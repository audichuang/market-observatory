import assert from "node:assert/strict";
import { test } from "node:test";
import { DCA_BUY_RULE, DCA_FX_RULE, DCA_LUMP_PREMISE } from "../src/lib/etf-copy.ts";
import * as copy from "../src/lib/etf-copy.ts";
import { nodes, pageText, pageWithAction } from "./helpers/etf-page.ts";
import type { Props } from "../pages/etfs.server.ts";
import { costScenario, parseCostQuery } from "../src/lib/costs.ts";
import { ETFS } from "../src/lib/universe.ts";

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

test("證據邊界固定說明逐字符合雙端規格", () => {
  assert.equal(copy.EVIDENCE_1X, "一次投入與定期定額的歷史研究只涵蓋非槓桿、正向 1x 的股票產品；這裡的試算是過去一段期間的算術結果，不代表未來。");
  assert.equal(copy.EVIDENCE_LEVERAGED, "這是每日重設的槓桿或反向產品：持有超過一天，報酬會偏離「倍數 × 指數報酬」，盤整或大波動時偏離通常更大。一般定投與一次投入的研究結論不適用這類產品，這裡的試算只是這段歷史的算術結果。");
});

test("定投試算依所選標的顯示 1x 或槓桿證據邊界，資料卡含註冊地、ISIN 與每日重設", () => {
  const uproRow = {
    ticker: "UPRO", name: "ProShares UltraPro S&P500", issuer: "ProShares", multiple: 3,
    grossFeePct: 0.88, netFeePct: 0.88, aumUsd: 5300921683, aumAsOf: null,
    sourceUrl: "https://www.proshares.com/our-etfs/leveraged-and-inverse/upro", note: "",
    facts: {
      domicile: "美國", distribution: "配息（每季）", isin: null,
      sourceUrl: "https://www.proshares.com/our-etfs/leveraged-and-inverse/upro", checkedAt: "2026-10-28",
    },
    close: 100, lastDate: "2026-10-28", ytd: 0.2, returns: {}, drift1y: null,
  };
  const vooRow = {
    ticker: "VOO", name: "Vanguard S&P 500 ETF", issuer: "Vanguard", multiple: 1,
    grossFeePct: 0.03, netFeePct: 0.03, aumUsd: 1032260000000, aumAsOf: "2026-09-30",
    sourceUrl: "https://investor.vanguard.com/investment-products/etfs/profile/voo", note: "",
    facts: {
      domicile: "美國", distribution: "配息（每季）", isin: null,
      sourceUrl: "https://investor.vanguard.com/investment-products/etfs/profile/voo", checkedAt: "2026-10-28",
    },
    close: 500, lastDate: "2026-10-28", ytd: 0.15, returns: {}, drift1y: null,
  };

  const renderedUpro = pageWithAction(undefined, {
    ...simulation,
    sim: { ...simulation.sim!, etf: "UPRO" },
    rows: [uproRow, vooRow] as any,
  }).render();
  const uproNodes = nodes(renderedUpro);
  assert.deepEqual(uproNodes.filter((n) => n.props.className === "notice warn").map(pageText), [copy.EVIDENCE_LEVERAGED], "UPRO 試算須顯示槓桿證據警示");
  const factsText = pageText(uproNodes.filter((n) => n.type === "details" && n.props.className === "etf-facts"));
  assert.ok(factsText.includes("註冊地"), "資料卡須含「註冊地」");
  assert.ok(factsText.includes("ISIN"), "資料卡須含「ISIN」");
  assert.ok(factsText.includes("倍數：3x，每日重設"), "UPRO 資料卡須顯示實際倍數與每日重設身分");

  const renderedVoo = pageWithAction(undefined, {
    ...simulation,
    sim: { ...simulation.sim!, etf: "VOO" },
    rows: [uproRow, vooRow] as any,
  }).render();
  const vooNodes = nodes(renderedVoo);
  assert.equal(vooNodes.filter((n) => n.props.className === "notice warn").length, 0, "VOO 試算不得顯示槓桿證據警示");
  assert.equal(vooNodes.filter((n) => n.type === "p" && n.props.className === "meta" && pageText(n) === copy.EVIDENCE_1X).length, 1, "VOO 試算須以一般樣式顯示完整 1x 證據句");
});

