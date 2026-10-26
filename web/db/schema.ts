import { sql } from "void/db";
import { index, integer, primaryKey, real, sqliteTable, text } from "void/schema-d1";

// 日線：主來源（Yahoo chart／Cboe）一列一筆，交叉核對來源寫在 check_* 欄。
// SPX／VIX 的來源規則：Yahoo 窗口（約十年）內 Yahoo 是主來源、Cboe 只做交叉核對（寫 check_*）；
// 窗口之前 Cboe 是主來源（source='cboe'）、沒有第二來源所以不核對（check_* 為空）。
// 窗口之前的列由 backfill-index-history 用 ON CONFLICT DO NOTHING 補，不改窗口內任何一列。
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
    /** 來源附的英文摘要（Nasdaq description），給 AI 寫重點用 */
    summary: text("summary"),
    /** 來源標的主角代號（Nasdaq primarysymbol，Yahoo 格式），常跟 symbols 不同：選股文會掛在很多代號底下 */
    primarySymbol: text("primary_symbol"),
    // ── AI 加工（本機排程寫入，src/server/ai-batch.ts）：讀者不一定懂英文，標題翻成繁中、標出利多利空與類別、濾掉雜訊 ──
    titleZh: text("title_zh"),
    /** positive／negative／neutral（對 focus 裡的公司而言） */
    tone: text("tone"),
    category: text("category"),
    /** 這則真正在講的代號（逗號分隔，SPY 代表大盤／總經）；空字串＝雜訊（選股標題黨、只順帶提到） */
    focus: text("focus"),
    enrichedAt: text("enriched_at"),
    /** 單篇文章的 AI 重點（JSON 字串陣列，3～5 點繁中）；本機排程產生（scripts/ai-batch.ts），所有人共用 */
    pointsZh: text("points_zh"),
  },
  (t) => [index("news_published_idx").on(t.publishedAt), index("news_enriched_idx").on(t.enrichedAt)],
);

// 每家公司每天的新聞重點（AI 依當天新聞與漲跌寫 1～2 句繁中）。digest 是當時用到的新聞 id 的雜湊，新聞變了才重寫。
export const newsDigests = sqliteTable(
  "news_digests",
  {
    symbol: text("symbol").notNull(),
    date: text("date").notNull(),
    summary: text("summary").notNull(),
    tone: text("tone").notNull(),
    newsIds: text("news_ids").notNull(),
    digest: text("digest").notNull(),
    model: text("model").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.date] }), index("news_digests_date_idx").on(t.date)],
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

// 個股分析師共識（Nasdaq）：每檔每天一列，留歷史才看得出隱含漲幅、修正廣度的變化。
export const analystViews = sqliteTable(
  "analyst_views",
  {
    symbol: text("symbol").notNull(),
    asOf: text("as_of").notNull(),
    price: real("price"),
    priceDate: text("price_date"),
    targetMean: real("target_mean"),
    targetLow: real("target_low"),
    targetHigh: real("target_high"),
    buy: integer("buy").notNull(),
    hold: integer("hold").notNull(),
    sell: integer("sell").notNull(),
    fiscalEnd: text("fiscal_end"),
    epsForecast: real("eps_forecast"),
    epsUp: integer("eps_up"),
    epsDown: integer("eps_down"),
    estimates: integer("estimates"),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.asOf] }), index("analyst_views_asof_idx").on(t.asOf)],
);

// 每個交易日當下發出的「約 21 個交易日後是否上漲」預測；事後用實際結果對帳，看真實命中率。
export const forecasts = sqliteTable("forecasts", {
  tradeDate: text("trade_date").primaryKey(),
  probability: real("probability").notNull(),
  baseRate: real("base_rate").notNull(),
  basis: text("basis").notNull(),
  call: text("call").notNull(),
  close: real("close").notNull(),
  createdAt: text("created_at").notNull(),
  // G02：寫入後不可改（同一交易日第一次寫入為準）；以下欄位讓每一筆都能還原到產生它的模型。舊列沒有這些值（null）。
  modelVersion: text("model_version"),
  regime: text("regime"), // JSON：當天的旗標，例如 {"aboveSma200":true,"vixStress":false}
  condP: real("cond_p"),
  condNEff: real("cond_n_eff"),
  bssLow: real("bss_low"),
  historyStart: text("history_start"),
  detail: text("detail"), // JSON，留給之後新增的欄位
});

// App 註冊的推播裝置（APNs device token）。一個使用者可以有多台；list_key 是註冊時這個人的名單 key（src/server/account.ts），
// 推播時用它找名單，不必在排程裡判斷誰是站長。environment：Xcode 直接跑的 debug 版走 sandbox，TestFlight／App Store 走 production。
export const devices = sqliteTable(
  "devices",
  {
    token: text("token").primaryKey(),
    userId: text("user_id").notNull(),
    listKey: text("list_key").notNull(),
    environment: text("environment").notNull(),
    appVersion: text("app_version"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastError: text("last_error"),
  },
  (t) => [index("devices_user_idx").on(t.userId)],
);

// 已發出的推播（去重用）：收盤後的補抓排程會再跑一次收盤推播，同一天同一個人只發一次。id 是「種類:日期:user id」。
export const pushLog = sqliteTable(
  "push_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    devices: integer("devices").notNull(),
    delivered: integer("delivered").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("push_log_created_idx").on(t.createdAt)],
);
