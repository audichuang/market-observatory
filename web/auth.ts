import { defineAuth } from "void/auth";

// 開放註冊：email／密碼或 Apple 帳號都能建立帳號。站長（能跑排程、看後台）由 OWNER_EMAIL 決定，見 src/server/account.ts。
//
// Apple 登入走 App 原生的 Sign in with Apple：App 拿到 Apple 簽發的 identity token，POST 到
// /api/auth/sign-in/social（provider: "apple"、idToken），這裡用 Apple 的公鑰驗簽、確認 audience 是 App 的 bundle ID。
// 這條路不需要 Services ID 與 client secret（網頁版的 Apple OAuth 才需要），所以 clientSecret 留空。
export default defineAuth(({ defaults, env }) => ({
  ...defaults,
  ...(env.APPLE_BUNDLE_ID
    ? {
        socialProviders: {
          ...defaults.socialProviders,
          apple: { clientId: env.APPLE_BUNDLE_ID, clientSecret: "", appBundleIdentifier: env.APPLE_BUNDLE_ID },
        },
      }
    : {}),
  // App 不常登入：60 天沒用才要重新登入，每天用到時自動延長。
  session: { ...defaults.session, expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24, cookieCache: { enabled: true, maxAge: 300 } },
}));
