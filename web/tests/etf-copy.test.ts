import assert from "node:assert/strict";
import { test } from "node:test";
import { DCA_BUY_RULE, DCA_FX_RULE, DCA_LUMP_PREMISE } from "../src/lib/etf-copy.ts";
import * as copy from "../src/lib/etf-copy.ts";
import { nodes, pageText, pageWithAction } from "./helpers/etf-page.ts";
import type { Props } from "../pages/etfs.server.ts";

const simulation: Partial<Props> = {
  sim: { etf: "IVV", years: 2, monthlyTwd: 1000, startDate: "2040-01-15" },
  dca: {
    firstBuyDate: "2040-01-16", months: 2, invested: 2000, units: 150, value: 3000,
    returnPct: 50, lumpSumValue: 4000, lumpSumReturnPct: 100, maxDrawdownPct: 0,
    path: [{ date: "2040-01-16", invested: 1000, value: 1000 }, { date: "2040-02-02", invested: 2000, value: 3000 }],
  },
  fxLast: { date: "2040-02-02", close: 31 },
};

test("定投固定說明與雙端規格逐字相同", () => {
  assert.equal(DCA_LUMP_PREMISE, "假設整筆資金在期初已備妥；逐月新收入無法照此提前投入。");
  assert.equal(DCA_BUY_RULE, "首筆在試算起點當天或之後的第一個交易日、之後每月第一個交易日，以收盤價買入；首月可能不是完整月份");
  assert.equal(DCA_FX_RULE, "換匯用買入日的 USD/TWD，當天沒有匯率時沿用之前最近一筆");
});

test("資金類型與對照說明逐字符合雙端規格", () => {
  assert.equal(copy.FUNDING_MONTHLY_LABEL, "每月新收入");
  assert.equal(copy.FUNDING_LUMP_LABEL, "期初已有整筆資金");
  assert.equal(copy.DCA_MONTHLY_NO_LUMP, "每月新收入無法在期初一次投入，所以這裡不列一次投入對照；期初已有整筆資金時，資金類型改選「期初已有整筆資金」。");
  assert.equal(copy.DCA_IDLE_CASH, "分批期間還沒投入的現金不計利息。");
});

test("每月新收入只列三項定投 KPI，保留日期與匯率說明", () => {
  const ui = pageWithAction(undefined, { ...simulation, funding: "monthly" });
  const rendered = ui.render();
  const text = pageText(rendered);
  assert.ok(text.includes(`試算起點 2040-01-15，首筆 2040-01-16。${DCA_BUY_RULE}；${DCA_FX_RULE}（最新 31.000，2040-02-02）。不含配息、手續費、換匯價差與稅。歷史試算不代表未來。`));
  const kpis = nodes(rendered).filter((n) => n.props.className === "kpi");
  assert.deepEqual(kpis.map((n) => pageText(nodes(n).find((c) => c.props.className === "label"))), ["投入 2 個月", "目前市值", "最大帳面虧損"]);
  // The required explanation itself mentions 一次投入; the comparison must be absent from the KPIs.
  assert.doesNotMatch(pageText(kpis), /一次投入|同金額期初單筆/);
  assert.ok(text.includes(copy.DCA_MONTHLY_NO_LUMP));
  assert.ok(!text.includes(DCA_LUMP_PREMISE) && !text.includes(copy.DCA_IDLE_CASH));
  assert.doesNotMatch(text, /用當[日天] USD\/TWD|錯失|少賺/);
});

test("期初整筆資金列一次投入與分批對照及其前提", () => {
  const rendered = pageWithAction(undefined, { ...simulation, funding: "lump" }).render();
  const text = pageText(rendered);
  const kpis = nodes(rendered).filter((n) => n.props.className === "kpi");
  assert.deepEqual(kpis.map((n) => pageText(nodes(n).find((c) => c.props.className === "label"))), ["期初資金", "一次投入（2040-01-16 全部買入）", "分 2 個月投入", "分批的最大帳面虧損"]);
  assert.deepEqual(kpis.slice(0, 3).map((n) => pageText(nodes(n).find((c) => c.props.className === "value"))), ["2,000", "4,000", "3,000"]);
  assert.equal(nodes(kpis[1]).find((n) => n.type === "delta")?.props.value, 100);
  assert.equal(nodes(kpis[2]).find((n) => n.type === "delta")?.props.value, 50);
  assert.ok(text.includes("每月分批金額（台幣）"));
  assert.ok(text.includes(DCA_LUMP_PREMISE) && text.includes(copy.DCA_IDLE_CASH));
  assert.ok(!text.includes(copy.DCA_MONTHLY_NO_LUMP));
});

test("改標的、期間、金額與儲存預設後網址保留資金類型", async () => {
  const ui = pageWithAction(undefined, { ...simulation, funding: "lump" });
  const rendered = ui.render();
  const selects = nodes(rendered).filter((n) => n.type === "select");
  (selects[0].props.onChange as Function)({ target: { value: "VOO" } });
  (selects[1].props.onChange as Function)({ target: { value: "5" } });
  const amount = nodes(rendered).find((n) => n.type === "input" && n.props.value === "1000");
  assert.ok(amount);
  (amount.props.onChange as Function)({ target: { value: "2000" } });
  const changed = ui.render();
  const form = nodes(changed).find((n) => n.type === "form" && n.props.onSubmit);
  assert.ok(form);
  (form.props.onSubmit as Function)({ preventDefault() {} });
  const save = nodes(changed).find((n) => n.type === "button" && pageText(n) === "設為我的預設");
  assert.ok(save);
  await (save.props.onClick as () => Promise<void>)();
  assert.equal(ui.visits.length, 4);
  const urls = ui.visits.map((url) => new URL(String(url), "http://localhost"));
  assert.ok(urls.every((url) => url.searchParams.get("funding") === "lump"));
  assert.equal(urls[0].searchParams.get("etf"), "VOO");
  assert.equal(urls[1].searchParams.get("years"), "5");
  assert.equal(urls[2].searchParams.get("monthly"), "2000");
});

test("資金類型選單在期間後，預設每月新收入，改選帶入網址", () => {
  const ui = pageWithAction();
  const rendered = ui.render();
  const funding = nodes(rendered).filter((n) => n.type === "select")[2];
  assert.ok(funding);
  assert.equal(funding.props.value, "monthly");
  assert.equal(pageText(funding), "每月新收入期初已有整筆資金");
  const label = nodes(rendered).find((n) => n.type === "label" && n.props.children.includes(funding));
  assert.ok(label && pageText(label).startsWith("資金類型"));
  (funding.props.onChange as Function)({ target: { value: "lump" } });
  assert.equal(new URL(String(ui.visits[0]), "http://localhost").searchParams.get("funding"), "lump");
});
