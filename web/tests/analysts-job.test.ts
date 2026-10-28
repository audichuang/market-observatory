import assert from "node:assert/strict";
import { test } from "node:test";
import { Budget } from "../src/lib/sources/http.ts";
import { runJob } from "../src/server/jobs.ts";
import { FakeUpstream, migratedDb } from "./helpers/fake-cloudflare.ts";

const SYMBOLS = ["NVDA", "AAPL", "MSFT"];

async function seededDb() {
  const { db, sql } = await migratedDb();
  const insert = sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, shares, fetched_at) VALUES ('2026-10-26', ?, ?, ?, 1, 'x')");
  SYMBOLS.forEach((symbol, i) => insert.run(symbol, symbol, 7 - i));
  return { db, sql };
}

test("EPS 抓取失敗時分析師工作回報 partial，仍寫入目標價並保留空的 EPS 欄位", async (t) => {
  const { db, sql } = await seededDb();
  t.after(() => sql.close());
  const upstream = new FakeUpstream();
  upstream.rules = [(url) => url.pathname.endsWith("/earnings-forecast") ? new Response("down", { status: 500 }) : null];
  t.after(upstream.install());

  const result = await runJob(db, "analysts", "test", {}, new Budget(40));
  assert.equal(result.status, "partial", result.summary);
  const detail = result.detail as Record<string, unknown>;
  assert.deepEqual(new Set(detail.epsFailed as string[]), new Set(SYMBOLS));
  assert.match(result.summary, /分析師共識 3\/3 檔/);
  assert.match(result.summary, /EPS 失敗 3 檔/);
  const rows = sql.prepare("SELECT symbol, target_mean, fiscal_end, eps_forecast, eps_up, eps_down, estimates FROM analyst_views ORDER BY symbol").all();
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.target_mean, 120);
    for (const column of ["fiscal_end", "eps_forecast", "eps_up", "eps_down", "estimates"]) assert.equal(row[column], null);
  }
  t.diagnostic(`${result.status}：${result.summary}；epsFailed=${JSON.stringify(detail.epsFailed)}；寫入 ${rows.length} 列`);
});

test("盤中執行分析師工作時只寫入前一個已收盤交易日的股價", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-27T19:00:00Z") });
  const { db, sql } = await seededDb();
  t.after(() => sql.close());
  const upstream = new FakeUpstream();
  upstream.rules = [(url) => {
    if (!url.pathname.startsWith("/v7/finance/spark")) return null;
    const symbols = url.searchParams.get("symbols")!.split(",");
    return Response.json({
      spark: { result: symbols.map((symbol) => ({
        symbol,
        response: [{
          meta: { symbol, exchangeTimezoneName: "America/New_York" },
          timestamp: [Date.parse("2026-10-26T20:00:00Z") / 1000, Date.parse("2026-10-27T19:00:00Z") / 1000],
          indicators: { quote: [{ close: [100, 105] }] },
        }],
      })) },
    });
  }];
  t.after(upstream.install());

  const result = await runJob(db, "analysts", "test", {}, new Budget(40));
  assert.equal(result.status, "ok", result.summary);
  const rows = sql.prepare("SELECT symbol, price_date, price FROM analyst_views ORDER BY symbol").all();
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.price_date, "2026-10-26");
    assert.equal(row.price, 100);
  }
  t.diagnostic(`${result.status}：${result.summary}；${JSON.stringify(rows)}`);
});
