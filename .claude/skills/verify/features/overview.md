# 總覽

登入後的首頁：最新交易日的 S&P 500 收盤、VIX、等權重對照、名單合計貢獻、下月展望摘要、近一週到近一年報酬、距 52 週高、收盤 vs 均線，以及名單每家公司對指數的貢獻點數（名單合計＋其他成分股（含近似誤差）＝指數漲跌）。可以切到更早的交易日。

## Sub-features

- `overview-title`（B1）：標題「S&P 500 收盤 YYYY-MM-DD（週X）」（網頁）／「S&P 500 M/D（週X）」（App），日期＝API `snapshot.tradeDate`。
- `overview-kpi`（B2）：KPI 卡片等於 API `snapshot.data`；App 的「市場指標」是可展開的按鈕（label 以「市場指標」開頭，value「已收合／已展開」），預設收起只顯示 VIX、距高、200 日線一行，展開後全部。只有 `index.check.status` 為 mismatch 才出現「來源不一致」。
- `overview-attribution`（B3）：名單每家的收盤、漲跌 %、權重、貢獻點數＝API；順序同 API `mag7`；「其他成分股 N 檔（推算）」列存在（App 列標題「其他成分股」、副標「N 檔（推算）」）；說明句寫「其他成分股（含近似誤差）＝指數漲跌減掉名單合計（權重與價格口徑不同造成的誤差也算在這裡）。」（「近似誤差」只出現一次）（網頁在表格上方；App 在表格下方的「說明」展開區）；名單合計＋其他成分股＝指數漲跌點數（差 ≤ 0.02）。
- `overview-symbol-link`（B4）：點公司 → 走勢頁、標的是那家。
- `overview-date`（B5）：選其他交易日 → 標題與數字換成 `?date=` 的值；能回到最新。
- `overview-events`（B7、B8）：未來三週事件只列名單公司財報與總經事件（FOMC、CPI、非農），由近到遠；「完整日曆 →」到新聞的日曆。
- `overview-digest-tone`（B12）：市場重點標題列有「利多／利空／中性」文字，VoiceOver 會讀到，裝飾色條不朗讀。一般與最大字級標籤均可見；無障礙字級的「今天為什麼漲跌」完整換行、語氣標籤另起一行，標題不能以省略號截斷。
- `overview-quality`：即使 quality.notes 為空，missing 或 pendingChecks 仍顯示「缺少」「待核對」；App missing 非空時在指數卡同一區段上方顯示精簡提示（`overview-missing-warning`），灰字搭配橘色圖示，文字完整換行；無警示時指數卡版面不變。下月展望的 up 紅色、down 綠色，摘要統一寫「上漲機率」。
- `overview-refresh`（B10）：App 下拉重新整理保留完整亮度與工具列；只有使用者從交易日清單切換日期時內容變暗、工具列改成轉圈。推播導向與回前景重新整理也保留完整亮度及日期／名單按鈕。
- `overview-foreground`（B11）：看最新日期時，距上次成功載入超過 10 分鐘，回前景重抓，畫面不變暗、工具列不被轉圈取代；看歷史日期時不自動切回最新。
- `overview-stale`：看最新（沒有 `?date=`）且 `snapshot.tradeDate` < API `expectedClose` 時，網頁與 App 頂端出現「最新快照是 …，但 … 應該已收盤」橘色警告。`expectedClose` 是抓價排程（週一到週五 UTC 21:40）加 30 分緩衝跑完後才換成當天，收盤後到 UTC 22:10 之間不警告；資料來源頁的「落後」標記用同一個日期。

## How to get to it (user POV)

- 網頁：`/`，或導覽列「市場總覽」、左上「市場觀測室」；手機寬度的底部分頁「總覽」。其他交易日用右上「查看其他交易日」的 `select`（選項值 `YYYY-MM-DD`，選了跳 `/?date=YYYY-MM-DD`）。
- App：底部分頁「總覽」；右上「其他交易日」按鈕開 sheet（導覽列標題「交易日」，每列 label 是日期如 `2026-10-22`，另有「回到最新」「完成」）；星號開名單。公司列的 label 含收盤、點數、%、權重，例如「NVDA、NVIDIA · 收盤 210.96、−3.51 點、−0.59%、權重 7.78%」，用 `label BEGINSWITH 'NVDA、'` 指名。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、測試帳號已登入、名單是七巨頭（或你剛加了什麼就照實核對）。

