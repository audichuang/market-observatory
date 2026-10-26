import { Link } from "@void/react";
import { Delta } from "../src/ui/bits.tsx";
import { dateWithWeekday, num, pctText } from "../src/ui/format.ts";
import type { Props } from "./outlook.server";

const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`);

const CALL: Record<string, [string, string, string]> = {
  up: ["ok", "偏多", "條件機率明顯高於歷史基準，且滾動驗證勝過基準"],
  down: ["bad", "偏空", "條件機率明顯低於歷史基準，且滾動驗證勝過基準"],
  inconclusive: ["warn", "不確定", "目前的訊號不足以把機率拉離歷史基準"],
};

const BASIS: Record<string, string> = {
  base: "歷史基準率",
  trend: "200 日線條件",
  vix: "VIX 條件",
  "trend+vix": "200 日線 × VIX 條件",
};

export default function OutlookPage({ outlook, cells, track, recent, consensus, strategists, factset, horizon, minN, minEpisodes }: Props) {
  if (!outlook) {
    return (
      <>
        <h1>下月展望</h1>
        <div className="notice warn">資料不足，或 VIX 超過 3 個交易日未更新</div>
      </>
    );
  }
  const { pick, evaluation: ev } = outlook;
  const [cls, label, why] = CALL[outlook.call];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>下月展望</h1>
          <p className="sub">以 {dateWithWeekday(outlook.asOf)} 收盤為準：約 {horizon} 個交易日後，S&amp;P 500 收盤高於今天的機率。</p>
        </div>
      </div>

      <div className="panel outlook-hero">
        <div className="outlook-prob">
          <div className="label">上漲機率</div>
          <div className="outlook-value">{pct(pick.p)}</div>
          <div className="sub">
            {pick.distinct || !pick.conditional ? (
              <>95% 區間 {pct(pick.conditional?.low ?? pick.base.low)}～{pct(pick.conditional?.high ?? pick.base.high)} · 依據：{BASIS[pick.basis]}</>
            ) : (
              <>
                採歷史基準率（95% 區間 {pct(pick.base.low)}～{pct(pick.base.high)}）；「{BASIS[pick.basis]}」條件下為 {pct(pick.conditional.p)}，區間 {pct(pick.conditional.low)}～{pct(pick.conditional.high)} 包含基準率，看不出差別
              </>
            )}
          </div>
        </div>
        <div className="outlook-call">
          <span className={`badge ${cls} big`}>{label}</span>
          <p className="sub">{why}</p>
          <p className="sub">歷史基準：{pct(pick.base.p)}（有效樣本約 {Math.round(pick.base.nEff)} 個月）{outlook.historyStart && <span className="meta"> · 樣本起點 {outlook.historyStart}</span>}</p>
        </div>
        <div className="prob-bar" aria-hidden>
          <div className="prob-ci" style={{ left: `${(pick.conditional?.low ?? pick.base.low) * 100}%`, width: `${((pick.conditional?.high ?? pick.base.high) - (pick.conditional?.low ?? pick.base.low)) * 100}%` }} />
          <div className="prob-mark base" style={{ left: `${pick.base.p * 100}%` }} title="歷史基準" />
          <div className="prob-mark now" style={{ left: `${pick.p * 100}%` }} title="目前" />
          <div className="prob-mid" />
        </div>
        <div className="prob-legend sub">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        {outlook.reasons.length > 0 && (
          <ul className="meta" style={{ margin: ".6rem 0 0", paddingLeft: "1.1rem" }}>
            {outlook.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
      </div>

      <div className="grid kpis section">
        <div className="panel kpi">
          <div className="label">S&amp;P 500 vs 200 日線</div>
          <div className="value" style={{ fontSize: "1.15rem" }}><Delta value={(outlook.close / outlook.sma200 - 1) * 100} percent /></div>
          <div className="delta sub">{outlook.regime.aboveSma200 ? "站上" : "跌破"} · 均線 {num(outlook.sma200, 0)}</div>
        </div>
        <div className="panel kpi">
          <div className="label">VIX</div>
          <div className="value" style={{ fontSize: "1.15rem" }}>{num(outlook.vix)}</div>
          <div className="delta sub">{outlook.regime.vixStress ? "≥ 30（恐慌區）" : "< 30"}</div>
        </div>
        <div className="panel kpi">
          <div className="label">滾動驗證 BSS</div>
          <div className="value" style={{ fontSize: "1.15rem" }}>{ev.bss === null ? "—" : ev.bss.toFixed(3)}</div>
          <div className="delta sub">95% 區間 {ev.bssLow === null ? "—" : `${ev.bssLow.toFixed(3)}～${ev.bssHigh!.toFixed(3)}`}</div>
        </div>
      </div>

      <div className="panel section">
        <h2>各條件下的歷史上漲比例</h2>
        <p className="sub">重疊的 {horizon} 日窗口不是獨立樣本，有效樣本以「天數 ÷ {horizon}」計；有效樣本少於 {minN}、或條件成立的日子分成不到 {minEpisodes} 段（段與段相隔至少 {horizon} 個交易日）的條件不採用，標為「樣本不足」（灰字）；基準率不受此限。</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>條件</th><th className="num">上漲比例</th><th className="num">95% 區間</th><th className="num">有效樣本／段數</th></tr>
            </thead>
            <tbody>
              {cells.map((c, i) => {
                // 基準率不受段數限制（i === 0）；其餘條件需有效樣本與段數都夠才採用。
                const thin = !c.rate || c.rate.nEff < minN || (i > 0 && c.rate.episodes < minEpisodes);
                return (
                <tr key={c.label} style={{ opacity: thin ? 0.45 : 1, fontWeight: c.current ? 600 : 400 }}>
                  <td>{c.label}{c.current && <span className="badge" style={{ marginLeft: ".4rem" }}>目前</span>}</td>
                  <td className="num">{pct(c.rate?.p, 1)}</td>
                  <td className="num">{c.rate ? `${pct(c.rate.low)}～${pct(c.rate.high)}` : "—"}</td>
                  <td className="num">{c.rate ? `${Math.round(c.rate.nEff)}／${c.rate.episodes}` : "0／0"}{thin && <span className="meta"> · 樣本不足</span>}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid two section">
        <div className="panel">
          <h2>滾動驗證</h2>
          <p className="sub">
            從 {ev.firstDate ?? "—"} 到 {ev.lastDate ?? "—"}，每 {horizon} 個交易日預測一次（共 {ev.points} 次），每次只用當下已知的資料。
          </p>
          <table>
            <tbody>
              <tr><td>預測方向命中率</td><td className="num">{pct(ev.hitRate)}</td></tr>
              <tr><td>永遠猜上漲的命中率</td><td className="num">{pct(ev.baseHitRate)}</td></tr>
              <tr><td>Brier 分數（越低越好）</td><td className="num">{ev.brier?.toFixed(4) ?? "—"}</td></tr>
              <tr><td>只用基準率的 Brier</td><td className="num">{ev.brierBase?.toFixed(4) ?? "—"}</td></tr>
            </tbody>
          </table>
          <p className="meta" style={{ marginTop: ".5rem" }}>BSS = 1 − Brier ÷ 基準 Brier；區間下限 &gt; 0 才代表穩定勝過「直接用歷史基準率」。</p>
        </div>
        <div className="panel">
          <h2>實際發出過的預測</h2>
          {track ? (
            <p className="sub">
              已到期 {track.n} 筆：實際上漲 {pct(track.upShare)}；Brier {track.brier.toFixed(4)}（基準 {track.brierBase.toFixed(4)}）。樣本少時參考價值有限。
            </p>
          ) : (
            <p className="sub">每天收盤後記錄一次，{horizon} 個交易日後才能對帳；目前還沒有到期的預測。</p>
          )}
          <ul className="list">
            {recent.slice(0, 8).map((f) => (
              <li key={f.date} style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
                <span style={{ minWidth: "6.5rem" }}>{f.date}</span>
                <span className="num">{pct(f.p)}</span>
                <span className={`badge ${CALL[f.call]?.[0] ?? ""}`}>{CALL[f.call]?.[1] ?? f.call}</span>
                <span className="meta" style={{ marginLeft: "auto" }}>{f.up === null ? "待到期" : f.up ? "後來上漲" : "後來下跌"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="section" style={{ marginTop: "1.5rem" }}>機構觀點（背景資訊，不放進上面的機率）</h2>
      <p className="sub" style={{ marginBottom: ".8rem" }}>
        研究顯示分析師目標價系統性偏樂觀，策略師年底目標與實際報酬幾乎沒有相關；這裡列出來是讓你知道市場共識在哪，而不是當漲跌訊號。
      </p>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2>由下而上：個股目標價按指數權重反推</h2>
        <p className="sub">S&amp;P 500 是市值加權指數，把每檔成分股的 12 個月共識目標價按權重加總，就得到「分析師隱含的指數目標」。</p>
        <div className="grid kpis" style={{ marginTop: ".6rem" }}>
          <div className="kpi">
            <div className="label">本站反推（權重前 200 檔）</div>
            <div className="value">{consensus?.impliedIndexTarget ? num(consensus.impliedIndexTarget, 0) : "—"}</div>
            <div className="delta">
              <Delta value={consensus?.impliedUpsidePct ?? null} percent digits={1} />{" "}
              <span className="sub">涵蓋 {consensus ? `${num(consensus.coveredWeightPct, 0)}%` : "—"} 權重</span>
            </div>
          </div>
          <div className="kpi">
            <div className="label">FactSet（全部成分股，週報）</div>
            <div className="value">{factset[0]?.bottomUpTarget ? num(factset[0].bottomUpTarget, 0) : "—"}</div>
            <div className="delta">
              <Delta value={factset[0]?.upsidePct ?? null} percent digits={1} />{" "}
              <span className="sub">{factset[0] ? `${factset[0].reportDate}，以 ${num(factset[0].referenceClose, 0)} 計` : "尚未取得"}</span>
            </div>
          </div>
          <div className="kpi">
            <div className="label">預估本益比（FactSet）</div>
            <div className="value">{factset[0]?.forwardPE ?? "—"}</div>
            <div className="delta sub">5 年平均 {factset[0]?.forwardPE5y ?? "—"} · 10 年 {factset[0]?.forwardPE10y ?? "—"}</div>
          </div>
          <div className="kpi">
            <div className="label">買進／持有／賣出（FactSet）</div>
            <div className="value" style={{ fontSize: "1.2rem" }}>{factset[0] ? `${factset[0].buyPct}／${factset[0].holdPct}／${factset[0].sellPct}%` : "—"}</div>
          </div>
        </div>
        {factset.length > 1 && (
          <p className="meta" style={{ marginTop: ".5rem" }}>
            FactSet 由下而上目標價近幾期：{factset.slice(0, 8).map((f) => `${f.reportDate?.slice(5)} ${num(f.bottomUpTarget, 0)}`).join("、")}
          </p>
        )}
        <p className="meta" style={{ marginTop: ".5rem" }}>
          FactSet 統計：由下而上目標價長期平均高估實際指數；兩個數字差距大時，通常是涵蓋範圍（本站只算前 200 檔）或更新時間不同。
          {factset[0] && <> 週報原文：<a href={factset[0].pdfUrl} target="_blank" rel="noreferrer">PDF</a>。</>}
        </p>
      </div>

      <div className="grid two">
        <div className="panel">
          <h2>成分股分析師共識</h2>
          {!consensus ? (
            <p className="sub">還沒有資料。每 4 小時輪流更新 SPY 權重前 200 檔中的 16 檔。</p>
          ) : (
            <>
              <div className="grid kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
                <div className="kpi"><div className="label">目標價隱含漲幅</div><div className="value" style={{ fontSize: "1.2rem" }}><Delta value={consensus.impliedUpsidePct} percent digits={1} /></div></div>
                <div className="kpi"><div className="label">買進評等占比</div><div className="value" style={{ fontSize: "1.2rem" }}>{consensus.buyPct === null ? "—" : `${num(consensus.buyPct, 0)}%`}</div></div>
                <div className="kpi"><div className="label">EPS 修正廣度</div><div className="value" style={{ fontSize: "1.2rem" }}><Delta value={consensus.revisionBreadth === null ? null : consensus.revisionBreadth * 100} digits={0} /></div><div className="delta sub">−100～+100</div></div>
              </div>
              <p className="meta" style={{ margin: ".5rem 0" }}>
                涵蓋 {consensus.symbols} 檔、約占指數 {num(consensus.coveredWeightPct, 0)}% 權重（{consensus.oldest}～{consensus.newest} 更新）。依 SPY 權重加權；目標價為 12 個月共識。買進占比是 Nasdaq 收錄的評等按權重平均，和 FactSet 全部評等的口徑不同，數字會有落差。
                {consensus.coveredWeightPct < 50 && " 涵蓋不到一半權重，數字還不完整。"}
              </p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>代號</th><th className="num">權重</th><th className="num">股價</th><th className="num">目標價</th><th className="num">隱含</th><th className="num hide-sm">買/持/賣</th></tr></thead>
                  <tbody>
                    {consensus.top.map((v) => (
                      <tr key={v.symbol}>
                        <td className="mono">{v.symbol}</td>
                        <td className="num">{num(v.weightPct, 2)}%</td>
                        <td className="num">{num(v.price)}</td>
                        <td className="num">{num(v.targetMean)}</td>
                        <td className="num"><Delta value={v.upsidePct} percent digits={1} /></td>
                        <td className="num hide-sm">{v.buy}/{v.hold}/{v.sell}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="panel">
          <h2>投行年底目標價</h2>
          {strategists && (
            <>
              <p className="sub">
                中位數 {num(strategists.median, 0)}，相對目前 {num(outlook.close, 0)} 為 {pctText(strategists.medianUpsidePct, 1)}；Reuters 民調（{strategists.poll.respondents} 人，{strategists.poll.surveyed}）中位數 {num(strategists.poll.median, 0)}。
              </p>
              <ul className="list">
                {strategists.list.map((t) => (
                  <li key={t.firm} style={{ display: "flex", gap: ".6rem", alignItems: "baseline", flexWrap: "wrap" }}>
                    <a href={t.sourceUrl} target="_blank" rel="noreferrer" style={{ minWidth: "8.5rem" }}>{t.firm}</a>
                    <strong className="num">{num(t.target, 0)}</strong>
                    <span className="meta">{t.horizon} · {t.asOf}{t.note ? ` · ${t.note}` : ""}</span>
                  </li>
                ))}
              </ul>
              <p className="meta" style={{ marginTop: ".5rem" }}>
                人工整理自新聞轉述（{strategists.checked} 核對），未必是券商原文。由下而上的指數目標價與預估本益比見 <a href={strategists.factsetUrl} target="_blank" rel="noreferrer">FactSet Earnings Insight</a>（每週五更新）。
              </p>
            </>
          )}
        </div>
      </div>
      <p className="meta" style={{ marginTop: "1rem" }}>
        方法與研究依據見 <Link href="/sources">資料來源</Link> 頁與專案 README。這不是投資建議。
      </p>
    </>
  );
}
