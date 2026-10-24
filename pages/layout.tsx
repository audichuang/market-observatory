import { Link, useShared } from "@void/react";
import { auth } from "void/client";
import "../src/ui/styles.css";

const NAV = [
  ["/", "市場總覽"],
  ["/history", "走勢與均線"],
  ["/etfs", "ETF 與定投"],
  ["/news", "新聞與日曆"],
  ["/sources", "資料來源"],
] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  const shared = useShared();
  const path = shared.path ?? "/";
  if (!shared.userEmail) return <>{children}</>;
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">市場觀測室</Link>
          <nav className="nav">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} prefetch className={(href === "/" ? path === "/" : path.startsWith(href)) ? "active" : ""}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="whoami">
            <span className="hide-sm">{shared.userEmail}</span>
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
      <main>{children}</main>
      <footer className="foot">
        個人研究用途，非投資建議。行情來自 Yahoo Finance（主）、Nasdaq 與 Cboe（核對），權重來自 State Street SPY 每日持股；非官方授權資料源，可能延遲或錯誤。
      </footer>
    </>
  );
}
