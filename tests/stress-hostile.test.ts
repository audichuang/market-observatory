// 壓力：名單滿 12 家時，上游不配合（spark 只回部分／回錯代號／對調收盤、429、503、多跳轉址、轉址迴圈、慢回應、單精度浮點）。
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { FakeUpstream, type Rule } from "./helpers/fake-cloudflare.ts";
import { type Sql, assertInvocation, assertSnapshotMatches, consistentSpx, invokeCron, latestSnapshot, seededDb } from "./helpers/stress-env.ts";

const upstream = new FakeUpstream();
let restore: () => void;
before(() => {
  restore = upstream.install();
});
after(() => restore());
beforeEach(() => {
  upstream.rules = [consistentSpx];
});

const ADDS = ["AVGO", "BRK-B", "FOXA", "NWSA", "LLY"];
async function fullListDb() {
  const { db, sql } = await seededDb();
  const { addWatchSymbol } = await import("../src/server/jobs.ts");
  for (const s of ADDS) {
    upstream.reset();
    assert.ok((await addWatchSymbol(db, s)).ok, s);
  }
  // 先正常跑一輪：收盤、核對都齊
  for (const f of ["prices", "crosscheck"]) assertInvocation(f, await invokeCron(upstream, f, db, sql));
  return { db, sql };
}
const list = async (db: D1Database) => (await import("../src/server/watchlist.ts")).loadWatchlist(db);
const isSpark = (u: URL) => u.pathname.startsWith("/v7/finance/spark");


/** 包一層 fetch：spark 的 JSON 先經過 edit 再回給程式。 */
function wrapSpark(edit: (result: any[]) => any[]) {
  const inner = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const res = await inner(input as string, init);
    const url = new URL(String(input));
    if (!isSpark(url) || !res.ok) return res;
    const j = (await res.json()) as { spark: { result: any[] } };
    j.spark.result = edit(j.spark.result);
    return new Response(JSON.stringify(j), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return () => (globalThis.fetch = inner);
}

test("spark 只回一半代號：缺的逐檔補抓；01:10 那支的核對剛好用完剩下額度、27 檔全做", async () => {
  const { db, sql } = await fullListDb();
  const undo = wrapSpark((r) => r.filter((_, i) => i % 2 === 0));
  try {
    const p = await invokeCron(upstream, "prices", db, sql);
    assertInvocation("prices（spark 一半）", p);
    const retry = await invokeCron(upstream, "retry", db, sql);
    assertInvocation("retry（spark 一半）", retry);
  } finally {
    undo();
  }
  assertSnapshotMatches("spark 一半", sql, await list(db), { checked: true });
});

test("spark 回錯代號（meta 不符、小寫、多一檔沒要的）：不寫錯的、缺的補抓", async () => {
  const { db, sql } = await fullListDb();
  const undo = wrapSpark((r) => {
    const out = r.map((x) => {
      if (x.symbol === "AAPL") return { ...x, response: [{ ...x.response[0], meta: { ...x.response[0].meta, symbol: "MSFT" } }] };
      if (x.symbol === "NVDA") return { ...x, symbol: "nvda" };
      return x;
    });
    out.push({ ...r[0], symbol: "EVIL", response: [{ ...r[0].response[0], meta: { symbol: "EVIL" } }] });
    return out;
  });
  try {
    const p = await invokeCron(upstream, "prices", db, sql);
    assertInvocation("prices（錯代號）", p);
    const fb = JSON.parse(p.runs[0].detail).fallback as string[];
    assert.ok(fb.includes("AAPL") && fb.includes("NVDA"), `fallback=${fb}`);
  } finally {
    undo();
  }
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM prices WHERE symbol IN ('EVIL','nvda')").get() as { n: number }).n, 0);
  assertSnapshotMatches("錯代號後", sql, await list(db), { checked: true });
});

test("spark 把 AAPL、MSFT 的收盤對調（代號都對）：核對抓到不一致；隔天恢復後核對回到 match", async () => {
  const { db, sql } = await fullListDb();
  const undo = wrapSpark((r) => {
    const a = r.find((x) => x.symbol === "AAPL");
    const m = r.find((x) => x.symbol === "MSFT");
    const ac = a.response[0].indicators.quote[0].close;
    a.response[0].indicators.quote[0].close = m.response[0].indicators.quote[0].close;
    m.response[0].indicators.quote[0].close = ac;
    return r;
  });
  try {
    const p = await invokeCron(upstream, "prices", db, sql);
    assertInvocation("prices（對調）", p, { strictJobs: false });
    const d = JSON.parse(p.runs[0].detail);
    // 對調一個月的資料應該被當成「分割」嗎？至少不能直接寫入沒被發現
    const cc = await invokeCron(upstream, "crosscheck", db, sql);
    assertInvocation("crosscheck（對調）", cc, { strictJobs: false });
    const snap = latestSnapshot(sql).data;
    const pending = JSON.parse((sql.prepare("SELECT value FROM settings WHERE key='pending_rebase'").get() as { value: string } | undefined)?.value ?? "{}");
    // 實際行為：對調的一個月被 detectRebase 當成「分割」，不寫入、改抓十年 chart（正確值），所以錯值從未入庫、核對也沒有不一致。
    assert.deepEqual(Object.keys(d.rebased?.factors ?? {}).sort(), ["AAPL", "MSFT"], `rebased=${JSON.stringify(d.rebased)}`);
    assert.deepEqual(pending, {});
    assert.deepEqual(snap.quality.mismatches, []);
  } finally {
    undo();
  }
  for (const f of ["prices", "crosscheck"]) assertInvocation(`${f}（恢復）`, await invokeCron(upstream, f, db, sql));
  assertSnapshotMatches("對調恢復後", sql, await list(db), { checked: true });
});

test("spark 收盤是單精度浮點：不清掉已完成的核對、不產生新 revision", async () => {
  const { db, sql } = await fullListDb();
  const before = {
    match: (sql.prepare("SELECT COUNT(*) AS n FROM prices WHERE check_status='match'").get() as { n: number }).n,
    revs: (sql.prepare("SELECT COUNT(*) AS n FROM snapshots").get() as { n: number }).n,
  };
  const undo = wrapSpark((r) => r.map((x) => ({ ...x, response: [{ ...x.response[0], indicators: { quote: [{ close: x.response[0].indicators.quote[0].close.map((c: number) => Math.fround(c)) }] } }] })));
  try {
    for (let i = 0; i < 2; i++) assertInvocation("prices（fround）", await invokeCron(upstream, "prices", db, sql));
  } finally {
    undo();
  }
  // spark 掛掉、改逐檔 chart（雙精度）
  upstream.rules = [consistentSpx, (u) => (isSpark(u) ? new Response("down", { status: 500 }) : null)];
  assertInvocation("prices（chart）", await invokeCron(upstream, "prices", db, sql));
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM prices WHERE check_status='match'").get() as { n: number }).n, before.match);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM snapshots").get() as { n: number }).n, before.revs);
});

