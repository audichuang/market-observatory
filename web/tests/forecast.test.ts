import assert from "node:assert/strict";
import { test } from "node:test";
import { Series } from "../src/lib/analytics.ts";
import { HORIZON, buildObservations, buildOutlook, conditionalRate, pickProbability, walkForward, wilson } from "../src/lib/forecast.ts";

const day = (i: number) => new Date(Date.UTC(2015, 0, 1) + i * 864e5).toISOString().slice(0, 10);
const series = (closes: number[]) => new Series(closes.map((close, i) => ({ date: day(i), close })));

test("Wilson 區間：樣本越多越窄、p 在區間內", () => {
  const a = wilson(0.6, 30);
  const b = wilson(0.6, 300);
  assert.ok(a.low < 0.6 && a.high > 0.6);
  assert.ok(b.high - b.low < a.high - a.low);
});

test("標籤不偷看未來：第 t 天的結果要到 t+21 天才算已知", () => {
  const spx = series(Array.from({ length: 260 }, (_, i) => 100 + i));
  const vix = series(Array.from({ length: 260 }, () => 15));
  const obs = buildObservations(spx, vix);
  const i = 210;
  assert.equal(obs[i].knownOn, day(i + HORIZON));
  // 在 t+20 天時，這個標籤還不能被用到。
  const before = conditionalRate(obs, day(i + HORIZON - 1));
  const after = conditionalRate(obs, day(i + HORIZON));
  assert.equal((after?.days ?? 0) - (before?.days ?? 0), 1);
  assert.equal(obs.at(-1)!.up, null);
  // 精確計數：第 199 天起才有 200 日線（regime），第 k 天收盤後已知的是第 199～k−21 天的標籤。
  const k = 240;
  assert.equal(conditionalRate(obs, day(k))!.days, k - HORIZON - 199 + 1);
});

test("條件樣本不足時退回基準率", () => {
  // 一路上漲：永遠在 200 日線之上，VIX 也從未 ≥ 30 → 「VIX 緊張」沒有樣本。
  const spx = series(Array.from({ length: 900 }, (_, i) => 100 + i));
  const vix = series(Array.from({ length: 900 }, () => 15));
  const obs = buildObservations(spx, vix);
  const pick = pickProbability(obs, day(899), { aboveSma200: true, vixStress: true })!;
  assert.equal(pick.basis, "trend");
  const none = pickProbability(obs, day(899), { aboveSma200: false, vixStress: true })!;
  assert.equal(none.basis, "base");
  assert.equal(none.distinct, false);
});

test("條件樣本只有少數幾筆（有效樣本 < 30）時不採用，退回較粗的條件或基準率", () => {
  const spx = series(Array.from({ length: 900 }, (_, i) => 100 + i));
  // 只有 60 天 VIX ≥ 30（有效樣本約 3）。
  const vix = series(Array.from({ length: 900 }, (_, i) => (i >= 400 && i < 460 ? 35 : 15)));
  const obs = buildObservations(spx, vix);
  const pick = pickProbability(obs, day(899), { aboveSma200: true, vixStress: true })!;
  assert.notEqual(pick.basis, "trend+vix");
  assert.notEqual(pick.basis, "vix");
});

test("條件看起來有差、但滾動驗證的 BSS 區間跨 0：仍判不確定", () => {
  const closes: number[] = [];
  let p = 100;
  for (let i = 0; i < 3000; i++) {
    p *= Math.floor(i / 300) % 2 === 0 ? 1.002 : 0.998;
    closes.push(p);
  }
  const o = buildOutlook(series(closes), series(closes.map(() => 15)))!;
  assert.equal(o.pick.distinct, true);
  assert.ok(o.evaluation.bssLow !== null && o.evaluation.bssLow <= 0, `bssLow=${o.evaluation.bssLow}`);
  assert.equal(o.call, "inconclusive");
  assert.ok(o.reasons.some((r) => r.includes("滾動驗證")));
});

test("條件明顯不同、且滾動驗證勝過基準時才給方向；否則標不確定", () => {
  // 造一段有規律的行情：長期趨勢交替，200 日線之上隔月多半漲、之下多半跌。
  const closes: number[] = [];
  let p = 100;
  for (let i = 0; i < 3000; i++) {
    const phase = Math.floor(i / 600) % 2; // 每 600 天換一次趨勢
    p *= phase === 0 ? 1.002 : 0.998;
    closes.push(p);
  }
  const outlook = buildOutlook(series(closes), series(closes.map(() => 15)))!;
  assert.ok(outlook.evaluation.points >= 12);
  assert.ok(outlook.evaluation.bss! > 0, `bss=${outlook.evaluation.bss}`);
  assert.notEqual(outlook.call, "inconclusive");

  // 純隨機漫步：不應該給方向。
  let s = 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let q = 100;
  const noise = Array.from({ length: 3000 }, () => (q *= 1 + (rnd() - 0.5) * 0.02));
  const flat = buildOutlook(series(noise), series(noise.map(() => 15)))!;
  assert.equal(flat.call, "inconclusive");
  assert.ok(flat.reasons.length > 0);
});

test("滾動驗證的預測點互不重疊（間隔至少 21 個交易日）", () => {
  const closes = Array.from({ length: 1400 }, (_, i) => 100 + Math.sin(i / 40) * 10 + i * 0.01);
  const obs = buildObservations(series(closes), series(closes.map(() => 15)));
  const ev = walkForward(obs);
  assert.ok(ev.points > 0);
  assert.ok(ev.points <= Math.ceil((1400 - 200 - 504) / HORIZON) + 1, `points=${ev.points}`);
});

test("條件區間包含基準率時，輸出的機率是基準率，不是條件機率", () => {
  // 前 1500 天漲多跌少、200 日線上下交替；條件差異小、區間會包含基準率。
  const closes: number[] = [];
  let p = 100;
  for (let i = 0; i < 2600; i++) {
    p *= 1 + 0.01 * Math.sin(i / 37) + 0.0003;
    closes.push(p);
  }
  const spx = series(closes);
  const vix = series(closes.map(() => 15));
  const obs = buildObservations(spx, vix);
  for (const regime of [{ aboveSma200: true, vixStress: false }, { aboveSma200: false, vixStress: false }]) {
    const pick = pickProbability(obs, day(2599), regime)!;
    if (pick.distinct) assert.equal(pick.p, pick.conditional!.p);
    else assert.equal(pick.p, pick.base.p);
  }
});
