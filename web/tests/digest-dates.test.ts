import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Series } from "../src/lib/analytics.ts";
import { buildSnapshot } from "../src/lib/snapshot.ts";
import { saveSnapshots } from "../src/server/repo.ts";
import { newsView, overviewView, type ViewCtx } from "../src/server/views.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

const D1 = "2026-10-27";
const D2 = "2026-10-28";
const members = [{ key: "NVDA", company: "NVIDIA", tickers: ["NVDA"] }];
const viewer = { id: "digest-dates", email: "digest@example.test", name: "日期測試", isOwner: false };

async function seeded(t: TestContext) {
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(`${D2}T23:00:00Z`) });
  sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
    .run("watchlist:digest-dates", JSON.stringify(members), D2);
  const ctx = (query: Record<string, string> = {}): ViewCtx => ({
    env: { DB: db }, req: { query: (key) => query[key], url: "http://dates.test/" },
  });
  const series = { SPX: new Series([{ date: D1, close: 100 }, { date: D2, close: 101 }]), NVDA: new Series([{ date: D1, close: 100 }, { date: D2, close: 102 }]) };
  async function snapshot(date: string) {
    const s = buildSnapshot({ tradeDate: date, series, checks: {}, weights: null, members });
    assert.ok(s);
    await saveSnapshots(db, [s], "摘要日期回歸測試");
  }
  return { sql, ctx, snapshot };
}

test("總覽查看 D1 時只配 D1 摘要，不取 D2 的同公司摘要", async (t) => {
  const { sql, ctx, snapshot } = await seeded(t);
  await snapshot(D1);
  await snapshot(D2);
  const insert = sql.prepare("INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES ('NVDA', ?, ?, 'positive', '', 'dates', 'test', ?)");
  insert.run(D1, "D1 公司重點", D1);
  insert.run(D2, "D2 公司重點", D2);

  const out = await overviewView(ctx({ date: D1 }), viewer);
  assert.equal(out.snapshot?.tradeDate, D1);
  assert.deepEqual(out.digests.map((d) => [d.symbol, d.date, d.summary]), [["NVDA", D1, "D1 公司重點"]]);
});

test("新聞頁以最新快照日為 latestTradeDate，不跟著舊摘要日期走", async (t) => {
  const { sql, ctx, snapshot } = await seeded(t);
  await snapshot(D1);
  await snapshot(D2);
  sql.prepare("INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES ('NVDA', ?, '較早的公司重點', 'positive', '', 'dates', 'test', ?)").run(D1, D1);

  const out = await newsView(ctx(), viewer);
  assert.equal(out.latestTradeDate, D2);
  assert.equal(out.digests[0]?.date, D1);
});

test("新聞頁沒有快照時 latestTradeDate 為 null", async (t) => {
  const { ctx } = await seeded(t);
  const out = await newsView(ctx(), viewer);
  assert.equal(out.latestTradeDate, null);
});
