import { Link } from "@void/react";
import { dateWithWeekday, daysBetween } from "../src/ui/format.ts";
import { NewsFeed } from "../src/ui/NewsFeed.tsx";
import type { Props } from "./news.server";

const STATUS: Record<string, [string, string]> = {
  confirmed: ["ok", "公司已公布"],
  estimated: ["warn", "Zacks 推估"],
  expected: ["warn", "預期"],
  scheduled: ["ok", "官方日程"],
  tentative: ["warn", "官方暫定"],
};

export default function NewsPage({ symbol, keys, today, news, digests, events }: Props) {
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today).reverse();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>新聞與事件日曆</h1>
          <p className="sub">新聞每 4 小時從 Nasdaq 抓一次（觀察名單與 SPY）。標題與重點由本機排程的 AI 整理成中文（約每 4 小時），全站共用；AI 可能出錯，請以原文為準。財報日期每天更新，總經事件（FOMC、CPI、非農）依聯準會與勞工統計局公布的日程。</p>
        </div>
      </div>
      <div className="grid two">
        <div className="panel">
          <h2>即將到來</h2>
          {upcoming.length === 0 ? <p className="sub">沒有登錄的事件。</p> : (
            <ul className="list">
              {upcoming.map((e) => {
                const [cls, label] = STATUS[e.status] ?? ["", e.status];
                const days = daysBetween(today, e.date);
                return (
                  <li key={e.id}>
                    <div>
                      <strong>{dateWithWeekday(e.date)}</strong> <span className="meta">{days === 0 ? "今天" : `${days} 天後`}</span>
                    </div>
                    <div>
                      {e.symbol && <Link href={`/news?symbol=${e.symbol}`} className="mono">{e.symbol}</Link>} {e.title}{" "}
                      <span className={`badge ${cls}`}>{label}</span>
                    </div>
                    {e.detail && <div className="meta">{e.detail}</div>}
                    <div className="meta"><a href={e.source_url} target="_blank" rel="noreferrer">來源</a></div>
                  </li>
                );
              })}
            </ul>
          )}
          {past.length > 0 && (
            <>
              <h3 style={{ marginTop: "1rem" }}>過去 30 天</h3>
              <ul className="list">
                {past.map((e) => (
                  <li key={e.id} className="meta">{e.date} {e.symbol ?? ""} {e.title}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="panel">
          <h2>新聞{symbol ? `：${symbol}` : ""}</h2>
          <div className="chips" style={{ marginBottom: ".6rem" }}>
            <Link href="/news" className={`chip ${symbol === null ? "active" : ""}`}>全部</Link>
            {keys.map((k) => <Link key={k} href={`/news?symbol=${k}`} className={`chip ${symbol === k ? "active" : ""}`}>{k}</Link>)}
          </div>
          <NewsFeed key={symbol ?? ""} news={news} digests={digests} />
        </div>
      </div>
    </>
  );
}
