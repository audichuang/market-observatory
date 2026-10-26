# 總覽

登入後的首頁：最新交易日的 S&P 500 收盤、VIX、等權重對照、名單合計貢獻、下月展望摘要、近一週到近一年報酬、距 52 週高、收盤 vs 均線，以及名單每家公司對指數的貢獻點數（名單合計＋其餘＝指數漲跌）。可以切到更早的交易日。

## Sub-features

- `overview-title`（B1）：標題「S&P 500 收盤 YYYY-MM-DD（週X）」（網頁）／「S&P 500 M/D（週X）」（App），日期＝API `snapshot.tradeDate`。
- `overview-kpi`（B2）：KPI 卡片等於 API `snapshot.data`；App 的「市場指標」預設收起只顯示 VIX、距高、200 日線一行，展開後全部。只有 `index.check.status` 為 mismatch 才出現「來源不一致」。
- `overview-attribution`（B3）：名單每家的收盤、漲跌 %、權重、貢獻點數＝API；順序同 API `mag7`；「其餘 N 檔（推算）」列存在；名單合計＋其餘＝指數漲跌點數（差 ≤ 0.02）。
- `overview-symbol-link`（B4）：點公司 → 走勢頁、標的是那家。
- `overview-date`（B5）：選其他交易日 → 標題與數字換成 `?date=` 的值；能回到最新。
- `overview-events`（B7、B8）：未來三週事件只列名單公司財報與 FOMC，由近到遠；「完整日曆 →」到新聞的日曆。
- `overview-refresh`（B10）：App 下拉重新整理。

## How to get to it (user POV)

- 網頁：`/`，或導覽列「市場總覽」、左上「市場觀測室」；手機寬度的底部分頁「總覽」。其他交易日用右上「查看其他交易日」下拉（`/?date=YYYY-MM-DD`）。
- App：底部分頁「總覽」；右上日曆圖示選交易日、星號開名單。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、測試帳號已登入、名單是七巨頭（或你剛加了什麼就照實核對）。

- **讀 API。** `page.fetch("/api/v1/overview")`，記下 `snapshot.tradeDate`、`snapshot.data` 的 index、vix、rsp、名單合計與 `mag7`。
- **標題與 KPI。** `goto("/")`，等 `text=S&P 500 收盤`。`evaluate` 讀 `h1` 與卡片文字，跟 API 比（B1、B2）。截圖 `overview-kpi.png`。
- **名單拆解。** 在「觀察名單，拆開來看」表格逐列核對（B3）：每列的貢獻點數加總＋「其餘」列＝最下面 S&P 500 列的點數。
- **其他交易日。** `page.selectOption("select", { index: 1 })`（「查看其他交易日」下拉的第二天），等網址出現 `?date=`、`h1` 換日期；`fetch("/api/v1/overview?date=<那天>")` 比數字；再選回第一項，標題回到最新（B5）。
- **公司連結。** 點表格裡的「NVIDIA」，網址變 `/history?symbol=NVDA`（B4）。
- **App。** walkthrough 的 `02-overview.png`、`02b-overview-attribution.png`、`02c-overview-events.png`；逐張看數字與 API 一致、顏色紅漲綠跌、沒有被切掉的字。
- **Proof。** `overview-kpi.png`、`overview.api.json`、`overview-date.png`；App 三張截圖。

## Gotchas

- 本機的快照只有回補的 60 個交易日，下拉選單只列這 60 天。
- 「資料 … 產出」的時間是快照建立時間，不是收盤時間。
- 下月展望卡片的「偵測不到 skill」標籤是展望模型的狀態（樣本外沒有預測力），文字含英文 skill——若要判語言 fail，要先確認是不是刻意保留的術語（同 BSS）。
- 名單剛改過時，總覽會用新名單重算最近 45 個交易日；更早的日子保留舊名單，切到很早的日期看到舊名單是正常的。
