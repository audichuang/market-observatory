// 開放註冊後：每人一份名單，排程追蹤聯集，總覽只看自己的；站長之外的人不能跑後台。
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { FakeUpstream } from "./helpers/fake-cloudflare.ts";
import { consistentSpx, invokeCron, latestSnapshot, seededDb } from "./helpers/stress-env.ts";
import { mergeWatchlists, MAX_TRACKED } from "../src/lib/watchlist.ts";
import { DEFAULT_WATCHLIST } from "../src/lib/universe.ts";
import { viewForMembers, type Snapshot } from "../src/lib/snapshot.ts";
import { settingKey, viewerOf, watchlistKey } from "../src/server/account.ts";

const upstream = new FakeUpstream();
let restore: () => void;
before(() => {
  restore = upstream.install();
  upstream.rules = [consistentSpx];
});
after(() => restore());

const jobs = () => import("../src/server/jobs.ts");
const wl = () => import("../src/server/watchlist.ts");
const B = "watchlist:user-b";

test("合併名單：照順序、同公司或同代號只留第一次出現", () => {
  const a = [{ key: "NVDA", company: "NVIDIA", tickers: ["NVDA"] }];
  const b = [
    { key: "GOOG", company: "Alphabet", tickers: ["GOOG", "GOOGL"] },
    { key: "NVDA", company: "NVIDIA", tickers: ["NVDA"] },
  ];
  const c = [{ key: "GOOGL", company: "Alphabet", tickers: ["GOOGL", "GOOG"] }];
  assert.deepEqual(mergeWatchlists([a, b, c]).map((m) => m.key), ["NVDA", "GOOG"]);
  const many = Array.from({ length: MAX_TRACKED + 5 }, (_, i) => ({ key: `K${i}`, company: `K${i}`, tickers: [`K${i}`] }));
  assert.equal(mergeWatchlists([many]).length, MAX_TRACKED);
});

test("站長判斷看 OWNER_EMAIL（不分大小寫）；站長沿用舊 key，其他人的 key 帶 user id", () => {
  const ctx = (email: string | null, owner?: string) => ({ get: () => (email ? { id: "u1", email } : null), env: { OWNER_EMAIL: owner } }) as never;
  assert.equal(viewerOf(ctx(null, "a@x.com")), null);
  const owner = viewerOf(ctx("A@x.com", "a@x.com"))!;
  assert.equal(owner.isOwner, true);
  assert.equal(watchlistKey(owner), "watchlist");
  assert.equal(settingKey(owner, "plan"), "plan");
  const other = viewerOf(ctx("b@x.com", "a@x.com"))!;
  assert.equal(other.isOwner, false);
  assert.equal(watchlistKey(other), "watchlist:u1");
  assert.equal(settingKey(other, "plan"), "plan:u1");
  // 沒設定 OWNER_EMAIL 時沒有人是站長
  assert.equal(viewerOf(ctx("a@x.com", undefined))!.isOwner, false);
});

test("排程追蹤所有人名單的聯集；站長還沒存過名單時算預設七巨頭", async () => {
  const { db } = await seededDb();
  const { loadTrackedMembers, updateWatchlist } = await wl();
  assert.deepEqual((await loadTrackedMembers(db)).map((m) => m.key), DEFAULT_WATCHLIST.map((m) => m.key));
  await updateWatchlist(db, () => [{ key: "AVGO", company: "Broadcom", tickers: ["AVGO"] }, DEFAULT_WATCHLIST[0]], B);
  assert.deepEqual((await loadTrackedMembers(db)).map((m) => m.key), [...DEFAULT_WATCHLIST.map((m) => m.key), "AVGO"]);
  // 站長存過名單（即使是空的）就以站長的為準，不再補預設
  await updateWatchlist(db, () => []);
  assert.deepEqual((await loadTrackedMembers(db)).map((m) => m.key), ["AVGO", "NVDA"]);
});

