import assert from "node:assert/strict";
import { test } from "node:test";
import { Series } from "../src/lib/analytics.ts";
import { DEFAULT_MODEL, EVAL_SEED, HORIZON, condOfPick, drawdownScored, returnQuantiles, MIN_CELL_ROWS, MIN_CELL_RUNS, MIN_EPISODES, MIN_VALID_REPLICATES, buildObservations, buildOutlook, callOf, cellEvaluations, cellGateOf, conditionalRate, evaluateRows, mulberry32, pickProbability, sdOf, stationaryBootstrapIndices, walkForward, walkForwardRows, wilson, type CellEval, type ModelConfig, type Observation, type WalkRow } from "../src/lib/forecast.ts";
import { PHASES, bssOf, nullPairedBss, pairedBrierDiffMcStdErr, pairedBrierDiffPhase, pairedMcStdErr, pairedPhaseAveraged, phaseGrid, pointInTimeCalls } from "../src/lib/forecast-eval.ts";

const day = (i: number) => new Date(Date.UTC(2015, 0, 1) + i * 864e5).toISOString().slice(0, 10);
// G04 之前的舊行為（不設段數門檻、不凍結窗口、不限 VIX 陳舊度）：既有測試的意圖不變，改用它來跑。
const LEGACY: ModelConfig = { ...DEFAULT_MODEL, shrinkK: null, minEpisodes: 0, baseWindowStart: null, vixMaxStaleSessions: null, bootstrap: { kind: "block", blockSize: 3, resamples: 1000 } };
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
  // 這個測試只看有效樣本的規則（舊行為）；一路上漲只有 1 段，G04 下 trend 也不會被採用，見下方 G04 測試。
  const obs = buildObservations(spx, vix, LEGACY);
  const pick = pickProbability(obs, day(899), { aboveSma200: true, vixStress: true }, LEGACY)!;
  assert.equal(pick.basis, "trend");
  const none = pickProbability(obs, day(899), { aboveSma200: false, vixStress: true }, LEGACY)!;
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
  // 3000 天只有約 5 段，G04 下會退回基準率；此測試的意圖是 BSS 判斷本身，所以用舊設定（不設段數門檻）。
  const o = buildOutlook(series(closes), series(closes.map(() => 15)), LEGACY)!;
  assert.equal(o.pick.distinct, true);
  assert.ok(o.evaluation.bssLow !== null && o.evaluation.bssLow <= 0, `bssLow=${o.evaluation.bssLow}`);
  assert.equal(o.call, "inconclusive");
  assert.ok(o.reasons.some((r) => r.includes("滾動驗證")));
});

test("G04 生效時，趨勢每側只有約 5 段的 regime fixture 退回基準率、不給方向；隨機漫步仍不給方向", () => {
  // 長期趨勢交替（每 600 天換一次，3000 天）：舊行為會採用 trend+vix 並給方向，
  // 但每側只有 2～3 段（< MIN_EPISODES），G04 下不能採用，退回基準率。
  const closes = alternating(3000, 600);
  const outlook = buildOutlook(series(closes), series(closes.map(() => 15)))!;
  assert.equal(outlook.pick.basis, "base");
  assert.equal(outlook.pick.distinct, false);
  assert.equal(outlook.call, "inconclusive");
  // 同一份資料在舊設定下的行為（這個 fixture 原本要證明的事）仍成立。
  const legacy = buildOutlook(series(closes), series(closes.map(() => 15)), LEGACY)!;
  assert.ok(legacy.evaluation.points >= 12);
  assert.ok(legacy.evaluation.bss! > 0, `bss=${legacy.evaluation.bss}`);
  assert.equal(legacy.pick.distinct, true);
  // G03 之前舊設定會給方向；現在 cell 只分成不到 8 段連續區間（(c) 不過），舊設定也不給方向。
  assert.ok(legacy.cellGate.runs < MIN_CELL_RUNS, `runs=${legacy.cellGate.runs}`);
  assert.equal(legacy.call, "inconclusive");

  // 純隨機漫步：不應該給方向。
  let s = 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let q = 100;
  const noise = Array.from({ length: 3000 }, () => (q *= 1 + (rnd() - 0.5) * 0.02));
  const flat = buildOutlook(series(noise), series(noise.map(() => 15)))!;
  assert.equal(flat.call, "inconclusive");
  assert.ok(flat.reasons.length > 0);
});

test("G04：趨勢兩側各有 ≥ 8 段（段間 ≥ 21 個交易日）時，選用 trend，p 與基準率可區分、walk-forward BSS > 0", () => {
  const closes = alternating(8000, 300);
  const spx = series(closes);
  const vix = series(closes.map(() => 15));
  const obs = buildObservations(spx, vix);
  const asOf = obs.at(-1)!.date;
  for (const side of [true, false]) {
    const r = conditionalRate(obs, asOf, { aboveSma200: side })!;
    assert.ok(r.episodes >= MIN_EPISODES, `aboveSma200=${side} episodes=${r.episodes}`);
  }
  const o = buildOutlook(spx, vix)!;
  assert.equal(o.pick.basis, "trend+vix");
  assert.ok(o.pick.conditional!.episodes >= MIN_EPISODES);
  assert.equal(o.pick.distinct, true);
  assert.ok(Math.abs(o.pick.p - o.pick.base.p) > 0.1, `p=${o.pick.p} base=${o.pick.base.p}`);
  assert.ok(o.evaluation.bss! > 0, `bss=${o.evaluation.bss}`);
  // 方向另外要過 G03 的 cell 閘門：8000 天裡能採用 trend 的列只有後半，連續區間不到 8 段，所以不給方向（正向對照見下方 12000 天的測試）。
  assert.equal(o.call, "inconclusive");
  assert.ok(o.cellGate.runs < MIN_CELL_RUNS);
});

