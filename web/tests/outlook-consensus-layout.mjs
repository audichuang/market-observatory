// Repro: cd web && node tests/outlook-consensus-layout.mjs <evidence-directory>
// Requires ego-browser. Render the actual page and stylesheet, without network data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "oxc-transform-react";
import { aggregateConsensus } from "../src/lib/consensus.ts";

registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith(".tsx")) return nextLoad(url, context);
    const result = transformSync(new URL(url).pathname, readFileSync(new URL(url), "utf8"), {
      reactCompiler: false, jsx: { runtime: "automatic" },
    });
    assert.deepEqual(result.errors, []);
    return { format: "module", source: result.code, shortCircuit: true };
  },
});
const { default: OutlookPage } = await import("../pages/outlook.tsx");
const evidence = resolve(process.argv[2]);
mkdirSync(evidence, { recursive: true });
const symbols = ["NVDA", "MSFT", "AAPL", "AMZN", "META", "AVGO", "GOOGL", "GOOG", "BRK-B", "LLY", "JPM", "WMT"];
const rows = symbols.map((symbol, i) => ({
  symbol, asOf: "2026-10-28", price: i === 8 ? 1086 : 100, priceDate: "2026-10-27",
  targetMean: 120, targetLow: 90, targetHigh: 150, buy: 40, hold: 20, sell: 4,
  epsUp: i === 1 ? 0 : 12, epsDown: i === 1 ? 0 : 2,
  fiscalEnd: "Jan 2027", estimates: 64, weightPct: 6 - i / 4,
}));
const weights = new Map(rows.map((v) => [v.symbol, v.weightPct]));
const css = readFileSync(new URL("../src/ui/styles.css", import.meta.url), "utf8");
const server = createServer((req, res) => {
  const top = rows.map((v, i) => req.url === "/missing" && i === 8 ? {
    ...v, targetMean: null, targetLow: null, targetHigh: null,
    buy: 0, hold: 0, sell: 0, epsUp: null, epsDown: null, fiscalEnd: null, estimates: null,
  } : v).map((v) => ({ ...v, upsidePct: v.targetMean === null ? null : (v.targetMean / v.price - 1) * 100 }));
  const consensus = { ...aggregateConsensus(top, weights, "2026-10-28"), top, weightsAsOf: "2026-10-27" };
  const markup = renderToStaticMarkup(createElement(OutlookPage, {
    outlook: null, cells: [], liveTrack: { n: 0 }, liveTrackDd5: { groups: [], delayed: 0, unknown: 0 }, recent: [], factset: [], strategists: null, horizon: 21, consensus,
  }));
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html lang="zh-Hant-TW"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><main>${markup}</main></html>`);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const script = `
const { default: assert } = await import("node:assert/strict");
const fs = await import("node:fs/promises");
const task = await taskSpace("mo-verify-fx-u1-20261029");
console.log({ spaceId: task.spaceId });
const page = task.page("p1");
const results = [];
for (const scenario of ["complete", "missing"]) {
  await page.goto(${JSON.stringify(base)} + "/" + scenario);
  for (const width of [1280, 1100, 1024, 960, 768, 728, 720, 390]) {
    await page.cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    const metrics = await page.evaluate(() => {
      const panel = [...document.querySelectorAll(".panel")].find(p => p.querySelector("h2")?.textContent === "成分股分析師共識");
      panel.scrollIntoView();
      const wrap = panel.querySelector(".table-wrap");
      const eps = [...wrap.querySelectorAll("tr")].map(tr => tr.lastElementChild);
      return { clientWidth: wrap.clientWidth, scrollWidth: wrap.scrollWidth, scrollLeft: wrap.scrollLeft,
        pageClientWidth: document.documentElement.clientWidth, pageScrollWidth: document.documentElement.scrollWidth,
        epsVisible: eps.every(cell => getComputedStyle(cell).display !== "none"),
        epsInside: eps.every(cell => cell.getBoundingClientRect().right <= wrap.getBoundingClientRect().right + 1),
        rows: wrap.querySelectorAll("tbody tr").length };
    });
    const result = { scenario, width, ...metrics };
    results.push(result);
    console.log(result);
    await page.screenshot({ path: ${JSON.stringify(evidence)} + "/" + scenario + "-" + width + ".png" });
  }
}
await page.cdp("Emulation.clearDeviceMetricsOverride");
await fs.writeFile(${JSON.stringify(evidence)} + "/metrics.json", JSON.stringify(results, null, 2));
for (const result of results) {
  assert.equal(result.rows, 12);
  assert.equal(result.scrollLeft, 0);
  assert.equal(result.scrollWidth, result.clientWidth, JSON.stringify(result));
  assert.ok(result.pageScrollWidth <= result.pageClientWidth, JSON.stringify(result));
  assert.equal(result.epsVisible, result.width > 390, JSON.stringify(result));
  if (result.epsVisible) assert.equal(result.epsInside, true, JSON.stringify(result));
}
console.log("PASS: 共識表在 1280／1100／1024／960／768／728／720／390 不溢出，390 隱藏 EPS 欄，含 Nasdaq 無資料列。");
`;
try {
  const child = spawn("ego-browser", ["nodejs"], { stdio: ["pipe", "inherit", "inherit"] });
  child.stdin.end(script);
  process.exitCode = await new Promise((done) => child.on("exit", done));
} finally {
  server.close();
}
