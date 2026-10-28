import {
  DIGEST_SCHEMA, ENRICH_SCHEMA, NEWS_CATEGORIES, POINTS_SCHEMA,
  digestPrompt, enrichPrompt, extractJson, marketPrompt, parseDigest, parseEnrich, parsePoints, pointsPrompt,
} from "./news-ai.ts";
import type { DigestInput, EnrichInput, MarketInput, NewsTone, PointsInput, Prompt } from "./news-ai.ts";

export type EvalSet = "dev" | "holdout";
export const BLOCKER_KINDS = ["format", "number", "company", "timing", "advice", "inference"] as const;
export type BlockerKind = typeof BLOCKER_KINDS[number];
export interface Finding { kind: BlockerKind; detail: string }
export interface RequiredFact { id: string; description: string; pattern?: string }
interface Gold {
  focus?: string[];
  category?: string;
  tone?: NewsTone;
  requiredFacts: RequiredFact[];
  forbidden: { kind: BlockerKind; pattern: string; reason: string }[];
}
interface CaseBase {
  id: string;
  group: { company: string; event: string; article: string };
  tags: string[];
  gold: Gold;
}
export type NewsEvalCase = CaseBase & (
  { task: "translate"; input: EnrichInput } |
  { task: "points"; input: PointsInput } |
  { task: "digest"; input: DigestInput } |
  { task: "market"; input: MarketInput }
);
export type AnswerMap = Record<string, unknown>;

const record = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
const nullableText = (x: unknown) => x === null || typeof x === "string";
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every(text);
const finiteOrNull = (x: unknown) => x === null || (typeof x === "number" && Number.isFinite(x));
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const tone = (x: unknown) => ["positive", "negative", "neutral"].includes(x as string);
const timing = (x: unknown) => ["before-close", "after-close", "unknown"].includes(x as string);
function news(x: unknown): boolean {
  return record(x) && typeof x.titleZh === "string" && text(x.title) && nullableText(x.summary)
    && text(x.tone) && text(x.category) && (x.timing === undefined || timing(x.timing));
}
function validInput(task: unknown, x: unknown): boolean {
  if (!record(x)) return false;
  if (task === "translate") return text(x.id) && text(x.title) && nullableText(x.summary) && strings(x.symbols) && nullableText(x.primarySymbol);
  if (task === "points") return text(x.title) && nullableText(x.body) && nullableText(x.summary) && strings(x.symbols);
  if (task === "digest") return text(x.key) && text(x.company) && text(x.date)
    && finiteOrNull(x.returnPct) && finiteOrNull(x.contributionPts) && Array.isArray(x.news) && x.news.every(news)
    && (x.unconfirmed === undefined || (Array.isArray(x.unconfirmed) && x.unconfirmed.every((n) => news(n) && record(n) && ["after-close", "unknown"].includes(n.timing as string))));
  if (task === "market") return text(x.date) && typeof x.close === "number" && Number.isFinite(x.close)
    && [x.changePts, x.returnPct, x.vix, x.vixChange, x.spreadPct, x.restPts].every(finiteOrNull)
    && Array.isArray(x.movers) && x.movers.every((m) => record(m) && text(m.key) && text(m.company) && finiteOrNull(m.returnPct) && finiteOrNull(m.contributionPts))
    && strings(x.news) && (x.unconfirmed === undefined || (Array.isArray(x.unconfirmed) && x.unconfirmed.every((n) => record(n) && text(n.id) && text(n.title) && ["after-close", "unknown"].includes(n.timing as string))));
  return false;
}

