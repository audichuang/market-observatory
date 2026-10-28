import assert from "node:assert/strict";
import { test } from "node:test";
import { detectRebase, refetchCoverage } from "../src/lib/rebase.ts";

const bars = (pairs: [string, number][]) => pairs.map(([date, close]) => ({ date, open: null, high: null, low: null, close, volume: null }));

const coverageCases = [
  {
    name: "空歷史即使沒有已存列也不涵蓋",
    stored: null,
    fresh: [],
    expected: { ok: false, reason: "重抓沒有日線" },
  },
  {
    name: "沒有已存列時非空歷史涵蓋",
    stored: null,
    fresh: ["2026-10-28"],
    expected: { ok: true },
  },
  {
    name: "末日早於已存末日，即使起點足夠早仍不涵蓋",
    stored: { min: "2020-04-02", max: "2026-10-28" },
    fresh: ["2019-01-01", "2026-10-27"],
    expected: { ok: false, reason: "重抓只到 2026-10-27，早於已存的 2026-10-28" },
  },
  {
    name: "起訖等於已存區間時涵蓋短歷史",
    stored: { min: "2026-10-26", max: "2026-10-28" },
    fresh: ["2026-10-26", "2026-10-28"],
    expected: { ok: true },
  },
  {
    name: "起點恰為 2200 天前，保留更早已存列仍算涵蓋",
    stored: { min: "2020-04-02", max: "2026-10-28" },
    fresh: ["2020-10-19", "2026-10-28"],
    expected: { ok: true },
  },
  {
    name: "起點比 2200 天前晚一天且未涵蓋已存起點時不涵蓋",
    stored: { min: "2020-04-02", max: "2026-10-28" },
    fresh: ["2020-10-20", "2026-10-28"],
    expected: { ok: false, reason: "重抓從 2020-10-20 開始，未涵蓋已存的 2020-04-02 起" },
  },
];

for (const { name, stored, fresh, expected } of coverageCases) {
  test(`重抓覆蓋：${name}`, () => {
    assert.deepEqual(refetchCoverage(stored, bars(fresh.map((date) => [date, 10])), "2026-10-28"), expected);
  });
}

test("2:1 分割：重疊區間最舊幾天新舊比值一致為 2，判定基準被改寫", () => {
  const existing = new Map([["2026-10-01", 200], ["2026-10-02", 202], ["2026-10-05", 204], ["2026-10-06", 206]]);
  const fresh = bars([["2026-10-01", 100], ["2026-10-02", 101], ["2026-10-05", 102], ["2026-10-06", 103], ["2026-10-07", 104]]);
  assert.equal(detectRebase(existing, fresh)?.toFixed(4), "2.0000");
});

test("分割發生在區間中段：只要最舊幾天被改寫就抓得到", () => {
  const existing = new Map([["2026-10-01", 200], ["2026-10-02", 202], ["2026-10-05", 204], ["2026-10-06", 103]]);
  const fresh = bars([["2026-10-01", 100], ["2026-10-02", 101], ["2026-10-05", 102], ["2026-10-06", 103]]);
  assert.ok(detectRebase(existing, fresh) !== null);
});

test("反向分割（1:10）也判定", () => {
  const existing = new Map([["2026-10-01", 5], ["2026-10-02", 5.1], ["2026-10-05", 5.2]]);
  const fresh = bars([["2026-10-01", 50], ["2026-10-02", 51], ["2026-10-05", 52]]);
  assert.equal(detectRebase(existing, fresh)?.toFixed(4), "0.1000");
});

test("一般收盤修正、新資料、重疊太少都不判定", () => {
  // 最後一天收盤從盤中價改成正式收盤，其餘相同。
  const revised = new Map([["2026-10-01", 100], ["2026-10-02", 101], ["2026-10-05", 102], ["2026-10-06", 99]]);
  assert.equal(detectRebase(revised, bars([["2026-10-01", 100], ["2026-10-02", 101], ["2026-10-05", 102], ["2026-10-06", 103.5]])), null);
  // 小幅、不一致的差異（資料源雜訊）不是分割。
  const noisy = new Map([["2026-10-01", 100.5], ["2026-10-02", 99], ["2026-10-05", 102]]);
  assert.equal(detectRebase(noisy, bars([["2026-10-01", 100], ["2026-10-02", 101], ["2026-10-05", 102]])), null);
  assert.equal(detectRebase(new Map(), bars([["2026-10-01", 100]])), null);
  assert.equal(detectRebase(new Map([["2026-10-01", 200]]), bars([["2026-10-01", 100]])), null);
});
