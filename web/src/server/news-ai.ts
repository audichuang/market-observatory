// 新聞 AI 的讀取端：翻譯、文章重點與每日重點都由本機排程寫進 D1（scripts/ai-batch.ts → src/server/ai-batch.ts），
// 伺服器不呼叫任何模型；這裡只讀每日重點給總覽與新聞頁。
import type { WatchMember } from "../lib/universe.ts";
import type { Db } from "./repo.ts";

export interface DigestSource {
  id: string;
  title: string;
  title_zh: string | null;
  url: string;
  publisher: string | null;
  published_at: string | null;
}

export interface DigestRow {
  symbol: string;
  company: string;
  date: string;
  summary: string;
  tone: string;
  sources: DigestSource[];
  sourcesMissing: number;
}

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");

function parseNewsIds(value: string): string[] {
  return value.trim() === "[]" ? [] : value.split(",").map((id) => id.trim()).filter(Boolean);
}

/** Resolve the displayed digests together, then restore each digest's source order. */
export async function withDigestSources<T extends { news_ids: string }>(db: Db, digests: T[]) {
  const idsByDigest = digests.map((d) => parseNewsIds(d.news_ids));
  const ids = [...new Set(idsByDigest.flat())];
  const rows = await db.prepare("SELECT id, title, title_zh, url, publisher, published_at FROM news WHERE id IN (SELECT value FROM json_each(?))")
    .bind(JSON.stringify(ids)).all<DigestSource>();
  const byId = new Map(rows.results.map((r) => [r.id, r]));
  return digests.map(({ news_ids: _ids, ...digest }, i) => {
    const sources = idsByDigest[i].flatMap((id) => {
      const source = byId.get(id);
      return source ? [source] : [];
    });
    return { ...digest, sources, sourcesMissing: idsByDigest[i].length - sources.length };
  });
}

/** 名單公司最近幾天的重點（每家只取最新一天）。 */
export async function latestDigests(db: Db, members: WatchMember[], since: string, until?: string): Promise<DigestRow[]> {
  if (!members.length) return [];
  const company = new Map(members.map((m) => [m.key, m.company]));
  const rows = await db
    .prepare(`SELECT symbol, date, summary, tone, news_ids FROM news_digests WHERE date >= ?${until ? " AND date <= ?" : ""} AND symbol IN (${placeholders(members.length)}) ORDER BY date DESC`)
    .bind(since, ...(until ? [until] : []), ...members.map((m) => m.key))
    .all<{ symbol: string; date: string; summary: string; tone: string; news_ids: string }>();
  const seen = new Set<string>();
  const digests = rows.results.filter((r) => (seen.has(r.symbol) ? false : (seen.add(r.symbol), true))).map((r) => ({ ...r, company: company.get(r.symbol) ?? r.symbol }));
  return withDigestSources(db, digests);
}
