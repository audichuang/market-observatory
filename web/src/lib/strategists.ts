// 投行策略師的 S&P 500 年底目標價。沒有穩定的公開結構化來源，只能人工維護：
// 每月對照 Reuters 民調／factbox 與各家公布更新一次。`verified: true` 的列對過機構官方原文，
// 其餘取自新聞轉述，待原文核對。只當背景資訊，不放進方向預測模型。

/**
 * Whole-table checked-on date: the last pass that looked at every row against Reuters factboxes / news.
 * Rows re-checked against a primary source after that carry their own `verifiedOn`.
 */
export const STRATEGIST_TARGETS_CHECKED = "2026-10-25";

/** Maintenance policy: a row whose data date is more than this many days old is flagged 待重新核對. */
export const STRATEGIST_STALE_DAYS = 45;

/** research = sell-side or independent research arm; wealth_management = private bank / CIO office of the same firm. */
export type StrategistDepartment = "research" | "wealth_management";
export type StrategistHorizonType = "year_end" | "rolling_12m";

export interface StrategistTarget {
  /** 顯示名稱（機構＋部門） */
  firm: string;
  /** 同一家公司的不同部門共用同一個 institution；中位數一家一票 */
  institution: string;
  department: StrategistDepartment;
  /** 目標指數點位；公布的是區間時放區間中點（targetIsMidpoint） */
  target: number;
  targetLow?: number;
  targetHigh?: number;
  /** true：target 是 targetLow～targetHigh 的中點，不是機構公布的點估計 */
  targetIsMidpoint?: boolean;
  /** 目標時點（顯示用） */
  horizon: string;
  /** 缺省視為 year_end；只有 year_end 進中位數 */
  horizonType?: StrategistHorizonType;
  /** 這個數字公布或被報導的日期（YYYY-MM 或 YYYY-MM-DD） */
  asOf: string;
  sourceUrl: string;
  /** true：數字對過機構官方原文；false：取自新聞轉述，待原文核對 */
  verified: boolean;
  /** 對過原文的日期 */
  verifiedOn?: string;
  note?: string;
}

const REUTERS_FACTBOX_2026_08 = "https://www.galvnews.com/news_reuters/business/factbox-major-brokerages-forecasts-for-s-p-500-index-in-2026/article_7275084d-b0f7-55d9-b162-d22b116e17fd.html";

