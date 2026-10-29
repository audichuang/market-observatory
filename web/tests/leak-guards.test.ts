// 開放註冊後的防線：資料來源頁不外洩執行紀錄的細節，一般使用者每天能加入的全站新公司有上限。
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { FakeUpstream, migratedDb } from "./helpers/fake-cloudflare.ts";
import { FILLERS, consistentSpx, seededDb } from "./helpers/stress-env.ts";
import { importResults } from "../src/server/ai-batch.ts";

const upstream = new FakeUpstream();
let restore: () => void;
before(() => {
  restore = upstream.install();
  upstream.rules = [consistentSpx];
});
after(() => restore());

test("資料來源頁的 loader 不送 detail、不含 email，trigger 只剩 cron／manual／local", async () => {
  const { db, sql } = await migratedDb();
  const ins = sql.prepare("INSERT INTO runs (job, trigger, status, started_at, finished_at, summary, detail) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const detail = JSON.stringify({ userId: "user-abc", token: "deadbeef", stack: "Error: boom\n    at x (owner@example.com)" });
  ins.run("prices", "manual owner@example.com", "error", "2026-10-26T00:00:00Z", "2026-10-26T00:01:00Z", "失敗", detail);
  ins.run("prices", "manual-cron owner@example.com", "ok", "2026-10-26T01:00:00Z", "2026-10-26T01:01:00Z", "完成", detail);
  ins.run("prices", "cron 0 21 * * 1-5", "ok", "2026-10-26T02:00:00Z", "2026-10-26T02:01:00Z", "完成", detail);
  ins.run("ai-daily", "ai-batch", "partial", "2026-10-26T03:00:00Z", "2026-10-26T03:01:00Z", "預期 2、寫入 1", detail);
  const { loader } = await import("../pages/sources.server.ts");
  const out = (await (loader as unknown as (c: unknown) => Promise<{ runs: Record<string, unknown>[]; registry: Record<string, unknown>[]; ai: unknown }>)({ env: { DB: db } }));
  assert.equal(out.registry.length, 14);
  assert.ok(out.registry.every((source) => !("patterns" in source)), "清冊不送 RegExp");
  assert.equal(out.runs.length, 4);
  for (const r of out.runs) assert.ok(!("detail" in r), JSON.stringify(r));
  assert.deepEqual(out.runs.map((r) => r.trigger), ["local", "cron", "manual", "manual"]);
  assert.ok(out.ai);
  assert.doesNotMatch(JSON.stringify(out.ai), /detail/);
  const json = JSON.stringify(out);
  assert.ok(!json.includes("@"), json);
  assert.ok(!json.includes("stack"), json);
  assert.ok(!json.includes("detail"), json);
});

test("資料來源頁命中快取後，AI 匯入未 bump data_version 仍立即反映 D1 狀態與執行紀錄", async (t) => {
  const { db, sql } = await migratedDb();
  const original = Object.getOwnPropertyDescriptor(globalThis, "caches");
  const stored = new Map<string, Response>();
  let hits = 0;
  Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
    match: async (key: string) => { const hit = stored.get(key); if (hit) hits++; return hit?.clone(); },
    put: async (key: string, response: Response) => { stored.set(key, response.clone()); },
  } } });
  t.after(() => { if (original) Object.defineProperty(globalThis, "caches", original); else Reflect.deleteProperty(globalThis, "caches"); });
  const { loader } = await import("../pages/sources.server.ts");
  const load = loader as unknown as (c: unknown) => Promise<{ runs: Record<string, unknown>[]; ai: { daily: { lastRun: { status: string; summary: string } | null } } }>;
  const ctx = { env: { DB: db } };
  const before = await load(ctx);
  assert.equal(before.ai.daily.lastRun, null);
  assert.deepEqual(before.runs, []);
  await importResults(db, { run: { id: "cached-page-partial", kind: "daily", expected: ["points:missing"], missing: ["points:missing"], unavailable: [] } });
  await importResults(db, { run: { id: "cached-page-translate", kind: "translate", expected: ["missing"], missing: ["missing"], unavailable: [] } });
  const out = await load(ctx);
  assert.equal(hits, 1, "第二次確實從相同版本的頁面快取讀取");
  assert.equal(out.ai.daily.lastRun?.status, "failed");
  assert.equal(out.ai.daily.lastRun?.summary, "預期 1、寫入 0、缺答案 1、拒收 0、正文取不到 0");
  assert.deepEqual(out.runs.map(({ job, trigger, status, summary }) => ({ job, trigger, status, summary })), [
    { job: "ai-translate", trigger: "local", status: "failed", summary: "預期 1、寫入 0、缺答案 1、拒收 0、正文取不到 0" },
    { job: "ai-daily", trigger: "local", status: "failed", summary: "預期 1、寫入 0、缺答案 1、拒收 0、正文取不到 0" },
  ]);
  assert.doesNotMatch(JSON.stringify(out.runs), /detail|ai-batch|@|stack/);
  assert.equal(sql.prepare("SELECT value FROM settings WHERE key = 'data_version'").get(), undefined);
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

test("刪除帳號時一併刪掉這個使用者的每日新增額度列，不動其他人的", async () => {
  const { db, sql } = await migratedDb();
  const put = sql.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  put.run("watch-new:u_1:2026-10-26", "3");
  put.run("watch-new:u_1:2026-10-27", "1");
  put.run("watch-new:ux1:2026-10-27", "2"); // '_' must not act as a wildcard
  put.run("watch-new:u_10:2026-10-27", "2");
  const { DELETE } = await import("../routes/api/v1/me.ts");
  const c = {
    get: (k: string) => (k === "user" ? { id: "u_1", email: "u1@example.com", name: "" } : undefined),
    env: { DB: db, OWNER_EMAIL: "owner@example.com" },
    json: (body: unknown, status?: number) => ({ body, status }),
  };
  const out = await (DELETE as unknown as (c: unknown) => Promise<unknown>)(c);
  assert.deepEqual(out, { deleted: true });
  const left = (sql.prepare("SELECT key FROM settings WHERE key LIKE 'watch-new:%' ORDER BY key").all() as { key: string }[]).map((r) => r.key);
  assert.deepEqual(left, ["watch-new:u_10:2026-10-27", "watch-new:ux1:2026-10-27"]);
});
