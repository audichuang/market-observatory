import { addDays, latestExpectedClose, MACRO_EVENTS } from "../lib/calendar.ts";
import { type Snapshot, buildSnapshot, snapshotLoadWindow } from "../lib/snapshot.ts";
import { CBOE_SOURCE, fetchCboeDaily } from "../lib/sources/cboe.ts";
import { type EarningsDate, NASDAQ_SOURCE, fetchAnalystView, fetchEarningsCalendar, fetchEarningsDate, fetchNasdaqHistorical, fetchNasdaqNews } from "../lib/sources/nasdaq.ts";
import { nextPendingRebase } from "../lib/rebase.ts";
import { bumpDataVersion } from "./page-cache.ts";
import { fetchSpyHoldings } from "../lib/sources/ssga.ts";
import { type FactsetInsight, fetchInsight, latestInsightUrl } from "../lib/sources/factset.ts";
import { YAHOO_SOURCE, fetchYahooDaily, fetchYahooLastCloses, fetchYahooSpark } from "../lib/sources/yahoo.ts";
import { Budget } from "../lib/sources/http.ts";
import { type ApnsConfig, notifyClose, notifyEvents } from "./push.ts";
import { buildOutlook } from "../lib/forecast.ts";
import { rotationPicks } from "../lib/consensus.ts";
import { easternDate } from "../lib/calendar.ts";
import { EQUAL_WEIGHT_SYMBOL, FX_SYMBOL, INDEX_SYMBOL, VIX_SYMBOL, type WatchMember, nasdaqCheckSymbols, watchTickers, yahooSymbols } from "../lib/universe.ts";
import { MAX_TRACKED, addToWatchlist, removeFromWatchlist } from "../lib/watchlist.ts";
import { WATCHLIST_KEY, latestHoldings, loadTrackedMembers, loadWatchlist, updateWatchlist } from "./watchlist.ts";
import { type BarBatch, applyCrossChecks, finishRun, insertWeights, loadPrices, getSetting, loadWeightAnchors, nowIso, putSetting, saveSnapshots, startRun, upsertBars, weightsNear } from "./repo.ts";

export type JobName = "prices" | "crosscheck" | "weights" | "news" | "events" | "analysts" | "factset" | "forecast" | "snapshots" | "notify-close" | "notify-events" | "backfill-prices" | "backfill-checks";
export const JOB_NAMES: JobName[] = ["prices", "crosscheck", "weights", "news", "events", "analysts", "factset", "forecast", "snapshots", "notify-close", "notify-events", "backfill-prices", "backfill-checks"];

export interface JobOptions {
  /** 回補工作的分段序號（從 0 開始） */
  part?: number;
  /** snapshots：要重算的交易日數 */
  sessions?: number;
  /** snapshots：重算到這一天（含）為止 */
  upTo?: string;
  /** 推播工作用的 APNs 金鑰（從 env 讀，見 src/server/push.ts 的 apnsConfig）；沒設定時推播工作記成 failed */
  push?: ApnsConfig | null;
}

/**
 * 每次執行的外部請求額度（轉址每一跳、重試每一次都算）。帳號是 Workers Paid（每次執行上限預設 10,000，
 * 外部請求不計費）；名單 30 家時最多的一支排程約 90 個，這裡設 1000 只是防程式出錯無限重打。
 * 免費方案上限是 50，換回免費方案要把這裡改回 48、名單上限改回 12（見 README）。
 * 同一次排程跑多個工作時共用同一個 Budget，見 runJobs。
 */
export const SUBREQUEST_BUDGET = 1000;

interface JobResult {
  status: "ok" | "partial" | "failed";
  summary: string;
  detail: Record<string, unknown>;
}

/** settings 表裡的分割待修清單（代號 → 偵測到的比值） */
export const PENDING_REBASE_KEY = "pending_rebase";


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
  // 快照用所有使用者名單的聯集算，每個人看的時候再只取自己的（viewForMembers）。
  // 計算中名單可能被別的裝置改掉（加入／移除也會重算快照）：存檔前重讀一次，變了就用新名單重算，
  // 否則較慢的這一方會把舊名單的快照寫在最後，總覽停在舊名單直到下一次重算。
  for (let attempt = 0; ; attempt++) {
    const members = await loadTrackedMembers(db);
    const result = await computeSnapshots(db, members, sessions, upTo);
    if (attempt < 2 && JSON.stringify(await loadTrackedMembers(db)) !== JSON.stringify(members)) continue;
    return { built: result.built, created: await saveSnapshots(db, result.snaps, reason) };
  }
}

