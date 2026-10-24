import { addDays, latestExpectedClose, MACRO_EVENTS } from "../lib/calendar.ts";
import { type Snapshot, buildSnapshot, snapshotLoadWindow } from "../lib/snapshot.ts";
import { CBOE_SOURCE, fetchCboeDaily } from "../lib/sources/cboe.ts";
import { type EarningsDate, NASDAQ_SOURCE, fetchAnalystView, fetchEarningsCalendar, fetchEarningsDate, fetchNasdaqHistorical, fetchNasdaqNews } from "../lib/sources/nasdaq.ts";
import { nextPendingRebase } from "../lib/rebase.ts";
import { bumpDataVersion } from "./page-cache.ts";
import { fetchSpyHoldings } from "../lib/sources/ssga.ts";
import { type FactsetInsight, fetchInsight, latestInsightUrl } from "../lib/sources/factset.ts";
import { YAHOO_SOURCE, fetchYahooDaily, fetchYahooLastCloses } from "../lib/sources/yahoo.ts";
import { buildOutlook } from "../lib/forecast.ts";
import { rotationPicks } from "../lib/consensus.ts";
import { easternDate } from "../lib/calendar.ts";
import { EQUAL_WEIGHT_SYMBOL, FX_SYMBOL, INDEX_SYMBOL, MAG7, MAG7_TICKERS, NASDAQ_CHECK_SYMBOLS, VIX_SYMBOL, YAHOO_SYMBOLS } from "../lib/universe.ts";
import { type BarBatch, applyCrossChecks, finishRun, insertWeights, loadPrices, getSetting, loadWeightAnchors, nowIso, putSetting, saveSnapshots, startRun, upsertBars, weightsNear } from "./repo.ts";

export type JobName = "prices" | "crosscheck" | "weights" | "news" | "events" | "analysts" | "factset" | "forecast" | "snapshots" | "backfill-prices" | "backfill-checks";
export const JOB_NAMES: JobName[] = ["prices", "crosscheck", "weights", "news", "events", "analysts", "factset", "forecast", "snapshots", "backfill-prices", "backfill-checks"];

export interface JobOptions {
  /** 回補工作的分段序號（從 0 開始） */
  part?: number;
  /** snapshots：要重算的交易日數 */
  sessions?: number;
  /** snapshots：重算到這一天（含）為止 */
  upTo?: string;
}

interface JobResult {
  status: "ok" | "partial" | "failed";
  summary: string;
  detail: Record<string, unknown>;
}

/** settings 表裡的分割待修清單（代號 → 偵測到的比值） */
export const PENDING_REBASE_KEY = "pending_rebase";

const SNAPSHOT_SYMBOLS = [INDEX_SYMBOL, VIX_SYMBOL, EQUAL_WEIGHT_SYMBOL, ...MAG7_TICKERS];

/** 一次只跑有限並行，避免同時打太多連線給同一個來源。 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (e) {
          out[i] = { status: "rejected", reason: e };
        }
      }
    }),
  );
  return out;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * 重算 upTo（含）之前最近 sessions 個交易日的快照；內容沒變就不新增 revision。
 * 查詢次數固定（不隨天數增加），一次可以重算幾十天。
 */
export async function rebuildSnapshots(db: D1Database, reason: string, sessions = 5, upTo?: string) {
  const end = upTo ?? "9999-12-31";
  const dates = await db
    .prepare("SELECT date FROM prices WHERE symbol = ? AND date <= ? ORDER BY date DESC LIMIT ?")
    .bind(INDEX_SYMBOL, end, sessions)
    .all<{ date: string }>();
  const targets = dates.results.map((r) => r.date).reverse();
  if (!targets.length) return { built: [] as string[], created: [] as string[] };
  const anchors = await loadWeightAnchors(db, MAG7_TICKERS);
  const window = snapshotLoadWindow(targets, anchors.dates);
  const loaded = await loadPrices(db, SNAPSHOT_SYMBOLS, window.from, window.to);
  const snaps: Snapshot[] = [];
  for (const tradeDate of targets) {
    const prev = loaded.series[INDEX_SYMBOL].previous(tradeDate);
    const weights = prev ? weightsNear(anchors, prev.date) : null;
    const snap = buildSnapshot({ tradeDate, series: loaded.series, checks: loaded.checks, weights });
    if (snap) snaps.push(snap);
  }
  return { built: targets, created: await saveSnapshots(db, snaps, reason) };
}

