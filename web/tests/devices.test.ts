import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { POST } from "../routes/api/v1/devices.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

const token = (n: number) => n.toString(16).padStart(64, "0");

async function registrationDb() {
  const { db, sql } = await migratedDb();
  const app = new Hono<{ Bindings: { DB: D1Database; OWNER_EMAIL: string }; Variables: { user: { id: string; email: string } } }>();
  app.use("*", async (c, next) => {
    const id = c.req.header("x-test-user") ?? "u1";
    c.set("user", { id, email: `${id}@example.test` });
    await next();
  });
  app.post("/devices", POST as never);
  const register = async (n: number, environment = "production", user = "u1") => {
    const res = await app.request("http://localhost/devices", {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": user },
      body: JSON.stringify({ token: token(n), environment, appVersion: "1.0" }),
    }, { DB: db, OWNER_EMAIL: "owner@example.test" });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { registered: true });
  };
  return { sql, register };
}

test("裝置重新註冊保留 last_error；換環境或換帳號才清除", async () => {
  const { sql, register } = await registrationDb();
  await register(1);
  const error = () => (sql.prepare("SELECT last_error FROM devices WHERE token = ?").get(token(1)) as { last_error: string | null }).last_error;
  sql.prepare("UPDATE devices SET last_error = 'APNs: HTTP 500'").run();
  await register(1);
  assert.equal(error(), "APNs: HTTP 500");
  await register(1, "sandbox");
  assert.equal(error(), null);
  sql.prepare("UPDATE devices SET last_error = 'APNs: HTTP 400'").run();
  await register(1, "sandbox", "u2");
  assert.equal(error(), null);
  assert.equal((sql.prepare("SELECT user_id FROM devices").get() as { user_id: string }).user_id, "u2");
});

test("第 11 台裝置註冊時刪除最舊的一台，不動別人的裝置", async () => {
  const { sql, register } = await registrationDb();
  await register(99, "production", "other");
  for (let n = 1; n <= 10; n++) {
    await register(n);
    sql.prepare("UPDATE devices SET updated_at = ? WHERE token = ?").run(`2026-10-${String(n).padStart(2, "0")}T00:00:00Z`, token(n));
  }
  await register(11);
  const left = sql.prepare("SELECT token FROM devices WHERE user_id = 'u1' ORDER BY token").all() as { token: string }[];
  assert.deepEqual(left.map((r) => r.token), Array.from({ length: 10 }, (_, i) => token(i + 2)));
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM devices WHERE user_id = 'other'").get() as { n: number }).n, 1);
});

test("裝置更新時間相同時仍保留本次註冊，並按加入順序決定其餘名額", async () => {
  const { sql, register } = await registrationDb();
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(value?: string | number) { super(value ?? "2026-10-28T00:00:00.000Z"); }
    static now() { return RealDate.parse("2026-10-28T00:00:00.000Z"); }
  } as DateConstructor;
  try {
    for (let n = 1; n <= 10; n++) await register(n);
    await register(1); // Refreshing an older row does not change its rowid.
    await register(11);
    const left = sql.prepare("SELECT token FROM devices WHERE user_id = 'u1' ORDER BY token").all() as { token: string }[];
    assert.equal(left.length, 10);
    assert.ok(left.some((r) => r.token === token(11)), "本次註冊必須留下");
    assert.ok(!left.some((r) => r.token === token(1)), "其餘同時更新的裝置以加入順序淘汰");
  } finally { globalThis.Date = RealDate; }
});
