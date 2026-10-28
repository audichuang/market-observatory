// 新聞 AI 的排程版：本機的 Orca 排程（Claude 訂閱，不用 API key）跑 scripts/ai-batch.ts，
// 先從這裡拿待辦（pendingWork），在本機產生提示詞交給 agent，答案再送回來由 importResults 驗證、寫進 D1。
// 這裡不呼叫任何模型，也不打外部請求；只讀寫 D1。
import { addDays, easternDate } from "../lib/calendar.ts";
import { type EnrichInput, isImportant, newsFingerprint, parseDigest, parseEnrich, parsePoints } from "../lib/news-ai.ts";
import { newsTiming } from "../lib/news-time.ts";
import { type Db, finishRun, getSnapshot, nowIso, startRun } from "./repo.ts";
import { loadTrackedMembers } from "./watchlist.ts";

/** 大盤那段存在 news_digests，代號用 SPX（名單公司不會用這個代號）。 */
export const MARKET_KEY = "SPX";

/** 一次最多翻幾則（每 20 則一個提示詞）；只翻最近幾天的，舊的不補。 */
const TRANSLATE_LIMIT = 100;
const TRANSLATE_DAYS = 7;
const TRANSLATE_WHERE = "(title_zh IS NULL OR enriched_at IS NULL) AND published_at >= ?";
/** 一次最多替幾則重要新聞寫重點；只看最近幾天。 */
const POINTS_LIMIT = 15;
const POINTS_DAYS = 3;

interface NewsRow {
  id: string;
  symbols: string;
  title: string;
  url: string;
  summary: string | null;
  primary_symbol: string | null;
  title_zh: string | null;
  tone: string | null;
  category: string | null;
  focus: string | null;
  points_zh: string | null;
  published_at: string;
  fetched_at: string;
  published_ago: string | null;
}
const COLS = "id, symbols, title, url, summary, primary_symbol, title_zh, tone, category, focus, points_zh, published_at, fetched_at, published_ago";
const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");
const toInput = (r: NewsRow): EnrichInput => ({ id: r.id, title: r.title, summary: r.summary, symbols: r.symbols.split(","), primarySymbol: r.primary_symbol });

export interface DigestWork {
  key: string;
  company: string;
  date: string;
  returnPct: number | null;
  contributionPts: number | null;
  news: { id: string; titleZh: string; title: string; summary: string | null; tone: string; category: string; timing: "before-close" }[];
  unconfirmed?: { id: string; titleZh: string; title: string; summary: string | null; tone: string; category: string; timing: "after-close" | "unknown" }[];
}

export interface MarketWork {
  date: string;
  close: number;
  changePts: number | null;
  returnPct: number | null;
  vix: number | null;
  vixChange: number | null;
  spreadPct: number | null;
  movers: { key: string; company: string; returnPct: number | null; contributionPts: number | null }[];
  restPts: number | null;
  news: string[];
  newsIds: string[];
  unconfirmed?: { id: string; title: string; timing: "after-close" | "unknown" }[];
}

export async function translateWork(db: Db, today: string): Promise<EnrichInput[]> {
  const rows = await db
    .prepare(`SELECT ${COLS} FROM news WHERE ${TRANSLATE_WHERE} ORDER BY published_at DESC, fetched_at DESC LIMIT ?`)
    .bind(addDays(today, -TRANSLATE_DAYS), TRANSLATE_LIMIT)
    .all<NewsRow>();
  return rows.results.map(toInput);
}

