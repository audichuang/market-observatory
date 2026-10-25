import { useState } from "react";

export interface NewsItem {
  id: string;
  symbols: string;
  title: string;
  url: string;
  publisher: string | null;
  published_at: string | null;
  title_zh: string | null;
  tone: string | null;
  category: string | null;
  focus: string | null;
  important: boolean;
  points_zh: string[] | null;
}

export interface DigestItem {
  symbol: string;
  company: string;
  date: string;
  summary: string;
  tone: string;
}

// 紅漲綠跌：利多紅、利空綠。
const TONE: Record<string, [string, string]> = {
  positive: ["tone-pos", "利多"],
  negative: ["tone-neg", "利空"],
  neutral: ["", "中性"],
};

export function ToneBadge({ tone }: { tone: string | null }) {
  const t = tone ? TONE[tone] : undefined;
  if (!t) return null;
  return <span className={`badge ${t[0]}`}>{t[1]}</span>;
}

/** 新聞列表＋每日重點：中文標題為主、英文原文小字。翻譯、重點與每日重點都由排程寫好（scripts/ai-batch.ts），這裡只顯示。 */
export function NewsFeed({ news, digests, showOthers = true, showDigests = true }: {
  news: NewsItem[];
  digests: DigestItem[];
  showOthers?: boolean;
  showDigests?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const important = news.filter((n) => n.important);
  const others = news.filter((n) => !n.important);
  const shown = showOthers ? important : news;

  const renderItem = (n: NewsItem) => (
    <li key={n.id}>
      <div>
        <ToneBadge tone={n.tone} /> {n.category && <span className="badge">{n.category}</span>}{" "}
        <a href={n.url} target="_blank" rel="noreferrer">{n.title_zh ?? n.title}</a>
      </div>
      {n.title_zh && <div className="meta news-en">{n.title}</div>}
      <div className="meta">{n.symbols.replace(/,/g, " · ")} · {n.publisher ?? "Nasdaq"} · {n.published_at ?? "日期不明"}</div>
      {n.points_zh && (
        <div style={{ marginTop: ".25rem" }}>
          <button type="button" className="secondary small" onClick={() => setOpen((o) => ({ ...o, [n.id]: !o[n.id] }))}>{open[n.id] ? "收起重點" : "重點"}</button>
        </div>
      )}
      {open[n.id] && n.points_zh && (
        <ul className="news-points">{n.points_zh.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
    </li>
  );

  return (
    <>
      {showDigests && (
        <div className="digests">
          {digests.map((d) => (
            <div key={d.symbol} className="digest">
              <strong>{d.company}</strong> <span className="mono meta">{d.symbol}</span> <ToneBadge tone={d.tone} />
              <div>{d.summary}</div>
              <div className="meta">{d.date}</div>
            </div>
          ))}
        </div>
      )}
      {news.length === 0 ? <p className="sub">還沒有新聞。</p> : (
        <>
          {shown.length > 0 ? <ul className="list">{shown.map(renderItem)}</ul> : <p className="sub">這陣子沒有特別重要的新聞。</p>}
          {showOthers && others.length > 0 && (
            <details className="news-others">
              <summary>其他 {others.length} 則</summary>
              <ul className="list">{others.map(renderItem)}</ul>
            </details>
          )}
        </>
      )}
    </>
  );
}
