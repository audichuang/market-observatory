// APNs 推播：用 .p8 金鑰簽 ES256 JWT（token-based），每台裝置一個 HTTP/2 請求。
// 每個請求都走 fetchWithTimeout 並扣這次執行的額度（AGENTS.md），同時最多 6 個。
import { easternDate, latestExpectedClose } from "../lib/calendar.ts";
import { DEFAULT_PUSH_PREFS, PUSH_PREFS_PREFIX, type EventRow, type PushMessage, type PushPrefs, bigMoves, dailySummary, eventReminder, sanitizePrefs } from "../lib/push.ts";
import { viewForMembers } from "../lib/snapshot.ts";
import { type Budget, SourceError, fetchWithTimeout } from "../lib/sources/http.ts";
import { getSnapshot, nowIso } from "./repo.ts";
import { loadWatchlist } from "./watchlist.ts";

export const APNS_SOURCE = "APNs";

export interface ApnsConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
}

export function apnsConfig(env: Record<string, unknown>): ApnsConfig | null {
  const s = (k: string) => (typeof env[k] === "string" ? (env[k] as string).trim() : "");
  const c = { teamId: s("APNS_TEAM_ID"), keyId: s("APNS_KEY_ID"), privateKey: s("APNS_PRIVATE_KEY"), bundleId: s("APPLE_BUNDLE_ID") };
  return c.teamId && c.keyId && c.privateKey && c.bundleId ? c : null;
}

const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlText = (text: string) => b64url(new TextEncoder().encode(text));

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  // secret 存成單行時換行可能變成字面上的 \n：兩種都接受。
  const body = pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

/** 用 Apple 後台建立的 .p8 金鑰簽 ES256 JWT（APNs 的 provider token、Sign in with Apple 的 client secret 都是這種）。 */
export async function es256Jwt(privateKeyPem: string, keyId: string, claims: Record<string, unknown>): Promise<string> {
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(privateKeyPem), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const input = `${b64urlText(JSON.stringify({ alg: "ES256", kid: keyId }))}.${b64urlText(JSON.stringify(claims))}`;
  // WebCrypto 的 ECDSA 簽章就是 JWS 要的 r||s（64 bytes），不用轉 DER。
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input));
  return `${input}.${b64url(sig)}`;
}

/** APNs 的 provider token 有效 1 小時、更新太頻繁會被拒（TooManyProviderTokenUpdates）：同一個 isolate 裡 40 分鐘內重用。 */
let cachedToken: { key: string; token: string; at: number } | null = null;

export async function providerToken(c: ApnsConfig, now = Date.now()): Promise<string> {
  const cacheKey = `${c.teamId}:${c.keyId}`;
  if (cachedToken && cachedToken.key === cacheKey && now - cachedToken.at < 40 * 60 * 1000) return cachedToken.token;
  const token = await es256Jwt(c.privateKey, c.keyId, { iss: c.teamId, iat: Math.floor(now / 1000) });
  cachedToken = { key: cacheKey, token, at: now };
  return token;
}

export interface DeviceRow {
  token: string;
  user_id: string;
  list_key: string;
  environment: string;
}

/** A delivered notification clears the previous failure, for scheduled and manual pushes alike. */
export function clearDeviceErrorStatement(db: D1Database, token: string): D1PreparedStatement {
  return db.prepare("UPDATE devices SET last_error = NULL WHERE token = ? AND last_error IS NOT NULL").bind(token);
}