const costs = () => {
  const values = { costFx: "0.5", costFee: "0.1", costMinUsd: "1", costYield: "1.2", costPromo: "2026-01-01" };
  const input = parseCostQuery((key) => values[key as keyof typeof values]);
  assert.ok(input && !("issue" in input));
  const result = costScenario(input, { monthlyTwd: 10000, fxRate: 32, fxDate: "2026-10-27", etf: ETFS[0], today: "2026-10-28" });
  assert.ok(!("issue" in result));
  return result;
};

test("成本面板列扣款拆解、三層各一列、免責句、過期優惠與來源日期", () => {
  const result = costs();
  const rendered = pageWithAction(undefined, { costScenario: result }).render();
  const panel = nodes(rendered).find((n) => n.props.id === "cost-scenario");
  assert.ok(panel);
  const text = pageText(panel);
  assert.ok(text.includes("成本情境（你的假設）"));
  assert.ok(text.includes(result.notes[0]));
  assert.ok(text.includes("已反映在基金淨值，不重扣"));
  assert.ok(text.includes("一年交易成本") && text.includes("984.00"));
  assert.ok(text.includes("82.00") && text.includes("0.8200%"));
  const layers = nodes(panel).filter((n) => n.type === "tr" && pageText(n).match(/^(基金費用|基金層預扣|投資人層預扣)/));
  assert.equal(layers.length, 3);
  assert.ok(pageText(layers[2]).includes("0.36%"));
  assert.ok(nodes(panel).some((n) => n.props.className === "notice warn" && pageText(n).includes("你填的優惠已過期")));
  for (const source of result.sources) {
    assert.ok(nodes(panel).some((n) => n.type === "a" && n.props.href === source.url));
    assert.ok(text.includes(source.checkedAt));
    if (source.sourceDate) assert.ok(text.includes(source.sourceDate));
  }
  assert.doesNotMatch(text, /排序|最省|建議/);
});

test("成本未試算時顯示表單；issue 時只列錯誤、不顯示計算結果", () => {
  for (const result of [null, { issue: "手續費比例要在 0–5% 之間" }]) {
    const panel = nodes(pageWithAction(undefined, { costScenario: result }).render()).find((n) => n.props.id === "cost-scenario");
    assert.ok(panel);
    assert.equal(nodes(panel).filter((n) => n.type === "table").length, 0);
    assert.ok(!pageText(panel).includes("一年交易成本"));
    assert.doesNotMatch(pageText(panel).replace(result?.issue ?? "", ""), /\d/, "未試算或錯誤時不顯示情境數字");
    if (result) assert.ok(nodes(panel).some((n) => n.props.role === "alert" && pageText(n) === result.issue));
    else assert.ok(pageText(panel).includes("尚未試算"));
  }
});

test("成本表單用查詢試算；切標的保留假設，清除後只移除 cost 參數", () => {
  const result = costs();
  const ui = pageWithAction(undefined, { costScenario: result, funding: "lump" });
  let rendered = ui.render();
  const target = nodes(rendered).filter((n) => n.type === "select")[0];
  (target.props.onChange as Function)({ target: { value: "UPRO" } });
  const retained = new URL(String(ui.visits[0]), "http://localhost");
  assert.equal(retained.searchParams.get("etf"), "UPRO");
  for (const [key, value] of Object.entries(result.inputs)) {
    if (value !== null) assert.equal(retained.searchParams.get(key), String(value));
  }
  const fee = nodes(rendered).find((n) => n.type === "input" && n.props.name === "costFee");
  assert.ok(fee);
  (fee.props.onChange as Function)({ target: { value: "9" } });
  rendered = ui.render();
  const panel = nodes(rendered).find((n) => n.props.id === "cost-scenario")!;
  const form = nodes(panel).find((n) => n.type === "form")!;
  assert.equal(form.props.noValidate, true, "不讓瀏覽器範圍檢查擋住伺服器中文錯誤");
  (form.props.onSubmit as Function)({ preventDefault() {} });
  assert.equal(new URL(String(ui.visits[1]), "http://localhost").searchParams.get("costFee"), "9");
  const clear = nodes(panel).find((n) => n.type === "button" && pageText(n) === "清除")!;
  (clear.props.onClick as Function)();
  const cleared = new URL(String(ui.visits[2]), "http://localhost");
  assert.ok([...cleared.searchParams.keys()].every((key) => !key.startsWith("cost")));
  assert.equal(cleared.searchParams.get("funding"), "lump");
  assert.equal(cleared.searchParams.get("monthly"), "1500");
});
