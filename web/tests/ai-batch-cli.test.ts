import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import * as batchLib from "../scripts/ai-batch-lib.ts";
import type { DailyWork, Task } from "../scripts/ai-batch-lib.ts";
import type { ImportBody } from "../src/server/ai-batch.ts";
import { DIGEST_SCHEMA, ENRICH_SCHEMA, POINTS_SCHEMA } from "../src/lib/news-ai.ts";

const web = join(import.meta.dirname, "..");
const emptyDaily = { date: null, points: [], digests: [], market: null };
const news = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `n${i + 1}`, title: `News ${i + 1}`, summary: null, symbols: ["NVDA"], primarySymbol: "NVDA" }));
const accepted = { translated: 1, points: 0, digests: 0, skipped: [], accepted: ["translate:n1"], rejected: [] };
const digest = (key: string) => ({ key, company: key, date: "2026-10-27", returnPct: 1, contributionPts: 2, news: [] });

async function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "mo-ai-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // Run an exact copy so even the old CLI, which ignores MO_AI_BATCH_DIR, cannot touch the live batch directory.
  mkdirSync(join(root, "scripts"));
  for (const file of ["ai-batch.ts", "ai-batch-lib.ts"]) {
    if (existsSync(join(web, "scripts", file))) copyFileSync(join(web, "scripts", file), join(root, "scripts", file));
  }
  symlinkSync(join(web, "src"), join(root, "src"), "dir");
  const batch = join(root, ".ai-batch");
  const state = { translate: news(1), daily: emptyDaily as object, receipt: accepted as object, signInStatus: 200, postStatus: 200, disconnectPost: false };
  const posts: (ImportBody & { run: NonNullable<ImportBody["run"]> })[] = [];
  const requests: string[] = [];
  const server = createServer(async (req, res) => {
    requests.push(`${req.method} ${req.url}`);
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/auth/sign-in/email") {
      res.statusCode = state.signInStatus;
      res.setHeader("set-cookie", "s=1; Path=/");
      return void res.end("{}");
    }
    if (req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      posts.push(JSON.parse(body));
      if (state.disconnectPost) return req.socket.destroy();
      res.statusCode = state.postStatus;
      return void res.end(JSON.stringify(state.receipt));
    }
    const kind = new URL(req.url!, "http://localhost").searchParams.get("kind");
    res.end(JSON.stringify(kind === "daily" ? state.daily : { translate: state.translate }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const port = (server.address() as { port: number }).port;
  const run = async (args: string[], batchDir = batch, model?: string) => {
    const env: NodeJS.ProcessEnv = { ...process.env, MO_URL: `http://127.0.0.1:${port}`, MO_EMAIL: "owner@example.test", MO_PASSWORD: "test-password", MO_AI_BATCH_DIR: batchDir };
    delete env.AI_BATCH_MODEL;
    if (model !== undefined) env.AI_BATCH_MODEL = model;
    const child = spawn(process.execPath, [join(root, "scripts/ai-batch.ts"), ...args], {
      cwd: web,
      env,
    });
    let out = "";
    child.stdout.on("data", (data) => out += data);
    child.stderr.on("data", (data) => out += data);
    const code = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
    return { code, out };
  };
  return { root, batch, state, posts, requests, run };
}

test("pull manifest 記錄來源、schema、任務 hash、未知模型與 daily 快照，push 補答案 mtime 與送出時間", async (t) => {
  const f = await fixture(t);
  f.state.daily = { ...emptyDaily, date: "2026-10-27", revision: 3, digests: [digest("NVDA")] };
  const pull = await f.run(["pull", "daily"]);
  assert.equal(pull.code, 0, pull.out);
  const dir = join(f.batch, "daily");
  const manifestFile = join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  assert.equal(manifest.kind, "daily");
  assert.match(manifest.runId, /^daily-.*Z-[a-z0-9]{4}$/);
  assert.ok(Number.isFinite(Date.parse(manifest.pulledAt)));
  assert.equal(manifest.gitCommit, "unknown", "複製到沒有 git 的目錄，不能記到呼叫者 cwd 的 commit");
  assert.equal(manifest.gitDirty, "unknown");
  assert.equal(manifest.promptSourceSha256, sha256(readFileSync(join(web, "src/lib/news-ai.ts"))));
  assert.deepEqual(manifest.schemaSha256, {
    translate: sha256(JSON.stringify(ENRICH_SCHEMA)), points: sha256(JSON.stringify(POINTS_SCHEMA)), digest: sha256(JSON.stringify(DIGEST_SCHEMA)),
  });
  assert.equal(manifest.tasksSha256, sha256(readFileSync(join(dir, "tasks.json"))));
  assert.equal(manifest.requestedModel, "unknown");
  assert.deepEqual(manifest.snapshot, { date: "2026-10-27", revision: 3 });
  assert.deepEqual(manifest.points, []);
  assert.deepEqual(manifest.unavailable, []);
  assert.equal("pushedAt" in manifest, false);
  const [task] = JSON.parse(readFileSync(join(dir, "tasks.json"), "utf8"));
  const answersFile = join(dir, "answers.json");
  writeFileSync(answersFile, JSON.stringify({ [task.id]: { summary: "每日重點摘要", tone: "neutral" } }));
  const answersWrittenAt = statSync(answersFile).mtime.toISOString();
  // Only the documented metadata may leave the local manifest.
  writeFileSync(manifestFile, JSON.stringify({ ...manifest, body: "私有正文", prompt: "私有提示詞" }));
  const push = await f.run(["push", "daily"]);
  assert.equal(push.code, 0, push.out);
  const saved = JSON.parse(readFileSync(manifestFile, "utf8"));
  assert.equal(saved.answersWrittenAt, answersWrittenAt);
  assert.ok(Date.parse(saved.pushedAt) >= Date.parse(saved.pulledAt));
  assert.equal(f.posts[0].model, "claude-orca");
  assert.deepEqual(f.posts[0].run.manifest, { ...manifest, answersWrittenAt, pushedAt: saved.pushedAt });
  assert.doesNotMatch(JSON.stringify(f.posts[0].run.manifest), /私有正文|私有提示詞|"body"|"prompt"/);
  assert.equal((await f.run(["pull", "daily"])).code, 0);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "runs", manifest.runId, "manifest.json"), "utf8")), saved);
});

