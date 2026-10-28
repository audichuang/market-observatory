# 下月展望

兩個目標的機率，對照歷史基準率：跌幅機率（dd5，以資料日收盤為起點，未來 21 個交易日內至少有一天收盤比它低 5% 以上，放在前面）與上漲機率（約 21 個交易日後收盤高於資料日）；列出目前符合的條件、樣本內與滾動驗證的表現、上線後的實際紀錄，以及機構觀點（FactSet 由下而上目標價、分析師共識、投行年底目標價，只當背景）。

## Sub-features

- `outlook-pick`（F6）：上漲機率＝API `outlook.pick.p`、基準率＝`outlook.pick.base.p`（顯示成 %）；dd5＝`outlook.drawdown.pick.p`、平常＝`outlook.drawdown.pick.base.p`。App 比較文案依各自的 `pick.distinct`：true 才依數值正負顯示「估計比平常高／估計比平常低」；false 或 nil 顯示「尚未偵測到與平常的差別」。遵守 U-01，沒偵測到差別不能解讀成已證明相等，不另設百分點門檻。模型的「偵測不到預測力」判斷仍另行可見。兩個目標的定義及自然頻率句在「機率與模型說明」展開區，網頁仍沿用原本呈現。
- `outlook-validation`：兩個分開標目標的滾動驗證區塊。網頁：KPI「跌幅機率（dd5）滾動驗證 BSS」＝`outlook.drawdown.evaluation.bss`、「上漲機率滾動驗證 BSS」＝`outlook.evaluation.bss`，各自的面板「滾動驗證：跌幅機率（dd5）」「滾動驗證：上漲機率」；App：同名的兩個 Section（dd5 的不列命中率）。區間標「歷史平均預測力 95% 區間（不是今天這個數字的區間）」。
- `outlook-intervals`：條件比例的區間（主數字下方、評估項「差異」、條件表表頭）標「這類時期的歷史比例 95% 區間」，跟 BSS 的預測力區間分名。
- `outlook-conditions`：條件表、目前條件有標記。
- `outlook-legend`：機率條的可見圖例列出目前機率、歷史基準、50% 中線與歷史比例 95% 區間，390px 觸控寬度也看得到。
- `outlook-records`：上線後實際紀錄：上漲機率（forecast 工作寫入；每列以紀錄日收盤為起點）。
- `outlook-views`：機構觀點區塊有內容或明確空狀態。
- `outlook-strategists`：投行年底目標價表。中位數＝API `strategists.median`、家數＝`medianCount`（一家一票、只算年底目標：UBS GWM 與 Wells Fargo Investment Institute 標「不計入中位數」）；每列有「資料日期」、「已核對原文」或「媒體轉述，待原文核對」標章，資料日期超過 `staleAfterDays`（45）天的列標「待重新核對」（中性灰，不是紅綠）；WFII 顯示「區間 7,800–8,000 的中點」；註腳有一家一票規則與全表核對日 `checked`。App 同一區塊用小字列出同樣的標章。
- `outlook-overview-card`：總覽的「下月展望」卡片與此頁一致（dd5 在前）。

- `outlook-disclosure`：App 下跌風險與上漲展望都依「標題 → 本次估計與歷史基準 → 白話比較 → 模型狀態／警示」排序；大字時數字自動直排。「未通過驗證，只供參考」、模型判斷、整體模型限制 `globalCaveat` 與定投提醒預設可見。「機率與模型說明」是兩段之後的共用展開區，依下跌風險、上漲展望列定義與頻率（`outlook-dd5-definition`／`outlook-up-definition`、`outlook-dd5-frequency`／`outlook-up-frequency`），再列原有模型細節。`test12_Outlook` 驗定義、頻率預設收合，操作說明與兩個滾動驗證展開／收合；`test17_OutlookCaveatVisibleByDefault` 檢查可見限制。
- `outlook-readability`：`test21_ReadabilityPolish` 拍 `polish-<variant>-outlook-collapsed-*.png`、`outlook-model-collapsed.png`、`outlook-expanded-*.png`，小幅捲動覆蓋兩段摘要、警示及展開後兩段定義／頻率。使用同 ETF 的裝置／字級矩陣，逐張看文字、數字與 tab bar 邊界；只重驗展望時設定 `TEST_RUNNER_MO_POLISH_SCREEN=outlook`，跳過 ETF 與總覽。
- `outlook-expanded-reading`：`test25_OutlookExpandedReading` 用相同矩陣重拍展開區直到報酬分位數及長註腳（`outlook-quantiles`／`outlook-quantile-meta`）完整進入畫面，再捲到「差異」評估列，拍 `polish-<variant>-outlook-assessment.png`。評估列兩段文字完整換行，OCR 限定在該列像素範圍，檢查 AX 提供的區間上下限均可見且沒有省略號，結果存 `outlook-assessment-ocr.txt`。證據沿用 `polish-<variant>-outlook-expanded-*.png`。跨頁閱讀回歸 `test16_Readability` 以摘要標題等待資料，並確認定義只在展開後出現。
- `outlook-unvalidated`：`test24_UnvalidatedDrawdownWarning` 檢查 `drawdown.scored=false` 時，一般與最大字級的「未通過驗證，只供參考」在模型說明收合時仍可讀。若本機完整歷史資料算出 true，先備份並暫時移開 `prices` 中 SPX／VIX 早於 2025-10-01 的真實歷史資料，bump `data_version`，讀 API 確認 false 才跑；完成或失敗都還原資料並再次 bump 版本。這只是本機資料準備，不改模型門檻。

## How to get to it (user POV)

- 網頁：導覽列「下月展望」→ `/outlook`；總覽的展望卡片（右側箭頭）。
- App：「更多 → 下月展望」；總覽的下月展望區塊。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態（`web-up.sh` 跑過 `forecast` 與 `daily-reference`）、測試帳號登入。

- **頁面。** `goto("/outlook")`，等 `text=下月展望`；`fetch("/api/v1/outlook")`，比 `pick.p`、`pick.base.p`、`drawdown.pick.p`，以及兩個 BSS 區塊各自對 `drawdown.evaluation` 與 `evaluation`（數字不能對調）。截圖 `outlook.png`（整頁：`page.screenshot` 前捲動，或分段截）。
- **紅漲綠跌與圖例（網頁）。** 本機 forecasts 準備 call=up 的上線紀錄，bump data_version 後開展望頁，確認該列徽章是紅色（tone-pos）；call=down 為綠色（tone-neg）。設 viewport 390px，機率條下四項圖例均可見並截圖。
- **App。** walkthrough 的 `08-outlook.png`、`08b-outlook-more.png`。
- **Proof。** `outlook.png`、`outlook.api.json`、App 兩張截圖。

## Gotchas

- 本機的 FactSet 與分析師共識只有 `daily-reference`、`news` 排程當次抓到的（分析師每次輪替 16 檔），區塊內容比正式站少是正常的。
- 模型定義改動要走 `web/docs/forecast.md` 的事前登記（`web/AGENTS.md`），驗證只看呈現，不改門檻。
- 頁面上的「2026-10-l01」是模型版本名稱（小寫 L），不是壞掉的字串，不算 fail。
- 策略師表的數字是人工維護的常數（`web/src/lib/strategists.ts`），本機與正式站相同；「待重新核對」依當天日期算，多數列被標是維護提醒，不算 fail。
- 「偵測不到預測力」（總覽卡片與此頁、網頁與 App 都有）是展望模型的狀態（樣本外沒有預測力，對應 API `call: "inconclusive"`），畫面上不該出現英文 skill。
