import assert from "node:assert/strict";
import { test } from "node:test";
import { Series } from "../src/lib/analytics.ts";
import { type PriceCheck, REST_NOTE, buildSnapshot, contributionPoints } from "../src/lib/snapshot.ts";
import { DEFAULT_WATCHLIST, watchTickers } from "../src/lib/universe.ts";
const MAG7_TICKERS = watchTickers(DEFAULT_WATCHLIST);

const D0 = "2026-10-21";
const D1 = "2026-10-22";
const D2 = "2026-10-23";

function input(overrides: { weightsAsOf?: string; mismatch?: string } = {}) {
  const series: Record<string, Series> = {
    SPX: new Series([{ date: D0, close: 7700 }, { date: D1, close: 7600 }, { date: D2, close: 7676 }]),
    VIX: new Series([{ date: D1, close: 20 }, { date: D2, close: 18 }]),
    RSP: new Series([{ date: D1, close: 200 }, { date: D2, close: 201 }]),
  };
  const weights = new Map<string, number>();
  for (const t of MAG7_TICKERS) {
    series[t] = new Series([{ date: D0, close: 100 }, { date: D1, close: 100 }, { date: D2, close: 102 }]);
    weights.set(t, 4);
  }
  const checks: Record<string, Map<string, PriceCheck>> = {};
  if (overrides.mismatch) checks[overrides.mismatch] = new Map([[D2, { status: "mismatch", source: "nasdaq", close: 1 }]]);
  return { tradeDate: D2, series, checks, weights: { asOf: overrides.weightsAsOf ?? D1, byTicker: weights }, members: DEFAULT_WATCHLIST };
}

test("貢獻點數 = 前日指數 × 前日權重 × 當日報酬", () => {
  assert.equal(contributionPoints(7600, 4, 2), 7600 * 0.04 * 0.02);
});

test("歸因：七巨頭與其餘成分股加總等於指數漲跌", () => {
  const s = buildSnapshot(input())!;
  assert.equal(s.index.changePts, 76);
  assert.equal(s.weights.method, "file");
  const nvda = s.mag7.find((r) => r.key === "NVDA")!;
  assert.equal(nvda.contributionPts?.toFixed(4), (7600 * 0.04 * 0.02).toFixed(4));
  // Alphabet 合併 GOOGL＋GOOG 兩個股類的權重與貢獻。
  const goog = s.mag7.find((r) => r.key === "GOOGL")!;
  assert.equal(goog.weightPct, 8);
  assert.equal(((s.mag7Total.contributionPts ?? 0) + (s.rest.contributionPts ?? 0)).toFixed(4), (76).toFixed(4));
  assert.equal(s.mag7Total.weightPct, 32);
});

test("持股日期不是前一交易日時，權重依價格推算並標示 rolled", () => {
  const s = buildSnapshot(input({ weightsAsOf: D0 }))!;
  assert.equal(s.weights.method, "rolled");
  // 個股 D0→D1 持平、指數 7700→7600：權重 = 4 × 1 ÷ (7600/7700)。
  assert.equal(s.mag7[0].weightPct?.toFixed(4), (4 / (7600 / 7700)).toFixed(4));
  assert.ok(s.quality.notes.some((n) => n.includes("推算")));
});

test("持股落後前一交易日 5 個交易日時，快照附權重未更新說明", () => {
  const s = buildSnapshot(input({ weightsAsOf: "2026-10-15" }))!;
  assert.ok(s.quality.notes.some((n) => /權重未更新/.test(n)));
  assert.ok(s.quality.notes.includes("權重未更新：最新 SPY 持股停在 2026-10-15，到 2026-10-22 已落後 5 個交易日（通常落後 1～2 個），成分與股數變動沒有反映"));
});

test("持股僅落後 2 個交易日時，快照仍只有原本的推算說明", () => {
  const s = buildSnapshot(input({ weightsAsOf: "2026-10-20" }))!;
  assert.deepEqual(s.quality.notes, ["權重由 2026-10-20 的 SPY 持股依價格變動推算到 2026-10-22（假設期間股數不變）"]);
});

test("持股晚於目標日時，不標權重未更新", () => {
  const s = buildSnapshot(input({ weightsAsOf: D2 }))!;
  assert.deepEqual(s.quality.notes, [`權重由 ${D2} 的 SPY 持股依價格變動推算到 ${D1}（假設期間股數不變）`]);
});

test("2024 年歷史快照超出日曆覆蓋時，不判斷權重未更新也不丟錯", () => {
  const historical = input({ weightsAsOf: "2024-10-15" });
  historical.tradeDate = "2024-10-23";
  historical.series = Object.fromEntries(Object.entries(historical.series).map(([symbol, series]) => [
    symbol, new Series(series.points.map((p) => ({ ...p, date: p.date.replace("2026", "2024") }))),
  ]));
  const s = buildSnapshot(historical)!;
  assert.equal(s.prevDate, "2024-10-22");
  assert.deepEqual(s.quality.notes, ["權重由 2024-10-15 的 SPY 持股依價格變動推算到 2024-10-22（假設期間股數不變）"]);
});

test("來源不一致會進 quality.mismatches，沒核對過的列為 pending", () => {
  const s = buildSnapshot(input({ mismatch: "NVDA" }))!;
  assert.deepEqual(s.quality.mismatches, ["NVDA"]);
  assert.equal(s.mag7.find((r) => r.key === "NVDA")!.check, "mismatch");
  assert.ok(s.quality.pendingChecks.includes("AAPL"));
});

test("沒有權重時不算歸因，也不假裝 0", () => {
  const s = buildSnapshot({ ...input(), weights: null })!;
  assert.equal(s.mag7Total.contributionPts, null);
  assert.equal(s.rest.contributionPts, null);
});

test("指數當天沒資料就不產生快照", () => {
  assert.equal(buildSnapshot({ ...input(), tradeDate: "2026-10-26" }), null);
});

test("回補早於持股檔的日期時，價格要載到持股日，否則權重推不回去", async () => {
  const { snapshotLoadWindow } = await import("../src/lib/snapshot.ts");
  // 目標 7 月、唯一一份持股檔在 10 月：結尾要延伸到 10 月。
  assert.deepEqual(snapshotLoadWindow(["2026-07-01", "2026-07-30"], ["2026-10-22"]), { from: "2025-04-27", to: "2026-10-22" });
  // 持股檔早於目標：維持目標結尾，不多載。
  assert.equal(snapshotLoadWindow(["2026-10-20", "2026-10-23"], ["2026-10-22"]).to, "2026-10-23");
  assert.equal(snapshotLoadWindow(["2026-10-23"], []).to, "2026-10-23");
});

test("持股檔晚於目標日、價格有載到時，歷史快照有歸因（往回推）", () => {
  const s = buildSnapshot(input({ weightsAsOf: D2 }))!;
  assert.equal(s.weights.method, "rolled");
  assert.notEqual(s.mag7Total.contributionPts, null);
});

test("其他成分股說明句只說一次「近似誤差」", () => {
  assert.equal(REST_NOTE.split("近似誤差").length - 1, 1);
  assert.equal(REST_NOTE, "其他成分股（含近似誤差）＝指數漲跌減掉名單合計（權重與價格口徑不同造成的誤差也算在這裡）。");
});
