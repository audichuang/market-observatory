// 溝通與對帳層（L09／L11）：純函式，不碰 D1。頁面三種分數（樣本內、滾動驗證、上線後實際紀錄）各自獨立，永不合併。

import type { Series } from "./analytics.ts";
import { DEFAULT_MODEL, HORIZON, vixAt, type ModelConfig, type Rate } from "./forecast.ts";
import { easternDate, inCalendarCoverage, latestExpectedClose } from "./calendar.ts";

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
  realtime?: number;
  delayed?: number;
  unknown?: number;
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

export const FORECAST_PENDING_BADGE = "待更新";

/** Dates are already formatted by the caller for its display. */
export function forecastPendingNote(forecastDate: string, snapshotDate: string): string {
  return `最新收盤 ${snapshotDate} 的預測還沒記錄（通常是在等當天的 VIX 或 S&P 500 收盤核對），這裡先顯示 ${forecastDate} 收盤的紀錄；展望頁用最新資料即時試算，數字可能不同。`;
}

export interface OutlookUnavailable {
  reason: "vix-stale" | "insufficient";
  spxDate: string | null;
  vixDate: string | null;
  staleSessions: number | null;
  maxStaleSessions: number | null;
}

/** Explain a null outlook using the model's existing VIX freshness rule. */
export function outlookUnavailable(spx: Series, vix: Series, cfg: ModelConfig = DEFAULT_MODEL): OutlookUnavailable {
  const last = spx.length - 1;
  const spxDate = spx.last()?.date ?? null;
  const vixDate = spxDate === null ? null : vix.onOrBefore(spxDate)?.date ?? null;
  return {
    reason: spxDate !== null && vixAt(spx, vix, last, cfg.vixMaxStaleSessions) === null ? "vix-stale" : "insufficient",
    spxDate,
    vixDate,
    staleSessions: vixDate === null ? null : last - spx.floorIndex(vixDate),
    maxStaleSessions: cfg.vixMaxStaleSessions,
  };
}

export function outlookUnavailableText(u: OutlookUnavailable | null | undefined): string {
  if (u?.reason === "vix-stale") {
    if (u.vixDate === null) return "還沒有 VIX 資料，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。";
    return `VIX 最新只到 ${u.vixDate}，比 S&P 500（${u.spxDate}）落後 ${u.staleSessions} 個交易日，超過 ${u.maxStaleSessions} 個交易日的上限，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。`;
  }
  if (u?.reason === "insufficient") return "歷史資料還不夠計算條件與驗證，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。";
  return "資料不足，或 VIX 超過 3 個交易日未更新，今天沒有產生預測；下方的機構觀點與過去的預測紀錄照常顯示。";
}

// --- L4: forecast live tracks ---
export function liveNoteOf(counts: { delayed: number; unknown: number }, target: "up" | "dd5"): string {
  return `只計即時發布的列（寫入時是最新交易日，且在下一個交易日美東 16:30 前寫入）；延遲補記 ${counts.delayed} 列、資格不明 ${counts.unknown} 列另列、不計分。${target === "up" ? "合併所有已發布的模型版本。" : "依模型版本分開計分。"}`;
}

/** PUB-1: calendar coverage is required before using the scheduled close comparison. */
export function publishStatusOf(tradeDate: string, createdAt: string): "on-time" | "late" | "unknown" {
  const at = new Date(createdAt);
  if (!Number.isFinite(at.getTime()) || !inCalendarCoverage(tradeDate) || !inCalendarCoverage(easternDate(at))) return "unknown";
  const expected = latestExpectedClose(at);
  return expected < tradeDate ? "unknown" : expected > tradeDate ? "late" : "on-time";
}

function publishClassOf(lag: unknown, tradeDate: string, createdAt: string): "realtime" | "delayed" | "unknown" {
  const status = publishStatusOf(tradeDate, createdAt);
  if (typeof lag !== "number" || !Number.isFinite(lag) || status === "unknown") return "unknown";
  return lag >= 1 || status === "late" ? "delayed" : "realtime";
}

/** L09 addendum: P(up) needs its own stored values and lag, but no dd5 metadata. */
export function upClassOf(row: LiveRow & { detail: string | null; created_at: string }): "realtime" | "delayed" | "unknown" {
  if (![row.p, row.base, row.close].every(Number.isFinite)) return "unknown";
  try {
    const detail = JSON.parse(row.detail ?? "null");
    return publishClassOf(detail?.recordedLagSessions, row.date, row.created_at);
  } catch {
    return "unknown";
  }
}

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

export function dd5ClassOf(detail: string | null, tradeDate: string, createdAt: string): "realtime" | "delayed" | "unknown" {
  const d = dd5DetailOf(detail);
  return !d ? "unknown" : publishClassOf(d.recordedLagSessions, tradeDate, createdAt);
}

/** R2-6: one grid shared by all realtime rows, anchored at the first realtime SPX session; group only after selecting mature rows. */
export function dd5LiveTrackOf(rows: { date: string; close: number; detail: string | null; created_at: string }[], points: { date: string; close: number }[]) {
  const counts = { realtime: 0, delayed: 0, unknown: 0 };
  const idx = new Map(points.map((p, i) => [p.date, i]));
  const realtime = rows.filter((r) => {
    const kind = dd5ClassOf(r.detail, r.date, r.created_at);
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
    note: liveNoteOf(counts, "dd5"),
  };
}
