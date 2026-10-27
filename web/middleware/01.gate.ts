import { defineMiddleware } from "void";
import { viewerOf } from "../src/server/account.ts";

declare module "void" {
  interface CloudContextVariables {
    shared: { userEmail: string | null; isOwner: boolean; path: string };
  }
}

// 未登入只能看登入頁與登入 API；其餘頁面導去 /login，API 回 401。後台 API（/api/admin/）只限站長（OWNER_EMAIL）。
// PWA 的 manifest、圖示、service worker 與離線頁也要公開：瀏覽器抓 manifest 時不一定帶 cookie。
// 本機 dev 的頁面模組直接從原始碼路徑載入（/pages/login.tsx、/src/…），沒放行的話未登入時登入頁不會 hydrate、按鈕都沒反應；正式站只有 /assets/。
const PUBLIC_PREFIXES = [
  "/login", "/api/auth/", "/__", "/assets/", "/favicon", "/icons/", "/manifest.webmanifest", "/sw.js", "/offline.html",
  ...(import.meta.env.DEV ? ["/pages/", "/src/", "/node_modules/", "/@"] : []),
];

export default defineMiddleware(async (c, next) => {
  const path = c.req.path;
  let user = c.get("user");
  const session = c.get("session");
  // Better Auth 1.7's cookieCache retains the session id even after revocation/account deletion.
  // Check the primary DB (expiresAt is timestamp_ms) before handlers, including GET initializers.
  if (user && (!session || !(await c.env.DB.prepare('SELECT 1 AS present FROM "session" WHERE id = ? AND "userId" = ? AND "expiresAt" > ?').bind(session.id, user.id, Date.now()).first()))) {
    c.set("user", null);
    c.set("session", null);
    user = null;
  }
  const viewer = viewerOf(c);
  c.set("shared", { userEmail: user?.email ?? null, isOwner: viewer?.isOwner ?? false, path });
  if (user && path.startsWith("/api/admin/") && !viewer?.isOwner) return c.json({ error: "只有站長能執行" }, 403);
  if (user || PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return next();
  if (path.startsWith("/api/")) return c.json({ error: "需要登入" }, 401);
  const nextUrl = path === "/" ? "" : `?next=${encodeURIComponent(path + (new URL(c.req.url).search || ""))}`;
  return c.redirect(`/login${nextUrl}`);
});
