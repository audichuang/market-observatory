// 新聞 AI 的純函式（提示詞與解析、免費的重要規則）與讀取端（newsView）；伺服器不呼叫模型，
// 翻譯與重點由本機排程寫入，見 tests/ai-batch.test.ts。
import assert from "node:assert/strict";
import { test } from "node:test";
import { Series } from "../src/lib/analytics.ts";
import { easternDate } from "../src/lib/calendar.ts";
import { digestPrompt, enrichPrompt, marketPrompt, extractArticleText, isImportant, matchYahooArticle, newsFingerprint, parseDigest, parseEnrich, parsePoints, pointsPrompt } from "../src/lib/news-ai.ts";
import type { Viewer } from "../src/server/account.ts";
import { buildSnapshot } from "../src/lib/snapshot.ts";
import { saveSnapshots } from "../src/server/repo.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

const items = [
  { id: "a", title: "Nvidia beats estimates", summary: null, symbols: ["SPY", "NVDA"], primarySymbol: "NVDA" },
  { id: "b", title: "3 AI Stocks to Buy", summary: "Dell backlog", symbols: ["NVDA"], primarySymbol: "DELL" },
];
const user = (id = "u1", isOwner = false): Viewer => ({ id, email: `${id}@x.com`, name: id, isOwner });
const NVDA = { key: "NVDA", company: "NVIDIA", tickers: ["NVDA"] };

function timingSections(prompt: string) {
  for (const anchor of ["無法確認在收盤前發布", "不能當成這天收盤漲跌的原因", "公布後立即"]) assert.ok(prompt.includes(anchor), anchor);
  assert.match(prompt, /新聞本身.*說法/);
  assert.match(prompt, /〔具名來源〕認為／指出/);
  assert.match(prompt, /沒有盤中資料.*盤中逆轉/);
  const [before, unconfirmed] = prompt.split("\n收盤前已發布的新聞：\n")[1]?.split("\n無法確認在收盤前發布的新聞：\n") ?? [];
  assert.ok(before && unconfirmed, "兩個新聞段落必須明確分開");
  return { before, unconfirmed };
}

test("公司提示詞：收盤前、盤後、時間不明分段，舊 Worker 未標時間的新聞也禁止收盤因果句", () => {
  const news = (title: string) => ({ titleZh: title, title: `English ${title}`, summary: `摘要 ${title}`, tone: "neutral", category: "財報" });
  const p = digestPrompt({
    key: "NVDA", company: "NVIDIA", date: "2026-10-23", returnPct: -1, contributionPts: -2,
    news: [{ ...news("已確認新聞 A"), timing: "before-close" }, news("舊版新聞 D")],
    unconfirmed: [{ ...news("盤後新聞 B"), timing: "after-close" }, { ...news("時間不明新聞 C"), timing: "unknown" }],
  }).user;
  const { before, unconfirmed } = timingSections(p);
  assert.match(before, /已確認新聞 A/);
  assert.doesNotMatch(before, /盤後新聞 B|時間不明新聞 C|舊版新聞 D/);
  assert.doesNotMatch(unconfirmed, /已確認新聞 A/);
  assert.match(unconfirmed, /\[收盤後\].*盤後新聞 B/);
  assert.match(unconfirmed, /\[時間不明\].*時間不明新聞 C/);
  assert.match(unconfirmed, /\[時間不明\].*舊版新聞 D/);
  assert.match(unconfirmed, /English 盤後新聞 B/);
  assert.match(unconfirmed, /摘要 時間不明新聞 C/);
});

test("大盤提示詞：新 Worker 分兩桶，舊 Worker 未給 unconfirmed 時所有標題列為時間不明", () => {
  const market = {
    date: "2026-10-23", close: 7560, changePts: -40, returnPct: -0.53,
    vix: 18, vixChange: 1, spreadPct: -0.3, movers: [], restPts: -40, news: ["大盤新聞 A"],
  };
  const current = timingSections(marketPrompt({ ...market, unconfirmed: [
    { id: "B", title: "大盤盤後 B", timing: "after-close" },
    { id: "C", title: "大盤不明 C", timing: "unknown" },
  ] }).user);
  assert.match(current.before, /大盤新聞 A/);
  assert.doesNotMatch(current.before, /大盤盤後 B|大盤不明 C/);
  assert.doesNotMatch(current.unconfirmed, /大盤新聞 A/);
  assert.match(current.unconfirmed, /\[收盤後\].*大盤盤後 B/);
  assert.match(current.unconfirmed, /\[時間不明\].*大盤不明 C/);
  const legacy = timingSections(marketPrompt(market).user);
  assert.doesNotMatch(legacy.before, /大盤新聞 A/);
  assert.match(legacy.unconfirmed, /\[時間不明\].*大盤新聞 A/);
  const empty = timingSections(marketPrompt({ ...market, unconfirmed: [] }).user);
  assert.match(empty.before, /大盤新聞 A/);
  assert.doesNotMatch(empty.unconfirmed, /大盤新聞 A/);
});
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

