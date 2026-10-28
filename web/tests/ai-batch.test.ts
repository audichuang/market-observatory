// 新聞 AI 排程（src/server/ai-batch.ts）：待辦只給還沒做的、答案驗證後寫進 D1、格式不對的略過，大盤那段存成 SPX。
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Hono } from "hono";
import { GET, POST } from "../routes/api/admin/ai.ts";
import type { Task } from "../scripts/ai-batch-lib.ts";
import { easternDate } from "../src/lib/calendar.ts";
import { Series } from "../src/lib/analytics.ts";
import { buildSnapshot } from "../src/lib/snapshot.ts";
import { DEFAULT_WATCHLIST } from "../src/lib/universe.ts";
import { marketPrompt } from "../src/lib/news-ai.ts";
import { type ImportReceipt, MARKET_KEY, dailyWork, importResults, translateWork } from "../src/server/ai-batch.ts";
import { saveSnapshots } from "../src/server/repo.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

const D1 = "2026-10-22";
const D2 = "2026-10-23";

async function seeded() {
  const { db, sql } = await migratedDb();
  const ins = sql.prepare("INSERT INTO news (id, symbols, title, url, publisher, published_at, source, fetched_at, published_ago, summary, primary_symbol) VALUES (?, ?, ?, ?, 'p', ?, 'nasdaq', '2026-10-23T18:00:00Z', '2 hours ago', ?, ?)");
  ins.run("n1", "SPY,NVDA", "Nvidia beats estimates", "https://e.com/n1", D2, "Rev up", "NVDA");
  ins.run("n2", "NVDA", "3 AI Stocks to Buy", "https://e.com/n2", D2, null, "DELL");
  ins.run("n3", "SPY", "Fed holds rates", "https://e.com/n3", D2, null, null);
  ins.run("old", "NVDA", "Old news", "https://e.com/old", "2026-01-02", null, "NVDA");
  const series = {
    SPX: new Series([{ date: D1, close: 7600 }, { date: D2, close: 7560 }]),
    NVDA: new Series([{ date: D1, close: 200 }, { date: D2, close: 190 }]),
  };
  const members = DEFAULT_WATCHLIST.filter((m) => m.key === "NVDA");
  const snap = buildSnapshot({ tradeDate: D2, series, checks: {}, weights: { asOf: D1, byTicker: new Map([["NVDA", 8]]) }, members })!;
  await saveSnapshots(db, [snap], "測試");
  return { db, sql };
}

async function timingSeeded() {
  const { db, sql } = await seeded();
  sql.prepare("DELETE FROM news").run();
  const ins = sql.prepare("INSERT INTO news (id, symbols, title, title_zh, url, publisher, published_at, source, fetched_at, published_ago, summary, tone, category, focus) VALUES (?, 'SPY,NVDA,AAPL', ?, ?, 'https://example.test/news', 'p', ?, 'nasdaq', ?, ?, '新聞摘要', 'neutral', '總經與市場', ?)");
  ins.run("A", "Before close", "收盤前新聞 A", D2, "2026-10-23T18:00:00Z", "2 hours ago", "SPY,NVDA");
  ins.run("B", "After close", "收盤後新聞 B", D2, "2026-10-23T23:00:00Z", "1 hours ago", "SPY,NVDA,AAPL");
  ins.run("C", "Unknown time", "時間不明新聞 C", D2, "2026-10-23T22:00:00Z", null, "SPY,NVDA,AAPL");
  return { db, sql };
}