test("G04 證明測試：一段連續約 700 天的 VIX ≥ 30（nEff≈33、僅 1 段）不能被採用為 vix 或 trend+vix", () => {
  const n = 2000;
  const spx = series(Array.from({ length: n }, (_, i) => 100 + i));
  const vix = series(Array.from({ length: n }, (_, i) => (i >= 500 && i < 1200 ? 35 : 15)));
  const obs = buildObservations(spx, vix);
  const asOf = day(n - 1);
  const cell = conditionalRate(obs, asOf, { vixStress: true })!;
  assert.ok(cell.nEff >= 30 && cell.nEff < 36, `nEff=${cell.nEff}`);
  assert.equal(cell.episodes, 1);
  const pick = pickProbability(obs, asOf, { aboveSma200: true, vixStress: true })!;
  assert.notEqual(pick.basis, "vix");
  assert.notEqual(pick.basis, "trend+vix");
  // 舊設定（不設段數門檻）會採用它。
  assert.equal(pickProbability(obs, asOf, { aboveSma200: true, vixStress: true }, LEGACY)!.basis, "trend+vix");
});

test("G04 段數：條件成立的兩段相隔 30 個交易日算 2 段，相隔 10 個交易日算 1 段；基準率也有段數", () => {
  const mk = (starts: number[], len: number, n: number): Observation[] =>
    Array.from({ length: n }, (_, i) => ({
      date: day(i),
      close: 100,
      regime: { x: starts.some((s) => i >= s && i < s + len) },
      up: true,
      knownOn: day(i),
    }));
  const asOf = day(999);
  // 第一段 [100,140)，最後一個成立日 139；第二段從 169 起（相隔 30）。
  assert.equal(conditionalRate(mk([100, 169], 40, 1000), asOf, { x: true })!.episodes, 2);
  // 第二段從 149 起（相隔 10）：連成 1 段。
  assert.equal(conditionalRate(mk([100, 149], 40, 1000), asOf, { x: true })!.episodes, 1);
  // 邊界：相隔剛好 21 算新的一段，20 不算。
  assert.equal(conditionalRate(mk([100, 160], 40, 1000), asOf, { x: true })!.episodes, 2);
  assert.equal(conditionalRate(mk([100, 159], 40, 1000), asOf, { x: true })!.episodes, 1);
  assert.equal(conditionalRate(mk([100], 40, 1000), asOf, { x: true })!.days, 40);
  // 基準率（資訊用）：全部連續成立 = 1 段。
  assert.equal(conditionalRate(mk([100], 40, 1000), asOf)!.episodes, 1);
  assert.equal(DEFAULT_MODEL.minEpisodes, MIN_EPISODES);
  assert.equal(MIN_EPISODES, 8);
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
    const pick = pickProbability(obs, day(2599), regime, { ...DEFAULT_MODEL, shrinkK: null })!; // 硬切換路徑（G01 採用後預設為收縮）
    if (pick.distinct) assert.equal(pick.p, pick.conditional!.p);
    else assert.equal(pick.p, pick.base.p);
  }
});

// 特徵測試：重構模型設定前後，輸出必須一字不差（數值四捨五入到 12 位）。
const r12 = (x: number | null) => (x === null ? null : Math.round(x * 1e12) / 1e12);
// mde 與 byCell 是 G03／G08 新增的欄位，不在這些特徵測試的釘死範圍內（另有測試）。
type PinnedEval = Omit<ReturnType<typeof walkForward>, "mde" | "byCell">;
const roundEval = (full: ReturnType<typeof walkForward>): PinnedEval => {
  const { mde: _mde, byCell: _byCell, ...e } = full;
  return {...e, hitRate: r12(e.hitRate), baseHitRate: r12(e.baseHitRate), brier: r12(e.brier), brierBase: r12(e.brierBase), bss: r12(e.bss), bssLow: r12(e.bssLow), bssHigh: r12(e.bssHigh) };
};
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
const characterised: [string, number[], number[], PinnedEval, number, string][] = [
  ["alt300", alternating(3000, 300), alternating(3000, 300).map(() => 15), { points: 108, hitRate: 0.62962962963, baseHitRate: 0.472222222222, brier: 0.20902409256, brierBase: 0.257032009644, bss: 0.186777970378, bssLow: -0.013115603516, bssHigh: 0.366382563506, firstDate: "2016-12-24", lastDate: "2023-02-18" }, 0.195804195804, "trend+vix"],
  ["alt600", alt600, alt600.map(() => 15), { points: 108, hitRate: 0.685185185185, baseHitRate: 0.518518518519, brier: 0.162957845483, brierBase: 0.267705074275, bss: 0.39127845849, bssLow: 0.178358878759, bssHigh: 0.589503908611, firstDate: "2016-12-24", lastDate: "2023-02-18" }, 0.913705583756, "trend+vix"],
  ["noise", noiseCloses(), noiseCloses().map(() => 15), { points: 108, hitRate: 0.509259259259, baseHitRate: 0.490740740741, brier: 0.254412814031, brierBase: 0.254412814031, bss: 0, bssLow: 0, bssHigh: 0, firstDate: "2016-12-24", lastDate: "2023-02-18" }, 0.455395683453, "trend+vix"],
  ["sin", sinCloses(), sinCloses().map(() => 15), { points: 89, hitRate: 0.505617977528, baseHitRate: 0.516853932584, brier: 0.25735595411, brierBase: 0.25735595411, bss: 0, bssLow: 0, bssHigh: 0, firstDate: "2016-12-24", lastDate: "2022-01-15" }, 0.511764705882, "trend+vix"],
  ["vixMix", alt600, alt600.map((_, i) => (Math.floor(i / 150) % 3 === 2 ? 35 : 15)), { points: 108, hitRate: 0.62037037037, baseHitRate: 0.518518518519, brier: 0.197774628376, brierBase: 0.267705074275, bss: 0.261221966331, bssLow: 0.043696689881, bssHigh: 0.459752218462, firstDate: "2016-12-24", lastDate: "2023-02-18" }, 0.87922705314, "trend+vix"],
];

