import assert from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { runJob } from "../src/server/jobs.ts";
import { replaceWeights } from "../src/server/repo.ts";
import { FakeUpstream, migratedDb } from "./helpers/fake-cloudflare.ts";

const AS_OF = "2026-10-27";
const FIRST_FETCH = "2026-10-28T11:30:00.000Z";
const NEXT_FETCH = "2026-10-28T12:30:00.000Z";
const holding = (ticker: string, weightPct = 0.2) => ({ ticker, name: `Company ${ticker}`, weightPct, shares: 100 });
const holdings505 = () => Array.from({ length: 505 }, (_, i) => holding(`SYN${i + 1}`));
const FINAL_URL = "https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx";

function holdingsXlsx(holdings: ReturnType<typeof holding>[]) {
  const rows = [
    ["Holdings: As of 27-Oct-2026"],
    ["Name", "Ticker", "Weight", "Shares Held"],
    ...holdings.map((h) => [h.name, h.ticker, h.weightPct, h.shares]),
  ];
  const sheet = `<worksheet><sheetData>${rows.map((row, i) =>
    `<row r="${i + 1}">${row.map((value, col) =>
      `<c r="${String.fromCharCode(65 + col)}${i + 1}" t="inlineStr"><is><t>${value}</t></is></c>`,
    ).join("")}</row>`,
  ).join("")}</sheetData></worksheet>`;
  return zipSync({ "xl/worksheets/sheet1.xml": strToU8(sheet) });
}

test("同一持股日更正會移除新版消失的代號並回傳差異（V-B #9）", async (t) => {
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  await replaceWeights(db, AS_OF, [holding("SYN1"), holding("SYN2")], FIRST_FETCH);
  await replaceWeights(db, "2026-10-26", [holding("SYN1"), holding("SYN2")], FIRST_FETCH);
  const correction = await replaceWeights(db, AS_OF, [holding("SYN1")], NEXT_FETCH);
  assert.deepEqual(sql.prepare("SELECT ticker FROM weights WHERE as_of = ? ORDER BY ticker").all(AS_OF).map((r) => r.ticker), ["SYN1"]);
  assert.deepEqual(correction, { previous: 2, removed: ["SYN2"], added: [], changed: 0, previousFetchedAt: FIRST_FETCH });
  assert.deepEqual(sql.prepare("SELECT ticker FROM weights WHERE as_of = '2026-10-26' ORDER BY ticker").all().map((r) => r.ticker), ["SYN1", "SYN2"]);
});

test("更正版末列違反 NOT NULL 時，刪除與先前寫入都回滾，保留第一版完整集合", async (t) => {
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  const first = [...holdings505(), holding("REMOVED")];
  await replaceWeights(db, AS_OF, first, FIRST_FETCH);
  const rows = () => sql.prepare("SELECT * FROM weights WHERE as_of = ? ORDER BY ticker").all(AS_OF);
  const before = rows();
  const invalid = holdings505().map((h) => ({ ...h, name: `Corrected ${h.name}`, weightPct: 0.3 }));
  invalid[504].name = null as unknown as string;
  await assert.rejects(() => replaceWeights(db, AS_OF, invalid, NEXT_FETCH), /NOT NULL/);
  assert.deepEqual(rows(), before);
});

test("持股內容相同（即使順序不同）不呼叫 batch，也保留原 fetched_at", async (t) => {
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  const first = [holding("SYN1"), { ...holding("SYN2"), shares: null }];
  await replaceWeights(db, AS_OF, first, FIRST_FETCH);
  const calls: D1PreparedStatement[][] = [];
  const observed = {
    prepare: db.prepare,
    async batch<T>(stmts: D1PreparedStatement[]) {
      calls.push(stmts);
      return db.batch<T>(stmts);
    },
  };
  const result = await replaceWeights(observed, AS_OF, [...first].reverse(), NEXT_FETCH);
  assert.equal(calls.length, 0);
  assert.deepEqual(result, { unchanged: true });
  assert.deepEqual(sql.prepare("SELECT DISTINCT fetched_at FROM weights WHERE as_of = ?").all(AS_OF).map((r) => r.fetched_at), [FIRST_FETCH]);
});

