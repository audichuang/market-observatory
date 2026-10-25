// 推播：訊息內容、APNs JWT、收盤推播的去重與失效裝置清理、請求都算進額度。
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { FakeUpstream } from "./helpers/fake-cloudflare.ts";
import { consistentSpx, invokeCron, seededDb, type Sql } from "./helpers/stress-env.ts";
import { bigMoves, dailySummary, eventReminder, sanitizePrefs } from "../src/lib/push.ts";
import type { Snapshot } from "../src/lib/snapshot.ts";
import { Budget } from "../src/lib/sources/http.ts";

const upstream = new FakeUpstream();
let restore: () => void;
const apnsCalls: { url: string; status: number }[] = [];
/** 測試可以指定某個 token 回什麼狀態碼（預設 200） */
const apnsStatus = new Map<string, number>();
before(() => {
  restore = upstream.install();
  upstream.rules = [
    consistentSpx,
    (u) => {
      if (!u.host.endsWith("push.apple.com")) return null;
      const token = u.pathname.split("/").at(-1)!;
      const status = apnsStatus.get(token) ?? 200;
      apnsCalls.push({ url: u.href, status });
      return new Response(status === 200 ? "" : JSON.stringify({ reason: status === 410 ? "Unregistered" : "BadDeviceToken" }), { status });
    },
  ];
});
after(() => restore());

const snap = (over: Partial<Snapshot> = {}): Snapshot =>
  ({
    tradeDate: "2026-10-23",
    index: { close: 6812.34, changePts: 57.4, returnPct: 0.85, prevClose: 6754.94 },
    vix: { close: 15.23 },
    mag7: [
      { key: "NVDA", company: "NVIDIA", tickers: ["NVDA"], returnPct: 5.4, contributionPts: 30.1 },
      { key: "TSLA", company: "Tesla", tickers: ["TSLA"], returnPct: -6.25, contributionPts: -8.2 },
      { key: "AAPL", company: "Apple", tickers: ["AAPL"], returnPct: 0.3, contributionPts: 1.2 },
    ],
    mag7Total: { contributionPts: 23.1, shareOfMovePct: 40.24, weightPct: 20 },
    ...over,
  }) as unknown as Snapshot;

test("收盤摘要：漲跌、名單合計、貢獻最大的一家、VIX；算不出漲跌就不發", () => {
  const m = dailySummary(snap())!;
  assert.equal(m.title, "S&P 500 10/23 收盤 +0.85%");
  assert.equal(m.body, "6,812.34（+57.40 點） · 名單合計 +23.1 點，占 40% · 最大 NVDA +30.1 點 · VIX 15.2");
  assert.equal(dailySummary(snap({ index: { close: 1, changePts: null, returnPct: null } as never })), null);
});

test("大漲大跌：只列超過門檻的，依幅度排序", () => {
  const m = bigMoves(snap(), 5)!;
  assert.equal(m.title, "名單 2 家大漲大跌超過 5%");
  assert.equal(m.body, "Tesla（TSLA）−6.3%、NVIDIA（NVDA）+5.4%");
  assert.equal(bigMoves(snap(), 6)!.title, "TSLA 10/23 大跌 −6.3%");
  assert.equal(bigMoves(snap(), 10), null);
});

test("事件提醒：只提名單上的財報與總經事件，標出盤前盤後與推估", () => {
  const events = [
    { date: "2026-10-28", kind: "earnings", symbol: "MSFT", title: "Microsoft 財報", detail: "盤後，財季 Sep/2026", status: "scheduled" },
    { date: "2026-10-28", kind: "earnings", symbol: "XOM", title: "Exxon 財報", detail: "盤前", status: "scheduled" },
    { date: "2026-10-28", kind: "macro", symbol: null, title: "FOMC 利率決議（10/27–28）", detail: "美東 14:00", status: "scheduled" },
    { date: "2026-10-28", kind: "earnings", symbol: "META", title: "Meta 財報", detail: null, status: "estimated" },
    { date: "2026-10-29", kind: "earnings", symbol: "AAPL", title: "Apple 財報", detail: null, status: "scheduled" },
  ];
  const m = eventReminder("2026-10-28", events, ["MSFT", "META", "AAPL"])!;
  assert.equal(m.body, "Microsoft 財報（盤後）、FOMC 利率決議（10/27–28）、Meta 財報（推估）");
  assert.equal(eventReminder("2026-10-30", events, ["MSFT"]), null);
});

test("推播偏好：缺的欄位用預設，門檻夾在 1～50", () => {
  assert.deepEqual(sanitizePrefs({ daily: false, moveThresholdPct: 0.2 }), { daily: false, moves: true, moveThresholdPct: 1, events: true });
  assert.deepEqual(sanitizePrefs("x"), { daily: true, moves: true, moveThresholdPct: 5, events: true });
});

