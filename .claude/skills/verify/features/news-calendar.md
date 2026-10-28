# 新聞與日曆

名單公司與 SPY 的 Nasdaq 新聞（正式站有中文翻譯與 AI 重點），可以用代號篩選；日曆列出名單公司財報與總經事件（FOMC、CPI、非農），App 是月曆加當日事件列表。

## Sub-features

- `news-digest-tone`（E9）：公司每日重點在公司名稱旁顯示「利多／利空／中性」，色條不朗讀；新聞篩選 chip 選中時帶 isSelected trait。
- `news-digest-dates`（L2-T5）：App 每列公司重點顯示資料日。全部代號時，「今日重點 · M/D（週）」只列 `/api/v1/news.latestTradeDate` 當天的摘要，前 3 家直接顯示，其餘收在「其餘 N 家」；其他日期收在預設收合的「較早的重點」。後端沒給 `latestTradeDate` 時，全部改列單一「公司重點」中性段落；單股段落保留原結構並顯示日期。

- `news-list`（E1）：標題、來源、時間。網頁與 App 都把 `important: true` 的新聞排前面，其餘收在「其他 N 則」：第一筆＝API `/api/v1/news` 的 `news` 裡**第一個 `important` 為 true** 的 `title`（不是 `news[0]`）。
- `news-open`（E2）：點新聞開原文，回來時列表位置合理。
- `news-filter`（E3、E4）：代號篩選只剩該代號新聞；總則數（重要＋「其他 N 則」）＝`?symbol=` 的 API `news` 筆數，第一筆同 E1 規則；快速連點停在最後一個。
- `calendar-month`（E5）：App 月曆週日開頭、今天有外圈；有事件的日子有點（總經紅點：FOMC／CPI／非農；財報藍點）與圖例；點某天列出當天事件；換月、回「今天」；「接下來」列表點一列選到那天。
- `calendar-web`：網頁 `/news` 的「即將到來」事件列表；總經事件有 FOMC、CPI（如 11/10「CPI 消費者物價指數（2026 年 10 月）」）與非農（如 11/6「非農就業報告（2026 年 10 月）」）。
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
- **Proof。** `news-list.png`、`news-nvda.png`、API JSON、App 的 E3／E4／E5 截圖與 `.txt`。

- **語氣與篩選無障礙（App）。** `test15_DigestToneLabels` 一般與最大字級各檢查 `news-digest-<symbol>` 的文字與利多／利空 staticTexts，並確認選中篩選 chip 的 `isSelected`；截圖 `E9-tone-normal`／`E9-tone-largest`。本機需有 `latestTradeDate` 當天、依 `keys` 排序的前 3 家名單公司 positive/negative 重點，缺資料測試明確失敗。
- **摘要資料日（L2-T5，App）。** 在本機用站長 `POST /api/admin/ai` 準備最新快照交易日 2 家、前一交易日另一家摘要，日期須落在 API 近三天的摘要範圍。讀 `/api/v1/news`，逐筆對照 `latestTradeDate` 與 `digests[].date`：「今日重點 · M/D（週）」只有最新日的 2 家；「較早的重點」初始收合，展開後只有前一日那家。每列（含單股篩選）有 `M/D（週）` 日期，最大字級不裁切，identifier 保持 `news-digest-<symbol>` 且 label 含利多／利空。另驗最新日沒有摘要時沒有今日段、全部在較早段；舊回應缺 `latestTradeDate` 時只有「公司重點」。留 `news-digest-dates-normal.png`／`news-digest-dates-largest.png`、展開較早段截圖及 API JSON；驗完還原本輪資料。

- App 一般及最大字級檢查新聞標題與事件列完整換行、摘要展開後可讀；大字月曆用「選擇日期」開啟原生 sheet，以單欄日期與事件標記選取，選完自動關閉並在原位置呈現當日事件。`test16_Readability` 檢查換月、回今天、選取事件日與關閉狀態；實看 `UI-<variant>-calendar-selected.png`，確認不用再捲過整月才能看到結果。
- 新聞詳情使用大型原生 sheet 閱讀；`test16_Readability` 點一則新聞、捲到「開啟原文」、關閉回列表。截圖 `UI-<variant>-news-detail*.png` 檢查標題、段落、來源與原文入口。
- 要驗長篇中文重點，可只在本機 D1 準備 `id=verify-ui-reading-news`、`source=verify` 的合成新聞，標題以「【排版驗證】」開頭、`points_zh` 放三段中文、`focus=NVDA`、`published_at` 設現在，讓它排在列表前面；截圖不能當成真實新聞。驗完刪掉這個 id，不能寫進正式站。

## Gotchas

- 本機沒有翻譯與 AI 重點（那是本機 Orca 排程寫進正式站的），標題是英文；要驗 AI 文字的呈現（例如 iOS 的「今天為什麼漲跌」展開）要用正式站一次性帳號，或用站長 `POST /api/admin/ai` 在本機寫一筆。
- FOMC、CPI、非農日期是 `src/lib/calendar.ts` 人工維護的靜態資料（聯準會與 BLS 官方日程頁抄入，BLS 頁面對 curl 回 403）；`events` 排程的摘要是「總經事件 N 筆（FOMC a、CPI b、非農 c）」；財報日來自 Nasdaq／Zacks，本機跑 `daily-reference` 當天抓到的才有。
- 點新聞會開外部網頁；ego-browser 會出現 popup，驗完關掉那個 Page。