async function computeSnapshots(db: D1Database, members: WatchMember[], sessions: number, upTo?: string) {
  const tickers = watchTickers(members);
  const end = upTo ?? "9999-12-31";
  const dates = await db
    .prepare("SELECT date FROM prices WHERE symbol = ? AND date <= ? ORDER BY date DESC LIMIT ?")
    .bind(INDEX_SYMBOL, end, sessions)
    .all<{ date: string }>();
  const targets = dates.results.map((r) => r.date).reverse();
  if (!targets.length) return { built: [] as string[], snaps: [] as Snapshot[] };
  const anchors = await loadWeightAnchors(db, tickers);
  const window = snapshotLoadWindow(targets, anchors.dates);
  const loaded = await loadPrices(db, [INDEX_SYMBOL, VIX_SYMBOL, EQUAL_WEIGHT_SYMBOL, ...tickers], window.from, window.to);
  const snaps: Snapshot[] = [];
  for (const tradeDate of targets) {
    const prev = loaded.series[INDEX_SYMBOL].previous(tradeDate);
    const weights = prev ? weightsNear(anchors, prev.date) : null;
    const snap = buildSnapshot({ tradeDate, series: loaded.series, checks: loaded.checks, weights, members });
    if (snap) snaps.push(snap);
  }
  return { built: targets, snaps };
}

async function fetchYahooBatch(entries: [string, string][], range: string, upTo: string, budget: Budget) {
  const results = await mapLimit(entries, 6, async ([symbol, provider]) => {
    // 匯率也只收到「最近應已收盤」那天，避免把盤中未完成的報價存成收盤。
    const bars = (await fetchYahooDaily(provider, range, budget)).filter((b) => b.date <= upTo);
    return { symbol, source: YAHOO_SOURCE, bars } as BarBatch;
  });
  const ok: BarBatch[] = [];
  const failed: Record<string, string> = {};
  results.forEach((r, i) => (r.status === "fulfilled" ? ok.push(r.value) : (failed[entries[i][0]] = errText(r.reason))));
  return { ok, failed };
}

/**
 * 多檔近期日線：先用 spark 一次 20 檔；spark 沒回來的代號改用單檔 chart 補，但只在額度扣掉 reserve 還夠時補，
 * 補不到的列為失敗（下一次排程再抓）。名單 30 家、連 ETF 約 50 檔時平常只要 3 個請求。
 */
async function fetchRecentBars(entries: [string, string][], range: string, upTo: string, budget: Budget, reserve: number) {
  const { bars, errors } = await fetchYahooSpark(entries.map(([, p]) => p), range, budget);
  const ok: BarBatch[] = [];
  const missing: [string, string][] = [];
  for (const [symbol, provider] of entries) {
    const b = bars.get(provider);
    if (b) ok.push({ symbol, source: YAHOO_SOURCE, bars: b.filter((x) => x.date <= upTo) });
    else missing.push([symbol, provider]);
  }
  const room = Math.max(0, budget.remaining - reserve);
  const fallback = await fetchYahooBatch(missing.slice(0, room), range, upTo, budget);
  ok.push(...fallback.ok);
  const failed: Record<string, string> = { ...fallback.failed };
  for (const [s] of missing.slice(room)) failed[s] = `spark 沒有回傳${errors[0] ? `（${errors[0]}）` : ""}，請求額度不足、這次沒有逐檔補抓`;
  return { ok, failed, sparkErrors: errors, fallback: missing.slice(0, room).map(([s]) => s) };
}

