import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { DEFAULT_PROMPTS, makeBlind, prepareTask, restoreLabels, scoreAnswers, validateCase } from "../src/lib/news-ai-eval.ts";
import type { EvalReport, EvalSet, PromptFunctions } from "../src/lib/news-ai-eval.ts";

const sha256 = (data: string) => createHash("sha256").update(data).digest("hex");
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
function ensure(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function writeJson(path: string, value: unknown, exclusive = false) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { flag: exclusive ? "wx" : "w" });
}

function loadCases(set: EvalSet) {
  const root = resolve("evals/news-ai");
  const dir = resolve(root, set);
  const names = readdirSync(dir).filter((name) => name.endsWith(".json") && (set === "holdout" || !name.startsWith("answers-"))).sort();
  const hashes: Record<string, string> = {};
  const sources = names.map((name) => {
    const source = readFileSync(resolve(dir, name), "utf8");
    hashes[name] = sha256(source);
    return source;
  });
  if (set === "holdout") {
    const lock = readJson(resolve(root, "holdout.lock.json"));
    ensure(object(lock) && object(lock.files) && Object.keys(lock.files).length > 0, "holdout 未登記；由 L2-T11 經站長簽核後登記");
    ensure(JSON.stringify(Object.keys(lock.files).sort()) === JSON.stringify(names), "holdout 案例清單與登記不符");
    for (const name of names) ensure(lock.files[name] === hashes[name], `holdout hash 不符：${name}；必須重新登記並由站長簽核`);
  }
  const cases = sources.map((source) => validateCase(JSON.parse(source)));
  ensure(cases.length > 0 && new Set(cases.map((c) => c.id)).size === cases.length, "案例不得為空或重複");
  if (set === "holdout") {
    const dev = loadCases("dev").cases;
    for (const c of cases) for (const other of dev) {
      ensure(c.id !== other.id && (["company", "event", "article"] as const).every((key) => c.group[key] !== other.group[key]), `${c.id}：公司／事件／同篇轉載與 dev 跨組`);
    }
  }
  return { cases, hashes };
}

async function main() {
  const parsed = parseArgs({ options: Object.fromEntries(["set", "out", "prompts", "answers", "labels", "key", "baseline", "a", "b", "seed"].map((name) => [name, { type: "string" as const }])), allowPositionals: true, strict: true });
  const [command, ...rest] = parsed.positionals;
  const flags = parsed.values;
  const allowed: Record<string, string[]> = {
    prepare: ["set", "out", "prompts"], score: ["set", "answers", "labels", "key", "baseline", "out"], blind: ["set", "a", "b", "seed", "out"],
  };
  ensure(command in allowed && rest.length === 0, "用法：eval-news-ai.ts prepare|score|blind --set dev|holdout …");
  ensure(Object.keys(flags).every((key) => allowed[command].includes(key)), "此子命令不接受指定的選項");
  const set = flags.set;
  ensure(set === "dev" || set === "holdout", "--set 必須是 dev 或 holdout");
  const { cases, hashes } = loadCases(set);
  const required = (name: string) => { const value = flags[name]; ensure(typeof value === "string" && value.length > 0, `缺少 --${name}`); return value; };
  if (command === "prepare") {
    const out = resolve(required("out"));
    const sourcePath = flags.prompts ? resolve(flags.prompts) : fileURLToPath(new URL("../src/lib/news-ai.ts", import.meta.url));
    let prompts: PromptFunctions = DEFAULT_PROMPTS;
    if (flags.prompts) {
      // Explicitly supplied local source only. The runner never invokes a model.
      const module = await import(pathToFileURL(sourcePath).href);
      for (const name of Object.keys(DEFAULT_PROMPTS)) ensure(typeof module[name] === "function", `提示詞模組缺少 ${name}`);
      prompts = module as PromptFunctions;
    }
    const tasks = cases.map((c) => prepareTask(c, prompts));
    mkdirSync(out, { recursive: true });
    writeJson(resolve(out, "tasks.json"), tasks, true);
    const md = [
      "# 新聞 AI 離線任務", "每案只生成一次，不重抽。translate 使用 haiku，其餘使用 sonnet。每輪候選最多改兩版，全部版本與答案都保留。",
      "答案存成以任務 id 為鍵的 JSON 物件；值為模型原始 JSON 物件或原始文字。不要在答案中加入版本名稱。",
      ...tasks.map((t) => `## ${t.id}：${t.title}\n\n模型：${t.model}\n\n### System\n${t.prompt.system}\n\n### User\n${t.prompt.user}\n\n### Schema\n\`\`\`json\n${JSON.stringify(t.schema, null, 2)}\n\`\`\``),
    ].join("\n\n");
    writeFileSync(resolve(out, "tasks.md"), md + "\n", { flag: "wx" });
    writeJson(resolve(out, "manifest.json"), { set, preparedAt: new Date().toISOString(), caseHashes: hashes, promptSource: sourcePath, promptSourceSha256: sha256(readFileSync(sourcePath, "utf8")), tasksSha256: sha256(JSON.stringify(tasks)), models: { translate: "haiku", points: "sonnet", digest: "sonnet", market: "sonnet" } }, true);
    console.log(`已準備 ${tasks.length} 案：${out}`);
    return;
  }
  if (command === "blind") {
    const a = required("a"), b = required("b"), seed = required("seed");
    ensure(/^\d+$/.test(seed), "seed 必須為 uint32 整數");
    const blind = makeBlind(cases, { name: basename(a), answers: readJson(a) }, { name: basename(b), answers: readJson(b) }, Number(seed));
    const out = resolve(required("out"));
    writeJson(resolve(out, "blind.json"), blind.sheet, true);
    writeJson(resolve(out, "labels.json"), blind.labels, true);
    writeJson(resolve(out, "key.json"), blind.key, true);
    console.log(`已產生盲評表：${out}/blind.json；對照鍵 key.json 請由協調者另外保管`);
    return;
  }
  ensure(!flags.key || flags.labels, "--key 必須與 --labels 一起使用");
  const answersPath = required("answers");
  const answers = readJson(answersPath);
  let labels = flags.labels ? readJson(flags.labels) : undefined;
  if (flags.key) labels = restoreLabels(answers, labels, readJson(flags.key));
  let baseline: EvalReport | undefined;
  if (flags.baseline) {
    const raw = readJson(flags.baseline);
    ensure(object(raw) && object(raw.caseHashes) && JSON.stringify(Object.entries(raw.caseHashes).sort()) === JSON.stringify(Object.entries(hashes).sort()), "baseline 案例 hash 不同，不能直接比較");
    baseline = raw as unknown as EvalReport;
  }
  const report = {
    ...scoreAnswers(cases, answers, { set, labels, baseline }),
    policy: "草案工具試算；正式閘門自 L2-T11 凍結與首次 holdout 登記合併起生效",
    caseHashes: hashes, scoredAt: new Date().toISOString(), answersSha256: sha256(readFileSync(answersPath, "utf8")),
    baseline: flags.baseline ?? null,
  };
  if (flags.out) writeJson(resolve(flags.out), report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.gate.passed) process.exitCode = 1;
}

try { await main(); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; }
