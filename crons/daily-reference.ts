import { defineScheduled } from "void";
import { runJob } from "../src/server/jobs.ts";

// 每天一次：SPY 持股權重（SSGA 約在美東清晨更新）與財報、FOMC 日程。
export const cron = "30 11 * * *";

export default defineScheduled(async (controller, env) => {
  await runJob(env.DB, "weights", `cron ${controller.cron}`);
  await runJob(env.DB, "events", `cron ${controller.cron}`);
});
