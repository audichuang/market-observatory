import assert from "node:assert/strict";
import { test } from "node:test";
import { ETFS } from "../src/lib/universe.ts";
import { etfsView } from "../src/server/views.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

function isValidIsin(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return false;
  const digits = isin.slice(0, 11).split("").map((c) => {
    const code = c.charCodeAt(0);
    return code >= 65 && code <= 90 ? String(code - 55) : c;
  }).join("");
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isin[11]);
}

test("ETFS 每檔 facts 存在、domicile 非空、sourceUrl 以 https:// 開頭、checkedAt 為合法 ISO 日期", () => {
  assert.equal(ETFS.length, 11);
  for (const etf of ETFS) {
    const facts = (etf as any).facts;
    assert.ok(facts, `${etf.ticker} facts 必須存在`);
    assert.ok(typeof facts.domicile === "string" && facts.domicile.length > 0, `${etf.ticker} domicile 必須非空`);
    assert.ok(typeof facts.sourceUrl === "string" && facts.sourceUrl.startsWith("https://"), `${etf.ticker} sourceUrl 必須以 https:// 開頭`);
    assert.ok(!isNaN(Date.parse(facts.checkedAt)), `${etf.ticker} checkedAt 必須為合法 ISO 日期`);
  }
});

test("isin 為 null，或符合 ^[A-Z]{2}[A-Z0-9]{9}\\d$ 且 ISIN 檢查碼（字母轉數字後 Luhn）正確", () => {
  for (const etf of ETFS) {
    const isin = (etf as any).facts?.isin;
    if (isin !== null && isin !== undefined) {
      assert.ok(typeof isin === "string", `${etf.ticker} isin 必須為 string 或 null`);
      assert.ok(isValidIsin(isin), `${etf.ticker} isin ${isin} 格式或檢查碼不正確`);
    }
  }
});

test("非 null 的 isin 不重複", () => {
  const isins = ETFS.map((e) => (e as any).facts?.isin).filter((isin): isin is string => isin !== null && isin !== undefined);
  const unique = new Set(isins);
  assert.equal(unique.size, isins.length, "非 null 的 isin 不得重複");
});

test("etfsView 回傳每列 facts 與 ETFS 同代號那列 deepEqual", async () => {
  const { db, sql } = await migratedDb();
  try {
    const viewer = { id: "facts-viewer", email: "facts@example.test", name: "", isOwner: false };
    const res = await etfsView({ env: { DB: db }, req: { query: () => undefined, url: "http://localhost/etfs" } }, viewer);
    assert.equal(res.rows.length, ETFS.length);
    for (const row of res.rows) {
      const source = ETFS.find((e) => e.ticker === row.ticker);
      assert.ok(source);
      assert.ok((row as any).facts, `${row.ticker} 在 etfsView 中缺少 facts`);
      assert.deepEqual((row as any).facts, (source as any).facts);
    }
  } finally {
    sql.close();
  }
});
