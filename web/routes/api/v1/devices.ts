import { defineHandler } from "void";
import { z } from "zod";
import { requireViewer, watchlistKey } from "../../../src/server/account.ts";
import { nowIso } from "../../../src/server/repo.ts";

// App 取得 APNs device token 後註冊（每次啟動都會再送一次，token 換了或換帳號登入都會更新）。
const Token = z.string().regex(/^[0-9a-f]{64,200}$/i, "不是 APNs device token");

export const POST = defineHandler.withValidator({
  body: z.object({ token: Token, environment: z.enum(["production", "sandbox"]), appVersion: z.string().max(40).optional() }),
})(async (c, { body }) => {
  const v = requireViewer(c);
  const now = nowIso();
  // 同一台裝置換了帳號：token 一樣、改掛到新帳號。
  await c.env.DB.prepare(
    `INSERT INTO devices (token, user_id, list_key, environment, app_version, created_at, updated_at, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, list_key = excluded.list_key, environment = excluded.environment,
       app_version = excluded.app_version, updated_at = excluded.updated_at, last_error = NULL`,
  )
    .bind(body.token.toLowerCase(), v.id, watchlistKey(v), body.environment, body.appVersion ?? null, now, now)
    .run();
  return { registered: true };
});

/** 登出或關閉推播時把這台裝置拿掉（只能刪自己的）。 */
export const DELETE = defineHandler.withValidator({ body: z.object({ token: Token }) })(async (c, { body }) => {
  const v = requireViewer(c);
  await c.env.DB.prepare("DELETE FROM devices WHERE token = ? AND user_id = ?").bind(body.token.toLowerCase(), v.id).run();
  return { removed: true };
});
