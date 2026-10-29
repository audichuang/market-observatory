import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { fetchCboeDaily } from "../src/lib/sources/cboe.ts";
import { Budget, SourceError } from "../src/lib/sources/http.ts";
import { fetchYahooDaily, fetchYahooSpark } from "../src/lib/sources/yahoo.ts";
import { addWatchSymbol, runJob } from "../src/server/jobs.ts";
import { loadWatchlist } from "../src/server/watchlist.ts";
import { chartResult, FakeUpstream, weekdays } from "./helpers/fake-cloudflare.ts";
import { seededDb } from "./helpers/stress-env.ts";

let upstream: FakeUpstream;
let restore: () => void;
beforeEach(() => {
  upstream = new FakeUpstream();
  restore = upstream.install();
});
afterEach(() => restore());

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

function conflictingChart(symbol: string, days: string[]) {
  const chart = chartResult(symbol, days, false);
  const i = Math.floor(days.length / 2);
  chart.timestamp.splice(i + 1, 0, chart.timestamp[i] + 60);
  for (const values of Object.values(chart.indicators.quote[0])) values?.splice(i + 1, 0, values[i]);
  chart.indicators.quote[0].close[i + 1] += 10;
  return chart;
}

test("加入新公司：空十年歷史回報抓不到，名單與價格都不寫入", async () => {
  const { db, sql } = await seededDb();
  const before = await loadWatchlist(db);
  upstream.rules = [(u) => u.pathname === "/v8/finance/chart/QAA" && u.searchParams.get("range") === "10y"
    ? json({ chart: { result: [chartResult("QAA", [], false)] } }) : null];
  const result = await addWatchSymbol(db, "QAA");
  assert.equal(result.ok, false, JSON.stringify(result));
  if (!result.ok) assert.match(result.error, /抓不到 QAA 的歷史股價.*回應沒有任何日線/);
  assert.deepEqual(await loadWatchlist(db), before);
  assert.deepEqual(sql.prepare("SELECT date FROM prices WHERE symbol = 'QAA'").all(), []);
});

test("crosscheck：Nasdaq 空歷史列為該檔失敗", async () => {
  const { db } = await seededDb();
  upstream.rules = [(u) => u.pathname === "/api/quote/NVDA/historical"
    ? json({ data: { tradesTable: { rows: [] } } }) : null];
  const result = await runJob(db, "crosscheck", "test");
  assert.ok("failed" in result.detail);
  assert.match((result.detail.failed as Record<string, string>).NVDA, /回應沒有任何日線/);
  assert.equal(result.status, "partial");
});

test("Cboe：since 之後沒有日線時拒收整份回應", async () => {
  upstream.rules = [(u) => u.host === "cdn-api.cboe.com"
    ? new Response("DATE,SPX\n10/21/2026,30\n") : null];
  await assert.rejects(fetchCboeDaily("SPX", "2026-10-22"), (e) => e instanceof SourceError && /2026-10-22 之後沒有資料/.test(e.message));
});

test("prices：spark 500 逐檔補抓正常為 ok，中段衝突只略過當天並記為 partial", async (t) => {
  const sparkDown = (u: URL) => u.pathname === "/v7/finance/spark" ? new Response("failed", { status: 500 }) : null;
  upstream.rules = [sparkDown];
  const control = await seededDb();
  const clean = await runJob(control.db, "prices", "test");
  assert.equal(clean.status, "ok", clean.summary);
  assert.doesNotMatch(clean.summary, /未採用/);

  const { db } = await seededDb();
  const days = weekdays(22);
  const chart = conflictingChart("NVDA", days);
  upstream.rules = [sparkDown, (u) => u.pathname === "/v8/finance/chart/NVDA" && u.searchParams.get("range") === "1mo"
    ? json({ chart: { result: [chart] } }) : null];
  const result = await runJob(db, "prices", "test");
  assert.equal(result.status, "partial", result.summary);
  const issues = result.detail.dataIssues;
  assert.equal(issues.length, 1);
  assert.match(issues[0], /yahoo-chart NVDA .*兩筆不同收盤/);
  assert.match(result.summary, /1 筆日線同日兩筆不同收盤、未採用/);
  const prices = await db.prepare("SELECT date FROM prices WHERE symbol = 'NVDA' ORDER BY date").all<{ date: string }>();
  assert.deepEqual(prices.results.map((r) => r.date), days.filter((d) => d !== days[11]));
  const saved = await db.prepare("SELECT status, summary, detail FROM runs WHERE id = ?").bind(result.id).first<{ status: string; summary: string; detail: string }>();
  assert.equal(saved!.status, result.status);
  assert.equal(saved!.summary, result.summary);
  assert.deepEqual(JSON.parse(saved!.detail).dataIssues, issues);
  t.diagnostic(`對照=${clean.status}；衝突=${result.status}；${issues[0]}`);
});

