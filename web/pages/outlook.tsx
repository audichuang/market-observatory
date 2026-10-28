import { Link } from "@void/react";
import type { ReactNode } from "react";
import { Delta } from "../src/ui/bits.tsx";
import { dateWithWeekday, num, pctText } from "../src/ui/format.ts";
import { FORECAST_CALL, LIVE_MIN_N, NO_INCREMENTAL_SKILL, PROPORTION_INTERVAL, SKILL_INTERVAL, dd5Definition, dd5ShortLabel, upTargetLabel } from "../src/lib/communication.ts";
import type { Assessments, Evaluation } from "../src/lib/forecast.ts";
import type { Props } from "./outlook.server";

const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`);
const coverageText = ({ symbols, weightPct }: { symbols: number; weightPct: number }) => `${symbols} 檔 · ${num(weightPct, 0)}% 權重${weightPct < 50 ? "（不到一半，數字不完整）" : ""}`;

const BASIS: Record<string, string> = {
  base: "歷史基準率",
  trend: "200 日線條件",
  vix: "VIX 條件",
  "trend+vix": "200 日線 × VIX 條件",
};

const rpct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

const STATUS: Record<string, [string, string]> = { pass: ["ok", "通過"], fail: ["bad", "未通過"], na: ["", "不適用"] };
const f3 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(3));

/** L12：四個固定評估項（與上面的 call 同一份資料，不會互相矛盾）。 */
function AssessmentRows({ a }: { a: Assessments }) {
  const rows: [string, string, string, string][] = [
    ["差異", a.difference.status, `條件 ${pct(a.difference.condP, 1)} vs 平常 ${pct(a.difference.baseP, 1)}`, a.difference.low === null ? "沒有可用的條件" : `${PROPORTION_INTERVAL} ${pct(a.difference.low)}～${pct(a.difference.high)}`],
    ["樣本", a.sampleAdequacy.status, a.sampleAdequacy.nEff === null ? "沒有可用的條件" : `有效樣本 ${Math.round(a.sampleAdequacy.nEff)}、${a.sampleAdequacy.episodes} 段`, `驗證 ${a.sampleAdequacy.rows} 列、${a.sampleAdequacy.runs} 段`],
    ["紀錄", a.trackRecord.status, `此條件 BSS 下界 ${f3(a.trackRecord.cellBssLow)}（最小可偵測 ${f3(a.trackRecord.cellMde)}）`, `上漲模型整體 BSS ${f3(a.trackRecord.globalBss)}`],
    ["資料新鮮度", a.dataFreshness.status, `SPX ${a.dataFreshness.spxDate}、VIX ${a.dataFreshness.vixDate ?? "—"}`, a.dataFreshness.staleSessions === null ? "—" : `VIX 落後 ${a.dataFreshness.staleSessions} 個交易日`],
  ];
  return (
    <table style={{ margin: ".6rem 0" }}>
      <tbody>
        {rows.map(([name, status, a1, a2]) => (
          <tr key={name}>
            <td style={{ whiteSpace: "nowrap" }}>{name}</td>
            <td><span className={`badge ${STATUS[status][0]}`}>{STATUS[status][1]}</span></td>
            <td>{a1}<span className="meta"> · {a2}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type OutlookData = NonNullable<Props["outlook"]>;

const bssRange = (ev: Evaluation) => (ev.bssLow === null ? "—" : `${f3(ev.bssLow)}～${f3(ev.bssHigh)}`);

/** 一個目標的整體滾動驗證 BSS（標明目標，避免把上漲模型的數字當成 dd5 的）。 */
function BssKpi({ label, ev }: { label: string; ev: Evaluation }) {
  return (
    <div className="panel kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: "1.15rem" }}>{f3(ev.bss)}</div>
      <div className="delta sub">{SKILL_INTERVAL} {bssRange(ev)}</div>
    </div>
  );
}

/** 一個目標的滾動驗證（walk-forward）面板；上漲與 dd5 各一個，數字各自來自自己的 evaluation。 */
function WalkForwardPanel({ title, target, ev, horizon }: { title: string; target: string; ev: Evaluation; horizon: number }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <p className="sub">
        {target}從 {ev.firstDate ?? "—"} 到 {ev.lastDate ?? "—"}，每 {horizon} 個交易日預測一次（共 {ev.points} 次），每次只用當下已知的資料。
      </p>
      <table>
        <tbody>
          <tr><td>Brier 分數（越低越好）</td><td className="num">{ev.brier?.toFixed(4) ?? "—"}</td></tr>
          <tr><td>只用基準率的 Brier</td><td className="num">{ev.brierBase?.toFixed(4) ?? "—"}</td></tr>
        </tbody>
      </table>
      <p className="sub" style={{ marginTop: ".5rem" }}>
        BSS {f3(ev.bss)}（{SKILL_INTERVAL} {bssRange(ev)}）· 最小可偵測 BSS {ev.mde === null ? "—" : ev.mde.toFixed(2)} · n = {ev.points} 列
      </p>
      <p className="meta" style={{ marginTop: ".5rem" }}>BSS = 1 − Brier ÷ 基準 Brier；區間下限 &gt; 0 才代表穩定勝過「直接用歷史基準率」。</p>
    </div>
  );
}

function ForecastBlock({ outlook, cells, horizon, minN, minEpisodes, trackPanel, frequency }: { outlook: OutlookData; cells: Props["cells"]; horizon: number; minN: number; minEpisodes: number; trackPanel: ReactNode; frequency: Props["frequency"] }) {
  const { pick, evaluation: ev } = outlook;
  const [cls, baseLabel, why] = FORECAST_CALL[outlook.call];
  // G08：沒有方向時註明最小可偵測 BSS（標準差為 0 則不寫數字）。
  const label = outlook.call === "inconclusive" && ev.mde !== null ? `偵測不到預測力（最小可偵測 BSS 約 ${ev.mde.toFixed(2)}）` : baseLabel;
  return (
    <>

  <div className="panel outlook-hero">
    <div className="outlook-prob" style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
      <div>
        <div className="label">{dd5ShortLabel(horizon)}</div>
        <div className="outlook-value">{pct(outlook.drawdown.pick.p)}</div>
        <div className="sub">（平常 {pct(outlook.drawdown.pick.base.p)}）</div>
        {!outlook.drawdown.scored && <div className="sub"><span className="badge warn">未通過驗證，只供參考</span></div>}
        <div className="meta">定義：{dd5Definition(horizon)}</div>
      </div>
      <div>
    <div className="label">上漲機率（{upTargetLabel(horizon)}）</div>
      <div className="outlook-value">{pct(pick.p)}</div>
      <div className="sub">
        {pick.shrinkWeight > 0 && pick.conditional ? (
          <>
            收縮後 {pct(pick.p, 1)}（基準 {pct(pick.base.p, 1)}、條件 {pct(pick.conditional.p, 1)}、權重 {pick.shrinkWeight.toFixed(2)}）· 依據：{BASIS[pick.basis]}
          </>
        ) : pick.distinct || !pick.conditional ? (
          <>{PROPORTION_INTERVAL} {pct(pick.conditional?.low ?? pick.base.low)}～{pct(pick.conditional?.high ?? pick.base.high)} · 依據：{BASIS[pick.basis]}</>
        ) : (
          <>
            {NO_INCREMENTAL_SKILL}，採歷史基準率（{PROPORTION_INTERVAL} {pct(pick.base.low)}～{pct(pick.base.high)}）；「{BASIS[pick.basis]}」條件下的歷史比例為 {pct(pick.conditional.p)}，區間 {pct(pick.conditional.low)}～{pct(pick.conditional.high)} 包含基準率
          </>
        )}
      </div>
      </div>
    </div>
    {frequency && (
      <p className="sub">
        {frequency.up}。<br />
        {frequency.dd5}。
      </p>
    )}
    <p className="sub"><strong>對每月定期定額：這不是加碼或停扣的訊號，它描述下個月可能的波動。</strong></p>
    {outlook.returnQuantiles.cell && (
      <p className="sub">
        過去類似情況 {horizon} 個交易日報酬：10% 機率低於 {rpct(outlook.returnQuantiles.cell.p10)}、一半低於 {rpct(outlook.returnQuantiles.cell.p50)}、90% 低於 {rpct(outlook.returnQuantiles.cell.p90)}
        <span className="meta">（{outlook.returnQuantiles.cell.n} 個交易日；描述統計，不計分{outlook.returnQuantiles.all ? `；不分條件：${rpct(outlook.returnQuantiles.all.p10)}／${rpct(outlook.returnQuantiles.all.p50)}／${rpct(outlook.returnQuantiles.all.p90)}` : ""}）</span>
      </p>
    )}
    <AssessmentRows a={outlook.assessments} />
    {outlook.globalCaveat && <p className="meta" style={{ margin: 0 }}>{outlook.globalCaveat}</p>}
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
    <div className="prob-legend prob-key sub">
      <span><i className="prob-mark now" aria-hidden />目前機率</span>
      <span><i className="prob-mark base" aria-hidden />歷史基準</span>
      <span><i className="prob-mid" aria-hidden />50% 中線</span>
      <span><i className="prob-ci" aria-hidden />歷史比例 95% 區間</span>
    </div>
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
    <BssKpi label="跌幅機率（dd5）滾動驗證 BSS" ev={outlook.drawdown.evaluation} />
    <BssKpi label="上漲機率滾動驗證 BSS" ev={ev} />
  </div>

  <div className="panel section">
    <h2>樣本內：各條件下的歷史上漲比例</h2>
    <p className="sub"><span className="badge">樣本內</span> 這張表用全部歷史算出，同一批資料也用來挑條件，只描述過去、不代表預測力（預測力看下面的滾動驗證與上線後紀錄）。重疊的 {horizon} 日窗口不是獨立樣本，有效樣本以「天數 ÷ {horizon}」計；有效樣本少於 {minN}、或條件成立的日子分成不到 {minEpisodes} 段（段與段相隔至少 {horizon} 個交易日）的條件不採用，標為「樣本不足」（灰字）；基準率不受此限。</p>
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>條件</th><th className="num">上漲比例</th><th className="num">歷史比例 95% 區間</th><th className="num">有效樣本／段數</th></tr>
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
    <WalkForwardPanel title="滾動驗證：跌幅機率（dd5）" target={`目標：${dd5Definition(horizon)}。`} ev={outlook.drawdown.evaluation} horizon={horizon} />
    <WalkForwardPanel title="滾動驗證：上漲機率" target={`目標：${upTargetLabel(horizon)}。`} ev={ev} horizon={horizon} />
  </div>
  <div className="section">{trackPanel}</div>
    </>
  );
}

export default function OutlookPage({ outlook, cells, liveTrack, frequency, recent, consensus, strategists, factset, horizon, minN, minEpisodes }: Props) {
  const trackPanel = (
    <div className="panel">
      <h2>上線後實際紀錄：上漲機率 <span className="meta">（合併所有已發布的模型版本；每列以紀錄日收盤為起點）</span></h2>
      {liveTrack.n === 0 ? (
        <p className="sub">每天收盤後記錄一次，{horizon} 個交易日後才能對帳；目前還沒有到期的預測。</p>
      ) : liveTrack.tooFew ? (
        <p className="sub">
          <span className="badge warn">樣本太少</span> 只有 {liveTrack.n} 個獨立月份（少於 {LIVE_MIN_N}），不報分數。只取不重疊的列：從第一筆紀錄起每 {horizon} 個交易日一列。
        </p>
      ) : (
        <p className="sub">
          BSS {f3(liveTrack.bss)}（對照紀錄當時存下的基準率）· n = {liveTrack.n} 個獨立月份 · 實際上漲 {pct(liveTrack.upShare)}。只取不重疊的列，與上面兩種分數分開看。
        </p>
      )}
      <ul className="list">
        {recent.slice(0, 8).map((f) => (
          <li key={f.date} style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
            <span style={{ minWidth: "6.5rem" }}>{f.date}</span>
            <span className="num">{pct(f.p)}</span>
            <span className={`badge ${FORECAST_CALL[f.call]?.[0] ?? ""}`}>{FORECAST_CALL[f.call]?.[1] ?? f.call}</span>
            <span className="meta" title={f.historyStart ? `樣本起點 ${f.historyStart}` : undefined}>{f.modelVersion ?? "舊版紀錄"}</span>
            <span className="meta" style={{ marginLeft: "auto" }}>{f.up === null ? "待到期" : f.up ? "後來上漲" : "後來下跌"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  const close = outlook?.close ?? strategists?.close ?? null;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>下月展望</h1>
          {outlook && <p className="sub">資料日 {dateWithWeekday(outlook.asOf)}。跌幅機率（dd5）：{dd5Definition(horizon)}的機率；上漲機率：S&amp;P 500 {upTargetLabel(horizon)}的機率。</p>}
          <p className="sub">以美元計、不含股息的 S&amp;P 500 價格指數；台幣結果另受匯率影響</p>
        </div>
      </div>

      {!outlook ? (
        <>
          <div className="notice warn">資料不足，或 VIX 超過 3 個交易日未更新，今天沒有產生預測；下方的機構觀點與過去的預測紀錄照常顯示。</div>
          <div className="section">{trackPanel}</div>
        </>
      ) : (
        <>
          <ForecastBlock outlook={outlook} cells={cells} horizon={horizon} minN={minN} minEpisodes={minEpisodes} trackPanel={trackPanel} frequency={frequency} />
        </>
      )}

      <h2 className="section" style={{ marginTop: "1.5rem" }}>機構觀點（背景資訊，不放進上面的機率）</h2>
      <p className="sub" style={{ marginBottom: ".8rem" }}>
        研究顯示分析師目標價系統性偏樂觀，策略師年底目標與實際報酬幾乎沒有相關；這裡列出來是讓你知道市場共識在哪，而不是當漲跌訊號。
      </p>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2>由下而上：個股目標價按指數權重反推</h2>
        <p className="sub">把涵蓋到的成分股 12 個月共識目標價的隱含漲幅按 SPY 權重平均，再套到 S&amp;P 500 收盤，推算「分析師隱含的指數目標」。這是涵蓋子集的外推，各檔股價日不同，不是全部成分股同一天的加總。</p>
        <div className="grid kpis" style={{ marginTop: ".6rem" }}>
          <div className="kpi">
            <div className="label">本站反推（權重前 200 檔）</div>
            <div className="value">{consensus?.impliedIndexTarget ? num(consensus.impliedIndexTarget, 0) : "—"}</div>
            <div className="delta">
              <Delta value={consensus?.impliedUpsidePct ?? null} percent digits={1} />{" "}
              <span className="sub">涵蓋 {consensus ? `${num(consensus.coverage.target.weightPct, 0)}%` : "—"} 權重 · 以 SPX {consensus?.indexCloseDate ?? "—"} 收盤推算</span>
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
            <p className="sub">7 天內沒有更新的分析師共識。每 4 小時輪流更新 SPY 權重前 200 檔中的 16 檔。</p>
          ) : (
            <>
              <div className="grid kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
                <div className="kpi"><div className="label">目標價隱含漲幅</div><div className="value" style={{ fontSize: "1.2rem" }}><Delta value={consensus.impliedUpsidePct} percent digits={1} /></div><div className="delta sub">{coverageText(consensus.coverage.target)}</div></div>
                <div className="kpi"><div className="label">買進評等占比</div><div className="value" style={{ fontSize: "1.2rem" }}>{consensus.buyPct === null ? "—" : `${num(consensus.buyPct, 0)}%`}</div><div className="delta sub">{coverageText(consensus.coverage.ratings)}</div></div>
                <div className="kpi"><div className="label">EPS 修正廣度</div><div className="value" style={{ fontSize: "1.2rem" }}><Delta value={consensus.revisionBreadth === null ? null : consensus.revisionBreadth * 100} digits={0} /></div><div className="delta sub">近四週（上修−下修）÷ 總次數，−100～+100</div><div className="delta sub">{coverageText(consensus.coverage.revisions)}</div></div>
              </div>
              <p className="meta" style={{ margin: ".5rem 0" }}>
                有可用數字的 {consensus.symbols} 檔約占指數 {num(consensus.coveredWeightPct, 0)}% 權重；
                {consensus.noData.symbols > 0 && <>另有 {consensus.noData.symbols} 檔（{num(consensus.noData.weightPct, 0)}%）沒有可用數字，例如 Nasdaq 沒有分析師資料；</>}
                分析師資料 {consensus.oldest}～{consensus.newest} 抓取；股價日 {consensus.priceOldest ?? "—"}～{consensus.priceNewest ?? "—"}，各檔不同日；權重用 SPY {consensus.weightsAsOf ?? "—"} 持股。目標價為 12 個月共識。買進占比是 Nasdaq 收錄的評等按權重平均，和 FactSet 全部評等的口徑不同，數字會有落差。
              </p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>代號</th><th className="num">權重</th><th className="num">股價</th><th className="num">目標價</th><th className="num">隱含</th><th className="num hide-sm">買/持/賣</th><th className="num hide-sm">EPS 近四週修正</th></tr></thead>
                  <tbody>
                    {consensus.top.map((v) => (
                      <tr key={v.symbol}>
                        <td className="mono">{v.symbol}</td>
                        <td className="num">{num(v.weightPct, 2)}%</td>
                        <td className="num">{num(v.price)}<div className="meta">{v.priceDate?.slice(5) ?? "—"}</div></td>
                        <td className="num" style={{ whiteSpace: "normal" }}>
                          {v.targetMean === null && v.buy + v.hold + v.sell === 0 ? "Nasdaq 無資料" : num(v.targetMean)}
                          {v.targetLow != null && v.targetHigh != null && <div className="meta" style={{ whiteSpace: "normal" }}>最低 {num(v.targetLow)}～最高 {num(v.targetHigh)}</div>}
                        </td>
                        <td className="num"><Delta value={v.upsidePct} percent digits={1} /></td>
                        <td className="num hide-sm">{v.buy}/{v.hold}/{v.sell}</td>
                        <td className="num hide-sm" style={{ whiteSpace: "normal" }}>
                          {v.epsUp === null || v.epsDown === null ? "缺資料" : v.epsUp === 0 && v.epsDown === 0 ? "沒有修正" : `上修 ${v.epsUp}／下修 ${v.epsDown}`}
                          <div className="meta">會計年度 {v.fiscalEnd ?? "缺資料"} · 估計數 {v.estimates ?? "缺資料"}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="meta" style={{ marginTop: ".5rem" }}>
                最低～最高是 Nasdaq 收錄的個別分析師目標價範圍，不是機率區間；EPS 欄是來源提供的近四週上修／下修次數，不是修正幅度，也不一定是不同分析師的家數；會計年度是來源列出的第一個年度。這些欄位只描述資料，能否預測報酬未經驗證（成效未證實），不是買賣訊號。
              </p>
            </>
          )}
        </div>
        <div className="panel">
          <h2>投行年底目標價</h2>
          {strategists && (
            <>
              <p className="sub">
                中位數 {num(strategists.median, 0)}（{strategists.medianCount} 家），相對目前 {num(close, 0)} 為 {pctText(strategists.medianUpsidePct, 1)}；Reuters 民調（{strategists.poll.respondents} 人，{strategists.poll.surveyed} 調查）中位數 {num(strategists.poll.median, 0)}。
              </p>
              <ul className="list">
                {strategists.list.map((t) => (
                  <li key={t.firm} style={{ display: "flex", gap: ".6rem", alignItems: "baseline", flexWrap: "wrap" }}>
                    <a href={t.sourceUrl} target="_blank" rel="noreferrer" style={{ minWidth: "8.5rem" }}>{t.firm}</a>
                    <strong className="num">{num(t.target, 0)}</strong>
                    {t.targetIsMidpoint && t.targetLow != null && t.targetHigh != null && (
                      <span className="meta">區間 {num(t.targetLow, 0)}–{num(t.targetHigh, 0)} 的中點</span>
                    )}
                    <span className="meta">{t.horizon} · 資料日期 {t.asOf}{t.note ? ` · ${t.note}` : ""}</span>
                    <span className="badge" title={t.verifiedOn ? `${t.verifiedOn} 對過原文` : undefined}>{t.verified ? "已核對原文" : "媒體轉述，待原文核對"}</span>
                    {!t.inMedian && <span className="badge">不計入中位數</span>}
                    {t.stale && <span className="badge">待重新核對</span>}
                  </li>
                ))}
              </ul>
              <p className="meta" style={{ marginTop: ".5rem" }}>
                {strategists.medianRule}資料日期超過 {strategists.staleAfterDays} 天的列標「待重新核對」（維護提醒，不代表數字有誤）。全表 {strategists.checked} 核對；標「已核對原文」的列對過機構官方原文，其餘取自新聞轉述。由下而上的指數目標價與預估本益比見 <a href={strategists.factsetUrl} target="_blank" rel="noreferrer">FactSet Earnings Insight</a>（每週五更新）。
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
