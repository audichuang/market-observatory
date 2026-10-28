# 下月展望

兩個目標的機率，對照歷史基準率：跌幅機率（dd5，以資料日收盤為起點，未來 21 個交易日內至少有一天收盤比它低 5% 以上，放在前面）與上漲機率（約 21 個交易日後收盤高於資料日）；列出目前符合的條件、樣本內與滾動驗證的表現、上線後的實際紀錄，以及機構觀點（FactSet 由下而上目標價、分析師共識、投行年底目標價，只當背景）。

## Sub-features

- `outlook-pick`（F6）：上漲機率＝API `outlook.pick.p`、基準率＝`outlook.pick.base.p`（顯示成 %）；dd5＝`outlook.drawdown.pick.p`、平常＝`outlook.drawdown.pick.base.p`，標題與「定義：」一行用上面的 dd5 定義。dd5「已計分」依 R2-5：G09 全域條件與今天所選 cell 的 offset 0 閘門都通過；「未通過驗證，只供參考」出現與否等於 `outlook.drawdown.scored === false`，且 API `outlook.drawdown.gate.failed` 非空、列出未通過原因（畫面不列原因）；退回基準率時 (d) 一律未過，p 照常顯示。P(up) 不顯著時的說法是「尚未偵測到增額預測力」（自然頻率句；沒有收縮、採歷史基準率時主數字下方那行也有），不出現「與平常差不多」。
- `outlook-validation`：兩個分開標目標的滾動驗證區塊。網頁 KPI「跌幅機率（dd5）滾動驗證 BSS」主數字＝API `phaseSummary.dd5.mean`、「上漲機率滾動驗證 BSS」＝`phaseSummary.up.mean`（三位小數），附「相位平均（21 個起始相位）」、各目標 `low`～`high`、資料截至 `phaseSummary.asOf` 與模型 `phaseSummary.modelVersion`。另一行「單一相位（offset 0）」各自對 `outlook.drawdown.evaluation`／`outlook.evaluation`，dd5 註明「『已計分』判定用這個」、上漲註明「方向判定用這個」。摘要或目標為 null 時，KPI 退回 offset 0 並寫「相位平均尚未計算」。兩個面板標題仍為「滾動驗證：跌幅機率（dd5）」「滾動驗證：上漲機率」，內文首行為「單一相位（offset 0）」。App 同名 DisclosureGroup 展開後首行顯示相位平均數字、區間、資料日與版本，原 BSS 列標「BSS（單一相位 offset 0）」（dd5 不列命中率）。區間標「歷史平均預測力 95% 區間（不是今天這個數字的區間）」。
- `outlook-intervals`：條件比例的區間（主數字下方、評估項「差異」、條件表表頭）標「這類時期的歷史比例 95% 區間」，跟 BSS 的預測力區間分名。
- `outlook-conditions`：條件表、目前條件有標記。
- `outlook-legend`：機率條的可見圖例列出目前機率、歷史基準、50% 中線與歷史比例 95% 區間，390px 觸控寬度也看得到。
- `outlook-records`：上線後實際紀錄：上漲機率（forecast 工作寫入；每列以紀錄日收盤為起點）。依 L09 增補一，只計 lag 0 且 PUB-1 準時的列；缺 lag、存下的 probability／base_rate／close 或時限不明先歸資格不明，lag ≥ 1 或逾時為延遲補記。API `liveTrack.realtime/delayed/unknown` 各為分類列數。網頁標題下、App footer 原樣顯示伺服器 `liveTrack.note`：「只計即時發布的列（寫入時是最新交易日，且在下一個交易日美東 16:30 前寫入）；延遲補記 X 列、資格不明 Y 列另列、不計分。合併所有已發布的模型版本。」X／Y 對 `delayed/unknown`。格線從第一筆即時列起每 21 個 SPX 交易日，無即時列的格點略過、不遞補；n 只算已到期格點，合併版本。
- `outlook-records-dd5`：同頁「上線後實際紀錄：跌幅機率（dd5）」，App 位於機構觀點之前、if／else 之外，`outlook` 為 nil 也顯示。依 R2-6 修訂一：缺 lag、drawdown.p／base／modelVersion 或 PUB-1 時限不明先歸資格不明；lag ≥ 1 或逾時為延遲補記，其餘即時。每個版本一行，模型、n、樣本太少／BSS、實際發生比例對 API `liveTrackDd5.groups` 的 `modelVersion/n/tooFew/bss/eventShare`；無到期列顯示空狀態。`realtime/delayed/unknown` 為分類列數；「延遲補記 X 列、資格不明 Y 列，保留、不計分」對 `delayed/unknown`。下方原樣顯示伺服器 `note`，資格與計數句同 P(up)，最後一句為「依模型版本分開計分。」格線從 PUB-1 分類後第一筆即時列起每 21 個 SPX 交易日，全部版本共用、略過無即時列的格點，再分組計分；少於 12 個獨立月份不報 BSS。
- `outlook-views`：機構觀點區塊有內容或明確空狀態。
- `outlook-strategists`：投行年底目標價表。中位數＝API `strategists.median`、家數＝`medianCount`（一家一票、只算年底目標：UBS GWM 與 Wells Fargo Investment Institute 標「不計入中位數」）；每列有「資料日期」、「已核對原文」或「媒體轉述，待原文核對」標章，資料日期超過 `staleAfterDays`（45）天的列標「待重新核對」（中性灰，不是紅綠）；WFII 顯示「區間 7,800–8,000 的中點」；註腳有一家一票規則與全表核對日 `checked`。App 同一區塊用小字列出同樣的標章。
- `outlook-overview-card`：總覽的「下月展望」卡片與此頁一致（dd5 在前）。

