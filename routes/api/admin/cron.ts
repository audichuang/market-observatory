import { defineHandler } from "void";
import { viewerOf } from "../../../src/server/account.ts";
import { SCHEDULES, type ScheduleName, runJobs } from "../../../src/server/jobs.ts";
import { apnsConfig } from "../../../src/server/push.ts";

// 手動跑一支排程（只限站長，middleware/01.gate.ts 擋）：跟排程觸發時一樣，在同一次執行裡依序跑那幾個工作、共用一份外部請求額度。
// 用來在正式站驗證「名單變大後排程會不會超過 Cloudflare 的請求上限」，不用等到排程時間。
export const POST = defineHandler(async (c) => {
  // middleware/01.gate.ts 已經擋過；這裡再檢查一次，route 被搬走或 middleware 改壞也不會變成任何人都能跑。
  const user = viewerOf(c);
  if (!user?.isOwner) return c.json({ error: "只有站長能執行" }, 403);
  const name = c.req.query("name") as ScheduleName;
  if (!Object.hasOwn(SCHEDULES, name)) return c.json({ error: `未知的排程：${name}；可用 ${Object.keys(SCHEDULES).join(", ")}` }, 400);
  const runs = await runJobs(c.env.DB, `manual-cron ${user.email}`, SCHEDULES[name], undefined, { push: apnsConfig(c.env) });
  return c.json({ name, runs });
});
