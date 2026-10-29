import { defineHandler } from "void";
import { z } from "zod";
import { easternDate } from "../../../src/lib/calendar.ts";
import { viewerOf } from "../../../src/server/account.ts";
import { dailyWork, importResults, translateWork } from "../../../src/server/ai-batch.ts";

// 新聞 AI 排程（scripts/ai-batch.ts）用的兩個端點，只限站長（middleware/01.gate.ts 擋，這裡再檢查一次）：
// GET ?kind=translate|daily 拿待辦；POST 送回 agent 的答案，驗證後寫進 D1。
export const GET = defineHandler(async (c) => {
  if (!viewerOf(c)?.isOwner) return c.json({ error: "只有站長能執行" }, 403);
  const today = easternDate();
  const kind = c.req.query("kind");
  if (kind === "translate") return c.json({ translate: await translateWork(c.env.DB, today) });
  if (kind === "daily") return c.json(await dailyWork(c.env.DB, today));
  return c.json({ error: "kind 要是 translate 或 daily" }, 400);
});

const answer = z.unknown();
export const POST = defineHandler.withValidator({
  body: z.object({
    model: z.string().max(60).optional(),
    translate: z.array(z.object({ ids: z.array(z.string().min(1).max(200)).min(1).max(20), answer })).max(20).optional(),
    points: z.array(z.object({ id: z.string().min(1).max(200), answer })).max(30).optional(),
    digests: z.array(z.object({ key: z.string().min(1).max(20), date: z.string(), newsIds: z.array(z.string().max(200)).max(20), answer })).max(60).optional(),
    run: z.object({
      id: z.string().min(1).max(64),
      kind: z.enum(["translate", "daily"]),
      expected: z.array(z.string()).max(500),
      missing: z.array(z.string()).max(500),
      unavailable: z.array(z.object({ key: z.string(), reason: z.string() })).max(100),
      manifest: z.unknown().optional(),
    }).optional(),
  }),
})(async (c, { body }) => {
  if (!viewerOf(c)?.isOwner) return c.json({ error: "只有站長能執行" }, 403);
  // 新聞的 AI 欄位與每日重點都在頁面快取之外讀（src/server/views.ts），寫進去下次打開就看得到，不必動資料版本。
  return c.json(await importResults(c.env.DB, body));
});
