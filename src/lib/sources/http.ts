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
 * 一次執行（一個排程、一個請求）能打的外部請求額度。Cloudflare 免費方案每次執行最多 50 個外部子請求，
 * 轉址的每一跳、重試的每一次都算一個；超過時 fetch 會直接丟錯，後面排的抓取全部失敗。
 * 所以每個外部請求打出去之前先 take()：額度用完就在本地拒絕，工作照額度決定要抓幾檔，不賭運氣。
 */
export class Budget {
  used = 0;
  readonly byHost: Record<string, number> = {};
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
  init: RequestInit & { timeoutMs?: number; budget?: Budget; retryWaitMs?: (retryAfter: string | null) => number } = {},
): Promise<Response> {
  const { timeoutMs = 20000, headers, budget, retryWaitMs = retryDelayMs, ...rest } = init;
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
      if (hop >= MAX_REDIRECTS) throw new SourceError(source, `轉址超過 ${MAX_REDIRECTS} 次`, res.status);
      target = new URL(loc, target).toString();
    }
    if (res.ok) return res;
    // 額度還夠才重試；不夠就把錯誤交回去，不拿別檔的額度來賭。
    if (attempt === 0 && RETRY_STATUSES.has(res.status) && (!budget || budget.remaining > 0)) {
      await sleep(retryWaitMs(res.headers.get("retry-after")));
      continue;
    }
    throw new SourceError(source, `HTTP ${res.status}`, res.status);
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
