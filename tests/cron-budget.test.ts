// 名單加到上限（12 家、15 個代號）以後，每支排程在一次執行裡打出去的外部請求都不能超過 Cloudflare 免費方案的 50 個。
// 用 tests/helpers/fake-cloudflare.ts 模擬 D1 與外部網路：超過 50 個就跟 Cloudflare 一樣丟錯。
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { CALENDAR_BRK_DATE, FakeUpstream, migratedDb, weekdays } from "./helpers/fake-cloudflare.ts";
import { MAX_WATCH } from "../src/lib/watchlist.ts";

const upstream = new FakeUpstream();
let restore: () => void;
before(() => {
  restore = upstream.install();
});
after(() => restore());

// 名單上限時代號最多的組合：三家有兩個股類（Alphabet、Fox、News Corp）。
const ADDS = ["AVGO", "BRK-B", "FOXA", "NWSA", "LLY"];
const NAMED: [string, string][] = [
  ["NVDA", "NVIDIA CORP"], ["AAPL", "APPLE INC"], ["MSFT", "MICROSOFT CORP"], ["AMZN", "AMAZON.COM INC"],
  ["GOOGL", "ALPHABET INC CL A"], ["GOOG", "ALPHABET INC CL C"], ["META", "META PLATFORMS INC CLASS A"], ["TSLA", "TESLA INC"],
  ["AVGO", "BROADCOM INC"], ["BRK-B", "BERKSHIRE HATHAWAY INC CL B"], ["LLY", "ELI LILLY + CO"],
  ["FOXA", "FOX CORP CLASS A"], ["FOX", "FOX CORP CLASS B"], ["NWSA", "NEWS CORP CLASS A"], ["NWS", "NEWS CORP CLASS B"],
];

async function seededDb() {
  const { db, sql } = await migratedDb();
  // 最新一份 SPY 持股：15 個名單代號＋ 488 個填充成分股（分析師輪替會用到前 200 檔）。
  const asOf = weekdays(2)[0];
  const ins = sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, shares, fetched_at) VALUES (?, ?, ?, ?, 1, 'x')");
  NAMED.forEach(([t, n], i) => ins.run(asOf, t, n, 7 - i * 0.3));
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < 488; i++) ins.run(asOf, `Q${letters[Math.floor(i / 26) % 26]}${letters[i % 26]}`, `FILLER ${i} INC`, 0.1 - i * 0.0001);
  return { db, sql };
}

type Run = { job: string; status: string; summary: string; detail: string };

