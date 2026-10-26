// 歷史回補：在 Worker 裡分段跑（Yahoo 會對單一 IP 限流，Worker 出口較穩），本腳本只負責登入與依序呼叫。
//   MO_URL=https://… MO_EMAIL=… MO_PASSWORD=… node scripts/backfill.ts [--sessions 500] [--history-only]
// --history-only：只補 SPX／VIX 的 Cboe 更早歷史（Yahoo 十年窗口之前），不跑其他步驟。
// 每段都寫進 runs 表；只補不存在或收盤有變的列，不會覆蓋排程寫入的核對結果。
export {};

const base = (process.env.MO_URL ?? "http://localhost:5173").replace(/\/$/, "");
const email = process.env.MO_EMAIL;
const password = process.env.MO_PASSWORD;
if (!email || !password) throw new Error("需要 MO_EMAIL 與 MO_PASSWORD");
const sessionsArg = process.argv.indexOf("--sessions");
const totalSessions = sessionsArg > 0 ? Number(process.argv[sessionsArg + 1]) : 500;

const historyOnly = process.argv.includes("--history-only");

const login = await fetch(`${base}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`登入失敗：HTTP ${login.status} ${await login.text()}`);
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

interface RunResult {
  status: string;
  summary: string;
  detail?: { first?: string | null; inserted?: Record<string, number>; remaining?: Record<string, number> };
}

async function run(job: string, params: Record<string, string | number> = {}): Promise<RunResult> {
  const qs = new URLSearchParams({ job, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base}/api/admin/run?${qs}`, { method: "POST", headers: { Cookie: cookie, Origin: base } });
    const body = (await res.json().catch(() => ({ status: `HTTP ${res.status}`, summary: "" }))) as RunResult;
    console.log(`${job} ${JSON.stringify(params)} → ${body.status} ${body.summary}`);
    if (body.status !== "failed" || attempt >= 3) return body;
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
}

// 呼叫 backfill-index-history 直到 detail.remaining 全為 0（最多 60 次）；只看 detail，不解析 summary。
async function backfillIndexHistory() {
  for (let call = 1; call <= 60; call++) {
    const r = await run("backfill-index-history");
    const left = r.detail?.remaining;
    if (!left) throw new Error(`backfill-index-history ${r.status}：${r.summary}`);
    // SPX 被略過（重疊不足或與 Yahoo 不一致）就不算完成：印出原因、以非零狀態結束。
    if (r.status === "partial") throw new Error(`backfill-index-history partial：${r.summary}`);
    if (Object.values(left).every((n) => n === 0)) return;
    const progressed = Object.values(r.detail?.inserted ?? {}).some((n) => n > 0);
    if (!progressed) throw new Error(`backfill-index-history 沒有進展（${r.status}）：${r.summary}`);
  }
  throw new Error("backfill-index-history 呼叫 60 次仍未補完");
}

if (historyOnly) {
  await backfillIndexHistory();
  console.log("歷史回補完成");
  process.exit(0);
}

// 1. 十年日線（最後一段是 Cboe VIX＋SPX 核對）。
for (let part = 0; ; part++) {
  const r = await run("backfill-prices", { part });
  if (r.summary.startsWith("沒有第")) break;
  if (r.summary.includes(`第 ${part + 1}/${part + 1} 段`)) break;
}
// 1b. SPX／VIX 十年窗口之前的歷史（Cboe，約 30 與 35 年）。
// 失敗不擋後面不需要它的步驟：先記下錯誤，全部跑完再印出並以非零結束。
let historyError: unknown = null;
try {
  await backfillIndexHistory();
} catch (e) {
  historyError = e;
  console.error(`歷史步驟失敗，先繼續其他步驟：${e instanceof Error ? e.message : e}`);
}
// 2. Nasdaq 全段交叉核對。
for (let part = 0; ; part++) {
  const r = await run("backfill-checks", { part });
  if (r.summary.startsWith("沒有第") || r.summary.includes(`第 ${part + 1}/${part + 1} 段`)) break;
}
// 3. 持股權重（回推歷史權重需要至少一份）。
await run("weights");
// 4. 快照：從最新往回，每次 60 個交易日。
let upTo: string | undefined;
for (let done = 0; done < totalSessions; done += 60) {
  const r = await run("snapshots", { sessions: Math.min(60, totalSessions - done), ...(upTo ? { upTo } : {}) });
  const first = r.detail?.first;
  if (!first) break;
  const d = new Date(`${first}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  upTo = d.toISOString().slice(0, 10);
}
if (historyError) {
  console.error(`回補未完成：${historyError instanceof Error ? historyError.message : historyError}`);
  process.exit(1);
}
console.log("回補完成");
