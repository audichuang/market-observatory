import { Form, Link, action, useForm, useRouter } from "@void/react";
import { useEffect, useState } from "react";
import LineChart from "../src/ui/LineChart.tsx";
import { Delta } from "../src/ui/bits.tsx";
import { compactUsd, num, pctText } from "../src/ui/format.ts";
import { planIssue } from "../src/lib/plan.ts";
import { DCA_BUY_RULE, DCA_FX_RULE, DCA_LUMP_PREMISE } from "../src/lib/etf-copy.ts";
import type { Props } from "./etfs.server";

const errorText = (e: unknown) => {
  const body = (e as { body?: unknown })?.body;
  if (body && typeof body === "object" && "error" in body) return String((body as { error: unknown }).error);
  if (body && typeof body === "object" && "errors" in body) return "輸入格式不對，請檢查規劃欄位";
  const status = (e as { status?: number })?.status;
  if (status && status >= 500) return `伺服器錯誤（HTTP ${status}），規劃沒有變更，請稍後再試`;
  return e instanceof Error && e.message ? `操作失敗：${e.message}` : "操作失敗，請檢查網路後再試";
};

export default function EtfPage({ asOf, catalogAsOf, rows, periods, plan, sim, dca, fxLast }: Props) {
  const router = useRouter();
  const form = useForm("/etfs", { ...plan });
  const issue = planIssue(form.data);
  const [monthly, setMonthly] = useState(String(sim.monthlyTwd));
  const [savedDefault, setSavedDefault] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultError, setDefaultError] = useState<string | null>(null);

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
  const simUrl = (patch: Partial<typeof sim>) => {
    const next = { ...sim, ...patch };
    return `/etfs?etf=${next.etf}&years=${next.years}&monthly=${next.monthlyTwd}`;
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
              每月投入（台幣）
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
                <div className="kpi"><div className="label">投入 {dca.months} 個月</div><div className="value">{num(dca.invested, 0)}</div></div>
                <div className="kpi"><div className="label">目前市值</div><div className="value">{num(dca.value, 0)}</div><div className="delta"><Delta value={dca.returnPct} percent /></div></div>
                <div className="kpi"><div className="label">同金額期初單筆</div><div className="value">{num(dca.lumpSumValue, 0)}</div><div className="delta"><Delta value={dca.lumpSumReturnPct} percent /></div><div className="meta">{DCA_LUMP_PREMISE}</div></div>
                <div className="kpi"><div className="label">最大帳面虧損</div><div className="value"><Delta value={dca.maxDrawdownPct} percent /></div></div>
              </div>
              <LineChart
                digits={0}
                height={300}
                width={560}
                lines={[
                  { name: "累計投入", color: "#5c6b7a", dashed: true, points: dca.path.map((p) => ({ date: p.date, value: p.invested })) },
                  { name: "市值", color: "#d1343b", points: dca.path.map((p) => ({ date: p.date, value: p.value })) },
                ]}
              />
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
    </>
  );
}

/** 0.0300 → 0.03、0.0945 → 0.0945：保留有效位數、去掉尾端 0。 */
function feeText(v: number): string {
  return String(Number(v.toFixed(4)));
}
