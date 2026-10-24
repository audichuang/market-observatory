// 追蹤標的的唯一真源：抓價、歸因、圖表、ETF 頁都從這裡讀。

export const INDEX_SYMBOL = "SPX"; // 對應 Yahoo ^GSPC、Cboe SPX_History
export const VIX_SYMBOL = "VIX"; // Cboe 官方 VIX_History
export const EQUAL_WEIGHT_SYMBOL = "RSP";
export const FX_SYMBOL = "USDTWD"; // Yahoo TWD=X，定投試算換匯用

export interface Mag7Member {
  /** 顯示用的公司代號；Alphabet 合併 GOOGL＋GOOG 兩個股類 */
  key: string;
  company: string;
  tickers: string[];
}

export const MAG7: Mag7Member[] = [
  { key: "NVDA", company: "NVIDIA", tickers: ["NVDA"] },
  { key: "AAPL", company: "Apple", tickers: ["AAPL"] },
  { key: "MSFT", company: "Microsoft", tickers: ["MSFT"] },
  { key: "AMZN", company: "Amazon", tickers: ["AMZN"] },
  { key: "GOOGL", company: "Alphabet", tickers: ["GOOGL", "GOOG"] },
  { key: "META", company: "Meta", tickers: ["META"] },
  { key: "TSLA", company: "Tesla", tickers: ["TSLA"] },
];

export const MAG7_TICKERS = MAG7.flatMap((m) => m.tickers);

export interface EtfProduct {
  ticker: string;
  name: string;
  issuer: string;
  /** 每日目標倍數；負數為反向 */
  multiple: number;
  /** 費用率（%）；官方只列單一費率時 gross 與 net 相同 */
  grossFeePct: number | null;
  netFeePct: number | null;
  aumUsd: number | null;
  aumAsOf: string | null;
  sourceUrl: string;
  note: string;
}

// 產品資料由人工查核發行商頁面維護（費率很少變動）；價格與報酬由每日排程自動計算。
export const ETF_CATALOG_AS_OF = "2026-10-24";
export const ETFS: EtfProduct[] = [
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", issuer: "Vanguard", multiple: 1, grossFeePct: 0.03, netFeePct: 0.03, aumUsd: 1032260000000, aumAsOf: "2026-09-30", sourceUrl: "https://investor.vanguard.com/investment-products/etfs/profile/voo", note: "ETF 股類資產，非母基金全股類" },
  { ticker: "IVV", name: "iShares Core S&P 500 ETF", issuer: "iShares", multiple: 1, grossFeePct: 0.03, netFeePct: 0.03, aumUsd: 873554553278, aumAsOf: "2026-10-23", sourceUrl: "https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf", note: "" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", issuer: "State Street", multiple: 1, grossFeePct: 0.0945, netFeePct: 0.0945, aumUsd: 810519790000, aumAsOf: "2026-10-22", sourceUrl: "https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy", note: "UIT 結構，股息不能再投資" },
  { ticker: "SPYM", name: "SPDR Portfolio S&P 500 ETF", issuer: "State Street", multiple: 1, grossFeePct: 0.02, netFeePct: 0.02, aumUsd: 182490310000, aumAsOf: "2026-10-22", sourceUrl: "https://www.ssga.com/us/en/individual/etfs/state-street-spdr-portfolio-sp-500-etf-spym", note: "" },
  { ticker: "SSO", name: "ProShares Ultra S&P500", issuer: "ProShares", multiple: 2, grossFeePct: 0.88, netFeePct: 0.84, aumUsd: 8536082121, aumAsOf: null, sourceUrl: "https://www.proshares.com/our-etfs/leveraged-and-inverse/sso", note: "費用減免至 2027-09-30" },
  { ticker: "UPRO", name: "ProShares UltraPro S&P500", issuer: "ProShares", multiple: 3, grossFeePct: 0.88, netFeePct: 0.88, aumUsd: 5300921683, aumAsOf: null, sourceUrl: "https://www.proshares.com/our-etfs/leveraged-and-inverse/upro", note: "" },
  { ticker: "SPXL", name: "Direxion Daily S&P 500 Bull 3X", issuer: "Direxion", multiple: 3, grossFeePct: 0.95, netFeePct: 0.84, aumUsd: null, aumAsOf: null, sourceUrl: "https://www.direxion.com/product/daily-sp-500-bull-bear-3x-etfs", note: "費用減免至 2027-09-01" },
  { ticker: "SH", name: "ProShares Short S&P500", issuer: "ProShares", multiple: -1, grossFeePct: 0.88, netFeePct: 0.88, aumUsd: 932754206, aumAsOf: null, sourceUrl: "https://www.proshares.com/our-etfs/leveraged-and-inverse/sh", note: "" },
  { ticker: "SDS", name: "ProShares UltraShort S&P500", issuer: "ProShares", multiple: -2, grossFeePct: 0.91, netFeePct: 0.91, aumUsd: 378965465, aumAsOf: null, sourceUrl: "https://www.proshares.com/our-etfs/leveraged-and-inverse/sds", note: "" },
  { ticker: "SPXU", name: "ProShares UltraPro Short S&P500", issuer: "ProShares", multiple: -3, grossFeePct: 0.9, netFeePct: 0.9, aumUsd: 424445247, aumAsOf: null, sourceUrl: "https://www.proshares.com/our-etfs/leveraged-and-inverse/spxu", note: "費用減免至 2027-09-30" },
  { ticker: "SPXS", name: "Direxion Daily S&P 500 Bear 3X", issuer: "Direxion", multiple: -3, grossFeePct: 1.04, netFeePct: 1.04, aumUsd: null, aumAsOf: null, sourceUrl: "https://www.direxion.com/product/daily-sp-500-bull-bear-3x-etfs", note: "" },
];

/** 每日從 Yahoo chart 抓的標的（不含 VIX，VIX 走 Cboe）。 */
export const YAHOO_SYMBOLS: Record<string, string> = {
  [INDEX_SYMBOL]: "^GSPC",
  [EQUAL_WEIGHT_SYMBOL]: "RSP",
  [FX_SYMBOL]: "TWD=X",
  ...Object.fromEntries(MAG7_TICKERS.map((t) => [t, t])),
  ...Object.fromEntries(ETFS.map((e) => [e.ticker, e.ticker])),
};

/** Nasdaq 交叉核對：指數與匯率 Nasdaq 沒有，SPX 改由 Cboe 核對。 */
export const NASDAQ_CHECK_SYMBOLS: { symbol: string; assetClass: "stocks" | "etf" }[] = [
  ...MAG7_TICKERS.map((t) => ({ symbol: t, assetClass: "stocks" as const })),
  { symbol: EQUAL_WEIGHT_SYMBOL, assetClass: "etf" },
  ...ETFS.map((e) => ({ symbol: e.ticker, assetClass: "etf" as const })),
];

export const CHART_SYMBOLS = [INDEX_SYMBOL, ...MAG7.map((m) => m.key), EQUAL_WEIGHT_SYMBOL, VIX_SYMBOL];
