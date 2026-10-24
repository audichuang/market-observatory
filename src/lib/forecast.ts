// 「約 21 個交易日後 S&P 500 是否高於今天」的機率估計。
//
// 研究結論（見 docs/forecast.md）：分析師目標價、策略師目標、廣度、VIX 期限結構對一個月方向都沒有穩定預測力；
// 只有「是否在 200 日線之上」與「VIX ≥ 30」有微弱、樣本少的差異。所以這裡刻意保守：
// - 預設輸出歷史基準率；條件機率只在有效樣本夠、且信賴區間不含基準率時才採用；
// - 用滾動（walk-forward）驗證算 Brier skill score，跨 0 就標「不確定」。
// 所有計算只用「當下已知」的資料：第 t 天的標籤要等到 t+21 天收盤後才算已知。

import { Series, smaSeries } from "./analytics.ts";

export const HORIZON = 21;
export const MIN_EFFECTIVE_N = 30;
export const VIX_STRESS = 30;

export type Regime = { aboveSma200: boolean; vixStress: boolean };

export interface Rate {
  /** 上漲比例 */
  p: number;
  /** 重疊窗口的天數 */
  days: number;
  /** 有效獨立樣本數 ≈ 天數 ÷ 21 */
  nEff: number;
  low: number;
  high: number;
}

/** Wilson 95% 區間；n 用有效樣本數（重疊窗口不是獨立樣本）。 */
export function wilson(p: number, n: number, z = 1.96): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 };
  const z2 = z * z;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

export function rateOf(ups: number, days: number): Rate | null {
  if (days === 0) return null;
  const p = ups / days;
  const nEff = days / HORIZON;
  return { p, days, nEff, ...wilson(p, nEff) };
}

export interface Observation {
  date: string;
  close: number;
  regime: Regime | null;
  /** 21 個交易日後是否較高；還不知道就是 null */
  up: boolean | null;
  /** 這個標籤在哪一天收盤後才知道 */
  knownOn: string | null;
}

/** 把 SPX 與 VIX 對齊成逐日觀測值；200 日線不足、VIX 缺值的日子 regime 為 null。 */
export function buildObservations(spx: Series, vix: Series): Observation[] {
  const pts = spx.points;
  const sma = smaSeries(pts, 200);
  return pts.map((p, i) => {
    const v = vix.at(p.date) ?? vix.onOrBefore(p.date)?.close ?? null;
    const regime = sma[i] === null || v === null ? null : { aboveSma200: p.close > (sma[i] as number), vixStress: v >= VIX_STRESS };
    const future = pts[i + HORIZON];
    return { date: p.date, close: p.close, regime, up: future ? future.close > p.close : null, knownOn: future?.date ?? null };
  });
}

function matches(r: Regime, cond: Partial<Regime>): boolean {
  return (cond.aboveSma200 === undefined || r.aboveSma200 === cond.aboveSma200) && (cond.vixStress === undefined || r.vixStress === cond.vixStress);
}

/** 在「asOf 當天收盤後已知」的標籤中，符合條件的上漲比例。 */
export function conditionalRate(obs: Observation[], asOf: string, cond: Partial<Regime> = {}): Rate | null {
  let ups = 0;
  let days = 0;
  for (const o of obs) {
    if (o.up === null || !o.knownOn || o.knownOn > asOf || !o.regime) continue;
    if (!matches(o.regime, cond)) continue;
    days++;
    if (o.up) ups++;
  }
  return rateOf(ups, days);
}

export interface Pick {
  p: number;
  /** 採用的依據 */
  basis: "base" | "trend" | "vix" | "trend+vix";
  base: Rate;
  conditional: Rate | null;
  /** 條件機率的區間不含基準率、且有效樣本夠，才算「條件有差」 */
  distinct: boolean;
}

/**
 * 只用 asOf 當天已知的資料，替 regime 挑一個機率：
 * 先試最細的組合（200 日線 × VIX），有效樣本不足就退到單一條件，再不夠就用基準率。
 */
export function pickProbability(obs: Observation[], asOf: string, regime: Regime): Pick | null {
  const base = conditionalRate(obs, asOf);
  if (!base) return null;
  const candidates: [Pick["basis"], Partial<Regime>][] = [
    ["trend+vix", regime],
    ["vix", { vixStress: regime.vixStress }],
    ["trend", { aboveSma200: regime.aboveSma200 }],
  ];
  for (const [basis, cond] of candidates) {
    const r = conditionalRate(obs, asOf, cond);
    if (!r || r.nEff < MIN_EFFECTIVE_N) continue;
    // VIX 一般狀態（<30）幾乎就是全部樣本，沒有資訊量，跳過。
    if (basis === "vix" && !regime.vixStress) continue;
    const distinct = base.p < r.low || base.p > r.high;
    return { p: r.p, basis, base, conditional: r, distinct };
  }
  return { p: base.p, basis: "base", base, conditional: null, distinct: false };
}

