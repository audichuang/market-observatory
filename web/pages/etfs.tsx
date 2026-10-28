import { Form, Link, action, useForm, useRouter } from "@void/react";
import { useEffect, useState } from "react";
import LineChart from "../src/ui/LineChart.tsx";
import { Delta } from "../src/ui/bits.tsx";
import { compactUsd, num, pctText } from "../src/ui/format.ts";
import { planIssue } from "../src/lib/plan.ts";
import { DCA_BUY_RULE, DCA_FX_RULE, DCA_IDLE_CASH, DCA_LUMP_PREMISE, DCA_MONTHLY_NO_LUMP, EVIDENCE_1X, EVIDENCE_LEVERAGED, FUNDING_LUMP_LABEL, FUNDING_MONTHLY_LABEL } from "../src/lib/etf-copy.ts";
import { ETFS, type EtfProduct } from "../src/lib/universe.ts";
import type { CostInputs } from "../src/lib/costs.ts";
import type { Props } from "./etfs.server";

const errorText = (e: unknown) => {
  const body = (e as { body?: unknown })?.body;
  if (body && typeof body === "object" && "error" in body) return String((body as { error: unknown }).error);
  if (body && typeof body === "object" && "errors" in body) return "輸入格式不對，請檢查規劃欄位";
  const status = (e as { status?: number })?.status;
  if (status && status >= 500) return `伺服器錯誤（HTTP ${status}），規劃沒有變更，請稍後再試`;
  return e instanceof Error && e.message ? `操作失敗：${e.message}` : "操作失敗，請檢查網路後再試";
};

