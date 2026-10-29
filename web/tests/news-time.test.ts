import assert from "node:assert/strict";
import { test } from "node:test";
import { newsTiming, parseAgo, publishedBounds } from "../src/lib/news-time.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

test("ago：只接受整數分鐘、小時與指定冠詞", () => {
  for (const [ago, count, unitMs] of [
    ["0 minutes ago", 0, 60_000], ["1 minute ago", 1, 60_000], ["2 minutes ago", 2, 60_000],
    ["1 hour ago", 1, 3_600_000], ["2 hours ago", 2, 3_600_000],
    ["a minute ago", 1, 60_000], ["an hour ago", 1, 3_600_000],
  ] as const) assert.deepEqual(parseAgo(ago), { count, unitMs }, ago);
  for (const ago of ["1 day ago", "2 days ago", "Oct 20, 2026", "1.5 hours ago", "-1 hour ago", "an minute ago", "a hour ago", "a minutes ago", "an hours ago", "1 hour ago extra", "", null, undefined]) {
    assert.equal(parseAgo(ago), null, String(ago));
    assert.equal(publishedBounds({ fetchedAt: "2026-10-23T22:30:00Z", publishedAgo: ago }), null);
    assert.equal(newsTiming({ fetched_at: "2026-10-23T22:30:00Z", published_ago: ago }, "2026-10-23"), "unknown");
  }
});

test("發布區間：上下各留一單位，下界再留 15 分鐘，零值上界不超過 fetched_at", () => {
  for (const [publishedAgo, lower, upper] of [
    ["2 hours ago", "2026-10-23T14:45:00.000Z", "2026-10-23T17:00:00.000Z"],
    ["2 minutes ago", "2026-10-23T17:42:00.000Z", "2026-10-23T17:59:00.000Z"],
    ["0 minutes ago", "2026-10-23T17:44:00.000Z", "2026-10-23T18:00:00.000Z"],
    ["a minute ago", "2026-10-23T17:43:00.000Z", "2026-10-23T18:00:00.000Z"],
    ["an hour ago", "2026-10-23T15:45:00.000Z", "2026-10-23T18:00:00.000Z"],
  ]) {
    const bounds = publishedBounds({ fetchedAt: "2026-10-23T18:00:00Z", publishedAgo });
    assert.deepEqual(bounds && [bounds.lower.toISOString(), bounds.upper.toISOString()], [lower, upper], publishedAgo);
  }
});

test("新聞時間：夏令、冬令與提早收盤依發布區間分為三態", () => {
  const cases = [
    ["2026-10-23", "2026-10-23T18:00:00Z", "2 hours ago", "before-close"],
    ["2026-10-23", "2026-10-23T22:30:00Z", "1 hours ago", "after-close"],
    ["2026-10-23", "2026-10-24T00:00:00Z", "5 hours ago", "unknown"],
    ["2026-12-03", "2026-12-03T19:00:00Z", "2 hours ago", "before-close"],
    ["2026-12-03", "2026-12-03T23:30:00Z", "1 hours ago", "after-close"],
    ["2026-12-03", "2026-12-04T01:00:00Z", "5 hours ago", "unknown"],
    ["2026-11-27", "2026-11-27T17:00:00Z", "2 hours ago", "before-close"],
    ["2026-11-27", "2026-11-27T20:30:00Z", "1 hours ago", "after-close"],
    ["2026-11-27", "2026-11-27T22:00:00Z", "5 hours ago", "unknown"],
    ["2026-10-23", "2026-10-23T22:30:00Z", "an hour ago", "after-close"],
    ["2026-10-23", "2026-10-23T20:00:00Z", "0 minutes ago", "unknown"],
    ["2026-10-23", "2026-10-23T19:59:59Z", "0 minutes ago", "before-close"],
    ["2026-10-23", "2026-10-23T22:15:00Z", "1 hour ago", "after-close"],
    ["2026-10-23", "2026-10-23T22:14:59Z", "1 hour ago", "unknown"],
    ["2026-10-23", "2026-10-23T04:30:00Z", "2 hours ago", "before-close"],
    ["2026-10-23", "2026-10-24T12:00:00Z", "1 hour ago", "after-close"],
  ] as const;
  for (const [date, fetched_at, published_ago, timing] of cases) {
    assert.equal(newsTiming({ fetched_at, published_ago }, date), timing, `${date}: ${fetched_at} / ${published_ago}`);
  }
});

