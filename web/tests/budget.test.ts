import assert from "node:assert/strict";
import { test } from "node:test";
import { Budget, BudgetError, fetchWithTimeout, retryDelayMs } from "../src/lib/sources/http.ts";
import { parseYahooSpark, fetchYahooSpark } from "../src/lib/sources/yahoo.ts";
import { sameClose } from "../src/server/repo.ts";
import { analystPicksWithin } from "../src/server/jobs.ts";

/** 換掉 global fetch，依序回傳 responses，記下每次請求的網址。 */
function stubFetch(responses: (() => Response)[]) {
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    urls.push(String(input));
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    return next();
  }) as typeof fetch;
  return { urls, restore: () => (globalThis.fetch = original) };
}

test("額度用完就在本地拒絕，不會真的打出去", async () => {
  const b = new Budget(2);
  const f = stubFetch([() => new Response("a"), () => new Response("b")]);
  try {
    await fetchWithTimeout("t", "https://x.test/1", { budget: b });
    await fetchWithTimeout("t", "https://x.test/2", { budget: b });
    await assert.rejects(fetchWithTimeout("t", "https://x.test/3", { budget: b }), BudgetError);
    assert.equal(f.urls.length, 2);
    assert.equal(b.used, 2);
    assert.equal(b.remaining, 0);
    assert.deepEqual(b.byHost, { "x.test": 2 });
  } finally {
    f.restore();
  }
});

test("轉址的每一跳都算一個請求", async () => {
  const b = new Budget(10);
  const f = stubFetch([
    () => new Response(null, { status: 302, headers: { location: "https://y.test/next" } }),
    () => new Response(null, { status: 301, headers: { location: "/final" } }),
    () => new Response("ok"),
  ]);
  try {
    const res = await fetchWithTimeout("t", "https://x.test/start", { budget: b });
    assert.equal(await res.text(), "ok");
    assert.deepEqual(f.urls, ["https://x.test/start", "https://y.test/next", "https://y.test/final"]);
    assert.equal(b.used, 3);
  } finally {
    f.restore();
  }
});

test("429 重試一次（也算額度）；額度用完就不重試", async () => {
  const wait = () => 0;
  const f = stubFetch([() => new Response("", { status: 429 }), () => new Response("ok")]);
  try {
    const b = new Budget(5);
    assert.equal(await (await fetchWithTimeout("t", "https://x.test/", { budget: b, retryWaitMs: wait })).text(), "ok");
    assert.equal(b.used, 2);
  } finally {
    f.restore();
  }
  const g = stubFetch([() => new Response("", { status: 429 })]);
  try {
    const b = new Budget(1);
    await assert.rejects(fetchWithTimeout("t", "https://x.test/", { budget: b, retryWaitMs: wait }), /HTTP 429/);
    assert.equal(g.urls.length, 1);
  } finally {
    g.restore();
  }
  // 404 不重試
  const h = stubFetch([() => new Response("", { status: 404 })]);
  try {
    await assert.rejects(fetchWithTimeout("t", "https://x.test/", { budget: new Budget(5), retryWaitMs: wait }), /HTTP 404/);
    assert.equal(h.urls.length, 1);
  } finally {
    h.restore();
  }
});

test("重試等待：照 Retry-After、最多 5 秒，加 0～0.5 秒隨機", () => {
  assert.equal(retryDelayMs("2", 0), 2000);
  assert.equal(retryDelayMs("60", 0), 5000);
  assert.equal(retryDelayMs(null, 0), 1000);
  assert.equal(retryDelayMs("0", 0.999), 499);
});

test("spark 收盤與 chart 只差浮點精度：不算收盤改了；真的改了一分錢要算", () => {
  // 實測 ^GSPC：spark 6812.3457（單精度）vs chart 6812.3459
  assert.ok(sameClose(6812.3459, 6812.3457));
  assert.ok(sameClose(512.04, 512.04003));
  assert.ok(!sameClose(512.04, 512.05));
  assert.ok(!sameClose(31.6, 31.62));
});

