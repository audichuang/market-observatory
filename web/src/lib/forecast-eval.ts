// 回測用的評估工具：stationary bootstrap、配對比較、相位平均、虛無分佈。純計算，不碰 D1 與網路。
// 規則出處：docs/forecast.md「事前登記」（G08、L02、L03、L08、配對）。

import { EVAL_SEED, G08_BOOTSTRAP, HORIZON, callOf, cellEvaluations, cellGateOf, mulberry32, sdOf, stationaryBootstrapIndices, labelOf, walkForwardRows, type Label, type ModelConfig, type Observation, type WalkRow } from "./forecast.ts";

// 評估用的 bootstrap 原語（stationary bootstrap、固定種子）定義在 forecast.ts（正式版 G08 與回測共用），這裡再匯出。
export { EVAL_SEED, stationaryBootstrapIndices };

export const EVAL_DEFAULTS = G08_BOOTSTRAP;
export const PHASES = 21;

export interface BootOpts {
  meanBlock?: number;
  resamples?: number;
  seed?: number;
}

export interface CI {
  point: number;
  low: number;
  high: number;
  sd: number;
}

function pctInterval(stats: number[]): { low: number; high: number } {
  const s = [...stats].sort((a, b) => a - b);
  return { low: s[Math.floor(s.length * 0.025)], high: s[Math.floor(s.length * 0.975)] };
}

/** 對任意統計量做 stationary bootstrap；95% 百分位區間。 */
export function bootstrapCI<T>(rows: T[], stat: (rs: T[]) => number, opts: BootOpts = {}): CI {
  const { meanBlock, resamples, seed } = { ...EVAL_DEFAULTS, ...opts };
  const point = stat(rows);
  if (rows.length === 0) return { point, low: NaN, high: NaN, sd: NaN };
  const rand = mulberry32(seed);
  const stats: number[] = [];
  for (let k = 0; k < resamples; k++) stats.push(stat(stationaryBootstrapIndices(rows.length, meanBlock, rand).map((i) => rows[i])));
  return { point, ...pctInterval(stats), sd: sdOf(stats) };
}

export const brierOf = (rs: WalkRow[], key: "p" | "pBase" = "p") => (rs.length ? rs.reduce((a, r) => a + (r[key] - r.y) ** 2, 0) / rs.length : NaN);

/** Brier skill score = 1 − Brier ÷ Brier(基準)；基準 Brier 為 0 時回 0（與 evaluateRows 一致）。 */
export function bssOf(rs: WalkRow[]): number {
  const b = brierOf(rs, "pBase");
  return b === 0 ? 0 : 1 - brierOf(rs, "p") / b;
}

export interface PairedDiff extends CI {
  /** 配對的列數 */
  n: number;
  /** 因為日期不在兩邊共有而被丟掉的日期數（A 獨有 + B 獨有） */
  dropped: number;
}

/** 依日期配對，bootstrap mean(BrierA − BrierB)；> 0 表示 A 較差。A、B 都用自己的 p（pBase 不參與）。 */
export function pairedBrierDiff(rowsA: WalkRow[], rowsB: WalkRow[], opts: BootOpts = {}): PairedDiff {
  const b = new Map(rowsB.map((r) => [r.date, r]));
  const diffs: number[] = [];
  let shared = 0;
  for (const a of rowsA) {
    const o = b.get(a.date);
    if (!o) continue;
    shared++;
    diffs.push((a.p - a.y) ** 2 - (o.p - o.y) ** 2);
  }
  const dropped = rowsA.length - shared + (rowsB.length - shared);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return { ...bootstrapCI(diffs, mean, opts), n: shared, dropped };
}

export interface CellSummary {
  cell: string;
  rows: number;
  /** offset 0 的列序列中，相鄰列都屬於該 cell 的連續區間數 */
  runs: number;
  bss: CI;
  /** 最小可偵測 BSS = 2.8 × BSS 的 bootstrap 標準差；標準差為 0 時 null */
  mde: number | null;
}

