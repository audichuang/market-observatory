import { defineScheduled } from "void";
import { runJob } from "../src/server/jobs.ts";

// 美股收盤後抓日線：UTC 21:40 = 冬令美東 16:40／夏令 17:40，兩季都已過收盤截止 16:30。
export const cron = "40 21 * * 1-5";

export default defineScheduled(async (controller, env) => {
  await runJob(env.DB, "prices", `cron ${controller.cron}`);
});
