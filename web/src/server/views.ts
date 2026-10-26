// 各頁的資料（網頁 loader 與 App 的 JSON API 共用同一份）。
// 跟使用者無關的部分照資料版本快取（cachedPage）；名單、定投規劃這類每個人不同的部分在快取外套上，
// 或把名單放進快取鍵，不會把甲的名單快取給乙看。
import { maxDrawdown, periodReturn, smaSeries, Series, leverageDrift, simulateDca } from "../lib/analytics.ts";
import { addDays, latestExpectedClose } from "../lib/calendar.ts";
import { importanceFor, isImportant } from "../lib/news-ai.ts";
import { viewForMembers } from "../lib/snapshot.ts";
import { ETFS, ETF_CATALOG_AS_OF, EQUAL_WEIGHT_SYMBOL, FX_SYMBOL, INDEX_SYMBOL, VIX_SYMBOL, type WatchMember } from "../lib/universe.ts";
import { MAX_WATCH, displayName, isConstituent } from "../lib/watchlist.ts";
import { z } from "zod";
import { type Viewer, getViewerSetting, settingKey, viewerWatchlist } from "./account.ts";
import { rebuildSnapshots, WATCHLIST_REBUILD_SESSIONS } from "./jobs.ts";
import { MARKET_KEY } from "./ai-batch.ts";
import { latestDigests } from "./news-ai.ts";
import { bumpDataVersion, cachedPage, readDb } from "./page-cache.ts";
import { getSnapshot, listRevisions, listSnapshotDates, loadPrices, putSetting } from "./repo.ts";
import { latestHoldings, loadTrackedMembers } from "./watchlist.ts";

export interface ViewCtx {
  env: { DB: D1Database };
  req: { query(key: string): string | undefined; url: string };
  executionCtx?: { waitUntil(p: Promise<unknown>): void };
}

/** Hono 的 c.executionCtx 在沒有執行環境時會丟錯（本機測試）：包一層，取不到就當沒有。 */
export function exec(c: ViewCtx) {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}

const cacheCtx = (c: ViewCtx) => ({ executionCtx: exec(c) });

/** 使用者的名單（第一次讀時寫入預設名單；預設名單帶進新公司時重算最近的快照）。 */
export async function membersOf(c: ViewCtx, v: Viewer): Promise<WatchMember[]> {
  const { members, needsRebuild } = await viewerWatchlist(c.env.DB, v);
  if (needsRebuild) {
    await rebuildSnapshots(c.env.DB, "新使用者的預設名單", WATCHLIST_REBUILD_SESSIONS);
    await bumpDataVersion(c.env.DB);
  }
  return members;
}

const memberKey = (members: WatchMember[]) => members.map((m) => m.tickers.join("+")).join(",");

// ── 總覽 ───────────────────────────────────────────────

/** 首頁卡片：把紀錄 detail 裡的 drawdown（p、base）攤出來；舊列沒有就是 null。detail 本身不外露。 */
function withDrawdown({ detail, ...f }: { trade_date: string; probability: number; base_rate: number; call: string; detail: string | null }) {
  let drawdown: { p: number; base: number } | null = null;
  try {
    const d = detail ? (JSON.parse(detail) as { drawdown?: { p?: unknown; base?: unknown } }).drawdown : undefined;
    if (typeof d?.p === "number" && typeof d.base === "number") drawdown = { p: d.p, base: d.base };
  } catch {
    // detail 壞掉就當沒有
  }
  return { ...f, drawdown };
}