async function jobPrices(db: D1Database, _opts: JobOptions, budget: Budget): Promise<JobResult> {
  const expected = latestExpectedClose();
  const symbols = yahooSymbols(await loadTrackedMembers(db));
  const entries = Object.entries(symbols);
  // 留 2 個給 Cboe 的 VIX 與 SPX。
  // VIX 以 Cboe 為主來源；SPX 用 Cboe 交叉核對 Yahoo。兩個最先抓：Yahoo 限流時逐檔補抓與重試可能把額度用光，
  // 先抓才不會連帶丟掉 VIX 與 SPX 核對（Cboe 跟 Yahoo 無關）。
  const since = addDays(expected, -40);
  let vix: BarBatch | null = null;
  let vixError: string | null = null;
  try {
    vix = { symbol: VIX_SYMBOL, source: CBOE_SOURCE, bars: await fetchCboeDaily("VIX", since, budget) };
  } catch (e) {
    vixError = errText(e);
  }
  let spx: BarBatch | null = null;
  let spxError: string | null = null;
  try {
    spx = { symbol: INDEX_SYMBOL, source: CBOE_SOURCE, bars: await fetchCboeDaily("SPX", since, budget) };
  } catch (e) {
    spxError = errText(e);
  }
  const { ok, failed, sparkErrors, fallback } = await fetchRecentBars(entries, "1mo", expected, budget, 0);
  if (vix) ok.push(vix);
  if (vixError) failed[VIX_SYMBOL] = vixError;
  const detail: Record<string, unknown> = { expected, failed, sparkErrors, fallback };
  if (spxError) detail.spxCheck = spxError;
  // 待修清單上的代號（之前偵測到分割、但完整歷史還沒重抓成功）不寫一個月資料，避免新舊基準混用。
  // 已從名單移除的代號不再追（之前偵測到分割、還沒重抓成功的也一樣）。
  const pending = Object.fromEntries(Object.entries(await getSetting<Record<string, number>>(db, PENDING_REBASE_KEY, {})).filter(([s]) => s in symbols));
  const { changed, rebased } = await upsertBars(db, ok.filter((b) => !(b.symbol in pending)));
  detail.changed = changed;
  // 分割後 Yahoo 改寫了整段歷史：偵測到（或還在待修清單上）就重抓這幾檔的十年日線。
  // 額度只夠重抓一部分時，其餘留在待修清單，下一次排程接著重抓。
  const rebasedSymbols = Object.keys({ ...pending, ...rebased }).filter((s) => s in symbols);
  if (rebasedSymbols.length) {
    const now = rebasedSymbols.slice(0, budget.remaining);
    const full = await fetchYahooBatch(now.map((s) => [s, symbols[s]] as [string, string]), "10y", expected, budget);
    await upsertBars(db, full.ok, { allowRebase: true });
    const stillPending = nextPendingRebase(pending, rebased, full.ok.map((b) => b.symbol));
    await putSetting(db, PENDING_REBASE_KEY, stillPending);
    for (const [s, err] of Object.entries(full.failed)) failed[s] = `分割後重抓歷史失敗，已列入待修、下次重試：${err}`;
    for (const s of rebasedSymbols.slice(now.length)) failed[s] = "分割後要重抓歷史，這次請求額度不足，已列入待修、下次重試";
    detail.rebased = { factors: { ...pending, ...rebased }, refetchFailed: full.failed, pending: stillPending };
  }
  const stale = ok.filter((b) => b.symbol !== FX_SYMBOL && b.bars.at(-1)?.date !== expected).map((b) => b.symbol);
  if (spx) {
    const checked = await applyCrossChecks(db, [spx]);
    detail.spxMismatches = checked.filter((c) => c.status === "mismatch");
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
    summary: `更新 ${total - failedNames.length}/${total} 檔；失敗 ${failedNames.join(",") || "無"}；尚無 ${expected} 收盤 ${stale.join(",") || "無"}${rebasedSymbols.length ? `；偵測到分割 ${rebasedSymbols.map((s) => `${s}×${({ ...pending, ...rebased })[s].toFixed(3)}`).join(",")}` : ""}；新快照 ${snaps.created.join(",") || "無"}`,
    detail,
  };
}

async function crossCheckNasdaq(db: D1Database, list: ReturnType<typeof nasdaqCheckSymbols>, from: string, limit: number, budget: Budget) {
  const results = await mapLimit(list, 4, async ({ symbol, assetClass }) => ({ symbol, source: NASDAQ_SOURCE, bars: await fetchNasdaqHistorical(symbol, assetClass, from, limit, budget) }) as BarBatch);
  const ok: BarBatch[] = [];
  const failed: Record<string, string> = {};
  results.forEach((r, i) => (r.status === "fulfilled" ? ok.push(r.value) : (failed[list[i].symbol] = errText(r.reason))));
  const checked = await applyCrossChecks(db, ok);
  return { failed, checked, mismatches: checked.filter((c) => c.status === "mismatch") };
}

