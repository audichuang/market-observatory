import { addDays } from "./calendar.ts";
import type { DailyBar } from "./sources/http.ts";

const SAMPLE = 3;
const MIN_SHIFT = 0.02;
const AGREEMENT = 0.005;

// Deepest product read: 60 months of trends + 320 warm-up days ≈ 2146 days; ETF 1900, snapshots 430.
// 窗口外的舊列沒有換基準；日後新增比 REBASE_COVER_DAYS 更深的讀取（例如 10 年定投）要先處理這些列。
export const REBASE_COVER_DAYS = 2200;

/** Check the span and stored dates of ascending daily bars before allowing a split rebase. */
export function refetchCoverage(
  stored: string[],
  fresh: DailyBar[],
  upTo: string,
): { ok: true } | { ok: false; reason: string } {
  if (!fresh.length) return { ok: false, reason: "重抓沒有日線" };
  if (!stored.length) return { ok: true };
  const min = stored[0];
  const max = stored[stored.length - 1];
  const first = fresh[0].date;
  const last = fresh[fresh.length - 1].date;
  if (last < max) return { ok: false, reason: `重抓只到 ${last}，早於已存的 ${max}` };
  // 窗口外的舊列沒有換基準；日後新增比 REBASE_COVER_DAYS 更深的讀取（例如 10 年定投）要先處理這些列。
  const from = addDays(upTo, -REBASE_COVER_DAYS);
  if (first > min && first > from) return { ok: false, reason: `重抓從 ${first} 開始，未涵蓋已存的 ${min} 起` };
  const dates = new Set(fresh.map((bar) => bar.date));
  const missing = stored.filter((date) => date >= from && !dates.has(date));
  if (missing.length) return { ok: false, reason: `重抓缺少已存日期 ${missing.slice(0, 5).join(",")}（共 ${missing.length} 天）` };
  return { ok: true };
}

/**
 * Yahoo 的收盤是拆股調整後的價格：一旦分割（或反向分割），整段歷史都會被改寫成新股數基準。
 * 每天只重抓一個月時，會出現「近一個月新基準、更早舊基準」混在一起。
 * 判斷法：新抓資料與資料庫重疊的「最舊幾天」，舊／新 比值彼此一致且偏離 1 超過 2% → 回傳該比值，
 * 呼叫端要重抓整段歷史。一般的收盤修正只會動到最近一兩天，比值也不會一致，不會誤判。
 */
export function detectRebase(existing: Map<string, number>, fresh: DailyBar[]): number | null {
  const ratios: number[] = [];
  for (const b of fresh) {
    const old = existing.get(b.date);
    if (old === undefined || b.close <= 0) continue;
    ratios.push(old / b.close);
    if (ratios.length === SAMPLE) break;
  }
  if (ratios.length < SAMPLE) return null;
  const mean = ratios.reduce((a, r) => a + r, 0) / ratios.length;
  if (Math.abs(mean - 1) <= MIN_SHIFT) return null;
  return ratios.every((r) => Math.abs(r / mean - 1) <= AGREEMENT) ? mean : null;
}

/**
 * 分割待修清單的下一個狀態：新偵測到的加入、這次成功重抓的移除。
 * 只要還在清單上，每日抓價就不寫這檔的一個月資料，並且每次都重抓完整歷史，
 * 不依賴「重疊天數夠不夠再偵測一次」。
 */
export function nextPendingRebase(
  pending: Record<string, number>,
  detected: Record<string, number>,
  recovered: string[],
): Record<string, number> {
  const next = { ...pending, ...detected };
  for (const s of recovered) delete next[s];
  return next;
}
