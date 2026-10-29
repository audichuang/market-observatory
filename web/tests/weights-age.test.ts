import assert from "node:assert/strict";
import { test } from "node:test";
import { loader as sourcesLoader, type Props as SourcesProps } from "../pages/sources.server.ts";
import { loader as watchlistLoader, type Props as WatchlistProps } from "../pages/watchlist.server.ts";
import { NYSE_CALENDAR, expectedSessions, inCalendarCoverage, latestScheduledClose } from "../src/lib/calendar.ts";
import { weightsLagSessions, weightsStaleNote } from "../src/lib/weights-age.ts";
import { requireViewer } from "../src/server/account.ts";
import { watchlistView } from "../src/server/views.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

test("持股檔齡只計交易日，跨週末與感恩節休市不多算", () => {
  assert.equal(weightsLagSessions("2026-10-23", "2026-10-26"), 1);
  assert.equal(weightsLagSessions("2026-11-25", "2026-11-27"), 1);
});

test("持股日期等於或晚於目標時不落後", () => {
  assert.equal(weightsLagSessions("2026-10-23", "2026-10-23"), 0);
  assert.equal(weightsLagSessions("2026-10-26", "2026-10-23"), 0);
});

test("任一日期在 NYSE 日曆覆蓋外就不判斷，也不丟錯", () => {
  assert.equal(weightsLagSessions("2024-10-21", "2024-10-23"), null);
  assert.equal(weightsLagSessions("2024-12-31", "2025-01-02"), null);
  assert.equal(weightsLagSessions("2027-12-30", "2028-01-03"), null);
});

test("持股落後 2 個交易日仍在通常延遲內，3 個才顯示共用警示", () => {
  assert.equal(weightsStaleNote("2026-10-20", "2026-10-22"), null);
  assert.equal(weightsStaleNote("2026-10-19", "2026-10-22"), "權重未更新：最新 SPY 持股停在 2026-10-19，到 2026-10-22 已落後 3 個交易日（通常落後 1～2 個），成分與股數變動沒有反映");
});

test("缺日期、日曆覆蓋外或持股不落後時沒有警示", () => {
  assert.equal(weightsStaleNote(null, "2026-10-22"), null);
  assert.equal(weightsStaleNote(undefined, "2026-10-22"), null);
  assert.equal(weightsStaleNote("2026-10-22", null), null);
  assert.equal(weightsStaleNote("2026-10-22", undefined), null);
  assert.equal(weightsStaleNote("2024-10-21", "2024-10-23"), null);
  assert.equal(weightsStaleNote("2026-10-23", "2026-10-22"), null);
});

for (const lag of [5, 0]) {
  test(`資料來源頁：持股落後 ${lag} 個交易日的警示以排程應有日期判斷，無需登入資訊`, async (t) => {
    const expected = latestScheduledClose();
    if (!inCalendarCoverage(expected)) return t.skip("NYSE 日曆覆蓋外");
    const asOf = expectedSessions(NYSE_CALENDAR.coverageStart, expected).at(-lag - 1)!;
    const { db, sql } = await migratedDb();
    t.after(() => sql.close());
    sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, shares, fetched_at) VALUES (?, 'NVDA', 'NVIDIA', 7, 100, ?)").run(asOf, new Date().toISOString());
    const out = await (sourcesLoader as unknown as (c: unknown) => Promise<SourcesProps>)({ env: { DB: db } });
    assert.equal(out.expected, expected);
    if (lag === 5) {
      assert.match(out.weightsStale!, /權重未更新/);
      assert.equal(out.weightsStale, weightsStaleNote(asOf, expected));
    } else assert.equal(out.weightsStale, null);
  });

  test(`名單頁：持股落後 ${lag} 個交易日的警示只加在網頁 loader，其他欄位等於 watchlistView`, async (t) => {
    const expected = latestScheduledClose();
    if (!inCalendarCoverage(expected)) return t.skip("NYSE 日曆覆蓋外");
    const asOf = expectedSessions(NYSE_CALENDAR.coverageStart, expected).at(-lag - 1)!;
    const { db, sql } = await migratedDb();
    t.after(() => sql.close());
    sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, shares, fetched_at) VALUES (?, 'NVDA', 'NVIDIA', 7, 100, ?)").run(asOf, new Date().toISOString());
    const c = {
      env: { DB: db },
      req: { query: () => undefined, url: "http://localhost/watchlist" },
      get: (k: string) => k === "user" ? { id: "weights-age-user", email: "weights-age@example.test", name: "測試使用者" } : undefined,
    };
    const { weightsStale, ...view } = await (watchlistLoader as unknown as (c: unknown) => Promise<WatchlistProps>)(c);
    if (lag === 5) {
      assert.match(weightsStale!, /權重未更新/);
      assert.equal(weightsStale, weightsStaleNote(asOf, expected));
    } else assert.equal(weightsStale, null);
    const apiView = await watchlistView(c as unknown as Parameters<typeof watchlistView>[0], requireViewer(c));
    assert.deepEqual(view, apiView);
    assert.ok(!("weightsStale" in apiView));
  });
}
