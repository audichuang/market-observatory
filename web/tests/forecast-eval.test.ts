import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MODEL, HORIZON, mulberry32, walkForwardRows, type ModelConfig, type Observation, type WalkRow } from "../src/lib/forecast.ts";
import { EVAL_SEED, bootstrapCI, bssOf, intersectRegimes, nullPairedBss, pairedBrierDiff, pairedBrierDiffMcStdErr, pairedBrierDiffPhase, pairedMcStdErr, pairedPhaseAveraged, permutationP, phaseAveraged, phaseAverageFromCells, phaseGrid, pointInTimeCalls, stationaryBootstrapIndices, summarizeByCell } from "../src/lib/forecast-eval.ts";

const day = (i: number) => new Date(Date.UTC(2015, 0, 1) + i * 864e5).toISOString().slice(0, 10);
const mkRows = (n: number, f: (i: number) => { p: number; pBase: number; y: number }): WalkRow[] =>
  Array.from({ length: n }, (_, i) => ({ date: day(i * 21), basis: "base", cell: "base", distinct: false, ...f(i) }));

test("stationary bootstrap：固定種子索引相同，平均區塊長約等於 meanBlock", () => {
  const a = stationaryBootstrapIndices(200, 6, mulberry32(7));
  const b = stationaryBootstrapIndices(200, 6, mulberry32(7));
  assert.deepEqual(a, b);
  const idx = stationaryBootstrapIndices(60000, 6, mulberry32(11));
  let blocks = 1;
  for (let i = 1; i < idx.length; i++) if (idx[i] !== (idx[i - 1] + 1) % 60000) blocks++;
  const mean = idx.length / blocks;
  assert.ok(Math.abs(mean - 6) < 0.4, `平均區塊長 ${mean}`);
});

test("pairedBrierDiff：相同列 → 差 0、區間 [0,0]", () => {
  const rows = mkRows(60, (i) => ({ p: 0.6, pBase: 0.6, y: i % 3 ? 1 : 0 }));
  const d = pairedBrierDiff(rows, rows);
  assert.equal(d.point, 0);
  assert.equal(d.low, 0);
  assert.equal(d.high, 0);
  assert.equal(d.dropped, 0);
  assert.equal(d.n, 60);
});

test("pairedBrierDiff：被支配的變體（A 恆較差）區間整段 > 0", () => {
  const good = mkRows(80, (i) => ({ p: i % 2 ? 0.9 : 0.1, pBase: 0.5, y: i % 2 }));
  const bad = good.map((r) => ({ ...r, p: 0.5 }));
  const d = pairedBrierDiff(bad, good);
  assert.ok(d.low > 0, `low ${d.low}`);
});

test("pairedBrierDiff：日期對不上的列被丟掉並計數", () => {
  const a = mkRows(50, () => ({ p: 0.6, pBase: 0.6, y: 1 }));
  const b = a.slice(5).concat(mkRows(3, () => ({ p: 0.6, pBase: 0.6, y: 1 })).map((r, i) => ({ ...r, date: `2099-01-0${i + 1}` })));
  const d = pairedBrierDiff(a, b);
  assert.equal(d.n, 45);
  assert.equal(d.dropped, 5 + 3);
});

function syntheticObs(n: number): Observation[] {
  const rand = mulberry32(3);
  return Array.from({ length: n }, (_, i) => ({
    date: day(i),
    close: 100 + i,
    regime: { aboveSma200: rand() > 0.3, vixStress: rand() > 0.9 },
    up: i + 21 < n ? rand() > 0.35 : null,
    knownOn: i + 21 < n ? day(i + 21) : null,
  }));
}

test("phaseAveraged：恆定 p（= 基準率）的序列 BSS 為 0", () => {
  const obs = syntheticObs(1500).map((o) => ({ ...o, regime: { aboveSma200: true, vixStress: false } }));
  // 單一 regime：所有候選條件等於基準，區間含基準率 → p = pBase
  const r = phaseAveraged(obs, DEFAULT_MODEL, "up", { resamples: 50 });
  assert.equal(r.bssByPhase.length, 21);
  assert.equal(r.mean, 0);
  assert.equal(r.ci.low, 0);
  assert.equal(r.ci.high, 0);
});

