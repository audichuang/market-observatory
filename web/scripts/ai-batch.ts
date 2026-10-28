// 新聞 AI 的本機排程：Orca 定時叫 Claude（訂閱，不用 API key）在這個 repo 跑，流程固定三步：
//   node scripts/ai-batch.ts pull <translate|daily>   從正式站拿待辦，寫出 .ai-batch/<kind>/tasks.md（沒事做就印「沒有待辦」）
//   （agent 讀 tasks.md，把每個任務的答案寫進 .ai-batch/<kind>/answers.json）
//   node scripts/ai-batch.ts push <translate|daily>   把答案送回正式站驗證、寫進 D1
// --check: daily only checks work (including pending translations); translate still writes the batch for Orca.
// push exits with 3 for missing/rejected answers. Successful HTTP responses are saved as receipt.json.
// 提示詞用 src/lib/news-ai.ts 的同一套（用語規則一致）；伺服器端見 src/server/ai-batch.ts、routes/api/admin/ai.ts。
// 帳密：MO_EMAIL／MO_PASSWORD，沒設就用 1Password 的 Agent vault（~/.config/op/agent-sa.env）。
import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { get as httpsGet } from "node:https";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { EnrichInput } from "../src/lib/news-ai.ts";
import { type BatchManifest, type DailyWork, type Receipt, type Task, type Unavailable, article, buildDailyTasks, buildTranslateTasks, createYahooSearch, hasDailyWork, preparePush, renderTasks, summarizeReceipt } from "./ai-batch-lib.ts";

const base = (process.env.MO_URL ?? "https://market-observatory.kzfvvwnwhp.workers.dev").replace(/\/$/, "");
const [cmd, kind] = process.argv.slice(2);
if (!["pull", "push"].includes(cmd) || (kind !== "translate" && kind !== "daily")) {
  console.error("用法：node scripts/ai-batch.ts <pull|push> <translate|daily>");
  process.exit(2);
}
const dir = join(process.env.MO_AI_BATCH_DIR ?? join(import.meta.dirname, "..", ".ai-batch"), kind);

function credentials(): { email: string; password: string } {
  if (process.env.MO_EMAIL && process.env.MO_PASSWORD) return { email: process.env.MO_EMAIL, password: process.env.MO_PASSWORD };
  const envFile = join(homedir(), ".config/op/agent-sa.env");
  const env = { ...process.env };
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Z_]+)=(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const item = JSON.parse(execFileSync("op", ["item", "get", "market-observatory 擁有者帳號", "--vault", "Agent", "--format", "json"], { env, encoding: "utf8" })) as {
    fields: { label: string; purpose?: string; value?: string }[];
  };
  const email = item.fields.find((f) => f.purpose === "USERNAME" || f.label === "username" || f.label === "email")?.value;
  const password = item.fields.find((f) => f.purpose === "PASSWORD")?.value;
  if (!email || !password) throw new Error("1Password 的站長帳號缺帳號或密碼");
  return { email, password };
}