test("特徵測試：walkForward 與 buildOutlook 的輸出固定", () => {
  for (const [name, spx, vix, evaluation, p, basis] of characterised) {
    const obs = buildObservations(series(spx), series(vix), LEGACY);
    assert.deepEqual(roundEval(walkForward(obs, 504, undefined, undefined, LEGACY)), evaluation, name);
    const o = buildOutlook(series(spx), series(vix), LEGACY)!;
    assert.equal(r12(o.pick.p), p, name);
    assert.equal(o.pick.basis, basis, name);
  }
  const obs = buildObservations(series(Array.from({ length: 900 }, (_, i) => 100 + i)), series(Array.from({ length: 900 }, () => 15)), LEGACY);
  const trend = pickProbability(obs, day(899), { aboveSma200: true, vixStress: true }, LEGACY)!;
  assert.deepEqual([trend.p, trend.basis], [1, "trend"]);
  const none = pickProbability(obs, day(899), { aboveSma200: false, vixStress: true }, LEGACY)!;
  assert.deepEqual([none.p, none.basis], [1, "base"]);
  const both = pickProbability(obs, day(899), { aboveSma200: true, vixStress: false }, LEGACY)!;
  assert.deepEqual([both.p, both.basis], [1, "trend+vix"]);
});

test("walkForward = evaluateRows(walkForwardRows)；只有趨勢旗標的模型不會出現 vix 依據", () => {
  // 用 G04 下真的會選到 trend 的 fixture（每側 ≥ 8 段），否則全部是 base，恆等式與「只有趨勢旗標」都是空測。
  const spx = alternating(8000, 300);
  const vix = spx.map(() => 15);
  const obs = buildObservations(series(spx), series(vix));
  assert.deepEqual(walkForward(obs), evaluateRows(walkForwardRows(obs)));
  const defRows = walkForwardRows(obs);
  assert.ok(defRows.some((r) => r.basis === "trend+vix"));

  const trendOnly: ModelConfig = { ...DEFAULT_MODEL, version: "test-trend", flags: [DEFAULT_MODEL.flags[0]], candidates: [["aboveSma200"]] };
  const tObs = buildObservations(series(spx), series(vix), trendOnly);
  assert.deepEqual(Object.keys(tObs.at(-1)!.regime ?? tObs[tObs.length - 22].regime!), ["aboveSma200"]);
  const rows = walkForwardRows(tObs, trendOnly);
  assert.ok(rows.some((r) => r.basis === "trend"), "趨勢旗標模型應實際選用 trend");
  assert.ok(rows.every((r) => r.basis === "trend" || r.basis === "base"));
  assert.deepEqual(walkForward(tObs, 504, undefined, undefined, trendOnly), evaluateRows(rows, trendOnly.bootstrap));
  const o = buildOutlook(series(spx), series(vix), trendOnly)!;
  assert.equal(o.modelVersion, "test-trend");
  assert.equal(o.pick.basis, "trend");
  assert.equal(buildOutlook(series(spx), series(vix))!.modelVersion, "2026-10-g09");

  // dates 只算指定日期。
  const some = rows.slice(0, 3).map((r) => r.date);
  assert.deepEqual(walkForwardRows(tObs, trendOnly, { dates: some }).map((r) => r.date), some);
});

// 特徵測試（DEFAULT_MODEL，G04 生效）：數值由 2026-10-g01（G01 收縮 k=40 已採用）的程式算出並固定；一個選到 trend+vix，一個退回基準率。
const defaultPinned: [string, number[], PinnedEval, number, string, string, Record<string, number>][] = [
  ["alt300x8000", alternating(8000, 300), { points: 346, hitRate: 0.609826589595, baseHitRate: 0.505780346821, brier: 0.217984235643, brierBase: 0.25404237914, bss: 0.141937513022, bssLow: 0.073320031309, bssHigh: 0.21579054706, firstDate: "2016-12-24", lastDate: "2036-10-25" }, 0.721968536106, "trend+vix", "inconclusive", { base: 171, "trend+vix": 175 }],
  ["alt600x3000-fallback", alt600, { points: 108, hitRate: 0.481481481481, baseHitRate: 0.518518518519, brier: 0.267705074275, brierBase: 0.267705074275, bss: 0, bssLow: 0, bssHigh: 0, firstDate: "2016-12-24", lastDate: "2023-02-18" }, 0.568345323741, "base", "inconclusive", { base: 108 }],
];

