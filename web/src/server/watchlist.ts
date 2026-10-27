import { DEFAULT_WATCHLIST, type WatchMember } from "../lib/universe.ts";
import { type Holding, mergeWatchlists, sanitizeWatchlist } from "../lib/watchlist.ts";
import { type Db, getSetting } from "./repo.ts";

// 觀察名單存在 settings 表，每個使用者一列；每個排程與頁面都在執行時讀，不在模組載入時讀，改了名單下一次執行就生效。
// 擁有者沿用開放註冊前的 key（WATCHLIST_KEY），其他使用者用 `watchlist:<user id>`，見 src/server/account.ts。
export const WATCHLIST_KEY = "watchlist";
export const USER_WATCHLIST_PREFIX = "watchlist:";
/** Prefix of a user's per-day counters of newly tracked companies (`watch-new:<user id>:<eastern date>`); account deletion removes every row under it. */
export const newTrackedQuotaPrefix = (userId: string) => `watch-new:${userId}:`;

/** 一份名單（預設是擁有者的）；還沒存過就是預設的七巨頭。 */
export async function loadWatchlist(db: Db, key = WATCHLIST_KEY): Promise<WatchMember[]> {
  const raw = await getSetting<unknown>(db, key, null);
  return sanitizeWatchlist(raw) ?? DEFAULT_WATCHLIST;
}

/**
 * 排程要追蹤的公司：所有使用者名單的聯集（擁有者的排最前面）。
 * 擁有者還沒存過名單時算預設七巨頭；其他使用者第一次打開名單時才寫入預設名單（ensureWatchlist），寫入前不在聯集裡。
 */
export async function loadTrackedMembers(db: Db): Promise<WatchMember[]> {
  const rows = await db
    .prepare("SELECT key, value FROM settings WHERE key = ? OR key LIKE ? ORDER BY key = ? DESC, updated_at, key")
    .bind(WATCHLIST_KEY, `${USER_WATCHLIST_PREFIX}%`, WATCHLIST_KEY)
    .all<{ key: string; value: string }>();
  const lists = rows.results.map((r) => {
    try {
      return sanitizeWatchlist(JSON.parse(r.value)) ?? [];
    } catch {
      return [];
    }
  });
  if (rows.results[0]?.key !== WATCHLIST_KEY) lists.unshift(DEFAULT_WATCHLIST);
  return mergeWatchlists(lists);
}

/** 使用者的名單列還不存在就寫入預設名單（不覆蓋已存在的）；回傳是否新寫入。 */
export async function ensureWatchlist(db: Db, key: string): Promise<boolean> {
  const res = await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO NOTHING")
    .bind(key, JSON.stringify(DEFAULT_WATCHLIST))
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * 讀改寫名單，存檔時比對「讀到的原始字串」沒被別人改過才寫入（例如手機在加、桌機同時在刪）。
 * 被搶先就重讀再套一次 edit，最多 3 次；edit 回傳錯誤字串就放棄。
 */
export async function updateWatchlist(
  db: Db,
  edit: (list: WatchMember[]) => WatchMember[] | string,
  key = WATCHLIST_KEY,
): Promise<{ ok: true; list: WatchMember[] } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
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
      ? await db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ? AND value = ?").bind(value, key, row.value).run()
      : await db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO NOTHING").bind(key, value).run();
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
