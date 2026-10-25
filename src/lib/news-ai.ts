// 新聞的 AI 加工（純函式）：提示詞與回應解析。讀者不一定懂英文，而且來源的新聞很雜：
// 很多是選股標題黨、只順帶提到某家公司、或是不相干公司的債券目標價。AI 逐則翻成繁中、標利多利空與類別，
// 並判斷「這則真正在講誰」（focus），沒在講名單公司也不是大盤總經的就當雜訊收起來。

export const NEWS_CATEGORIES = ["財報", "分析師", "產品與業務", "法規與訴訟", "總經與市場", "投資觀點"] as const;
export type NewsTone = "positive" | "negative" | "neutral";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

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

const STYLE = `用台灣繁體中文與台灣慣用的財經詞彙（財報、營收、晶片、股價、分析師、目標價、調升／調降評等、庫藏股、法說會），不可出現簡體字或中國用語（例如「芯片」「回購」「營收同比」）。公司保留英文代號或常用中文名（輝達、蘋果、微軟、特斯拉可用中文）。`

export function enrichPrompt(items: EnrichInput[]): ChatMessage[] {
  const lines = items.map((it, i) => {
    const extra = [it.primarySymbol ? `來源標的主角：${it.primarySymbol}` : null, it.summary ? `摘要：${it.summary.slice(0, 300)}` : null].filter(Boolean).join("；");
    return `${i + 1}. [${it.symbols.join(",")}] ${it.title}${extra ? `\n   （${extra}）` : ""}`;
  });
  return [
    {
      role: "system",
      content: `你是台灣的財經編輯，讀者看不懂英文。${STYLE}只輸出 JSON，不要其他文字。`,
    },
    {
      role: "user",
      content: `逐則處理下列美股新聞（方括號是這則被歸在哪些代號底下，SPY 代表大盤）：
- title_zh：標題翻成自然的繁中，保留數字與代號。
- tone：對 focus 裡的公司股價而言是 positive、negative 或 neutral；判斷不出來就 neutral。
- category：從 ${NEWS_CATEGORIES.join("、")} 選一個。選股推薦、「我會買哪檔」這類評論文選「投資觀點」。
- focus：這則真正在講方括號裡的哪些代號。只是順帶提到、泛泛的選股文、跟名單無關的其他公司（例如別家公司的債券目標價），都不算，給 []。只有在談大盤、利率、經濟數據、整體市場時才放 "SPY"（方括號裡沒有 SPY 也可以放）。

${lines.join("\n")}

輸出：{"items":[{"n":1,"title_zh":"...","tone":"neutral","category":"...","focus":["NVDA"]}]}`,
    },
  ];
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
export function parseEnrich(text: string, items: EnrichInput[]): Enriched[] {
  const data = extractJson(text) as { items?: { n?: unknown; title_zh?: unknown; tone?: unknown; category?: unknown; focus?: unknown }[] };
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

export function digestPrompt(d: DigestInput): ChatMessage[] {
  const move =
    d.returnPct === null
      ? "當天股價：無資料（休市或尚未收盤）"
      : `當天股價：${d.returnPct >= 0 ? "+" : ""}${d.returnPct.toFixed(2)}%${d.contributionPts === null ? "" : `，對 S&P 500 貢獻 ${d.contributionPts >= 0 ? "+" : ""}${d.contributionPts.toFixed(1)} 點`}`;
  const lines = d.news.map((n, i) => `${i + 1}. ${n.titleZh}（${n.category}／${n.tone}）\n   原文：${n.title}${n.summary ? `\n   摘要：${n.summary.slice(0, 300)}` : ""}`);
  return [
    { role: "system", content: `你是台灣的財經編輯，替看不懂英文的散戶整理個股重點。${STYLE}只輸出 JSON。` },
    {
      role: "user",
      content: `${d.company}（${d.key}）${d.date}（美東日期）的新聞如下，${move}。
用 1～2 句、合計不超過 70 個字，說明這天跟這家公司有關、真正重要的事，以及可能怎麼影響股價。
只根據下面的新聞，不要編造數字或原因；如果新聞看不出股價為什麼漲跌，就不要硬解釋漲跌。不要用「根據新聞」「綜合以上」這種開頭。
tone 是整體對股價偏 positive、negative 或 neutral。

${lines.join("\n")}

輸出：{"summary":"...","tone":"neutral"}`,
    },
  ];
}

export function parseDigest(text: string): { summary: string; tone: NewsTone } | null {
  const data = extractJson(text) as { summary?: unknown; tone?: unknown };
  if (typeof data.summary !== "string" || data.summary.trim().length < 6) return null;
  return { summary: data.summary.trim().slice(0, 160), tone: TONES.has(data.tone as NewsTone) ? (data.tone as NewsTone) : "neutral" };
}

/** 一組新聞 id 的指紋：新聞沒變就不重寫重點。 */
export function newsFingerprint(ids: string[]): string {
  let h = 2166136261;
  for (const ch of [...ids].sort().join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36);
}
