import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { buildDailyTasks, buildTranslateTasks, type BatchKind, type BatchManifest, type DailyWork, type Receipt, type Task } from "../scripts/ai-batch-lib.ts";
import type { AuditReport } from "../scripts/ai-audit-sample.ts";
import { easternDate, expectedSessions } from "../src/lib/calendar.ts";

const script = join(import.meta.dirname, "../scripts/ai-audit-sample.ts");
const month = "2026-09";
const date = `${month}-18`;
const digestKey = (symbol: string) => `digest:${symbol}:${date}`;
const hash = (key: string) => createHash("sha256").update(`${month}|${key}`).digest("hex");
const byHash = (keys: string[]) => [...keys].sort((a, b) => hash(a).localeCompare(hash(b)));

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "mo-ai-audit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

async function run(root: string, args: string[] = [], env = process.env, nodeArgs: string[] = []) {
  return execute(["--month", month, "--batches", root, ...args], env, nodeArgs);
}

async function execute(args: string[], env = process.env, nodeArgs: string[] = []) {
  const child = spawn(process.execPath, [...nodeArgs, script, ...args], { env });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stderr.on("data", (d) => (stderr += d));
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  return { code, stdout, stderr };
}

async function report(root: string, args: string[] = []) {
  const result = await run(root, args);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout) as AuditReport;
}

function save(root: string, kind: BatchKind, id: string, tasks: Task[], answers: Record<string, unknown>, accepted: string[], options: {
  working?: boolean; day?: string; pulledAt?: string; status?: "ok" | "partial" | "failed";
  rejected?: { key: string; reason: string }[]; unavailable?: BatchManifest["unavailable"]; noReceipt?: boolean;
} = {}) {
  const dir = options.working ? join(root, kind) : join(root, kind, "runs", id);
  mkdirSync(dir, { recursive: true });
  const manifest: BatchManifest = {
    runId: id, kind, pulledAt: options.pulledAt ?? `${options.day ?? date}T22:00:00Z`, unavailable: options.unavailable ?? [],
    ...(kind === "daily" ? { snapshot: { date: options.day ?? date, revision: 1 } } : {}),
  };
  const receipt: Receipt = {
    translated: accepted.filter((key) => key.startsWith("translate:")).length,
    points: accepted.filter((key) => key.startsWith("points:")).length,
    digests: accepted.filter((key) => key.startsWith("digest:")).length,
    skipped: [], accepted, rejected: options.rejected ?? [], run: { id: 1, status: options.status ?? "ok" },
  };
  for (const [file, value] of Object.entries({ "tasks.json": tasks, "answers.json": answers, "manifest.json": manifest, ...(!options.noReceipt && { "receipt.json": receipt }) })) {
    writeFileSync(join(dir, file), JSON.stringify(value, null, 2));
  }
  return dir;
}

async function digests(specs: { symbol: string; tone?: string; count?: number; earnings?: boolean; unconfirmed?: number }[]) {
  const news = <T extends "before-close" | "after-close">(symbol: string, n: number, category: string, timing: T) => ({
    id: `nasdaq:${symbol}-${n}`, titleZh: "合成新聞", title: "Synthetic news", summary: null, tone: "neutral", category, timing,
  });
  const work: DailyWork = { date, points: [], market: null, digests: [] };
  for (const { symbol, count = 2, earnings = false, unconfirmed = 0 } of specs) {
    if (symbol === "SPX") {
      work.market = {
        date, close: 6000, changePts: 1, returnPct: 0.1, vix: 20, vixChange: 0, spreadPct: 0, movers: [], restPts: 1,
        news: Array.from({ length: count }, () => "合成大盤標題"), newsIds: Array.from({ length: count }, (_, i) => `nasdaq:market-${i}`),
        unconfirmed: Array.from({ length: unconfirmed }, (_, i) => ({ id: `nasdaq:late-${i}`, title: "盤後標題", timing: "after-close" })),
      };
    } else {
      work.digests.push({
        key: symbol, company: "合成公司", date, returnPct: 1, contributionPts: 1,
        news: Array.from({ length: count }, (_, i) => news(symbol, i, earnings ? "財報" : "產品與業務", "before-close")),
        unconfirmed: Array.from({ length: unconfirmed }, (_, i) => news(symbol, 100 + i, earnings ? "財報" : "產品與業務", "after-close")),
      });
    }
  }
  const { tasks } = await buildDailyTasks(work, async () => { throw new Error("不應擷取正文"); });
  const answers = Object.fromEntries(tasks.map((task) => {
    assert.equal(task.meta.type, "digest");
    const spec = specs.find((s) => task.meta.type === "digest" && s.symbol === task.meta.key)!;
    return [task.id, { summary: "合成摘要", tone: spec.tone ?? "neutral" }];
  }));
  return { tasks, answers, accepted: specs.map((s) => digestKey(s.symbol)) };
}

