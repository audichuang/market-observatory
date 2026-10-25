import { defineHandler } from "void";
import { z } from "zod";
import { requireViewer } from "../../../src/server/account.ts";
import { PUSH_PREFS_PREFIX, sanitizePrefs } from "../../../src/lib/push.ts";
import { Budget } from "../../../src/lib/sources/http.ts";
import { type DeviceRow, apnsConfig, loadPrefs, sendPush } from "../../../src/server/push.ts";
import { putSetting } from "../../../src/server/repo.ts";

// 推播偏好（每個帳號一份，所有裝置共用）與「送一則測試推播到我的裝置」。

export const GET = defineHandler(async (c) => {
  const v = requireViewer(c);
  const devices = await c.env.DB.prepare("SELECT environment, app_version, updated_at, last_error FROM devices WHERE user_id = ? ORDER BY updated_at DESC").bind(v.id).all();
  return { prefs: await loadPrefs(c.env.DB, v.id), devices: devices.results, configured: apnsConfig(c.env) !== null };
});

export const PUT = defineHandler.withValidator({
  body: z.object({ daily: z.boolean(), moves: z.boolean(), moveThresholdPct: z.number().min(1).max(50), events: z.boolean() }),
})(async (c, { body }) => {
  const v = requireViewer(c);
  const prefs = sanitizePrefs(body);
  await putSetting(c.env.DB, `${PUSH_PREFS_PREFIX}${v.id}`, prefs);
  return { prefs };
});

/** POST：送一則測試推播到自己所有裝置，回傳每台的結果（裝置 token 只回前 8 碼）。 */
export const POST = defineHandler(async (c) => {
  const v = requireViewer(c);
  const cfg = apnsConfig(c.env);
  if (!cfg) return c.json({ error: "伺服器尚未設定 APNs 金鑰" }, 503);
  const devices = await c.env.DB.prepare("SELECT token, user_id, list_key, environment FROM devices WHERE user_id = ? LIMIT 10").bind(v.id).all<DeviceRow>();
  if (!devices.results.length) return c.json({ error: "這個帳號還沒有註冊推播的裝置" }, 404);
  const budget = new Budget(20);
  const msg = { kind: "daily" as const, title: "測試推播", body: "市場觀測室的推播設定正常。", data: { screen: "settings" } };
  const results = [];
  for (const d of devices.results) {
    const r = await sendPush(cfg, d, msg, budget);
    if (r === "gone") await c.env.DB.prepare("DELETE FROM devices WHERE token = ?").bind(d.token).run();
    results.push({ device: d.token.slice(0, 8), environment: d.environment, result: r });
  }
  return { results };
});
