# 資料來源（站長）

列出各上游來源、排程時間、SPY 持股檔日期、各標的最新資料、近 60 天來源不一致與執行紀錄；站長可以在這頁手動執行排程工作。非站長看得到頁面但不能執行，`/api/admin/*` 回 403。

## Sub-features

- `sources-page`：各區塊（手動執行、排程、SPY 持股檔、各標的最新資料、近 60 天來源不一致、執行紀錄）有內容。
- `sources-manual-run`：站長按某個工作的按鈕 → 執行紀錄多一筆、狀態 ok。
- `sources-non-owner`：測試帳號看不到可用的手動執行，`POST /api/admin/run?job=weights` 回 403。

## How to get to it (user POV)

- 網頁：導覽列「資料來源」→ `/sources`（手機寬度是右上資料庫圖示）。App 沒有這頁。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態。站長在 ego-browser 登入要用 `$RUN/owner.pw` 的密碼：在腳本裡用 `fs.readFile` 讀檔填進欄位，不要印出來。

- **站長頁面。** 站長登入後 `goto("/sources")`，等 `text=資料來源與品質`；截圖 `sources.png`。執行紀錄最上面幾筆是 `web-up.sh` 跑的回補與排程。
- **手動執行。** 在「手動執行」按 `weights`（`text="weights"`），等執行紀錄多一筆；`curl -b $RUN/owner.cj …/api/v1/…` 不需要，紀錄就在畫面上。截圖 `sources-manual-run.png`。
- **非站長。** 測試帳號 `page.fetch("/api/admin/run?job=weights", { method: "POST" })` 回 403、`{"error":"只有站長能執行"}`。
- **Proof。** `sources.png`、`sources-manual-run.png`、403 的回應。

## Gotchas

- 改到排程或抓取時，本機只能證明能跑；正式站的額度與子請求數要在部署後用 `POST /api/admin/cron?name=<排程>` 驗（`web/AGENTS.md`）。
- 手動執行會打真實上游，連按會被限流。