/** Validate untrusted JSON before constructing prompts or compiling case-specific patterns. */
export function validateCase(value: unknown): NewsEvalCase {
  requireValue(record(value), "案例必須是物件");
  requireValue(text(value.id) && /^[a-zA-Z0-9_-]+$/.test(value.id), "案例 id 格式錯誤");
  requireValue(record(value.group) && [value.group.company, value.group.event, value.group.article].every(text), `${value.id}：缺少分組`);
  requireValue(strings(value.tags), `${value.id}：tags 必須是字串陣列`);
  requireValue(validInput(value.task, value.input), `${value.id}：任務或 input 格式錯誤`);
  const g = value.gold;
  requireValue(record(g) && Array.isArray(g.requiredFacts) && g.requiredFacts.length > 0 && Array.isArray(g.forbidden), `${value.id}：gold 格式錯誤`);
  requireValue(g.requiredFacts.every((f) => record(f) && text(f.id) && text(f.description) && (f.pattern === undefined || text(f.pattern))), `${value.id}：必要事實格式錯誤`);
  requireValue(new Set(g.requiredFacts.map((f) => f.id)).size === g.requiredFacts.length, `${value.id}：事實 id 重複`);
  requireValue(g.forbidden.every((f) => record(f) && BLOCKER_KINDS.includes(f.kind as BlockerKind) && text(f.pattern) && text(f.reason)), `${value.id}：禁止推論格式錯誤`);
  requireValue(g.tone === undefined || tone(g.tone), `${value.id}：gold tone 格式錯誤`);
  requireValue(g.category === undefined || NEWS_CATEGORIES.includes(g.category as typeof NEWS_CATEGORIES[number]), `${value.id}：gold category 格式錯誤`);
  requireValue(value.task !== "translate" || strings(g.focus), `${value.id}：翻譯缺少 gold.focus`);
  for (const item of [...g.requiredFacts, ...g.forbidden]) {
    if (item.pattern !== undefined) new RegExp(item.pattern, "u");
  }
  return value as unknown as NewsEvalCase;
}

/** These are the four functions an older local news-ai.ts must export for --prompts. */
export const DEFAULT_PROMPTS = { enrichPrompt, pointsPrompt, digestPrompt, marketPrompt };
export type PromptFunctions = typeof DEFAULT_PROMPTS;
export function prepareTask(c: NewsEvalCase, prompts: PromptFunctions = DEFAULT_PROMPTS) {
  let prompt: Prompt;
  let meta: { type: "translate"; ids: string[] } | { type: "points"; id: string } | { type: "digest"; key: string; date: string; newsIds: string[] };
  switch (c.task) {
    case "translate": prompt = prompts.enrichPrompt([c.input]); meta = { type: "translate", ids: [c.input.id] }; break;
    case "points": prompt = prompts.pointsPrompt(c.input); meta = { type: "points", id: c.id }; break;
    case "digest": prompt = prompts.digestPrompt(c.input); meta = { type: "digest", key: c.input.key, date: c.input.date, newsIds: [] }; break;
    case "market": prompt = prompts.marketPrompt(c.input); meta = { type: "digest", key: "SPX", date: c.input.date, newsIds: [] }; break;
  }
  return { id: c.id, title: `${c.task}：${c.id}`, prompt, schema: c.task === "translate" ? ENRICH_SCHEMA : c.task === "points" ? POINTS_SCHEMA : DIGEST_SCHEMA,
    meta, model: c.task === "translate" ? "haiku" : "sonnet" };
}

// The production parsers intentionally discard/shorten invalid fields. Check the entire
// schema first so the evaluator cannot silently lose the offending part of an answer.
function matchesSchema(value: unknown, schema: unknown): boolean {
  if (!record(schema)) return false;
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
  if (schema.type === "string") return typeof value === "string";
  if (schema.type === "integer") return Number.isInteger(value);
  if (schema.type === "array") return Array.isArray(value) && value.every((v) => matchesSchema(v, schema.items));
  if (schema.type === "object") {
    if (!record(value) || !record(schema.properties)) return false;
    const props = schema.properties;
    return (schema.required as string[]).every((k) => k in value)
      && Object.entries(value).every(([k, v]) => k in props && matchesSchema(v, props[k]));
  }
  return false;
}

