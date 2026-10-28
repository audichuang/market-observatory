export type SourceRuntime = "worker" | "local" | "manual" | "static";
export type RightStatus = "未取得（條款限制）" | "官方公開，需標示來源" | "未查" | "不適用";
export interface SourceRight { status: RightStatus; basis: string }
export interface SourceTerms {
  name: string;
  url: string | null;
  versionDate: string | null;
  versionNote: string;
}
export interface SourceRegistryEntry {
  id: string;
  name: string;
  runtime: SourceRuntime;
  patterns: readonly RegExp[];
  jobs: readonly string[];
  screens: readonly string[];
  fields: readonly { name: string; usage: string }[];
  disableImpact: string;
  rights: Record<"automatedAcquisition" | "storage" | "publicDisplay" | "derivation" | "aiProcessing", SourceRight>;
  terms: readonly SourceTerms[];
  reviewedOn: string;
  evidence: readonly string[];
  notes: readonly string[];
}

// This records the supplied research, not a new legal determination or an access policy.
const RESEARCH = {
  reviewedOn: "2026-10-28",
  evidence: [
    "docs/research-2026-10-28/spec/L1-data.md L1-T7",
    "docs/research-2026-10-28/report.md §6 #17（B-09、S-03）",
    "docs/research-2026-10-28/results/B-data-pipeline.md §4",
    "docs/research-2026-10-28/verify/V-B.md #12–15",
  ],
};
const YAHOO_TERMS: readonly SourceTerms[] = [{
  name: "Yahoo Terms of Service",
  url: "https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html",
  versionDate: "2026-08-04",
  versionNote: "沿前輪 2026-08-04 版，本輪未重核；研究本輪讀取回 HTTP 999。",
}];
const YAHOO_RIGHTS: SourceRegistryEntry["rights"] = {
  automatedAcquisition: { status: "未取得（條款限制）", basis: "前輪記載禁止未經許可的自動擷取；沿前輪 2026-08-04 版，本輪未重核。" },
  storage: { status: "未查", basis: "本輪未重核全文，未確認涵蓋本站長期歷史保存的許可。" },
  publicDisplay: { status: "未查", basis: "本輪未重核全文，未確認網站、App 與推播顯示的許可。" },
  derivation: { status: "未查", basis: "本輪未重核全文，未確認本站計算與衍生用途的許可。" },
  aiProcessing: { status: "未查", basis: "本輪未重核全文；搜尋與正文供 AI 使用的權利仍待逐項確認。" },
};
const NASDAQ_TERMS: readonly SourceTerms[] = [{
  name: "Nasdaq Website Terms of Use",
  url: "https://www.nasdaq.com/legal",
  versionDate: null,
  versionNote: "V-B #15 未親見 2026-05-11 版本日；B 報告曾記載此日期，但本輪未核實。",
}];
const NASDAQ_RIGHTS: SourceRegistryEntry["rights"] = {
  automatedAcquisition: { status: "未取得（條款限制）", basis: "§2 限制資料捕捉；未見涵蓋本站自動取得的特別授權。" },
  storage: { status: "未取得（條款限制）", basis: "§6 限個人非商業使用，§11 限制保存；本站寫入 D1 的用途待確認。" },
  publicDisplay: { status: "未取得（條款限制）", basis: "§6、§7 限制個人非商業以外使用與對第三方發布、分享。" },
  derivation: { status: "未取得（條款限制）", basis: "§7 限制衍生作品與分析用途；僅呈現衍生數字不等於已獲許可。" },
  aiProcessing: { status: "未取得（條款限制）", basis: "§7 明列 AI／資料分析軟體限制；翻譯與摘要不假定豁免。" },
};
const UNREVIEWED_RIGHTS: SourceRegistryEntry["rights"] = {
  automatedAcquisition: { status: "不適用", basis: "現行為程式內建或人工維護，沒有自動請求此來源。" },
  storage: { status: "未查", basis: "本輪未逐項查核該來源的保存條款。" },
  publicDisplay: { status: "未查", basis: "本輪未逐項查核該來源的公開顯示條款。" },
  derivation: { status: "未查", basis: "本輪未逐項查核該來源的衍生用途條款。" },
  aiProcessing: { status: "未查", basis: "本輪未逐項查核該來源的 AI 處理權利。" },
};

