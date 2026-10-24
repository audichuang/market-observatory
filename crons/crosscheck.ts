import { defineScheduled } from "void";
import { runJob } from "../src/server/jobs.ts";

// 收盤抓價一小時後，用 Nasdaq 逐檔核對收盤價。
export const cron = "50 22 * * 1-5";

export default defineScheduled(async (controller, env) => {
  await runJob(env.DB, "crosscheck", `cron ${controller.cron}`);
});
