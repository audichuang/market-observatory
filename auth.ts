import { APIError } from "better-auth/api";
import { defineAuth } from "void/auth";

// 個人站：只有 OWNER_EMAIL 能建立帳號（email 唯一，所以最多一個帳號）。沒設定時一律拒絕註冊。
export default defineAuth(({ defaults, env }) => ({
  ...defaults,
  databaseHooks: {
    ...defaults.databaseHooks,
    user: {
      ...defaults.databaseHooks?.user,
      create: {
        ...defaults.databaseHooks?.user?.create,
        before: async (user) => {
          const owner = String(env.OWNER_EMAIL ?? "").trim().toLowerCase();
          if (!owner || user.email.trim().toLowerCase() !== owner) {
            throw new APIError("FORBIDDEN", { message: "這個網站只開放擁有者帳號註冊" });
          }
        },
      },
    },
  },
}));