test("相同輸入逐字重現；保存全集、六格依序選未選者，再以 hash 補足十篇", async (t) => {
  const root = fixture(t);
  const specs = [
    { symbol: "SPX", tone: "neutral", count: 0 },
    { symbol: "POS", tone: "positive" }, { symbol: "NEG", tone: "negative" },
    { symbol: "NEU", tone: "neutral" }, { symbol: "FEW", count: 1 }, { symbol: "EARN", earnings: true },
    ...Array.from({ length: 9 }, (_, i) => ({ symbol: `OTHER${i}`, tone: "positive" })),
  ];
  const batch = await digests(specs);
  save(root, "daily", "daily-all", batch.tasks, batch.answers, batch.accepted);
  const first = await run(root);
  const second = await run(root);
  assert.equal(first.code, 0, first.stderr);
  assert.equal(first.stdout, second.stdout);
  const r = JSON.parse(first.stdout) as AuditReport;
  assert.deepEqual(Object.keys(r), ["month", "rules", "coverage", "population", "samples", "shortages", "problemCases"]);
  assert.deepEqual(r.population.digest.map((item) => item.key), byHash(batch.accepted));
  for (const item of r.population.digest) assert.equal(item.sha256, hash(item.key));
  const selected: string[] = [];
  const sorted = byHash(batch.accepted);
  const predicates = [
    (s: typeof specs[number]) => s.symbol === "SPX",
    (s: typeof specs[number]) => s.tone === "positive",
    (s: typeof specs[number]) => s.tone === "negative",
    (s: typeof specs[number]) => (s.tone ?? "neutral") === "neutral",
    (s: typeof specs[number]) => s.symbol === "SPX" ? s.count === 0 : s.count === 1,
    (s: typeof specs[number]) => s.earnings === true,
  ];
  for (const predicate of predicates) {
    selected.push(sorted.find((key) => !selected.includes(key) && predicate(specs.find((s) => digestKey(s.symbol) === key)!))!);
  }
  selected.push(...sorted.filter((key) => !selected.includes(key)).slice(0, 10 - selected.length));
  assert.deepEqual(r.samples.digest, selected);
  assert.equal(r.samples.digest.length, 10);
  assert.deepEqual(r.shortages.digest.slots, []);
  assert.equal(r.shortages.digest.missing, 0);
});

test("只有四篇 accepted digest：全部選取，記數量不足與缺格", async (t) => {
  const root = fixture(t);
  const b = await digests(["A", "B", "C", "D"].map((symbol) => ({ symbol, tone: "positive" })));
  save(root, "daily", "daily-four", b.tasks, b.answers, b.accepted);
  const r = await report(root);
  assert.deepEqual(new Set(r.samples.digest), new Set(b.accepted));
  assert.equal(r.shortages.digest.missing, 6);
  assert.deepEqual(r.shortages.digest.slots, ["SPX", "tone:negative", "tone:neutral", "news-insufficient", "earnings"]);
});

