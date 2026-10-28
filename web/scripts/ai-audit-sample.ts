// Local, read-only monthly audit. Only --out writes; no Worker, auth or ai-batch CLI import.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { easternDate, expectedSessions } from "../src/lib/calendar.ts";
import type { BatchKind, BatchManifest, Receipt, Task } from "./ai-batch-lib.ts";

const TARGETS = { digest: 10, translate: 10, points: 10 };
const SLOTS = ["SPX", "tone:positive", "tone:negative", "tone:neutral", "news-insufficient", "earnings"] as const;
type Slot = typeof SLOTS[number];
type Category = keyof typeof TARGETS;
type Status = "ok" | "partial" | "failed" | "unknown";
type Source = { runId: string | null; directory: string; taskId: string | null };
type Item = { key: string; sha256: string; source: Source; tone: string | null; newsCount: number | null; earnings: boolean | null };
type Reason = { type: "missing" | "rejected" | "unavailable" | "case"; detail: string; source: Source | null };
type Batch = { kind: BatchKind; directory: string; date: string | null; manifest: BatchManifest | undefined; tasks: Task[]; answers: Record<string, unknown>; receipt: Receipt | undefined };

class UsageError extends Error {}

function category(key: string): Category {
  if (/^digest:[^:]+:\d{4}-\d{2}-\d{2}$/.test(key)) return "digest";
  if (/^translate:[^:]+$/.test(key)) return "translate";
  if (/^points:[^:]+$/.test(key)) return "points";
  throw new UsageError(`不是 L2 回執鍵：${key}`);
}

function options(args: string[]) {
  let month = "";
  let batches: string | undefined;
  let out: string | undefined;
  const cases: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!["--month", "--batches", "--out", "--case"].includes(flag)) throw new UsageError(`未知參數：${flag}`);
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new UsageError(`${flag} 缺少值`);
    if (flag === "--month") month = value;
    if (flag === "--batches") batches = value;
    if (flag === "--out") out = value;
    if (flag === "--case") {
      cases.push(value);
      while (args[i + 1] && !args[i + 1].startsWith("--")) cases.push(args[++i]);
    }
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new UsageError("--month 必須是 YYYY-MM");
  cases.forEach(category);
  return { month, batches, cases: [...new Set(cases)].sort(), out };
}

function defaultBatches(): string {
  const list = execFileSync("git", ["worktree", "list", "--porcelain", "-z"], { cwd: join(import.meta.dirname, "../.."), encoding: "utf8" });
  const first = list.split("\0")[0];
  if (!first.startsWith("worktree ")) throw new Error("git worktree list 沒有主 checkout");
  return join(first.slice("worktree ".length), "web/.ai-batch");
}

function protectBatchFiles(out: string, batches: string) {
  if (lstatSync(out, { throwIfNoEntry: false })?.isSymbolicLink()) throw new UsageError("--out 不可為符號連結，以免覆寫批次證據");
  const output = join(realpathSync(dirname(resolve(out))), basename(out));
  let root: string;
  try {
    root = realpathSync(batches);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    root = resolve(batches);
  }
  const path = relative(root, output);
  if (!path || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))) {
    throw new UsageError("--out 必須在唯讀批次目錄之外");
  }
}

// L2 archives may lack pre-manifest files, and unpushed working batches have no receipt.
function readJson<T>(file: string): T | undefined {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return JSON.parse(text) as T;
}

