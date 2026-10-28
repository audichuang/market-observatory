// 溝通與對帳層（L09／L11）：純函式，不碰 D1。頁面三種分數（樣本內、滾動驗證、上線後實際紀錄）各自獨立，永不合併。

import { HORIZON, type Rate } from "./forecast.ts";

/** 上線後實際紀錄至少要有幾個獨立月份才報分數。 */
export const LIVE_MIN_N = 12;

/** Directional forecast badges follow the Taiwan market convention: red up, green down. */
export const FORECAST_CALL: Record<string, [string, string, string]> = {
  up: ["tone-pos", "高於平常", "目前條件下的上漲機率明顯高於歷史基準（平常），且滾動驗證勝過基準"],
  down: ["tone-neg", "低於平常", "目前條件下的上漲機率明顯低於歷史基準（平常），且滾動驗證勝過基準"],
  inconclusive: ["warn", "偵測不到預測力", "目前的訊號不足以把機率拉離歷史基準"],
};

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

/** dd5 的統一定義（網頁、App 與 API 的自然頻率句共用；起點是資料日，不寫「今天」以免歷史紀錄的起點漂移）。 */
export const dd5Definition = (horizon = HORIZON): string => `以資料日收盤為起點，未來 ${horizon} 個交易日內至少有一天收盤比它低 5% 以上`;

/** 卡片與標題用的 dd5 短名稱。 */
export const dd5ShortLabel = (horizon = HORIZON): string => `${horizon} 個交易日內至少一天比資料日收盤低 5% 以上的機率`;

/** 上漲機率的目標：約 N 個交易日後收盤高於資料日（標題括號與滾動驗證的「目標」共用）。 */
export const upTargetLabel = (horizon = HORIZON): string => `約 ${horizon} 個交易日後收盤高於資料日`;

/** U-01：P(up) 沒有方向時的說法；不說「接近平常」或「與平常差不多」，那會被讀成已證明相等。 */
export const NO_INCREMENTAL_SKILL = "尚未偵測到增額預測力";

/** D-04：兩種「95% 區間」分名。比例區間是這類時期的歷史比例；預測力區間是滾動驗證 BSS 的 bootstrap 區間。兩者都不是今天機率的區間。 */
export const PROPORTION_INTERVAL = "這類時期的歷史比例 95% 區間";
export const SKILL_INTERVAL = "歷史平均預測力 95% 區間（不是今天這個數字的區間）";

/** 自然頻率：把比例換成「每 10 次有幾次」（四捨五入到整數）。 */
export const outOfTen = (p: number): number => Math.round(Math.min(1, Math.max(0, p)) * 10);

/**
 * L11：自然頻率句，用收縮後的 pick.p（頁面上的主數字）、每 100 次。
 * showBoth（up 與 dd5 都是該 pick.distinct）為 true 才同時列條件與平常的次數並附段數；否則只列平常，
 * 並說明「尚未偵測到」差別（不說「與平常差不多」：沒偵測到不等於證明相等，U-01）。
 * 也不說頁面「採」平常的比例：G01 收縮下 distinct=false 時 pick.p 仍可能不等於 base（主數字是收縮後的 p）。
 * 沒有條件時（basis 為 base）不印段數。kind "up"：21 個交易日後收高；"dd5"：見 dd5Definition。
 */
export function naturalFrequency(pick: { p: number; base: Rate; conditional: Rate | null }, kind: "up" | "dd5", showBoth: boolean, horizon = HORIZON): string {
  const what = kind === "up" ? `${horizon} 個交易日後收高` : `${horizon} 個交易日內至少有一天收盤比起點低 5% 以上`;
  if (!showBoth) {
    const lead = kind === "up" ? NO_INCREMENTAL_SKILL : "尚未偵測到條件與平常的差別";
    return `${lead}；平常是每 100 次有 ${outOfCent(pick.base.p)} 次 ${what}`;
  }
  const tail = pick.conditional ? `，依據 ${pick.conditional.episodes} 段獨立時期` : "";
  return `過去像今天這樣的時期，大約每 100 次有 ${outOfCent(pick.p)} 次 ${what}（平常是每 100 次有 ${outOfCent(pick.base.p)} 次）${tail}`;
}