/**
 * 以 cell（basis + 旗標值）為單位的摘要：對全部列做 stationary bootstrap，
 * 每次重抽只用屬於該 cell 的列算 BSS（G03(d)）；runs 看 rows（offset 0 序列）的原始順序。
 */
export function summarizeByCell(rows: WalkRow[], cellOf: (r: WalkRow) => string, opts: BootOpts = {}): CellSummary[] {
  const { meanBlock, resamples, seed } = { ...EVAL_DEFAULTS, ...opts };
  const keys = rows.map(cellOf);
  const cells = [...new Set(keys)];
  const runs = new Map<string, number>();
  keys.forEach((k, i) => {
    if (i === 0 || keys[i - 1] !== k) runs.set(k, (runs.get(k) ?? 0) + 1);
  });
  const rand = mulberry32(seed);
  const stats = new Map<string, number[]>(cells.map((c) => [c, []]));
  for (let r = 0; r < resamples; r++) {
    const idx = stationaryBootstrapIndices(rows.length, meanBlock, rand);
    const by = new Map<string, WalkRow[]>();
    for (const i of idx) {
      const k = keys[i];
      if (!by.has(k)) by.set(k, []);
      by.get(k)!.push(rows[i]);
    }
    for (const [k, rs] of by) stats.get(k)!.push(bssOf(rs));
  }
  return cells.map((cell) => {
    const mine = rows.filter((_, i) => keys[i] === cell);
    const st = stats.get(cell)!;
    const { low, high } = st.length ? pctInterval(st) : { low: NaN, high: NaN };
    const sd = sdOf(st);
    return { cell, rows: mine.length, runs: runs.get(cell) ?? 0, bss: { point: bssOf(mine), low, high, sd }, mde: sd > 0 ? 2.8 * sd : null };
  });
}

/** 配對比較前：兩邊 regime 都不為 null 的日子才保留（訓練樣本取交集）。 */
export function intersectRegimes(a: Observation[], b: Observation[]): [Observation[], Observation[]] {
  const cut = (xs: Observation[], ys: Observation[]) => xs.map((o, i) => (o.regime && !ys[i].regime ? { ...o, regime: null } : o));
  return [cut(a, b), cut(b, a)];
}

type Cells = (WalkRow | null)[][];

/**
 * 固定的交易日格點：s = 參考模型第一個「已知標籤 ≥ burnIn」的日子；相位 o、第 k 格 → 索引 s + o + 21k。
 * 格點不因 regime 為 null 而位移；缺的格就是缺。
 */
export function phaseGrid(refObs: Observation[], burnInDays = 504, phases = PHASES): number[][] {
  let known = 0;
  let s = -1;
  for (let i = 0; i < refObs.length; i++) {
    const j = i - HORIZON;
    if (j >= 0 && refObs[j].regime && refObs[j].up !== null) known++;
    if (known >= burnInDays) {
      s = i;
      break;
    }
  }
  return Array.from({ length: phases }, (_, o) => {
    const idx: number[] = [];
    if (s >= 0) for (let i = s + o; i < refObs.length; i += HORIZON) idx.push(i);
    return idx;
  });
}

/** 在格點上跑 walk-forward（dates 選項）；回傳 [相位][格] 的列，缺的格是 null。 */
export function phaseCells(obs: Observation[], cfg: ModelConfig, grid: number[][], label: Label): Cells {
  return grid.map((idx) => {
    const rows = walkForwardRows(obs, cfg, { dates: idx.map((i) => obs[i].date), label });
    const by = new Map(rows.map((r) => [r.date, r]));
    return idx.map((i) => by.get(obs[i].date) ?? null);
  });
}

