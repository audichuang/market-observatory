import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { latestExpectedClose, latestScheduledClose, PRICES_CRON_UTC_MINUTES } from "../src/lib/calendar.ts";

test("過期警告：抓價排程跑完之前不算當天收盤", () => {
  // 2026-10-26（一）夏令：美東 16:30 已過（UTC 20:30），但排程 UTC 21:40 還沒跑 → 仍是上週五
  assert.equal(latestExpectedClose(new Date("2026-10-26T21:20:00Z")), "2026-10-26");
  assert.equal(latestScheduledClose(new Date("2026-10-26T21:20:00Z")), "2026-10-23");
  // 排程開始後仍在緩衝內 → 還不算
  assert.equal(latestScheduledClose(new Date("2026-10-26T22:09:00Z")), "2026-10-23");
  // 緩衝過了 → 當天
  assert.equal(latestScheduledClose(new Date("2026-10-26T22:10:00Z")), "2026-10-26");
  // 冬令 EST 同樣以 UTC 排程為準
  assert.equal(latestScheduledClose(new Date("2026-11-02T21:50:00Z")), "2026-10-30");
  assert.equal(latestScheduledClose(new Date("2026-11-02T22:10:00Z")), "2026-11-02");
  // 週六整天、週日 → 週五
  assert.equal(latestScheduledClose(new Date("2026-10-24T23:59:00Z")), "2026-10-23");
  assert.equal(latestScheduledClose(new Date("2026-10-25T12:00:00Z")), "2026-10-23");
  // 感恩節休市（11/26 四）：當晚排程過後仍是 11/25
  assert.equal(latestScheduledClose(new Date("2026-11-26T23:00:00Z")), "2026-11-25");
  // 日曆範圍外退回週一到週五
  assert.equal(latestScheduledClose(new Date("2030-01-05T12:00:00Z")), "2030-01-04");
});

test("過期警告：任何時刻都不會比「應有收盤」更晚", () => {
  // 涵蓋 2026 年春、秋兩次夏令時間切換
  for (let t = Date.parse("2026-03-01T00:00:00Z"); t < Date.parse("2026-11-10T00:00:00Z"); t += 10 * 60000) {
    const at = new Date(t);
    assert.ok(latestScheduledClose(at) <= latestExpectedClose(at), at.toISOString());
  }
});

test("抓價排程時刻與 crons/prices.ts 一致", () => {
  const src = readFileSync(new URL("../crons/prices.ts", import.meta.url), "utf8");
  const m = src.match(/export const cron = "(\d+) (\d+) \* \* MON-FRI"/);
  assert.ok(m, "crons/prices.ts 的 cron 格式變了，latestScheduledClose 要跟著檢查");
  assert.equal(Number(m[2]) * 60 + Number(m[1]), PRICES_CRON_UTC_MINUTES);
});

test("排程的星期欄位只用英文縮寫", () => {
  // Cloudflare counts weekdays 1 = Sunday … 7 = Saturday, so "1-5" silently ran Sun–Thu and skipped Friday's close.
  for (const file of readdirSync(new URL("../crons/", import.meta.url)).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(new URL(`../crons/${file}`, import.meta.url), "utf8");
    const dow = src.match(/export const cron = "(?:\S+ ){4}(\S+)"/)?.[1];
    assert.ok(dow, `${file} 找不到 cron`);
    assert.ok(!/\d/.test(dow), `${file} 的星期欄位 ${dow} 要寫成 MON-FRI 這類縮寫`);
  }
});
