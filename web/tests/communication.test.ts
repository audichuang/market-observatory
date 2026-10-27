import assert from "node:assert/strict";
import { test } from "node:test";
import { LIVE_MIN_N, NO_INCREMENTAL_SKILL, PROPORTION_INTERVAL, SKILL_INTERVAL, dd5Definition, dd5ShortLabel, frequencySentences, upTargetLabel, liveTrackOf, naturalFrequency, outOfCent, outOfTen } from "../src/lib/communication.ts";
import { DEFAULT_MODEL, assessmentsOf, reasonsOf, buildOutlook, type Assessments, type CellGate } from "../src/lib/forecast.ts";
import { Series } from "../src/lib/analytics.ts";

const day = (i: number) => new Date(Date.UTC(2020, 0, 1) + i * 864e5).toISOString().slice(0, 10);
const rate = (p: number, episodes: number) => ({ p, days: 1000, nEff: 47, episodes, low: p - 0.1, high: p + 0.1 });

test("自然頻率：每 100 次、用收縮後 pick.p、不顯著時只講平常", () => {
  assert.equal(outOfTen(0.64), 6);
  assert.equal(outOfCent(0.6395), 64);
  // 正式站實際數字：up p 0.6517 / base 0.6395，不顯著
  assert.equal(
    naturalFrequency({ p: 0.6517, base: rate(0.6395, 24), conditional: rate(0.66, 14) }, "up", false),
    "尚未偵測到增額預測力；平常是每 100 次有 64 次 21 個交易日後收高",
  );
  // 顯著：兩個數字都顯示，附段數
  assert.equal(
    naturalFrequency({ p: 0.82, base: rate(0.69, 24), conditional: rate(0.9, 9) }, "up", true),
    "過去像今天這樣的時期，大約每 100 次有 82 次 21 個交易日後收高（平常是每 100 次有 69 次），依據 9 段獨立時期",
  );
  // drawdown 已計分：12 vs 17
  assert.equal(
    naturalFrequency({ p: 0.1192, base: rate(0.1659, 24), conditional: rate(0.1, 11) }, "dd5", true),
    "過去像今天這樣的時期，大約每 100 次有 12 次 21 個交易日內至少有一天收盤比起點低 5% 以上（平常是每 100 次有 17 次），依據 11 段獨立時期",
  );
  assert.equal(
    naturalFrequency({ p: 0.1192, base: rate(0.1659, 24), conditional: null }, "dd5", false),
    "尚未偵測到條件與平常的差別；平常是每 100 次有 17 次 21 個交易日內至少有一天收盤比起點低 5% 以上",
  );
  // 不 distinct 但有 G01 收縮（p ≠ base）：主數字是收縮後的 p，句子不能宣稱頁面「採」平常的比例
  for (const [pick, kind] of [
    [{ p: 0.6517, base: rate(0.6395, 24), conditional: rate(0.66, 14) }, "up"],
    [{ p: 0.31, base: rate(0.26, 24), conditional: rate(0.4, 6) }, "dd5"],
  ] as const) {
    const s = naturalFrequency(pick, kind, false);
    assert.ok(!/採/.test(s), s);
    assert.ok(s.includes(`平常是每 100 次有 ${outOfCent(pick.base.p)} 次`), s);
  }
  // basis 為 base（沒有條件）：不印段數
  assert.ok(!/段/.test(naturalFrequency({ p: 0.7, base: rate(0.7, 24), conditional: null }, "up", true)));
});

// 每天一列的假 forecasts；SPX 每天 +1（一定上漲），所以結果可預期。
const points = Array.from({ length: 400 }, (_, i) => ({ date: day(i), close: 100 + i }));
const fakeRows = (idxs: number[], p = 0.7, base = 0.6) => idxs.map((i) => ({ date: day(i), p, base, close: points[i].close }));

test("上線後紀錄只取不重疊列：從第一筆起每 21 個交易日", () => {
  const all = fakeRows(Array.from({ length: 200 }, (_, i) => 50 + i));
  const t = liveTrackOf(all, points);
  // 50, 71, 92, ... 最後一個到期列需 i+21 ≤ 399 → i ≤ 378；200 列涵蓋 50..249，格點 50+21k ≤ 249 → k=0..9
  assert.equal(t.n, 10);
  assert.equal(t.resolvedAll, 200);
  assert.equal(t.tooFew, true);
  assert.equal(t.bss, null);
  assert.equal(t.upShare, 1);
});

