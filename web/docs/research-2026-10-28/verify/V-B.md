# V-B：任務 B 獨立查核

查核日：2026-10-28（Asia/Taipei）。已先讀 `prompts/B.md`。原報告以下簡稱 **B**，指 `web/docs/research-2026-10-28/results/B-data-pipeline.md`；位置均為本次實際讀到的行號。checkout 為 `99066fd3ad63ec7b040f6fd447f255b2d3c3964a`，與 B 聲明的程式基準相同。

從摘要與 B-01～B-12 建議挑出 15 項關鍵主張：**已核實 13／部分 1／被推翻 1／無法核實 0**。其中被推翻的是把 APNs 接受請求稱為裝置「已送達」的觀測意義，不是否定其去重缺口。

親自讀本機 source、官方條款與平台文件，並執行只用人工常數、虛構代號的記憶體檢查。公開端點只唯讀抽查 Nasdaq earnings-date 與 SSGA 轉址；沒有執行市場回測、探索統計、正式站請求、Orca 工作或資料庫維運。未用 agent-reach，GitHub API 使用 **0 次**。本次結果證明的是此 checkout 的行為與可觸發條件，不證明正式資料已發生事故。

## 1. 主張查核表

| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
| --- | --- | --- | --- | --- | --- |
| 1 | D1 每查詢上限 100 個參數；100 家單股類聯集使三路徑分別綁定 116／113／105 個；Paid 單庫 10 GB、Time Travel 30 天 | B:113–119、128、162；B-01、B-10 | 已核實 | 官方 2026-10-24 Limits 確列上述三個上限，並說 batch 中各 statement 仍受參數限制。我用現行函式、100 個 `SYN` 公司、固定人工 bar 與只記錄 SQL args 的 fake DB，獨立得到 `[116,113,105]`。反駁檢查：`batchRun` 只分寫入 statement；三條 SELECT 的 `IN` 未分塊；`insertMissingBars` 的每句 96 參數保護不適用這三條查詢。fake D1 直接使用 Node SQLite，未另限制 100 個參數。未在真 D1 執行超限 SQL。 | [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)；`web/src/server/repo.ts:15`、`:44`、`:85`、`:144`、`:172`；`web/src/lib/universe.ts:60`、`:71`；`web/src/lib/watchlist.ts:15`；`web/tests/helpers/fake-cloudflare.ts:17` |
| 2 | Yahoo parser 接受錯 granularity、空歷史，衝突同日資料由最後一筆決定 | B:64–65、153、164；B-02 | 已核實 | 現行 `ChartJson.meta` 只有 symbol／timezone，parser 不讀 `dataGranularity`。人工 `3mo` 回應帶同日 close 10、20，回傳一列 close 20；無 timestamp 的合法 envelope 回 `[]`。反駁檢查：symbol mismatch、非正有限價格確有防護；Map 去重只消除重複列，不能識別價格衝突。搜尋 Yahoo source 與 jobs 的 production 呼叫未見 `range=max`，因此不能推論正式歷史已降頻。 | `web/src/lib/sources/yahoo.ts:13`、`:28`、`:34`、`:40`、`:54`；`web/src/server/jobs.ts:169`、`:184` |
| 3 | 分割重抓只看 fetch fulfilled 就解除 pending，空／短歷史仍可留下混合基準 | B:56、164、186；B-11 | 已核實 | `fetchYahooBatch` 不以 bars 數量決定成功；`full.ok.map(symbol)` 直接送進 `nextPendingRebase` 刪除 pending。獨立合成檢查：先存四日 close 20，三日新價 10 偵測出 factor 2；只以最後一日 close 10 執行 `allowRebase`，DB 仍是前三日 20、末日 10。空 parser 回應與 recovered 名單同樣可清除 pending。反駁檢查：近期寫入遇 rebase 會先跳過、既有 pending 也會隔離；這些確有作用，但沒有補回覆蓋檢查。 | `web/src/server/jobs.ts:114`、`:174`、`:184`、`:186`；`web/src/server/repo.ts:39`、`:69`、`:74`；`web/src/lib/rebase.ts:13`、`:32` |
| 4 | 補記日期裁切不等於當時發布；前台 live 計分未排除延遲補記 | B:81–84、163、178；B-03 | 已核實 | 取最近五個 SPX 資料日，以 `upTo(...,S)` 計算，再寫實際 `created_at` 與 `detail.recordedLagSessions`。歷史與 live SELECT 均未讀生成時間／detail；`liveTrackOf` 只依交易日格線選列。反駁檢查：同日 VIX、SPX match、`ON CONFLICT DO NOTHING` 與 `knownOn <= asOf` 都存在；缺口是發布資格與資料 vintage，不是已證明偷用未成熟標籤，也不是缺 purge／embargo。 | `web/src/server/jobs.ts:496`、`:520`、`:531`、`:541`、`:549`、`:559`；`web/src/server/outlook.ts:44`、`:63`；`web/src/lib/communication.ts:41`；`web/src/lib/forecast.ts:264` |
| 5 | consensus 可混入盤中／不同時點價格；空列仍算涵蓋，EPS 失敗被吞，前台不帶價格／取得時間 | B:85–86、165、179；B-04 | 已核實 | `fetchYahooLastCloses` 取最後一筆，未裁至完成交易日；同 symbol/as_of 更新覆寫。聚合先 `covered += w` 再分別驗 KPI；人工全空列配 10% 權重，得到 covered 10%，三項 KPI 全 null。EPS `.catch(() => null)` 不保留該請求失敗原因；outlook SELECT 沒有 `price_date`／`fetched_at`。反駁檢查：七日 freshness、各 KPI 自己的有效分母確存在，所以不是空資料被算成零目標漲幅；問題是單一涵蓋率的表意與時點。未抽查實際盤中行情。 | `web/src/lib/sources/yahoo.ts:118`；`web/src/lib/sources/nasdaq.ts:224`；`web/src/server/jobs.ts:634`、`:642`、`:645`；`web/src/lib/consensus.ts:30`、`:48`；`web/src/server/outlook.ts:74` |
| 6 | 收盤推播可包含 mismatch／pending 數字，後續修正或部分裝置失敗不會因此自動補送 | B:67、88、127、166、180；B-05、B-08 | 已核實 | `notifyClose` 只要求快照日期等於 expected；人工 snapshot 的 `quality.mismatches=['SPX']` 仍產生收盤訊息。`dailySummary` 的 null 閘門不能阻擋已有數字的錯價。claim key 是 kind/date/user；只要該使用者至少一次 APNs 請求成功就留下 claim，下一輪整則略過；全部失敗才刪 claim 重試。payload 僅 screen/date，沒有 snapshot revision。這是可觸發程式路徑，未發真推播。 | `web/src/server/push.ts:182`、`:192`、`:206`、`:230`；`web/src/lib/push.ts:42`、`:57`、`:62`、`:75` |
| 7 | 推播的成功計數可以稱為已有部分「裝置送達」 | B:127「若同 user 已送達部分裝置」；B:180「按裝置追蹤送達」的前提 | 被推翻 | 原文把成功計數的觀測層級說高了。`sendPush` 在 HTTP 請求成功後取消 response body，直接回 `ok`；`deliver` 把它累加成 `delivered`，沒有裝置收件確認。Apple 官方把狀態分成 “delivered, stored, and discarded”；流程從 “APNs accepts the push notification” 才開始，之後仍可暫存或丟棄。裝置離線後通知在 12 小時有效期內未能送出，就是此程式可遇到的具體區別。**被推翻範圍只限把 APNs 接受當作實際送達；第 6 列的去重行為仍成立。** | `web/src/server/push.ts:79`、`:91`、`:98`、`:199`；[Apple：通知狀態](https://developer.apple.com/documentation/usernotifications/viewing-the-status-of-push-notifications-using-metrics-and-apns)（親讀其官方 `.md` 版第 28、35、43、68 行）；[Apple：APNs 回應](https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns) |
| 8 | Nasdaq `expected*` 被現行 parser 升為 confirmed，UI 顯示公司已公布 | B:66、149、166、181；B-06 | 已核實 | 唯讀 GET AAPL earnings-date 得 HTTP 200；announcement 是 2026-11-02，reportText 含 `is expected* to report earnings`，沒有命中 `estimated`／`derived from an algorithm`。同措辭人工輸入現行 parser 得 `status:'confirmed'`；網頁 confirmed 對應「公司已公布」。反駁檢查：calendar 命中時雖不走此 fallback，其 rows 本來也一律 confirmed；fallback 可在日曆尚未列該公司時觸發。**只核實來源措辭與程式分類，不據此判斷 Apple 是否已另行公告。** | [Nasdaq earnings-date](https://api.nasdaq.com/api/analyst/AAPL/earnings-date)；`web/src/lib/sources/nasdaq.ts:63`、`:73`、`:155`；`web/src/server/jobs.ts:429`；`web/pages/news.tsx:7` |
| 9 | SSGA 同日更正會殘留消失 ticker、合法舊檔無檔齡閘門；原 URL 多一跳 | B:42、59–60、124、150、182；B-07 | 已核實 | 記憶體 DB 同一 as_of 先寫 SYN1/SYN2，再只寫 SYN1，SYN2 仍在；`insertWeights` 沒有刪集合成員。parser 只驗 As of、表頭、至少 400 檔與權重和 95–105%；`weightsNear` 無檔齡限制，找不到過去檔時取之後最早檔。唯讀 curl GET 原 URL 得 301→200，最終路徑移除 `/us/en/intermediary`。反駁檢查：ZIP／完整性檢查與 rolled 標示都有，不能防止內容合法但停止前進的檔案。未量測真實檔齡分布。 | `web/src/server/repo.ts:188`、`:218`；`web/src/lib/sources/ssga.ts:48`、`:73`、`:79`；[原持股 URL](https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx)；[最終 URL](https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx) |
| 10 | 本機 AI 停機後不保證補齊舊加工結果；翻譯看 7 日、重點看 3 日，digest 只取最新 snapshot | B:120、168、183；B-08 | 已核實 | 伺服器支線只讀寫 D1、不呼叫模型；本機腳本負責 pull/push。翻譯 cutoff 使用 `TRANSLATE_DAYS=7`，重點使用 `POINTS_DAYS=3`；daily 只 `getSnapshot(db)`，再查該日期已存在 digest，不遍歷缺少的舊交易日。`NewsFeed` 有 `title_zh ?? title`。Cloudflare news cron 與這條本機加工支線分離。反駁檢查：恢復後可補窗口內未處理項，故不是一停機就永久漏全部。正式 Orca 啟用、cadence、補跑能力未查，不能據 source 宣稱目前排程健康或實際停擺。 | `web/src/server/ai-batch.ts:1`、`:14`、`:17`、`:60`、`:69`、`:84`、`:88`；`web/scripts/ai-batch.ts:194`；`web/src/ui/NewsFeed.tsx:55`；`web/crons/news.ts:5`；`web/src/server/jobs.ts:778` |
| 11 | 提早收盤清單未參與 latestExpectedClose；仍等 16:30 ET，而 NYSE 指定兩個 2026 日期為 13:00 早收 | B:61–62、126、187；B-12 | 已核實 | 官方 NYSE 頁明列 2026-11-27、2026-12-24 13:00 ET 早收。source 雖列 `NYSE_EARLY_CLOSE`，`latestExpectedClose` 只比較固定 16:30；人工時間 2026-11-27 14:00 ET 回 2026-11-25（26 日休市），未認定 27 日可用。反駁檢查：`America/New_York` 已處理 DST，21:40 UTC 排程兩季都晚於 16:30；這是早收後提早服務的延遲，不是正常 cron 會抓到盤中的證據。 | [NYSE Hours & Calendars](https://www.nyse.com/markets/hours-calendars)；`web/src/lib/calendar.ts:22`、`:59`、`:71`、`:77`；`web/crons/prices.ts:5` |
| 12 | Cboe 條款連用其材料核對／更正別源資料也列為原則須事前書面同意的用途 | B:101、167、184；B-09 | 已核實 | 親讀 Terms §2，確含 “use to verify or correct other data or information”；同段列個人非商業單份用途、其他保存／顯示／衍生限制及法定 fair-use 例外；頁首日期為 2022-11-16。反駁檢查：例外確存在，不能把一般限制直接說成已違法。這足以支持盤點 SPX cross-check 權利，仍未讀到本專案特約或 daily CSV 的另行許可。 | [Cboe Terms](https://www.cboe.com/terms/) §2；現行用途 `web/src/server/jobs.ts:165`、`:194` |
| 13 | FactSet Terms of Use 確有限制自動擷取、scraping、複製／散布與衍生，不只是 JS shell | B:102、167、184；B-09 | 已核實 | 在官方 legal 頁展開 Terms of Use，讀到 License、個人非商業單份下載與 Acceptable Use；其中明列 scraper／scripting 等自動擷取，以及翻譯、修改等限制。反駁檢查：License 也授予依條款使用公開服務的有限權利；這不能擴張成任意解析、保存、再展示的明示許可。未取得 Earnings Insight PDF 特別條款或本專案契約，結論只限一般條文存在。 | [FactSet Legal](https://www.factset.com/legal)，Terms of Use → License／Acceptable Use Policy |
| 14 | SSGA 美國站限制對外複製／發布與以站內資料替代 supplier 授權 | B:100、167、184；B-09 | 已核實 | 親讀美國站 Access 段落：個人列印與 “internal use within your organization” 是例外；Restrictions on use 限制發布／再傳，且不得替代必要 Supplier license。反駁檢查：其中 remote access、customer 措辭確讓公開 XLSX 的具體適用需另判斷；報告有保留這點，因此「需盤點授權」成立，「已證明本網站違約」不成立。 | [SSGA 美國站 Terms and Conditions](https://www.ssga.com/us/en/footer/terms-and-conditions)，Access／Restrictions on use |
| 15 | Nasdaq 官方限制資料捕捉、個人非商業以外使用及再發布；B 稱頁面 Last Updated 2026-05-11 | B:99、167、184；B-09 | 部分 | 完整 DOM 正文讀到 §2 資料捕捉限制、§6 “personal, non-commercial use”、§7 分享／衍生與 AI／分析軟體限制，主旨得到支持。但本次抽取正文 51,507 字元，沒有 `Last Updated`、`May 11` 或 `2026` 的日期標記，**未親見 2026-05-11 版本日**。不能因此判日期為假，也不能繼續標成版本日已核實。另讀 Zacks 官方 Terms，可見 2025-02-19 更新日與 scraping 限制；它不證明 Nasdaq 有無轉授權。 | [Nasdaq Legal](https://www.nasdaq.com/legal) §2、§6、§7；[Zacks Terms](https://www.zacks.com/terms_of_service) |

合成檢查均直接 import 現行函式；SQL 寫入只在 `:memory:`，未讀任何市場價格檔。表中「已核實」不把這些合成觸發條件升格為正式事故。D1 實際大小、方案與備份可還原性仍未量測；B-10 的數值依據僅是官方平台限制。

## 2. 與事前登記或排除清單的衝突表

逐一對照 `forecast.md` 第一輪、第二輪草稿及 `proposal.md` §6。**十二項建議本身均未新增投資訊號，也未重開已否決的候選；下表列出必須保留的邊界與既有草稿重疊。** 第二輪仍按文件的草稿狀態處理，未查證其已完成登記合併。

| 建議 ID | 衝突的規則 | 說明 |
| --- | --- | --- |
| B-01 | 無直接衝突；`forecast.md:142` R2-0；`proposal.md:409` 起 §6 | SQL 分塊與合成容量驗證不新增 flag、不計算市場成績，不占研究名額；保留。 |
| B-02 | 無直接衝突；執行邊界為 `forecast.md:43`、`:51`、`:169` | 拒收壞輸入可與資料修復分開實作；若修後重報模型成績，須另登記。名額 A 的輸入 hash 不符就不得執行，不能用「清資料」直接替換凍結 CSV；既有試驗結果也不能覆寫。超出現有日曆 coverage 的資料不能無聲當成非交易日刪除。 |
| B-03 | 與 `forecast.md:111` L09、`:112` G02、`:149` R2-6 **重疊，須整合**；另見 `:118`、`:180` | 生成時間／補記顯示可保留；即時、補記、資格不明、版本分組與不遞補格線，第二輪草稿已定義。不能另起一套 live 納入規則或回寫 immutable 舊列。若補上第 4 節的整體停更問題，須先修訂登記再改評分資格。沒有重開 `proposal.md:426` 的 purge／embargo。 |
| B-04 | 無直接衝突；`forecast.md:142` R2-0、`:144` R2-2；`proposal.md:411`、`:417` | 顯示欄位時間與 KPI 有效涵蓋率屬背景資料品質；不能藉此把 analyst target／EPS 或策略師訊號接進 P(up)／dd5。B 已明言保持背景，故不算重開。 |
| B-05 | 無直接衝突；`forecast.md:114` L17／X03；`proposal.md:425` | 對錯價降級、保存 revision、改善裝置請求狀態，不是依 P(dd5) 改倉或扣款。需先更正「送達」語意；接受／送達的區分本身不需預測登記。 |
| B-06 | 無直接衝突；`forecast.md:142` R2-0、`:144` R2-2；`proposal.md:418` | 調整事件確認標示不新增事件型預測條件、不改 21 日計分目標。舊 App status 相容性是實作驗收，不是額外試驗名額。 |
| B-07 | 無直接衝突；`forecast.md:169`；`proposal.md:433` | 檔齡、版本、同日集合更正與代號待確認均可保留；不可將最新 holdings 冒充歷史 universe，也不是重開 N-PORT 權重回補。若量化對模型分數的影響，須先登記並遵守凍結輸入。 |
| B-08 | 無直接衝突；`forecast.md:114`；`proposal.md:425` | heartbeat、英文標題降級與 queue 不涉及風險調整扣款或新增條件。大規模 queue 仍應由觀測到的規模決定；官方額度上限不是目前已需改架構的證據。 |
| B-09 | 無直接衝突；`proposal.md:431`、`:433` | 授權清冊及逐源停用是來源治理；不能拿可下載、另一域名或供應商轉載當成授權，也不能因此重開被排除的 scraper／模型輸入。高風險只保留為待釐清的用途落差。 |
| B-10 | 無直接衝突；`forecast.md:112` G02、`:120`、`:169` | 容量／備份／還原驗證可保留；retention 或封存不得刪除不可變預測、第一輪結果／虛無值、第二輪凍結輸入及其核驗依據。原建議已保留 ledger，沒有直接衝突。 |
| B-11 | 無直接衝突；`forecast.md:52` D2、`:54` D4、`:112` G02；`proposal.md:434` | 修復拆股基準不等於換 Adj Close／TR 或 TWD 標籤；不得把修復後資料回寫成當時 forecast close。重報分數前另登記，舊 snapshot 可附版本／新增 revision，不改既有 forecast。 |
| B-12 | 無直接衝突；`forecast.md:52` D2、`:54` D4；`proposal.md:418` | expected 日期與早收服務說明屬資料時點；不能把服務等待時間改動偷換成 21 個交易日以外的目標／頁面數字。現有晚間 cron 沒有被本次查核證明需要提前。 |

## 3. 證據等級高估清單

- **預測效果分類未發現高估。** B:9 與建議表 B:176–187 全為 `none`，沒有把銀行自述升為獨立檢驗，也沒有用樣本內或橫斷面選股證據證明指數擇時。不能因本次工程重現就把任何建議升為 `independently_tested`；該標籤在此研究的定義是預測效果證據。
- **推播的觀測層級確有高估（第 7 列）。** HTTP 成功／APNs 接受被寫成裝置「已送達」。應分開記請求嘗試、APNs 接受／拒絕、未知裝置狀態；若要聲稱實際送達，須有對應的額外證據。Apple 的官方狀態文件明列接受後仍可暫存或丟棄；即使送達，也不能再推成使用者已看見。[Apple 官方文件](https://developer.apple.com/documentation/usernotifications/viewing-the-status-of-push-notifications-using-metrics-and-apns)
- **Nasdaq 條款版本日的「已核實」需縮限（第 15 列）。** 限制原文已親見，但本次沒有讀到 2026-05-11 的版本標記；保留查閱日，不重複宣稱該版日期已獨立核實。[Nasdaq 官方條款](https://www.nasdaq.com/legal)
- **其餘工程與授權結論應維持原有保留。** 合成超限／解析輸入不是正式事故，API 的 expected 文案不是公司未公告的證據，一般網站條款不是特定資料契約的最終適用判斷。本次確認 B 已多次明列這些限制（B:7、94、199–204），不把合理保留誤列為作者已經高估。

## 4. 最重要的遺漏

**B-03 沒有檢查「整條 SPX 資料流停更，卻仍被標為 lag=0」的情境。** `recordForecast` 取資料庫最後五個 SPX 日期（`web/src/server/jobs.ts:520`），用它們的相對位置計算 lag（`:546`），沒有與執行當下 `latestExpectedClose()` 比較；若 DB 最後一天 S 已落後真正市場交易日，但 S 的 SPX/VIX 已齊、核對 match 且尚無 forecast，S 仍可被寫成 `recordedLagSessions=0`。同日 VIX／match／不可覆寫都擋不住此情境。因此只顯示補記標記仍不足以認定當時準時發布；而第二輪草稿 `forecast.md:149` 的 R2-6 又正以這個欄位為資格核心，應先釐清「資料庫最新日」與「排程當時應有的交易日」、真實生成／發布時間的關係，再登記修訂資格規則。這是由現行控制流程得到的可觸發推論，未查正式資料是否發生，也未跑任何市場計分。

## 5. 結論：建議的去留

- **保留 B-01、B-02、B-04、B-06、B-07、B-11**：關鍵程式缺口均獲一手來源或合成重現支持；優先修可定位的查詢與資料完整性問題。
- **保留 B-03，但併入既有 R2-6**：補上整體停更仍可能 lag=0 的資格缺口；評分規則先登記，不重寫舊 forecast。
- **保留 B-05，但刪除把 APNs 接受等同裝置已送達的表述**：錯價降級、revision 與逐裝置請求追蹤有依據；實際送達目前沒有對應觀測證據。
- **保留 B-08、B-10、B-12；架構擴張降為有條件後續**：先量測 heartbeat、容量、失敗與通知規模；目前沒有正式事故或裝置量證據要求立即導入 queue，也沒有證據要求提早 cron。
- **保留 B-09 的授權盤點與用途控制**：條款限制原文成立；Nasdaq 2026-05-11 版本日降為未核實，「高」只表示待釐清的授權風險，不是違約判定。

沒有一整項建議需要刪除；十二項均未重開已否決的投資訊號。資料修正後若要重新報告模型成績，仍須先登記並保留原始試驗證據。
