import { ETF_CATALOG_AS_OF, type EtfProduct } from "./universe.ts";
import { US_DIVIDEND_WITHHOLDING, US_FUND_LEVEL_WITHHOLDING, type TaxSource } from "./tax-facts.ts";

export interface CostInputs {
  costCcy: "twd" | "usd";
  costFx: number;
  costFee: number;
  costMinUsd: number;
  costFixed: number;
  costPromo: string | null;
  costYield: number;
  costBasis: "nav" | "index";
  costTax: "tw" | "other";
}

export interface CostIssue { issue: string }

export function parseCostQuery(get: (key: string) => string | undefined): CostInputs | CostIssue | null {
  const keys = ["costCcy", "costFx", "costFee", "costMinUsd", "costFixed", "costPromo", "costYield", "costBasis", "costTax"];
  if (keys.every((key) => get(key) === undefined)) return null;
  const costCcy = get("costCcy") ?? "twd";
  const costBasis = get("costBasis") ?? "nav";
  const costTax = get("costTax") ?? "tw";
  if (costCcy !== "twd" && costCcy !== "usd") return { issue: "扣款幣別要選台幣或美元" };
  if (costBasis !== "nav" && costBasis !== "index") return { issue: "報酬口徑要選基金淨值／總報酬或稅前指數" };
  if (costTax !== "tw" && costTax !== "other") return { issue: "稅務身分要選台灣稅務居民或其他" };
  const input: CostInputs = {
    costCcy,
    costFx: Number(get("costFx") ?? 0), costFee: Number(get("costFee") ?? 0),
    costMinUsd: Number(get("costMinUsd") ?? 0), costFixed: Number(get("costFixed") ?? 0),
    costPromo: get("costPromo") || null, costYield: Number(get("costYield") ?? 0),
    costBasis, costTax,
  };
  const ranges = [
    ["costFx", 5, "換匯價差要在 0–5% 之間"],
    ["costFee", 5, "手續費比例要在 0–5% 之間"],
    ["costMinUsd", 100, "最低手續費要在 0–100 美元之間"],
    ["costFixed", 10000, "每次固定費用要是 0–10000 台幣的整數"],
    ["costYield", 10, "假設年配息率要在 0–10% 之間"],
  ] as const;
  for (const [key, max, issue] of ranges) {
    const value = input[key];
    if (!Number.isFinite(value) || value < 0 || value > max || (key === "costFixed" && !Number.isInteger(value))) return { issue };
  }
  if (input.costPromo) {
    const date = new Date(`${input.costPromo}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.costPromo) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.costPromo) {
      return { issue: "優惠到期日要是有效的 YYYY-MM-DD 日期" };
    }
  }
  return input;
}

interface CostContext {
  monthlyTwd: number;
  fxRate: number | null;
  fxDate: string | null;
  etf: EtfProduct;
  today: string;
}

interface CostLayer { pct: number | null; note: string }

export interface CostResult {
  perBuy: { amountTwd: number; fxSpreadTwd: number; fixedTwd: number; commissionTwd: number; investedTwd: number; costTwd: number; costPct: number };
  annualTxCostTwd: number;
  layers: { fundExpense: CostLayer; fundWithholding: CostLayer; investorWithholding: CostLayer };
  promo: { until: string; expired: boolean } | null;
  notes: string[];
  sources: TaxSource[];
  inputs: CostInputs;
}

export function costScenario(input: CostInputs, { monthlyTwd, fxRate, fxDate, etf, today }: CostContext): CostResult | CostIssue {
  const amountTwd = monthlyTwd;
  const fxSpreadTwd = input.costCcy === "twd" ? amountTwd * input.costFx / 100 : 0;
  const fixedTwd = input.costFixed;
  const tradeTwd = amountTwd - fxSpreadTwd - fixedTwd;
  const insufficient = { issue: "每月金額扣掉固定費用、換匯價差與手續費後已不夠買進" };
  if (tradeTwd <= 0) return insufficient;
  let minimumTwd = 0;
  if (input.costMinUsd > 0) {
    if (fxRate === null) return { issue: "沒有匯率資料，無法換算最低手續費" };
    minimumTwd = input.costMinUsd * fxRate;
  }
  const commissionTwd = Math.max(tradeTwd * input.costFee / 100, minimumTwd);
  const investedTwd = tradeTwd - commissionTwd;
  if (investedTwd <= 0) return insufficient;
  const costTwd = amountTwd - investedTwd;
  const usFund = etf.facts.domicile === "美國";
  const sources: TaxSource[] = [];
  if (input.costBasis === "index") sources.push({ name: `${etf.ticker} 發行商費用率`, url: etf.sourceUrl, sourceDate: null, checkedAt: ETF_CATALOG_AS_OF });
  if (usFund) sources.push(...US_FUND_LEVEL_WITHHOLDING.sources);
  if (usFund && input.costTax === "tw") sources.push(...US_DIVIDEND_WITHHOLDING.sources);
  const notes = ["這是你填的假設算出的情境，不是券商實際收費，也不是應納稅額；不比較券商，也不代表哪個產品比較好。"];
  if (etf.multiple !== 1) notes.push("槓桿與反向產品的分配性質與頻率不同，本情境只按你填的配息率估算。");
  if (input.costMinUsd > 0) notes.push(`最低手續費以 ${fxDate} 的 USD/TWD ${Number(fxRate!.toFixed(3))} 換算。`);
  return {
    perBuy: { amountTwd, fxSpreadTwd, fixedTwd, commissionTwd, investedTwd, costTwd, costPct: costTwd / amountTwd * 100 },
    annualTxCostTwd: costTwd * 12,
    layers: {
      fundExpense: { pct: input.costBasis === "index" ? etf.netFeePct : null, note: input.costBasis === "nav" ? "已反映在基金淨值，不重扣" : "基金淨費用率（占持有市值的年化 %）" },
      fundWithholding: { pct: usFund ? US_FUND_LEVEL_WITHHOLDING.pct : null, note: usFund ? "美國註冊基金持有美股，基金層不預扣美國股利稅" : "本情境未涵蓋此基金註冊地" },
      investorWithholding: {
        pct: input.costTax === "tw" && usFund ? input.costYield * US_DIVIDEND_WITHHOLDING.pct / 100 : null,
        note: input.costTax === "other" ? "不套用：請依你的稅務身分確認" : usFund ? "美國註冊 ETF 分配的一般股利通常預扣 30%（無適用協定）；資本利得分配、資本返還等其他分配性質不計" : "本情境未涵蓋此基金註冊地",
      },
    },
    promo: input.costPromo ? { until: input.costPromo, expired: input.costPromo < today } : null,
    notes, sources, inputs: input,
  };
}
