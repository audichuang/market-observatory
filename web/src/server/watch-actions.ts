import { z } from "zod";
import { addWatchSymbol, removeWatchSymbol } from "./jobs.ts";

// 名單的加入／移除（網頁的 action 與 App 的 API 共用）。寫入走主庫（不是讀取副本），加入時可能還要抓歷史股價、重算快照。
export const WatchBody = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), symbol: z.string().trim().min(1).max(10) }),
  z.object({ op: z.literal("remove"), key: z.string().min(1).max(10) }),
]);

export function changeWatchlist(db: D1Database, listKey: string, body: z.infer<typeof WatchBody>) {
  return body.op === "add" ? addWatchSymbol(db, body.symbol, undefined, listKey) : removeWatchSymbol(db, body.key, listKey);
}