test("rejected、missing、unavailable 不進母體；同鍵 missing 與 rejected 合併並保存兩個原因", async (t) => {
  const root = fixture(t);
  const b = await digests(["GOOD", "REJECT", "MISSING", "UNAVAILABLE"].map((symbol) => ({ symbol })));
  const missing = b.tasks.find((task) => task.meta.type === "digest" && task.meta.key === "MISSING")!;
  delete b.answers[missing.id];
  save(root, "daily", "daily-problems", b.tasks, b.answers, [digestKey("GOOD")], {
    status: "partial", rejected: [{ key: digestKey("REJECT"), reason: "格式不符" }, { key: digestKey("MISSING"), reason: "缺答案" }],
    unavailable: [{ key: digestKey("UNAVAILABLE"), reason: "fetch-failed" }],
  });
  const r = await report(root);
  assert.deepEqual(r.population.digest.map((item) => item.key), [digestKey("GOOD")]);
  assert.deepEqual(r.problemCases.map((item) => item.key).sort(), ["REJECT", "MISSING", "UNAVAILABLE"].map(digestKey).sort());
  const problem = r.problemCases.find((item) => item.key === digestKey("MISSING"))!;
  assert.deepEqual(problem.reasons.map((reason) => reason.type), ["missing", "rejected"]);
  assert.equal(problem.reasons[1].detail, "缺答案");
  assert.equal(r.problemCases.find((item) => item.key === digestKey("UNAVAILABLE"))!.reasons[0].detail, "fetch-failed");
});

test("--case 支援多鍵與重複旗標：另列問題案例、不占十篇名額", async (t) => {
  const root = fixture(t);
  const b = await digests(Array.from({ length: 12 }, (_, i) => ({ symbol: `S${i}` })));
  save(root, "daily", "daily-cases", b.tasks, b.answers, b.accepted);
  const key = "digest:NVDA:2026-11-18";
  const r = await report(root, ["--case", key, b.accepted[0], "--case", key]);
  assert.deepEqual(r.problemCases.map((item) => item.key).sort(), [key, b.accepted[0]].sort());
  assert.ok(!r.samples.digest.includes(key));
  assert.ok(!r.samples.digest.includes(b.accepted[0]));
  assert.equal(r.samples.digest.length, 10);
  assert.ok(r.population.digest.some((item) => item.key === b.accepted[0]), "全集保留 accepted 的使用者回報項目");
});

test("覆蓋用 daily snapshot.date 與 translate pulledAt；保留 partial、failed、無回執與缺日", async (t) => {
  const root = fixture(t);
  const b = await digests([{ symbol: "A" }]);
  save(root, "daily", "daily-ok", b.tasks, b.answers, b.accepted, { pulledAt: "2026-10-01T01:00:00Z" });
  save(root, "daily", "daily-partial", [], {}, [], { day: "2026-09-21", status: "partial" });
  save(root, "daily", "daily-failed", [], {}, [], { day: "2026-09-22", status: "failed" });
  save(root, "daily", "daily-unpushed", b.tasks, {}, [], { day: "2026-09-23", noReceipt: true });
  save(root, "translate", "translate-ok", [], {}, [], { day: "2026-09-21" });
  save(root, "daily", "other-month", b.tasks, b.answers, [digestKey("OUTSIDE")], { day: "2026-08-31" });
  const r = await report(root);
  assert.deepEqual(r.coverage.sessions.map((day) => day.date), expectedSessions("2026-09-01", "2026-09-30"));
  const day = (d: string) => r.coverage.sessions.find((item) => item.date === d)!;
  assert.equal(day(date).daily.status, "ok");
  assert.equal(day(date).translate.status, "missing");
  assert.equal(day("2026-09-21").daily.status, "partial");
  assert.equal(day("2026-09-21").translate.status, "ok");
  assert.equal(day("2026-09-22").daily.status, "failed");
  assert.equal(day("2026-09-23").daily.status, "unknown");
  assert.equal(day("2026-09-24").daily.status, "missing");
  assert.ok(!r.population.digest.some((item) => item.key === digestKey("OUTSIDE")));
});

for (const { id, pulledAt, day } of [
  { id: "friday", pulledAt: "2026-09-19T00:20:00Z", day: "2026-09-18" },
  { id: "month-end", pulledAt: "2026-10-01T00:20:00Z", day: "2026-09-30" },
]) {
  test(`translate ${id} 批次以 pulledAt 的美東日期歸入覆蓋與當月母體`, async (t) => {
    const root = fixture(t);
    const key = `translate:nasdaq:${id}`;
    save(root, "translate", id, [], {}, [key], { pulledAt });
    const r = await report(root);
    assert.deepEqual(r.coverage.sessions.find((item) => item.date === day)!.translate, {
      status: "ok", batches: [{ runId: id, directory: `translate/runs/${id}`, status: "ok" }],
    });
    assert.deepEqual(r.samples.translate, [key]);
    if (id === "month-end") {
      const nextMonth = await report(root, ["--month", "2026-10"]);
      assert.deepEqual(nextMonth.population.translate, []);
    }
  });
}

