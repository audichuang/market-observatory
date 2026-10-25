// 新聞的 AI 加工，三個「按需」函式：標題翻譯與分類（translate）、單篇文章重點（points）、每日公司重點（digests）。
// 只在使用者打開畫面／點開文章時才呼叫（API 在 routes/api/v1），不在排程裡跑。結果存進 D1、所有人共用，同一則只做一次；
// 每個帳號每天（美東日期）有呼叫次數上限（ai_usage），快取命中不算次數。
import { easternDate } from "../lib/calendar.ts";
import { DIGEST_SCHEMA, ENRICH_SCHEMA, POINTS_SCHEMA, type EnrichInput, digestPrompt, enrichPrompt, extractArticleText, importanceFor, isImportant, newsFingerprint, parseDigest, parseEnrich, parsePoints, pointsPrompt } from "../lib/news-ai.ts";
import { type Budget, fetchWithTimeout } from "../lib/sources/http.ts";
import type { WatchMember } from "../lib/universe.ts";
import type { Viewer } from "./account.ts";
import { type Ai, AiModelError, HAIKU, SONNET } from "./anthropic.ts";
import { type Db, getSnapshot, nowIso } from "./repo.ts";

/** 一般帳號每天的 AI 呼叫上限（開放註冊，避免被拿來刷額度）；站長 10 倍。 */
export const DAILY_LIMIT = 40;
export const OWNER_DAILY_LIMIT = 400;
export const limitFor = (v: Pick<Viewer, "isOwner">) => (v.isOwner ? OWNER_DAILY_LIMIT : DAILY_LIMIT);

/** 每個 API 請求的外部請求額度（Anthropic 呼叫含 SDK 與 fetchWithTimeout 的重試、抓原文含轉址）。 */
export const TRANSLATE_BUDGET = 12;
export const POINTS_BUDGET = 20;
export const DIGESTS_BUDGET = 40;

export const MAX_TRANSLATE = 20;
export const MAX_DIGESTS_PER_CALL = 5;

export const QUOTA_MESSAGE = "今天的 AI 額度已用完，明天再試";
export const NO_KEY_MESSAGE = "伺服器尚未設定 AI";
const FAILED_MESSAGE = "AI 暫時無法使用，請稍後再試";