export interface PhaseResult {
  bssByPhase: number[];
  /** 各相位實際有列的格（供檢視；不是用來算點估計的子集） */
  rowsByPhase: WalkRow[][];
  mean: number;
  min: number;
  max: number;
  /** 相位平均 BSS 的 cycle bootstrap 區間（點估計與每次重抽用同一批格） */
  ci: CI;
  cycles: { total: number; used: number; dropped: number };
}

/**
 * 相位平均與區間。格序號 k 是各相位對齊的鍵：只用「所有相位（配對時含兩個變體）都有列」的格，
 * 點估計與每次重抽都用同一批格；每次重抽抽一組 stationary 索引，套到所有相位，各相位算 BSS 再平均。
 * 單一變體：BSS = 1 − Brier(p)/Brier(pBase)；有 cellsB 時是配對 BSS = 1 − Brier(A)/Brier(B)；
 * metric = "brierDiff"（需 cellsB）時各相位的統計量改為 Brier(A) − Brier(B)（> 0 表示 A 較差）。
 */
export function phaseAverageFromCells(cellsA: Cells, opts: BootOpts & { cellsB?: Cells; metric?: "bss" | "brierDiff" } = {}): PhaseResult {
  const { meanBlock, resamples, seed } = { ...EVAL_DEFAULTS, ...opts };
  const B = opts.cellsB;
  const total = Math.max(...cellsA.map((c) => c.length));
  const keep: number[] = [];
  for (let k = 0; k < total; k++) if (cellsA.every((c) => c[k]) && (!B || B.every((c) => c[k]))) keep.push(k);
  const sq = (r: WalkRow) => (r.p - r.y) ** 2;
  const phaseStat = (o: number, ks: number[]): number => {
    const a = ks.map((k) => cellsA[o][k]!);
    if (!B) return bssOf(a);
    const bb = ks.map((k) => B[o][k]!);
    if (opts.metric === "brierDiff") return (a.reduce((s, r) => s + sq(r), 0) - bb.reduce((s, r) => s + sq(r), 0)) / ks.length;
    const den = bb.reduce((s, r) => s + sq(r), 0);
    return den === 0 ? 0 : 1 - a.reduce((s, r) => s + sq(r), 0) / den;
  };
  const avg = (ks: number[]) => cellsA.reduce((s, _, o) => s + phaseStat(o, ks), 0) / cellsA.length;
  const rowsByPhase = cellsA.map((c) => c.filter((r): r is WalkRow => r !== null));
  const cycles = { total, used: keep.length, dropped: total - keep.length };
  if (keep.length === 0) return { bssByPhase: cellsA.map(() => NaN), rowsByPhase, mean: NaN, min: NaN, max: NaN, ci: { point: NaN, low: NaN, high: NaN, sd: NaN }, cycles };
  const bssByPhase = cellsA.map((_, o) => phaseStat(o, keep));
  const mean = avg(keep);
  const rand = mulberry32(seed);
  const stats: number[] = [];
  for (let r = 0; r < resamples; r++) stats.push(avg(stationaryBootstrapIndices(keep.length, meanBlock, rand).map((i) => keep[i])));
  const { low, high } = stats.length ? pctInterval(stats) : { low: NaN, high: NaN };
  return { bssByPhase, rowsByPhase, mean, min: Math.min(...bssByPhase), max: Math.max(...bssByPhase), ci: { point: mean, low, high, sd: sdOf(stats) }, cycles };
}

export function phaseAveraged(obs: Observation[], cfg: ModelConfig, label: Label, opts: BootOpts & { phases?: number; grid?: number[][] } = {}): PhaseResult {
  const grid = opts.grid ?? phaseGrid(obs, 504, opts.phases);
  return phaseAverageFromCells(phaseCells(obs, cfg, grid, label), opts);
}

/**
 * 配對的相位平均 BSS（候選 vs 參考）：訓練樣本取兩者 regime 的交集，
 * 一律在參考變體的格點上評分；回報整格被捨去的格數（任一方缺列）。
 */
