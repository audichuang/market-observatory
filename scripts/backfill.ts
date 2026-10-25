// 歷史回補：在 Worker 裡分段跑（Yahoo 會對單一 IP 限流，Worker 出口較穩），本腳本只負責登入與依序呼叫。
//   MO_URL=https://… MO_EMAIL=… MO_PASSWORD=… node scripts/backfill.ts [--sessions 500]
// 每段都寫進 runs 表；只補不存在或收盤有變的列，不會覆蓋排程寫入的核對結果。
export {};

const base = (process.env.MO_URL ?? "http://localhost:5180").replace(/\/$/, "");
const email = process.env.MO_EMAIL;
const password = process.env.MO_PASSWORD;
if (!email || !password) throw new Error("需要 MO_EMAIL 與 MO_PASSWORD");
const sessionsArg = process.argv.indexOf("--sessions");
const totalSessions = sessionsArg > 0 ? Number(process.argv[sessionsArg + 1]) : 500;

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
  detail?: { first?: string | null };
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

// 1. 十年日線（最後一段是 Cboe VIX＋SPX 核對）。
for (let part = 0; ; part++) {
  const r = await run("backfill-prices", { part });
  if (r.summary.startsWith("沒有第")) break;
  if (r.summary.includes(`第 ${part + 1}/${part + 1} 段`)) break;
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
console.log("回補完成");
