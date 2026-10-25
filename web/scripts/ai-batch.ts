// 新聞 AI 的本機排程：Orca 定時叫 Claude（訂閱，不用 API key）在這個 repo 跑，流程固定三步：
//   node scripts/ai-batch.ts pull <translate|daily>   從正式站拿待辦，寫出 .ai-batch/<kind>/tasks.md（沒事做就印「沒有待辦」）
//   （agent 讀 tasks.md，把每個任務的答案寫進 .ai-batch/<kind>/answers.json）
//   node scripts/ai-batch.ts push <translate|daily>   把答案送回正式站驗證、寫進 D1
// pull 加 --check：沒有待辦時以結束碼 1 結束，給 Orca 的 precheck 用（沒事做就不叫 agent，不花訂閱額度）。
// 提示詞用 src/lib/news-ai.ts 的同一套（用語規則一致）；伺服器端見 src/server/ai-batch.ts、routes/api/admin/ai.ts。
// 帳密：MO_EMAIL／MO_PASSWORD，沒設就用 1Password 的 Agent vault（~/.config/op/agent-sa.env）。
import { execFileSync } from "node:child_process";
import { get as httpsGet } from "node:https";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DIGEST_SCHEMA, ENRICH_SCHEMA, type EnrichInput, POINTS_SCHEMA, type Prompt, digestPrompt, enrichPrompt, extractArticleText, marketPrompt, matchYahooArticle, pointsPrompt } from "../src/lib/news-ai.ts";
import type { DigestWork, MarketWork } from "../src/server/ai-batch.ts";

const base = (process.env.MO_URL ?? "https://market-observatory.kzfvvwnwhp.workers.dev").replace(/\/$/, "");
const [cmd, kind] = process.argv.slice(2);
if (!["pull", "push"].includes(cmd) || !["translate", "daily"].includes(kind)) {
  console.error("用法：node scripts/ai-batch.ts <pull|push> <translate|daily>");
  process.exit(2);
}
const dir = join(import.meta.dirname, "..", ".ai-batch", kind);
const MARKET_KEY = "SPX";

/** 一個任務：給 agent 的提示詞與答案格式；meta 是送回伺服器用的，agent 不用管。 */
interface Task {
  id: string;
  title: string;
  prompt: Prompt;
  schema: unknown;
  meta: { type: "translate"; ids: string[] } | { type: "points"; id: string } | { type: "digest"; key: string; date: string; newsIds: string[] };
}

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

