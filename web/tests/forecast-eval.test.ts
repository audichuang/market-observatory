import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MODEL, mulberry32, walkForwardRows, type Observation, type WalkRow } from "../src/lib/forecast.ts";
import { bootstrapCI, bssOf, pairedBrierDiff, phaseAveraged, stationaryBootstrapIndices } from "../src/lib/forecast-eval.ts";

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

test("walkForwardRows：offset 0 與預設排程相同，offset 讓起點後移", () => {
  const obs = syntheticObs(1500);
  const def = walkForwardRows(obs, DEFAULT_MODEL);
  assert.ok(def.length > 20);
  assert.deepEqual(walkForwardRows(obs, DEFAULT_MODEL, { offset: 0 }), def);
  const o5 = walkForwardRows(obs, DEFAULT_MODEL, { offset: 5 });
  assert.notEqual(o5[0].date, def[0].date);
  assert.ok(o5[0].date > def[0].date);
});

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
