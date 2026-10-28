export interface TaxSource {
  name: string;
  url: string;
  sourceDate: string | null;
  checkedAt: string;
}

export const US_DIVIDEND_WITHHOLDING = {
  pct: 30,
  appliesTo: "台灣稅務居民、非美國公民且非美國稅務居民、無適用協定的一般股利",
  sources: [
    { name: "IRS Publication 515 (2026)", url: "https://www.irs.gov/publications/p515", sourceDate: "2026", checkedAt: "2026-10-28" },
    { name: "IRS 所得稅協定 A–Z（未列台灣）", url: "https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z", sourceDate: null, checkedAt: "2026-10-28" },
  ] satisfies TaxSource[],
};

export const US_FUND_LEVEL_WITHHOLDING = {
  pct: 0,
  appliesTo: "美國註冊基金持有美股的基金層美國股利預扣",
  sources: [
    { name: "State Street：美國註冊 ETF 的基金層預扣", url: "https://www.ssga.com/hk/en/institutional/insights/considerations-for-non-us-investors-us-etfs-vs-irish-ucits", sourceDate: "2026-06-02", checkedAt: "2026-10-28" },
  ] satisfies TaxSource[],
};