test("Nasdaq 每個網址第一次 429（Retry-After 0）：五支排程都不超額、記帳相符", async () => {
  const { db, sql } = await fullListDb();
  const hits = new Map<string, number>();
  upstream.rules = [consistentSpx, (u) => {
    if (u.host !== "api.nasdaq.com") return null;
    const n = (hits.get(u.href) ?? 0) + 1;
    hits.set(u.href, n);
    return n === 1 ? new Response("slow", { status: 429, headers: { "retry-after": "0" } }) : null;
  }];
  for (const f of ["daily-reference", "prices", "crosscheck", "retry", "news"]) {
    const r = await invokeCron(upstream, f, db, sql);
    assertInvocation(`${f}（429）`, r, { strictJobs: false });
    for (const run of r.runs) if (!["weights", "factset"].includes(run.job)) assert.notEqual(run.status, "failed", `${f}/${run.job}: ${run.summary}`);
  }
});

test("Retry-After 3600 只等上限 5 秒；503 兩次的那檔失敗、核對 partial 不是 failed", async () => {
  const { db, sql } = await fullListDb();
  upstream.rules = [consistentSpx, (u) => {
    if (u.host !== "api.nasdaq.com") return null;
    if (u.pathname.includes("/AAPL/")) return new Response("x", { status: 429, headers: { "retry-after": "3600" } });
    if (u.pathname.includes("/MSFT/")) return new Response("x", { status: 503 });
    return null;
  }];
  const t0 = Date.now();
  const r = await invokeCron(upstream, "crosscheck", db, sql);
  const ms = Date.now() - t0;
  assertInvocation("crosscheck", r, { strictJobs: false });
  assert.ok(ms < 7000, `等了 ${ms}ms`);
  assert.equal(r.runs[0].status, "partial", r.runs[0].summary);
  assert.deepEqual(Object.keys(JSON.parse(r.runs[0].detail).failed).sort(), ["AAPL", "MSFT"]);
});

test("Cboe 與 spark 第一次 503、之後 OK：prices 成功", async () => {
  const { db, sql } = await fullListDb();
  const hits = new Map<string, number>();
  upstream.rules = [(u) => {
    if (u.host !== "cdn.cboe.com" && !isSpark(u)) return null;
    const n = (hits.get(u.href) ?? 0) + 1;
    hits.set(u.href, n);
    return n === 1 ? new Response("busy", { status: 503, headers: { "retry-after": "0" } }) : null;
  }, consistentSpx];
  const r = await invokeCron(upstream, "prices", db, sql);
  assertInvocation("prices（503→OK）", r);
  assert.equal(r.requests, 8);
});