- **讀 API。** `page.fetch("/api/v1/overview")`，記下 `snapshot.tradeDate`、`snapshot.data` 的 index、vix、rsp、名單合計與 `mag7`。
- **標題與 KPI。** `goto("/")`，等 `text=S&P 500 收盤`。`evaluate` 讀 `h1` 與卡片文字，跟 API 比（B1、B2）。截圖 `overview-kpi.png`。
- **名單拆解。** 在「觀察名單，拆開來看」表格用 `evaluate` 讀每列的儲存格，逐欄比 API `snapshot.data.mag7`、`rest`、`index`（實測 54 項全對）（B3）；每列的貢獻點數加總＋「其他成分股」列＝最下面 S&P 500 列的點數。
- **其他交易日。** `page.selectOption("select", { index: 1 })`（「查看其他交易日」的第二天；也可直接給選項值 `"2026-10-22"`），等網址出現 `?date=`、`h1` 換日期；`fetch("/api/v1/overview?date=<那天>")` 比數字；再選回第一項，標題回到最新（B5）。
- **公司連結。** 點 `loc=href:/history?symbol=NVDA`（`text=NVIDIA` 也會對到新聞標題），網址變 `/history?symbol=NVDA`（B4）。
- **App。** walkthrough 的 `02-overview.png`、`02b-overview-attribution.png`、`02c-overview-events.png`；`ios-test.sh … VerifyInteractionTests/test02_Overview` 的 `B2-before.txt`（value＝已收合）、`B2-kpi-expanded.png`／`.txt`（已展開，全部指標的數字對 API）、`B5-dates.txt`（test 從交易日清單讀到的最新與第二新的一天）、`B5-older.png`／`.txt`（第二新那天的數字對 `?date=<那天>`）、`B5-latest.png`、`B4-nvda-history.png`、`B8-calendar.png`。逐張看數字與 API 一致、顏色紅漲綠跌、沒有被切掉的字；確認首屏收盤與期間報酬、名單貢獻列及下月展望的數字層級清楚，標籤與數值在一般及最大字級均不互相擠壓，`B2-kpi-expanded.png` 要真的看到展開的指標。
- **品質與判讀（網頁）。** 在本機 D1 準備 notes=[]、pendingChecks 非空的快照並 bump data_version，重新載入總覽應顯示「待核對」；再測 missing 非空時頁首的缺資料警告。對照 API quality 陣列並截圖。
- **頁首提示（App）。** 只在驗證 worktree 備份最新快照後，把 `data.quality.missing` 設為 `["VIX"]` 並 bump `data_version`。`test21_ReadabilityPolish` 在兩台指定 MO 模擬器的一般字級淺色／最大字級深色拍 `polish-<variant>-overview-warning.png`；提示須可見，與 S&P 500 卡之間只有正常列間距。測完還原快照並 bump 版本，另拍無警示畫面，確認原本指數卡位置不變。
- **下拉與回前景（App）。** walkthrough 下拉期間截圖確認內容沒有半透明、日期與名單按鈕保留。`test14_ForegroundLoadsNewTradingDay` 用 DEBUG launch argument `-verifyOverviewRefreshInterval 0` 避免等 10 分鐘；本機站初始須停在上一交易日，測試寫出 `B11-ready.txt` 後，在這個 worktree 的 `web/` 用站長登入跑 `MO_URL=<BASE> MO_EMAIL=<owner> MO_PASSWORD=<從 owner.pw 讀入> node scripts/backfill.ts --sessions 60`。必須有真正更新的收盤可回補；測試以獨立 API 讀到更新日期後才回前景，最多等 120 秒，日期未增加會明確失敗。證據 `B11-background`／`B11-foreground-updated` 與日期文字。
- **重點語氣（App）。** `test15_DigestToneLabels` 一般與最大字級檢查 `market-digest` 卡片含「利多」或「利空」，截圖 `B12-tone-normal`／`B12-tone-largest`；最大字級的畫面必須完整看得到「今天為什麼漲跌」，不能只靠 AX label（SwiftUI 截斷時 AX 仍會回傳全文），以畫面 OCR 與實看截圖確認。先在本機 news_digests 準備當日 SPX 的 positive/negative 重點，缺資料明確失敗。
- **Proof。** `overview-kpi.png`、`overview.api.json`、`overview-date.png`；App 的 walkthrough 三張與 test02 的截圖、`.txt`。

## Gotchas

- 本機的快照只有回補的 60 個交易日，下拉選單只列這 60 天。
- 「資料 … 產出」的時間是快照建立時間，不是收盤時間。
- 下月展望卡片以「下跌風險」與「上漲機率」分組，數字、平常值與驗證狀態分行，先列 dd5（「21 個交易日內至少一天比資料日收盤低 5% 以上的機率」，網頁用 `dd5ShortLabel`、App 用 `Copy.dd5ShortLabel`，`forecast.drawdown.p`；API 沒有 `drawdown` 時只有上漲機率），再列上漲機率。「偵測不到預測力」標籤屬於上漲機率那格，是展望模型的狀態（對應 API 的 `call: "inconclusive"`），此時下方另有小字「尚未偵測到增額預測力」；介面不再出現英文 skill。
- 要看到 `overview-stale` 的警告：本機回補會抓到最新收盤，先在 `web/` 用 `npx void db execute "DELETE FROM snapshots WHERE trade_date = '<最新>'"` 刪掉最新快照，並改 `settings` 的 `data_version` 讓頁面快取失效；UTC 22:10 前後各看一次（前不警告、後警告）。
- 名單剛改過時，總覽會用新名單重算最近 45 個交易日；更早的日子保留舊名單，切到很早的日期看到舊名單是正常的。