test("manifest 以腳本所在 repo 記錄 commit 與 dirty；push 指定的模型 alias 同步到 manifest", async (t) => {
  const f = await fixture(t);
  const git = (...args: string[]) => execFileSync("git", ["-C", f.root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init");
  git("add", ".");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgSign=false", "commit", "-m", "測試初始狀態");
  const commit = git("rev-parse", "HEAD");
  assert.equal((await f.run(["pull", "translate"])).code, 0);
  const dir = join(f.batch, "translate");
  const manifestFile = join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  assert.equal(manifest.gitCommit, commit);
  assert.equal(manifest.gitDirty, false);
  assert.equal("snapshot" in manifest, false);
  assert.equal(manifest.requestedModel, "unknown");
  const [task] = JSON.parse(readFileSync(join(dir, "tasks.json"), "utf8"));
  writeFileSync(join(dir, "answers.json"), JSON.stringify({ [task.id]: { items: [] } }));
  assert.equal((await f.run(["push", "translate"], f.batch, "test-alias")).code, 0);
  assert.equal(f.posts[0].model, "test-alias");
  assert.equal(JSON.parse(readFileSync(manifestFile, "utf8")).requestedModel, "test-alias");
  assert.equal((f.posts[0].run.manifest as { requestedModel: string }).requestedModel, "test-alias");
  assert.equal((await f.run(["pull", "translate"], f.batch, "pull-alias")).code, 0);
  const next = JSON.parse(readFileSync(manifestFile, "utf8"));
  assert.equal(next.gitDirty, true);
  assert.equal(next.gitCommit, commit);
  assert.equal(next.requestedModel, "pull-alias");
});

test("再次 pull 會歸檔上一批答案，保留任務、提示詞與回執", async (t) => {
  const f = await fixture(t);
  const dir = join(f.batch, "translate");
  const first = await f.run(["pull", "translate"]);
  assert.equal(first.code, 0, first.out);
  const tasks = readFileSync(join(dir, "tasks.json"), "utf8");
  const markdown = readFileSync(join(dir, "tasks.md"), "utf8");
  const answers = '{\n  "saved-answer": {"items": []}\n}\n';
  writeFileSync(join(dir, "answers.json"), answers);
  writeFileSync(join(dir, "receipt.json"), '{"translated":1}\n');
  const second = await f.run(["pull", "translate"]);
  assert.equal(second.code, 0, second.out);
  assert.ok(existsSync(join(dir, "runs")), "上一批必須先歸檔，不能清空答案");
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const [runId] = readdirSync(join(dir, "runs"));
  const archived = join(dir, "runs", runId);
  assert.equal(readFileSync(join(archived, "answers.json"), "utf8"), answers);
  assert.equal(readFileSync(join(archived, "tasks.json"), "utf8"), tasks);
  assert.equal(readFileSync(join(archived, "tasks.md"), "utf8"), markdown);
  assert.equal(readFileSync(join(archived, "receipt.json"), "utf8"), '{"translated":1}\n');
  assert.equal(JSON.parse(readFileSync(join(archived, "manifest.json"), "utf8")).runId, runId);
  assert.match(manifest.runId, /^translate-.*Z-[a-z0-9]{4}$/);
  assert.notEqual(manifest.runId, runId);
  const taskId = JSON.parse(readFileSync(join(dir, "tasks.json"), "utf8"))[0].id;
  assert.equal(taskId, `t1-${manifest.runId.slice(-4)}`);
  assert.match(readFileSync(join(dir, "tasks.md"), "utf8"), new RegExp(`## ${taskId}：`));
  assert.equal(existsSync(join(dir, "receipt.json")), false);
});

test("daily precheck 沒有每日任務但有翻譯時，以 0 結束且不建立工作目錄", async (t) => {
  const f = await fixture(t);
  const result = await f.run(["pull", "daily", "--check"]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /每日沒有待辦，但有 1 則新聞待翻譯/);
  assert.ok(f.requests.includes("GET /api/admin/ai?kind=translate"));
  assert.equal(existsSync(f.batch), false);
});

function snapshot(dir: string) {
  return Object.fromEntries([".", ...readdirSync(dir, { recursive: true, encoding: "utf8" })].sort().map((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    return [name, { mtimeMs: stat.mtimeMs, content: stat.isFile() ? readFileSync(path, "utf8") : null }];
  }));
}

test("daily precheck 有 digest：既有任務與答案逐字及 mtime 不變、不歸檔、不產生 manifest", async (t) => {
  const f = await fixture(t);
  f.state.daily = { ...emptyDaily, digests: [digest("NVDA")] };
  const dir = join(f.batch, "daily");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "tasks.json"), '[{"id":"old-task","meta":{"type":"points","id":"old-news"}}]\n');
  writeFileSync(join(dir, "answers.json"), '{ "old-task": { "points": ["已完成的答案"] } }\n');
  const before = snapshot(dir);
  const result = await f.run(["pull", "daily", "--check"]);
  assert.equal(result.code, 0, result.out);
  assert.deepEqual(snapshot(dir), before);
  assert.match(result.out, /每日有待辦（precheck 不寫檔，排程會再 pull 一次）/);
  assert.equal(existsSync(join(dir, "runs")), false);
  assert.equal(existsSync(join(dir, "manifest.json")), false);
  assert.equal(f.requests.includes("GET /api/admin/ai?kind=translate"), false);
});

