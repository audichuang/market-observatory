import assert from "node:assert/strict";
import { test } from "node:test";
import { PLAN_RULES_TEXT, planIssue } from "../src/lib/plan.ts";
import { DEFAULT_PLAN, PlanSchema } from "../src/server/views.ts";

test("預設規劃在範圍內；超出範圍時回中文說明", () => {
  assert.equal(planIssue(DEFAULT_PLAN), null);
  assert.equal(planIssue({ ...DEFAULT_PLAN, exitConsiderationPct: 150 }), PLAN_RULES_TEXT);
  assert.equal(planIssue({ ...DEFAULT_PLAN, researchBudgetTwd: -1 }), PLAN_RULES_TEXT);
  assert.equal(planIssue({ ...DEFAULT_PLAN, trancheTwd: 1.5 }), PLAN_RULES_TEXT);
  assert.equal(planIssue({ ...DEFAULT_PLAN, notes: "x".repeat(2001) }), PLAN_RULES_TEXT);
  assert.equal(planIssue({ ...DEFAULT_PLAN, exitConsiderationPct: Number.NaN }), PLAN_RULES_TEXT);
});

test("伺服器驗證的錯誤訊息是中文（網頁表單與 App 直接顯示）", () => {
  const cases: Record<string, unknown>[] = [
    { exitConsiderationPct: 150 },
    { exitConsiderationPct: -1 },
    { researchBudgetTwd: 2_000_000_000 },
    { trancheTwd: 1.5 },
    { monthlyTwd: "abc" },
    { monthlyTwd: 0 },
    { years: 4 },
    { etf: "XYZ" },
    { notes: "x".repeat(2001) },
  ];
  for (const patch of cases) {
    const r = PlanSchema.safeParse({ ...DEFAULT_PLAN, ...patch });
    assert.equal(r.success, false, JSON.stringify(patch));
    for (const issue of r.error!.issues) assert.match(issue.message, /[一-鿿]/, `${JSON.stringify(patch)} → ${issue.message}`);
  }
  assert.equal(PlanSchema.safeParse(DEFAULT_PLAN).success, true);
  assert.equal(PlanSchema.safeParse({ ...DEFAULT_PLAN, monthlyTwd: 1, researchBudgetTwd: 0, trancheTwd: 0 }).success, true);
});
