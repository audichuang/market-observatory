# 資料來源（站長）

列出各上游來源、排程時間、SPY 持股檔日期、各標的最新資料、近 60 天來源不一致與執行紀錄；站長可以在這頁手動執行排程工作。非站長看得到頁面但不能執行，`/api/admin/*` 回 403。

## Sub-features

- `sources-page`：各區塊（手動執行、排程、SPY 持股檔、新聞 AI（本機排程）、資料性質、各標的最新資料、執行紀錄）有內容；「資料性質」列三條註記（Yahoo／Nasdaq 是非官方端點、價格不含股息、策略師目標表人工維護）；「近 60 天來源不一致」只在有不一致時才出現，沒出現不算 fail。
- `sources-ai-status`：新聞 AI 三行列每日重點（最近一次狀態、時間、計數 summary、最後完整成功、最新交易日大盤重點是否寫入）、標題翻譯（最近一次、最後完整成功、待翻譯筆數與最早抓取時間）、新聞來源（最後成功抓取）。結果以 D1 為準，AI 匯入後重新載入即更新；沒有快照或執行紀錄時顯示尚無資料。
- `sources-no-leak`：頁面資料（嵌在 HTML 裡）的執行紀錄只有 `id, job, trigger, status, started_at, finished_at, summary`，`trigger` 只會是 `cron`、`manual` 或 `local`（畫面為排程／手動／本機）；`ai` 只放公開狀態、時間與計數，不含 `detail`、email 或 stack；非站長看頁面原始碼搜 `@`、`stack`、`detail` 應無命中。
- `sources-manual-run`：站長按某個工作的按鈕 → 執行紀錄多一筆、狀態 ok。
- `sources-non-owner`：測試帳號看不到「手動執行」區塊，`POST /api/admin/run?job=weights` 回 403 `{"error":"只有站長能執行"}`。

## How to get to it (user POV)

- 網頁：導覽列「資料來源」→ `/sources`（手機寬度是右上資料庫圖示）。App 沒有這頁。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態。站長在 ego-browser 登入要用 `$RUN/owner.pw` 的密碼：在腳本裡用 `fs.readFile` 讀檔填進欄位，不要印出來。

- **站長頁面。** 站長登入後 `goto("/sources")`，等 `text=資料來源與品質`；截圖 `sources.png`。執行紀錄最上面幾筆是 `web-up.sh` 跑的回補與排程。
- **手動執行。** 按鈕是工作的中文名稱（「抓收盤價」「SPY 持股權重」「財報與總經日程」…；兩個推播工作是「發送收盤推播」「發送今日事件推播」）：點 `button:text-is("SPY 持股權重")`，按鈕變「執行中…」，結束後上方出現「SPY 持股權重：成功 …」、執行紀錄多一筆。截圖 `sources-manual-run.png`。
- **非站長。** 測試帳號 `goto("/sources")`：沒有 `h2:text-is("手動執行")`，截圖 `sources-non-owner.png`；`page.fetch("/api/admin/run?job=weights", { method: "POST" })` 回 403、`{"error":"只有站長能執行"}`。
- **新聞 AI。** 站長在本機站用 `MO_URL`、暫存的 `MO_AI_BATCH_DIR` 跑 `node scripts/ai-batch.ts pull daily`，保留至少兩個任務，只答一題再 push；確認結束碼 3、輸出「缺答案」，保存 `receipt.json`。重新載入 `/sources`，「新聞 AI（本機排程）」每日重點最近一次為 partial（徽章「部分成功」），時間與 summary 對上回執，最後完整成功維持前一筆 ok；最新交易日的大盤重點標示依該日 SPX 摘要是否寫入。標題翻譯顯示待翻譯筆數與最早抓取時間，新聞來源顯示最後成功抓取。執行紀錄依 `data_version` 快取；檢查前先在本機 worktree 的 `web/` 執行 `npx void db execute "INSERT INTO settings (key,value) VALUES ('data_version',json_object('v',CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))) ON CONFLICT(key) DO UPDATE SET value=excluded.value;"`，再重新載入 `/sources`。執行紀錄列「新聞 AI 每日重點 · 本機」；翻譯紀錄標「新聞 AI 標題翻譯」。截圖 `sources-ai-partial.png`。再 pull 確認 `runs/<runId>/manifest.json` 與答案仍在；`pull daily --check` 前後檔案與 mtime 不變。用測試帳號看原始碼，搜尋 `@`、`stack`、`detail` 無命中，保存結果 `sources-no-leak.txt`。
- **Proof。** `sources.png`、`sources-manual-run.png`、`sources-non-owner.png`、403 的回應；AI 驗收另附 `sources-ai-partial.png`、`receipt.json`、歸檔 manifest、precheck 前後比對與 `sources-no-leak.txt`。

## Gotchas

- 改到排程或抓取時，本機只能證明能跑；正式站的額度與子請求數要在部署後用 `POST /api/admin/cron?name=<排程>` 驗（`web/AGENTS.md`）。
- 手動執行會打真實上游，連按會被限流。
