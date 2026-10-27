import assert from "node:assert/strict";
import test from "node:test";
import { STRATEGIST_TARGETS, asOfDate, isStrategistStale, medianEligible, strategistTable, type StrategistTarget } from "../src/lib/strategists.ts";

const row = (o: Partial<StrategistTarget> & Pick<StrategistTarget, "firm" | "institution" | "target">): StrategistTarget => ({
  department: "research",
  horizon: "2026 年底",
  asOf: "2026-10-01",
  sourceUrl: "https://example.com",
  verified: false,
  ...o,
});

test("中位數一家一票：有研究部門時以研究部門為準，不看數字高低", () => {
  // Wealth arm lower than research arm, and the reverse: research arm votes in both cases.
  for (const [research, wealth] of [[8000, 7000], [7000, 8000]]) {
    const rows = [
      row({ firm: "X Research", institution: "X", target: research }),
      row({ firm: "X Wealth", institution: "X", department: "wealth_management", target: wealth }),
    ];
    assert.deepEqual(medianEligible(rows).map((t) => t.firm), ["X Research"]);
  }
});

test("中位數：沒有研究部門時財富管理那一列計入", () => {
  const rows = [row({ firm: "Y Wealth", institution: "Y", department: "wealth_management", target: 7600 })];
  assert.deepEqual(medianEligible(rows).map((t) => t.firm), ["Y Wealth"]);
});

test("中位數只收年底目標：rolling_12m 排除，缺 horizonType 視為年底", () => {
  const rows = [
    row({ firm: "A", institution: "A", target: 7000 }),
    row({ firm: "B", institution: "B", target: 9000, horizonType: "rolling_12m" }),
    row({ firm: "C", institution: "C", target: 8000, horizonType: "year_end" }),
  ];
  const t = strategistTable(rows, "2026-10-27");
  assert.deepEqual(t.list.filter((r) => r.inMedian).map((r) => r.firm), ["A", "C"]);
  assert.equal(t.median, 7500);
  assert.equal(t.medianCount, 2);
  assert.equal(t.list[0].horizonType, "year_end");
});

test("研究部門只有 12 個月目標時，同一家的財富管理年底目標計入", () => {
  const rows = [
    row({ firm: "Z Research", institution: "Z", target: 9000, horizonType: "rolling_12m" }),
    row({ firm: "Z Wealth", institution: "Z", department: "wealth_management", target: 7800 }),
  ];
  assert.deepEqual(medianEligible(rows).map((t) => t.firm), ["Z Wealth"]);
});

test("實際資料：UBS 與 Wells Fargo 都只算研究部門，中位數由本機重算", () => {
  const t = strategistTable(STRATEGIST_TARGETS, "2026-10-27");
  const excluded = t.list.filter((r) => !r.inMedian).map((r) => r.firm).sort();
  assert.deepEqual(excluded, ["UBS GWM", "Wells Fargo Investment Institute"]);
  const institutions = new Set(STRATEGIST_TARGETS.map((r) => r.institution));
  assert.equal(t.medianCount, institutions.size);
  assert.equal(t.median, 7950);
  // Display names stay unique (web key and iOS Identifiable use firm).
  assert.equal(new Set(STRATEGIST_TARGETS.map((r) => r.firm)).size, STRATEGIST_TARGETS.length);
});

test("WFII 是區間：target 仍是數字，標為區間中點", () => {
  const w = STRATEGIST_TARGETS.find((r) => r.firm === "Wells Fargo Investment Institute");
  assert.ok(w);
  assert.equal(typeof w.target, "number");
  assert.equal(w.targetLow, 7800);
  assert.equal(w.targetHigh, 8000);
  assert.equal(w.targetIsMidpoint, true);
  assert.equal(w.target, (w.targetLow! + w.targetHigh!) / 2);
  assert.match(w.note ?? "", /區間中點/);
  // Every row that claims a midpoint must carry its range.
  for (const r of STRATEGIST_TARGETS.filter((x) => x.targetIsMidpoint)) {
    assert.ok(r.targetLow !== undefined && r.targetHigh !== undefined, r.firm);
    assert.equal(r.target, (r.targetLow! + r.targetHigh!) / 2, r.firm);
  }
});

test("已核對原文的列帶核對日期", () => {
  for (const r of STRATEGIST_TARGETS.filter((x) => x.verified)) assert.match(r.verifiedOn ?? "", /^\d{4}-\d{2}-\d{2}$/, r.firm);
  assert.deepEqual(STRATEGIST_TARGETS.filter((x) => x.verified).map((x) => x.firm).sort(), ["UBS GWM", "Wells Fargo Investment Institute", "Yardeni Research"]);
});

test("逾期旗標：超過 45 天才標待重新核對", () => {
  assert.equal(isStrategistStale("2026-09-12", "2026-10-26"), false); // 44 days
  assert.equal(isStrategistStale("2026-09-12", "2026-10-27"), false); // 45 days
  assert.equal(isStrategistStale("2026-09-12", "2026-10-28"), true); // 46 days
});

test("逾期旗標：只有年月的日期當作該月最後一天", () => {
  assert.equal(asOfDate("2026-09"), "2026-09-30");
  assert.equal(asOfDate("2026-02"), "2026-02-28");
  assert.equal(isStrategistStale("2026-09", "2026-11-14"), false); // 45 days after 09-30
  assert.equal(isStrategistStale("2026-09", "2026-11-15"), true);
  assert.equal(isStrategistStale("not a date", "2026-10-27"), true);
});

test("strategistTable 對每列帶 stale 與 inMedian", () => {
  const t = strategistTable(STRATEGIST_TARGETS, "2026-10-27");
  const by = new Map(t.list.map((r) => [r.firm, r]));
  assert.equal(by.get("Yardeni Research")!.stale, false);
  assert.equal(by.get("Wells Fargo Investment Institute")!.stale, true);
  assert.equal(by.get("Goldman Sachs")!.stale, true);
  assert.equal(t.staleAfterDays, 45);
  assert.match(t.medianRule, /一家一票/);
});
