// 溝通與對帳層（L09／L11）：純函式，不碰 D1。頁面三種分數（樣本內、滾動驗證、上線後實際紀錄）各自獨立，永不合併。

import { HORIZON, type Rate } from "./forecast.ts";

/** 上線後實際紀錄至少要有幾個獨立月份才報分數。 */
export const LIVE_MIN_N = 12;

export interface LiveRow {
  date: string;
  p: number;
  base: number;
}

export interface LiveTrack {
  /** 獨立（不重疊）且已到期的列數 */
  n: number;
  /** 已到期的列數（含重疊的；只供說明為何 n 比較少） */
  resolvedAll: number;
  /** n < LIVE_MIN_N：頁面寫「樣本太少」，不報 BSS */
  tooFew: boolean;
  bss: number | null;
  brier: number | null;
  brierBase: number | null;
  upShare: number | null;
}

/**
 * L09：上線後實際紀錄。只用不重疊、已到期的列：從第一筆紀錄的交易日起，每 21 個交易日取一列
 * （落在格點上但當天沒有紀錄就略過，不遞補相鄰日）。
 * rows = forecasts 表（任意順序）；points = SPX 交易日序列（用來數交易日與判斷結果）。BSS 用該列存下來的 base_rate。
 */
export function liveTrackOf(rows: LiveRow[], points: { date: string; close: number }[], horizon = HORIZON): LiveTrack {
  const idx = new Map(points.map((p, i) => [p.date, i]));
  const known = rows.filter((r) => idx.has(r.date)).sort((a, b) => idx.get(a.date)! - idx.get(b.date)!);
  const empty: LiveTrack = { n: 0, resolvedAll: 0, tooFew: true, bss: null, brier: null, brierBase: null, upShare: null };
  if (!known.length) return empty;
  const i0 = idx.get(known[0].date)!;
  const outcome = (r: LiveRow): number | null => {
    const i = idx.get(r.date)!;
    const later = points[i + horizon];
    return later ? (later.close > points[i].close ? 1 : 0) : null;
  };
  const resolvedAll = known.filter((r) => outcome(r) !== null).length;
  const picked = known.filter((r) => (idx.get(r.date)! - i0) % horizon === 0 && outcome(r) !== null);
  const n = picked.length;
  if (!n) return { ...empty, resolvedAll };
  const ys = picked.map((r) => outcome(r)!);
  const brier = picked.reduce((a, r, k) => a + (r.p - ys[k]) ** 2, 0) / n;
  const brierBase = picked.reduce((a, r, k) => a + (r.base - ys[k]) ** 2, 0) / n;
  const tooFew = n < LIVE_MIN_N;
  return { n, resolvedAll, tooFew, bss: tooFew || brierBase === 0 ? null : 1 - brier / brierBase, brier, brierBase, upShare: ys.reduce((a, y) => a + y, 0) / n };
}

/** 自然頻率：把比例換成「每 10 次有幾次」（四捨五入到整數）。 */
export const outOfTen = (p: number): number => Math.round(Math.min(1, Math.max(0, p)) * 10);

/**
 * L11：自然頻率句。cond 為 null（沒有可用的條件、只剩基準率）時，「像今天這樣」就是整體，依據用基準率的段數。
 * kind "up"：21 個交易日後收高；"dd5"：21 個交易日內出現 ≥5% 回撤。
 */
export function naturalFrequency(cond: Rate | null, base: Rate, kind: "up" | "dd5", horizon = HORIZON): string {
  const r = cond ?? base;
  const what = kind === "up" ? `${horizon} 個交易日後收高` : `${horizon} 個交易日內出現 ≥5% 回撤`;
  return `過去像今天這樣的時期，大約每 10 次有 ${outOfTen(r.p)} 次 ${what}（平常是每 10 次有 ${outOfTen(base.p)} 次），依據 ${r.episodes} 段獨立時期`;
}