interface NumericToken { raw: string; coefficient: bigint; digits: number; scale: number; dimension: "percent" | "money" | "number"; marked: boolean }
function numbers(source: string): NumericToken[] {
  const out: NumericToken[] = [];
  const pattern = /[+-]?\s*[$＄]?\s*[+-]?\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:%|％|兆|億|萬|trillion\b|billion\b|million\b|[BM]\b))?(?:\s*美元)?/giu;
  for (const m of source.matchAll(pattern)) {
    const raw = m[0].trim();
    const numeric = /\d+(?:,\d{3})*(?:\.\d+)?/.exec(raw)![0];
    const unit = raw.slice(raw.indexOf(numeric) + numeric.length).trim().replace(/美元$/, "").trim().toUpperCase();
    const scale = ({ "兆": 12, TRILLION: 12, "億": 8, "萬": 4, B: 9, BILLION: 9, M: 6, MILLION: 6 } as Record<string, number>)[unit] ?? 0;
    out.push({ raw, coefficient: BigInt(numeric.replace(/[,.]/g, "")) * (raw.includes("-") ? -1n : 1n), digits: numeric.split(".")[1]?.length ?? 0,
      scale, dimension: /[%％]/.test(raw) ? "percent" : /[$＄]|美元/.test(raw) ? "money" : "number",
      marked: /[$＄.%％兆億萬]|\d\s*(?:[BM]|trillion|billion|million)\b/i.test(raw) });
  }
  return out;
}
function supportedNumber(answer: NumericToken, sources: NumericToken[]) {
  return sources.some((source) => {
    if (source.dimension !== answer.dimension) return false;
    // Work in decimal integers: Number.toFixed would incorrectly round 1.005 to 1.00.
    const power = source.scale - source.digits + answer.digits - answer.scale;
    const magnitude = source.coefficient < 0n ? -source.coefficient : source.coefficient;
    const divisor = 10n ** BigInt(Math.abs(power));
    const rounded = power >= 0 ? magnitude * divisor : magnitude / divisor + (magnitude % divisor * 2n >= divisor ? 1n : 0n);
    if (!/[+-]/.test(answer.raw)) return rounded === answer.coefficient;
    return rounded * (source.coefficient < 0n ? -1n : 1n) === answer.coefficient;
  });
}
function evidence(c: NewsEvalCase): string {
  // Only content actually made visible to the model is evidence, never gold or instructions.
  const n = (item: DigestInput["news"][number]) => [item.titleZh, item.title, item.summary?.slice(0, 300)].filter(Boolean).join("\n");
  if (c.task === "translate") return [c.input.title, c.input.summary?.slice(0, 300)].filter(Boolean).join("\n");
  if (c.task === "points") return [c.input.title, c.input.body || c.input.summary].filter(Boolean).join("\n");
  if (c.task === "digest") return [
    c.input.returnPct === null ? "" : `${c.input.returnPct}%`, c.input.contributionPts,
    ...c.input.news.map(n), ...(c.input.unconfirmed ?? []).map(n),
  ].join("\n");
  const m = c.input;
  // Reuse the displayed mover rows, including the folded total. Unlisted individual
  // values are not visible to the model and cannot support a claim in its answer.
  const moverRows = marketPrompt(m).user.split("\n").filter((line) => line.startsWith("- "));
  return [m.close, m.changePts, m.vix, m.vixChange, m.restPts, m.returnPct === null ? "" : `${m.returnPct}%`, m.spreadPct,
    ...moverRows, ...m.news, ...(m.unconfirmed ?? []).map((v) => v.title)].join("\n");
}