async function fetchYahooBatch(entries: [string, string][], range: string, upTo: string) {
  const results = await mapLimit(entries, 6, async ([symbol, provider]) => {
    // 匯率也只收到「最近應已收盤」那天，避免把盤中未完成的報價存成收盤。
    const bars = (await fetchYahooDaily(provider, range)).filter((b) => b.date <= upTo);
    return { symbol, source: YAHOO_SOURCE, bars } as BarBatch;
  });
  const ok: BarBatch[] = [];
  const failed: Record<string, string> = {};
  results.forEach((r, i) => (r.status === "fulfilled" ? ok.push(r.value) : (failed[entries[i][0]] = errText(r.reason))));
  return { ok, failed };
}

async function jobPrices(db: D1Database): Promise<JobResult> {
  const expected = latestExpectedClose();
  const entries = Object.entries(YAHOO_SYMBOLS);
  const { ok, failed } = await fetchYahooBatch(entries, "1mo", expected);
  const detail: Record<string, unknown> = { expected, failed };
  // VIX 以 Cboe 為主來源；SPX 用 Cboe 交叉核對 Yahoo。
  const since = addDays(expected, -40);
  try {
    ok.push({ symbol: VIX_SYMBOL, source: CBOE_SOURCE, bars: await fetchCboeDaily("VIX", since) });
  } catch (e) {
    failed[VIX_SYMBOL] = errText(e);
  }
  // 待修清單上的代號（之前偵測到分割、但完整歷史還沒重抓成功）不寫一個月資料，避免新舊基準混用。
  const pending = await getSetting<Record<string, number>>(db, PENDING_REBASE_KEY, {});
  const { changed, rebased } = await upsertBars(db, ok.filter((b) => !(b.symbol in pending)));
  detail.changed = changed;
  // 分割後 Yahoo 改寫了整段歷史：偵測到（或還在待修清單上）就重抓這幾檔的十年日線。
  const rebasedSymbols = Object.keys({ ...pending, ...rebased });
  if (rebasedSymbols.length) {
    const full = await fetchYahooBatch(rebasedSymbols.map((s) => [s, YAHOO_SYMBOLS[s]] as [string, string]), "10y", expected);
    await upsertBars(db, full.ok, { allowRebase: true });
    const stillPending = nextPendingRebase(pending, rebased, full.ok.map((b) => b.symbol));
    await putSetting(db, PENDING_REBASE_KEY, stillPending);
    for (const [s, err] of Object.entries(full.failed)) failed[s] = `分割後重抓歷史失敗，已列入待修、下次重試：${err}`;
    detail.rebased = { factors: { ...pending, ...rebased }, refetchFailed: full.failed, pending: stillPending };
  }
  const stale = ok.filter((b) => b.symbol !== FX_SYMBOL && b.bars.at(-1)?.date !== expected).map((b) => b.symbol);
  try {
    const checked = await applyCrossChecks(db, [{ symbol: INDEX_SYMBOL, source: CBOE_SOURCE, bars: await fetchCboeDaily("SPX", since) }]);
    detail.spxMismatches = checked.filter((c) => c.status === "mismatch");
  } catch (e) {
    detail.spxCheck = errText(e);
  }
  const snaps = await rebuildSnapshots(db, "收盤資料更新");
  detail.snapshots = snaps.created;
  try {
    detail.forecast = await recordForecast(db);
  } catch (e) {
    detail.forecast = errText(e);
  }
  const failedNames = Object.keys(failed);
  const total = entries.length + 1;
  return {
    status: failedNames.length === 0 && stale.length === 0 ? "ok" : failedNames.length > total / 2 ? "failed" : "partial",
    summary: `更新 ${total - failedNames.length}/${total} 檔；失敗 ${failedNames.join(",") || "無"}；尚無 ${expected} 收盤 ${stale.join(",") || "無"}${rebasedSymbols.length ? `；偵測到分割 ${rebasedSymbols.map((s) => `${s}×${rebased[s].toFixed(3)}`).join(",")}` : ""}；新快照 ${snaps.created.join(",") || "無"}`,
    detail,
  };
}

