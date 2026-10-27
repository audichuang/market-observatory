import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_WATCHLIST } from "../src/lib/universe.ts";
import { viewerWatchlist } from "../src/server/account.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

const viewer = { id: "u1", email: "u1@example.test", name: "", isOwner: false };

async function observedDb() {
  const { db, sql } = await migratedDb();
  const queries: string[] = [];
  const observed = {
    prepare(q: string) { queries.push(q); return db.prepare(q); },
    batch: db.batch.bind(db),
  };
  return { db: observed, sql, queries };
}

for (const [label, value, expected] of [
  ["合法名單", JSON.stringify(DEFAULT_WATCHLIST.slice(0, 2)), DEFAULT_WATCHLIST.slice(0, 2)],
  ["空名單", "[]", []],
  ["壞掉的 JSON", "{broken", DEFAULT_WATCHLIST],
  ["合法 JSON 但內容不是名單", '{"unexpected":true}', DEFAULT_WATCHLIST],
  ["JSON null", "null", DEFAULT_WATCHLIST],
] as const) {
  test(`viewerWatchlist：已有${label}只讀一列、不初始化或重算`, async () => {
    const { db, sql, queries } = await observedDb();
    sql.prepare("INSERT INTO settings (key, value) VALUES ('watchlist:u1', ?)").run(value);
    const result = await viewerWatchlist(db, viewer);
    assert.deepEqual(result, { key: "watchlist:u1", members: expected, needsRebuild: false });
    assert.deepEqual(queries, ["SELECT value FROM settings WHERE key = ?"], "存在但壞掉的內容也不能觸發 ensureWatchlist");
    assert.equal((sql.prepare("SELECT value FROM settings WHERE key = 'watchlist:u1'").get() as { value: string }).value, value);
  });
}

test("viewerWatchlist：站長尚無名單只讀一次，仍回預設且不建立設定", async () => {
  const { db, sql, queries } = await observedDb();
  assert.deepEqual(await viewerWatchlist(db, { ...viewer, isOwner: true }), { key: "watchlist", members: DEFAULT_WATCHLIST, needsRebuild: false });
  assert.deepEqual(queries, ["SELECT value FROM settings WHERE key = ?"]);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM settings").get() as { n: number }).n, 0);
});
