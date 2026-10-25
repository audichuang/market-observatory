import assert from "node:assert/strict";
import test from "node:test";
import { Series } from "../src/lib/analytics.ts";
import { buildSnapshot } from "../src/lib/snapshot.ts";
import { DEFAULT_WATCHLIST, nasdaqCheckSymbols, yahooSymbols } from "../src/lib/universe.ts";
import { MAX_WATCH, addToWatchlist, companyKey, displayName, removeFromWatchlist, sanitizeWatchlist, type Holding } from "../src/lib/watchlist.ts";

const HOLDINGS: Holding[] = [
  { ticker: "NVDA", name: "NVIDIA CORP", weightPct: 7.5 },
  { ticker: "GOOGL", name: "ALPHABET INC CL A", weightPct: 2.88 },
  { ticker: "GOOG", name: "ALPHABET INC CL C", weightPct: 2.31 },
  { ticker: "AVGO", name: "BROADCOM INC", weightPct: 2.6 },
  { ticker: "BRK-B", name: "BERKSHIRE HATHAWAY INC CL B", weightPct: 1.54 },
  { ticker: "JPM", name: "JPMORGAN CHASE + CO", weightPct: 1.4 },
  { ticker: "2602335D", name: "SOMETHING", weightPct: 0.000003 },
];

test("觀察名單：只收 S&P 500 成分股，非股票列與重複代號拒絕", () => {
  assert.equal(addToWatchlist([], "TSM", HOLDINGS).ok, false);
  assert.equal(addToWatchlist([], "2602335D", HOLDINGS).ok, false);
  assert.equal(addToWatchlist([], "", HOLDINGS).ok, false);
  const once = addToWatchlist([], "avgo", HOLDINGS);
  assert.ok(once.ok);
  assert.deepEqual(once.member, { key: "AVGO", company: "Broadcom", tickers: ["AVGO"] });
  assert.equal(addToWatchlist(once.list, "AVGO", HOLDINGS).ok, false);
});

test("觀察名單：同公司其他股類一起加入，代號用權重較大的股類", () => {
  const r = addToWatchlist([], "GOOG", HOLDINGS);
  assert.ok(r.ok);
  assert.equal(r.member.key, "GOOGL");
  assert.deepEqual(r.member.tickers, ["GOOGL", "GOOG"]);
  assert.equal(r.member.company, "Alphabet");
  // 已有其中一個股類就算重複
  assert.equal(addToWatchlist(r.list, "GOOGL", HOLDINGS).ok, false);
  // 點號寫法轉成持股檔的橫線寫法
  const b = addToWatchlist([], "brk.b", HOLDINGS);
  assert.ok(b.ok);
  assert.deepEqual(b.member.tickers, ["BRK-B"]);
  assert.equal(b.member.company, "Berkshire Hathaway");
});

test("觀察名單：滿了就不能再加；上限剛好可以加到滿", () => {
  const many = Array.from({ length: MAX_WATCH - 1 }, (_, i) => ({ key: `X${i}`, company: `X${i}`, tickers: [`X${i}`] }));
  const last = addToWatchlist(many, "AVGO", HOLDINGS);
  assert.ok(last.ok);
  assert.equal(last.list.length, MAX_WATCH);
  const over = addToWatchlist(last.list, "JPM", HOLDINGS);
  assert.equal(over.ok, false);
});

test("公司名：拿掉股類與公司型態字尾", () => {
  assert.equal(companyKey("ALPHABET INC CL A"), companyKey("ALPHABET INC CL C"));
  assert.equal(companyKey("DATADOG INC   CLASS A"), "DATADOG INC");
  assert.equal(displayName("JPMORGAN CHASE + CO"), "Jpmorgan Chase");
  assert.equal(displayName("VISA INC CLASS A SHARES"), "Visa");
});

test("移除與讀回：壞資料、重複代號會被濾掉", () => {
  assert.deepEqual(removeFromWatchlist(DEFAULT_WATCHLIST, "TSLA").map((m) => m.key), ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META"]);
  assert.equal(sanitizeWatchlist("nope"), null);
  assert.deepEqual(
    sanitizeWatchlist([{ key: "A", company: "A", tickers: ["A"] }, { key: "B" }, { key: "A2", company: "A again", tickers: ["A"] }, { key: "C", company: "C", tickers: ["C"] }]),
    [{ key: "A", company: "A", tickers: ["A"] }, { key: "C", company: "C", tickers: ["C"] }],
  );
  // 空名單是合法的（使用者全部移除），不會退回預設
  assert.deepEqual(sanitizeWatchlist([]), []);
});

test("抓價與核對清單跟著名單走", () => {
  const list = [{ key: "AVGO", company: "Broadcom", tickers: ["AVGO"] }];
  assert.ok("AVGO" in yahooSymbols(list));
  assert.ok(!("NVDA" in yahooSymbols(list)));
  assert.ok(nasdaqCheckSymbols(list).some((s) => s.symbol === "AVGO" && s.assetClass === "stocks"));
});

test("快照用傳入的名單拆貢獻：名單外的股票算進「其餘」，加總仍等於指數漲跌", () => {
  const D1 = "2026-10-22";
  const D2 = "2026-10-23";
  const series: Record<string, Series> = {
    SPX: new Series([{ date: D1, close: 7600 }, { date: D2, close: 7676 }]),
    AVGO: new Series([{ date: D1, close: 100 }, { date: D2, close: 105 }]),
    NVDA: new Series([{ date: D1, close: 100 }, { date: D2, close: 90 }]),
  };
  const members = [{ key: "AVGO", company: "Broadcom", tickers: ["AVGO"] }];
  const s = buildSnapshot({ tradeDate: D2, series, checks: {}, weights: { asOf: D1, byTicker: new Map([["AVGO", 3], ["NVDA", 8]]) }, members })!;
  assert.deepEqual(s.mag7.map((r) => r.key), ["AVGO"]);
  assert.equal(s.mag7Total.weightPct, 3);
  const avgo = 7600 * 0.03 * 0.05;
  assert.equal(s.mag7Total.contributionPts?.toFixed(4), avgo.toFixed(4));
  assert.equal(((s.mag7Total.contributionPts ?? 0) + (s.rest.contributionPts ?? 0)).toFixed(4), (76).toFixed(4));
});

test("設定值是陣列時原樣讀回，不會跟預設值合併成物件", async () => {
  const { getSetting } = await import("../src/server/repo.ts");
  const stored = new Map<string, string>([["list", JSON.stringify([{ key: "A" }, { key: "B" }])], ["obj", JSON.stringify({ a: 2 })]]);
  const db = {
    prepare: () => ({ bind: (k: string) => ({ first: async () => (stored.has(k) ? { value: stored.get(k)! } : null) }) }),
  } as unknown as Parameters<typeof getSetting>[0];
  assert.deepEqual(await getSetting<unknown>(db, "list", null), [{ key: "A" }, { key: "B" }]);
  assert.deepEqual(await getSetting(db, "list", [] as unknown[]), [{ key: "A" }, { key: "B" }]);
  // 物件設定照舊：缺的欄位用預設補上
  assert.deepEqual(await getSetting(db, "obj", { a: 1, b: 1 }), { a: 2, b: 1 });
  assert.equal(await getSetting(db, "missing", null), null);
});
