import { defineHandler } from "void";
import { z } from "zod";
import { SOURCE_REGISTRY } from "../../../src/lib/sources/registry.ts";
import { viewerOf } from "../../../src/server/account.ts";
import { bumpDataVersion } from "../../../src/server/page-cache.ts";
import { loadSourceSwitches, setSourceSwitch } from "../../../src/server/source-switches.ts";

export const GET = defineHandler(async (c) => {
  if (!viewerOf(c)?.isOwner) return c.json({ error: "只有站長能執行" }, 403);
  return c.json({ switches: await loadSourceSwitches(c.env.DB) });
});

export const POST = defineHandler.withValidator({
  body: z.object({ id: z.string(), disabled: z.boolean(), reason: z.string().max(200).optional() }),
})(async (c, { body }) => {
  if (!viewerOf(c)?.isOwner) return c.json({ error: "只有站長能執行" }, 403);
  if (!SOURCE_REGISTRY.some((source) => source.id === body.id && source.runtime === "worker")) {
    return c.json({ error: "只能切換 Worker 來源" }, 400);
  }
  const switches = await setSourceSwitch(c.env.DB, body.id, body.disabled, body.reason);
  await bumpDataVersion(c.env.DB);
  return c.json({ switches });
});
