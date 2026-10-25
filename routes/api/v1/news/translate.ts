import { defineHandler } from "void";
import { z } from "zod";
import { requireViewer } from "../../../../src/server/account.ts";
import { Budget } from "../../../../src/lib/sources/http.ts";
import { aiFromEnv } from "../../../../src/server/anthropic.ts";
import { AiHttpError, MAX_TRANSLATE, TRANSLATE_BUDGET, translateNews } from "../../../../src/server/news-ai.ts";
import { membersOf } from "../../../../src/server/views.ts";

// 使用者打開新聞畫面時，把畫面上還沒翻的標題送來：伺服器只處理還沒翻的，一次 Haiku 呼叫，結果存進 D1 所有人共用。
export const POST = defineHandler.withValidator({
  body: z.object({ ids: z.array(z.string().min(1).max(200)).min(1).max(MAX_TRANSLATE), symbol: z.string().max(20).optional() }),
})(async (c, { body }) => {
  const v = requireViewer(c);
  const members = await membersOf(c, v);
  try {
    return await translateNews(c.env.DB, aiFromEnv(c.env, new Budget(TRANSLATE_BUDGET)), v, members, body.ids, body.symbol && members.some((m) => m.key === body.symbol || body.symbol === "SPY") ? body.symbol : null);
  } catch (e) {
    if (e instanceof AiHttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});