export interface CheckedAnswer {
  id: string; sentences: string[]; blockers: Finding[]; flags: string[];
  referenceCoverage: { matched: number; total: number; missing: string[] };
}
export function checkAnswer(c: NewsEvalCase, answer: unknown): CheckedAnswer {
  const result: CheckedAnswer = { id: c.id, sentences: [], blockers: [], flags: [], referenceCoverage: { matched: 0, total: 0, missing: [] } };
  let data: Record<string, unknown>;
  let content: string[];
  try {
    const parsed = typeof answer === "string" ? extractJson(answer) : answer;
    requireValue(record(parsed) && matchesSchema(parsed, prepareTask(c).schema), "答案不符合輸出 schema");
    data = parsed;
    if (c.task === "translate") {
      const items = data.items as { n: number; title_zh: string; focus: string[]; category: string; tone: NewsTone }[];
      requireValue(items.length === 1 && items[0].n === 1 && parseEnrich(data, [c.input]).length === 1, "翻譯解析失敗或序號不符");
      const item = items[0];
      if ([...new Set(item.focus)].sort().join("\0") !== [...new Set(c.gold.focus)].sort().join("\0")) result.blockers.push({ kind: "company", detail: "focus 集合與金標不同" });
      if (c.gold.category !== undefined && item.category !== c.gold.category) result.flags.push("category 與金標不同，待人工看");
      if (c.gold.tone !== undefined && item.tone !== c.gold.tone) result.flags.push("tone 與金標不同，待人工看");
      content = [item.title_zh];
    } else if (c.task === "points") {
      requireValue(parsePoints(data) !== null && (data.points as string[]).every(text), "重點解析失敗");
      content = data.points as string[];
    } else {
      requireValue(parseDigest(data) !== null, "摘要解析失敗");
      content = [data.summary as string];
    }
    if (c.task !== "translate" && c.gold.tone !== undefined && data.tone !== c.gold.tone) result.flags.push("tone 與金標不同，待人工看");
  } catch (error) {
    result.blockers.push({ kind: "format", detail: error instanceof Error ? error.message : String(error) });
    return result;
  }
  result.sentences = content.flatMap((line) => line.split(/(?<=[。！？!?])|\n+/u).map((s) => s.trim()).filter(Boolean));
  const body = content.join("\n");
  const sourceNumbers = numbers(evidence(c));
  for (const token of numbers(body).filter((n) => n.marked)) {
    if (!supportedNumber(token, sourceNumbers)) result.blockers.push({ kind: "number", detail: `數字無出處：${token.raw}` });
  }
  for (const rule of c.gold.forbidden) {
    if (new RegExp(rule.pattern, "u").test(body)) result.blockers.push({ kind: rule.kind, detail: rule.reason });
  }
  if (/買進|賣出|加碼|減碼|停利|停損/u.test(body)) result.flags.push("買賣字眼，待人工看（可能是引用或否定句）");
  for (const fact of c.gold.requiredFacts) {
    if (fact.pattern === undefined) continue;
    result.referenceCoverage.total++;
    if (new RegExp(fact.pattern, "u").test(body)) result.referenceCoverage.matched++;
    else result.referenceCoverage.missing.push(fact.id);
  }
  return result;
}

