# 新聞與日曆

名單公司與 SPY 的 Nasdaq 新聞（正式站有中文翻譯與 AI 重點），可以用代號篩選；日曆列出名單公司財報與總經事件（FOMC、CPI、非農），App 是月曆加當日事件列表。

## Sub-features

- `news-digest-tone`（E9）：公司每日重點在公司名稱旁顯示「利多／利空／中性」，色條不朗讀；新聞篩選 chip 選中時帶 isSelected trait。

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
- **預期財報日。** 先讀 `/api/v1/news`，找未來三週內 `kind="earnings"`、`status="expected"` 的事件；若沒有，只在本機 worktree D1 執行 `CREATE TABLE verify_saved_event AS SELECT * FROM events WHERE kind='earnings' AND date>=date('now') AND date<=date('now','+21 days') LIMIT 1; UPDATE events SET status='expected' WHERE id IN (SELECT id FROM verify_saved_event);`。暫存表已存在時先完成上一輪還原；沒有可用事件就回報缺資料。變更後 bump `settings.data_version`，重新載入並存 API JSON；網頁 `/news`「即將到來」、App「新聞 → 日曆」選到該日，核對同一列的橘色「預期」，截圖 `news-expected.png`、`calendar-expected.png`。沿用這筆事件驗 [總覽事件列](overview.md)；有建立暫存表時，成敗都執行 `UPDATE events SET status=(SELECT status FROM verify_saved_event WHERE verify_saved_event.id=events.id) WHERE id IN (SELECT id FROM verify_saved_event); DROP TABLE verify_saved_event;` 還原並再次 bump。iOS 全程使用全域模擬器鎖，L7-T1 合併前依 AGENTS.md 手動寫 `sim.udid`，不跑 `ios-up.sh`／`down.sh`。
- **Proof。** `news-list.png`、`news-nvda.png`、API JSON、App 的 E3／E4／E5 截圖與 `.txt`。

- **語氣與篩選無障礙（App）。** `test15_DigestToneLabels` 一般與最大字級各檢查 `news-digest-<symbol>` 的文字與利多／利空 staticTexts，並確認選中篩選 chip 的 `isSelected`；截圖 `E9-tone-normal`／`E9-tone-largest`。本機需有近三天、前幾家名單公司 positive/negative 重點，缺資料測試明確失敗。

- App 一般及最大字級檢查新聞標題與事件列完整換行、摘要展開後可讀；大字月曆用「選擇日期」開啟原生 sheet，以單欄日期與事件標記選取，選完自動關閉並在原位置呈現當日事件。`test16_Readability` 檢查換月、回今天、選取事件日與關閉狀態；實看 `UI-<variant>-calendar-selected.png`，確認不用再捲過整月才能看到結果。
- 新聞詳情使用大型原生 sheet 閱讀；`test16_Readability` 點一則新聞、捲到「開啟原文」、關閉回列表。截圖 `UI-<variant>-news-detail*.png` 檢查標題、段落、來源與原文入口。
- 要驗長篇中文重點，可只在本機 D1 準備 `id=verify-ui-reading-news`、`source=verify` 的合成新聞，標題以「【排版驗證】」開頭、`points_zh` 放三段中文、`focus=NVDA`、`published_at` 設現在，讓它排在列表前面；截圖不能當成真實新聞。驗完刪掉這個 id，不能寫進正式站。

## Gotchas

- 本機沒有翻譯與 AI 重點（那是本機 Orca 排程寫進正式站的），標題是英文；要驗 AI 文字的呈現（例如 iOS 的「今天為什麼漲跌」展開）要用正式站一次性帳號，或用站長 `POST /api/admin/ai` 在本機寫一筆。
- FOMC、CPI、非農日期是 `src/lib/calendar.ts` 人工維護的靜態資料（聯準會與 BLS 官方日程頁抄入，BLS 頁面對 curl 回 403）；`events` 排程的摘要是「總經事件 N 筆（FOMC a、CPI b、非農 c）」；財報日來自 Nasdaq／Zacks，本機跑 `daily-reference` 當天抓到的才有。
- 網頁／Worker 與含 L3-T7 的 TestFlight 版本同時或稍晚上線；舊版 App 會把 `expected` 顯示成灰色英文，總覽則沒有徽章。若未同步上線，空窗從部署後第一次 `daily-reference`（UTC 11:30）的 events 工作改寫未來備援事件時開始；過去事件維持原值，整合回報須記錄空窗。
- 點新聞會開外部網頁；ego-browser 會出現 popup，驗完關掉那個 Page。
