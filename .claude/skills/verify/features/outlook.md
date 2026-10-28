# 下月展望

兩個目標的機率，對照歷史基準率：跌幅機率（dd5，以資料日收盤為起點，未來 21 個交易日內至少有一天收盤比它低 5% 以上，放在前面）與上漲機率（約 21 個交易日後收盤高於資料日）；列出目前符合的條件、樣本內與滾動驗證的表現、上線後的實際紀錄，以及機構觀點（FactSet 由下而上目標價、分析師共識、投行年底目標價，只當背景）。

## Sub-features

- `outlook-pick`（F6）：上漲機率＝API `outlook.pick.p`、基準率＝`outlook.pick.base.p`（顯示成 %）；dd5＝`outlook.drawdown.pick.p`、平常＝`outlook.drawdown.pick.base.p`，標題與「定義：」一行用上面的 dd5 定義。P(up) 不顯著時的說法是「尚未偵測到增額預測力」（自然頻率句；沒有收縮、採歷史基準率時主數字下方那行也有），不出現「與平常差不多」。
- `outlook-validation`：兩個分開標目標的滾動驗證區塊。網頁：KPI「跌幅機率（dd5）滾動驗證 BSS」＝`outlook.drawdown.evaluation.bss`、「上漲機率滾動驗證 BSS」＝`outlook.evaluation.bss`，各自的面板「滾動驗證：跌幅機率（dd5）」「滾動驗證：上漲機率」；App：同名的兩個 Section（dd5 的不列命中率）。區間標「歷史平均預測力 95% 區間（不是今天這個數字的區間）」。
- `outlook-intervals`：條件比例的區間（主數字下方、評估項「差異」、條件表表頭）標「這類時期的歷史比例 95% 區間」，跟 BSS 的預測力區間分名。
- `outlook-conditions`：條件表、目前條件有標記。
- `outlook-legend`：機率條的可見圖例列出目前機率、歷史基準、50% 中線與歷史比例 95% 區間，390px 觸控寬度也看得到。
- `outlook-records`：上線後實際紀錄：上漲機率（forecast 工作寫入；每列以紀錄日收盤為起點）。
- `outlook-views`：機構觀點區塊有內容或明確空狀態。
- `outlook-consensus`（網頁）：三張共識 KPI 各顯示「N 檔 · X% 權重」，依序對 API `consensus.coverage.target`、`ratings`、`revisions`；各自權重不到 50% 時顯示「（不到一半，數字不完整）」。`symbols`／`coveredWeightPct` 是三組有效列聯集，空列另列 `noData`，為 0 時省略空列說明。「本站反推（權重前 200 檔）」的涵蓋率＝`coverage.target.weightPct`，收盤日＝`indexCloseDate`；上方說明為「涵蓋子集的外推，各檔股價日不同，不是全部成分股同一天的加總」。說明行抓取日＝`oldest`～`newest`、股價日＝`priceOldest`～`priceNewest`（各檔不同日）、權重持股日＝`weightsAsOf`。表格股價下方列 `priceDate`（MM-DD）；目標價 null 且評等家數為 0 的列顯示「Nasdaq 無資料」。目標價均值下方列「最低 {targetLow}～最高 {targetHigh}」，任一缺值即省略；「EPS 近四週修正」欄顯示 `epsUp`／`epsDown`，0／0 為「沒有修正」，任一為 null 為「缺資料」，下方列「會計年度 {fiscalEnd} · 估計數 {estimates}」。EPS KPI 副標為「近四週（上修−下修）÷ 總次數，−100～+100」。表下說明個別分析師目標價範圍不是機率區間、EPS 是近四週修正次數而非幅度且不一定是不同分析師家數、會計年度為來源第一個年度；標「成效未證實」與「不是買賣訊號」。390px 時 EPS 欄隱藏，其他欄不破版。上榜表與彙總只含 UTC 今天往回 7 天內（含界線）的每檔最新列；`consensus` 為 null 時顯示「7 天內沒有更新的分析師共識…」。App 新欄位顯示由 L6-T4 驗證，本票只驗既有 Codable 可解碼。
- `outlook-strategists`：投行年底目標價表。中位數＝API `strategists.median`、家數＝`medianCount`（一家一票、只算年底目標：UBS GWM 與 Wells Fargo Investment Institute 標「不計入中位數」）；每列有「資料日期」、「已核對原文」或「媒體轉述，待原文核對」標章，資料日期超過 `staleAfterDays`（45）天的列標「待重新核對」（中性灰，不是紅綠）；WFII 顯示「區間 7,800–8,000 的中點」；註腳有一家一票規則與全表核對日 `checked`。App 同一區塊用小字列出同樣的標章。
- `outlook-overview-card`：總覽的「下月展望」卡片與此頁一致（dd5 在前）。