test("加入新公司：十年歷史中段衝突仍加入，提示略過天數與日期且其他日線都在", async () => {
  const { db } = await seededDb();
  const days = weekdays(260);
  const chart = conflictingChart("QAA", days);
  upstream.rules = [(u) => u.pathname === "/v8/finance/chart/QAA" && u.searchParams.get("range") === "10y"
    ? json({ chart: { result: [chart] } }) : null];
  const budget = new Budget(1000);
  budget.dataIssues.push("yahoo-chart OTHER 2026-01-01 有兩筆不同收盤（1、2），這天的資料不採用");
  const result = await addWatchSymbol(db, "QAA", budget);
  assert.ok(result.ok, JSON.stringify(result));
  assert.match(result.summary, new RegExp(`略過 1 天同日兩筆不同收盤的日線（${days[130]}）`));
  assert.doesNotMatch(result.summary, /2026-01-01/);
  assert.ok((await loadWatchlist(db)).some((m) => m.key === "QAA"));
  const prices = await db.prepare("SELECT date FROM prices WHERE symbol = 'QAA' ORDER BY date").all<{ date: string }>();
  assert.deepEqual(prices.results.map((r) => r.date), days.filter((d) => d !== days[130]));
});

test("crosscheck：Nasdaq 衝突日不核對並留下來源紀錄", async () => {
  const { db } = await seededDb();
  assert.equal((await runJob(db, "prices", "test")).status, "ok");
  const days = weekdays(3);
  const mdy = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
  upstream.rules = [(u) => u.pathname === "/api/quote/NVDA/historical"
    ? json({ data: { tradesTable: { rows: [
      { date: mdy(days[0]), close: "10" }, { date: mdy(days[1]), close: "20" },
      { date: mdy(days[1]), close: "30" }, { date: mdy(days[2]), close: "40" },
    ] } } }) : null];
  const result = await runJob(db, "crosscheck", "test");
  assert.deepEqual(result.detail.dataIssues, [`nasdaq NVDA ${days[1]} 有兩筆不同收盤（20、30），這天的資料不採用`]);
  assert.equal(result.status, "partial");
  const prices = await db.prepare("SELECT date, check_status FROM prices WHERE symbol = 'NVDA' AND date >= ? ORDER BY date").bind(days[0]).all<{ date: string; check_status: string | null }>();
  assert.deepEqual(prices.results.map((r) => [r.date, r.check_status]), [[days[0], "mismatch"], [days[1], null], [days[2], "mismatch"]]);
});

test("Cboe：衝突日不採用，budget 紀錄來源與 VIX／SPX 代號", async () => {
  upstream.rules = [(u) => u.host === "cdn-api.cboe.com"
    ? new Response("DATE,SPX\n10/21/2026,5\n10/22/2026,10\n10/22/2026,20\n") : null];
  for (const symbol of ["VIX", "SPX"] as const) {
    const budget = new Budget(10);
    const bars = await fetchCboeDaily(symbol, "2026-10-21", budget);
    assert.deepEqual(bars.map((b) => b.date), ["2026-10-21"]);
    assert.deepEqual(budget.dataIssues, [`cboe ${symbol} 2026-10-22 有兩筆不同收盤（10、20），這天的資料不採用`]);
  }
});