test("兩個任務只答一個：push 保存回執、送出逐筆 expected/missing，並以 3 結束", async (t) => {
  const f = await fixture(t);
  f.state.daily = { ...emptyDaily, digests: [digest("NVDA"), digest("AAPL")] };
  f.state.receipt = { translated: 0, points: 0, digests: 1, skipped: [], accepted: ["digest:NVDA:2026-10-27"], rejected: [] };
  const pull = await f.run(["pull", "daily"]);
  assert.equal(pull.code, 0, pull.out);
  const dir = join(f.batch, "daily");
  const tasks = JSON.parse(readFileSync(join(dir, "tasks.json"), "utf8"));
  writeFileSync(join(dir, "answers.json"), JSON.stringify({ [tasks[0].id]: { summary: "測試摘要文字", tone: "neutral" } }));
  const push = await f.run(["push", "daily"]);
  assert.equal(push.code, 3, push.out);
  assert.match(push.out, /缺答案：digest:AAPL:2026-10-27/);
  assert.deepEqual(f.posts[0].run.expected, ["digest:NVDA:2026-10-27", "digest:AAPL:2026-10-27"]);
  assert.deepEqual(f.posts[0].run.missing, ["digest:AAPL:2026-10-27"]);
  assert.equal(f.posts[0].run.id, JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")).runId);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "receipt.json"), "utf8")), f.state.receipt);
});

test("上一批代號的答案不會套到新任務，只會回報 missing", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.run(["pull", "translate"])).code, 0);
  const dir = join(f.batch, "translate");
  const [old] = JSON.parse(readFileSync(join(dir, "tasks.json"), "utf8"));
  assert.equal((await f.run(["pull", "translate"])).code, 0);
  writeFileSync(join(dir, "answers.json"), JSON.stringify({ [old.id]: { items: [{ n: 1, title_zh: "舊答案" }] } }));
  f.state.receipt = { ...accepted, translated: 0, accepted: [] };
  const result = await f.run(["push", "translate"]);
  assert.deepEqual(f.posts[0].translate, [], "不可以把舊答案送給新批次");
  assert.deepEqual(f.posts[0].points, []);
  assert.deepEqual(f.posts[0].digests, []);
  assert.deepEqual(f.posts[0].run.missing, ["translate:n1"]);
  assert.equal(result.code, 3, result.out);
});

