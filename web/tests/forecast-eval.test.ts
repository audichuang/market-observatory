import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MODEL, mulberry32, walkForwardRows, type Observation, type WalkRow } from "../src/lib/forecast.ts";
import { bootstrapCI, bssOf, intersectRegimes, nullPairedBss, pairedBrierDiff, pairedPhaseAveraged, phaseAveraged, phaseAverageFromCells, phaseGrid, pointInTimeCalls, stationaryBootstrapIndices, summarizeByCell } from "../src/lib/forecast-eval.ts";

const day = (i: number) => new Date(Date.UTC(2015, 0, 1) + i * 864e5).toISOString().slice(0, 10);
const mkRows = (n: number, f: (i: number) => { p: number; pBase: number; y: number }): WalkRow[] =>
  Array.from({ length: n }, (_, i) => ({ date: day(i * 21), basis: "base", distinct: false, ...f(i) }));

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
      return { date: day(o + 21 * k), basis: "base", distinct: false, p: 0.6, pBase: 0.5 + (o % 3) * 0.02, y };
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
    return { date: day(i * 21), basis: "b", distinct: true, y, pBase: 0.5, p: late ? (y ? 0.9 : 0.1) : 0.5 };
  });
  const knownOn = new Map(rows.map((r, i) => [r.date, day(i * 21 + 21)]));
  const calls = pointInTimeCalls(rows, knownOn, { blockSize: 3, resamples: 200 });
  assert.equal(calls.slice(0, 90).filter((c) => c !== "inconclusive").length, 0);
  assert.equal(calls.slice(0, 12).every((c) => c === "inconclusive"), true);
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

test("L08 虛無分佈：20 組、固定種子可重現", () => {
  const obs = syntheticObs(1200);
  const a = nullPairedBss(obs, obs, DEFAULT_MODEL, DEFAULT_MODEL, { N: 3, phases: 2, firstDate: day(0) });
  const b = nullPairedBss(obs, obs, DEFAULT_MODEL, DEFAULT_MODEL, { N: 3, phases: 2, firstDate: day(0) });
  assert.equal(a.values.length, 3);
  assert.deepEqual(a, b);
  assert.equal(a.threshold, Math.max(...a.values));
});

test("per-cell 摘要：段數 = offset 0 列中連續屬於該 cell 的最長段，只算該 cell 的列", () => {
  const mk = (i: number, basis: string): WalkRow => ({ date: day(i), basis, p: 0.7, pBase: 0.5, y: i % 2, distinct: true });
  const rows = [mk(0, "x"), mk(1, "x"), mk(2, "y"), mk(3, "x"), mk(4, "y")];
  const s = summarizeByCell(rows, (r) => r.basis, { resamples: 50 });
  const x = s.find((c) => c.cell === "x")!;
  assert.equal(x.rows, 3);
  assert.equal(x.runs, 2);
});
