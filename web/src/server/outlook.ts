// 下月展望（跟使用者無關，整頁照資料版本快取）。網頁 loader 與 App 的 API 共用。
import { addDays } from "../lib/calendar.ts";
import { aggregateConsensus, type ViewRow } from "../lib/consensus.ts";
import { HORIZON, MIN_EFFECTIVE_N, MIN_EPISODES, buildObservations, buildOutlook, conditionalRate, type Rate, type Regime } from "../lib/forecast.ts";
import { FACTSET_EARNINGS_INSIGHT_URL, REUTERS_POLL, STRATEGIST_TARGETS, STRATEGIST_TARGETS_CHECKED, median } from "../lib/strategists.ts";
import { INDEX_SYMBOL, VIX_SYMBOL } from "../lib/universe.ts";
import type { FactsetInsight } from "../lib/sources/factset.ts";
import { FACTSET_HISTORY_KEY } from "./jobs.ts";
import { cachedPage, readDb } from "./page-cache.ts";
import { getSetting, loadPrices } from "./repo.ts";
import { type ViewCtx, exec } from "./views.ts";

const pctOf = (r: Rate | null) => (r ? { p: r.p, low: r.low, high: r.high, nEff: r.nEff, episodes: r.episodes, days: r.days } : null);

export async function outlookView(c: ViewCtx) {
  const db = readDb(c.env);
  return cachedPage({ executionCtx: exec(c) }, db, "outlook", async () => {
    const loaded = await loadPrices(db, [INDEX_SYMBOL, VIX_SYMBOL], "0000-01-01");
    const spx = loaded.series[INDEX_SYMBOL];
    const vix = loaded.series[VIX_SYMBOL];
    const outlook = buildOutlook(spx, vix);
    if (!outlook) return { outlook: null, cells: [], track: null, recent: [], consensus: null, strategists: null, factset: [] as FactsetInsight[], horizon: HORIZON, minN: MIN_EFFECTIVE_N, minEpisodes: MIN_EPISODES };

    // 各條件下的歷史上漲比例（只用今天已知的標籤）。
    const obs = buildObservations(spx, vix);
    const cond = (label: string, c: Partial<Regime>, current: boolean) => ({ label, current, rate: pctOf(conditionalRate(obs, outlook.asOf, c)) });
    const r = outlook.regime;
    const cells = [
      cond("全部（基準率）", {}, true),
      cond("站上 200 日線", { aboveSma200: true }, r.aboveSma200),
      cond("跌破 200 日線", { aboveSma200: false }, !r.aboveSma200),
      cond("VIX < 30", { vixStress: false }, !r.vixStress),
      cond("VIX ≥ 30", { vixStress: true }, r.vixStress),
      cond("站上 200 日線，VIX < 30", { aboveSma200: true, vixStress: false }, r.aboveSma200 && !r.vixStress),
      cond("站上 200 日線，VIX ≥ 30", { aboveSma200: true, vixStress: true }, r.aboveSma200 && r.vixStress),
      cond("跌破 200 日線，VIX < 30", { aboveSma200: false, vixStress: false }, !r.aboveSma200 && !r.vixStress),
      cond("跌破 200 日線，VIX ≥ 30", { aboveSma200: false, vixStress: true }, !r.aboveSma200 && r.vixStress),
    ];

    // 實際發出過的預測，21 個交易日後對帳。
    const history = await db
      .prepare("SELECT trade_date, probability, base_rate, call, close FROM forecasts ORDER BY trade_date DESC LIMIT 400")
      .all<{ trade_date: string; probability: number; base_rate: number; call: string; close: number }>();
    const idx = new Map(spx.points.map((p, i) => [p.date, i]));
    const recent = history.results.map((f) => {
      const i = idx.get(f.trade_date);
      const later = i === undefined ? undefined : spx.points[i + HORIZON];
      return { date: f.trade_date, p: f.probability, base: f.base_rate, call: f.call, close: f.close, resolvedOn: later?.date ?? null, up: later ? later.close > f.close : null };
    });
    const resolved = recent.filter((f) => f.up !== null);
    const track = resolved.length
      ? {
          n: resolved.length,
          brier: resolved.reduce((a, f) => a + (f.p - (f.up ? 1 : 0)) ** 2, 0) / resolved.length,
          brierBase: resolved.reduce((a, f) => a + (f.base - (f.up ? 1 : 0)) ** 2, 0) / resolved.length,
          upShare: resolved.filter((f) => f.up).length / resolved.length,
        }
      : null;

    // 成分股分析師共識（SPY 權重前 100 檔，7 天內更新過的）。
    const weightsRows = await db
      .prepare("SELECT ticker, weight_pct FROM weights WHERE as_of = (SELECT MAX(as_of) FROM weights)")
      .all<{ ticker: string; weight_pct: number }>();
    const weights = new Map(weightsRows.results.map((w) => [w.ticker, w.weight_pct]));
    const views = await db
      .prepare("SELECT symbol, as_of AS asOf, price, target_mean AS targetMean, buy, hold, sell, eps_up AS epsUp, eps_down AS epsDown FROM analyst_views WHERE as_of >= ?")
      .bind(addDays(outlook.asOf, -10))
      .all<ViewRow>();
    const today = new Date().toISOString().slice(0, 10);
    const consensus = views.results.length ? aggregateConsensus(views.results, weights, today) : null;
    const topViews = views.results
      .filter((v) => weights.has(v.symbol))
      .sort((a, b) => (weights.get(b.symbol) ?? 0) - (weights.get(a.symbol) ?? 0) || b.asOf.localeCompare(a.asOf))
      .filter((v, i, arr) => arr.findIndex((x) => x.symbol === v.symbol) === i)
      .slice(0, 12)
      .map((v) => ({ ...v, weightPct: weights.get(v.symbol) ?? null, upsidePct: v.price && v.targetMean ? (v.targetMean / v.price - 1) * 100 : null }));

    const factset = (await getSetting<{ items: FactsetInsight[] }>(db, FACTSET_HISTORY_KEY, { items: [] })).items.slice(0, 26);
    const targets = STRATEGIST_TARGETS.map((t) => t.target);
    const med = median(targets);
    return {
      outlook,
      cells,
      track,
      recent: recent.slice(0, 30),
      consensus: consensus
        ? { ...consensus, top: topViews, impliedIndexTarget: consensus.impliedUpsidePct === null ? null : outlook.close * (1 + consensus.impliedUpsidePct / 100) }
        : null,
      factset,
      strategists: {
        list: STRATEGIST_TARGETS,
        checked: STRATEGIST_TARGETS_CHECKED,
        median: med,
        medianUpsidePct: med ? (med / outlook.close - 1) * 100 : null,
        poll: REUTERS_POLL,
        factsetUrl: FACTSET_EARNINGS_INSIGHT_URL,
      },
      horizon: HORIZON,
      minN: MIN_EFFECTIVE_N,
      minEpisodes: MIN_EPISODES,
    };
  });
}