test("加入別人已在追蹤的公司不打外部請求；移除時還有人追蹤就保留財報事件", async () => {
  const { db, sql } = await seededDb();
  const { addWatchSymbol, removeWatchSymbol } = await jobs();
  const { loadWatchlist, loadTrackedMembers } = await wl();
  // 站長加 AVGO：全站第一次追蹤，要抓歷史
  upstream.reset();
  assert.ok((await addWatchSymbol(db, "AVGO")).ok);
  assert.ok(upstream.count > 0);
  // B 加 AVGO：站長已在追蹤，不用再抓
  upstream.reset();
  const r = await addWatchSymbol(db, "avgo", undefined, B);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(upstream.count, 0);
  assert.deepEqual((await loadWatchlist(db, B)).map((m) => m.key), [...DEFAULT_WATCHLIST.map((m) => m.key), "AVGO"]);
  // B 的名單不影響站長的
  assert.deepEqual((await loadWatchlist(db)).map((m) => m.key), [...DEFAULT_WATCHLIST.map((m) => m.key), "AVGO"]);
  sql.prepare("INSERT INTO events (id, date, kind, symbol, title, detail, status, source_url, fetched_at) VALUES ('e1', '2999-01-01', 'earnings', 'AVGO', 'Broadcom 財報', NULL, 'scheduled', 'x', 'x')").run();
  assert.ok((await removeWatchSymbol(db, "AVGO", B)).ok);
  assert.ok((await loadTrackedMembers(db)).some((m) => m.key === "AVGO"), "站長還在追蹤");
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM events WHERE id = 'e1'").get() as { n: number }).n, 1);
  // 站長也移除：沒人追蹤了，未來的財報事件清掉
  assert.ok((await removeWatchSymbol(db, "AVGO")).ok);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM events WHERE id = 'e1'").get() as { n: number }).n, 0);
});

test("快照含聯集，每個人的總覽只留自己的公司、合計與「其餘」照自己的名單重算", async () => {
  const { db, sql } = await seededDb();
  const { addWatchSymbol } = await jobs();
  const { updateWatchlist, loadWatchlist } = await wl();
  // B 只追蹤 AVGO
  assert.ok((await addWatchSymbol(db, "AVGO", undefined, B)).ok);
  await updateWatchlist(db, (l) => l.filter((m) => m.key === "AVGO"), B);
  await invokeCron(upstream, "prices", db, sql);
  const snap = latestSnapshot(sql).data as unknown as Snapshot;
  assert.deepEqual(snap.mag7.map((r) => r.key), [...DEFAULT_WATCHLIST.map((m) => m.key), "AVGO"]);
  const mine = viewForMembers(snap, await loadWatchlist(db, B));
  assert.deepEqual(mine.mag7.map((r) => r.key), ["AVGO"]);
  assert.equal(mine.mag7Total.contributionPts, snap.mag7.find((r) => r.key === "AVGO")!.contributionPts);
  const total = (mine.mag7Total.contributionPts ?? 0) + (mine.rest.contributionPts ?? 0);
  assert.ok(Math.abs(total - (snap.index.changePts ?? 0)) < 1e-3, "自己的合計＋其餘＝指數漲跌");
  assert.deepEqual(mine.notTracked, []);
  // 名單上有、快照裡沒有的公司列在 notTracked
  assert.deepEqual(viewForMembers(snap, [{ key: "XOM", tickers: ["XOM"] }]).notTracked, ["XOM"]);
  // 同一家公司 key 不同（股類權重換了大小）也認得出來
  assert.deepEqual(viewForMembers(snap, [{ key: "GOOG", tickers: ["GOOG", "GOOGL"] }]).mag7.map((r) => r.key), ["GOOGL"]);
});

test("新使用者第一次讀名單時寫入預設名單；預設名單有聯集沒追蹤的公司時要求重算快照", async () => {
  const { db } = await seededDb();
  const { viewerWatchlist } = await import("../src/server/account.ts");
  const { updateWatchlist } = await wl();
  const v = { id: "new", email: "n@x.com", name: "", isOwner: false };
  // 站長還沒存過名單：聯集就是預設七巨頭，新使用者不帶進新公司
  let r = await viewerWatchlist(db, v);
  assert.equal(r.needsRebuild, false);
  assert.deepEqual(r.members, DEFAULT_WATCHLIST);
  // 第一個新使用者已經把七巨頭寫進聯集：第二個人不用重算
  await updateWatchlist(db, () => [{ key: "AVGO", company: "Broadcom", tickers: ["AVGO"] }]);
  assert.equal((await viewerWatchlist(db, { ...v, id: "new1" })).needsRebuild, false);
  // 聯集裡沒有七巨頭（只有站長的 AVGO）時，新使用者的預設名單帶進新公司，要重算
  const fresh = (await seededDb()).db;
  await updateWatchlist(fresh, () => [{ key: "AVGO", company: "Broadcom", tickers: ["AVGO"] }]);
  r = await viewerWatchlist(fresh, { ...v, id: "new2" });
  assert.equal(r.needsRebuild, true);
  // 第二次讀不再要求
  r = await viewerWatchlist(fresh, { ...v, id: "new2" });
  assert.equal(r.needsRebuild, false);
});