export const SOURCE_REGISTRY: readonly SourceRegistryEntry[] = [
  {
    ...RESEARCH, id: "yahoo-chart", name: "Yahoo chart／spark 日線", runtime: "worker",
    patterns: [/^https:\/\/query1\.finance\.yahoo\.com\/v8\/finance\/chart\/[^/?#]+(?:[?#]|$)/, /^https:\/\/query1\.finance\.yahoo\.com\/v7\/finance\/spark(?:[?#]|$)/],
    jobs: ["prices", "backfill-prices", "analysts", "addWatchSymbol"],
    screens: ["總覽", "走勢", "ETF 比較與定投", "下月展望", "資料來源", "收盤推播"],
    fields: [{ name: "date／close／OHLC／volume", usage: "個股、ETF、^GSPC、TWD=X 日線；收盤是拆股調整、不含股息。" }, { name: "price／price_date", usage: "分析師共識使用的現價與日期。" }],
    disableImpact: "停止更新日線、加入新公司的歷史與共識現價；快照、走勢、定投與展望會缺少新輸入，既存資料仍保留。",
    rights: YAHOO_RIGHTS, terms: YAHOO_TERMS,
    evidence: [...RESEARCH.evidence, "src/lib/sources/yahoo.ts", "src/server/jobs.ts", "docs/research-2026-10-27/results/P4-data-sources.md"],
    notes: ["沿前輪 2026-08-04 版，本輪未重核；HTTP 可下載不代表已取得授權。"],
  },
  {
    ...RESEARCH, id: "cboe-index", name: "Cboe VIX／SPX 歷史指數", runtime: "worker",
    patterns: [/^https:\/\/cdn-api\.cboe\.com\/api\/global\/us_indices\/daily_prices\/(?:VIX|SPX)_History\.csv(?:[?#]|$)/],
    jobs: ["prices", "backfill-prices", "backfill-index-history"], screens: ["總覽", "走勢", "下月展望", "資料來源"],
    fields: [{ name: "DATE／SPX", usage: "SPX 收盤交叉核對與窗口前歷史。" }, { name: "DATE／OPEN／HIGH／LOW／CLOSE", usage: "VIX 主價與窗口前歷史。" }],
    disableImpact: "VIX 主價、SPX 核對與更早指數歷史停止更新；影響總覽品質、走勢與展望輸入。回補十年日線的最後一段（VIX／SPX）也會受影響。",
    rights: {
      automatedAcquisition: { status: "未取得（條款限制）", basis: "§2 只列個人非商業一份下載的有限用途，其他用途原則須書面同意。" },
      storage: { status: "未取得（條款限制）", basis: "§2 電子保存原則須事前書面同意，另有法定 fair-use 例外，本站不判定適用。" },
      publicDisplay: { status: "未取得（條款限制）", basis: "§2 顯示與散布原則須書面同意；CSV 可下載不等於公開顯示許可。" },
      derivation: { status: "未取得（條款限制）", basis: "§2 衍生及用來『核對或更正他源資料』原則須書面同意，含 fair-use 例外。" },
      aiProcessing: { status: "未查", basis: "已核實一般保存與衍生限制，未另核實 AI 專項許可。" },
    },
    terms: [{ name: "Cboe Terms and Conditions", url: "https://www.cboe.com/terms/", versionDate: "2022-11-16", versionNote: "V-B #12 親讀頁首版本日與 §2。" }],
    evidence: [...RESEARCH.evidence, "src/lib/sources/cboe.ts", "src/server/jobs.ts"],
    notes: ["SPX 交叉核對也在條款列舉用途內；未確認 daily CSV 專屬許可或本專案特約，不作違法判定。"],
  },
  {
    ...RESEARCH, id: "nasdaq-quote", name: "Nasdaq 歷史行情核對", runtime: "worker",
    patterns: [/^https:\/\/api\.nasdaq\.com\/api\/quote\/[^/?#]+\/historical(?:[?#]|$)/],
    jobs: ["crosscheck", "backfill-checks", "addWatchSymbol"], screens: ["總覽", "走勢", "資料來源"],
    fields: [{ name: "date／close", usage: "個股與 ETF 收盤交叉核對，寫入 prices.check_*，不替換主價。" }],
    disableImpact: "Nasdaq 交叉核對停止更新；個股與 ETF 的主價仍由 Yahoo 取得，核對狀態可能待核對。",
    rights: NASDAQ_RIGHTS, terms: NASDAQ_TERMS,
    evidence: [...RESEARCH.evidence, "src/lib/sources/nasdaq.ts fetchNasdaqHistorical", "src/server/repo.ts applyCrossChecks"],
    notes: ["非官方網站端點；使用點號股類代號。"],
  },
  {
    ...RESEARCH, id: "nasdaq-news", name: "Nasdaq 新聞", runtime: "worker",
    patterns: [/^https:\/\/www\.nasdaq\.com\/api\/news\/topic\/articlebysymbol(?:[?#]|$)/],
    jobs: ["news", "本機 scripts/ai-batch.ts translate／daily"], screens: ["總覽新聞與摘要", "新聞", "公司重點"],
    fields: [{ name: "id／title／url／publisher／created／description／primarysymbol", usage: "新聞連結、標題、發布資訊、摘要與文章主角；亦作本機 AI 翻譯、重點及摘要輸入。" }],
    disableImpact: "新新聞停止匯入，本機翻譯與重點缺少新輸入；既存新聞與摘要保留。",
    rights: NASDAQ_RIGHTS, terms: NASDAQ_TERMS,
    evidence: [...RESEARCH.evidence, "src/lib/sources/nasdaq.ts fetchNasdaqNews", "scripts/ai-batch.ts"],
    notes: ["Worker 取新聞列表；本機 AI 配對正文另列 yahoo-news-local。"],
  },
  {
    ...RESEARCH, id: "nasdaq-analyst", name: "Nasdaq 分析師共識", runtime: "worker",
    patterns: [/^https:\/\/api\.nasdaq\.com\/api\/analyst\/[^/?#]+\/(?:targetprice|earnings-forecast)(?:[?#]|$)/],
    jobs: ["analysts"], screens: ["下月展望的成分股分析師共識"],
    fields: [
      { name: "priceTarget", usage: "平均目標價：顯示中；存為 target_mean。" },
      { name: "lowPriceTarget", usage: "低目標價：顯示中；存為 target_low。" },
      { name: "highPriceTarget", usage: "高目標價：顯示中；存為 target_high。" },
      { name: "buy", usage: "買進家數：顯示中；存為 buy。" },
      { name: "hold", usage: "持有家數：顯示中；存為 hold。" },
      { name: "sell", usage: "賣出家數：顯示中；存為 sell。" },
      { name: "fiscalEnd", usage: "財年：顯示中；存為 fiscal_end。" },
      { name: "consensusEPSForecast", usage: "EPS 共識預估：已存未顯示；存為 eps_forecast。" },
      { name: "noOfEstimates", usage: "估計數：顯示中；存為 estimates。" },
      { name: "up", usage: "上修次數：彙總與逐股顯示中；存為 eps_up。" },
      { name: "down", usage: "下修次數：彙總與逐股顯示中；存為 eps_down。" },
    ],
    disableImpact: "目標價、買／持／賣家數、EPS 共識與修正次數停止更新；共識隱含漲幅與修正廣度缺少新輸入。",
    rights: NASDAQ_RIGHTS, terms: NASDAQ_TERMS,
    evidence: [...RESEARCH.evidence, "src/lib/sources/nasdaq.ts:203-219（spec 基準；現行 parseAnalystView／fetchAnalystView）", "src/server/jobs.ts jobAnalysts 寫入 analyst_views", "db/schema.ts analystViews", "pages/outlook.tsx"],
    notes: ["上述欄位已在抓、已存於 analyst_views；取得與保存的條款狀態與現用欄位相同。", "targetprice 取目標價與 buy／hold／sell；earnings-forecast 取年度 EPS 列。歷月共識未抓取、未保存。"],
  },
  {
    ...RESEARCH, id: "nasdaq-earnings", name: "Nasdaq 財報日程（含 Zacks 推估）", runtime: "worker",
    patterns: [/^https:\/\/api\.nasdaq\.com\/api\/calendar\/earnings(?:[?#]|$)/, /^https:\/\/api\.nasdaq\.com\/api\/analyst\/[^/?#]+\/earnings-date(?:[?#]|$)/],
    jobs: ["events"], screens: ["總覽日曆", "事件日曆", "今日事件推播"],
    fields: [{ name: "symbol／date／time", usage: "Nasdaq 財報日曆的代號、日期與盤前／盤後時段。" }, { name: "announcement／reportText", usage: "earnings-date 的財報日文字與推估依據，包含 Zacks 演算法推估。" }],
    disableImpact: "財報日曆與補抓日期停止更新，日曆及事件推播缺少新財報日期；內建總經日期不受此來源控制。",
    rights: NASDAQ_RIGHTS,
    terms: [...NASDAQ_TERMS, { name: "Zacks Terms of Service（間接供應商）", url: "https://www.zacks.com/terms_of_service", versionDate: "2025-02-19", versionNote: "V-B #15 讀到更新日；限制自動擷取、再傳、發布與顯示，轉授權仍待確認。" }],
    evidence: [...RESEARCH.evidence, "src/lib/sources/nasdaq.ts fetchEarningsDate／fetchEarningsCalendar"],
    notes: ["本站沒有直接抓 Zacks；由 Nasdaq earnings-date 取得，不代表已取得 Zacks 轉授權，也不據此判定違反直接抓取條款。Nasdaq §8 要求注意第三方條款。"],
  },
  {
    ...RESEARCH, id: "ssga-holdings", name: "SSGA SPY 每日持股", runtime: "worker",
    patterns: [/^https:\/\/www\.ssga\.com\/library-content\/products\/fund-data\/etfs\/us\/holdings-daily-us-en-spy\.xlsx(?:[?#]|$)/],
    jobs: ["weights"], screens: ["總覽歸因", "觀察名單與重疊預覽", "下月展望共識", "資料來源"],
    fields: [{ name: "as_of／ticker／name／weight_pct／shares", usage: "SPY 持股日期、代號、名稱、權重與股數。" }],
    disableImpact: "持股權重與可選成分股停止更新；歸因、名單權重、分析師輪替與共識加權沿用舊資料。",
    rights: {
      automatedAcquisition: { status: "未查", basis: "Access／Restrictions on use 已核實，但對公開 XLSX 自動下載的具體適用仍待確認。" },
      storage: { status: "未取得（條款限制）", basis: "Access 只列個人列印與組織內部合理副本等有限用途；本站歷史保存待確認。" },
      publicDisplay: { status: "未取得（條款限制）", basis: "Restrictions on use 限制對外發布、再傳；不得替代必要的 supplier 授權。" },
      derivation: { status: "未查", basis: "免費持股檔不是歸因或衍生服務的明示許可，未確認涵蓋本站計算的授權。" },
      aiProcessing: { status: "未查", basis: "本輪未核實 AI 專項權利；不能由可下載推定許可。" },
    },
    terms: [{ name: "SSGA 美國站 Terms and Conditions", url: "https://www.ssga.com/us/en/footer/terms-and-conditions", versionDate: null, versionNote: "研究未見明確修訂日；使用美國站版本，未拿其他地區條款替代。" }],
    evidence: [...RESEARCH.evidence, "src/lib/sources/ssga.ts", "src/server/jobs.ts jobWeights"],
    notes: ["remote access／customer 措辭對公開 XLSX 的具體適用仍待人判斷。"],
  },
  {
    ...RESEARCH, id: "factset-insight", name: "FactSet Earnings Insight 週報", runtime: "worker",
    patterns: [/^https:\/\/www\.factset\.com\/earningsinsight(?:[?#]|$)/, /^https:\/\/advantage\.factset\.com\/[^?#]+\.pdf(?:[?#]|$)/],
    jobs: ["factset"], screens: ["下月展望的 FactSet 背景統計"],
    fields: [{ name: "reportDate／pdfUrl／bottomUpTarget／upsidePct／referenceClose", usage: "報告日期、PDF 連結、由下而上目標價、隱含漲幅與參考收盤。" }, { name: "buyPct／holdPct／sellPct／forwardPE／forwardPE5y／forwardPE10y", usage: "買／持／賣占比、預估本益比與五年／十年平均。" }],
    disableImpact: "停止尋找與解析新週報；下月展望沿用已存的 FactSet 背景。",
    rights: {
      automatedAcquisition: { status: "未取得（條款限制）", basis: "Acceptable Use 限制未經同意的自動擷取、scraping 與 scripting。" },
      storage: { status: "未取得（條款限制）", basis: "License 限個人非商業單份下載，限制未經許可複製；未取得本站歷史保存特約。" },
      publicDisplay: { status: "未取得（條款限制）", basis: "License 限制未經許可複製與散布；免費週報不等於再展示許可。" },
      derivation: { status: "未取得（條款限制）", basis: "Acceptable Use 限制修改、翻譯與衍生；未取得 PDF 特別授權。" },
      aiProcessing: { status: "未查", basis: "已核實一般擷取與衍生限制，未另核實 AI 專項許可。" },
    },
    terms: [{ name: "FactSet Legal → Terms of Use", url: "https://www.factset.com/legal", versionDate: null, versionNote: "研究展開 Terms of Use 讀到 License／Acceptable Use，未見明確修訂日。" }],
    evidence: [...RESEARCH.evidence, "src/lib/sources/factset.ts"],
    notes: ["先讀 www.factset.com/earningsinsight 的轉址，再取 advantage.factset.com PDF；PDF 特別法律註記與本專案契約未確認。"],
  },
  {
    ...RESEARCH, id: "yahoo-news-local", name: "Yahoo 新聞搜尋與配對正文（本機）", runtime: "local",
    patterns: [/^https:\/\/query2\.finance\.yahoo\.com\/v1\/finance\/search(?:[?#]|$)/, /^https:\/\/finance\.yahoo\.com\/(?:news|markets\/[^?#]*articles)\/[^?#]+/],
    jobs: ["本機 scripts/ai-batch.ts pull／daily"], screens: ["新聞翻譯與重點", "總覽與公司摘要"],
    fields: [{ name: "title／link／articleText", usage: "依代號搜尋新聞，以標題配對轉載，取得文章正文供本機 AI 處理。" }],
    disableImpact: "Worker 開關管不到；需停止或調整本機排程／scripts/ai-batch.ts，否則正文請求仍會執行。停用後公司新聞重點缺少正文。",
    rights: YAHOO_RIGHTS, terms: YAHOO_TERMS,
    evidence: [...RESEARCH.evidence, "scripts/ai-batch.ts searchYahoo／article", "docs/research-2026-10-27/results/P4-data-sources.md"],
    notes: ["沿前輪 2026-08-04 版，本輪未重核；轉載不代表原作者權利已轉授權。", "配對文章 link 只檢查 HTTPS，可能指向非 Yahoo 網站；原作者與轉載者的條款尚未逐一查核。patterns 只辨識已知 Yahoo 路徑，不將所有 HTTPS 網址歸為此來源。"],
  },
  {
    ...RESEARCH, id: "nyse-calendar", name: "NYSE 休市與交易時段（內建）", runtime: "static", patterns: [],
    jobs: ["內建 calendar", "prices／crosscheck／forecast 的交易日判斷"], screens: ["總覽", "走勢", "下月展望", "資料來源"],
    fields: [{ name: "holidays／earlyCloses／coverageStart／coverageEnd", usage: "交易日、休市日、提早收盤與覆蓋範圍；來源為 NYSE hours-calendars。" }],
    disableImpact: "沒有執行時請求可關；移除內建日曆會影響交易日與資料新鮮度判斷，需另行修改程式。",
    rights: UNREVIEWED_RIGHTS,
    terms: [{ name: "NYSE 一般條款（未查）", url: null, versionDate: null, versionNote: "本輪只核對交易時段原頁，未查一般條款網址與版本日。" }],
    evidence: [...RESEARCH.evidence, "src/lib/calendar.ts NYSE_CALENDAR", "https://www.nyse.com/markets/hours-calendars"],
    notes: ["程式內建日期，不是自動抓取 NYSE；不能以 Fed 的 public-domain 聲明代替 NYSE 權利。"],
  },
  {
    ...RESEARCH, id: "fed-fomc", name: "聯準會 FOMC 日程（內建）", runtime: "static", patterns: [],
    jobs: ["events（內建日期）"], screens: ["總覽日曆", "事件日曆", "今日事件推播"],
    fields: [{ name: "date／title／sourceUrl", usage: "FOMC 決議日期與來源連結，不含官方標誌。" }],
    disableImpact: "沒有執行時請求可關；需修改內建日程才會停止新增 FOMC 事件，既存事件保留。",
    rights: {
      ...UNREVIEWED_RIGHTS,
      storage: { status: "官方公開，需標示來源", basis: "Fed disclaimer：除另標者外 Board 資訊屬 public domain，可複製散布並需註明來源。" },
      publicDisplay: { status: "官方公開，需標示來源", basis: "Fed disclaimer 允許複製散布 Board 資訊並需註明來源；第三方素材與官方標誌另有權利。" },
      derivation: { status: "官方公開，需標示來源", basis: "Fed disclaimer 的 public-domain 聲明適用 Board 資訊，本站只採日期與文字，保留來源。" },
    },
    terms: [{ name: "Federal Reserve Disclaimer", url: "https://www.federalreserve.gov/disclaimer.htm", versionDate: null, versionNote: "研究核實 public-domain 與來源標示條文，未核實條款版本日。" }],
    evidence: [...RESEARCH.evidence, "src/lib/calendar.ts", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"],
    notes: ["只抄日期與文字，勿以 seal／logo 暗示官方認可。"],
  },
  {
    ...RESEARCH, id: "bls-schedule", name: "BLS CPI／非農日程（內建）", runtime: "static", patterns: [],
    jobs: ["events（內建日期）"], screens: ["總覽日曆", "事件日曆", "今日事件推播"],
    fields: [{ name: "date／title／sourceUrl", usage: "CPI 與 Employment Situation 公布日期及來源連結。" }],
    disableImpact: "沒有執行時請求可關；需修改內建日程才會停止新增 CPI／非農事件，既存事件保留。",
    rights: UNREVIEWED_RIGHTS,
    terms: [{ name: "BLS 條款（未查）", url: null, versionDate: null, versionNote: "本輪未重查 BLS 條款、條款網址與完整日程，版本日未核實。" }],
    evidence: [...RESEARCH.evidence, "src/lib/calendar.ts", "https://www.bls.gov/schedule/news_release/cpi.htm", "https://www.bls.gov/schedule/news_release/empsit.htm"],
    notes: ["內建日程不代表每日重新查核；不能套用 Fed 聲明。"],
  },
  {
    ...RESEARCH, id: "etf-catalog", name: "ETF 發行商基本資料（人工）", runtime: "manual", patterns: [],
    jobs: ["人工維護 src/lib/universe.ts"], screens: ["ETF 比較", "定投試算"],
    fields: [{ name: "ticker／name／issuer／multiple／grossFeePct／netFeePct／aumUsd／aumAsOf／sourceUrl", usage: "發行商官網的 ETF 名稱、倍數、費用與資產規模等靜態事實。" }],
    disableImpact: "沒有執行時請求可關；需人工移除或更新目錄，否則 ETF 頁仍使用既存資料。",
    rights: UNREVIEWED_RIGHTS,
    terms: [{ name: "各 ETF 發行商條款（未逐一查）", url: null, versionDate: null, versionNote: "各發行商條款網址與版本日尚未逐一查核；單筆來源連結見 universe.ts。" }],
    evidence: [...RESEARCH.evidence, "src/lib/universe.ts ETFS"],
    notes: ["人工查核與公開產品頁不等於已取得再散布或衍生授權。"],
  },
  {
    ...RESEARCH, id: "strategists", name: "投行策略師目標表（人工）", runtime: "manual", patterns: [],
    jobs: ["人工維護 src/lib/strategists.ts"], screens: ["下月展望的投行策略師目標表"],
    fields: [{ name: "firm／institution／department／target／targetLow／targetHigh／horizon／asOf／sourceUrl／verified", usage: "機構原文或媒體報導的年底目標、區間、期限與查核標記。" }],
    disableImpact: "沒有執行時請求可關；需人工移除或更新表格，否則下月展望仍顯示既存資料。",
    rights: UNREVIEWED_RIGHTS,
    terms: [{ name: "各機構與媒體條款（未逐一查）", url: null, versionDate: null, versionNote: "各原文機構、媒體與轉載者的條款網址及版本日未逐一查核。" }],
    evidence: [...RESEARCH.evidence, "src/lib/strategists.ts"],
    notes: ["是否已核對原文是資料查核標記，不是授權標記；目標表不進方向預測模型。"],
  },
];

export function sourceForUrl(url: string): SourceRegistryEntry | undefined {
  return SOURCE_REGISTRY.find((source) => source.patterns.some((pattern) => pattern.test(url)));
}
