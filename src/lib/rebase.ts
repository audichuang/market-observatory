import type { DailyBar } from "./sources/http.ts";

const SAMPLE = 3;
const MIN_SHIFT = 0.02;
const AGREEMENT = 0.005;

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
