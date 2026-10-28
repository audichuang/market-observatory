// G02：預測紀錄寫入後不可改、可追溯；VIX 過期時頁面仍要有不依賴預測的區塊，排程回報 partial。
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Series } from "../src/lib/analytics.ts";
import { DEFAULT_MODEL, buildOutlook } from "../src/lib/forecast.ts";
import { forecastNeedsAttention, recordForecast, runJob } from "../src/server/jobs.ts";
import { outlookView } from "../src/server/outlook.ts";
import { FakeUpstream, fakeClose, migratedDb, weekdays } from "./helpers/fake-cloudflare.ts";

const N = 900;

/** SPX 與 VIX 各 N 天；vixLag > 0 時 VIX 少最後 vixLag 個交易日。 */
async function seed(vixLag = 0, spxScale = 1) {
  const { db, sql } = await migratedDb();
  const days = weekdays(N);
  const ins = sql.prepare("INSERT OR REPLACE INTO prices (symbol, date, close, source, fetched_at, check_status) VALUES (?, ?, ?, 'test', 'x', ?)");
  days.forEach((d, i) => {
    // SPX 收盤都已經 cross-check 過（match）；VIX 是 Cboe 主來源，沒有第二來源。
    ins.run("SPX", d, (1000 + i * 2 + 30 * Math.sin(i / 7)) * spxScale, "match");
    if (i < N - vixLag) ins.run("VIX", d, 16 + 6 * Math.sin(i / 11), null);
  });
  return { db, sql, days };
}

const series = async (sql: { prepare: (q: string) => { all: (...a: never[]) => unknown[] } }, sym: string) =>
  new Series((sql.prepare("SELECT date, close FROM prices WHERE symbol = ? ORDER BY date").all(sym as never) as { date: string; close: number }[]));

test("同一交易日第二次寫入不覆蓋；新欄位都有值", async () => {
  const { db, sql } = await seed();
  const spx0 = await series(sql, "SPX");
  const vix0 = await series(sql, "VIX");
  const msg1 = await recordForecast(db);
  const row1 = sql.prepare("SELECT * FROM forecasts ORDER BY trade_date").all() as Record<string, unknown>[];
  assert.equal(row1.length, 5); // 補記最近 5 個交易日
  assert.match(msg1.message, /新記錄/);
  // 摘要顯示在站長的資料來源頁：結論與原因代碼要換成中文，不能漏出 up／down／inconclusive、vix-pending 之類的代碼。
  assert.doesNotMatch(msg1.message, /\b(up|down|inconclusive)\b|[a-z]+-[a-z]+/);

  // 最後一天的收盤改了、再算一次：紀錄不變。
  sql.prepare("UPDATE prices SET close = close * 0.5 WHERE symbol = 'SPX' AND date = (SELECT MAX(date) FROM prices WHERE symbol = 'SPX')").run();
  const msg2 = await recordForecast(db);
  assert.match(msg2.message, /已有紀錄|已記錄過|未覆蓋/);
  const row2 = sql.prepare("SELECT * FROM forecasts ORDER BY trade_date").all() as Record<string, unknown>[];
  assert.deepEqual(row2, row1);

  const r = row1[4];
  const outlook = buildOutlook(spx0, vix0)!;
  assert.equal(r.model_version, DEFAULT_MODEL.version);
  assert.equal(r.history_start, outlook.historyStart);
  assert.ok(r.history_start);
  assert.deepEqual(JSON.parse(r.regime as string), outlook.regime);
  assert.equal(typeof r.cond_n_eff === "number" || r.cond_n_eff === null, true);
  assert.equal(r.cond_p, outlook.pick.conditional?.p ?? null);
  assert.equal(r.bss_low, outlook.evaluation.bssLow);
  const detail = JSON.parse(r.detail as string);
  assert.deepEqual(detail.cellGate, outlook.cellGate);
  assert.deepEqual(detail.assessments, JSON.parse(JSON.stringify(outlook.assessments)));
  assert.equal(detail.drawdown.p, outlook.drawdown.pick.p);
  assert.equal(detail.drawdown.base, outlook.drawdown.pick.base.p);
  assert.equal(detail.drawdown.scored, outlook.drawdown.scored);
  assert.equal(detail.drawdown.modelVersion, DEFAULT_MODEL.version);
  assert.deepEqual(detail.drawdown.regime, outlook.regime);
  assert.equal(detail.drawdown.basis, outlook.drawdown.pick.basis);
  assert.equal(detail.drawdown.cell, outlook.drawdown.pick.cell);
  assert.equal(detail.drawdown.historyStart, outlook.historyStart);
  assert.deepEqual(detail.drawdown.cellGate, outlook.drawdown.cellGate);
  assert.ok(detail.drawdown.gate);
  assert.deepEqual(detail.drawdown.gate, outlook.drawdown.gate);
  const view = await outlookView({ env: { DB: db }, req: { query: () => undefined, url: "http://x/outlook" } });
  assert.ok(view.outlook!.drawdown.pick && view.outlook!.returnQuantiles.all);
});

