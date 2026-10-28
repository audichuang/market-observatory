import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import * as http from "../src/lib/sources/http.ts";
import { FakeUpstream } from "./helpers/fake-cloudflare.ts";
import { FILLERS, assertInvocation, consistentSpx, invokeCron, seededDb } from "./helpers/stress-env.ts";
import { putSetting } from "../src/server/repo.ts";
import { dataVersion } from "../src/server/page-cache.ts";

test("Budget 停用規則在扣額度前拒絕來源，未命中照常請求，整組取代後可恢復", () => {
  const budget = new http.Budget(2);
  const url = "https://www.nasdaq.com/api/news/topic/articlebysymbol?q=AAPL";
  budget.block([{ id: "nasdaq-news", label: "Nasdaq 新聞", patterns: [/^https:\/\/www\.nasdaq\.com\/api\/news\//] }]);
  assert.throws(() => budget.take(url), (error) => {
    assert.ok(error instanceof http.SourceDisabledError);
    assert.equal(error.message, "來源已停用：Nasdaq 新聞，未請求 www.nasdaq.com");
    return true;
  });
  assert.equal(budget.used, 0);
  assert.deepEqual(budget.byHost, {});
  budget.take("https://api.nasdaq.com/api/analyst/AAPL/targetprice");
  assert.equal(budget.used, 1);
  budget.block([]);
  budget.take(url);
  assert.equal(budget.used, 2);
  budget.block([{ id: "nasdaq-news", label: "Nasdaq 新聞", patterns: [/^https:\/\/www\.nasdaq\.com\/api\/news\//] }]);
  assert.throws(() => budget.take(url), http.SourceDisabledError, "額度用盡仍要先辨認停用來源");
  assert.equal(budget.used, 2);
});

test("停用 Nasdaq 核對與新聞後零請求且保留舊資料，分析師仍更新，恢復後下一輪重抓", async (t) => {
  const upstream = new FakeUpstream();
  const urls: URL[] = [];
  upstream.rules = [(url) => { urls.push(url); return null; }, consistentSpx];
  const restore = upstream.install();
  try {
    const { db, sql } = await seededDb();
    for (const name of ["prices", "crosscheck", "news"]) await invokeCron(upstream, name, db, sql);
    const checks = () => sql.prepare("SELECT symbol, date, check_close, check_source, check_status FROM prices ORDER BY symbol, date").all();
    const news = () => sql.prepare("SELECT * FROM news ORDER BY id").all();
    const oldChecks = checks();
    const oldNews = news();
    assert.ok(oldChecks.length > 0 && oldNews.length > 0, "先準備已存資料");
    await putSetting(db, "source_switches", {
      "nasdaq-quote": { disabled: true, at: new Date().toISOString() },
      "nasdaq-news": { disabled: true, at: new Date().toISOString() },
    });
    urls.length = 0;
    const crosscheck = await invokeCron(upstream, "crosscheck", db, sql);
    const newsRun = await invokeCron(upstream, "news", db, sql);
    assertInvocation("停用核對", crosscheck, { strictJobs: false });
    assertInvocation("停用新聞", newsRun, { strictJobs: false });
    assert.ok(!urls.some((url) => /\/api\/(quote|news)\//.test(url.pathname)), urls.map(String).join("\n"));
    assert.match(crosscheck.runs[0].summary, /來源已停用：Nasdaq 歷史行情核對/);
    assert.match(newsRun.runs.find((run) => run.job === "news")!.summary, /來源已停用：Nasdaq 新聞/);
    assert.ok(urls.some((url) => url.pathname.startsWith("/api/analyst/")), "只停指定來源，分析師照常抓");
    assert.equal(newsRun.runs.find((run) => run.job === "analysts")!.status, "ok");
    assert.ok(!newsRun.runs.find((run) => run.job === "analysts")!.summary.includes("來源已停用"), "共用 Budget 的下一個工作不得帶入前一個工作的停用訊息");
    assert.deepEqual(checks(), oldChecks);
    assert.deepEqual(news(), oldNews);
    t.diagnostic(`停用：crosscheck ${crosscheck.requests} 個、news 排程 ${newsRun.requests} 個實打請求；核對與新聞資料保留`);
    await putSetting(db, "source_switches", {});
    urls.length = 0;
    const resumed = await invokeCron(upstream, "crosscheck", db, sql);
    assertInvocation("恢復核對", resumed);
    assert.ok(urls.some((url) => url.pathname.startsWith("/api/quote/")));
    t.diagnostic(`恢復：crosscheck ${resumed.requests} 個請求`);
  } finally {
    restore();
  }
});

test("Yahoo chart 停用時加入全站新公司失敗，零 Yahoo 請求且名單與價格不變", async () => {
  const upstream = new FakeUpstream();
  const restore = upstream.install();
  try {
    const { db, sql } = await seededDb();
    await putSetting(db, "source_switches", { "yahoo-chart": { disabled: true, at: new Date().toISOString() } });
    const { addWatchSymbol } = await import("../src/server/jobs.ts");
    const { loadWatchlist } = await import("../src/server/watchlist.ts");
    const before = await loadWatchlist(db);
    const result = await addWatchSymbol(db, FILLERS[20]);
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error : "", /來源已停用/);
    assert.equal(upstream.count, 0);
    assert.deepEqual(await loadWatchlist(db), before);
    assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM prices").get() as { n: number }).n, 0);
  } finally {
    restore();
  }
});

test("來源開關 API 只允許站長切換 worker，驗證輸入、讀回停用與恢復並更新資料版本", async () => {
  const { db, sql } = await seededDb();
  const { GET, POST } = await import("../routes/api/admin/sources.ts");
  const app = new Hono<{ Bindings: { DB: D1Database; OWNER_EMAIL: string }; Variables: { user: { id: string; email: string } } }>();
  app.use("*", async (c, next) => {
    const id = c.req.header("x-test-user") ?? "owner";
    c.set("user", { id, email: `${id}@example.test` });
    await next();
  });
  app.get("/api/admin/sources", GET as never);
  app.post("/api/admin/sources", POST as never);
  const request = (body?: unknown, user = "owner") => app.request("http://localhost/api/admin/sources", {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-test-user": user },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }, { DB: db, OWNER_EMAIL: "owner@example.test" });
  const denied = await request({ id: "nasdaq-news", disabled: true }, "member");
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: "只有站長能執行" });
  assert.equal((await request(undefined, "member")).status, 403);
  for (const id of ["unknown", "yahoo-news-local", "nyse-calendar", "strategists"]) {
    assert.equal((await request({ id, disabled: true })).status, 400, id);
  }
  for (const body of [
    { id: "nasdaq-news", disabled: "true" },
    { id: "nasdaq-news", disabled: true, reason: "字".repeat(201) },
    { disabled: true },
  ]) assert.equal((await request(body)).status, 400, JSON.stringify(body));
  assert.equal(await dataVersion(db), "0", "拒絕的操作不得更新版本");
  const before = Number(await dataVersion(db));
  const disabled = await request({ id: "nasdaq-news", disabled: true, reason: "暫停自動取得" });
  assert.equal(disabled.status, 200);
  const saved = await disabled.json() as { switches: Record<string, { disabled: boolean; at: string; reason: string }> };
  assert.deepEqual(Object.keys(saved.switches), ["nasdaq-news"]);
  assert.equal(saved.switches["nasdaq-news"].disabled, true);
  assert.equal(saved.switches["nasdaq-news"].reason, "暫停自動取得");
  assert.ok(Number.isFinite(Date.parse(saved.switches["nasdaq-news"].at)));
  assert.ok(Number(await dataVersion(db)) > before);
  assert.deepEqual(await (await request()).json(), saved);
  const { loader } = await import("../pages/sources.server.ts");
  const loadPage = loader as unknown as (c: unknown) => Promise<{ switches: unknown }>;
  assert.deepEqual((await loadPage({ env: { DB: db } })).switches, saved.switches, "頁面讀回停用時間與狀態，loader 不需使用者 context");
  const setting = sql.prepare("SELECT value FROM settings WHERE key = 'source_switches'").get() as { value: string };
  assert.ok(!setting.value.includes("@"), "不存操作者 email");
  const restored = await request({ id: "nasdaq-news", disabled: false });
  assert.equal(restored.status, 200);
  assert.deepEqual(await restored.json(), { switches: {} });
  assert.deepEqual(await (await request()).json(), { switches: {} });
  assert.deepEqual((await loadPage({ env: { DB: db } })).switches, {});
});
