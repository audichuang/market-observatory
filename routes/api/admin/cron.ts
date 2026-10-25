import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { SCHEDULES, type ScheduleName, runJobs } from "../../../src/server/jobs.ts";

// 手動跑一支排程（只限登入的擁有者）：跟排程觸發時一樣，在同一次執行裡依序跑那幾個工作、共用一份外部請求額度。
// 用來在正式站驗證「名單變大後排程會不會超過 Cloudflare 的請求上限」，不用等到排程時間。
export const POST = defineHandler(async (c) => {
  const user = requireAuth(c);
  const name = c.req.query("name") as ScheduleName;
  if (!Object.hasOwn(SCHEDULES, name)) return c.json({ error: `未知的排程：${name}；可用 ${Object.keys(SCHEDULES).join(", ")}` }, 400);
  const runs = await runJobs(c.env.DB, `manual-cron ${user.email}`, SCHEDULES[name]);
  return c.json({ name, runs });
});