test("特徵測試：DEFAULT_MODEL（G04 生效）的 walkForward 與 buildOutlook 輸出固定", () => {
  for (const [name, spx, evaluation, p, basis, call, bases] of defaultPinned) {
    const vix = spx.map(() => 15);
    const obs = buildObservations(series(spx), series(vix));
    assert.deepEqual(roundEval(walkForward(obs)), evaluation, name);
    const o = buildOutlook(series(spx), series(vix))!;
    assert.equal(r12(o.pick.p), p, name);
    assert.equal(o.pick.basis, basis, name);
    assert.equal(o.call, call, name);
    const counts: Record<string, number> = {};
    for (const r of walkForwardRows(obs)) counts[r.basis] = (counts[r.basis] ?? 0) + 1;
    assert.deepEqual(counts, bases, name);
  }
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

test("G01 收縮：shrinkK = nEff 時恰為基準率與條件機率的中點；shrinkK null 與原行為一致；basis 為 base 時 p = p_base", () => {
  const closes = alternating(8000, 300);
  const obs = buildObservations(series(closes), series(closes.map(() => 15)));
  const last = obs.at(-1)!;
  const HARD = { ...DEFAULT_MODEL, shrinkK: null };
  const hard = pickProbability(obs, last.date, last.regime!, HARD)!;
  assert.equal(hard.basis, "trend+vix");
  assert.equal(hard.shrinkWeight, 0);
  const n = hard.conditional!.nEff;
  assert.ok(Math.abs(hard.conditional!.p - hard.base.p) > 0.1);
  // k = n：權重 1/2
  const mid = pickProbability(obs, last.date, last.regime!, { ...DEFAULT_MODEL, shrinkK: n })!;
  assert.equal(mid.basis, hard.basis);
  assert.equal(mid.shrinkWeight, 0.5);
  assert.ok(Math.abs(mid.p - (mid.base.p + mid.conditional!.p) / 2) < 1e-12);
  assert.equal(mid.distinct, hard.distinct);
  // 一般公式（k = 40）
  const k40 = pickProbability(obs, last.date, last.regime!, { ...DEFAULT_MODEL, shrinkK: 40 })!;
  assert.ok(Math.abs(k40.p - (40 * k40.base.p + n * k40.conditional!.p) / (40 + n)) < 1e-12);
  assert.ok(Math.abs(k40.shrinkWeight - n / (40 + n)) < 1e-12);
  // basis 為 base：條件樣本不足，p = p_base，權重 0
  const short = buildObservations(series(Array.from({ length: 900 }, (_, i) => 100 + i)), series(Array.from({ length: 900 }, () => 15)));
  const b = pickProbability(short, day(899), short.at(-1)!.regime!, { ...DEFAULT_MODEL, shrinkK: 40 })!;
  assert.equal(b.basis, "base");
  assert.equal(b.p, b.base.p);
  assert.equal(b.shrinkWeight, 0);
});

// G03：全域 bssLow > 0、條件機率也有差，但「今天這個 cell」在 walk-forward 裡的列數不足 30 → 不給方向。
// 趨勢兩側各有很多段；VIX ≥ 30 只出現在前 3600 天的上升段中（每段 2 個短爆發，共 12 段），最後 60 天再出現，所以今天的 cell = trend+vix(aboveSma200=true, vixStress=true)。
const g03StressSeries = () => {
  const N = 8000;
  const closes = alternating(N, 300);
  const inBurst = (i: number) => {
    const m = i % 600;
    return (m >= 100 && m < 160) || (m >= 190 && m < 250);
  };
  const vix = closes.map((_, i) => ((i < 3600 && inBurst(i)) || i >= N - 60 ? 35 : 15));
  return [series(closes), series(vix)] as const;
};

test("G03：全域 bssLow > 0、pick.distinct，但今天的 cell 在 walk-forward 只有 < 30 列 → inconclusive", () => {
  const [spx, vix] = g03StressSeries();
  const o = buildOutlook(spx, vix)!;
  assert.equal(o.pick.basis, "trend+vix");
  assert.equal(o.pick.distinct, true);
  assert.ok(o.evaluation.bssLow! > 0, `bssLow=${o.evaluation.bssLow}`);
  assert.deepEqual(o.regime, { aboveSma200: true, vixStress: true });
  assert.equal(o.pick.cell, "trend+vix(aboveSma200=true,vixStress=true)");
  assert.ok(o.cellGate.rows < MIN_CELL_ROWS, `rows=${o.cellGate.rows}`);
  assert.equal(o.cellGate.passed, false);
  assert.equal(o.call, "inconclusive");
  assert.ok(o.reasons.some((r) => r.includes("只有") && r.includes("列")));
});

test("G03 空重抽：該 cell 沒有任何列的重抽被跳過；有效重抽 < 1900 時 bssLow 為 null、閘門不過", () => {
  const row = (i: number, cell: string): WalkRow => ({ date: day(i * 21), basis: cell, cell, p: 0.7, pBase: 0.5, y: i % 2, distinct: true });
  // 40 列裡只有 1 列屬於 rare：每次重抽抽不到它的機率約 (39/40)^40 ≈ 36%，有效重抽遠少於 1900
  const rows = Array.from({ length: 40 }, (_, i) => row(i, i === 17 ? "rare" : "common"));
  const ev = cellEvaluations(rows);
  const rare = ev.find((e) => e.cell === "rare")!;
  const common = ev.find((e) => e.cell === "common")!;
  assert.ok(rare.validReplicates < MIN_VALID_REPLICATES && rare.validReplicates > 0, `valid=${rare.validReplicates}`);
  assert.equal(rare.bssLow, null);
  assert.equal(rare.bssHigh, null);
  assert.equal(common.validReplicates, 2000); // 39 列的 cell 不會抽不到
  assert.ok(common.bssLow !== null);
  assert.equal(cellGateOf(ev, "rare").passed, false);
  assert.deepEqual(cellGateOf(ev, "missing"), { rows: 0, runs: 0, bssLow: null, validReplicates: 0, passed: false });
  // 即使列數與段數都夠，bssLow 為 null 就不過
  const okEval: CellEval = { cell: "x", rows: 100, runs: 20, bss: 0.3, bssLow: null, bssHigh: null, mde: 0.1, validReplicates: 1899 };
  assert.equal(cellGateOf([okEval], "x").passed, false);
  assert.equal(cellGateOf([{ ...okEval, bssLow: 0.05, validReplicates: 1900 }], "x").passed, true);
  assert.equal(cellGateOf([{ ...okEval, bssLow: 0.05, rows: 29 }], "x").passed, false);
  assert.equal(cellGateOf([{ ...okEval, bssLow: 0.05, runs: 7 }], "x").passed, false);
  assert.equal(cellGateOf([{ ...okEval, bssLow: 0, validReplicates: 2000 }], "x").passed, false);
  // callOf：distinct 與閘門缺一不可；符號沿用 p ≥ 0.5
  assert.equal(callOf({ p: 0.7, distinct: true }, { passed: true }), "up");
  assert.equal(callOf({ p: 0.4, distinct: true }, { passed: true }), "down");
  assert.equal(callOf({ p: 0.7, distinct: false }, { passed: true }), "inconclusive");
  assert.equal(callOf({ p: 0.7, distinct: true }, { passed: false }), "inconclusive");
});

test("G03 / G08：evaluation.byCell 與 cell 的列數、段數；mde = 2.8 × bootstrap sd（標準差為 0 時 null）；固定種子不依賴列數", () => {
  const closes = alternating(12000, 300);
  const spx = series(closes);
  const vix = series(closes.map(() => 15));
  const obs = buildObservations(spx, vix);
  const rows = walkForwardRows(obs);
  const ev = evaluateRows(rows);
  // 獨立重算 mde：同種子、同一個 stationary 索引序列
  const rand = mulberry32(EVAL_SEED);
  const stats: number[] = [];
  for (let k = 0; k < 2000; k++) stats.push(bssOf(stationaryBootstrapIndices(rows.length, 6, rand).map((i) => rows[i])));
  assert.ok(Math.abs(ev.mde! - 2.8 * sdOf(stats)) < 1e-9, `${ev.mde} vs ${2.8 * sdOf(stats)}`);
  const sorted = [...stats].sort((a, b) => a - b);
  assert.equal(ev.bssLow, sorted[50]);
  assert.equal(ev.bssHigh, sorted[1950]);
  // byCell：列數加總 = 列數；runs 由原始順序數出
  assert.equal(ev.byCell.reduce((a, c) => a + c.rows, 0), rows.length);
  const t = ev.byCell.find((c) => c.cell === "trend+vix(aboveSma200=true,vixStress=false)")!;
  assert.equal(t.rows, rows.filter((r) => r.cell === t.cell).length);
  let runs = 0;
  rows.forEach((r, i) => {
    if (r.cell === t.cell && (i === 0 || rows[i - 1].cell !== t.cell)) runs++;
  });
  assert.equal(t.runs, runs);
  assert.ok(t.mde !== null && t.mde > 0);
  // 全部列 p = pBase 時 BSS 恆為 0、sd 為 0 → mde null
  const flat = rows.map((r) => ({ ...r, p: r.pBase }));
  assert.equal(evaluateRows(flat).mde, null);
  assert.equal(evaluateRows(flat.slice(0, 11)).mde, null);
  // 與列數無關的固定種子：同一批列重複算結果一樣；舊區塊法的 mde 也有（LEGACY）
  assert.deepEqual(evaluateRows(rows), ev);
  assert.ok(evaluateRows(rows, LEGACY.bootstrap).mde !== undefined);
});

test("G08 (2)：隨機漫步在每個相位 offset 0..20 都是 inconclusive（point-in-time）", () => {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let q = 100;
  const closes = Array.from({ length: 6000 }, () => (q *= 1 + (rnd() - 0.5) * 0.02));
  const obs = buildObservations(series(closes), series(closes.map(() => 15)));
  const grid = phaseGrid(obs, 504, PHASES);
  assert.equal(grid.length, 21);
  const knownOn = new Map(obs.map((o) => [o.date, o.knownOn]));
  let total = 0;
  for (let o = 0; o < PHASES; o++) {
    const rows = walkForwardRows(obs, DEFAULT_MODEL, { dates: grid[o].map((i) => obs[i].date) });
    total += rows.length;
    const calls = pointInTimeCalls(rows, knownOn);
    assert.ok(calls.every((c) => c === "inconclusive"), `offset ${o}: ${calls.filter((c) => c !== "inconclusive").length} 個方向`);
  }
  assert.ok(total > 21 * 50, `rows=${total}`);
  // 正式版在序列末端也不給方向
  assert.equal(buildOutlook(series(closes), series(closes.map(() => 15)))!.call, "inconclusive");
});

test("G08 (4) 正向對照：訊號強、滿足 G04 與 G03 (b)(c) 的合成序列，cell bssLow > 0 並給方向", () => {
  const closes = alternating(12000, 300);
  const o = buildOutlook(series(closes), series(closes.map(() => 15)))!;
  assert.equal(o.pick.basis, "trend+vix");
  assert.ok(o.pick.conditional!.nEff >= 30 && o.pick.conditional!.episodes >= MIN_EPISODES);
  assert.equal(o.pick.distinct, true);
  assert.ok(o.cellGate.rows >= MIN_CELL_ROWS, `rows=${o.cellGate.rows}`);
  assert.ok(o.cellGate.runs >= MIN_CELL_RUNS, `runs=${o.cellGate.runs}`);
  assert.ok(o.cellGate.bssLow! > 0, `bssLow=${o.cellGate.bssLow}`);
  assert.ok(o.cellGate.validReplicates >= MIN_VALID_REPLICATES);
  assert.equal(o.cellGate.passed, true);
  assert.notEqual(o.call, "inconclusive");
  const mine = o.evaluation.byCell.find((c) => c.cell === o.pick.cell)!;
  assert.equal(mine.bssLow, o.cellGate.bssLow);
  assert.ok(mine.mde! > 0);
});

test("G03 (d)：兩個列數與段數都夠的 cell，一個有 skill、一個反向；全域 bssLow > 0，反向 cell 的 bssLow 仍 ≤ 0 且閘門不過", () => {
  // 10 輪：每輪 A 連續 12 列（預測 0.95 對的方向）、B 連續 4 列（預測 0.45 偏向錯的方向，比基準 0.5 更差）。
  const rows: WalkRow[] = [];
  for (let round = 0; round < 10; round++) {
    for (let k = 0; k < 16; k++) {
      const i = rows.length;
      const y = i % 2;
      const skilled = k < 12;
      const p = skilled ? (y ? 0.95 : 0.05) : y ? 0.45 : 0.55;
      rows.push({ date: day(i * 21), basis: skilled ? "A" : "B", cell: skilled ? "A" : "B", p, pBase: 0.5, y, distinct: true });
    }
  }
  const ev = cellEvaluations(rows);
  const a = ev.find((e) => e.cell === "A")!;
  const b = ev.find((e) => e.cell === "B")!;
  assert.ok(a.rows >= 30 && a.runs >= 8 && b.rows >= 30 && b.runs >= 8, `A ${a.rows}/${a.runs} B ${b.rows}/${b.runs}`);
  // 全域 bssLow > 0（A 的 skill 蓋過 B 的反向），所以若 B 的重抽誤用全域 BSS 就會過閘門
  assert.ok(evaluateRows(rows).bssLow! > 0, `global bssLow=${evaluateRows(rows).bssLow}`);
  assert.ok(a.bss > 0.5 && a.bssLow! > 0);
  assert.ok(b.bss < 0, `B bss=${b.bss}`);
  assert.ok(b.bssLow !== null && b.bssLow <= 0, `B bssLow=${b.bssLow}`);
  assert.equal(cellGateOf(ev, "A").passed, true);
  assert.equal(cellGateOf(ev, "B").passed, false);
  // 今天的 cell 是反向的那個：即使 pick.distinct，也不給方向；是 skill 的那個才給。
  assert.equal(callOf({ p: 0.45, distinct: true }, cellGateOf(ev, "B")), "inconclusive");
  assert.equal(callOf({ p: 0.95, distinct: true }, cellGateOf(ev, "A")), "up");
});

// ---- D4／G09：dd5 目標 ----

test("D4 標籤：21 個交易日內任一收盤 ≤ 95% 才為 1；最後 21 列為 null；knownOn 與 up 相同", () => {
  const n = 60;
  const closes = Array.from({ length: n }, () => 100);
  closes[15] = 94; // 距 t=0 為 15 天內、跌 6% → dd5
  closes[40] = 96; // 跌 4%：不算
  const obs = buildObservations(series(closes), series(closes.map(() => 15)));
  assert.equal(obs[0].dd5, true);
  assert.equal(obs[0].knownOn, day(21));
  // t=19：窗口 t+1..t+21 = 20..40，只有 96（−4%）→ 0
  assert.equal(obs[19].dd5, false);
  // t=16..（窗口含 40 但不含 15）；t=-: 窗口剛好包含第 15 天的最後一個 t 是 14
  assert.equal(obs[14].dd5, true);
  assert.equal(obs[15].dd5, false);
  for (let i = n - HORIZON; i < n; i++) assert.equal(obs[i].dd5, null, `row ${i}`);
  assert.equal(obs[n - HORIZON - 1].dd5 !== null, true);
  // 恰好 −5% 也算（≤）
  const edge = Array.from({ length: 30 }, () => 100);
  edge[5] = 95;
  assert.equal(buildObservations(series(edge), series(edge.map(() => 15)))[0].dd5, true);
  // 21 日報酬
  assert.equal(obs[0].ret, 0);
  assert.ok(Math.abs(obs[19].ret! - (closes[40] / closes[19] - 1)) < 1e-12);
});

function dd5Obs(n: number): Observation[] {
  const rand = mulberry32(11);
  const flags: { a: boolean; v: boolean }[] = [];
  return Array.from({ length: n }, (_, i) => {
    const b = Math.floor(i / 30);
    flags[b] ??= { a: rand() > 0.4, v: rand() > 0.5 };
    const { a, v } = flags[b];
    const known = i + 21 < n;
    return {
      date: day(i),
      close: 100,
      regime: { aboveSma200: a, vixStress: v },
      up: known ? rand() > 0.35 : null,
      knownOn: known ? day(i + 21) : null,
      dd5: known ? rand() < (v ? 0.7 : 0.1) : null,
      ret: known ? rand() * 0.1 - 0.05 : null,
    };
  });
}

test("dd5 的 pick／walk-forward：regime 相關的回撤機率被抓到，且有 skill", () => {
  const obs = dd5Obs(4000);
  const asOf = day(3999);
  const calm = pickProbability(obs, asOf, { aboveSma200: true, vixStress: false }, DEFAULT_MODEL, "dd5")!;
  const stress = pickProbability(obs, asOf, { aboveSma200: true, vixStress: true }, DEFAULT_MODEL, "dd5")!;
  assert.equal(stress.basis, "trend+vix");
  assert.ok(stress.p > 0.5 && calm.p < 0.25, `${stress.p} ${calm.p}`);
  assert.ok(Math.abs(stress.base.p - conditionalRate(obs, asOf, {}, "dd5")!.p) < 1e-12);
  const ev = walkForward(obs, 504, undefined, undefined, DEFAULT_MODEL, "dd5");
  assert.ok(ev.bssLow! > 0, `bssLow ${ev.bssLow}`);
  assert.ok(ev.points > 50);
  // up 目標不受 dd5 標籤影響：up 的 base 與只看 up 欄位一致。
  const upBase = conditionalRate(obs, asOf)!;
  const upOnly = conditionalRate(obs.map((o) => ({ ...o, dd5: null })), asOf)!;
  assert.deepEqual(upBase, upOnly);
  const rows = walkForwardRows(obs, DEFAULT_MODEL, { label: "dd5" });
  assert.ok(rows.every((r) => r.y === 0 || r.y === 1));
});

test("G09 計分判定：全域 bssLow > 0 且所用 cell nEff ≥ 30、段數 ≥ 8", () => {
  const obs = dd5Obs(4000);
  const pick = pickProbability(obs, day(3999), { aboveSma200: true, vixStress: true }, DEFAULT_MODEL, "dd5")!;
  const ev = walkForward(obs, 504, undefined, undefined, DEFAULT_MODEL, "dd5");
  assert.equal(drawdownScored(pick, ev), true);
  assert.equal(drawdownScored(pick, { ...ev, bssLow: -0.01 }), false);
  assert.equal(drawdownScored(pick, { ...ev, bssLow: null }), false);
  const thin = { ...pick, conditional: { ...pick.conditional!, nEff: 29 } };
  assert.equal(drawdownScored(thin, ev), false);
  assert.equal(drawdownScored({ ...pick, conditional: { ...pick.conditional!, episodes: 7 } }, ev), false);
});

test("returnQuantiles：已知分佈的 10／50／90 百分位，只用 asOf 已知且符合條件的列", () => {
  const obs: Observation[] = Array.from({ length: 150 }, (_, i) => ({
    date: day(i), close: 100, regime: { aboveSma200: i < 100, vixStress: false }, up: true, knownOn: day(i + 21), dd5: false, ret: i < 100 ? i / 100 : 9,
  }));
  const q = returnQuantiles(obs, day(1000), { aboveSma200: true })!;
  assert.equal(q.n, 100);
  assert.ok(Math.abs(q.p10 - 0.099) < 1e-12 && Math.abs(q.p50 - 0.495) < 1e-12 && Math.abs(q.p90 - 0.891) < 1e-12);
  // knownOn ≤ asOf：asOf = day(60) 只含 i + 21 ≤ 60 的列（i = 0..39）
  assert.equal(returnQuantiles(obs, day(60), { aboveSma200: true })!.n, 40);
  assert.equal(returnQuantiles(obs, day(0)), null);
  assert.equal(returnQuantiles(obs, day(1000))!.n, 150);
});

test("buildOutlook 帶 drawdown 與 returnQuantiles（加法式），up 的欄位不變", () => {
  const n = 1200;
  const rand = mulberry32(5);
  let px = 100;
  const closes = Array.from({ length: n }, () => (px *= 1 + (rand() - 0.47) * 0.02));
  const o = buildOutlook(series(closes), series(closes.map(() => 15)))!;
  assert.ok(o.drawdown.pick.base.p >= 0 && o.drawdown.pick.base.p <= 1);
  assert.equal(typeof o.drawdown.scored, "boolean");
  assert.ok(o.drawdown.cellGate && o.drawdown.evaluation.points > 0);
  assert.ok(o.returnQuantiles.all!.p10 < o.returnQuantiles.all!.p50 && o.returnQuantiles.all!.p50 < o.returnQuantiles.all!.p90);
  assert.ok(o.returnQuantiles.cell!.n > 0);
  assert.equal(o.modelVersion, "2026-10-g09");
});

// ---- T11 review：不變量守護 ----

test("D4 窗口終點：唯一的 ≤95% 恰在 t+21 → true；只在 t+22 → false", () => {
  const mk = (k: number) => {
    const c = Array.from({ length: 60 }, () => 100);
    c[k] = 95;
    return buildObservations(series(c), series(c.map(() => 15)))[0].dd5;
  };
  assert.equal(mk(21), true);
  assert.equal(mk(22), false);
  assert.equal(mk(1), true);
  assert.equal(mk(0 + 20), true);
});

/** VIX 以 30 天為一段在 35／15 之間隨機切換；高 VIX 段的指數大幅下跌（多有 ≥5% 回撤），低 VIX 段幾乎不動。 */
function blockSeries(n: number, stressDrift: number, calmNoise: number) {
  const rand = mulberry32(21);
  const vix: number[] = [];
  const spx: number[] = [];
  let px = 1000;
  const stress: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const b = Math.floor(i / 30);
    stress[b] ??= rand() > 0.5;
    vix.push(stress[b] ? 35 : 15);
    px *= stress[b] ? 1 + stressDrift + (rand() - 0.5) * 0.004 : 1 + (rand() - 0.5) * calmNoise;
    spx.push(px);
  }
  return { spx, vix };
}

test("point-in-time：dd5 標籤成熟前不計入；asOf 之後的價格改變不影響 dd5 的 pick 與分位數", () => {
  const obs = dd5Obs(400);
  const j = 100;
  assert.equal(obs[j].knownOn, day(j + 21));
  const before = conditionalRate(obs, day(j + 20), {}, "dd5")!;
  const at = conditionalRate(obs, day(j + 21), {}, "dd5")!;
  assert.equal(at.days - before.days, 1);
  // 只有第 j 天一筆 dd5 = true 的情況下，成熟日當天才看得到
  const only = obs.map((o, i) => ({ ...o, dd5: i < 400 - 21 ? i === j : null }));
  assert.equal(conditionalRate(only, day(j + 20), {}, "dd5")?.p ?? 0, 0);
  assert.ok(conditionalRate(only, day(j + 21), {}, "dd5")!.p > 0);

  const { spx, vix } = blockSeries(1500, -0.004, 0.002);
  const o1 = buildObservations(series(spx), series(vix));
  // 挑一個 m，使 m−20..m 的 dd5 在原序列都是 false（崩盤只會把它們改成 true）
  let m = 1200;
  while (o1.slice(m - 20, m + 1).some((o) => o.dd5 !== false)) m++;
  const crash = spx.map((c, i) => (i > m ? c * 0.4 : c));
  const o2 = buildObservations(series(crash), series(vix));
  const asOf = day(m);
  const regime = o1[m].regime!;
  assert.deepEqual(o2[m].regime, regime);
  assert.deepEqual(pickProbability(o1, asOf, regime, DEFAULT_MODEL, "dd5"), pickProbability(o2, asOf, regime, DEFAULT_MODEL, "dd5"));
  assert.deepEqual(returnQuantiles(o1, asOf, regime), returnQuantiles(o2, asOf, regime));
  assert.deepEqual(returnQuantiles(o1, asOf), returnQuantiles(o2, asOf));
  // 確認 m−20..m 的 dd5 標籤確實被崩盤改變（否則上面的比較沒有鑑別力）
  assert.ok(o1.slice(m - 20, m + 1).some((o, i) => o.dd5 !== o2[m - 20 + i].dd5));
});

test("scored 接線：drawdown.evaluation = dd5 的 walkForward；明確成立與明確不成立的情境", () => {
  const good = blockSeries(4000, -0.004, 0.002);
  const og = buildOutlook(series(good.spx), series(good.vix))!;
  const obsG = buildObservations(series(good.spx), series(good.vix));
  assert.deepEqual(og.drawdown.evaluation, walkForward(obsG, 504, undefined, undefined, DEFAULT_MODEL, "dd5"));
  assert.notDeepEqual(og.drawdown.evaluation, walkForward(obsG, 504, undefined, undefined, DEFAULT_MODEL, "up"));
  assert.ok(og.drawdown.evaluation.bssLow! > 0);
  assert.equal(og.drawdown.scored, true);

  // 低波動、從不出現 ≥5% 回撤：dd5 標籤全為 0，BSS 下界不會 > 0
  const bad = blockSeries(4000, 0.0001, 0.002);
  const ob = buildOutlook(series(bad.spx), series(bad.vix))!;
  assert.ok(!(ob.drawdown.evaluation.bssLow! > 0));
  assert.equal(ob.drawdown.scored, false);
});

test("returnQuantiles.cell 用的是所選 cell：n 小於 .all，且等於符合該 cell 的已知列數", () => {
  const { spx, vix } = blockSeries(4000, -0.004, 0.002);
  const o = buildOutlook(series(spx), series(vix))!;
  assert.notEqual(o.drawdown.pick.basis, "base");
  const obs = buildObservations(series(spx), series(vix));
  const cond = condOfPick(o.drawdown.pick, o.regime);
  assert.ok(Object.keys(cond).length > 0);
  assert.equal(o.returnQuantiles.cell!.n, returnQuantiles(obs, o.asOf, cond)!.n);
  assert.ok(o.returnQuantiles.cell!.n < o.returnQuantiles.all!.n);
});

test("harness：paired／MC／null 都帶 label，up 與 dd5 結果不同", () => {
  const obs = dd5Obs(3000);
  const cand: ModelConfig = { ...DEFAULT_MODEL, shrinkK: null };
  const opts = { resamples: 60 };
  const f = (label: "up" | "dd5") => ({
    paired: pairedPhaseAveraged(obs, obs, DEFAULT_MODEL, cand, { ...opts, label }).mean,
    diff: pairedBrierDiffPhase(obs, obs, DEFAULT_MODEL, cand, { ...opts, label }).mean,
    mc: pairedMcStdErr(obs, obs, DEFAULT_MODEL, cand, { ...opts, label }).values,
    diffMc: pairedBrierDiffMcStdErr(obs, obs, DEFAULT_MODEL, cand, { ...opts, label }).values,
    nul: nullPairedBss(obs, obs, DEFAULT_MODEL, cand, { N: 3, label }).values,
  });
  const u = f("up");
  const d = f("dd5");
  for (const k of ["paired", "diff", "mc", "diffMc", "nul"] as const) assert.notDeepEqual(u[k], d[k], k);
  // 預設 label 仍是 up
  assert.equal(pairedPhaseAveraged(obs, obs, DEFAULT_MODEL, cand, opts).mean, u.paired);
  assert.deepEqual(nullPairedBss(obs, obs, DEFAULT_MODEL, cand, { N: 3 }).values, u.nul);
});
