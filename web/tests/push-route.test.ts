import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { POST } from "../routes/api/v1/push.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

test("測試推播成功清除上次失敗；失敗保留錯誤、失效裝置刪除", async () => {
  const { db, sql } = await migratedDb();
  const originalFetch = globalThis.fetch;
  try {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const der = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
    const privateKey = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString("base64")}\n-----END PRIVATE KEY-----`;
    const tokens = { ok: "a".repeat(64), failed: "b".repeat(64), gone: "c".repeat(64) };
    for (const token of Object.values(tokens)) sql.prepare("INSERT INTO devices (token, user_id, list_key, environment, created_at, updated_at, last_error) VALUES (?, 'push-user', 'watchlist:push-user', 'sandbox', 'x', 'x', 'old failure')").run(token);
    const requested: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      assert.equal(url.host, "api.sandbox.push.apple.com");
      const token = url.pathname.split("/").at(-1)!;
      requested.push(token);
      return token === tokens.ok ? new Response(null, { status: 200 }) : new Response(JSON.stringify({ reason: token === tokens.gone ? "Unregistered" : "DeviceTokenNotForTopic" }), { status: token === tokens.gone ? 410 : 400 });
    }) as typeof fetch;
    const app = new Hono();
    app.use("*", async (c, next) => { c.set("user" as never, { id: "push-user", email: "push@example.test" } as never); await next(); });
    app.post("/api/v1/push", async (c) => {
      const out = await (POST as unknown as (c: unknown) => Promise<unknown>)(c);
      return out instanceof Response ? out : c.json(out);
    });
    const response = await app.request("http://localhost/api/v1/push", { method: "POST" }, { DB: db, APNS_TEAM_ID: "A1TEAM", APNS_KEY_ID: "A1KEY", APNS_PRIVATE_KEY: privateKey, APPLE_BUNDLE_ID: "app.test" });
    assert.equal(response.status, 200);
    const body = await response.json() as { results: { result: string }[] };
    assert.equal(body.results.length, 3);
    assert.equal(requested.length, 3);
    assert.equal((sql.prepare("SELECT last_error FROM devices WHERE token = ?").get(tokens.ok) as { last_error: string | null }).last_error, null, "成功的測試推播要清掉上次失敗");
    assert.equal((sql.prepare("SELECT last_error FROM devices WHERE token = ?").get(tokens.failed) as { last_error: string | null }).last_error, "old failure");
    assert.equal(sql.prepare("SELECT token FROM devices WHERE token = ?").get(tokens.gone), undefined);
  } finally { globalThis.fetch = originalFetch; sql.close(); }
});
