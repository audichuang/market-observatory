// 「約 21 個交易日後 S&P 500 是否高於今天」的機率估計。
//
// 研究結論（見 docs/forecast.md）：分析師目標價、策略師目標、廣度、VIX 期限結構對一個月方向都沒有穩定預測力；
// 只有「是否在 200 日線之上」與「VIX ≥ 30」有微弱、樣本少的差異。所以這裡刻意保守：
// - 預設輸出歷史基準率；條件機率只在有效樣本夠、且信賴區間不含基準率時才採用；
// - 用滾動（walk-forward）驗證算 Brier skill score；方向要過 G03 的 cell 閘門，否則標「偵測不到 skill」。
// 所有計算只用「當下已知」的資料：第 t 天的標籤要等到 t+21 天收盤後才算已知。

import { Series, smaSeries } from "./analytics.ts";

export const HORIZON = 21;
export const MIN_EFFECTIVE_N = 30;
/** G04：條件成立的日子至少要分成這麼多段（段與段相隔 ≥ HORIZON 個觀測值），候選條件才可採用。 */
export const MIN_EPISODES = 8;
export const VIX_STRESS = 30;
/** G08：固定種子（不依賴列數）；變體比較與換資料時結果才可重現。 */
export const EVAL_SEED = 20261026;
/** G03 (b)(c)(d) 與 G08 的門檻。 */
export const MIN_CELL_ROWS = 30;
export const MIN_CELL_RUNS = 8;
export const MIN_VALID_REPLICATES = 1900;
export const MDE_FACTOR = 2.8;
/** G08 的 stationary bootstrap 參數（平均區塊長 6 列、2000 次、固定種子）。cell 閘門一律用它。 */
export const G08_BOOTSTRAP = { meanBlock: 6, resamples: 2000, seed: EVAL_SEED };

/** 預設模型的 regime 形狀（App 非可選解碼，欄位不能變）。 */
export type Regime = { aboveSma200: boolean; vixStress: boolean };
/** 一般化的 regime：旗標 id → 是否成立。 */
export type RegimeFlags = Record<string, boolean>;

/** 計算旗標時能看到的當日資料。 */
export interface FlagCtx {
  date: string;
  index: number;
  close: number;
  /** 200 日線；資料不足為 null */
  sma200: number | null;
  /** 當日（或之前最近一天）的 VIX；缺值為 null */
  vix: number | null;
}

export interface FlagDef {
  id: string;
  /** 組成 Pick.basis 的名稱（多個旗標以 + 連接） */
  basisId: string;
  /** 算不出來（資料不足）回 null，該日 regime 即為 null */
  compute: (ctx: FlagCtx) => boolean | null;
  /** 單一旗標的候選在 regime[id] 等於這個值時跳過（沒有資訊量） */
  skipSingleWhen?: boolean;
}

export interface BootstrapCfg {
  kind: "block" | "stationary";
  blockSize: number;
  resamples: number;
  seed?: number;
}

/** 所有模型變化都走這個設定；DEFAULT_MODEL 必須與重構前的行為完全一致。 */
export interface ModelConfig {
  version: string;
  flags: FlagDef[];
  /** 依序嘗試的旗標 id 組合（明確列出，不由旗標順序推導）；全部落空就用基準率 */
  candidates: string[][];
  minEffectiveN: number;
  /** G04：候選條件的最少段數；0 = 不設門檻 */
  minEpisodes: number;
  /** G01：收縮強度 k，p = (k·p_base + n·p_cond)/(k+n)；null = 不收縮（硬切換） */
  shrinkK: number | null;
  /** kind "block"：舊的固定區塊 bootstrap（blockSize = 區塊長，種子依列數）；"stationary"：G08（blockSize = 平均區塊長，種子固定 seed） */
  bootstrap: BootstrapCfg;
  /** D1：早於此日的觀測值 regime 為 null（基準率與所有條件只用此日之後）；SPX 之前的資料只用來暖機 200 日線。null = 用全部歷史 */
  baseWindowStart: string | null;
  /** M5：第 i 天只用日期不早於 spx.points[i−n] 的最近一筆 VIX（至多落後 n 個 SPX 交易日），否則該日 regime 為 null。null = 一直往前找 */
  vixMaxStaleSessions: number | null;
}

