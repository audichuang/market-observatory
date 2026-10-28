import { defineHandler, defineHead, type InferProps } from "void";
import { latestScheduledClose } from "../src/lib/calendar.ts";
import { weightsStaleNote } from "../src/lib/weights-age.ts";
import { requireViewer, watchlistKey } from "../src/server/account.ts";
import { WatchBody, changeWatchlist } from "../src/server/watch-actions.ts";
import { watchlistView } from "../src/server/views.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const view = await watchlistView(c, requireViewer(c));
  return { ...view, weightsStale: weightsStaleNote(view.asOf, latestScheduledClose()) };
});

export const action = defineHandler.withValidator({ body: WatchBody })(async (c, { body }) => {
  const res = await changeWatchlist(c.env.DB, watchlistKey(requireViewer(c)), body);
  if (!res.ok) return c.json({ error: res.error }, 422);
});

export const head = defineHead(() => ({ title: "觀察名單" }));