test("bootstrapCI：點估計等於統計量本身", () => {
  const rows = mkRows(40, (i) => ({ p: 0.7, pBase: 0.6, y: i % 2 }));
  assert.equal(bootstrapCI(rows, bssOf, { resamples: 100 }).point, bssOf(rows));
});

// 有訊號的合成序列：aboveSma200 為真時上漲機率 0.8，否則 0.3；vixStress 偶發。regime 慢速切換，避免每日獨立。
function informativeObs(n: number): Observation[] {
  const rand = mulberry32(9);
  let above = true;
  return Array.from({ length: n }, (_, i) => {
    if (rand() < 0.03) above = !above;
    const up = i + 21 < n ? rand() < (above ? 0.8 : 0.3) : null;
    return { date: day(i), close: 100, regime: { aboveSma200: above, vixStress: rand() > 0.93 }, up, knownOn: up === null ? null : day(i + 21) };
  });
}

const clone = (obs: Observation[]) => obs.map((o) => ({ ...o, regime: o.regime && { ...o.regime } }));

test("A1 相位格點固定：中段 40 天 regime 為 null，各相位仍落在不同日期", () => {
  const obs = syntheticObs(1500);
  for (let i = 900; i < 940; i++) obs[i].regime = null;
  const grid = phaseGrid(obs);
  const r = phaseAveraged(obs, DEFAULT_MODEL, "up", { resamples: 20 });
  assert.equal(grid.length, 21);
  // 格點 = s + o + 21k，不因缺口位移
  for (let o = 1; o < 21; o++) assert.equal(grid[o][0], grid[0][0] + o);
  const firstDates = new Set(r.rowsByPhase.map((rs) => rs[0]?.date));
  assert.equal(firstDates.size, 21);
  const gapDates = new Set(obs.slice(900, 940).map((o) => o.date));
  for (const rs of r.rowsByPhase) for (const row of rs) assert.ok(!gapDates.has(row.date));
  // 每個相位的列日期都在自己的格點上
  r.rowsByPhase.forEach((rs, o) => {
    const ok = new Set(grid[o].map((i) => obs[i].date));
    for (const row of rs) assert.ok(ok.has(row.date));
  });
});

test("A2 點估計與 bootstrap 用同一批格：缺列的最後一格整格捨去，點估計在區間內", () => {
  const rand = mulberry32(5);
  const cells: (WalkRow | null)[][] = Array.from({ length: 21 }, (_, o) =>
    Array.from({ length: o === 20 ? 12 : 13 }, (_, k) => {
      const y = rand() > 0.4 ? 1 : 0;
      return { date: day(o + 21 * k), basis: "base", cell: "base", distinct: false, p: 0.6, pBase: 0.5 + (o % 3) * 0.02, y };
    }),
  );
  const r = phaseAverageFromCells(cells, { resamples: 300 });
  assert.equal(r.cycles.used, 12);
  assert.equal(r.cycles.dropped, 1);
  assert.ok(r.ci.low <= r.mean && r.mean <= r.ci.high, `${r.ci.low} ${r.mean} ${r.ci.high}`);
});

test("A3 方向計數 point-in-time：後期才出現的 skill 不能讓早期有方向", () => {
  const n = 120;
  const rows: WalkRow[] = Array.from({ length: n }, (_, i) => {
    const late = i >= 90;
    // 前 90 列：預測與基準相同（BSS 0）；後 30 列預測明顯優於基準
    const y = i % 2;
    return { date: day(i * 21), basis: "b", cell: Math.floor(i / 3) % 2 ? "c" : "b", distinct: true, y, pBase: 0.5, p: late ? (y ? 0.9 : 0.1) : 0.5 };
  });
  const knownOn = new Map(rows.map((r, i) => [r.date, day(i * 21 + 21)]));
  const calls = pointInTimeCalls(rows, knownOn);
  assert.equal(calls.slice(0, 90).filter((c) => c !== "inconclusive").length, 0);
  assert.equal(calls.slice(0, 12).every((c) => c === "inconclusive"), true);
  // 後期的 skill 累積到足夠的列數與段數後，cell 閘門就會通過（測試有鑑別力）
  assert.ok(calls.slice(90).some((c) => c !== "inconclusive"), "後期應有方向");
});

