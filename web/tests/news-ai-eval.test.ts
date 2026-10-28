import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { checkAnswer, makeBlind, prepareTask, restoreLabels, scoreAnswers, validateCase } from "../src/lib/news-ai-eval.ts";
import type { Finding } from "../src/lib/news-ai-eval.ts";
import { digestPrompt, enrichPrompt, marketPrompt, pointsPrompt } from "../src/lib/news-ai.ts";

const numericCase = () => validateCase({
  id: "number-rounding", task: "points",
  group: { company: "SYNTH", event: "earnings", article: "original" },
  tags: ["單位"],
  input: { title: "Synthetic earnings", body: "Revenue was $1,234.56M; margin was -2.345%.", summary: null, symbols: ["SYNTH"] },
  gold: { requiredFacts: [{ id: "revenue", description: "營收", pattern: "營收" }], forbidden: [] },
});

const dev = new URL("../evals/news-ai/dev/", import.meta.url);
const json = (url: URL) => JSON.parse(readFileSync(url, "utf8"));
const devCases = () => readdirSync(dev).filter((name) => name.endsWith(".json") && !name.startsWith("answers-")).map((name) => validateCase(json(new URL(name, dev))));
const web = fileURLToPath(new URL("../", import.meta.url));
const cli = join(web, "scripts/eval-news-ai.ts");
const run = (args: string[], cwd = web) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });

