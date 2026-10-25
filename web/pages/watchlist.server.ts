import { defineHandler, defineHead, type InferProps } from "void";
import { requireViewer, watchlistKey } from "../src/server/account.ts";
import { WatchBody, changeWatchlist } from "../src/server/watch-actions.ts";
import { watchlistView } from "../src/server/views.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => watchlistView(c, requireViewer(c)));

export const action = defineHandler.withValidator({ body: WatchBody })(async (c, { body }) => {
  const res = await changeWatchlist(c.env.DB, watchlistKey(requireViewer(c)), body);
  if (!res.ok) return c.json({ error: res.error }, 422);
});

export const head = defineHead(() => ({ title: "觀察名單" }));