export interface Evaluation {
  points: number;
  /** 預測 > 50% 視為看漲，與實際方向一致的比例 */
  hitRate: number | null;
  /** 永遠看漲（基準）的命中率 */
  baseHitRate: number | null;
  brier: number | null;
  brierBase: number | null;
  /** Brier skill score = 1 − Brier ÷ Brier(基準)；> 0 才比單純用基準率好 */
  bss: number | null;
  bssLow: number | null;
  bssHigh: number | null;
  firstDate: string | null;
  lastDate: string | null;
}

/** 決定性的偽亂數（同一份資料每次 bootstrap 結果一樣）。 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 滾動驗證：從有 burnInDays 天已知標籤之後開始，每 21 個交易日預測一次（不重疊），
 * 每次只用當天已知的標籤估機率，再跟實際結果比。
 */
export function walkForward(obs: Observation[], burnInDays = 504, blockSize = 3, resamples = 1000): Evaluation {
  const rows: { date: string; p: number; pBase: number; y: number }[] = [];
  // 第 j 天的標籤在第 j+21 天收盤後已知，所以到第 i 天為止已知的標籤，就是 i−21 天以前、有 regime 的那些。
  let known = 0;
  let lastRow = -Infinity;
  for (let i = 0; i < obs.length; i++) {
    const j = i - HORIZON;
    if (j >= 0 && obs[j].regime && obs[j].up !== null) known++;
    const o = obs[i];
    if (!o.regime || o.up === null) continue;
    if (known < burnInDays) continue;
    if (i - lastRow < HORIZON) continue;
    lastRow = i;
    const pick = pickProbability(obs, o.date, o.regime);
    if (!pick) continue;
    rows.push({ date: o.date, p: pick.p, pBase: pick.base.p, y: o.up ? 1 : 0 });
  }
  const empty: Evaluation = { points: rows.length, hitRate: null, baseHitRate: null, brier: null, brierBase: null, bss: null, bssLow: null, bssHigh: null, firstDate: null, lastDate: null };
  if (rows.length < 12) return empty;
  const brierOf = (rs: typeof rows, key: "p" | "pBase") => rs.reduce((a, r) => a + (r[key] - r.y) ** 2, 0) / rs.length;
  const bssOf = (rs: typeof rows) => {
    const b = brierOf(rs, "pBase");
    return b === 0 ? 0 : 1 - brierOf(rs, "p") / b;
  };
  // 區塊 bootstrap：相鄰幾次預測一起抽，保留時間上的相關性。
  const rand = mulberry32(rows.length * 7919 + 17);
  const stats: number[] = [];
  const blocks = Math.ceil(rows.length / blockSize);
  for (let k = 0; k < resamples; k++) {
    const sample: typeof rows = [];
    for (let b = 0; b < blocks; b++) {
      const start = Math.floor(rand() * (rows.length - blockSize + 1));
      sample.push(...rows.slice(start, start + blockSize));
    }
    stats.push(bssOf(sample.slice(0, rows.length)));
  }
  stats.sort((a, b) => a - b);
  return {
    points: rows.length,
    hitRate: rows.filter((r) => (r.p > 0.5 ? 1 : 0) === r.y).length / rows.length,
    baseHitRate: rows.filter((r) => r.y === 1).length / rows.length,
    brier: brierOf(rows, "p"),
    brierBase: brierOf(rows, "pBase"),
    bss: bssOf(rows),
    bssLow: stats[Math.floor(resamples * 0.025)],
    bssHigh: stats[Math.floor(resamples * 0.975)],
    firstDate: rows[0].date,
    lastDate: rows.at(-1)!.date,
  };
}

export interface Outlook {
  asOf: string;
  horizonDays: number;
  regime: Regime;
  close: number;
  sma200: number;
  vix: number;
  pick: Pick;
  evaluation: Evaluation;
  /** "up"／"down"／"inconclusive"：只有條件機率顯著不同於基準、且滾動驗證勝過基準時才給方向 */
  call: "up" | "down" | "inconclusive";
  reasons: string[];
}

export function buildOutlook(spx: Series, vix: Series): Outlook | null {
  const obs = buildObservations(spx, vix);
  const last = obs.at(-1);
  if (!last?.regime) return null;
  const pick = pickProbability(obs, last.date, last.regime);
  if (!pick) return null;
  const sma = smaSeries(spx.points, 200).at(-1) as number;
  const evaluation = walkForward(obs);
  const reasons: string[] = [];
  if (!pick.distinct) reasons.push("目前條件下的上漲比例，信賴區間包含歷史基準率（或樣本不足），看不出差別");
  if (evaluation.bssLow === null) reasons.push("滾動驗證的預測次數不足 12 次");
  else if (evaluation.bssLow <= 0) reasons.push("滾動驗證中，這套條件機率沒有穩定勝過「永遠用基準率」");
  const conclusive = pick.distinct && evaluation.bssLow !== null && evaluation.bssLow > 0;
  return {
    asOf: last.date,
    horizonDays: HORIZON,
    regime: last.regime,
    close: last.close,
    sma200: sma,
    vix: vix.onOrBefore(last.date)?.close ?? NaN,
    pick,
    evaluation,
    call: !conclusive ? "inconclusive" : pick.p >= 0.5 ? "up" : "down",
    reasons,
  };
}
