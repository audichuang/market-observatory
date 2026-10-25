import { defineScheduled } from "void";
import { SCHEDULES, runJobs } from "../src/server/jobs.ts";

// 隔天 UTC 01:10 補抓延遲或被修正的收盤，抓完立刻再核對一次，修正過的收盤不會停在「待核對」。
// 兩個工作在同一次執行裡共用一份外部請求額度：收盤用 spark 批次抓（約 5 個），核對拿剩下的（名單 30 家約 50 個）。
export const cron = "10 1 * * 2-6";

export default defineScheduled(async (controller, env) => {
  await runJobs(env.DB, `cron ${controller.cron}`, SCHEDULES["retry"]);
});
