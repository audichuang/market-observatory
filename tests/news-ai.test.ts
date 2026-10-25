// 新聞 AI 加工：回應解析的防呆、哪些新聞算重要、排程工作（用假的模型）會翻譯、寫重點、新聞沒變不重寫。
import assert from "node:assert/strict";
import { test } from "node:test";
import { digestPrompt, enrichPrompt, newsFingerprint, parseDigest, parseEnrich } from "../src/lib/news-ai.ts";
import { Budget } from "../src/lib/sources/http.ts";
import { easternDate } from "../src/lib/calendar.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

const items = [
  { id: "a", title: "Nvidia beats estimates", summary: null, symbols: ["SPY", "NVDA"], primarySymbol: "NVDA" },
  { id: "b", title: "3 AI Stocks to Buy", summary: "Dell backlog", symbols: ["NVDA"], primarySymbol: "DELL" },
];

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
});

test("提示詞帶上代號、主角與摘要；重點的提示詞帶上當天漲跌", () => {
  const p = enrichPrompt(items)[1].content;
  assert.match(p, /1\. \[SPY,NVDA\] Nvidia beats estimates/);
  assert.match(p, /來源標的主角：DELL；摘要：Dell backlog/);
  const d = digestPrompt({ key: "NVDA", company: "NVIDIA", date: "2026-10-23", returnPct: -0.59, contributionPts: -3.51, news: [] })[1].content;
  assert.match(d, /−?-0\.59%.*-3\.5 點|當天股價：-0\.59%，對 S&P 500 貢獻 -3\.5 點/);
  assert.equal(parseDigest('{"summary":"短"}'), null);
  assert.deepEqual(parseDigest('{"summary":"輝達財報優於預期，帶動盤後上漲。","tone":"positive"}'), { summary: "輝達財報優於預期，帶動盤後上漲。", tone: "positive" });
  assert.equal(newsFingerprint(["b", "a"]), newsFingerprint(["a", "b"]));
});

test("重要與否：在講名單公司、或大盤總經才算；還沒加工的先當重要", async () => {
  const { newsMatters } = await import("../src/server/views.ts");
  const keys = ["NVDA", "SPY"];
  assert.equal(newsMatters({ focus: null, category: null }, keys), true);
  assert.equal(newsMatters({ focus: "NVDA", category: "財報" }, keys), true);
  assert.equal(newsMatters({ focus: "", category: "投資觀點" }, keys), false);
  assert.equal(newsMatters({ focus: "SPY", category: "總經與市場" }, keys), true);
  assert.equal(newsMatters({ focus: "SPY", category: "分析師" }, keys), false);
  assert.equal(newsMatters({ focus: "TSLA", category: "財報" }, keys), false);
});

test("排程工作：翻譯每則、替有新聞的公司寫重點，每次呼叫都扣額度；新聞沒變不重寫", async () => {
  const { db, sql } = await migratedDb();
  const { jobNewsAi } = await import("../src/server/news-ai.ts");
  const today = easternDate();
  const ins = sql.prepare("INSERT INTO news (id, symbols, title, url, publisher, published_at, source, fetched_at) VALUES (?, ?, ?, 'u', 'p', ?, 'nasdaq', 'x')");
  ins.run("n1", "SPY,NVDA", "Nvidia beats estimates", today);
  ins.run("n2", "NVDA", "3 AI Stocks to Buy", today);
  ins.run("n3", "SPY", "Fed holds rates", today);
  const calls: string[] = [];
  const llm = {
    model: "fake",
    async chat(messages: { content: string }[], budget: Budget) {
      budget.take("https://workers-ai.cloudflare/fake");
      const prompt = messages[1].content;
      calls.push(prompt.includes("逐則處理") ? "enrich" : "digest");
      if (prompt.includes("逐則處理")) {
        const rows = [...prompt.matchAll(/^(\d+)\. \[([^\]]+)\] (.+)$/gm)].map((m) => {
          const n = Number(m[1]);
          const title = m[3];
          const focus = title.includes("Nvidia") ? ["NVDA"] : title.includes("Fed") ? ["SPY"] : [];
          return { n, title_zh: `中文：${title}`, tone: "positive", category: title.includes("Fed") ? "總經與市場" : "財報", focus };
        });
        return JSON.stringify({ items: rows });
      }
      return '{"summary":"輝達財報優於預期，市場反應正面。","tone":"positive"}';
    },
  };
  const budget = new Budget(100);
  const r1 = await jobNewsAi(db, llm, budget);
  assert.equal(r1.status, "ok", r1.summary);
  assert.deepEqual(calls, ["enrich", "digest"], "三則一批翻譯；只有 NVDA 有真的在講它的新聞（預設名單沒有 SPY）");
  assert.equal(budget.used, 2);
  const rows = sql.prepare("SELECT id, title_zh, focus FROM news ORDER BY id").all() as { id: string; title_zh: string; focus: string }[];
  assert.deepEqual(rows.map((r) => [r.id, r.focus]), [["n1", "NVDA"], ["n2", ""], ["n3", "SPY"]]);
  const dg = sql.prepare("SELECT symbol, date, summary FROM news_digests").all() as { symbol: string; date: string; summary: string }[];
  assert.deepEqual(dg.map((d) => [d.symbol, d.date]), [["NVDA", today]]);

  calls.length = 0;
  const r2 = await jobNewsAi(db, llm, new Budget(100));
  assert.deepEqual(calls, [], `新聞沒變不重寫：${r2.summary}`);

  // 沒有模型（本機、測試）：整個略過、不打任何請求
  const r3 = await jobNewsAi(db, null, new Budget(100));
  assert.match(r3.summary, /略過/);
});