/** 跑一次排程（＝一次 Cloudflare 執行），回傳這次寫進 runs 的紀錄與實際打出去的請求數。 */
async function invokeCron(file: string, db: D1Database, sql: { prepare: (q: string) => { all: (...a: never[]) => unknown[]; get: (...a: never[]) => unknown } }) {
  const mod = (await import(`../crons/${file}.ts`)) as { default: (c: unknown, env: unknown, ctx: unknown) => Promise<void> };
  const lastId = ((sql.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM runs").get() as { m: number }).m);
  upstream.reset();
  await mod.default({ cron: file, scheduledTime: Date.now() }, { DB: db }, { waitUntil() {} });
  const runs = sql.prepare(`SELECT job, status, summary, detail FROM runs WHERE id > ${lastId} ORDER BY id`).all() as Run[];
  return { runs, requests: upstream.count, maxInFlight: upstream.maxInFlight, overLimit: upstream.overLimit, hosts: { ...upstream.hosts } };
}

function assertWithinLimit(name: string, r: Awaited<ReturnType<typeof invokeCron>>) {
  assert.equal(r.overLimit, 0, `${name}：超過 50 個請求（實際 ${r.requests}）`);
  assert.ok(r.requests <= 48, `${name}：用了 ${r.requests} 個請求，超過預留餘裕的 48`);
  // Cloudflare 一次最多 6 個連線同時等回應；超過會排隊，這裡要求程式自己就不超過。
  assert.ok(r.maxInFlight <= 6, `${name}：同時 ${r.maxInFlight} 個請求`);
  // 每個請求都有被額度記到：runs 裡各工作記的用量加起來要等於實際打出去的數量（漏傳 budget 的抓取會讓這裡對不上）。
  const recorded = r.runs.reduce((a, x) => a + (JSON.parse(x.detail).subrequests as number), 0);
  assert.equal(recorded, r.requests, `${name}：額度記到 ${recorded} 個，實際打了 ${r.requests} 個 ${JSON.stringify(r.hosts)}`);
}

test("名單從 7 家加到 12 家：每次加入都在請求上限內，第 13 家被擋下", async (t) => {
  const { db } = await seededDb();
  const { addWatchSymbol } = await import("../src/server/jobs.ts");
  const { loadWatchlist } = await import("../src/server/watchlist.ts");
  for (const s of ADDS) {
    upstream.reset();
    const res = await addWatchSymbol(db, s);
    assert.ok(res.ok, `${s}: ${JSON.stringify(res)}`);
    assert.ok(upstream.count <= 4 && upstream.overLimit === 0, `${s} 用了 ${upstream.count} 個請求`);
    t.diagnostic(`加入 ${s}：${upstream.count} 個請求`);
  }
  const list = await loadWatchlist(db);
  assert.equal(list.length, MAX_WATCH);
  assert.equal(list.flatMap((m) => m.tickers).length, 15);
  upstream.reset();
  const full = await addWatchSymbol(db, "QAA");
  assert.ok(!full.ok && /最多 12 家/.test(full.error));
  assert.equal(upstream.count, 0, "名單滿了不該再打任何請求");
});

async function fullListDb() {
  const { db, sql } = await seededDb();
  const { addWatchSymbol } = await import("../src/server/jobs.ts");
  for (const s of ADDS) {
    upstream.reset();
    assert.ok((await addWatchSymbol(db, s)).ok);
  }
  return { db, sql };
}

test("名單滿 12 家時，五支排程各自一次執行都不超過請求上限、工作都成功", async (t) => {
  const { db, sql } = await fullListDb();
  for (const file of ["daily-reference", "prices", "crosscheck", "retry", "news"]) {
    const r = await invokeCron(file, db, sql);
    assertWithinLimit(file, r);
    t.diagnostic(`${file}：${r.requests} 個請求，同時最多 ${r.maxInFlight} 個；${r.runs.map((x) => `${x.job}=${x.status}`).join("、")}`);
    for (const run of r.runs) {
      // weights（SSGA xlsx）與 factset（PDF）在假網路裡刻意回壞資料，只看請求數；其餘工作要成功。
      if (run.job === "weights" || run.job === "factset") continue;
      assert.equal(run.status, "ok", `${file}/${run.job}: ${run.summary}`);
    }
  }
  // 新聞一家一個請求（直接打 www.nasdaq.com，不經過 301 轉址）；Cboe 兩個檔各一個請求。
  const runs = sql.prepare("SELECT job, detail FROM runs").all() as { job: string; detail: string }[];
  const newsRun = runs.filter((x) => x.job === "news").at(-1)!;
  assert.equal(JSON.parse(newsRun.detail).subrequests, 13);
  const pricesRun = runs.filter((x) => x.job === "prices").at(-1)!;
  assert.equal(JSON.parse(pricesRun.detail).subrequests, 4, "spark 2 ＋ Cboe 2");
  // 股類代號（BRK-B）在 Nasdaq 要寫成 BRK.B：核對、新聞、財報日都要查得到。
  const brk = sql.prepare("SELECT date, status FROM events WHERE kind = 'earnings' AND symbol = 'BRK-B'").get() as { date: string; status: string } | undefined;
  assert.deepEqual(brk && [brk.date, brk.status], [CALENDAR_BRK_DATE, "confirmed"]);
  const brkCheck = sql.prepare("SELECT COUNT(*) AS n FROM prices WHERE symbol = 'BRK-B' AND check_status = 'match'").get() as { n: number };
  assert.ok(brkCheck.n > 0, "BRK-B 沒有被 Nasdaq 核對到");
  // 01:10 那支：收盤＋核對在同一次執行，核對 27 檔要全部做完，不再因額度略過 ETF。
  const retry = sql.prepare("SELECT summary FROM runs WHERE job = 'crosscheck' ORDER BY id DESC LIMIT 1").get() as { summary: string };
  assert.ok(!retry.summary.includes("略過"), retry.summary);
});

test("Yahoo spark 整個掛掉時改逐檔補抓，仍不超過上限；01:10 的核對只用剩下的額度", async () => {
  const { db, sql } = await fullListDb();
  upstream.rules = [(u) => (u.pathname.startsWith("/v7/finance/spark") ? new Response("down", { status: 500 }) : null)];
  try {
    const prices = await invokeCron("prices", db, sql);
    assertWithinLimit("prices（spark 掛掉）", prices);
    const p = prices.runs[0];
    assert.equal(p.status, "ok", p.summary);
    assert.equal(JSON.parse(p.detail).fallback.length, 29, "29 檔都要改逐檔補抓");
    const retry = await invokeCron("retry", db, sql);
    assertWithinLimit("retry（spark 掛掉）", retry);
    const cc = retry.runs.find((x) => x.job === "crosscheck")!;
    assert.equal(cc.status, "partial");
    assert.match(cc.summary, /請求額度不足、這次略過/);
    // 略過的是排在最後的那一段（名單個股在前、ETF 在後），而且核對的檔數＝剩下的額度扣掉重試保留。
    const { nasdaqCheckSymbols } = await import("../src/lib/universe.ts");
    const { loadWatchlist } = await import("../src/server/watchlist.ts");
    const order = nasdaqCheckSymbols(await loadWatchlist(db)).map((x) => x.symbol);
    const skipped = JSON.parse(cc.detail).skipped as string[];
    assert.deepEqual(skipped, order.slice(order.length - skipped.length), "略過的應該是清單尾端");
    const pricesUsed = JSON.parse(retry.runs[0].detail).subrequests as number;
    assert.equal(order.length - skipped.length, 48 - pricesUsed - 2);
  } finally {
    upstream.rules = [];
  }
  // spark 恢復後，傍晚那支單獨的核對排程把全部 27 檔補齊。
  const later = await invokeCron("crosscheck", db, sql);
  assertWithinLimit("crosscheck（隔天）", later);
  assert.equal(later.runs[0].status, "ok", later.runs[0].summary);
});

test("Nasdaq 每個網址第一次都回 429：重試會用掉額度，但不會超過上限", async () => {
  const { db, sql } = await fullListDb();
  upstream.rules = [(u, n) => (u.host === "api.nasdaq.com" && n === 1 ? new Response("slow down", { status: 429, headers: { "retry-after": "0" } }) : null)];
  try {
    const cc = await invokeCron("crosscheck", db, sql);
    assertWithinLimit("crosscheck（429）", cc);
    const news = await invokeCron("news", db, sql);
    assertWithinLimit("news（429）", news);
  } finally {
    upstream.rules = [];
  }
});

test("名單上每一檔同時偵測到分割：重抓十年歷史也在上限內，抓不完的留在待修清單", async () => {
  const { db, sql } = await fullListDb();
  const { yahooSymbols } = await import("../src/lib/universe.ts");
  const { loadWatchlist } = await import("../src/server/watchlist.ts");
  const all = Object.keys(yahooSymbols(await loadWatchlist(db)));
  sql.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('pending_rebase', ?, 'x')").run(JSON.stringify(Object.fromEntries(all.map((s) => [s, 2]))));
  const r = await invokeCron("retry", db, sql);
  assertWithinLimit("retry（全部待修）", r);
  // 上一輪留下的待修代號（這一輪沒有重新偵測到）也要能寫出摘要，不能讓整個工作失敗。
  assert.equal(r.runs[0].status, "ok", r.runs[0].summary);
  const pending = JSON.parse((sql.prepare("SELECT value FROM settings WHERE key = 'pending_rebase'").get() as { value: string }).value);
  assert.deepEqual(pending, {}, "29 檔都重抓成功，待修清單應清空");
});

test("額度很緊時：spark 掛掉的逐檔補抓與分割重抓都讓出 Cboe 的 2 個，其餘明確記成額度不足", async () => {
  const { db, sql } = await fullListDb();
  const { runJob } = await import("../src/server/jobs.ts");
  const { Budget } = await import("../src/lib/sources/http.ts");
  upstream.rules = [(u) => (u.pathname.startsWith("/v7/finance/spark") ? new Response("down", { status: 500 }) : null)];
  try {
    upstream.reset();
    const r = await runJob(db, "prices", "test", {}, new Budget(10));
    const failed = r.detail.failed as Record<string, string>;
    // 2 個 spark ＋ 6 個逐檔補抓 ＋ VIX、SPX
    assert.equal(upstream.count, 10);
    assert.ok(!("VIX" in failed), JSON.stringify(failed));
    assert.ok(!r.detail.spxCheck, String(r.detail.spxCheck));
    assert.equal(Object.values(failed).filter((m) => m.includes("請求額度不足")).length, 29 - 6);
  } finally {
    upstream.rules = [];
  }
  // 全部偵測到分割、額度只剩 6 個：先重抓 6 檔，其餘留在待修清單、標明額度不足。
  const { yahooSymbols } = await import("../src/lib/universe.ts");
  const { loadWatchlist } = await import("../src/server/watchlist.ts");
  const all = Object.keys(yahooSymbols(await loadWatchlist(db)));
  sql.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('pending_rebase', ?, 'x')").run(JSON.stringify(Object.fromEntries(all.map((s) => [s, 2]))));
  upstream.reset();
  const r2 = await runJob(db, "prices", "test", {}, new Budget(10));
  assert.equal(upstream.count, 10);
  const pending = JSON.parse((sql.prepare("SELECT value FROM settings WHERE key = 'pending_rebase'").get() as { value: string }).value);
  assert.equal(Object.keys(pending).length, 29 - 6);
  assert.ok(r2.detail.failed, JSON.stringify(r2).slice(0, 600));
  const msgs = Object.values(r2.detail.failed as Record<string, string>);
  assert.equal(msgs.filter((m) => m.includes("這次請求額度不足")).length, 29 - 6, msgs.join("\n"));
});

test("分析師輪替只抓剩下額度付得起的檔數：全部成功，而不是抓到一半額度用完", async () => {
  const { db } = await fullListDb();
  const { runJob } = await import("../src/server/jobs.ts");
  const { Budget } = await import("../src/lib/sources/http.ts");
  upstream.reset();
  const r = await runJob(db, "analysts", "test", {}, new Budget(20));
  assert.equal(r.status, "ok", r.summary);
  // 1 個 spark ＋ 前 100 檔每檔 2 個；留 2 個給重試 → 最多 17 個
  assert.ok(upstream.count <= 18 && upstream.count >= 15, String(upstream.count));
  assert.match(r.summary, /分析師共識 8\/8 檔/);
});

test("Yahoo 全面限流（spark 掛掉、逐檔每次都 429）：VIX 與 SPX 核對照樣從 Cboe 拿到", async () => {
  const { db, sql } = await fullListDb();
  upstream.rules = [(u) => (u.host === "query1.finance.yahoo.com" ? new Response("slow down", { status: u.pathname.startsWith("/v7") ? 500 : 429, headers: { "retry-after": "0" } }) : null)];
  try {
    const r = await invokeCron("prices", db, sql);
    assertWithinLimit("prices（Yahoo 限流）", r);
    const detail = JSON.parse(r.runs[0].detail);
    assert.ok(!("VIX" in detail.failed), JSON.stringify(detail.failed.VIX));
    assert.equal(detail.spxCheck, undefined);
    assert.equal(r.hosts["cdn-api.cboe.com"], 2);
  } finally {
    upstream.rules = [];
  }
});

test("重算快照途中名單被改：存檔的快照用的是改完的名單", async () => {
  const { db, sql } = await fullListDb();
  await invokeCron("prices", db, sql);
  const { rebuildSnapshots } = await import("../src/server/jobs.ts");
  // 第一次讀價格（快照計算中途）時，另一個裝置移除了 TSLA。
  let fired = false;
  const racing = new Proxy(db, {
    get(target, prop) {
      if (prop !== "prepare") return Reflect.get(target, prop);
      return (q: string) => {
        if (!fired && /FROM prices WHERE symbol IN/.test(q) && /date <= \?/.test(q)) {
          fired = true;
          sql.prepare("UPDATE settings SET value = ? WHERE key = 'watchlist'").run(
            JSON.stringify(JSON.parse((sql.prepare("SELECT value FROM settings WHERE key = 'watchlist'").get() as { value: string }).value).filter((m: { key: string }) => m.key !== "TSLA")),
          );
        }
        return target.prepare(q);
      };
    },
  });
  await rebuildSnapshots(racing as D1Database, "測試", 3);
  assert.ok(fired, "沒有觸發到中途修改（查詢字串對不上）");
  const latest = sql.prepare("SELECT data FROM snapshots ORDER BY trade_date DESC, revision DESC LIMIT 1").get() as { data: string };
  const keys = (JSON.parse(latest.data).mag7 as { key: string }[]).map((r) => r.key);
  assert.ok(!keys.includes("TSLA"), keys.join(","));
  assert.equal(keys.length, 11);
});

test("財報日曆沒排到時改查推估日期：股類代號（BRK-B）也查得到", async () => {
  const { db, sql } = await fullListDb();
  upstream.rules = [(u) => (u.pathname === "/api/calendar/earnings" ? new Response(JSON.stringify({ data: { rows: [] }, status: { rCode: 200 } })) : null)];
  try {
    const r = await invokeCron("daily-reference", db, sql);
    assertWithinLimit("daily-reference（日曆空白）", r);
    const ev = r.runs.find((x) => x.job === "events")!;
    assert.equal(ev.status, "ok", ev.summary);
    assert.match(ev.summary, /BRK-B 2026-11-19（估）/);
  } finally {
    upstream.rules = [];
  }
});
