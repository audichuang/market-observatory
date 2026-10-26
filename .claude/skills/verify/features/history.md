# 走勢與均線

選一個標的（S&P 500、名單公司、RSP）看收盤與 SMA20／60／200、區間報酬、最大回檔、交易日數；下面有名單 vs S&P 500 的相對報酬（起點 0%）、區間統計表、近 40 個交易日的指數漲跌拆解（名單 vs 其餘）。

## Sub-features

- `history-main`（C1）：預設 1 年；四條線都在圖框內；日期範圍＝API `mainStats.first`～`last`；區間報酬、最大回檔、交易日＝`mainStats.ret`、`mdd`、`points`。
- `history-range`（C2、C3）：切 1 個月／3 個月／6 個月／1 年／3 年／5 年，數字＝`months=1/3/6/12/36/60`；快速連點時停在最後一個。
- `history-symbol`（C4、C6）：標的選單或區間統計表的列切換標的。
- `history-compare`（C5）：相對報酬每條線顏色不同、圖例對得上、起點 0%。
- `history-contribution`（C7）：近 40 日貢獻柱狀圖，最新一天名單貢獻＝API `contribution` 最後一筆 `mag7`。

## How to get to it (user POV)

- 網頁：導覽列「走勢與均線」→ `/history`；`/history?symbol=NVDA&months=6`；總覽或名單點公司名稱。
- App：底部分頁「走勢」，右上標的選單；總覽或名單點公司列。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、測試帳號登入。

- **主圖。** `goto("/history")`，等 `text=走勢與均線`。`fetch("/api/v1/history?symbol=SPX&months=12")` 比 `mainStats`。截圖 `history-main.png`，用眼睛看四條線與圖例。
- **區間。** 點區間按鈕（畫面文字「6 個月」等），等網址或統計數字更新，比 `months=6` 的 API。
- **標的。** `selectOption("select", "NVDA")`，網址出現 `symbol=NVDA`，比 `symbol=NVDA` 的 API。
- **App。** walkthrough 的 `03-history.png`、`03b-history-compare.png`、`03c-history-contribution.png`。
- **Proof。** `history-main.png`、`history-nvda.png`、對應 API JSON、App 三張截圖。

## Gotchas

- 圖是 canvas（TradingView Lightweight Charts），DOM 裡沒有線，只能用截圖判斷，數字用統計卡片比。
- 本機只回補了 60 天快照：近 40 日貢獻圖有資料；更早日子的名單貢獻沒有（價格有十年）。
- App 的區間標籤要讀成「1 個月」而不是「1 月」（C2 曾經的 fail）。
