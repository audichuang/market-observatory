import { defineEnv, string } from "void/env";

export default defineEnv({
  /** 唯一允許註冊的 email；部署時用 `void secret put OWNER_EMAIL` 設定 */
  OWNER_EMAIL: string().optional(),
  /** 選填：設定後註冊必須輸入相同的註冊碼（`void secret put OWNER_SIGNUP_CODE`） */
  OWNER_SIGNUP_CODE: string().optional(),
});