test("空且無回執的工作批次不把同日已成功的 daily、translate 覆蓋降為 unknown", async (t) => {
  const root = fixture(t);
  const b = await digests([{ symbol: "AAPL" }]);
  save(root, "daily", "daily-ok", b.tasks, b.answers, b.accepted);
  save(root, "translate", "translate-ok", [], {}, ["translate:nasdaq:1"]);
  save(root, "daily", "daily-empty", [], {}, [], { working: true, noReceipt: true, pulledAt: "2026-10-01T01:00:00Z" });
  save(root, "translate", "translate-empty", [], {}, [], { working: true, noReceipt: true, pulledAt: `${date}T23:00:00Z` });
  const r = await report(root);
  const day = r.coverage.sessions.find((day) => day.date === date)!;
  for (const kind of ["daily", "translate"] as const) {
    assert.deepEqual(day[kind], { status: "ok", batches: [{ runId: `${kind}-ok`, directory: `${kind}/runs/${kind}-ok`, status: "ok" }] });
  }
  assert.deepEqual(r.population.digest.map((item) => item.key), b.accepted);
  assert.deepEqual(r.samples.translate, ["translate:nasdaq:1"]);
  assert.deepEqual(r.problemCases, []);
});

test("只有空且無回執的批次時，當日覆蓋列為 missing", async (t) => {
  const root = fixture(t);
  for (const kind of ["daily", "translate"] as const) save(root, kind, "empty", [], {}, [], { working: true, noReceipt: true });
  const r = await report(root);
  const day = r.coverage.sessions.find((day) => day.date === date)!;
  assert.deepEqual(day.daily, { status: "missing", batches: [] });
  assert.deepEqual(day.translate, { status: "missing", batches: [] });
});

test("空 daily 工作批次的 unavailable 仍列問題案例，無回執時不算覆蓋", async (t) => {
  const root = fixture(t);
  const key = "points:nasdaq:28651961";
  save(root, "daily", "daily-unavailable", [], {}, [], {
    working: true, noReceipt: true, unavailable: [{ key, reason: "no-match" }],
  });
  const r = await report(root);
  assert.deepEqual(r.problemCases, [{
    key,
    reasons: [{ type: "unavailable", detail: "no-match", source: { runId: "daily-unavailable", directory: "daily", taskId: null } }],
  }]);
  const day = r.coverage.sessions.find((day) => day.date === date)!;
  assert.deepEqual(day.daily, { status: "missing", batches: [] });
});

test("空且無日期的 daily 工作批次含 unavailable 時仍列為不可判定", async (t) => {
  const root = fixture(t);
  const dir = save(root, "daily", "daily-undated-unavailable", [], {}, [], {
    working: true, noReceipt: true, unavailable: [{ key: "points:nasdaq:28651961", reason: "no-match" }],
  });
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as BatchManifest;
  manifest.snapshot = { date: null, revision: null };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
  const r = await report(root);
  assert.deepEqual(r.coverage.undatedBatches, [{
    runId: "daily-undated-unavailable", directory: "daily", taskId: null,
    reason: "缺 manifest 或 daily snapshot.date，無法判定月份與交易日",
  }]);
});

test("只有 tasks.json=[] 的舊版 daily 目錄不列入 undatedBatches", async (t) => {
  const root = fixture(t);
  mkdirSync(join(root, "daily"));
  writeFileSync(join(root, "daily/tasks.json"), "[]");
  const r = await report(root);
  assert.deepEqual(r.coverage.undatedBatches, []);
});

