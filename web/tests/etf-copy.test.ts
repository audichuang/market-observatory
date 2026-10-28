import assert from "node:assert/strict";
import { test } from "node:test";
import { DCA_BUY_RULE, DCA_FX_RULE, DCA_LUMP_PREMISE } from "../src/lib/etf-copy.ts";
import { nodes, pageText, pageWithAction } from "./helpers/etf-page.ts";

test("定投固定說明與雙端規格逐字相同", () => {
  assert.equal(DCA_LUMP_PREMISE, "假設整筆資金在期初已備妥；逐月新收入無法照此提前投入。");
  assert.equal(DCA_BUY_RULE, "首筆在試算起點當天或之後的第一個交易日、之後每月第一個交易日，以收盤價買入；首月可能不是完整月份");
  assert.equal(DCA_FX_RULE, "換匯用買入日的 USD/TWD，當天沒有匯率時沿用之前最近一筆");
});

test("定投頁面顯示試算起點、首筆日期、匯率取值與單筆資金前提", () => {
  const ui = pageWithAction(undefined, {
    sim: { etf: "IVV", years: 2, monthlyTwd: 1000, startDate: "2040-01-15" },
    dca: {
      firstBuyDate: "2040-01-16", months: 2, invested: 2000, units: 150, value: 3000,
      returnPct: 50, lumpSumValue: 4000, lumpSumReturnPct: 100, maxDrawdownPct: 0,
      path: [{ date: "2040-01-16", invested: 1000, value: 1000 }, { date: "2040-02-02", invested: 2000, value: 3000 }],
    },
    fxLast: { date: "2040-02-02", close: 31 },
  });
  const rendered = ui.render();
  const text = pageText(rendered);
  assert.ok(text.includes(`試算起點 2040-01-15，首筆 2040-01-16。${DCA_BUY_RULE}；${DCA_FX_RULE}（最新 31.000，2040-02-02）。不含配息、手續費、換匯價差與稅。歷史試算不代表未來。`));
  const lumpKpi = nodes(rendered).find((n) => n.props.className === "kpi" && pageText(n).includes("同金額期初單筆"));
  assert.ok(lumpKpi && pageText(lumpKpi).includes(DCA_LUMP_PREMISE));
  assert.doesNotMatch(text, /用當[日天] USD\/TWD|錯失|少賺/);
});