export const DEFAULT_MODEL: ModelConfig = {
  version: "2026-10-g03g08",
  flags: [
    { id: "aboveSma200", basisId: "trend", compute: (c) => (c.sma200 === null ? null : c.close > c.sma200) },
    // VIX 一般狀態（<30）幾乎就是全部樣本，沒有資訊量，單獨成候選時跳過。
    { id: "vixStress", basisId: "vix", compute: (c) => (c.vix === null ? null : c.vix >= VIX_STRESS), skipSingleWhen: false },
  ],
  candidates: [["aboveSma200", "vixStress"], ["vixStress"], ["aboveSma200"]],
  minEffectiveN: MIN_EFFECTIVE_N,
  minEpisodes: MIN_EPISODES,
  shrinkK: 40,
  bootstrap: { kind: "stationary", blockSize: G08_BOOTSTRAP.meanBlock, resamples: G08_BOOTSTRAP.resamples, seed: G08_BOOTSTRAP.seed },
  baseWindowStart: "1990-01-02",
  vixMaxStaleSessions: 3,
};

export interface Rate {
  /** 上漲比例 */
  p: number;
  /** 重疊窗口的天數 */
  days: number;
  /** 有效獨立樣本數 ≈ 天數 ÷ 21 */
  nEff: number;
  /** G04：條件成立的日子分成幾段（距上一個成立日 ≥ 21 個觀測值才算新的一段）；基準率只供參考 */
  episodes: number;
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

export function rateOf(ups: number, days: number, episodes: number): Rate | null {
  if (days === 0) return null;
  const p = ups / days;
  const nEff = days / HORIZON;
  return { p, days, nEff, episodes, ...wilson(p, nEff) };
}

export interface Observation {
  date: string;
  close: number;
  regime: RegimeFlags | null;
  /** 21 個交易日後是否較高；還不知道就是 null */
  up: boolean | null;
  /** 這個標籤在哪一天收盤後才知道 */
  knownOn: string | null;
}

/** M5：spx 第 i 天可用的 VIX（當天或之前最近一筆，且不早於 spx.points[i−maxStale].date）；沒有就 null。maxStale 為 null 時不設下限。 */
export function vixAt(spx: Series, vix: Series, i: number, maxStale: number | null): number | null {
  const pts = spx.points;
  const v = vix.onOrBefore(pts[i].date);
  if (!v) return null;
  if (maxStale !== null && v.date < pts[Math.max(0, i - maxStale)].date) return null;
  return v.close;
}

/** 把 SPX 與 VIX 對齊成逐日觀測值；任一旗標算不出來（200 日線不足、VIX 缺值）的日子 regime 為 null。 */
export function buildObservations(spx: Series, vix: Series, cfg: ModelConfig = DEFAULT_MODEL): Observation[] {
  const pts = spx.points;
  const sma = smaSeries(pts, 200);
  return pts.map((p, i) => {
    const ctx: FlagCtx = { date: p.date, index: i, close: p.close, sma200: sma[i], vix: vixAt(spx, vix, i, cfg.vixMaxStaleSessions) };
    let regime: RegimeFlags | null = {};
    for (const f of cfg.flags) {
      if (cfg.baseWindowStart !== null && p.date < cfg.baseWindowStart) {
        regime = null;
        break;
      }
      const x = f.compute(ctx);
      if (x === null) {
        regime = null;
        break;
      }
      regime[f.id] = x;
    }
    const future = pts[i + HORIZON];
    return { date: p.date, close: p.close, regime, up: future ? future.close > p.close : null, knownOn: future?.date ?? null };
  });
}

function matches(r: RegimeFlags, cond: Partial<RegimeFlags>): boolean {
  for (const k in cond) if (cond[k] !== undefined && r[k] !== cond[k]) return false;
  return true;
}

/** 在「asOf 當天收盤後已知」的標籤中，符合條件的上漲比例。 */
export function conditionalRate(obs: Observation[], asOf: string, cond: Partial<RegimeFlags> = {}): Rate | null {
  let ups = 0;
  let days = 0;
  let episodes = 0;
  let prev = -Infinity;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (o.up === null || !o.knownOn || o.knownOn > asOf || !o.regime) continue;
    if (!matches(o.regime, cond)) continue;
    days++;
    if (i - prev >= HORIZON) episodes++;
    prev = i;
    if (o.up) ups++;
  }
  return rateOf(ups, days, episodes);
}