async function crossCheckNasdaq(db: D1Database, list: typeof NASDAQ_CHECK_SYMBOLS, from: string, limit: number) {
  const results = await mapLimit(list, 4, async ({ symbol, assetClass }) => ({ symbol, source: NASDAQ_SOURCE, bars: await fetchNasdaqHistorical(symbol, assetClass, from, limit) }) as BarBatch);
  const ok: BarBatch[] = [];
  const failed: Record<string, string> = {};
  results.forEach((r, i) => (r.status === "fulfilled" ? ok.push(r.value) : (failed[list[i].symbol] = errText(r.reason))));
  const checked = await applyCrossChecks(db, ok);
  return { failed, checked, mismatches: checked.filter((c) => c.status === "mismatch") };
}

async function jobCrosscheck(db: D1Database): Promise<JobResult> {
  const { failed, checked, mismatches } = await crossCheckNasdaq(db, NASDAQ_CHECK_SYMBOLS, addDays(latestExpectedClose(), -14), 40);
  const snaps = await rebuildSnapshots(db, "Nasdaq 交叉核對");
  const failedNames = Object.keys(failed);
  const mismatched = [...new Set(mismatches.map((m) => m.symbol))];
  return {
    status: failedNames.length === 0 ? "ok" : failedNames.length === NASDAQ_CHECK_SYMBOLS.length ? "failed" : "partial",
    summary: `核對 ${NASDAQ_CHECK_SYMBOLS.length - failedNames.length} 檔、${checked.length} 筆；不一致 ${mismatched.join(",") || "無"}；失敗 ${failedNames.join(",") || "無"}`,
    detail: { failed, mismatches, snapshots: snaps.created },
  };
}

async function jobWeights(db: D1Database): Promise<JobResult> {
  const file = await fetchSpyHoldings();
  const existed = await db.prepare("SELECT COUNT(*) AS n FROM weights WHERE as_of = ?").bind(file.asOf).first<{ n: number }>();
  await insertWeights(db, file.asOf, file.holdings);
  const snaps = await rebuildSnapshots(db, `SPY 持股 ${file.asOf}`);
  const mag = MAG7_TICKERS.map((t) => `${t} ${file.holdings.find((h) => h.ticker === t)?.weightPct.toFixed(2) ?? "?"}%`);
  return {
    status: "ok",
    summary: `持股日期 ${file.asOf}（${file.holdings.length} 檔${existed?.n ? "，已存在、覆寫" : ""}）；${mag.join("、")}`,
    detail: { asOf: file.asOf, count: file.holdings.length, snapshots: snaps.created },
  };
}

// 回補分段：每段 4 檔 Yahoo 十年日線（讓 5 年報酬與 5 年定投有完整資料）；最後一段補 Cboe VIX 並用 Cboe 核對 SPX。
const BACKFILL_CHUNK = 4;
export const BACKFILL_PRICE_PARTS = Math.ceil(Object.keys(YAHOO_SYMBOLS).length / BACKFILL_CHUNK) + 1;
const CHECK_CHUNK = 5;
export const BACKFILL_CHECK_PARTS = Math.ceil(NASDAQ_CHECK_SYMBOLS.length / CHECK_CHUNK);