/** 逐檔請求的工作留給 429 重試的額度：沒留的話，一次重試就會讓排在最後的那檔因額度用完而失敗。 */
const RETRY_RESERVE = 2;

async function jobCrosscheck(db: D1Database, _opts: JobOptions, budget: Budget): Promise<JobResult> {
  // Nasdaq 沒有批次查詢，一檔一個請求。額度不夠時先核對名單上的個股，ETF 排後面（下一次核對排程會補）。
  const full = nasdaqCheckSymbols(await loadTrackedMembers(db));
  const list = full.slice(0, Math.max(0, budget.remaining - RETRY_RESERVE));
  const skipped = full.slice(list.length).map((s) => s.symbol);
  const { failed, checked, mismatches } = await crossCheckNasdaq(db, list, addDays(latestExpectedClose(), -14), 40, budget);
  const snaps = await rebuildSnapshots(db, "Nasdaq 交叉核對");
  const failedNames = Object.keys(failed);
  const mismatched = [...new Set(mismatches.map((m) => m.symbol))];
  return {
    status: failedNames.length === 0 && skipped.length === 0 ? "ok" : failedNames.length === list.length ? "failed" : "partial",
    summary: `核對 ${list.length - failedNames.length} 檔、${checked.length} 筆；不一致 ${mismatched.join(",") || "無"}；失敗 ${failedNames.join(",") || "無"}${skipped.length ? `；請求額度不足、這次略過 ${skipped.join(",")}` : ""}`,
    detail: { failed, mismatches, snapshots: snaps.created, skipped },
  };
}

async function jobWeights(db: D1Database, _opts: JobOptions, budget: Budget): Promise<JobResult> {
  const file = await fetchSpyHoldings(budget);
  const existed = await db.prepare("SELECT COUNT(*) AS n FROM weights WHERE as_of = ?").bind(file.asOf).first<{ n: number }>();
  await insertWeights(db, file.asOf, file.holdings);
  const snaps = await rebuildSnapshots(db, `SPY 持股 ${file.asOf}`);
  const mag = watchTickers(await loadTrackedMembers(db)).map((t) => `${t} ${file.holdings.find((h) => h.ticker === t)?.weightPct.toFixed(2) ?? "?"}%`);
  return {
    status: "ok",
    summary: `持股日期 ${file.asOf}（${file.holdings.length} 檔${existed?.n ? "，已存在、覆寫" : ""}）；${mag.join("、")}`,
    detail: { asOf: file.asOf, count: file.holdings.length, snapshots: snaps.created },
  };
}

// 回補分段：每段 4 檔 Yahoo 十年日線（讓 5 年報酬與 5 年定投有完整資料）；最後一段補 Cboe VIX 並用 Cboe 核對 SPX。
const BACKFILL_CHUNK = 4;
const CHECK_CHUNK = 5;

