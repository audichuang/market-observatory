import { type Budget, type DailyBar, SourceError, fetchWithTimeout, mdyToIso, parseLooseNumber } from "./http.ts";

export const NASDAQ_SOURCE = "nasdaq";

/** Nasdaq 的代號用點（BRK.B），SSGA／Yahoo 與本站用連字號（BRK-B）；連字號版本 Nasdaq 回「Symbol not exists」。 */
export const nasdaqSymbol = (s: string) => s.replace("-", ".");
/** Nasdaq 回來的代號換回本站格式（財報日曆列的是 GEF.B 這種寫法）。 */
export const fromNasdaqSymbol = (s: string) => s.replace(".", "-");

const NASDAQ_HEADERS = {
  Accept: "application/json, text/plain, */*",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
};

interface NasdaqEnvelope<T> {
  data: T | null;
  status?: { rCode?: number; bCodeMessage?: { errorMessage?: string }[] | null };
}

async function getJson<T>(url: string, budget?: Budget): Promise<T> {
  const res = await fetchWithTimeout(NASDAQ_SOURCE, url, { headers: NASDAQ_HEADERS, timeoutMs: 15000, budget });
  const body = (await res.json()) as NasdaqEnvelope<T>;
  if (!body.data) {
    const msg = body.status?.bCodeMessage?.map((m) => m.errorMessage).join("; ") || `rCode ${body.status?.rCode}`;
    throw new SourceError(NASDAQ_SOURCE, msg);
  }
  return body.data;
}

interface HistoricalData {
  tradesTable?: { rows?: { date: string; close: string; open?: string; high?: string; low?: string; volume?: string }[] | null };
}

export function parseNasdaqHistorical(data: HistoricalData): DailyBar[] {
  const rows = data.tradesTable?.rows ?? [];
  const out: DailyBar[] = [];
  for (const r of rows) {
    const date = mdyToIso(r.date);
    const close = parseLooseNumber(r.close);
    if (!date || close === null) continue;
    out.push({ date, close, open: parseLooseNumber(r.open), high: parseLooseNumber(r.high), low: parseLooseNumber(r.low), volume: parseLooseNumber(r.volume) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchNasdaqHistorical(symbol: string, assetClass: "stocks" | "etf", fromDate: string, limit = 40, budget?: Budget): Promise<DailyBar[]> {
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(nasdaqSymbol(symbol))}/historical?assetclass=${assetClass}&fromdate=${fromDate}&limit=${limit}`;
  return parseNasdaqHistorical(await getJson<HistoricalData>(url, budget));
}

export interface EarningsDate {
  symbol: string;
  date: string;
  /** Zacks 演算法推估（estimated）或公司已公布（confirmed） */
  status: "estimated" | "confirmed";
  detail: string;
  sourceUrl: string;
}

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

export function parseEarningsDate(symbol: string, data: { announcement?: string; reportText?: string }): EarningsDate | null {
  const m = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/.exec(data.announcement ?? "");
  if (!m || !MONTHS[m[1]]) return null;
  const text = (data.reportText ?? "").replace(/\s+/g, " ").trim();
  const eps = /consensus EPS forecast for the quarter is \$?(-?\d+(?:\.\d+)?)/i.exec(text)?.[1];
  const lastYear = /reported EPS for the same quarter last year was \$?(-?\d+(?:\.\d+)?)/i.exec(text)?.[1];
  const parts = [eps ? `市場預估 EPS $${eps}` : null, lastYear ? `去年同季 $${lastYear}` : null].filter(Boolean);
  return {
    symbol,
    date: `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, "0")}`,
    status: /estimated|derived from an algorithm/i.test(text) ? "estimated" : "confirmed",
    detail: parts.join("，"),
    sourceUrl: `https://www.nasdaq.com/market-activity/stocks/${symbol.toLowerCase()}/earnings`,
  };
}

export async function fetchEarningsDate(symbol: string, budget?: Budget): Promise<EarningsDate | null> {
  const data = await getJson<{ announcement?: string; reportText?: string }>(`https://api.nasdaq.com/api/analyst/${encodeURIComponent(nasdaqSymbol(symbol))}/earnings-date`, budget);
  return parseEarningsDate(symbol, data);
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: string | null;
  /** 英文摘要（description），可能是空的 */
  summary: string | null;
  /** 文章主角（primarysymbol），Yahoo 格式（BRK-B） */
  primarySymbol: string | null;
}

interface NewsRow {
  title?: string;
  url?: string;
  publisher?: string;
  created?: string;
  id?: number | string;
  description?: string;
  primarysymbol?: string;
}

function parseNasdaqCreated(created: string | undefined): string | null {
  if (!created) return null;
  const m = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/.exec(created);
  if (!m || !MONTHS[m[1]]) return null;
  return `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, "0")}`;
}

export function parseNasdaqNews(rows: NewsRow[]): NewsItem[] {
  const out: NewsItem[] = [];
  for (const r of rows) {
    if (!r.title || !r.url) continue;
    const url = r.url.startsWith("http") ? r.url : `https://www.nasdaq.com${r.url.startsWith("/") ? "" : "/"}${r.url}`;
    out.push({
      id: `nasdaq:${r.id ?? url}`,
      title: r.title.trim(),
      url,
      publisher: r.publisher?.trim() || null,
      publishedAt: parseNasdaqCreated(r.created),
      // description 常以「Key Points」開頭、句子黏在一起：去掉開頭字樣、限制長度
      summary: r.description?.replace(/^\s*Key Points\s*/i, "").trim().slice(0, 600) || null,
      primarySymbol: r.primarysymbol ? fromNasdaqSymbol(r.primarysymbol.toUpperCase()) : null,
    });
  }
  return out;
}