test("article 區分搜尋失敗、未對到、抓取失敗、非 HTML 與正文不足", async (t) => {
  const title = "Nvidia beats estimates";
  const url = "https://finance.yahoo.com/news/nvidia.html";
  const search = { status: 200, type: "application/json", body: JSON.stringify({ news: [{ title, link: url }] }) };
  const html = { status: 200, type: "text/html", body: `<article><p>${"a".repeat(250)}</p></article>` };
  const cases = [
    { name: "搜尋連線失敗", search: new Error("offline"), article: html, reason: "search-failed" },
    { name: "搜尋 HTTP 失敗", search: { ...search, status: 503 }, article: html, reason: "search-failed" },
    { name: "搜尋 JSON 損壞", search: { ...search, body: "not-json" }, article: html, reason: "search-failed" },
    { name: "沒有新聞", search: { ...search, body: '{"news":[]}' }, article: html, reason: "no-match" },
    { name: "標題不同", search: { ...search, body: JSON.stringify({ news: [{ title: "Other news", link: url }] }) }, article: html, reason: "no-match" },
    { name: "文章連線失敗", search, article: new Error("offline"), reason: "fetch-failed" },
    { name: "文章 HTTP 失敗", search, article: { ...html, status: 403 }, reason: "fetch-failed" },
    { name: "文章不是 HTML", search, article: { ...html, type: "application/pdf" }, reason: "not-html" },
    { name: "文章太短", search, article: { ...html, body: "<p>short</p>" }, reason: "too-short" },
  ];
  for (const c of cases) await t.test(c.name, async () => {
    const getText = async (requested: string) => {
      const response = requested === url ? c.article : c.search;
      if (response instanceof Error) throw response;
      return response;
    };
    assert.deepEqual(await batchLib.article(title, ["NVDA"], getText), { unavailable: c.reason });
  });
});

