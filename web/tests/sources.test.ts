import assert from "node:assert/strict";
import { test } from "node:test";
import { isNyseSession, latestExpectedClose } from "../src/lib/calendar.ts";
import { parseCboeCsv } from "../src/lib/sources/cboe.ts";
import type { DayConflict } from "../src/lib/sources/http.ts";
import { parseEarningsCalendar, parseEarningsDate, parseNasdaqHistorical } from "../src/lib/sources/nasdaq.ts";
import { parseSpyHoldings } from "../src/lib/sources/ssga.ts";
import { parseYahooChart, parseYahooSpark } from "../src/lib/sources/yahoo.ts";

test("Yahoo：依交易所時區換日期、丟掉空收盤、代號不符就報錯", () => {
  const json = {
    chart: {
      result: [{
        meta: { symbol: "^GSPC", exchangeTimezoneName: "America/New_York" },
        // 2026-10-21、22、23 的 13:30Z（美東 9:30 開盤）；22 日收盤為空
        timestamp: [1792589400, 1792675800, 1792762200],
        indicators: { quote: [{ close: [7663.43, null, 7623.68], open: [1, 2, 3], high: [1, 2, 3], low: [1, 2, 3], volume: [1, 2, 3] }] },
      }],
    },
  };
  const bars = parseYahooChart(json, "^GSPC");
  assert.deepEqual(bars.map((b) => [b.date, b.close]), [["2026-10-21", 7663.43], ["2026-10-23", 7623.68]]);
  assert.throws(() => parseYahooChart(json, "NVDA"), /不同/);
});

test("Yahoo：拒收非日線頻率，1d 與缺少頻率欄位照常接受", () => {
  const chart = {
    meta: { symbol: "NVDA", dataGranularity: "3mo" as string | undefined },
    timestamp: [1792589400],
    indicators: { quote: [{ close: [10] }] },
  };
  assert.throws(() => parseYahooChart({ chart: { result: [chart] } }, "NVDA"), /回應頻率是 3mo，不是日線/);
  assert.equal(parseYahooSpark({ spark: { result: [{ symbol: "NVDA", response: [chart] }] } }).size, 0);
  chart.meta.dataGranularity = "1d";
  assert.equal(parseYahooChart({ chart: { result: [chart] } }, "NVDA").length, 1);
  delete chart.meta.dataGranularity;
  assert.equal(parseYahooChart({ chart: { result: [chart] } }, "NVDA").length, 1);
});

test("Yahoo：中段衝突日整天略過，最後一天留最後一筆，相同收盤合併且日期遞增", () => {
  const chart = {
    meta: { symbol: "NVDA", dataGranularity: "1d" },
    // Source order need not be chronological; the latest date is still the live-day exception.
    timestamp: [1792762200, 1792589400, 1792675800, 1792675860, 1792589460, 1792762260, 1792675920],
    indicators: { quote: [{ close: [30, 5, 10, 20, 5.000001, 40, 10], open: [1, 2, 3, 4, 5, 6, 7] }] },
  };
  const conflicts: DayConflict[] = [];
  const bars = parseYahooChart({ chart: { result: [chart] } }, "NVDA", conflicts);
  assert.deepEqual(bars.map((b) => [b.date, b.close, b.open]), [["2026-10-21", 5.000001, 5], ["2026-10-23", 40, 6]]);
  assert.deepEqual(conflicts, [{ date: "2026-10-22", closes: [10, 20, 10] }]);

  chart.timestamp = [1792589400, 1792675800, 1792675860, 1792762200];
  chart.indicators.quote[0].close = [5, 10, 20, 30];
  const middleConflicts: DayConflict[] = [];
  assert.deepEqual(parseYahooChart({ chart: { result: [chart] } }, "NVDA", middleConflicts).map((b) => b.date), ["2026-10-21", "2026-10-23"]);
  assert.deepEqual(middleConflicts, [{ date: "2026-10-22", closes: [10, 20] }]);

  const lastConflicts: DayConflict[] = [];
  chart.timestamp = [1792762200, 1792762260];
  chart.indicators.quote[0].close = [30, 40];
  assert.equal(parseYahooChart({ chart: { result: [chart] } }, "NVDA", lastConflicts)[0].close, 40);
  assert.deepEqual(lastConflicts, []);
});

test("Yahoo spark：回報各代號衝突，空結果與錯頻率交給逐檔補抓", () => {
  const chart = {
    meta: { symbol: "NVDA", dataGranularity: "1d" },
    timestamp: [1792589400, 1792675800, 1792675860, 1792762200],
    indicators: { quote: [{ close: [5, 10, 20, 30] }] },
  };
  const conflicts: Record<string, DayConflict[]> = {};
  const bars = parseYahooSpark({ spark: { result: [
    { symbol: "NVDA", response: [chart] },
    { symbol: "EMPTY", response: [{ meta: { symbol: "EMPTY" }, timestamp: [] }] },
    { symbol: "WRONG", response: [{ ...chart, meta: { symbol: "WRONG", dataGranularity: "3mo" } }] },
  ] } }, conflicts);
  assert.deepEqual([...bars.keys()], ["NVDA"]);
  assert.deepEqual(bars.get("NVDA")!.map((b) => b.date), ["2026-10-21", "2026-10-23"]);
  assert.deepEqual(conflicts, { NVDA: [{ date: "2026-10-22", closes: [10, 20] }] });
});

