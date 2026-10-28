// 模擬 Cloudflare 免費方案的執行環境，給「名單變大後排程會不會爆」的測試用：
// - D1：node:sqlite 記憶體資料庫，套用 db/migrations 的完整 schema。
// - 外部網路：假的 fetch，依網址回 Yahoo／Nasdaq／Cboe 格式的資料；
//   每次執行（reset 之間）超過 limit 個請求就丟出 Cloudflare 的錯誤（預設 Workers Paid 的 10,000，免費方案是 50），
//   並記錄同時進行的請求數上限。
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { addDays, latestExpectedClose } from "../../src/lib/calendar.ts";

export async function migratedDb() {
  const { DatabaseSync } = await import("node:sqlite");
  const sql = new DatabaseSync(":memory:");
  const dir = join(import.meta.dirname, "../../db/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const part of readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint")) if (part.trim()) sql.exec(part);
  }
  const bound = (q: string, args: unknown[]) => {
    const statement = () => {
      if (args.length > 100) throw new Error(`too many SQL variables: ${args.length} (maximum 100)`);
      return sql.prepare(q);
    };
    return {
      first: async () => statement().get(...(args as never[])) ?? null,
      all: async () => ({ results: statement().all(...(args as never[])) }),
      run: async () => ({ meta: { changes: Number(statement().run(...(args as never[])).changes) } }),
    };
  };
  const db = {
    prepare: (q: string) => ({ ...bound(q, []), bind: (...args: unknown[]) => bound(q, args) }),
    batch: async (stmts: { run: () => Promise<unknown> }[]) => {
      sql.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        sql.exec("COMMIT");
        return out;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
    withSession: () => db,
  };
  return { db: db as unknown as D1Database, sql };
}

/** 最近 n 個平日（含最近應已收盤那天），由舊到新。 */
export function weekdays(n: number, end = latestExpectedClose()): string[] {
  const out: string[] = [];
  for (let d = end; out.length < n; d = addDays(d, -1)) {
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) out.unshift(d);
  }
  return out;
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** 每檔固定的假價格：同一代號同一天在 Yahoo、Nasdaq、Cboe 都一樣，交叉核對會是 match。 */
export const fakeClose = (symbol: string, date: string) => {
  if (symbol === "^GSPC") symbol = "SPX"; // Yahoo 的 ^GSPC 與 Cboe 的 SPX 是同一個指數，核對才會 match
  const base = 50 + (hash(symbol) % 400);
  const day = Math.round((Date.parse(date) - Date.parse("2020-01-01")) / 86400000);
  return Math.round(base * (1 + day * 0.0002) * 100) / 100;
};
const tsOf = (date: string) => Date.parse(`${date}T20:00:00Z`) / 1000; // 美東 16:00
const mdy = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;

function chartResult(symbol: string, days: string[], closeOnly: boolean) {
  const close = days.map((d) => fakeClose(symbol, d));
  return {
    meta: { symbol, exchangeTimezoneName: "America/New_York" },
    timestamp: days.map(tsOf),
    indicators: { quote: [closeOnly ? { close } : { open: close, high: close, low: close, close, volume: close.map(() => 1000) }] },
  };
}

/** 假財報日曆裡 BRK.B 的日期：測試執行日之後的第 3 個平日（events 工作只看未來兩週）。 */
export const CALENDAR_BRK_DATE = (() => {
  const out: string[] = [];
  for (let d = new Date().toISOString().slice(0, 10); out.length < 3; ) {
    d = addDays(d, 1);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d);
  }
  return out[2];
})();

const RANGE_DAYS: Record<string, number> = { "5d": 5, "1mo": 22, "10y": 260 };

export type Rule = (url: URL, n: number) => Response | null | undefined;

export class FakeUpstream {
  limit = 10000;
  count = 0;
  inFlight = 0;
  maxInFlight = 0;
  overLimit = 0;
  readonly hosts: Record<string, number> = {};
  /** 測試可以插入規則改變某些網址的回應（例如 spark 掛掉、Nasdaq 回 429）；回 null 就走預設。 */
  rules: Rule[] = [];
  private seen = new Map<string, number>();

  reset() {
    this.count = 0;
    this.inFlight = 0;
    this.maxInFlight = 0;
    this.overLimit = 0;
    for (const k of Object.keys(this.hosts)) delete this.hosts[k];
  }

