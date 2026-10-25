import assert from "node:assert/strict";
import { test } from "node:test";
import { Series, leverageDrift, periodReturn, rollWeight, simulateDca, smaAt, smaSeries } from "../src/lib/analytics.ts";

const s = (pairs: [string, number][]) => new Series(pairs.map(([date, close]) => ({ date, close })));

test("periodReturn 從起點當天或之前最後一筆算起，缺終點回 null", () => {
  const x = s([["2026-01-02", 100], ["2026-01-05", 110], ["2026-01-06", 121]]);
  assert.equal(periodReturn(x, "2026-01-03", "2026-01-06")?.toFixed(6), (21).toFixed(6));
  assert.equal(periodReturn(x, "2026-01-01", "2026-01-06"), null); // 沒有起點以前的資料
  assert.equal(periodReturn(x, "2026-01-02", "2026-01-07"), null); // 終點那天沒資料
});

test("SMA 不足 n 筆回 null，不用部分資料硬算", () => {
  const x = s([["2026-01-02", 1], ["2026-01-05", 2], ["2026-01-06", 3]]);
  assert.equal(smaAt(x, "2026-01-05", 3), null);
  assert.equal(smaAt(x, "2026-01-06", 3), 2);
  assert.deepEqual(smaSeries(x.points, 2), [null, 1.5, 2.5]);
});

test("rollWeight：個股漲得比指數多，權重變大；同一天不變", () => {
  const stock = s([["2026-01-02", 100], ["2026-01-05", 120]]);
  const index = s([["2026-01-02", 1000], ["2026-01-05", 1100]]);
  assert.equal(rollWeight(5, stock, index, "2026-01-02", "2026-01-02"), 5);
  assert.equal(rollWeight(5, stock, index, "2026-01-02", "2026-01-05")?.toFixed(6), (5 * 1.2 / 1.1).toFixed(6));
  // 往回推（持股檔比目標日晚）也成立。
  assert.equal(rollWeight(6, stock, index, "2026-01-05", "2026-01-02")?.toFixed(6), (6 / 1.2 * 1.1).toFixed(6));
  assert.equal(rollWeight(5, stock, index, "2026-01-02", "2026-01-09"), null);
});

test("定投：每月第一個交易日買一次，市值與單筆對照正確", () => {
  const x = s([["2026-01-02", 10], ["2026-01-20", 12], ["2026-02-02", 5], ["2026-02-27", 10]]);
  const r = simulateDca(x, "2026-01-01", 100)!;
  assert.equal(r.months, 2);
  assert.equal(r.invested, 200);
  assert.equal(r.units, 10 + 20);
  assert.equal(r.value, 300);
  assert.equal(r.lumpSumValue, (200 / 10) * 10);
  // 2/2 市值 30 單位 × 5 = 150，已投入 200 → 帳面 −25%。
  assert.equal(r.maxDrawdownPct, -25);
});

test("槓桿偏離 = 實際報酬 − 倍數 × 指數報酬", () => {
  const etf = s([["2026-01-02", 100], ["2026-01-05", 115]]);
  const idx = s([["2026-01-02", 100], ["2026-01-05", 106]]);
  const d = leverageDrift(etf, idx, 3, "2026-01-02", "2026-01-05")!;
  assert.equal(d.naive.toFixed(6), (18).toFixed(6));
  assert.equal(d.drift.toFixed(6), (-3).toFixed(6));
});
