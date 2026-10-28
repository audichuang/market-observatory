# ETF 與定投

11 檔 S&P 500 ETF（含槓桿與反向）的各期間報酬、費用、規模比較；台幣定投試算（首筆在試算起點當天或之後第一個有價格的交易日買入，之後每月第一個交易日以收盤價買入，首月可能不完整；換匯用買入日的 USD/TWD，當天沒有匯率時沿用之前最近一筆）；「我的規劃」存每個帳號的研究預算、每批投入、出場／檢討門檻與備註（網頁與 App 用詞不同，見下方把手）。

## Sub-features

- `etfs-table`（F1、F2）：11 檔 VOO、IVV、SPY、SPYM、SSO、UPRO、SPXL、SH、SDS、SPXU、SPXS；報酬＝API `rows[].returns`；2×／3×／反向標示正確；期間切換 YTD、1M、5Y。
- `dca-simulate`（F3）：選 ETF、年數、每月金額按「試算」，結果＝`/api/v1/etfs?etf=…&years=…&monthly=…` 的 `dca`；沒存前按鈕是「設為我的預設」。
- `dca-monthly-minimum`：正數月額取整後至少 1 元，儲存端拒絕 0；舊規劃的月額 0 讀成預設 10000，其餘欄位與資料庫原值保留。
- `dca-save-feedback`：儲存預設與規劃時停用送出按鈕；HTTP 或網路失敗顯示 `role="alert"` 紅字，儲存預設保留伺服器具體錯誤（如登入過期、欄位錯誤）；即時欄位驗證用 `role="status"`。
- `dca-save-default`（F3b）：「設為我的預設」後 API `plan` 是那組值，離開再進來仍是；之後改回 VOO／3 年／10000。
- `plan-validate`（F4）：出場漲幅填 `150`：App「儲存」停用、顯示中文範圍說明「金額要是 0 到 10 億的整數，出場漲幅 0–100%…」；網頁「儲存規劃」停用並顯示同一句中文說明，不存入。
- `plan-save`（F5）：每批投入改 60000 儲存、讀回；之後改回 50000。

## How to get to it (user POV)

- 網頁：導覽列「ETF 與定投」→ `/etfs`（`/etfs?etf=IVV&years=2&monthly=5000`）；下方「定投試算（台幣）」「我的規劃」。
- App：「更多 → ETF 與定投試算」，右上「我的規劃」。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、測試帳號登入、規劃是預設值（VOO／3 年／10000、每批 50000）。

- **表格。** `goto("/etfs")`，等 `text=ETF 產品比較`；`fetch("/api/v1/etfs")` 比每列報酬。截圖 `etfs-table.png`。
- **試算。** 在「定投試算（台幣）」選 ETF 與年數（兩個 `select` 會直接換網址）、`input[type=number]` 填 5000、按「試算」；比 `fetch("/api/v1/etfs?etf=IVV&years=2&monthly=5000")` 的 `dca`。
- **預設失敗與小數。** 開 `/etfs?monthly=1500.5`，畫面每月金額取整成 1501，按「設為我的預設」後網址的 monthly 也是 1501，API `plan.monthlyTwd` 讀回 1501。改試算金額後，以 CDP `Network.emulateNetworkConditions` 設 offline，再按儲存：出現 `p.error[role="alert"]`；恢復網路後改回預設並讀回。
- **月額下限。** 開 `/etfs?monthly=0.4`，畫面與 API `sim.monthlyTwd` 都是 1；歷史資料足夠時仍可試算。儲存後 `plan.monthlyTwd` 讀回 1，直接送 API 月額 0 應回 400。測完改回原預設並讀回。
- **我的規劃（網頁）。** 欄位是「加碼研究預算」「單筆加碼」「檢討門檻 ±%」「待定事項與備註」，按鈕「儲存規劃」。欄位沒有 name，用整頁 `input[type=number]` 的順序：0＝每月投入（定投試算）、1＝研究預算、2＝單筆加碼、3＝檢討門檻（取第 n 個的寫法照 `ego-browser skill`）。單筆加碼改 60000、按 `button:text-is("儲存規劃")`，`fetch("/api/v1/etfs")` 的 `plan.trancheTwd` 讀回；改回 50000 再讀回一次（F5）。檢討門檻填 150 按儲存，看錯誤訊息與 `plan.exitConsiderationPct` 沒變（F4）。
- **App。** walkthrough 的 `07-etfs.png`、`07b-dca.png`；`ios-test.sh … VerifyInteractionTests/test06_EtfsPlan`：`F2-periods.txt`、`F3-dca.png`／`.txt`（IVV／2 年／5000 的結果對 API `dca`）、`F3b-reopen.txt`（離開再進來仍是「標的、IVV」「期間、2 年」「已是我的預設」）、`F4-exit150.txt`（「儲存 enabled=false」＋中文範圍說明）、`F5-reopen.txt`（60000），結束時改回 VOO／3 年／10000、每批 50000。
  App 把手：試算區的 Picker 按鈕 label「標的、VOO」「期間、3 年」，每月投入欄位 label「每月投入」，試算按鈕 label「每月投入、試算」；「設為我的預設／已是我的預設」在清單下方，要先捲出來。右上「我的規劃」的欄位 label 是「研究預算」「每批投入」「考慮出場漲幅 %」，按鈕「儲存」「取消」。
- **Proof。** `etfs-table.png`、`dca-ivv.png`、`plan-saved.png`、`plan-exit150-after-save.png`、`plan-saved.api.json`、還原後的 API JSON、App 截圖與 `.txt`。

## Gotchas

- App ETF 列將名稱、費用率、規模及備註分行，大字時代號與報酬上下排列，報酬正負號與數值維持同一行；用 `test16_Readability` 的 `etfs`、`etfs-reading` 與規劃截圖檢查一般／最大字級，`test20_LargeTypeEtfAndLogin` 比較同樣 headline 的 VOO 代號／報酬高度，檢查報酬單行且不超出畫面；再用 `test06_EtfsPlan` 操作與 API 讀回確認試算及儲存。

- 「試算」按鈕在金額沒變時停用。
- 規劃存在 D1 `settings`，每個帳號各一份；改完一定要改回並讀回，下一個功能才從基準開始。
- 定投不含配息、手續費與稅；數字跟券商對帳單不同是設計如此。
- 檢討門檻超出 0–100 時，網頁在送出前就停用「儲存規劃」並顯示「金額要是 0 到 10 億的整數，檢討門檻 0–100%，備註最多 2000 字。」；直接打 API 送 150 回 400「檢討門檻要在 0–100% 之間」。