export interface Pick {
  p: number;
  /** 採用的依據 */
  /** "base" 或旗標 basisId 以 + 連接（預設模型：trend+vix／vix／trend） */
  basis: string;
  /** G03：所選候選條件的各旗標及其值（例如 trend+vix(aboveSma200=true,vixStress=false)）；基準率為 "base"。驗證以 cell 為單位 */
  cell: string;
  base: Rate;
  conditional: Rate | null;
  /** 條件機率的區間不含基準率、且有效樣本夠，才算「條件有差」 */
  distinct: boolean;
  /** G01：條件機率的權重 n/(k+n)；基準率或未啟用收縮（shrinkK null）為 0 */
  shrinkWeight: number;
}

/**
 * 只用 asOf 當天已知的資料，替 regime 挑一個機率：
 * 依 cfg.candidates 的順序試（預設先最細的 200 日線 × VIX，再單一條件），有效樣本或段數（G04）不足就往下，再不夠就用基準率。
 */
export function pickProbability(obs: Observation[], asOf: string, regime: RegimeFlags, cfg: ModelConfig = DEFAULT_MODEL): Pick | null {
  const base = conditionalRate(obs, asOf);
  if (!base) return null;
  const flagOf = new Map(cfg.flags.map((f) => [f.id, f]));
  for (const ids of cfg.candidates) {
    const defs = ids.map((id) => flagOf.get(id)!);
    // 單一旗標的候選若處於「沒有資訊量」的狀態就跳過。
    if (defs.length === 1 && defs[0].skipSingleWhen !== undefined && regime[defs[0].id] === defs[0].skipSingleWhen) continue;
    const cond: RegimeFlags = {};
    for (const id of ids) cond[id] = regime[id];
    const r = conditionalRate(obs, asOf, cond);
    if (!r || r.nEff < cfg.minEffectiveN || r.episodes < cfg.minEpisodes) continue;
    const basis = defs.map((f) => f.basisId).join("+");
    const distinct = base.p < r.low || base.p > r.high;
    const cell = `${basis}(${ids.map((id) => `${id}=${regime[id]}`).join(",")})`;
    // 區間包含基準率就看不出差別：輸出基準率，條件機率只留著給頁面對照。
    // G01：shrinkK 不為 null 時一律收縮（取代 distinct 的硬切換）；distinct 仍照算，供 G03 使用。
    if (cfg.shrinkK !== null) {
      const w = r.nEff / (cfg.shrinkK + r.nEff);
      return { p: (1 - w) * base.p + w * r.p, basis, cell, base, conditional: r, distinct, shrinkWeight: w };
    }
    return { p: distinct ? r.p : base.p, basis, cell, base, conditional: r, distinct, shrinkWeight: 0 };
  }
  return { p: base.p, basis: "base", cell: "base", base, conditional: null, distinct: false, shrinkWeight: 0 };
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
  /** G08：最小可偵測 BSS = 2.8 × BSS 的 bootstrap 標準差；標準差為 0 時 null */
  mde: number | null;
  /** G03：以 cell 為單位的驗證（offset 0 walk-forward 列） */
  byCell: CellEval[];
}

export interface CellEval {
  cell: string;
  rows: number;
  /** 列序列中，相鄰列都屬於該 cell 的連續區間數 */
  runs: number;
  bss: number;
  /** 對全部列做 stationary bootstrap，每次只用屬於該 cell 的列；空重抽跳過，有效重抽 < MIN_VALID_REPLICATES 時為 null */
  bssLow: number | null;
  bssHigh: number | null;
  mde: number | null;
  validReplicates: number;
}

/** 決定性的偽亂數（同一份資料每次 bootstrap 結果一樣）。 */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface WalkRow {
  date: string;
  basis: string;
  p: number;
  pBase: number;
  y: number;
  distinct: boolean;
  /** G03：所選候選條件的 cell（同 Pick.cell） */
  cell: string;
}

