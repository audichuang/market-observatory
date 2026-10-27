import { defineHandler } from "void";
import { viewerOf } from "../../../src/server/account.ts";
import { JOB_NAMES, type JobName, runJob } from "../../../src/server/jobs.ts";
import { apnsConfig } from "../../../src/server/push.ts";

// 手動觸發排程工作（只限站長，middleware/01.gate.ts 擋）；結果同樣寫進 runs。
// 回補用參數：part（分段序號）、sessions（重算天數）、upTo（重算到哪一天）。
export const POST = defineHandler(async (c) => {
  // middleware/01.gate.ts 已經擋過；這裡再檢查一次，route 被搬走或 middleware 改壞也不會變成任何人都能跑。
  const user = viewerOf(c);
  if (!user?.isOwner) return c.json({ error: "只有站長能執行" }, 403);
  const job = c.req.query("job") as JobName;
  if (!JOB_NAMES.includes(job)) return c.json({ error: `未知的工作：${job}` }, 400);
  const int = (v: string | undefined) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : undefined);
  const upTo = c.req.query("upTo");
  const result = await runJob(c.env.DB, job, "manual", {
    part: int(c.req.query("part")),
    sessions: int(c.req.query("sessions")),
    upTo: upTo && /^\d{4}-\d{2}-\d{2}$/.test(upTo) ? upTo : undefined,
    push: apnsConfig(c.env),
  });
  return c.json(result);
});
