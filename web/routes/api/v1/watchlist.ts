import { defineHandler } from "void";
import { z } from "zod";
import { requireViewer, watchlistKey } from "../../../src/server/account.ts";
import { changeWatchlist } from "../../../src/server/watch-actions.ts";
import { watchlistView } from "../../../src/server/views.ts";

export const GET = defineHandler(async (c) => watchlistView(c, requireViewer(c)));

/** 加入一家：全站沒人追蹤過的公司要先抓十年日線，可能要十幾秒。 */
export const POST = defineHandler.withValidator({ body: z.object({ symbol: z.string().trim().min(1).max(10) }) })(async (c, { body }) => {
  const v = requireViewer(c);
  const res = await changeWatchlist(c.env.DB, watchlistKey(v), { op: "add", symbol: body.symbol });
  if (!res.ok) return c.json({ error: res.error }, 422);
  return { summary: res.summary, ...(await watchlistView(c, v)) };
});

/** ?key=NVDA 移除一家。 */
export const DELETE = defineHandler.withValidator({ query: z.object({ key: z.string().min(1).max(10) }) })(async (c, { query }) => {
  const v = requireViewer(c);
  const res = await changeWatchlist(c.env.DB, watchlistKey(v), { op: "remove", key: query.key });
  if (!res.ok) return c.json({ error: res.error }, 422);
  return { summary: res.summary, ...(await watchlistView(c, v)) };
});
