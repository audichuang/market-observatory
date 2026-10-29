import assert from "node:assert/strict";
import { test } from "node:test";
import { historyView, type ViewCtx } from "../src/server/views.ts";
import { migratedDb, weekdays } from "./helpers/fake-cloudflare.ts";

test("走勢頁的區間報酬與圖表共用各標的第一個交易日收盤", async (t) => {
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  const end = "2040-02-06";
  const stamp = `${end}T23:00:00.000Z`;
  const viewer = { id: "history-anchor-user", email: "anchor@example.test", name: "起點測試", isOwner: false };
  const watch = [{ key: "NVDA", company: "NVIDIA", tickers: ["NVDA"] }];
  sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)").run(`watchlist:${viewer.id}`, JSON.stringify(watch), stamp);
  sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, fetched_at) VALUES (?, 'NVDA', 'NVIDIA', 6, ?)").run(end, stamp);
  const price = sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at) VALUES (?, ?, ?, 'history-anchor', ?)");
  for (const date of weekdays(30, end)) {
    const close = date === end ? 121 : date >= "2040-01-09" ? 110 : 100;
    for (const symbol of ["SPX", "RSP"]) price.run(symbol, date, close, stamp);
    if (date >= "2040-01-16") price.run("NVDA", date, date === end ? 60 : 50, stamp);
  }
  const ctx = (query: Record<string, string>): ViewCtx => ({ env: { DB: db }, req: { query: (key) => query[key], url: "http://history-anchor.test/" } });
  const h = await historyView(ctx({ symbol: "SPX", months: "1" }), viewer);

  await t.test("起點落在週六時，SPX 圖表、區間報酬與統計列都從週一算起", () => {
    const spx = h.stats.find((s) => s.symbol === "SPX")!;
    const last = h.rebased.find((s) => s.symbol === "SPX")!.points.at(-1)!;
    assert.notEqual(spx.ret, null);
    assert.ok(Math.abs(last.value! - spx.ret!) < 0.01, `SPX 圖終值 ${last.value} 與統計報酬 ${spx.ret} 應相同`);
    assert.ok(Math.abs(h.mainStats.ret! - 10) < 0.01);
    assert.equal(h.mainStats.first, "2040-01-09");
    assert.equal(h.mainStats.last, end);
    assert.equal(spx.first, "2040-01-09");
  });

  await t.test("晚上市標的從自己的首筆算起，統計報酬與圖終值相同", () => {
    const nvda = h.stats.find((s) => s.symbol === "NVDA")!;
    const last = h.rebased.find((s) => s.symbol === "NVDA")!.points.at(-1)!;
    assert.notEqual(nvda.ret, null, "NVDA 有終點收盤，應從自己的首筆算出報酬");
    assert.equal(nvda.first, "2040-01-16");
    assert.equal(last.date, end);
    assert.ok(Math.abs(nvda.ret! - 20) < 0.01);
    assert.ok(Math.abs(last.value! - nvda.ret!) < 0.01);
  });
});
