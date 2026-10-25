// 刪除帳號時撤銷 Apple 授權：client secret 的 JWT 內容、code 換 token 再撤銷、換錯 Apple ID 不撤銷。
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Budget } from "../src/lib/sources/http.ts";
import { SiwaError, clientSecret, revokeAppleAuthorization, siwaConfig } from "../src/server/siwa.ts";

async function testKey() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
  return { pem, publicKey: pair.publicKey };
}

const dec = (x: string) => JSON.parse(Buffer.from(x, "base64url").toString());
const idToken = (sub: string) => `${Buffer.from('{"alg":"RS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub })).toString("base64url")}.sig`;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockApple(tokenResponse: { status: number; body: unknown }) {
  const calls: { url: string; form: URLSearchParams }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, form: new URLSearchParams(String(init?.body ?? "")) });
    if (url.endsWith("/auth/token")) return new Response(JSON.stringify(tokenResponse.body), { status: tokenResponse.status });
    if (url.endsWith("/auth/revoke")) return new Response("", { status: 200 });
    return new Response("", { status: 404 });
  }) as typeof fetch;
  return calls;
}

test("SIWA 設定：缺任何一項就是 null", () => {
  assert.equal(siwaConfig({ APNS_TEAM_ID: "T", SIWA_KEY_ID: "K", APPLE_BUNDLE_ID: "b" }), null);
  assert.deepEqual(siwaConfig({ APNS_TEAM_ID: "T", SIWA_KEY_ID: "K", SIWA_PRIVATE_KEY: "P", APPLE_BUNDLE_ID: "b" }), { teamId: "T", keyId: "K", privateKey: "P", clientId: "b" });
});

test("client secret：ES256、kid／iss／sub／aud 正確、exp 不超過 6 個月，簽章驗得過", async () => {
  const { pem, publicKey } = await testKey();
  const t0 = 1_800_000_000_000;
  const jwt = await clientSecret({ teamId: "TEAM123456", keyId: "SIWAKEY123", privateKey: pem, clientId: "com.audichuang.observatory" }, t0);
  const [h, p, s] = jwt.split(".");
  assert.deepEqual(dec(h), { alg: "ES256", kid: "SIWAKEY123" });
  const claims = dec(p);
  assert.deepEqual(claims, { iss: "TEAM123456", iat: t0 / 1000, exp: t0 / 1000 + 300, aud: "https://appleid.apple.com", sub: "com.audichuang.observatory" });
  assert.ok(claims.exp - claims.iat <= 15_777_000);
  assert.ok(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, Buffer.from(s, "base64url"), new TextEncoder().encode(`${h}.${p}`)));
});

test("撤銷：code 換 refresh token，再用 refresh token 撤銷；兩個請求都算進額度", async () => {
  const { pem } = await testKey();
  const calls = mockApple({ status: 200, body: { access_token: "AT", refresh_token: "RT", id_token: idToken("apple-sub-1") } });
  const budget = new Budget(4);
  await revokeAppleAuthorization({ teamId: "T", keyId: "K", privateKey: pem, clientId: "app.test" }, "CODE", ["apple-sub-1"], budget);
  assert.deepEqual(calls.map((c) => c.url), ["https://appleid.apple.com/auth/token", "https://appleid.apple.com/auth/revoke"]);
  assert.equal(calls[0].form.get("grant_type"), "authorization_code");
  assert.equal(calls[0].form.get("code"), "CODE");
  assert.equal(calls[0].form.get("client_id"), "app.test");
  assert.ok(calls[0].form.get("client_secret"));
  assert.equal(calls[1].form.get("token"), "RT");
  assert.equal(calls[1].form.get("token_type_hint"), "refresh_token");
  assert.equal(budget.used, 2);
});

test("撤銷：授權畫面換了別的 Apple ID 就不撤銷、回 400", async () => {
  const { pem } = await testKey();
  const calls = mockApple({ status: 200, body: { refresh_token: "RT", id_token: idToken("someone-else") } });
  await assert.rejects(
    revokeAppleAuthorization({ teamId: "T", keyId: "K", privateKey: pem, clientId: "app.test" }, "CODE", ["apple-sub-1"], new Budget(4)),
    (e: unknown) => e instanceof SiwaError && e.status === 400,
  );
  assert.equal(calls.length, 1);
});

test("撤銷：code 過期（invalid_grant）回 400，讓使用者重試", async () => {
  const { pem } = await testKey();
  mockApple({ status: 400, body: { error: "invalid_grant" } });
  await assert.rejects(
    revokeAppleAuthorization({ teamId: "T", keyId: "K", privateKey: pem, clientId: "app.test" }, "CODE", ["apple-sub-1"], new Budget(4)),
    (e: unknown) => e instanceof SiwaError && e.status === 400,
  );
});

test("撤銷：金鑰設定錯（invalid_client）回 502 並帶 Apple 的錯誤，不叫使用者重試", async () => {
  const { pem } = await testKey();
  mockApple({ status: 400, body: { error: "invalid_client" } });
  await assert.rejects(
    revokeAppleAuthorization({ teamId: "T", keyId: "K", privateKey: pem, clientId: "app.test" }, "CODE", ["apple-sub-1"], new Budget(4)),
    (e: unknown) => e instanceof SiwaError && e.status === 502 && e.message.includes("invalid_client"),
  );
});
