import assert from "node:assert/strict";
import { test } from "node:test";
import { costScenario, parseCostQuery } from "../src/lib/costs.ts";
import { ETFS, ETF_CATALOG_AS_OF } from "../src/lib/universe.ts";

const context = { monthlyTwd: 10000, fxRate: 32, fxDate: "2026-10-27", etf: ETFS.find((e) => e.ticker === "VOO")!, today: "2026-10-28" };
const parse = (values: Record<string, string | undefined>) => parseCostQuery((key) => values[key]);
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);

test("台幣月扣一萬元依序扣換匯價差與手續費，與手算 A 一致", () => {
  const input = parse({ costFx: "0.5", costFee: "0.1" });
  assert.ok(input && !("issue" in input));
  const result = costScenario(input, context);
  assert.ok(!("issue" in result));
  assert.equal(result.perBuy.amountTwd, 10000);
  assert.equal(result.perBuy.fixedTwd, 0);
  near(result.perBuy.fxSpreadTwd, 50);
  near(result.perBuy.commissionTwd, 9.95);
  near(result.perBuy.investedTwd, 9940.05);
  near(result.perBuy.costTwd, 59.95);
  near(result.perBuy.costPct, 0.5995);
  near(result.annualTxCostTwd, 719.4);
});

const scenario = (values: Record<string, string>, overrides: Partial<Parameters<typeof costScenario>[1]> = {}) => {
  const input = parse(values);
  assert.ok(input && !("issue" in input));
  const result = costScenario(input, { ...context, ...overrides });
  assert.ok(!("issue" in result));
  return result;
};

test("無成本查詢不啟用；省略欄位正規化為零、台幣、NAV 與台灣身分", () => {
  assert.equal(parse({}), null);
  assert.deepEqual(parse({ costFee: "0.1" }), {
    costCcy: "twd", costFx: 0, costFee: 0.1, costMinUsd: 0, costFixed: 0,
    costPromo: null, costYield: 0, costBasis: "nav", costTax: "tw",
  });
});

test("最低一美元手續費與美元扣款分別符合手算 B、C", () => {
  const b = scenario({ costFee: "0.1", costMinUsd: "1" }, { monthlyTwd: 3000 });
  assert.equal(b.perBuy.commissionTwd, 32);
  assert.equal(b.perBuy.investedTwd, 2968);
  near(b.perBuy.costPct, 1.0666666666666667);
  assert.ok(b.notes.includes("最低手續費以 2026-10-27 的 USD/TWD 32 換算。"));
  assert.equal(scenario({ costCcy: "usd", costFx: "1" }).perBuy.fxSpreadTwd, 0);
  assert.equal(scenario({ costFixed: "100", costFee: "1" }).perBuy.commissionTwd, 99);
  assert.equal(scenario({ costFee: "0.1" }, { fxRate: null, fxDate: null }).perBuy.commissionTwd, 10);
});

test("最低手續費註記的匯率最多三位小數，計算仍用原始精度", () => {
  const result = scenario({ costMinUsd: "1" }, { fxRate: 30.336366115787033 });
  assert.ok(result.notes.includes("最低手續費以 2026-10-27 的 USD/TWD 30.336 換算。"));
  assert.equal(result.perBuy.commissionTwd, 30.336366115787033);
});

test("NAV 不重扣基金費用；index 列淨費率，投資人一般股利預扣不隨口徑變動", () => {
  const nav = scenario({ costYield: "1.2" });
  const index = scenario({ costYield: "1.2", costBasis: "index" });
  assert.deepEqual(nav.layers.fundExpense, { pct: null, note: "已反映在基金淨值，不重扣" });
  assert.equal(index.layers.fundExpense.pct, 0.03);
  assert.deepEqual(index.layers.investorWithholding, nav.layers.investorWithholding);
  near(nav.layers.investorWithholding.pct!, 0.36);
  assert.equal(nav.layers.investorWithholding.note, "美國註冊 ETF 分配的一般股利通常預扣 30%（無適用協定）；資本利得分配、資本返還等其他分配性質不計");
  assert.deepEqual(nav.layers.fundWithholding, { pct: 0, note: "美國註冊基金持有美股，基金層不預扣美國股利稅" });
  assert.deepEqual(scenario({ costTax: "other", costYield: "1.2" }).layers.investorWithholding, { pct: null, note: "不套用：請依你的稅務身分確認" });
});

