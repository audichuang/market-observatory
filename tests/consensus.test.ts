import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateConsensus, type ViewRow } from "../src/lib/consensus.ts";
import { parseInsightText } from "../src/lib/sources/factset.ts";

const row = (symbol: string, asOf: string, price: number | null, targetMean: number | null, extra: Partial<ViewRow> = {}): ViewRow => ({
  symbol, asOf, price, targetMean, buy: 0, hold: 0, sell: 0, epsUp: null, epsDown: null, ...extra,
});

test("隱含漲幅依指數權重加權，不是簡單平均", () => {
  const weights = new Map([["A", 8], ["B", 2]]);
  const c = aggregateConsensus([row("A", "2026-10-24", 100, 110), row("B", "2026-10-24", 100, 150)], weights, "2026-10-25");
  // (8×10% + 2×50%) ÷ 10 = 18%；簡單平均會是 30%。
  assert.equal(c.impliedUpsidePct?.toFixed(6), (18).toFixed(6));
  assert.equal(c.coveredWeightPct, 10);
});

test("每檔只取最新一列；過期、不在權重表裡的不算", () => {
  const weights = new Map([["A", 5]]);
  const c = aggregateConsensus(
    [row("A", "2026-10-20", 100, 200), row("A", "2026-10-24", 100, 120), row("A", "2026-09-01", 100, 300), row("ZZZ", "2026-10-24", 1, 100)],
    weights,
    "2026-10-25",
  );
  assert.equal(c.symbols, 1);
  assert.equal(c.impliedUpsidePct?.toFixed(6), (20).toFixed(6));
});

test("買進占比與 EPS 修正廣度依權重加權；沒有修正的個股不計入廣度", () => {
  const weights = new Map([["A", 6], ["B", 3], ["C", 1]]);
  const c = aggregateConsensus(
    [
      row("A", "2026-10-24", 1, 1, { buy: 3, hold: 1, sell: 0, epsUp: 3, epsDown: 1 }),
      row("B", "2026-10-24", 1, 1, { buy: 0, hold: 2, sell: 2, epsUp: 0, epsDown: 2 }),
      row("C", "2026-10-24", 1, 1, { buy: 1, hold: 0, sell: 0, epsUp: 0, epsDown: 0 }),
    ],
    weights,
    "2026-10-25",
  );
  assert.equal(c.buyPct?.toFixed(6), (((6 * 0.75 + 3 * 0 + 1 * 1) / 10) * 100).toFixed(6));
  assert.equal(c.revisionBreadth?.toFixed(6), ((6 * 0.5 + 3 * -1) / 9).toFixed(6));
});

test("FactSet 週報：數字中間夾空白也抽得出來；句型不符就回 null", () => {
  const text = "The bottom - up target price for the S&P 500 is 9, 3 14 . 37 , which is 21 . 5 % above th e closing price of 7, 663 . 43 . " +
    "Overall, there are 1 3, 300 ratings on stocks in the S&P 500. Of these 1 3 ,300 ratings, 60 . 0 % are Buy ratings, 35 . 2 % are Hold ratings, and 4 . 7 % are Sell ratings. " +
    "Valuation: The forward 12-month P/E ratio for the S&P 500 is 18.7. This P/E ratio is below the 5-year average (19.8) and below the 10-year average (19.1).";
  const r = parseInsightText(text, "https://advantage.factset.com/x/EarningsInsight_102326.pdf");
  assert.deepEqual(
    [r.reportDate, r.bottomUpTarget, r.upsidePct, r.referenceClose, r.buyPct, r.holdPct, r.sellPct, r.forwardPE, r.forwardPE5y, r.forwardPE10y],
    ["2026-10-23", 9314.37, 21.5, 7663.43, 60, 35.2, 4.7, 18.7, 19.8, 19.1],
  );
  const below = parseInsightText("bottom-up target price for the S&P 500 is 5,000.00, which is 3.0% below the closing price of 5,154.64", "x");
  assert.equal(below.upsidePct, -3);
  assert.equal(parseInsightText("totally different layout", "x").bottomUpTarget, null);
});

test("PDF 內容流用間接長度（/Length 12 0 R）時，不會把 12 截成 1", async () => {
  const { deflateSync } = await import("node:zlib");
  const { extractPdfText } = await import("../src/lib/sources/factset.ts");
  const body = deflateSync(Buffer.from("BT (hello world) Tj ET"));
  const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n1 0 obj\n<< /Length 12 0 R /Filter /FlateDecode >>\nstream\n"), body, Buffer.from("endstream\nendobj\n")]);
  assert.match(await extractPdfText(new Uint8Array(pdf)), /hello world/);
});

test("分析師輪替：一直失敗的代號排到後面，不會每輪佔名額", async () => {
  const { rotationPicks } = await import("../src/lib/consensus.ts");
  const fetched = new Map([["A", "2026-10-20T00:00:00Z"], ["B", "2026-10-21T00:00:00Z"]]);
  // C 從沒成功過，但剛失敗過 → 排在 A、B 之後
  assert.deepEqual(rotationPicks(["C", "A", "B"], fetched, { C: "2026-10-24T00:00:00Z" }, 2), ["A", "B"]);
  // 沒失敗紀錄、也沒抓過的新代號照樣最先抓
  assert.deepEqual(rotationPicks(["A", "D"], fetched, {}, 1), ["D"]);
  // 成功比失敗新：以成功時間為準
  assert.deepEqual(rotationPicks(["A", "B"], fetched, { A: "2026-10-01T00:00:00Z" }, 1), ["A"]);
});
