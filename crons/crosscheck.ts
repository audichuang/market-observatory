import { defineScheduled } from "void";
import { SCHEDULES, runJobs } from "../src/server/jobs.ts";
import { apnsConfig } from "../src/server/push.ts";

// 收盤抓價一小時後，用 Nasdaq 逐檔核對收盤價。
export const cron = "50 22 * * 1-5";

export default defineScheduled(async (controller, env) => {
  await runJobs(env.DB, `cron ${controller.cron}`, SCHEDULES["crosscheck"], undefined, { push: apnsConfig(env) });
});
