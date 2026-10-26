// 溝通與對帳層（L09／L11）：純函式，不碰 D1。頁面三種分數（樣本內、滾動驗證、上線後實際紀錄）各自獨立，永不合併。

import { HORIZON, type Rate } from "./forecast.ts";

/** 上線後實際紀錄至少要有幾個獨立月份才報分數。 */
export const LIVE_MIN_N = 12;

export interface LiveRow {
  date: string;
  p: number;
  base: number;
  /** 紀錄當時存下的起始收盤（forecasts.close）；對帳一律用它，不用事後可能被修正的歷史價 */
  close: number;
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
    return later ? (later.close > r.close ? 1 : 0) : null;
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
 * L11：自然頻率句，用收縮後的 pick.p（頁面上的主數字）、每 100 次。
 * showBoth（up 與 dd5 都是該 pick.distinct）為 true 才同時列條件與平常的次數並附段數；否則只說「與平常差不多」並只列平常。
 * 沒有條件時（basis 為 base）不印段數。kind "up"：21 個交易日後收高；"dd5"：21 個交易日內出現 ≥5% 回撤。
 */
export function naturalFrequency(pick: { p: number; base: Rate; conditional: Rate | null }, kind: "up" | "dd5", showBoth: boolean, horizon = HORIZON): string {
  const what = kind === "up" ? `${horizon} 個交易日後收高` : `${horizon} 個交易日內出現 ≥5% 回撤`;
  if (!showBoth) return `與平常差不多：過去大約每 100 次有 ${outOfCent(pick.base.p)} 次 ${what}`;
  const tail = pick.conditional ? `，依據 ${pick.conditional.episodes} 段獨立時期` : "";
  return `過去像今天這樣的時期，大約每 100 次有 ${outOfCent(pick.p)} 次 ${what}（平常是每 100 次有 ${outOfCent(pick.base.p)} 次）${tail}`;
}

export const outOfCent = (p: number): number => Math.round(Math.min(1, Math.max(0, p)) * 100);

type PickLike = { p: number; base: Rate; conditional: Rate | null; distinct: boolean };

/** 頁面的兩句自然頻率。顯示兩個數字與否，up 與 drawdown 都看 pick.distinct（scored 只影響另外的「未通過驗證」標籤）。 */
export function frequencySentences(o: { pick: PickLike; drawdown: { pick: PickLike; scored: boolean } }): { up: string; dd5: string } {
  return { up: naturalFrequency(o.pick, "up", o.pick.distinct), dd5: naturalFrequency(o.drawdown.pick, "dd5", o.drawdown.pick.distinct) };
}