export const apnsHost = (environment: string) => (environment === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com");

export function apnsPayload(msg: PushMessage) {
  return { aps: { alert: { title: msg.title, body: msg.body }, sound: "default", "thread-id": msg.kind }, kind: msg.kind, ...msg.data };
}

/** 送一則到一台裝置：成功回 "ok"；裝置已註銷或 token 已失效回 "gone"；其他錯誤回錯誤說明。 */
export async function sendPush(c: ApnsConfig, device: Pick<DeviceRow, "token" | "environment">, msg: PushMessage, budget: Budget): Promise<"ok" | "gone" | string> {
  try {
    const res = await fetchWithTimeout(APNS_SOURCE, `${apnsHost(device.environment)}/3/device/${device.token}`, {
      method: "POST",
      budget,
      timeoutMs: 10000,
      errorBody: true,
      headers: {
        authorization: `bearer ${await providerToken(c)}`,
        "apns-topic": c.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        // 收盤摘要隔天就沒意義了：裝置離線超過 12 小時就不補送。
        "apns-expiration": String(Math.floor(Date.now() / 1000) + 12 * 3600),
        "apns-collapse-id": `${msg.kind}-${msg.data.date ?? ""}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(apnsPayload(msg)),
    });
    await res.body?.cancel();
    return "ok";
  } catch (e) {
    if (e instanceof SourceError) {
      if (e.status === 410) return "gone";
      if (e.status === 400) {
        // fetchWithTimeout includes the APNs JSON error body after the HTTP status.
        const body = e.message.slice(e.message.indexOf("{"));
        try {
          const { reason } = JSON.parse(body) as { reason?: string };
          if (reason === "BadDeviceToken" || reason === "Unregistered") return "gone";
        } catch {
          // Non-JSON errors are kept for diagnosis, never treated as invalid tokens.
        }
      }
    }
    return e instanceof Error ? e.message : String(e);
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function loadPrefs(db: D1Database, userId: string): Promise<PushPrefs> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(`${PUSH_PREFS_PREFIX}${userId}`).first<{ value: string }>();
  if (!row) return DEFAULT_PUSH_PREFS;
  try {
    return sanitizePrefs(JSON.parse(row.value));
  } catch {
    return DEFAULT_PUSH_PREFS;
  }
}

interface Recipient {
  userId: string;
  listKey: string;
  devices: DeviceRow[];
}

async function recipients(db: D1Database): Promise<Recipient[]> {
  const rows = await db.prepare("SELECT token, user_id, list_key, environment FROM devices ORDER BY user_id").all<DeviceRow>();
  const byUser = new Map<string, Recipient>();
  for (const d of rows.results) {
    const r = byUser.get(d.user_id) ?? { userId: d.user_id, listKey: d.list_key, devices: [] };
    r.devices.push(d);
    byUser.set(d.user_id, r);
  }
  return [...byUser.values()];
}

export interface NotifyResult {
  status: "ok" | "partial" | "failed";
  summary: string;
  detail: Record<string, unknown>;
}

/**
 * 發給每個有裝置的使用者：build 依使用者算出要發的訊息。
 * 發之前先在 push_log 佔位（同一則只會佔到一次），重跑排程、兩個排程同時跑都不會重複發；
 * 送到 0 台時刪掉佔位，下一次排程可以再試。
 */
async function deliver(db: D1Database, cfg: ApnsConfig | null, budget: Budget, dedupeDate: string, build: (r: Recipient) => Promise<PushMessage[]>): Promise<NotifyResult> {
  const people = await recipients(db);
  if (!people.length) return { status: "ok", summary: "沒有註冊推播的裝置", detail: {} };
  if (!cfg) return { status: "failed", summary: "尚未設定 APNs 金鑰（APNS_TEAM_ID／APNS_KEY_ID／APNS_PRIVATE_KEY／APPLE_BUNDLE_ID）", detail: {} };
  const claim = db.prepare("INSERT INTO push_log (id, user_id, kind, title, body, devices, delivered, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?) ON CONFLICT(id) DO NOTHING");
  const sent: string[] = [];
  const skipped: string[] = [];
  const errors: Record<string, string> = {};
  const gone: string[] = [];
  const jobs: { id: string; msg: PushMessage; device: DeviceRow }[] = [];
  for (const r of people) {
    for (const msg of await build(r)) {
      const id = `${msg.kind}:${dedupeDate}:${r.userId}`;
      const res = await claim.bind(id, r.userId, msg.kind, msg.title, msg.body, r.devices.length, nowIso()).run();
      if ((res.meta?.changes ?? 0) === 0) {
        skipped.push(id);
        continue;
      }
      for (const device of r.devices) jobs.push({ id, msg, device });
    }
  }
  // 額度不夠送完的裝置這次不送（佔位會在下面依實際送達數更新或刪掉）。
  const room = Math.max(0, budget.remaining - 2);
  const now = jobs.slice(0, room);
  const results = await mapLimit(now, 6, (j) => sendPush(cfg, j.device, j.msg, budget));
  const delivered = new Map<string, number>();
  const stmts: D1PreparedStatement[] = [];
  results.forEach((r, i) => {
    const j = now[i];
    if (r === "ok") {
      delivered.set(j.id, (delivered.get(j.id) ?? 0) + 1);
      stmts.push(clearDeviceErrorStatement(db, j.device.token));
    } else if (r === "gone") gone.push(j.device.token);
    else errors[`${j.id}@${j.device.token.slice(0, 8)}`] = r;
  });
  for (const j of jobs.slice(room)) errors[`${j.id}@${j.device.token.slice(0, 8)}`] = "請求額度不足，這次沒有送";
  for (const id of new Set(jobs.map((j) => j.id))) {
    const n = delivered.get(id) ?? 0;
    if (n > 0) {
      sent.push(id);
      stmts.push(db.prepare("UPDATE push_log SET delivered = ? WHERE id = ?").bind(n, id));
    } else stmts.push(db.prepare("DELETE FROM push_log WHERE id = ?").bind(id));
  }
  for (const t of gone) stmts.push(db.prepare("DELETE FROM devices WHERE token = ?").bind(t));
  for (const [k, err] of Object.entries(errors)) {
    const token = jobs.find((j) => `${j.id}@${j.device.token.slice(0, 8)}` === k)?.device.token;
    if (token) stmts.push(db.prepare("UPDATE devices SET last_error = ?, updated_at = ? WHERE token = ?").bind(err.slice(0, 300), nowIso(), token));
  }
  if (stmts.length) await db.batch(stmts);
  // 只保留 90 天的發送紀錄。
  await db.prepare("DELETE FROM push_log WHERE created_at < ?").bind(new Date(Date.now() - 90 * 86400000).toISOString()).run();
  const failedCount = Object.keys(errors).length;
  return {
    status: failedCount === 0 ? "ok" : sent.length === 0 && jobs.length > 0 ? "failed" : "partial",
    summary: `推播 ${sent.length} 則（${now.length - failedCount - gone.length}/${jobs.length} 台送達）${skipped.length ? `；已發過 ${skipped.length} 則` : ""}${gone.length ? `；移除失效裝置 ${gone.length} 台` : ""}${failedCount ? `；失敗 ${failedCount}` : ""}`,
    detail: { sent, skipped, gone: gone.length, errors },
  };
}

/** 收盤後：最新快照是「最近應已收盤」那天才發（還沒抓到當天收盤就等補抓排程）。 */
export async function notifyClose(db: D1Database, cfg: ApnsConfig | null, budget: Budget): Promise<NotifyResult> {
  const expected = latestExpectedClose();
  const latest = await getSnapshot(db);
  if (!latest || latest.tradeDate !== expected) return { status: "ok", summary: `還沒有 ${expected} 的快照（最新 ${latest?.tradeDate ?? "無"}），這次不發收盤推播`, detail: {} };
  return deliver(db, cfg, budget, expected, async (r) => {
    const prefs = await loadPrefs(db, r.userId);
    const view = viewForMembers(latest.data, await loadWatchlist(db, r.listKey));
    const out: PushMessage[] = [];
    if (prefs.daily) {
      const m = dailySummary(view);
      if (m) out.push(m);
    }
    if (prefs.moves) {
      const m = bigMoves(view, prefs.moveThresholdPct);
      if (m) out.push(m);
    }
    return out;
  });
}

/** 美東早上：當天名單公司的財報與總經事件。 */
export async function notifyEvents(db: D1Database, cfg: ApnsConfig | null, budget: Budget): Promise<NotifyResult> {
  const today = easternDate();
  const events = await db.prepare("SELECT date, kind, symbol, title, detail, status FROM events WHERE date = ?").bind(today).all<EventRow>();
  if (!events.results.length) return { status: "ok", summary: `美東 ${today} 沒有登錄的事件`, detail: {} };
  return deliver(db, cfg, budget, today, async (r) => {
    const prefs = await loadPrefs(db, r.userId);
    if (!prefs.events) return [];
    const keys = (await loadWatchlist(db, r.listKey)).map((m) => m.key);
    const m = eventReminder(today, events.results, keys);
    return m ? [m] : [];
  });
}