test("newsView：摘要列出原始新聞來源，已清除的新聞計入缺少數量", async (t) => {
  const { db, sql, today } = await seeded();
  t.after(() => sql.close());
  const { newsView } = await import("../src/server/views.ts");
  sql.exec("UPDATE news SET title_zh = '輝達財報優於預期' WHERE id = 'n1'");
  sql.prepare("INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES ('NVDA', ?, '輝達財報優於預期。', 'positive', 'n1,gone', 'f', 'm', 'x')").run(today);
  const out = await newsView({ env: { DB: db }, req: { query: () => undefined, url: "https://x/api/v1/news" } }, user("viewer"));
  assert.deepEqual(out.digests[0].sources.map((source) => ({ ...source })), [{
    id: "n1", title: "Nvidia beats estimates", title_zh: "輝達財報優於預期", url: "https://example.com/n1", publisher: "p", published_at: today,
  }]);
  assert.equal(out.digests[0].sourcesMissing, 1);
  assert.ok(!("news_ids" in out.digests[0]));
});

test("newsView：舊合成來源 [] 與空字串都當空，逗號清單會 trim 並去掉空項目", async (t) => {
  const { db, sql, today } = await seeded();
  t.after(() => sql.close());
  const { newsView } = await import("../src/server/views.ts");
  sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('watchlist:viewer', ?, 'x')").run(JSON.stringify([NVDA, AAPL, GOOG]));
  const insert = sql.prepare("INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES (?, ?, '公司重點', 'neutral', ?, 'f', 'm', 'x')");
  insert.run("NVDA", today, "[]");
  insert.run("AAPL", today, "");
  insert.run("GOOG", today, " , n3, n1, , ");
  const out = await newsView({ env: { DB: db }, req: { query: () => undefined, url: "https://x/api/v1/news" } }, user("viewer"));
  const bySymbol = Object.fromEntries(out.digests.map((d) => [d.symbol, d]));
  for (const symbol of ["NVDA", "AAPL"]) {
    assert.deepEqual(bySymbol[symbol].sources, []);
    assert.equal(bySymbol[symbol].sourcesMissing, 0);
  }
  assert.deepEqual(bySymbol.GOOG.sources.map((s) => s.id), ["n3", "n1"]);
  assert.equal(bySymbol.GOOG.sourcesMissing, 0);
});

test("newsView：三筆摘要合計 150 則來源完整回傳，順序依各自 news_ids 而非新聞排序", async (t) => {
  const { db, sql, today } = await seeded();
  t.after(() => sql.close());
  const { newsView } = await import("../src/server/views.ts");
  const members = [NVDA, AAPL, GOOG];
  sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('watchlist:viewer', ?, 'x')").run(JSON.stringify(members));
  const insertNews = sql.prepare("INSERT INTO news (id, symbols, title, url, source, fetched_at, published_at) VALUES (?, ?, ?, ?, 'test', 'x', ?)");
  const insertDigest = sql.prepare("INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES (?, ?, '公司重點', 'neutral', ?, 'f', 'm', 'x')");
  const expected = new Map<string, string[]>();
  for (const member of members) {
    const ids = Array.from({ length: 50 }, (_, i) => `${member.key}-${i}`);
    for (const id of ids) insertNews.run(id, member.key, `Title ${id}`, `https://example.com/${id}`, today);
    ids.reverse();
    expected.set(member.key, ids);
    insertDigest.run(member.key, today, ids.join(","));
  }
  const out = await newsView({ env: { DB: db }, req: { query: () => undefined, url: "https://x/api/v1/news" } }, user("viewer"));
  assert.equal(out.digests.length, 3);
  for (const digest of out.digests) {
    assert.deepEqual(digest.sources.map((s) => s.id), expected.get(digest.symbol));
    assert.equal(digest.sourcesMissing, 0);
  }
});

