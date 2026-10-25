// 新聞 AI 排程（src/server/ai-batch.ts）：待辦只給還沒做的、答案驗證後寫進 D1、格式不對的略過，大盤那段存成 SPX。
import assert from "node:assert/strict";
import { test } from "node:test";
import { easternDate } from "../src/lib/calendar.ts";
import { Series } from "../src/lib/analytics.ts";
import { buildSnapshot } from "../src/lib/snapshot.ts";
import { DEFAULT_WATCHLIST } from "../src/lib/universe.ts";
import { MARKET_KEY, dailyWork, importResults, translateWork } from "../src/server/ai-batch.ts";
import { saveSnapshots } from "../src/server/repo.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

const D1 = "2026-10-22";
const D2 = "2026-10-23";

async function seeded() {
  const { db, sql } = await migratedDb();
  const ins = sql.prepare("INSERT INTO news (id, symbols, title, url, publisher, published_at, source, fetched_at, summary, primary_symbol) VALUES (?, ?, ?, ?, 'p', ?, 'nasdaq', 'x', ?, ?)");
  ins.run("n1", "SPY,NVDA", "Nvidia beats estimates", "https://e.com/n1", D2, "Rev up", "NVDA");
  ins.run("n2", "NVDA", "3 AI Stocks to Buy", "https://e.com/n2", D2, null, "DELL");
  ins.run("n3", "SPY", "Fed holds rates", "https://e.com/n3", D2, null, null);
  ins.run("old", "NVDA", "Old news", "https://e.com/old", "2026-01-02", null, "NVDA");
  const series = {
    SPX: new Series([{ date: D1, close: 7600 }, { date: D2, close: 7560 }]),
    NVDA: new Series([{ date: D1, close: 200 }, { date: D2, close: 190 }]),
  };
  const members = DEFAULT_WATCHLIST.filter((m) => m.key === "NVDA");
  const snap = buildSnapshot({ tradeDate: D2, series, checks: {}, weights: { asOf: D1, byTicker: new Map([["NVDA", 8]]) }, members })!;
  await saveSnapshots(db, [snap], "測試");
  return { db, sql };
}

const translated = (n: number, zh: string, focus: string[], category = "財報") => ({ n, title_zh: zh, tone: "negative", category, focus });

test("翻譯：只給最近還沒翻的；答案依序號寫回，格式不對的那組略過", async () => {
  const { db, sql } = await seeded();
  const work = await translateWork(db, "2026-10-25");
  assert.deepEqual(work.map((w) => w.id).sort(), ["n1", "n2", "n3"], "超過 7 天的舊新聞不補");
  const ids = work.map((w) => w.id);
  const answer = { items: ids.map((id, i) => translated(i + 1, `中文 ${id}`, id === "n3" ? ["SPY"] : id === "n1" ? ["NVDA"] : [], id === "n3" ? "總經與市場" : "財報")) };
  const r = await importResults(db, { translate: [{ ids, answer }, { ids: ["n1"], answer: "胡言亂語" }] });
  assert.equal(r.translated, 3);
  assert.equal(r.skipped.length, 1);
  assert.equal((sql.prepare("SELECT title_zh, focus FROM news WHERE id = 'n3'").get() as { title_zh: string; focus: string }).focus, "SPY");
  assert.deepEqual(await translateWork(db, "2026-10-25"), [], "翻過的不再給");
});

test("每日：重點只給 AI 判定重要的；公司重點與大盤各一份，寫過就不再給", async () => {
  const { db, sql } = await seeded();
  const today = easternDate();
  // 還沒翻：沒有 focus，不給文章重點
  let work = await dailyWork(db, D2);
  assert.equal(work.points.length, 0);
  sql.prepare("UPDATE news SET published_at = ? WHERE id IN ('n1','n2','n3')").run(D2);
  sql.prepare("UPDATE news SET title_zh = '輝達財報優於預期', focus = 'NVDA', category = '財報', enriched_at = 'x' WHERE id = 'n1'").run();
  sql.prepare("UPDATE news SET title_zh = '3 檔 AI 股', focus = '', category = '投資觀點', enriched_at = 'x' WHERE id = 'n2'").run();
  sql.prepare("UPDATE news SET title_zh = '聯準會按兵不動', focus = 'SPY', category = '總經與市場', enriched_at = 'x' WHERE id = 'n3'").run();
  work = await dailyWork(db, D2);
  assert.equal(work.date, D2);
  assert.deepEqual(work.points.map((p) => p.id).sort(), ["n1", "n3"], "選股文（focus 空）不寫重點");
  assert.deepEqual(work.digests.map((d) => [d.key, d.news.map((n) => n.id)]), [["NVDA", ["n1"]]]);
  assert.ok(work.market);
  assert.deepEqual(work.market.news, ["聯準會按兵不動"]);
  assert.equal(work.market.movers[0].key, "NVDA");

  const r = await importResults(db, {
    model: "claude-test",
    points: [{ id: "n1", answer: { points: ["營收創新高"], tone: "positive" } }, { id: "n3", answer: { points: [] } }],
    digests: [
      { key: "NVDA", date: D2, newsIds: ["n1"], answer: { summary: "財報優於預期但股價下跌", tone: "neutral" } },
      { key: MARKET_KEY, date: D2, newsIds: ["n3"], answer: { summary: "權值股拖累指數走低", tone: "negative" } },
      { key: "AAPL", date: "昨天", newsIds: [], answer: { summary: "日期不對的不寫", tone: "neutral" } },
    ],
  });
  assert.deepEqual([r.points, r.digests, r.skipped.length], [1, 2, 2]);
  assert.equal((sql.prepare("SELECT points_zh FROM news WHERE id = 'n1'").get() as { points_zh: string }).points_zh, '["營收創新高"]');
  assert.equal((sql.prepare("SELECT model FROM news_digests WHERE symbol = 'SPX'").get() as { model: string }).model, "claude-test");
  work = await dailyWork(db, today);
  assert.deepEqual([work.digests.length, work.market], [0, null], "寫過的公司與大盤不再給");
});