async function jobBackfillPrices(db: D1Database, opts: JobOptions, budget: Budget): Promise<JobResult> {
  const part = opts.part ?? 0;
  const since = addDays(latestExpectedClose(), -3660);
  const entries = Object.entries(yahooSymbols(await loadTrackedMembers(db)));
  // 段數跟著名單長度變：每段 4 檔，最後一段補 VIX／SPX。
  const BACKFILL_PRICE_PARTS = Math.ceil(entries.length / BACKFILL_CHUNK) + 1;
  if (part === BACKFILL_PRICE_PARTS - 1) {
    const vix = await fetchCboeDaily("VIX", since, budget);
    const { changed } = await upsertBars(db, [{ symbol: VIX_SYMBOL, source: CBOE_SOURCE, bars: vix }]);
    const checked = await applyCrossChecks(db, [{ symbol: INDEX_SYMBOL, source: CBOE_SOURCE, bars: await fetchCboeDaily("SPX", since, budget) }]);
    return {
      status: "ok",
      summary: `第 ${part + 1}/${BACKFILL_PRICE_PARTS} 段：VIX ${changed[VIX_SYMBOL] ?? 0} 筆；SPX 核對 ${checked.length} 天、不一致 ${checked.filter((c) => c.status === "mismatch").length}`,
      detail: { part },
    };
  }
  const slice = entries.slice(part * BACKFILL_CHUNK, (part + 1) * BACKFILL_CHUNK);
  if (!slice.length) return { status: "failed", summary: `沒有第 ${part} 段`, detail: {} };
  const { ok, failed } = await fetchYahooBatch(slice, "10y", latestExpectedClose(), budget);
  const { changed } = await upsertBars(db, ok, { allowRebase: true });
  const failedNames = Object.keys(failed);
  return {
    status: failedNames.length === 0 ? "ok" : failedNames.length === slice.length ? "failed" : "partial",
    summary: `第 ${part + 1}/${BACKFILL_PRICE_PARTS} 段：${Object.entries(changed).map(([s, n]) => `${s} ${n}`).join("、")}；失敗 ${failedNames.join(",") || "無"}`,
    detail: { part, changed, failed },
  };
}

async function jobBackfillChecks(db: D1Database, opts: JobOptions, budget: Budget): Promise<JobResult> {
  const part = opts.part ?? 0;
  const list = nasdaqCheckSymbols(await loadTrackedMembers(db));
  const BACKFILL_CHECK_PARTS = Math.ceil(list.length / CHECK_CHUNK);
  const slice = list.slice(part * CHECK_CHUNK, (part + 1) * CHECK_CHUNK);
  if (!slice.length) return { status: "failed", summary: `沒有第 ${part} 段`, detail: {} };
  const { failed, checked, mismatches } = await crossCheckNasdaq(db, slice, addDays(latestExpectedClose(), -1840), 9999, budget);
  const failedNames = Object.keys(failed);
  return {
    status: failedNames.length === 0 ? "ok" : failedNames.length === slice.length ? "failed" : "partial",
    summary: `第 ${part + 1}/${BACKFILL_CHECK_PARTS} 段：核對 ${checked.length} 筆，不一致 ${mismatches.length}；失敗 ${failedNames.join(",") || "無"}`,
    detail: { part, failed, mismatches: mismatches.slice(0, 50) },
  };
}

async function jobNews(db: D1Database, _opts: JobOptions, budget: Budget): Promise<JobResult> {
  // 一家一個請求；額度不夠時大盤（SPY）優先，名單照順序取到額度為止，其餘下一輪（4 小時後）再抓。
  const all = ["SPY", ...(await loadTrackedMembers(db)).map((m) => m.key)];
  const symbols = all.slice(0, Math.max(0, budget.remaining - RETRY_RESERVE));
  const skipped = all.slice(symbols.length);
  const results = await mapLimit(symbols, 3, (s) => fetchNasdaqNews(s, 8, budget));
  const stmt = db.prepare(
    `INSERT INTO news (id, symbols, title, url, publisher, published_at, source, fetched_at, summary, primary_symbol) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET symbols = CASE WHEN instr(news.symbols, excluded.symbols) > 0 THEN news.symbols ELSE news.symbols || ',' || excluded.symbols END,
       summary = COALESCE(news.summary, excluded.summary), primary_symbol = COALESCE(news.primary_symbol, excluded.primary_symbol),
       -- 多掛了一個代號：AI 要重新判斷這則在講誰
       enriched_at = CASE WHEN instr(news.symbols, excluded.symbols) > 0 THEN news.enriched_at ELSE NULL END`,
  );
  const stmts: D1PreparedStatement[] = [];
  const failed: string[] = [];
  const fetchedAt = nowIso();
  results.forEach((r, i) => {
    if (r.status === "rejected") return failed.push(`${symbols[i]}: ${errText(r.reason)}`);
    for (const n of r.value) stmts.push(stmt.bind(n.id, symbols[i], n.title, n.url, n.publisher, n.publishedAt, NASDAQ_SOURCE, fetchedAt, n.summary, n.primarySymbol));
  });
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  // 只保留 120 天，避免表無限長大。
  await db.prepare("DELETE FROM news WHERE fetched_at < ?").bind(addDays(fetchedAt.slice(0, 10), -120)).run();
  return {
    status: failed.length === 0 && skipped.length === 0 ? "ok" : failed.length === symbols.length ? "failed" : "partial",
    summary: `新聞 ${stmts.length} 則（${symbols.length - failed.length}/${all.length} 個來源）${skipped.length ? `；請求額度不足、這次略過 ${skipped.join(",")}` : ""}`,
    detail: { failed, skipped },
  };
}