/** Public pipeline health comes from persisted results, never local scheduler heartbeats. */
export async function aiPipelineStatus(db: Db, now: Date = new Date()) {
  const lastOkAt = async (job: string) => (await db.prepare("SELECT MAX(finished_at) AS at FROM runs WHERE job = ? AND status = 'ok'").bind(job).first<{ at: string | null }>())!.at;
  const jobStatus = async (job: string) => {
    const [lastRun, okAt] = await Promise.all([
      db.prepare("SELECT status, finished_at AS finishedAt, summary FROM runs WHERE job = ? ORDER BY started_at DESC, id DESC LIMIT 1")
        .bind(job).first<{ status: string; finishedAt: string | null; summary: string | null }>(),
      lastOkAt(job),
    ]);
    return { lastRun, lastOkAt: okAt };
  };
  const [daily, translate, newsOkAt, snapshot, backlog] = await Promise.all([
    jobStatus("ai-daily"),
    jobStatus("ai-translate"),
    lastOkAt("news"),
    db.prepare("SELECT trade_date, EXISTS(SELECT 1 FROM news_digests WHERE symbol = ? AND date = snapshots.trade_date) AS written FROM snapshots ORDER BY trade_date DESC, revision DESC LIMIT 1")
      .bind(MARKET_KEY).first<{ trade_date: string; written: number }>(),
    db.prepare(`SELECT COUNT(*) AS count, MIN(fetched_at) AS oldestFetchedAt FROM news WHERE ${TRANSLATE_WHERE}`)
      .bind(addDays(easternDate(now), -TRANSLATE_DAYS)).first<{ count: number; oldestFetchedAt: string | null }>(),
  ]);
  return {
    daily: { ...daily, latestTradeDate: snapshot?.trade_date ?? null, marketDigestWritten: snapshot?.written === 1 },
    translate: { ...translate, backlog: backlog! },
    news: { lastOkAt: newsOkAt },
  };
}

/** 每日的待辦：重要新聞的重點、最新交易日每家追蹤公司的重點（有新聞才寫）、大盤那段。已寫過的不再給。 */
export async function dailyWork(db: Db, today: string): Promise<{
  date: string | null;
  revision?: number;
  points: { id: string; title: string; url: string; summary: string | null; symbols: string[] }[];
  digests: DigestWork[];
  market: MarketWork | null;
}> {
  const members = await loadTrackedMembers(db);
  const keys = members.map((m) => m.key);
  const tickers = members.flatMap((m) => m.tickers);

  const recent = await db
    .prepare(`SELECT ${COLS} FROM news WHERE published_at >= ? ORDER BY published_at DESC, fetched_at DESC LIMIT 300`)
    .bind(addDays(today, -POINTS_DAYS))
    .all<NewsRow>();
  // 重點只寫已經翻過、AI 判定真的在講追蹤公司（或大盤總經）的；選股、「我會買哪檔」這類投資觀點文不寫
  const points = recent.results
    .filter((n) => n.points_zh === null && n.focus !== null && n.category !== "投資觀點" && isImportant(n, [...keys, "SPY"], tickers))
    .slice(0, POINTS_LIMIT)
    .map((n) => ({ id: n.id, title: n.title, url: n.url, summary: n.summary, symbols: n.symbols.split(",") }));

  const snap = await getSnapshot(db);
  if (!snap) return { date: null, points, digests: [] as DigestWork[], market: null };
  const date = snap.tradeDate;
  const s = snap.data;
  const have = new Set(
    (await db.prepare("SELECT symbol FROM news_digests WHERE date = ?").bind(date).all<{ symbol: string }>()).results.map((r) => r.symbol),
  );
  const onDate = (await db.prepare(`SELECT ${COLS} FROM news WHERE published_at = ? ORDER BY fetched_at DESC`).bind(date).all<NewsRow>()).results
    .map((n) => ({ ...n, timing: newsTiming(n, date) }));
  const digests: DigestWork[] = members
    .filter((m) => !have.has(m.key))
    .map((m) => {
      const row = s.mag7.find((x) => x.key === m.key);
      const selected = onDate.filter((n) => isImportant(n, [m.key], m.tickers)).slice(0, 8);
      const news: DigestWork["news"] = [];
      const unconfirmed: NonNullable<DigestWork["unconfirmed"]> = [];
      for (const n of selected) {
        const item = { id: n.id, titleZh: n.title_zh ?? n.title, title: n.title, summary: n.summary, tone: n.tone ?? "neutral", category: n.category ?? "未分類" };
        if (n.timing === "before-close") news.push({ ...item, timing: n.timing });
        else unconfirmed.push({ ...item, timing: n.timing });
      }
      return {
        key: m.key,
        company: m.company,
        date,
        returnPct: row?.returnPct ?? null,
        contributionPts: row?.contributionPts ?? null,
        news,
        unconfirmed,
      };
    })
    .filter((d) => d.news.length + d.unconfirmed.length > 0);

  let market: MarketWork | null = null;
  if (!have.has(MARKET_KEY)) {
    const macro = onDate.filter((n) => n.focus !== null && n.focus.split(",").includes("SPY") && n.category === "總經與市場").slice(0, 10);
    const beforeClose = macro.filter((n) => n.timing === "before-close");
    const unconfirmed: NonNullable<MarketWork["unconfirmed"]> = [];
    for (const n of macro) {
      if (n.timing !== "before-close") unconfirmed.push({ id: n.id, title: n.title_zh ?? n.title, timing: n.timing });
    }
    market = {
      date,
      close: s.index.close,
      changePts: s.index.changePts,
      returnPct: s.index.returnPct,
      vix: s.vix.close,
      vixChange: s.vix.change,
      spreadPct: s.breadth.spreadPct,
      // All tracked companies: restPts is the remainder after every one of them, so the parts must cover the same set.
      // marketPrompt lists the largest few and folds the others into one line.
      movers: [...s.mag7]
        .sort((a, b) => Math.abs(b.contributionPts ?? 0) - Math.abs(a.contributionPts ?? 0))
        .map((r) => ({ key: r.key, company: r.company, returnPct: r.returnPct, contributionPts: r.contributionPts })),
      restPts: s.rest.contributionPts,
      news: beforeClose.map((n) => n.title_zh ?? n.title),
      newsIds: beforeClose.map((n) => n.id),
      unconfirmed,
    };
  }
  return { date, revision: snap.revision, points, digests, market };
}

