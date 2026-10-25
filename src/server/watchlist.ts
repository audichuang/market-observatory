import { DEFAULT_WATCHLIST, type WatchMember } from "../lib/universe.ts";
import { type Holding, sanitizeWatchlist } from "../lib/watchlist.ts";
import { type Db, getSetting, putSetting } from "./repo.ts";

// 觀察名單存在 settings 表；每個排程與頁面都在執行時讀，不在模組載入時讀，改了名單下一次執行就生效。
export const WATCHLIST_KEY = "watchlist";

export async function loadWatchlist(db: Db): Promise<WatchMember[]> {
  const raw = await getSetting<unknown>(db, WATCHLIST_KEY, null);
  return sanitizeWatchlist(raw) ?? DEFAULT_WATCHLIST;
}

export async function saveWatchlist(db: Db, list: WatchMember[]): Promise<void> {
  await putSetting(db, WATCHLIST_KEY, list);
}

/** 最新一份 SPY 持股（可加入名單的範圍與公司名稱）。 */
export async function latestHoldings(db: Db): Promise<{ asOf: string | null; holdings: Holding[] }> {
  const rows = await db
    .prepare("SELECT as_of, ticker, name, weight_pct FROM weights WHERE as_of = (SELECT MAX(as_of) FROM weights) ORDER BY weight_pct DESC")
    .all<{ as_of: string; ticker: string; name: string; weight_pct: number }>();
  return { asOf: rows.results[0]?.as_of ?? null, holdings: rows.results.map((r) => ({ ticker: r.ticker, name: r.name, weightPct: r.weight_pct })) };
}
