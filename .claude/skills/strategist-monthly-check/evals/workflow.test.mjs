import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("套用流程在 fixture 審閱後先啟動網站，再用同一 run-id 啟動 iOS", () => {
  const markdown = readFileSync(new URL("../SKILL.md", import.meta.url), "utf8");
  const section = markdown.slice(markdown.indexOf("## 5."));
  const [prerequisites, ...steps] = section.split(/^\d+\. /m);

  assert.equal(steps.length, 5);
  assert.doesNotMatch(prerequisites, /(?:web|ios)-up\.sh/, "環境前提不應提前啟動服務");
  assert.doesNotMatch(steps.slice(0, 3).join("\n"), /(?:web|ios)-up\.sh/, "先完成測試與 fixture 審閱");

  const launch = steps[3];
  const web = launch.indexOf("web-up.sh <run-id>");
  const ios = launch.indexOf("ios-up.sh <run-id>");
  assert.ok(web >= 0, "步驟 4 須先用 web-up.sh 建立 run-id 目錄與 state.env");
  assert.ok(ios > web, "步驟 4 須在 web-up.sh 之後用同一 run-id 執行 ios-up.sh");
});