export class AiHttpError extends Error {
  status: 404 | 429 | 502 | 503;
  constructor(status: 404 | 429 | 502 | 503, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AiState {
  enabled: boolean;
  used: number;
  limit: number;
}

export async function aiState(db: Db, v: Viewer, enabled: boolean, date = easternDate()): Promise<AiState> {
  const row = await db.prepare("SELECT calls FROM ai_usage WHERE user_id = ? AND date = ?").bind(v.id, date).first<{ calls: number }>();
  return { enabled, used: row?.calls ?? 0, limit: limitFor(v) };
}

/** 先扣次數再呼叫（失敗再退回）。回傳實際拿到的次數（0～wanted）；用原子的 upsert 擋同時送出的請求超過上限。 */
export async function reserveCalls(db: Db, v: Viewer, wanted: number, date = easternDate()): Promise<number> {
  const limit = limitFor(v);
  for (let attempt = 0; attempt < 3; attempt++) {
    const used = (await db.prepare("SELECT calls FROM ai_usage WHERE user_id = ? AND date = ?").bind(v.id, date).first<{ calls: number }>())?.calls ?? 0;
    const grant = Math.min(wanted, limit - used);
    if (grant <= 0) return 0;
    const r = await db
      .prepare("INSERT INTO ai_usage (user_id, date, calls) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET calls = calls + excluded.calls WHERE calls + excluded.calls <= ?")
      .bind(v.id, date, grant, limit)
      .run();
    if ((r.meta?.changes ?? 0) > 0) return grant;
  }
  return 0;
}

export async function refundCalls(db: Db, v: Viewer, n: number, date = easternDate()): Promise<void> {
  if (n > 0) await db.prepare("UPDATE ai_usage SET calls = MAX(0, calls - ?) WHERE user_id = ? AND date = ?").bind(n, v.id, date).run();
}

/** 只有「模型還沒回應」的失敗（沒 key、網路、逾時、HTTP 錯誤）才退回額度；模型回應了才壞（拒絕、截斷、解析失敗）已經計費，不退。 */
const refundable = (e: unknown) => !(e instanceof AiModelError);

/** 模型已回應但內容不能用（格式不對）：已計費，不退額度。 */
function parseOrModelError<T>(parse: () => T | null, message: string): T {
  let out: T | null;
  try {
    out = parse();
  } catch (e) {
    throw new AiModelError(e instanceof Error ? e.message : message);
  }
  if (out === null) throw new AiModelError(message);
  return out;
}

function failure(e: unknown): AiHttpError {
  if (e instanceof AiHttpError) return e;
  console.error("AI 呼叫失敗：", e instanceof Error ? e.message : String(e));
  return new AiHttpError(502, FAILED_MESSAGE);
}

// ── 標題翻譯與分類 ──────────────────────────────────────

interface NewsRow {
  id: string;
  symbols: string;
  title: string;
  summary: string | null;
  primary_symbol: string | null;
  title_zh: string | null;
  tone: string | null;
  category: string | null;
  focus: string | null;
  enriched_at: string | null;
}
const NEWS_COLS = "id, symbols, title, summary, primary_symbol, title_zh, tone, category, focus, enriched_at";
const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");

/**
 * 認領超過這麼久還沒放掉，當作那個請求已經死掉（Worker 被中斷），可以重新認領。
 * 要比一次翻譯最長可能的時間長：anthropic.ts 單次 60 秒、最多重試 1 次，加上 D1 寫回，約兩分多。
 */
const CLAIM_TTL_MS = 300_000;
/** 等別的請求翻完的上限；超過就回 pending，前端過幾秒再來拿（那時多半已有快取，不呼叫模型）。 */
const WAIT_MS = 12_000;

/**
 * 認領值是「時間#隨機碼」：時間在前，過期判斷照字串比較就對；隨機碼讓放掉時只放自己的，
 * 過期的舊請求晚回來也不會清掉別人重新認領的那份。
 */
async function claimForTranslate(db: Db, ids: string[]): Promise<{ token: string; ids: string[] }> {
  const now = Date.now();
  const token = `${new Date(now).toISOString()}#${crypto.randomUUID()}`;
  const r = await db
    .prepare(`UPDATE news SET ai_claim_at = ? WHERE id IN (${placeholders(ids.length)}) AND (title_zh IS NULL OR enriched_at IS NULL) AND (ai_claim_at IS NULL OR ai_claim_at < ?) RETURNING id`)
    .bind(token, ...ids, new Date(now - CLAIM_TTL_MS).toISOString())
    .all<{ id: string }>();
  return { token, ids: r.results.map((x) => x.id) };
}

async function releaseClaim(db: Db, claim: { token: string; ids: string[] }) {
  if (claim.ids.length) await db.prepare(`UPDATE news SET ai_claim_at = NULL WHERE ai_claim_at = ? AND id IN (${placeholders(claim.ids.length)})`).bind(claim.token, ...claim.ids).run();
}

/** 等別人持有的認領寫回；回傳等完仍沒翻好的 id（別人還在翻、或剛失敗放掉了）。 */
async function waitForTranslations(db: Db, ids: string[], waitMs = WAIT_MS): Promise<string[]> {
  const until = Date.now() + waitMs;
  for (;;) {
    const r = await db
      .prepare(`SELECT id, ai_claim_at FROM news WHERE id IN (${placeholders(ids.length)}) AND (title_zh IS NULL OR enriched_at IS NULL)`)
      .bind(...ids)
      .all<{ id: string; ai_claim_at: string | null }>();
    const left = r.results;
    // 全翻好了，或剩下的已沒人在翻（失敗放掉）：不必再等
    if (left.every((x) => x.ai_claim_at === null) || Date.now() >= until) return left.map((x) => x.id);
    await new Promise((res) => setTimeout(res, 400));
  }
}

/**
 * 只處理還沒翻、或多掛了代號要重新判斷在講誰的（enriched_at 被排程清掉）：一次 Haiku 呼叫；其餘直接回傳，不算次數。
 * symbol 是畫面上的代號篩選（新聞頁 ?symbol=），重要與否照該畫面的規則算，翻完分組才不會跳。
 */
export async function translateNews(db: Db, ai: Ai | null, v: Viewer, members: WatchMember[], ids: string[], symbol: string | null = null, waitMs = WAIT_MS) {
  const unique = [...new Set(ids)].slice(0, MAX_TRANSLATE);
  const load = async () => (unique.length ? (await db.prepare(`SELECT ${NEWS_COLS} FROM news WHERE id IN (${placeholders(unique.length)})`).bind(...unique).all<NewsRow>()).results : []);
  const rows = await load();
  const todo = rows.filter((r) => r.title_zh === null || r.enriched_at === null);
  if (todo.length && !ai) throw new AiHttpError(503, NO_KEY_MESSAGE);
  // 先在 D1 原子地認領：別的請求（另一個分頁、剛換掉的篩選、其他使用者）正在翻的不再呼叫模型，等它寫回就好。
  const claim = todo.length ? await claimForTranslate(db, todo.map((r) => r.id)) : { token: "", ids: [] as string[] };
  const theirs = todo.filter((r) => !claim.ids.includes(r.id)).map((r) => r.id);
  const own = todo.filter((r) => claim.ids.includes(r.id));
  if (own.length && ai) {
    // 認領之後的每條路（扣額度失敗、額度用完、模型失敗）都要放掉自己的認領
    try {
      const date = easternDate();
      if ((await reserveCalls(db, v, 1, date)) === 0) throw new AiHttpError(429, QUOTA_MESSAGE);
      let billed = false;
      try {
        const inputs: EnrichInput[] = own.map((r) => ({ id: r.id, title: r.title, summary: r.summary, symbols: r.symbols.split(","), primarySymbol: r.primary_symbol }));
        const p = enrichPrompt(inputs);
        const raw = await ai.json({ model: HAIKU, system: p.system, user: p.user, schema: ENRICH_SCHEMA, maxTokens: 4000 });
        billed = true;
        const parsed = parseOrModelError(() => parseEnrich(raw, inputs), "標題翻譯格式不對");
        const now = nowIso();
        const update = db.prepare("UPDATE news SET title_zh = ?, tone = ?, category = ?, focus = ?, enriched_at = ? WHERE id = ? AND (title_zh IS NULL OR enriched_at IS NULL)");
        if (parsed.length) await db.batch(parsed.map((e) => update.bind(e.titleZh, e.tone, e.category, e.focus.join(","), now, e.id)));
      } catch (e) {
        if (!billed && refundable(e)) await refundCalls(db, v, 1, date).catch(() => {});
        throw failure(e);
      }
    } finally {
      await releaseClaim(db, claim).catch(() => {});
    }
  }
  // 別人正在翻的：等它寫回；等不到的回 pending，前端過幾秒再送一次（不呼叫模型，除非那邊失敗了）
  const pending = theirs.length ? await waitForTranslations(db, theirs, waitMs) : [];
  const important = importanceFor(members, symbol);
  const fresh = todo.length ? await load() : rows;
  const items = fresh
    .filter((r) => r.title_zh !== null)
    .map((r) => ({ id: r.id, title_zh: r.title_zh, tone: r.tone, category: r.category, focus: r.focus, important: important(r) }));
  return { items, pending, ai: await aiState(db, v, ai !== null) };
}

// ── 單篇文章重點 ────────────────────────────────────────

/** 只抓這一篇原文；失敗（逾時、非 HTML、額度用完）就回 null，呼叫端改用標題＋摘要。 */
async function fetchArticle(url: string, budget: Budget): Promise<string | null> {
  if (!/^https:\/\//i.test(url)) return null;
  try {
    const res = await fetchWithTimeout("article", url, { budget, timeoutMs: 10_000, headers: { Accept: "text/html,application/xhtml+xml" } });
    if (!(res.headers.get("content-type") ?? "").includes("html")) {
      await res.body?.cancel();
      return null;
    }
    return extractArticleText((await res.text()).slice(0, 600_000));
  } catch {
    return null;
  }
}

export async function newsPoints(db: Db, ai: Ai | null, v: Viewer, id: string, budget: Budget) {
  const row = await db
    .prepare("SELECT id, symbols, title, url, summary, tone, points_zh FROM news WHERE id = ?")
    .bind(id)
    .first<{ id: string; symbols: string; title: string; url: string; summary: string | null; tone: string | null; points_zh: string | null }>();
  if (!row) throw new AiHttpError(404, "找不到這則新聞");
  if (row.points_zh) {
    try {
      const cached = JSON.parse(row.points_zh) as string[];
      return { id, points: cached, tone: row.tone, cached: true, ai: await aiState(db, v, ai !== null) };
    } catch {
      // 存壞了就當沒有，重新產生
    }
  }
  if (!ai) throw new AiHttpError(503, NO_KEY_MESSAGE);
  const date = easternDate();
  if ((await reserveCalls(db, v, 1, date)) === 0) throw new AiHttpError(429, QUOTA_MESSAGE);
  let billed = false;
  try {
    const body = await fetchArticle(row.url, budget);
    const p = pointsPrompt({ title: row.title, body, summary: row.summary, symbols: row.symbols.split(",") });
    const raw = await ai.json({ model: SONNET, system: p.system, user: p.user, schema: POINTS_SCHEMA, maxTokens: 1500 });
    billed = true;
    const out = parseOrModelError(() => parsePoints(raw), "重點格式不對");
    await db.prepare("UPDATE news SET points_zh = ?, tone = COALESCE(tone, ?) WHERE id = ?").bind(JSON.stringify(out.points), out.tone, id).run();
    return { id, points: out.points, tone: row.tone ?? out.tone, cached: false, ai: await aiState(db, v, true) };
  } catch (e) {
    if (!billed && refundable(e)) await refundCalls(db, v, 1, date).catch(() => {});
    throw failure(e);
  }
}

// ── 每日公司重點 ────────────────────────────────────────

export interface DigestRow {
  symbol: string;
  company: string;
  date: string;
  summary: string;
  tone: string;
}

/** 名單公司最近幾天的重點（每家只取最新一天）。 */
export async function latestDigests(db: Db, members: WatchMember[], since: string, until?: string): Promise<DigestRow[]> {
  if (!members.length) return [];
  const company = new Map(members.map((m) => [m.key, m.company]));
  const rows = await db
    .prepare(`SELECT symbol, date, summary, tone FROM news_digests WHERE date >= ?${until ? " AND date <= ?" : ""} AND symbol IN (${placeholders(members.length)}) ORDER BY date DESC`)
    .bind(since, ...(until ? [until] : []), ...members.map((m) => m.key))
    .all<{ symbol: string; date: string; summary: string; tone: string }>();
  const seen = new Set<string>();
  return rows.results.filter((r) => (seen.has(r.symbol) ? false : (seen.add(r.symbol), true))).map((r) => ({ ...r, company: company.get(r.symbol) ?? r.symbol }));
}

async function digestsOn(db: Db, members: WatchMember[], date: string): Promise<DigestRow[]> {
  const rows = await db
    .prepare(`SELECT symbol, date, summary, tone FROM news_digests WHERE date = ? AND symbol IN (${placeholders(members.length || 1)})`)
    .bind(date, ...(members.length ? members.map((m) => m.key) : [""]))
    .all<{ symbol: string; date: string; summary: string; tone: string }>();
  const by = new Map(rows.results.map((r) => [r.symbol, r]));
  return members.flatMap((m) => (by.has(m.key) ? [{ ...by.get(m.key)!, company: m.company }] : []));
}

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

/** 替名單上「這天有真的在講它的新聞、但還沒有重點」的公司寫重點：一次最多 5 家，每家一次 Sonnet 呼叫。 */
export async function generateDigests(db: Db, ai: Ai | null, v: Viewer, members: WatchMember[], date: string) {
  const have = new Set((await digestsOn(db, members, date)).map((d) => d.symbol));
  const rows = await db
    .prepare(`SELECT ${NEWS_COLS}, published_at FROM news WHERE published_at = ? ORDER BY fetched_at DESC`)
    .bind(date)
    .all<NewsRow>();
  const todo = members
    .filter((m) => !have.has(m.key))
    .map((m) => ({ m, news: rows.results.filter((n) => isImportant(n, [m.key], m.tickers)).slice(0, 8) }))
    .filter((t) => t.news.length > 0)
    .slice(0, MAX_DIGESTS_PER_CALL);
  if (todo.length) {
    if (!ai) throw new AiHttpError(503, NO_KEY_MESSAGE);
    const quotaDate = easternDate();
    const grant = await reserveCalls(db, v, todo.length, quotaDate);
    if (grant === 0) throw new AiHttpError(429, QUOTA_MESSAGE);
    const run = todo.slice(0, grant);
    const snap = await getSnapshot(db, date).catch(() => null);
    const results = await mapLimit(run, 3, async ({ m, news }) => {
      const row = snap?.data.mag7.find((x) => x.key === m.key);
      const p = digestPrompt({
        key: m.key,
        company: m.company,
        date,
        returnPct: row?.returnPct ?? null,
        contributionPts: row?.contributionPts ?? null,
        news: news.map((n) => ({ titleZh: n.title_zh ?? n.title, title: n.title, summary: n.summary, tone: n.tone ?? "neutral", category: n.category ?? "未分類" })),
      });
      const raw = await ai.json({ model: SONNET, system: p.system, user: p.user, schema: DIGEST_SCHEMA, maxTokens: 600 });
      const d = parseOrModelError(() => parseDigest(raw), `${m.key} 重點格式不對`);
      return { m, news, d };
    });
    const now = nowIso();
    const insert = db.prepare(
      `INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(symbol, date) DO NOTHING`,
    );
    const stmts = results.flatMap((r) => (r.status === "fulfilled" ? [insert.bind(r.value.m.key, date, r.value.d.summary, r.value.d.tone, r.value.news.map((n) => n.id).join(","), newsFingerprint(r.value.news.map((n) => n.id)), SONNET, now)] : []));
    const failed = results.filter((r) => r.status === "rejected");
    await refundCalls(db, v, failed.filter((f) => refundable(f.reason)).length, quotaDate).catch(() => {});
    if (stmts.length) await db.batch(stmts);
    if (failed.length) failed.forEach((f) => console.error("每日重點失敗：", (f as PromiseRejectedResult).reason));
    if (!stmts.length) throw failure((failed[0] as PromiseRejectedResult).reason);
  }
  return { digests: await digestsOn(db, members, date), ai: await aiState(db, v, ai !== null) };
}
