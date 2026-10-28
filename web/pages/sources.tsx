import { useRouter, useShared } from "@void/react";
import { useState } from "react";
import { CheckBadge, RunStatusBadge, runStatusText } from "../src/ui/bits.tsx";
import { num, taipeiTime } from "../src/ui/format.ts";
import type { CheckStatus } from "../src/lib/snapshot.ts";
import type { Props } from "./sources.server";

const JOB_LABEL: Record<string, string> = {
  prices: "抓收盤價",
  crosscheck: "Nasdaq 交叉核對",
  weights: "SPY 持股權重",
  news: "新聞",
  events: "財報與總經日程",
  analysts: "分析師共識（16 檔）",
  factset: "FactSet 週報",
  forecast: "重算下月展望",
  snapshots: "重算近 30 天快照",
  "notify-close": "發送收盤推播",
  "notify-events": "發送今日事件推播",
  "backfill-prices": "回補十年日線（分段）",
  "backfill-checks": "回補交叉核對（分段）",
  "backfill-index-history": "回補 SPX／VIX 更早歷史（Cboe）",
};

const label = (job: string) => JOB_LABEL[job] ?? job;

/** D1 裡存的來源代碼（src/lib/sources/*_SOURCE）換成來源名稱 */
const SOURCE_LABEL: Record<string, string> = { "yahoo-chart": "Yahoo chart", cboe: "Cboe", nasdaq: "Nasdaq" };
const sourceName = (s: string | null) => (s ? SOURCE_LABEL[s] ?? s : "");

const NO_SECOND_SOURCE = new Set(["USDTWD", "VIX"]);

const SCHEDULE = [
  ["抓收盤價", "週一至五 UTC 21:40（美東收盤後）；隔日 UTC 01:10 補抓並再核對", "Yahoo chart（主）、Cboe VIX／SPX"],
  ["交叉核對", "週一至五 UTC 22:50", "Nasdaq 歷史行情逐檔比對收盤"],
  ["持股權重＋日曆＋週報", "每天 UTC 11:30", "State Street SPY 持股檔、Nasdaq 財報日期、聯準會 FOMC 與勞工統計局 CPI／非農日程（程式內建的官方靜態日期）、FactSet Earnings Insight（有新一期才解析）"],
  ["新聞＋分析師共識", "每 4 小時", "Nasdaq 個股新聞；SPY 權重前 200 檔輪流抓目標價（前 100 檔加抓 EPS 修正，每次 16 檔）"],
];

/** U-04: what kind of data each source is, so readers don't mistake it for an official feed. */
const DATA_NOTES = [
  "Yahoo chart 與 Nasdaq（api.nasdaq.com）是網站自用的非官方端點，沒有公開 API 或服務保證，格式或可用性可能無預警改變；收盤價因此另用第二來源交叉核對。",
  "S&P 500（^GSPC）是價格指數，各標的收盤是拆股調整後、不含股息的價格（不是 Adj Close）；漲跌與報酬都沒算股息，跟含息的總報酬比會偏低。",
  "投行策略師年底目標表是人工維護的背景資訊，不進方向預測模型：標「已核對原文」的列對過機構官方原文，其餘取自媒體報導。",
];