export default function EtfPage({ asOf, catalogAsOf, rows, periods, plan, sim, dca, fxLast, funding, costScenario, checklists, overlap }: Props) {
  const router = useRouter();
  const form = useForm("/etfs", { ...plan });
  const issue = planIssue(form.data);
  const [monthly, setMonthly] = useState(String(sim.monthlyTwd));
  const [savedDefault, setSavedDefault] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const costInputs = costScenario && !("issue" in costScenario) ? costScenario.inputs
    : Object.fromEntries([...router.query].filter(([key]) => key.startsWith("cost")));
  const [costForm, setCostForm] = useState(costFormOf(costInputs));
  useEffect(() => setCostForm(costFormOf(costInputs)), [costScenario]);
  const overlapInputs = overlap.inputs ? overlapQueryOf(overlap.inputs) : Object.fromEntries([...router.query].filter(([key]) => key === "ovEtf" || key === "ov"));
  const [overlapForm, setOverlapForm] = useState(overlapFormOf(overlap, router.query));
  useEffect(() => setOverlapForm(overlapFormOf(overlap, router.query)), [overlap]);

  async function saveDefault() {
    setSavingDefault(true);
    setSavedDefault(false);
    setDefaultError(null);
    try {
      const res = await action("/etfs", { data: { ...plan, etf: sim.etf, years: sim.years, monthlyTwd: sim.monthlyTwd } });
      if (!res.ok) {
        setDefaultError(errorText(res.error));
        return;
      }
      setSavedDefault(true);
      router.visit(simUrl({}));
    } catch (e) {
      setDefaultError(errorText(e));
    } finally {
      setSavingDefault(false);
    }
  }
  useEffect(() => setMonthly(String(sim.monthlyTwd)), [sim.monthlyTwd]);
  const isDefault = plan.etf === sim.etf && plan.years === sim.years && plan.monthlyTwd === sim.monthlyTwd;
  const simUrl = (patch: Partial<typeof sim & { funding: string }>, costs: CostInputs | Partial<typeof costForm> | null = costInputs, overlapQuery = overlapInputs) => {
    const next = { ...sim, funding, ...patch };
    const query = new URLSearchParams({ etf: next.etf, years: String(next.years), monthly: String(next.monthlyTwd), funding: next.funding });
    for (const [key, value] of Object.entries(costs ?? {})) {
      if (value !== null && value !== "") query.set(key, String(value));
    }
    for (const [key, value] of Object.entries(overlapQuery)) query.set(key, value);
    return `/etfs?${query}`;
  };
  return (
    <>
      <div className="page-head">
        <div>
          <h1>ETF 產品比較</h1>
          <p className="sub">同樣追蹤 S&amp;P 500，費率、結構與每日重設倍數不同。價格與報酬每日自動更新（至 {asOf}）；費率與 AUM 為 {catalogAsOf} 人工查核發行商頁面。</p>
        </div>
      </div>

      <div className="panel">
        <ul className="etf-cards show-sm">
          {rows.map((r) => (
            <li key={r.ticker}>
              <div className="etf-card-head">
                <Link href={`/history?symbol=${r.ticker}`}><strong>{r.ticker}</strong></Link>
                <span className="badge">{r.multiple}x</span>
                <span className="num" style={{ marginLeft: "auto" }}>{num(r.close)}</span>
              </div>
              <div className="meta">{r.name} · 費用率 {r.netFeePct === null ? "—" : `${feeText(r.netFeePct)}%`} · AUM {compactUsd(r.aumUsd)}</div>
              <dl className="etf-card-grid">
                <div><dt>YTD</dt><dd><Delta value={r.ytd} percent digits={1} /></dd></div>
                {periods.map((p) => (
                  <div key={p}><dt>{p}</dt><dd><Delta value={r.returns[p]} percent digits={1} /></dd></div>
                ))}
                {r.drift1y && <div><dt>1Y 偏離</dt><dd><Delta value={r.drift1y.drift} percent digits={1} /></dd></div>}
              </dl>
              {r.note && <div className="meta">{r.note}</div>}
              <details className="etf-facts" style={{ marginTop: ".3rem" }}>
                <summary>產品資料</summary>
                <div className="meta" style={{ marginTop: ".3rem", lineHeight: 1.5 }}>
                  <div>註冊地：{r.facts?.domicile ?? "未查核"}</div>
                  <div>配息：{r.facts?.distribution ?? "未查核"}</div>
                  <div>ISIN：{r.facts?.isin ?? "未查核"}</div>
                  <div>費用率：{feeSummary(r, catalogAsOf)}</div>
                  <div>倍數：{multipleText(r.multiple)}</div>
                  <div>出處：<a href={r.facts?.sourceUrl ?? r.sourceUrl} target="_blank" rel="noreferrer">發行商頁面</a>（{r.facts?.checkedAt ?? "未查核"} 查閱）</div>
                  <div style={{ marginTop: ".3rem" }}>{r.multiple === 1 ? EVIDENCE_1X : EVIDENCE_LEVERAGED}</div>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <div className="table-wrap hide-sm">
          <table>
            <thead>
              <tr>
                <th>代號</th>
                <th className="num">倍數</th>
                <th className="num">費用率</th>
                <th className="num hide-sm">AUM</th>
                <th className="num">收盤</th>
                <th className="num">YTD</th>
                {periods.map((p) => <th key={p} className="num">{p}</th>)}
                <th className="num" title="近一年實際報酬 − 倍數 × S&P 500 報酬">1Y 偏離</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker}>
                  <td>
                    <a href={r.sourceUrl} target="_blank" rel="noreferrer"><strong>{r.ticker}</strong></a>
                    <div className="meta">{r.name}</div>
                    {r.note && <div className="meta">{r.note}</div>}
                    <details className="etf-facts" style={{ marginTop: ".3rem" }}>
                      <summary>產品資料</summary>
                      <div className="meta" style={{ marginTop: ".3rem", lineHeight: 1.5 }}>
                        <div>註冊地：{r.facts?.domicile ?? "未查核"}</div>
                        <div>配息：{r.facts?.distribution ?? "未查核"}</div>
                        <div>ISIN：{r.facts?.isin ?? "未查核"}</div>
                        <div>費用率：{feeSummary(r, catalogAsOf)}</div>
                        <div>倍數：{multipleText(r.multiple)}</div>
                        <div>出處：<a href={r.facts?.sourceUrl ?? r.sourceUrl} target="_blank" rel="noreferrer">發行商頁面</a>（{r.facts?.checkedAt ?? "未查核"} 查閱）</div>
                        <div style={{ marginTop: ".3rem" }}>{r.multiple === 1 ? EVIDENCE_1X : EVIDENCE_LEVERAGED}</div>
                      </div>
                    </details>
                  </td>
                  <td className="num">{r.multiple > 0 ? `${r.multiple}x` : `${r.multiple}x`}</td>
                  <td className="num">
                    {r.netFeePct === null ? "—" : `${feeText(r.netFeePct)}%`}
                    {r.grossFeePct !== null && r.grossFeePct !== r.netFeePct && <div className="meta">總 {feeText(r.grossFeePct)}%</div>}
                  </td>
                  <td className="num hide-sm">{compactUsd(r.aumUsd)}{r.aumAsOf && <div className="meta">{r.aumAsOf}</div>}</td>
                  <td className="num">
                    <Link href={`/history?symbol=${r.ticker}`}>{num(r.close)}</Link>
                    {r.lastDate !== asOf && <div className="meta">{r.lastDate ?? "無資料"}</div>}
                  </td>
                  <td className="num"><Delta value={r.ytd} percent digits={1} /></td>
                  {periods.map((p) => <td key={p} className="num"><Delta value={r.returns[p]} percent digits={1} /></td>)}
                  <td className="num">{r.drift1y ? <Delta value={r.drift1y.drift} percent digits={1} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="meta" style={{ marginTop: ".6rem" }}>
          報酬為價格報酬，不含配息。「1Y 偏離」是槓桿／反向 ETF 近一年實際報酬減去「倍數 × 指數報酬」：每日重設加上費用，盤整或大波動時通常為負，持有越久偏離越大。
        </p>
      </div>

      <div className="grid two section">
        <div className="panel">
          <h2>定投試算（台幣）</h2>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const m = Number(monthly);
              if (m > 0) router.visit(simUrl({ monthlyTwd: m }));
            }}
          >
            <label className="field">
              標的
              <select value={sim.etf} onChange={(e) => router.visit(simUrl({ etf: e.target.value, monthlyTwd: Number(monthly) || sim.monthlyTwd }))}>
                {rows.map((r) => <option key={r.ticker} value={r.ticker}>{r.ticker}（{r.multiple}x）</option>)}
              </select>
            </label>
            <label className="field">
              期間
              <select value={sim.years} onChange={(e) => router.visit(simUrl({ years: Number(e.target.value), monthlyTwd: Number(monthly) || sim.monthlyTwd }))}>
                {[1, 2, 3, 5].map((y) => <option key={y} value={y}>過去 {y} 年</option>)}
              </select>
            </label>
            <label className="field">
              資金類型
              <select value={funding} onChange={(e) => router.visit(simUrl({ funding: e.target.value, monthlyTwd: Number(monthly) || sim.monthlyTwd }))}>
                <option value="monthly">{FUNDING_MONTHLY_LABEL}</option>
                <option value="lump">{FUNDING_LUMP_LABEL}</option>
              </select>
            </label>
            <label className="field">
              {funding === "lump" ? "每月分批金額（台幣）" : "每月投入（台幣）"}
              <input type="number" inputMode="numeric" min={1000} step={1000} enterKeyHint="go" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </label>
            <div className="row" style={{ flexBasis: "100%" }}>
              <button type="submit" disabled={Number(monthly) === sim.monthlyTwd || !(Number(monthly) > 0)}>試算</button>
              <button
                type="button"
                className="secondary"
                disabled={isDefault || savingDefault}
                onClick={saveDefault}
              >
                {savingDefault ? "儲存中…" : isDefault ? "已是我的預設" : "設為我的預設"}
              </button>
              {savedDefault && isDefault && <span className="badge ok">已儲存</span>}
            </div>
          </form>
          {defaultError && <p className="error" role="alert">{defaultError}</p>}
          {!dca ? (
            <p className="sub" style={{ marginTop: "1rem" }}>這檔的歷史資料不夠 {sim.years} 年，或尚未回補。</p>
          ) : (
            <>
              <div className="grid kpis" style={{ marginTop: "1rem" }}>
                <div className="kpi"><div className="label">{funding === "lump" ? "期初資金" : `投入 ${dca.months} 個月`}</div><div className="value">{num(dca.invested, 0)}</div></div>
                {funding === "lump" && <div className="kpi"><div className="label">一次投入（{dca.firstBuyDate} 全部買入）</div><div className="value">{num(dca.lumpSumValue, 0)}</div><div className="delta"><Delta value={dca.lumpSumReturnPct} percent /></div></div>}
                <div className="kpi"><div className="label">{funding === "lump" ? `分 ${dca.months} 個月投入` : "目前市值"}</div><div className="value">{num(dca.value, 0)}</div><div className="delta"><Delta value={dca.returnPct} percent /></div></div>
                <div className="kpi"><div className="label">{funding === "lump" ? "分批的最大帳面虧損" : "最大帳面虧損"}</div><div className="value"><Delta value={dca.maxDrawdownPct} percent /></div></div>
              </div>
              <p className="meta">{funding === "lump" ? <>{DCA_LUMP_PREMISE}{DCA_IDLE_CASH}</> : DCA_MONTHLY_NO_LUMP}</p>
              <LineChart
                digits={0}
                height={300}
                width={560}
                lines={[
                  { name: "累計投入", color: "#5c6b7a", dashed: true, points: dca.path.map((p) => ({ date: p.date, value: p.invested })) },
                  { name: "市值", color: "#d1343b", points: dca.path.map((p) => ({ date: p.date, value: p.value })) },
                ]}
              />
              {(rows.find((r) => r.ticker === sim.etf)?.multiple ?? ETFS.find((e) => e.ticker === sim.etf)?.multiple ?? 1) === 1 ? (
                <p className="meta">{EVIDENCE_1X}</p>
              ) : (
                <div className="notice warn">{EVIDENCE_LEVERAGED}</div>
              )}
              <p className="meta">
                試算起點 {sim.startDate}，首筆 {dca.firstBuyDate}。{DCA_BUY_RULE}；{DCA_FX_RULE}（最新 {num(fxLast?.close ?? null, 3)}，{fxLast?.date}）。不含配息、手續費、換匯價差與稅。歷史試算不代表未來。
              </p>
            </>
          )}
        </div>

        <div className="panel">
          <h2>我的規劃</h2>
          <p className="sub">只是規劃，不是持倉或交易紀錄。定投的預設標的、期間與金額在左邊試算按「設為我的預設」。</p>
          <Form form={form} className="stack" style={{ marginTop: ".8rem" }}>
            <div className="row">
              <label className="field">
                加碼研究預算
                <input type="number" inputMode="numeric" value={form.data.researchBudgetTwd} onChange={(e) => form.setData("researchBudgetTwd", Number(e.target.value))} />
              </label>
              <label className="field">
                單筆加碼
                <input type="number" inputMode="numeric" value={form.data.trancheTwd} onChange={(e) => form.setData("trancheTwd", Number(e.target.value))} />
              </label>
              <label className="field">
                檢討門檻 ±%
                <input type="number" inputMode="numeric" value={form.data.exitConsiderationPct} onChange={(e) => form.setData("exitConsiderationPct", Number(e.target.value))} />
              </label>
            </div>
            <label className="field">
              待定事項與備註
              <textarea value={form.data.notes} onChange={(e) => form.setData("notes", e.target.value)} />
            </label>
            {issue ? <p className="error" role="status">{issue}</p> : form.error && <p className="error" role="alert">{String(form.error)}</p>}
            <div className="row">
              <button disabled={form.pending || !form.hasChanges || issue !== null}>{form.pending ? "儲存中…" : "儲存規劃"}</button>
              {form.recentlySuccessful && <span className="badge ok">已儲存</span>}
            </div>
          </Form>
          <p className="meta" style={{ marginTop: ".8rem" }}>
            單筆加碼 {num(plan.trancheTwd, 0)} 元約可分 {plan.trancheTwd ? Math.floor(plan.researchBudgetTwd / plan.trancheTwd) : "—"} 次；漲跌達 {pctText(plan.exitConsiderationPct, 0).replace("+", "±")} 時檢討。
          </p>
        </div>
      </div>
      <div className="panel section" id="cost-scenario">
        <h2>成本情境（你的假設）</h2>
        <p className="sub">只是試算，不會儲存。假設年配息率僅計一般股利。</p>
        <form className="row" noValidate onSubmit={(e) => { e.preventDefault(); router.visit(simUrl({}, costForm)); }}>
          <label className="field">
            扣款幣別
            <select name="costCcy" value={costForm.costCcy} onChange={(e) => setCostForm({ ...costForm, costCcy: e.target.value })}>
              <option value="twd">台幣</option><option value="usd">美元</option>
            </select>
          </label>
          {([
            ["costFx", "換匯價差 %", 5], ["costFee", "手續費比例 %", 5],
            ["costMinUsd", "最低手續費（美元）", 100], ["costFixed", "每次固定費用（台幣）", 10000],
            ["costYield", "假設年配息率 %", 10],
          ] as const).map(([key, label, max]) => (
            <label className="field" key={key}>
              {label}
              <input name={key} type="number" inputMode={key === "costFixed" ? "numeric" : "decimal"} min={0} max={max} step={key === "costFixed" ? 1 : "any"} value={costForm[key]} onChange={(e) => setCostForm({ ...costForm, [key]: e.target.value })} />
            </label>
          ))}
          <label className="field">
            優惠到期日
            <input name="costPromo" type="date" value={costForm.costPromo} onChange={(e) => setCostForm({ ...costForm, costPromo: e.target.value })} />
          </label>
          <label className="field">
            報酬口徑
            <select name="costBasis" value={costForm.costBasis} onChange={(e) => setCostForm({ ...costForm, costBasis: e.target.value })}>
              <option value="nav">基金淨值／總報酬</option><option value="index">稅前指數</option>
            </select>
          </label>
          <label className="field" style={{ maxWidth: "100%" }}>
            稅務身分
            <select name="costTax" style={{ maxWidth: "100%" }} value={costForm.costTax} onChange={(e) => setCostForm({ ...costForm, costTax: e.target.value })}>
              <option value="tw">台灣稅務居民、非美國公民且非美國稅務居民</option><option value="other">其他</option>
            </select>
          </label>
          <div className="row" style={{ flexBasis: "100%" }}>
            <button type="submit">試算成本</button>
            <button type="button" className="secondary" onClick={() => { setCostForm(costFormOf(null)); router.visit(simUrl({}, null)); }}>清除</button>
          </div>
        </form>
        {!costScenario ? <p className="meta">尚未試算，請填入你的假設後按「試算成本」。</p> : "issue" in costScenario ? (
          <p className="error" role="alert">{costScenario.issue}</p>
        ) : (
          <>
            <p className="meta">以 {sim.etf}、每月 {num(costScenario.perBuy.amountTwd, 0)} 台幣等值金額估算。</p>
            <h3>每次扣款拆解（台幣）</h3>
            <div className="table-wrap">
              <table>
                <tbody>
                  {([
                    ["扣款金額", costScenario.perBuy.amountTwd], ["換匯價差", costScenario.perBuy.fxSpreadTwd],
                    ["固定費用", costScenario.perBuy.fixedTwd], ["手續費", costScenario.perBuy.commissionTwd],
                    ["買進金額", costScenario.perBuy.investedTwd], ["交易成本", costScenario.perBuy.costTwd],
                  ] as const).map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td className="num">{num(value, 2)}</td></tr>)}
                  <tr><th scope="row">交易成本占扣款金額</th><td className="num">{num(costScenario.perBuy.costPct, 4)}%</td></tr>
                </tbody>
              </table>
            </div>
            <p>一年交易成本：{num(costScenario.annualTxCostTwd, 2)} 台幣（每月一次，共 12 次）</p>
            <h3>三層年化項目（占持有市值的 %）</h3>
            <p className="meta">各層各自列出，不加總，也不與交易成本相加。</p>
            <div className="table-wrap">
              <table>
                <tbody>
                  {([
                    ["基金費用", costScenario.layers.fundExpense], ["基金層預扣", costScenario.layers.fundWithholding],
                    ["投資人層預扣", costScenario.layers.investorWithholding],
                  ] as const).map(([label, layer]) => (
                    <tr key={label}><th scope="row">{label}</th><td>{layer.pct !== null && <strong>{feeText(layer.pct)}%</strong>}<div className="meta">{layer.note}</div></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {costScenario.promo && <p className={costScenario.promo.expired ? "notice warn" : "meta"}>{costScenario.promo.expired ? "你填的優惠已過期" : "你填的優惠到期日"}：{costScenario.promo.until}；費用仍依你填的假設計算。</p>}
            {costScenario.notes.map((note) => <p className="meta" key={note}>{note}</p>)}
            <ul className="meta">
              {costScenario.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>（來源日期：{source.sourceDate ?? "未標明"}；查閱日：{source.checkedAt}）</li>)}
            </ul>
          </>
        )}
      </div>
      <div className="panel section" id="tax-checklists" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <h2>稅務與傳承檢查清單</h2>
        {checklists.map((checklist) => (
          <details key={checklist.id} id={checklist.id} style={{ marginTop: ".8rem" }}>
            <summary>{checklist.title}</summary>
            <ol>
              {checklist.items.map((item) => <li key={item}>{item}</li>)}
            </ol>
            {checklist.note && <p className="meta">{checklist.note}</p>}
            <p className="meta">{checklist.footer}</p>
            <ul className="meta">
              {checklist.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
                  （頁面更新日：{source.updatedAt}；查閱日：{source.checkedAt}）
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <div className="panel section" id="watchlist-overlap" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <h2>與觀察名單的重疊</h2>
        {overlap.notes.map((note) => <p className="meta" key={note}>{note}</p>)}
        {overlap.weightsStale && <div className="notice warn">{overlap.weightsStale}</div>}
        <table style={{ tableLayout: "fixed" }}>
          <thead><tr><th style={{ whiteSpace: "normal" }}>公司</th><th style={{ whiteSpace: "normal" }}>代號</th><th style={{ whiteSpace: "normal", textAlign: "right" }}>指數權重</th></tr></thead>
          <tbody>
            {overlap.members.map((m) => (
              <tr key={m.key}>
                <th scope="row" style={{ whiteSpace: "normal" }}>{m.company}</th>
                <td>{m.tickers.join("、")}{m.outOfIndex.length > 0 && <div className="meta">{m.outOfIndex.join("、")} 已不在持股檔，權重以 0 計</div>}</td>
                <td className="num">{overlap.asOf === null ? "—" : `${num(m.weightPct, 3)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {overlap.members.length === 0 && <p className="meta">觀察名單目前沒有公司。</p>}
        <p>名單合計覆蓋：{overlap.asOf === null ? "—" : `${num(overlap.totalWeight, 3)}%`}；指數前十大公司合計：{overlap.asOf === null ? "—" : `${num(overlap.top10CompanyWeight, 3)}%`}</p>
        <form className="row" noValidate onSubmit={(e) => {
          e.preventDefault();
          const query: Record<string, string> = {};
          if (overlapForm.ovEtf !== "") query.ovEtf = overlapForm.ovEtf;
          const direct = overlap.members.filter((m) => overlapForm.ov[m.key] !== "").map((m) => `${m.key}:${overlapForm.ov[m.key]}`).join(",");
          if (direct) query.ov = direct;
          router.visit(simUrl({}, costInputs, query));
        }}>
          <label className="field" style={{ minWidth: 0 }}>
            {sim.etf} 金額（台幣）
            <input name="ovEtf" type="number" inputMode="numeric" min={0} max={1_000_000_000} step={1} value={overlapForm.ovEtf} onChange={(e) => setOverlapForm({ ...overlapForm, ovEtf: e.target.value })} />
          </label>
          {overlap.members.map((m) => (
            <label className="field" key={m.key} style={{ minWidth: 0 }}>
              <span>{m.company}（{m.key}）</span>另外持有（台幣）
              <input name={`ov-${m.key}`} type="number" inputMode="numeric" min={0} max={1_000_000_000} step={1} value={overlapForm.ov[m.key]} onChange={(e) => setOverlapForm({ ...overlapForm, ov: { ...overlapForm.ov, [m.key]: e.target.value } })} />
            </label>
          ))}
          <div style={{ flexBasis: "100%" }}><button type="submit">計算假設曝險</button></div>
        </form>
        {overlap.issue && <p className="error" role="alert">{overlap.issue}</p>}
        {overlap.exposure && <>
          <h3>假設曝險（台幣）</h3>
          <div className="table-wrap hide-sm">
            <table>
              <thead><tr><th>公司</th><th className="num">經 ETF</th><th className="num">另外持有</th><th className="num">合計</th><th className="num">占你填的總額</th></tr></thead>
              <tbody>{overlap.exposure.members.map((m, i) => <tr key={m.key}>
                <th scope="row">{overlap.members[i].company}</th><td className="num">{num(m.viaEtfTwd, 2)}</td><td className="num">{num(m.directTwd, 2)}</td><td className="num">{num(m.combinedTwd, 2)}</td><td className="num">{m.sharePct === null ? "—" : `${num(m.sharePct, 2)}%`}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="show-sm">
            {overlap.exposure.members.map((m, i) => <div key={m.key}>
              <h4>{overlap.members[i].company}（{m.key}）</h4>
              <dl>{([
                ["經 ETF", num(m.viaEtfTwd, 2)], ["另外持有", num(m.directTwd, 2)], ["合計", num(m.combinedTwd, 2)],
                ["占你填的總額", m.sharePct === null ? "—" : `${num(m.sharePct, 2)}%`],
              ] as const).map(([label, value]) => <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5rem" }}>
                <dt>{label}</dt><dd className="num" style={{ margin: 0, whiteSpace: "normal" }}>{value}</dd>
              </div>)}</dl>
            </div>)}
          </div>
          <p>你填的總額：{num(overlap.exposure.totalTwd, 2)} 台幣；名單占比：{overlap.exposure.watchlistSharePct === null ? "—" : `${num(overlap.exposure.watchlistSharePct, 2)}%`}</p>
          <p>ETF 中名單以外的金額：{num(overlap.exposure.otherViaEtfTwd, 2)} 台幣</p>
        </>}
      </div>
    </>
  );
}

function costFormOf(inputs: CostInputs | Partial<Record<keyof CostInputs, string>> | null): Record<keyof CostInputs, string> {
  return {
    costCcy: inputs?.costCcy ?? "twd", costFx: String(inputs?.costFx ?? 0), costFee: String(inputs?.costFee ?? 0),
    costMinUsd: String(inputs?.costMinUsd ?? 0), costFixed: String(inputs?.costFixed ?? 0), costPromo: inputs?.costPromo ?? "",
    costYield: String(inputs?.costYield ?? 0), costBasis: inputs?.costBasis ?? "nav", costTax: inputs?.costTax ?? "tw",
  };
}

/** 0.0300 → 0.03、0.0945 → 0.0945：保留有效位數、去掉尾端 0。 */
function feeText(v: number): string {
  return String(Number(v.toFixed(4)));
}

function multipleText(m: number): string {
  if (m === 1) return "1x，不每日重設";
  if (m < 0) return `反向 ${Math.abs(m)}x，每日重設`;
  return `${m}x，每日重設`;
}

function feeSummary(r: EtfProduct, catalogAsOf: string): string {
  if (r.netFeePct === null) return `—（${catalogAsOf} 查核）`;
  if (r.grossFeePct !== null && r.grossFeePct !== r.netFeePct) {
    return `淨 ${feeText(r.netFeePct)}% / 總 ${feeText(r.grossFeePct)}%（${catalogAsOf} 查核）`;
  }
  return `淨／總 ${feeText(r.netFeePct)}%（${catalogAsOf} 查核）`;
}

function overlapQueryOf(inputs: NonNullable<Props["overlap"]["inputs"]>): Record<string, string> {
  const query: Record<string, string> = { ovEtf: String(inputs.ovEtf) };
  const direct = Object.entries(inputs.ov).map(([key, amount]) => `${key}:${amount}`).join(",");
  if (direct) query.ov = direct;
  return query;
}

function overlapFormOf(overlap: Props["overlap"], query: URLSearchParams) {
  const direct = Object.fromEntries((query.get("ov") ?? "").split(",").map((entry) => entry.split(":")));
  return {
    ovEtf: overlap.inputs ? String(overlap.inputs.ovEtf) : query.get("ovEtf") ?? "",
    ov: Object.fromEntries(overlap.members.map((m) => [m.key, overlap.inputs?.ov[m.key] === undefined ? direct[m.key] ?? "" : String(overlap.inputs.ov[m.key])])),
  };
}
