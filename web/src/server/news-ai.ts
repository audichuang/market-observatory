// 新聞 AI 的讀取端：翻譯、文章重點與每日重點都由本機排程寫進 D1（scripts/ai-batch.ts → src/server/ai-batch.ts），
// 伺服器不呼叫任何模型；這裡只讀每日重點給總覽與新聞頁。
import type { WatchMember } from "../lib/universe.ts";
import type { Db } from "./repo.ts";

export interface DigestRow {
  symbol: string;
  company: string;
  date: string;
  summary: string;
  tone: string;
}

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");

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
