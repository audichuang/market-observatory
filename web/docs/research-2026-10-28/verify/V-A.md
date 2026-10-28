# V-A：任務 A 研究結果獨立查核

查核日期：2026-10-28（Asia/Taipei）。已先讀 `prompts/A.md`，再讀報告全文及「給整合者的摘要」。本機 HEAD 為 `99066fd3ad63ec7b040f6fd447f255b2d3c3964a`，與原報告相同；下列 repo 行號均指本次親自打開的檔案，不以另一份 LLM 查核文字替代原始碼。

選取 15 條主張：14 條建議各選一組核心程式／規格主張，另選支撐摘要的精確回測數字。判定計數：**已核實 14／部分 1／被推翻 0／無法核實 0**。「已核實」限於表內寫明的程式行為或文字事實，不代表正式資料已發生事故，也不代表修正已上線。未操作正式站或 iOS，未讀正式 D1；沒有對市場歷史資料執行回測、探索統計或重新計分。

另查第二輪合併事實：`gh api repos/audichuang/market-observatory/pulls/35` 回傳 `merged: true`、`base: main`、`merge_commit_sha: 955d8d3cfa79dd306e7a067db6a50b972783de36`、`merged_at: 2026-10-28T00:37:21Z`；本機該 merge commit 的時間為 08:37:20 +08:00，且是 HEAD 的祖先。因此原報告「已合併登記」成立，標題「草稿」不使登記失效。GitHub API 共用 **1 次**，未用 agent-reach。來源：[PR #35](https://github.com/audichuang/market-observatory/pull/35)、`web/docs/forecast.md:118`、`:120`。

## 1. 主張查核表

本表「原報告」均指 `web/docs/research-2026-10-28/results/A-judgment-audit.md`。同一列的多個原始碼位置用來核對同一個因果鏈；有保護條件的，列出它為何未能完全擋住所述情境。

| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
| --- | --- | --- | --- | --- | --- |
| 1 | A-01：P(up) 前瞻計分會納入延遲補記；dd5 缺獨立版本及前瞻分數。 | §2 A-01，行 53；摘要行 214、224 | 已核實 | 寫入有 `recordedLagSessions: lag`，但計分 SQL 只取 `date,p,base,close`；`liveTrackOf` 只篩格點與成熟日。以合成資料傳入 lag=2 與 lag=0 的兩個成熟格點，得到 `n=2`。價格截到預測日、同日 VIX、SPX match、不可覆寫等保護均存在，仍不驗證發布時間。dd5 寫入只有 p/base/scored/cellGate，沒有專屬 modelVersion；回傳只有一個 up 的 liveTrack。**正式混入筆數未核實，且 n<12 不報 BSS 的保護確實存在。** | `web/src/server/jobs.ts:531`、`:537`、`:541`、`:549`、`:559`、`:562`；`web/src/server/outlook.ts:63`、`:96`；`web/src/lib/communication.ts:43`、`:53`、`:59` |
| 2 | A-02：dd5 的 cellGate 已算出，但 scored 未使用它；這是待上線的新規則。 | §2 A-02，行 54；摘要行 214、225 | 已核實 | `drawdownScored` 只有全域 `bssLow > 0`、所用樣本 nEff 與 episodes 三條件。`buildOutlook` 將 cellGate 與 scored 分別裝入物件，沒有以 gate 攔 scored。合成輸入可得 `scored=true, gate=false`。反證檢查：原 G09 的確只規定上述全域／樣本條件，不能把原實作說成違反原規則；R2-5 才新增 cell skill 條件。 | `web/src/lib/forecast.ts:611`、`:625`、`:748`；`web/docs/forecast.md:66`、`:148` |
| 3 | A-03：兩端主報的 BSS 仍來自單一相位，未明標 offset 0。 | §2 A-03，行 55；摘要行 226 | 已核實 | `buildOutlook` 對 up/dd5 分別呼叫一次 `walkForward`；該函式只評估一份 `walkForwardRows`。網頁 KPI／面板直接取這兩個 evaluation，Swift 也相同，標題沒有相位資訊。反證檢查：離線確有 `phaseAverageFromCells`，但 runtime 路徑沒有引用它；「已分兩目標」並不等於「已做相位平均主報」。 | `web/src/lib/forecast.ts:528`、`:721`、`:725`；`web/src/lib/forecast-eval.ts:172`；`web/pages/outlook.tsx:168`、`:199`；`ios/MarketObservatory/Views/MoreView.swift:457`、`:461`；`web/docs/forecast.md:147` |
| 4 | A-04：同日盤後新聞可進收盤原因輸入，逐則時間及來源未送進 prompt。 | §2 A-04，行 56；摘要行 218、227 | 已核實 | parser 對 `created` 只擷取月日年；合成 `Oct 28, 2040 5:30 PM ET` 變成 `2040-10-28`。每日工作以 `published_at = date` 選新聞；個股只帶標題／摘要等，大盤只帶標題。反證檢查：prompt 已禁止編造並允許原因不明，但沒有發布時間與「不得把盤後當盤中原因」的限制，不能據此排除該輸入。**未證明正式文章曾犯此錯，也未證明真實上游每則都有可信時分。** | `web/src/lib/sources/nasdaq.ts:106`、`:123`；`web/src/server/ai-batch.ts:91`、`:103`、`:125`；`web/src/lib/news-ai.ts:129`、`:142`、`:163`、`:193` |
| 5 | A-05：空共識仍增加總涵蓋權重，各指標則有各自分母。 | §2 A-05，行 57；摘要行 215、228 | 已核實 | `covered += w` 先於 price/target、ratings、revisions 的有效性判斷。單一合成空列、權重 7，回傳 `symbols=1, coveredWeightPct=7`，三項指標全 null。反證檢查：空列不是只能由手工壞資料造成；抓取遇 `No record found` 會轉成 EMPTY_VIEW，成功寫入。畫面的「涵蓋不到一半」也只看總 coveredWeight，未檢查各指標分母。 | `web/src/lib/consensus.ts:48`、`:53`、`:57`、`:62`、`:68`；`web/src/server/jobs.ts:608`、`:634`、`:638`、`:645`、`:653`；`web/pages/outlook.tsx:316` |
| 6 | A-06：top 表與彙總 freshness 不同，price_date／weights as_of 在讀取時丟失。 | §2 A-06，行 58；摘要行 215、229 | 已核實 | 彙總以 UTC today 往回 7 日篩；資料庫查詢卻以 outlook／最後 SPX 日期往回 10 日預篩，top 後續只篩 weights、排序、去重、取 12。故例如 today=10/28、outlook=10/28、列 asOf=10/20，可進 top 而不進彙總。反證檢查：確有 DB 預篩，故不是任意久遠列都能進；但它仍無法保證與 7 日 cutoff 一致。SELECT 沒取已存的 price_date，weights SELECT 也沒回傳 as_of。 | `web/src/lib/consensus.ts:30`、`:35`；`web/src/server/outlook.ts:69`、`:74`、`:75`、`:78`、`:79`、`:100`；`web/src/server/jobs.ts:645` |
| 7 | A-07：總覽可顯示早於最新快照的 forecast，卡片未顯示預測日期。 | §2 A-07，行 59；摘要行 230 | 已核實 | 總覽 SQL 無日期匹配，獨立取最後 forecast。缺同日 VIX 或 SPX 尚未 match 會跳過新預測，而快照仍可更新。兩端卡片均未使用 trade_date/tradeDate。反證檢查：`viewingLatest` 只等於「未選歷史日期」，不是 forecast 與 snapshot 同日；所以它只擋歷史頁情境，擋不住最新頁的舊預測。 | `web/src/server/jobs.ts:197`、`:201`、`:531`；`web/src/server/views.ts:77`、`:109`、`:111`；`web/pages/index.tsx:87`；`ios/MarketObservatory/Views/OverviewView.swift:180` |
| 8 | A-08：iOS 仍顯示以 50% 為界的命中率，call 已改相對基準率。 | §2 A-08，行 60；摘要行 217、231 | 已核實 | evaluation 的 hitRate 仍用 `r.p > 0.5`；callOf 比的是 p 與 base。合成 p=0.60、base=0.65、通過 gate，可得 call=down，但半數規則為 up。Swift 的 up 區塊明傳 `showHitRate: true`，實際列出「預測方向命中率／永遠猜上漲的命中率」。反證檢查：dd5 傳 false，只擋 dd5；網頁確已沒有該列。此合成情境不表示歷史上已有 down call。 | `web/src/lib/forecast.ts:513`、`:637`；`ios/MarketObservatory/Views/MoreView.swift:459`、`:463`、`:589`；`web/pages/outlook.tsx:69`；`web/docs/forecast.md:35`、`:65` |
| 9 | A-09：outlook=null 時，後端與網頁保留歷史紀錄，iOS 隱藏它。 | §2 A-09，行 61；摘要行 232 | 已核實 | 後端 buildOutlook 後繼續查詢 recent/liveTrack，不因 null 提早返回。網頁 null 分支仍放 trackPanel；Swift 的 `forecastSection(p)` 則在 `if let o = p.outlook` 內，else 僅說資料不足。反證檢查：機構觀點在 if 外，因此被隱藏的是歷史紀錄區，不能擴張成「iOS 整頁都無資料」。 | `web/src/server/outlook.ts:22`、`:43`、`:63`、`:92`；`web/pages/outlook.tsx:246`；`ios/MarketObservatory/Views/MoreView.swift:382`、`:465`、`:470` |
| 10 | A-10：「我的規劃」兩端用詞不同，exitConsiderationPct 沒有門檻觸發或出場引擎。 | §2 A-10，行 62；§4 行 198–206；摘要行 216、233 | 已核實 | 網頁是「檢討門檻 ±%」「漲跌達…時檢討」，Swift 是「考慮出場的漲幅／考慮出場漲幅 %」。追過欄位引用後，只有 schema、儲存、模型、表單／顯示；預算÷單筆的分次數只在網頁。反證檢查：推播確有 moves 門檻，但用的是另一欄 moveThresholdPct，對名單個股單日漲跌計算；notifyClose/notifyEvents 沒有讀 plan。 | `web/pages/etfs.tsx:207`、`:222`；`ios/MarketObservatory/Views/MoreView.swift:254`、`:299`、`:312`；`web/src/server/views.ts:224`、`:244`、`:257`；`web/src/lib/push.ts:62`；`web/src/server/push.ts:230`、`:251` |
| 11 | A-11：定投首筆可能落在月中；FX 實作容許之前最近一筆，文案卻說當日。 | §2 A-11，行 63；摘要行 234 | 已核實 | `simulateDca` 先 filter startDate，再用 lastMonth="" 判首筆；合成資料已有 1/02，但 start=1/15 時，1/16 仍投入首筆。上游 startDate 是 end 減 years×365.25 日，沒有對齊月初；FX 使用 `onOrBefore(p.date)`，會取前值。反證檢查：資料足夠的 guard 只檢查價格起點，沒有把首月改成下個完整月份；不含配息／稅費的警語也未解決日期口徑。 | `web/src/lib/analytics.ts:157`、`:165`；`web/src/server/views.ts:294`、`:299`、`:303`、`:304`；`web/pages/etfs.tsx:187`；`ios/MarketObservatory/Views/MoreView.swift:248` |
| 12 | A-12：歷史比較圖與報酬統計的起點不同，終值可不一致。 | §2 A-12，行 64；摘要行 235 | 已核實 | 比較圖先取 date≥start 的第一個 close 歸零；stats/mainStats 用 `periodReturn`，其起點是 onOrBefore(start)。合成 start=2040-01-07、價格 1/06=100、1/09=110、1/10=121，圖終值約 10%、表格約 21%。反證檢查：兩者用同一份 loaded series 也不夠，因挑基準點的方法本就不同；圖沒有改用 periodReturn 的共同 anchor。 | `web/src/server/views.ts:152`、`:169`、`:183`、`:217`；`web/src/lib/analytics.ts:64` |
| 13 | A-13：RSP−SPX 是百分點差，兩端卻加上 %。 | §2 A-13，行 65；摘要行 236 | 已核實 | snapshot 存 `rspReturn - returnPct`，兩者均為百分比報酬。網頁 Delta 傳 percent，最終 pctText 加 `%`；Swift 用 Fmt.pct，同樣加 `%`。反證檢查：不是乘除 100 的尺度錯誤，僅差值的單位標示錯；marketPrompt 已明寫「個百分點」。 | `web/src/lib/snapshot.ts:252`；`web/pages/index.tsx:75`；`web/src/ui/bits.tsx:4`；`web/src/ui/format.ts:16`；`ios/MarketObservatory/Views/OverviewView.swift:323`；`ios/MarketObservatory/Format.swift:26`；`web/src/lib/news-ai.ts:185` |
| 14 | A-14：現行設計摘要仍描述硬切換，與已啟用收縮不同；文獻更正尚未全部落進原表。 | §2 A-14，行 66；§3 M-07，行 84；摘要行 237 | 已核實 | forecast.md 行 7 說 Wilson 未排除基準率就不採條件；DEFAULT 的 shrinkK=40，而 pickProbability 在 shrinkK 非 null 時不論 distinct 都回傳加權機率。反證檢查：distinct 仍約束 call，卻不把 p 強制拉回 base。另 R2-10 明列 BTZ→academic_is 等更正，但原表 BTZ 仍標 academic_oos（有爭議）；這證明「更正未落實」，**不等於本次已重讀並核實每篇論文的正確等級**。 | `web/docs/forecast.md:7`、`:153`、`:241`；`web/src/lib/forecast.ts:80`、`:90`、`:306`、`:310`、`:637`；`web/src/lib/communication.ts:83` |
| 15 | 摘要引用的已登記結果：P(up) BSS 0.001 [−0.007, 0.009]、dd5 相位平均 0.038 [0.014, 0.064]，分別未偵測到／正向 skill。 | 行 9、17–18；摘要行 213（透過引用承接數字） | 部分 | 親見試驗登記逐字列出兩組數字；R2-4 也確認 dd5 的 0.038 是相位平均、0.049 是 offset 0，截止 2026-10-23。但這是專案自己的結果登記；本次在 .backtest 只見兩份輸入 CSV，所查 repo 檔案未取得對應這兩組數字的原始逐列計分及機器執行輸出。依限制沒有重算，所以只核實「引用符合登記」，沒有獨立核實數字本身。原報告標 anecdotal 合宜；「零」應讀為未偵測到，而不是證明真實效果為零。 | `web/docs/forecast.md:33`、`:34`、`:147`；`web/.backtest/SPX.csv`、`web/.backtest/VIX.csv`（僅核對檔案存在，未計算行情）；計分路徑 `web/scripts/backtest.ts:124`、`:138` |

合成操作均從 `web/` 用 `node --input-type=module` 經 stdin 直接 import 現有函式；沒有新增測試檔、改 source 或讀市場 CSV。關鍵輸出如下，`2040` 日期及所有價格都是人工 fixture：

```text
A-01：lag2Included=true, n=2, tooFew=true
A-02：scored=true, gate=false
A-04：created="Oct 28, 2040 5:30 PM ET" → publishedAt="2040-10-28"
A-05：coveredWeightPct=7，三個指標都是 null
A-08：call=down，halfThresholdDirection=up
A-11：start=2040-01-15，第一筆 path=2040-01-16，invested=1000
A-12：chartPct=10.000000000000009，tablePct=20.999999999999996
```

## 2. 與事前登記或排除清單的衝突表

逐一對照 `web/docs/forecast.md` 第一輪、第二輪，以及 `web/docs/research-2026-10-27/proposal.md` §6。依 forecast.md:120 的明文優先順序，第二輪高於第一輪及研究章節；不能拿 proposal 舊稿覆蓋已合併規則。**14 條建議的文字本身未見直接重開已否決項目；下表列出執行時必須維持的界線及一項新增登記需求。**

| 建議 ID | 衝突的規則 | 說明 |
| --- | --- | --- |
| A-01 | 無直接衝突；G02／L09、R2-6（forecast.md:111–112、149）；proposal §6:425、427 | 保留原始列、分開資格與版本符合規則。P(up) 的新資格尚未涵蓋在 dd5 的 R2-6，原報告已要求另補登記。第 4 節發現 lag=0 仍會納入停更後的舊列；要增加真正發布時點資格，須新增修訂條目，不能回寫既有登記或修改原預測。不得順便把前瞻分數做成調倉／停扣或退場觸發。 |
| A-02 | 無；R2-5（forecast.md:148）高於 proposal M-03 的舊版本 | 可接已登記 gate，但要升版本、記生效日與各項失敗原因，舊紀錄依原 G09。不得把已刪除的事件群下限重新加回；這是新規則落實，不是宣稱舊 G09 寫錯。 |
| A-03 | 無；L02／R2-4（forecast.md:73、147）；proposal §6:423 | 主報各相位先算再平均，offset 0 gate 另標。不可混池計分、改 gate 門檻、把 0.038 寫死成未來常數，也不可順便把 R2-7 的可靠度診斷搬上頁面。 |
| A-04 | 無；forecast.md:11；proposal §6:430–431 | 時間與來源是編輯輸入修正，不是重開 rates/USD/oil 的預測輸入或未授權 surprise 抓取。不得把日報、原因分類與事件敘事回饋機率，也不能宣稱加時間便已證明因果。 |
| A-05 | 無；forecast.md:11、21 | 顯示有效涵蓋數不等於驗證共識的短期預測力；沒有新增 flag 或模型權重。proposal §6 沒有禁止這種資料品質呈現。 |
| A-06 | 無；forecast.md:11、21 | freshness 對齊與 as-of 揭露屬共識資料呈現，不重開目標價作為 21 日方向輸入，也不應把子集外推改稱全指數完整目標。proposal §6 無直接禁止。 |
| A-07 | 無；G02（forecast.md:112） | 加預測日期／待更新狀態不改預測或標籤。不能為追上快照而覆寫已存的預測；也不需增加試驗名額。proposal §6 無直接禁止。 |
| A-08 | 無；L01 及其試驗登記（forecast.md:35、65） | 是落實移除半數命中率；保留舊 API 欄位可維持相容。proposal §6:428 禁的是投行命中率排名，此建議也沒有要求新增該排名。 |
| A-09 | 無；M5／L09（forecast.md:55、111） | 歷史紀錄可顯示，當期預測仍須服從 VIX 最多落後 3 個 SPX 交易日；不得為了填滿 UI 放寬 M5 或把舊紀錄冒充新預測。proposal §6 無直接禁止。 |
| A-10 | 無；L17／X03（forecast.md:114）；proposal §6:425 | 統一為檢討備忘符合產品邊界。若擴充成用 P(dd5) 自動加碼、停扣、出場或部位調整，就會重開永久否決項目；原建議沒有要求這些。 |
| A-11 | 無；forecast D2／L16（forecast.md:52、113）；proposal §6:434 | 這是定投試算的交易日期與 FX 說明，不是 forecast 的幣別／含息標籤改動。可用合成日期驗證；本次未重跑歷史試算，不因此開啟 TWD／TR 機率研究。 |
| A-12 | 無；forecast 的 D1／D2（forecast.md:51–52）不等於歷史圖表的顯示起點 | 調整圖表 anchor 或列出各自日期，不改模型歷史起點、成熟標籤及任何預測結果。proposal §6 無直接排除這種呈現修正。 |
| A-13 | 無；forecast.md:23 | 只改描述性 RSP 差值的單位，不把已放棄的廣度改回方向條件，沒有重開試驗。proposal §6 無直接禁止。 |
| A-14 | 無；G01、R2-10、優先順序（forecast.md:62、120、153）；proposal §6:424 | 可更新「現行設計」及落實文獻更正，但不得用現況去改寫舊登記。proposal 的「第三 flag 通過後自動等權組合」重開路徑已被 R2-9（forecast.md:152）撤銷；不可因整理文件而恢復該承諾。論文事實另以原文查核，不能只因 codex-review 寫過就標已核實。 |

## 3. 證據等級高估清單

- **選取的 14 條修正建議未發現 bank_claim 被升為 independently_tested、樣本內被改稱學術 OOS，或橫斷面選股被套成指數擇時。** 原報告行 9、49 把程式事實標 `none`、自家回測標 `anecdotal`，與本次打開的原始碼及登記範圍一致。這個判定不替其他研究任務背書。
- **精確回測數字只能列「既有登記值」。** 第 15 條未取得原始執行產物，不把 forecast.md:34 的「獨立 Python 重算 0.0488」再包裝為本次 independently_tested；另一模型寫下「獨立」不構成新的獨立驗證。原報告已坦承未重算，因此這是整合時需要保留的證據上限，而非指控它已冒報重算。
- **「P(up) 為零」有被讀成確定無效的風險。** 同一報告行 9 有補「偵測不到增額預測力」，應保留這個完整說法；登記的 0.001 及跨零區間不證明真實效果恰為零（forecast.md:33）。
- **靜態缺口及合成重現，不等於正式事故的頻率或損害。** A-01 的「高」是修正優先判斷，不能轉成「正式前瞻績效已嚴重失真」；A-04 也不能轉成「已發現盤後消息被誤寫成原因」。原報告行 49、248 已保留未核實界線；本次同樣不替它補上事故證據。
- **「即時前瞻」的品質不能只靠 lag=0 保證。** 第 4 節的合成操作顯示，連 R2-6 所定義的即時資格都可能含停更後才寫的舊日期。未另定發布時限前，不應在完成 A-01 後就宣告已取得乾淨的前瞻證據。
- **A-14 的文獻更正清單是待辦，不是原文驗證紀錄。** 親見 forecast.md:153 要求 BTZ→academic_is，但 :241 仍把明稱「樣本內結果」的同一列標 academic_oos；可確認文件內部等級矛盾，不能僅憑這兩處或 codex-review 就宣稱本次已完成 BTZ、C&D、Huang 等論文的一手核實。原報告行 84 明說「只查落實」，整合者不應省略此限定。

## 4. 最重要的遺漏

報告抓到「lag≥1 補記混入前瞻計分」，卻沒有檢查 **lag=0 本身是否足以代表即時發布**：`recordForecast` 以資料庫 SPX 最後 5 列計 lag（`web/src/server/jobs.ts:520`、`:546`），沒有將交易日與真實寫入時刻的應有收盤日相比；價格工作即使發現 stale，仍先呼叫 recordForecast，最後才回報 partial（`:192`、`:201`、`:215`），獨立 forecast 工作也直接呼叫它（`:718`）。本次用記憶體 SQLite、900 筆合成 SPX/VIX、同日 VIX 與 match，令最新儲存日為 2040-01-06、時鐘為 2040-01-13T23:00:00Z；實際輸出 `expectedClose=2040-01-13, tradeDate=2040-01-06, createdAt=2040-01-13T23:00:00.000Z, recordedLagSessions=0`。因此按現有 R2-6 加上版本欄位仍可能把遲一週的預測列當即時。這不是已知正式事故，但足以要求 A-01 在交付前先提出新增登記：固定可接受的發布時限及 created_at 判準，並說明舊列如何分類；不得直接改既有規則、覆寫舊列，或在本次額外計算市場歷史的受影響筆數。

## 5. 結論：建議的保留、降級或刪除

- **保留 A-02～A-13。** 核心程式主張均經一手原始碼核對，部分另以合成輸入重現；未發現直接重開已否決項目。仍須遵守版本、生效日、API 相容性與原登記的界線。
- **A-01 保留，但先補登記再定完成標準。** 現有補記污染確實可觸發；只依 R2-6 篩 lag=0 仍不足以保證即時，須補查真正發布時點。正式影響程度維持未核實。
- **A-14 保留文件與程式一致性修正；文獻部分維持待核。** 不把其他模型的更正清單當成已重讀原文。
- **摘要的精確 BSS 數字降為「既有試驗登記值，本次未獨立核實」。** 不因此推導交易效益，也不新增回測。
- **沒有因主張被推翻而必須刪除的建議。** 本次判定為已核實 14、部分 1、被推翻 0、無法核實 0。
