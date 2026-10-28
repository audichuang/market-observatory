import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildSnapshot } from "../src/lib/snapshot.ts";
import { DEFAULT_WATCHLIST, ETFS, FX_SYMBOL } from "../src/lib/universe.ts";
import { outlookView } from "../src/server/outlook.ts";
import { loadPrices, saveSnapshots } from "../src/server/repo.ts";
import { etfsView, historyView, newsView, overviewView, watchlistView, type ViewCtx } from "../src/server/views.ts";
import { migratedDb, weekdays } from "./helpers/fake-cloudflare.ts";

const TODAY = "2026-10-28";
const STAMP = `${TODAY}T23:00:00.000Z`;
const FIXTURES = join(import.meta.dirname, "../../ios/MarketObservatoryTests/Fixtures/generated");
const viewer = { id: "contract-user", email: "contract@example.test", name: "契約測試", isOwner: false };

test("API 契約：真正的 view 輸出須與 iOS 解碼 fixture 一致", async (t) => {
  // Freeze all date-dependent output (expectedClose, news.today, strategist stale), without a production-only clock seam.
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(STAMP) });
  const { db, sql } = await migratedDb();
  t.after(() => sql.close());
  const dates = weekdays(900, TODAY);
  const symbols = [...new Set(["SPX", "VIX", "RSP", FX_SYMBOL, ...DEFAULT_WATCHLIST.flatMap((m) => m.tickers), ...ETFS.map((e) => e.ticker)])];
  const price = sql.prepare("INSERT INTO prices (symbol, date, close, source, fetched_at, check_status) VALUES (?, ?, ?, 'contract', ?, 'match')");
  for (const [j, symbol] of symbols.entries()) {
    for (const [i, date] of dates.entries()) {
      const close = symbol === "VIX" ? 24 + 12 * Math.sin(i / 19) : symbol === FX_SYMBOL ? 31 + Math.sin(i / 31) : 1000 + j * 20 + i * 2 + 90 * Math.sin(i / 17);
      price.run(symbol, date, close, STAMP);
    }
  }
  const weight = sql.prepare("INSERT INTO weights (as_of, ticker, name, weight_pct, fetched_at) VALUES (?, ?, ?, ?, ?)");
  const weights = new Map(DEFAULT_WATCHLIST.flatMap((m) => m.tickers).map((ticker, i) => [ticker, 6 - i / 2]));
  for (const [ticker, pct] of weights) weight.run(TODAY, ticker, ticker, pct, STAMP);
  weight.run(TODAY, "AVGO", "Broadcom", 2, STAMP);
  sql.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)").run("watchlist:contract-user", JSON.stringify(DEFAULT_WATCHLIST), STAMP);
  const loaded = await loadPrices(db, symbols, dates[0], TODAY);
  for (const date of dates.slice(-2)) {
    const snapshot = buildSnapshot({ tradeDate: date, series: loaded.series, checks: loaded.checks, weights: { asOf: TODAY, byTicker: weights }, members: DEFAULT_WATCHLIST });
    assert.ok(snapshot);
    await saveSnapshots(db, [snapshot], "API 契約合成資料");
  }
  sql.prepare("INSERT INTO events (id,date,kind,symbol,title,status,source_url,fetched_at) VALUES ('contract-event',?,'earnings','NVDA','NVIDIA 財報','scheduled','https://example.test/event',?)").run(TODAY, STAMP);
  sql.prepare("INSERT INTO news (id,symbols,title,url,publisher,published_at,source,fetched_at,title_zh,tone,category,focus,primary_symbol,points_zh,enriched_at) VALUES ('contract-news','NVDA','NVIDIA earnings','https://example.test/news','合成新聞',?,'contract',?,'NVIDIA 財報更新','positive','earnings','company','NVDA',?,?)").run(STAMP, STAMP, JSON.stringify(["營收成長", "展望更新"]), STAMP);
  sql.prepare("INSERT INTO news_digests (symbol,date,summary,tone,news_ids,digest,model,created_at) VALUES ('NVDA',?,'合成公司重點','positive','[]','contract','contract',?)").run(TODAY, STAMP);
  sql.prepare("INSERT INTO news_digests (symbol,date,summary,tone,news_ids,digest,model,created_at) VALUES ('SPX',?,'合成市場重點','negative','[]','contract','contract',?)").run(TODAY, STAMP);
  sql.prepare("INSERT INTO analyst_views (symbol,as_of,price,price_date,target_mean,target_low,target_high,buy,hold,sell,eps_up,eps_down,fiscal_end,estimates,fetched_at) VALUES ('NVDA',?,100,'2026-10-27',120,90,150,10,2,1,4,1,'Dec 2026',20,?)").run(TODAY, STAMP);
  sql.prepare("INSERT INTO analyst_views (symbol,as_of,price,target_mean,buy,hold,sell,eps_up,eps_down,fetched_at) VALUES ('AVGO',?,null,null,0,0,0,null,null,?)").run(TODAY, STAMP);
  sql.prepare("INSERT INTO forecasts (trade_date,probability,base_rate,basis,call,close,created_at,detail,model_version,history_start) VALUES (?,0.7,0.6,'contract','up',1000,?,?, '2026-10-l01',?)").run(dates[dates.length - 30], STAMP, JSON.stringify({ drawdown: { p: 0.15, base: 0.2, scored: true } }), dates[0]);
  const ctx = (query: Record<string, string> = {}): ViewCtx => ({ env: { DB: db }, req: { query: (key) => query[key], url: "http://contract.test/" } });
  const payloads = {
    overview: await overviewView(ctx(), viewer),
    history: await historyView(ctx({ months: "1", symbol: "NVDA" }), viewer),
    etfs: await etfsView(ctx({ years: "1" }), viewer),
    news: await newsView(ctx(), viewer),
    watchlist: await watchlistView(ctx(), viewer),
    outlook: await outlookView(ctx()),
  };
  // Keep non-empty coverage for the branches that have previously broken App decoding.
  assert.ok(payloads.overview.snapshot && payloads.overview.forecast?.drawdown);
  assert.ok(payloads.etfs.dca && payloads.etfs.rows.find((r) => r.ticker === "SSO")?.drift1y);
  assert.ok(payloads.outlook.outlook?.drawdown && payloads.outlook.consensus);
  assert.deepEqual(payloads.outlook.consensus.noData, { symbols: 1, weightPct: 2 });
  assert.ok(payloads.news.news[0]?.points_zh?.length);
  for (const [name, payload] of Object.entries(payloads)) {
    await t.test(name, () => {
      const path = join(FIXTURES, `generated-${name}.json`);
      const actual = `${JSON.stringify(payload, null, 2)}\n`;
      if (process.env.MO_UPDATE_API_FIXTURES === "1") {
        mkdirSync(FIXTURES, { recursive: true });
        writeFileSync(path, actual);
      }
      assert.equal(actual, readFileSync(path, "utf8"), `${name} API 契約改變：檢查 iOS Codable 後，以 MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts 更新，並跑 MarketObservatoryTests。`);
    });
  }
});
