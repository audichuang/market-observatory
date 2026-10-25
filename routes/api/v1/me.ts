import { defineHandler } from "void";
import { requireViewer, watchlistKey } from "../../../src/server/account.ts";
import { PLAN_KEY } from "../../../src/server/views.ts";
import { PUSH_PREFS_PREFIX } from "../../../src/lib/push.ts";

// App 用的 JSON API（/api/v1/*）：跟網頁共用同一份資料（src/server/views.ts），登入狀態同樣由 middleware/01.gate.ts 把關。

export const GET = defineHandler((c) => {
  const v = requireViewer(c);
  return { id: v.id, email: v.email, name: v.name, isOwner: v.isOwner };
});

/**
 * 刪除帳號（App Store 規定能在 App 內刪除帳號）：名單、定投規劃、推播偏好、裝置與登入資料一起刪。
 * 站長帳號不能從這裡刪：站長的名單是排程的基準，誤刪會讓整站回到預設名單。
 */
export const DELETE = defineHandler(async (c) => {
  const v = requireViewer(c);
  if (v.isOwner) return c.json({ error: "站長帳號不能在 App 內刪除" }, 403);
  const db = c.env.DB;
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
