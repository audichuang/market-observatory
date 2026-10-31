import { defineScheduled } from "void";
import { SCHEDULES, runJobs } from "../src/server/jobs.ts";
import { apnsConfig } from "../src/server/push.ts";

// 美股收盤後抓日線：UTC 21:40 = 冬令美東 16:40／夏令 17:40，兩季都已過收盤截止 16:30。
export const cron = "40 21 * * MON-FRI";

export default defineScheduled(async (controller, env) => {
  await runJobs(env.DB, `cron ${controller.cron}`, SCHEDULES["prices"], undefined, { push: apnsConfig(env) });
});
