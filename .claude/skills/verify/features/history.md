# 走勢與均線

選一個標的（S&P 500、名單公司、RSP）看收盤與 SMA20／60／200、區間報酬與最大回撤（App 另顯示交易日數）；下面有名單 vs S&P 500 的相對報酬（起點 0%）、區間統計表、近 40 個交易日的指數漲跌拆解（名單 vs 其他成分股（含近似誤差）；圖例寫短名「其他成分股」，全名在說明句）。

## Sub-features

- `history-main`（C1）：預設 1 年；四條線都在圖框內；日期範圍＝`mainStats.first`～`last`、區間報酬＝`ret`、最大回撤（App 寫「最大回檔」）＝`mdd`；App 另有交易日＝`points`，網頁沒有顯示交易日數。
- `history-range`（C2、C3）：切 1 個月／3 個月／6 個月／1 年／3 年／5 年，數字＝`months=1/3/6/12/36/60`；快速連點時停在最後一個。
- `history-symbol`（C4、C6）：標的選單或區間統計表的列切換標的。
- `history-compare`（C5）：相對報酬每條線顏色不同、圖例對得上；各標的以區間內第一個交易日收盤為 0%，主標的區間報酬、統計列與圖終值同一起點。圖下說明「每條線以區間第一個交易日收盤為 0%，與下表「區間報酬」同一起點」。統計列 `first` 與 SPX 不同時，網頁報酬旁標「自 YYYY-MM-DD」、App 副標加「自 M/D」；缺 SPX 終點日收盤時，區間報酬仍為 null。
- `history-contribution`（C7）：近 40 日貢獻柱狀圖，最新一天名單貢獻＝API `contribution` 最後一筆 `mag7`。

## How to get to it (user POV)

- 網頁：導覽列「走勢與均線」→ `/history`；`/history?symbol=NVDA&months=6`；總覽或名單點公司名稱。
- App：底部分頁「走勢」，右上標的選單（按鈕 label「標的：S&P 500」，選項 label「S&P 500（SPX）」「NVIDIA（NVDA）」…）；區間是 SegmentedControl 的按鈕「1 個月」…「5 年」；總覽或名單點公司列。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、測試帳號登入。

- **主圖。** `goto("/history")`，等 `text=走勢與均線`。`fetch("/api/v1/history?symbol=SPX&months=12")` 比 `mainStats`。截圖 `history-main.png`，用眼睛看四條線與圖例。
- **區間。** 區間按鈕是 `a.chip`（文字「1 個月」「1 年」…），點 `a.chip:text-is("6 個月")`，等網址出現 `months=6` 與統計數字更新，再比 `months=6` 的 API。
- **標的。** `selectOption("select", "NVDA")`，網址出現 `symbol=NVDA`，比 `symbol=NVDA` 的 API。
- **共同起點。** `/history?symbol=SPX&months=12` 的區間報酬＝統計表 SPX 列＝`rebased` 的 SPX 末點（容許顯示位數四捨五入）；對帳 `/api/v1/history?symbol=SPX&months=12` 的 `mainStats.ret`、`stats[].ret`、`stats[].first` 與 `rebased` 末點。App 同樣比「區間報酬」與「區間統計」S&P 500 列，兩端圖下都要有起點說明；有晚上市標的時，核對該列「自 …」與 `stats[].first`。
- **App。** walkthrough 的 `03-history.png`、`03b-history-compare.png`、`03c-history-contribution.png`；`ios-test.sh … VerifyInteractionTests/test03_History` 的 `C2-ranges.txt`（每個區間的報酬、回檔、交易日對 `months=` 的 API）、`C3-rapid.png`、`C4-nvda.png`／`.txt`、`C6-aapl.png`。
- **Proof。** `history-main.png`、`history-nvda.png`、對應 API JSON、App 的 walkthrough 三張與 test03 的截圖、`.txt`。

- App 大字級檢查區間統計、報酬及回檔文字完整換行；圖表與圖例仍可辨識。

## Gotchas

- 圖是 canvas（TradingView Lightweight Charts），DOM 裡沒有線，只能用截圖判斷，數字用統計卡片比。
- 本機只回補了 60 天快照：近 40 日貢獻圖有資料；更早日子的名單貢獻沒有（價格有十年）。
- App 的區間標籤要讀成「1 個月」而不是「1 月」（C2 曾經的 fail）。
- 本機沒有晚上市名單公司時，「自 …」僅能以 `history-anchor.test.ts` 的首筆日期／報酬測試確認資料，回報須註明未在畫面上看到；該測試也涵蓋區間起點落在週六的情境。`analytics.test.ts` 另驗空區間、缺終點與只有終點一筆皆回 null。
