// Repro: sign in to a local test account in ego-browser, then run:
// cd web && node tests/research-navigation.mjs http://localhost:5198 <evidence-directory>
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const base = new URL(process.argv[2]);
assert.equal(base.hostname, "localhost", "Only run against the local test instance");
const evidence = resolve(process.argv[3]);
mkdirSync(evidence, { recursive: true });

const script = `
const { default: assert } = await import("node:assert/strict");
const fs = await import("node:fs/promises");
const task = await taskSpace("mo-verify-l6t5-review-20261028");
const page = task.page("p1");
const results = [];
for (const entry of ["select", "table"]) {
  await page.goto(${JSON.stringify(base.origin)} + "/history?symbol=NVDA&months=12");
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find(b => b.textContent === "複製範本");
    return b && Object.keys(b).some(k => k.startsWith("__reactFiber"));
  });
  // Keep clipboard permission/focus outside this navigation regression.
  await page.evaluate(() => {
    window.__researchNavigationDocument = "same-document";
    let copied = "";
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async text => { copied = text; },
      readText: async () => copied,
    } });
  });
  await page.click('summary:text-is("研究表範本（7 題）")', { label: "展開 NVIDIA 研究表" });
  await page.click('button:text-is("複製範本")', { label: "複製 NVIDIA 研究表" });
  await page.waitForSelector('[role=status]:text-is("已複製，可貼到你自己的筆記保存")');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /^NVIDIA（NVDA）研究表 /);
  await page.screenshot({ path: ${JSON.stringify(evidence)} + "/" + entry + "-before.png" });

  if (entry === "select") await page.selectOption("select", "AAPL");
  else await page.click('table a[href="/history?symbol=AAPL&months=12"]', { label: "從表格切換 Apple" });
  await page.waitForFunction(() =>
    new URL(location.href).searchParams.get("symbol") === "AAPL" &&
    [...document.querySelectorAll("a")].some(a => a.textContent === "SEC EDGAR 申報清單" && a.href.includes("CIK=AAPL&"))
  );
  const state = await page.evaluate(async () => {
    const panel = [...document.querySelectorAll(".panel")].find(p => p.querySelector("h2")?.textContent === "研究表與原始資料");
    panel.scrollIntoView({ block: "center" });
    return {
      status: panel.querySelector('[role=status]')?.textContent ?? null,
      open: panel.querySelector("details").open,
      sameDocument: window.__researchNavigationDocument === "same-document",
      clipboard: await navigator.clipboard.readText(),
    };
  });
  await page.screenshot({ path: ${JSON.stringify(evidence)} + "/" + entry + "-after.png" });
  results.push({ entry, ...state, clipboardUnchanged: state.clipboard === copied });

  // The new symbol can still be expanded and copied independently.
  if (!state.open) await page.click('summary:text-is("研究表範本（7 題）")', { label: "展開 Apple 研究表" });
  await page.click('button:text-is("複製範本")', { label: "複製 Apple 研究表" });
  await page.waitForFunction(async () => (await navigator.clipboard.readText()).startsWith("Apple（AAPL）研究表 "));
  assert.equal(await page.evaluate(() => document.querySelector('[role=status]').textContent), "已複製，可貼到你自己的筆記保存");
}
await fs.writeFile(${JSON.stringify(evidence)} + "/results.json", JSON.stringify(results, null, 2));
console.log(results.map(({ clipboard, ...result }) => ({ ...result, clipboardFirstLine: clipboard.split("\\n")[0] })));
assert.deepEqual(results.map(({ entry, status, open, sameDocument, clipboardUnchanged }) =>
  ({ entry, status, open, sameDocument, clipboardUnchanged })),
  ["select", "table"].map(entry => ({ entry, status: null, open: false, sameDocument: true, clipboardUnchanged: true })));
console.log("PASS: 下拉選單與表格連結切換標的後，複製提示清除、範本收合，且新標的可重新複製。");
`;

const child = spawn("ego-browser", ["nodejs"], { stdio: ["pipe", "inherit", "inherit"] });
child.stdin.end(script);
process.exitCode = await new Promise((done) => child.on("exit", done));