export interface ImportBody {
  translate?: { ids: string[]; answer: unknown }[];
  points?: { id: string; answer: unknown }[];
  digests?: { key: string; date: string; newsIds: string[]; answer: unknown }[];
  model?: string;
  run?: {
    id: string;
    kind: "translate" | "daily";
    expected: string[];
    missing: string[];
    unavailable: { key: string; reason: string }[];
    manifest?: unknown;
  };
}

export interface ImportReceipt {
  translated: number;
  points: number;
  digests: number;
  skipped: string[];
  accepted: string[];
  rejected: { key: string; reason: string }[];
  run?: { id: number; status: "ok" | "partial" | "failed" };
}

/** 驗證 agent 的答案並寫進 D1；回傳實際寫入數與逐筆回執，保留舊版略過訊息。 */
export async function importResults(db: Db, body: ImportBody): Promise<ImportReceipt> {
  const now = nowIso();
  const model = (body.model ?? "claude").slice(0, 60);
  const runId = body.run ? await startRun(db, `ai-${body.run.kind}`, "ai-batch") : null;
  const writes: { stmt: D1PreparedStatement; kind: "translated" | "points" | "digests"; key: string }[] = [];
  const skipped: string[] = [];
  const accepted: string[] = [];
  const rejected: { key: string; reason: string }[] = [];
  const counts = { translated: 0, points: 0, digests: 0 };

  for (const t of body.translate ?? []) {
    const ids = [...new Set(t.ids)].slice(0, 20);
    if (!ids.length) continue;
    // 用 agent 拿到的同一組順序重建輸入：答案裡的 n 是這組的序號
    const rows = (await db.prepare(`SELECT ${COLS} FROM news WHERE id IN (${placeholders(ids.length)})`).bind(...ids).all<NewsRow>()).results;
    const byId = new Map(rows.map((r) => [r.id, r]));
    if (ids.some((id) => !byId.has(id))) {
      skipped.push(`翻譯：有 ${ids.filter((id) => !byId.has(id)).length} 則已不在資料庫`);
    }
    // 被刪掉的那則留在原位、標成不存在：答案的 n 對的是 agent 拿到的序號
    const inputs = ids.map((id) => (byId.has(id) ? toInput(byId.get(id)!) : { id, title: "", summary: null, symbols: [], primarySymbol: null }));
    let parsed: ReturnType<typeof parseEnrich> = [];
    try {
      parsed = parseEnrich(t.answer, inputs).filter((e) => byId.has(e.id));
    } catch (e) {
      skipped.push(`翻譯：${e instanceof Error ? e.message : String(e)}`);
    }
    parsed = [...new Map(parsed.map((e) => [e.id, e])).values()];
    const answered = new Set(parsed.map((e) => e.id));
    for (const id of ids) {
      if (!byId.has(id)) rejected.push({ key: `translate:${id}`, reason: "新聞已不在資料庫，沒有寫入" });
      else if (!answered.has(id)) rejected.push({ key: `translate:${id}`, reason: "答案缺這則或格式不對" });
    }
    const update = db.prepare("UPDATE news SET title_zh = ?, tone = ?, category = ?, focus = ?, enriched_at = ? WHERE id = ?");
    for (const e of parsed) writes.push({ stmt: update.bind(e.titleZh, e.tone, e.category, e.focus.join(","), now, e.id), kind: "translated", key: `translate:${e.id}` });
  }

  for (const p of body.points ?? []) {
    const out = parsePoints(p.answer);
    if (!out) {
      skipped.push(`重點 ${p.id}：格式不對`);
      rejected.push({ key: `points:${p.id}`, reason: "格式不對" });
      continue;
    }
    writes.push({ stmt: db.prepare("UPDATE news SET points_zh = ?, tone = COALESCE(tone, ?) WHERE id = ?").bind(JSON.stringify(out.points), out.tone, p.id), kind: "points", key: `points:${p.id}` });
  }

  const insert = db.prepare(
    `INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol, date) DO UPDATE SET summary = excluded.summary, tone = excluded.tone, news_ids = excluded.news_ids, digest = excluded.digest, model = excluded.model, created_at = excluded.created_at`,
  );
  for (const d of body.digests ?? []) {
    let out = null;
    try {
      out = parseDigest(d.answer);
    } catch {
      out = null;
    }
    if (!out || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !d.key) {
      skipped.push(`每日重點 ${d.key}：格式不對`);
      rejected.push({ key: `digest:${d.key}:${d.date}`, reason: "格式不對" });
      continue;
    }
    const snapshot = await db.prepare("SELECT trade_date FROM snapshots WHERE trade_date = ? LIMIT 1").bind(d.date).first();
    if (!snapshot) {
      rejected.push({ key: `digest:${d.key}:${d.date}`, reason: "日期不是交易日快照" });
      continue;
    }
    const sources = await db.prepare("SELECT id, published_at FROM news WHERE id IN (SELECT value FROM json_each(?))")
      .bind(JSON.stringify(d.newsIds)).all<Pick<NewsRow, "id" | "published_at">>();
    const sourceDates = new Map(sources.results.map((n) => [n.id, n.published_at]));
    const invalidSources = d.newsIds.filter((id) => sourceDates.get(id) !== d.date);
    if (invalidSources.length) {
      rejected.push({ key: `digest:${d.key}:${d.date}`, reason: `來源新聞不存在或日期不符：${invalidSources.join(",")}` });
      continue;
    }
    writes.push({ stmt: insert.bind(d.key, d.date, out.summary, out.tone, d.newsIds.join(","), newsFingerprint(d.newsIds), model, now), kind: "digests", key: `digest:${d.key}:${d.date}` });
  }

  if (writes.length) {
    const results = await db.batch(writes.map((w) => w.stmt));
    results.forEach((result, i) => {
      const { kind, key } = writes[i];
      counts[kind] += result.meta.changes;
      if (result.meta.changes === 0) rejected.push({ key, reason: "新聞已不在資料庫，沒有寫入" });
      else accepted.push(key);
    });
  }
  const receipt = { ...counts, skipped, accepted, rejected };
  if (body.run && runId !== null) {
    const { id, expected, missing, unavailable, manifest } = body.run;
    const storedManifest = manifest !== undefined && new TextEncoder().encode(JSON.stringify(manifest)).byteLength > 16 * 1024 ? { truncated: true } : manifest;
    const status = expected.length > 0 && accepted.length === 0 ? "failed" : missing.length || rejected.length ? "partial" : "ok";
    const summary = `預期 ${expected.length}、寫入 ${accepted.length}、缺答案 ${missing.length}、拒收 ${rejected.length}、正文取不到 ${unavailable.length}`;
    await finishRun(db, runId, status, summary, { runId: id, expected, accepted, missing, rejected, unavailable, manifest: storedManifest });
    return { ...receipt, run: { id: runId, status } };
  }
  return receipt;
}
