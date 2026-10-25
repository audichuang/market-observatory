import { defineHandler } from "void";
import { z } from "zod";
import { requireViewer, watchlistKey } from "../../../src/server/account.ts";
import { PLAN_KEY } from "../../../src/server/views.ts";
import { PUSH_PREFS_PREFIX } from "../../../src/lib/push.ts";
import { Budget } from "../../../src/lib/sources/http.ts";
import { SiwaError, revokeAppleAuthorization, siwaConfig } from "../../../src/server/siwa.ts";

// App 用的 JSON API（/api/v1/*）：跟網頁共用同一份資料（src/server/views.ts），登入狀態同樣由 middleware/01.gate.ts 把關。

/** 這個使用者綁定的 Apple ID（account 表 providerId = 'apple' 的 accountId，也就是 Apple 的 sub） */
async function appleAccountIds(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT "accountId" FROM "account" WHERE "userId" = ? AND "providerId" = 'apple'`)
    .bind(userId)
    .all<{ accountId: string }>();
  return results.map((r) => r.accountId);
}

export const GET = defineHandler(async (c) => {
  const v = requireViewer(c);
  // hasApple：App 刪帳號前要不要先跑一次 Apple 授權（拿 authorization code 撤銷 token）。
  const hasApple = (await appleAccountIds(c.env.DB, v.id)).length > 0;
  return { id: v.id, email: v.email, name: v.name, isOwner: v.isOwner, hasApple };
});

const DeleteBody = z.object({ appleAuthorizationCode: z.string().min(1).max(2000).optional() }).optional();

/**
 * 刪除帳號（App Store 規定能在 App 內刪除帳號）：名單、定投規劃、推播偏好、裝置與登入資料一起刪。
 * 站長帳號不能從這裡刪：站長的名單是排程的基準，誤刪會讓整站回到預設名單。
 *
 * 用 Apple 登入過的帳號要先撤銷 Apple 授權（審查指南 5.1.1(v)）：App 再跑一次 Apple 授權、把 authorization code
 * 放在 body 的 appleAuthorizationCode 送上來。撤銷失敗（含伺服器沒設定 SIWA 金鑰）就回錯誤、帳號保留，使用者可以再試；
 * 不會跳過撤銷直接刪。只用 email／密碼的帳號照舊直接刪。
 */
export const DELETE = defineHandler(async (c) => {
  const v = requireViewer(c);
  if (v.isOwner) return c.json({ error: "站長帳號不能在 App 內刪除" }, 403);
  const db = c.env.DB;

  const appleIds = await appleAccountIds(db, v.id);
  if (appleIds.length > 0) {
    // 舊版 App 不帶 body：讀不到就當沒送。
    const parsed = DeleteBody.safeParse(await c.req.json().catch(() => undefined));
    const code = parsed.success ? parsed.data?.appleAuthorizationCode : undefined;
    if (!code) return c.json({ error: "這個帳號用 Apple 登入，刪除前要先用 Apple 確認身分，請更新 App 後再試" }, 400);
    const cfg = siwaConfig(c.env as unknown as Record<string, unknown>);
    if (!cfg) {
      console.error("account delete: Apple 授權撤銷未設定（SIWA_KEY_ID／SIWA_PRIVATE_KEY／APNS_TEAM_ID／APPLE_BUNDLE_ID）");
      return c.json({ error: "伺服器尚未設定 Apple 授權撤銷，暫時無法刪除帳號，請稍後再試" }, 503);
    }
    try {
      await revokeAppleAuthorization(cfg, code, appleIds, new Budget(4));
    } catch (e) {
      console.error("account delete: Apple 授權撤銷失敗", e);
      if (e instanceof SiwaError) return c.json({ error: e.message }, e.status);
      return c.json({ error: "無法撤銷 Apple 授權，帳號沒有刪除，請稍後再試" }, 502);
    }
  }

  await db.batch([
    db.prepare("DELETE FROM settings WHERE key IN (?, ?, ?)").bind(watchlistKey(v), `${PLAN_KEY}:${v.id}`, `${PUSH_PREFS_PREFIX}${v.id}`),
    db.prepare("DELETE FROM devices WHERE user_id = ?").bind(v.id),
    db.prepare("DELETE FROM push_log WHERE user_id = ?").bind(v.id),
    db.prepare('DELETE FROM "session" WHERE "userId" = ?').bind(v.id),
    db.prepare('DELETE FROM "account" WHERE "userId" = ?').bind(v.id),
    db.prepare('DELETE FROM "user" WHERE id = ?').bind(v.id),
  ]);
  return { deleted: true };
});
