// 觀察名單的規則（純函式，不碰資料庫）：能加哪些代號、同公司多股類怎麼合併、名單上限。
import type { WatchMember } from "./universe.ts";

/**
 * 名單上限。每一檔都會讓排程多打幾個外部請求（Yahoo 收盤、Nasdaq 核對、新聞、財報日）。
 * Workers Paid 每次執行的外部請求上限很寬（見 SUBREQUEST_BUDGET），真正的限制是 Yahoo／Nasdaq 打太多會回 429，
 * 以及總覽、走勢頁一次列太多家不好讀：30 家約 35 個代號，核對一次約 50 個請求。
 */
export const MAX_WATCH = 30;

/**
 * 全站（所有使用者名單的聯集）最多追蹤幾家公司。排程抓的是聯集，每多一家，核對與新聞排程各多 1～2 個請求；
 * 100 家約 110 個代號，最重的核對排程約 130 個請求，離 SUBREQUEST_BUDGET 還遠，也不至於讓 Nasdaq 限流。
 */
export const MAX_TRACKED = 100;

export interface Holding {
  ticker: string;
  name: string;
  weightPct: number;
}

/** 持股檔偶爾夾帶非股票列（例如 2602335D、權重近 0）：含數字或權重不大於 0 的不算成分股。 */
export const isConstituent = (h: Holding) => h.weightPct > 0 && /^[A-Z]{1,5}(-[A-Z])?$/.test(h.ticker);

/** 把股類字尾拿掉，用來找同一家公司的其他股類：「ALPHABET INC CL A」與「ALPHABET INC CL C」→「ALPHABET INC」。 */
export function companyKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\s+(CL(ASS)?\s+[A-Z]\b.*|SHS\b.*|SHARES\b.*)$/, "")
    .trim();
}

const SUFFIX = /\b(INC|CORP|CORPORATION|CO|COMPANY|PLC|LTD|N\.?V|S\.?A|HOLDINGS?|GROUP|THE)\b\.?/g;

/** 持股檔的公司名是全大寫（「NVIDIA CORP」）：去掉公司型態字尾、轉成首字大寫，給畫面用。 */
export function displayName(name: string): string {
  // 「PROCTER + GAMBLE CO/THE」這種把 THE 放到斜線後面的寫法：先拿掉「/THE」與多餘斜線。
  const base = companyKey(name).replace(/\/(THE)?\s*$/, "").replace(/\s[&+]\s*CO(MPANY)?\b\.?/g, " ").replace(SUFFIX, " ").replace(/\s+/g, " ").trim() || companyKey(name);
  return base
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 3 && !/[aeiou]/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export type AddResult = { ok: true; member: WatchMember; list: WatchMember[] } | { ok: false; error: string };

/**
 * 把一個代號加進名單。只收最新 SPY 持股裡的 S&P 500 成分股；同公司的其他股類一起加（例如加 GOOG 會帶上 GOOGL），
 * 歸因才不會只算到半家公司。
 */
export function addToWatchlist(list: WatchMember[], input: string, holdings: Holding[]): AddResult {
  const ticker = input.trim().toUpperCase().replace(".", "-");
  if (!ticker) return { ok: false, error: "請輸入代號" };
  const universe = holdings.filter(isConstituent);
  const hit = universe.find((h) => h.ticker === ticker);
  if (!hit) return { ok: false, error: `${ticker} 不在最新的 S&P 500 成分股（SPY 持股）裡` };
  if (list.some((m) => m.tickers.includes(ticker))) return { ok: false, error: `${ticker} 已經在名單裡` };
  if (list.length >= MAX_WATCH) return { ok: false, error: `名單最多 ${MAX_WATCH} 家，請先移除一家` };
  const key = companyKey(hit.name);
  const siblings = universe.filter((h) => companyKey(h.name) === key).sort((a, b) => b.weightPct - a.weightPct);
  const member: WatchMember = { key: siblings[0].ticker, company: displayName(hit.name), tickers: siblings.map((h) => h.ticker) };
  return { ok: true, member, list: [...list, member] };
}

export function removeFromWatchlist(list: WatchMember[], key: string): WatchMember[] {
  return list.filter((m) => m.key !== key);
}

/** 設定裡存的名單可能是舊格式或被手動改壞：只留欄位齊全、代號不重複的項目。 */
export function sanitizeWatchlist(raw: unknown): WatchMember[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: WatchMember[] = [];
  for (const m of raw as Partial<WatchMember>[]) {
    if (!m || typeof m.key !== "string" || typeof m.company !== "string" || !Array.isArray(m.tickers) || !m.tickers.length) continue;
    const tickers = m.tickers.filter((t): t is string => typeof t === "string" && !seen.has(t));
    if (!tickers.length) continue;
    tickers.forEach((t) => seen.add(t));
    out.push({ key: m.key, company: m.company, tickers });
  }
  return out.slice(0, MAX_WATCH);
}

/**
 * 多份名單合成一份（排程要抓的聯集）：照名單順序、同一家公司（key）或同一個代號只留第一次出現的。
 * 超過 MAX_TRACKED 的部分不收，加入時就會擋下，這裡只是防手動改壞的資料拖垮排程。
 */
export function mergeWatchlists(lists: WatchMember[][]): WatchMember[] {
  const keys = new Set<string>();
  const tickers = new Set<string>();
  const out: WatchMember[] = [];
  for (const list of lists) {
    for (const m of list) {
      if (keys.has(m.key) || m.tickers.some((t) => tickers.has(t))) continue;
      keys.add(m.key);
      m.tickers.forEach((t) => tickers.add(t));
      out.push(m);
    }
  }
  return out.slice(0, MAX_TRACKED);
}
