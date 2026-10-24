import { defineHandler, defineHead, type InferProps } from "void";
import { maxDrawdown, periodReturn, smaSeries } from "../src/lib/analytics.ts";
import { addDays } from "../src/lib/calendar.ts";
import type { Snapshot } from "../src/lib/snapshot.ts";
import { ETFS, EQUAL_WEIGHT_SYMBOL, INDEX_SYMBOL, MAG7, VIX_SYMBOL } from "../src/lib/universe.ts";
import { loadPrices } from "../src/server/repo.ts";

export type Props = InferProps<typeof loader>;

const RANGES = [1, 3, 6, 12, 36, 60];
export const SYMBOL_LABELS: Record<string, string> = {
  [INDEX_SYMBOL]: "S&P 500",
  [VIX_SYMBOL]: "VIX",
  [EQUAL_WEIGHT_SYMBOL]: "RSP 等權重",
  ...Object.fromEntries(MAG7.map((m) => [m.key, m.company])),
  ...Object.fromEntries(ETFS.map((e) => [e.ticker, e.ticker])),
};

export const loader = defineHandler(async (c) => {
  const db = c.env.DB;
  const symbol = SYMBOL_LABELS[c.req.query("symbol") ?? ""] ? (c.req.query("symbol") as string) : INDEX_SYMBOL;
  const months = RANGES.includes(Number(c.req.query("months"))) ? Number(c.req.query("months")) : 12;
  const last = await db.prepare("SELECT MAX(date) AS d FROM prices WHERE symbol = ?").bind(INDEX_SYMBOL).first<{ d: string | null }>();
  const end = last?.d ?? new Date().toISOString().slice(0, 10);
  const start = addDays(end, -Math.round(months * 30.44));

  // 均線先用更早的資料暖機，再截到顯示區間，避免圖的開頭均線是錯的。
  const compareSymbols = [INDEX_SYMBOL, ...MAG7.map((m) => m.key), EQUAL_WEIGHT_SYMBOL];
  const loaded = await loadPrices(db, [...new Set([symbol, ...compareSymbols])], addDays(start, -320), end);
  const main = loaded.series[symbol];
  const sma20 = smaSeries(main.points, 20);
  const sma60 = smaSeries(main.points, 60);
  const sma200 = smaSeries(main.points, 200);
  const visible = main.points.map((p, i) => ({ ...p, sma20: sma20[i], sma60: sma60[i], sma200: sma200[i] })).filter((p) => p.date >= start);
  const step = Math.max(1, Math.floor(visible.length / 400));
  const priceLine = visible.filter((_, i) => i % step === 0 || i === visible.length - 1);

  // 相對報酬比較：每條線以區間第一個交易日為 0%。
  const rebased = compareSymbols.map((s) => {
    const pts = loaded.series[s].points.filter((p) => p.date >= start);
    const base = pts[0]?.close;
    return { symbol: s, points: base ? pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => ({ date: p.date, value: ((p.close / base) - 1) * 100 })) : [] };
  });

  const stats = compareSymbols.map((s) => {
    const series = loaded.series[s];
    const inRange = series.points.filter((p) => p.date >= start);
    return {
      symbol: s,
      label: SYMBOL_LABELS[s],
      close: series.last()?.close ?? null,
      ret: periodReturn(series, start, end),
      mdd: maxDrawdown(inRange),
      vol: annualVol(inRange.map((p) => p.close)),
    };
  });

  // 近 40 個交易日七巨頭貢獻（取每天最新版快照）。
  const contrib = await db
    .prepare(
      `SELECT s.trade_date, s.data FROM snapshots s
       JOIN (SELECT trade_date, MAX(revision) AS r FROM snapshots GROUP BY trade_date ORDER BY trade_date DESC LIMIT 40) m
       ON s.trade_date = m.trade_date AND s.revision = m.r ORDER BY s.trade_date`,
    )
    .all<{ trade_date: string; data: string }>();
  const contribution = contrib.results.map((r) => {
    const d = JSON.parse(r.data) as Snapshot;
    return { date: r.trade_date, index: d.index.changePts, mag7: d.mag7Total.contributionPts, rest: d.rest.contributionPts };
  });

  const mainStats = { ret: periodReturn(main, start, end), mdd: maxDrawdown(main.points.filter((p) => p.date >= start)), points: visible.length, first: visible[0]?.date ?? null, last: visible.at(-1)?.date ?? null };
  return { symbol, months, ranges: RANGES, symbols: Object.entries(SYMBOL_LABELS), priceLine, mainStats, rebased, stats, contribution };
});

function annualVol(closes: number[]): number | null {
  if (closes.length < 20) return null;
  const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance * 252) * 100;
}

export const head = defineHead<Props>((_c, p) => ({ title: `${SYMBOL_LABELS[p.symbol]} 走勢｜市場觀測室` }));

