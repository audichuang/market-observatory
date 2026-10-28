import assert from "node:assert/strict";
import { test } from "node:test";
import { isNyseSession, latestExpectedClose } from "../src/lib/calendar.ts";
import { parseCboeCsv } from "../src/lib/sources/cboe.ts";
import { parseEarningsCalendar, parseEarningsDate, parseNasdaqHistorical, parseNasdaqNews } from "../src/lib/sources/nasdaq.ts";
import { parseSpyHoldings } from "../src/lib/sources/ssga.ts";
import { parseYahooChart } from "../src/lib/sources/yahoo.ts";

test("Nasdaq 新聞：保留 ago 原文、去除首尾空白並限制 40 字，發布日期不變", () => {
  const rows = parseNasdaqNews([
    { title: "News", url: "/articles/time", created: "Oct 23, 2026", ago: "  2 hours ago  " },
    { title: "Long", url: "/articles/long", ago: `  ${"x".repeat(41)}  ` },
    { title: "Empty", url: "/articles/empty", ago: "  " },
    { title: "Missing", url: "/articles/missing" },
  ]);
  assert.equal(rows[0].publishedAt, "2026-10-23");
  assert.deepEqual(rows.map((row) => row.publishedAgo), ["2 hours ago", "x".repeat(40), null, null]);
});

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

test("Cboe：VIX 五欄與 SPX 兩欄都能解析，since 之前的列不讀", () => {
  const vix = parseCboeCsv("DATE,OPEN,HIGH,LOW,CLOSE\n10/22/2026,19,20,18,19.03\n10/23/2026,19.1,20,18.5,19.45\n", "2026-10-23");
  assert.deepEqual(vix, [{ date: "2026-10-23", open: 19.1, high: 20, low: 18.5, close: 19.45, volume: null }]);
  const spx = parseCboeCsv("DATE,SPX\n10/23/2026,7623.680000\n");
  assert.equal(spx[0].close, 7623.68);
  assert.throws(() => parseCboeCsv("<html>"), /表頭/);
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