export async function overviewView(c: ViewCtx, v: Viewer) {
  const db = readDb(c.env);
  const members = await membersOf(c, v);
  const date = c.req.query("date") || undefined;
  const rev = Number(c.req.query("rev")) || undefined;
  const today = new Date().toISOString().slice(0, 10);
  const shared = await cachedPage(cacheCtx(c), db, `index?date=${date ?? ""}&rev=${rev ?? ""}&close=${latestExpectedClose()}&today=${today}`, async () => {
    const snapshot = await getSnapshot(db, date, rev);
    const tradeDate = snapshot?.tradeDate ?? null;
    const [revisions, dates, events, lastPriceRun, forecast] = await Promise.all([
      tradeDate ? listRevisions(db, tradeDate) : Promise.resolve([]),
      listSnapshotDates(db, 400),
      db.prepare("SELECT date, kind, symbol, title, status FROM events WHERE date >= ? AND date <= ? ORDER BY date LIMIT 60").bind(today, addDays(today, 21)).all<{ date: string; kind: string; symbol: string | null; title: string; status: string }>(),
      db.prepare("SELECT status, summary, finished_at FROM runs WHERE job = 'prices' ORDER BY id DESC LIMIT 1").first<{ status: string; summary: string; finished_at: string | null }>(),
      db.prepare("SELECT trade_date, probability, base_rate, call, detail FROM forecasts ORDER BY trade_date DESC LIMIT 1").first<{ trade_date: string; probability: number; base_rate: number; call: string; detail: string | null }>(),
    ]);
    return { snapshot, revisions, dates, events: events.results, lastPriceRun, forecast: forecast ? withDrawdown(forecast) : null };
  });
  const mine = new Set(members.map((m) => m.key));
  // 新聞的 AI 欄位會在使用者點開時才補上、全站共用：不放進頁面快取（快取只在資料版本變時更新），每次讀最新的。
  const newsRows = await c.env.DB.prepare(`SELECT ${NEWS_COLS} FROM news WHERE symbols != 'SPY' ORDER BY published_at DESC, fetched_at DESC LIMIT 120`).all<NewsRow>();
  const snapshot = shared.snapshot ? { ...shared.snapshot, data: viewForMembers(shared.snapshot.data, members) } : null;
  // 「其餘」幾檔：用快照所依據那天的 SPY 持股實算。持股檔偶爾夾帶非股票列（例如 2602335D、權重近 0），含數字的代號不算。
  // 持股檔與這一天相差超過 7 天（看舊日期、權重是從後來的持股推回去的）就不寫檔數，當時的名單不一定一樣。
  const s = snapshot?.data;
  const tickers = s ? s.mag7.flatMap((m) => m.tickers) : [];
  const rest =
    s?.weights.asOf && Math.abs(Date.parse(s.weights.asOf) - Date.parse(s.tradeDate)) <= 7 * 86400000
      ? await db
          .prepare(`SELECT COUNT(*) AS n FROM weights WHERE as_of = ? AND weight_pct > 0 AND ticker NOT GLOB '*[0-9]*'${tickers.length ? ` AND ticker NOT IN (${tickers.map(() => "?").join(",")})` : ""}`)
          .bind(s.weights.asOf, ...tickers)
          .first<{ n: number }>()
      : null;
  return {
    snapshot,
    revisions: shared.revisions,
    dates: shared.dates,
    expectedClose: latestExpectedClose(),
    // 只列真的在講自己名單公司的新聞（AI 判過的照 AI；還沒判的用免費規則，見 isImportant）
    news: newsRows.results.map((n) => newsOut(n, isImportant(n, [...mine], members.flatMap((m) => m.tickers)))).filter((n) => n.important).slice(0, 5),
    events: shared.events.filter((e) => e.kind !== "earnings" || (e.symbol !== null && mine.has(e.symbol))).slice(0, 8),
    lastPriceRun: shared.lastPriceRun,
    forecast: shared.forecast,
    restCount: rest?.n ?? null,
    viewingLatest: !date,
    // 名單公司在這個交易日（或之後一天，盤後新聞）的 AI 新聞重點
    digests: s ? await latestDigests(c.env.DB, members, s.tradeDate, addDays(s.tradeDate, 1)) : [],
    market: s ? await marketDigest(c.env.DB, s.tradeDate) : null,
  };
}

/** 總覽最上面那段「今天為什麼漲跌」：排程寫在 news_digests（代號 SPX），沒寫到就不顯示。 */
async function marketDigest(db: D1Database, date: string) {
  return db.prepare("SELECT date, summary, tone FROM news_digests WHERE symbol = ? AND date = ?").bind(MARKET_KEY, date).first<{ date: string; summary: string; tone: string }>();
}

// ── 走勢 ───────────────────────────────────────────────

const RANGES = [1, 3, 6, 12, 36, 60];
const symbolLabels = (members: WatchMember[]): Record<string, string> => ({
  [INDEX_SYMBOL]: "S&P 500",
  [VIX_SYMBOL]: "VIX",
  [EQUAL_WEIGHT_SYMBOL]: "RSP 等權重",
  ...Object.fromEntries(members.map((m) => [m.key, m.company])),
  ...Object.fromEntries(ETFS.map((e) => [e.ticker, e.ticker])),
});

