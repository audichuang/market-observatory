import { Series } from "../lib/analytics.ts";
import type { PriceCheck, Snapshot } from "../lib/snapshot.ts";
import { detectRebase } from "../lib/rebase.ts";
import type { DailyBar } from "../lib/sources/http.ts";

// 直接用 D1 prepared statement：批次寫入比 ORM 快，也不會撞到單一查詢參數上限。

/** D1 主庫或讀取 session（withSession）都可以：這裡只用得到 prepare 與 batch。 */
export type Db = Pick<D1Database, "prepare" | "batch">;

export const nowIso = () => new Date().toISOString();

const CHUNK = 200;

async function batchRun(db: Db, stmts: D1PreparedStatement[]) {
  for (let i = 0; i < stmts.length; i += CHUNK) await db.batch(stmts.slice(i, i + CHUNK));
}

export interface BarBatch {
  symbol: string;
  source: string;
  bars: DailyBar[];
}

// 免費方案每次呼叫的 D1 查詢與子請求有上限：多檔標的一律「一次查詢＋分塊 batch」，不逐檔來回。

/**
 * 寫入主來源日線；收盤價改變時清掉舊的交叉核對結果。
 * 回傳每檔新增或收盤有變的日期數，以及偵測到歷史基準被改寫（分割）的代號與比值。
 * 偵測到分割的代號這次「不寫入」：只寫一個月會新舊基準混用，而且寫了之後下一輪就再也偵測不到。
 * 呼叫端重抓完整歷史後，用 allowRebase 整段寫入。
 */
export async function upsertBars(
  db: Db,
  items: BarBatch[],
  opts: { allowRebase?: boolean; fetchedAt?: string } = {},
): Promise<{ changed: Record<string, number>; rebased: Record<string, number> }> {
  const fetchedAt = opts.fetchedAt ?? nowIso();
  const withBars = items.filter((i) => i.bars.length);
  if (!withBars.length) return { changed: {}, rebased: {} };
  const minDate = withBars.reduce((m, i) => (i.bars[0].date < m ? i.bars[0].date : m), "9999-12-31");
  const symbols = withBars.map((i) => i.symbol);
  const rows = await db
    .prepare(`SELECT symbol, date, close FROM prices WHERE symbol IN (${symbols.map(() => "?").join(",")}) AND date >= ?`)
    .bind(...symbols, minDate)
    .all<{ symbol: string; date: string; close: number }>();
  const existing = new Map(rows.results.map((r) => [`${r.symbol}|${r.date}`, r.close]));
  const stmt = db.prepare(
    `INSERT INTO prices (symbol, date, open, high, low, close, volume, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol, date) DO UPDATE SET
       open = COALESCE(excluded.open, prices.open), high = COALESCE(excluded.high, prices.high),
       low = COALESCE(excluded.low, prices.low), volume = COALESCE(excluded.volume, prices.volume),
       source = excluded.source, fetched_at = excluded.fetched_at,
       check_status = CASE WHEN prices.close = excluded.close THEN prices.check_status ELSE NULL END,
       check_close = CASE WHEN prices.close = excluded.close THEN prices.check_close ELSE NULL END,
       close = excluded.close`,
  );
  const stmts: D1PreparedStatement[] = [];
  const changed: Record<string, number> = {};
  const rebased: Record<string, number> = {};
  for (const { symbol, source, bars } of withBars) {
    changed[symbol] = 0;
    const mine = new Map<string, number>();
    for (const b of bars) {
      const old = existing.get(`${symbol}|${b.date}`);
      if (old !== undefined) mine.set(b.date, old);
    }
    const factor = detectRebase(mine, bars);
    if (factor !== null) {
      rebased[symbol] = factor;
      if (!opts.allowRebase) continue;
    }
    for (const b of bars) {
      const old = existing.get(`${symbol}|${b.date}`);
      if (old !== undefined && sameClose(old, b.close)) continue;
      changed[symbol]++;
      stmts.push(stmt.bind(symbol, b.date, b.open, b.high, b.low, b.close, b.volume, source, fetchedAt));
    }
  }
  await batchRun(db, stmts);
  return { changed, rebased };
}

/**
 * 同一個收盤的兩種寫法：Yahoo spark 的收盤是單精度浮點，與 chart 的值差在第 8 位有效數字左右
 * （實測 ^GSPC 差 0.0002、相對 3e-8；單精度誤差上限約 6e-8）。門檻 1e-6 留了十幾倍餘裕；價格一萬美元以下時，它小於一分錢，真的修正收盤一定看得出來。這種差異不算「收盤改了」，否則每天都會把整個月重寫一遍、清掉已做完的交叉核對。
 */
export const sameClose = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-6;

export const CHECK_ABS_TOLERANCE = 0.011;
export const CHECK_REL_TOLERANCE = 0.0005;

export function compareCloses(primary: number, other: number): "match" | "mismatch" {
  return Math.abs(primary - other) <= Math.max(CHECK_ABS_TOLERANCE, Math.abs(primary) * CHECK_REL_TOLERANCE) ? "match" : "mismatch";
}

