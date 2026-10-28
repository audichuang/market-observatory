import { cachedPage, readDb } from "../src/server/page-cache.ts";
import { defineHandler, defineHead, type InferProps } from "void";
import { NYSE_CALENDAR, addDays, latestScheduledClose } from "../src/lib/calendar.ts";
import { CBOE_URLS } from "../src/lib/sources/cboe.ts";
import { SSGA_DISPLAY_URL } from "../src/lib/sources/ssga.ts";
import { VIX_SYMBOL, yahooSymbols } from "../src/lib/universe.ts";
import { weightsStaleNote } from "../src/lib/weights-age.ts";
import { loadTrackedMembers } from "../src/server/watchlist.ts";
import { yahooDisplayUrl } from "../src/lib/sources/yahoo.ts";
import { JOB_NAMES } from "../src/server/jobs.ts";
import { CHECK_ABS_TOLERANCE, CHECK_REL_TOLERANCE } from "../src/server/repo.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const db = readDb(c.env);
  // 頁面資料依資料版本快取，見 src/server/page-cache.ts。
  return cachedPage(c, db, `sources?close=${latestScheduledClose()}`, async () => {
    // 「落後」標記的基準：抓價排程該跑完了才算，與總覽的過期警告一致。
    const expected = latestScheduledClose();
    const [freshness, mismatches, runs, weights, counts] = await Promise.all([
      db
        .prepare(
          `SELECT p.symbol, p.date, p.close, p.source, p.fetched_at, p.check_status, p.check_source, p.check_close
           FROM prices p JOIN (SELECT symbol, MAX(date) AS d FROM prices GROUP BY symbol) m ON p.symbol = m.symbol AND p.date = m.d ORDER BY p.symbol`,
        )
        .all<{ symbol: string; date: string; close: number; source: string; fetched_at: string; check_status: string | null; check_source: string | null; check_close: number | null }>(),
      db
        .prepare("SELECT symbol, date, close, check_close, check_source FROM prices WHERE check_status = 'mismatch' AND date >= ? ORDER BY date DESC LIMIT 50")
        .bind(addDays(expected, -60))
        .all<{ symbol: string; date: string; close: number; check_close: number; check_source: string }>(),
      // Page props are embedded in the HTML for every signed-in user: never send detail (other users' ids, token prefixes, stacks)
      // or the raw trigger (manual triggers used to carry the owner's email).
      db
        .prepare("SELECT id, job, CASE WHEN trigger LIKE 'cron%' THEN 'cron' ELSE 'manual' END AS trigger, status, started_at, finished_at, summary FROM runs ORDER BY id DESC LIMIT 60").all<{ id: number; job: string; trigger: string; status: string; started_at: string; finished_at: string | null; summary: string | null }>(),
      db.prepare("SELECT as_of, COUNT(*) AS n, ROUND(SUM(weight_pct), 2) AS total, MAX(fetched_at) AS fetched_at FROM weights GROUP BY as_of ORDER BY as_of DESC LIMIT 10").all<{ as_of: string; n: number; total: number; fetched_at: string }>(),
      db.prepare("SELECT (SELECT COUNT(*) FROM prices) AS prices, (SELECT COUNT(*) FROM snapshots) AS snapshots, (SELECT COUNT(DISTINCT trade_date) FROM snapshots) AS days, (SELECT COUNT(*) FROM news) AS news, (SELECT COUNT(*) FROM events) AS events").first<Record<string, number>>(),
    ]);
    const tracked = yahooSymbols(await loadTrackedMembers(db));
    const sourceLinks: Record<string, string> = Object.fromEntries(Object.entries(tracked).map(([s, p]) => [s, yahooDisplayUrl(p)]));
    sourceLinks[VIX_SYMBOL] = CBOE_URLS.VIX;
    return {
      expected,
      // 只列目前追蹤的標的；從觀察名單移除的代號舊資料還在，但不再更新，不列入「是否過期」。
      freshness: freshness.results.filter((f) => f.symbol in sourceLinks).map((f) => ({ ...f, link: sourceLinks[f.symbol] })),
      mismatches: mismatches.results,
      runs: runs.results,
      weights: weights.results,
      weightsStale: weightsStaleNote(weights.results[0]?.as_of, expected),
      counts,
      jobs: JOB_NAMES,
      tolerance: { abs: CHECK_ABS_TOLERANCE, rel: CHECK_REL_TOLERANCE },
      calendar: NYSE_CALENDAR,
      links: { ssga: SSGA_DISPLAY_URL, cboeSpx: CBOE_URLS.SPX },
    };
  });
});

export const head = defineHead(() => ({ title: "資料來源" }));
