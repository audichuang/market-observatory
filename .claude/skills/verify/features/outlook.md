# 下月展望

約 21 個交易日後 S&P 500 收高的機率與跌 ≥5% 的機率，對照歷史基準率；列出目前符合的條件、樣本內與滾動驗證的表現、上線後的實際紀錄，以及機構觀點（FactSet 由下而上目標價、分析師共識、投行年底目標價，只當背景）。

## Sub-features

- `outlook-pick`（F6）：上漲機率＝API `outlook.pick.p`、基準率＝`outlook.pick.base.p`（顯示成 %）。
- `outlook-conditions`：條件表、目前條件有標記。
- `outlook-records`：上線後實際紀錄（forecast 工作寫入）。
- `outlook-views`：機構觀點區塊有內容或明確空狀態。
- `outlook-strategists`：投行年底目標價表。中位數＝API `strategists.median`、家數＝`medianCount`（一家一票、只算年底目標：UBS GWM 與 Wells Fargo Investment Institute 標「不計入中位數」）；每列有「資料日期」、「已核對原文」或「媒體轉述，待原文核對」標章，資料日期超過 `staleAfterDays`（45）天的列標「待重新核對」（中性灰，不是紅綠）；WFII 顯示「區間 7,800–8,000 的中點」；註腳有一家一票規則與全表核對日 `checked`。App 同一區塊用小字列出同樣的標章。
- `outlook-overview-card`：總覽的「下月展望」卡片與此頁一致。

## How to get to it (user POV)

- 網頁：導覽列「下月展望」→ `/outlook`；總覽的展望卡片（右側箭頭）。
- App：「更多 → 下月展望」；總覽的下月展望區塊。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態（`web-up.sh` 跑過 `forecast` 與 `daily-reference`）、測試帳號登入。

- **頁面。** `goto("/outlook")`，等 `text=下月展望`；`fetch("/api/v1/outlook")`，比 `pick.p`、`pick.base.p`。截圖 `outlook.png`（整頁：`page.screenshot` 前捲動，或分段截）。
- **App。** walkthrough 的 `08-outlook.png`、`08b-outlook-more.png`。
- **Proof。** `outlook.png`、`outlook.api.json`、App 兩張截圖。

## Gotchas

- 本機的 FactSet 與分析師共識只有 `daily-reference`、`news` 排程當次抓到的（分析師每次輪替 16 檔），區塊內容比正式站少是正常的。
- 模型定義改動要走 `web/docs/forecast.md` 的事前登記（`web/AGENTS.md`），驗證只看呈現，不改門檻。
- 頁面上的「2026-10-l01」是模型版本名稱（小寫 L），不是壞掉的字串，不算 fail。
- 策略師表的數字是人工維護的常數（`web/src/lib/strategists.ts`），本機與正式站相同；「待重新核對」依當天日期算，多數列被標是維護提醒，不算 fail。
- 「偵測不到預測力」（總覽卡片與此頁、網頁與 App 都有）是展望模型的狀態（樣本外沒有預測力，對應 API `call: "inconclusive"`），畫面上不該出現英文 skill。
