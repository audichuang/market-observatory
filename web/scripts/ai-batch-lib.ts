import { DIGEST_SCHEMA, ENRICH_SCHEMA, type EnrichInput, POINTS_SCHEMA, type Prompt, digestPrompt, enrichPrompt, extractArticleText, marketPrompt, matchYahooArticle, pointsPrompt } from "../src/lib/news-ai.ts";
import type { ImportBody, ImportReceipt, dailyWork } from "../src/server/ai-batch.ts";

export type BatchKind = "translate" | "daily";
export type DailyWork = Awaited<ReturnType<typeof dailyWork>>;
export type UnavailableReason = "search-failed" | "no-match" | "fetch-failed" | "not-html" | "too-short";
export interface Unavailable { key: string; reason: UnavailableReason }
export interface PointSource { key: string; url: string; bodyChars: number; truncated: boolean }
export interface BatchManifest {
  runId: string;
  kind: BatchKind;
  pulledAt: string;
  unavailable: Unavailable[];
  gitCommit?: string;
  gitDirty?: boolean | "unknown";
  promptSourceSha256?: string;
  schemaSha256?: { translate: string; points: string; digest: string };
  tasksSha256?: string;
  requestedModel?: string;
  snapshot?: { date: string | null; revision: number | null };
  points?: PointSource[];
  answersWrittenAt?: string;
  pushedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  prompt: Prompt;
  schema: unknown;
  meta: { type: "translate"; ids: string[] } | { type: "points"; id: string } | { type: "digest"; key: string; date: string; newsIds: string[] };
}

export interface TextResponse { status: number; type: string; body: string }
export type GetText = (url: string) => Promise<TextResponse>;
export type ArticleResult = { body: string; url: string; truncated: boolean } | { unavailable: UnavailableReason };
type YahooNews = { title?: unknown; link?: unknown }[];
type SearchResult = { news: YahooNews } | { unavailable: "search-failed" };

