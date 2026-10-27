// 新聞的 AI 加工（純函式）：提示詞、結構化輸出的 schema 與回應解析。讀者不一定懂英文，而且來源的新聞很雜：
// 很多是選股標題黨、只順帶提到某家公司、或是不相干公司的債券目標價。AI 逐則翻成繁中、標利多利空與類別，
// 並判斷「這則真正在講誰」（focus），沒在講名單公司也不是大盤總經的就當雜訊收起來。
// 呼叫由本機排程的 agent 執行（scripts/ai-batch.ts 撈待辦、產生提示詞，結果經 /api/admin/ai 寫回，見 src/server/ai-batch.ts）。

export const NEWS_CATEGORIES = ["財報", "分析師", "產品與業務", "法規與訴訟", "總經與市場", "投資觀點"] as const;
export type NewsTone = "positive" | "negative" | "neutral";

/** 一次模型呼叫的提示詞：system 放角色與用語規則，user 放這次的內容。 */
export interface Prompt {
  system: string;
  user: string;
}

const TONE_SCHEMA = { type: "string", enum: ["positive", "negative", "neutral"] } as const;

export const ENRICH_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          title_zh: { type: "string" },
          tone: TONE_SCHEMA,
          category: { type: "string", enum: [...NEWS_CATEGORIES] },
          focus: { type: "array", items: { type: "string" } },
        },
        required: ["n", "title_zh", "tone", "category", "focus"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

export const DIGEST_SCHEMA = {
  type: "object",
  properties: { summary: { type: "string" }, tone: TONE_SCHEMA },
  required: ["summary", "tone"],
  additionalProperties: false,
} as const;

export const POINTS_SCHEMA = {
  type: "object",
  properties: { points: { type: "array", items: { type: "string" } }, tone: TONE_SCHEMA },
  required: ["points", "tone"],
  additionalProperties: false,
} as const;

export interface EnrichInput {
  id: string;
  title: string;
  summary: string | null;
  /** 這則掛在哪些代號底下（抓新聞時的代號，SPY 代表大盤） */
  symbols: string[];
  primarySymbol: string | null;
}

export interface Enriched {
  id: string;
  titleZh: string;
  tone: NewsTone;
  category: string;
  /** 真正在講的代號（symbols 裡的，或 SPY＝大盤／總經）；空陣列＝雜訊 */
  focus: string[];
}

const STYLE = `用台灣繁體中文與台灣慣用的財經詞彙：財報、營收、晶片、股價、分析師、目標價、調升／調降評等、庫藏股（不是「回購」）、法說會、年增／季增（不是「同比」「環比」）、獲利（不是「利潤」）、軟體（不是「軟件」）、記憶體（不是「內存」）。不可出現簡體字或中國用語（例如「芯片」「回購」「營收同比」）。公司保留英文代號或常用中文名（輝達、蘋果、微軟、特斯拉可用中文）。`

export function enrichPrompt(items: EnrichInput[]): Prompt {
  const lines = items.map((it, i) => {
    const extra = [it.primarySymbol ? `來源標的主角：${it.primarySymbol}` : null, it.summary ? `摘要：${it.summary.slice(0, 300)}` : null].filter(Boolean).join("；");
    return `${i + 1}. [${it.symbols.join(",")}] ${it.title}${extra ? `\n   （${extra}）` : ""}`;
  });
  return {
    system: `你是台灣的財經編輯，讀者看不懂英文。${STYLE}`,
    user: `逐則處理下列美股新聞（方括號是這則被歸在哪些代號底下，SPY 代表大盤）：
- title_zh：標題翻成自然的繁中，保留數字、代號與專有名詞（ETF 名稱、公司名）。
- tone：對 focus 裡的公司股價而言是 positive、negative 或 neutral；判斷不出來就 neutral。
- category：從 ${NEWS_CATEGORIES.join("、")} 選一個。選股推薦、「我會買哪檔」這類評論文選「投資觀點」。
- focus：這則真正在講方括號裡的哪些代號。只是順帶提到、泛泛的選股文、跟名單無關的其他公司（例如別家公司的債券目標價），都不算，給 []。只有在談大盤、利率、經濟數據、整體市場時才放 "SPY"（方括號裡沒有 SPY 也可以放）。

${lines.join("\n")}

每則輸出一筆，n 是上面的序號。`,
  };
}

/** 從模型回應挑出第一個 JSON 物件（模型偶爾會包在 ```json 裡或前後加字）。 */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("回應裡沒有 JSON");
  return JSON.parse(text.slice(start, end + 1));
}