async function signIn(): Promise<string> {
  const res = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(credentials()),
  });
  if (!res.ok) throw new Error(`登入失敗：HTTP ${res.status} ${await res.text()}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function api<T>(cookie: string, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Cookie: cookie, Origin: base, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}：HTTP ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

/** GET 一個網址的文字內容（最多跟 3 次轉址）。用 node:https 而不是 fetch：Yahoo 的回應 header 超過 fetch 的上限（UND_ERR_HEADERS_OVERFLOW）。 */
function getText(url: string, hops = 3): Promise<{ status: number; type: string; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html,application/json" }, maxHeaderSize: 65536, timeout: 10_000 }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location && hops > 0) {
        res.resume();
        resolve(getText(new URL(res.headers.location, url).href, hops - 1));
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => {
        if (body.length < 900_000) body += c;
      });
      res.on("end", () => resolve({ status, type: String(res.headers["content-type"] ?? ""), body }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

const searchYahoo = createYahooSearch(getText);
const readArticle = (title: string, symbols: string[]) => article(title, symbols, getText, searchYahoo);

async function buildTasks(cookie: string): Promise<{ tasks: Task[]; unavailable: Unavailable[] }> {
  if (kind === "translate") {
    const { translate } = await api<{ translate: EnrichInput[] }>(cookie, "GET", "/api/admin/ai?kind=translate");
    return { tasks: buildTranslateTasks(translate), unavailable: [] };
  }
  const work = await api<DailyWork>(cookie, "GET", "/api/admin/ai?kind=daily");
  return buildDailyTasks(work, readArticle);
}

function archivePrevious() {
  const tasksFile = join(dir, "tasks.json");
  if (!existsSync(tasksFile) || !JSON.parse(readFileSync(tasksFile, "utf8")).length) return;
  const manifestFile = join(dir, "manifest.json");
  const runId = existsSync(manifestFile)
    ? (JSON.parse(readFileSync(manifestFile, "utf8")) as { runId: string }).runId
    : `legacy-${statSync(tasksFile).mtime.toISOString()}`;
  mkdirSync(join(dir, "runs"), { recursive: true });
  const archive = join(dir, "runs", runId);
  // Refuse an existing destination rather than overwrite any archived evidence.
  mkdirSync(archive);
  for (const file of ["tasks.json", "tasks.md", "answers.json", "manifest.json", "receipt.json"]) {
    if (existsSync(join(dir, file))) renameSync(join(dir, file), join(archive, file));
  }
}

async function dailyPrecheck(cookie: string) {
  const work = await api<DailyWork>(cookie, "GET", "/api/admin/ai?kind=daily");
  if (await hasDailyWork(work, async (point) => "body" in (await readArticle(point.title, point.symbols)))) {
    console.log("每日有待辦（precheck 不寫檔，排程會再 pull 一次）");
    return;
  }
  const { translate } = await api<{ translate: EnrichInput[] }>(cookie, "GET", "/api/admin/ai?kind=translate");
  if (translate.length) {
    console.log(`每日沒有待辦，但有 ${translate.length} 則新聞待翻譯`);
  } else {
    console.log("每日沒有待辦，也沒有新聞待翻譯。");
    process.exitCode = 1;
  }
}

if (cmd === "pull") {
  const cookie = await signIn();
  if (kind === "daily" && process.argv.includes("--check")) {
    await dailyPrecheck(cookie);
  } else {
    const pulledAt = new Date().toISOString();
    const runId = `${kind}-${pulledAt.replace(/[-:.]/g, "")}-${randomInt(36 ** 4).toString(36).padStart(4, "0")}`;
    const { tasks, unavailable } = await buildTasks(cookie);
    for (const task of tasks) task.id += `-${runId.slice(-4)}`;
    archivePrevious();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "answers.json"), "{}\n");
    writeFileSync(join(dir, "tasks.json"), JSON.stringify(tasks, null, 2));
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ runId, kind, pulledAt, unavailable }, null, 2));
    if (!tasks.length) {
      writeFileSync(join(dir, "tasks.md"), "沒有待辦。\n");
      console.log(`沒有待辦（${kind}），不用做任何事。`);
      if (process.argv.includes("--check")) process.exitCode = 1;
    } else {
      writeFileSync(join(dir, "tasks.md"), renderTasks(tasks, kind, join(dir, "answers.json")));
      console.log(`${tasks.length} 個任務，讀 ${join(dir, "tasks.md")}，答案寫進 ${join(dir, "answers.json")}，再執行 push。`);
    }
  }
} else {
  const tasksFile = join(dir, "tasks.json");
  if (!existsSync(tasksFile)) throw new Error("沒有 tasks.json，先執行 pull");
  const tasks = JSON.parse(readFileSync(tasksFile, "utf8")) as Task[];
  if (!tasks.length) {
    console.log("沒有任務");
  } else {
    const answers = JSON.parse(readFileSync(join(dir, "answers.json"), "utf8")) as Record<string, unknown>;
    const manifestFile = join(dir, "manifest.json");
    // A batch pulled by the previous CLI has no manifest yet.
    const pulledAt = statSync(tasksFile).mtime.toISOString();
    const manifest: BatchManifest = existsSync(manifestFile)
      ? JSON.parse(readFileSync(manifestFile, "utf8"))
      : { runId: `legacy-${pulledAt}`, kind, pulledAt, unavailable: [] };
    const body = preparePush(tasks, answers, manifest, process.env.AI_BATCH_MODEL ?? "claude-orca");
    const cookie = await signIn();
    const receipt = await api<Receipt>(cookie, "POST", "/api/admin/ai", body);
    writeFileSync(join(dir, "receipt.json"), JSON.stringify(receipt, null, 2));
    const result = summarizeReceipt(receipt, body.run);
    console.log(result.message);
    process.exitCode = result.exitCode;
  }
}
