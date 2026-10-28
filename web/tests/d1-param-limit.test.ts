import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeUpstream, migratedDb } from "./helpers/fake-cloudflare.ts";
import { FILLERS, assertSnapshotMatches, consistentSpx, invokeCron, latestSnapshot, seededDb } from "./helpers/stress-env.ts";
import { addToWatchlist } from "../src/lib/watchlist.ts";
import { D1_MAX_BOUND_PARAMS, inChunks, loadPrices, loadWeightAnchors, putSetting } from "../src/server/repo.ts";
import { latestHoldings, loadTrackedMembers } from "../src/server/watchlist.ts";

test("假 D1 在 first/all/run 執行時拒絕 101 個參數，96 與 100 個仍可執行", async () => {
  const { db, sql } = await migratedDb();
  try {
    for (const count of [96, 100, 101]) {
      const stmt = db.prepare(`SELECT ${Array(count).fill("?").join(",")}`).bind(...Array(count).fill(1));
      for (const method of ["first", "all", "run"] as const) {
        if (count > 100) await assert.rejects(() => stmt[method](), /too many SQL variables.*101/);
        else await assert.doesNotReject(() => stmt[method]());
      }
    }
  } finally {
    sql.close();
  }
});

test("inChunks 先去重並依保留參數數量分塊，空清單不產生區塊", () => {
  assert.equal(D1_MAX_BOUND_PARAMS, 100);
  const symbols = FILLERS.slice(0, 110);
  for (const [reserved, sizes] of [[0, [100, 10]], [1, [99, 11]], [2, [98, 12]]] as const) {
    const chunks = inChunks([...symbols, ...symbols], reserved);
    assert.deepEqual(chunks.map((c) => c.length), sizes);
    assert.deepEqual(chunks.flat(), symbols);
    assert.deepEqual(inChunks([], reserved), []);
  }
  assert.deepEqual(inChunks([3, 1, 3, 2], 2), [[3, 1, 2]]);
});

test("四份名單聯集 100 家含多股類時，prices/crosscheck/retry 與快照不超過 D1 參數上限", async (t) => {
  const { db, sql } = await seededDb();
  const { holdings } = await latestHoldings(db);
  const symbols = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "BRK-B", "LLY", "FOXA", "NWSA", "JPM", ...FILLERS.slice(0, 87)];
  const keys = ["watchlist", "watchlist:user-a", "watchlist:user-b", "watchlist:user-c"];
  for (const [i, key] of keys.entries()) {
    let list: Awaited<ReturnType<typeof loadTrackedMembers>> = [];
    for (const symbol of symbols.slice(i * 30, (i + 1) * 30)) {
      const added = addToWatchlist(list, symbol, holdings);
      assert.ok(added.ok, JSON.stringify(added));
      list = added.list;
    }
    await putSetting(db, key, list);
  }
  const members = await loadTrackedMembers(db);
  assert.equal(members.length, 100);
  assert.equal(members.flatMap((m) => m.tickers).length, 103);
  for (const [key, tickers] of [["GOOGL", ["GOOGL", "GOOG"]], ["FOXA", ["FOXA", "FOX"]], ["NWSA", ["NWSA", "NWS"]], ["BRK-B", ["BRK-B"]]] as const) {
    assert.deepEqual(members.find((m) => m.key === key)?.tickers, tickers);
  }
  const upstream = new FakeUpstream();
  upstream.rules = [consistentSpx];
  const restore = upstream.install();
  try {
    for (const cron of ["prices", "crosscheck", "retry"]) {
      const { runs } = await invokeCron(upstream, cron, db, sql);
      assert.ok(runs.length > 0, cron);
      for (const run of runs) {
        assert.notEqual(run.status, "failed", `${cron}/${run.job}: ${run.summary}`);
        assert.doesNotMatch(run.summary, /too many SQL variables/);
      }
      assert.equal(latestSnapshot(sql).data.mag7.length, 100, cron);
      assertSnapshotMatches(cron, sql, members, { checked: cron !== "prices" });
      t.diagnostic(`${cron}: ${runs.map((r) => `${r.job}=${r.status}`).join(", ")}; mag7=100`);
    }
  } finally {
    restore();
  }
});

test("loadWeightAnchors 空清單不發 IN 查詢，仍依日期載入全部持股檔", async () => {
  const { db, sql } = await readFixture();
  try {
    const anchors = await loadWeightAnchors({
      prepare(query) {
        assert.doesNotMatch(query, /\bIN\s*\(/i);
        return db.prepare(query);
      },
      batch: db.batch,
    }, []);
    assert.deepEqual(anchors.dates, ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]);
    assert.deepEqual([...anchors.byDate.values()].map((weights) => weights.size), [0, 0, 0, 0]);
  } finally {
    sql.close();
  }
});

async function readFixture() {
  const { db, sql } = await migratedDb();
  const symbols = FILLERS.slice(0, 110);
  const price = sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at, check_status, check_source, check_close) VALUES (?, ?, ?, 'yahoo', 'x', ?, ?, ?)");
  const weight = sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, fetched_at) VALUES (?, ?, ?, ?, 'x')");
  for (const [i, symbol] of symbols.entries()) {
    for (const [j, date] of ["2026-10-23", "2026-10-21", "2026-10-19", "2026-10-22", "2026-10-20"].entries()) {
      const status = date === "2026-10-21" ? "match" : date === "2026-10-22" ? "mismatch" : null;
      price.run(symbol, date, 100 + i + j, status, status ? "nasdaq" : null, status ? 100 + i : null);
    }
    for (const asOf of ["2026-10-22", "2026-10-20", "2026-10-21"]) weight.run(asOf, symbol, symbol, i + 0.5);
  }
  weight.run("2026-10-19", "UNTRACKED", "Untracked", 1);
  return { db, sql, symbols };
}

test("loadPrices 讀取 110 個代號含重複時，價格、核對與日期區間等同逐檔查詢", async () => {
  const { db, sql, symbols } = await readFixture();
  try {
    const loaded = await loadPrices(db, [...symbols, ...symbols], "2026-10-20", "2026-10-22");
    assert.equal(Object.keys(loaded.series).length, 110);
    for (const symbol of symbols) {
      const single = await loadPrices(db, [symbol], "2026-10-20", "2026-10-22");
      assert.deepEqual(loaded.series[symbol].points, single.series[symbol].points, symbol);
      assert.deepEqual(loaded.checks[symbol], single.checks[symbol], symbol);
      assert.deepEqual(loaded.series[symbol].points.map((p) => p.date), ["2026-10-20", "2026-10-21", "2026-10-22"]);
      assert.deepEqual([...loaded.checks[symbol].keys()], ["2026-10-20", "2026-10-21", "2026-10-22"]);
    }
  } finally {
    sql.close();
  }
});

test("loadWeightAnchors 讀取 110 個代號含重複時，權重等同逐檔查詢且保留所有持股檔日期", async () => {
  const { db, sql, symbols } = await readFixture();
  try {
    const anchors = await loadWeightAnchors(db, [...symbols, ...symbols]);
    assert.deepEqual(anchors.dates, ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]);
    for (const symbol of symbols) {
      const single = await loadWeightAnchors(db, [symbol]);
      assert.deepEqual(anchors.dates, single.dates, symbol);
      for (const date of anchors.dates) assert.equal(anchors.byDate.get(date)!.get(symbol), single.byDate.get(date)!.get(symbol), `${symbol}/${date}`);
    }
  } finally {
    sql.close();
  }
});
