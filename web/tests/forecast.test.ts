import assert from "node:assert/strict";
import { test } from "node:test";
import { Series } from "../src/lib/analytics.ts";
import { DEFAULT_MODEL, HORIZON, buildObservations, buildOutlook, conditionalRate, evaluateRows, pickProbability, walkForward, walkForwardRows, wilson, type ModelConfig } from "../src/lib/forecast.ts";

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

// 特徵測試：重構模型設定前後，輸出必須一字不差（數值四捨五入到 12 位）。
const r12 = (x: number | null) => (x === null ? null : Math.round(x * 1e12) / 1e12);
const roundEval = (e: ReturnType<typeof walkForward>) => ({ ...e, hitRate: r12(e.hitRate), baseHitRate: r12(e.baseHitRate), brier: r12(e.brier), brierBase: r12(e.brierBase), bss: r12(e.bss), bssLow: r12(e.bssLow), bssHigh: r12(e.bssHigh) });
const alternating = (n: number, phase: number) => {
  const c: number[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    p *= Math.floor(i / phase) % 2 === 0 ? 1.002 : 0.998;
    c.push(p);
  }
  return c;
};
const noiseCloses = () => {
  let s = 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let q = 100;
  return Array.from({ length: 3000 }, () => (q *= 1 + (rnd() - 0.5) * 0.02));
};
const sinCloses = () => {
  const c: number[] = [];
  let p = 100;
  for (let i = 0; i < 2600; i++) {
    p *= 1 + 0.01 * Math.sin(i / 37) + 0.0003;
    c.push(p);
  }
  return c;
};
const alt600 = alternating(3000, 600);
const characterised: [string, number[], number[], ReturnType<typeof roundEval>, number, string][] = [
  ["alt300", alternating(3000, 300), alternating(3000, 300).map(() => 15), { points: 108, hitRate: 0.62962962963, baseHitRate: 0.472222222222, brier: 0.20902409256, brierBase: 0.257032009644, bss: 0.186777970378, bssLow: -0.013115603516, bssHigh: 0.366382563506, firstDate: "2016-12-24", lastDate: "2023-02-18" }, 0.195804195804, "trend+vix"],
  ["alt600", alt600, alt600.map(() => 15), { points: 108, hitRate: 0.685185185185, baseHitRate: 0.518518518519, brier: 0.162957845483, brierBase: 0.267705074275, bss: 0.39127845849, bssLow: 0.178358878759, bssHigh: 0.589503908611, firstDate: "2016-12-24", lastDate: "2023-02-18" }, 0.913705583756, "trend+vix"],
  ["noise", noiseCloses(), noiseCloses().map(() => 15), { points: 108, hitRate: 0.509259259259, baseHitRate: 0.490740740741, brier: 0.254412814031, brierBase: 0.254412814031, bss: 0, bssLow: 0, bssHigh: 0, firstDate: "2016-12-24", lastDate: "2023-02-18" }, 0.455395683453, "trend+vix"],
  ["sin", sinCloses(), sinCloses().map(() => 15), { points: 89, hitRate: 0.505617977528, baseHitRate: 0.516853932584, brier: 0.25735595411, brierBase: 0.25735595411, bss: 0, bssLow: 0, bssHigh: 0, firstDate: "2016-12-24", lastDate: "2022-01-15" }, 0.511764705882, "trend+vix"],
  ["vixMix", alt600, alt600.map((_, i) => (Math.floor(i / 150) % 3 === 2 ? 35 : 15)), { points: 108, hitRate: 0.62037037037, baseHitRate: 0.518518518519, brier: 0.197774628376, brierBase: 0.267705074275, bss: 0.261221966331, bssLow: 0.043696689881, bssHigh: 0.459752218462, firstDate: "2016-12-24", lastDate: "2023-02-18" }, 0.87922705314, "trend+vix"],
];

test("特徵測試：walkForward 與 buildOutlook 的輸出固定", () => {
  for (const [name, spx, vix, evaluation, p, basis] of characterised) {
    const obs = buildObservations(series(spx), series(vix));
    assert.deepEqual(roundEval(walkForward(obs)), evaluation, name);
    const o = buildOutlook(series(spx), series(vix))!;
    assert.equal(r12(o.pick.p), p, name);
    assert.equal(o.pick.basis, basis, name);
  }
  const obs = buildObservations(series(Array.from({ length: 900 }, (_, i) => 100 + i)), series(Array.from({ length: 900 }, () => 15)));
  const trend = pickProbability(obs, day(899), { aboveSma200: true, vixStress: true })!;
  assert.deepEqual([trend.p, trend.basis], [1, "trend"]);
  const none = pickProbability(obs, day(899), { aboveSma200: false, vixStress: true })!;
  assert.deepEqual([none.p, none.basis], [1, "base"]);
  const both = pickProbability(obs, day(899), { aboveSma200: true, vixStress: false })!;
  assert.deepEqual([both.p, both.basis], [1, "trend+vix"]);
});

