// 壓力：名單 0→12 一家一家加、每加一家跑全部五支排程；移除再加回；重複跑的冪等；併發的加入／移除。
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { FakeUpstream } from "./helpers/fake-cloudflare.ts";
import { FIVE, type Sql, assertInvocation, assertSnapshotMatches, consistentSpx, invokeCron, latestSnapshot, seededDb } from "./helpers/stress-env.ts";

const upstream = new FakeUpstream();
let restore: () => void;
before(() => {
  restore = upstream.install();
  upstream.rules = [consistentSpx];
});
after(() => restore());

const jobs = () => import("../src/server/jobs.ts");
const wl = () => import("../src/server/watchlist.ts");

async function runAll(db: D1Database, sql: Sql, label: string, strict = true) {
  for (const f of FIVE) assertInvocation(`${label}/${f}`, await invokeCron(upstream, f, db, sql), { strictJobs: strict });
}

async function emptyListDb() {
  const { db, sql } = await seededDb();
  const { removeWatchSymbol } = await jobs();
  for (const k of ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA"]) {
    upstream.reset();
    const r = await removeWatchSymbol(db, k);
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(upstream.count, 0);
  }
  assert.deepEqual(await (await wl()).loadWatchlist(db), [], "移除全部後應是空名單，不能退回預設 7 家");
  return { db, sql };
}

const GROW = ["NVDA", "goog", "brk.b", "FOXA", "NWS", "AAPL", " msft ", "AMZN", "META", "TSLA", "AVGO", "LLY"];

test("0→12：每加一家跑全部五支排程，額度、狀態、快照成員與歸因都正確", async (t) => {
  const { db, sql } = await emptyListDb();
  const { addWatchSymbol, removeWatchSymbol } = await jobs();
  const { loadWatchlist } = await wl();
  await runAll(db, sql, "空名單");
  for (const s of GROW) {
    upstream.reset();
    const r = await addWatchSymbol(db, s);
    assert.ok(r.ok, `${s}: ${JSON.stringify(r)}`);
    assert.ok(upstream.count <= 6 && upstream.overLimit === 0, `${s} 加入用了 ${upstream.count}`);
    const list = await loadWatchlist(db);
    assertSnapshotMatches(`加入 ${s} 後立即`, sql, list);
    await runAll(db, sql, `+${s}`);
    assertSnapshotMatches(`加入 ${s} 跑完排程`, sql, list, { checked: true });
  }
  const list = await loadWatchlist(db);
  assert.deepEqual(list.map((m) => m.key), ["NVDA", "GOOGL", "BRK-B", "FOXA", "NWSA", "AAPL", "MSFT", "AMZN", "META", "TSLA", "AVGO", "LLY"]);
  assert.equal(list.flatMap((m) => m.tickers).length, 15);
  t.diagnostic(`最後一輪各排程：${(await invokeCron(upstream, "daily-reference", db, sql)).requests} 個請求 (daily-reference)`);

  // 移除三家（含多股類的 GOOGL、FOXA），跑排程；再加回兩家
  for (const k of ["GOOGL", "FOXA", "LLY"]) assert.ok((await removeWatchSymbol(db, k)).ok);
  assert.ok(!(await removeWatchSymbol(db, "GOOG")).ok, "用非 key 的股類移除應失敗");
  let now = await loadWatchlist(db);
  assert.equal(now.length, 9);
  assertSnapshotMatches("移除三家後", sql, now);
  const ev = sql.prepare("SELECT COUNT(*) AS n FROM events WHERE kind='earnings' AND symbol IN ('GOOGL','FOXA','LLY')").get() as { n: number };
  assert.equal(ev.n, 0, "移除的公司未來財報事件應清掉");
  await runAll(db, sql, "移除後");
  assertSnapshotMatches("移除後跑排程", sql, now, { checked: true });
  for (const s of ["GOOG", "fox"]) {
    upstream.reset();
    const r = await addWatchSymbol(db, s);
    assert.ok(r.ok, `${s}: ${JSON.stringify(r)}`);
  }
  now = await loadWatchlist(db);
  assert.deepEqual(now.slice(-2).map((m) => [m.key, m.tickers]), [["GOOGL", ["GOOGL", "GOOG"]], ["FOXA", ["FOXA", "FOX"]]]);
  await runAll(db, sql, "加回後");
  assertSnapshotMatches("加回後", sql, now, { checked: true });

  // 冪等：再跑一輪五支排程，不應新增任何快照 revision、不應清掉任何核對結果
  const revs = (sql.prepare("SELECT COUNT(*) AS n FROM snapshots").get() as { n: number }).n;
  const matched = (sql.prepare("SELECT COUNT(*) AS n FROM prices WHERE check_status = 'match'").get() as { n: number }).n;
  const news = (sql.prepare("SELECT COUNT(*) AS n FROM news").get() as { n: number }).n;
  await runAll(db, sql, "第二輪");
  await runAll(db, sql, "第三輪");
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM snapshots").get() as { n: number }).n, revs, "重跑不應新增快照 revision");
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM prices WHERE check_status = 'match'").get() as { n: number }).n, matched, "重跑不應清掉核對");
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM news").get() as { n: number }).n, news, "新聞不應重複");
  const dupRev = sql.prepare("SELECT trade_date, digest, COUNT(*) AS n FROM snapshots GROUP BY trade_date, digest HAVING n > 1").all();
  assert.deepEqual(dupRev, [], "同一天同內容不應有兩個 revision");
});

