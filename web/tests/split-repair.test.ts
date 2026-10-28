import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { addDays, latestExpectedClose } from "../src/lib/calendar.ts";
import { runJob } from "../src/server/jobs.ts";
import { chartResult, FakeUpstream, migratedDb, weekdays } from "./helpers/fake-cloudflare.ts";

async function splitDb(days: string[]) {
  const { db, sql } = await migratedDb();
  sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('watchlist', ?, 'x')")
    .run(JSON.stringify([{ key: "QAA", company: "QAA", tickers: ["QAA"] }]));
  sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('pending_rebase', ?, 'x')")
    .run(JSON.stringify({ QAA: 2 }));
  const insert = sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at) VALUES ('QAA', ?, 20, 'yahoo-chart', 'x')");
  for (const day of days) insert.run(day);
  return { db, sql };
}

function refetch(t: TestContext, days: string[], conflict?: string) {
  const upstream = new FakeUpstream();
  const result = chartResult("QAA", conflict ? [...days, conflict] : days, true);
  result.indicators.quote[0].close = conflict ? [...days.map(() => 10), 11] : days.map(() => 10);
  upstream.rules = [(url) => url.host === "query1.finance.yahoo.com" && url.pathname === "/v8/finance/chart/QAA" && url.searchParams.get("range") === "10y"
    ? Response.json({ chart: { result: [result], error: null } })
    : null];
  t.after(upstream.install());
}

for (const conflict of [false, true]) {
  test(`分割重抓中段${conflict ? "衝突遭拒收" : "缺日"}：保留全部原價與待修，summary 說明缺少日期`, async (t) => {
    const days = weekdays(7);
    const missing = days[3];
    const { db, sql } = await splitDb(days);
    refetch(t, conflict ? days : days.filter((date) => date !== missing), conflict ? missing : undefined);

    const result = await runJob(db, "prices", "test");
    const pending = JSON.parse((sql.prepare("SELECT value FROM settings WHERE key = 'pending_rebase'").get() as { value: string }).value);
    assert.deepEqual(pending, { QAA: 2 });
    const prices = sql.prepare("SELECT date, close FROM prices WHERE symbol = 'QAA' ORDER BY date").all();
    assert.deepEqual(prices.map((row) => ({ ...row })), days.map((date) => ({ date, close: 20 })));
    assert.equal(result.status, "partial");
    assert.match(result.summary, /QAA.*重抓缺少已存日期/);
    assert.ok(result.summary.includes(missing), result.summary);
    const recorded = sql.prepare("SELECT summary FROM runs WHERE id = ?").get(result.id) as { summary: string };
    assert.equal(recorded.summary, result.summary);
    t.diagnostic(`QAA：pending=${JSON.stringify(pending)}；close=${prices.map((row) => row.close).join(",")}；${result.summary}`);
  });
}

test("分割重抓只回最後一天：保留待修與四天原價，拒絕混用基準", async (t) => {
  const days = weekdays(4);
  const { db, sql } = await splitDb(days);
  refetch(t, [days.at(-1)!]);

  const result = await runJob(db, "prices", "test");
  const pending = JSON.parse((sql.prepare("SELECT value FROM settings WHERE key = 'pending_rebase'").get() as { value: string }).value);
  const prices = sql.prepare("SELECT date, close FROM prices WHERE symbol = 'QAA' ORDER BY date").all();
  assert.deepEqual({ pending, prices: prices.map((row) => ({ ...row })) }, {
    pending: { QAA: 2 },
    prices: days.map((date) => ({ date, close: 20 })),
  });
  const detail = result.detail as Record<string, unknown>;
  const failed = detail.failed as Record<string, string>;
  assert.match(failed.QAA, /分割後重抓的歷史未涵蓋已存區間，保留待修、下次重試：/);
  const rebased = detail.rebased as { uncovered: Record<string, string> };
  assert.equal(failed.QAA, `分割後重抓的歷史未涵蓋已存區間，保留待修、下次重試：${rebased.uncovered.QAA}`);
  assert.equal(result.status, "partial");
  assert.match(result.summary, /失敗 QAA/);
  const recorded = sql.prepare("SELECT status, summary, detail FROM runs WHERE id = ?").get(result.id) as { status: string; summary: string; detail: string };
  assert.equal(recorded.status, "partial");
  assert.equal(recorded.summary, result.summary);
  assert.deepEqual(JSON.parse(recorded.detail).rebased.uncovered, rebased.uncovered);
  t.diagnostic(`QAA：pending=${JSON.stringify(pending)}；close=${prices.map((row) => row.close).join(",")}；status=${recorded.status}；${failed.QAA}`);
});

test("分割重抓從已存最早日之前開始：寫入新基準並清除待修", async (t) => {
  const days = weekdays(4);
  const { db, sql } = await splitDb(days);
  const freshDays = [addDays(days[0], -1), ...days];
  refetch(t, freshDays);

  const result = await runJob(db, "prices", "test");
  const pending = JSON.parse((sql.prepare("SELECT value FROM settings WHERE key = 'pending_rebase'").get() as { value: string }).value);
  assert.deepEqual(pending, {});
  const prices = sql.prepare("SELECT date, close FROM prices WHERE symbol = 'QAA' ORDER BY date").all();
  assert.deepEqual(prices.map((row) => ({ ...row })), freshDays.map((date) => ({ date, close: 10 })));
  const detail = result.detail as Record<string, unknown>;
  const rebased = detail.rebased as { uncovered: Record<string, string> };
  assert.deepEqual(rebased.uncovered, {});
  assert.equal(result.status, "ok", result.summary);
});

test("分割重抓涵蓋 2200 天窗口：寫入新基準，窗口外舊列筆數與內容不變", async (t) => {
  const upTo = latestExpectedClose();
  const days = Array.from({ length: 2401 }, (_, i) => addDays(upTo, i - 2400));
  const freshDays = days.slice(100);
  const { db, sql } = await splitDb(days);
  const olderQuery = sql.prepare("SELECT * FROM prices WHERE symbol = 'QAA' AND date < ? ORDER BY date");
  const olderBefore = olderQuery.all(freshDays[0]);
  assert.equal(olderBefore.length, 100);
  refetch(t, freshDays);

  const result = await runJob(db, "prices", "test");
  const pending = JSON.parse((sql.prepare("SELECT value FROM settings WHERE key = 'pending_rebase'").get() as { value: string }).value);
  assert.deepEqual(pending, {});
  assert.deepEqual(olderQuery.all(freshDays[0]), olderBefore);
  const freshPrices = sql.prepare("SELECT date, close FROM prices WHERE symbol = 'QAA' AND date >= ? ORDER BY date").all(freshDays[0]);
  assert.deepEqual(freshPrices.map((row) => ({ ...row })), freshDays.map((date) => ({ date, close: 10 })));
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM prices WHERE symbol = 'QAA'").get() as { n: number }).n, 2401);
  const detail = result.detail as Record<string, unknown>;
  const rebased = detail.rebased as { uncovered: Record<string, string> };
  assert.deepEqual(rebased.uncovered, {});
  assert.equal(result.status, "ok", result.summary);
});