test("A4 配對：候選多 5 天暖機也能完整配對，丟掉的日期有回報；交集讓雙方訓練樣本一致", () => {
  const ref = syntheticObs(1500);
  const cand = clone(ref);
  for (let i = 0; i < 5; i++) ref[i].regime = { aboveSma200: true, vixStress: false };
  for (let i = 0; i < 5; i++) cand[i].regime = null;
  const [a, b] = intersectRegimes(ref, cand);
  for (let i = 0; i < 5; i++) assert.equal(a[i].regime, null);
  assert.deepEqual(a.map((o) => o.regime === null), b.map((o) => o.regime === null));
  const r = pairedPhaseAveraged(ref, cand, DEFAULT_MODEL, DEFAULT_MODEL, { resamples: 50 });
  // 捨去的格只有「末端標籤未知」那幾格，與參考單獨算相同；候選的額外暖機不造成配對損失
  assert.equal(r.cycles.dropped, phaseAveraged(a, DEFAULT_MODEL, "up", { resamples: 10 }).cycles.dropped);
  assert.ok(r.cycles.used > 0);
  assert.equal(r.mean, 0);
  assert.ok(Number.isFinite(r.ci.low));
});

// 獨立重算用：在格點日期上直接跑 walkForwardRows，丟掉不完整的格後取各相位 BSS（配對時為 1 − ΣA/ΣB）的平均。
function completeCycleMean(a: Observation[], cfgA: ModelConfig, b: Observation[] | null, cfgB: ModelConfig, phases: number): { mean: number; kept: number; meanAll: number } {
  const grid = phaseGrid(a, 504, phases);
  const rowsOf = (obs: Observation[], cfg: ModelConfig, o: number) => {
    const rows = walkForwardRows(obs, cfg, { dates: grid[o].map((i) => obs[i].date) });
    return grid[o].map((i) => rows.find((r) => r.date === obs[i].date) ?? null);
  };
  const A = grid.map((_, o) => rowsOf(a, cfgA, o));
  const B = b ? grid.map((_, o) => rowsOf(b, cfgB, o)) : null;
  const total = Math.max(...grid.map((g) => g.length));
  const keep: number[] = [];
  for (let k = 0; k < total; k++) if (A.every((c) => c[k]) && (!B || B.every((c) => c[k]))) keep.push(k);
  const sq = (r: WalkRow) => (r.p - r.y) ** 2;
  const stat = (ks: number[], o: number) => {
    const ra = ks.map((k) => A[o][k]).filter((r): r is WalkRow => !!r);
    if (!B) return 1 - ra.reduce((s, r) => s + (r.p - r.y) ** 2, 0) / ra.reduce((s, r) => s + (r.pBase - r.y) ** 2, 0);
    const rb = ks.map((k) => B[o][k]).filter((r): r is WalkRow => !!r);
    return 1 - ra.reduce((s, r) => s + sq(r), 0) / rb.reduce((s, r) => s + sq(r), 0);
  };
  const all = Array.from({ length: total }, (_, k) => k);
  const mean = (ks: number[]) => grid.reduce((s, _, o) => s + stat(ks, o), 0) / grid.length;
  return { mean: mean(keep), kept: keep.length, meanAll: mean(all) };
}