export interface CaseLabel {
  sentences: { text: string; supported: boolean; evidence?: string }[];
  coveredFacts: string[];
  blockers: Finding[];
}
export interface ReviewLabels {
  reviewers: { name: string; role: "owner" | "second" }[];
  singleReviewer: boolean;
  cases: Record<string, CaseLabel>;
}
interface Fraction { numerator: number; denominator: number; rate: number }
export interface EvalReport {
  set: EvalSet;
  cases: CheckedAnswer[];
  blockers: (Finding & { id: string })[];
  support: Fraction | null;
  coverage: Fraction | null;
  review: Omit<ReviewLabels, "cases"> | null;
  gate: { passed: boolean; reasons: string[] };
}
function fraction(numerator: number, denominator: number): Fraction | null {
  return denominator ? { numerator, denominator, rate: numerator / denominator } : null;
}
function validateLabel(value: unknown, c: NewsEvalCase, checked: CheckedAnswer): asserts value is CaseLabel {
  requireValue(record(value) && Array.isArray(value.sentences) && strings(value.coveredFacts) && Array.isArray(value.blockers), `${c.id}：人工標註格式錯誤`);
  requireValue(value.sentences.length === checked.sentences.length && value.sentences.every((s, i) => record(s) && s.text === checked.sentences[i] && typeof s.supported === "boolean" && (!s.supported || text(s.evidence))), `${c.id}：必須逐句標註原答案並填來源 evidence`);
  requireValue(new Set(value.coveredFacts).size === value.coveredFacts.length && value.coveredFacts.every((id) => c.gold.requiredFacts.some((f) => f.id === id)), `${c.id}：涵蓋事實 id 不符`);
  requireValue(value.blockers.every((b) => record(b) && BLOCKER_KINDS.includes(b.kind as BlockerKind) && text(b.detail)), `${c.id}：人工阻擋項格式錯誤`);
}
function validateAnswers(cases: NewsEvalCase[], answers: unknown): asserts answers is AnswerMap {
  requireValue(record(answers), "答案必須是以案例 id 為鍵的物件");
  requireValue(Object.keys(answers).every((id) => cases.some((c) => c.id === id)), "答案含不屬於本組的案例 id");
}

/** Automatic coverage is diagnostic only. Missing human labels can never pass the gate. */
export function scoreAnswers(cases: NewsEvalCase[], answers: unknown, options: { set: EvalSet; labels?: unknown; baseline?: EvalReport }): EvalReport {
  requireValue(cases.length > 0 && new Set(cases.map((c) => c.id)).size === cases.length, "案例不得為空或重複");
  validateAnswers(cases, answers);
  let labels: ReviewLabels | undefined;
  if (options.labels !== undefined) {
    const l = options.labels;
    requireValue(record(l) && Array.isArray(l.reviewers) && l.reviewers.length >= 1 && l.reviewers.length <= 2 && l.reviewers.every((r, i) => record(r) && text(r.name) && r.role === (i === 0 ? "owner" : "second")), "評審必須由站長擔任，第二位可選");
    requireValue(l.singleReviewer === (l.reviewers.length === 1) && record(l.cases), "必須明寫是否單人評估");
    requireValue(Object.keys(l.cases).every((id) => cases.some((c) => c.id === id)), "人工標註含未知案例");
    labels = l as unknown as ReviewLabels;
  }
  const checked = cases.map((c) => checkAnswer(c, answers[c.id]));
  let supported = 0;
  let sentences = 0;
  let covered = 0;
  let facts = 0;
  let complete = true;
  checked.forEach((result, i) => {
    const c = cases[i];
    const label = labels?.cases[c.id];
    if (label === undefined || result.sentences.length === 0) { complete = false; return; }
    validateLabel(label, c, result);
    result.blockers.push(...label.blockers);
    supported += label.sentences.filter((s) => s.supported).length;
    sentences += label.sentences.length;
    covered += label.coveredFacts.length;
    facts += c.gold.requiredFacts.length;
  });
  const report: EvalReport = {
    set: options.set, cases: checked,
    blockers: checked.flatMap((c) => c.blockers.map((b) => ({ id: c.id, ...b }))),
    support: complete ? fraction(supported, sentences) : null,
    coverage: complete ? fraction(covered, facts) : null,
    review: labels ? { reviewers: labels.reviewers, singleReviewer: labels.singleReviewer } : null,
    gate: { passed: false, reasons: [] },
  };
  const reasons = report.gate.reasons;
  if (report.blockers.length) reasons.push(`阻擋項 ${report.blockers.length} 件，必須為 0`);
  if (!complete || !report.support || !report.coverage) reasons.push("缺少完整人工逐句／必要事實標註，不能以參考涵蓋率代替");
  if (report.support && report.support.rate < 0.95) reasons.push("逐句支持率低於 95%");
  if (report.coverage && report.coverage.rate < 0.9) reasons.push("必要事實涵蓋率低於 90%");
  const baseline = options.baseline;
  if (baseline) {
    requireValue(baseline.set === report.set && baseline.gate?.passed === true && baseline.support !== null && baseline.coverage !== null
      && baseline.cases.map((c) => c.id).sort().join("\0") === cases.map((c) => c.id).sort().join("\0"), "baseline 必須是同組案例且經完整人工評估通過的報告");
    for (const metric of ["support", "coverage"] as const) {
      const b = baseline[metric];
      requireValue(b && Number.isFinite(b.rate) && b.rate >= 0 && b.rate <= 1 && b.denominator > 0 && b.rate === b.numerator / b.denominator, "baseline 計分格式錯誤");
      if (report[metric] && report[metric].rate < b.rate) reasons.push(`${metric} 低於 baseline`);
    }
  }
  report.gate.passed = reasons.length === 0;
  return report;
}

