# ETF 與定投

11 檔 S&P 500 ETF（含槓桿與反向）的各期間報酬、費用、規模比較；台幣定投試算（每月第一個交易日買入、當天匯率換匯）；「我的規劃」存每個帳號的研究預算、每批投入、考慮出場漲幅等。

## Sub-features

- `etfs-table`（F1、F2）：11 檔 VOO、IVV、SPY、SPYM、SSO、UPRO、SPXL、SH、SDS、SPXU、SPXS；報酬＝API `rows[].returns`；2×／3×／反向標示正確；期間切換 YTD、1M、5Y。
- `dca-simulate`（F3）：選 ETF、年數、每月金額按「試算」，結果＝`/api/v1/etfs?etf=…&years=…&monthly=…` 的 `dca`；沒存前按鈕是「設為我的預設」。
- `dca-save-default`（F3b）：「設為我的預設」後 API `plan` 是那組值，離開再進來仍是；之後改回 VOO／3 年／10000。
- `plan-validate`（F4）：考慮出場漲幅 `150` 時「儲存」不能按、顯示中文範圍說明。
- `plan-save`（F5）：每批投入改 60000 儲存、讀回；之後改回 50000。

## How to get to it (user POV)

- 網頁：導覽列「ETF 與定投」→ `/etfs`（`/etfs?etf=IVV&years=2&monthly=5000`）；下方「定投試算（台幣）」「我的規劃」。
- App：「更多 → ETF 與定投試算」，右上「我的規劃」。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、測試帳號登入、規劃是預設值（VOO／3 年／10000、每批 50000）。

- **表格。** `goto("/etfs")`，等 `text=ETF 產品比較`；`fetch("/api/v1/etfs")` 比每列報酬。截圖 `etfs-table.png`。
- **試算。** 在「定投試算（台幣）」選 ETF 與年數（兩個 `select` 會直接換網址）、`input[type=number]` 填 5000、按「試算」；比 `fetch("/api/v1/etfs?etf=IVV&years=2&monthly=5000")` 的 `dca`。
- **我的規劃。** 改每批投入、按儲存，`fetch("/api/v1/etfs")` 的 `plan.trancheTwd` 讀回；改回原值再讀回一次。
- **App。** walkthrough 的 `07-etfs.png`、`07b-dca.png`；F3b、F4、F5 需要輸入，用 XCUITest 補 test 或 Codex DeviceHub 手動操作。
- **Proof。** `etfs-table.png`、`dca-ivv.png`、`plan-saved.api.json`、還原後的 API JSON、App 截圖。

## Gotchas

- 「試算」按鈕在金額沒變時停用。
- 規劃存在 D1 `settings`，每個帳號各一份；改完一定要改回並讀回，下一個功能才從基準開始。
- 定投不含配息、手續費與稅；數字跟券商對帳單不同是設計如此。
