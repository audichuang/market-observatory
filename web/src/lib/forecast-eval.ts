// 回測用的評估工具：stationary bootstrap、配對比較、相位平均、虛無分佈。純計算，不碰 D1 與網路。
// 規則出處：docs/forecast.md「事前登記」（G08、L02、L03、L08、配對）。

import { HORIZON, mulberry32, walkForwardRows, type ModelConfig, type Observation, type WalkRow } from "./forecast.ts";

/** 固定種子（不依賴列數）；變體比較與換資料時結果才可重現。 */
export const EVAL_SEED = 20261026;
export const EVAL_DEFAULTS = { meanBlock: 6, resamples: 2000, seed: EVAL_SEED };
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

function sdOf(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
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

export interface BasisSummary {
  basis: string;
  rows: number;
  /** 該 basis 連續出現的段數（相鄰的列同一 basis 算一段） */
  runs: number;
  bss: CI;
  /** 最小可偵測 BSS = 2.8 × BSS 的 bootstrap 標準差；標準差為 0 時 null */
  mde: number | null;
}

export function summarizeByBasis(rows: WalkRow[], opts: BootOpts = {}): BasisSummary[] {
  const by = new Map<string, WalkRow[]>();
  const runs = new Map<string, number>();
  rows.forEach((r, i) => {
    by.set(r.basis, [...(by.get(r.basis) ?? []), r]);
    if (i === 0 || rows[i - 1].basis !== r.basis) runs.set(r.basis, (runs.get(r.basis) ?? 0) + 1);
  });
  return [...by.entries()].map(([basis, rs]) => {
    const bss = bootstrapCI(rs, bssOf, opts);
    return { basis, rows: rs.length, runs: runs.get(basis) ?? 0, bss, mde: bss.sd > 0 ? 2.8 * bss.sd : null };
  });
}

export interface PhaseResult {
  /** 各相位（offset 0..20）的 BSS；該相位列數不足時為 NaN */
  bssByPhase: number[];
  rowsByPhase: WalkRow[][];
  mean: number;
  min: number;
  max: number;
  /** 相位平均 BSS 的 bootstrap 區間 */
  ci: CI;
}

/**
 * 21 個起始相位各自跑不重疊 walk-forward（每個相位只用當天已知的標籤），回傳相位平均 BSS。
 * 區間作法：第 k 個預測在各相位是同一個 21 日週期的第 k 列，所以以「週期序號 k」為共同的時間軸，
 * 每次重抽只抽一組 stationary 索引，套到所有相位（相位彼此保持對齊），再取各相位 BSS 的平均；
 * 週期數取各相位列數的最小值（最多差 1 列）。
 */
export function phaseAveraged(obs: Observation[], cfg: ModelConfig, label: "up", opts: BootOpts & { phases?: number } = {}): PhaseResult {
  const phases = opts.phases ?? PHASES;
  const rowsByPhase = Array.from({ length: phases }, (_, offset) => walkForwardRows(obs, cfg, { offset, label }));
  const bssByPhase = rowsByPhase.map((rs) => (rs.length ? bssOf(rs) : NaN));
  const valid = bssByPhase.filter((x) => !Number.isNaN(x));
  const mean = valid.reduce((a, b) => a + b, 0) / (valid.length || 1);
  const m = Math.min(...rowsByPhase.map((rs) => rs.length));
  const { meanBlock, resamples, seed } = { ...EVAL_DEFAULTS, ...opts };
  const rand = mulberry32(seed);
  const stats: number[] = [];
  if (m > 0) {
    for (let k = 0; k < resamples; k++) {
      const idx = stationaryBootstrapIndices(m, meanBlock, rand);
      let s = 0;
      for (const rs of rowsByPhase) s += bssOf(idx.map((i) => rs[i]));
      stats.push(s / phases);
    }
  }
  const { low, high } = stats.length ? pctInterval(stats) : { low: NaN, high: NaN };
  return {
    bssByPhase,
    rowsByPhase,
    mean,
    min: valid.length ? Math.min(...valid) : NaN,
    max: valid.length ? Math.max(...valid) : NaN,
    ci: { point: mean, low, high, sd: sdOf(stats) },
  };
}

/** L03：同一統計量換 5 個種子重跑，回傳各次的值與標準差（單次結果的 Monte Carlo 標準誤）。 */
export function mcStdErr(fn: (seed: number) => number | null, seeds: number[] = [1, 2, 3, 4, 5]): { values: number[]; mean: number; se: number } {
  const values = seeds.map(fn).filter((x): x is number => x !== null && !Number.isNaN(x));
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  return { values, mean, se: sdOf(values) };
}

/**
 * L08：把有標籤的日子「以區塊為單位」打散順序（區塊長 = b 個 21 日週期，保留標籤的重疊結構），
 * 產生虛無序列；每組各變體跑同一個 walk-forward，取最大 BSS，回傳這些最大值的第 95 百分位。
 * 各變體用同一組置換；種子固定（不依賴列數）。obs 可傳陣列（各變體共用）或依 cfg 建立的函式。
 */
export function nullMaxBss(
  obs: Observation[] | ((cfg: ModelConfig) => Observation[]),
  cfgs: ModelConfig[],
  opts: { N?: number; block?: [number, number]; seed?: number; phases?: number } = {},
): { p95: number; maxes: number[] } {
  const N = opts.N ?? 20;
  const [bMin, bMax] = opts.block ?? [6, 12];
  const rand = mulberry32(opts.seed ?? EVAL_SEED + 8);
  const base = new Map<ModelConfig, Observation[]>(cfgs.map((c) => [c, typeof obs === "function" ? obs(c) : obs]));
  const ref = base.get(cfgs[0])!;
  const labeled = ref.flatMap((o, i) => (o.up === null ? [] : [i]));
  const maxes: number[] = [];
  for (let k = 0; k < N; k++) {
    const len = (bMin + Math.floor(rand() * (bMax - bMin + 1))) * HORIZON;
    const blocks: number[][] = [];
    for (let s = 0; s < labeled.length; s += len) blocks.push(labeled.slice(s, s + len));
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }
    const order = blocks.flat();
    let best = -Infinity;
    for (const cfg of cfgs) {
      const src = base.get(cfg)!;
      const ups = labeled.map((_, n) => src[order[n]].up);
      const permuted = src.map((o) => ({ ...o }));
      labeled.forEach((pos, n) => (permuted[pos].up = ups[n]));
      const b = phaseAveraged(permuted, cfg, "up", { resamples: 0, phases: opts.phases }).mean;
      if (b > best) best = b;
    }
    maxes.push(best);
  }
  const sorted = [...maxes].sort((a, b) => a - b);
  return { p95: sorted[Math.ceil(0.95 * N) - 1], maxes };
}