test("HOME 空白、無帳密、禁止網路與子程序仍能執行", async (t) => {
  const root = fixture(t);
  const home = join(root, "home");
  mkdirSync(home);
  const guard = join(root, "offline.mjs");
  writeFileSync(guard, `
    import net from 'node:net';
    import child from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const denied = () => { throw new Error('禁止網路或登入子程序'); };
    globalThis.fetch = denied;
    net.Socket.prototype.connect = denied;
    for (const name of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync']) child[name] = denied;
    syncBuiltinESMExports();
  `);
  const b = await digests([{ symbol: "OFFLINE" }]);
  save(root, "daily", "daily-offline", b.tasks, b.answers, b.accepted);
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, PATH: "" };
  delete env.MO_EMAIL;
  delete env.MO_PASSWORD;
  const r = await run(root, [], env, ["--import", guard]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal((JSON.parse(r.stdout) as AuditReport).population.digest.length, 1);
  assert.deepEqual(readdirSync(home), []);
});

test("最新 working batch 與 runs 歸檔都納入；字串形式答案也能讀 tone", async (t) => {
  const root = fixture(t);
  const old = await digests([{ symbol: "OLD" }]);
  const latest = await digests([{ symbol: "LATEST", tone: "negative" }]);
  save(root, "daily", "daily-old", old.tasks, old.answers, old.accepted);
  const dir = save(root, "daily", "daily-latest", latest.tasks, Object.fromEntries(Object.entries(latest.answers).map(([key, answer]) => [key, JSON.stringify(answer)])), latest.accepted, { working: true });
  const before = ["tasks.json", "answers.json", "manifest.json", "receipt.json"].map((file) => readFileSync(join(dir, file), "utf8"));
  const r = await report(root);
  assert.deepEqual(new Set(r.population.digest.map((item) => item.key)), new Set([...old.accepted, ...latest.accepted]));
  const item = r.population.digest.find((item) => item.key === digestKey("LATEST"))!;
  assert.equal(item.tone, "negative");
  assert.equal(item.source.directory, "daily");
  assert.deepEqual(["tasks.json", "answers.json", "manifest.json", "receipt.json"].map((file) => readFileSync(join(dir, file), "utf8")), before);
});

test("新聞不足計入盤後輸入，大盤零標題與公司僅一則以當時 prompt 為準", async (t) => {
  const root = fixture(t);
  const b = await digests([{ symbol: "SPX", count: 0, unconfirmed: 1 }, { symbol: "TWO", count: 1, unconfirmed: 1 }, { symbol: "LATE", count: 0, unconfirmed: 1, earnings: true }]);
  save(root, "daily", "daily-timing", b.tasks, b.answers, b.accepted);
  const r = await report(root);
  assert.deepEqual(r.population.digest.map((item) => [item.key, item.newsCount]).sort(), [[digestKey("SPX"), 1], [digestKey("TWO"), 2], [digestKey("LATE"), 1]].sort());
  assert.ok(r.population.digest.find((item) => item.key === digestKey("LATE"))!.earnings);
  assert.ok(!r.shortages.digest.slots.includes("news-insufficient"));
});

test("translate 與 points 各十則，以 accepted 回執鍵排序且同鍵去重", async (t) => {
  const root = fixture(t);
  const ids = Array.from({ length: 14 }, (_, i) => `nasdaq:${i}`);
  const tasks = buildTranslateTasks(ids.map((id) => ({ id, title: "Synthetic title", summary: null, symbols: ["AAPL"], primarySymbol: "AAPL" })));
  const translations = ids.map((id) => `translate:${id}`);
  const points = ids.map((id) => `points:${id}`);
  save(root, "translate", "translate-first", tasks, { [tasks[0].id]: { items: [] } }, translations);
  save(root, "translate", "translate-second", tasks, { [tasks[0].id]: { items: [] } }, translations, { working: true });
  save(root, "daily", "daily-points", [], {}, points);
  const r = await report(root);
  assert.deepEqual(r.population.translate.map((item) => item.key), byHash(translations));
  assert.deepEqual(r.population.points.map((item) => item.key), byHash(points));
  assert.deepEqual(r.samples.translate, byHash(translations).slice(0, 10));
  assert.deepEqual(r.samples.points, byHash(points).slice(0, 10));
});