interface BlindEntry { version: "a" | "b"; answer: unknown }
export interface BlindKey { seed: number; versions: { a: string; b: string }; cases: Record<string, { A: BlindEntry; B: BlindEntry }> }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** The key is private. Public sheets/label templates contain only A/B and the seed. */
export function makeBlind(cases: NewsEvalCase[], a: { name: string; answers: unknown }, b: { name: string; answers: unknown }, seed: number) {
  requireValue(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff, "seed 必須為 uint32 整數");
  validateAnswers(cases, a.answers);
  validateAnswers(cases, b.answers);
  const aa = a.answers;
  const bb = b.answers;
  const key: BlindKey = { seed, versions: { a: a.name, b: b.name }, cases: {} };
  const labels = { reviewers: [{ name: "", role: "owner" }], singleReviewer: true, cases: {} as Record<string, unknown> };
  let state = seed;
  const rows = [...cases].sort((x, y) => x.id.localeCompare(y.id)).map((c) => {
    requireValue(c.id in aa && c.id in bb, `${c.id}：盲評需要兩份答案`);
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const left: BlindEntry = state >>> 31 ? { version: "a", answer: aa[c.id] } : { version: "b", answer: bb[c.id] };
    const right: BlindEntry = left.version === "a" ? { version: "b", answer: bb[c.id] } : { version: "a", answer: aa[c.id] };
    key.cases[c.id] = { A: left, B: right };
    const template = (answer: unknown) => ({ sentences: checkAnswer(c, answer).sentences.map((text) => ({ text, supported: null, evidence: "" })), coveredFacts: [], blockers: [] });
    labels.cases[c.id] = { A: template(left.answer), B: template(right.answer) };
    return { id: c.id, task: c.task, input: c.input, requiredFacts: c.gold.requiredFacts.map(({ id, description }) => ({ id, description })), A: left.answer, B: right.answer };
  });
  return { sheet: { seed, cases: rows }, key, labels };
}

export function restoreLabels(answers: unknown, labels: unknown, key: unknown): ReviewLabels {
  requireValue(record(answers) && record(labels) && record(labels.cases) && record(key) && record(key.cases), "盲評標註或對照鍵格式錯誤");
  const restored: Record<string, CaseLabel> = {};
  for (const [id, answer] of Object.entries(answers)) {
    const mapping = key.cases[id];
    const annotation = labels.cases[id];
    requireValue(record(mapping) && record(annotation), `${id}：缺少盲評對照鍵或標註`);
    const sides = ["A", "B"].filter((side) => record(mapping[side]) && canonical(mapping[side].answer) === canonical(answer));
    requireValue(sides.length > 0, `${id}：答案與對照鍵不符`);
    if (sides.length === 2) requireValue(canonical(annotation.A) === canonical(annotation.B), `${id}：兩版答案相同但標註不同，請站長釐清`);
    restored[id] = annotation[sides[0]] as CaseLabel;
  }
  return { reviewers: labels.reviewers as ReviewLabels["reviewers"], singleReviewer: labels.singleReviewer as boolean, cases: restored };
}
