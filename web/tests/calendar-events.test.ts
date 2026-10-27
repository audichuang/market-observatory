import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, easternDate, isNyseSession, MACRO_EVENTS, macroEventsSummary, NYSE_CALENDAR } from "../src/lib/calendar.ts";
import { eventReminder } from "../src/lib/push.ts";

const byId = new Map(MACRO_EVENTS.map((e) => [e.id, e]));

test("總經事件：BLS 官方日程的 CPI 與非農都在，日期與來源正確", () => {
  const cpi = byId.get("cpi-2026-11-10")!;
  assert.equal(cpi.title, "CPI 消費者物價指數（2026 年 10 月）");
  assert.equal(cpi.sourceUrl, "https://www.bls.gov/schedule/news_release/cpi.htm");
  assert.equal(cpi.status, "scheduled");
  assert.equal(byId.get("cpi-2027-01-13")!.title, "CPI 消費者物價指數（2026 年 12 月）");
  assert.equal(byId.get("cpi-2027-12-10")!.title, "CPI 消費者物價指數（2027 年 11 月）");
  const nfp = byId.get("nfp-2026-11-06")!;
  assert.equal(nfp.title, "非農就業報告（2026 年 10 月）");
  assert.equal(nfp.sourceUrl, "https://www.bls.gov/schedule/news_release/empsit.htm");
  assert.ok(byId.has("nfp-2027-04-02"));
  assert.ok(byId.has("nfp-2027-12-03"));
});

test("總經事件：id 不重複、都落在開市日、依日期排序；非農都是週五", () => {
  assert.equal(byId.size, MACRO_EVENTS.length);
  for (const e of MACRO_EVENTS) assert.equal(isNyseSession(e.date), true, e.id);
  assert.deepEqual(MACRO_EVENTS.map((e) => e.date), [...MACRO_EVENTS.map((e) => e.date)].sort());
  for (const e of MACRO_EVENTS.filter((x) => x.id.startsWith("nfp-"))) assert.equal(new Date(`${e.date}T12:00:00Z`).getUTCDay(), 5, e.id);
  // BLS does not mark any of these dates tentative.
  assert.equal(MACRO_EVENTS.filter((e) => !e.id.startsWith("fomc-") && e.status !== "scheduled").length, 0);
});

test("排程摘要不再把全部總經事件叫 FOMC", () => {
  assert.equal(macroEventsSummary(), "總經事件 44 筆（FOMC 16、CPI 14、非農 14）");
});

test("事件推播：CPI 與非農照標題列出，不會被誤標盤前盤後", () => {
  const rows = MACRO_EVENTS.filter((e) => e.date === "2026-11-10" || e.date === "2026-11-06").map((e) => ({ ...e, kind: "macro", symbol: null }));
  assert.equal(eventReminder("2026-11-10", rows, [])!.body, "CPI 消費者物價指數（2026 年 10 月）");
  assert.equal(eventReminder("2026-11-06", rows, [])!.body, "非農就業報告（2026 年 10 月）");
});

test("日曆還要覆蓋至少 180 天：NYSE 休市日與總經事件都不能快到期", () => {
  const need = addDays(easternDate(), 180);
  const hint = "去 NYSE 官網補 2028 休市日與 FOMC/CPI/非農日程";
  assert.ok(NYSE_CALENDAR.coverageEnd >= need, `NYSE_CALENDAR.coverageEnd ${NYSE_CALENDAR.coverageEnd} < ${need}：${hint}`);
  const lastEvent = MACRO_EVENTS.reduce((m, e) => (e.date > m ? e.date : m), "");
  assert.ok(lastEvent >= need, `MACRO_EVENTS 最後一筆 ${lastEvent} < ${need}：${hint}`);
});
