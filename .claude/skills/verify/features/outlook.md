# 下月展望

兩個目標的機率，對照歷史基準率：跌幅機率（dd5，以資料日收盤為起點，未來 21 個交易日內至少有一天收盤比它低 5% 以上，放在前面）與上漲機率（約 21 個交易日後收盤高於資料日）；列出目前符合的條件、樣本內與滾動驗證的表現、上線後的實際紀錄，以及機構觀點（FactSet 由下而上目標價、分析師共識、投行年底目標價，只當背景）。

## Sub-features

- `outlook-pick`（F6）：上漲機率＝API `outlook.pick.p`、基準率＝`outlook.pick.base.p`（顯示成 %）；dd5＝`outlook.drawdown.pick.p`、平常＝`outlook.drawdown.pick.base.p`，標題與「定義：」一行用上面的 dd5 定義。P(up) 不顯著時的說法是「尚未偵測到增額預測力」（自然頻率句；沒有收縮、採歷史基準率時主數字下方那行也有），不出現「與平常差不多」。
- `outlook-validation`：兩個分開標目標的滾動驗證區塊。網頁：KPI「跌幅機率（dd5）滾動驗證 BSS」＝`outlook.drawdown.evaluation.bss`、「上漲機率滾動驗證 BSS」＝`outlook.evaluation.bss`，各自的面板「滾動驗證：跌幅機率（dd5）」「滾動驗證：上漲機率」；App：同名的兩個 Section（dd5 的不列命中率）。區間標「歷史平均預測力 95% 區間（不是今天這個數字的區間）」。
- `outlook-intervals`：條件比例的區間（主數字下方、評估項「差異」、條件表表頭）標「這類時期的歷史比例 95% 區間」，跟 BSS 的預測力區間分名。
- `outlook-conditions`：條件表、目前條件有標記。
- `outlook-legend`：機率條的可見圖例列出目前機率、歷史基準、50% 中線與歷史比例 95% 區間，390px 觸控寬度也看得到。
- `outlook-records`：上線後實際紀錄：上漲機率（forecast 工作寫入；每列以紀錄日收盤為起點）。
- `outlook-unavailable`：`outlook` 為 null 時，網頁與 App 依 `outlookUnavailable` 說明 VIX 最新日、落後的 SPX 交易日數與上限；完全沒有 VIX 或歷史資料不足時各有提示。App 顯示橘色 Notice，兩端的過去預測紀錄與機構觀點照常顯示；舊後端缺欄位或未知 reason 用原有網頁提示。有展望時 `outlookUnavailable` 為 null，版面順序不變，M5 上限仍為 3 個交易日。
- `outlook-views`：機構觀點區塊有內容或明確空狀態。
- `outlook-strategists`：投行年底目標價表。中位數＝API `strategists.median`、家數＝`medianCount`（一家一票、只算年底目標：UBS GWM 與 Wells Fargo Investment Institute 標「不計入中位數」）；每列有「資料日期」、「已核對原文」或「媒體轉述，待原文核對」標章，資料日期超過 `staleAfterDays`（45）天的列標「待重新核對」（中性灰，不是紅綠）；WFII 顯示「區間 7,800–8,000 的中點」；註腳有一家一票規則與全表核對日 `checked`。App 同一區塊用小字列出同樣的標章。
- `outlook-overview-card`：總覽卡片先列 dd5，再列上漲機率；只在看最新日且有 forecast 時顯示，數字取已存預測，不重算。卡片「資料日」取 `/api/v1/overview` 的 `forecast.trade_date`（網頁 `dateWithWeekday`、App `Fmt.fullDate`）；早於 `snapshot.data.tradeDate` 時顯示橘色「待更新」與完整說明。展望頁用最新資料即時試算，可能與卡片不同。

- `outlook-disclosure`：App 的下跌風險與上漲展望分區呈現，本次估計與歷史基準並列並標出百分點差；大字時自動直排。模型判斷（含「偵測不到預測力」）與整體模型限制 `globalCaveat` 預設可見；「機率與模型說明」與兩個滾動驗證可展開查看細節。`test12_Outlook` 操作三個區塊展開與收合；本機 `globalCaveat` 有值時用 `test17_OutlookCaveatVisibleByDefault` 確認方法區塊仍收合時已能看到限制。

