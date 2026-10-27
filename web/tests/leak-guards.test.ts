// 開放註冊後的防線：資料來源頁不外洩執行紀錄的細節，一般使用者每天能加入的全站新公司有上限。
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { FakeUpstream, migratedDb } from "./helpers/fake-cloudflare.ts";
import { FILLERS, consistentSpx, seededDb } from "./helpers/stress-env.ts";

const upstream = new FakeUpstream();
let restore: () => void;
before(() => {
  restore = upstream.install();
  upstream.rules = [consistentSpx];
});
after(() => restore());

test("資料來源頁的 loader 不送 detail、不含 email，trigger 只剩 cron／manual", async () => {
  const { db, sql } = await migratedDb();
  const ins = sql.prepare("INSERT INTO runs (job, trigger, status, started_at, finished_at, summary, detail) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const detail = JSON.stringify({ userId: "user-abc", token: "deadbeef", stack: "Error: boom\n    at x (owner@example.com)" });
  ins.run("prices", "manual owner@example.com", "error", "2026-10-26T00:00:00Z", "2026-10-26T00:01:00Z", "失敗", detail);
  ins.run("prices", "manual-cron owner@example.com", "ok", "2026-10-26T01:00:00Z", "2026-10-26T01:01:00Z", "完成", detail);
  ins.run("prices", "cron 0 21 * * 1-5", "ok", "2026-10-26T02:00:00Z", "2026-10-26T02:01:00Z", "完成", detail);
  const { loader } = await import("../pages/sources.server.ts");
  const out = (await (loader as unknown as (c: unknown) => Promise<{ runs: Record<string, unknown>[] }>)({ env: { DB: db } }));
  assert.equal(out.runs.length, 3);
  for (const r of out.runs) assert.ok(!("detail" in r), JSON.stringify(r));
  assert.deepEqual(out.runs.map((r) => r.trigger), ["cron", "manual", "manual"]);
  const json = JSON.stringify(out);
  assert.ok(!json.includes("@"), json);
  assert.ok(!json.includes("stack"), json);
});

test("一般使用者每天最多加入 5 家全站新公司；第 6 家不打上游，已有人追蹤的與站長名單不受限", async () => {
  const { db } = await seededDb();
  const { addWatchSymbol } = await import("../src/server/jobs.ts");
  const MAX_NEW_TRACKED_PER_DAY = 5;
  const user = "watchlist:u1";
  for (const s of FILLERS.slice(0, MAX_NEW_TRACKED_PER_DAY)) {
    const r = await addWatchSymbol(db, s, undefined, user);
    assert.ok(r.ok, JSON.stringify(r));
  }
  upstream.reset();
  const sixth = await addWatchSymbol(db, FILLERS[MAX_NEW_TRACKED_PER_DAY], undefined, user);
  assert.equal(sixth.ok, false);
  assert.match(!sixth.ok ? sixth.error : "", /今天新增的新公司已達上限/);
  assert.equal(upstream.count, 0, "被拒的新代號不能打上游");

  // 站長名單不受此上限（這裡加第 6 家以上的全站新公司）。
  for (const s of FILLERS.slice(10, 10 + MAX_NEW_TRACKED_PER_DAY + 1)) {
    const r = await addWatchSymbol(db, s);
    assert.ok(r.ok, JSON.stringify(r));
  }
  // 已達上限的使用者仍能加入別人已在追蹤的公司。
  const tracked = await addWatchSymbol(db, FILLERS[10], undefined, user);
  assert.ok(tracked.ok, JSON.stringify(tracked));
});

test("已用 4 家時並發加入兩家全站新公司：只有一家成功、只有一家打上游", async () => {
  const { db, sql } = await seededDb();
  const { addWatchSymbol } = await import("../src/server/jobs.ts");
  const user = "watchlist:u2";
  let perAdd = 0;
  for (const s of FILLERS.slice(20, 24)) {
    upstream.reset();
    const r = await addWatchSymbol(db, s, undefined, user);
    assert.ok(r.ok, JSON.stringify(r));
    perAdd = upstream.count;
  }
  upstream.reset();
  const results = await Promise.all([addWatchSymbol(db, FILLERS[24], undefined, user), addWatchSymbol(db, FILLERS[25], undefined, user)]);
  assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
  const rejected = results.find((r) => !r.ok);
  assert.match(rejected && !rejected.ok ? rejected.error : "", /今天新增的新公司已達上限/);
  assert.equal(upstream.count, perAdd, "被拒的那一家不能打上游");
  const row = sql.prepare("SELECT value FROM settings WHERE key LIKE 'watch-new:u2:%'").get() as { value: string };
  assert.equal(JSON.parse(row.value), 5);
});

test("上游失敗的新代號也算一次額度：第 5 家抓價失敗後，第 6 家被拒且不打上游", async () => {
  const { db } = await seededDb();
  const { addWatchSymbol } = await import("../src/server/jobs.ts");
  const user = "watchlist:u3";
  for (const s of FILLERS.slice(30, 34)) {
    const r = await addWatchSymbol(db, s, undefined, user);
    assert.ok(r.ok, JSON.stringify(r));
  }
  const broken = FILLERS[34];
  upstream.rules = [(u) => (u.host.endsWith("finance.yahoo.com") && u.href.includes(broken) ? new Response("down", { status: 500 }) : null), consistentSpx];
  try {
    const failed = await addWatchSymbol(db, broken, undefined, user);
    assert.equal(failed.ok, false);
    assert.match(!failed.ok ? failed.error : "", /抓不到/);
  } finally {
    upstream.rules = [consistentSpx];
  }
  upstream.reset();
  const sixth = await addWatchSymbol(db, FILLERS[35], undefined, user);
  assert.equal(sixth.ok, false);
  assert.match(!sixth.ok ? sixth.error : "", /今天新增的新公司已達上限/);
  assert.equal(upstream.count, 0);
});
