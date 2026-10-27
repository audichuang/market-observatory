# 觀察名單

每個帳號一份名單（預設七巨頭，最多 30 家），只收最新 SPY 持股裡的成分股，同公司多股類（GOOGL＋GOOG）合併成一列。加入全站沒人追蹤過的公司時會先抓十年日線（約幾秒），抓不到就整個不加。改名單後總覽與最近 45 個交易日的貢獻立刻用新名單重算。

## Sub-features

- `watchlist-list`（D1）：顯示家數「N/30 家」、合計權重＝API `totalWeight`，每家權重＝API。
- `watchlist-add`（D2、D3）：用輸入框或權重最大的候選按鈕加入；有進度提示「加入 X 中…」，完成「已加入 X」；總覽同步出現。
- `watchlist-add-invalid`（D4）：輸入不存在的代號（`ZZZZ`）：網頁顯示中文錯誤，App 搜尋顯示系統字串「沒有「ZZZZ」的結果」。
- `watchlist-new-daily-cap`：非站長帳號每天（美東日期）最多加入 5 家全站沒人追蹤的公司，第 6 家顯示「今天新增的新公司已達上限…」、名單不變；別人已在追蹤的公司不受限，站長名單不受限。只有單元測試（`tests/leak-guards.test.ts`）覆蓋，實際操作要 6 家新公司、會打真實上游。
- `watchlist-no-duplicate`（D5）：已在名單的公司不出現在候選。
- `watchlist-remove`（D6–D8）：移除；App 的整列左滑只露出「移除」、不會直接刪，按了跳確認「從名單移除 Broadcom？」（「取消」「移除」），取消時保留。
- `watchlist-symbol-link`（D9）：點公司 → 走勢頁該標的。
- `watchlist-cross-surface`：網頁改的名單，App 名單頁與總覽也看得到（反之亦然）。

## How to get to it (user POV)

- 網頁：`/watchlist`（導覽列「觀察名單」，手機寬度從總覽的「編輯名單」）；總覽表格右上「編輯名單」。
- App：總覽右上星號或「編輯名單」，開成 sheet（導覽列「觀察名單」，右上「加入」、「完成」關閉）；「加入」開的是 searchField，打代號後點結果列。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、測試帳號登入、名單是七巨頭、AVGO 不在名單。

- **列表。** `goto("/watchlist")`，等 `input[placeholder="代號或公司，例如 AVGO"]`。`fetch("/api/v1/watchlist")` 比家數、合計權重、每家權重（D1）。截圖 `watchlist-before.png`。
- **加入。** `fill('input[placeholder="代號或公司，例如 AVGO"]', "AVGO")`，`click('form button[type=submit]')`。用 `waitForFunction(() => [...document.querySelectorAll("li")].some(li => li.innerText.includes("AVGO")), undefined, { timeout: 60000 })` 等列表出現，`[role=status]` 文字是「已加入 Broadcom」。截圖 `watchlist-add.png`。
- **讀回。** `JSON.parse((await page.fetch("/api/v1/watchlist")).body).members.map(m => m.key)` 最後一個是 `AVGO`、`totalWeight` 增加、`candidates.map(c => c.ticker)` 裡不再有 AVGO（D5）；`goto("/")` 的表格有「Broadcom AVGO」，名單合計＋其他成分股仍＝指數漲跌（D3）。截圖 `watchlist-add-overview.png`、存 `watchlist-add.api.json`。
- **跨介面。** 跑 iOS walkthrough：`04-watchlist.png` 有 8 家、最後一家 AVGO、「8/30 家」。
- **錯誤代號。** 輸入 `ZZZZ` 按加入：`[role=status]` 是「ZZZZ 不在最新的 S&P 500 成分股（SPY 持股）裡」，名單不變（D4）。
- **移除（還原基準）。** 先用 `evaluate` 找到含 AVGO 的 `li`、把它的「移除」按鈕標上 `data-verify-target="remove"`，再 `click('[data-verify-target="remove"]')`。會跳 confirm「從名單移除 Broadcom？股價資料會保留，之後可以再加回來。」：先 `page.dismissDialog()`，AVGO 要還在（網頁版的 D7）；再點一次、`page.acceptDialog()`，等 AVGO 從列表消失；`members` 讀回 7 家、總覽不再有 Broadcom（D8）。
- **App 加入、移除、點公司。** 名單是七巨頭時跑 `ios-test.sh … VerifyInteractionTests/test04_Watchlist`（只斷言「7/30 家」開頭；`D1-before.txt`、`D8-removed.txt` 的合計權重對 API `totalWeight`）：`D5-search-nvda.txt`（已在名單的不出現）、`D4-search-zzzz.txt`、`D2-added.txt`（第一次加入全站沒人追蹤的公司時是「已加入 Broadcom（AVGO），補了 2514 筆日線」；「8/30 家 · 合計權重 …」對 API `totalWeight`）、`D6-full-swipe.png`（整列快速左滑後仍 8 家）、`D7-confirm.png`、`D8-removed.png`、`D9-tsla.png`。
- **Proof。** `watchlist-before.png`、`watchlist-add.png`、`watchlist-add-overview.png`、`watchlist-add.api.json`、`ios/04-watchlist.png`、test04 的截圖與 `.txt`、移除後的 API JSON。

## Gotchas

- 「加入」按鈕在輸入框空白時停用；輸入框有 `aria-label="股票代號"`，但 ego-browser 用 role 名稱找不到它，用 placeholder。
- `text=Broadcom` 會同時對到 datalist 的 option 與狀態列，等列表的 `li` 而不是文字。
- 加入全站沒人追蹤的公司要抓十年日線（本機約 5–15 秒）；Yahoo 限流時會失敗並顯示原因，名單不變——這是正確行為，不是測試要繞過的東西。
- `/api/v1/watchlist` 也回傳 `candidates`（還沒加入的成分股），整包 JSON 搜 `"AVGO"` 不管加沒加都會中；判斷名單一律看 `members`。
- 移除會跳原生 confirm，沒處理前任何 `evaluate` 都會丟 `PageDialogOpenedError`。
- 正式站的站長名單是使用者真的在用的資料；只用一次性帳號測加減。
- D9 斷言要看 sheet 已關（`觀察名單` 導覽列不存在）且「標的：Tesla」可點；只看元素存在會被 sheet 後面的走勢頁騙過（曾經的 bug：點公司 sheet 不關）。
