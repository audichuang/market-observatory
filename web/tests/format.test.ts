import assert from "node:assert/strict";
import { test } from "node:test";
import { ppText } from "../src/ui/format.ts";

test("百分點正值保留加號與兩位小數", () => {
  assert.equal(ppText(0.35), "+0.35 個百分點");
});

test("百分點負值使用減號與兩位小數", () => {
  assert.equal(ppText(-1.2), "−1.20 個百分點");
});

test("百分點缺值只顯示破折號", () => {
  assert.equal(ppText(null), "—");
});
