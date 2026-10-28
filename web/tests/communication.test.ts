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

// --- L4: forecast live tracks ---
import { dd5ClassOf, dd5LiveTrackOf, publishStatusOf, upClassOf } from "../src/lib/communication.ts";
import { expectedSessions } from "../src/lib/calendar.ts";

const dd5Detail = (lag = 0, modelVersion = "dd5-v1", p = 0.8, base = 0.2) =>
  JSON.stringify({ recordedLagSessions: lag, drawdown: { p, base, modelVersion } });

test("dd5 分類：準時 lag 0 即時、lag 2 或逾時補記；缺資格欄位或時限不明優先歸不明", () => {
  const date = "2026-03-06";
  const onTime = "2026-03-06T22:00:00Z";
  assert.equal(dd5ClassOf(dd5Detail(), date, onTime), "realtime");
  assert.equal(dd5ClassOf(dd5Detail(2), date, onTime), "delayed");
  assert.equal(dd5ClassOf(dd5Detail(), date, "2026-03-09T22:00:00Z"), "delayed");
  assert.equal(dd5ClassOf(dd5Detail(2), date, "x"), "unknown");
  for (const detail of [null, "{", "null", JSON.stringify({ drawdown: { p: 0.1, base: 0.2, modelVersion: "v1" } }),
    ...["p", "base", "modelVersion"].map((key) => {
      const d = JSON.parse(dd5Detail(2));
      delete d.drawdown[key];
      return JSON.stringify(d);
    }), dd5Detail(2, ""), dd5Detail(2, "v1", "0.1" as never)]) {
    for (const createdAt of [onTime, "2026-03-09T22:00:00Z"]) {
      assert.equal(dd5ClassOf(detail, date, createdAt), "unknown", String(detail));
    }
  }
});

const dd5Dates = expectedSessions("2026-01-02", "2027-06-30");
const dd5Points = (n: number) => dd5Dates.slice(0, n).map((date) => ({ date, close: 100 }));
const dd5Row = (i: number, detail: string | null = dd5Detail()) => ({ date: dd5Dates[i], close: 100, detail, created_at: `${dd5Dates[i]}T22:00:00Z` });

test("dd5 格線：從第一筆即時列起，全部版本共用；補記格點略過不遞補", () => {
  const result = dd5LiveTrackOf([
    dd5Row(64, dd5Detail(0, "v2")), dd5Row(0, null), dd5Row(1), dd5Row(2, dd5Detail(0, "off-grid")),
    dd5Row(22, dd5Detail(0, "v2")), dd5Row(43, dd5Detail(2)), dd5Row(44, dd5Detail(0, "off-grid")),
  ], dd5Points(86));
  assert.equal(result.realtime, 5);
  assert.equal(result.delayed, 1);
  assert.equal(result.unknown, 1);
  assert.deepEqual(result.groups.map((g) => [g.modelVersion, g.n]), [["dd5-v1", 1], ["v2", 2]]);
  assert.equal(result.note, "只計即時發布的列（寫入時是最新交易日，且在下一個交易日美東 16:30 前寫入）；延遲補記 1 列、資格不明 1 列另列、不計分。依模型版本分開計分。");
});

test("PUB-1 逾時 lag 0 列不作 dd5 格線起點，逾時格點略過不遞補", () => {
  const rows = [dd5Row(0), dd5Row(1), dd5Row(21), dd5Row(22), dd5Row(23), dd5Row(43)];
  rows[0].created_at = `${dd5Dates[1]}T22:00:00Z`;
  rows[3].created_at = `${dd5Dates[23]}T22:00:00Z`;
  const result = dd5LiveTrackOf(rows, dd5Points(65));
  assert.equal(result.realtime, 4);
  assert.equal(result.delayed, 2);
  assert.deepEqual(result.groups.map((g) => g.n), [2]); // Only sessions 1 and 43, on the new grid.
});

test("PUB-1：夏令與冬令下一交易日美東 16:30 前準時、之後逾時", () => {
  for (const [date, before, boundary, after] of [
    ["2026-03-09", "2026-03-10T20:29:00Z", "2026-03-10T20:30:00Z", "2026-03-10T20:31:00Z"],
    ["2026-01-05", "2026-01-06T21:29:00Z", "2026-01-06T21:30:00Z", "2026-01-06T21:31:00Z"],
  ]) {
    assert.equal(publishStatusOf(date, before), "on-time");
    assert.equal(publishStatusOf(date, boundary), "late");
    assert.equal(publishStatusOf(date, after), "late");
  }
});

