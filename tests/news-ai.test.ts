// 新聞 AI（按需呼叫）：提示詞與解析、免費的重要規則、每日額度與 429、快取命中不呼叫、只翻還沒翻的、
// 每個 Anthropic 請求都扣 budget、請求參數符合新模型的限制、排程不再呼叫 AI。
import assert from "node:assert/strict";
import { test } from "node:test";
import { easternDate } from "../src/lib/calendar.ts";
import { digestPrompt, enrichPrompt, extractArticleText, isImportant, newsFingerprint, parseDigest, parseEnrich, parsePoints, pointsPrompt } from "../src/lib/news-ai.ts";
import { Budget } from "../src/lib/sources/http.ts";
import type { Viewer } from "../src/server/account.ts";
import { type Ai, type AiRequest, HAIKU, SONNET, createAi } from "../src/server/anthropic.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

const items = [
  { id: "a", title: "Nvidia beats estimates", summary: null, symbols: ["SPY", "NVDA"], primarySymbol: "NVDA" },
  { id: "b", title: "3 AI Stocks to Buy", summary: "Dell backlog", symbols: ["NVDA"], primarySymbol: "DELL" },
];
const user = (id = "u1", isOwner = false): Viewer => ({ id, email: `${id}@x.com`, name: id, isOwner });
const NVDA = { key: "NVDA", company: "NVIDIA", tickers: ["NVDA"] };
const AAPL = { key: "AAPL", company: "Apple", tickers: ["AAPL"] };
const GOOG = { key: "GOOG", company: "Alphabet", tickers: ["GOOG", "GOOGL"] };

test("解析逐則結果：包在 ```json 裡也讀得到；focus 只收輸入裡有的代號；壞掉的列略過", () => {
  const text =
    '```json\n{"items":[{"n":1,"title_zh":"輝達財報優於預期","tone":"positive","category":"財報","focus":["NVDA","AMD"]},' +
    '{"n":2,"title_zh":"3 檔 AI 股","tone":"weird","category":"亂寫","focus":[]},{"n":9,"title_zh":"不存在"}]}\n```';
  const out = parseEnrich(text, items);
  assert.deepEqual(out, [
    { id: "a", titleZh: "輝達財報優於預期", tone: "positive", category: "財報", focus: ["NVDA"] },
    { id: "b", titleZh: "3 檔 AI 股", tone: "neutral", category: "投資觀點", focus: [] },
  ]);
  assert.throws(() => parseEnrich("抱歉我無法", items));
  // 結構化輸出已經是物件
  assert.equal(parseEnrich({ items: [{ n: 1, title_zh: "好", tone: "negative", category: "財報", focus: ["SPY"] }] }, items)[0].focus[0], "SPY");
});

test("提示詞帶上代號、主角、摘要與台灣用語規則；重點的提示詞帶上當天漲跌", () => {
  const p = enrichPrompt(items);
  assert.match(p.user, /1\. \[SPY,NVDA\] Nvidia beats estimates/);
  assert.match(p.user, /來源標的主角：DELL；摘要：Dell backlog/);
  assert.match(p.system, /庫藏股/);
  assert.match(p.system, /不可出現簡體字或中國用語/);
  const d = digestPrompt({ key: "NVDA", company: "NVIDIA", date: "2026-10-23", returnPct: -0.59, contributionPts: -3.51, news: [] });
  assert.match(d.user, /當天股價：-0\.59%，對 S&P 500 貢獻 -3\.5 點/);
  assert.equal(parseDigest('{"summary":"短"}'), null);
  assert.deepEqual(parseDigest({ summary: "輝達財報優於預期，帶動盤後上漲。", tone: "positive" }), { summary: "輝達財報優於預期，帶動盤後上漲。", tone: "positive" });
  assert.equal(newsFingerprint(["b", "a"]), newsFingerprint(["a", "b"]));
});