test("A2 獨立重算：點估計 = 完整格的平均（含一個影響很大的被捨去的不完整格）", () => {
  const obs = informativeObs(1500);
  const grid = phaseGrid(obs);
  // 讓某個相位的第 10 格 regime 為 null → 該格不完整；其餘相位的第 10 格標籤全翻成與基準相反，使它影響很大
  obs[grid[3][10]].regime = null;
  for (let o = 0; o < 21; o++) if (o !== 3) obs[grid[o][10]].up = false;
  const r = phaseAveraged(obs, DEFAULT_MODEL, "up", { resamples: 50 });
  const ind = completeCycleMean(obs, DEFAULT_MODEL, null, DEFAULT_MODEL, 21);
  assert.equal(r.cycles.used, ind.kept);
  assert.ok(Math.abs(r.mean - ind.mean) < 1e-12, `${r.mean} vs ${ind.mean}`);
  // 兩種估計法確實不同，測試才有鑑別力
  assert.ok(Math.abs(ind.mean - ind.meanAll) > 1e-4, `${ind.mean} vs ${ind.meanAll}`);
});

test("L08 虛無分佈：兩個不同模型、預設 N = 20、值不全相同、第 1 組與獨立重算一致", () => {
  const obs = informativeObs(3000);
  const cand: ModelConfig = { ...DEFAULT_MODEL, version: "cand", candidates: [["aboveSma200"]], minEffectiveN: 5 };
  const phases = 3;
  // 前段保留真實標籤（讓兩個模型都學到條件機率），只置換 firstDate 之後的標籤，這樣虛無值才會因模型不同而不同
  const firstDate = day(1800);
  const a = nullPairedBss(obs, obs, DEFAULT_MODEL, cand, { phases, firstDate });
  const b = nullPairedBss(obs, obs, DEFAULT_MODEL, cand, { phases, firstDate });
  assert.equal(a.values.length, 20);
  assert.deepEqual(a, b);
  assert.ok(new Set(a.values).size > 1, "虛無值不該全部相同");
  assert.equal(a.threshold, Math.max(...a.values));
  // 獨立重算第 1 組（種子 EVAL_SEED + 1）：區塊長 21×b，b ∈ 6..12，置換每日 up 標籤
  const [r0, c0] = intersectRegimes(obs, obs);
  const labeled = r0.flatMap((o, i) => (o.date >= firstDate && o.up !== null ? [i] : []));
  const rand = mulberry32(EVAL_SEED + 1);
  const len = (6 + Math.floor(rand() * 7)) * HORIZON;
  const blocks: number[][] = [];
  for (let s = 0; s < labeled.length; s += len) blocks.push(labeled.slice(s, s + len));
  for (let i = blocks.length - 1; i > 0; i--) {
    const k = Math.floor(rand() * (i + 1));
    [blocks[i], blocks[k]] = [blocks[k], blocks[i]];
  }
  const order = blocks.flat();
  const perm = (xs: Observation[]) => {
    const out = xs.map((o) => ({ ...o }));
    labeled.forEach((pos, n) => (out[pos].up = xs[order[n]].up));
    return out;
  };
  const ind = completeCycleMean(perm(c0), cand, perm(r0), DEFAULT_MODEL, phases);
  assert.ok(Math.abs(a.values[0] - ind.mean) < 1e-12, `${a.values[0]} vs ${ind.mean}`);
});

test("B1 配對下界的 MC 標準誤：5 個下界的 sd，兩個不同模型時 > 0 或至少可重現", () => {
  const obs = informativeObs(1400);
  const cand: ModelConfig = { ...DEFAULT_MODEL, version: "cand", candidates: [["aboveSma200"]], minEffectiveN: 5 };
  const a = pairedMcStdErr(obs, obs, DEFAULT_MODEL, cand, { resamples: 100, phases: 3 });
  assert.equal(a.values.length, 5);
  assert.ok(new Set(a.values).size > 1);
  assert.ok(a.se > 0);
  assert.deepEqual(a, pairedMcStdErr(obs, obs, DEFAULT_MODEL, cand, { resamples: 100, phases: 3 }));
});