test("PUB-1：補抓、週末與感恩節仍準時，下一交易日收盤後逾時", () => {
  assert.equal(publishStatusOf("2026-03-06", "2026-03-07T01:10:00Z"), "on-time");
  assert.equal(publishStatusOf("2026-03-06", "2026-03-08T22:00:00Z"), "on-time");
  assert.equal(publishStatusOf("2026-11-25", "2026-11-26T22:00:00Z"), "on-time");
  assert.equal(publishStatusOf("2026-11-25", "2026-11-27T22:00:00Z"), "late");
});

test("PUB-1：壞時間、任一美東日期在日曆外、或應有收盤日早於 trade_date 都不明", () => {
  for (const [date, at] of [
    ["2026-03-06", "x"],
    ["2024-12-31", "2025-01-02T22:00:00Z"],
    ["2026-03-06", "2040-01-13T23:00:00Z"],
    ["2026-03-06", "2026-03-06T21:29:00Z"],
    ["2025-01-02", "2025-01-01T01:10:00Z"], // UTC is covered; the eastern date is not.
  ]) assert.equal(publishStatusOf(date, at), "unknown", `${date} / ${at}`);
  assert.equal(publishStatusOf("2027-12-31", "2028-01-01T01:10:00Z"), "on-time");
});

test("P(up) 資格不依賴 dd5 欄位，缺 lag／存下的值或時限不明先歸不明", () => {
  const row = { date: "2026-03-06", p: 0.7, base: 0.6, close: 100, detail: JSON.stringify({ recordedLagSessions: 0 }), created_at: "2026-03-06T22:00:00Z" };
  assert.equal(upClassOf(row), "realtime");
  assert.equal(upClassOf({ ...row, detail: JSON.stringify({ recordedLagSessions: 2 }) }), "delayed");
  assert.equal(upClassOf({ ...row, created_at: "2026-03-09T22:00:00Z" }), "delayed");
  for (const detail of [null, "{", "null", "{}", JSON.stringify({ recordedLagSessions: "0" })]) {
    assert.equal(upClassOf({ ...row, detail, created_at: "2026-03-09T22:00:00Z" }), "unknown");
  }
  assert.equal(upClassOf({ ...row, detail: JSON.stringify({ recordedLagSessions: 2 }), created_at: "x" }), "unknown");
  for (const key of ["p", "base", "close"]) assert.equal(upClassOf({ ...row, [key]: null } as never), "unknown");
});

test("dd5 標籤：21 日內含邊界 0.95，22 日才跌不算；21 日收盤存在才到期", () => {
  for (const dropOn of [1, 21, 22]) {
    const points = dd5Points(23);
    points[dropOn].close = 95;
    const track = dd5LiveTrackOf([dd5Row(0)], points);
    assert.equal(track.groups[0].eventShare, dropOn <= 21 ? 1 : 0);
  }
  const immature = dd5Points(21);
  immature[1].close = 90;
  assert.deepEqual(dd5LiveTrackOf([dd5Row(0)], immature).groups, []);
  assert.deepEqual(dd5LiveTrackOf([], dd5Points(23)).groups, []);
});

test("dd5 以存下的 p／base 計分：11 月不報 BSS，12 月符合手算值", () => {
  const points = dd5Points(253);
  const rows = Array.from({ length: 12 }, (_, k) => {
    if (k % 2 === 0) points[k * 21 + 1].close = 95;
    return dd5Row(k * 21, dd5Detail(0, "v1", k % 2 === 0 ? 0.8 : 0.2, k % 2 === 0 ? 0.4 : 0.2));
  });
  const small = dd5LiveTrackOf(rows.slice(0, 11), points).groups[0];
  assert.equal(small.n, 11);
  assert.equal(small.tooFew, true);
  assert.equal(small.bss, null);
  const full = dd5LiveTrackOf(rows, points).groups[0];
  assert.equal(full.n, 12);
  assert.equal(full.tooFew, false);
  // Six events: model error .2 in both outcomes; base errors .6 and .2.
  assert.ok(Math.abs(full.brier! - 0.04) < 1e-12);
  assert.ok(Math.abs(full.brierBase! - 0.2) < 1e-12);
  assert.ok(Math.abs(full.bss! - 0.8) < 1e-12);
  assert.equal(full.eventShare, 0.5);
});

test("dd5 起始價用存下的 close，歷史起始價修訂不改結果", () => {
  const points = dd5Points(22);
  points[1].close = 95;
  const before = dd5LiveTrackOf([dd5Row(0)], points);
  points[0].close = 1000;
  assert.deepEqual(dd5LiveTrackOf([dd5Row(0)], points), before);
  assert.equal(before.groups[0].eventShare, 1);
  assert.equal(dd5LiveTrackOf([{ ...dd5Row(0), close: 90 }], points).groups[0].eventShare, 0);
});