test("名單滿 12 家：第 13 家、非成分股、重複、怪格式都在本地擋下，不打網路", async () => {
  const { db } = await emptyListDb();
  const { addWatchSymbol } = await jobs();
  for (const s of GROW) assert.ok((await addWatchSymbol(db, s)).ok, s);
  const cases: [string, RegExp][] = [
    ["JPM", /最多 12 家/],
    ["XXXX", /不在最新的 S&P 500/],
    ["2602335D", /不在最新的 S&P 500/],
    ["ZERO", /不在最新的 S&P 500/],
    ["nvda", /已經在名單裡/],
    ["GOOG", /已經在名單裡/],
    ["BRK.B", /已經在名單裡/],
    ["brk-b", /已經在名單裡/],
    ["", /請輸入代號/],
    ["   ", /請輸入代號/],
    ["BRK..B", /不在最新的 S&P 500/],
  ];
  for (const [input, re] of cases) {
    upstream.reset();
    const r = await addWatchSymbol(db, input);
    assert.ok(!r.ok && re.test(r.error), `${JSON.stringify(input)} → ${JSON.stringify(r)}`);
    assert.equal(upstream.count, 0, `${JSON.stringify(input)} 打了 ${upstream.count} 個請求`);
  }
  assert.equal((await (await wl()).loadWatchlist(db)).length, 12);
});

test("併發：11 家時同時加兩家，只有一家成功，名單 12 家不超過", async () => {
  const { db } = await emptyListDb();
  const { addWatchSymbol } = await jobs();
  for (const s of GROW.slice(0, 11)) assert.ok((await addWatchSymbol(db, s)).ok, s);
  upstream.reset();
  const [a, b] = await Promise.all([addWatchSymbol(db, "LLY"), addWatchSymbol(db, "JPM")]);
  assert.equal([a, b].filter((r) => r.ok).length, 1, JSON.stringify([a, b]));
  const loser = [a, b].find((r) => !r.ok) as { error: string };
  assert.match(loser.error, /最多 12 家/);
  const list = await (await wl()).loadWatchlist(db);
  assert.equal(list.length, 12);
});

test("併發：同一檔同時加兩次，不會重複；名單 10 家", async () => {
  const { db } = await emptyListDb();
  const { addWatchSymbol } = await jobs();
  for (const s of GROW.slice(0, 9)) assert.ok((await addWatchSymbol(db, s)).ok, s);
  const [a, b] = await Promise.all([addWatchSymbol(db, "goog"), addWatchSymbol(db, "GOOGL")]);
  // goog 已在名單（GROW 第 2 家），兩個都應被拒
  assert.ok(!a.ok && !b.ok);
  const [c, d] = await Promise.all([addWatchSymbol(db, "TSLA"), addWatchSymbol(db, "tsla")]);
  assert.equal([c, d].filter((r) => r.ok).length, 1, JSON.stringify([c, d]));
  const list = await (await wl()).loadWatchlist(db);
  assert.equal(list.length, 10);
  assert.equal(list.filter((m) => m.key === "TSLA").length, 1);
});

