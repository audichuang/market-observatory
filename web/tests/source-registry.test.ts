import assert from "node:assert/strict";
import { test } from "node:test";
import { SOURCE_REGISTRY, sourceForUrl, type SourceRegistryEntry } from "../src/lib/sources/registry.ts";
import { FakeUpstream, migratedDb } from "./helpers/fake-cloudflare.ts";
import { FILLERS, FIVE, assertInvocation, consistentSpx, invokeCron, seededDb } from "./helpers/stress-env.ts";

test("五支排程與加入全站新公司的每個上游網址都列在 worker 清冊", async (t) => {
  const upstream = new FakeUpstream();
  const urls = new Set<string>();
  upstream.rules = [(url) => { urls.add(url.href); return null; }, consistentSpx];
  const restore = upstream.install();
  try {
    const { db, sql } = await seededDb();
    for (const cron of FIVE) assertInvocation(cron, await invokeCron(upstream, cron, db, sql));
    upstream.reset();
    const { addWatchSymbol } = await import("../src/server/jobs.ts");
    const added = await addWatchSymbol(db, FILLERS[20]);
    assert.ok(added.ok, JSON.stringify(added));
    assert.ok(upstream.count > 0, "全站新公司必須實際抓取日線");

    // APNs and Sign in with Apple are transport/authentication, not market data sources.
    const exceptions = new Set(["api.push.apple.com", "api.sandbox.push.apple.com", "appleid.apple.com"]);
    const covered = new Set<string>();
    for (const url of urls) {
      if (exceptions.has(new URL(url).hostname)) continue;
      const source = sourceForUrl(url);
      assert.ok(source, `上游網址未列入清冊：${url}`);
      assert.equal(source.runtime, "worker", url);
      covered.add(source.id);
    }
    assert.deepEqual([...covered].sort(), SOURCE_REGISTRY.filter((s) => s.runtime === "worker").map((s) => s.id).sort());
    t.diagnostic(`已檢查 ${urls.size} 個不同請求網址、${covered.size} 個 worker 來源`);
  } finally {
    restore();
  }
});

test("回補十年日線的每個實際來源都列出 backfill-prices 工作", async (t) => {
  const upstream = new FakeUpstream();
  const urls = new Set<string>();
  upstream.rules = [(url) => { urls.add(url.href); return null; }, consistentSpx];
  const restore = upstream.install();
  try {
    const { db } = await seededDb();
    const { runJob } = await import("../src/server/jobs.ts");
    // The seeded default watchlist has seven backfill parts; the last fetches VIX/SPX.
    for (let part = 0; part < 7; part++) {
      upstream.reset();
      const result = await runJob(db, "backfill-prices", "test", { part });
      assert.equal(result.status, "ok", result.summary);
      t.diagnostic(result.summary);
    }
    assert.deepEqual([...urls].filter((url) => sourceForUrl(url)?.id === "cboe-index").map((url) => new URL(url).pathname).sort(), [
      "/api/global/us_indices/daily_prices/SPX_History.csv",
      "/api/global/us_indices/daily_prices/VIX_History.csv",
    ]);
    for (const url of urls) {
      const source = sourceForUrl(url);
      assert.ok(source, `上游網址未列入清冊：${url}`);
      assert.equal(source.runtime, "worker", url);
      assert.ok(source.jobs.includes("backfill-prices"), `${source.id} 未列出 backfill-prices`);
    }
  } finally {
    restore();
  }
});

test("Cboe 停用影響明列回補十年日線最後一段的 VIX／SPX", () => {
  const cboe = SOURCE_REGISTRY.find((s) => s.id === "cboe-index")!;
  assert.match(cboe.disableImpact, /回補十年日線.*最後一段.*VIX.*SPX/);
});

