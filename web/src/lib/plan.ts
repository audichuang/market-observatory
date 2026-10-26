// 「我的規劃」欄位的上下限：伺服器的 PlanSchema（src/server/views.ts）與網頁表單的即時檢查共用，
// 數字與 iOS 的 PlanEditor（ios/MarketObservatory/Views/MoreView.swift）一致。

export const PLAN_LIMITS = {
  monthlyMaxTwd: 10_000_000,
  amountMaxTwd: 1_000_000_000,
  exitPctMax: 100,
  notesMax: 2000,
} as const;

/** 表單上顯示的整體說明（與 iOS 同一句，欄位名稱用網頁的） */
export const PLAN_RULES_TEXT = `金額要是 0 到 10 億的整數，檢討門檻 0–${PLAN_LIMITS.exitPctMax}%，備註最多 ${PLAN_LIMITS.notesMax} 字。`;

const amountOk = (n: number) => Number.isInteger(n) && n >= 0 && n <= PLAN_LIMITS.amountMaxTwd;

/** 「我的規劃」可編輯欄位是否都在範圍內；不在範圍時回說明文字，否則 null。 */
export function planIssue(p: { researchBudgetTwd: number; trancheTwd: number; exitConsiderationPct: number; notes: string }): string | null {
  const ok =
    amountOk(p.researchBudgetTwd) &&
    amountOk(p.trancheTwd) &&
    Number.isFinite(p.exitConsiderationPct) &&
    p.exitConsiderationPct >= 0 &&
    p.exitConsiderationPct <= PLAN_LIMITS.exitPctMax &&
    p.notes.length <= PLAN_LIMITS.notesMax;
  return ok ? null : PLAN_RULES_TEXT;
}