test("VIX 過期：outlookView 的 outlook 為 null，但共識、策略師、預測紀錄仍在", async () => {
  const { db, sql } = await seed();
  await recordForecast(db);
  sql.prepare("DELETE FROM prices WHERE symbol = 'VIX' AND date > (SELECT date FROM (SELECT date FROM prices WHERE symbol = 'VIX' ORDER BY date DESC LIMIT 1 OFFSET 8))").run();
  const v = await outlookView({ env: { DB: db }, req: { query: () => undefined, url: "http://x/outlook" } });
  assert.equal(v.outlook, null);
  assert.deepEqual(v.cells, []);
  assert.ok(v.strategists && v.strategists.list.length > 0);
  // Additive strategist metadata reaches the payload; existing fields keep their types.
  assert.equal(typeof v.strategists.median, "number");
  assert.ok(v.strategists.list.every((t) => typeof t.target === "number" && typeof t.inMedian === "boolean" && typeof t.stale === "boolean"));
  assert.equal(v.strategists.medianCount, v.strategists.list.filter((t) => t.inMedian).length);
  assert.ok(v.recent.length >= 1);
  for (const k of ["track", "consensus", "factset", "horizon", "minN"]) assert.ok(k in v, k);
  assert.ok("modelVersion" in v.recent[0] && "historyStart" in v.recent[0]);
  assert.ok(v.liveTrackDd5);
  assert.equal(v.liveTrackDd5.realtime, 1);
  assert.equal(v.liveTrackDd5.delayed, 4);
});

test("dd5 讀取端：新紀錄按 lag 分類，無 detail 舊列另計資格不明；P(up) 附暫時說明", async () => {
  const { db, sql, days } = await seed();
  const recorded = await recordForecast(db);
  assert.equal(recorded.recorded.length, 5);
  sql.prepare("INSERT INTO forecasts (trade_date, probability, base_rate, basis, call, close, created_at) VALUES (?, 0.6, 0.6, 'test', 'inconclusive', 1000, 'x')").run(days.at(-6)!);
  const v = await outlookView({ env: { DB: db }, req: { query: () => undefined, url: "http://x/outlook" } });
  assert.equal(v.liveTrackDd5.realtime, 1);
  assert.equal(v.liveTrackDd5.delayed, 4);
  assert.equal(v.liveTrackDd5.unknown, 1);
  assert.equal(v.liveTrack.note, "合併所有已寫入的紀錄，包含延遲補記的列；尚未依發布時間區分即時與補記。");
});

test("forecast 工作遇到 VIX 過期：status partial，原因寫明 VIX", async () => {
  const { db, sql } = await seed(8);
  const r = await runJob(db, "forecast", "test");
  assert.equal(r.status, "partial");
  assert.match(r.summary, /VIX 超過 3 個交易日未更新/);
  assert.equal((r.detail as Record<string, unknown>).reasonCode, "vix-stale");
  assert.match(String((r.detail as Record<string, unknown>).reason), /VIX/);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM forecasts").get() as { n: number }).n, 0);
});

test("資料不足：partial，原因是資料不足而不是 VIX", async () => {
  const { db } = await migratedDb();
  const r = await runJob(db, "forecast", "test");
  assert.equal(r.status, "partial");
  assert.match(r.summary, /資料不足/);
  assert.doesNotMatch(r.summary, /VIX 超過/);
});

const rowOf = (sql: { prepare: (q: string) => { get: (...a: never[]) => unknown } }, d: string) =>
  sql.prepare("SELECT * FROM forecasts WHERE trade_date = ?").get(d as never) as Record<string, unknown> | undefined;
