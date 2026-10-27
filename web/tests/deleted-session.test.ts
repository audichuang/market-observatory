import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { Hono, type Context } from "hono";
import { DELETE as deleteAccount } from "../routes/api/v1/me.ts";
import { POST as registerDevice } from "../routes/api/v1/devices.ts";
import { PUT as savePrefs } from "../routes/api/v1/push.ts";
import { PUT as savePlan } from "../routes/api/v1/etfs.ts";
import { GET as overview } from "../routes/api/v1/overview.ts";
import { GET as news } from "../routes/api/v1/news.ts";
import { GET as watchlist, POST as addWatch } from "../routes/api/v1/watchlist.ts";
import { action as webPlan } from "../pages/etfs.server.ts";
import { action as webWatch } from "../pages/watchlist.server.ts";
import { loader as webOverview } from "../pages/index.server.ts";
import { loader as webNews } from "../pages/news.server.ts";
import { DEFAULT_PLAN } from "../src/server/views.ts";
import { FakeUpstream, migratedDb } from "./helpers/fake-cloudflare.ts";

// Load the actual gate; only replace Vite's compile-time DEV constant and resolve relative imports.
const source = readFileSync(new URL("../middleware/01.gate.ts", import.meta.url), "utf8")
  .replaceAll("import.meta.env.DEV", "false")
  .replace('from "void"', `from ${JSON.stringify(import.meta.resolve("void"))}`)
  .replace('from "../src/server/account.ts"', `from ${JSON.stringify(new URL("../src/server/account.ts", import.meta.url).href)}`);
const { default: gate } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const route = (handler: unknown) => async (c: Context) => {
  const out = await (handler as (c: Context) => Promise<unknown>)(c);
  return out instanceof Response ? out : c.json(out ?? {});
};
const cachedUser = { id: "deleted-user", email: "deleted@example.test", name: "deleted" };
const prefs = { daily: true, moves: true, moveThresholdPct: 5, events: true };
const cases = [
  ["APNs 裝置", "POST", "/api/v1/devices", { token: "a".repeat(64), environment: "sandbox" }],
  ["定投規劃", "PUT", "/api/v1/etfs", DEFAULT_PLAN],
  ["推播偏好", "PUT", "/api/v1/push", prefs],
  ["總覽 GET 名單初始化", "GET", "/api/v1/overview", undefined],
  ["新聞 GET 名單初始化", "GET", "/api/v1/news", undefined],
  ["名單 GET 初始化", "GET", "/api/v1/watchlist", undefined],
  ["名單與每日新增配額", "POST", "/api/v1/watchlist", { symbol: "AVGO" }],
  ["網頁定投 action", "POST", "/etfs", DEFAULT_PLAN],
  ["網頁名單 action 與配額", "POST", "/watchlist", { op: "add", symbol: "AVGO" }],
  ["網頁總覽 loader 初始化", "GET", "/", undefined],
  ["網頁新聞 loader 初始化", "GET", "/news", undefined],
] as const;

for (const [label, method, path, body] of cases) test(`刪除帳號後的快取身分不能寫入${label}`, async () => {
  const { db, sql } = await migratedDb();
  const upstream = new FakeUpstream();
  const restore = upstream.install();
  try {
    sql.prepare('INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 0, 0, 0)').run(cachedUser.id, cachedUser.name, cachedUser.email);
    sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, fetched_at) VALUES ('2026-10-28', 'AVGO', 'Broadcom', 2, 'x')").run();
    const app = new Hono();
    // Better Auth's cookieCache can return this same authenticated identity after its row is deleted.
    app.use("*", async (c, next) => { c.set("user" as never, cachedUser as never); c.set("session" as never, { userId: cachedUser.id } as never); await next(); });
    app.use("*", gate);
    app.delete("/api/v1/me", route(deleteAccount));
    app.post("/api/v1/devices", route(registerDevice));
    app.put("/api/v1/etfs", route(savePlan));
    app.put("/api/v1/push", route(savePrefs));
    app.get("/api/v1/overview", route(overview));
    app.get("/api/v1/news", route(news));
    app.get("/api/v1/watchlist", route(watchlist));
    app.post("/api/v1/watchlist", route(addWatch));
    app.post("/etfs", route(webPlan));
    app.post("/watchlist", route(webWatch));
    app.get("/", route(webOverview));
    app.get("/news", route(webNews));
    const env = { DB: db, OWNER_EMAIL: "owner@example.test" };
    assert.equal((await app.request("http://localhost/api/v1/me", { method: "DELETE" }, env)).status, 200);
    assert.equal(sql.prepare('SELECT id FROM "user" WHERE id = ?').get(cachedUser.id), undefined);
    upstream.reset();
    const response = await app.request(`http://localhost${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }, env);
    const settings = sql.prepare("SELECT key FROM settings WHERE key LIKE '%deleted-user%' ORDER BY key").all();
    const devices = sql.prepare("SELECT token FROM devices WHERE user_id = ?").all(cachedUser.id);
    assert.deepEqual({ status: response.status, settings, devices, externalRequests: upstream.count }, { status: path.startsWith("/api/") ? 401 : 302, settings: [], devices: [], externalRequests: 0 });
  } finally { restore(); sql.close(); }
});

test("已刪帳號打開公開登入頁時不再帶快取身分，避免重新導回受保護頁", async () => {
  const { db, sql } = await migratedDb();
  try {
    const app = new Hono();
    app.use("*", async (c, next) => { c.set("user" as never, cachedUser as never); c.set("session" as never, { userId: cachedUser.id } as never); await next(); });
    app.use("*", gate);
    app.get("/login", (c) => c.json({ user: c.get("user" as never), session: c.get("session" as never), shared: c.get("shared" as never) }));
    const response = await app.request("http://localhost/login", {}, { DB: db });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { user: null, session: null, shared: { userEmail: null, isOwner: false, path: "/login" } });
  } finally { sql.close(); }
});
