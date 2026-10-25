// 壓力測試共用：種子資料庫（含 0→12 家需要的成分股）、跑一次排程、檢查每次執行的額度與快照內容。
import assert from "node:assert/strict";
import { type FakeUpstream, fakeClose, migratedDb, weekdays } from "./fake-cloudflare.ts";

export const NAMED: [string, string][] = [
  ["NVDA", "NVIDIA CORP"], ["AAPL", "APPLE INC"], ["MSFT", "MICROSOFT CORP"], ["AMZN", "AMAZON.COM INC"],
  ["GOOGL", "ALPHABET INC CL A"], ["GOOG", "ALPHABET INC CL C"], ["META", "META PLATFORMS INC CLASS A"], ["TSLA", "TESLA INC"],
  ["AVGO", "BROADCOM INC"], ["BRK-B", "BERKSHIRE HATHAWAY INC CL B"], ["LLY", "ELI LILLY + CO"],
  ["FOXA", "FOX CORP CLASS A"], ["FOX", "FOX CORP CLASS B"], ["NWSA", "NEWS CORP CLASS A"], ["NWS", "NEWS CORP CLASS B"],
  ["JPM", "JPMORGAN CHASE + CO"],
];
export const SEED_WEIGHT = new Map(NAMED.map(([t], i) => [t, 7 - i * 0.3]));

export type Sql = { prepare: (q: string) => { all: (...a: never[]) => unknown[]; get: (...a: never[]) => unknown; run: (...a: never[]) => unknown } };

export async function seededDb() {
  const { db, sql } = await migratedDb();
  const asOf = weekdays(2)[0];
  const ins = sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, shares, fetched_at) VALUES (?, ?, ?, ?, 1, 'x')");
  NAMED.forEach(([t, n]) => ins.run(asOf, t, n, SEED_WEIGHT.get(t)!));
  // 非股票列（含數字、權重 0）不能被加入
  ins.run(asOf, "2602335D", "CASH COLLATERAL", 0.01);
  ins.run(asOf, "ZERO", "ZERO WEIGHT INC", 0);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < 480; i++) ins.run(asOf, `Q${letters[Math.floor(i / 26) % 26]}${letters[i % 26]}`, `FILLER ${i} INC`, 0.1 - i * 0.0001);
  return { db, sql: sql as unknown as Sql };
}

const mdy = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
/** 假網路的 Cboe SPX 用 fakeClose("SPX")、Yahoo 用 fakeClose("^GSPC")，兩邊不同；讓 Cboe 回 ^GSPC 的值，SPX 核對才會是 match。 */
export const consistentSpx = (u: URL) =>
  u.host === "cdn-api.cboe.com" && u.pathname.includes("SPX")
    ? new Response(["DATE,SPX", ...weekdays(60).map((d) => `${mdy(d)},${fakeClose("^GSPC", d)}`)].join("\n"), { status: 200 })
    : null;

export type Run = { job: string; status: string; summary: string; detail: string };
export const FIVE = ["daily-reference", "prices", "crosscheck", "retry", "news"] as const;

export async function invokeCron(upstream: FakeUpstream, file: string, db: D1Database, sql: Sql) {
  const mod = (await import(`../../crons/${file}.ts`)) as { default: (c: unknown, env: unknown, ctx: unknown) => Promise<void> };
  const lastId = (sql.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM runs").get() as { m: number }).m;
  upstream.reset();
  await mod.default({ cron: file, scheduledTime: Date.now() }, { DB: db }, { waitUntil() {} });
  const runs = sql.prepare(`SELECT job, status, summary, detail FROM runs WHERE id > ${lastId} ORDER BY id`).all() as Run[];
  return { runs, requests: upstream.count, maxInFlight: upstream.maxInFlight, overLimit: upstream.overLimit, hosts: { ...upstream.hosts } };
}

export function assertInvocation(name: string, r: Awaited<ReturnType<typeof invokeCron>>, opts: { strictJobs?: boolean } = {}) {
  assert.equal(r.overLimit, 0, `${name}：超過 50（${r.requests}）`);
  assert.ok(r.requests <= 48, `${name}：${r.requests} > 48`);
  assert.ok(r.maxInFlight <= 6, `${name}：同時 ${r.maxInFlight}`);
  const recorded = r.runs.reduce((a, x) => a + (JSON.parse(x.detail).subrequests as number), 0);
  assert.equal(recorded, r.requests, `${name}：記到 ${recorded}、實打 ${r.requests} ${JSON.stringify(r.hosts)}`);
  if (opts.strictJobs !== false) {
    for (const run of r.runs) {
      if (run.job === "weights" || run.job === "factset") continue;
      assert.equal(run.status, "ok", `${name}/${run.job}: ${run.summary}`);
    }
  }
}

export type SnapData = {
  tradeDate: string;
  mag7: { key: string; tickers: string[]; weightPct: number | null; contributionPts: number | null; check: string; weightMethod: string | null; returnPct: number | null }[];
  mag7Total: { weightPct: number | null; contributionPts: number | null };
  quality: { missing: string[]; mismatches: string[]; pendingChecks: string[] };
  index: { check: { status: string } };
};

export function latestSnapshot(sql: Sql): { revision: number; data: SnapData } {
  const row = sql.prepare("SELECT revision, data FROM snapshots ORDER BY trade_date DESC, revision DESC LIMIT 1").get() as { revision: number; data: string };
  return { revision: row.revision, data: JSON.parse(row.data) };
}

/** 最新快照的成員＝目前名單（順序相同），每列歸因齊全且權重＝持股檔各股類相加。 */
export function assertSnapshotMatches(name: string, sql: Sql, list: { key: string; tickers: string[] }[], opts: { checked?: boolean } = {}) {
  const { data } = latestSnapshot(sql);
  assert.deepEqual(data.mag7.map((r) => [r.key, r.tickers]), list.map((m) => [m.key, m.tickers]), `${name}：快照成員與名單不同`);
  for (const row of data.mag7) {
    assert.notEqual(row.contributionPts, null, `${name}：${row.key} 沒有貢獻`);
    assert.notEqual(row.returnPct, null, `${name}：${row.key} 沒有報酬`);
    assert.equal(row.weightMethod, "file", `${name}：${row.key} 權重方法 ${row.weightMethod}`);
    const expectW = row.tickers.reduce((a, t) => a + SEED_WEIGHT.get(t)!, 0);
    assert.ok(Math.abs((row.weightPct as number) - expectW) < 1e-3, `${name}：${row.key} 權重 ${row.weightPct} ≠ ${expectW}`);
    if (opts.checked) assert.equal(row.check, "match", `${name}：${row.key} 核對 ${row.check}`);
  }
  const sumW = data.mag7.reduce((a, r) => a + (r.weightPct as number), 0);
  const sumC = data.mag7.reduce((a, r) => a + (r.contributionPts as number), 0);
  if (data.mag7.length) {
    assert.ok(Math.abs((data.mag7Total.weightPct as number) - sumW) < 1e-3, `${name}：合計權重`);
    assert.ok(Math.abs((data.mag7Total.contributionPts as number) - sumC) < 1e-3, `${name}：合計貢獻`);
  }
  const listTickers = new Set(list.flatMap((m) => m.tickers));
  for (const m of data.quality.missing) assert.ok(!listTickers.has(m), `${name}：缺 ${m} 收盤`);
  if (opts.checked) assert.deepEqual(data.quality.mismatches, [], `${name}：不一致 ${data.quality.mismatches}`);
  return data;
}
