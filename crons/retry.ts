import { defineScheduled } from "void";
import { runJob } from "../src/server/jobs.ts";

// 隔天 UTC 01:10 補抓延遲或被修正的收盤，抓完立刻再核對一次，修正過的收盤不會停在「待核對」。
export const cron = "10 1 * * 2-6";

export default defineScheduled(async (controller, env) => {
  await runJob(env.DB, "prices", `cron ${controller.cron}`);
  await runJob(env.DB, "crosscheck", `cron ${controller.cron}`);
});
