import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MODEL } from "../src/lib/forecast.ts";
import type { PhaseSummary } from "../src/lib/forecast-eval.ts";
import { runJob } from "../src/server/jobs.ts";
import { outlookView } from "../src/server/outlook.ts";
import { getSetting, putSetting } from "../src/server/repo.ts";
import { migratedDb, weekdays } from "./helpers/fake-cloudflare.ts";

test("forecast-phase：寫入與讀取摘要，同資料日與版本略過，日期或版本改變則重算", async (t) => {
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-28T23:00:00Z") });
  t.mock.method(globalThis, "fetch", () => { throw new Error("forecast-phase 不應打外部請求"); });
  const days = weekdays(900, "2026-10-28");
  const insert = sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at) VALUES (?, ?, ?, 'test', 'x')");
  days.forEach((day, i) => {
    insert.run("SPX", day, 1000 + i * 2 + 90 * Math.sin(i / 17));
    insert.run("VIX", day, 24 + 12 * Math.sin(i / 19));
  });
  const first = await runJob(db, "forecast-phase", "test");
  assert.equal(first.status, "ok", first.summary);
  assert.equal(first.detail.subrequests, 0);
  const stored = await getSetting<(PhaseSummary & { computedAt: string }) | null>(db, "forecast-phase-summary", null);
  assert.ok(stored);
  assert.equal(stored.asOf, days.at(-1));
  assert.equal(stored.modelVersion, DEFAULT_MODEL.version);
  assert.equal(stored.computedAt, "2026-10-28T23:00:00.000Z");
  assert.ok(Number.isFinite(stored.dd5?.mean) && Number.isFinite(stored.up?.mean));
  t.mock.timers.tick(60_000);
  const second = await runJob(db, "forecast-phase", "test");
  assert.equal(second.status, "ok");
  assert.equal(second.summary, "已是最新");
  assert.deepEqual(await getSetting(db, "forecast-phase-summary", null), stored);
  const view = await outlookView({ env: { DB: db }, req: { query: () => undefined, url: "http://test/outlook" } });
  assert.deepEqual(view.phaseSummary, stored);

  await putSetting(db, "forecast-phase-summary", { ...stored, modelVersion: "previous-model" });
  const updated = await runJob(db, "forecast-phase", "test");
  assert.equal(updated.status, "ok", updated.summary);
  const next = await getSetting<(PhaseSummary & { computedAt: string }) | null>(db, "forecast-phase-summary", null);
  assert.equal(next?.modelVersion, DEFAULT_MODEL.version);
  assert.equal(next?.computedAt, "2026-10-28T23:01:00.000Z");
  insert.run("SPX", "2026-10-29", 2800);
  insert.run("VIX", "2026-10-29", 20);
  const newDate = await runJob(db, "forecast-phase", "test");
  assert.equal(newDate.status, "ok", newDate.summary);
  const latest = await getSetting<PhaseSummary | null>(db, "forecast-phase-summary", null);
  assert.equal(latest?.asOf, "2026-10-29");
});

test("forecast-phase：空資料庫或 VIX 過期時 status ok，不寫摘要；尚未計算的 view 回 null", async (t) => {
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  for (const seeded of [false, true]) {
    if (seeded) {
      const days = weekdays(900, "2026-10-28");
      const insert = sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at) VALUES (?, ?, ?, 'test', 'x')");
      days.forEach((day, i) => {
        insert.run("SPX", day, 1000 + i);
        if (i < days.length - 8) insert.run("VIX", day, 20);
      });
    }
    const result = await runJob(db, "forecast-phase", "test");
    assert.equal(result.status, "ok", result.summary);
    assert.equal(result.summary, "資料不足，略過");
    assert.equal(result.detail.subrequests, 0);
    assert.equal(await getSetting(db, "forecast-phase-summary", null), null);
    const view = await outlookView({ env: { DB: db }, req: { query: () => undefined, url: "http://test/outlook" } });
    assert.equal(view.phaseSummary, null);
  }
});
