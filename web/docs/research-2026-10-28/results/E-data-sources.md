# 任務 E：個股、ETF、權重、基本面、新聞與總經資料源

研究日：2026-10-28（台灣時間）。結論：**先取得個股與 ETF 日線的公開顯示授權，優先補 SEC 申報溯源與官方公布日程；沒有核實到本題所列來源中，可免費直接取代 Yahoo、又同時允許本站公開顯示與永久保存的完整行情方案。**「開放下載」「API 免費」「網站不收費」都不能代替顯示或再散布授權。

## 範圍、日期與證據讀法

- 已讀 `README.md`、`web/docs/forecast.md` 的既有研究與事前登記，以及 `web/docs/research-2026-10-27/proposal.md` 的排除清單與下一輪問題。本報告不重做指數層級資料源、戰術指標或預測文獻整理。
- **下列所有價格、額度、歷史深度、更新時點、條款狀態，除另註外，一律是 2026-10-28 查閱的官方頁面現況。** 每列附一手網址；「未標日期」表示條款沒有可辨識的版本日期，不能把查閱日當成生效日。美元價格均為 USD，不是已取得的商務報價。
- HTTP 狀態、大小、轉址及欄位是本機於 2026-10-28 的少量 curl 實測，完整方法見後文。未從 Cloudflare Worker 執行，也沒有使用瀏覽器 cookie；本機成功不等於 Worker 出口成功。
- 本輪沒有回測、沒有價格品質的歷史統計、沒有權重誤差計算，沒有碰正式站管理 API。只讀程式與公開文件，只寫本檔。
- **預測證據等級一律為 `none`，結果為「未檢驗，不能判正／零／負」**，除非特別列出其他證據。本輪沒有對任何來源提出「能預測股價／提高投資報酬」的正面主張。適用期限、資產與橫斷面選股：均無受檢驗的預測設定；資料涵蓋範圍會另列。端點可用與條款允許是資料事實，不是 `independently_tested` 的預測績效。

## 目前程式中真正需要替換的位置

以下位置均已親自開檔確認，讀取日為 2026-10-28：

| 用途 | 已確認的位置 | 對選源的影響 |
| --- | --- | --- |
| 單檔歷史、近期批次價格 | `web/src/lib/sources/yahoo.ts:5`、`web/src/lib/sources/yahoo.ts:74`；排程入口 `web/src/server/jobs.ts:114`、`web/src/server/jobs.ts:130` | 不能只換網址；批次能力、拆股處理、時間戳與修訂行為都不同。 |
| 價格語意 | `web/src/lib/sources/yahoo.ts:24` | 現有註解明定 `close` 為拆股調整後、不含股息；供應商的 `adjusted close` 可能連股息都調整，不能直接塞進同一欄。這是目前 source 的定義，本輪未另外核對 Yahoo 全歷史。 |
| SPY 權重 | `web/src/lib/sources/ssga.ts:5`、`web/src/lib/sources/ssga.ts:48`、`web/src/lib/sources/ssga.ts:79` | 解析器綁定 XLSX 及 `Weight`；IVV 新 CSV 的欄名已不同，不能當成同格式備援。 |
| 分析師預估 | `web/src/lib/sources/nasdaq.ts:203`、`web/src/lib/sources/nasdaq.ts:224` | 需要目標價、評等分布及 EPS 上下修家數；單有 recommendation trends 不足以替換。 |
| 分析師所用股價 | `web/src/server/jobs.ts:630` | 換掉主要收盤管線後，這個 Yahoo 呼叫也要處理，否則依賴仍在。 |
| 共識彙總 | `web/src/lib/consensus.ts:30`、`web/src/server/jobs.ts:642` | 當日 `as_of` 是本站抓取日期；不代表供應商的研究發布時間，更不是歷史 consensus vintage。 |
| 財報與新聞 | `web/src/lib/sources/nasdaq.ts:79`、`web/src/lib/sources/nasdaq.ts:132`、`web/src/lib/sources/nasdaq.ts:168` | Nasdaq 頁面端點沒有正式 API 合約或 SLA；財報「已確認」與「推估」仍應區分。 |
| 本機新聞正文 | `web/scripts/ai-batch.ts:94`、`web/scripts/ai-batch.ts:107` | 會搜尋 Yahoo 轉載頁；只換 Worker 新聞標題來源，仍沒有解除正文與摘要的權利問題。 |
| HTTP 預算、UA 與轉址 | `web/src/lib/sources/http.ts:55`、`web/src/server/jobs.ts:43` | 每跳都扣 budget；目前通用 UA 模仿瀏覽器。SEC 應用具聯絡方式的宣告 UA，不能照搬通用設定。 |

## 十類的首選與備援

這裡的「首選」是針對本 App 的取得路徑，不表示已獲授權或現在可以上線。

| 類別 | 首選 | 備援／不採用時怎麼辦 | 每日 Worker 或本機 |
| --- | --- | --- | --- |
| 個股、ETF 日線 | Tiingo **Display Redistribution** 詢價與合約確認 | Massive Business 報價；免費 Stooq 不能當已授權備援 | 授權後 REST 可每日 Worker；大量回補本機 |
| 基本面、財報 8-K | SEC submissions + companyfacts／companyconcept + 原始申報 | SEC Financial Statement Data Sets；公司 IR 原文供人工核對 | 增量 Worker；bulk ZIP 本機 |
| Form 4、13F | EDGAR 原始 XML + accession／接受時間 | SEC 結構化批次資料集 | 少量增量 Worker；跨管理人、長歷史本機 |
| 分析師預估、評等 | FMP 商務顯示授權與欄位樣本確認 | Finnhub 商務授權；沒預算就保留缺資料狀態，不用免費層硬補 | 授權後 Worker 輪替；歷史 vintage 另議 |
| 指數權重近似 | SSGA SPY，先補公開使用權確認 | IVV 最新持股 CSV 作交叉來源；VOO 作人工核對 | SPY／IVV 可 Worker；不是官方 SPX 權重 |
| 放空 | FINRA consolidatedShortInterest | FINRA Reg SHO daily 作另一種觀察資料，**不互相代替** | 小範圍 API／每日檔 Worker；全歷史本機 |
| 選擇權／財報隱含波動 | 本輪先不新增公開數字；付費需求先詢 Cboe 授權 | 有商務授權的 Massive options；免費頁面只作人讀查閱 | 授權、需求成立後才建；不爬 delayed quote 頁 |
| 財報日曆／逐字稿 | 公司 IR 公告確認日程；逐字稿連回公司發布版本 | 日曆：有授權的 Finnhub／FMP；逐字稿：有再利用授權的供應商 | 少數 IR 來源 Worker；HTML／PDF 逐字稿本機處理 |
| 總經與公布日程 | 原發布機構 BLS／BEA／Fed；BLS ICS | ALFRED 提供可取得的 vintage；日程用官方 HTML 核對 | 小範圍 Worker；GDPNow 工作簿與大批回補本機 |
| 新聞 | SEC 官方消息、公司公告的事實與來源連結 | GDELT 發現新聞連結；付費新聞 feed 另詢顯示及 AI 使用權 | Worker 抓 metadata；已確認可處理的正文走本機 |

## 個股與 ETF 日線替代

### 取得、額度、歷史與 Worker 適配

以下 URL 的 `<KEY>`、`{symbol}`、`{date}` 是文件占位符，本輪沒有申請或使用任何私人 key。

