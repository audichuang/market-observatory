import assert from "node:assert/strict";
import { test } from "node:test";
import { loader as watchlistLoader, type Props as WatchlistProps } from "../pages/watchlist.server.ts";
import { etfsView } from "../src/server/views.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

test("ETF 重疊與名單頁共用排程收盤基準，行情快取命中時仍反映持股日期與收盤日更新", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-28T23:00:00Z") });
  const { db, sql } = await migratedDb();
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
  const cached = new Map<string, Response>();
  let hits = 0;
  Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
    match: async (key: string) => { const response = cached.get(key); if (response) hits++; return response?.clone(); },
    put: async (key: string, response: Response) => { cached.set(key, response.clone()); },
  } } });
  t.after(() => {
    if (originalCaches) Object.defineProperty(globalThis, "caches", originalCaches);
    else Reflect.deleteProperty(globalThis, "caches");
    sql.close();
  });
  const viewer = { id: "weights-age-user", email: "weights-age@example.test", name: "測試使用者", isOwner: false };
  const c = {
    env: { DB: db },
    req: { query: () => undefined, url: "http://localhost/etfs" },
    get: (key: string) => key === "user" ? viewer : undefined,
  };
  const compare = async (expected: string | null) => {
    const etfs = await etfsView(c, viewer);
    const watchlist = await (watchlistLoader as unknown as (c: unknown) => Promise<WatchlistProps>)(c);
    assert.equal(watchlist.weightsStale, expected);
    assert.equal(etfs.overlap.weightsStale, watchlist.weightsStale);
  };
  sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, fetched_at) VALUES ('2026-10-22', 'NVDA', 'NVIDIA', 7, '2026-10-28')").run();
  await compare("權重未更新：最新 SPY 持股停在 2026-10-22，到 2026-10-28 已落後 4 個交易日（通常落後 1～2 個），成分與股數變動沒有反映");
  sql.prepare("UPDATE weights SET as_of = '2026-10-28'").run();
  await compare(null);
  sql.prepare("UPDATE weights SET as_of = '2026-10-26'").run();
  await compare(null);
  t.mock.timers.setTime(Date.parse("2026-10-29T23:00:00Z"));
  await compare("權重未更新：最新 SPY 持股停在 2026-10-26，到 2026-10-29 已落後 3 個交易日（通常落後 1～2 個），成分與股數變動沒有反映");
  assert.equal(hits, 3, "提示須在同一份行情快取命中時正確更新");
});
