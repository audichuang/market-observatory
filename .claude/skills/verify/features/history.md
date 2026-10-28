# 走勢與均線

選一個標的（S&P 500、名單公司、RSP）看收盤與 SMA20／60／200、區間報酬與最大回撤（App 另顯示交易日數）；下面有名單 vs S&P 500 的相對報酬（起點 0%）、區間統計表、近 40 個交易日的指數漲跌拆解（名單 vs 其他成分股（含近似誤差）；圖例寫短名「其他成分股」，全名在說明句）。

## Sub-features

- `history-main`（C1）：預設 1 年；四條線都在圖框內；日期範圍＝`mainStats.first`～`last`、區間報酬＝`ret`、最大回撤（App 寫「最大回檔」）＝`mdd`；App 另有交易日＝`points`，網頁沒有顯示交易日數。
- `history-range`（C2、C3）：切 1 個月／3 個月／6 個月／1 年／3 年／5 年，數字＝`months=1/3/6/12/36/60`；快速連點時停在最後一個。
- `history-symbol`（C4、C6）：標的選單或區間統計表的列切換標的。
- `history-compare`（C5）：相對報酬每條線顏色不同、圖例對得上、起點 0%。
- `history-contribution`（C7）：近 40 日貢獻柱狀圖，最新一天名單貢獻＝API `contribution` 最後一筆 `mag7`。

## How to get to it (user POV)

- 網頁：導覽列「走勢與均線」→ `/history`；`/history?symbol=NVDA&months=6`；總覽或名單點公司名稱。
- App：底部分頁「走勢」，右上標的選單（按鈕 label「標的：S&P 500」，選項 label「S&P 500（SPX）」「NVIDIA（NVDA）」…）；區間是 SegmentedControl 的按鈕「1 個月」…「5 年」；總覽或名單點公司列。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、測試帳號登入。

- **主圖。** `goto("/history")`，等 `text=走勢與均線`。`fetch("/api/v1/history?symbol=SPX&months=12")` 比 `mainStats`。截圖 `history-main.png`，用眼睛看四條線與圖例。
- **區間。** 區間按鈕是 `a.chip`（文字「1 個月」「1 年」…），點 `a.chip:text-is("6 個月")`，等網址出現 `months=6` 與統計數字更新，再比 `months=6` 的 API。
- **標的。** `selectOption("select", "NVDA")`，網址出現 `symbol=NVDA`，比 `symbol=NVDA` 的 API。
- **App。** walkthrough 的 `03-history.png`、`03b-history-compare.png`、`03c-history-contribution.png`；`ios-test.sh … VerifyInteractionTests/test03_History` 的 `C2-ranges.txt`（每個區間的報酬、回檔、交易日對 `months=` 的 API）、`C3-rapid.png`、`C4-nvda.png`／`.txt`、`C6-aapl.png`。
- **Proof。** `history-main.png`、`history-nvda.png`、對應 API JSON、App 的 walkthrough 三張與 test03 的截圖、`.txt`。

- App 大字級檢查區間統計、報酬及回檔文字完整換行；圖表與圖例仍可辨識。

## Gotchas

- 圖是 canvas（TradingView Lightweight Charts），DOM 裡沒有線，只能用截圖判斷，數字用統計卡片比。
- 本機只回補了 60 天快照：近 40 日貢獻圖有資料；更早日子的名單貢獻沒有（價格有十年）。
- App 的區間標籤要讀成「1 個月」而不是「1 月」（C2 曾經的 fail）。

## 研究表與原始資料（網頁 L6-T5、App L6-T6）