export default function SourcesPage({ expected, freshness, mismatches, runs, weights, weightsStale, counts, jobs, tolerance, calendar, links }: Props) {
  const router = useRouter();
  const { isOwner } = useShared();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAllRuns, setShowAllRuns] = useState(false);

  async function trigger(job: string) {
    setBusy(job);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/run?job=${job}`, { method: "POST" });
      const body = (await res.json()) as { status?: string; summary?: string; error?: string };
      setMessage(`${label(job)}：${body.status ? runStatusText(body.status) : `錯誤 ${res.status}`} ${body.summary ?? body.error ?? ""}`);
      router.refresh();
    } catch {
      setMessage(`${label(job)} 失敗：連不上伺服器或回應格式不對，請稍後再試`);
    } finally {
      setBusy(null);
    }
  }

  const staleCount = freshness.filter((f) => f.symbol !== "USDTWD" && f.date < expected).length;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>資料來源與品質</h1>
          <p className="sub">
            排程應已抓到收盤的最近交易日：<strong>{expected}</strong>。日線 {num(counts?.prices ?? 0, 0)} 筆、快照 {num(counts?.snapshots ?? 0, 0)} 版（{counts?.days ?? 0} 天）、新聞 {counts?.news ?? 0} 則、事件 {counts?.events ?? 0} 筆。
          </p>
        </div>
      </div>

      {staleCount > 0 ? (
        <div className="notice warn">{staleCount} 個標的最新資料早於 {expected}。</div>
      ) : (
        <div className="notice ok">所有標的都已更新到 {expected}。</div>
      )}

      {isOwner && <div className="panel">
        <h2>手動執行</h2>
        <div className="chips">
          {jobs.filter((j) => !j.startsWith("backfill")).map((j) => (
            <button key={j} className="secondary" disabled={busy !== null} onClick={() => trigger(j)}>
              {busy === j ? "執行中…" : label(j)}
            </button>
          ))}
        </div>
        {message && <p className="sub" style={{ marginTop: ".6rem" }}>{message}</p>}
      </div>}

      <div className="grid two section">
        <div className="panel">
          <h2>排程</h2>
          <table>
            <tbody>
              {SCHEDULE.map(([name, when, what]) => (
                <tr key={name}><td><strong>{name}</strong><div className="meta">{when}</div></td><td className="meta">{what}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="meta" style={{ marginTop: ".6rem" }}>
            交叉核對容差：差距 ≤ max({tolerance.abs}, 收盤 × {tolerance.rel * 100}%) 視為一致。S&amp;P 500 由 <a href={links.cboeSpx} target="_blank" rel="noreferrer">Cboe 官方歷史</a> 核對。
            NYSE 休市日曆覆蓋 {calendar.coverageStart}～{calendar.coverageEnd}（{calendar.verifiedOn} 核對 <a href={calendar.sourceUrl} target="_blank" rel="noreferrer">NYSE</a>）。
          </p>
        </div>
        <div className="panel">
          <h2>SPY 持股檔</h2>
          {weightsStale && <div className="notice warn">{weightsStale}</div>}
          <p className="sub">來源：<a href={links.ssga} target="_blank" rel="noreferrer">State Street SPY 每日持股</a>。通常落後 1～2 個交易日，歸因時依價格推算到前一交易日。</p>
          <table>
            <thead><tr><th>持股日期</th><th className="num">檔數</th><th className="num">權重合計</th><th>抓取時間</th></tr></thead>
            <tbody>
              {weights.map((w) => (
                <tr key={w.as_of}><td>{w.as_of}</td><td className="num">{w.n}</td><td className="num">{w.total}%</td><td className="meta">{taipeiTime(w.fetched_at)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel section">
        <h2>資料性質</h2>
        <ul className="list">
          {DATA_NOTES.map((n) => <li key={n} className="meta">{n}</li>)}
        </ul>
      </div>

      <div className="panel section">
        <h2>各標的最新資料</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>標的</th><th>日期</th><th className="num">收盤</th><th>主來源</th><th>第二來源</th><th className="hide-sm">抓取時間</th></tr></thead>
            <tbody>
              {freshness.map((f) => (
                <tr key={f.symbol}>
                  <td className="mono">{f.link ? <a href={f.link} target="_blank" rel="noreferrer">{f.symbol}</a> : f.symbol}</td>
                  <td>{f.date} {f.symbol !== "USDTWD" && f.date < expected && <span className="badge warn">落後</span>}</td>
                  <td className="num">{num(f.close)}</td>
                  <td className="meta">{sourceName(f.source)}</td>
                  <td>
                    <CheckBadge status={(f.check_status as CheckStatus) ?? (NO_SECOND_SOURCE.has(f.symbol) ? "unavailable" : "pending")} />
                    {f.check_close !== null && f.check_status === "mismatch" && <span className="meta"> {sourceName(f.check_source)} {num(f.check_close)}</span>}
                  </td>
                  <td className="meta hide-sm">{taipeiTime(f.fetched_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {mismatches.length > 0 && (
        <div className="panel section">
          <h2>近 60 天來源不一致</h2>
          <table>
            <thead><tr><th>標的</th><th>日期</th><th className="num">主來源</th><th className="num">第二來源</th></tr></thead>
            <tbody>
              {mismatches.map((m) => (
                <tr key={`${m.symbol}-${m.date}`}><td className="mono">{m.symbol}</td><td>{m.date}</td><td className="num">{num(m.close, 4)}</td><td className="num">{num(m.check_close, 4)} <span className="meta">{sourceName(m.check_source)}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel section">
        <h2>執行紀錄</h2>
        <ul className="list">
          {(showAllRuns ? runs : runs.slice(0, 15)).map((r) => (
            <li key={r.id}>
              <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
                <RunStatusBadge status={r.status} />
                <strong>{label(r.job)}</strong>
                <span className="meta">{taipeiTime(r.started_at)} · {r.trigger.startsWith("cron") ? "排程" : "手動"}</span>
              </div>
              <div className="meta">{r.summary}</div>
            </li>
          ))}
        </ul>
        {runs.length > 15 && !showAllRuns && (
          <button className="secondary" style={{ marginTop: ".6rem" }} onClick={() => setShowAllRuns(true)}>顯示全部 {runs.length} 筆</button>
        )}
      </div>
    </>
  );
}