test("overviewView：大盤與公司摘要帶來源及缺少數量，大盤空引用仍保留摘要", async (t) => {
  const { db, sql, today } = await seeded();
  t.after(() => sql.close());
  const { overviewView } = await import("../src/server/views.ts");
  sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('watchlist:viewer', ?, 'x')").run(JSON.stringify([NVDA]));
  const snapshot = buildSnapshot({ tradeDate: today, series: { SPX: new Series([{ date: today, close: 100 }]), NVDA: new Series([{ date: today, close: 200 }]) }, checks: {}, weights: null, members: [NVDA] });
  assert.ok(snapshot);
  await saveSnapshots(db, [snapshot], "摘要來源測試");
  sql.prepare("INSERT INTO news_digests (symbol, date, summary, tone, news_ids, digest, model, created_at) VALUES ('SPX', ?, '市場重點', 'neutral', ' n3, gone, n1, ', 'f', 'm', 'x'), ('NVDA', ?, '公司重點', 'positive', 'n1', 'f', 'm', 'x')").run(today, today);
  const ctx = { env: { DB: db }, req: { query: () => undefined, url: "https://x/api/v1/overview" } };
  const out = await overviewView(ctx, user("viewer"));
  assert.deepEqual(out.market?.sources.map((s) => [s.id, s.title, s.title_zh, s.url, s.publisher, s.published_at]), [
    ["n3", "Fed holds rates", null, "https://example.com/n3", "p", today],
    ["n1", "Nvidia beats estimates", null, "https://example.com/n1", "p", today],
  ]);
  assert.equal(out.market?.sourcesMissing, 1);
  assert.ok(out.market && !("news_ids" in out.market));
  assert.deepEqual(out.digests[0].sources.map((s) => s.id), ["n1"]);
  assert.equal(out.digests[0].sourcesMissing, 0);
  sql.exec("UPDATE news_digests SET news_ids = '[]' WHERE symbol = 'SPX'");
  const empty = await overviewView(ctx, user("viewer"));
  assert.deepEqual(empty.market, { date: today, summary: "市場重點", tone: "neutral", sources: [], sourcesMissing: 0 });
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

test("大盤提示詞：逐家列前 6 家、其餘追蹤公司併一行；餘數叫「其他成分股（含近似誤差）」；允許寫沒有單一催化因素、不推測後市", () => {
  const mover = (key: string, ret: number, pts: number) => ({ key, company: key, returnPct: ret, contributionPts: pts });
  const p = marketPrompt({
    date: "2026-10-23",
    close: 7560,
    changePts: -40,
    returnPct: -0.53,
    vix: 18.2,
    vixChange: 1.1,
    spreadPct: -0.3,
    movers: [mover("TSLA", -1, -0.8), mover("NVDA", -3, -12), mover("AAPL", -2, -9), mover("MSFT", -1.5, -6), mover("AMZN", -1.2, -4), mover("GOOGL", -1, -3), mover("META", 0.5, 1.2), mover("AVGO", -0.4, -0.6)],
    restPts: -5.8,
    news: ["聯準會按兵不動"],
  }).user;
  assert.match(p, /- NVDA（NVDA）-3\.00%，貢獻 -12\.0 點/);
  assert.match(p, /- 未列出的追蹤公司（2 家）合計，貢獻 -1\.4 點/, "最小的兩家（TSLA、AVGO）併成一行");
  assert.doesNotMatch(p, /TSLA|AVGO/);
  assert.match(p, /其他成分股（含近似誤差）合計 -5\.8 點/);
  assert.match(p, /沒有可清楚辨識的單一催化因素/);
  assert.doesNotMatch(p, /多數股票較弱|其餘成分股/);
  const d = digestPrompt({ key: "NVDA", company: "NVIDIA", date: "2026-10-23", returnPct: -0.59, contributionPts: -3.51, news: [] }).user;
  assert.doesNotMatch(d, /可能怎麼影響股價/);
  assert.match(d, /沒有可清楚辨識的單一催化因素/);
});
