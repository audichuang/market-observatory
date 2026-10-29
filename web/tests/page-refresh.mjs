// Prepare: npx void db migrate; npm run dev -- --port 5199 --strictPort --host 127.0.0.1
// In ego-browser taskSpace("mo-verify-fx-u5"), visit /login and sign in as owner.
// Run against that isolated local Vite instance (no price backfill required):
// node tests/page-refresh.mjs http://127.0.0.1:5199 <evidence-directory>
// Uses only the source switch and forecast-phase (no external requests or push).
// A minimal DB records forecast-phase as ok / "資料不足，略過"; the test asserts
// that this real backend run appears immediately, independently of market data.
// Keep the task space for red/green runs; finish it with task.finish({ keep: [] })
// after verification, and stop the dev server you started.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const base = new URL(process.argv[2]);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname) && Number(base.port) >= 5195, "Only use an isolated local test instance on port >= 5195");
const evidence = resolve(process.argv[3]);
mkdirSync(evidence, { recursive: true });

const script = `
const { default: assert } = await import("node:assert/strict");
const fs = await import("node:fs/promises");
const task = await taskSpace("mo-verify-fx-u5");
const page = task.page("p1");
const evidence = ${JSON.stringify(evidence)};
const checks = [];
const check = (name, pass, detail) => { checks.push({ name, pass, ...detail }); console.log(pass ? "PASS:" : "FAIL:", name, detail); };
const api = async (url, options) => {
  const response = await page.fetch(url, options);
  assert.equal(response.status, 200, url);
  return JSON.parse(response.body);
};
const ready = () => page.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find(b => b.textContent === "登出");
  return b && Object.keys(b).some(k => k.startsWith("__reactFiber"));
});
const sourceCell = () => page.evaluate(() => {
  const cell = [...document.querySelectorAll("td")].find(td => [...td.children].some(n => n.textContent === "nasdaq-news"));
  cell.querySelector("button").setAttribute("data-u5-toggle", "");
  cell.scrollIntoView({ block: "center" });
  return { text: cell.textContent, button: cell.querySelector("button").textContent };
});
const enterSources = async () => {
  await page.goto(${JSON.stringify(base.origin)} + "/");
  await ready();
  // Wait for the actual mount/hover prefetch before clicking the navigation link.
  await page.hover('nav[aria-label="主要分頁"] a[href="/sources"]');
  await page.waitForFunction(() => performance.getEntriesByType("resource").some(r => new URL(r.name).pathname === "/sources" && r.initiatorType === "fetch"));
  await page.evaluate(() => {
    window.__u5Document = true;
    window.__u5Network = [];
    const original = window.fetch;
    window.fetch = async (...args) => {
      const response = await original(...args);
      window.__u5Network.push({ url: String(args[0] instanceof Request ? args[0].url : args[0]), method: args[1]?.method ?? "GET", status: response.status });
      return response;
    };
  });
  await page.click('nav[aria-label="主要分頁"] a[href="/sources"]', { label: "由導覽進資料來源" });
  await page.waitForSelector('h1:text-is("資料來源與品質")');
};
const waitForIdle = () => page.waitForFunction(() => ![...document.querySelectorAll("button")].some(b => b.disabled && /切換中|執行中/.test(b.textContent)) && !document.querySelector(".progress.on"));
const waitForButton = async (text) => {
  try {
    await page.waitForFunction(text => {
      const cell = [...document.querySelectorAll("td")].find(td => [...td.children].some(n => n.textContent === "nasdaq-news"));
      return cell?.querySelector("button")?.textContent === text;
    }, text, { timeout: 2000 });
  } catch { /* Record the stale UI below, then recover only for cleanup. */ }
};

await enterSources();
assert.equal((await api("/api/admin/sources")).switches["nasdaq-news"]?.disabled ?? false, false, "Start with Nasdaq news enabled");
await sourceCell();
await page.screenshot({ path: evidence + "/sources-before.png" });
await page.click("[data-u5-toggle]", { label: "停用 Nasdaq 新聞來源" });
await page.acceptDialog();
await waitForIdle();
await waitForButton("恢復");
const disabledApi = await api("/api/admin/sources");
const disabledUi = await sourceCell();
check("停用後同列立即更新", disabledApi.switches["nasdaq-news"].disabled && disabledUi.button === "恢復" && disabledUi.text.includes("已停用"), { backendDisabled: disabledApi.switches["nasdaq-news"].disabled, ui: disabledUi });
await page.screenshot({ path: evidence + "/sources-disabled.png" });
// Prime a separate disabled page shell: restore must also survive navigation prefetch.
await enterSources();
await sourceCell();
await page.click("[data-u5-toggle]", { label: "恢復 Nasdaq 新聞來源" });
await waitForIdle();
await waitForButton("停用");
const restoredApi = await api("/api/admin/sources");
const restoredUi = await sourceCell();
check("恢復後同列立即更新", !restoredApi.switches["nasdaq-news"]?.disabled && restoredUi.button === "停用" && restoredUi.text.includes("啟用中"), { backendDisabled: restoredApi.switches["nasdaq-news"]?.disabled ?? false, ui: restoredUi });
await page.screenshot({ path: evidence + "/sources-restored.png" });

// A fresh document resets the navigation cache, then the navigation link primes it again.
await enterSources();
// Show all records, including when an action crosses the default 15-row limit.
const showAllRuns = async () => {
  if (await page.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.startsWith("顯示全部")))) {
    await page.click('button:has-text("顯示全部")');
  }
};
await showAllRuns();
const runsState = (mark = false) => page.evaluate(mark => {
  const panel = [...document.querySelectorAll(".panel")].find(p => p.querySelector("h2")?.textContent === "執行紀錄");
  if (mark) panel.querySelectorAll("li").forEach(li => li.setAttribute("data-u5-existing-run", ""));
  return { count: panel.querySelectorAll("li").length, first: panel.querySelector("li")?.textContent ?? null, firstIsOld: panel.querySelector("li")?.hasAttribute("data-u5-existing-run") ?? false };
}, mark);
await page.evaluate(() => [...document.querySelectorAll("h2")].find(h => h.textContent === "執行紀錄").scrollIntoView({ block: "center" }));
await page.screenshot({ path: evidence + "/sources-runs-before.png" });
for (let attempt = 1; attempt <= 2; attempt++) {
  const before = await runsState(true);
  await page.click('button:text-is("展望相位平均")', { label: "執行展望相位平均工作" });
  await page.waitForFunction(() => [...document.querySelectorAll("p")].some(p => p.textContent.startsWith("展望相位平均：成功")));
  await waitForIdle();
  await showAllRuns();
  try { await page.waitForFunction(() => {
    const panel = [...document.querySelectorAll(".panel")].find(p => p.querySelector("h2")?.textContent === "執行紀錄");
    return panel.querySelector("li") && !panel.querySelector("li").hasAttribute("data-u5-existing-run");
  }, undefined, { timeout: 2000 }); } catch { /* Assert using the captured state. */ }
  const after = await runsState();
  const backend = await api("/sources", { headers: { "X-VoidPages": "true", Accept: "application/json" } });
  const run = backend.props.runs[0];
  check("手動執行第 " + attempt + " 次即時新增紀錄", after.count === Math.min(60, before.count + 1) && !after.firstIsOld && after.first?.includes("展望相位平均") && run.job === "forecast-phase" && run.status === "ok", { before, after, backendRun: run });
  await page.evaluate(() => [...document.querySelectorAll("h2")].find(h => h.textContent === "執行紀錄").scrollIntoView({ block: "center" }));
  await page.screenshot({ path: evidence + "/sources-run-" + attempt + ".png" });
}
check("手動執行保留同一份文件", await page.evaluate(() => window.__u5Document === true), {});
const network = await page.evaluate(() => window.__u5Network);

// Simulate an update from another client while this prefetched page is in the background.
await enterSources();
await sourceCell();
await api("/api/admin/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "nasdaq-news", disabled: true }) });
await page.evaluate(() => {
  const descriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
  const now = Date.now;
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  Date.now = () => now() + 11 * 60 * 1000;
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
  Date.now = now;
  if (descriptor) Object.defineProperty(document, "visibilityState", descriptor);
  else delete document.visibilityState;
});
await waitForIdle();
await waitForButton("恢復");
const foregroundUi = await sourceCell();
check("回前景後重新取得資料", foregroundUi.button === "恢復", { ui: foregroundUi });
await page.screenshot({ path: evidence + "/sources-foreground.png" });
await api("/api/admin/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "nasdaq-news", disabled: false }) });
assert.equal((await api("/api/admin/sources")).switches["nasdaq-news"]?.disabled ?? false, false);
await fs.writeFile(evidence + "/results.json", JSON.stringify({ checks, network }, null, 2));
assert.ok(checks.every(c => c.pass), "來源狀態或執行紀錄未即時更新，詳見 results.json");
console.log("PASS: 導覽列進頁後，停用／恢復與連續手動執行皆即時更新同一頁。");
`;

const child = spawn("ego-browser", ["nodejs"], { stdio: ["pipe", "inherit", "inherit"] });
child.stdin.end(script);
process.exitCode = await new Promise((done) => child.on("exit", done));