test("每日新聞按收盤時間分兩桶：大盤與公司只用 A 解釋收盤，保留 B、C 與只有未確認新聞的公司", async () => {
  const { db } = await timingSeeded();
  const work = await dailyWork(db, D2);
  assert.ok(work.market);
  assert.deepEqual(work.market.news, ["收盤前新聞 A"]);
  assert.deepEqual(work.market.newsIds, ["A"]);
  assert.deepEqual(work.market.unconfirmed, [
    { id: "B", title: "收盤後新聞 B", timing: "after-close" },
    { id: "C", title: "時間不明新聞 C", timing: "unknown" },
  ]);
  const nvda = work.digests.find((d) => d.key === "NVDA")!;
  assert.deepEqual(nvda.news, [{ id: "A", titleZh: "收盤前新聞 A", title: "Before close", summary: "新聞摘要", tone: "neutral", category: "總經與市場", timing: "before-close" }]);
  const unconfirmed = [
    { id: "B", titleZh: "收盤後新聞 B", title: "After close", summary: "新聞摘要", tone: "neutral", category: "總經與市場", timing: "after-close" },
    { id: "C", titleZh: "時間不明新聞 C", title: "Unknown time", summary: "新聞摘要", tone: "neutral", category: "總經與市場", timing: "unknown" },
  ];
  assert.deepEqual(nvda.unconfirmed, unconfirmed);
  const aapl = work.digests.find((d) => d.key === "AAPL");
  assert.ok(aapl, "只有未確認新聞仍須產生公司摘要任務");
  assert.deepEqual(aapl.news, []);
  assert.deepEqual(aapl.unconfirmed, unconfirmed);
});