/** Cache Yahoo searches within one pull, preserving request failures separately from empty results. */
export function createYahooSearch(getText: GetText) {
  const cache = new Map<string, Promise<SearchResult>>();
  return (symbol: string): Promise<SearchResult> => {
    let result = cache.get(symbol);
    if (!result) {
      result = (async (): Promise<SearchResult> => {
        try {
          const response = await getText(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=30&quotesCount=0`);
          if (response.status !== 200) return { unavailable: "search-failed" };
          const data = JSON.parse(response.body) as { news?: YahooNews };
          if (data.news !== undefined && !Array.isArray(data.news)) return { unavailable: "search-failed" };
          return { news: data.news ?? [] };
        } catch {
          return { unavailable: "search-failed" };
        }
      })();
      cache.set(symbol, result);
    }
    return result;
  };
}

/** Only an exact Yahoo title match can supply a body; unavailable articles never become points tasks. */
export async function article(title: string, symbols: string[], getText: GetText, searchYahoo = createYahooSearch(getText)): Promise<ArticleResult> {
  let searchFailed = false;
  for (const symbol of symbols.slice(0, 3)) {
    const search = await searchYahoo(symbol);
    if ("unavailable" in search) {
      searchFailed = true;
      continue;
    }
    const url = matchYahooArticle(title, search.news);
    if (!url) continue;
    let response: TextResponse;
    try {
      response = await getText(url);
    } catch {
      return { unavailable: "fetch-failed" };
    }
    if (response.status !== 200) return { unavailable: "fetch-failed" };
    if (!response.type.toLowerCase().includes("html")) return { unavailable: "not-html" };
    const body = extractArticleText(response.body);
    return body ? { body, url, truncated: body.length === 6000 } : { unavailable: "too-short" };
  }
  return { unavailable: searchFailed ? "search-failed" : "no-match" };
}

export function buildTranslateTasks(translate: EnrichInput[]): Task[] {
  const tasks: Task[] = [];
  for (let i = 0; i < translate.length; i += 20) {
    const items = translate.slice(i, i + 20);
    tasks.push({ id: `t${tasks.length + 1}`, title: `標題翻譯與分類（${items.length} 則）`, prompt: enrichPrompt(items), schema: ENRICH_SCHEMA, meta: { type: "translate", ids: items.map((item) => item.id) } });
  }
  return tasks;
}

export async function buildDailyTasks(work: DailyWork, readArticle: (title: string, symbols: string[]) => Promise<ArticleResult>): Promise<{ tasks: Task[]; unavailable: Unavailable[]; points: PointSource[] }> {
  const tasks: Task[] = [];
  const unavailable: Unavailable[] = [];
  const points: PointSource[] = [];
  if (work.market) {
    const { newsIds, ...market } = work.market;
    tasks.push({ id: "m1", title: `大盤：${market.date} 為什麼漲跌`, prompt: marketPrompt(market), schema: DIGEST_SCHEMA, meta: { type: "digest", key: "SPX", date: market.date, newsIds } });
  }
  work.digests.forEach((digest, i) => tasks.push({
    id: `d${i + 1}`, title: `${digest.company}（${digest.key}）${digest.date} 重點`, prompt: digestPrompt(digest), schema: DIGEST_SCHEMA,
    meta: { type: "digest", key: digest.key, date: digest.date, newsIds: digest.news.map((news) => news.id) },
  }));
  const articles = await Promise.all(work.points.map((point) => readArticle(point.title, point.symbols)));
  work.points.forEach((point, i) => {
    const result = articles[i];
    if ("unavailable" in result) {
      unavailable.push({ key: `points:${point.id}`, reason: result.unavailable });
    } else {
      points.push({ key: `points:${point.id}`, url: result.url, bodyChars: result.body.length, truncated: result.truncated });
      tasks.push({
        id: `p${i + 1}`, title: `文章重點：${point.title}`, prompt: pointsPrompt({ title: point.title, body: result.body, summary: point.summary, symbols: point.symbols }), schema: POINTS_SCHEMA,
        meta: { type: "points", id: point.id },
      });
    }
  });
  return { tasks, unavailable, points };
}

export async function hasDailyWork(work: DailyWork, canReadArticle: (point: DailyWork["points"][number]) => Promise<boolean>): Promise<boolean> {
  if (work.market || work.digests.length) return true;
  return (await Promise.all(work.points.map(canReadArticle))).some(Boolean);
}

export function receiptKeys(task: Task): string[] {
  const meta = task.meta;
  if (meta.type === "translate") return meta.ids.map((id) => `translate:${id}`);
  if (meta.type === "points") return [`points:${meta.id}`];
  return [`digest:${meta.key}:${meta.date}`];
}

export function preparePush(tasks: Task[], answers: Record<string, unknown>, manifest: BatchManifest, model: string): ImportBody & { run: NonNullable<ImportBody["run"]> } {
  // Keep local evidence out of the POST even if extra fields were added to the file.
  const { runId, kind, pulledAt, gitCommit, gitDirty, promptSourceSha256, schemaSha256, tasksSha256, requestedModel, snapshot, points, unavailable, answersWrittenAt, pushedAt } = manifest;
  const summary = {
    runId, kind, pulledAt, gitCommit, gitDirty, promptSourceSha256, schemaSha256, tasksSha256, requestedModel,
    snapshot: snapshot && { date: snapshot.date, revision: snapshot.revision },
    points: points?.map(({ key, url, bodyChars, truncated }) => ({ key, url, bodyChars, truncated })),
    unavailable: unavailable.map(({ key, reason }) => ({ key, reason })), answersWrittenAt, pushedAt,
  };
  const body = {
    model,
    translate: [] as NonNullable<ImportBody["translate"]>,
    points: [] as NonNullable<ImportBody["points"]>,
    digests: [] as NonNullable<ImportBody["digests"]>,
    run: { id: manifest.runId, kind: manifest.kind, expected: tasks.flatMap(receiptKeys), missing: [] as string[], unavailable: manifest.unavailable, manifest: summary },
  };
  for (const task of tasks) {
    if (!Object.hasOwn(answers, task.id)) {
      body.run.missing.push(...receiptKeys(task));
      continue;
    }
    const raw = answers[task.id];
    const answer = typeof raw === "string" ? JSON.parse(raw) : raw;
    const meta = task.meta;
    if (meta.type === "translate") body.translate.push({ ids: meta.ids, answer });
    else if (meta.type === "points") body.points.push({ id: meta.id, answer });
    else body.digests.push({ key: meta.key, date: meta.date, newsIds: meta.newsIds, answer });
  }
  return body;
}

export type Receipt = Omit<ImportReceipt, "accepted" | "rejected"> & Partial<Pick<ImportReceipt, "accepted" | "rejected">>;

export function summarizeReceipt(receipt: Receipt, run: NonNullable<ImportBody["run"]>) {
  // Old Workers only report skipped; an explicitly empty rejected array takes precedence.
  const rejected = receipt.rejected?.map((item) => `${item.key}（${item.reason}）`) ?? receipt.skipped;
  const incomplete = run.missing.length > 0 || rejected.length > 0;
  const written = receipt.accepted?.length ?? receipt.translated + receipt.points + receipt.digests;
  const status = run.expected.length > 0 && written === 0 ? "failed" : incomplete ? "partial" : "ok";
  return {
    status,
    exitCode: incomplete ? 3 : 0,
    message: `寫入：翻譯 ${receipt.translated} 則、文章重點 ${receipt.points} 則、每日重點 ${receipt.digests} 則；缺答案：${run.missing.join(",") || "無"}；拒收：${rejected.join("；") || "無"}；正文取不到 ${run.unavailable.length} 則`,
  };
}

export function renderTasks(tasks: Task[], kind: BatchKind, answers: string): string {
  const head = `# 新聞 AI 待辦（${kind}，${tasks.length} 個任務）

逐一完成下面每個任務：照「規則」與「內容」寫出答案，答案必須符合該任務的 JSON 格式。
全部寫完後，把答案存成 \`${answers}\`，格式是以任務代號為鍵的物件，例如：
\`\`\`json
${JSON.stringify(Object.fromEntries(tasks.slice(0, 2).map((t) => [t.id, "<符合該任務格式的 JSON 物件>"])), null, 2)}
\`\`\`
只寫這個檔案；不要改其他檔案、不要 commit、不要部署。寫完執行 \`node scripts/ai-batch.ts push ${kind}\`。
`;
  const body = tasks.map(
    (t) => `\n---\n\n## ${t.id}：${t.title}\n\n### 規則\n\n${t.prompt.system}\n\n### 內容\n\n${t.prompt.user}\n\n### 答案格式（JSON Schema）\n\n\`\`\`json\n${JSON.stringify(t.schema)}\n\`\`\`\n`,
  );
  return head + body.join("");
}
