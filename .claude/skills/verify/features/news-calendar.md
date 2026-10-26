# 新聞與日曆

名單公司與 SPY 的 Nasdaq 新聞（正式站有中文翻譯與 AI 重點），可以用代號篩選；日曆列出名單公司財報與 FOMC，App 是月曆加當日事件列表。

## Sub-features

- `news-list`（E1）：標題、來源、時間；第一筆＝API `/api/v1/news` 的 `news[0].title`。
- `news-open`（E2）：點新聞開原文，回來時列表位置合理。
- `news-filter`（E3、E4）：代號篩選只剩該代號新聞＝`?symbol=` 的 API；快速連點停在最後一個。
- `calendar-month`（E5）：App 月曆週日開頭、今天有外圈；有事件的日子有點（FOMC 紅點、財報藍點）與圖例；點某天列出當天事件；換月、回「今天」；「接下來」列表點一列選到那天。
- `calendar-web`：網頁 `/news` 的「即將到來」事件列表。
- `news-refresh`（E6）：App 下拉重新整理只有一個轉圈。

## How to get to it (user POV)

- 網頁：導覽列「新聞與日曆」→ `/news`（`/news?symbol=NVDA`）。
- App：底部分頁「新聞」，上方「新聞／日曆」切換；總覽「完整日曆 →」；事件推播點開。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態（`web-up.sh` 已跑過 `news` 與 `daily-reference` 排程）、測試帳號登入。

- **列表。** `goto("/news")`，等 `text=新聞與事件日曆`；`fetch("/api/v1/news")` 的 `news[0].title` 出現在畫面上。截圖 `news-list.png`。
- **篩選。** 點代號按鈕「NVDA」（`text="NVDA"` 精確比對），網址出現 `symbol=NVDA`，畫面第一筆＝`fetch("/api/v1/news?symbol=NVDA")` 的第一筆。
- **App 日曆。** walkthrough 的 `05-news.png`、`05b-calendar.png`、`05c-calendar-day.png`（點了第一個有 FOMC 的日子）；核對點的顏色與當天事件數＝API `events` 該日期的筆數。
- **Proof。** `news-list.png`、`news-nvda.png`、API JSON、App 三張截圖。

## Gotchas

- 本機沒有翻譯與 AI 重點（那是本機 Orca 排程寫進正式站的），標題是英文；要驗 AI 文字的呈現（例如 iOS 的「今天為什麼漲跌」展開）要用正式站一次性帳號，或用站長 `POST /api/admin/ai` 在本機寫一筆。
- FOMC 日期是 `src/lib/calendar.ts` 人工維護的；財報日來自 Nasdaq／Zacks，本機跑 `daily-reference` 當天抓到的才有。
- 點新聞會開外部網頁；ego-browser 會出現 popup，驗完關掉那個 Page。