test("單篇重點：解析最多 5 點；正文抽取去掉 script／導覽、太短回 null；抓不到原文時提示詞要求不要推測", () => {
  assert.deepEqual(parsePoints({ points: [" 一 ", "", "二", "三", "四", "五", "六"], tone: "x" }), { points: ["一", "二", "三", "四", "五"], tone: "neutral" });
  assert.equal(parsePoints({ points: [] }), null);
  const para = "Nvidia said on Thursday that quarterly revenue rose sharply thanks to data center demand &amp; new chips.";
  const html = `<html><nav><p>${para.repeat(3)} menu</p></nav><script>var x="<p>${para.repeat(9)}</p>"</script><article><p>${para}</p><p>${para}</p><p>${para}</p></article></html>`;
  const text = extractArticleText(html)!;
  assert.ok(text.includes("data center demand & new chips"));
  assert.equal(text.split("\n").length, 3);
  assert.equal(extractArticleText("<p>too short</p>"), null);
  assert.match(pointsPrompt({ title: "T", body: null, summary: "S", symbols: ["NVDA"] }).user, /抓不到原文/);
  assert.match(pointsPrompt({ title: "T", body: "BODY", summary: null, symbols: ["NVDA"] }).user, /原文正文[^]*BODY/);
});

test("重要與否（免費規則）：AI 判過照 focus；沒判過時 primary_symbol 在名單、或沒有主角且掛在 SPY 才算", () => {
  const keys = ["NVDA", "SPY"];
  const tickers = ["NVDA"];
  const n = (o: Partial<Parameters<typeof isImportant>[0]>) => ({ focus: null, category: null, primary_symbol: null, symbols: "NVDA", ...o });
  // 還沒判過
  assert.equal(isImportant(n({ primary_symbol: "NVDA" }), keys, tickers), true);
  assert.equal(isImportant(n({ primary_symbol: "DELL" }), keys, tickers), false, "掛在 NVDA 底下但主角是別家");
  assert.equal(isImportant(n({ primary_symbol: null, symbols: "SPY" }), keys, tickers), true, "沒有主角且掛在大盤");
  assert.equal(isImportant(n({ primary_symbol: null, symbols: "NVDA" }), keys, tickers), false, "沒有主角、沒掛大盤");
  assert.equal(isImportant(n({ primary_symbol: null, symbols: "SPY" }), ["NVDA"], tickers), false, "不看大盤時不算");
  // 判過了
  assert.equal(isImportant(n({ focus: "NVDA", category: "財報" }), keys, tickers), true);
  assert.equal(isImportant(n({ focus: "", category: "投資觀點", primary_symbol: "NVDA" }), keys, tickers), false);
  assert.equal(isImportant(n({ focus: "SPY", category: "總經與市場" }), keys, tickers), true);
  assert.equal(isImportant(n({ focus: "SPY", category: "分析師" }), keys, tickers), false);
  assert.equal(isImportant(n({ focus: "TSLA", category: "財報" }), keys, tickers), false);
});

// ── 假的 Ai 與資料 ──

function fakeAi(handler: (req: AiRequest) => unknown) {
  const calls: AiRequest[] = [];
  const ai: Ai = {
    async json(req) {
      calls.push(req);
      return handler(req);
    },
  };
  return { ai, calls };
}
const enrichAnswer = (req: AiRequest) => ({
  items: [...req.user.matchAll(/^(\d+)\. \[([^\]]+)\] (.+)$/gm)].map((m) => ({
    n: Number(m[1]),
    title_zh: `中文：${m[3]}`,
    tone: "positive",
    category: m[3].includes("Fed") ? "總經與市場" : "財報",
    focus: m[3].includes("Nvidia") ? ["NVDA"] : m[3].includes("Fed") ? ["SPY"] : [],
  })),
});

async function seeded() {
  const { db, sql } = await migratedDb();
  const today = easternDate();
  const ins = sql.prepare("INSERT INTO news (id, symbols, title, url, publisher, published_at, source, fetched_at, summary, primary_symbol) VALUES (?, ?, ?, ?, 'p', ?, 'nasdaq', 'x', ?, ?)");
  ins.run("n1", "SPY,NVDA", "Nvidia beats estimates", "https://example.com/n1", today, "Rev up", "NVDA");
  ins.run("n2", "NVDA", "3 AI Stocks to Buy", "https://example.com/n2", today, null, "DELL");
  ins.run("n3", "SPY", "Fed holds rates", "https://example.com/n3", today, null, null);
  ins.run("n4", "AAPL", "Apple unveils chip", "https://example.com/n4", today, null, "AAPL");
  return { db, sql, today };
}