/** 每個代號的 Yahoo 新聞搜尋結果（同一次 pull 裡共用，同一家公司的幾則重點只搜一次）。 */
const yahooNews = new Map<string, Promise<{ title?: unknown; link?: unknown }[]>>();
function searchYahoo(symbol: string) {
  let p = yahooNews.get(symbol);
  if (!p) {
    p = getText(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=30&quotesCount=0`)
      .then((r) => (r.status === 200 ? ((JSON.parse(r.body) as { news?: { title?: unknown; link?: unknown }[] }).news ?? []) : []))
      .catch(() => []);
    yahooNews.set(symbol, p);
  }
  return p;
}

/**
 * 抓原文正文；抓不到回 null（這則就不寫重點）。Nasdaq 文章頁對機器回 403（Akamai），
 * 所以改在 Yahoo 用代號搜新聞、以標題對回同一篇轉載，抓 Yahoo 那頁。Zacks 等不在 Yahoo 的來源對不到。
 */
async function article(title: string, symbols: string[]): Promise<string | null> {
  for (const symbol of symbols.slice(0, 3)) {
    const url = matchYahooArticle(title, await searchYahoo(symbol));
    if (!url) continue;
    try {
      const res = await getText(url);
      return res.status === 200 && res.type.includes("html") ? extractArticleText(res.body) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

async function buildTasks(cookie: string): Promise<Task[]> {
  if (kind === "translate") {
    const { translate } = await api<{ translate: EnrichInput[] }>(cookie, "GET", "/api/admin/ai?kind=translate");
    return chunk(translate, 20).map((items, i) => ({
      id: `t${i + 1}`,
      title: `標題翻譯與分類（${items.length} 則）`,
      prompt: enrichPrompt(items),
      schema: ENRICH_SCHEMA,
      meta: { type: "translate", ids: items.map((x) => x.id) },
    }));
  }
  const work = await api<{
    date: string | null;
    points: { id: string; title: string; url: string; summary: string | null; symbols: string[] }[];
    digests: DigestWork[];
    market: MarketWork | null;
  }>(cookie, "GET", "/api/admin/ai?kind=daily");
  const tasks: Task[] = [];
  if (work.market) {
    const { newsIds, ...m } = work.market;
    tasks.push({ id: "m1", title: `大盤：${m.date} 為什麼漲跌`, prompt: marketPrompt(m), schema: DIGEST_SCHEMA, meta: { type: "digest", key: MARKET_KEY, date: m.date, newsIds } });
  }
  work.digests.forEach((d, i) =>
    tasks.push({
      id: `d${i + 1}`,
      title: `${d.company}（${d.key}）${d.date} 重點`,
      prompt: digestPrompt(d),
      schema: DIGEST_SCHEMA,
      meta: { type: "digest", key: d.key, date: d.date, newsIds: d.news.map((n) => n.id) },
    }),
  );
  // 抓不到原文就不寫：只靠標題寫出的重點等於把標題換句話說
  const bodies = await Promise.all(work.points.map((p) => article(p.title, p.symbols)));
  work.points.forEach((p, i) =>
    bodies[i] &&
    tasks.push({
      id: `p${i + 1}`,
      title: `文章重點：${p.title}`,
      prompt: pointsPrompt({ title: p.title, body: bodies[i], summary: p.summary, symbols: p.symbols }),
      schema: POINTS_SCHEMA,
      meta: { type: "points", id: p.id },
    }),
  );
  return tasks;
}

function render(tasks: Task[]): string {
  const answers = join(dir, "answers.json");
  const head = `# 新聞 AI 待辦（${kind}，${tasks.length} 個任務）

逐一完成下面每個任務：照「規則」與「內容」寫出答案，答案必須符合該任務的 JSON 格式。
全部寫完後，把答案存成 \`${answers}\`，格式是以任務代號為鍵的物件，例如：
\`\`\`json
${JSON.stringify(Object.fromEntries(tasks.slice(0, 2).map((t) => [t.id, "<符合該任務格式的 JSON 物件>"])), null, 2)}
\`\`\`
只寫這個檔案；不要改其他檔案、不要 commit、不要部署。寫完執行 \`node scripts/ai-batch.ts push ${kind}\`。
`;
  const body = tasks.map(
    (t) => `\n---\n\n## ${t.id}：${t.title}\n\n### 規則\n\n${t.prompt.system}\n\n### 內容\n\n${t.prompt.user}\n\n### 答案格式（JSON Schema）\n\n\`\`\`json\n${JSON.stringify(t.schema)}\n\`\`\`\n`,
  );
  return head + body.join("");
}

const cookie = await signIn();

if (cmd === "pull") {
  const tasks = await buildTasks(cookie);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "answers.json"), "{}\n");
  writeFileSync(join(dir, "tasks.json"), JSON.stringify(tasks, null, 2));
  if (!tasks.length) {
    writeFileSync(join(dir, "tasks.md"), "沒有待辦。\n");
    console.log(`沒有待辦（${kind}），不用做任何事。`);
    if (process.argv.includes("--check")) process.exitCode = 1;
  } else {
    writeFileSync(join(dir, "tasks.md"), render(tasks));
    console.log(`${tasks.length} 個任務，讀 ${join(dir, "tasks.md")}，答案寫進 ${join(dir, "answers.json")}，再執行 push。`);
  }
} else {
  const tasksFile = join(dir, "tasks.json");
  if (!existsSync(tasksFile)) throw new Error("沒有 tasks.json，先執行 pull");
  const tasks = JSON.parse(readFileSync(tasksFile, "utf8")) as Task[];
  const answers = JSON.parse(readFileSync(join(dir, "answers.json"), "utf8")) as Record<string, unknown>;
  const parse = (a: unknown) => (typeof a === "string" ? JSON.parse(a) : a);
  const body = {
    model: process.env.AI_BATCH_MODEL ?? "claude-orca",
    translate: [] as { ids: string[]; answer: unknown }[],
    points: [] as { id: string; answer: unknown }[],
    digests: [] as { key: string; date: string; newsIds: string[]; answer: unknown }[],
  };
  const missing: string[] = [];
  for (const t of tasks) {
    if (!(t.id in answers)) {
      missing.push(t.id);
      continue;
    }
    const answer = parse(answers[t.id]);
    if (t.meta.type === "translate") body.translate.push({ ids: t.meta.ids, answer });
    else if (t.meta.type === "points") body.points.push({ id: t.meta.id, answer });
    else body.digests.push({ key: t.meta.key, date: t.meta.date, newsIds: t.meta.newsIds, answer });
  }
  const r = await api<{ translated: number; points: number; digests: number; skipped: string[] }>(cookie, "POST", "/api/admin/ai", body);
  console.log(`寫入：翻譯 ${r.translated} 則、文章重點 ${r.points} 則、每日重點 ${r.digests} 則${missing.length ? `；沒有答案：${missing.join(",")}` : ""}${r.skipped.length ? `；略過：${r.skipped.join("；")}` : ""}`);
}