- `outlook-disclosure`：App 的下跌風險與上漲展望分區呈現，本次估計與歷史基準並列並標出百分點差；大字時自動直排。模型判斷（含「偵測不到預測力」）與整體模型限制 `globalCaveat` 預設可見；「機率與模型說明」與兩個滾動驗證可展開查看細節。`test12_Outlook` 操作三個區塊展開與收合；本機 `globalCaveat` 有值時用 `test17_OutlookCaveatVisibleByDefault` 確認方法區塊仍收合時已能看到限制。

## How to get to it (user POV)

- 網頁：導覽列「下月展望」→ `/outlook`；總覽的展望卡片（右側箭頭）。
- App：「更多 → 下月展望」；總覽的下月展望區塊。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態（`web-up.sh` 跑過 `forecast` 與 `daily-reference`）、測試帳號登入。

- **頁面。** `goto("/outlook")`，等 `text=下月展望`；`fetch("/api/v1/outlook")`，比 `pick.p`、`pick.base.p`、`drawdown.pick.p`，以及兩個 BSS 區塊各自對 `drawdown.evaluation` 與 `evaluation`（數字不能對調）。截圖 `outlook.png`（整頁：`page.screenshot` 前捲動，或分段截）。
- **共識（網頁）。** 在「成分股分析師共識」逐卡對帳 `consensus.coverage`，再核對「本站反推」的目標價涵蓋率、SPX 收盤日、說明行的三種日期與 `noData` 檔數／權重。對照 `top[].priceDate` 與股價下方日期，檢查空列「Nasdaq 無資料」，並確認所有 `top[].asOf` ≥ UTC 今天減 7 天。逐列核對最低／最高＝`targetLow`／`targetHigh`，EPS 上修／下修＝`epsUp`／`epsDown`，會計年度／估計數＝`fiscalEnd`／`estimates`；缺目標價任一端點時沒有範圍行，EPS 0／0 顯示「沒有修正」、null 顯示「缺資料」。確認 EPS KPI 副標完整、表下有「成效未證實」與欄位口徑說明；390px 時 EPS 表頭與儲存格均隱藏，其他欄不破版，另留 `outlook-consensus-390.png`。留 `outlook-consensus.png` 與同次 `outlook-consensus.api.json`；本機沒有新鮮資料時驗證明確空狀態，數字對帳標「未驗證：缺 7 天內共識資料」；本機缺 0／0 或 null 案例時分別標示未驗證。
- **共識表桌機換行（網頁）。** 準備 12 列，含 `fiscalEnd: "Jan 2027"`、`estimates: 64`、四位數股價與「Nasdaq 無資料」列；在 1024px、1100px、1280px 與 1440px 寬度確認半寬面板的 `.table-wrap` 滿足 `scrollWidth === clientWidth`、`scrollLeft === 0`，EPS 表頭與各列完整位於可視範圍，表頭、年度／估計數及缺資料文字可換行。390px 時 EPS 欄隱藏且表格仍不溢出。可在 `web/` 跑 `node tests/outlook-consensus-layout.mjs <證據目錄>`，用實際頁面 JSX 與 CSS 重現，留下兩組資料、五種寬度的截圖與 `metrics.json`；本機實例仍須依上段登入、點導覽並對 API。
- **紅漲綠跌與圖例（網頁）。** 本機 forecasts 準備 call=up 的上線紀錄，bump data_version 後開展望頁，確認該列徽章是紅色（tone-pos）；call=down 為綠色（tone-neg）。設 viewport 390px，機率條下四項圖例均可見並截圖。
- **App。** walkthrough 的 `08-outlook.png`、`08b-outlook-more.png`。
- **Proof。** `outlook.png`、`outlook.api.json`、App 兩張截圖。

## Gotchas

- 本機的 FactSet 與分析師共識只有 `daily-reference`、`news` 排程當次抓到的（分析師每次輪替 16 檔），區塊內容比正式站少是正常的。
- 模型定義改動要走 `web/docs/forecast.md` 的事前登記（`web/AGENTS.md`），驗證只看呈現，不改門檻。
- 頁面上的「2026-10-l01」是模型版本名稱（小寫 L），不是壞掉的字串，不算 fail。
- 策略師表的數字是人工維護的常數（`web/src/lib/strategists.ts`），本機與正式站相同；「待重新核對」依當天日期算，多數列被標是維護提醒，不算 fail。
- 「偵測不到預測力」（總覽卡片與此頁、網頁與 App 都有）是展望模型的狀態（樣本外沒有預測力，對應 API `call: "inconclusive"`），畫面上不該出現英文 skill。
