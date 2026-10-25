import { defineScheduled } from "void";
import { SUBREQUEST_BUDGET, estimatePricesSubrequests, runJob } from "../src/server/jobs.ts";

// 隔天 UTC 01:10 補抓延遲或被修正的收盤，抓完立刻再核對一次，修正過的收盤不會停在「待核對」。
// 兩個工作在同一次執行裡共用 50 個外部請求額度：核對只用補抓剩下的（名單大時 ETF 留給傍晚的核對排程）。
export const cron = "10 1 * * 2-6";

export default defineScheduled(async (controller, env) => {
  const prices = await runJob(env.DB, "prices", `cron ${controller.cron}`);
  const used = typeof prices.detail.subrequests === "number" ? prices.detail.subrequests : await estimatePricesSubrequests(env.DB);
  await runJob(env.DB, "crosscheck", `cron ${controller.cron}`, { maxSymbols: SUBREQUEST_BUDGET - used });
});