function annualVol(closes: number[]): number | null {
  if (closes.length < 20) return null;
  const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance * 252) * 100;
}

export async function historyView(c: ViewCtx, v: Viewer) {
  const db = readDb(c.env);
  const members = await membersOf(c, v);
  const SYMBOL_LABELS = symbolLabels(members);
  const symbol = SYMBOL_LABELS[c.req.query("symbol") ?? ""] ? (c.req.query("symbol") as string) : INDEX_SYMBOL;
  const months = RANGES.includes(Number(c.req.query("months"))) ? Number(c.req.query("months")) : 12;
  // 頁面資料依資料版本快取，見 src/server/page-cache.ts；名單放進快取鍵，每份名單各自一份。
  return cachedPage(cacheCtx(c), db, `history?symbol=${symbol}&months=${months}&members=${memberKey(members)}`, async () => {
    const last = await db.prepare("SELECT MAX(date) AS d FROM prices WHERE symbol = ?").bind(INDEX_SYMBOL).first<{ d: string | null }>();
    const end = last?.d ?? new Date().toISOString().slice(0, 10);
    const start = addDays(end, -Math.round(months * 30.44));

    // 均線先用更早的資料暖機，再截到顯示區間，避免圖的開頭均線是錯的。
    const compareSymbols = [INDEX_SYMBOL, ...members.map((m) => m.key), EQUAL_WEIGHT_SYMBOL];
    const loaded = await loadPrices(db, [...new Set([symbol, ...compareSymbols])], addDays(start, -320), end);
    const main = loaded.series[symbol];
    const sma20 = smaSeries(main.points, 20);
    const sma60 = smaSeries(main.points, 60);
    const sma200 = smaSeries(main.points, 200);
    const visible = main.points.map((p, i) => ({ ...p, sma20: sma20[i], sma60: sma60[i], sma200: sma200[i] })).filter((p) => p.date >= start);
    const step = Math.max(1, Math.floor(visible.length / 400));
    // 傳給瀏覽器的數值只留 2 位小數（價格、均線、報酬率），整頁資料量約少四成。
    const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
    const priceLine = visible
      .filter((_, i) => i % step === 0 || i === visible.length - 1)
      .map((p) => ({ date: p.date, close: r2(p.close) as number, sma20: r2(p.sma20), sma60: r2(p.sma60), sma200: r2(p.sma200) }));

    // 相對報酬比較：每條線以區間第一個交易日為 0%。
    const rebased = compareSymbols.map((s) => {
      const pts = loaded.series[s].points.filter((p) => p.date >= start);
      const base = pts[0]?.close;
      return { symbol: s, points: base ? pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => ({ date: p.date, value: r2(((p.close / base) - 1) * 100) })) : [] };
    });

    const stats = compareSymbols.map((s) => {
      const series = loaded.series[s];
      const inRange = series.points.filter((p) => p.date >= start);
      return {
        symbol: s,
        label: SYMBOL_LABELS[s],
        close: series.last()?.close ?? null,
        ret: periodReturn(series, start, end),
        mdd: maxDrawdown(inRange),
        vol: annualVol(inRange.map((p) => p.close)),
      };
    });

    // 近 40 個交易日名單貢獻（取每天最新版快照），只加總這個人名單上的公司；
    // 名單上任何一家那天沒有貢獻數字（缺價、還沒追蹤）就整天記成 null，不拿半套名單充數。
    const tickers = members.flatMap((m) => m.tickers);
    const keys = members.map((m) => m.key);
    const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",") || "NULL";
    const contrib = await db
      .prepare(
        `SELECT s.trade_date AS date,
                json_extract(s.data, '$.index.changePts') AS idx,
                (SELECT SUM(json_extract(r.value, '$.contributionPts')) FROM json_each(s.data, '$.mag7') r
                  WHERE json_extract(r.value, '$.key') IN (${placeholders(keys.length)})
                     OR EXISTS (SELECT 1 FROM json_each(r.value, '$.tickers') t WHERE t.value IN (${placeholders(tickers.length)}))) AS mag7,
                (SELECT COUNT(*) FROM json_each(s.data, '$.mag7') r
                  WHERE json_extract(r.value, '$.contributionPts') IS NOT NULL
                    AND (json_extract(r.value, '$.key') IN (${placeholders(keys.length)})
                     OR EXISTS (SELECT 1 FROM json_each(r.value, '$.tickers') t WHERE t.value IN (${placeholders(tickers.length)})))) AS n
         FROM snapshots s
         JOIN (SELECT trade_date, MAX(revision) AS r FROM snapshots GROUP BY trade_date ORDER BY trade_date DESC LIMIT 40) m
         ON s.trade_date = m.trade_date AND s.revision = m.r ORDER BY s.trade_date`,
      )
      .bind(...keys, ...tickers, ...keys, ...tickers)
      .all<{ date: string; idx: number | null; mag7: number | null; n: number }>();
    // 只在 SQL 取需要的數字，不把 40 份完整快照 JSON 拉回 Worker 解析。
    const contribution = contrib.results.map((r) => {
      const mag7 = r.n === members.length ? (r.mag7 ?? 0) : null;
      return { date: r.date, index: r.idx, mag7, rest: mag7 !== null && r.idx !== null ? r.idx - mag7 : null };
    });

    const mainStats = { ret: periodReturn(main, start, end), mdd: maxDrawdown(main.points.filter((p) => p.date >= start)), points: visible.length, first: visible[0]?.date ?? null, last: visible.at(-1)?.date ?? null };
    return { symbol, label: SYMBOL_LABELS[symbol], watch: members.map((m) => m.key), months, ranges: RANGES, symbols: Object.entries(SYMBOL_LABELS), priceLine, mainStats, rebased, stats, contribution };
  });
}

