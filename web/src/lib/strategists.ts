// 投行策略師的 S&P 500 年底目標價。沒有穩定的公開結構化來源，只能人工維護：
// 每月對照 Reuters 民調／factbox 與各家公布更新一次，數字取自新聞轉述（未必對過券商原文）。
// 研究結論：策略師年底目標與實際報酬的相關約為 0，只當背景資訊，不放進方向預測模型。

export const STRATEGIST_TARGETS_CHECKED = "2026-10-25";

export interface StrategistTarget {
  firm: string;
  /** 目標指數點位 */
  target: number;
  /** 目標時點 */
  horizon: string;
  /** 這個數字公布或被報導的日期 */
  asOf: string;
  sourceUrl: string;
  note?: string;
}

export const STRATEGIST_TARGETS: StrategistTarget[] = [
  { firm: "Yardeni Research", target: 8400, horizon: "2026 年底", asOf: "2026-09", sourceUrl: "https://finance.yahoo.com/markets/stocks/articles/ed-yardeni-raises-p-500-125931405.html", note: "今年第三次上調" },
  { firm: "Citi", target: 8100, horizon: "2026 年底", asOf: "2026-09", sourceUrl: "https://finance.yahoo.com/markets/stocks/articles/where-p-500-end-2026-042351442.html" },
  { firm: "HSBC", target: 8100, horizon: "2026 年底", asOf: "2026-09", sourceUrl: "https://finance.yahoo.com/markets/stocks/articles/hsbc-raises-2026-p-500-154300501.html" },
  { firm: "Goldman Sachs", target: 8000, horizon: "2026 年底", asOf: "2026-08", sourceUrl: "https://www.galvnews.com/news_reuters/business/factbox-major-brokerages-forecasts-for-s-p-500-index-in-2026/article_7275084d-b0f7-55d9-b162-d22b116e17fd.html" },
  { firm: "Deutsche Bank", target: 8000, horizon: "2026 年底", asOf: "2026-08", sourceUrl: "https://www.galvnews.com/news_reuters/business/factbox-major-brokerages-forecasts-for-s-p-500-index-in-2026/article_7275084d-b0f7-55d9-b162-d22b116e17fd.html" },
  { firm: "JPMorgan", target: 8000, horizon: "2026 年底", asOf: "2026-09", sourceUrl: "https://www.cnbc.com/2026/06/24/jpmorgan-hikes-2026-sp-500-target-but-sees-hurdles-ahead-for-stocks.html", note: "6 月由 7,200 調到 7,800，之後再到 8,000" },
  { firm: "Barclays", target: 7950, horizon: "2026 年底", asOf: "2026-09-09", sourceUrl: "https://www.cnbc.com/2026/09/09/barclays-raises-sp-500-year-end-target-citing-standout-earnings-driven-by-ai.html", note: "由 7,800 上調" },
  { firm: "Wells Fargo", target: 7950, horizon: "2026 年底", asOf: "2026-08", sourceUrl: "https://www.galvnews.com/news_reuters/business/factbox-major-brokerages-forecasts-for-s-p-500-index-in-2026/article_7275084d-b0f7-55d9-b162-d22b116e17fd.html" },
  { firm: "UBS GWM", target: 7900, horizon: "2026 年底", asOf: "2026-08", sourceUrl: "https://www.ctvnews.ca/business/article/ubs-lifts-sp-500-annual-forecast-on-robust-consumer-spending-ai-demand/" },
  { firm: "Evercore ISI", target: 7750, horizon: "2026 年底", asOf: "2026-08", sourceUrl: "https://www.galvnews.com/news_reuters/business/factbox-major-brokerages-forecasts-for-s-p-500-index-in-2026/article_7275084d-b0f7-55d9-b162-d22b116e17fd.html" },
  { firm: "UBS Global Research", target: 7500, horizon: "2026 年底", asOf: "2026-08", sourceUrl: "https://www.galvnews.com/news_reuters/business/factbox-major-brokerages-forecasts-for-s-p-500-index-in-2026/article_7275084d-b0f7-55d9-b162-d22b116e17fd.html" },
  { firm: "BofA", target: 7100, horizon: "2026 年底", asOf: "2026-09", sourceUrl: "https://finance.yahoo.com/markets/stocks/articles/where-p-500-end-2026-042351442.html", note: "目前最保守" },
];

export const REUTERS_POLL = {
  median: 7900,
  respondents: 46,
  surveyed: "2026-08-12～08-25",
  sourceUrl: "https://www.roic.ai/news/wall-streets-2026-target-sp-500-seen-hitting-7900-08-26-2026",
};

/** 每週五更新的 FactSet Earnings Insight（由下而上目標價、預估本益比）；目前只連結，不自動解析 PDF。 */
export const FACTSET_EARNINGS_INSIGHT_URL = "https://www.factset.com/earningsinsight";

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
