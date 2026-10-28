const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export class SourceError extends Error {
  source: string;
  status?: number;
  constructor(source: string, message: string, status?: number) {
    super(`${source}: ${message}`);
    this.source = source;
    this.status = status;
  }
}

/**
 * 一次執行（一個排程、一個請求）能打的外部請求額度。Cloudflare 每次執行的外部子請求有上限
 * （免費方案 50、Workers Paid 預設 10,000），轉址的每一跳、重試的每一次都算一個；超過時 fetch 會直接丟錯。
 * 每個外部請求打出去之前先 take()：額度用完就在本地拒絕，工作照額度決定要抓幾檔，不賭運氣。
 */
export class Budget {
  used = 0;
  readonly byHost: Record<string, number> = {};
  readonly dataIssues: string[] = [];
  readonly limit: number;
  constructor(limit: number) {
    this.limit = limit;
  }
  get remaining(): number {
    return Math.max(0, this.limit - this.used);
  }
  take(url: string): void {
    const host = new URL(url).host;
    if (this.used >= this.limit) throw new BudgetError(host, this.limit);
    this.used++;
    this.byHost[host] = (this.byHost[host] ?? 0) + 1;
  }
}

export class BudgetError extends Error {
  constructor(host: string, limit: number) {
    super(`這次執行的外部請求額度（${limit}）已用完，未請求 ${host}`);
  }
}

const MAX_REDIRECTS = 5;
/** 429／503 只重試一次：等對方給的 Retry-After（最多 5 秒）加一點隨機，避免同一秒一起重打。 */
const RETRY_STATUSES = new Set([429, 503]);
const MAX_RETRY_WAIT_MS = 5000;

export function retryDelayMs(retryAfter: string | null, random = Math.random()): number {
  const secs = retryAfter !== null && /^\d+$/.test(retryAfter.trim()) ? Number(retryAfter.trim()) : 1;
  return Math.min(secs * 1000, MAX_RETRY_WAIT_MS) + Math.floor(random * 500);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithTimeout(
  source: string,
  url: string,
  init: RequestInit & { timeoutMs?: number; budget?: Budget; retryWaitMs?: (retryAfter: string | null) => number; errorBody?: boolean } = {},
): Promise<Response> {
  const { timeoutMs = 20000, headers, budget, retryWaitMs = retryDelayMs, errorBody = false, ...rest } = init;
  const signal = AbortSignal.timeout(timeoutMs);
  const reqInit = { ...rest, signal, headers: { "User-Agent": UA, Accept: "*/*", ...(headers as Record<string, string> | undefined) } };
  for (let attempt = 0; ; attempt++) {
    // 自己跟轉址：每一跳都要先扣額度（自動跟轉址時，跳了幾次在這裡看不到）。
    let target = url;
    let res: Response;
    for (let hop = 0; ; hop++) {
      budget?.take(target);
      res = await fetch(target, { ...reqInit, redirect: "manual" });
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!loc) break;
      // 沒讀的回應本體會佔著連線（Workers 同時只能有 6 個）：跟轉址、重試、丟錯之前都先丟掉。
      await res.body?.cancel();
      if (hop >= MAX_REDIRECTS) throw new SourceError(source, `轉址超過 ${MAX_REDIRECTS} 次`, res.status);
      target = new URL(loc, target).toString();
    }
    if (res.ok) return res;
    // errorBody：錯誤回應的本體帶進錯誤訊息（例如 APNs 的 {"reason":"BadDeviceToken"}），只取前 200 字。
    const detail = errorBody ? (await res.text().catch(() => "")).slice(0, 200) : "";
    if (!errorBody) await res.body?.cancel();
    // 額度還夠才重試；不夠就把錯誤交回去，不拿別檔的額度來賭。
    if (attempt === 0 && RETRY_STATUSES.has(res.status) && (!budget || budget.remaining > 0)) {
      await sleep(retryWaitMs(res.headers.get("retry-after")));
      continue;
    }
    throw new SourceError(source, `HTTP ${res.status}${detail ? ` ${detail}` : ""}`, res.status);
  }
}

export interface DailyBar {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

/**
 * 同一個收盤的兩種寫法：Yahoo spark 的收盤是單精度浮點，與 chart 的值差在第 8 位有效數字左右
 * （實測 ^GSPC 差 0.0002、相對 3e-8；單精度誤差上限約 6e-8）。門檻 1e-6 留了十幾倍餘裕；價格一萬美元以下時，它小於一分錢，真的修正收盤一定看得出來。這種差異不算「收盤改了」，否則每天都會把整個月重寫一遍、清掉已做完的交叉核對。
 */
export const sameClose = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-6;

export type DayConflict = { date: string; closes: number[] };

/** Reject conflicting dates, except Yahoo's latest date which can include a live quote. */
export function dedupeDaily(rows: DailyBar[], lastDayKeepsLatest: boolean): { bars: DailyBar[]; conflicts: DayConflict[] } {
  const byDate = new Map<string, DailyBar[]>();
  for (const row of rows) {
    const group = byDate.get(row.date);
    if (group) group.push(row);
    else byDate.set(row.date, [row]);
  }
  const dates = [...byDate.keys()].sort();
  const bars: DailyBar[] = [];
  const conflicts: DayConflict[] = [];
  for (const date of dates) {
    const group = byDate.get(date)!;
    const closes = group.map((r) => r.close);
    if (!(lastDayKeepsLatest && date === dates.at(-1)) && !sameClose(Math.min(...closes), Math.max(...closes))) {
      conflicts.push({ date, closes });
    } else {
      bars.push(group[group.length - 1]);
    }
  }
  return { bars, conflicts };
}

export const finiteOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** "1,234.5" / "$1.95" / "6,317,269" → number；空或 N/A 回 null。 */
export function parseLooseNumber(s: unknown): number | null {
  if (typeof s === "number") return finiteOrNull(s);
  if (typeof s !== "string") return null;
  const cleaned = s.replace(/[$,%\s]/g, "");
  if (!cleaned || cleaned === "N/A" || cleaned === "--") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "10/23/2026" → "2026-10-23" */
export function mdyToIso(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