async function jobEvents(db: D1Database, _opts: JobOptions, budget: Budget): Promise<JobResult> {
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
  const members = await loadTrackedMembers(db);
  const keys = members.map((m) => m.key);
  const calendar = await mapLimit(days, 3, (d) => fetchEarningsCalendar(d, keys, budget));
  const byKey = new Map<string, EarningsDate>();
  const failed: string[] = [];
  calendar.forEach((r, i) => {
    if (r.status === "rejected") failed.push(`日曆 ${days[i]}: ${errText(r.reason)}`);
    else for (const e of r.value) if (!byKey.has(e.symbol)) byKey.set(e.symbol, e);
  });
  // 日曆上沒有的才逐家查推估日期；額度不夠的這次略過，保留上次寫入的日期。
  const missing = members.filter((m) => !byKey.has(m.key));
  const rest = missing.slice(0, Math.max(0, budget.remaining - RETRY_RESERVE));
  const skipped = missing.slice(rest.length).map((m) => m.key);
  const estimates = await mapLimit(rest, 3, (m) => fetchEarningsDate(m.key, budget));
  const unknown: string[] = [];
  estimates.forEach((r, i) => {
    if (r.status === "rejected") failed.push(`${rest[i].key}: ${errText(r.reason)}`);
    else if (r.value) byKey.set(rest[i].key, r.value);
    else unknown.push(rest[i].key);
  });
  const found: string[] = [];
  const clearFuture = db.prepare("DELETE FROM events WHERE kind = 'earnings' AND symbol = ? AND date >= ?");
  for (const m of members) {
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
    summary: `財報日 ${found.join("、") || "無"}${unknown.length ? `；尚未公布 ${unknown.join("、")}` : ""}${skipped.length ? `；請求額度不足、這次略過 ${skipped.join("、")}` : ""}；FOMC ${MACRO_EVENTS.length} 場`,
    detail: { failed, unknown, skipped },
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
async function jobAnalysts(db: D1Database, _opts: JobOptions, budget: Budget): Promise<JobResult> {
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
  const top = new Set(universe.results.slice(0, EPS_REVISION_UNIVERSE).map((u) => u.ticker));
  // 前 100 檔每檔 2 個請求（目標價＋EPS 修正）、其餘 1 個，另加 1 個 spark 取股價。
  // 跟新聞同一次排程：新聞用掉的多，這次就少抓幾檔，輪替自然往後順延。
  const picks = analystPicksWithin(rotationPicks(universe.results.map((u) => u.ticker), seen, failures, ANALYST_PER_RUN), top, budget.remaining - 1 - RETRY_RESERVE);
  if (!picks.length) return { status: "partial", summary: "請求額度不足，這次沒有抓分析師共識", detail: { remaining: budget.remaining } };
  let prices = new Map<string, { date: string; close: number }>();
  let priceError: string | null = null;
  try {
    prices = await fetchYahooLastCloses(picks, budget);
  } catch (e) {
    priceError = errText(e);
  }
  // Nasdaq 對少數成分股（例如 BRK.B）沒有分析師資料，回「No record found」：記成空結果，輪替照常前進。
  // 每檔同時打 2 個請求（目標價＋EPS 修正），3 檔並行＝同時 6 個，剛好是 Cloudflare 每次執行的同時連線上限。
  const results = await mapLimit(picks, 3, (s) =>
    fetchAnalystView(s, top.has(s), budget).catch((e) => {
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

/** 依序取輪替名單，直到請求數用到 room 為止（前 100 檔一檔 2 個請求、其餘 1 個）。 */
export function analystPicksWithin(candidates: string[], top: Set<string>, room: number): string[] {
  const out: string[] = [];
  let cost = 0;
  for (const s of candidates) {
    const c = top.has(s) ? 2 : 1;
    if (cost + c > room) break;
    cost += c;
    out.push(s);
  }
  return out;
}

export const FACTSET_KEY = "factset_insight";
const ANALYST_FAILURES_KEY = "analyst_failures";
export const FACTSET_HISTORY_KEY = "factset_history";

/** FactSet 週報：先看轉址到哪一期，跟上次一樣就不下載；新的一期才下載、解析、存檔（保留最近 104 期）。 */
async function jobFactset(db: D1Database, _opts: JobOptions, budget: Budget): Promise<JobResult> {
  const url = await latestInsightUrl(budget);
  const prev = await getSetting<{ latest: FactsetInsight | null }>(db, FACTSET_KEY, { latest: null });
  if (prev.latest?.pdfUrl === url) return { status: "ok", summary: `沒有新的一期（${prev.latest.reportDate}）`, detail: {} };
  const insight = await fetchInsight(url, budget);
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

const JOBS: Record<JobName, (db: D1Database, opts: JobOptions, budget: Budget) => Promise<JobResult>> = {
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
  "notify-close": (db, opts, budget) => notifyClose(db, opts.push ?? null, budget),
  "notify-events": (db, opts, budget) => notifyEvents(db, opts.push ?? null, budget),
  "backfill-prices": jobBackfillPrices,
  "backfill-checks": jobBackfillChecks,
};

/**
 * 執行並記錄到 runs；例外也會寫成 failed，不會讓排程靜默失敗。
 * budget 是這次執行（整個排程或整個 HTTP 請求）的外部請求額度：同一次執行跑多個工作要傳同一個（用 runJobs）。
 * 每個工作實際用掉幾個請求記在 detail.subrequests，正式站可以直接查 runs 表驗證。
 */
export async function runJob(db: D1Database, job: JobName, trigger: string, opts: JobOptions = {}, budget = new Budget(SUBREQUEST_BUDGET)) {
  const id = await startRun(db, job, trigger);
  const before = budget.used;
  const usage = () => ({ subrequests: budget.used - before, budgetLeft: budget.remaining });
  try {
    const r = await JOBS[job](db, opts, budget);
    const detail = { ...r.detail, ...usage() };
    await finishRun(db, id, r.status, r.summary, detail);
    await bumpDataVersion(db);
    return { id, ...r, detail };
  } catch (e) {
    const summary = errText(e);
    const detail = { stack: e instanceof Error ? e.stack : null, ...usage() };
    await finishRun(db, id, "failed", summary, detail);
    await bumpDataVersion(db);
    return { id, status: "failed" as const, summary, detail };
  }
}

/**
 * 每支排程在一次執行裡依序跑的工作（crons/*.ts 與手動觸發 /api/admin/cron 共用這份定義，
 * 正式站手動跑一次＝排程跑一次：同樣的工作、同樣共用一份請求額度）。
 */
export const SCHEDULES = {
  // 收盤推播跟在抓價後面：當天收盤沒抓到就不發，隔天清晨的補抓（retry）抓到後再發（push_log 去重，不會發兩次）。
  prices: ["prices", "notify-close"],
  crosscheck: ["crosscheck"],
  retry: ["prices", "crosscheck", "notify-close"],
  // 事件提醒在美東早上（UTC 11:30 = 台灣晚上 7:30）：當天的財報日剛更新完。
  "daily-reference": ["weights", "events", "factset", "notify-events"],
  // 抓完新聞就翻譯、分類、寫各家重點（Workers AI），再輪替抓分析師共識。
  news: ["news", "analysts"],
} as const satisfies Record<string, readonly JobName[]>;
export type ScheduleName = keyof typeof SCHEDULES;

/** 一次排程依序跑幾個工作，共用同一個外部請求額度（前面用多少，後面就只剩多少）。 */
export async function runJobs(db: D1Database, trigger: string, jobs: readonly JobName[], budget = new Budget(SUBREQUEST_BUDGET), opts: JobOptions = {}) {
  const out = [];
  for (const job of jobs) out.push(await runJob(db, job, trigger, opts, budget));
  return out;
}

// ── 觀察名單變更 ───────────────────────────────────────────────

/** 名單變更後重算的交易日數：總覽讀最新一天、走勢頁的貢獻圖讀最近 40 天。更早的快照保留當時的名單。 */
export const WATCHLIST_REBUILD_SESSIONS = 45;

export type WatchChange = { ok: true; summary: string } | { ok: false; error: string };

/**
 * 把一家公司加進某個使用者的名單（listKey，預設是擁有者的）。
 * 全站沒人追蹤過的公司先抓十年日線（新代號在資料庫裡一筆都沒有，沒有價格就算不出權重與貢獻），
 * 抓不到就整個不加，不留半套；別人名單上已經有的公司價格本來就在更新，直接加入。
 * 全站追蹤的公司數到 MAX_TRACKED 時，只能加別人已經在追蹤的公司。
 */
export async function addWatchSymbol(db: D1Database, input: string, budget = new Budget(SUBREQUEST_BUDGET), listKey = WATCHLIST_KEY): Promise<WatchChange> {
  const list = await loadWatchlist(db, listKey);
  const { holdings } = await latestHoldings(db);
  const res = addToWatchlist(list, input, holdings);
  if (!res.ok) return res;
  const { member } = res;
  const tracked = await loadTrackedMembers(db);
  const trackedTickers = new Set(watchTickers(tracked));
  const isNew = member.tickers.some((t) => !trackedTickers.has(t));
  if (isNew && tracked.length >= MAX_TRACKED) return { ok: false, error: `全站追蹤的公司已達 ${MAX_TRACKED} 家上限，目前只能加入其他人已在追蹤的公司` };
  let summary = `已加入 ${member.company}（${member.tickers.join("＋")}）`;
  if (isNew) {
    const expected = latestExpectedClose();
    const { ok, failed } = await fetchYahooBatch(member.tickers.map((t) => [t, t] as [string, string]), "10y", expected, budget);
    const failedNames = Object.keys(failed);
    if (failedNames.length) return { ok: false, error: `抓不到 ${failedNames.join(",")} 的歷史股價（${Object.values(failed)[0]}），稍後再試` };
    await upsertBars(db, ok, { allowRebase: true });
    // Nasdaq 核對最近兩個月；失敗不擋（之後的排程會再核對）。
    await crossCheckNasdaq(db, member.tickers.map((t) => ({ symbol: t, assetClass: "stocks" as const })), addDays(expected, -60), 60, budget).catch(() => null);
    summary += `，補了 ${ok.reduce((a, b) => a + b.bars.length, 0)} 筆日線`;
  }
  // 抓價花了幾秒，這段時間名單可能被別的裝置改過：存檔時重讀、重新套用。
  const saved = await updateWatchlist(
    db,
    (current) => {
      const again = addToWatchlist(current, input, holdings);
      return again.ok ? again.list : again.error;
    },
    listKey,
  );
  if (!saved.ok) return saved;
  if (isNew) await rebuildSnapshots(db, `觀察名單加入 ${member.company}`, WATCHLIST_REBUILD_SESSIONS);
  await bumpDataVersion(db);
  return { ok: true, summary };
}

export async function removeWatchSymbol(db: D1Database, key: string, listKey = WATCHLIST_KEY): Promise<WatchChange> {
  const target = (await loadWatchlist(db, listKey)).find((m) => m.key === key);
  if (!target) return { ok: false, error: `${key} 不在名單裡` };
  const saved = await updateWatchlist(db, (current) => (current.some((m) => m.key === key) ? removeFromWatchlist(current, key) : `${key} 已經不在名單裡`), listKey);
  if (!saved.ok) return saved;
  // 還有別人在追蹤就不動快照與事件；沒人追蹤了才停止更新財報日、重算快照。
  if (!(await loadTrackedMembers(db)).some((m) => m.key === key)) {
    // 移除的公司不再更新財報日：清掉它未來的事件，總覽與日曆才不會留著過時的日期。
    await db.prepare("DELETE FROM events WHERE kind = 'earnings' AND symbol = ? AND date >= ?").bind(key, easternDate()).run();
    await rebuildSnapshots(db, `觀察名單移除 ${target.company}`, WATCHLIST_REBUILD_SESSIONS);
  }
  await bumpDataVersion(db);
  return { ok: true, summary: `已移除 ${target.company}` };
}
