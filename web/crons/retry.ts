import { defineScheduled } from "void";
import { SCHEDULES, runJobs } from "../src/server/jobs.ts";
import { apnsConfig } from "../src/server/push.ts";

// Retry at UTC 02:00 (Taipei 10:00), after the observed Cboe CSV update at UTC 01:11.
// Fetch delayed or corrected closes, then cross-check them in the same run.
// 兩個工作在同一次執行裡共用一份外部請求額度：收盤用 spark 批次抓（約 5 個），核對拿剩下的（名單 30 家約 50 個）。
export const cron = "0 2 * * 2-6";

export default defineScheduled(async (controller, env) => {
  await runJobs(env.DB, `cron ${controller.cron}`, SCHEDULES["retry"], undefined, { push: apnsConfig(env) });
});
