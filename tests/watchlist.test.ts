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

test("名單上的公司已不在持股檔（調出指數）：權重以 0 計，合計與其餘照算，並加註", () => {
  const D1 = "2026-10-22";
  const D2 = "2026-10-23";
  const series: Record<string, Series> = {
    SPX: new Series([{ date: D1, close: 7600 }, { date: D2, close: 7676 }]),
    AVGO: new Series([{ date: D1, close: 100 }, { date: D2, close: 105 }]),
    XYZ: new Series([{ date: D1, close: 50 }, { date: D2, close: 40 }]),
  };
  const members = [
    { key: "AVGO", company: "Broadcom", tickers: ["AVGO"] },
    { key: "XYZ", company: "Gone", tickers: ["XYZ"] },
  ];
  const s = buildSnapshot({ tradeDate: D2, series, checks: {}, weights: { asOf: D1, byTicker: new Map([["AVGO", 3]]) }, members })!;
  assert.equal(s.mag7.find((r) => r.key === "XYZ")!.weightPct, 0);
  assert.equal(s.mag7Total.weightPct, 3);
  assert.notEqual(s.rest.contributionPts, null);
  assert.ok(s.quality.notes.some((n) => n.includes("XYZ") && n.includes("權重以 0 計")));
  // 還沒有任何持股檔時不能當成 0（那是「不知道」，不是「沒有」）
  const none = buildSnapshot({ tradeDate: D2, series, checks: {}, weights: null, members })!;
  assert.equal(none.mag7Total.weightPct, null);
});

// node:sqlite 模擬 D1：prepare/bind 之後 first/all/run，run 回傳 meta.changes。
async function sqliteDb() {
  const { DatabaseSync } = await import("node:sqlite");
  const sql = new DatabaseSync(":memory:");
  sql.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)");
  sql.exec("CREATE TABLE weights (as_of TEXT, ticker TEXT, name TEXT, weight_pct REAL, shares REAL, fetched_at TEXT)");
  const stmt = (q: string, args: unknown[]) => ({
    first: async () => (sql.prepare(q).get(...(args as never[])) ?? null),
    all: async () => ({ results: sql.prepare(q).all(...(args as never[])) }),
    run: async () => ({ meta: { changes: Number(sql.prepare(q).run(...(args as never[])).changes) } }),
  });
  const db = { prepare: (q: string) => ({ ...stmt(q, []), bind: (...args: unknown[]) => stmt(q, args) }), batch: async () => [] };
  return { db: db as never, sql };
}

test("兩個裝置同時改名單：先寫的不會被後寫的蓋掉", async () => {
  const { updateWatchlist, loadWatchlist } = await import("../src/server/watchlist.ts");
  const { db, sql } = await sqliteDb();
  // 已經存過名單（走「比對舊值才更新」那條路；沒存過的「新增」路徑在下一段測）
  sql.prepare("INSERT INTO settings VALUES ('watchlist', ?, 'x')").run(JSON.stringify(DEFAULT_WATCHLIST));
  // 裝置 A 讀到名單後，存檔前裝置 B 先移除了 TSLA。
  let interleaved = false;
  const res = await updateWatchlist(db, (list) => {
    if (!interleaved) {
      interleaved = true;
      // 在 A 的 edit 裡同步插入 B 的寫入（模擬 A 抓價那幾秒內 B 完成）
      void updateWatchlist(db, (l) => l.filter((m) => m.key !== "TSLA"));
    }
    return [...list, { key: "AVGO", company: "Broadcom", tickers: ["AVGO"] }];
  });
  // 讓 B 的非同步寫入先完成，再看 A 的結果
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(res.ok);
  const keys = (await loadWatchlist(db)).map((m) => m.key);
  assert.ok(keys.includes("AVGO"), keys.join(","));
  assert.ok(!keys.includes("TSLA"), keys.join(","));
});

test("第一次存名單（設定表還沒有這列）時兩邊同時寫，也不會互相蓋掉", async () => {
  const { updateWatchlist, loadWatchlist } = await import("../src/server/watchlist.ts");
  const { db } = await sqliteDb();
  let interleaved = false;
  await updateWatchlist(db, (list) => {
    if (!interleaved) {
      interleaved = true;
      void updateWatchlist(db, (l) => l.filter((m) => m.key !== "TSLA"));
    }
    return [...list, { key: "AVGO", company: "Broadcom", tickers: ["AVGO"] }];
  });
  await new Promise((r) => setTimeout(r, 10));
  const keys = (await loadWatchlist(db)).map((m) => m.key);
  assert.ok(keys.includes("AVGO") && !keys.includes("TSLA"), keys.join(","));
});

test("名單清空時仍找得到持股檔日期（快照不會誤報「尚未取得權重」）", async () => {
  const { loadWeightAnchors, weightsNear } = await import("../src/server/repo.ts");
  const { db, sql } = await sqliteDb();
  sql.exec("INSERT INTO weights VALUES ('2026-10-22', 'NVDA', 'NVIDIA CORP', 7.7, 1, 'x')");
  const anchors = await loadWeightAnchors(db, []);
  assert.deepEqual(anchors.dates, ["2026-10-22"]);
  assert.equal(weightsNear(anchors, "2026-10-23")?.asOf, "2026-10-22");
});
