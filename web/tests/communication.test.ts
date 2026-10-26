import assert from "node:assert/strict";
import { test } from "node:test";
import { LIVE_MIN_N, liveTrackOf, naturalFrequency, outOfTen } from "../src/lib/communication.ts";
import { DEFAULT_MODEL, assessmentsOf, buildOutlook, type Assessments, type CellGate } from "../src/lib/forecast.ts";
import { Series } from "../src/lib/analytics.ts";

const day = (i: number) => new Date(Date.UTC(2020, 0, 1) + i * 864e5).toISOString().slice(0, 10);
const rate = (p: number, episodes: number) => ({ p, days: 1000, nEff: 47, episodes, low: p - 0.1, high: p + 0.1 });

test("自然頻率：每 10 次、四捨五入、依據段數", () => {
  assert.equal(outOfTen(0.64), 6);
  assert.equal(outOfTen(0.65), 7);
  assert.equal(outOfTen(0.049), 0);
  assert.equal(
    naturalFrequency(rate(0.82, 9), rate(0.69, 24), "up"),
    "過去像今天這樣的時期，大約每 10 次有 8 次 21 個交易日後收高（平常是每 10 次有 7 次），依據 9 段獨立時期",
  );
  assert.equal(
    naturalFrequency(rate(0.31, 11), rate(0.18, 24), "dd5"),
    "過去像今天這樣的時期，大約每 10 次有 3 次 21 個交易日內出現 ≥5% 回撤（平常是每 10 次有 2 次），依據 11 段獨立時期",
  );
  // 沒有條件時用基準率
  assert.match(naturalFrequency(null, rate(0.7, 24), "up"), /每 10 次有 7 次.*平常是每 10 次有 7 次.*依據 24 段/);
});

// 每天一列的假 forecasts；SPX 每天 +1（一定上漲），所以結果可預期。
const points = Array.from({ length: 400 }, (_, i) => ({ date: day(i), close: 100 + i }));
const fakeRows = (idxs: number[], p = 0.7, base = 0.6) => idxs.map((i) => ({ date: day(i), p, base }));

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
