# 新聞與日曆

名單公司與 SPY 的 Nasdaq 新聞（正式站有中文翻譯與 AI 重點），可以用代號篩選；日曆列出名單公司財報與總經事件（FOMC、CPI、非農），App 是月曆加當日事件列表。

## Sub-features

- `news-digest-tone`（E9）：公司每日重點在公司名稱旁顯示「利多／利空／中性」，色條不朗讀；新聞篩選 chip 選中時帶 isSelected trait。
- `news-digest-dates`（L2-T5）：App 每列公司重點顯示資料日。全部代號時，「今日重點 · M/D（週）」只列 `/api/v1/news.latestTradeDate` 當天的摘要，前 3 家直接顯示，其餘收在「其餘 N 家」；其他日期收在預設收合的「較早的重點」。後端沒給 `latestTradeDate` 時，全部改列單一「公司重點」中性段落；單股段落保留原結構並顯示日期。
- `news-digest-import`（L2-T6）：摘要匯入日期必須有交易日快照，每個來源新聞 ID 都必須存在且發布日等於摘要日；不符者逐筆回傳 `rejected`，不寫入摘要。大盤摘要可沒有新聞來源；只檢查格式、來源與日期，不判斷語意。
- `news-digest-sources`（L2-T8，網頁）：每張公司摘要可展開「參考來源（整篇，非逐句）· N 則」，依原始引用順序列中文標題（無則英文）、出處與日期，點標題開原文。缺來源時另列缺少數量；舊 `[]` 來源顯示 0 則。頁首說明標題翻譯約每 4 小時執行，文章重點與每日摘要在美股交易日收盤後的台灣早上產生，全站共用；AI 可能出錯，請以原文為準。
- `news-digest-sources-ios`（L2-T9）：公司摘要展開時，下方獨立一列「參考來源（整篇，非逐句）」，identifier `news-digest-sources-<symbol>`；單股篩選預設展開，收合摘要也收合來源。依 API 順序列中文標題（無則英文）、出處與日期，點一列用 `openURL` 開原文；`sourcesMissing > 0` 顯示「另有 N 則來源已不在資料庫，無法列出」。來源按鈕獨立於 `news-digest-<symbol>` 的摘要按鈕。

- `news-list`（E1）：標題、來源、時間。網頁與 App 都把 `important: true` 的新聞排前面，其餘收在「其他 N 則」：第一筆＝API `/api/v1/news` 的 `news` 裡**第一個 `important` 為 true** 的 `title`（不是 `news[0]`）。
- `news-open`（E2）：點新聞開原文，回來時列表位置合理。
- `news-filter`（E3、E4）：代號篩選只剩該代號新聞；總則數（重要＋「其他 N 則」）＝`?symbol=` 的 API `news` 筆數，第一筆同 E1 規則；快速連點停在最後一個。
- `calendar-month`（E5）：App 月曆週日開頭、今天有外圈；有事件的日子有點（總經紅點：FOMC／CPI／非農；財報藍點）與圖例；點某天列出當天事件；換月、回「今天」；「接下來」列表點一列選到那天。
- `calendar-web`：網頁 `/news` 的「即將到來」事件列表；總經事件有 FOMC、CPI（如 11/10「CPI 消費者物價指數（2026 年 10 月）」）與非農（如 11/6「非農就業報告（2026 年 10 月）」）。
- `calendar-earnings-status`：Nasdaq earnings-date 備援回應命中 `estimated|derived from an algorithm` 時維持 `estimated`／「Zacks 推估」；其餘是 `expected`，網頁與 App 日曆顯示橘色「預期」。財報日曆列仍是 `confirmed`／「公司已公布」。事件推播與站長 events 工作摘要對 `expected` 加「（預期）」。
- `news-refresh`（E6）：App 下拉重新整理只有一個轉圈。

## How to get to it (user POV)

- 網頁：導覽列「新聞與日曆」→ `/news`（`/news?symbol=NVDA`）。
- App：底部分頁「新聞」，上方「新聞／日曆」切換；總覽「完整日曆 →」；事件推播點開。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態（`web-up.sh` 已跑過 `news` 與 `daily-reference` 排程）、測試帳號登入。