test("新聞 upsert：保留第一次的 ago 與 fetched_at，既有 null 不補值", async () => {
  const { db, sql } = await migratedDb();
  try {
    sql.exec(`INSERT INTO news (id, symbols, title, url, source, fetched_at)
      VALUES ('legacy', 'SPY', 'Old', 'https://example.test/old', 'nasdaq', '2026-10-23T18:00:00Z')`);
    const legacy = sql.prepare("SELECT published_ago FROM news WHERE id = 'legacy'").get();
    assert.equal(legacy?.published_ago, null);

    const { NEWS_UPSERT_SQL } = await import("../src/server/jobs.ts");
    const upsert = (id: string, ago: string | null, fetchedAt: string) => db.prepare(NEWS_UPSERT_SQL)
      .bind(id, "SPY", "News", "https://example.test/news", "Publisher", "2026-10-23", "nasdaq", fetchedAt, null, null, ago).run();
    await upsert("first", "2 hours ago", "2026-10-23T18:00:00Z");
    await upsert("first", "5 hours ago", "2026-10-23T21:00:00Z");
    await upsert("empty", null, "2026-10-23T18:00:00Z");
    await upsert("empty", "5 hours ago", "2026-10-23T21:00:00Z");
    await upsert("legacy", "5 hours ago", "2026-10-23T21:00:00Z");
    const rows = sql.prepare("SELECT id, published_ago, fetched_at FROM news ORDER BY id").all();
    assert.deepEqual(rows.map((row) => ({ ...row })), [
      { id: "empty", published_ago: null, fetched_at: "2026-10-23T18:00:00Z" },
      { id: "first", published_ago: "2 hours ago", fetched_at: "2026-10-23T18:00:00Z" },
      { id: "legacy", published_ago: null, fetched_at: "2026-10-23T18:00:00Z" },
    ]);
  } finally {
    sql.close();
  }
});

test("新聞工作：ago 配對各自回應的擷取時間，不等全部來源結束才取時間", async (t) => {
  const { db, sql } = await migratedDb();
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-23T18:00:00Z") });
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin + url.pathname, "https://www.nasdaq.com/api/news/topic/articlebysymbol");
    const symbol = url.searchParams.get("q")!.split("|")[0];
    requests++;
    if (symbol !== "SPY") {
      await new Promise<void>((resolve) => setImmediate(resolve));
      t.mock.timers.tick(60_000);
    }
    return Response.json({ data: { rows: [{ id: symbol, title: `${symbol} news`, url: `/articles/${symbol}`, created: "Oct 23, 2026", ago: "2 hours ago" }] }, status: { rCode: 200 } });
  });
  try {
    const { runJob } = await import("../src/server/jobs.ts");
    const result = await runJob(db, "news", "test");
    assert.equal(result.status, "ok", result.summary);
    assert.equal(result.detail.subrequests, requests);
    assert.equal(requests, 8, "SPY 與預設七家公司各一個請求");
    const first = sql.prepare("SELECT published_at, published_ago, fetched_at FROM news WHERE id = 'nasdaq:SPY'").get();
    assert.deepEqual({ ...first }, { published_at: "2026-10-23", published_ago: "2 hours ago", fetched_at: "2026-10-23T18:00:00.000Z" });
    const later = sql.prepare("SELECT fetched_at FROM news WHERE id = 'nasdaq:NVDA'").get();
    assert.ok(String(later?.fetched_at) > String(first?.fetched_at));
  } finally {
    sql.close();
  }
});
