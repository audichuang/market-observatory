import { defineMiddleware } from "void";

declare module "void" {
  interface CloudContextVariables {
    shared: { userEmail: string | null; path: string };
  }
}

// 未登入只能看登入頁與登入 API；其餘頁面導去 /login，API 回 401。
// PWA 的 manifest、圖示、service worker 與離線頁也要公開：瀏覽器抓 manifest 時不一定帶 cookie。
const PUBLIC_PREFIXES = ["/login", "/api/auth/", "/__", "/assets/", "/favicon", "/icons/", "/manifest.webmanifest", "/sw.js", "/offline.html"];

export default defineMiddleware(async (c, next) => {
  const path = c.req.path;
  const user = c.get("user");
  c.set("shared", { userEmail: user?.email ?? null, path });
  if (user || PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return next();
  if (path.startsWith("/api/")) return c.json({ error: "需要登入" }, 401);
  const nextUrl = path === "/" ? "" : `?next=${encodeURIComponent(path + (new URL(c.req.url).search || ""))}`;
  return c.redirect(`/login${nextUrl}`);
});