test("Cboe：VIX 五欄與 SPX 兩欄都能解析，since 之前的列不讀", () => {
  const vix = parseCboeCsv("DATE,OPEN,HIGH,LOW,CLOSE\n10/22/2026,19,20,18,19.03\n10/23/2026,19.1,20,18.5,19.45\n", "2026-10-23");
  assert.deepEqual(vix, [{ date: "2026-10-23", open: 19.1, high: 20, low: 18.5, close: 19.45, volume: null }]);
  const spx = parseCboeCsv("DATE,SPX\n10/23/2026,7623.680000\n");
  assert.equal(spx[0].close, 7623.68);
  assert.throws(() => parseCboeCsv("<html>"), /表頭/);
});

for (const source of ["Nasdaq", "Cboe"]) test(`${source}：衝突日整天略過（含最後一天），相同收盤留來源最後一列`, () => {
  const rows = [
    { date: "10/21/2026", close: "5", open: "1" },
    { date: "10/21/2026", close: "5.000001", open: "2" },
    { date: "10/22/2026", close: "10", open: "3" },
    { date: "10/22/2026", close: "20", open: "4" },
    { date: "10/23/2026", close: "30", open: "5" },
    { date: "10/23/2026", close: "40", open: "6" },
  ];
  const conflicts: DayConflict[] = [];
  const bars = source === "Nasdaq"
    ? parseNasdaqHistorical({ tradesTable: { rows } }, conflicts)
    : parseCboeCsv("DATE,OPEN,CLOSE\n" + rows.map((r) => `${r.date},${r.open},${r.close}`).join("\n"), undefined, conflicts);
  assert.deepEqual(bars.map((b) => [b.date, b.close, b.open]), [["2026-10-21", 5.000001, 2]]);
  assert.deepEqual(conflicts, [{ date: "2026-10-22", closes: [10, 20] }, { date: "2026-10-23", closes: [30, 40] }]);
});

test("Nasdaq：歷史行情、Zacks 推估與財報日曆", () => {
  const bars = parseNasdaqHistorical({ tradesTable: { rows: [{ date: "10/23/2026", close: "$216.54", volume: "6,317,269" }, { date: "10/22/2026", close: "218.22" }] } });
  assert.deepEqual(bars.map((b) => [b.date, b.close]), [["2026-10-22", 218.22], ["2026-10-23", 216.54]]);
  assert.equal(bars[1].volume, 6317269);

  const est = parseEarningsDate("NVDA", { announcement: "Earnings announcement* for NVDA: Nov 18, 2026", reportText: "is estimated to report earnings on 11/18/2026. derived from an algorithm ... the consensus EPS forecast for the quarter is $2.49." })!;
  assert.equal(est.date, "2026-11-18");
  assert.equal(est.status, "estimated");
  assert.equal(est.detail, "市場預估 EPS $2.49");
  const both = parseEarningsDate("NVDA", { announcement: "Earnings announcement* for NVDA: Nov 18, 2026", reportText: "the consensus EPS forecast for the quarter is $2.49. The reported EPS for the same quarter last year was $1.24." })!;
  assert.equal(both.detail, "市場預估 EPS $2.49，去年同季 $1.24");
  assert.equal(parseEarningsDate("META", { announcement: "Earnings announcement* for META: ", reportText: "hasn't provided" }), null);

  const cal = parseEarningsCalendar("2026-10-29", [{ symbol: "AMZN", time: "time-after-hours" }, { symbol: "LLY" }], ["AMZN", "AAPL"]);
  assert.equal(cal.length, 1);
  assert.equal(cal[0].status, "confirmed");
  assert.match(cal[0].detail, /盤後/);
});

test("SSGA：讀出持股日期與權重，表格不完整就拒收", () => {
  const header = [["Fund Name:", "SPY"], ["Holdings:", "As of 22-Oct-2026"], ["Name", "Ticker", "Identifier", "SEDOL", "Weight", "Sector", "Shares Held"]];
  const rows = Array.from({ length: 500 }, (_, i) => [`CO ${i}`, i === 0 ? "BRK.B" : `T${i}`, "", "", "0.2", "-", "100"]);
  const f = parseSpyHoldings([...header, ...rows]);
  assert.equal(f.asOf, "2026-10-22");
  assert.equal(f.holdings[0].ticker, "BRK-B");
  assert.throws(() => parseSpyHoldings([...header, ...rows.slice(0, 50)]), /不完整/);
});

test("NYSE 日曆：假日、週末、覆蓋範圍外", () => {
  assert.equal(isNyseSession("2026-11-26"), false); // 感恩節
  assert.equal(isNyseSession("2026-11-27"), true); // 提早收盤但有開市
  assert.equal(isNyseSession("2026-10-24"), false); // 週六
  assert.equal(isNyseSession("2030-01-02"), null);
  // 美東週六上午 → 最近應有收盤的是週五。
  assert.equal(latestExpectedClose(new Date("2026-10-24T14:00:00Z")), "2026-10-23");
  // 美東週五 16:00（還不到 17 點）→ 週四。
  assert.equal(latestExpectedClose(new Date("2026-10-23T20:00:00Z")), "2026-10-22");
});
