import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { Series } from "../src/lib/analytics.ts";
import { latestExpectedClose, previousExpectedSession } from "../src/lib/calendar.ts";
import { nextPendingRebase } from "../src/lib/rebase.ts";
import { buildSnapshot, type Snapshot } from "../src/lib/snapshot.ts";
import { MAG7_TICKERS } from "../src/lib/universe.ts";
import { saveSnapshots } from "../src/server/repo.ts";

test("冬令與夏令：美東 16:30 之後就算當天收盤", () => {
  // 2026-11-02（一）冬令 EST：UTC 21:40 = 美東 16:40 → 當天
  assert.equal(latestExpectedClose(new Date("2026-11-02T21:40:00Z")), "2026-11-02");
  // 美東 16:20 → 還不算，往前找到上週五
  assert.equal(latestExpectedClose(new Date("2026-11-02T21:20:00Z")), "2026-10-30");
  // 夏令 EDT：UTC 21:40 = 美東 17:40 → 當天
  assert.equal(latestExpectedClose(new Date("2026-10-23T21:40:00Z")), "2026-10-23");
});

test("前一個應開市日依 NYSE 日曆，跳過週末與假日", () => {
  assert.equal(previousExpectedSession("2026-10-26"), "2026-10-23");
  assert.equal(previousExpectedSession("2026-11-27"), "2026-11-25"); // 感恩節休市
  assert.equal(previousExpectedSession("2030-01-02"), null);
});

test("指數缺前一交易日：當日漲跌與歸因不算，列入缺資料", () => {
  const series: Record<string, Series> = {
    SPX: new Series([{ date: "2026-10-21", close: 7700 }, { date: "2026-10-23", close: 7400 }]),
  };
  const weights = new Map<string, number>();
  for (const t of MAG7_TICKERS) {
    series[t] = new Series([{ date: "2026-10-21", close: 100 }, { date: "2026-10-23", close: 96 }]);
    weights.set(t, 4);
  }
  const s = buildSnapshot({ tradeDate: "2026-10-23", series, checks: {}, weights: { asOf: "2026-10-21", byTicker: weights } })!;
  assert.equal(s.index.returnPct, null);
  assert.equal(s.index.changePts, null);
  assert.equal(s.mag7Total.contributionPts, null);
  assert.ok(s.quality.missing.includes("SPX 2026-10-22"));
  // 週一的前一個交易日是週五，不是缺資料。
  const monday = buildSnapshot({
    tradeDate: "2026-10-26",
    series: { SPX: new Series([{ date: "2026-10-23", close: 7400 }, { date: "2026-10-26", close: 7474 }]) },
    checks: {},
    weights: null,
  })!;
  assert.equal(monday.index.changePts, 74);
});

test("分割待修清單：偵測到就加入，成功重抓才移除", () => {
  assert.deepEqual(nextPendingRebase({}, { NVDA: 10 }, []), { NVDA: 10 });
  assert.deepEqual(nextPendingRebase({ NVDA: 10 }, {}, []), { NVDA: 10 }); // 重抓失敗、重疊不足也不會遺失
  assert.deepEqual(nextPendingRebase({ NVDA: 10 }, { SH: 0.25 }, ["NVDA"]), { SH: 0.25 });
});

// 用 node:sqlite 實際執行 saveSnapshots 的 SQL，模擬 D1 的 prepare/bind/batch。
function sqliteD1() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("CREATE TABLE snapshots (trade_date TEXT NOT NULL, revision INTEGER NOT NULL, digest TEXT NOT NULL, reason TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (trade_date, revision))");
  const db = {
    prepare: (q: string) => ({ bind: (...args: unknown[]) => ({ q, args }) }),
    batch: async (stmts: { q: string; args: unknown[] }[]) => stmts.map((s) => ({ results: sql.prepare(s.q).all(...(s.args as never[])) })),
  };
  return { db: db as unknown as D1Database, sql };
}

const snap = (tradeDate: string, close: number) => ({ tradeDate, index: { close } }) as unknown as Snapshot;

test("快照版本：內容沒變不寫、變了加一版；同時兩批寫入不會撞號", async () => {
  const { db, sql } = sqliteD1();
  assert.deepEqual(await saveSnapshots(db, [snap("2026-10-23", 1)], "a"), ["2026-10-23 r1"]);
  assert.deepEqual(await saveSnapshots(db, [snap("2026-10-23", 1)], "b"), []);
  // 兩個工作同時算出不同內容：不會因為讀到同一個最新版本而搶同一號、整批失敗。
  const [x, y] = await Promise.all([saveSnapshots(db, [snap("2026-10-23", 2)], "c"), saveSnapshots(db, [snap("2026-10-23", 3)], "d")]);
  assert.deepEqual([...x, ...y].sort(), ["2026-10-23 r2", "2026-10-23 r3"]);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM snapshots").get() as { n: number }).n, 3);
});