- `history-research`：主圖後只在 `watch.includes(symbol)` 時顯示「研究表與原始資料」；SPX、VIX、RSP 與 ETF 不顯示。沿用走勢頁資料，不改 API，也沒有輸入框或儲存。
- 入口：登入測試帳號後，從名單點 NVIDIA 的「走勢」，或開 `/history?symbol=NVDA`。確認面板在主圖下、相對報酬圖上；「SEC EDGAR 申報清單」另開 NVIDIA CORP 申報清單，「公司投資人關係（IR）」另開 `https://investor.nvidia.com/`；兩者均有 `target="_blank" rel="noreferrer"`。
- 展開 `summary:text-is("研究表範本（7 題）")`，依序看到企業驅動、盈餘假設、與共識的差異、估值敏感度、下一個核對事件、反證、論點失效條件；底部有「這張表只整理研究問題，不是評等、目標價或買賣建議；本站不保存你填的內容。」。
- 複製：整頁導覽後先依 verify 的 Drive 等 hydrate，再點 `button:text-is("複製範本")`，看到「已複製，可貼到你自己的筆記保存」。讀剪貼簿前先 `page.cdp('Browser.grantPermissions', {permissions:['clipboardReadWrite']})`；比對 `researchTemplate({company: 'NVIDIA', ticker: 'NVDA', date: 裝置點擊當下的本地日期})`，包含每題後空行，結尾不換行。不讀剪貼簿時逐題比對展開文字；模擬 `navigator.clipboard.writeText` 回傳 rejected Promise 後重點，確認顯示「無法複製，請手動選取上方文字」。
- 同頁換公司：NVDA 展開範本並複製後，分別用標的下拉選單與區間統計表的 Apple 連結切到 AAPL；EDGAR 連結改為 `CIK=AAPL`，複製提示消失、範本收合，剪貼簿仍保留原先 NVIDIA 的文字。重新展開並複製後才顯示 Apple 的成功提示與範本。可重跑 `cd web && node tests/research-navigation.mjs http://localhost:<port> <證據目錄>`（先在 ego-browser 登入本機測試帳號；腳本以記憶體剪貼簿排除權限與焦點干擾，走真實 Void 客戶端導覽），留存 `select-before/after.png`、`table-before/after.png` 與 `results.json`。
- 隱藏與未收錄 IR：依序開 `/history?symbol=SPX`、`/history?symbol=VIX`、`/history?symbol=RSP`、`/history?symbol=VOO`，皆無研究面板。暫時把 AVGO 加入測試帳號名單後，開 `/history?symbol=AVGO`，只有 EDGAR 外連並顯示「這家公司未收錄 IR 網址；可從 EDGAR 的年報（10-K）找到公司網站。」；複製文字也省略「公司 IR」行。測完移除 AVGO 並確認名單還原。
- Proof：`history-research-nvda.png`（主圖與面板位置）、`history-research-expanded.png`（七題）、`history-research-copied.png`／`history-research-copy-failed.png`（結果提示）、剪貼簿文字（可讀時）、兩個外連的落地頁截圖、非公司標的無面板的截圖、`history-research-avgo.png` 與名單還原的讀回證據。
- Gotchas：EDGAR 用內部連字號 `BRK-B`，不可轉成 `BRK.B`；SEC 會擋 curl，外連落地頁只能用瀏覽器驗。IR 只收錄預設七家在 2026-10-28 核對過的網址。剪貼簿需 https 或 localhost；日期只在點擊時計算，SSR 不輸出日期。
- App（C8）：走勢 → 右上「標的：S&P 500」→ NVIDIA；主圖後、相對報酬圖前顯示同名 Section，條件為 `h.watch.contains(h.symbol)`。點 EDGAR 會開 Safari 的 NVIDIA 申報清單，IR 開公司投資人頁；未收錄 IR 時用與網頁相同的說明句。展開「研究表範本（7 題）」逐題核對，footer 是 `Research.note`；沒有輸入框或儲存。
- App 複製：展開後點「複製範本」，確認「已複製，可貼到你自己的筆記保存」，剪貼簿等於 `Research.template(company:ticker:date:)`；日期取按下當下裝置本地的 Gregorian `yyyy-MM-dd`。同頁改選另一家公司時範本收合、成功提示清除；切回 S&P 500 或 RSP 時整個 Section 消失，ETF 也不顯示。範本與七個 IR 網址的正本是 `web/src/lib/research.ts`，`CopyTests` 和 `web/tests/research.test.ts` 比對同一全文字面值。
- App 自動互動：在全域模擬器鎖內重用 `MO iPhone 16 Plus`，依 AGENTS.md 設定本輪 `sim.udid`，執行 `ios-test.sh … VerifyInteractionTests/test19_HistoryResearch` 對本機站操作選 NVIDIA、核對兩個外連與七題、複製、再切 S&P 500。Proof：`C8-research-links.png`、`C8-research.png`／`.txt`、`C8-research-spx.png`／`.txt`（輸出目錄沿用 `MO_SHOTS`）。本票只編譯 XCUITest，實跑留到整合 UI 驗收。
- App 人工驗收另點兩個外連確認落地頁，並用最大 Dynamic Type 檢查七題、未收錄 IR 句、複製結果與 footer 都完整換行。驗完立即 shutdown；L7-T1 合併前不執行 `ios-up.sh` 或 `down.sh`。
