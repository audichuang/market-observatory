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
  /** Sign in with Apple 金鑰（.p8，要開 Sign in with Apple 功能；APNs 那把加開也行）：刪帳號時簽 client secret 撤銷 Apple 授權，Team ID 共用 APNS_TEAM_ID */
  SIWA_KEY_ID: string().optional(),
  SIWA_PRIVATE_KEY: string().optional(),
  /** Anthropic API key：新聞 AI（使用者點開時才呼叫，見 src/server/news-ai.ts）。沒設定時新聞只顯示英文原文 */
  ANTHROPIC_API_KEY: string().optional(),
});
