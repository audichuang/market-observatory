import { easternDate, easternMinutes, NYSE_EARLY_CLOSE } from "./calendar.ts";

const MINUTE_MS = 60_000;

/** Only minute/hour clues are precise enough to bound a publication time. */
export function parseAgo(ago: string | null | undefined): { count: number; unitMs: number } | null {
  if (!ago) return null;
  const normalized = ago === "a minute ago" ? "1 minute ago" : ago === "an hour ago" ? "1 hour ago" : ago;
  const match = /^(\d+) (minutes?|hours?) ago$/.exec(normalized);
  if (!match) return null;
  return { count: Number(match[1]), unitMs: match[2].startsWith("minute") ? MINUTE_MS : 60 * MINUTE_MS };
}

/** Allow one unit of rounding uncertainty and 15 extra minutes on the lower bound. */
export function publishedBounds({ fetchedAt, publishedAgo }: { fetchedAt: string; publishedAgo?: string | null }): { lower: Date; upper: Date } | null {
  const ago = parseAgo(publishedAgo);
  if (!ago) return null;
  const fetchedMs = Date.parse(fetchedAt);
  return {
    lower: new Date(fetchedMs - (ago.count + 1) * ago.unitMs - 15 * MINUTE_MS),
    upper: new Date(fetchedMs - Math.max(ago.count - 1, 0) * ago.unitMs),
  };
}

export function newsTiming(row: { fetched_at: string; published_ago?: string | null }, tradeDate: string): "before-close" | "after-close" | "unknown" {
  const bounds = publishedBounds({ fetchedAt: row.fetched_at, publishedAgo: row.published_ago });
  if (!bounds) return "unknown";
  const closeMinutes = (NYSE_EARLY_CLOSE.has(tradeDate) ? 13 : 16) * 60;
  const beforeClose = (bound: Date) => {
    const date = easternDate(bound);
    return date < tradeDate || (date === tradeDate && easternMinutes(bound) < closeMinutes);
  };
  if (beforeClose(bounds.upper)) return "before-close";
  if (!beforeClose(bounds.lower)) return "after-close";
  return "unknown";
}
