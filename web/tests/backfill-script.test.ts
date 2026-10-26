// scripts/backfill.ts：用本機假伺服器當 Worker，驗證步驟順序與結束狀態（不打任何真實網路）。
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { join } from "node:path";
import { test } from "node:test";

async function runScript(args: string[], history: object) {
  const jobs: string[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/api/auth/sign-in/email") {
      res.setHeader("set-cookie", "s=1; Path=/");
      return void res.end("{}");
    }
    const job = url.searchParams.get("job") ?? "";
    jobs.push(job);
    const body = job === "backfill-index-history" ? history : { status: "ok", summary: "第 1/1 段" };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const child = spawn(process.execPath, [join(import.meta.dirname, "../scripts/backfill.ts"), "--sessions", "60", ...args], {
    env: { ...process.env, MO_URL: `http://127.0.0.1:${port}`, MO_EMAIL: "a@b.c", MO_PASSWORD: "x" },
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const code = await new Promise<number | null>((r) => child.on("close", r));
  server.close();
  return { code, jobs, out };
}

const SPX_SKIPPED = { status: "partial", summary: "SPX 重疊不足，略過 SPX", detail: { remaining: { SPX: 340, VIX: 0 }, inserted: { SPX: 0, VIX: 0 } } };

test("一般模式：歷史步驟 partial 不擋後面的步驟，全部跑完後才以非零結束並印出原因", async () => {
  const r = await runScript([], SPX_SKIPPED);
  for (const j of ["backfill-checks", "weights", "snapshots"]) assert.ok(r.jobs.includes(j), `沒跑 ${j}：${r.jobs}`);
  assert.notEqual(r.code, 0);
  assert.match(r.out, /SPX 重疊不足/);
  assert.doesNotMatch(r.out, /回補完成/);
});

test("--history-only：SPX 被略過就立刻非零結束、不跑其他步驟、不報完成", async () => {
  const r = await runScript(["--history-only"], SPX_SKIPPED);
  assert.deepEqual(r.jobs, ["backfill-index-history"]);
  assert.notEqual(r.code, 0);
  assert.doesNotMatch(r.out, /完成/);
});