export function pairedPhaseAveraged(refObs: Observation[], candObs: Observation[], refCfg: ModelConfig, candCfg: ModelConfig, opts: BootOpts & { phases?: number; label?: Label } = {}): PhaseResult {
  const [r, c] = intersectRegimes(refObs, candObs);
  const grid = phaseGrid(r, 504, opts.phases);
  const label = opts.label ?? "up";
  return phaseAverageFromCells(phaseCells(c, candCfg, grid, label), { ...opts, cellsB: phaseCells(r, refCfg, grid, label) });
}

/**
 * 配對的相位平均 Brier 差（候選 − 參考）：與 pairedPhaseAveraged 同一組交集、格點與 cycle bootstrap，
 * 統計量改為各相位 Brier(候選) − Brier(參考) 再取平均；> 0 表示候選較差。
 */
export function pairedBrierDiffPhase(refObs: Observation[], candObs: Observation[], refCfg: ModelConfig, candCfg: ModelConfig, opts: BootOpts & { phases?: number; label?: Label } = {}): PhaseResult {
  const [r, c] = intersectRegimes(refObs, candObs);
  const grid = phaseGrid(r, 504, opts.phases);
  const label = opts.label ?? "up";
  return phaseAverageFromCells(phaseCells(c, candCfg, grid, label), { ...opts, cellsB: phaseCells(r, refCfg, grid, label), metric: "brierDiff" });
}

/** L03：配對 Brier 差下界以外，報告差的 CI 下界在種子 1..5 下的 MC 標準誤（不除以 √5）。 */
export function pairedBrierDiffMcStdErr(refObs: Observation[], candObs: Observation[], refCfg: ModelConfig, candCfg: ModelConfig, opts: BootOpts & { phases?: number; label?: Label; seeds?: number[] } = {}): { values: number[]; mean: number; se: number } {
  const [r, c] = intersectRegimes(refObs, candObs);
  const grid = phaseGrid(r, 504, opts.phases);
  const label = opts.label ?? "up";
  const cellsA = phaseCells(c, candCfg, grid, label);
  const cellsB = phaseCells(r, refCfg, grid, label);
  return mcStdErr((seed) => phaseAverageFromCells(cellsA, { ...opts, seed, cellsB, metric: "brierDiff" }).ci.low, opts.seeds);
}

/**
 * 方向計數的 point-in-time 閘門（G03）：第 i 列只用 knownOn ≤ 該列日期的列，
 * 在這些列上算該列 cell 的列數、段數與 bssLow（同正式版的 cellEvaluations），再交給 callOf。
 * 該列 pick 不 distinct 時一定是 inconclusive，不必跑 bootstrap。
 */
export function pointInTimeCalls(rows: WalkRow[], knownOn: Map<string, string | null>): ("up" | "down" | "inconclusive")[] {
  return rows.map((r) => {
    if (!r.distinct) return "inconclusive";
    const prior = rows.filter((x) => {
      const k = knownOn.get(x.date);
      return k !== null && k !== undefined && k <= r.date;
    });
    return callOf(r, cellGateOf(cellEvaluations(prior), r.cell));
  });
}

/** L03：以種子 1..5 各跑一次，回傳各次的值與標準差（單次結果的 Monte Carlo 標準誤，不除以 √5）。 */
export function mcStdErr(fn: (seed: number) => number | null, seeds: number[] = [1, 2, 3, 4, 5]): { values: number[]; mean: number; se: number } {
  const values = seeds.map(fn).filter((x): x is number => x !== null && !Number.isNaN(x));
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  return { values, mean, se: sdOf(values) };
}

/**
 * L03 對「決策用下界」的 MC 標準誤：配對（候選 vs 參考）相位平均 BSS 的下界，
 * 在同一組交集後觀測與同一組格點上，用種子 1..5 各跑一次 cycle bootstrap，回傳 5 個下界的標準差（不除以 √5）。
 */
