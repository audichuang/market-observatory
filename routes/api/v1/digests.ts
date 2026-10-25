import { defineHandler } from "void";
import { z } from "zod";
import { easternDate } from "../../../src/lib/calendar.ts";
import { Budget } from "../../../src/lib/sources/http.ts";
import { requireViewer } from "../../../src/server/account.ts";
import { aiFromEnv } from "../../../src/server/anthropic.ts";
import { AiHttpError, DIGESTS_BUDGET, generateDigests } from "../../../src/server/news-ai.ts";
import { getSnapshot } from "../../../src/server/repo.ts";
import { membersOf } from "../../../src/server/views.ts";

// 使用者按「產生今日重點」時才呼叫：替名單上這天有真的在講它的新聞、但還沒有重點的公司（一次最多 5 家）各寫一則。
export const POST = defineHandler.withValidator({
  body: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
})(async (c, { body }) => {
  const v = requireViewer(c);
  try {
    const date = body.date ?? (await getSnapshot(c.env.DB))?.tradeDate ?? easternDate();
    return await generateDigests(c.env.DB, aiFromEnv(c.env, new Budget(DIGESTS_BUDGET)), v, await membersOf(c, v), date);
  } catch (e) {
    if (e instanceof AiHttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});
