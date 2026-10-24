import { cachedPage, readDb } from "../src/server/page-cache.ts";
import { defineHandler, defineHead, type InferProps } from "void";
import { addDays, latestExpectedClose } from "../src/lib/calendar.ts";
import { getSnapshot, listRevisions, listSnapshotDates } from "../src/server/repo.ts";
import { MAG7_TICKERS } from "../src/lib/universe.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const db = readDb(c.env);
  // 頁面資料依資料版本快取，見 src/server/page-cache.ts。
  return cachedPage(c, db, `index?${new URL(c.req.url).search}&close=${latestExpectedClose()}&today=${new Date().toISOString().slice(0, 10)}`, async () => {
    const date = c.req.query("date") || undefined;
    const rev = Number(c.req.query("rev")) || undefined;
    const snapshot = await getSnapshot(db, date, rev);
    const tradeDate = snapshot?.tradeDate ?? null;
    const today = new Date().toISOString().slice(0, 10);
    const [revisions, dates, news, events, lastPriceRun, forecast, rest] = await Promise.all([
      tradeDate ? listRevisions(db, tradeDate) : Promise.resolve([]),
      listSnapshotDates(db, 400),
      db.prepare("SELECT title, url, publisher, published_at, symbols FROM news WHERE symbols != 'SPY' ORDER BY published_at DESC, fetched_at DESC LIMIT 5").all<{ title: string; url: string; publisher: string | null; published_at: string | null; symbols: string }>(),
      db.prepare("SELECT date, kind, symbol, title, status FROM events WHERE date >= ? AND date <= ? ORDER BY date LIMIT 8").bind(today, addDays(today, 21)).all<{ date: string; kind: string; symbol: string | null; title: string; status: string }>(),
      db.prepare("SELECT status, summary, finished_at FROM runs WHERE job = 'prices' ORDER BY id DESC LIMIT 1").first<{ status: string; summary: string; finished_at: string | null }>(),
      db.prepare("SELECT trade_date, probability, base_rate, call FROM forecasts ORDER BY trade_date DESC LIMIT 1").first<{ trade_date: string; probability: number; base_rate: number; call: string }>(),
      // 「其餘」幾檔：用快照所依據那天的 SPY 持股實算。持股檔偶爾夾帶非股票列（例如 2602335D、權重近 0），含數字的代號不算。
      // 持股檔與這一天相差超過 7 天（看舊日期、權重是從後來的持股推回去的）就不寫檔數，當時的名單不一定一樣。
      snapshot?.data.weights.asOf && Math.abs(Date.parse(snapshot.data.weights.asOf) - Date.parse(snapshot.tradeDate)) <= 7 * 86400000
        ? db
            .prepare(`SELECT COUNT(*) AS n FROM weights WHERE as_of = ? AND weight_pct > 0 AND ticker NOT GLOB '*[0-9]*' AND ticker NOT IN (${MAG7_TICKERS.map(() => "?").join(",")})`)
            .bind(snapshot.data.weights.asOf, ...MAG7_TICKERS)
            .first<{ n: number }>()
        : Promise.resolve(null),
    ]);
    return {
      snapshot,
      revisions,
      dates,
      expectedClose: latestExpectedClose(),
      news: news.results,
      events: events.results,
      lastPriceRun,
      forecast,
      restCount: rest?.n ?? null,
      viewingLatest: !date,
    };
  });
});

export const head = defineHead<Props>((_c, p) => ({ title: `市場總覽 ${p.snapshot?.tradeDate ?? ""}` }));