export function pairedMcStdErr(refObs: Observation[], candObs: Observation[], refCfg: ModelConfig, candCfg: ModelConfig, opts: BootOpts & { phases?: number; label?: Label; seeds?: number[] } = {}): { values: number[]; mean: number; se: number } {
  const [r, c] = intersectRegimes(refObs, candObs);
  const grid = phaseGrid(r, 504, opts.phases);
  const label = opts.label ?? "up";
  const cellsA = phaseCells(c, candCfg, grid, label);
  const cellsB = phaseCells(r, refCfg, grid, label);
  return mcStdErr((seed) => phaseAverageFromCells(cellsA, { ...opts, seed, cellsB }).ci.low, opts.seeds);
}

/**
 * L08 虛無分佈：第 j 組（j = 1..N）用種子 EVAL_SEED + j；區塊長 = 21 × b 個交易日，b 由該種子在 6..12 均勻抽出；
 * 把 firstDate 起每日有標籤的 `up` 以區塊置換（regime 與 knownOn 不動，候選與參考用同一組置換），
 * 再算相位平均配對 BSS（候選 vs 參考）。門檻 = 各組的最大值。
 */
export function nullPairedBss(
  refObs: Observation[],
  candObs: Observation[],
  refCfg: ModelConfig,
  candCfg: ModelConfig,
  opts: { N?: number; firstDate?: string; phases?: number; label?: Label } = {},
): { values: number[]; threshold: number } {
  const N = opts.N ?? 20;
  const label = opts.label ?? "up";
  const firstDate = opts.firstDate ?? "1990-01-02";
  const [r0, c0] = intersectRegimes(refObs, candObs);
  const grid = phaseGrid(r0, 504, opts.phases);
  const labeled = r0.flatMap((o, i) => (o.date >= firstDate && labelOf(o, label) !== null ? [i] : []));
  const values: number[] = [];
  for (let j = 1; j <= N; j++) {
    const seed = EVAL_SEED + j;
    const rand = mulberry32(seed);
    const len = (6 + Math.floor(rand() * 7)) * HORIZON;
    const blocks: number[][] = [];
    for (let s = 0; s < labeled.length; s += len) blocks.push(labeled.slice(s, s + len));
    for (let i = blocks.length - 1; i > 0; i--) {
      const k = Math.floor(rand() * (i + 1));
      [blocks[i], blocks[k]] = [blocks[k], blocks[i]];
    }
    const order = blocks.flat();
    const apply = (obs: Observation[]) => {
      const out = obs.map((o) => ({ ...o }));
      labeled.forEach((pos, n) => {
        if (label === "up") out[pos].up = obs[order[n]].up;
        else out[pos].dd5 = obs[order[n]].dd5;
      });
      return out;
    };
    const r = apply(r0);
    const c = apply(c0);
    values.push(phaseAverageFromCells(phaseCells(c, candCfg, grid, label), { resamples: 0, cellsB: phaseCells(r, refCfg, grid, label) }).mean);
  }
  return { values, threshold: Math.max(...values) };
}

/**
 * Permutation p-value against the L08 null draws: p = (1 + #{null >= observed}) / (N + 1).
 * Ties count against the candidate (>=). With N = 199: p <= 0.025 iff exceed <= 4; p <= 0.045 iff exceed <= 8.
 * A NaN observed value or null draw would silently compare false and shrink p, so p is NaN then
 * (registered rule: a statistic that cannot be computed is a rejection).
 */
export function permutationP(values: number[], observed: number): { p: number; exceed: number; n: number } {
  if (Number.isNaN(observed) || values.some(Number.isNaN)) return { p: NaN, exceed: NaN, n: values.length };
  const exceed = values.filter((v) => v >= observed).length;
  return { p: (1 + exceed) / (values.length + 1), exceed, n: values.length };
}
