import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PLAN, PlanSchema, etfsView } from "../src/server/views.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

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