// ── ETF 與定投 ───────────────────────────────────────────

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
export const PLAN_KEY = "plan";

export const PlanSchema = z.object({
  monthlyTwd: z.number().int().min(0).max(10_000_000),
  etf: z.string().refine((t) => ETFS.some((e) => e.ticker === t), "未知的 ETF"),
  years: z.number().int().refine((n) => [1, 2, 3, 5].includes(n)),
  researchBudgetTwd: z.number().int().min(0).max(1_000_000_000),
  trancheTwd: z.number().int().min(0).max(1_000_000_000),
  exitConsiderationPct: z.number().min(0).max(100),
  notes: z.string().max(2000),
});

export async function savePlan(db: D1Database, v: Viewer, plan: Plan) {
  await putSetting(db, settingKey(v, PLAN_KEY), plan);
}

const PERIODS = [
  ["1M", 30],
  ["3M", 91],
  ["6M", 182],
  ["1Y", 365],
  ["3Y", 1096],
  ["5Y", 1826],
] as const;

export async function etfsView(c: ViewCtx, v: Viewer) {
  const db = readDb(c.env);
  // 定投規劃每人一份，存檔後要立刻看到：讀主庫，不走快取。
  const plan = await getViewerSetting<Plan>(c.env.DB, v, PLAN_KEY, DEFAULT_PLAN);
  const etf = ETFS.some((e) => e.ticker === c.req.query("etf")) ? (c.req.query("etf") as string) : plan.etf;
  const years = [1, 2, 3, 5].includes(Number(c.req.query("years"))) ? Number(c.req.query("years")) : plan.years;
  const monthlyTwd = Number(c.req.query("monthly")) > 0 ? Math.min(Number(c.req.query("monthly")), 10_000_000) : plan.monthlyTwd;
  const computed = await cachedPage(cacheCtx(c), db, `etfs?etf=${etf}&years=${years}&monthly=${monthlyTwd}`, async () => {
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

    return { asOf: end, catalogAsOf: ETF_CATALOG_AS_OF, rows, periods: PERIODS.map(([k]) => k), sim: { etf, years, monthlyTwd, startDate }, dca, fxLast };
  });
  return { ...computed, plan };
}

// ── 新聞與日曆 ───────────────────────────────────────────

/** `news` 表裡 API 與頁面會用到的欄位（primary_symbol 與 points_zh 只在伺服器內部／轉成陣列後輸出） */
export const NEWS_COLS = "id, symbols, title, url, publisher, published_at, fetched_at, primary_symbol, title_zh, tone, category, focus, points_zh, enriched_at";

export interface NewsRow {
  id: string;
  symbols: string;
  title: string;
  url: string;
  publisher: string | null;
  published_at: string | null;
  fetched_at: string;
  primary_symbol: string | null;
  title_zh: string | null;
  tone: string | null;
  category: string | null;
  /** AI 判斷這則真正在講的代號；null＝還沒加工 */
  focus: string | null;
  /** AI 重點（JSON 字串陣列）；null＝還沒產生 */
  points_zh: string | null;
  enriched_at: string | null;
}