async function jobBackfillPrices(db: D1Database, opts: JobOptions): Promise<JobResult> {
  const part = opts.part ?? 0;
  const since = addDays(latestExpectedClose(), -3660);
  const entries = Object.entries(YAHOO_SYMBOLS);
  if (part === BACKFILL_PRICE_PARTS - 1) {
    const vix = await fetchCboeDaily("VIX", since);
    const { changed } = await upsertBars(db, [{ symbol: VIX_SYMBOL, source: CBOE_SOURCE, bars: vix }]);
    const checked = await applyCrossChecks(db, [{ symbol: INDEX_SYMBOL, source: CBOE_SOURCE, bars: await fetchCboeDaily("SPX", since) }]);
    return {
      status: "ok",
      summary: `第 ${part + 1}/${BACKFILL_PRICE_PARTS} 段：VIX ${changed[VIX_SYMBOL] ?? 0} 筆；SPX 核對 ${checked.length} 天、不一致 ${checked.filter((c) => c.status === "mismatch").length}`,
      detail: { part },
    };
  }
  const slice = entries.slice(part * BACKFILL_CHUNK, (part + 1) * BACKFILL_CHUNK);
  if (!slice.length) return { status: "failed", summary: `沒有第 ${part} 段`, detail: {} };
  const { ok, failed } = await fetchYahooBatch(slice, "10y", latestExpectedClose());
  const { changed } = await upsertBars(db, ok, { allowRebase: true });
  const failedNames = Object.keys(failed);
  return {
    status: failedNames.length === 0 ? "ok" : failedNames.length === slice.length ? "failed" : "partial",
    summary: `第 ${part + 1}/${BACKFILL_PRICE_PARTS} 段：${Object.entries(changed).map(([s, n]) => `${s} ${n}`).join("、")}；失敗 ${failedNames.join(",") || "無"}`,
    detail: { part, changed, failed },
  };
}

async function jobBackfillChecks(db: D1Database, opts: JobOptions): Promise<JobResult> {
  const part = opts.part ?? 0;
  const slice = NASDAQ_CHECK_SYMBOLS.slice(part * CHECK_CHUNK, (part + 1) * CHECK_CHUNK);
  if (!slice.length) return { status: "failed", summary: `沒有第 ${part} 段`, detail: {} };
  const { failed, checked, mismatches } = await crossCheckNasdaq(db, slice, addDays(latestExpectedClose(), -1840), 9999);
  const failedNames = Object.keys(failed);
  return {
    status: failedNames.length === 0 ? "ok" : failedNames.length === slice.length ? "failed" : "partial",
    summary: `第 ${part + 1}/${BACKFILL_CHECK_PARTS} 段：核對 ${checked.length} 筆，不一致 ${mismatches.length}；失敗 ${failedNames.join(",") || "無"}`,
    detail: { part, failed, mismatches: mismatches.slice(0, 50) },
  };
}

async function jobNews(db: D1Database): Promise<JobResult> {
  const symbols = [...MAG7.map((m) => m.key), "SPY"];
  const results = await mapLimit(symbols, 3, (s) => fetchNasdaqNews(s, 8));
  const stmt = db.prepare(
    `INSERT INTO news (id, symbols, title, url, publisher, published_at, source, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET symbols = CASE WHEN instr(news.symbols, excluded.symbols) > 0 THEN news.symbols ELSE news.symbols || ',' || excluded.symbols END`,
  );
  const stmts: D1PreparedStatement[] = [];
  const failed: string[] = [];
  const fetchedAt = nowIso();
  results.forEach((r, i) => {
    if (r.status === "rejected") return failed.push(`${symbols[i]}: ${errText(r.reason)}`);
    for (const n of r.value) stmts.push(stmt.bind(n.id, symbols[i], n.title, n.url, n.publisher, n.publishedAt, NASDAQ_SOURCE, fetchedAt));
  });
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  // 只保留 120 天，避免表無限長大。
  await db.prepare("DELETE FROM news WHERE fetched_at < ?").bind(addDays(fetchedAt.slice(0, 10), -120)).run();
  return {
    status: failed.length === 0 ? "ok" : failed.length === symbols.length ? "failed" : "partial",
    summary: `新聞 ${stmts.length} 則（${symbols.length - failed.length}/${symbols.length} 個來源）`,
    detail: { failed },
  };
}