export interface CheckResult {
  symbol: string;
  date: string;
  status: "match" | "mismatch";
  primary: number;
  other: number;
}

/** 把第二來源的收盤寫進 check_* 欄，回傳每一天的比對結果（主來源沒有的日期略過）。 */
export async function applyCrossChecks(db: Db, items: BarBatch[], checkedAt = nowIso()): Promise<CheckResult[]> {
  const withBars = items.filter((i) => i.bars.length);
  if (!withBars.length) return [];
  const minDate = withBars.reduce((m, i) => (i.bars[0].date < m ? i.bars[0].date : m), "9999-12-31");
  const symbols = withBars.map((i) => i.symbol);
  const rows = await db
    .prepare(`SELECT symbol, date, close FROM prices WHERE symbol IN (${symbols.map(() => "?").join(",")}) AND date >= ?`)
    .bind(...symbols, minDate)
    .all<{ symbol: string; date: string; close: number }>();
  const primary = new Map(rows.results.map((r) => [`${r.symbol}|${r.date}`, r.close]));
  const stmt = db.prepare("UPDATE prices SET check_close = ?, check_source = ?, check_status = ?, checked_at = ? WHERE symbol = ? AND date = ?");
  const stmts: D1PreparedStatement[] = [];
  const results: CheckResult[] = [];
  for (const { symbol, source, bars } of withBars) {
    for (const b of bars) {
      const p = primary.get(`${symbol}|${b.date}`);
      if (p === undefined) continue;
      const status = compareCloses(p, b.close);
      results.push({ symbol, date: b.date, status, primary: p, other: b.close });
      stmts.push(stmt.bind(b.close, source, status, checkedAt, symbol, b.date));
    }
  }
  await batchRun(db, stmts);
  return results;
}

export interface LoadedPrices {
  series: Record<string, Series>;
  checks: Record<string, Map<string, PriceCheck>>;
}

export async function loadPrices(db: Db, symbols: string[], fromDate: string, toDate = "9999-12-31"): Promise<LoadedPrices> {
  const placeholders = symbols.map(() => "?").join(",");
  const rows = await db
    .prepare(`SELECT symbol, date, close, check_status, check_source, check_close FROM prices WHERE symbol IN (${placeholders}) AND date >= ? AND date <= ? ORDER BY date`)
    .bind(...symbols, fromDate, toDate)
    .all<{ symbol: string; date: string; close: number; check_status: string | null; check_source: string | null; check_close: number | null }>();
  const pts: Record<string, { date: string; close: number }[]> = Object.fromEntries(symbols.map((s) => [s, []]));
  const checks: LoadedPrices["checks"] = Object.fromEntries(symbols.map((s) => [s, new Map()]));
  for (const r of rows.results) {
    pts[r.symbol].push({ date: r.date, close: r.close });
    checks[r.symbol].set(r.date, {
      status: (r.check_status as PriceCheck["status"]) ?? "pending",
      source: r.check_source,
      close: r.check_close,
    });
  }
  return { series: Object.fromEntries(Object.entries(pts).map(([s, p]) => [s, new Series(p)])), checks };
}

export async function insertWeights(db: Db, asOf: string, holdings: { ticker: string; name: string; weightPct: number; shares: number | null }[], fetchedAt = nowIso()) {
  const stmt = db.prepare(
    "INSERT INTO weights (as_of, ticker, name, weight_pct, shares, fetched_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(as_of, ticker) DO UPDATE SET weight_pct = excluded.weight_pct, shares = excluded.shares, name = excluded.name",
  );
  await batchRun(db, holdings.map((h) => stmt.bind(asOf, h.ticker, h.name, h.weightPct, h.shares, fetchedAt)));
}

export interface WeightAnchors {
  /** 依日期遞增 */
  dates: string[];
  byDate: Map<string, Map<string, number>>;
}

/** 一次載入所有持股檔中指定代號的權重，再在記憶體裡挑最近的一份。 */
export async function loadWeightAnchors(db: Db, tickers: string[]): Promise<WeightAnchors> {
  const rows = await db
    .prepare(`SELECT as_of, ticker, weight_pct FROM weights WHERE ticker IN (${tickers.map(() => "?").join(",")}) ORDER BY as_of`)
    .bind(...tickers)
    .all<{ as_of: string; ticker: string; weight_pct: number }>();
  // 日期取所有持股檔（名單清空或某檔已調出指數時，仍知道有哪幾份持股檔）。
  const dates = await db.prepare("SELECT DISTINCT as_of FROM weights ORDER BY as_of").all<{ as_of: string }>();
  const byDate = new Map<string, Map<string, number>>(dates.results.map((d) => [d.as_of, new Map()]));
  for (const r of rows.results) {
    if (!byDate.has(r.as_of)) byDate.set(r.as_of, new Map());
    byDate.get(r.as_of)!.set(r.ticker, r.weight_pct);
  }
  return { dates: [...byDate.keys()], byDate };
}