test("CLI pull daily：公司與大盤保留兩桶來源 ID，tasks.md 含分段、小標與完整時間規則", async (t) => {
  const { db, sql } = await timingSeeded();
  sql.prepare("UPDATE news SET points_zh = '[\"已有重點\"]'").run();
  const app = new Hono<{ Bindings: { DB: D1Database; OWNER_EMAIL: string }; Variables: { user: { id: string; email: string } } }>();
  app.use("*", async (c, next) => {
    c.set("user", { id: "owner", email: "owner@example.test" });
    await next();
  });
  app.get("/api/admin/ai", GET as never);
  const server = createServer(async (req, res) => {
    if (req.url === "/api/auth/sign-in/email") {
      res.setHeader("set-cookie", "session=test; Path=/");
      res.end("{}");
      return;
    }
    const response = await app.request(`http://localhost${req.url}`, undefined, { DB: db, OWNER_EMAIL: "owner@example.test" });
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(await response.text());
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const dir = mkdtempSync(join(tmpdir(), "mo-l2-t4-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const web = join(import.meta.dirname, "..");
  const port = (server.address() as { port: number }).port;
  const child = spawn(process.execPath, ["scripts/ai-batch.ts", "pull", "daily"], {
    cwd: web,
    env: { ...process.env, MO_URL: `http://127.0.0.1:${port}`, MO_EMAIL: "owner@example.test", MO_PASSWORD: "test-password", MO_AI_BATCH_DIR: dir },
  });
  let output = "";
  child.stdout.on("data", (data) => output += data);
  child.stderr.on("data", (data) => output += data);
  const code = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  assert.equal(code, 0, output);
  const tasks = JSON.parse(readFileSync(join(dir, "daily/tasks.json"), "utf8")) as Task[];
  assert.deepEqual(Object.fromEntries(tasks.map((task) => {
    assert.equal(task.meta.type, "digest");
    return [task.meta.key, task.meta.newsIds];
  })), { SPX: ["A", "B", "C"], NVDA: ["A", "B", "C"], AAPL: ["B", "C"] });
  const markdown = readFileSync(join(dir, "daily/tasks.md"), "utf8");
  for (const text of ["收盤前已發布的新聞", "無法確認在收盤前發布的新聞", "[收盤後]", "[時間不明]", "不能當成這天收盤漲跌的原因", "公布後立即", "〔具名來源〕認為／指出"]) {
    assert.equal(markdown.split(text).length - 1 >= 3, true, text);
  }
});

const translated = (n: number, zh: string, focus: string[], category = "財報") => ({ n, title_zh: zh, tone: "negative", category, focus });

async function adminApi() {
  const { db, sql } = await seeded();
  const app = new Hono<{ Bindings: { DB: D1Database; OWNER_EMAIL: string }; Variables: { user: { id: string; email: string } } }>();
  app.use("*", async (c, next) => {
    c.set("user", { id: "test-user", email: c.req.header("x-test-user") ?? "owner@example.test" });
    await next();
  });
  app.post("/api/admin/ai", POST as never);
  const request = (body: unknown, email = "owner@example.test") => app.request("http://localhost/api/admin/ai", {
    method: "POST", headers: { "content-type": "application/json", "x-test-user": email }, body: JSON.stringify(body),
  }, { DB: db, OWNER_EMAIL: "owner@example.test" });
  return { sql, request };
}

test("匯入回執：不存在的新聞不計入重點寫入數，逐筆列為拒收", async () => {
  const { db } = await seeded();
  const r = await importResults(db, { points: [{ id: "absent", answer: { points: ["x"], tone: "neutral" } }] });
  assert.equal(r.points, 0);
  assert.deepEqual(r.accepted, []);
  assert.deepEqual(r.rejected, [{ key: "points:absent", reason: "新聞已不在資料庫，沒有寫入" }]);
  assert.deepEqual(r.skipped, []);
});

test("匯入回執：翻譯三則只回答兩則，缺答的新聞逐筆列為拒收", async () => {
  const { db, sql } = await seeded();
  const r = await importResults(db, {
    translate: [{ ids: ["n1", "n2", "n3"], answer: { items: [translated(1, "第一則", ["NVDA"]), translated(3, "第三則", ["SPY"])] } }],
  });
  assert.equal(r.translated, 2);
  assert.deepEqual(r.accepted, ["translate:n1", "translate:n3"]);
  assert.deepEqual(r.rejected, [{ key: "translate:n2", reason: "答案缺這則或格式不對" }]);
  assert.deepEqual(r.skipped, [], "缺答維持舊版 skipped 的數量");
  assert.equal((sql.prepare("SELECT title_zh FROM news WHERE id = 'n2'").get() as { title_zh: string | null }).title_zh, null);
});

test("翻譯回執：重複序號只計一次寫入、保留最後答案，批次紀錄與回執一致", async () => {
  const { db, sql } = await seeded();
  const r = await importResults(db, {
    translate: [{ ids: ["n1", "n2", "n3"], answer: { items: [
      translated(1, "第一A", ["NVDA"]),
      { ...translated(1, "第一B", ["SPY"], "投資觀點"), tone: "positive" },
      translated(3, "第三", ["SPY"]),
    ] } }],
    run: { id: "duplicate-translate", kind: "translate", expected: ["translate:n1", "translate:n2", "translate:n3"], missing: [], unavailable: [] },
  });
  assert.deepEqual({ translated: r.translated, accepted: r.accepted, rejected: r.rejected, skipped: r.skipped }, {
    translated: 2, accepted: ["translate:n1", "translate:n3"],
    rejected: [{ key: "translate:n2", reason: "答案缺這則或格式不對" }], skipped: [],
  });
  assert.deepEqual({ ...sql.prepare("SELECT title_zh, tone, category, focus FROM news WHERE id = 'n1'").get() }, {
    title_zh: "第一B", tone: "positive", category: "投資觀點", focus: "SPY",
  });
  assert.equal((sql.prepare("SELECT title_zh FROM news WHERE id = 'n2'").get() as { title_zh: string | null }).title_zh, null);
  assert.equal((sql.prepare("SELECT title_zh FROM news WHERE id = 'n3'").get() as { title_zh: string }).title_zh, "第三");
  const row = sql.prepare("SELECT id, job, trigger, status, summary, detail FROM runs").get() as { id: number; job: string; trigger: string; status: string; summary: string; detail: string };
  assert.deepEqual(r.run, { id: row.id, status: "partial" });
  assert.deepEqual([row.job, row.trigger, row.status], ["ai-translate", "ai-batch", "partial"]);
  assert.equal(row.summary, "預期 3、寫入 2、缺答案 0、拒收 1、正文取不到 0");
  assert.deepEqual(JSON.parse(row.detail).accepted, ["translate:n1", "translate:n3"]);
  assert.deepEqual(JSON.parse(row.detail).rejected, r.rejected);
});

test("批次紀錄：缺答與拒收寫成 partial，保存回執、正文不可得與 manifest", async () => {
  const { db, sql } = await seeded();
  const run = {
    id: "daily-test", kind: "daily" as const,
    expected: ["points:n1", "points:n2", "points:absent"], missing: ["points:n2"],
    unavailable: [{ key: "points:n3", reason: "fetch-failed" }], manifest: { model: "sonnet" },
  };
  const r = await importResults(db, {
    points: ["n1", "absent"].map((id) => ({ id, answer: { points: ["重點"], tone: "neutral" } })), run,
  });
  const rows = sql.prepare("SELECT * FROM runs").all() as { id: number; job: string; trigger: string; status: string; summary: string; detail: string; finished_at: string | null }[];
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.deepEqual([row.job, row.trigger, row.status], ["ai-daily", "ai-batch", "partial"]);
  assert.deepEqual(r.run, { id: row.id, status: "partial" });
  assert.ok(row.finished_at);
  assert.equal(row.summary, "預期 3、寫入 1、缺答案 1、拒收 1、正文取不到 1");
  assert.deepEqual(JSON.parse(row.detail), {
    runId: run.id, expected: run.expected, accepted: ["points:n1"], missing: run.missing,
    rejected: [{ key: "points:absent", reason: "新聞已不在資料庫，沒有寫入" }], unavailable: run.unavailable, manifest: run.manifest,
  });
});

test("管理 API：接受 optional run 並寫入紀錄，舊請求不建立紀錄，限站長執行", async () => {
  const { sql, request } = await adminApi();
  const legacy = await request({ points: [{ id: "n1", answer: { points: ["重點"], tone: "neutral" } }] });
  assert.equal(legacy.status, 200);
  const legacyBody = await legacy.json() as ImportReceipt;
  assert.equal("run" in legacyBody, false);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM runs").get() as { n: number }).n, 0);
  const body = { run: { id: "translate-api", kind: "translate", expected: [], missing: [], unavailable: [] } };
  const response = await request(body);
  assert.equal(response.status, 200);
  const receipt = await response.json() as ImportReceipt;
  assert.deepEqual(receipt.run, { id: 1, status: "ok" });
  assert.equal((sql.prepare("SELECT job FROM runs").get() as { job: string }).job, "ai-translate");
  assert.equal((await request(body, "reader@example.test")).status, 403);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM runs").get() as { n: number }).n, 1);
});

test("批次紀錄：manifest 以序列化後的 UTF-8 位元組數限制在 16 KB", async () => {
  const { db, sql } = await seeded();
  for (const [manifest, saved] of [["x".repeat(16 * 1024 - 2), "x".repeat(16 * 1024 - 2)], ["文".repeat(6000), { truncated: true }]] as const) {
    const r = await importResults(db, { run: { id: "manifest-test", kind: "daily", expected: [], missing: [], unavailable: [], manifest } });
    const row = sql.prepare("SELECT detail FROM runs WHERE id = ?").get(r.run!.id) as { detail: string };
    assert.deepEqual(JSON.parse(row.detail).manifest, saved);
  }
});

test("批次紀錄：完整寫入為 ok、部分缺答或拒收為 partial、預期非空卻零寫入為 failed", async (t) => {
  const cases = [
    { name: "全部寫入，正文不可得不影響狀態", ids: ["n1"], expected: ["points:n1"], missing: [], status: "ok" },
    { name: "缺一筆答案", ids: ["n1"], expected: ["points:n1", "points:n2"], missing: ["points:n2"], status: "partial" },
    { name: "部分拒收", ids: ["n1", "absent"], expected: ["points:n1", "points:absent"], missing: [], status: "partial" },
    { name: "全部拒收", ids: ["absent"], expected: ["points:absent"], missing: [], status: "failed" },
    { name: "全部缺答", ids: [], expected: ["points:n1"], missing: ["points:n1"], status: "failed" },
  ];
  for (const c of cases) await t.test(c.name, async () => {
    const { db, sql } = await seeded();
    const r = await importResults(db, {
      points: c.ids.map((id) => ({ id, answer: { points: ["重點"], tone: "neutral" } })),
      run: { id: "status-test", kind: "daily", expected: c.expected, missing: c.missing, unavailable: [{ key: "points:n3", reason: "fetch-failed" }] },
    });
    assert.equal(r.run?.status, c.status);
    const row = sql.prepare("SELECT status, summary FROM runs").get() as { status: string; summary: string };
    assert.equal(row.status, c.status);
    assert.ok(row.summary.includes("正文取不到 1"));
  });
});

test("翻譯回執：刪除的新聞維持答案序號，格式不對的答案逐筆拒收，skipped 訊息不變", async () => {
  const { db, sql } = await seeded();
  const r = await importResults(db, { translate: [{ ids: ["absent", "n1", "n2"], answer: { items: [translated(1, "已刪除", []), translated(2, "第一則", ["NVDA"]), translated(3, "", [])] } }] });
  assert.equal(r.translated, 1);
  assert.deepEqual(r.accepted, ["translate:n1"]);
  assert.deepEqual(r.rejected, [
    { key: "translate:absent", reason: "新聞已不在資料庫，沒有寫入" },
    { key: "translate:n2", reason: "答案缺這則或格式不對" },
  ]);
  assert.deepEqual(r.skipped, ["翻譯：有 1 則已不在資料庫"]);
  assert.equal((sql.prepare("SELECT title_zh FROM news WHERE id = 'n1'").get() as { title_zh: string }).title_zh, "第一則");
});

test("每日重點回執：新增與覆寫都依 D1 實際命中計一筆", async () => {
  const { db, sql } = await seeded();
  for (const summary of ["首次寫入公司摘要", "更新後的公司摘要"]) {
    const r = await importResults(db, { digests: [{ key: "NVDA", date: D2, newsIds: ["n1"], answer: { summary, tone: "neutral" } }] });
    assert.equal(r.digests, 1);
    assert.deepEqual(r.accepted, [`digest:NVDA:${D2}`]);
    assert.deepEqual(r.rejected, []);
    assert.equal((sql.prepare("SELECT summary FROM news_digests").get() as { summary: string }).summary, summary);
  }
});

test("每日重點回執：來源新聞不存在就拒收整筆摘要", async () => {
  const { db } = await seeded();
  const r = await importResults(db, { digests: [{
    key: "NVDA", date: D2, newsIds: ["nonexistent-source"], answer: { summary: "缺少來源的摘要", tone: "neutral" },
  }] });
  assert.equal(r.digests, 0);
  assert.deepEqual(r.accepted, []);
  assert.deepEqual(r.rejected, [{ key: `digest:NVDA:${D2}`, reason: "來源新聞不存在或日期不符：nonexistent-source" }]);
});

test("每日重點回執：日期格式合法且來源同日，沒有該日交易日快照仍拒收", async () => {
  const { db, sql } = await seeded();
  sql.prepare("UPDATE news SET published_at = ? WHERE id = 'n1'").run(D1);
  const r = await importResults(db, { digests: [{
    key: "NVDA", date: D1, newsIds: ["n1"], answer: { summary: "沒有快照的摘要", tone: "neutral" },
  }] });
  assert.equal(r.digests, 0);
  assert.deepEqual(r.accepted, []);
  assert.deepEqual(r.rejected, [{ key: `digest:NVDA:${D1}`, reason: "日期不是交易日快照" }]);
});

test("每日重點回執：來源有異日新聞就拒收整筆，列出所有不存在或異日的 ID", async () => {
  const { db } = await seeded();
  const r = await importResults(db, { digests: [{
    key: "NVDA", date: D2, newsIds: ["n1", "old", "nonexistent-source"], answer: { summary: "混入異日來源的摘要", tone: "neutral" },
  }] });
  assert.equal(r.digests, 0);
  assert.deepEqual(r.accepted, []);
  assert.deepEqual(r.rejected, [{ key: `digest:NVDA:${D2}`, reason: "來源新聞不存在或日期不符：old,nonexistent-source" }]);
});

test("每日重點回執：所有來源都存在且同日就接受", async () => {
  const { db } = await seeded();
  const r = await importResults(db, { digests: [{
    key: "NVDA", date: D2, newsIds: ["n1", "n2", "n3"], answer: { summary: "同日來源的摘要", tone: "neutral" },
  }] });
  assert.equal(r.digests, 1);
  assert.deepEqual(r.accepted, [`digest:NVDA:${D2}`]);
  assert.deepEqual(r.rejected, []);
});

test("每日重點回執：大盤沒有新聞來源仍可接受", async () => {
  const { db } = await seeded();
  const r = await importResults(db, { digests: [{
    key: MARKET_KEY, date: D2, newsIds: [], answer: { summary: "依快照整理大盤表現", tone: "neutral" },
  }] });
  assert.equal(r.digests, 1);
  assert.deepEqual(r.accepted, [`digest:SPX:${D2}`]);
  assert.deepEqual(r.rejected, []);
});

test("管理 API：不存在的摘要來源回傳拒收，沒有寫進新聞摘要", async () => {
  const { sql, request } = await adminApi();
  const response = await request({ digests: [{
    key: "NVDA", date: D2, newsIds: ["nonexistent-source"], answer: { summary: "不應顯示的摘要", tone: "neutral" },
  }] });
  assert.equal(response.status, 200);
  const r = await response.json() as ImportReceipt;
  assert.equal(r.digests, 0);
  assert.deepEqual(r.accepted, []);
  assert.deepEqual(r.rejected, [{ key: `digest:NVDA:${D2}`, reason: "來源新聞不存在或日期不符：nonexistent-source" }]);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM news_digests").get() as { n: number }).n, 0);
});

test("管理 API：驗證 run 的種類、型別與長度上限，超限不寫入", async () => {
  const { sql, request } = await adminApi();
  const run = { id: "limit-test", kind: "daily", expected: [], missing: [], unavailable: [] };
  for (const patch of [
    { id: "x".repeat(65) }, { kind: "weekly" }, { expected: Array(501).fill("points:n1") },
    { missing: Array(501).fill("points:n1") }, { unavailable: Array(101).fill({ key: "points:n1", reason: "fetch-failed" }) },
    { expected: [1] }, { missing: [1] }, { unavailable: [{ key: "points:n1", reason: 1 }] },
  ]) {
    assert.equal((await request({ run: { ...run, ...patch } })).status, 400);
  }
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM runs").get() as { n: number }).n, 0);
  const atLimit = await request({ run: {
    ...run, id: "x".repeat(64), expected: Array(500).fill("points:n1"), missing: Array(500).fill("points:n1"),
    unavailable: Array(100).fill({ key: "points:n3", reason: "fetch-failed" }), manifest: { model: "sonnet" },
  } });
  assert.equal(atLimit.status, 200);
  assert.equal((await atLimit.json() as ImportReceipt).run?.status, "failed");
  assert.equal(JSON.parse((sql.prepare("SELECT detail FROM runs").get() as { detail: string }).detail).manifest.model, "sonnet");
});

test("翻譯：只給最近還沒翻的；答案依序號寫回，格式不對的那組略過", async () => {
  const { db, sql } = await seeded();
  const work = await translateWork(db, "2026-10-25");
  assert.deepEqual(work.map((w) => w.id).sort(), ["n1", "n2", "n3"], "超過 7 天的舊新聞不補");
  const ids = work.map((w) => w.id);
  const answer = { items: ids.map((id, i) => translated(i + 1, `中文 ${id}`, id === "n3" ? ["SPY"] : id === "n1" ? ["NVDA"] : [], id === "n3" ? "總經與市場" : "財報")) };
  const r = await importResults(db, { translate: [{ ids, answer }, { ids: ["n1"], answer: "胡言亂語" }] });
  assert.equal(r.translated, 3);
  assert.equal(r.skipped.length, 1);
  assert.deepEqual(r.rejected, [{ key: "translate:n1", reason: "答案缺這則或格式不對" }]);
  assert.equal((sql.prepare("SELECT title_zh, focus FROM news WHERE id = 'n3'").get() as { title_zh: string; focus: string }).focus, "SPY");
  assert.deepEqual(await translateWork(db, "2026-10-25"), [], "翻過的不再給");
});

test("每日：重點只給 AI 判定重要的；公司重點與大盤各一份，寫過就不再給", async () => {
  const { db, sql } = await seeded();
  const today = easternDate();
  // 還沒翻：沒有 focus，不給文章重點
  let work = await dailyWork(db, D2);
  assert.equal(work.points.length, 0);
  sql.prepare("UPDATE news SET published_at = ? WHERE id IN ('n1','n2','n3')").run(D2);
  sql.prepare("UPDATE news SET title_zh = '輝達財報優於預期', focus = 'NVDA', category = '財報', enriched_at = 'x' WHERE id = 'n1'").run();
  sql.prepare("UPDATE news SET title_zh = '3 檔 AI 股', focus = '', category = '投資觀點', enriched_at = 'x' WHERE id = 'n2'").run();
  sql.prepare("UPDATE news SET title_zh = '聯準會按兵不動', focus = 'SPY', category = '總經與市場', enriched_at = 'x' WHERE id = 'n3'").run();
  work = await dailyWork(db, D2);
  assert.equal(work.date, D2);
  assert.deepEqual(work.points.map((p) => p.id).sort(), ["n1", "n3"], "選股文（focus 空）不寫重點");
  assert.deepEqual(work.digests.map((d) => [d.key, d.news.map((n) => n.id)]), [["NVDA", ["n1"]]]);
  assert.equal(work.digests[0].news[0].timing, "before-close");
  assert.deepEqual(work.digests[0].unconfirmed, []);
  assert.ok(work.market);
  assert.deepEqual(work.market.news, ["聯準會按兵不動"]);
  assert.deepEqual(work.market.unconfirmed, []);
  assert.equal(work.market.movers[0].key, "NVDA");

  const r = await importResults(db, {
    model: "claude-test",
    points: [{ id: "n1", answer: { points: ["營收創新高"], tone: "positive" } }, { id: "n3", answer: { points: [] } }],
    digests: [
      { key: "NVDA", date: D2, newsIds: ["n1"], answer: { summary: "財報優於預期但股價下跌", tone: "neutral" } },
      { key: MARKET_KEY, date: D2, newsIds: ["n3"], answer: { summary: "權值股拖累指數走低", tone: "negative" } },
      { key: "AAPL", date: "昨天", newsIds: [], answer: { summary: "日期不對的不寫", tone: "neutral" } },
    ],
  });
  assert.deepEqual([r.points, r.digests, r.skipped.length], [1, 2, 2]);
  assert.deepEqual(r.accepted, ["points:n1", `digest:NVDA:${D2}`, `digest:SPX:${D2}`]);
  assert.deepEqual(r.rejected, [{ key: "points:n3", reason: "格式不對" }, { key: "digest:AAPL:昨天", reason: "格式不對" }]);
  assert.equal((sql.prepare("SELECT points_zh FROM news WHERE id = 'n1'").get() as { points_zh: string }).points_zh, '["營收創新高"]');
  assert.equal((sql.prepare("SELECT model FROM news_digests WHERE symbol = 'SPX'").get() as { model: string }).model, "claude-test");
  work = await dailyWork(db, today);
  assert.deepEqual([work.digests.length, work.market], [0, null], "寫過的公司與大盤不再給");
});

test("大盤那段：提示詞裡追蹤公司（含未逐家列出的）加上其他成分股，合計等於指數漲跌點數", async () => {
  const { db } = await migratedDb();
  const members = DEFAULT_WATCHLIST;
  assert.ok(members.length > 6, "要有第 7 家以上的追蹤公司才測得到");
  const tickers = members.flatMap((m) => m.tickers);
  // Every ticker gets a distinct non-zero move and a weight, so every contribution (and restPts) is non-null.
  const series: Record<string, Series> = { SPX: new Series([{ date: D1, close: 7600 }, { date: D2, close: 7560 }]) };
  tickers.forEach((t, i) => (series[t] = new Series([{ date: D1, close: 100 }, { date: D2, close: 100 - (i + 1) * 0.7 }])));
  const weights = new Map(tickers.map((t, i) => [t, 6 - i * 0.5]));
  const snap = buildSnapshot({ tradeDate: D2, series, checks: {}, weights: { asOf: D1, byTicker: weights }, members })!;
  assert.ok(snap.mag7.every((r) => r.contributionPts !== null && r.contributionPts !== 0));
  await saveSnapshots(db, [snap], "測試");

  const work = await dailyWork(db, D2);
  assert.ok(work.market && work.market.changePts !== null && work.market.restPts !== null);
  const prompt = marketPrompt(work.market).user;
  // Sum every signed point figure on the contribution lines (listed companies, the unlisted-tracked line, and the remainder).
  const section = prompt.slice(prompt.indexOf("點數貢獻"), prompt.indexOf("這天的大盤與總經新聞"));
  const parts = [...section.matchAll(/([+-]\d+\.\d) 點/g)].map((x) => Number(x[1]));
  const sum = parts.reduce((a, x) => a + x, 0);
  assert.ok(Math.abs(sum - work.market.changePts) < 0.05 * parts.length, `各項合計 ${sum.toFixed(2)} ≠ 指數漲跌 ${work.market.changePts}`);
});
