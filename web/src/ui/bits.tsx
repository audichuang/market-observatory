import type { CheckStatus } from "../lib/snapshot.ts";
import { pctText, signed, tone } from "./format.ts";

export function Delta({ value, digits = 2, percent = false }: { value: number | null | undefined; digits?: number; percent?: boolean }) {
  return <span className={tone(value)}>{percent ? pctText(value, digits) : signed(value, digits)}</span>;
}

/** 收盤價核對：只有兩個來源對不上時才顯示，其餘狀態不必看。 */
export function CheckBadge({ status }: { status: CheckStatus }) {
  return status === "mismatch" ? <span className="badge bad">來源不一致</span> : null;
}

/** 以 0 為中心的水平條；max 是兩側的滿格值。 */
export function CenteredBar({ value, max }: { value: number | null; max: number }) {
  if (value === null || !max) return <div className="bar-track"><div className="bar-zero" /></div>;
  const w = Math.min(50, (Math.abs(value) / max) * 50);
  const style = value >= 0 ? { left: "50%", width: `${w}%` } : { left: `${50 - w}%`, width: `${w}%` };
  return (
    <div className="bar-track">
      <div className="bar-zero" />
      <div className="bar-fill" style={{ ...style, background: value >= 0 ? "var(--up)" : "var(--down)" }} />
    </div>
  );
}

const RUN_STATUS_TEXT: Record<string, string> = { ok: "成功", partial: "部分成功", failed: "失敗", running: "執行中" };
export const runStatusText = (status: string) => RUN_STATUS_TEXT[status] ?? status;

export function RunStatusBadge({ status }: { status: string }) {
  const cls = status === "ok" ? "ok" : status === "partial" || status === "running" ? "warn" : "bad";
  const text = runStatusText(status);
  return <span className={`badge ${cls}`}>{text}</span>;
}
