import { defineScheduled } from "void";
import { runJob } from "../src/server/jobs.ts";

export const cron = "0 */4 * * *";

export default defineScheduled(async (controller, env) => {
  await runJob(env.DB, "news", `cron ${controller.cron}`);
  // 同一次排程順便輪流更新 12 檔成分股的分析師共識（約 25 個子請求），前 100 檔約一天半輪一遍。
  await runJob(env.DB, "analysts", `cron ${controller.cron}`);
});
