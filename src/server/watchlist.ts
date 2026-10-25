import { DEFAULT_WATCHLIST, type WatchMember } from "../lib/universe.ts";
import { type Holding, sanitizeWatchlist } from "../lib/watchlist.ts";
import { type Db, getSetting } from "./repo.ts";

// 觀察名單存在 settings 表；每個排程與頁面都在執行時讀，不在模組載入時讀，改了名單下一次執行就生效。
export const WATCHLIST_KEY = "watchlist";

export async function loadWatchlist(db: Db): Promise<WatchMember[]> {
  const raw = await getSetting<unknown>(db, WATCHLIST_KEY, null);
  return sanitizeWatchlist(raw) ?? DEFAULT_WATCHLIST;
}

/**
 * 讀改寫名單，存檔時比對「讀到的原始字串」沒被別人改過才寫入（例如手機在加、桌機同時在刪）。
 * 被搶先就重讀再套一次 edit，最多 3 次；edit 回傳錯誤字串就放棄。
 */
export async function updateWatchlist(db: Db, edit: (list: WatchMember[]) => WatchMember[] | string): Promise<{ ok: true; list: WatchMember[] } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(WATCHLIST_KEY).first<{ value: string }>();
    let parsed: unknown = null;
    try {
      parsed = row ? JSON.parse(row.value) : null;
    } catch {
      parsed = null;
    }
    const next = edit(sanitizeWatchlist(parsed) ?? DEFAULT_WATCHLIST);
    if (typeof next === "string") return { ok: false, error: next };
    const value = JSON.stringify(next);
    const res = row
      ? await db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ? AND value = ?").bind(value, WATCHLIST_KEY, row.value).run()
      : await db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO NOTHING").bind(WATCHLIST_KEY, value).run();
    if ((res.meta?.changes ?? 0) > 0) return { ok: true, list: next };
  }
  return { ok: false, error: "名單同時被其他裝置修改，請重新整理後再試" };
}

/** 最新一份 SPY 持股（可加入名單的範圍與公司名稱）。 */
export async function latestHoldings(db: Db): Promise<{ asOf: string | null; holdings: Holding[] }> {
  const rows = await db
    .prepare("SELECT as_of, ticker, name, weight_pct FROM weights WHERE as_of = (SELECT MAX(as_of) FROM weights) ORDER BY weight_pct DESC")
    .all<{ as_of: string; ticker: string; name: string; weight_pct: number }>();
  return { asOf: rows.results[0]?.as_of ?? null, holdings: rows.results.map((r) => ({ ticker: r.ticker, name: r.name, weightPct: r.weight_pct })) };
}
