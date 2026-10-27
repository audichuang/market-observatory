// NYSE 休市日與總經事件（FOMC、CPI、非農）日程。都是官方公布的靜態資料，超出覆蓋範圍就不判斷「應該開市」。

export const NYSE_CALENDAR = {
  sourceUrl: "https://www.nyse.com/markets/hours-calendars",
  verifiedOn: "2026-10-25",
  coverageStart: "2025-01-01",
  coverageEnd: "2027-12-31",
};

const NYSE_CLOSED = new Set([
  // 2025（含 1/9 卡特總統國喪日休市）
  "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26",
  "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
  "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

export const NYSE_EARLY_CLOSE = new Set(["2025-07-03", "2025-11-28", "2025-12-24", "2026-11-27", "2026-12-24", "2027-11-26"]);

export function inCalendarCoverage(date: string): boolean {
  return date >= NYSE_CALENDAR.coverageStart && date <= NYSE_CALENDAR.coverageEnd;
}

/** 覆蓋範圍內回 true/false；範圍外回 null（不知道）。 */
export function isNyseSession(date: string): boolean | null {
  if (!inCalendarCoverage(date)) return null;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6 && !NYSE_CLOSED.has(date);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** date 之前最近的一個應開市交易日；date 或結果超出日曆覆蓋時回 null（不知道）。 */
export function previousExpectedSession(date: string): string | null {
  if (!inCalendarCoverage(date)) return null;
  for (let d = addDays(date, -1); inCalendarCoverage(d); d = addDays(d, -1)) if (isNyseSession(d)) return d;
  return null;
}

/** from、to 皆含；任一端超出覆蓋範圍就丟錯，呼叫端要自己處理。 */
export function expectedSessions(from: string, to: string): string[] {
  if (!inCalendarCoverage(from) || !inCalendarCoverage(to)) {
    throw new Error(`NYSE 日曆只覆蓋 ${NYSE_CALENDAR.coverageStart}～${NYSE_CALENDAR.coverageEnd}`);
  }
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isNyseSession(d)) out.push(d);
  return out;
}

/** 美東當地日期（處理夏令時間）。 */
export function easternDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** 美東時間從午夜起算的分鐘數（處理夏令時間）。 */
export function easternMinutes(at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** 收盤 16:00 之後半小時，Yahoo 與 Nasdaq 的日線通常已是正式收盤。 */
export const CLOSE_READY_MINUTES = 16 * 60 + 30;

/**
 * 「現在應該已經有收盤價」的最近交易日：美東 16:30 以後算當天，否則往前找。
 * 超出日曆覆蓋時退回週一到週五的判斷。
 */
export function latestExpectedClose(at: Date = new Date()): string {
  let d = easternDate(at);
  if (easternMinutes(at) < CLOSE_READY_MINUTES) d = addDays(d, -1);
  return sessionOnOrBefore(d);
}

/** 抓價排程（crons/prices.ts，週一到週五 UTC 21:40）的 UTC 分鐘數；改排程要一起改，tests/scheduled-close.test.ts 會比對。 */
export const PRICES_CRON_UTC_MINUTES = 21 * 60 + 40;
/** 排程開始後留給抓價跑完的時間。 */
export const PRICES_RUN_GRACE_MINUTES = 30;

/**
 * 「抓價排程應該已經抓進來」的最近交易日，給過期警告用：UTC 21:40 的排程加緩衝跑完之後才算當天。
 * 只看 latestExpectedClose 的話，收盤後到排程之間（每天約一小時）會誤報過期。
 */
export function latestScheduledClose(at: Date = new Date()): string {
  const due = new Date(at.getTime() - (PRICES_CRON_UTC_MINUTES + PRICES_RUN_GRACE_MINUTES) * 60000);
  return sessionOnOrBefore(due.toISOString().slice(0, 10));
}

function sessionOnOrBefore(date: string): string {
  let d = date;
  for (let i = 0; i < 10; i++) {
    const s = isNyseSession(d);
    const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (s === true || (s === null && weekday !== 0 && weekday !== 6)) return d;
    d = addDays(d, -1);
  }
  return d;
}

export interface MacroEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
  sourceUrl: string;
  status: "scheduled" | "tentative";
}

const FOMC_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
// [決議日, 是否附 SEP 經濟預測, 是否暫定]；聯準會頁面 2026-10-25 查核。
const FOMC: [string, string, boolean, boolean][] = [
  ["2026-01-28", "1/27–28", false, false], ["2026-03-18", "3/17–18", true, false],
  ["2026-04-29", "4/28–29", false, false], ["2026-06-17", "6/16–17", true, false],
  ["2026-07-29", "7/28–29", false, false], ["2026-09-16", "9/15–16", true, false],
  ["2026-10-28", "10/27–28", false, false], ["2026-12-09", "12/8–9", true, false],
  ["2027-01-27", "1/26–27", false, true], ["2027-03-17", "3/16–17", true, true],
  ["2027-04-28", "4/27–28", false, true], ["2027-06-09", "6/8–9", true, true],
  ["2027-07-28", "7/27–28", false, true], ["2027-09-15", "9/14–15", true, true],
  ["2027-10-27", "10/26–27", false, true], ["2027-12-08", "12/7–8", true, true],
];

const fomcEvents: MacroEvent[] = FOMC.map(([date, span, sep, tentative]) => ({
  id: `fomc-${date}`,
  date,
  title: `FOMC 利率決議（${span}）`,
  detail: `${sep ? "附經濟預測摘要（SEP）與點陣圖；" : ""}美東 14:00 公布聲明，14:30 主席記者會${tentative ? "；聯準會標示為暫定日程" : ""}`,
  sourceUrl: FOMC_URL,
  status: tentative ? "tentative" : "scheduled",
}));

// BLS release schedules, read 2026-10-27 from the official pages below (plain curl gets 403,
// so the pages were read through a browser-like fetch tool). BLS marks none of these dates
// as tentative. Releases before 2026-10-27 are not listed; refresh when BLS publishes 2028.
// [release date (ET), reference month]
const BLS_CPI_URL = "https://www.bls.gov/schedule/news_release/cpi.htm";
const BLS_CPI: [string, string][] = [
  ["2026-11-10", "2026-10"], ["2026-12-10", "2026-11"], ["2027-01-13", "2026-12"],
  ["2027-02-11", "2027-01"], ["2027-03-10", "2027-02"], ["2027-04-13", "2027-03"],
  ["2027-05-12", "2027-04"], ["2027-06-10", "2027-05"], ["2027-07-14", "2027-06"],
  ["2027-08-11", "2027-07"], ["2027-09-14", "2027-08"], ["2027-10-14", "2027-09"],
  ["2027-11-10", "2027-10"], ["2027-12-10", "2027-11"],
];
const BLS_EMPSIT_URL = "https://www.bls.gov/schedule/news_release/empsit.htm";
const BLS_EMPSIT: [string, string][] = [
  ["2026-11-06", "2026-10"], ["2026-12-04", "2026-11"], ["2027-01-08", "2026-12"],
  ["2027-02-05", "2027-01"], ["2027-03-05", "2027-02"], ["2027-04-02", "2027-03"],
  ["2027-05-07", "2027-04"], ["2027-06-04", "2027-05"], ["2027-07-02", "2027-06"],
  ["2027-08-06", "2027-07"], ["2027-09-03", "2027-08"], ["2027-10-08", "2027-09"],
  ["2027-11-05", "2027-10"], ["2027-12-03", "2027-11"],
];

const refMonth = (ym: string) => `${ym.slice(0, 4)} 年 ${Number(ym.slice(5))} 月`;

const cpiEvents: MacroEvent[] = BLS_CPI.map(([date, ref]) => ({
  id: `cpi-${date}`,
  date,
  title: `CPI 消費者物價指數（${refMonth(ref)}）`,
  detail: "美東 08:30 公布；勞工統計局（BLS）",
  sourceUrl: BLS_CPI_URL,
  status: "scheduled",
}));

const nfpEvents: MacroEvent[] = BLS_EMPSIT.map(([date, ref]) => ({
  id: `nfp-${date}`,
  date,
  title: `非農就業報告（${refMonth(ref)}）`,
  detail: "美東 08:30 公布；勞工統計局（BLS）就業情勢報告",
  sourceUrl: BLS_EMPSIT_URL,
  status: "scheduled",
}));

export const MACRO_EVENTS: MacroEvent[] = [...fomcEvents, ...cpiEvents, ...nfpEvents].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

/** Run summary for the events job, e.g. 「總經事件 44 筆（FOMC 16、CPI 14、非農 14）」. */
export function macroEventsSummary(events: MacroEvent[] = MACRO_EVENTS): string {
  const count = (prefix: string) => events.filter((e) => e.id.startsWith(prefix)).length;
  return `總經事件 ${events.length} 筆（FOMC ${count("fomc-")}、CPI ${count("cpi-")}、非農 ${count("nfp-")}）`;
}