test("walkForward = evaluateRows(walkForwardRows)；只有趨勢旗標的模型不會出現 vix 依據", () => {
  const [, spx, vix] = characterised[4];
  const obs = buildObservations(series(spx), series(vix));
  assert.deepEqual(walkForward(obs), evaluateRows(walkForwardRows(obs)));
  assert.ok(walkForwardRows(obs).length > 0);

  const trendOnly: ModelConfig = { ...DEFAULT_MODEL, version: "test-trend", flags: [DEFAULT_MODEL.flags[0]], candidates: [["aboveSma200"]] };
  const tObs = buildObservations(series(spx), series(vix), trendOnly);
  assert.deepEqual(Object.keys(tObs.at(-1)!.regime ?? tObs[tObs.length - 22].regime!), ["aboveSma200"]);
  const rows = walkForwardRows(tObs, trendOnly);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.basis === "trend" || r.basis === "base"));
  const o = buildOutlook(series(spx), series(vix), trendOnly)!;
  assert.equal(o.modelVersion, "test-trend");
  assert.notEqual(o.pick.basis, "vix");
  assert.equal(buildOutlook(series(spx), series(vix))!.modelVersion, "2026-10-m1m5");

  // dates 只算指定日期。
  const some = rows.slice(0, 3).map((r) => r.date);
  assert.deepEqual(walkForwardRows(tObs, trendOnly, { dates: some }).map((r) => r.date), some);
});

test("M5：VIX 比最後一個 SPX 日期早結束 5 個交易日 → 沒有展望；3 個交易日以內仍有", () => {
  const n = 900;
  const spx = series(Array.from({ length: n }, (_, i) => 100 + i));
  const vixEndingBefore = (k: number) => series(Array.from({ length: n - k }, () => 15));
  assert.equal(buildOutlook(spx, vixEndingBefore(5)), null);
  assert.equal(buildOutlook(spx, vixEndingBefore(4)), null);
  const o = buildOutlook(spx, vixEndingBefore(3))!;
  assert.ok(o.regime);
  assert.equal(o.vix, 15);
  // Outlook.vix 與 regime 用同一個有界查找；不設上限（舊行為）時 5 天前的 VIX 仍被沿用。
  assert.ok(buildOutlook(spx, vixEndingBefore(5), { ...DEFAULT_MODEL, vixMaxStaleSessions: null }));
});

test("D1：1990-01-02 之前的觀測值沒有 regime，historyStart 與條件樣本都不含更早的日子", () => {
  const n = 9000;
  const dayFrom1985 = (i: number) => new Date(Date.UTC(1985, 0, 1) + i * 864e5).toISOString().slice(0, 10);
  const spx = new Series(Array.from({ length: n }, (_, i) => ({ date: dayFrom1985(i), close: 100 + i })));
  const vix = new Series(Array.from({ length: n }, (_, i) => ({ date: dayFrom1985(i), close: 15 })));
  const obs = buildObservations(spx, vix);
  assert.ok(obs.some((o) => o.date < "1990-01-02"));
  assert.ok(obs.filter((o) => o.date < "1990-01-02").every((o) => o.regime === null));
  const o = buildOutlook(spx, vix)!;
  assert.ok(o.historyStart! >= "1990-01-02", `historyStart=${o.historyStart}`);
  const legacy: ModelConfig = { ...DEFAULT_MODEL, baseWindowStart: null, vixMaxStaleSessions: null };
  const lo = buildOutlook(spx, vix, legacy)!;
  assert.ok(lo.historyStart! < "1990-01-02");
  const asOf = obs.at(-1)!.date;
  const windowed = conditionalRate(obs, asOf)!;
  const full = conditionalRate(buildObservations(spx, vix, legacy), asOf)!;
  assert.ok(windowed.days < full.days);
  // 窗口內第一天的 SMA200 用到窗口前的 SPX 暖機資料，所以 historyStart 就是 1990-01-02。
  assert.equal(o.historyStart, "1990-01-02");
});
