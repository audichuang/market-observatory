# 資料來源（站長）

列出各上游來源、排程時間、SPY 持股檔日期、各標的最新資料、近 60 天來源不一致與執行紀錄；站長可以在這頁手動執行排程工作。非站長看得到頁面但不能執行，`/api/admin/*` 回 403。

## Sub-features

- `sources-retry-schedule`：收盤補抓時間顯示「隔日 UTC 02:00（台灣 10:00）」，對應週二至六 UTC 02:00 的 retry 排程。
- `sources-page`：各區塊（手動執行、排程、SPY 持股檔、新聞 AI（本機排程）、資料性質、各標的最新資料、執行紀錄）有內容；「資料性質」列三條註記（Yahoo／Nasdaq 是非官方端點、價格不含股息、策略師目標表人工維護）；「近 60 天來源不一致」只在有不一致時才出現，沒出現不算 fail。
- `sources-weights-stale`：最新 SPY 持股落後 `latestScheduledClose()` 超過 2 個 NYSE 交易日時，「SPY 持股檔」標題下顯示共用的「權重未更新：最新 SPY 持股停在 …」橘色警示。weights 工作則以 `latestExpectedClose()` 判斷，過期檔仍寫入，執行狀態為 partial、摘要開頭帶同一警示。
- `sources-ai-status`：新聞 AI 三行列每日重點（最近一次狀態、時間、計數 summary、最後完整成功、最新交易日大盤重點是否寫入）、標題翻譯（最近一次、最後完整成功、待翻譯筆數與最早抓取時間）、新聞來源（最後成功抓取）。結果以 D1 為準，AI 匯入後重新載入即更新；沒有快照或執行紀錄時顯示尚無資料。
- `sources-no-leak`：頁面資料（嵌在 HTML 裡）的執行紀錄只有 `id, job, trigger, status, started_at, finished_at, summary`，`trigger` 只會是 `cron`、`manual` 或 `local`（畫面為排程／手動／本機）；`ai` 只放公開狀態、時間與計數，不含 `detail`、email 或 stack；非站長看頁面原始碼搜 `@`、`stack`、`detail` 應無命中。
- `sources-manual-run`：站長按某個工作的按鈕 → 執行紀錄多一筆、狀態 ok。
- `sources-forecast-phase`：站長可手動執行「展望相位平均」；交叉核對排程（週一至五 UTC 22:50）依序執行 `crosscheck`、`forecast-phase`，頁面說明「之後重算展望相位平均」。新工作只讀 SPX／VIX 算摘要存 settings，不打外部請求（detail.subrequests = 0）；同資料日與模型版本回「已是最新」、computedAt 不變；資料不足回「資料不足，略過」、status 仍 ok。
- `sources-analysts`：分析師工作以抓取時的 `latestExpectedClose()` 為股價日上限；美東 16:30 前（含夏令時間 UTC 20:00 的 news 排程）採前一交易日收盤。EPS 請求失敗仍寫入目標價、EPS 欄為 null，工作為 partial，摘要保留「分析師共識 x/y 檔」開頭並追加「；EPS 失敗 N 檔」；`detail.epsFailed` 列出失敗代號，沒有失敗時為空陣列。
- `sources-non-owner`：測試帳號看不到「手動執行」區塊，`POST /api/admin/run?job=weights` 回 403 `{"error":"只有站長能執行"}`。

## How to get to it (user POV)

- 網頁：導覽列「資料來源」→ `/sources`（手機寬度是右上資料庫圖示）。App 沒有這頁。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態。站長在 ego-browser 登入要用 `$RUN/owner.pw` 的密碼：在腳本裡用 `fs.readFile` 讀檔填進欄位，不要印出來。

