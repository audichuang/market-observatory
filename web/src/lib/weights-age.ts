import { addDays, expectedSessions, inCalendarCoverage } from "./calendar.ts";

// README.md: SSGA holdings usually lag by 1–2 trading sessions; this is an operational threshold.
export const WEIGHTS_STALE_SESSIONS = 2;

export function weightsLagSessions(asOf: string, target: string): number | null {
  if (asOf >= target) return 0;
  if (!inCalendarCoverage(asOf) || !inCalendarCoverage(target)) return null;
  return expectedSessions(addDays(asOf, 1), target).length;
}

export function weightsStaleNote(asOf: string | null | undefined, target: string | null | undefined): string | null {
  if (asOf == null || target == null) return null;
  const lag = weightsLagSessions(asOf, target);
  return lag !== null && lag > WEIGHTS_STALE_SESSIONS
    ? `權重未更新：最新 SPY 持股停在 ${asOf}，到 ${target} 已落後 ${lag} 個交易日（通常落後 1～2 個），成分與股數變動沒有反映`
    : null;
}