test("MO_AI_BATCH_DIR 使用指定根目錄下的 kind，translate --check 仍寫檔並歸檔", async (t) => {
  const f = await fixture(t);
  const batch = join(f.root, "custom-batches");
  const dir = join(batch, "translate");
  assert.equal((await f.run(["pull", "translate", "--check"], batch)).code, 0);
  const { runId } = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const answers = '{"previous":"保留翻譯答案"}\n';
  writeFileSync(join(dir, "answers.json"), answers);
  assert.equal((await f.run(["pull", "translate", "--check"], batch)).code, 0);
  assert.equal(readFileSync(join(dir, "runs", runId, "answers.json"), "utf8"), answers);
  assert.ok(existsSync(join(dir, "tasks.md")));
  assert.equal(existsSync(f.batch), false);
  f.state.translate = [];
  assert.equal((await f.run(["pull", "translate", "--check"], batch)).code, 1);
  assert.equal(readFileSync(join(dir, "tasks.md"), "utf8"), "沒有待辦。\n");
  assert.equal(readdirSync(join(dir, "runs")).length, 2, "空的新批次也保留前兩次真的 pull");
});

test("舊版無 manifest 批次以 tasks mtime 歸檔，沒有回執便維持沒有回執", async (t) => {
  const f = await fixture(t);
  const dir = join(f.batch, "translate");
  mkdirSync(dir, { recursive: true });
  const tasks = '[{"id":"t1","meta":{"type":"translate","ids":["n1"]}}]\n';
  const answers = '{"t1":{"items":[]}}\n';
  writeFileSync(join(dir, "tasks.json"), tasks);
  writeFileSync(join(dir, "answers.json"), answers);
  const mtime = statSync(join(dir, "tasks.json")).mtime;
  assert.equal((await f.run(["pull", "translate"])).code, 0);
  const archive = join(dir, "runs", `legacy-${mtime.toISOString()}`);
  assert.equal(readFileSync(join(archive, "tasks.json"), "utf8"), tasks);
  assert.equal(readFileSync(join(archive, "answers.json"), "utf8"), answers);
  assert.equal(statSync(join(archive, "tasks.json")).mtime.toISOString(), mtime.toISOString());
  assert.equal(existsSync(join(archive, "receipt.json")), false);
});

test("daily precheck 每日與翻譯皆空時回 1，既有批次與歸檔均不變", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.run(["pull", "daily"])).code, 0);
  f.state.translate = [];
  const before = snapshot(f.batch);
  const result = await f.run(["pull", "daily", "--check"]);
  assert.equal(result.code, 1, result.out);
  assert.deepEqual(snapshot(f.batch), before);
});

test("push 空任務不讀答案、不登入也不呼叫 API", async (t) => {
  const f = await fixture(t);
  const dir = join(f.batch, "daily");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "tasks.json"), "[]\n");
  const result = await f.run(["push", "daily"]);
  assert.equal(result.code, 0, result.out);
  assert.equal(result.out.trim(), "沒有任務");
  assert.deepEqual(f.requests, []);
});

test("push 全部 accepted 回 0、rejected 或舊 Worker 的 skipped 回 3，HTTP 錯誤仍拋出", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.run(["pull", "translate"])).code, 0);
  const dir = join(f.batch, "translate");
  const [task] = JSON.parse(readFileSync(join(dir, "tasks.json"), "utf8"));
  writeFileSync(join(dir, "answers.json"), JSON.stringify({ [task.id]: { items: [] } }));
  for (const c of [
    { name: "全部 accepted", receipt: accepted, code: 0, output: /缺答案：無；拒收：無；正文取不到 0 則/ },
    { name: "server 拒收", receipt: { ...accepted, translated: 0, accepted: [], rejected: [{ key: "translate:n1", reason: "格式不對" }] }, code: 3, output: /拒收：translate:n1（格式不對）/ },
    { name: "舊 Worker skipped", receipt: { translated: 0, points: 0, digests: 0, skipped: ["舊版拒收"] }, code: 3, output: /拒收：舊版拒收/ },
    { name: "新 Worker rejected 優先", receipt: { ...accepted, skipped: ["舊版訊息"] }, code: 0, output: /拒收：無/ },
  ]) await t.test(c.name, async () => {
    f.state.receipt = c.receipt;
    const result = await f.run(["push", "translate"]);
    assert.equal(result.code, c.code, result.out);
    assert.match(result.out, c.output);
    assert.deepEqual(f.posts.at(-1)!.run.expected, ["translate:n1"]);
    assert.deepEqual(f.posts.at(-1)!.run.missing, []);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "receipt.json"), "utf8")), c.receipt);
  });
  const before = readFileSync(join(dir, "receipt.json"), "utf8");
  f.state.postStatus = 503;
  const result = await f.run(["push", "translate"]);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /HTTP 503/);
  assert.equal(readFileSync(join(dir, "receipt.json"), "utf8"), before);
});