- **站長頁面。** 站長登入後 `goto("/sources")`，等 `text=資料來源與品質`；確認收盤補抓時間是「隔日 UTC 02:00（台灣 10:00）」，截圖 `sources.png`。執行紀錄最上面幾筆是 `web-up.sh` 跑的回補與排程。
- **手動執行。** 按鈕是工作的中文名稱（「抓收盤價」「SPY 持股權重」「財報與總經日程」…；兩個推播工作是「發送收盤推播」「發送今日事件推播」）：點 `button:text-is("SPY 持股權重")`，按鈕變「執行中…」，結束後上方出現「SPY 持股權重：成功 …」、執行紀錄多一筆。截圖 `sources-manual-run.png`。
- **權重未更新。** 沿用 `overview.md` 的舊持股準備與還原步驟，開 `/sources`，確認「SPY 持股檔」標題下有 `notice warn`，警示以排程應有日期為目標，與 `/watchlist` 逐字相同；存 `sources-weights-stale.png`。還原後確認消失。過期 xlsx 的 partial 與摘要由 `tests/weights-replace.test.ts` 合成驗證。
- **相位平均。** 點 `button:text-is("展望相位平均")`，執行紀錄出現成功；讀 `/api/v1/outlook` 留下 `phaseSummary`，再執行一次，摘要「已是最新」且 API computedAt 不變。交叉核對排程的本機／部署後 API 對帳須含兩個工作，確認 `forecast-phase` status ok、detail.subrequests = 0；留 `sources-forecast-phase.png` 與 API JSON。
- **分析師對帳。** 本機 `web-up.sh` 跑完 news 後，在 `/sources` 核對 analysts 紀錄為 ok 或帶「EPS 失敗 N 檔」的 partial；查本輪 `analyst_views.price_date` 不晚於抓取時的 `latestExpectedClose()`。部署後由站長執行 `POST /api/admin/cron?name=news`，留存 analysts 的 `status`、`summary`、`detail.subrequests`、`detail.epsFailed`，並對帳新寫入列；請求數量級與原流程相同（輪替常數與端點數不變）。EPS 失敗的合成情境與盤中日期界線由 `web/tests/analysts-job.test.ts` 重現。
- **非站長。** 測試帳號 `goto("/sources")`：沒有 `h2:text-is("手動執行")`，截圖 `sources-non-owner.png`；`page.fetch("/api/admin/run?job=weights", { method: "POST" })` 回 403、`{"error":"只有站長能執行"}`。
- **新聞 AI。** 站長在本機站用 `MO_URL`、暫存的 `MO_AI_BATCH_DIR` 跑 `node scripts/ai-batch.ts pull daily`，保留至少兩個任務，只答一題再 push；確認結束碼 3、輸出「缺答案」，保存 `receipt.json`。重新載入 `/sources`，「新聞 AI（本機排程）」每日重點最近一次為 partial（徽章「部分成功」），時間與 summary 對上回執，最後完整成功維持前一筆 ok；最新交易日的大盤重點標示依該日 SPX 摘要是否寫入。標題翻譯顯示待翻譯筆數與最早抓取時間，新聞來源顯示最後成功抓取。新聞 AI 狀態與執行紀錄不經 `cachedPage`，每次請求都從主庫讀取；不必 bump `data_version`，重新載入 `/sources` 即應看到最新紀錄。執行紀錄列「新聞 AI 每日重點 · 本機」；翻譯紀錄標「新聞 AI 標題翻譯」。截圖 `sources-ai-partial.png`。再 pull 確認 `runs/<runId>/manifest.json` 與答案仍在；`pull daily --check` 前後檔案與 mtime 不變。用測試帳號看原始碼，搜尋 `@`、`stack`、`detail` 無命中，保存結果 `sources-no-leak.txt`。
- **Proof。** `sources.png`、`sources-manual-run.png`、`sources-non-owner.png`、403 的回應；AI 驗收另附 `sources-ai-partial.png`、`receipt.json`、歸檔 manifest、precheck 前後比對與 `sources-no-leak.txt`。

## Gotchas

- 改到排程或抓取時，本機只能證明能跑；正式站的額度與子請求數要在部署後用 `POST /api/admin/cron?name=<排程>` 驗（`web/AGENTS.md`）。
- 手動執行會打真實上游，連按會被限流。

## 來源授權清冊（L1-T7）

