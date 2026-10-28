import assert from "node:assert/strict";
import { test } from "node:test";
import { aiPipelineStatus, dailyWork } from "../src/server/ai-batch.ts";
import { Series } from "../src/lib/analytics.ts";
import { buildSnapshot } from "../src/lib/snapshot.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

const now = new Date("2026-10-28T02:00:00Z");

test("daily 待辦帶最新快照 revision，沒有快照時維持 optional", async () => {
  const { db, sql } = await migratedDb();
  const snap = buildSnapshot({ tradeDate: "2026-10-27", series: { SPX: new Series([{ date: "2026-10-26", close: 7000 }, { date: "2026-10-27", close: 7010 }]) }, checks: {}, weights: { asOf: "2026-10-26", byTicker: new Map() }, members: [] })!;
  assert.equal((await dailyWork(db, "2026-10-27")).revision, undefined);
  sql.prepare("INSERT INTO snapshots VALUES ('2026-10-27', 3, 'new', 'test', ?, '2026-10-27T22:00:00Z')").run(JSON.stringify(snap));
  const work = await dailyWork(db, "2026-10-27");
  assert.equal(work.date, "2026-10-27");
  assert.equal(work.revision, 3);
});

test("AI 狀態依 D1 區分最近 partial 與最後 ok，列出翻譯積壓與最新交易日缺少的大盤摘要", async () => {
  const { db, sql } = await migratedDb();
  const run = sql.prepare("INSERT INTO runs (job, trigger, status, started_at, finished_at, summary, detail) VALUES (?, 'ai-batch', ?, ?, ?, ?, ?)");
  const okAt = "2026-10-26T22:01:00Z";
  const partialAt = "2026-10-27T22:01:00Z";
  for (const job of ["ai-daily", "ai-translate"]) {
    run.run(job, "ok", "2026-10-26T22:00:00Z", okAt, "預期 2、寫入 2", "private stack owner@example.test");
    run.run(job, "partial", "2026-10-27T22:00:00Z", partialAt, "預期 2、寫入 1", "private stack owner@example.test");
  }
  run.run("news", "ok", "2026-10-27T20:00:00Z", "2026-10-27T20:01:00Z", "完成", "private");
  run.run("news", "error", "2026-10-27T23:00:00Z", "2026-10-27T23:01:00Z", "失敗", "private");
  const news = sql.prepare("INSERT INTO news (id, symbols, title, url, source, published_at, fetched_at, title_zh, enriched_at) VALUES (?, 'NVDA', 'News', 'https://example.test/news', 'nasdaq', ?, ?, ?, ?)");
  news.run("missing-title", "2026-10-20", "2026-10-20T20:00:00Z", null, "2026-10-20T21:00:00Z");
  news.run("missing-enriched", "2026-10-27", "2026-10-27T20:00:00Z", "中文標題", null);
  news.run("done", "2026-10-27", "2026-10-27T20:00:00Z", "中文標題", "2026-10-27T21:00:00Z");
  news.run("too-old", "2026-10-19", "2026-10-19T20:00:00Z", null, null);
  sql.exec("INSERT INTO snapshots VALUES ('2026-10-26', 1, 'old', 'test', '{}', '2026-10-26T22:00:00Z'), ('2026-10-27', 2, 'new', 'test', '{}', '2026-10-27T22:00:00Z')");
  sql.exec("INSERT INTO news_digests VALUES ('SPX', '2026-10-26', '舊摘要', 'neutral', '', 'old', 'test', '2026-10-26T22:00:00Z')");

  const out = await aiPipelineStatus(db, now);
  for (const status of [out.daily, out.translate]) {
    assert.deepEqual({ ...status.lastRun }, { status: "partial", finishedAt: partialAt, summary: "預期 2、寫入 1" });
    assert.equal(status.lastOkAt, okAt);
  }
  assert.deepEqual({ ...out.translate.backlog }, { count: 2, oldestFetchedAt: "2026-10-20T20:00:00Z" });
  assert.equal(out.daily.latestTradeDate, "2026-10-27");
  assert.equal(out.daily.marketDigestWritten, false);
  assert.equal(out.news.lastOkAt, "2026-10-27T20:01:00Z");
  assert.doesNotMatch(JSON.stringify(out), /detail|stack|@/);

  sql.exec("INSERT INTO news_digests VALUES ('SPX', '2026-10-27', '新摘要', 'neutral', '', 'new', 'test', '2026-10-27T23:00:00Z')");
  assert.equal((await aiPipelineStatus(db, now)).daily.marketDigestWritten, true);
});
