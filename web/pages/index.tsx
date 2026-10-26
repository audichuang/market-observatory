import { Link, useRouter } from "@void/react";
import type { Mag7Row } from "../src/lib/snapshot.ts";
import { CenteredBar, CheckBadge, Delta } from "../src/ui/bits.tsx";
import { dateWithWeekday, num, pctText, signed, taipeiTime } from "../src/ui/format.ts";
import { NewsFeed, ToneBadge } from "../src/ui/NewsFeed.tsx";
import type { Props } from "./index.server";

export default function Overview({ snapshot, dates, expectedClose, news, digests, market, events, lastPriceRun, forecast, restCount, viewingLatest }: Props) {
  const router = useRouter();
  if (!snapshot) {
    return (
      <>
        <h1>市場總覽</h1>
        <div className="notice warn">還沒有任何快照。到「資料來源」頁手動執行一次抓價，或等收盤後的排程。</div>
      </>
    );
  }
  const s = snapshot.data;
  const stale = viewingLatest && s.tradeDate < expectedClose;
  const maxContribution = Math.max(0.01, ...s.mag7.map((r) => Math.abs(r.contributionPts ?? 0)), Math.abs(s.rest.contributionPts ?? 0));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>S&amp;P 500 收盤 {dateWithWeekday(s.tradeDate)}</h1>
          <p className="sub">資料 {taipeiTime(snapshot.createdAt)} 產出</p>
        </div>
        <div className="row" style={{ maxWidth: 360 }}>
          <label className="field">
            查看其他交易日
            <select value={s.tradeDate} onChange={(e) => router.visit(`/?date=${e.target.value}`)}>
              {dates.map((d) => (
                <option key={d.tradeDate} value={d.tradeDate}>{d.tradeDate}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {stale && (
        <div className="notice warn">
          最新快照是 {s.tradeDate}，但 {expectedClose} 應該已收盤。最近一次抓價：{lastPriceRun ? `${lastPriceRun.summary}（${taipeiTime(lastPriceRun.finished_at)}）` : "沒有紀錄"}。
        </div>
      )}
      {s.quality.mismatches.length > 0 && (
        <div className="notice bad">收盤價來源不一致：{s.quality.mismatches.join("、")}。歸因數字可能有誤，詳見「資料來源」頁。</div>
      )}

      {market && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="label">今天為什麼漲跌 <ToneBadge tone={market.tone} /></div>
          <p style={{ margin: ".35rem 0 0" }}>{market.summary}</p>
        </div>
      )}

      <div className="grid kpis">
        <div className="panel kpi">
          <div className="label">S&amp;P 500 <CheckBadge status={s.index.check.status} /></div>
          <div className="value">{num(s.index.close)}</div>
          <div className="delta"><Delta value={s.index.changePts} /> （<Delta value={s.index.returnPct} percent />）</div>
        </div>
        <div className="panel kpi">
          <div className="label">VIX 恐慌指數</div>
          <div className="value">{num(s.vix.close)}</div>
          <div className="delta"><Delta value={s.vix.change} /> · 近月 {num(s.vix.monthLow, 1)}–{num(s.vix.monthHigh, 1)}</div>
        </div>
        <div className="panel kpi">
          <div className="label">等權重 RSP − 市值加權</div>
          <div className="value"><Delta value={s.breadth.spreadPct} percent /></div>
          <div className="delta sub">RSP {pctText(s.breadth.rspReturnPct)} vs SPX {pctText(s.breadth.spxReturnPct)}</div>
        </div>
        <div className="panel kpi">
          <div className="label">觀察名單合計貢獻</div>
          <div className="value"><Delta value={s.mag7Total.contributionPts} /> 點</div>
          <div className="delta sub">
            占指數漲跌 {s.mag7Total.shareOfMovePct === null ? "—（平盤）" : `${num(s.mag7Total.shareOfMovePct, 0)}%`} · 權重 {num(s.mag7Total.weightPct, 1)}%
          </div>
        </div>
      </div>

      {forecast && viewingLatest && (
        <Link href="/outlook" className="panel section outlook-card">
          <div>
            <div className="sub">下月展望（約 21 個交易日後）</div>
            <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
              <div>
                <div className="sub">收高機率</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{Math.round(forecast.probability * 100)}%</div>
                <div className="sub">平常 {Math.round(forecast.base_rate * 100)}%</div>
              </div>
              {forecast.drawdown && (
                <div>
                  <div className="sub">≥5% 跌幅機率</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{Math.round(forecast.drawdown.p * 100)}%</div>
                  <div className="sub">平常 {Math.round(forecast.drawdown.base * 100)}%</div>
                  {!forecast.drawdown.scored && <div className="sub"><span className="badge warn">未通過驗證</span></div>}
                </div>
              )}
            </div>
          </div>
          <div className="sub" style={{ flex: 1 }}>
            <span className={`badge ${forecast.call === "up" ? "ok" : forecast.call === "down" ? "bad" : "warn"}`}>
              {forecast.call === "up" ? "高於平常" : forecast.call === "down" ? "低於平常" : "偵測不到 skill"}
            </span>
          </div>
          <span aria-hidden>→</span>
        </Link>
      )}

      <div className="grid kpis section" style={{ alignItems: "start" }}>
        <Mini label="近一週" value={s.index.weekPct} />
        <Mini label="近一月" value={s.index.monthPct} />
        <Mini label="今年以來" value={s.index.ytdPct} />
        <Mini label="近一年" value={s.index.yearPct} />
        <div className="panel kpi">
          <div className="label">距 52 週高點</div>
          <div className="value" style={{ fontSize: "1.15rem" }}><Delta value={s.index.fromHighPct} percent /></div>
          <div className="delta sub">高 {num(s.index.high52, 0)} · 低 {num(s.index.low52, 0)}</div>
        </div>
        <div className="panel kpi">
          <div className="label">收盤 vs 均線</div>
          <div className="delta" style={{ marginTop: ".3rem" }}>
            <MaLine name="20 日" close={s.index.close} ma={s.index.sma20} />
            <MaLine name="60 日" close={s.index.close} ma={s.index.sma60} />
            <MaLine name="200 日" close={s.index.close} ma={s.index.sma200} />
          </div>
        </div>
      </div>

      <div className="panel section">
        <div className="head-row">
          <h2>觀察名單，拆開來看</h2>
          <Link href="/watchlist" className="button secondary small">編輯名單</Link>
        </div>
        <p className="sub">
          貢獻點數 = 前一交易日指數 × 前一交易日權重 × 當日報酬。{s.weights.method === "rolled" ? `權重由 ${s.weights.asOf} SPY 持股依價格推算。` : s.weights.asOf ? `權重來自 ${s.weights.asOf} SPY 持股。` : ""}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>公司</th>
                <th className="num hide-sm">收盤</th>
                <th className="num">漲跌</th>
                <th className="num">權重</th>
                <th className="num">貢獻（點）</th>
                <th className="hide-sm" style={{ minWidth: 120 }}></th>
                <th className="num hide-sm">占漲跌</th>
              </tr>
            </thead>
            <tbody>
              {s.mag7.map((r) => <Mag7Line key={r.key} r={r} max={maxContribution} />)}
              <tr>
                <td>其餘{restCount ? ` ${restCount} 檔` : "成分股"} <span className="meta">（推算）</span></td>
                <td className="num hide-sm">—</td>
                <td className="num"><Delta value={s.rest.impliedReturnPct} percent /></td>
                <td className="num">{s.mag7Total.weightPct === null ? "—" : `${num(100 - s.mag7Total.weightPct, 1)}%`}</td>
                <td className="num"><Delta value={s.rest.contributionPts} /></td>
                <td className="hide-sm"><CenteredBar value={s.rest.contributionPts} max={maxContribution} /></td>
                <td className="num hide-sm">{s.mag7Total.shareOfMovePct === null ? "—" : `${num(100 - s.mag7Total.shareOfMovePct, 0)}%`}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>S&amp;P 500</td>
                <td className="num hide-sm">{num(s.index.close)}</td>
                <td className="num"><Delta value={s.index.returnPct} percent /></td>
                <td className="num">100%</td>
                <td className="num"><Delta value={s.index.changePts} /></td>
                <td className="hide-sm"></td>
                <td className="num hide-sm">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {s.quality.notes.length > 0 && (
          <ul className="meta" style={{ marginTop: ".6rem", paddingLeft: "1.1rem" }}>
            {s.quality.notes.map((n) => <li key={n}>{n}</li>)}
            {s.quality.missing.length > 0 && <li>缺少當日收盤：{s.quality.missing.join("、")}</li>}
            {s.quality.pendingChecks.length > 0 && <li>尚待第二來源核對：{s.quality.pendingChecks.join("、")}</li>}
          </ul>
        )}
      </div>

      <div className="grid two section">
        <div className="panel">
          <h2>最新新聞</h2>
          <NewsFeed news={news} digests={digests} showOthers={false} />
          <p style={{ marginTop: ".5rem" }}><Link href="/news">全部新聞 →</Link></p>
        </div>
        <div className="panel">
          <h2>未來三週事件</h2>
          {events.length === 0 ? <p className="sub">三週內沒有登錄的事件。</p> : (
            <ul className="list">
              {events.map((e) => (
                <li key={`${e.date}-${e.title}`}>
                  <strong>{dateWithWeekday(e.date)}</strong> {e.title}
                  {e.status === "estimated" && <span className="badge warn" style={{ marginLeft: ".4rem" }}>推估日期</span>}
                  {e.status === "tentative" && <span className="badge warn" style={{ marginLeft: ".4rem" }}>暫定</span>}
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: ".5rem" }}><Link href="/news">完整日曆 →</Link></p>
        </div>
      </div>
    </>
  );
}

function Mini({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="panel kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: "1.15rem" }}><Delta value={value} percent /></div>
    </div>
  );
}

function MaLine({ name, close, ma }: { name: string; close: number; ma: number | null }) {
  const diff = ma === null ? null : ((close / ma) - 1) * 100;
  return (
    <div>
      {name} {num(ma, 0)} <span className="meta">（</span><Delta value={diff} percent /><span className="meta">）</span>
    </div>
  );
}

function Mag7Line({ r, max }: { r: Mag7Row; max: number }) {
  return (
    <tr>
      <td>
        <Link href={`/history?symbol=${r.key}`}>{r.company}</Link> <span className="meta mono">{r.tickers.join("+")}</span>
      </td>
      <td className="num hide-sm">{num(r.close)}</td>
      <td className="num"><Delta value={r.returnPct} percent /></td>
      <td className="num">{r.weightPct === null ? "—" : `${num(r.weightPct)}%`}</td>
      <td className="num"><Delta value={r.contributionPts} /></td>
      <td className="hide-sm"><CenteredBar value={r.contributionPts} max={max} /></td>
      <td className="num hide-sm">{r.shareOfMovePct === null ? "—" : `${signed(r.shareOfMovePct, 0).replace("+", "")}%`}</td>
    </tr>
  );
}
