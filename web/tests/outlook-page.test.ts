import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "oxc-transform-react";
import { outlookView } from "../src/server/outlook.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

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

test("樣本太少時，格線說明從第一筆即時發布的紀錄起算", async (t) => {
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  const props = await outlookView({ env: { DB: db }, req: { query: () => undefined, url: "http://test.local/outlook" } });
  const html = renderToStaticMarkup(createElement(OutlookPage, {
    ...props, liveTrack: { ...props.liveTrack, n: 1, tooFew: true },
  }));
  assert.match(html, /樣本太少/);
  assert.match(html, /從第一筆即時發布的紀錄起每 21 個交易日一列/);
  assert.doesNotMatch(html, /從第一筆紀錄起/);
});