test("translate：只處理還沒翻的、一次呼叫用 Haiku；翻過的再送不呼叫也不算次數", async () => {
  const { db, sql } = await seeded();
  const { translateNews } = await import("../src/server/news-ai.ts");
  const { ai, calls } = fakeAi(enrichAnswer);
  sql.prepare("UPDATE news SET title_zh = '已翻', tone = 'neutral', category = '財報', focus = 'NVDA', enriched_at = 'x' WHERE id = 'n1'").run();
  const r1 = await translateNews(db, ai, user(), [NVDA], ["n1", "n2", "n3", "n1", "nope"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, HAIKU);
  assert.deepEqual(calls[0].user.match(/^\d+\. \[.+$/gm)!.map((l) => l.replace(/^\d+\. /, "")), ["[NVDA] 3 AI Stocks to Buy", "[SPY] Fed holds rates"], "n1 已翻、nope 不存在，只送 n2 n3");
  assert.deepEqual(r1.items.map((i) => [i.id, i.title_zh, i.important]).sort(), [["n1", "已翻", true], ["n2", "中文：3 AI Stocks to Buy", false], ["n3", "中文：Fed holds rates", true]].sort());
  assert.deepEqual(r1.ai, { enabled: true, used: 1, limit: 40 });
  assert.equal((sql.prepare("SELECT focus FROM news WHERE id = 'n3'").get() as { focus: string }).focus, "SPY");
  // 再送一次：全部已翻，不呼叫、不扣次數
  const r2 = await translateNews(db, ai, user(), [NVDA], ["n1", "n2", "n3"]);
  assert.equal(calls.length, 1);
  assert.equal(r2.ai.used, 1);
  assert.equal(r2.items.length, 3);
  // 沒設 key 但全部已翻：照樣回快取
  const r3 = await translateNews(db, null, user(), [NVDA], ["n1"]);
  assert.deepEqual(r3.ai.enabled, false);
});

test("額度：一般帳號每天 40 次、站長 400 次；用完回 429 的訊息；失敗會退回；沒設 key 回 503", async () => {
  const { db, sql } = await seeded();
  const { reserveCalls, refundCalls, translateNews, AiHttpError, QUOTA_MESSAGE, NO_KEY_MESSAGE } = await import("../src/server/news-ai.ts");
  const { ai, calls } = fakeAi(enrichAnswer);
  assert.equal(await reserveCalls(db, user("a"), 38), 38);
  assert.equal(await reserveCalls(db, user("a"), 5), 2, "只剩 2 次，只給 2 次");
  assert.equal(await reserveCalls(db, user("a"), 1), 0);
  assert.equal(await reserveCalls(db, user("b"), 1), 1, "別人的額度不受影響");
  await assert.rejects(translateNews(db, ai, user("a"), [NVDA], ["n2"]), (e: unknown) => e instanceof AiHttpError && e.status === 429 && e.message === QUOTA_MESSAGE);
  assert.equal(calls.length, 0, "額度用完就不呼叫模型");
  assert.equal((sql.prepare("SELECT title_zh FROM news WHERE id = 'n2'").get() as { title_zh: string | null }).title_zh, null);
  // 站長 400
  assert.equal(await reserveCalls(db, user("o", true), 500), 400);
  // 失敗退回
  const bad = fakeAi(() => {
    throw new Error("boom");
  });
  await refundCalls(db, user("a"), 3);
  await assert.rejects(translateNews(db, bad.ai, user("a"), [NVDA], ["n2"]), (e: unknown) => e instanceof AiHttpError && e.status === 502);
  const used = (sql.prepare("SELECT calls FROM ai_usage WHERE user_id = 'a'").get() as { calls: number }).calls;
  assert.equal(used, 37, "40 - 3 退回，失敗的那次也退回");
  // 沒 key 且有東西要翻
  await assert.rejects(translateNews(db, null, user("c"), [NVDA], ["n2"]), (e: unknown) => e instanceof AiHttpError && e.status === 503 && e.message === NO_KEY_MESSAGE);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = 'c'").get() as { n: number }).n, 0, "沒 key 不扣次數");
});

test("單篇重點：抓一篇原文、用 Sonnet、存起來；第二次（任何人）直接讀快取不呼叫；抓不到原文改用標題＋摘要", async () => {
  const { db, sql } = await seeded();
  const { newsPoints, AiHttpError } = await import("../src/server/news-ai.ts");
  const para = "Nvidia said on Thursday that quarterly revenue rose sharply thanks to data center demand and new chips.";
  const fetched: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    fetched.push(url);
    if (url.endsWith("/n1")) return new Response(`<article><p>${para}</p><p>${para}</p><p>${para}</p></article>`, { headers: { "content-type": "text/html; charset=utf-8" } });
    return new Response("nope", { status: 404 });
  }) as typeof fetch;
  try {
    const { ai, calls } = fakeAi(() => ({ points: ["營收大增", "資料中心需求強"], tone: "positive" }));
    const budget = new Budget(20);
    const r1 = await newsPoints(db, ai, user(), "n1", budget);
    assert.deepEqual([r1.points, r1.cached, r1.tone, r1.ai.used], [["營收大增", "資料中心需求強"], false, "positive", 1]);
    assert.equal(calls[0].model, SONNET);
    assert.match(calls[0].user, /原文正文[^]*quarterly revenue/);
    assert.deepEqual(fetched, ["https://example.com/n1"], "只抓那一篇");
    assert.equal(budget.used, 1, "抓原文也扣 budget");
    assert.equal((sql.prepare("SELECT points_zh FROM news WHERE id = 'n1'").get() as { points_zh: string }).points_zh, JSON.stringify(["營收大增", "資料中心需求強"]));
    // 別的帳號再點：快取
    const r2 = await newsPoints(db, ai, user("u2"), "n1", new Budget(20));
    assert.deepEqual([r2.cached, r2.ai.used, calls.length, fetched.length], [true, 0, 1, 1]);
    // 抓不到原文（404）：用標題＋摘要，仍然完成
    const r3 = await newsPoints(db, ai, user(), "n2", new Budget(20));
    assert.equal(r3.cached, false);
    assert.match(calls[1].user, /抓不到原文/);
    await assert.rejects(newsPoints(db, ai, user(), "missing", new Budget(20)), (e: unknown) => e instanceof AiHttpError && e.status === 404);
  } finally {
    globalThis.fetch = original;
  }
});