async function jobEvents(db: D1Database): Promise<JobResult> {
  const fetchedAt = nowIso();
  const stmt = db.prepare(
    `INSERT INTO events (id, date, kind, symbol, title, detail, status, source_url, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET date = excluded.date, title = excluded.title, detail = excluded.detail, status = excluded.status, source_url = excluded.source_url, fetched_at = excluded.fetched_at`,
  );
  const stmts = MACRO_EVENTS.map((e) => stmt.bind(e.id, e.date, "macro", null, e.title, e.detail, e.status, e.sourceUrl, fetchedAt));
  // 先掃 Nasdaq 未來兩週的財報日曆（公司已排定、含盤前／盤後）；沒排進去的再用 Zacks 推估日期。
  const days: string[] = [];
  for (let d = fetchedAt.slice(0, 10); days.length < 10; d = addDays(d, 1)) {
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(d);
  }
  const keys = MAG7.map((m) => m.key);
  const calendar = await mapLimit(days, 3, (d) => fetchEarningsCalendar(d, keys));
  const byKey = new Map<string, EarningsDate>();
  const failed: string[] = [];
  calendar.forEach((r, i) => {
    if (r.status === "rejected") failed.push(`日曆 ${days[i]}: ${errText(r.reason)}`);
    else for (const e of r.value) if (!byKey.has(e.symbol)) byKey.set(e.symbol, e);
  });
  const rest = MAG7.filter((m) => !byKey.has(m.key));
  const estimates = await mapLimit(rest, 3, (m) => fetchEarningsDate(m.key));
  const unknown: string[] = [];
  estimates.forEach((r, i) => {
    if (r.status === "rejected") failed.push(`${rest[i].key}: ${errText(r.reason)}`);
    else if (r.value) byKey.set(rest[i].key, r.value);
    else unknown.push(rest[i].key);
  });
  const found: string[] = [];
  const clearFuture = db.prepare("DELETE FROM events WHERE kind = 'earnings' AND symbol = ? AND date >= ?");
  for (const m of MAG7) {
    const e = byKey.get(m.key);
    if (!e) continue;
    // 推估日期可能改到別的月份：先清掉這家公司未來的舊事件，再寫新的。
    stmts.push(clearFuture.bind(m.key, fetchedAt.slice(0, 10)));
    // 同一季只留一筆：id 用「代號＋年月」，日期改了就覆蓋。
    const id = `earnings-${m.key}-${e.date.slice(0, 7)}`;
    found.push(`${m.key} ${e.date}${e.status === "estimated" ? "（估）" : ""}`);
    stmts.push(stmt.bind(id, e.date, "earnings", m.key, `${m.company} 財報`, e.detail, e.status, e.sourceUrl, fetchedAt));
  }
  await db.batch(stmts);
  return {
    status: failed.length === 0 ? "ok" : found.length === 0 ? "failed" : "partial",
    summary: `財報日 ${found.join("、") || "無"}${unknown.length ? `；尚未公布 ${unknown.join("、")}` : ""}；FOMC ${MACRO_EVENTS.length} 場`,
    detail: { failed, unknown },
  };
}

/** 用最新收盤計算「約 21 個交易日後是否上漲」並存檔（同一天重算就覆蓋），之後拿實際結果對帳。 */
export async function recordForecast(db: D1Database) {
  const loaded = await loadPrices(db, [INDEX_SYMBOL, VIX_SYMBOL], "0000-01-01");
  const outlook = buildOutlook(loaded.series[INDEX_SYMBOL], loaded.series[VIX_SYMBOL]);
  if (!outlook) return "資料不足，未產生預測";
  await db
    .prepare(
      `INSERT INTO forecasts (trade_date, probability, base_rate, basis, call, close, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(trade_date) DO UPDATE SET probability = excluded.probability, base_rate = excluded.base_rate, basis = excluded.basis, call = excluded.call, close = excluded.close, created_at = excluded.created_at`,
    )
    .bind(outlook.asOf, outlook.pick.p, outlook.pick.base.p, outlook.pick.basis, outlook.call, outlook.close, nowIso())
    .run();
  return `${outlook.asOf} 上漲機率 ${(outlook.pick.p * 100).toFixed(1)}%（${outlook.call}）`;
}