async function testKey() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
  return { pem, publicKey: pair.publicKey };
}

test("APNs JWT：ES256、kid／iss 正確，簽章驗得過；40 分鐘內重用同一個", async () => {
  const { providerToken } = await import("../src/server/push.ts");
  const { pem, publicKey } = await testKey();
  // secret 存成單行、換行變成字面 \n 也要能用
  const cfg = { teamId: "TEAM123456", keyId: "KEY1234567", privateKey: pem.replace(/\n/g, "\\n"), bundleId: "app.test" };
  const t0 = 1_800_000_000_000;
  const token = await providerToken(cfg, t0);
  const [h, p, s] = token.split(".");
  const dec = (x: string) => JSON.parse(Buffer.from(x, "base64url").toString());
  assert.deepEqual(dec(h), { alg: "ES256", kid: "KEY1234567" });
  assert.deepEqual(dec(p), { iss: "TEAM123456", iat: t0 / 1000 });
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, Buffer.from(s, "base64url"), new TextEncoder().encode(`${h}.${p}`));
  assert.ok(ok);
  assert.equal(await providerToken(cfg, t0 + 39 * 60 * 1000), token);
  assert.notEqual(await providerToken(cfg, t0 + 41 * 60 * 1000), token);
});

const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);
const TOKEN_GONE = "c".repeat(64);

function addDevice(sql: Sql, token: string, userId: string, listKey: string, environment = "production") {
  sql.prepare("INSERT INTO devices (token, user_id, list_key, environment, created_at, updated_at) VALUES (?, ?, ?, ?, 'x', 'x')").run(token as never, userId as never, listKey as never, environment as never);
}

test("收盤推播：每人每天一則摘要；重跑不重複發、失效裝置會移除、APNs 請求算進額度", async () => {
  const { db, sql } = await seededDb();
  const { pem } = await testKey();
  const env = { DB: db, APNS_TEAM_ID: "TEAM123456", APNS_KEY_ID: "KEY1234567", APNS_PRIVATE_KEY: pem, APPLE_BUNDLE_ID: "app.test" };
  // 先讓價格與快照就位（這時還沒有裝置，推播工作什麼都不做、不打 APNs）
  await invokeCron(upstream, "prices", db, sql);
  addDevice(sql, TOKEN_A, "owner", "watchlist");
  addDevice(sql, TOKEN_GONE, "owner", "watchlist", "sandbox");
  addDevice(sql, TOKEN_B, "user-b", "watchlist:user-b");
  apnsStatus.set(TOKEN_GONE, 410);
  // B 關掉大漲大跌，只收摘要
  sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('push:user-b', ?, 'x')").run(JSON.stringify({ daily: true, moves: false, moveThresholdPct: 5, events: true }) as never);

  const { notifyClose } = await import("../src/server/push.ts");
  const { apnsConfig } = await import("../src/server/push.ts");
  apnsCalls.length = 0;
  upstream.reset();
  const budget = new Budget(100);
  const r1 = await notifyClose(db, apnsConfig(env), budget);
  assert.equal(r1.status, "ok", r1.summary);
  // 假資料的漲跌都很小，不會觸發大漲大跌：站長 2 台、B 1 台各收到一則摘要
  assert.equal(apnsCalls.length, 3, JSON.stringify(apnsCalls));
  assert.equal(budget.used, upstream.count, "每個 APNs 請求都扣了額度");
  assert.ok(apnsCalls.some((c) => c.url.startsWith("https://api.sandbox.push.apple.com/3/device/")), "sandbox 裝置打 sandbox 主機");
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM devices WHERE token = ?").get(TOKEN_GONE as never) as { n: number }).n, 0, "410 的裝置被移除");
  const logged = sql.prepare("SELECT id, delivered FROM push_log ORDER BY id").all() as { id: string; delivered: number }[];
  assert.deepEqual(logged.map((l) => [l.id.split(":")[0], l.id.split(":")[2], l.delivered]), [["daily", "owner", 1], ["daily", "user-b", 1]]);

  // 補抓排程再跑一次：不重複發
  apnsCalls.length = 0;
  const r2 = await notifyClose(db, apnsConfig(env), new Budget(100));
  assert.equal(apnsCalls.length, 0);
  assert.match(r2.summary, /已發過 2 則/);
});

test("收盤推播接在抓價排程後面；沒設定 APNs 金鑰時記成 failed，不影響抓價", async () => {
  const { db, sql } = await seededDb();
  addDevice(sql, TOKEN_A, "owner", "watchlist");
  const r = await invokeCron(upstream, "prices", db, sql);
  assert.deepEqual(r.runs.map((x) => [x.job, x.status]), [["prices", "ok"], ["notify-close", "failed"]]);
  assert.match(r.runs[1].summary, /尚未設定 APNs 金鑰/);
});