test("每日重點：一次最多 5 家、只替有新聞且還沒有重點的公司寫，每家一次 Sonnet；寫過的不重寫", async () => {
  const { db, sql, today } = await seeded();
  const { generateDigests } = await import("../src/server/news-ai.ts");
  const { ai, calls } = fakeAi(() => ({ summary: "財報優於預期，市場反應正面。", tone: "positive" }));
  const members = [NVDA, AAPL, GOOG, ...["A", "B", "C", "D"].map((k) => ({ key: k, company: k, tickers: [k] }))];
  for (const m of members.slice(3)) sql.prepare("INSERT INTO news (id, symbols, title, url, published_at, source, fetched_at, primary_symbol) VALUES (?, ?, ?, 'https://e.com', ?, 'nasdaq', 'x', ?)").run(`x${m.key}`, m.key, `${m.key} news`, today, m.key);
  // GOOG 沒有新聞；NVDA、AAPL、A、B、C、D 有 → 6 家有新聞，一次只做 5
  const r1 = await generateDigests(db, ai, user(), members, today);
  assert.equal(calls.length, 5);
  assert.ok(calls.every((c) => c.model === SONNET));
  assert.deepEqual(r1.digests.map((d) => d.symbol), ["NVDA", "AAPL", "A", "B", "C"]);
  assert.equal(r1.ai.used, 5);
  const r2 = await generateDigests(db, ai, user(), members, today);
  assert.equal(calls.length, 6, "只剩 D 還沒有");
  assert.equal(r2.digests.length, 6);
  const r3 = await generateDigests(db, ai, user(), members, today);
  assert.equal(calls.length, 6, "都有了就不呼叫");
  assert.equal(r3.ai.used, 6);
  // 額度只剩 1 次時，只做 1 家
  const { db: db2 } = await seeded();
  const { reserveCalls } = await import("../src/server/news-ai.ts");
  await reserveCalls(db2, user("q"), 39);
  const one = fakeAi(() => ({ summary: "財報優於預期，市場反應正面。", tone: "positive" }));
  const r4 = await generateDigests(db2, one.ai, user("q"), [NVDA, AAPL], today);
  assert.equal(one.calls.length, 1);
  assert.deepEqual(r4.digests.map((d) => d.symbol), ["NVDA"]);
});