- `outlook-disclosure`：App 的下跌風險與上漲展望分區呈現，本次估計與歷史基準並列並標出百分點差；大字時自動直排。模型判斷（含「偵測不到預測力」）與整體模型限制 `globalCaveat` 預設可見；「機率與模型說明」與兩個滾動驗證可展開查看細節。`test12_Outlook` 操作三個區塊展開與收合；本機 `globalCaveat` 有值時用 `test17_OutlookCaveatVisibleByDefault` 確認方法區塊仍收合時已能看到限制。

## How to get to it (user POV)

- 網頁：導覽列「下月展望」→ `/outlook`；總覽的展望卡片（右側箭頭）。
- App：「更多 → 下月展望」；總覽的下月展望區塊。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態（`web-up.sh` 跑過 `forecast` 與 `daily-reference`）、測試帳號登入。
- 站長先在 `/sources` 手動執行「展望相位平均」，確認執行紀錄 status ok；計算用本機合成或回補資料，不用試驗登記的固定數字。
- 驗證 R2-5 前，站長在本機 `/sources` 手動執行「重算下月展望」；新寫入 recent 列的版本應為 `2026-10-g09r1`。網頁 dd5 與 App「更多 → 下月展望」下跌風險區的驗證提示對 `outlook.drawdown.scored`；App「機率與模型說明」版本對 `outlook.modelVersion`。
- 驗證兩個紀錄面板前，只在本機 D1 新增至少 22 個交易日以前、位於 2025–2027 NYSE 日曆覆蓋內的 forecasts 已到期列，detail 帶 `recordedLagSessions` 與 `drawdown.p/base/modelVersion`：各一筆 lag 0 且 created_at 為當晚準時時間、lag 0 但 created_at 在下一交易日美東 16:30 之後、準時 lag 2、created_at='x'，另留無 detail 舊列；不回填既有列。PUB-1 以 created_at 的美東日期檢查覆蓋，再比較 `latestExpectedClose(created_at)` 與 trade_date；解析失敗、任一日期超出覆蓋或應有收盤早於 trade_date 均不明。bump `data_version` 後確認逾時 lag 0 不計入 n、兩句正式說明的 X／Y 分別等於各自 API 的 delayed／unknown，保存 `outlook-records.png`／`outlook-records.api.json` 與 `outlook-records-dd5.png`／`outlook-records-dd5.api.json`；App「更多 → 下月展望」兩區塊顯示同樣伺服器字串。依 L3-display.md §6 T3 的 VIX 暫存步驟讓 `outlook` 為 null，再確認網頁與 App 的 dd5 區塊仍顯示，驗完還原 VIX 並 bump 版本。

- **頁面。** `goto("/outlook")`，等 `text=下月展望`；`fetch("/api/v1/outlook")`，比 `pick.p`、`pick.base.p`、`drawdown.pick.p`；兩個 KPI 主數字各自對 `phaseSummary.dd5.mean`／`phaseSummary.up.mean`，日期、版本與區間也對 API。單一相位一行與滾動驗證面板各自對 `drawdown.evaluation`／`evaluation`（數字不能對調）。另在尚未計算的本機資料庫確認退回 offset 0 與「相位平均尚未計算」。截圖 `outlook.png`（整頁：`page.screenshot` 前捲動，或分段截）。
- **紅漲綠跌與圖例（網頁）。** 本機 forecasts 準備 call=up 的上線紀錄，bump data_version 後開展望頁，確認該列徽章是紅色（tone-pos）；call=down 為綠色（tone-neg）。設 viewport 390px，機率條下四項圖例均可見並截圖。
- **App。** walkthrough 的 `08-outlook.png`、`08b-outlook-more.png`。
- **Proof。** `outlook.png`、`outlook.api.json`、App 兩張截圖。

## Gotchas

- 本機的 FactSet 與分析師共識只有 `daily-reference`、`news` 排程當次抓到的（分析師每次輪替 16 檔），區塊內容比正式站少是正常的。
- 模型定義改動要走 `web/docs/forecast.md` 的事前登記（`web/AGENTS.md`），驗證只看呈現，不改門檻。
- 現行模型版本為「2026-10-g09r1」；recent 舊列維持寫入時的版本與判定，不重算。
- 策略師表的數字是人工維護的常數（`web/src/lib/strategists.ts`），本機與正式站相同；「待重新核對」依當天日期算，多數列被標是維護提醒，不算 fail。
- 「偵測不到預測力」（總覽卡片與此頁、網頁與 App 都有）是展望模型的狀態（樣本外沒有預測力，對應 API `call: "inconclusive"`），畫面上不該出現英文 skill。
