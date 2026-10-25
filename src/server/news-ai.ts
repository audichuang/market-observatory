// 新聞 AI 加工的排程工作：先把新抓到的新聞逐則翻成繁中、分類、判斷在講誰（enrich），
// 再替每家公司寫當天的重點（digest）。模型呼叫由排程注入（src/server/llm.ts）；沒有 Workers AI 綁定（本機測試）時整個略過。
import { addDays, easternDate } from "../lib/calendar.ts";
import { type ChatMessage, type EnrichInput, digestPrompt, enrichPrompt, newsFingerprint, parseDigest, parseEnrich } from "../lib/news-ai.ts";
import type { Budget } from "../lib/sources/http.ts";
import { getSnapshot, nowIso } from "./repo.ts";
import { loadTrackedMembers } from "./watchlist.ts";

/** 呼叫一次模型、回傳文字。每次呼叫前先扣 budget（Workers AI 的呼叫也算這次執行的子請求）。 */
export type Llm = { model: string; chat: (messages: ChatMessage[], budget: Budget, maxTokens: number) => Promise<string> };

const ENRICH_BATCH = 15;
/** 每次最多加工幾則（新聞排程每 4 小時一次，一般一次新進 30～80 則） */
const ENRICH_PER_RUN = 120;
const DIGESTS_PER_RUN = 30;

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

export async function jobNewsAi(db: D1Database, llm: Llm | null, budget: Budget) {
  if (!llm) return { status: "ok" as const, summary: "沒有 Workers AI 綁定，略過新聞翻譯與重點", detail: {} };
  const since = addDays(easternDate(), -3);

  // ── 逐則加工 ──
  const pending = await db
    .prepare("SELECT id, symbols, title, summary, primary_symbol FROM news WHERE enriched_at IS NULL AND (published_at >= ? OR published_at IS NULL) ORDER BY published_at DESC, fetched_at DESC LIMIT ?")
    .bind(since, ENRICH_PER_RUN)
    .all<{ id: string; symbols: string; title: string; summary: string | null; primary_symbol: string | null }>();
  const inputs: EnrichInput[] = pending.results.map((r) => ({ id: r.id, title: r.title, summary: r.summary, symbols: r.symbols.split(","), primarySymbol: r.primary_symbol }));
  const batches: EnrichInput[][] = [];
  for (let i = 0; i < inputs.length; i += ENRICH_BATCH) batches.push(inputs.slice(i, i + ENRICH_BATCH));
  const enrichErrors: string[] = [];
  const now = nowIso();
  const update = db.prepare("UPDATE news SET title_zh = ?, tone = ?, category = ?, focus = ?, enriched_at = ? WHERE id = ?");
  let enriched = 0;
  const results = await mapLimit(batches, 3, async (batch) => parseEnrich(await llm.chat(enrichPrompt(batch), budget, 3000), batch));
  const stmts: D1PreparedStatement[] = [];
  results.forEach((r) => {
    if (r.status === "rejected") return enrichErrors.push(errText(r.reason));
    for (const e of r.value) stmts.push(update.bind(e.titleZh, e.tone, e.category, e.focus.join(","), now, e.id));
    enriched += r.value.length;
  });
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));

  // ── 每家公司的當天重點：美東今天與昨天有「真正在講它」的新聞才寫；新聞沒變就不重寫 ──
  const members = await loadTrackedMembers(db);
  const company = new Map(members.map((m) => [m.key, m.company]));
  const rows = await db
    .prepare("SELECT id, title, title_zh, summary, tone, category, focus, published_at FROM news WHERE enriched_at IS NOT NULL AND focus != '' AND published_at >= ?")
    .bind(addDays(easternDate(), -1))
    .all<{ id: string; title: string; title_zh: string; summary: string | null; tone: string; category: string; focus: string; published_at: string }>();
  const groups = new Map<string, typeof rows.results>();
  for (const r of rows.results) {
    for (const k of r.focus.split(",")) {
      if (!company.has(k)) continue;
      const g = `${k}|${r.published_at}`;
      groups.set(g, [...(groups.get(g) ?? []), r]);
    }
  }
  const existing = await db.prepare("SELECT symbol, date, digest FROM news_digests WHERE date >= ?").bind(addDays(easternDate(), -1)).all<{ symbol: string; date: string; digest: string }>();
  const have = new Map(existing.results.map((e) => [`${e.symbol}|${e.date}`, e.digest]));
  const latest = await getSnapshot(db);
  const todo = [...groups.entries()]
    .map(([g, news]) => ({ g, key: g.split("|")[0], date: g.split("|")[1], news: news.slice(0, 8), fp: newsFingerprint(news.map((n) => n.id)) }))
    .filter((t) => have.get(t.g) !== t.fp)
    .slice(0, DIGESTS_PER_RUN);
  const skippedDigests = Math.max(0, [...groups.keys()].filter((g) => have.get(g) !== newsFingerprint((groups.get(g) ?? []).map((n) => n.id))).length - todo.length);
  const digestErrors: string[] = [];
  const insert = db.prepare(
    `INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol, date) DO UPDATE SET summary = excluded.summary, tone = excluded.tone, news_ids = excluded.news_ids, digest = excluded.digest, model = excluded.model, created_at = excluded.created_at`,
  );
  const written: string[] = [];
  const digests = await mapLimit(todo, 3, async (t) => {
    const row = latest?.tradeDate === t.date ? latest.data.mag7.find((m) => m.key === t.key) : undefined;
    const text = await llm.chat(
      digestPrompt({
        key: t.key,
        company: company.get(t.key) ?? t.key,
        date: t.date,
        returnPct: row?.returnPct ?? null,
        contributionPts: row?.contributionPts ?? null,
        news: t.news.map((n) => ({ titleZh: n.title_zh, title: n.title, summary: n.summary, tone: n.tone, category: n.category })),
      }),
      budget,
      600,
    );
    const d = parseDigest(text);
    if (!d) throw new Error(`${t.key} 重點格式不對`);
    return { t, d };
  });
  const dstmts: D1PreparedStatement[] = [];
  digests.forEach((r) => {
    if (r.status === "rejected") return digestErrors.push(errText(r.reason));
    const { t, d } = r.value;
    dstmts.push(insert.bind(t.key, t.date, d.summary, d.tone, t.news.map((n) => n.id).join(","), t.fp, llm.model, now));
    written.push(`${t.key} ${t.date}`);
  });
  if (dstmts.length) await db.batch(dstmts);
  await db.prepare("DELETE FROM news_digests WHERE date < ?").bind(addDays(easternDate(), -60)).run();

  const failed = enrichErrors.length + digestErrors.length;
  return {
    status: failed === 0 ? ("ok" as const) : enriched + written.length > 0 ? ("partial" as const) : ("failed" as const),
    summary: `翻譯 ${enriched}/${inputs.length} 則；重點 ${written.length} 家（${written.join("、") || "無"}）${skippedDigests ? `；這次額滿、略過 ${skippedDigests} 家` : ""}${failed ? `；失敗 ${failed}` : ""}`,
    detail: { enrichErrors: enrichErrors.slice(0, 5), digestErrors: digestErrors.slice(0, 5), model: llm.model },
  };
}
