import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "../src/lib/safe-next.ts";

test("站內路徑原樣保留", () => {
  assert.equal(safeNext("/history?symbol=NVDA&months=3"), "/history?symbol=NVDA&months=3");
  assert.equal(safeNext("/etfs#plan"), "/etfs#plan");
});

test("外站或瀏覽器會解讀成外站的寫法一律回首頁", () => {
  for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "/\t/evil.com", "https://evil.com", "evil.com", "", undefined, "/%0a"]) {
    const out = safeNext(bad);
    assert.ok(out === "/" || (out.startsWith("/") && !out.startsWith("//")), `${JSON.stringify(bad)} → ${out}`);
  }
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext("/\t/evil.com"), "/");
});

test("點區段正規化後變成 //host 的寫法不能導去外站", () => {
  const origin = "https://site.example";
  for (const tricky of ["/.//evil.example/path", "/a/..//evil.example", "/%2e//evil.example"]) {
    const out = safeNext(tricky);
    assert.ok(!out.startsWith("//"), `${tricky} → ${out}`);
    assert.equal(new URL(out, origin).origin, origin, `${tricky} → ${out}`);
  }
});