const TONES = new Set<NewsTone>(["positive", "negative", "neutral"]);

/** 對回應逐則驗證；缺的、格式不對的就略過（下次再處理），focus 只收輸入裡有的代號。 */
export function parseEnrich(input: string | unknown, items: EnrichInput[]): Enriched[] {
  const data = (typeof input === "string" ? extractJson(input) : input) as { items?: { n?: unknown; title_zh?: unknown; tone?: unknown; category?: unknown; focus?: unknown }[] };
  const out: Enriched[] = [];
  for (const r of data.items ?? []) {
    const idx = typeof r.n === "number" ? r.n - 1 : -1;
    const it = items[idx];
    if (!it || typeof r.title_zh !== "string" || !r.title_zh.trim()) continue;
    const tone = TONES.has(r.tone as NewsTone) ? (r.tone as NewsTone) : "neutral";
    const category = typeof r.category === "string" && (NEWS_CATEGORIES as readonly string[]).includes(r.category) ? r.category : "投資觀點";
    // 大盤（SPY）一律可選：談整體市場的新聞常掛在個股底下
    const focus = Array.isArray(r.focus) ? [...new Set(r.focus.filter((s): s is string => typeof s === "string" && (it.symbols.includes(s) || s === "SPY")))] : [];
    out.push({ id: it.id, titleZh: r.title_zh.trim().slice(0, 200), tone, category, focus });
  }
  return out;
}

export interface DigestInput {
  key: string;
  company: string;
  date: string;
  /** 當天報酬（%）與對指數的貢獻點數；當天沒交易或還沒收盤時為 null */
  returnPct: number | null;
  contributionPts: number | null;
  news: { titleZh: string; title: string; summary: string | null; tone: string; category: string }[];
}

export function digestPrompt(d: DigestInput): Prompt {
  const move =
    d.returnPct === null
      ? "當天股價：無資料（休市或尚未收盤）"
      : `當天股價：${d.returnPct >= 0 ? "+" : ""}${d.returnPct.toFixed(2)}%${d.contributionPts === null ? "" : `，對 S&P 500 貢獻 ${d.contributionPts >= 0 ? "+" : ""}${d.contributionPts.toFixed(1)} 點`}`;
  const lines = d.news.map((n, i) => `${i + 1}. ${n.titleZh}（${n.category}／${n.tone}）\n   原文：${n.title}${n.summary ? `\n   摘要：${n.summary.slice(0, 300)}` : ""}`);
  return {
    system: `你是台灣的財經編輯，替看不懂英文的散戶整理個股重點。${STYLE}`,
    user: `${d.company}（${d.key}）${d.date}（美東日期）的新聞如下，${move}。
用 1～2 句、合計不超過 70 個字，說明這天跟這家公司有關、實際發生了什麼，以及新聞裡有沒有具名人士對股價的說法。
只根據下面的新聞，不要編造數字或原因，也不要自己推測之後的走勢；如果新聞看不出股價為什麼漲跌，就直接寫「沒有可清楚辨識的單一催化因素」，不要硬解釋漲跌。不要用「根據新聞」「綜合以上」這種開頭。
tone 是整體對股價偏 positive、negative 或 neutral。

${lines.join("\n")}`,
  };
}

export interface MarketInput {
  date: string;
  close: number;
  changePts: number | null;
  returnPct: number | null;
  vix: number | null;
  vixChange: number | null;
  /** 等權重減市值加權（百分點） */
  spreadPct: number | null;
  /** 追蹤名單裡的每一家（提示詞只逐家列貢獻絕對值最大的幾家，其餘併成一行，各項加總才等於指數漲跌） */
  movers: { key: string; company: string; returnPct: number | null; contributionPts: number | null }[];
  /** 指數漲跌減掉全部追蹤公司貢獻後的餘數：其他成分股，加上權重與價格口徑的近似誤差 */
  restPts: number | null;
  /** 這天大盤、總經的新聞標題（繁中優先） */
  news: string[];
}

const signedNum = (n: number | null, digits: number, unit = "") => (n === null ? "無資料" : `${n >= 0 ? "+" : ""}${n.toFixed(digits)}${unit}`);