test("CLI：未登記、hash 錯誤或漏登案例皆以 2 拒絕；有效登記才進入評分", () => {
  const dir = mkdtempSync(join(tmpdir(), "mo-eval-lock-"));
  try {
    const base = join(dir, "evals/news-ai");
    mkdirSync(join(base, "holdout"), { recursive: true });
    mkdirSync(join(base, "dev"));
    const lock = join(base, "holdout.lock.json");
    const answer = fileURLToPath(new URL("answers-good.json", dev));
    writeFileSync(lock, '{"files":{}}');
    let result = run(["score", "--set", "holdout", "--answers", answer], dir);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /未登記/);
    for (const command of ["prepare", "blind"]) {
      const refused = run([command, "--set", "holdout"], dir);
      assert.equal(refused.status, 2);
      assert.match(refused.stderr, /未登記/);
    }
    const data = JSON.stringify(numericCase());
    writeFileSync(join(base, "dev/dev.json"), JSON.stringify({ ...numericCase(), id: "dev-only", group: { company: "DEV", event: "DEV", article: "DEV" } }));
    writeFileSync(join(base, "holdout/case.json"), data);
    writeFileSync(lock, JSON.stringify({ files: { "case.json": "0".repeat(64) } }));
    result = run(["score", "--set", "holdout", "--answers", answer], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /hash/);
    const hash = createHash("sha256").update(data).digest("hex");
    writeFileSync(lock, JSON.stringify({ files: { "case.json": hash } }));
    const localAnswers = join(dir, "answers.json");
    writeFileSync(localAnswers, JSON.stringify({ "number-rounding": { points: ["營收 $1234.6M。"], tone: "neutral" } }));
    result = run(["score", "--set", "holdout", "--answers", localAnswers], dir);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).blockers.length, 0);
    writeFileSync(join(base, "dev/dev.json"), JSON.stringify({ ...numericCase(), id: "dev-only" }));
    result = run(["score", "--set", "holdout", "--answers", localAnswers], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /跨組/);
    writeFileSync(join(base, "holdout/extra.json"), data);
    result = run(["score", "--set", "holdout", "--answers", localAnswers], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /登記/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CLI：prepare 不洩漏 gold，score 壞答案列出阻擋且 exit 1，blind 公開檔隱藏版本", () => {
  const dir = mkdtempSync(join(tmpdir(), "mo-eval-cli-"));
  try {
    const prepared = join(dir, "prepared");
    let result = run(["prepare", "--set", "dev", "--out", prepared]);
    assert.equal(result.status, 0, result.stderr);
    const tasks = JSON.parse(readFileSync(join(prepared, "tasks.json"), "utf8"));
    assert.equal(tasks.length, 8);
    assert.ok(tasks.every((t: { model: string; meta: { type: string } }) => t.model === (t.meta.type === "translate" ? "haiku" : "sonnet")));
    assert.doesNotMatch(readFileSync(join(prepared, "tasks.json"), "utf8"), /requiredFacts|forbidden|gold/);
    const report = join(dir, "report.json");
    result = run(["score", "--set", "dev", "--answers", "evals/news-ai/dev/answers-bad.json", "--out", report]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(readFileSync(report, "utf8")).cases.filter((c: { blockers: unknown[] }) => c.blockers.length).length, 8);
    const blinded = join(dir, "blind");
    result = run(["blind", "--set", "dev", "--a", "evals/news-ai/dev/answers-good.json", "--b", "evals/news-ai/dev/answers-bad.json", "--seed", "1028", "--out", blinded]);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(readFileSync(join(blinded, "blind.json"), "utf8") + readFileSync(join(blinded, "labels.json"), "utf8"), /answers-good|answers-bad/);
    assert.match(readFileSync(join(blinded, "key.json"), "utf8"), /answers-good/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("八案格式有效、每類至少兩案；正例無阻擋，反例各自命中設計的阻擋種類", () => {
  const cases = devCases();
  for (const task of ["translate", "points", "digest", "market"]) assert.ok(cases.filter((c) => c.task === task).length >= 2);
  const good = json(new URL("answers-good.json", dev));
  const bad = json(new URL("answers-bad.json", dev));
  const expected = {
    "translate-other-target": "company", "translate-earnings": "number", "points-conflict-truncated": "inference",
    "points-injection-units": "advice", "digest-after-close": "timing", "digest-date-only": "timing",
    "market-conflicting-sources": "inference", "market-format": "format",
  };
  for (const c of cases) {
    assert.deepEqual(checkAnswer(c, good[c.id]).blockers, [], c.id);
    assert.ok(checkAnswer(c, bad[c.id]).blockers.some((b) => b.kind === expected[c.id as keyof typeof expected]), c.id);
  }
});

test("盲評隱藏版本名稱、固定 seed 可重現，對照鍵能還原每案 A／B 並合併人工標註", () => {
  const cases = devCases();
  const a = { name: "current-version-secret", answers: json(new URL("answers-good.json", dev)) };
  const b = { name: "candidate-version-secret", answers: json(new URL("answers-bad.json", dev)) };
  const result = makeBlind(cases, a, b, 1028);
  assert.deepEqual(makeBlind(cases, a, b, 1028), result);
  assert.notDeepEqual(makeBlind(cases, a, b, 1029).key, result.key);
  assert.doesNotMatch(JSON.stringify([result.sheet, result.labels]), /current-version-secret|candidate-version-secret/);
  const labels = { reviewers: [{ name: "站長", role: "owner" }], singleReviewer: true, cases: {} as Record<string, unknown> };
  for (const row of result.sheet.cases) {
    const mapping = result.key.cases[row.id];
    assert.deepEqual(row.A, (mapping.A.version === "a" ? a : b).answers[row.id]);
    assert.deepEqual(row.B, (mapping.B.version === "a" ? a : b).answers[row.id]);
    const goodSide = mapping.A.version === "a" ? "A" : "B";
    const c = cases.find((c) => c.id === row.id)!;
    const label = { sentences: checkAnswer(c, a.answers[c.id]).sentences.map((text) => ({ text, supported: true, evidence: "合成來源" })), coveredFacts: c.gold.requiredFacts.map((f) => f.id), blockers: [] };
    labels.cases[row.id] = { [goodSide]: label };
  }
  const restored = restoreLabels(a.answers, labels, result.key);
  assert.equal(scoreAnswers(cases, a.answers, { set: "dev", labels: restored }).gate.passed, true);
  assert.throws(() => restoreLabels({ ...a.answers, [cases[0].id]: "換掉的答案" }, labels, result.key), /對照鍵/);
});

test("只有人工逐句標註與事實涵蓋才能過門檻，人工重大錯誤合併阻擋，baseline 不容退步", () => {
  const c = numericCase();
  const answers = { [c.id]: { points: ["營收 $1234.6M。"], tone: "neutral" } };
  assert.equal(scoreAnswers([c], answers, { set: "dev" }).gate.passed, false);
  const labels = {
    reviewers: [{ name: "站長", role: "owner" as const }], singleReviewer: true,
    cases: { [c.id]: { sentences: [{ text: "營收 $1234.6M。", supported: true, evidence: "Revenue was $1,234.56M" }], coveredFacts: ["revenue"], blockers: [] as Finding[] } },
  };
  const baseline = scoreAnswers([c], answers, { set: "dev", labels });
  assert.equal(baseline.gate.passed, true);
  assert.deepEqual(baseline.support, { numerator: 1, denominator: 1, rate: 1 });
  const blocked = structuredClone(labels);
  blocked.cases[c.id].blockers = [{ kind: "advice", detail: "人工判定投資建議" }];
  assert.equal(scoreAnswers([c], answers, { set: "dev", labels: blocked }).gate.passed, false);
  const many = { ...c, id: "many" };
  const lines = Array.from({ length: 20 }, (_, i) => `營收說明第 ${i + 1} 項。`);
  const longAnswers = { many: { points: lines.slice(0, 5).map((_, i) => lines.slice(i * 4, i * 4 + 4).join("")), tone: "neutral" } };
  const fullLabels = { ...labels, cases: { many: { sentences: lines.map((text) => ({ text, supported: true, evidence: "合成來源" })), coveredFacts: ["revenue"], blockers: [] } } };
  const full = scoreAnswers([many], longAnswers, { set: "dev", labels: fullLabels });
  fullLabels.cases.many.sentences[0].supported = false;
  const regressed = scoreAnswers([many], longAnswers, { set: "dev", labels: fullLabels, baseline: full });
  assert.equal(regressed.support?.rate, 0.95);
  assert.equal(regressed.gate.passed, false);
  assert.ok(regressed.gate.reasons.some((r) => r.includes("baseline")));
});

test("數字出處允許千分位與較少位四捨五入，但擋新增數字及換錯單位", () => {
  const c = numericCase();
  const check = (text: string) => checkAnswer(c, { points: [text], tone: "neutral" }).blockers;
  assert.deepEqual(check("營收 $1234.6M，利潤率 -2.35%。"), []);
  assert.ok(check("營收 $999.0M。").some((b) => b.kind === "number"));
  assert.deepEqual(check("利潤率下降 2.35%。"), []);
  assert.ok(check("利潤率 +2.35%。").some((b) => b.kind === "number"));
  assert.ok(check("營收 $1234.6B。").some((b) => b.kind === "number"));
});

test("下跌摘要未明寫正負號時按絕對值核對百分比、點數與百分點", () => {
  const summaries = {
    "digest-date-only": "Moss Relay 股價跌 0.8%，對指數為負貢獻 0.2 點，檢討供應契約，發布時間不明。",
    "market-format": "指數下跌 0.19%，跌 12.34 點，落後 0.2 個百分點，Aura Works 股價跌 1.2%，為負貢獻 8.0 點；其餘成分為負貢獻 4.34 點。沒有可清楚辨識的單一催化因素。",
  };
  const results = devCases().filter((c) => c.id in summaries).map((c) => ({
    id: c.id,
    blockers: checkAnswer(c, { summary: summaries[c.id as keyof typeof summaries], tone: "neutral" }).blockers,
  }));
  assert.deepEqual(results, [
    { id: "digest-date-only", blockers: [] },
    { id: "market-format", blockers: [] },
  ]);
});

test("十進位半值必須正確四捨五入；B／M／億萬可等值換算", () => {
  const c = numericCase();
  assert.ok(c.task === "points");
  c.input.body = "EPS was $1.005; revenue was $1.25B; margin was -1.005%.";
  assert.deepEqual(checkAnswer(c, { points: ["每股盈餘 $1.01，營收 12.5億美元，利潤率 -1.01%。"], tone: "neutral" }).blockers, []);
});

test("兆瓦／兆赫／兆位元不應被當成兆級數值而誤擋", () => {
  const c = numericCase();
  assert.ok(c.task === "points");
  const cases = [
    { source: "Capacity is 500 MW.", answer: "容量為 500 兆瓦。" },
    { source: "Capacity is 1,200 megawatts.", answer: "容量為 1,200 兆瓦。" },
    { source: "Frequency is 800 MHz.", answer: "頻率為 800 兆赫。" },
    { source: "Capacity is 900 megabits.", answer: "容量為 900 兆位元。" },
    { source: "Capacity is 500 MW.", answer: "容量為 500 MW。" },
  ];
  assert.deepEqual(cases.map(({ source, answer }) => {
    c.input.body = source;
    return { source, blockers: checkAnswer(c, { points: [answer], tone: "neutral" }).blockers };
  }), cases.map(({ source }) => ({ source, blockers: [] })));
});

test("兆／trillion 市值可與億等值換算，仍須保留貨幣維度", () => {
  const c = numericCase();
  assert.ok(c.task === "points");
  c.input.body = "Synthetic market cap reached $4.5 trillion.";
  const check = (text: string) => checkAnswer(c, { points: [text], tone: "neutral" }).blockers;
  assert.deepEqual([
    check("市值達 4.5 兆美元。"),
    check("市值達 45,000 億美元。"),
    check("市值達 4.5 TRILLION 美元。"),
  ], [[], [], []]);
  assert.ok(check("市值達 4.5 兆。").some((b) => b.kind === "number"));
  assert.ok(check("市值達 7.7 兆美元。").some((b) => b.kind === "number"));
  c.input.body = "合成公司市值達 4.5 兆美元。";
  assert.deepEqual(check("市值達 $4.5 trillion。"), []);
});

test("T／tn 市值縮寫可與兆美元雙向換算，整數與小數皆不誤擋", () => {
  const c = numericCase();
  assert.ok(c.task === "points");
  const cases = [
    { source: "$5T", answer: "市值達 5 兆美元。" },
    { source: "$5tn", answer: "市值達 5 兆美元。" },
    { source: "$5t", answer: "市值達 5 兆美元。" },
    { source: "$5TN", answer: "市值達 5 兆美元。" },
    { source: "$4.5T", answer: "市值達 4.5 兆美元。" },
    { source: "$4.5tn", answer: "市值達 4.5 兆美元。" },
    { source: "$5 trillion", answer: "市值達 5 兆美元。" },
    { source: "$5B", answer: "市值達 50 億美元。" },
  ];
  assert.deepEqual(cases.map(({ source, answer }) => {
    c.input.body = source;
    const forward = checkAnswer(c, { points: [answer], tone: "neutral" }).blockers;
    c.input.body = answer;
    const reverse = checkAnswer(c, { points: [source], tone: "neutral" }).blockers;
    return { source, forward, reverse };
  }), cases.map(({ source }) => ({ source, forward: [], reverse: [] })));
  c.input.body = "Market cap reached $5 trillion; capacity reached 5 trillion.";
  for (const answer of ["99T", "99tn", "$99T", "$99tn", "$5B"]) {
    assert.ok(checkAnswer(c, { points: [answer], tone: "neutral" }).blockers.some((b) => b.kind === "number"), answer);
  }
});

test("整數兆／trillion 必須核對來源，錯誤數值不能漏擋", () => {
  const c = numericCase();
  assert.ok(c.task === "points");
  c.input.body = "Synthetic market cap reached $9 trillion.";
  const check = (text: string) => checkAnswer(c, { points: [text], tone: "neutral" }).blockers;
  assert.deepEqual(check("市值達 9 兆美元。"), []);
  assert.deepEqual([
    check("市值達 99 兆美元。"),
    check("市值達 99 trillion 美元。"),
    check("市值達 $99 trillion。"),
  ].map((blockers) => blockers.some((b) => b.kind === "number")), [true, true, true]);
});

test("大盤提示詞折疊的貢獻合計也是來源；被折疊而未提供的個股數字不能引用", () => {
  const c = devCases().find((c) => c.id === "market-format")!;
  assert.ok(c.task === "market");
  c.input.movers = Array.from({ length: 8 }, (_, i) => ({ key: `FICT${i}`, company: `Synthetic ${i}`, returnPct: i < 6 ? null : 77.7, contributionPts: i < 6 ? 10 - i : i === 6 ? 0.2 : 0.4 }));
  assert.match(prepareTask(c).prompt.user, /未列出的追蹤公司.*合計，貢獻 \+0.6 點/);
  assert.deepEqual(checkAnswer(c, { summary: "未列出的追蹤公司合計貢獻 0.6 點。", tone: "neutral" }).blockers, []);
  assert.ok(checkAnswer(c, { summary: "未列出的追蹤公司上漲 77.7%。", tone: "neutral" }).blockers.some((b) => b.kind === "number"));
});

test("草案狀態不能被提前凍結；runner 僅 import 純函式與 node 內建模組", () => {
  assert.match(readFileSync(join(web, "docs/news-ai-eval.md"), "utf8").split("\n")[0], /草案，未凍結/);
  const source = readFileSync(cli, "utf8");
  assert.doesNotMatch(source, /import[^;]*ai-batch/s);
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  assert.ok(imports.every((p) => p.startsWith("node:") || ["../src/lib/news-ai.ts", "../src/lib/news-ai-eval.ts"].includes(p)));
});

test("四種任務沿用正式提示詞，舊本機提示詞可由 --prompts 準備並記錄 hash", () => {
  for (const c of devCases()) {
    const prompt = c.task === "translate" ? enrichPrompt([c.input]) : c.task === "points" ? pointsPrompt(c.input) : c.task === "digest" ? digestPrompt(c.input) : marketPrompt(c.input);
    assert.deepEqual(prepareTask(c).prompt, prompt);
  }
  const dir = mkdtempSync(join(tmpdir(), "mo-eval-prompts-"));
  try {
    const source = `export {pointsPrompt,digestPrompt,marketPrompt} from ${JSON.stringify(pathToFileURL(join(web, "src/lib/news-ai.ts")).href)};\nexport function enrichPrompt() { return {system: "legacy-system", user: "legacy-user"}; }\n`;
    const prompts = join(dir, "news-ai.ts");
    writeFileSync(prompts, source);
    const out = join(dir, "tasks");
    const result = run(["prepare", "--set", "dev", "--out", out, "--prompts", prompts]);
    assert.equal(result.status, 0, result.stderr);
    const tasks = JSON.parse(readFileSync(join(out, "tasks.json"), "utf8"));
    assert.equal(tasks.find((t: { meta: { type: string } }) => t.meta.type === "translate").prompt.user, "legacy-user");
    assert.equal(JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")).promptSourceSha256, createHash("sha256").update(source).digest("hex"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("完整原始答案都要檢查：不可用 parser 的截短、略過或 focus 過濾藏錯", () => {
  const c = numericCase();
  assert.ok(checkAnswer(c, { points: ["正常。", "正常。", "正常。", "正常。", "正常。", "營收 $999M。"], tone: "neutral" }).blockers.some((b) => b.kind === "number"));
  for (const answer of [null, {}, "不是 JSON", { points: [], tone: "neutral" }, { points: ["營收", 1], tone: "neutral" }]) {
    assert.ok(checkAnswer(c, answer).blockers.some((b) => b.kind === "format"));
  }
  const t = devCases().find((c) => c.id === "translate-other-target")!;
  const good = json(new URL("answers-good.json", dev))[t.id];
  good.items[0].focus = ["NOT-IN-INPUT"];
  assert.ok(checkAnswer(t, good).blockers.some((b) => b.kind === "company"));
});

test("只用可見來源核數字；買賣引用或否定與因果詞不會被全域封鎖", () => {
  const c = numericCase();
  assert.ok(c.task === "points");
  c.input.body = "The company did not buy shares. Sales were $1M.";
  c.input.summary = "Hidden unused summary: $999M.";
  const quoted = checkAnswer(c, { points: ["公司未買進股份，因為來源未提到計畫。"], tone: "neutral" });
  assert.deepEqual(quoted.blockers, []);
  assert.ok(quoted.flags.some((f) => f.includes("待人工看")));
  assert.ok(checkAnswer(c, { points: ["營收 $999M。"], tone: "neutral" }).blockers.some((b) => b.kind === "number"));
  const t = devCases().find((c) => c.id === "translate-other-target")!;
  assert.ok(t.task === "translate");
  t.input.summary = "x".repeat(301) + " $777M";
  const answer = { items: [{ n: 1, title_zh: "營收 $777M", focus: t.gold.focus, tone: "negative", category: "財報" }] };
  const result = checkAnswer(t, answer);
  assert.ok(result.blockers.some((b) => b.kind === "number"));
  assert.ok(result.flags.some((f) => f.startsWith("tone")));
  assert.ok(result.flags.some((f) => f.startsWith("category")));
});

test("參考涵蓋只計有 pattern 的事實；95%／90% 的人工門檻可通過，低於則拒絕", () => {
  const c = numericCase();
  c.gold.requiredFacts = Array.from({ length: 10 }, (_, i) => ({ id: `fact-${i}`, description: `事實 ${i}`, ...(i === 0 ? { pattern: "營收" } : {}) }));
  const lines = Array.from({ length: 20 }, (_, i) => `營收說明 ${i}。`);
  const answer = { points: [lines.join("")], tone: "neutral" };
  assert.deepEqual(checkAnswer(c, answer).referenceCoverage, { matched: 1, total: 1, missing: [] });
  const labels = { reviewers: [{ name: "站長", role: "owner" }], singleReviewer: true, cases: { [c.id]: { sentences: lines.map((text, i) => ({ text, supported: i > 0, evidence: "來源" })), coveredFacts: c.gold.requiredFacts.slice(0, 9).map((f) => f.id), blockers: [] } } };
  const score = () => scoreAnswers([c], { [c.id]: answer }, { set: "dev", labels });
  assert.equal(score().gate.passed, true);
  assert.equal(score().support?.rate, 0.95);
  assert.equal(score().coverage?.rate, 0.9);
  labels.cases[c.id].sentences[1].supported = false;
  assert.equal(score().gate.passed, false);
  labels.cases[c.id].sentences[1].supported = true;
  labels.cases[c.id].coveredFacts.pop();
  assert.equal(score().gate.passed, false);
  labels.cases[c.id].sentences[0].text = "換了答案。";
  assert.throws(score, /逐句/);
});

test("案例信任邊界拒絕錯任務、缺 focus、無效 pattern 與重複事實 id", () => {
  const c = numericCase();
  assert.throws(() => validateCase({ ...c, task: "unknown" }), /格式/);
  assert.throws(() => validateCase({ ...c, task: "translate" }), /格式/);
  const t = devCases().find((c) => c.task === "translate")!;
  assert.throws(() => validateCase({ ...t, gold: { ...t.gold, focus: undefined } }), /focus/);
  assert.throws(() => validateCase({ ...c, gold: { ...c.gold, forbidden: [{ kind: "timing", pattern: "[", reason: "bad" }] } }), /regular expression/i);
  assert.throws(() => validateCase({ ...c, gold: { ...c.gold, requiredFacts: [c.gold.requiredFacts[0], c.gold.requiredFacts[0]] } }), /重複/);
});

test("CLI：盲評 key 合併人工標註可通過，baseline hash 不同必須拒收", () => {
  const dir = mkdtempSync(join(tmpdir(), "mo-eval-score-"));
  try {
    const cases = devCases();
    const good = json(new URL("answers-good.json", dev));
    const blind = makeBlind(cases, { name: "good", answers: good }, { name: "bad", answers: json(new URL("answers-bad.json", dev)) }, 7);
    const labels = { reviewers: [{ name: "測試用合成評審", role: "owner" }], singleReviewer: true, cases: {} as Record<string, unknown> };
    for (const c of cases) {
      const side = blind.key.cases[c.id].A.version === "a" ? "A" : "B";
      labels.cases[c.id] = { [side]: { sentences: checkAnswer(c, good[c.id]).sentences.map((text) => ({ text, supported: true, evidence: "測試用合成來源" })), coveredFacts: c.gold.requiredFacts.map((f) => f.id), blockers: [] } };
    }
    const labelsPath = join(dir, "labels.json"), keyPath = join(dir, "key.json"), out = join(dir, "report.json");
    writeFileSync(labelsPath, JSON.stringify(labels));
    writeFileSync(keyPath, JSON.stringify(blind.key));
    const args = ["score", "--set", "dev", "--answers", "evals/news-ai/dev/answers-good.json", "--labels", labelsPath, "--key", keyPath];
    let result = run([...args, "--out", out]);
    assert.equal(result.status, 0, result.stderr);
    result = run([...args, "--baseline", out]);
    assert.equal(result.status, 0, result.stderr);
    const baseline = JSON.parse(readFileSync(out, "utf8"));
    baseline.caseHashes = {};
    writeFileSync(out, JSON.stringify(baseline));
    result = run([...args, "--baseline", out]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /hash/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
