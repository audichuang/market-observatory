import { sql } from "void/db";
import { index, integer, primaryKey, real, sqliteTable, text } from "void/schema-d1";

// 日線：主來源（Yahoo chart／Cboe）一列一筆，交叉核對來源寫在 check_* 欄。
export const prices = sqliteTable(
  "prices",
  {
    symbol: text("symbol").notNull(),
    date: text("date").notNull(),
    open: real("open"),
    high: real("high"),
    low: real("low"),
    close: real("close").notNull(),
    volume: real("volume"),
    source: text("source").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    checkClose: real("check_close"),
    checkSource: text("check_source"),
    checkStatus: text("check_status"),
    checkedAt: text("checked_at"),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.date] }), index("prices_date_idx").on(t.date)],
);

// SPY 每日持股（SSGA 官方檔），as_of 是檔案自帶的持股日期。
export const weights = sqliteTable(
  "weights",
  {
    asOf: text("as_of").notNull(),
    ticker: text("ticker").notNull(),
    name: text("name").notNull(),
    weightPct: real("weight_pct").notNull(),
    shares: real("shares"),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.asOf, t.ticker] })],
);

// 每個交易日的計算結果；內容不同才新增 revision，舊 revision 不可變。
export const snapshots = sqliteTable(
  "snapshots",
  {
    tradeDate: text("trade_date").notNull(),
    revision: integer("revision").notNull(),
    digest: text("digest").notNull(),
    reason: text("reason").notNull(),
    data: text("data").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tradeDate, t.revision] })],
);

export const news = sqliteTable(
  "news",
  {
    id: text("id").primaryKey(),
    symbols: text("symbols").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    publisher: text("publisher"),
    publishedAt: text("published_at"),
    source: text("source").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [index("news_published_idx").on(t.publishedAt)],
);

// 事件日曆：財報（Nasdaq／Zacks 估計）與總經（官方公布的 FOMC 等日程）。
export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    kind: text("kind").notNull(),
    symbol: text("symbol"),
    title: text("title").notNull(),
    detail: text("detail"),
    status: text("status").notNull(),
    sourceUrl: text("source_url").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [index("events_date_idx").on(t.date)],
);

// 每次排程或手動執行的紀錄：成功、部分失敗、失敗都要留下。
export const runs = sqliteTable(
  "runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    job: text("job").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    summary: text("summary"),
    detail: text("detail"),
  },
  (t) => [index("runs_job_idx").on(t.job, t.startedAt)],
);

// 個人設定（定投規劃等），單一 owner 用 key-value 存。
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});
