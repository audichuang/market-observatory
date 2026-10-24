import { Link, useNavigation, useRouter, useShared } from "@void/react";
import { useEffect } from "react";
import { auth } from "void/client";
import PageSkeleton from "../src/ui/PageSkeleton.tsx";
import "../src/ui/styles.css";

const NAV = [
  { href: "/", label: "市場總覽", short: "總覽", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { href: "/history", label: "走勢與均線", short: "走勢", icon: "M3 17l5-5 4 4 8-8M15 8h5v5" },
  { href: "/outlook", label: "下月展望", short: "展望", icon: "M12 3a9 9 0 1 0 9 9M12 3v9l6-6M12 3a9 9 0 0 1 9 9h-9" },
  { href: "/etfs", label: "ETF 與定投", short: "ETF", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/news", label: "新聞與日曆", short: "新聞", icon: "M4 5h16v14H4zM4 9h16M9 3v4M15 3v4" },
  { href: "/sources", label: "資料來源", short: "資料", icon: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" },
] as const;

// 導覽分頁一出現就在背景預先載入；1 分鐘內直接用、30 分鐘內先顯示舊資料再背景更新（行情一天只變幾次）。
const PREFETCH = ["mount", "hover", "click"] as const;
const CACHE_FOR: [string, string] = ["1m", "30m"];

const isActive = (href: string, path: string) => (href === "/" ? path === "/" : path.startsWith(href));

export default function Layout({ children }: { children: React.ReactNode }) {
  const shared = useShared();
  const router = useRouter();
  const navigation = useNavigation();
  const currentPath = router.path ?? shared.path ?? "/";
  const loading = navigation.state === "loading" && navigation.location !== null;
  const targetPath = loading ? navigation.location!.pathname : currentPath;
  // 換到另一個分頁時先顯示目標頁的骨架；同一頁只換條件（區間、標的）時保留內容、頂端顯示進度條。
  const switchingPage = loading && targetPath !== currentPath;

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    // 安裝成 App（standalone）後沒有瀏覽器的重新整理：離開超過 10 分鐘再回來，就重抓目前頁面的資料。
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 10 * 60 * 1000) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  if (!shared.userEmail) return <>{children}</>;
  return (
    <>
      <div className={`progress ${navigation.state !== "idle" ? "on" : ""}`} aria-hidden />
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" prefetch={PREFETCH} cacheFor={CACHE_FOR}>市場觀測室</Link>
          <nav className="nav" aria-label="主要分頁">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} prefetch={PREFETCH} cacheFor={CACHE_FOR} className={isActive(n.href, targetPath) ? "active" : ""}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="whoami">
            <span className="hide-sm">{shared.userEmail}</span>
            <Link href="/sources" prefetch={PREFETCH} cacheFor={CACHE_FOR} className={`show-sm-inline icon-link ${isActive("/sources", targetPath) ? "active" : ""}`} aria-label="資料來源">
              資料
            </Link>
            <button
              className="secondary"
              onClick={async () => {
                await auth.signOut();
                window.location.href = "/login";
              }}
            >
              登出
            </button>
          </div>
        </div>
      </header>
      <main aria-busy={loading}>{switchingPage ? <PageSkeleton path={targetPath} /> : children}</main>
      <footer className="foot">
        個人研究用途，非投資建議。行情來自 Yahoo Finance（主）、Nasdaq 與 Cboe（核對），權重來自 State Street SPY 每日持股；非官方授權資料源，可能延遲或錯誤。
      </footer>
      <nav className="tabbar" aria-label="主要分頁">
        {NAV.filter((n) => n.href !== "/sources").map((n) => (
          <Link key={n.href} href={n.href} prefetch={PREFETCH} cacheFor={CACHE_FOR} className={isActive(n.href, targetPath) ? "active" : ""}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d={n.icon} />
            </svg>
            <span>{n.short}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
