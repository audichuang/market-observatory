# 資料來源（站長）

列出各上游來源、排程時間、SPY 持股檔日期、各標的最新資料、近 60 天來源不一致與執行紀錄；站長可以在這頁手動執行排程工作。非站長看得到頁面但不能執行，`/api/admin/*` 回 403。

## Sub-features

- `sources-page`：各區塊（手動執行、排程、SPY 持股檔、資料性質、各標的最新資料、執行紀錄）有內容；「資料性質」列三條註記（Yahoo／Nasdaq 是非官方端點、價格不含股息、策略師目標表人工維護）；「近 60 天來源不一致」只在有不一致時才出現，沒出現不算 fail。
- `sources-weights-stale`：最新 SPY 持股落後 `latestScheduledClose()` 超過 2 個 NYSE 交易日時，「SPY 持股檔」標題下顯示共用的「權重未更新：最新 SPY 持股停在 …」橘色警示。weights 工作則以 `latestExpectedClose()` 判斷，過期檔仍寫入，執行狀態為 partial、摘要開頭帶同一警示。
- `sources-no-leak`：頁面資料（嵌在 HTML 裡）的執行紀錄只有 `id, job, trigger, status, started_at, finished_at, summary`，`trigger` 只會是 `cron` 或 `manual`，不含 `detail`、email 或 stack；非站長看頁面原始碼搜 `@`、`stack`、`detail` 應無命中。
- `sources-manual-run`：站長按某個工作的按鈕 → 執行紀錄多一筆、狀態 ok。
- `sources-non-owner`：測試帳號看不到「手動執行」區塊，`POST /api/admin/run?job=weights` 回 403 `{"error":"只有站長能執行"}`。

## How to get to it (user POV)

- 網頁：導覽列「資料來源」→ `/sources`（手機寬度是右上資料庫圖示）。App 沒有這頁。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態。站長在 ego-browser 登入要用 `$RUN/owner.pw` 的密碼：在腳本裡用 `fs.readFile` 讀檔填進欄位，不要印出來。

- **站長頁面。** 站長登入後 `goto("/sources")`，等 `text=資料來源與品質`；截圖 `sources.png`。執行紀錄最上面幾筆是 `web-up.sh` 跑的回補與排程。
- **手動執行。** 按鈕是工作的中文名稱（「抓收盤價」「SPY 持股權重」「財報與總經日程」…；兩個推播工作是「發送收盤推播」「發送今日事件推播」）：點 `button:text-is("SPY 持股權重")`，按鈕變「執行中…」，結束後上方出現「SPY 持股權重：成功 …」、執行紀錄多一筆。截圖 `sources-manual-run.png`。
- **權重未更新。** 沿用 `overview.md` 的舊持股準備與還原步驟，開 `/sources`，確認「SPY 持股檔」標題下有 `notice warn`，警示以排程應有日期為目標，與 `/watchlist` 逐字相同；存 `sources-weights-stale.png`。還原後確認消失。過期 xlsx 的 partial 與摘要由 `tests/weights-replace.test.ts` 合成驗證。
- **非站長。** 測試帳號 `goto("/sources")`：沒有 `h2:text-is("手動執行")`，截圖 `sources-non-owner.png`；`page.fetch("/api/admin/run?job=weights", { method: "POST" })` 回 403、`{"error":"只有站長能執行"}`。
- **Proof。** `sources.png`、`sources-manual-run.png`、`sources-non-owner.png`、403 的回應。

## Gotchas

- 改到排程或抓取時，本機只能證明能跑；正式站的額度與子請求數要在部署後用 `POST /api/admin/cron?name=<排程>` 驗（`web/AGENTS.md`）。
- 手動執行會打真實上游，連按會被限流。

## 來源授權清冊（L1-T7）

- `sources-registry`：站長在 `/sources` 看到「來源授權清冊（站長）」表，列出 14 個來源（8 worker、1 local、3 static、2 manual），包含工作與畫面用途、取得欄位、停用影響、五項權利及各項依據、條款連結、版本日、本站查閱日與依據文件。
- 免責句逐字為：「這份清冊整理的是條款文字與本站用途的落差，不是法律意見；列在這裡不代表已取得授權。」清冊不控制既有資料的顯示或隱藏。
- 站長登入後由導覽列「資料來源」進入，找到 `h2:text-is("來源授權清冊（站長）")`。在該表的 Nasdaq 分析師列確認低／高目標價、財年、EPS 共識、估計數、上修／下修各有欄位名與顯示狀態；低／高目標價、財年、EPS 共識、估計數為「已存未顯示；L6 #10 預定顯示」，上／下修為「彙總顯示中；L6 #10 預定顯示逐股次數」。文字寫明已在抓、已存於 `analyst_views`，L6 #10 只改顯示，歷月共識未抓取。
- 橫向捲動表格看條款欄：Nasdaq 版本日為「未核實」，原因提到 V-B #15 未親見 2026-05-11；Yahoo 註「沿前輪 2026-08-04 版，本輪未重核」；Cboe 版本為 2022-11-16，衍生計算欄提到「核對或更正他源資料」限制。本站查閱日皆為 2026-10-28。展開「依據文件」可讀文件與程式位置。
- 證據：站長表格與 Nasdaq 列存 `sources-registry.png`，條款欄存 `sources-registry-terms.png`；用測試帳號從導覽列進入 `/sources`，確認沒有清冊標題與表，存 `sources-registry-non-owner.png`。App 無此頁。
- 清冊是 repo 公開的靜態資料，props 會嵌入每位登入者的 HTML；只有面板對站長顯示。loader 只需 `env.DB`，不查登入者、不送 RegExp，也不含 email。`tests/source-registry.test.ts` 記錄五支排程與加入全站新公司的每個請求網址，新增上游必須補清冊；APNs／Sign in with Apple 是傳輸與認證例外。此守門只跑 worker，沒有執行本機 AI 排程；本機配對正文可能來自非 Yahoo 網站，仍需另外核查其條款。
