# V-G：任務 G 研究結果獨立查核

查核日：2026-10-28（Asia/Taipei）。先讀任務規則 `web/docs/research-2026-10-28/prompts/G.md`，再由「給整合者的摘要」及 G-01～G-05 反查十五條關鍵主張。下文 `G:行號` 指 `web/docs/research-2026-10-28/results/G-x-practitioners.md`；本機行號均為本次實際讀取的版本。

**判定：已核實 13 條、部分 2 條、被推翻 0 條、無法核實 0 條。** 「已核實」只表示指定來源確實支持該主張；作者自報績效並未因此變成獨立驗證。G-04 的函式描述有原文支持，但漏讀正常排程的阻擋條件，故整體列為「部分」，不把整條描述判成不存在。

本次 X 使用 `agent-reach twitter thread` 一次，成功取得 Bilello 原貼文；未遇停止類錯誤。GitHub 使用 `gh repo view`／`gh api` 共四次指令，其中一次在本機被 zsh 的未加引號問號擋下，實際送出三次唯讀請求。PDF 除讀取正文，另直接渲染、檢視 Bespoke 第 12 頁、Goepfert PDF 第 5 頁、Callum 第 11 頁與 3Fourteen 第 1 頁的表格／圖。未執行作者程式，未下載市場歷史資料，未做回測或探索統計；程式驗證只用了兩個合成文字輸入，未呼叫正式站管理 API。

## 1. 主張查核表

| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
| --- | --- | --- | --- | --- | --- |
| 1 | Mauboussin／Callahan 用適當 reference class 的基準率作 prior，再依新資訊更新；2.0 回應通膨、產業切樣與世界改變，並非選股報酬 OOS。支撐 G-02／G-03。 | G:104–117、289 | 已核實 | 2026-05-13 官方 PDF 第 1 頁說先用基準率、再更新；第 2 頁明寫 “base rates are dynamic distributions”，並區分營收成長與創造價值。第 3 頁 Exhibit 1 是同起始營收規模公司的五年營收成長分布，並非股票報酬預測計分。 | [Bayes and Base Rates 2.0，第 1–3 頁](https://www.morganstanley.com/im/publication/insights/articles/article_bayesandbaserates2_ltr.pdf) |
| 2 | Maggiulli 的 40 年比較中，完美買低點超過 70% 的期間輸給每月定投；起始年 1920–1979，使用含息、通膨調整美股資料。只能當作者回測。 | G:82–88、289 | 已核實 | 2019-02-05 原文先定義每月投入或累積現金，買入後持有到終點，確有 “over 70%” 與 40 年、1920–1979 的陳述。文章說圖為含息、通膨調整；對應 repo 確有 `analysis/0110_buy_dips.R`。程式第 95 行的等待現金僅累加月投入，沒有計息；這是報告未列出的額外限制。只讀程式，未重算數字。 | [作者原文](https://ofdollarsanddata.com/even-god-couldnt-beat-dollar-cost-averaging/)；[作者程式，第 85–108、188 行](https://github.com/nmaggiulli/of-dollars-and-data/blob/master/analysis/0110_buy_dips.R#L85) |
| 3 | Callum 的失敗回顧保留原始判斷日期；idea inventory 有提出日期、方向、初始期限、信心及結案情況；以優於 50/50 的自評論證價值。支撐 G-02／G-03。 | G:133–139、290 | 已核實 | 2025 年末 PDF 第 4 頁列 “Charts That Didn’t Work”，原句後有日期；第 11 頁表格有 Date／Direction／Timeframe／Conviction／Updates／Outcome。第 12 頁以 “materially better than 50/50” 論證價值。這是作者重現的日期及自評，未取得當日不可改寫的原始付費報告來認證全套紀錄。 | [官方 PDF，第 4、11–12 頁](https://www.topdowncharts.com/_files/ugd/542496_11fe6959db2b49a0b80cca452d7cbf0f.pdf) |
| 4 | Sonders／Gordon 於 2026-06-03 明確承認失業率輕微上升的預期錯誤，並承認 household survey 曾給假訊號。 | G:119–124、290 | 已核實 | Schwab 官文日期與作者相符；正文寫 “We were, however, wrong” 後直接指向失業率預期，另說 household employment 更波動，2024 年曾出現假訊號。這能證明有具體認錯，不能認證整體預測能力。 | [Schwab 原文，勞動市場段](https://advisorservices.schwab.com/story/us-stock-market-outlook) |
| 5 | Bespoke 政治條件表的 D／D／R 只有 n=2、上漲 100%；同表 All Periods n=61、70.5%，資產是 DJIA。 | G:156–161、291 | 已核實 | 2023-01-06 PDF 第 12 頁右下表，欄名依序為 President／Senate／House／Occurrences／DJIA Change／Annualized Return／% of Time Up；D D R 列為 2、100.0，All Periods 為 61、70.5。表題為 1901–2022 國會會期，註腳還限定第 117 屆計至 12/14。不是 S&P 500 的 21 日期限。 | [Bespoke 原 PDF，第 12 頁](https://media.bespokepremium.com/uploads/2023/01/Bespoke-Report-010623-Pros-and-Cons.pdf#page=12) |
| 6 | Goepfert 以 1954–1976 估回歸，稱 1977–2003 為 OOS，但另一句從 1976 起；全樣本 extreme 為 ±2.25 個百分點，OOS 改 ±1.75；交易例處理一個月發布延遲。 | G:163–169、291 | 已核實 | 論文印刷頁 2 以全期殘差標準差 1.5%、1.5 倍標準差定出 ±2.25%；印刷頁 3 的 OOS 段確有上述起訖差異與 ±1.75%，同頁交易示範說使用資料可收到日期的收盤價。**未看到 OOS 門檻事前凍結證明，不等於已證明作者偷看調參。** | [CMT 官方存檔，PDF 第 4–5 頁／印刷頁 2–3](https://cmtassociation.org/wp-content/uploads/2025/08/2004DowAwardRevised.pdf) |
| 7 | S&P DJI：2025-06-30 前十大公司接近 40%；須區分當期前十大與固定 cohort、合併 Alphabet 股類；集中度下降不必然伴隨大盤下跌。支撐 G-01。 | G:207–214、292 | 已核實 | 2026-04 原 PDF 第 2 頁 Exhibit 1 註明 “then-current 10 largest companies”、資料截至 2025-06-30。第 5 頁說小公司較強也會降低集中度，Exhibit 6 的註腳 2 明列 Alphabet 兩種股類相加。這是描述性歷史與口徑；註腳位於 Exhibit 6，不能誤指為 Exhibit 1 的註腳。 | [S&P DJI 原 PDF，第 2、4–5 頁](https://www.spglobal.com/spdji/en/documents/research/research-in-the-shadows-of-giants.pdf) |
| 8 | Kris 公開信件擷取→options 資料對照→呈現的 agent 構想，但入口尚未完成；Claude Projects 留持續更新文件。支撐 G-04。 | G:199–205、293 | 已核實 | 2026-01-25 原文的 Investment Idea Generation 段描述三階段，緊接 “Status: very early…need to get email agent running”；前段也說將各次結論與不滿意方向回填 living document。來源是未完成構想，沒有摘要品質或投資成效測試。 | [Kris 原文，Tools I use／Investment Idea Generation](https://moontower.substack.com/p/innovators-dilemma-in-homine) |
| 9 | 3Fourteen 自報 Core RAAM 2024 年 18.9%，且區分 discretionary strategy 與模型；不是單次 SPX 呼叫績效。 | G:171–176、294 | 已核實 | 2025-01-02 PDF 第 1 頁正文說策略建議屬 discretionary；圖上明列 “2024 PERFORMANCE: 18.9%”，表內 YTD 為 18.85%。圖是多資產模型，非個別方向呼叫。第 13 頁保留修改 chart／model 的權利；沒有本次可驗的獨立績效稽核。 | [3Fourteen 原 PDF，第 1、13 頁](https://www.3fourteenresearch.com/samples/3fr-model-review-2024.pdf) |
| 10 | FCTE 的 2025-04-30 prospectus 揭露基金可偏離 newsletter 模型，且當時尚無完整日曆年績效。 | G:178–183、294 | 已核實 | SEC 存檔日期相符。Principal Investment Strategies 明列數量、證券種類、買賣時間可不同；Performance Deviation Risk 再列權重、現金流、費用差異。Performance 段寫尚無完整日曆年績效。文件沒有把 RAAM 變成 FCTE 的同一策略；兩者本來就不能互借收益。 | [SEC 原存檔，Principal Investment Strategies／Performance Deviation Risk／Performance](https://www.sec.gov/Archives/edgar/data/1771146/000199937125005134/fcte-485bpos_043025.htm) |
| 11 | Bilello：2026-10-13 前十大「持股」占 39.5%，為其 1980 年起資料內最高；精確權重未獨立核對。 | G:61–66、253、316 | 部分 | `agent-reach twitter thread` 回 `ok:true`；作者與 2026-10-13 01:45 UTC 日期相符，貼文確有 “39.5%” 與 “with data going back to 1980”。**已核實作者如此陳述；未核實金融數值本身**：未取得底層 holdings、精確 as-of 或公司／證券排序方法。原報告已揭露此限制，不能將本列當成抓到其造假。 | [Bilello 原貼文](https://x.com/charliebilello/status/2109822680375644364) |
| 12 | `pointsPrompt` 的無正文分支只根據標題摘要，且不告知資料不足；報告由此提出 G-04 的現行來源層級缺口。 | G:243–247、303 | 部分 | 函式描述正確，**但現行正常 ai-batch 路徑有反證**：唯一正式呼叫端先抓 `bodies`，在 `scripts/ai-batch.ts:165` 用 `bodies[i] && tasks.push(...)` 擋住無正文任務，`:169` 才呼叫 prompt。因此不能以未走到的分支證明現行文章重點有此 bug。這不排除舊資料或手動匯入，本次未查正式 DB。另 `extractArticleText` 最多取 6,000 字，所以 G-04 的「全文」標籤也不準確；可追溯性議題仍可成立。 | `web/scripts/ai-batch.ts:111`、`:162`、`:165`、`:169`；`web/src/lib/news-ai.ts:207`、`:229`、`:244`；`web/tests/news-ai.test.ts:55`（null 分支是測試呼叫） |
| 13 | `parsePoints` 不驗證逐句來源支持度；來源追溯及固定材料的品質評估仍可補。支撐 G-04／G-05。 | G:247–249、303–304 | 已核實 | 函式只檢查陣列、字串／長度與 tone；用合成輸入實際呼叫，得到 `{"points":["這是一句沒有附來源對應的合成文字"],"tone":"positive"}`。再追到 `importResults`，也只是解析後寫 points/tone，沒有句子→原文對應。`news_digests.news_ids` 已有整篇新聞層級連結，不能誤稱完全沒有來源紀錄；它仍不足以支持逐句內容。這不是已證明產生了錯誤數字。 | `web/src/lib/news-ai.ts:220`；`web/src/server/ai-batch.ts:170`、`:183`、`:197`；`web/db/schema.ts:93` |
| 14 | 現有 watchlist 已合併同公司股類、計算名單覆蓋並有 holdings as-of，G-01 應重用。 | G:259–264、300 | 已核實 | `companyKey` 去股類字尾，`addToWatchlist` 取同 key 的 siblings；view 對 `m.tickers` 加總並回傳 totalWeight/asOf。反查 UI 還發現：網頁已顯示「合計權重」、各公司權重、SPY 及日期；iOS 也顯示合計權重。因此不是一整套尚未存在的功能；新增全指數前十大公司統計才是另一步。未在真實 holdings 上重算。 | `web/src/lib/watchlist.ts:27`、`:62`；`web/src/server/views.ts:389`、`:393`、`:398`；`web/pages/watchlist.tsx:110`、`:124`、`:141`；`ios/MarketObservatory/Views/WatchlistView.swift:128` |
| 15 | plan 的研究預算與 ±20% 只是規劃及文字提醒，沒有持倉損益／自動觸發；手動理由紀錄是不同功能。支撐 G-03。 | G:268–272、302 | 已核實 | DEFAULT_PLAN 有 researchBudgetTwd/trancheTwd/exitConsiderationPct；savePlan 存設定，ETF view 的計算只使用每月金額等試算參數；頁面以預算÷單筆顯示可分幾次，再印門檻文字。搜尋這些欄位的使用處，看到驗證、儲存、表單及 iOS 顯示，沒有以實際持倉報酬觸發的路徑。此結論限目前 source。 | `web/src/server/views.ts:224`、`:257`、`:270`、`:311`；`web/pages/etfs.tsx:222`；`web/src/lib/plan.ts:17`；`ios/MarketObservatory/Views/MoreView.swift:252` |

## 2. 與事前登記或排除清單的衝突表

比對依據：`forecast.md:43–45` 規定登記優先於研究建議；第二輪草稿 `:118–120` 規定未合併不得執行、優先於第一輪及研究章節。因此不採 proposal 較舊文字中「第三個 flag 後自動等權」或同輪執行 EWMA 的路線，應以 `forecast.md:151–152` 的延後／獨立登記規則為準。以下將明確衝突、重複既有功能與未來越界條件分開說明。

| 建議 ID | 衝突的規則 | 說明 |
| --- | --- | --- |
| G-01 | 目前文字無直接衝突。邊界：`forecast.md:51`（D1）、`:114`（L17/X03）、`:142`（R2-0）、`:159`（唯一 dd5 名額 A）；`proposal.md:425`（依 dd5 調部位）、`:433`（不可因取得資料就加模型）。 | 當期 SPY 公司權重描述不占模型名額，也未重開否決項目。**「若連到未來報酬則登記」只是必要條件，不表示本輪有額外名額**；不得趁顯示集中度計算其歷史預測力。名單覆蓋、SPY 與日期已顯示是重複範圍，非登記衝突。 |
| G-02 | 目前文字無直接衝突。邊界：`forecast.md:111`（L09 不混三種分數）、`:144`（R2-2）；`proposal.md:417`（策略師訊號不入模型）、`:428`（不顯示既有投行命中排行）。 | 來源卡與證據身分符合既有原則；「期限／樣本／基準」應抄有來源的文獻欄位，不可替社群貼文補算 SPX 事件表。若擴充為帳號排行榜或社群觀點投票，就會重開排除項目；原建議明說不做，故本次未判為衝突。 |
| G-03 | 目前文字無直接衝突。邊界：`forecast.md:112`（G02 預測紀錄不可改）、`:114`、`:690`（L14 不列 top-5 失誤）；`proposal.md:376`（U-05 前瞻紀錄先定規則）、`:425`、`:428`。 | 個人手動筆記不等於 forecast 紀錄，也不需要以市場模型名額授權。保留舊理由符合可追溯原則；但不能改寫既有 forecasts、把筆記檢討轉成自動停扣／部位建議，或事後挑理由計分。原建議對後續計分需登記已有提醒，沒有直接重開 U-05 已限制的舊呼叫計分。 |
| G-04 | 無直接模型衝突；須遵守 `forecast.md:142`、`:144`；`proposal.md:417`、`:425`。另與 `proposal.md:361` 的「先有觸發例子才加規則」、`:386` 的日報不回饋模型一致處理。 | 來源層級／輸入保存不新增預測條件；沿用本機路徑符合專案分工。但原文由 prompt 推現行缺陷的依據被呼叫端反駁，不能因此上新 fallback 或重寫 prompt。若把 Kris 的 bullish/bearish 擷取接回模型或調部位，就重開策略師訊號與 meta-labeling；原建議沒有要求這樣做。 |
| G-05 | 目前文字無直接衝突。對應 `proposal.md:366`（N-09 新聞抽查）、`:386`（P-05 日報不入模型）；若擴為市場計分，另受 `forecast.md:43`、`:142`、`:159` 約束。 | 固定新聞材料、人工標註及出處／日期／單位稽核是內容品質評估，不是市場回測；與 N-09 可合併，避免另建一套。不可把 tone 或摘要品質分數變成 alpha、用未來報酬挑提示詞，亦不可藉此計算 R2-8 已延後的 EWMA 或其他候選。 |

**本次逐條比對，五條建議按其明文限制都沒有直接要求重開已否決項目。** 問題集中在 G-01 的既有範圍、G-04 的現況推論，以及整合時不可把「不需市場登記」擴張成「可以順便研究市場效果」。

## 3. 證據等級高估清單

1. **本次抽查未發現把自述正式升為 `academic_oos` 或 `independently_tested` 的誤標。** G:12、G-S18、G-S19 均明確保留為 `anecdotal`；G-S20、G-S24 的 `none` 指沒有預測力證據，並非官方文件不可查。Goepfert 的時間切分、獲獎、SEC 存檔都沒有被當成獨立複製，這部分應保留。
2. **G-02／G-03／G-04 的 `anecdotal` 只夠支持「有人採用或提出這種流程」，不支持 App 效益。** Callum 的自評不是研究筆記能改善決策的實驗；Kris 甚至明說入口未完成。因此若整合表把這幾條寫成已證實提高理解、減少幻覺或改善投資決策，應降為 `none`（該產品效果未檢驗）。原報告已寫「效益未驗」，不可刪掉限定。
3. **G:243 的「本機現況已親讀」不能涵蓋可達性結論。** 第 12 列顯示只讀 `pointsPrompt` 不足以證明現行排程有摘要降級缺陷；來源可見性是合理設計議題，但尚未證明是已發生的內容錯誤。這是程式證據強度被高估，而非金融證據分類問題。
4. **Bilello 的 39.5% 仍只核到作者陳述。** 第 11 列沒有把持股原始資料、精確日期與排序口徑補齊；不得拿來背書 App 的「目前前十大公司」數字。原報告的 `anecdotal` 及未核對註記是適當的，應繼續保留。
5. **期限與資產移植沒有得到新證據。** Mauboussin 是五年營收成長 reference class，Bespoke 是 DJIA 國會會期，Maggiulli 是四十年現金流策略，RAAM 是多資產模型。它們均不足以提高本站 21 日 SPX 方向或 dd5 的證據等級；原摘要大致守住此界線。Maggiulli 還少列等待現金不計息的程式假設，不能將「70%」概括成所有買低點或既有一筆資金的結論。

## 4. 最重要的遺漏

最重要的是沒有把「借鑑流程」追到本專案完整的輸入與保存路徑，便把它包成新增功能：`web/scripts/ai-batch.ts:162–169` 已擋住無正文的文章重點，`web/src/lib/news-ai.ts:229–245` 取得的也只是最多 6,000 字正文節錄；真正需要區分的是文章重點、只用標題摘要的公司 digest（`:137`）及只用標題的大盤 digest（`web/src/server/ai-batch.ts:125`），並交代實際讀到的轉載 URL、輸入快照如何保留。當前 tasks.json 雖有 prompt（`web/scripts/ai-batch.ts:200`），下一次 pull 會寫同一路徑，寫回 points 的資料也不帶該輸入；既有 news_ids 則只做到新聞層級（第 13 列）。這才是 G-04／G-05 該查的具體缺口，不能用未走到的 fallback 代替。另外 G-01 應先對照已顯示的合計權重、SPY 及日期（第 14 列），再說清楚剩下要新增的集中度資訊，否則會高估工作量與新意。本次未查正式 DB，尚不能聲稱已出現摘要錯誤或讀者誤解。

## 5. 結論：哪些建議因查核結果應該降級、刪除或保留

- **G-01 縮減保留**：名單合計權重、SPY 與日期已顯示；只評估新增公司集中度及說明，不重做既有功能，不變成擇時訊號。
- **G-02 保留**：來源卡有方法依據；維持「作者自述／獨立驗證」區別，不宣稱改善投資結果。
- **G-03 降級為待產品驗證的選配**：可保留手動理由與版本，但沒有使用者效益證據，不因從業者自評而提高優先序。
- **G-04 刪除錯誤的現況理由並改寫**：正常排程已擋住無正文的文章重點；將「全文」改成「正文節錄」，保留實際來源與輸入追溯的設計議題，按不同 AI 內容分別定義。
- **G-05 保留，與既有 N-09 抽查合併**：先凍結材料與錯誤分類，用內容忠實度檢驗 G-04 的實際需求；不以報酬評分，不增市場模型名額。