export async function fetchNasdaqNews(symbol: string, limit = 8, budget?: Budget): Promise<NewsItem[]> {
  const data = await getJson<{ rows?: NewsRow[] }>(
    // 新聞在 api.nasdaq.com 會 301 轉到 www.nasdaq.com：直接打最終網址，每家省一個請求額度（名單滿時一次省 13 個）。
    `https://www.nasdaq.com/api/news/topic/articlebysymbol?q=${encodeURIComponent(nasdaqSymbol(symbol))}|stocks&offset=0&limit=${limit}`,
    budget,
  );
  return parseNasdaqNews(data.rows ?? []);
}

interface CalendarRow {
  symbol?: string;
  time?: string;
  epsForecast?: string;
  fiscalQuarterEnding?: string;
}

const TIME_LABEL: Record<string, string> = {
  "time-pre-market": "盤前",
  "time-after-hours": "盤後",
  "time-not-supplied": "時段未定",
};

/** 某一天的 Nasdaq 財報日曆，只回傳 symbols 裡的公司。 */
export function parseEarningsCalendar(date: string, rows: CalendarRow[], symbols: string[]): EarningsDate[] {
  const wanted = new Set(symbols);
  return rows
    .filter((r) => r.symbol && wanted.has(fromNasdaqSymbol(r.symbol)))
    .map((r) => ({
      symbol: fromNasdaqSymbol(r.symbol as string),
      date,
      status: "confirmed" as const,
      detail: [TIME_LABEL[r.time ?? ""] ?? null, r.fiscalQuarterEnding ? `財季 ${r.fiscalQuarterEnding}` : null, r.epsForecast ? `市場預估 EPS ${r.epsForecast}` : null].filter(Boolean).join("，"),
      sourceUrl: `https://www.nasdaq.com/market-activity/earnings?date=${date}`,
    }));
}

export async function fetchEarningsCalendar(date: string, symbols: string[], budget?: Budget): Promise<EarningsDate[]> {
  const data = await getJson<{ rows?: CalendarRow[] | null }>(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, budget);
  return parseEarningsCalendar(date, data.rows ?? [], symbols);
}

export interface AnalystView {
  symbol: string;
  targetMean: number | null;
  targetLow: number | null;
  targetHigh: number | null;
  buy: number;
  hold: number;
  sell: number;
  /** 最近一個會計年度的共識 EPS 與近 4 週上修／下修次數 */
  fiscalEnd: string | null;
  epsForecast: number | null;
  epsUp: number | null;
  epsDown: number | null;
  estimates: number | null;
  epsError: string | null;
}

interface TargetPriceData {
  consensusOverview?: { lowPriceTarget?: unknown; highPriceTarget?: unknown; priceTarget?: unknown; buy?: unknown; hold?: unknown; sell?: unknown } | null;
}
interface ForecastRow {
  fiscalEnd?: string;
  consensusEPSForecast?: unknown;
  noOfEstimates?: unknown;
  up?: unknown;
  down?: unknown;
}
interface EarningsForecastData {
  yearlyForecast?: { rows?: ForecastRow[] | null } | null;
}

export function parseAnalystView(symbol: string, target: TargetPriceData, forecast: EarningsForecastData | null): AnalystView {
  const c = target.consensusOverview ?? {};
  const row = forecast?.yearlyForecast?.rows?.[0] ?? null;
  return {
    symbol,
    targetMean: parseLooseNumber(c.priceTarget),
    targetLow: parseLooseNumber(c.lowPriceTarget),
    targetHigh: parseLooseNumber(c.highPriceTarget),
    buy: parseLooseNumber(c.buy) ?? 0,
    hold: parseLooseNumber(c.hold) ?? 0,
    sell: parseLooseNumber(c.sell) ?? 0,
    fiscalEnd: row?.fiscalEnd ?? null,
    epsForecast: parseLooseNumber(row?.consensusEPSForecast),
    epsUp: parseLooseNumber(row?.up),
    epsDown: parseLooseNumber(row?.down),
    estimates: parseLooseNumber(row?.noOfEstimates),
    epsError: null,
  };
}


/** withEpsRevisions=false 時只抓目標價（1 個請求），用來擴大涵蓋範圍又不超過子請求上限。 */
export async function fetchAnalystView(symbol: string, withEpsRevisions = true, budget?: Budget): Promise<AnalystView> {
  const base = `https://api.nasdaq.com/api/analyst/${encodeURIComponent(nasdaqSymbol(symbol))}`;
  let epsError: string | null = null;
  const [target, forecast] = await Promise.all([
    getJson<TargetPriceData>(`${base}/targetprice`, budget),
    withEpsRevisions ? getJson<EarningsForecastData>(`${base}/earnings-forecast`, budget).catch((e) => {
      epsError = e instanceof Error ? e.message : String(e);
      return null;
    }) : Promise.resolve(null),
  ]);
  return { ...parseAnalystView(symbol, target, forecast), epsError };
}