  install() {
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      this.count++;
      this.hosts[url.host] = (this.hosts[url.host] ?? 0) + 1;
      if (this.count > this.limit) {
        this.overLimit++;
        // Cloudflare 超過子請求上限時的行為：fetch 直接丟錯。
        throw new Error("Too many subrequests.");
      }
      this.inFlight++;
      this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
      try {
        await new Promise((r) => setTimeout(r, 2));
        const key = url.href;
        const n = (this.seen.get(key) ?? 0) + 1;
        this.seen.set(key, n);
        for (const rule of this.rules) {
          const r = rule(url, n);
          if (r) return r;
        }
        return this.respond(url);
      } finally {
        this.inFlight--;
      }
    }) as typeof fetch;
    return () => {
      globalThis.fetch = original;
    };
  }

  respond(url: URL): Response {
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    const nasdaq = (data: unknown) => json({ data, status: { rCode: 200 } });
    const p = url.pathname;
    if (url.host === "query1.finance.yahoo.com" && p.startsWith("/v7/finance/spark")) {
      const days = weekdays(RANGE_DAYS[url.searchParams.get("range") ?? "1mo"] ?? 22);
      const symbols = (url.searchParams.get("symbols") ?? "").split(",");
      if (symbols.length > 20) return new Response("too many", { status: 400 });
      return json({ spark: { result: symbols.map((s) => ({ symbol: s, response: [chartResult(s, days, true)] })) } });
    }
    if (url.host === "query1.finance.yahoo.com" && p.startsWith("/v8/finance/chart/")) {
      const symbol = decodeURIComponent(p.split("/").pop() ?? "");
      const days = weekdays(RANGE_DAYS[url.searchParams.get("range") ?? "1mo"] ?? 22);
      return json({ chart: { result: [chartResult(symbol, days, false)], error: null } });
    }
    // 跟真的一樣：舊網址會轉址（Cboe 307、Nasdaq 新聞 301），打到就多花一個請求。
    if (url.host === "cdn.cboe.com") return new Response(null, { status: 307, headers: { location: `https://cdn-api.cboe.com${p}` } });
    if (url.host === "api.nasdaq.com" && p === "/api/news/topic/articlebysymbol") return new Response(null, { status: 301, headers: { location: `https://www.nasdaq.com${p}${url.search}` } });
    if (url.host === "cdn-api.cboe.com") {
      const which = p.includes("VIX") ? "VIX" : "SPX";
      const rows = weekdays(60).map((d) => (which === "VIX" ? `${mdy(d)},20,21,19,${20 + (hash(d) % 5)}` : `${mdy(d)},${fakeClose("SPX", d)}`));
      return new Response([which === "VIX" ? "DATE,OPEN,HIGH,LOW,CLOSE" : "DATE,SPX", ...rows].join("\n"), { status: 200 });
    }
    if (url.host === "api.nasdaq.com" || (url.host === "www.nasdaq.com" && p.startsWith("/api/"))) {
      // 跟真的 Nasdaq 一樣：股類代號要用點（BRK.B），連字號版本回「Symbol not exists」。
      if (/[A-Z]-[A-Z]/.test(decodeURIComponent(p + url.search))) return json({ data: null, status: { rCode: 400, bCodeMessage: [{ code: 1001, errorMessage: "Symbol not exists." }] } });
      const hist = /^\/api\/quote\/([^/]+)\/historical$/.exec(p);
      if (hist) {
        const symbol = decodeURIComponent(hist[1]).replace(".", "-");
        const from = url.searchParams.get("fromdate") ?? "2000-01-01";
        const rows = weekdays(40).filter((d) => d >= from).reverse().map((d) => ({ date: mdy(d), close: `$${fakeClose(symbol, d).toFixed(2)}` }));
        return nasdaq({ tradesTable: { rows } });
      }
      if (p === "/api/news/topic/articlebysymbol") {
        const sym = (url.searchParams.get("q") ?? "").split("|")[0];
        return nasdaq({ rows: [1, 2, 3].map((i) => ({ id: `${sym}-${i}`, title: `${sym} news ${i}`, url: `/articles/${sym}-${i}`, publisher: "Fake", created: "Oct 23, 2026" })) });
      }
      // 財報日曆的代號也是點的寫法；BRK.B 排在 11/03（日期本身只是測試資料）。
      if (p === "/api/calendar/earnings") return nasdaq({ rows: url.searchParams.get("date") === CALENDAR_BRK_DATE ? [{ symbol: "BRK.B", time: "time-pre-market" }] : [] });
      if (p.endsWith("/earnings-date")) return nasdaq({ announcement: "Earnings announcement* for X: Nov 19, 2026", reportText: "derived from an algorithm" });
      if (p.endsWith("/targetprice")) return nasdaq({ consensusOverview: { priceTarget: "$120", lowPriceTarget: "$90", highPriceTarget: "$150", buy: 10, hold: 3, sell: 1 } });
      if (p.endsWith("/earnings-forecast")) return nasdaq({ yearlyForecast: { rows: [{ fiscalEnd: "Dec 2026", consensusEPSForecast: "5.1", noOfEstimates: 20, up: 2, down: 1 }] } });
    }
    if (url.host === "www.factset.com") return new Response(null, { status: 302, headers: { location: "https://advantage.factset.com/insight.pdf" } });
    if (url.host === "advantage.factset.com") return new Response("not a pdf", { status: 200 });
    // SSGA 的 xlsx 不在這裡模擬：回 404，weights 工作失敗但請求照樣計數（持股權重由測試直接寫進 D1）。
    return new Response("not found", { status: 404 });
  }
}
