import { defineHandler, defineHead, type InferProps } from "void";
import { z } from "zod";
import { MAX_WATCH, displayName, isConstituent } from "../src/lib/watchlist.ts";
import { addWatchSymbol, removeWatchSymbol } from "../src/server/jobs.ts";
import { latestHoldings, loadWatchlist } from "../src/server/watchlist.ts";

export type Props = InferProps<typeof loader>;

// 名單頁不走頁面快取、也不讀讀取副本：內容小，而且改完要立刻看到（副本可能慢半拍）。
export const loader = defineHandler(async (c) => {
  const db = c.env.DB;
  const [list, { asOf, holdings }] = await Promise.all([loadWatchlist(db), latestHoldings(db)]);
  const weight = new Map(holdings.map((h) => [h.ticker, h.weightPct]));
  const inList = new Set(list.flatMap((m) => m.tickers));
  const members = list.map((m) => ({ ...m, weightPct: m.tickers.reduce((a, t) => a + (weight.get(t) ?? 0), 0), outOfIndex: holdings.length ? m.tickers.filter((t) => !weight.has(t)) : [] }));
  // 可加入的成分股：權重由大到小，給搜尋框的建議清單用。
  const candidates = holdings
    .filter((h) => isConstituent(h) && !inList.has(h.ticker))
    .map((h) => ({ ticker: h.ticker, name: displayName(h.name), weightPct: Math.round(h.weightPct * 1000) / 1000 }));
  const totalWeight = members.reduce((a, m) => a + m.weightPct, 0);
  return { members, candidates, asOf, totalWeight, max: MAX_WATCH };
});

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), symbol: z.string().trim().min(1).max(10) }),
  z.object({ op: z.literal("remove"), key: z.string().min(1).max(10) }),
]);

export const action = defineHandler.withValidator({ body: Body })(async (c, { body }) => {
  // 寫入走主庫（不是讀取副本），加入時還要抓歷史股價、重算快照。
  const res = body.op === "add" ? await addWatchSymbol(c.env.DB, body.symbol) : await removeWatchSymbol(c.env.DB, body.key);
  if (!res.ok) return c.json({ error: res.error }, 422);
});

export const head = defineHead(() => ({ title: "觀察名單" }));