test("Yahoo spark：只記錄有保留的請求代號，使用 ^GSPC、TWD=X、BRK-B 原名", async () => {
  const symbols = ["^GSPC", "TWD=X", "BRK-B"];
  const days = weekdays(3);
  upstream.rules = [(u) => u.pathname === "/v7/finance/spark" ? json({ spark: { result: [
    ...[...symbols, "EXTRA"].map((symbol) => ({ symbol, response: [conflictingChart(symbol, days)] })),
    { symbol: "EMPTY", response: [chartResult("EMPTY", [], true)] },
    { symbol: "WRONG", response: [{ ...conflictingChart("WRONG", days), meta: { symbol: "WRONG", dataGranularity: "3mo" } }] },
  ] } }) : null];
  const budget = new Budget(10);
  const { bars, errors } = await fetchYahooSpark([...symbols, "EMPTY", "WRONG"], "1mo", budget);
  assert.deepEqual([...bars.keys()], symbols);
  assert.deepEqual(errors, []);
  assert.deepEqual(budget.dataIssues, symbols.map((s) => {
    const closes = conflictingChart(s, days).indicators.quote[0].close;
    return `yahoo-chart ${s} ${days[1]} 有兩筆不同收盤（${closes[1]}、${closes[2]}），這天的資料不採用`;
  }));
  for (const s of symbols) assert.deepEqual(bars.get(s)!.map((b) => b.date), [days[0], days[2]]);
});

test("Yahoo chart：衝突紀錄使用請求代號原名", async () => {
  const days = weekdays(3);
  upstream.rules = [(u) => u.pathname.startsWith("/v8/finance/chart/")
    ? json({ chart: { result: [conflictingChart(decodeURIComponent(u.pathname.split("/").at(-1)!), days)] } }) : null];
  for (const symbol of ["^GSPC", "TWD=X", "BRK-B"]) {
    const budget = new Budget(10);
    assert.equal((await fetchYahooDaily(symbol, "1mo", budget)).length, 2);
    assert.equal(budget.dataIssues.length, 1);
    assert.ok(budget.dataIssues[0].startsWith(`yahoo-chart ${symbol} ${days[1]} 有兩筆不同收盤`));
  }
});

test("runJob：共用 Budget 只記本次新增衝突，摘要最多列三筆並保留完整 detail", async () => {
  const { db } = await seededDb();
  const days = weekdays(4);
  const rows = days.flatMap((d) => [10, 20].map((close) => ({ date: `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`, close: String(close) })));
  upstream.rules = [(u) => u.pathname === "/api/quote/NVDA/historical" ? json({ data: { tradesTable: { rows } } }) : null];
  const budget = new Budget(1000);
  budget.dataIssues.push("前一個工作的衝突");
  const result = await runJob(db, "crosscheck", "test", {}, budget);
  assert.equal(result.status, "partial");
  assert.equal(result.detail.dataIssues.length, 4);
  assert.match(result.summary, /4 筆日線同日兩筆不同收盤、未採用：/);
  for (const date of days.slice(0, 3)) assert.ok(result.summary.includes(date));
  assert.ok(!result.summary.includes(days[3]));
  assert.ok(result.summary.endsWith("…"));
  assert.doesNotMatch(result.summary, /前一個工作/);
  assert.ok("failed" in result.detail);
  assert.match((result.detail.failed as Record<string, string>).NVDA, /回應沒有任何日線/);

  const next = await runJob(db, "news", "test", {}, budget);
  assert.equal(next.status, "ok", next.summary);
  assert.deepEqual(next.detail.dataIssues, []);
  assert.doesNotMatch(next.summary, /未採用/);
});

test("runJob：抓取後例外仍保存本次 dataIssues，failed 狀態不變", async () => {
  const { db, sql } = await seededDb();
  upstream.rules = [(u) => u.pathname === "/api/quote/NVDA/historical" ? json({ data: { tradesTable: { rows: [
    { date: "10/21/2026", close: "10" }, { date: "10/21/2026", close: "20" },
    { date: "10/22/2026", close: "30" },
  ] } } }) : null];
  // Fail at the database boundary after the fetch has recorded the conflict.
  sql.prepare("DROP TABLE prices").run();
  const budget = new Budget(1000);
  budget.dataIssues.push("前一個工作的衝突");
  const result = await runJob(db, "crosscheck", "test", {}, budget);
  assert.equal(result.status, "failed");
  assert.match(result.summary, /no such table: prices/);
  assert.deepEqual(result.detail.dataIssues, ["nasdaq NVDA 2026-10-21 有兩筆不同收盤（10、20），這天的資料不採用"]);
  const saved = await db.prepare("SELECT detail FROM runs WHERE id = ?").bind(result.id).first<{ detail: string }>();
  assert.deepEqual(JSON.parse(saved!.detail).dataIssues, result.detail.dataIssues);
});
