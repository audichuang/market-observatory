const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export class SourceError extends Error {
  source: string;
  status?: number;
  constructor(source: string, message: string, status?: number) {
    super(`${source}: ${message}`);
    this.source = source;
    this.status = status;
  }
}

export async function fetchWithTimeout(
  source: string,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 20000, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": UA, Accept: "*/*", ...(headers as Record<string, string> | undefined) },
  });
  if (!res.ok) throw new SourceError(source, `HTTP ${res.status}`, res.status);
  return res;
}

export interface DailyBar {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

export const finiteOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** "1,234.5" / "$1.95" / "6,317,269" → number；空或 N/A 回 null。 */
export function parseLooseNumber(s: unknown): number | null {
  if (typeof s === "number") return finiteOrNull(s);
  if (typeof s !== "string") return null;
  const cleaned = s.replace(/[$,%\s]/g, "");
  if (!cleaned || cleaned === "N/A" || cleaned === "--") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "10/23/2026" → "2026-10-23" */
export function mdyToIso(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