/**
 * 滾動驗證的逐點預測：從有 burnInDays 天已知標籤之後開始，每 21 個交易日預測一次（不重疊），
 * 每次只用當天已知的標籤估機率，再跟實際結果比。
 * 給 opts.dates 時只算這些日期（略過暖機與間隔限制，由呼叫端決定；標籤未知或 regime 為 null 的日子仍然不算）。
 */
export function walkForwardRows(obs: Observation[], cfg: ModelConfig = DEFAULT_MODEL, opts: { dates?: string[]; label?: "up"; burnInDays?: number } = {}): WalkRow[] {
  const burnInDays = opts.burnInDays ?? 504;
  const only = opts.dates ? new Set(opts.dates) : null;
  const rows: WalkRow[] = [];
  // 第 j 天的標籤在第 j+21 天收盤後已知，所以到第 i 天為止已知的標籤，就是 i−21 天以前、有 regime 的那些。
  let known = 0;
  let lastRow = -Infinity;
  for (let i = 0; i < obs.length; i++) {
    const j = i - HORIZON;
    if (j >= 0 && obs[j].regime && obs[j].up !== null) known++;
    const o = obs[i];
    if (!o.regime || o.up === null) continue;
    if (only) {
      if (!only.has(o.date)) continue;
    } else {
      if (known < burnInDays) continue;
      if (i - lastRow < HORIZON) continue;
      lastRow = i;
    }
    const pick = pickProbability(obs, o.date, o.regime, cfg);
    if (!pick) continue;
    rows.push({ date: o.date, basis: pick.basis, p: pick.p, pBase: pick.base.p, y: o.up ? 1 : 0, distinct: pick.distinct, cell: pick.cell });
  }
  return rows;
}

/** Politis–Romano stationary bootstrap：每步以 1/meanBlock 的機率換新起點，否則接續下一列（環狀）。 */
export function stationaryBootstrapIndices(n: number, meanBlock: number, rand: () => number): number[] {
  const out: number[] = new Array(n);
  if (n === 0) return out;
  const q = 1 / Math.max(1, meanBlock);
  let cur = Math.floor(rand() * n);
  for (let i = 0; i < n; i++) {
    if (i > 0) cur = rand() < q ? Math.floor(rand() * n) : (cur + 1) % n;
    out[i] = cur;
  }
  return out;
}

