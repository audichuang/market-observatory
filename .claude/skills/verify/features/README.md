# 市場觀測室驗證地圖

這個目錄是驗證市場觀測室使用者功能的唯一來源（iOS 的手動 QA 測案也在這裡，`ios/QA/` 只放每輪的報告與結果）。操作前先讀這份索引，再照對應的功能檔做。測案編號（A1、D6…）沿用 `ios/QA/report-*.md` 用過的編號，舊報告對得回來。

## 基準狀態

- 照 [SKILL.md](../SKILL.md) 的 Launch：在乾淨 worktree 跑 `web-up.sh <run-id>`，網站在 `http://localhost:5181`，資料是 60 個交易日的快照＋十年日線＋當天的新聞、事件、展望。
- iOS：`ios-up.sh <run-id>` 建好的「MO Verify <run-id>」模擬器，App 用 `-debugBaseURL` 連本機站。
- `doctor.sh <run-id>` 全部 ✓ 才開始。
- 測試帳號 `verify-<run-id>@example.test`（密碼至少 8 字），在網頁登入頁註冊。新帳號的名單是七巨頭：NVDA、AAPL、MSFT、AMZN、GOOGL（＋GOOG 合併）、META、TSLA。
- 站長帳號（`OWNER_EMAIL`）只用來準備資料與驗「資料來源」頁；一般功能用測試帳號驗。

## 操作慣例

- 網頁用 ego-browser（`ego-browser nodejs`），iOS 用 `ios-walkthrough.sh`（逐頁截圖）、`ios-test.sh` 跑 `VerifyInteractionTests` 的互動測試，加上 `simctl`；用法與選擇器、XCUITest 的坑在 SKILL.md 的 Drive。
- 把手用畫面上的中文字與網址；網頁幾乎沒有 ARIA label，App 只有登入欄位有 identifier。功能檔裡寫的是實測過的精確把手。
- 已知 bug（另案修）會讓對應測案 fail：照實記 fail，不要改步驟讓它過。已知 bug 記在對應功能檔的 Gotchas，修好後刪掉那一筆（2026-10-26 全面驗證找到的 bug 都已修好，目前沒有）。
- 每個功能從基準狀態開始；會改資料的（名單、定投規劃、推播偏好）做完要改回基準，並讀回確認。
- 等畫面上的結果出現，不要固定 sleep。

## 全域的「正確」

- **語言**：介面是繁體中文（台灣用語）。代號、ETF 英文名、單位與術語（SMA20、VIX、YTD、1Y、AUM、EPS、Brier、BSS、FOMC）可以是英文，其他英文字串都算 fail。新聞標題在本機沒有翻譯，是英文，不算 fail。
- **顏色**：紅＝上漲／正值、綠＝下跌／負值，0 或無資料灰色。
- **數字**：等於同一帳號 `/api/v1/*` 的值，只容許顯示位數的四捨五入；正負號要對。
- **版面**：文字不重疊、不被裁掉一半，關鍵數字不能被「…」截斷。
- **網頁窄螢幕與配色**：登入、走勢（至少 9 家名單）、ETF、展望分別在 320px、360px 與深淺模式截圖；`document.documentElement.scrollWidth === document.documentElement.clientWidth`。深色主要按鈕為深字，secondary 與 chip 仍保留各自覆寫；提示、徽章文字對比至少 4.5:1。走勢 tooltip 用一般字色並附線色小色塊。
- **反應**：每個操作 15 秒內有可見結果，載入中要有提示。
- **穩定**：不閃退；每個功能做完 App 仍在前景可操作（`ls ~/Library/Logs/DiagnosticReports | grep -i MarketObservatory` 沒有新檔）。
- **iOS 深色與大字（H1、H2）**：`simctl ui <UDID> appearance dark` 看五個分頁、`content_size accessibility-large` 看總覽／名單／日曆／ETF；看完改回 `light`、`large`。
- **iOS 閱讀矩陣**：`test16_Readability` 走總覽、名單、走勢、新聞、日曆、更多、ETF、規劃、展望、推播、帳號與登入。預設用最大輔助使用字級；外部設定 `TEST_RUNNER_MO_READING_VARIANT=dark-normal` 可拍一般字級，`dark-largest` 拍最大字級。深淺模式另以 `simctl ui` 設定，名稱只用來標記證據。逐張檢查 `UI-<variant>-*.png`；通過測案不代表已看過畫面。
- 整輪沒有英文錯誤訊息、原始 JSON、`Optional(...)`、`nil`（H4）。

## 證據與回報

- 動作前後各一張截圖，加上讀回的 API JSON；檔名用子功能 ID。
- 寫入要從另一個畫面或 API 讀回（例如網頁加名單 → App 名單頁也有）。
- 每個證據記下功能 ID、入口（網頁／App）、帳號、commit。
- 走不到的入口回報「未驗證」與缺的前提，不要用另一個入口代替。

## 功能檔格式

每個功能檔：H1 標題＋一段使用者看得到的行為，然後依序四個 H2：`Sub-features`（ID 與一行說明）、`How to get to it (user POV)`（每個入口）、`Driving it with ego-browser / XCUITest`（先列 `Preconditions:`，每個步驟寫動作、指令或把手、看得到的結果）、`Gotchas`。

## 功能

- [帳號：註冊、登入、登出、刪除](./account.md)：網頁與 App 的 email 登入、Apple 登入取消、刪除帳號。
- [總覽](./overview.md)：當日收盤、KPI、名單貢獻拆解、其他交易日、事件。
- [走勢與均線](./history.md)：價格與均線圖、區間切換、標的切換、相對報酬、近 40 日貢獻。
- [觀察名單](./watchlist.md)：加入、移除、上限、跨畫面同步。
- [新聞與日曆](./news-calendar.md)：新聞列表與代號篩選、月曆與當日事件。
- [ETF 與定投](./etfs-dca.md)：ETF 比較、定投試算、我的規劃。
- [下月展望](./outlook.md)：機率、基準率、條件、機構觀點。
- [推播](./push.md)：推播偏好、模擬推播送達與點開導向。
- [資料來源（站長）](./sources-admin.md)：排程紀錄、手動執行、來源不一致。