/** target 當天或之前最近的持股檔；都沒有就取之後最早的一份（回補歷史時用）。 */
export function weightsNear(anchors: WeightAnchors, target: string) {
  if (!anchors.dates.length) return null;
  const before = anchors.dates.filter((d) => d <= target).at(-1);
  const asOf = before ?? anchors.dates[0];
  return { asOf, byTicker: anchors.byDate.get(asOf)! };
}

export async function digestOf(data: unknown): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(data)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/**
 * 內容與最新 revision 相同就不寫；不同就新增 revision（舊的保留不改）。回傳新寫入的「日期 rN」。
 * 版本號與「內容是否改變」都在同一條 INSERT…SELECT 裡決定：排程與手動重算同時跑時，
 * D1 逐條執行，不會兩邊讀到同一個最新版本、搶同一個號碼。
 */
export async function saveSnapshots(db: Db, snaps: Snapshot[], reason: string): Promise<string[]> {
  if (!snaps.length) return [];
  const stmt = db.prepare(
    `INSERT INTO snapshots (trade_date, revision, digest, reason, data, created_at)
     SELECT ?1, COALESCE((SELECT MAX(revision) FROM snapshots WHERE trade_date = ?1), 0) + 1, ?2, ?3, ?4, ?5
     WHERE COALESCE((SELECT digest FROM snapshots WHERE trade_date = ?1 ORDER BY revision DESC LIMIT 1), '') <> ?2
     RETURNING trade_date, revision`,
  );
  const at = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const snap of snaps) stmts.push(stmt.bind(snap.tradeDate, await digestOf(snap), reason, JSON.stringify(snap), at));
  const created: string[] = [];
  for (let i = 0; i < stmts.length; i += CHUNK) {
    const results = await db.batch<{ trade_date: string; revision: number }>(stmts.slice(i, i + CHUNK));
    for (const r of results) for (const row of r.results ?? []) created.push(`${row.trade_date} r${row.revision}`);
  }
  return created;
}

export interface SnapshotRow {
  tradeDate: string;
  revision: number;
  reason: string;
  createdAt: string;
  data: Snapshot;
}

export async function getSnapshot(db: Db, tradeDate?: string, revision?: number): Promise<SnapshotRow | null> {
  let row: { trade_date: string; revision: number; reason: string; created_at: string; data: string } | null;
  if (tradeDate && revision) {
    row = await db.prepare("SELECT * FROM snapshots WHERE trade_date = ? AND revision = ?").bind(tradeDate, revision).first();
  } else if (tradeDate) {
    row = await db.prepare("SELECT * FROM snapshots WHERE trade_date = ? ORDER BY revision DESC LIMIT 1").bind(tradeDate).first();
  } else {
    row = await db.prepare("SELECT * FROM snapshots ORDER BY trade_date DESC, revision DESC LIMIT 1").first();
  }
  if (!row) return null;
  return { tradeDate: row.trade_date, revision: row.revision, reason: row.reason, createdAt: row.created_at, data: JSON.parse(row.data) as Snapshot };
}

export async function listRevisions(db: Db, tradeDate: string) {
  const rows = await db
    .prepare("SELECT revision, reason, created_at, digest FROM snapshots WHERE trade_date = ? ORDER BY revision DESC")
    .bind(tradeDate)
    .all<{ revision: number; reason: string; created_at: string; digest: string }>();
  return rows.results.map((r) => ({ revision: r.revision, reason: r.reason, createdAt: r.created_at, digest: r.digest }));
}

export async function listSnapshotDates(db: Db, limit = 400) {
  const rows = await db
    .prepare("SELECT trade_date, MAX(revision) AS revision FROM snapshots GROUP BY trade_date ORDER BY trade_date DESC LIMIT ?")
    .bind(limit)
    .all<{ trade_date: string; revision: number }>();
  return rows.results.map((r) => ({ tradeDate: r.trade_date, revision: r.revision }));
}

export async function startRun(db: Db, job: string, trigger: string) {
  const row = await db
    .prepare("INSERT INTO runs (job, trigger, status, started_at) VALUES (?, ?, 'running', ?) RETURNING id")
    .bind(job, trigger, nowIso())
    .first<{ id: number }>();
  return row!.id;
}

export async function finishRun(db: Db, id: number, status: "ok" | "partial" | "failed", summary: string, detail: unknown) {
  await db
    .prepare("UPDATE runs SET status = ?, finished_at = ?, summary = ?, detail = ? WHERE id = ?")
    .bind(status, nowIso(), summary, JSON.stringify(detail), id)
    .run();
}

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  if (!row) return fallback;
  try {
    const value = JSON.parse(row.value) as T;
    // 物件設定：缺的欄位用預設值補（舊版存的設定少了新欄位時）。陣列或其他型別原樣回傳，不能展開成物件。
    const isPlain = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
    return isPlain(fallback) && isPlain(value) ? { ...fallback, ...value } : value;
  } catch {
    return fallback;
  }
}

export async function putSetting(db: Db, key: string, value: unknown) {
  await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(key, JSON.stringify(value))
    .run();
}