test("push 登入、HTTP 或斷線失敗時，manifest 與回執維持上一個成功狀態並一致歸檔", async (t) => {
  for (const failure of [
    { name: "登入 401", state: { signInStatus: 401 }, output: /登入失敗：HTTP 401/ },
    { name: "POST 400", state: { postStatus: 400 }, output: /HTTP 400/ },
    { name: "POST 503", state: { postStatus: 503 }, output: /HTTP 503/ },
    { name: "POST 斷線", state: { disconnectPost: true }, output: /fetch failed/ },
  ]) for (const pushed of [false, true]) await t.test(`${pushed ? "成功後重推" : "首次 push"}：${failure.name}`, async (t) => {
    const f = await fixture(t);
    assert.equal((await f.run(["pull", "translate"])).code, 0);
    const dir = join(f.batch, "translate");
    const manifestFile = join(dir, "manifest.json");
    const receiptFile = join(dir, "receipt.json");
    const [task] = JSON.parse(readFileSync(join(dir, "tasks.json"), "utf8"));
    writeFileSync(join(dir, "answers.json"), JSON.stringify({ [task.id]: { items: [] } }));
    if (pushed) {
      const success = await f.run(["push", "translate"], f.batch, "successful-model");
      assert.equal(success.code, 0, success.out);
    }
    const manifest = readFileSync(manifestFile, "utf8");
    const receipt = existsSync(receiptFile) ? readFileSync(receiptFile, "utf8") : undefined;
    const postCount = f.posts.length;
    Object.assign(f.state, failure.state);
    const result = await f.run(["push", "translate"], f.batch, "failed-model");
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, failure.output);
    assert.equal(f.posts.length, postCount + (failure.state.signInStatus ? 0 : 1));
    assert.equal(readFileSync(manifestFile, "utf8"), manifest, "失敗不能寫入 pushedAt、答案時間或模型");
    assert.equal(existsSync(receiptFile), pushed);
    if (pushed) assert.equal(readFileSync(receiptFile, "utf8"), receipt);

    f.state.signInStatus = 200;
    const pull = await f.run(["pull", "translate"]);
    assert.equal(pull.code, 0, pull.out);
    const archive = join(dir, "runs", JSON.parse(manifest).runId);
    assert.equal(readFileSync(join(archive, "manifest.json"), "utf8"), manifest);
    assert.equal(existsSync(join(archive, "receipt.json")), pushed);
    if (pushed) assert.equal(readFileSync(join(archive, "receipt.json"), "utf8"), receipt);
  });
});

test("article 保存擷取 URL，6000 字上限才標 truncated，同批搜尋可共用", async () => {
  let searchRequests = 0;
  let bodyChars = 5999;
  const getText = async (url: string) => {
    if (url.includes("/search?")) {
      searchRequests++;
      return { status: 200, type: "application/json", body: '{"news":[{"title":"Same title","link":"https://example.test/article"}]}' };
    }
    return { status: 200, type: "text/html", body: `<article><p>${"a".repeat(bodyChars)}</p></article>` };
  };
  const search = batchLib.createYahooSearch(getText);
  for (const [length, truncated] of [[5999, false], [6000, true], [6001, true]] as const) {
    bodyChars = length;
    assert.deepEqual(await batchLib.article("Same title", ["NVDA"], getText, search), { body: "a".repeat(Math.min(length, 6000)), url: "https://example.test/article", truncated });
  }
  assert.equal(searchRequests, 1);
});

const point = { id: "n1", title: "Same title", url: "https://example.test/article", summary: null, symbols: ["NVDA"] };
const market: NonNullable<DailyWork["market"]> = { date: "2026-10-27", close: 7000, changePts: 5, returnPct: 1, vix: 20, vixChange: 1, spreadPct: 1, movers: [], restPts: 1, news: [], newsIds: [] };

