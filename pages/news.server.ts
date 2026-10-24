import { defineHandler, defineHead, type InferProps } from "void";
import { addDays } from "../src/lib/calendar.ts";
import { MAG7 } from "../src/lib/universe.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const db = c.env.DB;
  const keys = [...MAG7.map((m) => m.key), "SPY"];
  const symbol = keys.includes(c.req.query("symbol") ?? "") ? (c.req.query("symbol") as string) : null;
  const news = symbol
    ? await db.prepare("SELECT * FROM news WHERE ',' || symbols || ',' LIKE ? ORDER BY published_at DESC, fetched_at DESC LIMIT 60").bind(`%,${symbol},%`).all()
    : await db.prepare("SELECT * FROM news ORDER BY published_at DESC, fetched_at DESC LIMIT 80").all();
  const today = new Date().toISOString().slice(0, 10);
  const events = await db
    .prepare("SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date, kind")
    .bind(addDays(today, -30), addDays(today, 120))
    .all<{ id: string; date: string; kind: string; symbol: string | null; title: string; detail: string | null; status: string; source_url: string; fetched_at: string }>();
  return {
    symbol,
    keys,
    today,
    news: news.results as { id: string; symbols: string; title: string; url: string; publisher: string | null; published_at: string | null; fetched_at: string }[],
    events: events.results,
  };
});

export const head = defineHead(() => ({ title: "新聞與日曆｜市場觀測室" }));