test("Anthropic 請求：每個請求（含重試）都扣 budget；參數符合新模型（無 temperature、Haiku 關思考、Sonnet 不送 thinking、結構化輸出、low effort）", async () => {
  const original = globalThis.fetch;
  const bodies: Record<string, unknown>[] = [];
  let mode: "ok" | "fail" | "refuse" = "ok";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    assert.match(String(input), /^https:\/\/api\.anthropic\.com\/v1\/messages/);
    bodies.push(JSON.parse(String(init?.body)));
    if (mode === "fail") return new Response('{"type":"error","error":{"type":"overloaded_error","message":"x"}}', { status: 529 });
    const msg = { id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: '{"ok":true}' }], stop_reason: mode === "refuse" ? "refusal" : "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
    return new Response(JSON.stringify(msg), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false };
    const budget = new Budget(10);
    const ai = createAi("test-key", budget);
    assert.deepEqual(await ai.json({ model: HAIKU, system: "s", user: "u", schema, maxTokens: 100 }), { ok: true });
    assert.deepEqual(await ai.json({ model: SONNET, system: "s", user: "u", schema, maxTokens: 100 }), { ok: true });
    assert.equal(budget.used, 2, "兩次請求扣兩次");
    assert.equal(budget.byHost["api.anthropic.com"], 2);
    const [h, s] = bodies;
    for (const b of bodies) {
      assert.ok(!("temperature" in b) && !("top_p" in b));
      assert.deepEqual(b.output_config, { effort: "low", format: { type: "json_schema", schema } });
    }
    assert.equal(h.model, HAIKU);
    assert.deepEqual(h.thinking, { type: "disabled" });
    assert.equal(s.model, SONNET);
    assert.ok(!("thinking" in s), "Sonnet 5.5 送 thinking: disabled 會 400");
    // 失敗：SDK 重試一次（maxRetries 1），每次都扣額度
    mode = "fail";
    bodies.length = 0;
    const b2 = new Budget(10);
    await assert.rejects(createAi("k", b2).json({ model: HAIKU, system: "s", user: "u", schema, maxTokens: 10 }));
    assert.ok(b2.used >= 2 && b2.used === bodies.length, `扣到的 ${b2.used} 次要等於實際打出去的 ${bodies.length} 次`);
    // 額度不夠就在本地拒絕、不打出去
    bodies.length = 0;
    const b3 = new Budget(0);
    await assert.rejects(createAi("k", b3).json({ model: HAIKU, system: "s", user: "u", schema, maxTokens: 10 }));
    assert.equal(bodies.length, 0);
    // 模型拒絕
    mode = "refuse";
    await assert.rejects(createAi("k", new Budget(5)).json({ model: SONNET, system: "s", user: "u", schema, maxTokens: 10 }), /拒絕/);
  } finally {
    globalThis.fetch = original;
  }
});

test("排程不再呼叫 AI：news 排程只剩抓新聞與分析師，沒有 news-ai 工作", async () => {
  const { SCHEDULES, JOB_NAMES } = await import("../src/server/jobs.ts");
  assert.deepEqual([...SCHEDULES.news], ["news", "analysts"]);
  assert.ok(!(JOB_NAMES as string[]).includes("news-ai"));
});