const cboeHops = (hops: number): Rule => (u) => {
  if (u.host !== "cdn.cboe.com") return null;
  const h = Number(u.searchParams.get("hop") ?? 0);
  if (h < hops) return new Response(null, { status: 302, headers: { location: `${u.pathname}?hop=${h + 1}` } });
  return null;
};

test("Cboe 3 跳轉址：每跳都記帳；retry 的核對仍做完 27 檔", async () => {
  const { db, sql } = await fullListDb();
  upstream.rules = [cboeHops(3), consistentSpx];
  const p = await invokeCron(upstream, "prices", db, sql);
  assertInvocation("prices（3 跳）", p);
  assert.equal(p.requests, 2 + 4 + 4);
  const r = await invokeCron(upstream, "retry", db, sql);
  assertInvocation("retry（3 跳）", r);
});

test("Cboe 3 跳轉址＋spark 掛掉：VIX 仍應抓得到（逐檔補抓要讓出 Cboe 的額度）", async () => {
  const { db, sql } = await fullListDb();
  // 每檔 chart 也第一次 503：逐檔補抓每檔用 2 個請求
  const hits = new Map<string, number>();
  upstream.rules = [cboeHops(3), consistentSpx, (u) => {
    if (isSpark(u)) return new Response("down", { status: 500 });
    if (u.pathname.startsWith("/v8/finance/chart/")) {
      const n = (hits.get(u.href) ?? 0) + 1;
      hits.set(u.href, n);
      return n === 1 ? new Response("busy", { status: 503, headers: { "retry-after": "0" } }) : null;
    }
    return null;
  }];
  const p = await invokeCron(upstream, "prices", db, sql);
  assertInvocation("prices（3 跳＋spark 掛）", p, { strictJobs: false });
  const failed = JSON.parse(p.runs[0].detail).failed as Record<string, string>;
  assert.ok(!("VIX" in failed), `VIX 失敗：${failed.VIX}；用了 ${p.requests}；${p.runs[0].summary}`);
});

test("Cboe 轉址迴圈：最多 6 跳就放棄，不吃光額度", async () => {
  const { db, sql } = await fullListDb();
  upstream.rules = [(u) => (u.host === "cdn.cboe.com" ? new Response(null, { status: 301, headers: { location: u.pathname } }) : null)];
  const p = await invokeCron(upstream, "prices", db, sql);
  assertInvocation("prices（迴圈）", p, { strictJobs: false });
  assert.equal(p.requests, 2 + 6 + 6);
  assert.equal(p.runs[0].status, "partial", p.runs[0].summary);
});

test("Nasdaq 回應慢（每個 40ms）：同時連線不超過 6、記帳相符", async () => {
  const { db, sql } = await fullListDb();
  const inner = globalThis.fetch;
  let inFlight = 0;
  let max = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    inFlight++;
    max = Math.max(max, inFlight);
    try {
      if (String(input).includes("api.nasdaq.com")) await new Promise((r) => setTimeout(r, 40));
      return await inner(input as string, init);
    } finally {
      inFlight--;
    }
  }) as typeof fetch;
  try {
    for (const f of ["crosscheck", "news", "daily-reference"]) {
      max = 0;
      assertInvocation(`${f}（慢）`, await invokeCron(upstream, f, db, sql));
      assert.ok(max <= 6, `${f} 同時 ${max}`);
    }
  } finally {
    globalThis.fetch = inner;
  }
});

test("spark 掛掉＋每檔 chart 第一次 429（沒有轉址）：VIX 仍應抓得到", async () => {
  const { db, sql } = await fullListDb();
  const hits = new Map<string, number>();
  upstream.rules = [consistentSpx, (u) => {
    if (isSpark(u)) return new Response("down", { status: 500 });
    if (u.pathname.startsWith("/v8/finance/chart/")) {
      const n = (hits.get(u.href) ?? 0) + 1;
      hits.set(u.href, n);
      return n === 1 ? new Response("slow", { status: 429, headers: { "retry-after": "0" } }) : null;
    }
    return null;
  }];
  const p = await invokeCron(upstream, "prices", db, sql);
  assertInvocation("prices（spark 掛＋chart 429）", p, { strictJobs: false });
  const failed = JSON.parse(p.runs[0].detail).failed as Record<string, string>;
  assert.ok(!("VIX" in failed), `VIX 失敗：${failed.VIX}；用了 ${p.requests}；${p.runs[0].summary}`);
});