/** 輸出給網頁與 App 的新聞：primary_symbol 不外露，points_zh 轉成陣列。 */
export function newsOut(n: NewsRow, important: boolean) {
  const { primary_symbol: _p, points_zh, enriched_at: _e, ...rest } = n;
  let points: string[] | null = null;
  try {
    points = points_zh ? (JSON.parse(points_zh) as string[]) : null;
  } catch {
    points = null;
  }
  return { ...rest, points_zh: points, important };
}

export async function newsView(c: ViewCtx, v: Viewer) {
  const db = readDb(c.env);
  const members = await membersOf(c, v);
  const keys = [...members.map((m) => m.key), "SPY"];
  const symbol = keys.includes(c.req.query("symbol") ?? "") ? (c.req.query("symbol") as string) : null;
  const today = new Date().toISOString().slice(0, 10);
  // 事件日曆是全站共用、依資料版本快取；新聞的 AI 欄位會在使用者點開時才補上，不進快取，每次讀最新的。
  const events = await cachedPage(cacheCtx(c), db, `news-events?today=${today}`, async () =>
    (
      await db
        .prepare("SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date, kind")
        .bind(addDays(today, -30), addDays(today, 120))
        .all<{ id: string; date: string; kind: string; symbol: string | null; title: string; detail: string | null; status: string; source_url: string; fetched_at: string }>()
    ).results,
  );
  // 不指定代號時只列自己名單上（與大盤 SPY）的新聞。
  const like = keys.map(() => "',' || symbols || ',' LIKE ?").join(" OR ");
  const news = symbol
    ? await c.env.DB.prepare(`SELECT ${NEWS_COLS} FROM news WHERE ',' || symbols || ',' LIKE ? ORDER BY published_at DESC, fetched_at DESC LIMIT 60`).bind(`%,${symbol},%`).all<NewsRow>()
    : await c.env.DB.prepare(`SELECT ${NEWS_COLS} FROM news WHERE ${like} ORDER BY published_at DESC, fetched_at DESC LIMIT 120`).bind(...keys.map((k) => `%,${k},%`)).all<NewsRow>();
  // 指定代號時，「重要」是這則真的在講那家公司
  const important = importanceFor(members, symbol);
  const digestMembers = symbol ? members.filter((m) => m.key === symbol) : members;
  return {
    symbol,
    keys,
    today,
    news: news.results.map((n) => newsOut(n, important(n))),
    digests: await latestDigests(c.env.DB, digestMembers, addDays(today, -3)),
    events: events.filter((e) => e.kind !== "earnings" || (e.symbol !== null && keys.includes(e.symbol))),
  };
}

// ── 觀察名單 ─────────────────────────────────────────────

// 名單頁不走頁面快取、也不讀讀取副本：內容小，而且改完要立刻看到（副本可能慢半拍）。
export async function watchlistView(c: ViewCtx, v: Viewer) {
  const db = c.env.DB;
  const [list, { asOf, holdings }, tracked] = await Promise.all([membersOf(c, v), latestHoldings(db), loadTrackedMembers(db)]);
  const weight = new Map(holdings.map((h) => [h.ticker, h.weightPct]));
  const inList = new Set(list.flatMap((m) => m.tickers));
  const trackedTickers = new Set(tracked.flatMap((m) => m.tickers));
  const members = list.map((m) => ({ ...m, weightPct: m.tickers.reduce((a, t) => a + (weight.get(t) ?? 0), 0), outOfIndex: holdings.length ? m.tickers.filter((t) => !weight.has(t)) : [] }));
  // 可加入的成分股：權重由大到小，給搜尋框的建議清單用；tracked 表示全站已經在追蹤（加入不用等抓十年日線）。
  const candidates = holdings
    .filter((h) => isConstituent(h) && !inList.has(h.ticker))
    .map((h) => ({ ticker: h.ticker, name: displayName(h.name), weightPct: Math.round(h.weightPct * 1000) / 1000, tracked: trackedTickers.has(h.ticker) }));
  const totalWeight = members.reduce((a, m) => a + m.weightPct, 0);
  return { members, candidates, asOf, totalWeight, max: MAX_WATCH };
}
