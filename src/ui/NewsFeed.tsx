import { useEffect, useRef, useState } from "react";
import { mergeTranslated, pendingTranslateIds } from "./news-feed-logic.ts";

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
  /** 標題還沒翻，或 AI 要重新判斷這則在講誰 */
  needs_ai: boolean;
}

export interface DigestItem {
  symbol: string;
  company: string;
  date: string;
  summary: string;
  tone: string;
}

export interface AiInfo {
  enabled: boolean;
  used: number;
  limit: number;
}

interface TranslateOut {
  id: string;
  title_zh: string | null;
  tone: string | null;
  category: string | null;
  focus: string | null;
  important: boolean;
}

// 紅漲綠跌：利多紅、利空綠。
const TONE: Record<string, [string, string]> = {
  positive: ["tone-pos", "利多"],
  negative: ["tone-neg", "利空"],
  neutral: ["", "中性"],
};

const MAX_TRANSLATE = 20;

async function postJson<T>(url: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, status: res.status, error: data.error ?? "AI 暫時無法使用，請稍後再試" };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: "網路不通，請稍後再試" };
  }
}

export function ToneBadge({ tone }: { tone: string | null }) {
  const t = tone ? TONE[tone] : undefined;
  if (!t) return null;
  return <span className={`badge ${t[0]}`}>{t[1]}</span>;
}

/** 新聞列表＋每日重點：中文標題為主、英文原文小字；進頁面時把還沒翻的標題送去翻；每則可點「AI 重點」。 */
export function NewsFeed({ news: initial, digests: initialDigests, ai: initialAi, date, symbol = null, showOthers = true, showDigests = true }: {
  news: NewsItem[];
  digests: DigestItem[];
  ai: AiInfo;
  date: string;
  /** 新聞頁的代號篩選；翻譯回應照這個畫面的規則算「重要」 */
  symbol?: string | null;
  showOthers?: boolean;
  showDigests?: boolean;
}) {
  const [news, setNews] = useState(initial);
  const [digests, setDigests] = useState(initialDigests);
  const [ai, setAi] = useState(initialAi);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pointsError, setPointsError] = useState<Record<string, string>>({});
  const [digestBusy, setDigestBusy] = useState(false);
  const [digestNote, setDigestNote] = useState<string | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const tried = useRef(new Set<string>());
  const inflight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 伺服器重新載入（換代號、換頁）時以新資料為準
  useEffect(() => {
    setNews(initial);
    setDigests(initialDigests);
    setAi(initialAi);
  }, [initial, initialDigests, initialAi]);

  // 畫面上看得到的（重要的；「其他」展開後才算）還沒翻的標題一次送去翻；失敗就維持英文。
  // 請求的生命週期跟著元件（不是跟著 news／ai 的每次變動）：AI 重點或額度更新時，進行中的翻譯結果照樣依 id 併回；
  // 同時只送一批，這批回來更新 news 後 effect 會再接著送下一批。
  useEffect(() => {
    if (!ai.enabled || ai.used >= ai.limit || inflight.current) return;
    const pending = pendingTranslateIds(news, { showOthers, othersOpen, tried: tried.current, max: MAX_TRANSLATE });
    if (pending.length === 0) return;
    for (const id of pending) tried.current.add(id);
    inflight.current = true;
    void postJson<{ items: TranslateOut[]; ai: AiInfo }>("/api/v1/news/translate", { ids: pending, ...(symbol ? { symbol } : {}) }).then((r) => {
      inflight.current = false;
      if (!mounted.current) return;
      if (!r.ok) {
        setNotice(r.status === 429 || r.status === 503 ? r.error : "標題暫時無法翻成中文，先顯示英文原文。");
        return;
      }
      setNews((cur) => mergeTranslated(cur, r.data.items));
      setAi(r.data.ai);
    });
  }, [news, ai.enabled, ai.used, ai.limit, showOthers, othersOpen, symbol]);

  async function loadPoints(id: string) {
    setOpen((o) => ({ ...o, [id]: true }));
    const item = news.find((n) => n.id === id);
    if (item?.points_zh) return;
    setBusy((b) => ({ ...b, [id]: true }));
    setPointsError((e) => ({ ...e, [id]: "" }));
    const r = await postJson<{ points: string[]; tone: string | null; ai: AiInfo }>(`/api/v1/news/${encodeURIComponent(id)}/points`);
    setBusy((b) => ({ ...b, [id]: false }));
    if (!r.ok) {
      setPointsError((e) => ({ ...e, [id]: r.error }));
      return;
    }
    setNews((cur) => cur.map((n) => (n.id === id ? { ...n, points_zh: r.data.points, tone: n.tone ?? r.data.tone } : n)));
    setAi(r.data.ai);
  }

  async function makeDigests() {
    setDigestBusy(true);
    setDigestNote(null);
    const r = await postJson<{ digests: DigestItem[]; ai: AiInfo }>("/api/v1/digests", date ? { date } : {});
    setDigestBusy(false);
    if (!r.ok) {
      setDigestNote(r.error);
      return;
    }
    setAi(r.data.ai);
    if (r.data.digests.length === 0) {
      setDigestNote("目前沒有需要整理的公司：名單上這幾天沒有真的在講它們的新聞，或重點都已經產生了。");
      return;
    }
    setDigests((cur) => {
      const merged = new Map(cur.map((d) => [d.symbol, d]));
      for (const d of r.data.digests) merged.set(d.symbol, d);
      return [...merged.values()];
    });
  }

  const quotaOut = ai.enabled && ai.used >= ai.limit;
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
      <div style={{ marginTop: ".25rem" }}>
        {n.points_zh && open[n.id] ? (
          <button type="button" className="secondary small" onClick={() => setOpen((o) => ({ ...o, [n.id]: false }))}>收起重點</button>
        ) : (
          <button type="button" className="secondary small" disabled={busy[n.id] || (!n.points_zh && (!ai.enabled || quotaOut))} onClick={() => void loadPoints(n.id)}>
            {busy[n.id] ? "整理中…" : "AI 重點"}
          </button>
        )}
      </div>
      {open[n.id] && n.points_zh && (
        <ul className="news-points">{n.points_zh.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      {pointsError[n.id] && <div className="meta news-err">{pointsError[n.id]}</div>}
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
          {ai.enabled && !quotaOut && (
            <p>
              <button type="button" className="secondary small" disabled={digestBusy} onClick={() => void makeDigests()}>
                {digestBusy ? "產生中…" : "產生今日重點"}
              </button>{" "}
              <span className="meta">今天已用 {ai.used}／{ai.limit} 次 AI</span>
            </p>
          )}
          {digestNote && <p className="meta news-err">{digestNote}</p>}
        </div>
      )}
      {!ai.enabled && <p className="sub">伺服器尚未設定 AI，目前只顯示英文原文。</p>}
      {quotaOut && <p className="sub">今天的 AI 額度已用完，明天再試；先顯示英文原文與已翻好的標題。</p>}
      {notice && <p className="sub">{notice}</p>}
      {news.length === 0 ? <p className="sub">還沒有新聞。</p> : (
        <>
          {shown.length > 0 ? <ul className="list">{shown.map(renderItem)}</ul> : <p className="sub">這陣子沒有特別重要的新聞。</p>}
          {showOthers && others.length > 0 && (
            <details className="news-others" onToggle={(e) => setOthersOpen(e.currentTarget.open)}>
              <summary>其他 {others.length} 則</summary>
              <ul className="list">{others.map(renderItem)}</ul>
            </details>
          )}
        </>
      )}
    </>
  );
}