test("newsView：每則帶 AI 欄位與免費 important、points 轉成陣列、digests 與 ai 在頂層；不洩漏 primary_symbol", async () => {
  const { db, sql, today } = await seeded();
  const { newsView } = await import("../src/server/views.ts");
  sql.prepare("UPDATE news SET points_zh = ? WHERE id = 'n1'").run(JSON.stringify(["重點一"]));
  sql.prepare("INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES ('NVDA', ?, '輝達財報優於預期。', 'positive', 'n1', 'f', 'm', 'x')").run(today);
  const c = { env: { DB: db, ANTHROPIC_API_KEY: "k" }, req: { query: () => undefined, url: "https://x/api/v1/news" } };
  const out = await newsView(c, user("viewer"));
  const byId = Object.fromEntries(out.news.map((n) => [n.id, n]));
  assert.equal(byId.n1.important, true, "primary_symbol 是 NVDA（預設名單）");
  assert.equal(byId.n2.important, false, "掛在 NVDA 底下但主角是 DELL");
  assert.equal(byId.n3.important, true, "沒有主角、掛在 SPY（大盤）");
  assert.deepEqual(byId.n1.points_zh, ["重點一"]);
  assert.equal(byId.n2.points_zh, null);
  assert.equal(byId.n2.title_zh, null);
  assert.ok(!("primary_symbol" in byId.n1));
  assert.deepEqual(out.digests.map((d) => [d.symbol, d.company, d.summary]), [["NVDA", "NVIDIA", "輝達財報優於預期。"]]);
  assert.deepEqual(out.ai, { enabled: true, used: 0, limit: 40 });
  assert.equal((await newsView({ ...c, env: { DB: db } }, user("viewer"))).ai.enabled, false);
});

// ── 審查後修正 ──

