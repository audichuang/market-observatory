import assert from "node:assert/strict";
import { test } from "node:test";
import { outlookView } from "../src/server/outlook.ts";
import type { ViewCtx } from "../src/server/views.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

test("共識上榜表回傳目標價最低最高、會計年度與估計數", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-28T23:00:00Z") });
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  const stamp = "2026-10-28T23:00:00Z";
  sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, fetched_at) VALUES ('2026-10-27', 'NVDA', 'NVIDIA', 6, ?)").run(stamp);
  const price = sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at) VALUES (?, '2026-10-27', ?, 'test', ?)");
  price.run("SPX", 7000, stamp);
  price.run("VIX", 20, stamp);
  sql.prepare("INSERT INTO analyst_views (symbol, as_of, price, price_date, target_mean, target_low, target_high, buy, hold, sell, eps_up, eps_down, fiscal_end, estimates, fetched_at) VALUES ('NVDA', '2026-10-27', 100, '2026-10-27', 120, 90, 150, 10, 2, 1, 2, 1, 'Dec 2026', 20, ?)").run(stamp);
  const ctx: ViewCtx = { env: { DB: db }, req: { query: () => undefined, url: "http://test.local/outlook" } };

  const { consensus } = await outlookView(ctx);
  assert.ok(consensus);
  assert.equal(consensus.top[0].symbol, "NVDA");
  assert.equal(consensus.top[0].targetLow, 90);
  assert.equal(consensus.top[0].targetHigh, 150);
  assert.equal(consensus.top[0].fiscalEnd, "Dec 2026");
  assert.equal(consensus.top[0].estimates, 20);
  assert.equal(consensus.top[0].epsUp, 2);
  assert.equal(consensus.top[0].epsDown, 1);
});

test("共識上榜表與彙總共用七天界線，回傳股價、權重與指數收盤日", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-28T23:00:00Z") });
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  const stamp = "2026-10-28T23:00:00Z";
  const weight = sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, fetched_at) VALUES ('2026-10-27', ?, ?, ?, ?)");
  weight.run("NVDA", "NVIDIA", 6, stamp);
  weight.run("AAPL", "Apple", 5.5, stamp);
  const price = sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at) VALUES (?, '2026-10-27', ?, 'test', ?)");
  price.run("SPX", 7000, stamp);
  price.run("VIX", 20, stamp);
  const view = sql.prepare("INSERT INTO analyst_views (symbol, as_of, price, price_date, target_mean, buy, hold, sell, eps_up, eps_down, fetched_at) VALUES (?, ?, 100, ?, 120, 10, 2, 1, 4, 1, ?)");
  view.run("NVDA", "2026-10-27", "2026-10-27", stamp);
  view.run("AAPL", "2026-10-19", "2026-10-19", stamp);
  const ctx: ViewCtx = { env: { DB: db }, req: { query: () => undefined, url: "http://test.local/outlook" } };

  const { consensus } = await outlookView(ctx);
  assert.ok(consensus);
  assert.deepEqual(consensus.top.map((v) => v.symbol), ["NVDA"]);
  assert.equal(consensus.coveredWeightPct, 6);
  assert.equal(consensus.weightsAsOf, "2026-10-27");
  assert.equal(consensus.indexCloseDate, "2026-10-27");
  assert.equal(consensus.top[0].priceDate, "2026-10-27");

  sql.prepare("DELETE FROM analyst_views WHERE symbol = 'NVDA'").run();
  assert.equal((await outlookView(ctx)).consensus, null);
});