test("--case 接受含冒號與網址的新聞回執鍵，保留 accepted 全集但不抽樣", async (t) => {
  const root = fixture(t);
  const keys = ["translate:nasdaq:1", "translate:nasdaq:https://www.nasdaq.com/x", "points:nasdaq:1", "points:nasdaq:https://www.nasdaq.com/x"];
  save(root, "translate", "translate-cases", [], {}, keys.slice(0, 2));
  save(root, "daily", "points-cases", [], {}, keys.slice(2));
  const r = await report(root, ["--case", ...keys]);
  assert.deepEqual(r.population.translate.map((item) => item.key), byHash(keys.slice(0, 2)));
  assert.deepEqual(r.population.points.map((item) => item.key), byHash(keys.slice(2)));
  assert.deepEqual(r.problemCases.map((item) => item.key), [...keys].sort());
  for (const item of r.problemCases) assert.deepEqual(item.reasons.map((reason) => reason.type), ["case"]);
  assert.deepEqual(r.samples.translate, []);
  assert.deepEqual(r.samples.points, []);
});

test("accepted 回執鍵格式錯誤是資料錯誤：exit 1，不印參數用法", async (t) => {
  const root = fixture(t);
  save(root, "translate", "invalid-key", [], {}, ["invalid-accepted-key"]);
  const r = await run(root);
  assert.equal(r.code, 1, r.stderr);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /不是 L2 回執鍵：invalid-accepted-key/);
  assert.doesNotMatch(r.stderr, /用法/);
});

test("未推送批次不產生 missing，同鍵在另一批 accepted 後仍可抽樣", async (t) => {
  const news = { id: "nasdaq:1", title: "Synthetic title", url: "https://example.test/article", summary: null, symbols: ["AAPL"], primarySymbol: "AAPL" };
  const translateTasks = buildTranslateTasks([news]);
  const digest = await digests([{ symbol: "AAPL" }]);
  const { tasks: pointTasks } = await buildDailyTasks({ date, points: [news], market: null, digests: [] }, async () => ({ body: "合成正文", url: "https://example.test/article", truncated: false }));
  const batches = [
    { kind: "translate" as const, tasks: translateTasks, answers: { [translateTasks[0].id]: { items: [] } }, accepted: ["translate:nasdaq:1"] },
    { kind: "daily" as const, tasks: [...digest.tasks, ...pointTasks], answers: { ...digest.answers, [pointTasks[0].id]: { points: ["合成重點"], tone: "neutral" } }, accepted: [...digest.accepted, "points:nasdaq:1"] },
  ];
  for (const working of [false, true]) {
    await t.test(working ? "未推送工作目錄" : "未推送歸檔", async (t) => {
      const root = fixture(t);
      for (const batch of batches) {
        save(root, batch.kind, "unpushed", batch.tasks, {}, [], { working, noReceipt: true, pulledAt: `${date}T${working ? "23" : "21"}:00:00Z` });
        save(root, batch.kind, "accepted", batch.tasks, batch.answers, batch.accepted, { working: !working, pulledAt: `${date}T22:00:00Z` });
      }
      const r = await report(root);
      assert.deepEqual(r.problemCases, []);
      assert.deepEqual(r.samples.digest, [digestKey("AAPL")]);
      assert.deepEqual(r.samples.translate, ["translate:nasdaq:1"]);
      assert.deepEqual(r.samples.points, ["points:nasdaq:1"]);
      for (const kind of ["digest", "translate", "points"] as const) assert.equal(r.shortages[kind].available, 1);
      const day = r.coverage.sessions.find((day) => day.date === date)!;
      assert.equal(day.daily.status, "unknown");
      assert.equal(day.translate.status, "unknown");
    });
  }
});

test("同鍵拒收後成功：全集保留 accepted 與最新輸入，歷史問題仍另列且不占樣本", async (t) => {
  const root = fixture(t);
  const old = await digests([{ symbol: "RETRIED", tone: "positive" }]);
  const latest = await digests([{ symbol: "RETRIED", tone: "negative", count: 1 }]);
  const key = digestKey("RETRIED");
  save(root, "daily", "a-rejected", old.tasks, {}, [], { status: "failed", rejected: [{ key, reason: "缺答案" }], pulledAt: "2026-09-18T21:00:00Z" });
  save(root, "daily", "b-accepted", old.tasks, old.answers, [key], { pulledAt: "2026-09-18T22:00:00Z" });
  save(root, "daily", "latest", latest.tasks, latest.answers, [key], { working: true, pulledAt: "2026-09-18T23:00:00Z" });
  const r = await report(root);
  assert.equal(r.population.digest.length, 1);
  assert.equal(r.population.digest[0].tone, "negative");
  assert.equal(r.population.digest[0].newsCount, 1);
  assert.equal(r.population.digest[0].source.runId, "latest");
  assert.deepEqual(r.problemCases[0].reasons.map((reason) => reason.type), ["missing", "rejected"]);
  assert.deepEqual(r.samples.digest, []);
  assert.equal(r.coverage.sessions.find((day) => day.date === date)!.daily.status, "failed");
});