function stubAnthropic(stopReason: string, text = '{"ok":true}') {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => {
    requests++;
    const msg = { id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text }], stop_reason: stopReason, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
    return new Response(JSON.stringify(msg), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { restore: () => (globalThis.fetch = original), requests: () => requests };
}

test("模型已回應才壞（拒絕、截斷、不是 JSON、格式不對）已經計費：不退額度，重複送最後會 429，不能無限重試", async () => {
  const { translateNews, newsPoints, generateDigests, AiHttpError, DAILY_LIMIT } = await import("../src/server/news-ai.ts");
  const cases: [string, string, string][] = [["refusal", '{"ok":true}', "拒絕"], ["max_tokens", '{"ok":true}', "截斷"], ["end_turn", "not json", "JSON"], ["end_turn", '{"items":"x"}', "翻譯格式"]];
  for (const [stop, text] of cases) {
    const { db, sql } = await seeded();
    const stub = stubAnthropic(stop, text);
    try {
      const ai = createAi("k", new Budget(1000));
      let status = 0;
      for (let i = 0; i < DAILY_LIMIT + 1; i++) {
        try {
          await translateNews(db, ai, user(), [NVDA], ["n2"]);
        } catch (e) {
          status = (e as InstanceType<typeof AiHttpError>).status;
        }
      }
      assert.equal(status, 429, `${stop}：第 41 次要被額度擋下`);
      assert.equal(stub.requests(), DAILY_LIMIT, "只打出去 40 次");
      assert.equal((sql.prepare("SELECT calls FROM ai_usage WHERE user_id = 'u1'").get() as { calls: number }).calls, DAILY_LIMIT);
      // 重點與每日重點同一條規則
      const { db: db2, today: t2 } = await seeded();
      const p = await newsPoints(db2, createAi("k", new Budget(1000)), user("p"), "n2", new Budget(5)).catch((e) => e);
      assert.ok(p instanceof AiHttpError && p.status === 502);
      assert.equal((await generateDigests(db2, createAi("k", new Budget(1000)), user("p"), [NVDA], t2).catch((e) => e)).status, 502);
    } finally {
      stub.restore();
    }
  }
  // 模型回應前的失敗（網路、HTTP 錯誤）照舊退回
  const { db, sql } = await seeded();
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response("{}", { status: 400 })) as typeof fetch;
  try {
    await assert.rejects(translateNews(db, createAi("k", new Budget(100)), user(), [NVDA], ["n2"]), (e: unknown) => e instanceof AiHttpError && e.status === 502);
    assert.equal((sql.prepare("SELECT calls FROM ai_usage WHERE user_id = 'u1'").get() as { calls: number }).calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("多掛了代號（enriched_at 被排程清掉）：已翻的也要重新判斷在講誰，重判後才算新公司的重要新聞", async () => {
  const { db, sql } = await seeded();
  const { translateNews } = await import("../src/server/news-ai.ts");
  const { ai, calls } = fakeAi(enrichAnswer);
  await translateNews(db, ai, user(), [NVDA, AAPL], ["n1"]);
  assert.equal(calls.length, 1);
  assert.equal((await translateNews(db, ai, user(), [NVDA, AAPL], ["n1"])).items[0].important, true);
  assert.equal(calls.length, 1, "沒變就不重判");
  // 排程把 n1 多掛上 AAPL 並清掉 enriched_at
  sql.prepare("UPDATE news SET symbols = 'SPY,NVDA,AAPL', enriched_at = NULL WHERE id = 'n1'").run();
  const again = fakeAi(() => ({ items: [{ n: 1, title_zh: "輝達與蘋果", tone: "positive", category: "財報", focus: ["NVDA", "AAPL"] }] }));
  const r = await translateNews(db, again.ai, user(), [AAPL], ["n1"]);
  assert.equal(again.calls.length, 1, "已翻但 enriched_at 是 NULL → 重判");
  assert.equal(r.items[0].title_zh, "輝達與蘋果");
  assert.equal(r.items[0].important, true);
  assert.equal((sql.prepare("SELECT focus FROM news WHERE id = 'n1'").get() as { focus: string }).focus, "NVDA,AAPL");
  assert.notEqual((sql.prepare("SELECT enriched_at FROM news WHERE id = 'n1'").get() as { enriched_at: string | null }).enriched_at, null);
  await translateNews(db, again.ai, user(), [AAPL], ["n1"]);
  assert.equal(again.calls.length, 1, "重判完不再重判");
});

test("translate 帶畫面的代號篩選：重要與否與 newsView 同一條規則（不是整份名單）", async () => {
  const { db, sql } = await seeded();
  const { translateNews } = await import("../src/server/news-ai.ts");
  const { newsView } = await import("../src/server/views.ts");
  // n5：在講 NVDA，但也掛在 AAPL 底下
  sql.prepare("INSERT INTO news (id, symbols, title, url, published_at, source, fetched_at, primary_symbol) VALUES ('n5', 'NVDA,AAPL', 'Nvidia and Apple', 'https://e.com/5', ?, 'nasdaq', 'x', 'NVDA')").run(easternDate());
  const { ai } = fakeAi(() => ({ items: [{ n: 1, title_zh: "輝達", tone: "neutral", category: "財報", focus: ["NVDA"] }] }));
  const members = [NVDA, AAPL];
  const filtered = await translateNews(db, ai, user(), members, ["n5"], "AAPL");
  assert.equal(filtered.items[0].important, false, "AAPL 頁面：這則是在講 NVDA");
  const whole = await translateNews(db, ai, user(), members, ["n5"]);
  assert.equal(whole.items[0].important, true, "全部頁面：NVDA 在名單上");
  const c = { env: { DB: db }, req: { query: (k: string) => (k === "symbol" ? "AAPL" : undefined), url: "https://x/api/v1/news?symbol=AAPL" } };
  assert.equal((await newsView(c, user("viewer"))).news.find((n) => n.id === "n5")!.important, filtered.items[0].important);
});

test("NewsFeed 邏輯：只翻看得到的（其他組收合時不翻）、已送過的不重送、翻完依 id 併回目前列表", async () => {
  const { pendingTranslateIds, mergeTranslated } = await import("../src/ui/news-feed-logic.ts");
  const n = (id: string, important: boolean, needs_ai = true) => ({ id, important, needs_ai });
  const news = [n("a", true), n("b", false), n("c", true, false), n("d", false)];
  const o = { showOthers: true, othersOpen: false, tried: new Set<string>(), max: 20 };
  assert.deepEqual(pendingTranslateIds(news, o), ["a"], "其他組收合：只翻重要的");
  assert.deepEqual(pendingTranslateIds(news, { ...o, othersOpen: true }), ["a", "b", "d"], "展開後才翻其他");
  assert.deepEqual(pendingTranslateIds(news, { ...o, othersOpen: true, tried: new Set(["a"]) }), ["b", "d"]);
  assert.deepEqual(pendingTranslateIds(news, { ...o, showOthers: false }), ["a", "b", "d"], "沒有收合組的頁面全部都看得到");
  assert.deepEqual(pendingTranslateIds(news, { ...o, othersOpen: true, max: 2 }), ["a", "b"]);
  // 請求期間列表已經被別的更新改過（例如 points 回來）：依 id 併回，不整個覆蓋
  const current = [{ id: "a", title_zh: null as string | null, points_zh: ["重點"], important: true, needs_ai: true }];
  const merged = mergeTranslated(current, [{ id: "a", title_zh: "中", important: false }, { id: "zzz", title_zh: "x", important: true }]);
  assert.deepEqual(merged, [{ id: "a", title_zh: "中", points_zh: ["重點"], important: false, needs_ai: false }]);
});

test("NewsFeed 邏輯：換代號篩選後，舊代號送出的翻譯回應不能併回新列表", async () => {
  const { isStaleTranslate, mergeTranslated } = await import("../src/ui/news-feed-logic.ts");
  assert.equal(isStaleTranslate("AAPL", "NVDA"), true, "請求用 AAPL 送出，畫面已切到 NVDA");
  assert.equal(isStaleTranslate("AAPL", null), true, "切回全部");
  assert.equal(isStaleTranslate(null, "NVDA"), true);
  assert.equal(isStaleTranslate("NVDA", "NVDA"), false);
  assert.equal(isStaleTranslate(null, null), false);
  // 沒擋的後果：舊代號算的 important 會蓋掉新畫面的分組
  const cur = [{ id: "x", important: true, needs_ai: true }];
  assert.equal(mergeTranslated(cur, [{ id: "x", important: false }])[0].important, false);
});

test("同一則同時被兩個請求翻（換篩選、兩個分頁、兩個使用者）：只呼叫一次模型、只扣一次額度，兩邊都拿到中文；失敗會放掉認領", async () => {
  const { db, sql } = await seeded();
  const { translateNews } = await import("../src/server/news-ai.ts");
  const { ai, calls } = fakeAi(async (req) => {
    await new Promise((r) => setTimeout(r, 80));
    return enrichAnswer(req);
  });
  const [a, b] = await Promise.all([translateNews(db, ai, user(), [NVDA], ["n1", "n3"]), translateNews(db, ai, user(), [NVDA], ["n1", "n3"], "NVDA")]);
  assert.equal(calls.length, 1, "第二個請求等第一個寫回，不再呼叫");
  assert.deepEqual([a.items.length, b.items.length], [2, 2]);
  assert.equal(b.items.find((i) => i.id === "n1")?.title_zh, "中文：Nvidia beats estimates");
  assert.equal(b.ai.used, 1);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM news WHERE ai_claim_at IS NOT NULL").get() as { n: number }).n, 0, "翻完放掉認領");
  // 模型失敗：認領要放掉，下一次能重送
  const bad = fakeAi(() => {
    throw new Error("boom");
  });
  await assert.rejects(translateNews(db, bad.ai, user("z"), [NVDA], ["n2"]));
  assert.equal((sql.prepare("SELECT ai_claim_at FROM news WHERE id = 'n2'").get() as { ai_claim_at: string | null }).ai_claim_at, null);
  await translateNews(db, ai, user("z"), [NVDA], ["n2"]);
  assert.equal(calls.length, 2);
});
