import { defineScheduled } from "void";
import { SCHEDULES, runJobs } from "../src/server/jobs.ts";

// 每天一次：SPY 持股權重（SSGA 約在美東清晨更新）與財報、FOMC 日程；
// FactSet 週報每週五更新，每天只看轉址，有新的一期才下載解析。三個工作共用同一次執行的請求額度。
export const cron = "30 11 * * *";

export default defineScheduled(async (controller, env) => {
  await runJobs(env.DB, `cron ${controller.cron}`, SCHEDULES["daily-reference"]);
});