export function sdOf(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

const mdeOf = (sd: number): number | null => (sd > 0 ? MDE_FACTOR * sd : null);

/**
 * G03 (d)：以 cell 為單位的驗證。對全部列做 G08 stationary bootstrap（所有 cell 共用同一批重抽），
 * 每次重抽只用屬於該 cell 的列算 BSS；該 cell 沒有任何列的重抽跳過；有效重抽 < MIN_VALID_REPLICATES 時 bssLow／bssHigh 為 null。
 * runs 看 rows 的原始順序（相鄰列都屬於該 cell 的連續區間）。
 */
export function cellEvaluations(rows: WalkRow[], boot: { meanBlock: number; resamples: number; seed: number } = G08_BOOTSTRAP): CellEval[] {
  const names = [...new Set(rows.map((r) => r.cell))];
  const id = new Map(names.map((c, i) => [c, i]));
  const ids = rows.map((r) => id.get(r.cell)!);
  const sq = rows.map((r) => (r.p - r.y) ** 2);
  const sqBase = rows.map((r) => (r.pBase - r.y) ** 2);
  const runs = names.map(() => 0);
  ids.forEach((c, i) => {
    if (i === 0 || ids[i - 1] !== c) runs[c]++;
  });
  const stats: number[][] = names.map(() => []);
  const rand = mulberry32(boot.seed);
  const sp = new Array<number>(names.length);
  const sb = new Array<number>(names.length);
  const cnt = new Array<number>(names.length);
  for (let k = 0; k < boot.resamples && rows.length > 0; k++) {
    sp.fill(0);
    sb.fill(0);
    cnt.fill(0);
    for (const i of stationaryBootstrapIndices(rows.length, boot.meanBlock, rand)) {
      const c = ids[i];
      sp[c] += sq[i];
      sb[c] += sqBase[i];
      cnt[c]++;
    }
    for (let c = 0; c < names.length; c++) {
      if (cnt[c] === 0) continue;
      const b = sb[c] / cnt[c];
      stats[c].push(b === 0 ? 0 : 1 - sp[c] / cnt[c] / b);
    }
  }
  return names.map((cell, c) => {
    const mine = rows.filter((_, i) => ids[i] === c);
    const st = stats[c].sort((x, y) => x - y);
    const ok = st.length >= MIN_VALID_REPLICATES;
    return {
      cell,
      rows: mine.length,
      runs: runs[c],
      bss: bssOfRows(mine),
      bssLow: ok ? st[Math.floor(st.length * 0.025)] : null,
      bssHigh: ok ? st[Math.floor(st.length * 0.975)] : null,
      mde: mdeOf(sdOf(st)),
      validReplicates: st.length,
    };
  });
}

const brierOfRows = (rs: WalkRow[], key: "p" | "pBase") => rs.reduce((a, r) => a + (r[key] - r.y) ** 2, 0) / rs.length;
function bssOfRows(rs: WalkRow[]): number {
  const b = brierOfRows(rs, "pBase");
  return b === 0 ? 0 : 1 - brierOfRows(rs, "p") / b;
}

/** 由逐點預測算命中率、Brier、BSS 與 bootstrap 區間（cfg.bootstrap.kind 決定用舊區塊法或 G08 stationary）。 */
export function evaluateRows(rows: WalkRow[], bootstrap: BootstrapCfg = DEFAULT_MODEL.bootstrap): Evaluation {
  const { blockSize, resamples } = bootstrap;
  const empty: Evaluation = { points: rows.length, hitRate: null, baseHitRate: null, brier: null, brierBase: null, bss: null, bssLow: null, bssHigh: null, firstDate: null, lastDate: null, mde: null, byCell: [] };
  if (rows.length < 12) return empty;
  const stats: number[] = [];
  if (bootstrap.kind === "stationary") {
    const rand = mulberry32(bootstrap.seed ?? EVAL_SEED);
    for (let k = 0; k < resamples; k++) stats.push(bssOfRows(stationaryBootstrapIndices(rows.length, blockSize, rand).map((i) => rows[i])));
  } else {
    // 舊的區塊 bootstrap：相鄰幾次預測一起抽，保留時間上的相關性（LEGACY 特徵測試用，行為不可變）。
    const rand = mulberry32(rows.length * 7919 + 17);
    const blocks = Math.ceil(rows.length / blockSize);
    for (let k = 0; k < resamples; k++) {
      const sample: WalkRow[] = [];
      for (let b = 0; b < blocks; b++) {
        const start = Math.floor(rand() * (rows.length - blockSize + 1));
        sample.push(...rows.slice(start, start + blockSize));
      }
      stats.push(bssOfRows(sample.slice(0, rows.length)));
    }
  }
  const sd = sdOf(stats);
  stats.sort((a, b) => a - b);
  return {
    points: rows.length,
    hitRate: rows.filter((r) => (r.p > 0.5 ? 1 : 0) === r.y).length / rows.length,
    baseHitRate: rows.filter((r) => r.y === 1).length / rows.length,
    brier: brierOfRows(rows, "p"),
    brierBase: brierOfRows(rows, "pBase"),
    bss: bssOfRows(rows),
    bssLow: stats[Math.floor(resamples * 0.025)],
    bssHigh: stats[Math.floor(resamples * 0.975)],
    firstDate: rows[0].date,
    lastDate: rows.at(-1)!.date,
    mde: mdeOf(sd),
    byCell: cellEvaluations(rows),
  };
}

/** 滾動驗證 = 逐點預測 + 評估。 */
export function walkForward(obs: Observation[], burnInDays = 504, blockSize?: number, resamples?: number, cfg: ModelConfig = DEFAULT_MODEL): Evaluation {
  return evaluateRows(walkForwardRows(obs, cfg, { burnInDays }), { ...cfg.bootstrap, blockSize: blockSize ?? cfg.bootstrap.blockSize, resamples: resamples ?? cfg.bootstrap.resamples });
}

export interface Outlook {
  modelVersion: string;
  asOf: string;
  horizonDays: number;
  regime: RegimeFlags;
  close: number;
  sma200: number;
  vix: number;
  /** 第一個有 regime 的日期（樣本起點；受 baseWindowStart 與暖機影響） */
  historyStart: string | null;
  pick: Pick;
  evaluation: Evaluation;
  /** G03：今天所選 cell 的閘門（列數 ≥ 30、段數 ≥ 8、bssLow > 0）；call 另外還要 pick.distinct */
  cellGate: CellGate;
  /** "up"／"down"／"inconclusive"：只有條件機率顯著不同於基準、且滾動驗證勝過基準時才給方向 */
  call: "up" | "down" | "inconclusive";
  reasons: string[];
}

export interface CellGate {
  rows: number;
  runs: number;
  bssLow: number | null;
  validReplicates: number;
  passed: boolean;
}

/** G03 (b)(c)(d)：由 cellEvaluations 的結果取出指定 cell 的閘門；cell 在列中不存在則全部不過。 */
export function cellGateOf(evals: CellEval[], cell: string): CellGate {
  const e = evals.find((x) => x.cell === cell);
  if (!e) return { rows: 0, runs: 0, bssLow: null, validReplicates: 0, passed: false };
  const passed = e.rows >= MIN_CELL_ROWS && e.runs >= MIN_CELL_RUNS && e.bssLow !== null && e.bssLow > 0;
  return { rows: e.rows, runs: e.runs, bssLow: e.bssLow, validReplicates: e.validReplicates, passed };
}

/** G03 方向閘門：pick.distinct 且該 cell 通過 (b)(c)(d) 才給方向（buildOutlook 與回測腳本共用）。符號沿用 p ≥ 0.5（L01 的相對基準語意之後再改）。 */
export function callOf(pick: { p: number; distinct: boolean }, gate: { passed: boolean }): "up" | "down" | "inconclusive" {
  const conclusive = pick.distinct && gate.passed;
  return !conclusive ? "inconclusive" : pick.p >= 0.5 ? "up" : "down";
}

export function buildOutlook(spx: Series, vix: Series, cfg: ModelConfig = DEFAULT_MODEL): Outlook | null {
  const obs = buildObservations(spx, vix, cfg);
  const last = obs.at(-1);
  if (!last?.regime) return null;
  const pick = pickProbability(obs, last.date, last.regime, cfg);
  if (!pick) return null;
  const sma = smaSeries(spx.points, 200).at(-1) as number;
  const evaluation = walkForward(obs, 504, undefined, undefined, cfg);
  const cellGate = cellGateOf(evaluation.byCell, pick.cell);
  const reasons: string[] = [];
  if (!pick.distinct) reasons.push("目前條件下的上漲比例，信賴區間包含歷史基準率（或樣本不足），看不出差別");
  if (evaluation.bssLow === null) reasons.push("滾動驗證的預測次數不足 12 次");
  else if (evaluation.bssLow <= 0) reasons.push("滾動驗證中，這套條件機率沒有穩定勝過「永遠用基準率」");
  if (pick.distinct) {
    if (cellGate.rows < MIN_CELL_ROWS) reasons.push(`目前這個條件組合在滾動驗證中只有 ${cellGate.rows} 列（需要 ${MIN_CELL_ROWS}），無法驗證`);
    else if (cellGate.runs < MIN_CELL_RUNS) reasons.push(`目前這個條件組合在滾動驗證中只分成 ${cellGate.runs} 段連續區間（需要 ${MIN_CELL_RUNS}）`);
    else if (cellGate.bssLow === null) reasons.push("目前這個條件組合的有效重抽次數不足，算不出 BSS 下界");
    else if (cellGate.bssLow <= 0) reasons.push("目前這個條件組合在滾動驗證中沒有穩定勝過「永遠用基準率」");
  }
  const call = callOf(pick, cellGate);
  return {
    modelVersion: cfg.version,
    asOf: last.date,
    horizonDays: HORIZON,
    regime: last.regime,
    close: last.close,
    sma200: sma,
    vix: vixAt(spx, vix, obs.length - 1, cfg.vixMaxStaleSessions) ?? NaN,
    historyStart: obs.find((o) => o.regime)?.date ?? null,
    pick,
    evaluation,
    cellGate,
    call,
    reasons,
  };
}
