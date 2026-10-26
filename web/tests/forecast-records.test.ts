// G02：預測紀錄寫入後不可改、可追溯；VIX 過期時頁面仍要有不依賴預測的區塊，排程回報 partial。
import assert from "node:assert/strict";
import { test } from "node:test";
import { Series } from "../src/lib/analytics.ts";
import { DEFAULT_MODEL, buildOutlook } from "../src/lib/forecast.ts";
import { recordForecast, runJob } from "../src/server/jobs.ts";
import { outlookView } from "../src/server/outlook.ts";
import { migratedDb, weekdays } from "./helpers/fake-cloudflare.ts";

const N = 900;

/** SPX 與 VIX 各 N 天；vixLag > 0 時 VIX 少最後 vixLag 個交易日。 */
async function seed(vixLag = 0, spxScale = 1) {
  const { db, sql } = await migratedDb();
  const days = weekdays(N);
  const ins = sql.prepare("INSERT OR REPLACE INTO prices (symbol, date, close, source, fetched_at) VALUES (?, ?, ?, 'test', 'x')");
  days.forEach((d, i) => {
    ins.run("SPX", d, (1000 + i * 2 + 30 * Math.sin(i / 7)) * spxScale);
    if (i < N - vixLag) ins.run("VIX", d, 16 + 6 * Math.sin(i / 11));
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
  const row1 = sql.prepare("SELECT * FROM forecasts").all() as Record<string, unknown>[];
  assert.equal(row1.length, 1);
  assert.match(msg1.message, /已記錄|新記錄/);

  // 最後一天的收盤改了、再算一次：紀錄不變。
  sql.prepare("UPDATE prices SET close = close * 0.5 WHERE symbol = 'SPX' AND date = (SELECT MAX(date) FROM prices WHERE symbol = 'SPX')").run();
  const msg2 = await recordForecast(db);
  assert.match(msg2.message, /已有紀錄|已記錄過|未覆蓋/);
  const row2 = sql.prepare("SELECT * FROM forecasts").all() as Record<string, unknown>[];
  assert.deepEqual(row2, row1);

  const r = row1[0];
  const outlook = buildOutlook(spx0, vix0)!;
  assert.equal(r.model_version, DEFAULT_MODEL.version);
  assert.equal(r.history_start, outlook.historyStart);
  assert.ok(r.history_start);
  assert.deepEqual(JSON.parse(r.regime as string), outlook.regime);
  assert.equal(typeof r.cond_n_eff === "number" || r.cond_n_eff === null, true);
  assert.equal(r.cond_p, outlook.pick.conditional?.p ?? null);
  assert.equal(r.bss_low, outlook.evaluation.bssLow);
  assert.doesNotThrow(() => JSON.parse(r.detail as string));
});

test("VIX 過期：outlookView 的 outlook 為 null，但共識、策略師、預測紀錄仍在", async () => {
  const { db, sql } = await seed();
  await recordForecast(db);
  sql.prepare("DELETE FROM prices WHERE symbol = 'VIX' AND date > (SELECT date FROM (SELECT date FROM prices WHERE symbol = 'VIX' ORDER BY date DESC LIMIT 1 OFFSET 8))").run();
  const v = await outlookView({ env: { DB: db }, req: { query: () => undefined, url: "http://x/outlook" } });
  assert.equal(v.outlook, null);
  assert.deepEqual(v.cells, []);
  assert.ok(v.strategists && v.strategists.list.length > 0);
  assert.equal(v.recent.length, 1);
  for (const k of ["track", "consensus", "factset", "horizon", "minN"]) assert.ok(k in v, k);
  assert.ok("modelVersion" in v.recent[0] && "historyStart" in v.recent[0]);
});

test("forecast 工作遇到 VIX 過期：status partial，原因寫明 VIX", async () => {
  const { db, sql } = await seed(8);
  const r = await runJob(db, "forecast", "test");
  assert.equal(r.status, "partial");
  assert.match(r.summary, /VIX 超過 3 個交易日未更新/);
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