function runDirectories(root: string, kind: BatchKind): string[] {
  try {
    return readdirSync(join(root, kind, "runs"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).map((entry) => `${kind}/runs/${entry.name}`).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function loadBatches(root: string): Batch[] {
  const batches: Batch[] = [];
  for (const kind of ["daily", "translate"] as const) {
    for (const directory of [...runDirectories(root, kind), kind]) {
      const dir = join(root, directory);
      const manifest = readJson<BatchManifest>(join(dir, "manifest.json"));
      const tasks = readJson<Task[]>(join(dir, "tasks.json"));
      const answers = readJson<Record<string, unknown>>(join(dir, "answers.json"));
      const receipt = readJson<Receipt>(join(dir, "receipt.json"));
      if (!manifest && !tasks && !answers && !receipt) continue;
      const date = kind === "daily" ? manifest?.snapshot?.date ?? null : manifest?.pulledAt.slice(0, 10) ?? null;
      batches.push({ kind, directory, date, manifest, tasks: tasks ?? [], answers: answers ?? {}, receipt });
    }
  }
  // The latest accepted version supplies the traits when a receipt key was written again.
  return batches.sort((a, b) => compare(a.manifest?.pushedAt ?? a.manifest?.pulledAt ?? "", b.manifest?.pushedAt ?? b.manifest?.pulledAt ?? "") || compare(a.directory, b.directory));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function taskKeys(task: Task): string[] {
  const meta = task.meta;
  if (meta.type === "translate") return meta.ids.map((id) => `translate:${id}`);
  if (meta.type === "points") return [`points:${meta.id}`];
  return [`digest:${meta.key}:${meta.date}`];
}

function source(batch: Batch, task?: Task): Source {
  return { runId: batch.manifest?.runId ?? null, directory: batch.directory, taskId: task?.id ?? null };
}

function traits(task: Task | undefined, raw: unknown) {
  if (task?.meta.type !== "digest") return { tone: null, newsCount: null, earnings: null };
  const answer = typeof raw === "string" ? JSON.parse(raw) as { tone?: string } : raw as { tone?: string } | undefined;
  // Count both timing sections: newsIds records only confirmed pre-close sources in L2.
  const newsCount = [...task.prompt.user.matchAll(/^\d+\. /gm)].length;
  const earnings = /^\d+\. [^\n]*（財報／[^）\n]+）$/m.test(task.prompt.user);
  return { tone: answer?.tone ?? null, newsCount, earnings };
}

function matches(item: Item, slot: Slot): boolean {
  if (slot === "SPX") return item.key.startsWith("digest:SPX:");
  if (slot.startsWith("tone:")) return item.tone === slot.slice(5);
  if (slot === "news-insufficient") return item.newsCount === (item.key.startsWith("digest:SPX:") ? 0 : 1);
  return item.earnings === true;
}

function coverageFor(batches: Batch[], date: string, kind: BatchKind) {
  const runs = batches.filter((batch) => batch.date === date && batch.kind === kind).map((batch) => ({
    runId: batch.manifest?.runId ?? null, directory: batch.directory, status: batch.receipt?.run?.status ?? "unknown" as Status,
  }));
  // Preserve every receipt and show the worst state, so a later ok does not hide a gap.
  const status = !runs.length ? "missing" : (["failed", "partial", "unknown", "ok"] as const).find((state) => runs.some((run) => run.status === state))!;
  return { status, batches: runs };
}

function audit(month: string, batches: Batch[], cases: string[]) {
  const from = `${month}-01`;
  const monthEnd = new Date(`${month}-01T12:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const to = [monthEnd.toISOString().slice(0, 10), easternDate()].sort()[0];
  let sessions: string[];
  try {
    sessions = from > to ? [] : expectedSessions(from, to);
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
  const selectedBatches = batches.filter((batch) => batch.date?.startsWith(`${month}-`) && batch.date <= to);
  const accepted = new Map<string, Item>();
  const problems = new Map<string, { key: string; reasons: Reason[] }>();
  function problem(key: string, reason: Reason) {
    if (!problems.has(key)) problems.set(key, { key, reasons: [] });
    const reasons = problems.get(key)!.reasons;
    if (!reasons.some((existing) => JSON.stringify(existing) === JSON.stringify(reason))) reasons.push(reason);
  }
  for (const batch of selectedBatches) {
    const tasks = new Map(batch.tasks.flatMap((task) => taskKeys(task).map((key) => [key, task] as const)));
    for (const task of batch.tasks) {
      if (!Object.hasOwn(batch.answers, task.id)) {
        for (const key of taskKeys(task)) problem(key, { type: "missing", detail: "answers.json 缺少任務答案", source: source(batch, task) });
      }
    }
    for (const { key, reason } of batch.receipt?.rejected ?? []) problem(key, { type: "rejected", detail: reason, source: source(batch, tasks.get(key)) });
    for (const { key, reason } of batch.manifest?.unavailable ?? []) problem(key, { type: "unavailable", detail: reason, source: source(batch, tasks.get(key)) });
    for (const key of batch.receipt?.accepted ?? []) {
      category(key);
      const task = tasks.get(key);
      accepted.set(key, { key, sha256: createHash("sha256").update(`${month}|${key}`).digest("hex"), source: source(batch, task), ...traits(task, task && batch.answers[task.id]) });
    }
  }
  // Keep all accepted evidence, including a successful retry of an earlier problem key.
  const population: Record<Category, Item[]> = { digest: [], translate: [], points: [] };
  for (const item of accepted.values()) population[category(item.key)].push(item);
  for (const key of cases) problem(key, { type: "case", detail: "使用者指定回執鍵", source: accepted.get(key)?.source ?? null });
  for (const items of Object.values(population)) items.sort((a, b) => compare(a.sha256, b.sha256) || compare(a.key, b.key));

  const samples: Record<Category, string[]> = { digest: [], translate: [], points: [] };
  const missingSlots: Slot[] = [];
  const eligible = (kind: Category) => population[kind].filter((item) => !problems.has(item.key));
  const digest = eligible("digest");
  for (const slot of SLOTS) {
    const item = digest.find((item) => !samples.digest.includes(item.key) && matches(item, slot));
    if (item) samples.digest.push(item.key);
    else missingSlots.push(slot);
  }
  for (const kind of ["digest", "translate", "points"] as const) {
    for (const item of eligible(kind)) {
      if (samples[kind].length >= TARGETS[kind]) break;
      if (!samples[kind].includes(item.key)) samples[kind].push(item.key);
    }
  }
  const shortage = (kind: Category) => ({ target: TARGETS[kind], available: eligible(kind).length, sampled: samples[kind].length, missing: Math.max(0, TARGETS[kind] - samples[kind].length) });
  return {
    month,
    rules: {
      sort: 'sha256("<YYYY-MM>|<回執鍵>") 升冪；同 hash 時以回執鍵升冪',
      targets: TARGETS,
      policy: "維護政策，非統計樣本量；可調整腳本的 TARGETS",
      digestSlots: [...SLOTS],
      selection: "digest 逐格取排序最前且未選者，缺格記不足，再依排序補足；translate、points 依排序選取",
      newsInsufficient: "公司 prompt 只有 1 則新聞；SPX prompt 的大盤新聞標題 0 則（含盤後與時間不明輸入）",
      earnings: "公司 prompt 的新聞分類含「財報」，不以標題關鍵字判斷",
      population: "只採 receipt.accepted，回執鍵去重；missing、rejected、unavailable 與 --case 另列問題案例，不占樣本名額；若另批曾 accepted，其寫入證據仍保留在全集",
      duplicateKeys: "重複 accepted 回執鍵取 manifest.pushedAt（尚未記錄則 pulledAt）最後者；同時間依批次目錄升冪取最後者",
      coverage: "交易日到美東今天；daily 用 snapshot.date，translate 用 pulledAt 日期；只讀 receipt.run.status，同日保留所有批次且呈現最差狀態",
      evidence: "無回執狀態為 unknown，無日期批次另列不可判定；缺檔或已清除的歷史不能證明是否寫入，不以 Orca completed 或檔案 mtime 推定",
    },
    coverage: {
      from, to,
      sessions: sessions.map((date) => ({ date, daily: coverageFor(selectedBatches, date, "daily"), translate: coverageFor(selectedBatches, date, "translate") })),
      undatedBatches: batches.filter((batch) => batch.date === null).map((batch) => ({ ...source(batch), reason: "缺 manifest 或 daily snapshot.date，無法判定月份與交易日" })),
    },
    population,
    samples,
    shortages: { digest: { ...shortage("digest"), slots: missingSlots }, translate: shortage("translate"), points: shortage("points") },
    problemCases: [...problems.values()].sort((a, b) => compare(a.key, b.key)),
  };
}

export type AuditReport = ReturnType<typeof audit>;

try {
  const args = options(process.argv.slice(2));
  const batches = args.batches ?? defaultBatches();
  if (args.out) protectBatchFiles(args.out, batches);
  const result = audit(args.month, loadBatches(batches), args.cases);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (args.out) writeFileSync(args.out, json);
  else process.stdout.write(json);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof UsageError) console.error("用法：node scripts/ai-audit-sample.ts --month YYYY-MM [--batches <目錄>] [--case <回執鍵> …] [--out <檔>]");
  process.exitCode = error instanceof UsageError ? 2 : 1;
}
