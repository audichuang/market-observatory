import { defineScheduled } from "void";
import { SCHEDULES, runJobs } from "../src/server/jobs.ts";
import { apnsConfig } from "../src/server/push.ts";

export const cron = "0 */4 * * *";

export default defineScheduled(async (controller, env) => {
  // 同一次排程順便輪流更新最多 16 檔成分股的分析師共識；新聞先抓，分析師用剩下的請求額度，前 100 檔約一天半輪一遍。
  await runJobs(env.DB, `cron ${controller.cron}`, SCHEDULES["news"], undefined, { push: apnsConfig(env) });
});
