import { Series } from "../lib/analytics.ts";
import type { PriceCheck, Snapshot } from "../lib/snapshot.ts";
import { detectRebase } from "../lib/rebase.ts";
import type { DailyBar } from "../lib/sources/http.ts";

// 直接用 D1 prepared statement：批次寫入比 ORM 快，也不會撞到單一查詢參數上限。

export const nowIso = () => new Date().toISOString();

const CHUNK = 200;

async function batchRun(db: D1Database, stmts: D1PreparedStatement[]) {
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
 */
export async function upsertBars(db: D1Database, items: BarBatch[], fetchedAt = nowIso()): Promise<{ changed: Record<string, number>; rebased: Record<string, number> }> {
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
       open = excluded.open, high = excluded.high, low = excluded.low, volume = excluded.volume,
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
    if (factor !== null) rebased[symbol] = factor;
    for (const b of bars) {
      if (existing.get(`${symbol}|${b.date}`) === b.close) continue;
      changed[symbol]++;
      stmts.push(stmt.bind(symbol, b.date, b.open, b.high, b.low, b.close, b.volume, source, fetchedAt));
    }
  }
  await batchRun(db, stmts);
  return { changed, rebased };
}

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
export async function applyCrossChecks(db: D1Database, items: BarBatch[], checkedAt = nowIso()): Promise<CheckResult[]> {
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

export async function loadPrices(db: D1Database, symbols: string[], fromDate: string, toDate = "9999-12-31"): Promise<LoadedPrices> {
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

export async function insertWeights(db: D1Database, asOf: string, holdings: { ticker: string; name: string; weightPct: number; shares: number | null }[], fetchedAt = nowIso()) {
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
export async function loadWeightAnchors(db: D1Database, tickers: string[]): Promise<WeightAnchors> {
  const rows = await db
    .prepare(`SELECT as_of, ticker, weight_pct FROM weights WHERE ticker IN (${tickers.map(() => "?").join(",")}) ORDER BY as_of`)
    .bind(...tickers)
    .all<{ as_of: string; ticker: string; weight_pct: number }>();
  const byDate = new Map<string, Map<string, number>>();
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

/** 內容與最新 revision 相同就不寫；不同就新增 revision（舊的保留不改）。回傳新寫入的「日期 rN」。 */
export async function saveSnapshots(db: D1Database, snaps: Snapshot[], reason: string): Promise<string[]> {
  if (!snaps.length) return [];
  const dates = snaps.map((s) => s.tradeDate);
  const latest = await db
    .prepare(
      `SELECT trade_date, revision, digest FROM snapshots s WHERE trade_date IN (${dates.map(() => "?").join(",")})
       AND revision = (SELECT MAX(revision) FROM snapshots WHERE trade_date = s.trade_date)`,
    )
    .bind(...dates)
    .all<{ trade_date: string; revision: number; digest: string }>();
  const byDate = new Map(latest.results.map((r) => [r.trade_date, r]));
  const stmt = db.prepare("INSERT INTO snapshots (trade_date, revision, digest, reason, data, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  const stmts: D1PreparedStatement[] = [];
  const created: string[] = [];
  const at = nowIso();
  for (const snap of snaps) {
    const digest = await digestOf(snap);
    const prev = byDate.get(snap.tradeDate);
    if (prev?.digest === digest) continue;
    const revision = (prev?.revision ?? 0) + 1;
    stmts.push(stmt.bind(snap.tradeDate, revision, digest, reason, JSON.stringify(snap), at));
    created.push(`${snap.tradeDate} r${revision}`);
  }
  await batchRun(db, stmts);
  return created;
}

export interface SnapshotRow {
  tradeDate: string;
  revision: number;
  reason: string;
  createdAt: string;
  data: Snapshot;
}

export async function getSnapshot(db: D1Database, tradeDate?: string, revision?: number): Promise<SnapshotRow | null> {
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

export async function listRevisions(db: D1Database, tradeDate: string) {
  const rows = await db
    .prepare("SELECT revision, reason, created_at, digest FROM snapshots WHERE trade_date = ? ORDER BY revision DESC")
    .bind(tradeDate)
    .all<{ revision: number; reason: string; created_at: string; digest: string }>();
  return rows.results.map((r) => ({ revision: r.revision, reason: r.reason, createdAt: r.created_at, digest: r.digest }));
}

export async function listSnapshotDates(db: D1Database, limit = 400) {
  const rows = await db
    .prepare("SELECT trade_date, MAX(revision) AS revision FROM snapshots GROUP BY trade_date ORDER BY trade_date DESC LIMIT ?")
    .bind(limit)
    .all<{ trade_date: string; revision: number }>();
  return rows.results.map((r) => ({ tradeDate: r.trade_date, revision: r.revision }));
}

export async function startRun(db: D1Database, job: string, trigger: string) {
  const row = await db
    .prepare("INSERT INTO runs (job, trigger, status, started_at) VALUES (?, ?, 'running', ?) RETURNING id")
    .bind(job, trigger, nowIso())
    .first<{ id: number }>();
  return row!.id;
}

export async function finishRun(db: D1Database, id: number, status: "ok" | "partial" | "failed", summary: string, detail: unknown) {
  await db
    .prepare("UPDATE runs SET status = ?, finished_at = ?, summary = ?, detail = ? WHERE id = ?")
    .bind(status, nowIso(), summary, JSON.stringify(detail), id)
    .run();
}

export async function getSetting<T>(db: D1Database, key: string, fallback: T): Promise<T> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  if (!row) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(row.value) as T) };
  } catch {
    return fallback;
  }
}

export async function putSetting(db: D1Database, key: string, value: unknown) {
  await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(key, JSON.stringify(value))
    .run();
}
