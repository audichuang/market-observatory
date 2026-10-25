// 新聞 AI 的純函式（提示詞與解析、免費的重要規則）與讀取端（newsView）；伺服器不呼叫模型，
// 翻譯與重點由本機排程寫入，見 tests/ai-batch.test.ts。
import assert from "node:assert/strict";
import { test } from "node:test";
import { easternDate } from "../src/lib/calendar.ts";
import { digestPrompt, enrichPrompt, extractArticleText, isImportant, matchYahooArticle, newsFingerprint, parseDigest, parseEnrich, parsePoints, pointsPrompt } from "../src/lib/news-ai.ts";
import type { Viewer } from "../src/server/account.ts";
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

test("Worker 排程不呼叫 AI：news 排程只剩抓新聞與分析師，沒有 news-ai 工作", async () => {
  const { SCHEDULES, JOB_NAMES } = await import("../src/server/jobs.ts");
  assert.deepEqual([...SCHEDULES.news], ["news", "analysts"]);
  assert.ok(!(JOB_NAMES as string[]).includes("news-ai"));
});

test("newsView：每則帶 AI 欄位與免費 important、points 轉成陣列、digests 在頂層；不洩漏 primary_symbol", async () => {
  const { db, sql, today } = await seeded();
  const { newsView } = await import("../src/server/views.ts");
  sql.prepare("UPDATE news SET points_zh = ? WHERE id = 'n1'").run(JSON.stringify(["重點一"]));
  sql.prepare("INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES ('NVDA', ?, '輝達財報優於預期。', 'positive', 'n1', 'f', 'm', 'x')").run(today);
  const c = { env: { DB: db }, req: { query: () => undefined, url: "https://x/api/v1/news" } };
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
  assert.ok(!("ai" in out) && !("needs_ai" in byId.n1));
});

// ── 審查後修正 ──

test("matchYahooArticle: same title ignoring case, punctuation and entities; never a different article", () => {
  const news = [
    { title: "Apple Joins Nvidia in the $5 Trillion Club", link: "https://finance.yahoo.com/a" },
    { title: "Here&#39;s How Many Shares of Apple Stock You&#x27;d Need", link: "https://finance.yahoo.com/b" },
    { title: "Apple Is One of the Most Profitable Businesses", link: "http://insecure.example/c" },
  ];
  assert.equal(matchYahooArticle("apple joins NVIDIA in the $5 trillion club.", news), "https://finance.yahoo.com/a");
  assert.equal(matchYahooArticle("Here's How Many Shares of Apple Stock You'd Need", news), "https://finance.yahoo.com/b");
  assert.equal(matchYahooArticle("Apple Joins Nvidia", news), null);
  assert.equal(matchYahooArticle("Apple Is One of the Most Profitable Businesses", news), null);
  assert.equal(matchYahooArticle("", news), null);
});