- **列表。** `goto("/news")`，等 `text=新聞與事件日曆`；`fetch("/api/v1/news")`，畫面第一筆＝`news.find(n => n.important).title`。截圖 `news-list.png`。
- **篩選。** 點代號篩選 `a.chip:text-is("NVDA")`（頁面上另有 `.mono` 的同名連結，`text=NVDA` 會對到多個），網址出現 `symbol=NVDA`；第一筆＝`fetch("/api/v1/news?symbol=NVDA")` 裡第一個 important 的，總則數＝該 API 的 `news.length`。截圖 `news-nvda.png`。
- **App 列表與篩選。** `ios-test.sh … VerifyInteractionTests/test05_NewsCalendar`：`E3-nvda.txt` 對 `?symbol=NVDA` 的 API、`E4-rapid.txt` 停在 TSLA。
- **App 日曆。** walkthrough 的 `05b-calendar.png`、`05c-calendar-day.png`；test05 的 `E5-day-label.txt`、`E5-day.png`／`.txt`（點的是 `ios-test.sh` 傳入的 `MO_EVENT_DATE`，檔案第一行記日期）、`E5-next-month.png`、`E5-today.png`。核對點的顏色與當天事件數＝API `events` 該日期的筆數。label 有兩種，要指名對的那個：月曆的日期格是「10/28（三），有總經事件，有財報」（逗號分隔），「接下來」列表的列是「10/28（三）、MSFT、Microsoft 財報、2 天後」（頓號分隔）；`label CONTAINS '10/28'` 會先對到「接下來」那列，test05 用「`M/D（` 開頭且不含 `、`」指名日期格。
- **預期財報日。** 先讀 `/api/v1/news`，找未來三週內 `kind="earnings"`、`status="expected"` 的事件；若沒有，只在本機 worktree D1 執行 `CREATE TABLE verify_saved_event AS SELECT * FROM events WHERE kind='earnings' AND date>=date('now') AND date<=date('now','+21 days') LIMIT 1; UPDATE events SET status='expected' WHERE id IN (SELECT id FROM verify_saved_event);`。暫存表已存在時先完成上一輪還原；沒有可用事件就回報缺資料。變更後 bump `settings.data_version`，重新載入並存 API JSON；網頁 `/news`「即將到來」、App「新聞 → 日曆」選到該日，核對同一列的橘色「預期」，截圖 `news-expected.png`、`calendar-expected.png`。沿用這筆事件驗 [總覽事件列](overview.md)；有建立暫存表時，成敗都執行 `UPDATE events SET status=(SELECT status FROM verify_saved_event WHERE verify_saved_event.id=events.id) WHERE id IN (SELECT id FROM verify_saved_event); DROP TABLE verify_saved_event;` 還原並再次 bump。iOS 全程使用全域模擬器鎖，沿用本輪已開的 MO 機；首次啟動或換機才依 [verify 的 Launch](../SKILL.md) 執行 `ios-up.sh <run-id> <機型>`。整輪驗證結束後才依 [verify 的 Cleanup](../SKILL.md) 執行 `down.sh <run-id>` 一次。
- **Proof。** `news-list.png`、`news-nvda.png`、API JSON、App 的 E3／E4／E5 截圖與 `.txt`。