// 目標價抓權重前 200 檔（約占指數 85% 權重），EPS 修正只抓前 100 檔：每次 16 檔約 25 個子請求。
const ANALYST_UNIVERSE = 200;
const EPS_REVISION_UNIVERSE = 100;
const ANALYST_PER_RUN = 16;
const EMPTY_VIEW = { targetMean: null, targetLow: null, targetHigh: null, buy: 0, hold: 0, sell: 0, fiscalEnd: null, epsForecast: null, epsUp: null, epsDown: null, estimates: null };

/** SPY 權重前 200 檔，每次挑最久沒更新的 16 檔抓分析師共識；股價用 Yahoo spark 一次取得。 */
async function jobAnalysts(db: D1Database): Promise<JobResult> {
  const universe = await db
    .prepare("SELECT ticker, weight_pct FROM weights WHERE as_of = (SELECT MAX(as_of) FROM weights) ORDER BY weight_pct DESC LIMIT ?")
    .bind(ANALYST_UNIVERSE)
    .all<{ ticker: string; weight_pct: number }>();
  if (!universe.results.length) return { status: "failed", summary: "還沒有 SPY 持股權重", detail: {} };
  const lastFetched = await db
    .prepare("SELECT symbol, MAX(fetched_at) AS f FROM analyst_views GROUP BY symbol")
    .all<{ symbol: string; f: string }>();
  const seen = new Map(lastFetched.results.map((r) => [r.symbol, r.f]));
  const failures = await getSetting<Record<string, string>>(db, ANALYST_FAILURES_KEY, {});
  const picks = rotationPicks(universe.results.map((u) => u.ticker), seen, failures, ANALYST_PER_RUN);
  let prices = new Map<string, { date: string; close: number }>();
  let priceError: string | null = null;
  try {
    prices = await fetchYahooLastCloses(picks);
  } catch (e) {
    priceError = errText(e);
  }
  const top = new Set(universe.results.slice(0, EPS_REVISION_UNIVERSE).map((u) => u.ticker));
  // Nasdaq 對少數成分股（例如 BRK.B）沒有分析師資料，回「No record found」：記成空結果，輪替照常前進。
  const results = await mapLimit(picks, 4, (s) =>
    fetchAnalystView(s, top.has(s)).catch((e) => {
      if (errText(e).includes("No record found")) return { ...EMPTY_VIEW, symbol: s };
      throw e;
    }),
  );
  const asOf = easternDate();
  const fetchedAt = nowIso();
  const stmt = db.prepare(
    `INSERT INTO analyst_views (symbol, as_of, price, price_date, target_mean, target_low, target_high, buy, hold, sell, fiscal_end, eps_forecast, eps_up, eps_down, estimates, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol, as_of) DO UPDATE SET price = excluded.price, price_date = excluded.price_date, target_mean = excluded.target_mean, target_low = excluded.target_low,
       target_high = excluded.target_high, buy = excluded.buy, hold = excluded.hold, sell = excluded.sell, fiscal_end = excluded.fiscal_end, eps_forecast = excluded.eps_forecast,
       eps_up = excluded.eps_up, eps_down = excluded.eps_down, estimates = excluded.estimates, fetched_at = excluded.fetched_at`,
  );
  const stmts: D1PreparedStatement[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") return failed.push(`${picks[i]}: ${errText(r.reason)}`);
    const v = r.value;
    const p = prices.get(picks[i]);
    stmts.push(stmt.bind(v.symbol, asOf, p?.close ?? null, p?.date ?? null, v.targetMean, v.targetLow, v.targetHigh, v.buy, v.hold, v.sell, v.fiscalEnd, v.epsForecast, v.epsUp, v.epsDown, v.estimates, fetchedAt));
  });
  if (stmts.length) await db.batch(stmts);
  // 失敗的代號記下時間，下一輪排到後面；只保留還在名單裡的。
  const inUniverse = new Set(universe.results.map((u) => u.ticker));
  const nextFailures: Record<string, string> = {};
  for (const [s, t] of Object.entries(failures)) if (inUniverse.has(s)) nextFailures[s] = t;
  results.forEach((r, i) => {
    if (r.status === "rejected") nextFailures[picks[i]] = fetchedAt;
    else delete nextFailures[picks[i]];
  });
  await putSetting(db, ANALYST_FAILURES_KEY, nextFailures);
  return {
    status: failed.length === 0 && !priceError ? "ok" : stmts.length === 0 ? "failed" : "partial",
    summary: `分析師共識 ${stmts.length}/${picks.length} 檔（${picks.join(",")}）；股價 ${prices.size} 檔${priceError ? `（失敗：${priceError}）` : ""}`,
    detail: { failed, priceError },
  };
}