| 來源與端點 | key／免費額度與歷史 | 更新、修訂與 point-in-time | Worker 判斷與結論 |
| --- | --- | --- | --- |
| **Stooq**：`https://stooq.com/q/d/l/?s=aapl.us&i=d&d1=20261026&d2=20261027`；[歷史頁](https://stooq.com/q/d/?s=aapl.us)、[條款入口](https://stooq.com/t/) | 常見下載路徑不帶 key，但本次只有 JS challenge；免費速率、逐檔歷史起點均**未核實**。 | 更新 SLA、拆股／股息調整方式、歷史修訂版本均未核實，不能宣稱 PIT。 | 本次 HTTP 成功碼實際是驗證 HTML。不建議 Worker；本機也不能把可下載推成可公開再散布。 |
| **Tiingo**：`https://api.tiingo.com/tiingo/daily/{symbol}/prices?startDate={date}&token=<KEY>`；[EOD 文件](https://www.tiingo.com/documentation/end-of-day)、[價格](https://www.tiingo.com/about/pricing)、[產品](https://www.tiingo.com/products/end-of-day-stock-price-data) | 需 key。Starter：每小時 50、每日 1,000 requests、每月 500 symbols／1 GB；價格頁稱 30+ 年，產品 summary 稱最早 1962 年，單檔以 metadata `startDate` 為準，不能假定全部都有。 | 文件稱多數美股／ETF 17:30 EST 可得，晚間至 20:00 EST 收更正；原文使用 EST，不能直接當全年 UTC 固定點。raw 與 split/dividend adjusted 並存；歷史會更正，普通 API 不是當時收到版本的 archive。 | 小範圍 REST 適合 Worker，初始多檔回補受小時額度限制；本輪未用 key 實測。**首選詢價對象**，原因是公開列出 display redistribution，而非免費層便宜。 |
| **Alpha Vantage**：`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&apikey=<KEY>`；[文件](https://www.alphavantage.co/documentation/)、[支援／額度](https://www.alphavantage.co/support/) | 需 key；每日 25 requests。daily compact 最新 100 點可用免費 key；full 25+ 年須 premium；`TIME_SERIES_DAILY_ADJUSTED` 的 entitlement 另看文件，不能當免費承諾。 | EOD／即時／延遲取決於 endpoint 與 entitlement，未找到 daily 免費層明確發布時鐘；adjusted 會含公司行動，非 vintage。 | JSON／CSV 適合 Worker，但免費深度與每日額度不適合本站的歷史及聯集需求；沒做有 key 的測試。 |
| **Massive（原 Polygon）**：`https://api.massive.com/v2/aggs/ticker/AAPL/range/1/day/{from}/{to}?adjusted=true&apiKey=<KEY>`；[custom bars](https://massive.com/docs/rest/stocks/aggregates/custom-bars)、[價格](https://massive.com/pricing?product=stocks) | 需 key；Basic 每分鐘 5 calls、最近 2 年、EOD；其他方案的歷史深度不同。這些是 Individual 方案，非本站報價。 | 由合格交易建 bars；有公司行動及更正，不提供「某日當時 API 看見什麼」的保證。`adjusted` 的公司行動範圍須與本站語意逐欄確認。 | REST、日期篩選友善；whole-market daily summary 可減少上游請求，但 payload 大，須先取得具體授權及樣本。本輪未測 key／實際大小。商務備援。 |
| **EODHD**：`https://eodhd.com/api/eod/AAPL.US?from={date}&api_token=<KEY>&fmt=json`；[EOD 文件](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes)、[價格](https://eodhd.com/pricing)、[limits](https://eodhd.com/financial-apis/api-limits) | 需 key。價格表：Free 每日 20 calls、每分鐘 20 requests、EOD 1 年；付費標 30+ 年，逐檔不同。limits 通用頁卻寫預設每分鐘 1,000，**與 Free 價格表不一致**；免費層依較明確的 plan 欄，實際以 key headers／書面回覆確認。 | EOD 文件稱美國主要交易所收盤後 15 分鐘內，其他市場通常較晚；仍有後續修訂。文件與頁尾對市場資料有 indicative／非交易所 feed 的概括聲明；**不能當官方收盤的獨立驗證源，須先釐清 EOD 資料血緣**。 | JSON、bulk 友善，但一個 bulk HTTP request 不等於一個計費 call。免費層不夠；商用權及原始價性質未釐清，不列最先替換。 |
| **Financial Modeling Prep（FMP）**：`https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=AAPL&apikey=<KEY>`；[文件](https://site.financialmodelingprep.com/developer/docs)、[價格](https://site.financialmodelingprep.com/pricing-plans) | 需 key；Basic 每日 250 calls、滾動月頻寬 500 MB。Starter 標最多 5 年，Premium 最多 30 年；**Basic 的逐檔歷史起點及免費 endpoint/symbol 範圍未以帳號核實**。 | EOD 可用；精確發布 SLA 未核實。歷史及標準化財報可能修訂，不等於 PIT。 | REST 適合 Worker，先拿 plan entitlement、批次能力與資料樣本；不把網站的所有文件範例當免費權限。 |
| **Finnhub**：`https://finnhub.io/api/v1/stock/candle?symbol=AAPL&resolution=D&from={unix}&to={unix}&token=<KEY>`；[價格](https://finnhub.io/pricing)、[Candles 文件](https://finnhub.io/docs/api/stock-candles) | 需 key；Free 每分鐘 60 calls，但官方頁 **Candles (OHLCV) 標 Premium，Free OHLC 欄打叉**；不是免費日線替代。付費產品列 30+ 年，逐檔／市場另議。 | 不同 feed 的延遲不同；未核實付費日線固定發布時鐘。歷史修訂，非 vintage。 | API 結構友善、無需 browser cookie，但本輪沒有 key，不能宣稱實測可用。 |
| **Nasdaq Data Link**：付費 Sharadar SEP 例：`https://data.nasdaq.com/api/v3/datatables/SHARADAR/SEP.json?ticker=AAPL&api_key=<KEY>`；[資料庫](https://data.nasdaq.com/databases/SEP)、[平台條款](https://data.nasdaq.com/terms) | 資料庫與 API 家族各有 entitlement。官方資料庫／docs 本次僅 JS shell、載入畫面或不可讀；SEP 最新價格、歷史起點、免費額度及 rate limit **未核實**。不抄網路常見的通用配額。 | SEP、EOD、Nasdaq Basic 是不同產品；不能互借延遲、歷史或 PIT 宣稱。 | 正式 API 理論上適合 Worker，bulk export 適合本機；目前缺產品合約及可讀規格，優先序落後。 |
| **Cboe 官方 DataShop**：[Equity EOD Summary](https://datashop.cboe.com/equity-eod-summary) | 購買產品／交付憑證，不是免 key 公開日線 API；免費完整額度無。官方列歷史自 2010-01，daily file delivery。 | 涵蓋美國上市股票／ETF 的 regular trading hours，close 是該時段最後成交；另有 primary exchange open/close marks，不能混成同一概念。一般交付非接收版本的 PIT。 | 正式 nightly file 可當授權後方案；全市場檔本機先整理。不用公開 delayed quotes 頁替代。 |
| **交易所官方**：[NYSE Daily TAQ](https://www.nyse.com/data-products/catalog/daily-taq)、[Nasdaq Daily Market Summary](https://www.nasdaqtrader.com/Trader.aspx?id=DailyMarketSummary) | NYSE TAQ 為購買產品，自 1993 年；Nasdaq 公開 daily summary 是市場統計，不能當各股可用歷史 OHLC feed。未核實低價且含公開顯示權的官方全市場 EOD 合約。 | TAQ 是交易／報價事件資料，不是可直接塞進日線表的調整價；通常交付前一交易日。 | TAQ 檔案及彙整成本不適合本 App 每日 Worker；必要時本機 ETL，且資料及 redistribution 合約另外處理。 |

### 授權不是免費額度的附屬品

| 來源 | 官方條款、版本日期與本 App 的判斷 |
| --- | --- |
| Tiingo | [Terms of Use](https://app.tiingo.com/tos/)：生效日 2022-01-16，最近更新 **2026-10-06**。Starter／Trial 不許持久保存資料或 Derived Products；付費停止後有刪除義務。可重建價格的轉換與序列不能藉「衍生」規避。現有 cross-check 也不能假定免費許可。產品頁列 EOD + IEX Display Redistribution：startup **$250／月**、enterprise **$500／月**；internal commercial **$50／月**不是公開顯示權。須確認網站、iOS、推播、保存與解約後保留權。 |
| Alpha Vantage | [Terms](https://www.alphavantage.co/terms_of_service/)：PDF 未標統一版本日期；EULA 生效與接受註冊相關。預設 personal/non-commercial，提供他人直接或間接存取超出私人用途需另議。本站開放註冊，不能用免費 key 就視為符合。 |
| Massive | [Individuals](https://massive.com/legal/individuals-terms-of-service)：更新 2025-07-18；[Businesses](https://massive.com/legal/businesses-terms-of-service)：更新 **2026-10-06**。Business 條款容許在已購 entitlement 與第三方條款下對 Edge Users 顯示；**不是買任何 Business SKU 就可任意轉售原始資料**。歷史、衍生與終止保存權仍須看 Order Form。 |
| EODHD | [Terms](https://eodhd.com/financial-apis/terms-conditions)：未標版本日期。Personal 明文禁止展示、再傳輸、再散布及重新包裝後提供他人；需 Commercial 授權。不能把低價 personal EOD 訂閱當本站價格。 |
| FMP | [Terms](https://site.financialmodelingprep.com/terms-of-service)：更新 **2023-08-01**；[價格頁](https://site.financialmodelingprep.com/pricing-plans)直接寫顯示／再散布需特定 **Data Display and Licensing Agreement**。Basic 配額不含這張許可。 |
| Finnhub | [Terms](https://finnhub.io/terms-of-service)：未標版本日期。未經書面同意，不可分享 data **或 derived results**；網站列示方案預設 personal；停訂有資料刪除要求。Free recommendation 的可呼叫性不解決公開顯示。 |
| Nasdaq Data Link | [Terms](https://data.nasdaq.com/terms)：本次可讀文本未見可明確辨認的統一版日。須遵守 Order Form 與第三方資料條款；平台帳號不自動授權把資料放進 SaaS／公開資料庫。**特定 SEP 合約未核實**。 |
| Stooq | [條款入口](https://stooq.com/t/)只見 JS 驗證；版本及 redistribution 權利 **未核實**。沒有把二手使用教學當授權。 |
| Cboe | [網站 Terms](https://www.cboe.com/terms/)更新 **2022-11-16**；個人下載許可不是對外顯示許可，條款還限制拿資料核對／修正其他資料。DataShop 應以購買時資料合約為準，不能拿網站 Terms 當完整的商用授權書。 |
| NYSE／Nasdaq 交易所 feed | [NYSE data policies/contracts](https://www.nyse.com/market-data/agreements)、[Nasdaq agreements](https://www.nasdaqtrader.com/Trader.aspx?id=MarketDataAgreements)。各產品、CTA／UTP 與 redistribution 條款分開，沒有單一通用版日；**本 App 所需合約、總費用未核實**。 |

**日線選型結論：** 先把目前真正顯示的個股／ETF 價格、歷史、點數歸因、推播與 derived outputs 列成同一份需求詢 Tiingo；以 Massive Business 作比較報價。這是根據可取得授權規格的工程優先序，**沒有證明兩者哪個歷史品質較佳**。Stooq 目前連無 cookie 的資料回應都未成功，不能稱作穩定免費替代。

## SEC 基本面與財報 8-K

### 端點與可取得範圍

官方文件：[EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)（頁面日期 2024-06-06）、[Developer Resources](https://www.sec.gov/about/developer-resources)（最近檢視 2025-03-10）、[Accessing EDGAR Data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)。本節資料與規格查閱日均為 2026-10-28。

| 資料 | 端點 | key、額度、歷史與更新 | Worker／本機 |
| --- | --- | --- | --- |
| 申報清單 | `https://data.sec.gov/submissions/CIK0000320193.json` | 無 key、免費；同一使用者所有機器合計最多每秒 10 requests。recent 至少涵蓋一年或最近 1,000 件，較舊部分由 `filings.files` 指向。EDGAR 索引自 1994Q3。申報傳播時更新，不是每天固定收盤。 | 小範圍 JSON 適合增量輪替；本次本機被擋，見實測。 |
| 全公司 XBRL | `https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json` | 無 key，與 SEC 共用 fair access。XBRL 強制申報自 2009 年起陸續適用；**不代表每個公司／tag 自該年都有**。日間更新；全量 ZIP 約每日 03:00 ET 更新。 | 單公司可能很大；持有 CIK／accession 後按變動抓，不要每位使用者開頁就抓。 |
| 單一概念 | `https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/Assets.json` | 同上；只回指定 taxonomy/tag 各單位的 facts。 | 若只顯示少數基本面欄位，可減小單次解析負擔；但 tag 數變多會增加子請求。 |
| 跨公司 frames | `https://data.sec.gov/api/xbrl/frames/us-gaap/Assets/USD/CY2025Q4I.json` | 同上；**選最接近日曆區間、最後申報的 fact**，沒有 `asOf` vintage 查詢承諾。 | 可顯示目前截面；不適合回溯「當時知道的截面」。本輪未抓該示例，也不據它計算。 |
| 原始 8-K／附件 | `https://www.sec.gov/Archives/edgar/data/{CIK}/{accession去連字號}/{primaryDocument}`；同目錄 `index.json` 找附件 | 由 submissions 的 accession／primaryDocument 找路徑；有些財報以 8-K Item 2.02 及 Exhibit 99.1 發布，細項未必是 companyfacts 的標準 tag。HTML／inline XBRL／PDF 均可能。 | 先抓申報 metadata；有事件才取文件。本機做長文與附件解析較合適。 |
| 財報批次 | [Financial Statement Data Sets](https://www.sec.gov/data-research/sec-markets-data/financial-statement-data-sets) | 自 **2009-01**，按季更新；as-filed flattened data。官方記錄 **2024-12** 曾重處理歷史資料集，不能把今天下載的 ZIP 誤稱從未變過的歷史封存。 | bulk ZIP 只適合 `web/scripts/` 回補與離線整理，不放日常 Worker。 |

### `filed` 是必要條件，不足以單獨保證 point-in-time

以下是**建議資料定義，沒有執行任何計算**：

- 保留 `CIK, accession, form, taxonomy, tag, unit, start, end, fy, fp, filed, value`，並由 submissions 補接受時間；再加本站 `firstSeenAt`、原文 URL、原始內容版本／解析器版本。觀察期 `end` 是財務期間，不是可用時間。
- 歷史查詢先排除 `filed > decisionDate` 的版本，再依具體 cutoff 的接受／傳播時間選已知 accession；`filed` 只有日期，不能據此把盤後發布數字放回同日開盤或收盤前。若沒有精確可用時間，就標示只能做到日期層級，不能偽造精準 PIT。
- 生產資料以實際首次取得時間約束本站「當時已知」；歷史重建另標「依申報時間重建」，不能用今天第一次回補的時間把所有舊資料說成歷史上本站已經看過。
- 不把重編財報覆蓋舊 accession；新版本自新發布時間起適用。同一 `end` 的 facts 可能是不同期間長度、財年、單位、重編與比較欄；不能取 array 最後一筆當唯一真相。
- `frames` 會取後來申報資訊；不得直接拿最新 frames 回填過去。companyfacts 也只收標準 taxonomy、整個 entity 層級的合格 facts，不能取代分部收入、公司自訂 KPI 或全部 non-GAAP 財報。
- 8-K、IR 新聞稿與 10-Q 的出現時間不同；若產品要顯示「最新已公布財報」，只等 10-Q 可能落後。這是資料可用時間問題，**不是財報公告交易策略**。

**公開使用權：** SEC 提供免費公開存取及程式化下載，但不能把私人公司提交的全部文章、逐字稿、照片或附件當成美國政府創作。數值事實、申報識別與來源連結適合做本 App 的溯源欄位；整份附件的再發布／AI 處理權須另分辨。本判斷依 [SEC 公開存取政策](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)及 [Copyright Act §105](https://www.copyright.gov/title17/92chap1.html#105)對政府作品的範圍；不是 SEC 對所有申報附件的 blanket redistribution license。兩頁不是同一份授權合約，沒有統一條款版日。

**結論：** 基本面首選 SEC 增量 API + 原始申報，備援為官方批次資料集。先服務個股研究與檢討時的事實查閱；不要順便建立估值擇時或個股評分。

## Form 4 與 13F

| 來源 | 端點、key／額度 | 歷史、延遲、PIT | 使用與再散布判斷 |
| --- | --- | --- | --- |
| EDGAR Form 4 原始 XML | 先用前節 submissions／[EDGAR ownership RSS](https://www.sec.gov/about/rss-feeds)辨認 Form 4／4-A，再由 accession 目錄取得 ownership XML。無 key，與 SEC 共用 fair access。 | 交易日不等於申報／公開日；保存 `transactionDate`、接受時間、修正 accession。不能只依交易日回填。需要解讀 transaction code、衍生／非衍生、直接／間接持有、腳註及計畫交易揭露。 | 只做事實與原文連結；資料權利界線同前節。沒有證明 insider flow 是本 App 的買賣訊號。 |
| [Insider Transactions Data Sets](https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets) | 官方季度 ZIP，無 key、免費。 | 官方列 **2006-01 起**；季更新；同一季最後營業日 **17:30 ET** 後申報歸下一批。**2025-07** 曾補更新部分批次欄位。是 as-filed 扁平化資料，不是即時訊號。 | 歷史回補首選；放 `web/scripts/`，不可每次 Worker 解全季 ZIP。 |
| EDGAR 13F-HR／13F-HR-A | 以管理人 CIK 的 submissions 找申報，下載該 accession 的 information table XML；無 key。 | [官方 FAQ](https://www.sec.gov/rules-regulations/staff-guidance/frequently-asked-questions-about-form-13f)：季後 **45 日**內申報，遇假日順延；資料不包含 short equity／short option positions。報表期末不是可交易的揭露日。修正申報、保密處理與共同申報要分辨。 | 個股 issuer CIK 不會直接給「所有持有它的 13F 管理人」；跨管理人彙整需另建索引與證券對照，成本高。 |
| [Form 13F Data Sets](https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets) | 官方 flattened ZIP，無 key、免費。 | **2013-07 起**；季更新，自 **2024-03** 改在 2／5／8／11 月月底後處理前段期間，配合申報到期；曾重處理歷史檔。 | 本機批次最合適。原始 CUSIP 等識別碼到 ticker 的歷史映射仍需資料來源與權利確認，不能用今天 ticker map 冒充歷史。 |

上表規格與數字均查於 2026-10-28，資料集頁／FAQ為一手來源。原始申報與結構化資料集的取得政策同 SEC，未找到另一份有獨立版日的私人內容再發布授權。

**結論：** 原始 XML 為新申報首選，官方 ZIP 為歷史備援。Form 4 可列入觀察名單的「公司申報」，13F 先連回原文；不優先做機構持股排行榜。預測證據 `none`，結果未檢驗；不新增 index insider／short-interest flag，不重開既有排除項。

## 分析師預估與評等：免費層能拿什麼

| 來源 | 端點與免費層 | 歷史／更新／PIT | 授權與取捨 |
| --- | --- | --- | --- |
| Nasdaq 現用 | `https://api.nasdaq.com/api/analyst/AAPL/targetprice`、`.../earnings-forecast`；無 key。官方未公布這組網站端點的免費 quota／SLA。 | 最新值，未核實歷史 vintage API；本站抓取日期不能取代每位分析師報告時間。 | [Nasdaq Legal](https://www.nasdaq.com/legal)更新 **2026-05-11**，限制自動擷取、儲存、分享及 derivative works，亦有 AI／data-analysis software 限制。**現用不等於授權已成立**，不能當長期合法備援。 |
| Zacks | 現用的 Nasdaq earnings-date 推估不能推成 Zacks 有免費通用 estimates API。應走 [Zacks Data](https://www.zacksdata.com/)洽授權；網站／第三方 JS 端點無正式免費保證。 | 免費 quota、全歷史起點、更新 SLA、PIT entitlement **未核實**。 | [網站 Terms 入口](https://www.zacks.com/terms_of_service)只見 bot interruption；版本／全文未核實。[Zacks MCP Terms](https://zacksdata.com/mcp-terms/)更新 **2026-09-23**，禁止系統化建立資料庫／產品；這是 connector 條款，**不能挪作網站 API 授權**。 |
| FMP | `https://financialmodelingprep.com/stable/analyst-estimates?symbol=AAPL&period=annual&apikey=<KEY>`；另見 [Analyst Ratings & Price Targets 文件](https://site.financialmodelingprep.com/developer/docs)。key；每日免費 250 calls 是總配額，不保證每個 estimates／ratings endpoint 對全名單免費。 | 文件例有財年與分析師數；`date` 不能直接當預估發布時間。正式 revision history、歷史 as-of 與精確更新 SLA未核實。 | 前述 Display and Licensing Agreement 必要。**優先詢價及取得樣本**，特別確認與現用 EPS 上下修家數的可比性；有欄位不表示相同定義。 |
| Finnhub | `https://finnhub.io/api/v1/stock/recommendation?symbol=AAPL&token=<KEY>`；[recommendation](https://finnhub.io/docs/api/recommendation-trends)。官方價格頁 Free 有 recommendation trends；[price-target](https://finnhub.io/docs/api/price-target)、EPS Estimates 是 Premium。 | Recommendation 有 period；免費歷史起點與 SLA 未核實。Free EPS surprises 為最近 **4 季**，是 actual-vs-estimate，不是 forward EPS revisions。 | [價格](https://finnhub.io/pricing)與 [Terms](https://finnhub.io/terms-of-service)查於 2026-10-28；免費不能分享原始或 derived results。可當商務洽詢備援，不能無縫補齊 Nasdaq 共識。 |

**結論：** 公開顯示首選是取得 FMP 的特定授權與樣本，備援詢 Finnhub。尚未有核實的「免費、公開、欄位齊全」替代；沒有數字可顯示時就標缺資料。不要把公司 guidance、actual surprise、分析師 estimate 與 revision breadth 混成同一欄，也不要把推薦評等改造成個股買賣建議。

## 指數權重：SPY、IVV、VOO 與 S&P 官方

| 來源 | 端點／取得 | 更新、歷史與 PIT | 條款與 Worker |
| --- | --- | --- | --- |
| **SSGA SPY** | 現用 URL 轉到 `https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx`，無 key／免費下載；無官方數值 rate limit。 | 本次表內 as-of **2026-10-26**；daily 檔會覆寫，沒有核實完整歷史 API。自行保存「持股 as-of」及「首次看到時間」才能描述收到版本。 | XLSX 本次小，Worker 現已有解析器。US 條款路徑本次無法讀取；可讀的 [SSGA 法國站 Terms](https://www.ssga.com/fr/en_gb/footer/terms-and-conditions)限制對外再散布，但不能以它替代 US 合約；**US 持股檔公開使用權未核實，版日未知**。 |
| **iShares IVV** | 官網目前直接提供 `https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv`，無 key。舊 `.ajax?fileType=csv...` 本次回 HTML。 | 本次 CSV as-of **2026-10-26**；最新檔覆寫。產品頁另有部分日期選項，沒有核實任意歷史日均可取得。欄位有 `Market Weight`、`Notional Weight`，含現金／衍生部位時要依欄位定義處理。 | 純文字適合 Worker。本次無 cookie 成功；[BlackRock Terms](https://www.blackrock.com/corporate/compliance/terms-and-conditions)限制 personal/non-commercial，公共或商用再利用需書面同意；未標版日。**不能因 CSV 官方公開就當再散布已授權**。 |
| **Vanguard VOO** | [產品／Portfolio Composition](https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf)；網頁及匯出檔，無核實穩定公開 REST contract。 | 產品頁有不同月末日期；未核實與 SPY／IVV 相同的 daily file SLA、歷史起點或版本 archive。不能把當前網頁月份自動套用到所有下載。 | 適合人工核對，暫不當 Worker 首要備援。[Vanguard Terms](https://advisors.vanguard.com/site/terms-and-conditions)限制複製、顯示與重複自動存取；未標版日，沒有本站公開顯示許可。 |
| **S&P DJI 官方 constituent weights** | [Data & Index Licensing](https://www.spglobal.com/spdji/en/about-us/data-index-licensing/)；[能力文件](https://www.spglobal.com/spdji/en/documents/index-policies/index-data-capabilities-brochure.pdf)：constituents／weights／float／corporate actions，API 或 SFTP／SPICE。 | EOD 及歷史依所購 package；沒有核實免費完整 daily weights API。 | 價格需聯絡 Commercial Services，**取得成本沒有可核實公開報價**。[S&P Terms](https://www.spglobal.com/en/terms-of-use)及 [SPDJI disclaimers](https://www.spglobal.com/spdji/en/disclaimers/)須另查產品授權，不能買查看權就對外顯示。條款版本／本站報價未核實。 |

本表日期、欄位與數值依 2026-10-28 官網／curl；實測大小見後文。**ETF 持股權重是基金的權重，不是官方 index weights**；SPY、IVV 的現金、公司行動與持股日期可能不同，換一檔 ETF 不會消除近似性。本輪不量化落差，避免新的市場歷史統計。

**結論：** 取得使用權後仍以 SPY 為首選；IVV 作分開標來源的核對與備援，VOO 只作人工參照。不要平均兩家的權重以假裝更準，也不要用最新持股回填歷史。這部分只處理資料可得性與授權，不重抄前輪 N-PORT／權重推算議題。

## FINRA 放空資料

### 兩種資料必須分開

| 資料 | 端點、key、額度 | 歷史／發布／修訂 | Worker 及用法 |
| --- | --- | --- | --- |
| **Consolidated Short Interest** | `https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest`；schema：`https://api.finra.org/metadata/group/otcMarket/name/consolidatedShortInterest`。本次 `GET ?limit=1` 無 key 成功；正式 filtered POST／大量或 async 應依 [Query API docs](https://developer.finra.org/docs)及 Public credentials。 | [官方資料說明](https://www.finra.org/finra-data/browse-catalog/equity-short-interest)：**每月兩次**，涵蓋 exchange-listed 與 OTC；依 settlement date，於之後 **第 7 個營業日**發布。官方標最多滾動 **5 年**；修訂只提供最新值及 revision flag，**不是完整 vintage**。本次任意樣本較舊，不拿它推論最早／最後可查日期。 | 小量依 symbol／settlement date 篩選適合 Worker；保留發布日與首次收到時間。多使用者聯集可集中抓，無須每位使用者重抓。 |
| **Reg SHO Daily Short Sale Volume** | API dataset `regShoDaily`（同 `otcMarket` group）；每日原始檔例 `https://cdn.finra.org/equity/regsho/daily/CNMSshvol20261027.txt`。每日檔無 key。 | [官方說明](https://www.finra.org/finra-data/browse-catalog/short-sale-volume-data)及 [資料意義](https://syndication.finra.org/content/short-interest-what-it-what-it-not)：這是 FINRA 場外回報的成交 flow，**不含整體交易所 activity**，也不是未平倉 short positions。格狀頁保留 **365 日**；更舊檔/API可另取，完整最早有效日未核實；本輪未核實當前每日固定發布時鐘。 | 單日檔小，適合 Worker；全歷史本機。分母須是同一檔案所涵蓋成交量，不能拿全市場量混算後命名 short interest。 |

共同數值規格（2026-10-28，[官方 Query API docs](https://developer.finra.org/docs)）：同步每 IP 每分鐘 **1,200 requests**；同步最多 **5,000 records／3 MB**，預設 **1,000 records**；非同步另有規格。[費用表](https://developer.finra.org/fees)列 Public credentials **$0／月**，不是 Firm／Organization 的付費資格。正式使用前仍應按該身份完成條款與憑證流程，不把一次匿名 GET 當全部功能無認證承諾。

### FINRA 有可用的再散布例外，不能只讀通用條款

[API General Terms](https://developer.finra.org/terms-and-conditions)更新 **2026-03-19**，但明定 Specific Terms 優先。[Equity Data Specific Terms](https://developer.finra.org/sites/default/files/2022-12/Developer%20API%20-%20Specific%20Terms%20-%20Equity%20Data%20%2812-2022%29%5B10%5D.pdf)更新 **2022-12-20**，適用 `otcMarket` datasets，允許對終端使用者作非商業個人／專業用途再散布及 derived data，條件包括標 FINRA 來源、不得加收資料費、終端使用者不得再散布，並合理確保其遵守條款。

**結論：** short interest 首選 FINRA consolidated；daily short volume 是另一張可選背景卡，不是備用 short interest。本 App 免費的結構與這條例外相容的可能性高，但須將終端使用條件及 attribution 做進產品；日後收費、輸出 API、廣告或用途改變需重新確認，不能概括稱「FINRA 全部 public domain」。預測證據 `none`，未檢驗；不接回已否決的指數 flag。

## 選擇權、免費 IV 與財報隱含波動

| 來源 | 取得與免費限制 | 歷史、延遲及使用權 | 結論 |
| --- | --- | --- | --- |
| **Cboe delayed quotes** | [AAPL quote table](https://www.cboe.com/delayed_quotes/aapl/quote_table)為公開查閱頁；網頁使用的 CDN JSON 不是本報告已核實的正式免費 API。無正式 quota／SLA。此次頁面抽取工具因回應過大失敗；沒有下載整條 option chain 或計算 IV。 | [Market Data Policies](https://cdn.cboe.com/resources/membership/Market_Data_Policies.pdf)定義一般延遲為 **15 分鐘**，但這不授予網站 scraping／再散布權。[網站 Terms](https://www.cboe.com/terms/)版日 **2022-11-16**，原始資料、衍生、核對用途均受限制。免費頁只有當前鏈，未核實 PIT 歷史。 | 只建議使用者自行開官方頁閱讀。不能當免費財報 expected move feed。 |
| **Cboe DataShop** | [Option EOD Summary](https://datashop.cboe.com/option-eod-summary)、[All Access API](https://datashop.cboe.com/cboe-all-access-api)：付費／憑證及 entitlement。 | [官方 FAQ](https://datashop.cboe.com/faqs)：option EOD／quotes 自 **2010-01**；Calcs 含 IV／Greeks，常使用 **15:45 ET** snapshot，半日市有不同時點。買歷史資料與對外展示權要分開詢價；本 App 總費用、版日及再利用許可未核實。 | 日後確有需求再詢價；大鏈／歷史檔在本機處理。 |
| **Massive options** | 正式 [options 文件](https://massive.com/docs/rest/options/overview)／商務條款；需 key。免費方案的樣本或歷史 bars 不能當完整 current snapshot IV 權限。 | 本輪沒有帳號驗證 IV、Greeks、earnings implied move 的 entitlement、歷史起點與日更時鐘；公開顯示依 Business Order Form。 | 授權後可作備援候選；目前未核實完整需求，不報低價可用結論。 |
| Alpha Vantage 等供應商 | [options 文件](https://www.alphavantage.co/documentation/)有 options endpoints，存在不代表免費完整鏈與再散布許可。 | 同前節 Alpha Vantage Terms；免費 IV entitlement、歷史與 PIT 未核實。 | 沒有解決成本與公開權利，不另建管線。 |

**沒有免費且已核實可再散布的「財報隱含波動」來源結論。** 單一合約 annualized IV、跨到期日 ATM straddle implied move 與 earnings-specific jump variance 是不同量，不能替別人的欄位換個中文名。本 App 沒有選擇權交易決策，這輪首選為不新增數字、備援為未來有需求時付費詢價。預測證據 `none`，未檢驗；不重開 VRP／VIX 類模型候選。

## 財報日曆與電話會議逐字稿

| 來源 | 端點、key／免費層與 Worker | 歷史、時點與合法使用 |
| --- | --- | --- |
| **公司 IR 公告／event feed** | 以公司 IR 的 Events／Newsroom 為準；例 [NVIDIA Events](https://investor.nvidia.com/events-and-presentations/events-and-presentations/default.aspx)、[官方 RSS 目錄](https://investor.nvidia.com/investor-resources/rss/default.aspx)，列 `https://investor.nvidia.com/rss/Event.aspx?LanguageId=1`。無 key，未公布數字 quota；本次 feed 遇 Cloudflare challenge。 | 能確認公司宣告的未來日期，不是從舊財報日期推估。保留 `announcedAt, firstSeenAt, eventAt, timezone, confirmed/estimated, sourceURL`；事件 feed 會更新／移除，不保證完整歷史。公開事件事實可供人工記錄，全文／feed 自動再發布須看各公司條款。 |
| **Finnhub earnings calendar** | `https://finnhub.io/api/v1/calendar/earnings?from={date}&to={date}&token=<KEY>`；[文件](https://finnhub.io/docs/api/earnings-calendar)。官方 Free：美國最近／前瞻可查範圍列 **1 個月及即時更新**，不是完整歷史；共用每分鐘 **60 calls**。 | 僅有日期欄不能保證 issuer-confirmed；需核對狀態／來源。公開用仍須書面許可，不能以免費 quota 解決。 |
| **FMP calendar／transcripts** | [文件](https://site.financialmodelingprep.com/developer/docs)：stable earnings-calendar、earning-call-transcript；需 key。價格頁將 corporate calendars 放在較高方案，transcripts 在 Ultimate；免費全量 entitlement **未核實**。 | 供應商延遲與全歷史起點未核實；必須另外確認 transcript 的儲存、公開摘要、模型輸入、引述與再散布權，不只取得 API access。 |
| **公司正式 transcript** | 核實存在的例子：[Microsoft FY26 Q4 conference call](https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q4)，事件日 **2026-07-29**，頁上有完整 Transcript。免 key；沒有統一速率及涵蓋全部公司歷史的 API。 | 公司說先發布 prepared remarks、完整 transcript 後補；兩者版本不能混用。公開讀取不等於可整篇重刊；[Microsoft Copyright](https://www.microsoft.com/en-us/legal/intellectualproperty/copyright)明示網上可讀不等於 public domain，未標條款版日。優先連回原文，不鏡像全文。 |
| **SEC 8-K 財報附件** | 同前節 accession 路徑，無 key、免費。 | 可確認已發生的公告及附件；**不是未來財報日曆，也沒有要求每家公司都交完整電話會議逐字稿**。不能以 SEC API 取代這兩項服務。 |

本表 entitlement 與日期查於 2026-10-28。[NVIDIA Terms](https://www.nvidia.com/en-us/about-nvidia/terms-of-service/)為其 IR 站連出的條款，未見版日；沒有核實 blanket public redistribution 許可。

**結論：** 日曆先用公司 IR 確認，備援為有授權的 Finnhub／FMP；推估仍明示。逐字稿首選公司版本的來源連結，若要大量 AI 摘要再買含該用途的授權；不擷取 Seeking Alpha／Motley Fool 等第三方全文當「免費合法 transcript」。本輪未核實到涵蓋全觀察名單、免 key 又含公開摘要權的服務。

## 總經：原發布機構、vintage 與日程

本節只新增 API／使用權／修訂與官方日程資訊，不重做前輪利率或指數變數的預測能力評估。

| 來源 | 端點與 key／免費額度 | 歷史、更新、PIT | 公開使用權、Worker 與取捨 |
| --- | --- | --- | --- |
| **FRED／ALFRED** | `https://api.stlouisfed.org/fred/series/observations?series_id={id}&realtime_start={date}&realtime_end={date}&api_key=<KEY>&file_type=json`；另用 `fred/series/vintagedates`。需免費 key；[v1 errors](https://fred.stlouisfed.org/docs/api/fred/errors.html)列每分鐘 **120 requests**。 | [Real-Time Periods](https://fred.stlouisfed.org/docs/api/fred/realtime_period.html)允許取過去已知版本；[vintage dates](https://fred.stlouisfed.org/docs/api/fred/series_vintagedates.html)是新增／修訂日期。歷史與 vintage 起點逐 series 不同，日期層級非精確盤中 timestamp；FRED 收到／入庫時間也可能晚於原機構。 | JSON 小範圍適合 Worker，歷史回補本機。[API Terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html)未標版日，**不覆蓋第三方版權**；須看 series notes 的 Copyright，公開 App 還有連結／終端使用條款要求。只把已確認可用的官方 series 加進白名單。 |
| **BLS** | `https://api.bls.gov/publicAPI/v1/timeseries/data/{seriesID}`；較高額度 POST `https://api.bls.gov/publicAPI/v2/timeseries/data/`。依 [FAQ](https://www.bls.gov/developers/api_faqs.htm)（更新 **2023-08-30**）：未註冊每日 **25 queries**、每次 **25 series／10 年**；註冊 key 每日 **500**、每次 **50 series／20 年**。 | 這是單次取資料的範圍，不是 series 的最早歷史。API 通常提供目前修訂版本，非 ALFRED 式 vintage。[API Features](https://www.bls.gov/bls/api_features.htm)的舊文件記載發布至 API 有 **1 日 lag**，而 [Dissemination](https://www.bls.gov/about-bls/dissemination.htm)說發布時更新資料庫；**當前 API 分鐘級 lag 未實測，不當成即時發布 feed**。 | JSON 適合小量 Worker；官網／ICS 本機遇 403，不代表 API 一定也擋。[Copyright](https://www.bls.gov/bls/linksite.htm)更新 **2016-08-05**：資料與文字原則 public domain，例外照片／插圖，要求註明來源。 |
| **BEA** | `https://apps.bea.gov/api/data/?UserID=<KEY>&method=GetData&datasetname=NIPA&TableName=T10101&Frequency=Q&Year={year}&ResultFormat=JSON`。免費 key；[API User Guide](https://apps.bea.gov/api/_pdf/bea_web_service_api_user_guide.pdf) **2026-04-20**：每分鐘 **100 requests／100 MB／30 errors** 三種限制。 | 起點依 table／frequency；按 [官方日程](https://www.bea.gov/news/schedule)發布。普通 API 的當前資料不等於每次 GDP vintage；歷史版本另用官方 release archive／可取得的 ALFRED，不以 observation period 冒充 first release。 | 切年份／表格的 JSON 適合 Worker；`ALL` 大回應本機。[Policies](https://www.bea.gov/about/policies-and-information)頁最後修改 **2026-02-05**；[引用指引](https://www.bea.gov/help/guidelines-for-citing-bea)本次抽取不穩。對政府自產統計依 §105 判斷可引用、標 BEA；第三方圖文另議，未取得另一份 blanket 網站授權。 |
| **Treasury Fiscal Data** | `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1`；[API 文件](https://fiscaldata.treasury.gov/api-documentation/)。無 key、免費；文件未找到可承諾的數字 rate ceiling，不能說無限制。 | 起點／頻率依資料集，API 可更正，沒有通用 vintage 參數。`record_date` 不等於發布時間。數值回傳為字串，`null` 也可能是字串。 | 實測 JSON 成功，fields/filter/page 支援讓 Worker 易控制大小。文件 License and Authorization 明許商業／非商業 copy/adapt/redistribute；**未標版日**。該頁 web 抽取 403，但瀏覽器已讀到授權原文及 API 說明。不是每日市場匯率來源，不能用季度 Treasury reporting FX 換掉定投用 USD/TWD。 |
| **Atlanta Fed GDPNow** | [官方 GDPNow](https://www.atlantafed.org/research-and-data/data/gdpnow)及頁內 `GDPTrackingModelDataAndForecasts.xlsx` 下載連結。無 key；沒有核實官方穩定版 REST contract 或數字 rate limit。 | 官方說 `TrackingDeepArchives` 為 **2011Q3–2014Q1** 上線前歷史；`TrackingArchives` 自 **2014Q2** 起。不能把上線前序列當即時 OOS。隨輸入發布更新，不是每個交易日固定更新；工作簿／模型可能改版，須保留預測發布日期與版本。 | 工作簿留本機，不在 Worker 重複解大檔。授權版本／全面再散布條款**未核實**；頁上顯示還含第三方 Blue Chip，比較線不能一併當 Atlanta Fed 自產資料再發。沒有據此主張能預測股票。 |
| **Fed H.15** | [目前 release](https://www.federalreserve.gov/releases/h15/)、[DDP](https://www.federalreserve.gov/datadownload/Choose.aspx?rel=H15)、[RSS](https://www.federalreserve.gov/feeds/h15.xml)。無 key；無核實數字 rate limit。 | [About](https://www.federalreserve.gov/releases/h15/about.htm)為每日營業日發布；歷史起點逐 series。更正會發公告，當前下載非 vintage。**本次 RSS 是資料服務公告與更正，不是每天利率數值 feed**。 | Worker 取選定小系列；大量 DDP 回補本機。[Fed Disclaimer](https://www.federalreserve.gov/disclaimer.htm)未標版日，原則 public domain、可複製散布並註明來源，第三方標示內容例外。 |

### 公布日程：BLS 確實有官方 ICS

- 官方端點：`https://www.bls.gov/schedule/news_release/bls.ics`。[訂閱說明](https://www.bls.gov/help/hlpiCAL.htm)明列該 URL（說明頁最後修改 **2008-07-19**）；[當前官方月曆](https://www.bls.gov/schedule/news_release/)仍連到它。無 key、免費，更新依需要，舊說明的預定更新時段不能當 SLA。歷史日程保存與異動紀錄要自行保留。
- **本機此次 ICS 回 403 Access Denied，沒有取得 VEVENT。** 因此它是最值得試接的官方格式，尚不是已驗證可由本站 Worker 抓取的來源；備援為官方 HTML 日程，仍要檢查該出口可存取性，不用瀏覽器 cookie 餵 Worker。
- [BEA Release Schedule](https://www.bea.gov/news/schedule)本次頁末更新 **2026-10-28**，可提供 GDP／PCE 日程；本輪未核實穩定 ICS URL，不猜 endpoint。
- [Federal Reserve Calendar](https://www.federalreserve.gov/newsevents/calendar.htm)及各 release 頁是政策／統計公布日程核對來源；現有 FOMC 人工維護不必為了整合日程而全部重寫。
- 事件保留機構時區及版本，前端換台北時間；不要把 ET 固定當成全年相同 UTC offset。沒有 consensus 的官方日程就只寫公布時間與已公布數字，不重新爬排除清單內的商業 consensus 來湊 surprise。

**總經結論：** 日常現值取原機構；需要歷史已知版本才用已確認 series 的 ALFRED。優先擴充日程與來源時間，GDPNow 是低優先、待授權的背景資料。這些不進 `forecast.ts`，不改每月扣款或加碼規則。

## 新聞：合法取得 metadata 與合法重用正文是兩件事

| 來源 | 端點、key、免費／歷史／更新 | 使用權、PIT 與 Worker 結論 |
| --- | --- | --- |
| **Nasdaq 現用新聞** | `https://www.nasdaq.com/api/news/topic/articlebysymbol?q=AAPL%7Cstocks&offset=0&limit=8`；無 key，沒有核實正式免費 quota、全歷史起點或 SLA。 | [Legal](https://www.nasdaq.com/legal)版日 **2026-05-11** 限制擷取、儲存、分享與衍生用途；文章亦可能屬第三方。不能因標題 API 可讀就認定全文翻譯／摘要已授權。已知本機腳本另找 Yahoo 轉載，不解決權利問題。 |
| **SEC 官方新聞稿 RSS** | `https://www.sec.gov/news/pressreleases.rss`；[官方目錄](https://www.sec.gov/about/rss-feeds)最近檢視 **2026-06-24**。無 key、免費；無獨立 RSS 數字 quota，低量使用並遵守 SEC fair access。歷史 archive 與當前 feed 分開，feed 不保證全歷史。發布時更新。 | 本次無 cookie curl 成功；metadata 輕量。SEC 自產消息依政府作品原則使用、標來源；私人申報附件不沿用此結論。`pubDate`／`firstSeenAt` 均存，編輯後的現文不是自動 PIT。範圍是監管消息，**不取代公司與市場全部新聞**。 |
| **GDELT DOC API** | `https://api.gdeltproject.org/api/v2/doc/doc?query=%22Nvidia%22&mode=artlist&format=json&maxrecords=5&timespan=1d`；無 key。原始 [DOC 文件](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)寫預設近 **3 個月**；[2018-01-08 更新](https://blog.gdeltproject.org/doc-geo-2-0-api-updates-full-year-searching-and-more/)將搜尋擴為最多近 **1 年**，故不能只抄舊文件的上限。本輪未實測長窗口可用性。 | [Terms](https://gdeltproject.org/about.html#termsofuse)未標版日，GDELT 自有 datasets 可商用／再散布，但須署名及連結；**沒有連帶授權新聞出版社的全文／圖片**。本次僅一次 API 測試回 429，訊息要求每 **5 秒**至多一請求；不能當穩定 SLA。只當低頻連結發現備援；`seendate` 是發現時間，不保證原文發布時間或未編輯版本。 |
| **公司 IR RSS／newsroom** | 公司分散維護；例 NVIDIA [RSS 目錄](https://investor.nvidia.com/investor-resources/rss/default.aspx)，event／presentation／SEC Filing feeds 各分開。無 key；無統一 quota、歷史起點或發布延遲。本次 event RSS 遇 challenge，沒有宣稱所有 IR feed 都可抓。 | 公司官方不等於內容無版權；[NVIDIA Terms](https://www.nvidia.com/en-us/about-nvidia/terms-of-service/)未標版日、未核實本站再發布許可。優先抽取公告的事實與來源，逐來源確認 feed／正文／AI 使用條件。對已阻擋的來源留人工維護，不新增換 UA／cookie 的繞路。 |

GDELT Project 與其他以 GDELT 為名的 cloud／付費服務不是同一份授權；本報告只引用 `gdeltproject.org` 的原始資料與 API。

**結論：** 先補「公司公告／SEC 申報」這條清楚的事實來源，再用 GDELT 找外部報導；不要把兩者宣稱為同等完整的 Nasdaq 新聞替代。若要全面替掉 Nasdaq + Yahoo 文章管線，還需要一份涵蓋 **metadata 顯示、全文取得、AI 處理與公開摘要** 的新聞授權；本輪沒有核實免費全包方案。預測證據 `none`，未檢驗；不增加新聞情緒交易分數。

## 無 key 候選的 curl 實測紀錄

執行環境為本機 Mac，時間 **2026-10-28 04:58–05:02 UTC**。只做連通、schema 與檔案格式確認；未對價格、持股或放空資料做統計。以下 URL 就是實際請求來源；API 回傳錯誤也照錄。每個來源最多少量讀取；SEC press RSS 為取得精簡可記錄輸出再讀一次，未重試封鎖的申報端點。

共同命令（各列將 `URL` 換成所列網址，`-g` 避免方括號被 curl 當 glob）：

```sh
curl -g -sS -L --max-redirs 3 --max-time 25 \
  -A 'market-observatory research (https://github.com/audichuang/market-observatory)' \
  -w '\n__PROBE__%{http_code}|%{num_redirects}|%{size_download}|%{url_effective}|%{content_type}' \
  'URL'
```

回應只在記憶體解析；JSON 只列 keys，CSV 只記日期／表頭，XLSX 只讀 sharedStrings 找表頭，未存市場資料到任何其他檔。`size_download` 是當次 curl 所報傳輸大小，不是 Worker 實際記憶體峰值。

| 實際 URL／時間 UTC | HTTP／轉址／bytes | 回應前段／欄位與解讀 |
| --- | --- | --- |
| [SEC submissions](https://data.sec.gov/submissions/CIK0000320193.json)，04:58:40 | **403／0／4,819** | HTML title：`SEC.gov \| Your Request Originates from an Undeclared Automated Tool`；未取得 JSON。此研究 UA 沒有 SEC 範例要求的 email，不能據此斷言具正確聯絡 UA 的 Worker 也必擋。 |
| [SEC companyconcept Assets](https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/Assets.json)，04:58:40 | **403／0／4,819** | 同上；沒有虛報 `units` 等實測欄位。companyfacts 未另抓整包，相關 schema 依官方文件。 |
| [Stooq CSV 路徑](https://stooq.com/q/d/l/?s=aapl.us&i=d&d1=20261026&d2=20261027)，04:58:41 | **200／0／796** | `text/html`，前段 `<!DOCTYPE html>`，提示需要 JavaScript 驗證，**不是 `Date,Open,High,Low,Close,Volume` CSV**。 |
| [IVV 舊 ajax 路徑](https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/1467271812596.ajax?fileType=csv&fileName=IVV_holdings&dataType=fund)，04:58:41 | **200／0／2,314,548** | Content-Type 宣稱 `text/csv`，body 卻 `<!DOCTYPE html>`、title 為 IVV 產品頁；**HTTP 及 Content-Type 都不足以判成功**。 |
| [IVV 官網新 CSV](https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv)，04:59:18 | **200／0／91,540** | `text/plain`；前段 `iShares Core S&P 500 ETF`、`Fund Holdings as of,"Oct 26, 2026"`。表頭：`Ticker,Name,Type,Sector,Asset Class,Market Value,Notional Value,Quantity,Price,Location,Exchange,Currency,FX Rate,Market Currency,Accrual Date,Market Weight,Notional Weight`。 |
| [SSGA 現用 XLSX](https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx)，04:59:18 | **200／1／54,430** | 最終網址 [去掉區域前綴的 XLSX](https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx)。ZIP/XLSX；讀到 `As of 26-Oct-2026`、`Name,Ticker,Identifier,SEDOL,Weight,Sector,Shares Held,Local Currency`。授權確認後若實作，應直接用最終網址省轉址。 |
| [FINRA metadata](https://api.finra.org/metadata/group/otcMarket/name/consolidatedShortInterest)，04:58:42 | **200／0／2,487** | JSON：`datasetGroup,datasetName,description,partitionFields,fields`。 |
| [FINRA sample GET](https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest?limit=1)，04:59:18 | **200／0／376** | CSV：`accountingYearMonthNumber,symbolCode,issueName,issuerServicesGroupExchangeCode,marketClassCode,currentShortPositionQuantity,previousShortPositionQuantity,stockSplitFlag,averageDailyVolumeQuantity,daysToCoverQuantity,revisionFlag,changePercent,changePreviousNumber,settlementDate`。僅驗 schema，不把未排序樣本當最新紀錄。 |
| [FINRA 日檔](https://cdn.finra.org/equity/regsho/daily/CNMSshvol20261027.txt)，04:59:19 | **200／0／531,491** | `Date\|Symbol\|ShortVolume\|ShortExemptVolume\|TotalVolume\|Market`。沒有加總或計算放空比率。 |
| [BLS ICS](https://www.bls.gov/schedule/news_release/bls.ics)，04:58:40 | **403／0／1,325** | HTML title `Access Denied`；沒有 `BEGIN:VCALENDAR` 或實測事件欄位。 |
| [Treasury Debt to the Penny](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1)，04:58:41 | **200／0／1,791** | JSON：`data,meta,links`；data 欄位 `record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt,src_line_nbr,record_fiscal_year,record_fiscal_quarter,record_calendar_year,record_calendar_quarter,record_calendar_month,record_calendar_day`。 |
| [Fed H.15 RSS](https://www.federalreserve.gov/feeds/h15.xml)，04:59:19 | **200／0／82,381** | XML/RDF RSS：`channel,title,link,description,item,dc:date`，包含資料服務公告／更正；不是每個日值一筆的數列。 |
| [SEC Press Releases RSS](https://www.sec.gov/news/pressreleases.rss)，05:01:54 | **200／0／18,571** | XML root `rss`，`channel,title,link,description,language,item,pubDate,creator,guid`。 |
| [NVIDIA event RSS](https://investor.nvidia.com/rss/Event.aspx?LanguageId=1)，05:01:54 | **403／0／5,644** | HTML title `Just a moment...`，沒有取得事件 RSS。 |
| [GDELT DOC 樣本](https://api.gdeltproject.org/api/v2/doc/doc?query=%22Nvidia%22&mode=artlist&format=json&maxrecords=5&timespan=1d)，05:02:09 | **429／0／444** | 文字：`Please limit requests to one every 5 seconds`，另指向 ngrams；沒有取得 `articles` JSON。本 session 未對該 API 高頻呼叫；不能假定錯誤是本站能以簡單重試解決。 |

**針對具體失敗的工程建議：** IVV/Stooq 的成功碼假象已有實例，未來 adapter 必須驗檔頭及必要表頭，不能只檢查 HTTP。GDELT 的實際限流回應不支持立刻追加重試；先低頻、跨執行留待下一輪。SEC 使用正確宣告 UA 後仍需在預定出口做一次低量驗收。這些是連通驗證，不涉及市場統計；沒有建議更換出口或取得 cookie 來繞封鎖。

## 哪些 Yahoo 用途先替換最划算

| 優先序／對象 | 建議做法 | 為何划算／限制 |
| --- | --- | --- |
| 優先：個股／ETF daily bars、歷史、共識所用現價 | 用同一份取得顯示權的 EOD feed；一起處理 `yahoo.ts` 與 `jobs.ts:630`，歷史回補保留原來源。 | 核心使用者功能共用最多；不必為了省請求同時養多個沒有公開權利的網站端點。合約必須含網站、iOS、推播及資料保存。 |
| 同步：價格調整與事件欄 | 先寫出 raw、split-only、dividend-adjusted 的欄位對照與 migration 定義；保留公司行動及 provider timestamp。 | 避免把含配息調整價接到「不含配息」的定投試算，或拆股讓價格跳動。只寫規格、合成 fixture 測 parser；**不在這輪比較真實價格歷史**。 |
| 優先：Yahoo 轉載文章搜尋／正文 | 先補公告／申報事實與連結；有明確文章處理權的來源才讓本機 AI 讀正文。 | 解決 `ai-batch.ts:99` 的第二層依賴；不因改標題來源就錯稱已移除 Yahoo。完整媒體新聞覆蓋仍需授權預算。 |
| 個別處理：USD/TWD | 在行情報價中明列 USD/TWD 的歷史深度、fixing／日界與顯示權。 | 個股 EOD 的合約不一定含 FX；Fiscal Data 的 reporting FX 不是可直接替換的每日市場收盤。本輪未核實完整可用的同包方案。 |
| 不在此輪展開：SPX、VIX 與既有指數來源 | 沿用前輪研究結論，另確認正在使用的公開顯示／核對權；不重作歷史或訊號研究。 | 個股／ETF 的 feed 不保證同時含獲授權的官方 SPX 指數。Cboe 官方不代表網站下載檔可任意公開。 |

### 日常 Worker 與本機回補的分工

- **每日 Worker 候選：** 授權後少量 REST EOD、SEC submissions 增量、所需 companyconcept、SPY/IVV 最新小檔、FINRA 小範圍查詢／當日日檔、官方 RSS、已驗收的日程、少數 FRED/BLS/BEA series。這是架構判斷，沒有跑正式 Worker 連通測試。
- **只宜本機 `web/scripts/`：** SEC 全量 companyfacts／submissions ZIP、季度 financials／insider／13F ZIP、跨管理人與 CUSIP 歷史映射、全市場 TAQ／options／bulk EOD 回補、GDPNow 多工作表、HTML/PDF 逐字稿解析。不要把「可單次下載」當成 Worker 可長期解大檔。
- **本機也沒有例外授權：** Stooq challenge、Nasdaq／Yahoo 正文或其他禁止資料庫／再散布的來源，不會因改成本機 cron 就合法化；本機分工只解決檔案及執行限制。
- 每份資料的 `source`、觀察期、供應商發布時間、首次取得時間、修訂版本與授權用途應可區分。新 adapter 沿用現有 Budget；供應商 quota 需另外記帳，不能以 Cloudflare 子請求數代替。尤其 EODHD bulk 的 HTTP 數與計費 calls 不相同。

### 事前登記邊界

本報告的採用建議不需要先跑任何市場統計，也**沒有新增預測試驗名額**。API 連通、schema、授權與合成資料 parser 驗證可獨立進行。若整合者要量化「新舊價格差異對報酬的影響」「SPY 與 IVV 的歷史點數誤差」「Form 4／13F／short interest 的預測力」，都應另寫研究定義、樣本、cutoff、採用門檻與失敗後果，按既有流程先登記；**本輪未設任意數字門檻，也未執行這些計算**。資料來源更換不是繞過既有 forecast 事前登記與排除清單的理由。

## 給整合者的摘要

### 關鍵發現（3–8 條，每條附證據等級與來源）

- **`none`（預測結果未檢驗）：行情替代的首要成本是公開顯示權。** 2026-10-28 查閱：Tiingo 明列 startup Display Redistribution **$250／月**；免費 Starter 禁永久保存，internal commercial 也不是公開顯示許可。[產品與價格](https://www.tiingo.com/products/end-of-day-stock-price-data)、[條款，更新 2026-10-06](https://app.tiingo.com/tos/)
- **`none`（預測結果未檢驗）：不能用免費方案清單決定分析師或日線替代。** Finnhub Free 的 OHLC、price target、EPS estimates 未包含；FMP 顯示／再散布需另外協議；Nasdaq 現用端點亦受網站限制。以上均查於 2026-10-28。[Finnhub 價格](https://finnhub.io/pricing)、[FMP 價格與授權](https://site.financialmodelingprep.com/pricing-plans)、[Nasdaq Legal，2026-05-11](https://www.nasdaq.com/legal)
- **`none`（預測結果未檢驗）：SEC 最適合補基本面溯源，但 `filed` 篩選本身不等於完整 point-in-time。** 最新 frames 會選後來申報資訊；須保留 accession、接受／首次取得時間與修正版本，不可把財務期末當可用日。[SEC API 文件](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)、[申報傳播與更正規則](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)
- **`none`（預測結果未檢驗）：IVV 有可無 cookie 取得的新持股 CSV，但免費下載不含公開使用許可。** 2026-10-28 實測 `latest-holdings.csv` 成功；舊 ajax 路徑回成功碼卻是 HTML。SPY／IVV 都是 ETF 權重近似。[IVV CSV](https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv)、[BlackRock Terms](https://www.blackrock.com/corporate/compliance/terms-and-conditions)
- **`none`（預測結果未檢驗）：FINRA 有條件允許 Equity Data 再散布，且 short interest 與 daily short volume 必須分開。** 前者每月兩次持倉快照，後者為特定場外成交 flow；不能把後者命名成前者。[Equity Specific Terms，2022-12-20](https://developer.finra.org/sites/default/files/2022-12/Developer%20API%20-%20Specific%20Terms%20-%20Equity%20Data%20%2812-2022%29%5B10%5D.pdf)、[官方資料解釋](https://syndication.finra.org/content/short-interest-what-it-what-it-not)
- **`none`（預測結果未檢驗）：官方日程與公告比新增交易指標更適合先接，但連通仍有缺口。** 2026-10-28 實測 SEC RSS、Treasury API 成功；BLS ICS 回 **403**、GDELT 回 **429**。GDELT 開放的是自身 dataset，沒有連帶授權出版社全文。[BLS ICS 說明](https://www.bls.gov/help/hlpiCAL.htm)、[SEC RSS](https://www.sec.gov/about/rss-feeds)、[Fiscal Data 文件](https://fiscaldata.treasury.gov/api-documentation/)、[GDELT Terms](https://gdeltproject.org/about.html#termsofuse)

### 對我們 App 的建議

| ID | 建議 | 服務哪個決策（a 每月定投／b 加碼研究預算／c ±20% 檢討／d 觀察名單個股／資料／流水線／呈現） | 證據等級 | 成本（低／中／高） | 需事前登記？ | 與既有規則或排除清單衝突？ |
| --- | --- | --- | --- | --- | --- | --- |
| E-01 | 以 Tiingo Display Redistribution 為首選詢價，Massive Business 作備援；合約涵蓋網站、iOS、推播、歷史保存及解約保留權後才遷移 | a／資料／流水線 | none | 高 | 否；若比較市場歷史影響則另登記 | 無；不改扣款規則 |
| E-02 | 先定義 raw／split-only／dividend-adjusted 對照；一起移除日線與共識現價的 Yahoo 依賴 | a／資料／流水線 | none | 中 | 規格與合成 parser 驗證否；市場歷史計算是 | 無；維持不含配息試算語意 |
| E-03 | SEC 增量保存 accession、接受時間、filed、首次取得及版本；先做財報／申報事實卡 | c／d／資料 | none | 中 | 純溯源否；任何績效研究是 | 無；不轉成個股建議 |
| E-04 | SPY 保留主來源，確認使用權後以 IVV 新 CSV 核對；標基金、as-of 與首次取得時間 | 資料／呈現 | none | 中 | 連通／schema 否；歷史權重誤差計算是 | 無；不宣稱官方 SPX 權重 |
| E-05 | 分析師資料詢 FMP 特定 display agreement，備援 Finnhub 商務方案；沒授權不以免費層擴充 | d／資料 | none | 高 | 背景顯示否；預測用途另議 | 無；不得進既有機率模型 |
| E-06 | 先接官方公布日程、來源與修訂時間；BLS ICS 完成預定出口驗收再採用，備援官方 HTML | a／c／資料／呈現 | none | 中 | 否，只作事件資訊 | 無；不湊 surprise／停扣訊號 |
| E-07 | 新聞先補 SEC／公司公告事實與原文連結；GDELT 低頻找連結，正文與 AI 摘要另確認權利 | d／流水線／呈現 | none | 中 | 否；若做情緒績效研究則是 | 無；不改為交易分數 |
| E-08 | FINRA short interest 僅作可選背景資料，先實作 attribution 與終端使用條件；不混入 daily volume | d／資料／呈現 | none | 中 | 單純顯示否；訊號研究是 | 顯示無；指數 flag 抵觸既有排除 |
| E-09 | Form 4 可列申報連結；13F 批次與證券映射、GDPNow 工作簿、逐字稿解析留本機且延後 | c／d／流水線 | none | 高 | 資料整理否；市場統計是 | 無；不做跟單或機構排名 |
| E-10 | 本輪不增加 options IV／財報隱含波動數字；日後需求成立再詢 Cboe／商務 API | b／d／資料 | none | 低 | 不做毋須；新計算另登記 | 避免重開 VRP／VIX 排除項 |

### 建議不要做的事與理由

- 不把「免費 API」「官方 CSV」「不收費網站」等同公開顯示／永久保存許可；本機 cron 也沒有授權例外。
- 不以 Stooq、Nasdaq 網頁端點或 Cboe delayed quotes 做未授權的自動備援；不以 cookie、換 UA 或繞出口解封鎖。
- 不用最新 frames、目前持股或報表期末日回填歷史已知資料；不把 Form 13F 當即時持倉、short volume 當 short interest。
- 不以可重建價格的衍生序列規避授權；不把含股息調整價靜默接進現有定投試算。
- 不新增個股買賣評分、跟單、新聞情緒或風險調整扣款；本輪沒有足以支持這些決策的預測證據，也沒有新試驗名額。

### 未核實、不確定、需要人判斷的地方

- Tiingo／Massive／FMP／Finnhub 尚無本站具體商務報價或簽約；尤其解約後保存、衍生輸出、推播與 AI 使用範圍需書面確認，不能只看方案名稱。
- Stooq 條款、Zacks 網站條款、Nasdaq Data Link 特定產品配額與歷史、SSGA US 持股再利用、GDPNow 再散布權未完整核實；不能引用其他地區或 connector 條款代替。
- SEC 申報 API 本機遇 **403**，研究 UA 未含 email；BLS ICS 也遇 **403**，公司 IR feed 遇 challenge，GDELT 遇 **429**。**未驗證：Cloudflare Worker 的預定出口、合規聯絡 UA 與有 key 方案**；替代驗證是本文官網規格及本機 curl 證據。
- EODHD 價格表與通用 limits 頁的免費速率敘述不一致，資料來源聲明也須釐清；未做市場價格品質比較。IVV 新欄位的完整計算定義及 SPY／IVV 的近似誤差未計算。
- 免費全文新聞／逐字稿加公開 AI 摘要的全包來源未核實；資料源對結果的「預測力」全部未檢驗。是否投入個股基本面卡或放空背景卡，屬產品取捨，不是回測結論。
