import assert from "node:assert/strict";
import { test } from "node:test";
import { upsertBars } from "../src/server/repo.ts";

// 最小的 D1 替身：只實作 upsertBars 用到的 SELECT 與 INSERT。
function fakeDb() {
  const store = new Map<string, number>();
  const db = {
    prepare(sql: string) {
      return {
        bind: (...a: unknown[]) => ({
          sql,
          a,
          all: async () => {
            const minDate = a.at(-1) as string;
            const syms = a.slice(0, -1) as string[];
            return {
              results: [...store]
                .map(([k, close]) => ({ symbol: k.split("|")[0], date: k.split("|")[1], close }))
                .filter((r) => syms.includes(r.symbol) && r.date >= minDate),
            };
          },
        }),
      };
    },
    batch: async (stmts: { a: unknown[] }[]) => {
      for (const s of stmts) store.set(`${s.a[0]}|${s.a[1]}`, s.a[5] as number);
    },
  };
  return { db: db as unknown as D1Database, store };
}

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString().slice(0, 10);
const bar = (i: number, close: number) => ({ date: day(i), open: close, high: close, low: close, close, volume: 1 });

test("偵測到分割時，一個月的新基準先不寫；歷史沒補好之前，下一輪仍偵測得到", async () => {
  const { db, store } = fakeDb();
  for (let i = 0; i < 100; i++) store.set(`X|${day(i)}`, 100);
  const month = (from: number) => [{ symbol: "X", source: "y", bars: Array.from({ length: 26 }, (_, k) => bar(from + k, 50)) }];

  const run1 = await upsertBars(db, month(75));
  assert.deepEqual(Object.keys(run1.rebased), ["X"]);
  assert.equal(store.get(`X|${day(80)}`), 100, "沒有重抓完整歷史前，不寫入新基準");
  // 假設十年重抓失敗：什麼都沒寫。下一輪必須再偵測到。
  const run2 = await upsertBars(db, month(76));
  assert.deepEqual(Object.keys(run2.rebased), ["X"]);
});

test("重抓完整歷史時允許改寫，整段換成新基準", async () => {
  const { db, store } = fakeDb();
  for (let i = 0; i < 100; i++) store.set(`X|${day(i)}`, 100);
  const full = [{ symbol: "X", source: "y", bars: Array.from({ length: 101 }, (_, k) => bar(k, 50)) }];
  const res = await upsertBars(db, full, { allowRebase: true });
  assert.equal(store.get(`X|${day(0)}`), 50);
  assert.equal(res.changed.X, 101);
});