export const FACTSET_KEY = "factset_insight";
const ANALYST_FAILURES_KEY = "analyst_failures";
export const FACTSET_HISTORY_KEY = "factset_history";

/** FactSet 週報：先看轉址到哪一期，跟上次一樣就不下載；新的一期才下載、解析、存檔（保留最近 104 期）。 */
async function jobFactset(db: D1Database): Promise<JobResult> {
  const url = await latestInsightUrl();
  const prev = await getSetting<{ latest: FactsetInsight | null }>(db, FACTSET_KEY, { latest: null });
  if (prev.latest?.pdfUrl === url) return { status: "ok", summary: `沒有新的一期（${prev.latest.reportDate}）`, detail: {} };
  const insight = await fetchInsight(url);
  const history = await getSetting<{ items: FactsetInsight[] }>(db, FACTSET_HISTORY_KEY, { items: [] });
  const items = [insight, ...history.items.filter((h) => h.pdfUrl !== insight.pdfUrl)].slice(0, 104);
  await putSetting(db, FACTSET_KEY, { latest: insight });
  await putSetting(db, FACTSET_HISTORY_KEY, { items });
  return {
    status: "ok",
    summary: `${insight.reportDate} 由下而上目標價 ${insight.bottomUpTarget}（${insight.upsidePct}%）、預估本益比 ${insight.forwardPE ?? "?"}、買進 ${insight.buyPct ?? "?"}%`,
    detail: { insight },
  };
}

const JOBS: Record<JobName, (db: D1Database, opts: JobOptions) => Promise<JobResult>> = {
  prices: jobPrices,
  crosscheck: jobCrosscheck,
  weights: jobWeights,
  news: jobNews,
  events: jobEvents,
  analysts: jobAnalysts,
  factset: jobFactset,
  forecast: async (db) => ({ status: "ok", summary: await recordForecast(db), detail: {} }),
  snapshots: async (db, opts) => {
    const sessions = Math.min(Math.max(opts.sessions ?? 30, 1), 120);
    const r = await rebuildSnapshots(db, opts.upTo ? "歷史重算" : "手動重算", sessions, opts.upTo);
    return {
      status: "ok",
      summary: `重算 ${r.built[0] ?? "—"}～${r.built.at(-1) ?? "—"} 共 ${r.built.length} 天，新 revision ${r.created.length} 筆`,
      detail: { first: r.built[0] ?? null, created: r.created.length },
    };
  },
  "backfill-prices": jobBackfillPrices,
  "backfill-checks": jobBackfillChecks,
};

/** 執行並記錄到 runs；例外也會寫成 failed，不會讓排程靜默失敗。 */
export async function runJob(db: D1Database, job: JobName, trigger: string, opts: JobOptions = {}) {
  const id = await startRun(db, job, trigger);
  try {
    const r = await JOBS[job](db, opts);
    await finishRun(db, id, r.status, r.summary, r.detail);
    await bumpDataVersion(db);
    return { id, ...r };
  } catch (e) {
    const summary = errText(e);
    await finishRun(db, id, "failed", summary, { stack: e instanceof Error ? e.stack : null });
    await bumpDataVersion(db);
    return { id, status: "failed" as const, summary, detail: {} };
  }
}