test("格點上沒有紀錄就略過、不遞補；未到期不算；輸入順序無關", () => {
  const rows = fakeRows([10, 31, 53, 52, 73, 94, 380]).reverse();
  const t = liveTrackOf(rows, points);
  // 格點：10, 31, 52, 73, 94（53 與 380 不在格點；52 在）；380 不在格點且未到期
  assert.equal(t.n, 5);
  const late = liveTrackOf(fakeRows([10, 31, 52, 73, 94, 115, 136, 157, 178, 199, 220, 241, 262, 283, 304, 325, 346, 367, 388]), points);
  // 367 的 t+21=388 到期；388 未到期
  assert.equal(late.n, 18);
  assert.equal(late.resolvedAll, 18);
});

test("上線後 BSS：n ≥ 12 才報；用列內存的 base_rate", () => {
  const idxs = Array.from({ length: LIVE_MIN_N }, (_, k) => 20 + 21 * k);
  const t = liveTrackOf(fakeRows(idxs, 0.9, 0.6), points);
  assert.equal(t.n, LIVE_MIN_N);
  assert.equal(t.tooFew, false);
  // y=1：Brier = 0.01、基準 = 0.16 → BSS = 1 − 0.01/0.16
  assert.ok(Math.abs(t.bss! - (1 - 0.01 / 0.16)) < 1e-12);
  assert.equal(liveTrackOf([], points).n, 0);
});

const gate = (over: Partial<CellGate> = {}): CellGate => ({ rows: 60, runs: 12, bssLow: 0.05, validReplicates: 2000, passed: true, ...over });

test("assessmentsOf：各項狀態", () => {
  const cond = rate(0.85, 12);
  const base = rate(0.65, 30);
  const pick = { p: 0.8, basis: "trend", cell: "c", base, conditional: cond, distinct: true, shrinkWeight: 0.5 };
  const ev = { bss: 0.1, bssLow: 0.02, byCell: [{ cell: "c", rows: 60, runs: 12, bss: 0.1, bssLow: 0.05, bssHigh: 0.2, mde: 0.08, validReplicates: 2000 }] } as never;
  const a = assessmentsOf({ pick, evaluation: ev, gate: gate(), spxDate: "2026-10-23", vixDate: "2026-10-22", staleSessions: 1, cfg: DEFAULT_MODEL });
  assert.deepEqual([a.difference.status, a.sampleAdequacy.status, a.trackRecord.status, a.dataFreshness.status], ["pass", "pass", "pass", "pass"]);
  assert.equal(a.trackRecord.cellMde, 0.08);
  const b = assessmentsOf({ pick: { ...pick, distinct: false }, evaluation: ev, gate: gate(), spxDate: "x", vixDate: "y", staleSessions: 4, cfg: DEFAULT_MODEL });
  assert.equal(b.difference.status, "fail");
  assert.equal(b.dataFreshness.status, "fail");
  const c = assessmentsOf({ pick: { ...pick, conditional: null, distinct: false, basis: "base", cell: "base" }, evaluation: ev, gate: gate({ rows: 0, runs: 0, bssLow: null, passed: false }), spxDate: "x", vixDate: "y", staleSessions: 0, cfg: DEFAULT_MODEL });
  assert.equal(c.sampleAdequacy.status, "na");
  assert.equal(c.trackRecord.status, "na");
});

function consistent(a: Assessments, call: string, label: string) {
  const st = Object.values(a).map((x) => x.status);
  if (call !== "inconclusive") assert.ok(st.every((s) => s === "pass"), `${label}: call ${call} 但評估項 ${st}`);
  if (st.includes("fail")) assert.equal(call, "inconclusive", `${label}: 有 fail 卻給方向`);
}

test("buildOutlook：assessments 與 call 不矛盾（多種合成序列）", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const closes: number[] = [];
    let x = 3000;
    let s = seed * 7919;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    // 高低波動交替的區塊：有些 seed 會形成可驗證的訊號
    for (let i = 0; i < 2400; i++) {
      const stress = Math.floor(i / 180) % 2 === 1;
      x *= 1 + (stress ? -0.0004 * seed : 0.0008) + (rnd() - 0.5) * 0.01;
      closes.push(x);
    }
    const spx = new Series(closes.map((close, i) => ({ date: day(i), close })));
    const vix = new Series(closes.map((_, i) => ({ date: day(i), close: Math.floor(i / 180) % 2 === 1 ? 35 : 15 })));
    const o = buildOutlook(spx, vix);
    if (!o) continue;
    consistent(o.assessments, o.call, `seed ${seed}`);
  }
});