- **語氣與篩選無障礙（App）。** `test15_DigestToneLabels` 一般與最大字級各檢查 `news-digest-<symbol>` 的文字與利多／利空 staticTexts，並確認選中篩選 chip 的 `isSelected`；截圖 `E9-tone-normal`／`E9-tone-largest`。本機需有 `latestTradeDate` 當天、依 `keys` 排序的前 3 家名單公司 positive/negative 重點，日期須落在 API 近三天的摘要範圍，缺資料測試明確失敗。
- **摘要資料日（L2-T5，App）。** 在本機用站長 `POST /api/admin/ai` 準備最新快照交易日 2 家、前一交易日另一家摘要；兩日都須在本機 `snapshots.trade_date` 存在，`newsIds` 使用本機 `news` 實際存在且 `published_at` 等於摘要日的新聞 ID，日期須落在 API 近三天的摘要範圍。讀 `/api/v1/news`，逐筆對照 `latestTradeDate` 與 `digests[].date`：「今日重點 · M/D（週）」只有最新日的 2 家；「較早的重點」初始收合，展開後只有前一日那家。每列（含單股篩選）有 `M/D（週）` 日期，最大字級不裁切，identifier 保持 `news-digest-<symbol>` 且 label 含利多／利空。另驗最新日沒有摘要時沒有今日段、全部在較早段；舊回應缺 `latestTradeDate` 時只有「公司重點」。留 `news-digest-dates-normal.png`／`news-digest-dates-largest.png`、展開較早段截圖及 API JSON；驗完還原本輪資料。
- **摘要匯入拒收（L2-T6）。** 本機站長送 `POST /api/admin/ai`：用存在的快照交易日搭配 `newsIds: ["nonexistent-source"]`，確認 `digests === 0`、`accepted` 為空，`rejected` 含 `digest:<key>:<date>` 與「來源新聞不存在或日期不符：nonexistent-source」；來源有異日新聞也拒收。日期格式合法卻沒有快照時回「日期不是交易日快照」。再驗同日有效來源可接受、大盤空 `newsIds` 可接受；讀 `/api/v1/news` 並看網頁與 App 新聞頁，拒收的摘要不能出現。保留請求、回執與讀回的 API JSON；成功案例驗完還原本輪資料。
- **摘要參考來源（L2-T8，網頁）。** 在本機用站長 `POST /api/admin/ai` 寫入同日真實新聞 ID 的公司摘要，再直接在本機 D1 準備含不存在 ID 的舊摘要（匯入 API 會拒收）。到 `/news` 展開每張摘要的參考來源，逐列核對標題、網址、出處、日期與 `/api/v1/news` 的 `digests[].sources`，順序相同；點來源標題開原文。缺來源卡顯示「另有 N 則來源已不在資料庫，無法列出」，N 等於 `sourcesMissing`；零來源卡顯示 0 則。核對頁首分別說明標題翻譯約每 4 小時、文章重點與每日摘要在美股交易日收盤後的台灣早上產生，以及 AI 可能出錯、以原文為準，全文沒有「已驗證」。320px 寬展開清單後不得水平溢出；留 `news-digest-sources.png`、`news-digest-sources-320.png` 與 API JSON，驗完還原本輪資料。
- **摘要參考來源（L2-T9，App）。** 沿用 L2-T8 的本機資料準備。全部代號時點 `news-digest-<symbol>`，確認下方出現 `news-digest-sources-<symbol>`，再次點摘要後來源收起；單股篩選預設可見來源。逐列對照 `/api/v1/news` 的 `digests[].sources` 標題、網址、順序、出處與日期，含沒有中文標題的英文來源；點一列確認 Safari 開啟該網址，回 App 後摘要仍展開。缺來源提示的 N 必須等於 `sourcesMissing`。保留 `news-digest-<symbol>` 的語氣 label，跑 `test15_DigestToneLabels` 與 `test16_Readability`；逐張查看一般／最大輔助字級及深色模式，來源標題、出處、日期與缺來源提示不裁切、不重疊。留 `news-digest-sources-ios-expanded.png`、收合與單股截圖、`news-digest-sources-ios-largest.png`、`news-digest-sources-ios-dark.png`、Safari 截圖與 API JSON；驗完還原本輪資料。

- App 一般及最大字級檢查新聞標題與事件列完整換行、摘要展開後可讀；大字月曆用「選擇日期」開啟原生 sheet，以單欄日期與事件標記選取，選完自動關閉並在原位置呈現當日事件。`test16_Readability` 檢查換月、回今天、選取事件日與關閉狀態；實看 `UI-<variant>-calendar-selected.png`，確認不用再捲過整月才能看到結果。
- 新聞詳情使用大型原生 sheet 閱讀；`test16_Readability` 點一則新聞、捲到「開啟原文」、關閉回列表。截圖 `UI-<variant>-news-detail*.png` 檢查標題、段落、來源與原文入口。
- 要驗長篇中文重點，可只在本機 D1 準備 `id=verify-ui-reading-news`、`source=verify` 的合成新聞，標題以「【排版驗證】」開頭、`points_zh` 放三段中文、`focus=NVDA`、`published_at` 設現在，讓它排在列表前面；截圖不能當成真實新聞。驗完刪掉這個 id，不能寫進正式站。

## Gotchas

- 本機沒有翻譯與 AI 重點（那是本機 Orca 排程寫進正式站的），標題是英文；要驗 AI 文字的呈現（例如 iOS 的「今天為什麼漲跌」展開）要用正式站一次性帳號，或用站長 `POST /api/admin/ai` 在本機寫一筆。摘要日期須有本機交易日快照，`newsIds` 須是本機實際存在、發布日相同的新聞。要驗「缺來源」的舊格式摘要，只能直接寫入本機 D1，API 會拒收；驗完還原，不能寫進正式站。
- FOMC、CPI、非農日期是 `src/lib/calendar.ts` 人工維護的靜態資料（聯準會與 BLS 官方日程頁抄入，BLS 頁面對 curl 回 403）；`events` 排程的摘要是「總經事件 N 筆（FOMC a、CPI b、非農 c）」；財報日來自 Nasdaq／Zacks，本機跑 `daily-reference` 當天抓到的才有。
- 網頁／Worker 與含 L3-T7 的 TestFlight 版本同時或稍晚上線；舊版 App 會把 `expected` 顯示成灰色英文，總覽則沒有徽章。若未同步上線，空窗從部署後第一次 `daily-reference`（UTC 11:30）的 events 工作改寫未來備援事件時開始；過去事件維持原值，整合回報須記錄空窗。
- 點新聞會開外部網頁；ego-browser 會出現 popup，驗完關掉那個 Page。