test("per-cell 摘要：段數 = offset 0 列中連續屬於該 cell 的最長段，只算該 cell 的列", () => {
  const mk = (i: number, basis: string): WalkRow => ({ date: day(i), basis, p: 0.7, pBase: 0.5, y: i % 2, distinct: true, cell: basis });
  const rows = [mk(0, "x"), mk(1, "x"), mk(2, "y"), mk(3, "x"), mk(4, "y")];
  const s = summarizeByCell(rows, (r) => r.basis, { resamples: 50 });
  const x = s.find((c) => c.cell === "x")!;
  assert.equal(x.rows, 3);
  assert.equal(x.runs, 2);
});

test("配對相位平均 Brier 差：相同模型 → 0 [0,0]；較差的候選 > 0", () => {
  const obs = informativeObs(1400);
  const same = pairedBrierDiffPhase(obs, obs, DEFAULT_MODEL, DEFAULT_MODEL, { resamples: 100, phases: 3 });
  assert.equal(same.mean, 0);
  assert.equal(same.ci.low, 0);
  assert.equal(same.ci.high, 0);
  const cand: ModelConfig = { ...DEFAULT_MODEL, version: "cand", candidates: [["aboveSma200"]], minEffectiveN: 5 };
  const d = pairedBrierDiffPhase(obs, obs, DEFAULT_MODEL, cand, { resamples: 100, phases: 3 });
  assert.ok(Number.isFinite(d.mean) && Number.isFinite(d.ci.low) && d.ci.low <= d.mean && d.mean <= d.ci.high);
  const mc = pairedBrierDiffMcStdErr(obs, obs, DEFAULT_MODEL, cand, { resamples: 100, phases: 3 });
  assert.equal(mc.values.length, 5);
  const mc0 = pairedBrierDiffMcStdErr(obs, obs, DEFAULT_MODEL, DEFAULT_MODEL, { resamples: 100, phases: 3 });
  assert.equal(mc0.se, 0);
});

test("L08 置換 p：p = (1 + #{虛無 ≥ 觀測})/(N+1)，同值算入；N = 199 時 p ≤ 0.025 ⇔ b ≤ 4、p ≤ 0.045 ⇔ b ≤ 8", () => {
  const observed = 0.01;
  // b draws at or above observed (the first one is an exact tie), the rest strictly below.
  const draws = (b: number) => Array.from({ length: 199 }, (_, i) => (i === 0 && b > 0 ? observed : i < b ? observed + 0.001 * i : observed - 0.001 * (i + 1)));
  for (let b = 0; b <= 20; b++) {
    const r = permutationP(draws(b), observed);
    assert.equal(r.exceed, b);
    assert.equal(r.n, 199);
    assert.equal(r.p, (1 + b) / 200);
    assert.equal(r.p <= 0.025, b <= 4, `b=${b}`);
    assert.equal(r.p <= 0.045, b <= 8, `b=${b}`);
  }
  // Tie counts against the candidate.
  assert.equal(permutationP([0.5], 0.5).exceed, 1);
  assert.equal(permutationP([0.4999], 0.5).exceed, 0);
  // N = 20 (round 1): smallest attainable p is 1/21.
  assert.equal(permutationP(Array(20).fill(-1), 0).p, 1 / 21);
  // Uncomputable statistic must not look significant.
  assert.ok(Number.isNaN(permutationP([0.1, 0.2], NaN).p));
  assert.ok(Number.isNaN(permutationP([0.1, NaN], 0.5).p));
});

test("L08 虛無值不受 N 影響：N = 3 的值等於 N = 5 的前 3 組（種子固定 EVAL_SEED + j）", () => {
  const obs = informativeObs(3000);
  const cand: ModelConfig = { ...DEFAULT_MODEL, version: "cand", candidates: [["aboveSma200"]], minEffectiveN: 5 };
  const opts = { phases: 3, firstDate: day(1800) };
  const three = nullPairedBss(obs, obs, DEFAULT_MODEL, cand, { ...opts, N: 3 });
  const five = nullPairedBss(obs, obs, DEFAULT_MODEL, cand, { ...opts, N: 5 });
  assert.equal(five.values.length, 5);
  assert.deepEqual(three.values, five.values.slice(0, 3));
});
