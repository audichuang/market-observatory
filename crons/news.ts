import { defineScheduled } from "void";
import { runJob } from "../src/server/jobs.ts";

export const cron = "0 */4 * * *";

export default defineScheduled(async (controller, env) => {
  await runJob(env.DB, "news", `cron ${controller.cron}`);
});