test("505 檔替換只用一次 batch，INSERT 每句最多 16 列、全部查詢至多 100 個參數", async (t) => {
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  await replaceWeights(db, AS_OF, [holding("OLD1"), holding("OLD2")], FIRST_FETCH);
  const parameters: number[] = [];
  const batches: D1PreparedStatement[][] = [];
  const observed = {
    prepare(query: string) {
      assert.doesNotMatch(query, /NOT IN/i);
      const stmt = db.prepare(query);
      const bind = stmt.bind.bind(stmt);
      stmt.bind = (...args: unknown[]) => {
        parameters.push(args.length);
        return bind(...args);
      };
      return stmt;
    },
    async batch<T>(stmts: D1PreparedStatement[]) {
      batches.push(stmts);
      return db.batch<T>(stmts);
    },
  };
  const result = await replaceWeights(observed, AS_OF, holdings505(), NEXT_FETCH);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 34); // Two deletes and 32 multi-row inserts.
  assert.deepEqual(parameters, [1, 2, 2, ...Array(31).fill(96), 54]);
  assert.ok(parameters.every((n) => n <= 100));
  assert.deepEqual(result.removed, ["OLD1", "OLD2"]);
  assert.equal(result.added?.length, 505);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM weights WHERE as_of = ?").get(AS_OF)?.n, 505);
});

test("weights 工作直接請求最終網址一次，同日更正與相同內容都記入 runs", async (t) => {
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  const fresh = Array.from({ length: 500 }, (_, i) => holding(`SYN${i + 1}`));
  await replaceWeights(db, AS_OF, [...fresh.slice(0, 499), holding("REMOVED")], FIRST_FETCH);
  fresh[0].weightPct = 0.3;
  fresh[499].weightPct = 0.1;
  const upstream = new FakeUpstream();
  const requested: string[] = [];
  upstream.rules = [(url) => {
    if (url.host !== "www.ssga.com") return null;
    requested.push(url.href);
    if (url.pathname.startsWith("/us/en/intermediary/library-content/")) {
      return new Response(null, { status: 301, headers: { location: FINAL_URL } });
    }
    if (url.href === FINAL_URL) return new Response(holdingsXlsx(fresh));
    return null;
  }];
  t.after(upstream.install());
  const corrected = await runJob(db, "weights", "test");
  assert.equal(corrected.status, "ok", corrected.summary);
  assert.equal(upstream.hosts["www.ssga.com"], 1);
  assert.deepEqual(requested, [FINAL_URL]);
  assert.equal(corrected.detail.subrequests, 1);
  const correction = { previous: 500, removed: ["REMOVED"], added: ["SYN500"], changed: 1, previousFetchedAt: FIRST_FETCH };
  assert.match(corrected.summary, /持股日期 2026-10-27（500 檔）；同日更正：移除 REMOVED；新增 SYN500；權重變動 1 檔/);
  assert.ok(corrected.summary.includes(`上一版取得於 ${FIRST_FETCH}`));
  assert.deepEqual((corrected.detail as Record<string, unknown>).correction, correction);
  const stored = sql.prepare("SELECT summary, detail FROM runs WHERE id = ?").get(corrected.id)!;
  assert.equal(stored.summary, corrected.summary);
  assert.deepEqual(JSON.parse(stored.detail as string).correction, correction);
  const timestamps = () => sql.prepare("SELECT DISTINCT fetched_at FROM weights WHERE as_of = ?").all(AS_OF).map((r) => r.fetched_at);
  const fetched = timestamps();
  assert.equal(fetched.length, 1);
  assert.notDeepEqual(fetched, [FIRST_FETCH]);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM weights WHERE ticker = 'REMOVED'").get()?.n, 0);
  t.diagnostic(`更正紀錄：${corrected.summary}；subrequests=${corrected.detail.subrequests}`);

  upstream.reset();
  requested.length = 0;
  const same = await runJob(db, "weights", "test");
  assert.equal(same.status, "ok", same.summary);
  assert.match(same.summary, /持股日期 2026-10-27（500 檔）；已存在、內容相同/);
  assert.deepEqual((same.detail as Record<string, unknown>).correction, { unchanged: true });
  assert.deepEqual(timestamps(), fetched);
  assert.equal(upstream.hosts["www.ssga.com"], 1);
  assert.deepEqual(requested, [FINAL_URL]);
  assert.equal(same.detail.subrequests, 1);
  assert.equal(sql.prepare("SELECT summary FROM runs WHERE id = ?").get(same.id)?.summary, same.summary);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM runs WHERE job = 'weights'").get()?.n, 2);
  t.diagnostic(`相同內容紀錄：${same.summary}；subrequests=${same.detail.subrequests}`);
});