## How to get to it (user POV)

- 網頁：導覽列「下月展望」→ `/outlook`；總覽的展望卡片（右側箭頭）。
- App：「更多 → 下月展望」；總覽的下月展望區塊。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態（`web-up.sh` 跑過 `forecast` 與 `daily-reference`）、測試帳號登入。

- **頁面。** `goto("/outlook")`，等 `text=下月展望`；`fetch("/api/v1/outlook")`，比 `pick.p`、`pick.base.p`、`drawdown.pick.p`，以及兩個 BSS 區塊各自對 `drawdown.evaluation` 與 `evaluation`（數字不能對調）。截圖 `outlook.png`（整頁：`page.screenshot` 前捲動，或分段截）。
- **紅漲綠跌與圖例（網頁）。** 本機 forecasts 準備 call=up 的上線紀錄，bump data_version 後開展望頁，確認該列徽章是紅色（tone-pos）；call=down 為綠色（tone-neg）。設 viewport 390px，機率條下四項圖例均可見並截圖。
- **App。** walkthrough 的 `08-outlook.png`、`08b-outlook-more.png`。
- **總覽入口與預測日期。** 依 [總覽的展望資料日與待更新驗證](overview.md#driving-it-with-ego-browser--xcuitest) 準備同日與落後兩種狀態；核對卡片資料日、標籤與說明後，網頁及 App 各從總覽卡片進入下月展望。卡片機率對 `/api/v1/overview` 的已存 forecast，展望頁機率對 `/api/v1/outlook` 的即時計算，不要求兩者數字相等；驗完還原本機 forecasts 與 data_version。
- **無法產生展望。** 僅在本機 worktree D1，先確認沒有 `verify_held_vix`，暫停 prices 工作，執行 `CREATE TABLE verify_held_vix AS SELECT * FROM prices WHERE symbol='VIX' AND date > (SELECT date FROM prices WHERE symbol='VIX' ORDER BY date DESC LIMIT 1 OFFSET 5); DELETE FROM prices WHERE symbol='VIX' AND date IN (SELECT date FROM verify_held_vix);` 並 bump `data_version`。兩端從導覽入口進入下月展望，確認同句「VIX 最新只到 …落後 5 個交易日…超過 3 個交易日的上限」，App 為橘色 Notice；網頁「上線後實際紀錄」與 App「實際發出的預測／上線後實際紀錄」仍在。儲存 `outlook-unavailable.png`、`outlook-unavailable.api.json` 與 App 截圖，對帳 `outlook === null`、`outlookUnavailable.reason === "vix-stale"`、兩個日期、落後天數及 `recent` 筆數。驗完執行 `INSERT INTO prices SELECT * FROM verify_held_vix; DROP TABLE verify_held_vix;` 再 bump，確認兩端正常版面與 `outlookUnavailable === null`，App 再跑 `test12_Outlook`。iOS 操作須持有全域模擬器鎖並重用既有 MO 裝置，依本輪整合流程執行。
- **Proof。** `outlook.png`、`outlook.api.json`、App 兩張截圖。

## Gotchas

- 本機的 FactSet 與分析師共識只有 `daily-reference`、`news` 排程當次抓到的（分析師每次輪替 16 檔），區塊內容比正式站少是正常的。
- 模型定義改動要走 `web/docs/forecast.md` 的事前登記（`web/AGENTS.md`），驗證只看呈現，不改門檻。
- 頁面上的「2026-10-l01」是模型版本名稱（小寫 L），不是壞掉的字串，不算 fail。
- 策略師表的數字是人工維護的常數（`web/src/lib/strategists.ts`），本機與正式站相同；「待重新核對」依當天日期算，多數列被標是維護提醒，不算 fail。
- 「偵測不到預測力」（總覽卡片與此頁、網頁與 App 都有）是展望模型的狀態（樣本外沒有預測力，對應 API `call: "inconclusive"`），畫面上不該出現英文 skill。
