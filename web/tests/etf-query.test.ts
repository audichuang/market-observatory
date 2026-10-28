import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PLAN, PlanSchema, etfsView } from "../src/server/views.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

test("資金類型只影響呈現，同一使用者切換時定投數字不變", async () => {
  const { db, sql } = await migratedDb();
  try {
    const price = sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at) VALUES (?, ?, ?, 'test', '2040-02-02')");
    for (const [i, date] of ["2037-02-02", "2040-01-16", "2040-02-02"].entries()) {
      for (const symbol of ["SPX", "VOO", "USDTWD"]) price.run(symbol, date, symbol === "USDTWD" ? 31 : 100 + i * 20);
    }
    const viewer = { id: "funding-query", email: "etf@example.test", name: "", isOwner: false };
    const results = [];
    for (const funding of [undefined, "lump", "xyz"]) {
      const query = new URLSearchParams(funding ? { funding } : {});
      results.push(await etfsView({ env: { DB: db }, req: { query: (key) => query.get(key) ?? undefined, url: `http://localhost/etfs?${query}` } }, viewer));
    }
    assert.ok(results[0].dca, "合成價格須產生實際試算，避免只比對 null");
    assert.deepEqual(results.map((data) => data.funding), ["monthly", "lump", "monthly"]);
    assert.deepEqual(results[1].dca, results[0].dca);
    assert.deepEqual(results[2].dca, results[0].dca);
  } finally {
    sql.close();
  }
});

test("小數定投查詢取整後可以儲存成預設", async () => {
  const { db, sql } = await migratedDb();
  try {
    const queries = new URLSearchParams({ monthly: "1500.5" });
    const data = await etfsView({
      env: { DB: db },
      req: { query: (key) => queries.get(key) ?? undefined, url: `http://localhost/etfs?${queries}` },
    }, { id: "etf-query", email: "etf@example.test", name: "", isOwner: false });
    assert.equal(data.sim.monthlyTwd, 1501);
    assert.equal(PlanSchema.safeParse({ ...DEFAULT_PLAN, monthlyTwd: data.sim.monthlyTwd }).success, true);
  } finally {
    sql.close();
  }
});

test("小於一元的正月額取整後至少一元", async () => {
  const { db, sql } = await migratedDb();
  try {
    for (const monthly of ["0.4", "0.49", "0.5", "0.99"]) {
      const data = await etfsView({ env: { DB: db }, req: { query: (key) => key === "monthly" ? monthly : undefined, url: `http://localhost/etfs?monthly=${monthly}` } }, { id: "minimum-monthly", email: "etf@example.test", name: "", isOwner: false });
      assert.equal(data.sim.monthlyTwd, 1, monthly);
      assert.equal(PlanSchema.safeParse({ ...DEFAULT_PLAN, monthlyTwd: data.sim.monthlyTwd }).success, true);
    }
  } finally {
    sql.close();
  }
});

test("舊規劃的零月額讀成預設月額，其他規劃欄位保留且不改寫儲存資料", async () => {
  const { db, sql } = await migratedDb();
  const stored = { ...DEFAULT_PLAN, monthlyTwd: 0, researchBudgetTwd: 0, trancheTwd: 0, notes: "保留既有備註" };
  try {
    sql.prepare("INSERT INTO settings (key, value) VALUES ('plan:legacy-zero', ?)").run(JSON.stringify(stored));
    const data = await etfsView({ env: { DB: db }, req: { query: () => undefined, url: "http://localhost/etfs" } }, { id: "legacy-zero", email: "etf@example.test", name: "", isOwner: false });
    assert.deepEqual(data.plan, { ...stored, monthlyTwd: DEFAULT_PLAN.monthlyTwd });
    assert.equal(data.sim.monthlyTwd, DEFAULT_PLAN.monthlyTwd);
    assert.equal(PlanSchema.safeParse(data.plan).success, true);
    assert.deepEqual(JSON.parse((sql.prepare("SELECT value FROM settings WHERE key = 'plan:legacy-zero'").get() as { value: string }).value), stored);
  } finally {
    sql.close();
  }
});