test("併發：prices 排程執行中加入一家（排程剛開始抓價時）", async () => {
  const { db, sql } = await seededDb();
  const { addWatchSymbol } = await jobs();
  await runAll(db, sql, "預設 7 家");
  const pPrices = invokeCron(upstream, "prices", db, sql);
  const pAdd = addWatchSymbol(db, "AVGO");
  const [r, add] = await Promise.all([pPrices, pAdd]);
  assert.ok(add.ok, JSON.stringify(add));
  assert.equal(r.overLimit, 0);
  const list = await (await wl()).loadWatchlist(db);
  assertSnapshotMatches("加入與 prices 重疊後", sql, list);
});

/** 讓排程那一邊的 rebuildSnapshots 在讀完名單、載入價格時停住，等另一個請求做完名單變更（D1 每個查詢都是一次網路往返，這個空檔在正式站存在）。 */
function gatedDb(db: D1Database, onLoadPrices: () => Promise<unknown>) {
  let fired = false;
  const wrap = <T extends { all: () => Promise<unknown> }>(s: T): T => ({
    ...s,
    all: async () => {
      if (!fired) {
        fired = true;
        await onLoadPrices();
      }
      return s.all();
    },
  });
  const g: D1Database = {
    ...(db as object),
    prepare: (q: string) => {
      const p = db.prepare(q) as unknown as { all: () => Promise<unknown>; bind: (...a: unknown[]) => { all: () => Promise<unknown> } };
      if (!/check_status, check_source, check_close FROM prices/.test(q)) return p as unknown as D1PreparedStatement;
      return { ...wrap(p), bind: (...a: unknown[]) => wrap(p.bind(...a)) } as unknown as D1PreparedStatement;
    },
    batch: db.batch.bind(db),
    withSession: () => g,
  } as unknown as D1Database;
  return g;
}

test("競態：prices 重算快照途中有人移除一家，最新快照不應留著被移除的公司", async () => {
  const { db, sql } = await seededDb();
  const { runJob, removeWatchSymbol } = await jobs();
  await runAll(db, sql, "預設 7 家");
  let removed: unknown;
  const g = gatedDb(db, async () => (removed = await removeWatchSymbol(db, "TSLA")));
  upstream.reset();
  const r = await runJob(g, "prices", "test");
  assert.equal(r.status, "ok", r.summary);
  assert.ok((removed as { ok: boolean }).ok);
  const list = await (await wl()).loadWatchlist(db);
  assert.ok(!list.some((m) => m.key === "TSLA"));
  let raced: unknown = null;
  try {
    assertSnapshotMatches("移除與 prices 重算重疊後", sql, list);
  } catch (e) {
    raced = e;
  }
  // 自癒：下一次會重算快照的排程（crosscheck）跑完後應該對了
  assertInvocation("crosscheck（自癒）", await invokeCron(upstream, "crosscheck", db, sql));
  assertSnapshotMatches("移除與 prices 重算重疊後＋crosscheck", sql, list);
  if (raced) throw raced;
});

test("競態：prices 重算快照途中有人加入一家，最新快照應包含新加入的公司", async () => {
  const { db, sql } = await seededDb();
  const { runJob, addWatchSymbol } = await jobs();
  await runAll(db, sql, "預設 7 家");
  let added: unknown;
  const g = gatedDb(db, async () => (added = await addWatchSymbol(db, "AVGO")));
  upstream.reset();
  const r = await runJob(g, "prices", "test");
  assert.equal(r.status, "ok", r.summary);
  assert.ok((added as { ok: boolean }).ok, JSON.stringify(added));
  const list = await (await wl()).loadWatchlist(db);
  let raced: unknown = null;
  try {
    assertSnapshotMatches("加入與 prices 重算重疊後", sql, list);
  } catch (e) {
    raced = e;
  }
  // 自癒：下一次會重算快照的排程（crosscheck）跑完後應該對了
  assertInvocation("crosscheck（自癒）", await invokeCron(upstream, "crosscheck", db, sql));
  assertSnapshotMatches("加入與 prices 重算重疊後＋crosscheck", sql, list);
  if (raced) throw raced;
});