test("--out 與 stdout 位元組相同；空目錄與不存在的批次目錄 exit 0", async (t) => {
  const root = join(fixture(t), "batches");
  mkdirSync(root);
  const output = join(root, "../audit.json");
  const first = await run(root);
  const second = await run(root, ["--out", output]);
  assert.equal(first.code, 0, first.stderr);
  assert.equal(second.code, 0, second.stderr);
  assert.equal(second.stdout, "");
  assert.equal(readFileSync(output, "utf8"), first.stdout);
  const r = await report(join(root, "absent"));
  assert.deepEqual(r.population, { digest: [], translate: [], points: [] });
  assert.equal(r.shortages.digest.missing, 10);
});

test("當月交易日只列到今天（美東日期）", async (t) => {
  const root = fixture(t);
  const today = easternDate();
  const r = await report(root, ["--month", today.slice(0, 7)]);
  assert.deepEqual(r.coverage.sessions.map((day) => day.date), expectedSessions(`${today.slice(0, 7)}-01`, today));
});

test("錯誤參數 exit 2 且不輸出 JSON", async (t) => {
  const root = fixture(t);
  for (const args of [["--month", "2026-13"], ["--month", "26-09"], ["--month", "2026-09-01"], ["--month", "2024-01"], ["--out"], ["--batches"], ["--case"], ["--case", "NVDA"], ["--case", "translate:"], ["--case", "points:"], ["--unknown"], ["extra"]]) {
    const r = await run(root, args);
    assert.equal(r.code, 2, `${args}: ${r.stderr}`);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /用法/);
  }
  assert.equal((await execute(["--batches", root])).code, 2);
});

test("預設批次目錄取 git worktree 第一筆，支援主 checkout 路徑含空白", async (t) => {
  const root = fixture(t);
  const primary = join(root, "primary checkout");
  const secondary = join(root, "other checkout");
  const bin = join(root, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "git"), '#!/bin/sh\nprintf \'worktree %s\\0HEAD unused\\0\\0worktree %s\\0HEAD unused\\0\\0\' "$AUDIT_PRIMARY" "$AUDIT_SECONDARY"\n');
  chmodSync(join(bin, "git"), 0o755);
  const b = await digests([{ symbol: "PRIMARY" }]);
  save(join(primary, "web/.ai-batch"), "daily", "primary-run", b.tasks, b.answers, b.accepted);
  save(join(secondary, "web/.ai-batch"), "daily", "secondary-run", [], {}, [digestKey("WRONG")]);
  const r = await execute(["--month", month], { ...process.env, PATH: bin, AUDIT_PRIMARY: primary, AUDIT_SECONDARY: secondary });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual((JSON.parse(r.stdout) as AuditReport).population.digest.map((item) => item.key), b.accepted);
});

test("--out 不得覆寫批次證據，包含經符號連結指向批次的輸出路徑", async (t) => {
  const root = fixture(t);
  const batches = join(root, "batches");
  const b = await digests([{ symbol: "SAFE" }]);
  const dir = save(batches, "daily", "safe-run", b.tasks, b.answers, b.accepted);
  const receipt = join(dir, "receipt.json");
  const before = readFileSync(receipt, "utf8");
  const link = join(root, "receipt-link.json");
  symlinkSync(receipt, link);
  const alias = join(root, "alias");
  symlinkSync(batches, alias);
  for (const out of [receipt, link, join(alias, "new-report.json")]) {
    const r = await run(batches, ["--out", out]);
    assert.equal(r.code, 2, r.stderr);
    assert.equal(r.stdout, "");
    assert.equal(readFileSync(receipt, "utf8"), before);
  }
});
