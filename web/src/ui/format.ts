// 顯示格式。null 一律顯示「—」，不顯示 0。

export const DASH = "—";

export function num(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function signed(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const s = num(Math.abs(v), digits);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

export function pctText(v: number | null | undefined, digits = 2): string {
  const s = signed(v, digits);
  return s === DASH ? s : `${s}%`;
}

/** 台灣慣例：紅漲綠跌。 */
export function tone(v: number | null | undefined): "up" | "down" | "flat" {
  if (v === null || v === undefined || !Number.isFinite(v) || Math.abs(v) < 1e-9) return "flat";
  return v > 0 ? "up" : "down";
}

export function compactUsd(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${num(v, 0)}`;
}

export function taipeiTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
export function dateWithWeekday(date: string | null | undefined): string {
  if (!date) return DASH;
  const d = new Date(`${date}T12:00:00Z`);
  return `${date}（${WEEKDAYS[d.getUTCDay()]}）`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

export function ppText(v: number | null | undefined, digits = 2): string {
  const s = signed(v, digits);
  return s === DASH ? s : `${s} 個百分點`;
}
