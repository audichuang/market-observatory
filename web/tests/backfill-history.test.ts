// backfill-index-history：Cboe 長歷史只補 Yahoo 窗口之前的日期，窗口內的列（收盤、source、check_*）一個字都不能動。
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { FakeUpstream, migratedDb, weekdays } from "./helpers/fake-cloudflare.ts";
import { runJob } from "../src/server/jobs.ts";

const upstream = new FakeUpstream();
let restore: () => void;
before(() => {
  restore = upstream.install();
});
after(() => restore());
beforeEach(() => {
  upstream.rules = [];
  upstream.reset();
});

const YAHOO_DAYS = 60;
const CBOE_DAYS = 400;
const mdy = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
const all = weekdays(CBOE_DAYS);
const yahooDays = all.slice(-YAHOO_DAYS);
const yahooClose = (sym: string, i: number) => (sym === "SPX" ? 5000 + i * 1.37 : 18 + (i % 7) * 0.31);

/** Cboe 長歷史：重疊的那段收盤與 Yahoo 差 skew（預設 1e-7，跟真實資料一樣），更早的另外編。 */
function serveCboe(skew = 1e-7) {
  upstream.rules.push((url) => {
    if (url.host !== "cdn-api.cboe.com") return null;
    const vix = url.pathname.includes("VIX");
    const rows = all.map((d, i) => {
      const yi = i - (CBOE_DAYS - YAHOO_DAYS);
      const c = yi >= 0 ? yahooClose(vix ? "VIX" : "SPX", yi) * (1 + skew) : (vix ? 30 : 3000) + i * 0.5;
      return vix ? `${mdy(d)},${c},${c + 1},${c - 1},${c.toFixed(6)}` : `${mdy(d)},${c.toFixed(6)}`;
    });
    return new Response([vix ? "DATE,OPEN,HIGH,LOW,CLOSE" : "DATE,SPX", ...rows].join("\n"), { status: 200 });
  });
}

async function seeded() {
  const { db, sql } = await migratedDb();
  const ins = sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at, check_close, check_source, check_status, checked_at) VALUES (?, ?, ?, 'yahoo', 'x', ?, 'cboe', 'match', 'x')");
  for (const sym of ["SPX", "VIX"]) yahooDays.forEach((d, i) => ins.run(sym, d, yahooClose(sym, i), yahooClose(sym, i)));
  return { db, sql };
}

type Row = { symbol: string; date: string; close: number; source: string; check_status: string | null; check_close: number | null };
const rowsOf = (sql: { prepare: (q: string) => { all: (...a: never[]) => unknown[] } }, sym: string) =>
  sql.prepare("SELECT symbol, date, close, source, check_status, check_close FROM prices WHERE symbol = ? ORDER BY date").all(sym as never) as Row[];

test("補到 Yahoo 窗口之前：新列 source=cboe，窗口內的列不變，只花 2 個請求", async () => {
  const { db, sql } = await seeded();
  const before = rowsOf(sql, "SPX").concat(rowsOf(sql, "VIX"));
  serveCboe();
  const r = await runJob(db, "backfill-index-history", "test");
  assert.equal(r.status, "ok", r.summary);
  assert.equal(r.detail.subrequests, 2);
  const d = r.detail as unknown as { inserted: Record<string, number>; remaining: Record<string, number> };
  assert.deepEqual(d.inserted, { SPX: CBOE_DAYS - YAHOO_DAYS, VIX: CBOE_DAYS - YAHOO_DAYS });
  assert.deepEqual(d.remaining, { SPX: 0, VIX: 0 });
  for (const sym of ["SPX", "VIX"]) {
    const rows = rowsOf(sql, sym);
    assert.equal(rows.length, CBOE_DAYS);
    const old = rows.filter((x) => x.date < yahooDays[0]);
    assert.equal(old.length, CBOE_DAYS - YAHOO_DAYS);
    assert.ok(old.every((x) => x.source === "cboe" && x.check_status === null && x.check_close === null));
    assert.deepEqual(rows.filter((x) => x.date >= yahooDays[0]), before.filter((x) => x.symbol === sym));
  }
});

test("分段：每次只補最新的一段，三次補完、第四次不再寫入", async () => {
  const { db, sql } = await seeded();
  serveCboe();
  const older = CBOE_DAYS - YAHOO_DAYS; // 340
  const seen: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = await runJob(db, "backfill-index-history", "test", { historyRows: 120 });
    const d = r.detail as unknown as { inserted: Record<string, number>; remaining: Record<string, number> };
    seen.push(d.inserted.SPX);
    assert.equal(d.remaining.SPX, Math.max(0, older - 120 * (i + 1)));
    // 歷史永遠連續：目前最早的日期之後沒有缺口。
    const dates = rowsOf(sql, "SPX").map((x) => x.date);
    assert.deepEqual(dates, all.slice(all.length - dates.length));
  }
  assert.deepEqual(seen, [120, 120, 100, 0]);
  assert.equal(rowsOf(sql, "SPX").length, CBOE_DAYS);
});

test("重疊日期差 10%：SPX 不寫入、狀態 partial，VIX 照補", async () => {
  const { db, sql } = await seeded();
  upstream.rules.push((url) => {
    if (url.host !== "cdn-api.cboe.com" || url.pathname.includes("VIX")) return null;
    const rows = all.map((d, i) => {
      const yi = i - (CBOE_DAYS - YAHOO_DAYS);
      return `${mdy(d)},${(yi >= 0 ? yahooClose("SPX", yi) * 1.1 : 3000 + i).toFixed(6)}`;
    });
    return new Response(["DATE,SPX", ...rows].join("\n"), { status: 200 });
  });
  const r = await runJob(db, "backfill-index-history", "test");
  assert.equal(r.status, "partial");
  const d = r.detail as unknown as { inserted: Record<string, number>; overlapMismatches: number };
  assert.equal(d.inserted.SPX, 0);
  assert.equal(d.overlapMismatches, YAHOO_DAYS);
  assert.equal(rowsOf(sql, "SPX").length, YAHOO_DAYS);
});

test("還沒有日線時失敗並提示先跑 backfill-prices", async () => {
  const { db } = await migratedDb();
  const r = await runJob(db, "backfill-index-history", "test");
  assert.equal(r.status, "failed");
  assert.match(r.summary, /backfill-prices/);
});
