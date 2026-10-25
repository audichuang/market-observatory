import { defineEnv, string } from "void/env";

export default defineEnv({
  /** 站長 email：能手動跑排程、回補與重算（`void secret put OWNER_EMAIL`）。任何人都能註冊，但只有這個帳號是站長 */
  OWNER_EMAIL: string().optional(),
  /** iOS App 的 bundle ID：Apple 登入的 identity token 要以它為 audience，APNs 推播的 topic 也是它 */
  APPLE_BUNDLE_ID: string().optional(),
  /** APNs 推播金鑰（Apple Developer 後台建立的 .p8）：Team ID、Key ID 與金鑰本文（PEM，含 BEGIN/END 行） */
  APNS_TEAM_ID: string().optional(),
  APNS_KEY_ID: string().optional(),
  APNS_PRIVATE_KEY: string().optional(),
});