/** 大盤那段逐家列出的追蹤公司數；其餘的追蹤公司併成一行。 */
const MARKET_MOVERS_LISTED = 6;

/** 總覽最上面那段「今天為什麼漲跌」：只講整體，個股原因另有每家的重點。 */
export function marketPrompt(m: MarketInput): Prompt {
  const sorted = [...m.movers].sort((a, b) => Math.abs(b.contributionPts ?? 0) - Math.abs(a.contributionPts ?? 0));
  const listed = sorted.slice(0, MARKET_MOVERS_LISTED);
  const unlisted = sorted.slice(MARKET_MOVERS_LISTED);
  const movers = listed.map((x) => `- ${x.company}（${x.key}）${signedNum(x.returnPct, 2, "%")}，貢獻 ${signedNum(x.contributionPts, 1, " 點")}`);
  if (unlisted.length) {
    // restPts excludes every tracked company, so the unlisted ones need their own line for the parts to add up.
    const pts = unlisted.every((x) => x.contributionPts !== null) ? unlisted.reduce((a, x) => a + (x.contributionPts as number), 0) : null;
    movers.push(`- 未列出的追蹤公司（${unlisted.length} 家）合計，貢獻 ${signedNum(pts, 1, " 點")}`);
  }
  return {
    system: `你是台灣的財經編輯，替看不懂英文的散戶寫每日美股收盤重點。${STYLE}`,
    user: `S&P 500 ${m.date}（美東日期）收 ${m.close.toFixed(2)}，${signedNum(m.changePts, 2, " 點")}（${signedNum(m.returnPct, 2, "%")}）。
VIX ${m.vix === null ? "無資料" : m.vix.toFixed(2)}（${signedNum(m.vixChange, 2)}）；等權重減市值加權 ${signedNum(m.spreadPct, 2, " 個百分點")}（負值代表等權重指數落後市值加權指數，也就是較小的成分股平均表現不如大型權值股；不代表多數股票下跌或較弱）。
追蹤公司的點數貢獻：
${movers.join("\n") || "（無資料）"}
其他成分股（含近似誤差）合計 ${signedNum(m.restPts, 1, " 點")}。
以上各項加總約等於指數漲跌點數。
這天的大盤與總經新聞：
${m.news.map((t, i) => `${i + 1}. ${t}`).join("\n") || "（沒有）"}

用 2～3 句、合計不超過 100 個字，說明這天指數怎麼走：漲跌集中在少數權值股還是普遍漲跌、主要是誰、有沒有總經或消息面的原因。
只根據上面的數字與新聞，不要編造原因，也不要推測之後的走勢。新聞說明不了這天的漲跌時，直接寫「沒有可清楚辨識的單一催化因素」，再描述漲跌結構；不要因為漲跌幅大就硬找原因。不要用「根據資料」「綜合以上」這種開頭，不要逐檔列數字。
tone 是這天整體偏 positive、negative 或 neutral。`,
  };
}

export interface PointsInput {
  title: string;
  /** 抓得到的原文正文；抓不到時為 null，只能靠標題與摘要 */
  body: string | null;
  summary: string | null;
  /** 這則掛在哪些代號底下 */
  symbols: string[];
}

export function pointsPrompt(p: PointsInput): Prompt {
  const source = p.body ? `原文正文（可能被截斷）：\n${p.body}` : `${p.summary ? `摘要：${p.summary}` : "（沒有摘要）"}\n注意：抓不到原文，只能根據標題與摘要整理 2～3 點；內容不足的地方不要補充或推測，也不要在重點裡提到「抓不到原文」「原文未提供」這類話，不要重複標題。`;
  return {
    system: `你是台灣的財經編輯，替看不懂英文的散戶整理單篇新聞的重點。${STYLE}`,
    user: `整理下面這篇美股新聞，輸出 3～5 點繁體中文重點，每點一句、不超過 50 個字，先講最重要的。
只根據文章，不要編造數字或原因，不加投資建議。tone 是整體對文中公司股價偏 positive、negative 或 neutral（看不出來就 neutral）。

標題：${p.title}
相關代號：${p.symbols.join(",")}
${source}`,
  };
}

export function parsePoints(data: unknown): { points: string[]; tone: NewsTone } | null {
  const d = data as { points?: unknown; tone?: unknown };
  if (!Array.isArray(d?.points)) return null;
  const points = d.points.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 120)).slice(0, 5);
  if (points.length === 0) return null;
  return { points, tone: TONES.has(d.tone as NewsTone) ? (d.tone as NewsTone) : "neutral" };
}