const cut = (sql: Parameters<typeof series>[0], sym: string, to: string) => series(sql, sym).then((s) => new Series(s.points.filter((p) => p.date <= to)));

test("(a) VIX 晚一個交易日：T 不記；VIX(T) 到了且 SPX 為 match 後，T 用 VIX(T) 的 regime 記下", async () => {
  const { db, sql, days } = await seed(1);
  const T = days.at(-1)!;
  const r1 = await recordForecast(db);
  assert.equal(rowOf(sql, T), undefined);
  assert.ok(rowOf(sql, days.at(-2)!), "VIX 已有的前一天照記");
  assert.deepEqual(r1.pending.map((p) => [p.date, p.reason]), [[T, "vix-pending"]]);
  assert.equal(r1.reason, "vix-pending");

  sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at) VALUES ('VIX', ?, 45, 'test', 'x')").run(T as never);
  const r2 = await recordForecast(db);
  assert.deepEqual(r2.recorded, [T]);
  const row = rowOf(sql, T)!;
  const full = buildOutlook(await series(sql, "SPX"), await series(sql, "VIX"))!;
  assert.deepEqual(JSON.parse(row.regime as string), full.regime);
  assert.equal(full.regime.vixStress, true);
  const d = JSON.parse(row.detail as string);
  assert.equal(d.vixDate, T);
  assert.equal(d.vix, 45);
  assert.equal(d.spxCheck, "match");
  assert.equal(d.recordedLagSessions, 0);
});

test("(b) SPX 收盤 cross-check 不一致：不記；更正並重新核對 match 後以更正後的收盤記下", async () => {
  const { db, sql, days } = await seed();
  const T = days.at(-1)!;
  sql.prepare("UPDATE prices SET check_status = 'mismatch' WHERE symbol = 'SPX' AND date = ?").run(T as never);
  const r1 = await recordForecast(db);
  assert.equal(rowOf(sql, T), undefined);
  assert.deepEqual(r1.pending.map((p) => [p.date, p.reason]), [[T, "spx-mismatch"]]);
  assert.equal(r1.reason, "spx-mismatch");
  assert.equal(forecastNeedsAttention(r1), false); // 最近 2 個交易日內的不一致還不算異常

  sql.prepare("UPDATE prices SET close = 9999, check_status = 'match' WHERE symbol = 'SPX' AND date = ?").run(T as never);
  await recordForecast(db);
  assert.equal(rowOf(sql, T)!.close, 9999);
});

test("(b2) 尚未 cross-check（pending）：不記", async () => {
  const { db, sql, days } = await seed();
  const T = days.at(-1)!;
  sql.prepare("UPDATE prices SET check_status = NULL WHERE symbol = 'SPX' AND date = ?").run(T as never);
  const r = await recordForecast(db);
  assert.equal(rowOf(sql, T), undefined);
  assert.deepEqual(r.pending.map((p) => [p.date, p.reason]), [[T, "spx-unchecked"]]);
});

test("(c) 補記只用當天以前的資料：兩個交易日後才補，也等於截到 S 的 buildOutlook", async () => {
  const { db, sql, days } = await seed();
  const S = days.at(-3)!;
  await recordForecast(db);
  const row = rowOf(sql, S)!;
  const o = buildOutlook(await cut(sql, "SPX", S), await cut(sql, "VIX", S))!;
  assert.equal(row.close, o.close);
  assert.equal(row.probability, o.pick.p);
  assert.equal(row.call, o.call);
  assert.equal(row.history_start, o.historyStart);
  assert.deepEqual(JSON.parse(row.regime as string), o.regime);
  const detail = JSON.parse(row.detail as string);
  assert.equal(detail.recordedLagSessions, 2);
  assert.equal(detail.drawdown.modelVersion, DEFAULT_MODEL.version);
  assert.deepEqual(detail.drawdown.regime, o.regime);
  assert.equal(detail.drawdown.basis, o.drawdown.pick.basis);
  assert.equal(detail.drawdown.cell, o.drawdown.pick.cell);
  assert.equal(detail.drawdown.historyStart, o.historyStart);
});

test("(d) 第二次呼叫什麼都不做", async () => {
  const { db, sql } = await seed();
  await recordForecast(db);
  const before = sql.prepare("SELECT * FROM forecasts ORDER BY trade_date").all();
  const r = await recordForecast(db);
  assert.deepEqual(r.recorded, []);
  assert.equal(r.outcome, "exists");
  assert.deepEqual(sql.prepare("SELECT * FROM forecasts ORDER BY trade_date").all(), before);
});

