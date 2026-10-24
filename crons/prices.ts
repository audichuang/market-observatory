import { defineScheduled } from "void";
import { runJob } from "../src/server/jobs.ts";

// 美股收盤後抓日線（UTC 21:20 = 夏令 17:20／冬令 16:20 美東）；隔天 UTC 01:10 再補一次延遲資料。
export const cron = ["20 21 * * 1-5", "10 1 * * 2-6"];

export default defineScheduled(async (controller, env) => {
  await runJob(env.DB, "prices", `cron ${controller.cron}`);
});