export const outOfCent = (p: number): number => Math.round(Math.min(1, Math.max(0, p)) * 100);

type PickLike = { p: number; base: Rate; conditional: Rate | null; distinct: boolean };

/** 頁面的兩句自然頻率。顯示兩個數字與否，up 與 drawdown 都看 pick.distinct（scored 只影響另外的「未通過驗證」標籤）。 */
export function frequencySentences(o: { pick: PickLike; drawdown: { pick: PickLike; scored: boolean } }): { up: string; dd5: string } {
  return { up: naturalFrequency(o.pick, "up", o.pick.distinct), dd5: naturalFrequency(o.drawdown.pick, "dd5", o.drawdown.pick.distinct) };
}

// --- L4: forecast live tracks ---
export const DD5_LIVE_NOTE = "依 R2-6：只計寫入時就是資料庫最新 SPX 交易日（延遲 0 個交易日）、且存有 dd5 模型版本的列；尚未比對排程當時應有的收盤日，資料來源停更後才補寫的列仍可能被算入。";
export const UP_LIVE_NOTE = "合併所有已寫入的紀錄，包含延遲補記的列；尚未依發布時間區分即時與補記。";

interface Dd5Detail {
  recordedLagSessions: number;
  drawdown: { p: number; base: number; modelVersion: string };
}

function dd5DetailOf(detail: string | null): Dd5Detail | null {
  try {
    const d = JSON.parse(detail ?? "null");
    if (!Number.isFinite(d?.recordedLagSessions) || !Number.isFinite(d?.drawdown?.p) || !Number.isFinite(d?.drawdown?.base)
      || typeof d?.drawdown?.modelVersion !== "string" || !d.drawdown.modelVersion.trim()) return null;
    return d;
  } catch {
    return null;
  }
}

export function dd5ClassOf(detail: string | null): "realtime" | "delayed" | "unknown" {
  const d = dd5DetailOf(detail);
  return !d ? "unknown" : d.recordedLagSessions >= 1 ? "delayed" : "realtime";
}

/** R2-6: one grid shared by all realtime rows, anchored at the first realtime SPX session; group only after selecting mature rows. */
export function dd5LiveTrackOf(rows: { date: string; close: number; detail: string | null }[], points: { date: string; close: number }[]) {
  const counts = { realtime: 0, delayed: 0, unknown: 0 };
  const idx = new Map(points.map((p, i) => [p.date, i]));
  const realtime = rows.filter((r) => {
    const kind = dd5ClassOf(r.detail);
    counts[kind]++;
    return kind === "realtime" && idx.has(r.date);
  }).sort((a, b) => idx.get(a.date)! - idx.get(b.date)!);
  const groups = new Map<string, { n: number; error: number; baseError: number; events: number }>();
  const start = realtime.length ? idx.get(realtime[0].date)! : 0;
  for (const r of realtime) {
    const i = idx.get(r.date)!;
    if ((i - start) % HORIZON !== 0 || !points[i + HORIZON]) continue;
    const y = points.slice(i + 1, i + HORIZON + 1).some((p) => p.close <= 0.95 * r.close) ? 1 : 0;
    const d = dd5DetailOf(r.detail)!.drawdown;
    const g = groups.get(d.modelVersion) ?? { n: 0, error: 0, baseError: 0, events: 0 };
    g.n++;
    g.error += (d.p - y) ** 2;
    g.baseError += (d.base - y) ** 2;
    g.events += y;
    groups.set(d.modelVersion, g);
  }
  return {
    ...counts,
    groups: [...groups].map(([modelVersion, g]) => {
      const brier = g.error / g.n;
      const brierBase = g.baseError / g.n;
      const tooFew = g.n < LIVE_MIN_N;
      return { modelVersion, n: g.n, tooFew, brier, brierBase, bss: tooFew || brierBase === 0 ? null : 1 - brier / brierBase, eventShare: g.events / g.n };
    }),
    note: DD5_LIVE_NOTE,
  };
}