test("分層與交易成本沒有加總或稅後報酬欄位，來源各附版本與查閱日", () => {
  const result = scenario({ costYield: "1.2", costBasis: "index" });
  assert.deepEqual(Object.keys(result).sort(), ["annualTxCostTwd", "inputs", "layers", "notes", "perBuy", "promo", "sources"]);
  assert.deepEqual(Object.keys(result.perBuy).sort(), ["amountTwd", "commissionTwd", "costPct", "costTwd", "fixedTwd", "fxSpreadTwd", "investedTwd"]);
  assert.deepEqual(Object.keys(result.layers).sort(), ["fundExpense", "fundWithholding", "investorWithholding"]);
  assert.equal(result.notes[0], "這是你填的假設算出的情境，不是券商實際收費，也不是應納稅額；不比較券商，也不代表哪個產品比較好。");
  assert.ok(result.sources.some((s) => s.url === "https://www.irs.gov/publications/p515" && s.sourceDate === "2026"));
  assert.ok(result.sources.some((s) => s.name.includes("State Street") && s.sourceDate === "2026-06-02"));
  assert.ok(result.sources.some((s) => s.url === context.etf.sourceUrl));
  assert.ok(result.sources.every((s) => s.name && s.url && "sourceDate" in s && s.checkedAt));
});

test("所有 index 情境的費率來源不冒用資料卡查閱日或把費率查核日當文件日期", () => {
  for (const etf of ETFS) {
    const result = scenario({ costBasis: "index" }, { etf });
    assert.deepEqual(result.sources.find((s) => s.name === `${etf.ticker} 發行商費用率`), {
      name: `${etf.ticker} 發行商費用率`, url: etf.sourceUrl, sourceDate: null, checkedAt: ETF_CATALOG_AS_OF,
    });
  }
});

test("優惠只標記日期，過期與否不改費用；槓桿與反向另列分配性質說明", () => {
  const expired = scenario({ costPromo: "2026-01-01" });
  assert.deepEqual(expired.promo, { until: "2026-01-01", expired: true });
  assert.deepEqual(expired.perBuy, scenario({ costPromo: "2026-10-28" }).perBuy);
  assert.deepEqual(scenario({ costPromo: "2026-10-28" }).promo, { until: "2026-10-28", expired: false });
  assert.equal(scenario({ costFee: "0" }).promo, null);
  for (const ticker of ["UPRO", "SH"]) {
    assert.ok(scenario({ costYield: "1.2" }, { etf: ETFS.find((e) => e.ticker === ticker)! }).notes.includes("槓桿與反向產品的分配性質與頻率不同，本情境只按你填的配息率估算。"));
  }
});

test("查詢拒絕不合法的數值、選項與不存在的日期，回傳中文 issue", () => {
  for (const values of [
    { costFee: "9" }, { costFx: "-1" }, { costMinUsd: "101" }, { costFixed: "1.5" },
    { costFixed: "10001" }, { costYield: "11" }, { costYield: "NaN" }, { costFee: "Infinity" },
    { costFee: "oops" }, { costCcy: "eur" }, { costBasis: "price" }, { costTax: "us" },
    { costPromo: "2026-02-30" }, { costPromo: "2026-1-01" }, { costPromo: "invalid" },
  ]) {
    const result = parse(values);
    assert.ok(result && "issue" in result, JSON.stringify(values));
    assert.match(result.issue, /[\u4e00-\u9fff]/);
  }
  assert.ok(!("issue" in parse({ costFx: "5", costFee: "5", costMinUsd: "100", costFixed: "10000", costYield: "10", costPromo: "2028-02-29" })!));
});

test("扣完固定費、價差或最低費不夠買進，以及最低費缺匯率時回 issue", () => {
  for (const values of [{ costFixed: "3000" }, { costFixed: "3001" }, { costMinUsd: "100" }, { costFixed: "2900", costFx: "5" }]) {
    const input = parse(values);
    assert.ok(input && !("issue" in input));
    assert.deepEqual(costScenario(input, { ...context, monthlyTwd: 3000 }), { issue: "每月金額扣掉固定費用、換匯價差與手續費後已不夠買進" });
  }
  const input = parse({ costMinUsd: "1" });
  assert.ok(input && !("issue" in input));
  assert.deepEqual(costScenario(input, { ...context, fxRate: null, fxDate: null }), { issue: "沒有匯率資料，無法換算最低手續費" });
});
