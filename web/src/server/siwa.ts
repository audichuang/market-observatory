// 刪除帳號時撤銷 Sign in with Apple 的授權（App Store 審查指南 5.1.1(v)：提供 Apple 登入又能在 App 內刪帳號，
// 刪除時要呼叫 Apple 的 REST API 撤銷 token）。
//
// 不存 refresh token：App 刪帳號前再跑一次 Apple 授權，把拿到的 authorization code（5 分鐘內有效、只能用一次）送上來，
// 這裡用它換 refresh token、立刻撤銷。這樣這個改動之前用 Apple 建立的帳號也一樣能撤銷。
import { type Budget, SourceError, fetchWithTimeout } from "../lib/sources/http.ts";
import { es256Jwt } from "./push.ts";

export const SIWA_SOURCE = "Sign in with Apple";
const APPLE_ID = "https://appleid.apple.com";

export interface SiwaConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
  /** App 原生登入的 client_id 就是 bundle ID */
  clientId: string;
}

export function siwaConfig(env: Record<string, unknown>): SiwaConfig | null {
  const s = (k: string) => (typeof env[k] === "string" ? (env[k] as string).trim() : "");
  const c = { teamId: s("APNS_TEAM_ID"), keyId: s("SIWA_KEY_ID"), privateKey: s("SIWA_PRIVATE_KEY"), clientId: s("APPLE_BUNDLE_ID") };
  return c.teamId && c.keyId && c.privateKey && c.clientId ? c : null;
}

/** client secret：用開了 Sign in with Apple 的 .p8 金鑰簽的 ES256 JWT。每次刪帳號才用一次，給 5 分鐘就夠（Apple 上限 6 個月）。 */
export function clientSecret(c: SiwaConfig, now = Date.now()): Promise<string> {
  const iat = Math.floor(now / 1000);
  return es256Jwt(c.privateKey, c.keyId, { iss: c.teamId, iat, exp: iat + 300, aud: APPLE_ID, sub: c.clientId });
}

/** id_token 是 Apple 在這條 TLS 連線上直接回的，只取 sub 比對帳號，不另外驗簽。 */
function idTokenSubject(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  const part = idToken.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

export class SiwaError extends Error {
  /** 400：code 無效／過期／不是這個帳號的 Apple ID，使用者重試即可；502：Apple 那邊失敗 */
  status: 400 | 502;
  constructor(status: 400 | 502, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * 用 authorization code 換 token，再撤銷 refresh token（沒有就撤銷 access token）。
 * appleUserIds 是這個使用者在 account 表裡的 Apple accountId：換回來的 id_token 的 sub 要是其中之一，
 * 免得使用者在授權畫面換了另一個 Apple ID，撤銷到別的帳號、這個帳號的授權反而留著。
 */
export async function revokeAppleAuthorization(c: SiwaConfig, code: string, appleUserIds: readonly string[], budget: Budget): Promise<void> {
  const secret = await clientSecret(c);
  const form = (fields: Record<string, string>) => ({
    method: "POST",
    budget,
    timeoutMs: 10000,
    errorBody: true,
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(fields).toString(),
  });

  let tokens: { refresh_token?: string; access_token?: string; id_token?: string };
  try {
    const res = await fetchWithTimeout(SIWA_SOURCE, `${APPLE_ID}/auth/token`, form({ client_id: c.clientId, client_secret: secret, code, grant_type: "authorization_code" }));
    tokens = (await res.json()) as typeof tokens;
  } catch (e) {
    // invalid_grant：code 過期（5 分鐘）、用過了，使用者重試即可。invalid_client 等其他 400 是伺服器金鑰設定錯，走 502 並帶 Apple 的錯誤。
    if (e instanceof SourceError && e.status === 400 && e.message.includes("invalid_grant")) throw new SiwaError(400, "Apple 授權已失效，請再試一次");
    throw new SiwaError(502, `無法向 Apple 確認授權：${e instanceof Error ? e.message : String(e)}`);
  }

  const sub = idTokenSubject(tokens.id_token);
  if (!sub || !appleUserIds.includes(sub)) throw new SiwaError(400, "請用登入這個帳號的 Apple ID 確認");

  const [token, hint] = tokens.refresh_token ? [tokens.refresh_token, "refresh_token"] : [tokens.access_token, "access_token"];
  if (!token) throw new SiwaError(502, "Apple 沒有回傳可撤銷的 token");
  try {
    const res = await fetchWithTimeout(SIWA_SOURCE, `${APPLE_ID}/auth/revoke`, form({ client_id: c.clientId, client_secret: secret, token, token_type_hint: hint }));
    await res.body?.cancel();
  } catch (e) {
    throw new SiwaError(502, `無法撤銷 Apple 授權：${e instanceof Error ? e.message : String(e)}`);
  }
}