export const STRATEGIST_TARGETS: StrategistTarget[] = [
  { firm: "Yardeni Research", institution: "Yardeni Research", department: "research", target: 7900, horizon: "2026 年底", asOf: "2026-09-15", sourceUrl: "https://www.yardeniquicktakes.com/proceed-with-caution/", verified: true, verifiedOn: "2026-10-27", note: "由 8,400 下調；8,400 移到 2027 年中" },
  { firm: "Citi", institution: "Citi", department: "research", target: 8100, horizon: "2026 年底", asOf: "2026-09", sourceUrl: "https://finance.yahoo.com/markets/stocks/articles/where-p-500-end-2026-042351442.html", verified: false },
  { firm: "HSBC", institution: "HSBC", department: "research", target: 8100, horizon: "2026 年底", asOf: "2026-09", sourceUrl: "https://finance.yahoo.com/markets/stocks/articles/hsbc-raises-2026-p-500-154300501.html", verified: false },
  { firm: "Goldman Sachs", institution: "Goldman Sachs", department: "research", target: 8000, horizon: "2026 年底", asOf: "2026-08", sourceUrl: REUTERS_FACTBOX_2026_08, verified: false },
  { firm: "Deutsche Bank", institution: "Deutsche Bank", department: "research", target: 8000, horizon: "2026 年底", asOf: "2026-08", sourceUrl: REUTERS_FACTBOX_2026_08, verified: false },
  { firm: "JPMorgan", institution: "JPMorgan", department: "research", target: 8000, horizon: "2026 年底", asOf: "2026-09", sourceUrl: "https://www.cnbc.com/2026/06/24/jpmorgan-hikes-2026-sp-500-target-but-sees-hurdles-ahead-for-stocks.html", verified: false, note: "6 月由 7,200 調到 7,800，之後再到 8,000" },
  { firm: "Barclays", institution: "Barclays", department: "research", target: 7950, horizon: "2026 年底", asOf: "2026-09-09", sourceUrl: "https://www.cnbc.com/2026/09/09/barclays-raises-sp-500-year-end-target-citing-standout-earnings-driven-by-ai.html", verified: false, note: "由 7,800 上調" },
  { firm: "Wells Fargo Securities", institution: "Wells Fargo", department: "research", target: 7950, horizon: "2026 年底", asOf: "2026-08", sourceUrl: REUTERS_FACTBOX_2026_08, verified: false },
  { firm: "Wells Fargo Investment Institute", institution: "Wells Fargo", department: "wealth_management", target: 7900, targetLow: 7800, targetHigh: 8000, targetIsMidpoint: true, horizon: "2026 年底", asOf: "2026-06-15", sourceUrl: "https://fa.wellsfargoadvisors.com/michele-kief/mediahandler/media/813828/institute_alert_061526.pdf", verified: true, verifiedOn: "2026-10-27", note: "公布區間 7,800–8,000；7,900 為區間中點，不是點估計" },
  { firm: "UBS GWM", institution: "UBS", department: "wealth_management", target: 8100, horizon: "2026 年底", asOf: "2026-09-16", sourceUrl: "https://www.ubs.com/global/en/wealthmanagement/insights/chief-investment-office/house-view/daily/2026/latest-16092026.html", verified: true, verifiedOn: "2026-10-27", note: "9/16 為發布／重申日，不一定是首次調整日" },
  { firm: "Evercore ISI", institution: "Evercore ISI", department: "research", target: 7750, horizon: "2026 年底", asOf: "2026-08", sourceUrl: REUTERS_FACTBOX_2026_08, verified: false },
  { firm: "UBS Global Research", institution: "UBS", department: "research", target: 7500, horizon: "2026 年底", asOf: "2026-08", sourceUrl: REUTERS_FACTBOX_2026_08, verified: false },
  { firm: "BofA", institution: "BofA", department: "research", target: 7100, horizon: "2026 年底", asOf: "2026-09", sourceUrl: "https://finance.yahoo.com/markets/stocks/articles/where-p-500-end-2026-042351442.html", verified: false, note: "目前最保守" },
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

/** UI footnote for the median; keep in sync with `medianEligible`. */
export const STRATEGIST_MEDIAN_RULE =
  "中位數只算年底目標，一家一票：同一家同時有研究部門與財富管理部門時以研究部門為準，財富管理的數字照列但不計入；沒有研究部門才用財富管理的數字。";

const isYearEnd = (t: StrategistTarget) => (t.horizonType ?? "year_end") === "year_end";

/**
 * Rows that vote in the median.
 * Policy (decided by department type, never by which number is higher or lower):
 *  1. Year-end targets only: horizonType strictly "year_end"; a missing horizonType counts as year_end.
 *  2. One vote per institution. If the institution has a year-end `research` row, that row votes and its
 *     `wealth_management` rows are shown but excluded. Without a research row, the wealth-management row votes.
 *  3. Several rows of the same institution and department (not expected in the data): the latest asOf wins,
 *     ties broken by firm name, so the choice still never depends on the target value.
 */
export function medianEligible(rows: StrategistTarget[]): StrategistTarget[] {
  const byInstitution = new Map<string, StrategistTarget[]>();
  for (const t of rows.filter(isYearEnd)) {
    const list = byInstitution.get(t.institution) ?? [];
    list.push(t);
    byInstitution.set(t.institution, list);
  }
  const rank = (d: StrategistDepartment) => (d === "research" ? 0 : 1);
  const picked = new Set<StrategistTarget>();
  for (const list of byInstitution.values()) {
    picked.add([...list].sort((a, b) => rank(a.department) - rank(b.department) || b.asOf.localeCompare(a.asOf) || a.firm.localeCompare(b.firm))[0]);
  }
  return rows.filter((t) => picked.has(t));
}

/**
 * Calendar date an asOf refers to: YYYY-MM-DD as is; month-only YYYY-MM is read as the month's last day,
 * so a month-only row is never flagged earlier than any precise date in that month would be.
 */
export function asOfDate(asOf: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return asOf;
  const m = /^(\d{4})-(\d{2})$/.exec(asOf);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).toISOString().slice(0, 10);
}

/** True when the row's data date is more than `days` days before today; an unparseable asOf counts as stale. */
export function isStrategistStale(asOf: string, today: string, days = STRATEGIST_STALE_DAYS): boolean {
  const d = asOfDate(asOf);
  if (!d) return true;
  return (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000 > days;
}

/** Strategist rows plus the computed median metadata (shared by the web loader and /api/v1/outlook). */
export function strategistTable(rows: StrategistTarget[], today: string) {
  const eligible = new Set(medianEligible(rows));
  const list = rows.map((t) => ({
    ...t,
    horizonType: t.horizonType ?? ("year_end" as const),
    inMedian: eligible.has(t),
    stale: isStrategistStale(t.asOf, today),
  }));
  return {
    list,
    median: median(list.filter((t) => t.inMedian).map((t) => t.target)),
    medianCount: eligible.size,
    medianRule: STRATEGIST_MEDIAN_RULE,
    staleAfterDays: STRATEGIST_STALE_DAYS,
  };
}
