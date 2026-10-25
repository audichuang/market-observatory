import type { Context } from "hono";
import { DEFAULT_WATCHLIST, watchTickers } from "../lib/universe.ts";
import { type Db, getSetting } from "./repo.ts";
import { USER_WATCHLIST_PREFIX, WATCHLIST_KEY, ensureWatchlist, loadTrackedMembers, loadWatchlist } from "./watchlist.ts";

// 開放註冊後的帳號規則：誰是擁有者（能跑排程、看後台）、每個使用者的設定存在 settings 表的哪個 key。

export interface Viewer {
  id: string;
  email: string;
  name: string;
  /** email 等於 OWNER_EMAIL：只有擁有者能手動跑排程、回補與重算 */
  isOwner: boolean;
}

type Ctx = Pick<Context, "get" | "env">;

export function viewerOf(c: Ctx): Viewer | null {
  const user = c.get("user") as { id: string; email: string; name?: string | null } | null | undefined;
  if (!user) return null;
  const owner = String((c.env as { OWNER_EMAIL?: string }).OWNER_EMAIL ?? "").trim().toLowerCase();
  return { id: user.id, email: user.email, name: user.name ?? "", isOwner: Boolean(owner) && user.email.trim().toLowerCase() === owner };
}

export class HttpError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

export function requireViewer(c: Ctx): Viewer {
  const v = viewerOf(c);
  if (!v) throw new HttpError(401, "需要登入");
  return v;
}

export function requireOwner(c: Ctx): Viewer {
  const v = requireViewer(c);
  if (!v.isOwner) throw new HttpError(403, "只有站長能執行");
  return v;
}

/** 擁有者沿用開放註冊前的 key（資料不用搬）；其他使用者在 key 後面加上 user id。 */
export function settingKey(v: Pick<Viewer, "id" | "isOwner">, base: string): string {
  return v.isOwner ? base : `${base}:${v.id}`;
}

export const watchlistKey = (v: Pick<Viewer, "id" | "isOwner">) => (v.isOwner ? WATCHLIST_KEY : `${USER_WATCHLIST_PREFIX}${v.id}`);

/**
 * 這個使用者的名單。第一次讀時寫入預設名單，讓它進入排程追蹤的聯集；
 * 預設名單裡有聯集原本沒追蹤的公司時，回傳 needsRebuild，呼叫端要重算最近的快照（否則總覽缺這幾家）。
 * 讀取副本可能慢半拍：寫入一律用主庫（primary）。
 */
export async function viewerWatchlist(primary: Db, v: Viewer) {
  const key = watchlistKey(v);
  const exists = await primary.prepare("SELECT 1 AS x FROM settings WHERE key = ?").bind(key).first();
  if (v.isOwner || exists) return { key, members: await loadWatchlist(primary, key), needsRebuild: false };
  const before = await loadTrackedMembers(primary);
  const created = await ensureWatchlist(primary, key);
  const tracked = new Set(watchTickers(before));
  const needsRebuild = created && watchTickers(DEFAULT_WATCHLIST).some((t) => !tracked.has(t));
  return { key, members: await loadWatchlist(primary, key), needsRebuild };
}

export async function getViewerSetting<T>(db: Db, v: Viewer, base: string, fallback: T): Promise<T> {
  return getSetting<T>(db, settingKey(v, base), fallback);
}