// F16: an SPX close left unchecked past the catch-up window can never be recorded, so it must surface as an anomaly.
const uncheck = (sql: { prepare: (q: string) => { run: (...a: never[]) => unknown } }, dates: string[]) => {
  for (const d of dates) sql.prepare("UPDATE prices SET check_status = NULL WHERE symbol = 'SPX' AND date = ?").run(d as never);
};

test("(e) Cboe SPX 連續 3 個交易日沒核對：attention，原因是 spx-unchecked；forecast 工作標 partial", async () => {
  const { db, sql, days } = await seed();
  uncheck(sql, days.slice(-3));
  const r = await recordForecast(db);
  assert.equal(r.attention, true);
  assert.equal(r.reason, "spx-unchecked");
  assert.match(r.message, new RegExp(`${days.at(-3)} 的 SPX 收盤 2 個交易日後仍未核對`));
  assert.doesNotMatch(r.message, /[a-z]+-[a-z]+/);
  const job = await runJob(db, "forecast", "test");
  assert.equal(job.status, "partial");
  assert.equal((job.detail as Record<string, unknown>).reasonCode, "spx-unchecked");
});

test("(f) 只缺最新 1 天的核對（正常的發布延遲）：不算異常", async () => {
  const { db, sql, days } = await seed();
  uncheck(sql, days.slice(-1));
  const r = await recordForecast(db);
  assert.equal(r.reason, "spx-unchecked");
  assert.equal(r.attention, false);
});

const upstream = new FakeUpstream();
let restore: () => void;
before(() => {
  restore = upstream.install();
});
after(() => restore());

/** SPX equals the fake upstream's close (so Yahoo upserts do not reset check status), unchecked; forecasts already exist except for the last 3 sessions. */
async function pricesJobDb() {
  const { db, sql, days } = await seed();
  sql.prepare("UPDATE prices SET check_status = NULL WHERE symbol = 'SPX'").run();
  const upd = sql.prepare("UPDATE prices SET close = ? WHERE symbol = 'SPX' AND date = ?");
  for (const d of days) upd.run(fakeClose("SPX", d), d);
  const ins = sql.prepare("INSERT INTO forecasts (trade_date, probability, base_rate, basis, call, close, created_at) VALUES (?, 0.6, 0.6, 'test', 'inconclusive', 1, 'x')");
  for (const d of days.slice(0, -3)) ins.run(d);
  return { db, sql, days };
}

test("(g) Cboe SPX 的 CSV 回 200 但缺最近 3 天：抓價工作 partial，預測原因 spx-unchecked", async () => {
  const { db, sql, days } = await pricesJobDb();
  const mdy = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
  const csv = ["DATE,SPX", ...days.slice(-60, -3).map((d) => `${mdy(d)},${fakeClose("SPX", d)}`)].join("\n");
  upstream.rules = [(u) => (u.host === "cdn-api.cboe.com" && u.pathname.includes("SPX") ? new Response(csv, { status: 200 }) : null)];
  try {
    const r = await runJob(db, "prices", "test");
    const detail = r.detail as Record<string, unknown>;
    assert.equal(detail.forecastReason, "spx-unchecked", r.summary);
    assert.equal(r.status, "partial", r.summary);
    const unchecked = sql.prepare("SELECT date FROM prices WHERE symbol = 'SPX' AND check_status IS NULL AND date >= ? ORDER BY date").all(days.at(-5)! as never) as { date: string }[];
    assert.deepEqual(unchecked.map((x) => x.date), days.slice(-3));
  } finally {
    upstream.rules = [];
  }
});

test("(h) Cboe SPX 抓取失敗：抓價摘要寫出 SPX 核對失敗的原因", async () => {
  const { db } = await pricesJobDb();
  upstream.rules = [(u) => (u.host === "cdn-api.cboe.com" && u.pathname.includes("SPX") ? new Response("down", { status: 500 }) : null)];
  try {
    const r = await runJob(db, "prices", "test");
    assert.match(r.summary, /SPX 核對失敗 .+/);
    assert.equal((r.detail as Record<string, unknown>).forecastReason, "spx-unchecked");
    assert.equal(r.status, "partial", r.summary);
  } finally {
    upstream.rules = [];
  }
});
