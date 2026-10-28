# 資料來源（站長）

列出各上游來源、排程時間、SPY 持股檔日期、各標的最新資料、近 60 天來源不一致與執行紀錄；站長可以在這頁手動執行排程工作。非站長看得到頁面但不能執行，`/api/admin/*` 回 403。

## Sub-features

- `sources-page`：各區塊（手動執行、排程、SPY 持股檔、資料性質、各標的最新資料、執行紀錄）有內容；「資料性質」列三條註記（Yahoo／Nasdaq 是非官方端點、價格不含股息、策略師目標表人工維護）；「近 60 天來源不一致」只在有不一致時才出現，沒出現不算 fail。
- `sources-no-leak`：頁面資料（嵌在 HTML 裡）的執行紀錄只有 `id, job, trigger, status, started_at, finished_at, summary`，`trigger` 只會是 `cron` 或 `manual`，不含 `detail`、email 或 stack；非站長看頁面原始碼搜 `@`、`stack`、`detail` 應無命中。
- `sources-manual-run`：站長按某個工作的按鈕 → 執行紀錄多一筆、狀態 ok。
- `sources-analysts`：分析師工作以抓取時的 `latestExpectedClose()` 為股價日上限；美東 16:30 前（含夏令時間 UTC 20:00 的 news 排程）採前一交易日收盤。EPS 請求失敗仍寫入目標價、EPS 欄為 null，工作為 partial，摘要保留「分析師共識 x/y 檔」開頭並追加「；EPS 失敗 N 檔」；`detail.epsFailed` 列出失敗代號，沒有失敗時為空陣列。
- `sources-non-owner`：測試帳號看不到「手動執行」區塊，`POST /api/admin/run?job=weights` 回 403 `{"error":"只有站長能執行"}`。

## How to get to it (user POV)

- 網頁：導覽列「資料來源」→ `/sources`（手機寬度是右上資料庫圖示）。App 沒有這頁。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態。站長在 ego-browser 登入要用 `$RUN/owner.pw` 的密碼：在腳本裡用 `fs.readFile` 讀檔填進欄位，不要印出來。

- **站長頁面。** 站長登入後 `goto("/sources")`，等 `text=資料來源與品質`；截圖 `sources.png`。執行紀錄最上面幾筆是 `web-up.sh` 跑的回補與排程。
- **手動執行。** 按鈕是工作的中文名稱（「抓收盤價」「SPY 持股權重」「財報與總經日程」…；兩個推播工作是「發送收盤推播」「發送今日事件推播」）：點 `button:text-is("SPY 持股權重")`，按鈕變「執行中…」，結束後上方出現「SPY 持股權重：成功 …」、執行紀錄多一筆。截圖 `sources-manual-run.png`。
- **分析師對帳。** 本機 `web-up.sh` 跑完 news 後，在 `/sources` 核對 analysts 紀錄為 ok 或帶「EPS 失敗 N 檔」的 partial；查本輪 `analyst_views.price_date` 不晚於抓取時的 `latestExpectedClose()`。部署後由站長執行 `POST /api/admin/cron?name=news`，留存 analysts 的 `status`、`summary`、`detail.subrequests`、`detail.epsFailed`，並對帳新寫入列；請求數量級與原流程相同（輪替常數與端點數不變）。EPS 失敗的合成情境與盤中日期界線由 `web/tests/analysts-job.test.ts` 重現。
- **非站長。** 測試帳號 `goto("/sources")`：沒有 `h2:text-is("手動執行")`，截圖 `sources-non-owner.png`；`page.fetch("/api/admin/run?job=weights", { method: "POST" })` 回 403、`{"error":"只有站長能執行"}`。
- **Proof。** `sources.png`、`sources-manual-run.png`、`sources-non-owner.png`、403 的回應。

## Gotchas

- 改到排程或抓取時，本機只能證明能跑；正式站的額度與子請求數要在部署後用 `POST /api/admin/cron?name=<排程>` 驗（`web/AGENTS.md`）。
- 手動執行會打真實上游，連按會被限流。