test("spark 一次最多 20 檔：29 檔拆成 2 個請求；某一批失敗不影響另一批", async () => {
  const symbols = Array.from({ length: 29 }, (_, i) => `S${i}`);
  const reply = (u: string) => {
    const syms = new URL(u).searchParams.get("symbols")!.split(",");
    return {
      spark: {
        result: syms.map((s) => ({
          symbol: s,
          response: [{ meta: { symbol: s }, timestamp: [Date.parse("2026-10-23T20:00:00Z") / 1000], indicators: { quote: [{ close: [10] }] } }],
        })),
      },
    };
  };
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const u = String(input);
    urls.push(u);
    return urls.length === 1 ? new Response(JSON.stringify(reply(u))) : new Response("", { status: 500 });
  }) as typeof fetch;
  try {
    const b = new Budget(10);
    const { bars, errors } = await fetchYahooSpark(symbols, "1mo", b);
    assert.equal(urls.length, 2);
    assert.equal(new URL(urls[0]).searchParams.get("symbols")!.split(",").length, 20);
    assert.equal(bars.size, 20);
    assert.equal(errors.length, 1);
    assert.equal(b.used, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test("spark 回傳的代號與要求的不同就丟掉那一檔", () => {
  const out = parseYahooSpark({
    spark: { result: [{ symbol: "AAA", response: [{ meta: { symbol: "BBB" }, timestamp: [1792800000], indicators: { quote: [{ close: [1] }] } }] }] },
  } as never);
  assert.equal(out.size, 0);
});

test("分析師輪替照剩下的額度取檔數：前 100 檔一檔 2 個請求", () => {
  const top = new Set(["A", "B", "C"]);
  assert.deepEqual(analystPicksWithin(["A", "B", "X", "C"], top, 5), ["A", "B", "X"]);
  assert.deepEqual(analystPicksWithin(["A", "B", "X", "C"], top, 4), ["A", "B"]);
  assert.deepEqual(analystPicksWithin(["A"], top, 1), []);
  assert.deepEqual(analystPicksWithin(["X", "Y"], top, 0), []);
});

test("spark 的浮點雜訊不會重寫收盤、不會清掉已做完的交叉核對；只有收盤的新資料不覆蓋既有的開高低量", async () => {
  const { migratedDb } = await import("./helpers/fake-cloudflare.ts");
  const { upsertBars } = await import("../src/server/repo.ts");
  const { db, sql } = await migratedDb();
  const day = (close: number, ohlc: number | null) => ({ date: "2026-10-23", open: ohlc, high: ohlc, low: ohlc, close, volume: ohlc });
  await upsertBars(db, [{ symbol: "SPX", source: "yahoo-chart", bars: [day(6812.3459, 6800)] }]);
  sql.exec("UPDATE prices SET check_status = 'match', check_close = 6812.35");
  const noise = await upsertBars(db, [{ symbol: "SPX", source: "yahoo-chart", bars: [day(6812.3457, null)] }]);
  assert.equal(noise.changed.SPX, 0);
  let row = sql.prepare("SELECT close, open, check_status FROM prices").get() as { close: number; open: number; check_status: string };
  assert.deepEqual([row.close, row.open, row.check_status], [6812.3459, 6800, "match"]);
  // 真的修正了收盤：要寫入、要清掉核對結果，但開盤價（spark 沒給）保留舊的。
  const fixed = await upsertBars(db, [{ symbol: "SPX", source: "yahoo-chart", bars: [day(6815.1, null)] }]);
  assert.equal(fixed.changed.SPX, 1);
  row = sql.prepare("SELECT close, open, check_status FROM prices").get() as { close: number; open: number; check_status: string };
  assert.deepEqual([row.close, row.open, row.check_status], [6815.1, 6800, null]);
});
