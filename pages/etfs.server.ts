import { defineHandler, defineHead, type InferProps } from "void";
import { z } from "zod";
import { Series, leverageDrift, periodReturn, simulateDca } from "../src/lib/analytics.ts";
import { addDays } from "../src/lib/calendar.ts";
import { ETFS, ETF_CATALOG_AS_OF, FX_SYMBOL, INDEX_SYMBOL } from "../src/lib/universe.ts";
import { getSetting, loadPrices, putSetting } from "../src/server/repo.ts";

export type Props = InferProps<typeof loader>;

export const DEFAULT_PLAN = {
  monthlyTwd: 10000,
  etf: "VOO",
  years: 3,
  researchBudgetTwd: 200000,
  trancheTwd: 50000,
  exitConsiderationPct: 20,
  notes: "待定：交易券商與手續費、換匯成本、槓桿 ETF 持有期限、整體停手門檻、分批間距與再進場規則",
};
export type Plan = typeof DEFAULT_PLAN;

const PERIODS = [
  ["1M", 30],
  ["3M", 91],
  ["6M", 182],
  ["1Y", 365],
  ["3Y", 1096],
  ["5Y", 1826],
] as const;

export const loader = defineHandler(async (c) => {
  const db = c.env.DB;
  const plan = await getSetting<Plan>(db, "plan", DEFAULT_PLAN);
  const etf = ETFS.some((e) => e.ticker === c.req.query("etf")) ? (c.req.query("etf") as string) : plan.etf;
  const years = [1, 2, 3, 5].includes(Number(c.req.query("years"))) ? Number(c.req.query("years")) : plan.years;
  const monthlyTwd = Number(c.req.query("monthly")) > 0 ? Math.min(Number(c.req.query("monthly")), 10_000_000) : plan.monthlyTwd;

  const last = await db.prepare("SELECT MAX(date) AS d FROM prices WHERE symbol = ?").bind(INDEX_SYMBOL).first<{ d: string | null }>();
  const end = last?.d ?? new Date().toISOString().slice(0, 10);
  const loaded = await loadPrices(db, [INDEX_SYMBOL, FX_SYMBOL, ...ETFS.map((e) => e.ticker)], addDays(end, -1900), end);
  const spx = loaded.series[INDEX_SYMBOL];
  const ytdStart = `${Number(end.slice(0, 4)) - 1}-12-31`;

  const rows = ETFS.map((e) => {
    const s = loaded.series[e.ticker];
    const lastPt = s.last();
    const returns = Object.fromEntries(PERIODS.map(([k, d]) => [k, s.length && s.points[0].date <= addDays(end, -d) ? periodReturn(s, addDays(end, -d), end) : null]));
    const drift1y = e.multiple === 1 ? null : leverageDrift(s, spx, e.multiple, addDays(end, -365), end);
    return { ...e, close: lastPt?.close ?? null, lastDate: lastPt?.date ?? null, ytd: periodReturn(s, ytdStart, end), returns, drift1y };
  });

  // 定投試算：價格換成台幣計價（每天用當天或之前最近的 USD/TWD），每月第一個交易日投入固定台幣。
  const fx = loaded.series[FX_SYMBOL];
  const price = loaded.series[etf];
  const twdPoints = price.points
    .map((p) => {
      const rate = fx.onOrBefore(p.date)?.close;
      return rate ? { date: p.date, close: p.close * rate } : null;
    })
    .filter((p): p is { date: string; close: number } => p !== null);
  const startDate = addDays(end, -Math.round(years * 365.25));
  const dcaRaw = price.points[0] && price.points[0].date <= addDays(startDate, 7) ? simulateDca(new Series(twdPoints), startDate, monthlyTwd) : null;
  const step = dcaRaw ? Math.max(1, Math.floor(dcaRaw.path.length / 300)) : 1;
  const dca = dcaRaw ? { ...dcaRaw, path: dcaRaw.path.filter((_, i) => i % step === 0 || i === dcaRaw.path.length - 1) } : null;
  const fxLast = fx.last();

  return { asOf: end, catalogAsOf: ETF_CATALOG_AS_OF, rows, periods: PERIODS.map(([k]) => k), plan, sim: { etf, years, monthlyTwd, startDate }, dca, fxLast };
});

const PlanSchema = z.object({
  monthlyTwd: z.number().int().min(0).max(10_000_000),
  etf: z.string().refine((t) => ETFS.some((e) => e.ticker === t), "未知的 ETF"),
  years: z.number().int().refine((n) => [1, 2, 3, 5].includes(n)),
  researchBudgetTwd: z.number().int().min(0).max(1_000_000_000),
  trancheTwd: z.number().int().min(0).max(1_000_000_000),
  exitConsiderationPct: z.number().min(0).max(100),
  notes: z.string().max(2000),
});

export const action = defineHandler.withValidator({ body: PlanSchema })(async (c, { body }) => {
  await putSetting(c.env.DB, "plan", body);
});

export const head = defineHead(() => ({ title: "ETF 與定投" }));