test("daily 有 market 或 digests 就有待辦且不抓正文；只有 points 時須有可取得的正文", async () => {
  for (const work of [{ ...emptyDaily, date: market.date, market, points: [point] }, { ...emptyDaily, digests: [digest("NVDA")], points: [point] }]) {
    assert.equal(await batchLib.hasDailyWork(work, async () => { assert.fail("precheck 不應抓正文"); }), true);
  }
  const work = { ...emptyDaily, points: [point, { ...point, id: "n2" }] };
  assert.equal(await batchLib.hasDailyWork(work, async (p) => p.id === "n2"), true);
  assert.equal(await batchLib.hasDailyWork(work, async () => false), false);
  assert.equal(await batchLib.hasDailyWork(emptyDaily, async () => { assert.fail("沒有 points 不應抓正文"); }), false);
});

function task(id: string, meta: Task["meta"]): Task {
  return { id, title: "test", prompt: { system: "test", user: "test" }, schema: {}, meta };
}

test("正文不可得以 points:<id> 列入 unavailable，不建立任務也不影響成功狀態", async () => {
  const work = { ...emptyDaily, points: [point, { ...point, id: "n2", title: "Unavailable" }] };
  const built = await batchLib.buildDailyTasks(work, async (title) => title === "Unavailable"
    ? { unavailable: "not-html" }
    : { body: "可用正文", url: point.url, truncated: false });
  assert.deepEqual(built.tasks.map((task) => task.meta), [{ type: "points", id: "n1" }]);
  assert.deepEqual(built.points, [{ key: "points:n1", url: point.url, bodyChars: 4, truncated: false }]);
  assert.deepEqual(built.unavailable, [{ key: "points:n2", reason: "not-html" }]);
  const manifest = { runId: "daily-test-abcd", kind: "daily" as const, pulledAt: "2026-10-27T00:00:00Z", unavailable: built.unavailable };
  const body = batchLib.preparePush(built.tasks, { p1: { points: ["答案"], tone: "neutral" } }, manifest, "test");
  assert.deepEqual(body.run.unavailable, built.unavailable);
  assert.deepEqual(body.run.expected, ["points:n1"]);
  const result = batchLib.summarizeReceipt({ ...accepted, translated: 0, points: 1, accepted: ["points:n1"] }, body.run);
  assert.equal(result.status, "ok");
  assert.equal(result.exitCode, 0);
  assert.match(result.message, /正文取不到 1 則/);
});

test("回執鍵逐則展開翻譯、points 與 digest，字串答案可解析，缺整題翻譯列出每則新聞", () => {
  const tasks = [task("t1-abcd", { type: "translate", ids: ["n1", "n2"] }), task("p1-abcd", { type: "points", id: "n3" }), task("m1-abcd", { type: "digest", key: "SPX", date: "2026-10-27", newsIds: [] })];
  const manifest = { runId: "daily-test-abcd", kind: "daily" as const, pulledAt: "2026-10-27T00:00:00Z", unavailable: [] };
  const body = batchLib.preparePush(tasks, { "p1-abcd": '{"points":["重點"]}', "m1-abcd": { summary: "大盤摘要", tone: "neutral" } }, manifest, "test");
  assert.deepEqual(body.run.expected, ["translate:n1", "translate:n2", "points:n3", "digest:SPX:2026-10-27"]);
  assert.deepEqual(body.run.missing, ["translate:n1", "translate:n2"]);
  assert.deepEqual(body.translate, []);
  assert.deepEqual(body.points, [{ id: "n3", answer: { points: ["重點"] } }]);
  assert.deepEqual(body.digests, [{ key: "SPX", date: "2026-10-27", newsIds: [], answer: { summary: "大盤摘要", tone: "neutral" } }]);
  assert.equal(batchLib.summarizeReceipt({ ...accepted, points: 1, accepted: ["points:n3"] }, body.run).status, "partial");
  assert.equal(batchLib.summarizeReceipt({ ...accepted, translated: 0, accepted: [] }, body.run).status, "failed");
});