/** 從 HTML 抽出正文：優先 <article>，取 <p> 的文字，截到 maxChars；抽不到足夠內容就回 null（呼叫端改用標題＋摘要）。 */
export function extractArticleText(html: string, maxChars = 6000): string | null {
  const clean = html.replace(/<(script|style|noscript|svg|nav|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const article = /<article\b[\s\S]*?<\/article>/i.exec(clean)?.[0] ?? clean;
  const decode = (t: string) =>
    t
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  const paras = [...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => decode(m[1])).filter((t) => t.length >= 40);
  const text = paras.join("\n").slice(0, maxChars);
  return text.length >= 200 ? text : null;
}

/**
 * 在 Yahoo 搜尋結果裡找同一篇文章的網址：Nasdaq 文章頁擋機器（Akamai），但同一篇轉載（Motley Fool 等）多半也在 Yahoo、抓得到正文。
 * 只認標題完全相同（忽略大小寫、標點與 HTML 實體），寧可對不到也不要拿錯文章寫重點。
 */
export function matchYahooArticle(title: string, news: { title?: unknown; link?: unknown }[]): string | null {
  const norm = (t: string) => t.toLowerCase().replace(/&[a-z#0-9]+;/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  const want = norm(title);
  if (!want) return null;
  const hit = news.find((n) => typeof n.title === "string" && typeof n.link === "string" && /^https:\/\//i.test(n.link) && norm(n.title) === want);
  return hit ? (hit.link as string) : null;
}

export function parseDigest(input: string | unknown): { summary: string; tone: NewsTone } | null {
  const data = (typeof input === "string" ? extractJson(input) : input) as { summary?: unknown; tone?: unknown };
  if (typeof data.summary !== "string" || data.summary.trim().length < 6) return null;
  return { summary: data.summary.trim().slice(0, 160), tone: TONES.has(data.tone as NewsTone) ? (data.tone as NewsTone) : "neutral" };
}

/**
 * 這則對這個人重不重要。AI 判過（focus 不是 null）就照 focus：真的在講他名單上的公司，或是大盤總經新聞；
 * 還沒判過時用免費規則：primary_symbol 是他名單上的公司 → 重要；primary_symbol 是 null 且掛在 SPY（大盤）底下 → 重要；其餘不重要。
 * wantedKeys 是名單的公司代號（含 SPY 代表要看大盤），wantedTickers 是這些公司的所有股類代號（primary_symbol 用）。
 */
export function isImportant(n: { focus: string | null; category: string | null; primary_symbol: string | null; symbols: string }, wantedKeys: string[], wantedTickers: string[]): boolean {
  if (n.focus !== null) {
    const focus = n.focus.split(",").filter(Boolean);
    return focus.some((f) => f !== "SPY" && wantedKeys.includes(f)) || (focus.includes("SPY") && wantedKeys.includes("SPY") && n.category === "總經與市場");
  }
  if (n.primary_symbol) return wantedTickers.includes(n.primary_symbol) || wantedKeys.includes(n.primary_symbol);
  return wantedKeys.includes("SPY") && n.symbols.split(",").includes("SPY");
}

/**
 * 一則新聞在「某個畫面」的重要與否：不指定代號時看整份名單（含大盤 SPY），指定代號時只看那一個。
 * 網頁的新聞頁（newsView）與標題翻譯的回應共用這條規則，避免翻完之後分組跳掉。
 */
export function importanceFor(members: { key: string; tickers: string[] }[], symbol: string | null) {
  const wantedKeys = symbol ? [symbol] : [...members.map((m) => m.key), "SPY"];
  const wantedTickers = members.filter((m) => wantedKeys.includes(m.key)).flatMap((m) => m.tickers);
  return (n: { focus: string | null; category: string | null; primary_symbol: string | null; symbols: string }): boolean =>
    symbol === "SPY" && n.focus !== null ? n.focus.split(",").includes("SPY") : isImportant(n, wantedKeys, wantedTickers);
}

/** 一組新聞 id 的指紋：新聞沒變就不重寫重點。 */
export function newsFingerprint(ids: string[]): string {
  let h = 2166136261;
  for (const ch of [...ids].sort().join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36);
}