- `sources-registry`：站長在 `/sources` 看到「來源授權清冊（站長）」表，列出 14 個來源（8 worker、1 local、3 static、2 manual），包含工作與畫面用途、取得欄位、停用影響、五項權利及各項依據、條款連結、版本日、本站查閱日與依據文件。
- Cboe 列的工作包含 `prices`、`backfill-prices`、`backfill-index-history`；停用影響明列「回補十年日線的最後一段（VIX／SPX）也會受影響」。`tests/source-registry.test.ts` 實跑回補的全部七段，檢查每個實際來源都列出 `backfill-prices`，並確認最後一段實際請求 VIX／SPX。
- Nasdaq 歷史行情核對（`nasdaq-quote`）列的工作包含 `crosscheck`、`backfill-checks`、`addWatchSymbol`。`tests/source-registry.test.ts` 記錄加入全站新公司時的實際請求，確認每個命中來源的工作都包含 `addWatchSymbol`（目前為 Yahoo chart 與 Nasdaq 歷史行情核對）。
- 免責句逐字為：「這份清冊整理的是條款文字與本站用途的落差，不是法律意見；列在這裡不代表已取得授權。」清冊不控制既有資料的顯示或隱藏。
- 站長登入後由導覽列「資料來源」進入，找到 `h2:text-is("來源授權清冊（站長）")`。在該表的 Nasdaq 分析師列確認低／高目標價、財年、EPS 共識、估計數、上修／下修各有欄位名與顯示狀態；低／高目標價、財年、估計數為「顯示中」，EPS 共識為「已存未顯示」，上／下修為「彙總與逐股顯示中」。文字寫明已在抓、已存於 `analyst_views`，取得與保存的條款狀態與現用欄位相同，歷月共識未抓取。
- 橫向捲動表格看條款欄：Nasdaq 版本日為「未核實」，原因提到 V-B #15 未親見 2026-05-11；Yahoo 註「沿前輪 2026-08-04 版，本輪未重核」；Cboe 版本為 2022-11-16，衍生計算欄提到「核對或更正他源資料」限制。本站查閱日皆為 2026-10-28。展開「依據文件」可讀文件與程式位置。
- 證據：站長表格與 Nasdaq 列存 `sources-registry.png`，條款欄存 `sources-registry-terms.png`；用測試帳號從導覽列進入 `/sources`，確認沒有清冊標題與表，存 `sources-registry-non-owner.png`。App 無此頁。
- 清冊是 repo 公開的靜態資料，props 會嵌入每位登入者的 HTML；只有面板對站長顯示。loader 只需 `env.DB`，不查登入者、不送 RegExp，也不含 email。`tests/source-registry.test.ts` 記錄五支排程與加入全站新公司的每個請求網址，新增上游必須補清冊；APNs／Sign in with Apple 是傳輸與認證例外。此守門只跑 worker，沒有執行本機 AI 排程；本機配對正文可能來自非 Yahoo 網站，仍需另外核查其條款。

## 逐源停用（L1-T8）

- `sources-switches`：清冊只有 8 個 Worker 來源有「停用／恢復」按鈕，顯示「啟用中」或「已停用（台北時間）」。本機、人工與程式內建來源標「不可切換」。Yahoo、Cboe、SSGA 列另寫明抓價／加入新公司／分析師現價失敗、展望等 VIX、權重未更新的影響。
- 只在本機站驗：站長由導覽列「資料來源」進入清冊，找到 Nasdaq 新聞列的「停用」，確認對話框逐字為「停用後排程不再向這個來源發請求；已存的資料保留，畫面照常顯示到資料過期。確定停用？」；取消時狀態不變，確認後該列變「已停用（時間）」與「恢復」。用 `GET /api/admin/sources` 對帳 switches 中的 `nasdaq-news`（disabled、at，可有 reason，沒有操作者 email）。
- 在「手動執行」按「新聞」，執行紀錄 summary 含「來源已停用：Nasdaq 新聞」；經導覽列到新聞頁，確認既有新聞仍顯示。停用只擋 Worker 請求，不刪改價格、新聞、G02 或凍結輸入，也不改既有過期規則。
- 回清冊按「恢復」，該列變「啟用中」；再執行「新聞」應成功。切換成功會更新資料版本並 refresh，重新開頁也要一致。驗完以 GET 確認所有本輪開關都已恢復；正式站不要為驗收停用來源。
- 測試帳號由導覽列進入 `/sources`，看不到清冊與停用／恢復按鈕；`page.fetch("/api/admin/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "nasdaq-news", disabled: true }) })` 回 403 `{"error":"只有站長能執行"}`。站長傳未知或非 Worker id、reason 超過 200 字回 400。
- Yahoo chart 停用時，一般使用者在觀察名單嘗試加入全站新公司，應立即顯示「來源已停用：Yahoo chart／spark 日線，暫時無法加入新公司」，零請求且不佔每日新增名額。`tests/source-switches.test.ts` 固定美東日期，以 `watchlist:u1` 連試 5 家後確認沒有 `watch-new:` 列；同一天恢復 Yahoo 後，即使 Nasdaq 核對仍停用，第 6 家仍可成功加入，僅扣 1 個名額。
- 證據：停用前後 `sources-switches-before.png`／`sources-switches-disabled.png`、執行紀錄 `sources-switches-run.png`、保留的新聞 `sources-switches-news.png`、恢復後 `sources-switches-restored.png`，另存 API 讀回及非站長 403。`tests/source-switches.test.ts` 對帳停用來源零子請求、未停用分析師仍抓、舊資料不變、恢復後再抓，以及 Yahoo 停用時加入新公司失敗且零請求。
