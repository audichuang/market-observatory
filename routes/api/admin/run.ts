import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { JOB_NAMES, type JobName, runJob } from "../../../src/server/jobs.ts";

// 手動觸發排程工作（只限登入的擁有者）；結果同樣寫進 runs。
// 回補用參數：part（分段序號）、sessions（重算天數）、upTo（重算到哪一天）。
export const POST = defineHandler(async (c) => {
  const user = requireAuth(c);
  const job = c.req.query("job") as JobName;
  if (!JOB_NAMES.includes(job)) return c.json({ error: `未知的工作：${job}` }, 400);
  const int = (v: string | undefined) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : undefined);
  const upTo = c.req.query("upTo");
  const result = await runJob(c.env.DB, job, `manual ${user.email}`, {
    part: int(c.req.query("part")),
    sessions: int(c.req.query("sessions")),
    upTo: upTo && /^\d{4}-\d{2}-\d{2}$/.test(upTo) ? upTo : undefined,
  });
  return c.json(result);
});