test("A2：上線後紀錄以存下的起始收盤對帳，事後改歷史價不影響", () => {
  const idxs = Array.from({ length: LIVE_MIN_N }, (_, k) => 20 + 21 * k);
  const rows = fakeRows(idxs, 0.9, 0.6);
  const before = liveTrackOf(rows, points);
  // 歷史序列的起始價被事後改成很高（若用它對帳，結果會變成下跌）
  const revised = points.map((p, i) => (idxs.includes(i) ? { ...p, close: p.close * 10 } : p));
  assert.deepEqual(liveTrackOf(rows, revised), before);
  // 存下的起始收盤高於 21 日後 → 下跌
  const down = liveTrackOf(rows.map((r) => ({ ...r, close: 1e6 })), points);
  assert.equal(down.upShare, 0);
});

test("A1：reasons 只由未通過的評估項產生；全域警語另列", () => {
  const cond = rate(0.85, 12);
  const base = rate(0.65, 30);
  const pick = { p: 0.8, basis: "trend", cell: "c", base, conditional: cond, distinct: true, shrinkWeight: 0.5 };
  const ev = { bss: -0.1, bssLow: -0.2, byCell: [{ cell: "c", rows: 60, runs: 12, bss: 0.1, bssLow: 0.05, bssHigh: 0.2, mde: 0.08, validReplicates: 2000 }] } as never;
  const a = assessmentsOf({ pick, evaluation: ev, gate: gate(), spxDate: "x", vixDate: "x", staleSessions: 0, cfg: DEFAULT_MODEL });
  assert.deepEqual(reasonsOf(a), []);
  const a2 = assessmentsOf({ pick: { ...pick, distinct: false }, evaluation: ev, gate: gate(), spxDate: "x", vixDate: "x", staleSessions: 0, cfg: DEFAULT_MODEL });
  assert.equal(reasonsOf(a2).length, 1);
});

test("drawdown 自然頻率看 distinct、不看 scored", () => {
  const up = { p: 0.65, base: rate(0.64, 24), conditional: rate(0.66, 14), distinct: false };
  const dd = (distinct: boolean) => ({ p: 0.15, base: rate(0.26, 24), conditional: rate(0.12, 10), distinct });
  // distinct 且未計分：兩個數字都顯示（15 vs 26）
  assert.equal(
    frequencySentences({ pick: up, drawdown: { pick: dd(true), scored: false } }).dd5,
    "過去像今天這樣的時期，大約每 100 次有 15 次 21 個交易日內至少有一天收盤比起點低 5% 以上（平常是每 100 次有 26 次），依據 10 段獨立時期",
  );
  // 不 distinct 但已計分：只講平常
  assert.equal(
    frequencySentences({ pick: up, drawdown: { pick: dd(false), scored: true } }).dd5,
    "尚未偵測到條件與平常的差別；平常是每 100 次有 26 次 21 個交易日內至少有一天收盤比起點低 5% 以上",
  );
  assert.match(frequencySentences({ pick: up, drawdown: { pick: dd(false), scored: false } }).up, /^尚未偵測到增額預測力/);
});

test("dd5 定義：以資料日收盤為起點、21 個交易日內至少一天低 5% 以上；不寫「今天」", () => {
  assert.equal(dd5Definition(), "以資料日收盤為起點，未來 21 個交易日內至少有一天收盤比它低 5% 以上");
  assert.equal(dd5ShortLabel(), "21 個交易日內至少一天比資料日收盤低 5% 以上的機率");
  for (const s of [dd5Definition(), dd5ShortLabel()]) assert.ok(!s.includes("今天"));
  assert.equal(dd5Definition(21), "以資料日收盤為起點，未來 21 個交易日內至少有一天收盤比它低 5% 以上");
  assert.equal(dd5ShortLabel(21), "21 個交易日內至少一天比資料日收盤低 5% 以上的機率");
  assert.equal(upTargetLabel(21), "約 21 個交易日後收盤高於資料日");
});

test("U-01 與 D-04 文案：不說與平常差不多；兩種區間分名", () => {
  const base = rate(0.64, 24);
  const sentences = [naturalFrequency({ p: 0.65, base, conditional: rate(0.66, 14) }, "up", false), naturalFrequency({ p: 0.17, base, conditional: null }, "dd5", false)];
  for (const s of sentences) assert.ok(!/差不多|接近平常/.test(s), s);
  assert.ok(sentences[0].startsWith(NO_INCREMENTAL_SKILL));
  assert.notEqual(PROPORTION_INTERVAL, SKILL_INTERVAL);
  assert.match(PROPORTION_INTERVAL, /歷史比例/);
  assert.match(SKILL_INTERVAL, /預測力.*不是今天/);
});
