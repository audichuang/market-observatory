import { getSetting, putSetting, type Db } from "./repo.ts";

// 頁面資料快取：資料只在排程／手動工作或儲存規劃時改變，所以用「資料版本號」加「建置編號」當快取鍵的一部分。
// 版本一變，舊快取自然不再被命中；沒變時重複開同一頁不必再從 D1 讀上萬筆日線重算。

const VERSION_KEY = "data_version";
const CACHE_ORIGIN = "https://page-cache.market-observatory.internal";
declare const __BUILD_ID__: string | undefined;
const BUILD_ID = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

/** 頁面讀取走 D1 讀取副本（離使用者較近）；寫入與排程仍用主庫。 */
export function readDb(env: { DB: D1Database }): Db {
  return env.DB.withSession("first-unconstrained");
}

export async function dataVersion(db: Db): Promise<string> {
  const v = await getSetting<{ v: number }>(db, VERSION_KEY, { v: 0 });
  return String(v.v);
}

export async function bumpDataVersion(db: Db): Promise<void> {
  await putSetting(db, VERSION_KEY, { v: Date.now() });
}

interface Ctx {
  executionCtx?: { waitUntil(p: Promise<unknown>): void };
}

/**
 * 依「頁面 + 查詢參數 + 資料版本」快取 loader 的結果（Cloudflare Cache API，各機房各自一份）。
 * 快取不可用（本機某些環境、讀寫失敗）時直接重算，不讓快取問題擋住頁面。
 */
export async function cachedPage<T>(c: Ctx, db: Db, key: string, compute: () => Promise<T>): Promise<T> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return compute();
  const url = `${CACHE_ORIGIN}/${BUILD_ID}/${encodeURIComponent(await dataVersion(db))}/${key}`;
  try {
    const hit = await cache.match(url);
    if (hit) return (await hit.json()) as T;
  } catch {
    // 快取讀取失敗就當沒命中
  }
  const value = await compute();
  const put = cache
    .put(url, new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=86400" } }))
    .catch(() => {});
  if (c.executionCtx) c.executionCtx.waitUntil(put);
  return value;
}