test("Nasdaq 分析師逐欄揭露已保存、目前顯示與 L6 #10 預定顯示，版本日維持未核實", () => {
  const analyst = SOURCE_REGISTRY.find((s) => s.id === "nasdaq-analyst")!;
  const fields = new Map(analyst.fields.map((f) => [f.name, f.usage]));
  for (const name of ["priceTarget", "buy", "hold", "sell"]) assert.match(fields.get(name)!, /顯示中/, name);
  for (const name of ["lowPriceTarget", "highPriceTarget", "fiscalEnd", "consensusEPSForecast", "noOfEstimates"]) {
    assert.match(fields.get(name)!, /已存未顯示.*L6 #10 預定顯示/, name);
  }
  for (const name of ["up", "down"]) assert.match(fields.get(name)!, /彙總顯示中.*L6 #10 預定顯示逐股/, name);
  const notes = analyst.notes.join(" ");
  assert.match(notes, /已在抓、已存於 analyst_views/);
  assert.match(notes, /L6 #10 只改顯示/);
  assert.match(notes, /歷月共識未抓取/);
  for (const source of SOURCE_REGISTRY.filter((s) => s.id.startsWith("nasdaq-"))) {
    assert.equal(source.terms[0].versionDate, null, source.id);
    assert.match(source.terms[0].versionNote, /V-B #15 未親見 2026-05-11/, source.id);
  }
  for (const id of ["yahoo-chart", "yahoo-news-local"]) {
    const terms = SOURCE_REGISTRY.find((s) => s.id === id)!.terms[0];
    assert.equal(terms.versionDate, "2026-08-04");
    assert.match(terms.versionNote, /沿前輪 2026-08-04 版，本輪未重核/);
  }
  const cboe = SOURCE_REGISTRY.find((s) => s.id === "cboe-index")!;
  assert.equal(cboe.terms[0].versionDate, "2022-11-16");
  assert.match(cboe.rights.derivation.basis, /核對或更正他源資料/);
  const zacks = SOURCE_REGISTRY.find((s) => s.id === "nasdaq-earnings")!.terms[1];
  assert.equal(zacks.versionDate, "2025-02-19");
});

test("sources loader 只需 env.DB，回傳完整靜態清冊、不送 RegExp 或 email", async () => {
  const { db } = await migratedDb();
  const { loader } = await import("../pages/sources.server.ts");
  const out = await (loader as unknown as (c: unknown) => Promise<{ registry: Omit<SourceRegistryEntry, "patterns">[] }>)({ env: { DB: db } });
  assert.ok(Array.isArray(out.registry), "loader 必須回傳 registry");
  assert.deepEqual(out.registry, SOURCE_REGISTRY.map(({ patterns: _patterns, ...source }) => source));
  assert.ok(out.registry.every((source) => !("patterns" in source)), "不得將 RegExp 塞入 props");
  assert.deepEqual(JSON.parse(JSON.stringify(out.registry)), out.registry, "props 必須可完整 JSON 序列化");
  assert.ok(!JSON.stringify(out).includes("@"));
});

test("sourceForUrl 分開 Nasdaq analyst 與 earnings，local 網址不算 worker，未知路徑不命中", () => {
  const samples = [
    ["https://api.nasdaq.com/api/analyst/BRK.B/targetprice", "nasdaq-analyst"],
    ["https://api.nasdaq.com/api/analyst/AAPL/earnings-forecast", "nasdaq-analyst"],
    ["https://api.nasdaq.com/api/analyst/AAPL/earnings-date", "nasdaq-earnings"],
    ["https://query2.finance.yahoo.com/v1/finance/search?q=AAPL", "yahoo-news-local"],
    ["https://finance.yahoo.com/news/example-123.html", "yahoo-news-local"],
    ["https://finance.yahoo.com/markets/stocks/articles/example-123.html", "yahoo-news-local"],
    ["https://advantage.factset.com/hubfs/Website/Resources%20Section/Research%20Desk/Earnings%20Insight/EarningsInsight_102326.pdf", "factset-insight"],
  ];
  for (const [url, id] of samples) assert.equal(sourceForUrl(url)?.id, id, url);
  assert.equal(sourceForUrl(samples[3][0])?.runtime, "local");
  for (const url of [
    "https://unknown.example/data", "https://api.nasdaq.com/api/analyst/AAPL/new-endpoint",
    "https://query1.finance.yahoo.com/v1/new-data", "https://api.nasdaq.com.evil.example/api/analyst/AAPL/targetprice",
  ]) assert.equal(sourceForUrl(url), undefined, url);
});

test("清冊涵蓋 14 個來源，逐項保留用途、五項權利與條款查核依據", () => {
  assert.deepEqual(SOURCE_REGISTRY.map((s) => s.id).sort(), [
    "yahoo-chart", "cboe-index", "nasdaq-quote", "nasdaq-news", "nasdaq-analyst", "nasdaq-earnings",
    "ssga-holdings", "factset-insight", "yahoo-news-local", "nyse-calendar", "fed-fomc", "bls-schedule", "etf-catalog", "strategists",
  ].sort());
  const rights = ["automatedAcquisition", "storage", "publicDisplay", "derivation", "aiProcessing"];
  const statuses = new Set(["未取得（條款限制）", "官方公開，需標示來源", "未查", "不適用"]);
  for (const source of SOURCE_REGISTRY) {
    assert.ok(source.name && source.jobs.length && source.screens.length && source.fields.length && source.disableImpact, source.id);
    assert.ok(source.evidence.length, source.id);
    assert.equal(source.reviewedOn, "2026-10-28", source.id);
    assert.deepEqual(Object.keys(source.rights).sort(), [...rights].sort(), source.id);
    for (const right of Object.values(source.rights)) {
      assert.ok(statuses.has(right.status), `${source.id}: ${right.status}`);
      assert.ok(right.basis.trim(), source.id);
    }
    if (source.runtime === "worker" || source.runtime === "local") assert.ok(source.terms.length, source.id);
    for (const term of source.terms) {
      if (term.url !== null) assert.match(term.url, /^https:\/\//, source.id);
      else assert.ok(source.runtime === "static" || source.runtime === "manual", source.id);
      if (term.versionDate === null) assert.ok(term.versionNote.trim(), `${source.id}: 未核實版本日必須有原因`);
      else assert.match(term.versionDate, /^\d{4}-\d{2}-\d{2}$/, source.id);
    }
  }
});
