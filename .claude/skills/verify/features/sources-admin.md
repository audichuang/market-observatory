# 資料來源（站長）

列出各上游來源、排程時間、SPY 持股檔日期、各標的最新資料、近 60 天來源不一致與執行紀錄；站長可以在這頁手動執行排程工作。非站長看得到頁面但不能執行，`/api/admin/*` 回 403。

## Sub-features

- `sources-page`：各區塊（手動執行、排程、SPY 持股檔、資料性質、各標的最新資料、執行紀錄）有內容；「資料性質」列三條註記（Yahoo／Nasdaq 是非官方端點、價格不含股息、策略師目標表人工維護）；「近 60 天來源不一致」只在有不一致時才出現，沒出現不算 fail。
- `sources-no-leak`：頁面資料（嵌在 HTML 裡）的執行紀錄只有 `id, job, trigger, status, started_at, finished_at, summary`，`trigger` 只會是 `cron` 或 `manual`，不含 `detail`、email 或 stack；非站長看頁面原始碼搜 `@`、`stack`、`detail` 應無命中。
- `sources-manual-run`：站長按某個工作的按鈕 → 執行紀錄多一筆、狀態 ok。
- `sources-forecast-phase`：站長可手動執行「展望相位平均」；交叉核對排程（週一至五 UTC 22:50）依序執行 `crosscheck`、`forecast-phase`，頁面說明「之後重算展望相位平均」。新工作只讀 SPX／VIX 算摘要存 settings，不打外部請求（detail.subrequests = 0）；同資料日與模型版本回「已是最新」、computedAt 不變；資料不足回「資料不足，略過」、status 仍 ok。
- `sources-non-owner`：測試帳號看不到「手動執行」區塊，`POST /api/admin/run?job=weights` 回 403 `{"error":"只有站長能執行"}`。

## How to get to it (user POV)

- 網頁：導覽列「資料來源」→ `/sources`（手機寬度是右上資料庫圖示）。App 沒有這頁。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態。站長在 ego-browser 登入要用 `$RUN/owner.pw` 的密碼：在腳本裡用 `fs.readFile` 讀檔填進欄位，不要印出來。

- **站長頁面。** 站長登入後 `goto("/sources")`，等 `text=資料來源與品質`；截圖 `sources.png`。執行紀錄最上面幾筆是 `web-up.sh` 跑的回補與排程。
- **手動執行。** 按鈕是工作的中文名稱（「抓收盤價」「SPY 持股權重」「財報與總經日程」…；兩個推播工作是「發送收盤推播」「發送今日事件推播」）：點 `button:text-is("SPY 持股權重")`，按鈕變「執行中…」，結束後上方出現「SPY 持股權重：成功 …」、執行紀錄多一筆。截圖 `sources-manual-run.png`。
- **相位平均。** 點 `button:text-is("展望相位平均")`，執行紀錄出現成功；讀 `/api/v1/outlook` 留下 `phaseSummary`，再執行一次，摘要「已是最新」且 API computedAt 不變。交叉核對排程的本機／部署後 API 對帳須含兩個工作，確認 `forecast-phase` status ok、detail.subrequests = 0；留 `sources-forecast-phase.png` 與 API JSON。
- **非站長。** 測試帳號 `goto("/sources")`：沒有 `h2:text-is("手動執行")`，截圖 `sources-non-owner.png`；`page.fetch("/api/admin/run?job=weights", { method: "POST" })` 回 403、`{"error":"只有站長能執行"}`。
- **Proof。** `sources.png`、`sources-manual-run.png`、`sources-non-owner.png`、403 的回應。

## Gotchas

- 改到排程或抓取時，本機只能證明能跑；正式站的額度與子請求數要在部署後用 `POST /api/admin/cron?name=<排程>` 驗（`web/AGENTS.md`）。
- 手動執行會打真實上游，連按會被限流。
