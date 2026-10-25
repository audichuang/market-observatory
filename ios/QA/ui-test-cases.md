# 市場觀測室 iOS App：實機 UI 測案

在 iOS 27.1 模擬器上親手操作 App，逐項判定 **pass／fail／not-run**。每一項都寫了「正確」的定義；看不到的就不能判 pass。

## 環境

- 模擬器：`MO Codex QA`（UDID 寫在 `/tmp/mo-codex-udid`），iOS 27.1、iPhone Duo。用 Xcode 27 的 **DeviceHub**（`/Applications/Xcode.app/Contents/Applications/DeviceHub.app`）顯示畫面與操作；這台機器沒有舊的 Simulator.app。
- App：`com.audichuang.observatory`，已安裝的是 Debug 版、沒有簽章，連正式後端 `https://market-observatory.kzfvvwnwhp.workers.dev`。
- 輔助指令（終端機）：
  - 截圖：`xcrun simctl io <UDID> screenshot --display=1 <路徑>`（失敗就拿掉 `--display=1`），存到 `/tmp/mo-codex-qa/`，檔名用測案編號（例如 `B2.png`）。
  - 重新啟動 App：`xcrun simctl terminate <UDID> com.audichuang.observatory && xcrun simctl launch <UDID> com.audichuang.observatory`
  - 推播：`xcrun simctl push <UDID> com.audichuang.observatory <payload.json>`
  - 字級與外觀：`xcrun simctl ui <UDID> content_size <大小>`、`xcrun simctl ui <UDID> appearance dark|light`
- **核對資料用的 API**（用同一個測試帳號登入後比對畫面上的數字）：

  ```sh
  B=https://market-observatory.kzfvvwnwhp.workers.dev
  curl -s -c /tmp/mo-qa-cj -H "Origin: $B" -H 'content-type: application/json' \
    -X POST $B/api/auth/sign-in/email -d '{"email":"<測試帳號>","password":"<密碼>"}'
  curl -s -b /tmp/mo-qa-cj "$B/api/v1/overview"          # 總覽（?date=YYYY-MM-DD 看其他交易日）
  curl -s -b /tmp/mo-qa-cj "$B/api/v1/history?symbol=SPX&months=12"
  curl -s -b /tmp/mo-qa-cj "$B/api/v1/watchlist"
  curl -s -b /tmp/mo-qa-cj "$B/api/v1/news"               # ?symbol=NVDA
  curl -s -b /tmp/mo-qa-cj "$B/api/v1/etfs"               # ?etf=VOO&years=3&monthly=10000
  curl -s -b /tmp/mo-qa-cj "$B/api/v1/outlook"
  curl -s -b /tmp/mo-qa-cj "$B/api/v1/push"
  ```

## 全域的「正確」定義

- **語言**：介面是繁體中文（台灣用語）。代號（NVDA）、ETF 英文名、單位與術語（SMA20、VIX、YTD、1Y、AUM、EPS、Brier、BSS、FOMC）可以是英文，其他英文字串都算 fail。
- **顏色**：台灣慣例，**紅色＝上漲／正值、綠色＝下跌／負值**，0 或無資料是灰色。顏色反了就是 fail。
- **數字**：畫面上的數字跟 API JSON 一致，只允許四捨五入的差（顯示到幾位就比到幾位）。正負號要對，負號用「−」或「-」都可以。
- **版面**：文字不能互相重疊、不能被裁掉一半；不能出現「…」截斷關鍵數字。長句可以換行。
- **反應**：每個操作 15 秒內要有可見的結果。載入中要有轉圈或淡化之類的提示，不能看起來像沒反應。
- **穩定**：整輪不能閃退。每一類測完都要確認 App 還在前景、可以操作。

---

## A. 啟動、註冊、登入

| 編號 | 步驟 | 正確 |
| --- | --- | --- |
| A1 | 啟動 App（第一次、未登入） | 登入畫面：標題「市場觀測室」、有「使用 Apple 登入」按鈕、Email／密碼欄位、可切換「建立帳號」，底部有「個人研究用途，非投資建議。」 |
| A2 | 切到建立帳號，輸入測試 email、密碼 `short`（少於 8 字），送出 | 顯示中文錯誤（密碼太短之類）、留在登入畫面、不閃退 |
| A3 | 用測試 email 與正確密碼建立帳號 | 15 秒內進入主畫面「總覽」分頁；跳出系統通知權限詢問（允許）。下方或側邊有 5 個分頁：總覽、走勢、名單、新聞、更多 |
| A4 | 結束 App 再啟動 | 直接進總覽，不用重新登入 |
| A5 | （G 類之後）登出，用錯誤密碼登入 | 顯示中文錯誤、不閃退；再用正確密碼登入成功 |
| A6 | 點「使用 Apple 登入」，在 Apple 的視窗按取消 | 回到登入畫面，不閃退；可以有一行說明，但不能是英文錯誤碼或卡住。模擬器沒有登入 Apple ID、跳不出 Apple 視窗時記 not-run 並寫明看到什麼 |

## B. 總覽（新帳號的預設名單是七巨頭：NVDA、AAPL、MSFT、AMZN、GOOGL、META、TSLA）

| 編號 | 步驟 | 正確 |
| --- | --- | --- |
| B1 | 看標題 | 「S&P 500 M/D（週X）」，日期等於 API `snapshot.tradeDate`，星期正確 |
| B2 | 核對 KPI 卡片 | S&P 500 收盤、點數漲跌與 %、VIX 與漲跌、RSP − 市值加權、名單合計貢獻（點、占比、權重）、距 52 週高（與高低點）、收盤 vs 20／60／200 日均線、近一週／近一月／今年以來／近一年，全部等於 API `snapshot.data` 對應欄位。卡片上「兩源一致」之類的核對標籤要跟 `index.check.status` 一致 |
| B3 | 核對名單貢獻列表 | 7 家都在，順序與 API `mag7` 相同；每家的貢獻點數、報酬 %、權重等於 API；「其餘」列存在；名單合計＋其餘＝指數漲跌點數（差 ≤ 0.02） |
| B4 | 點列表中的 NVDA | 切到「走勢」分頁，標的是 NVIDIA（NVDA） |
| B5 | 回總覽，用「其他交易日」選一個較早的日期（例如上一個交易日） | 有載入提示；標題日期與數字換成 API `?date=<那天>` 的值；有方法回到最新一天，回去之後標題變回最新日期 |
| B6 | 若「版本」選單存在（某天有多個版本），切到舊版本 | 數字換成那個版本；顯示「看最新版」之類的回去方法。沒有多版本的日期就記 not-run |
| B7 | 往下捲：下月展望、未來三週事件、最新新聞 | 三個區塊都有內容或明確的空狀態；事件只列名單公司的財報與總經事件（FOMC），日期由近到遠 |
| B8 | 點「完整日曆 →」 | 切到新聞分頁的**日曆**段落 |
| B9 | 回總覽，點「全部新聞 →」 | 切到新聞分頁的新聞段落 |
| B10 | 下拉重新整理 | 有轉圈、資料重新載入、不閃退 |

## C. 走勢

| 編號 | 步驟 | 正確 |
| --- | --- | --- |
| C1 | 打開走勢分頁（先把標的切回 S&P 500） | 預設「1 年」；價格圖有收盤與 SMA20／60／200 四條線，都畫在圖框內，圖例標示清楚；日期範圍文字等於 API `mainStats.first`～`mainStats.last`；區間報酬、最大回檔、交易日數等於 API `mainStats`（ret、mdd、points） |
| C2 | 依序點 1 個月、3 個月、6 個月、3 年、5 年 | 每次圖與交易日數都更新，數字等於 `months=1/3/6/36/60` 的 API；區間標籤不能被誤讀成「1 月、3 月」這種月份 |
| C3 | 快速連點 6 個月 → 1 年 → 3 個月（1 秒內） | 最後停在 3 個月，圖與統計都是 3 個月的資料，不會被較慢的回應蓋掉 |
| C4 | 用標的選單選 NVIDIA | 圖與統計換成 NVDA（核對 `symbol=NVDA`） |
| C5 | 看相對報酬圖（名單 vs S&P 500） | 每條線顏色不同、圖例對得上；起點是 0% |
| C6 | 在「區間統計」點 Apple 那一列 | 標的切成 AAPL |
| C7 | 看近 40 個交易日的貢獻圖 | 柱狀圖有資料，名單與其餘分開；最近一天的名單貢獻等於 API `contribution` 最後一筆 `mag7`（四捨五入）；有空資料時顯示空狀態，不是空白一片 |
| C8 | 點「編輯名單」 | 切到名單分頁 |

## D. 觀察名單（會改測試帳號的名單，最後要還原）

| 編號 | 步驟 | 正確 |
| --- | --- | --- |
| D1 | 打開名單分頁 | 7 家、「7/30 家」、合計權重等於 API `totalWeight`（1 位小數）；每家權重等於 API |
| D2 | 按右上角＋，搜尋「AVGO」，點 Broadcom | 有進度提示；完成後出現成功訊息；名單變 8 家，Broadcom 在最後 |
| D3 | 切到總覽 | 名單貢獻列表出現 AVGO（不用手動重新整理）；名單合計跟著變 |
| D4 | 再按＋，搜尋「ZZZZ」 | 沒有候選或顯示查無結果；不閃退、沒有英文錯誤 |
| D5 | 加入畫面的候選清單裡，已在名單上的公司（例如 NVDA）不能出現 | 搜尋「NVDA」時沒有 NVIDIA 可選 |
| D6 | 對 AVGO 那列往左滑到底（full swipe） | **不能**直接刪掉；要停在「移除」按鈕或跳出確認 |
| D7 | 點移除 → 確認對話框按「取消」 | AVGO 還在 |
| D8 | 再移除一次，這次確認 | AVGO 消失、回到 7 家；總覽同步不再有 AVGO |
| D9 | 點 TSLA 那一列 | 切到走勢，標的是 Tesla |

## E. 新聞與日曆

| 編號 | 步驟 | 正確 |
| --- | --- | --- |
| E1 | 打開新聞分頁（新聞段落） | 列表有標題、來源、時間；第一筆標題等於 API `/api/v1/news` 的 `news[0].title` |
| E2 | 點一則新聞 | 在 App 內（Safari 檢視）或瀏覽器開啟原文；關掉後回到 App 的新聞列表，捲動位置合理 |
| E3 | 點代號篩選 NVDA | 有載入提示；列表只剩 NVDA 相關新聞，第一筆等於 `?symbol=NVDA` 的 `news[0].title`；再點「全部」回到全部 |
| E4 | 快速連點三個不同代號 | 最後停留的代號與列表內容一致 |
| E5 | 切到日曆段落 | 顯示**月曆**（週日開頭、今天有外圈、預設選今天）；有事件的日子在日期下面有點：總經（FOMC）紅點、名單公司財報藍點，下方有圖例。2026-10-28 同時有紅點與藍點（FOMC＋MSFT 財報）。點 28 號：變成選取，下方標題「10/28（三）· 3 天後」，列出當天每個事件（與 API `events` 中 date=2026-10-28 的筆數一致）。左右滑或按箭頭能換月，範圍外的月份箭頭停用；不在本月時有「今天」按鈕可回來。「接下來」列出最近的事件，點一列會在月曆上選到那天 |
| E6 | 下拉重新整理 | 只出現一個轉圈、不閃退 |

## F. 更多

| 編號 | 步驟 | 正確 |
| --- | --- | --- |
| F1 | 更多 → ETF 與定投試算 | 11 檔 ETF（VOO、IVV、SPY、SPYM、SSO、UPRO、SPXL、SH、SDS、SPXU、SPXS）；預設期間的報酬等於 API `rows[].returns`；槓桿與反向的標示（2×、3×、反向）正確；「1Y 偏離」每列最多出現一次 |
| F2 | 切換期間 YTD、1M、5Y | 報酬數字換成對應期間 |
| F3 | 定投試算：選 IVV、2 年、每月 5000，按「試算」 | 結果（投入、市值、報酬率等）等於 API `/api/v1/etfs?etf=IVV&years=2&monthly=5000` 的 `dca`；這時按鈕是「設為我的預設」（還沒存）。離開再進來，試算區回到原本的 VOO／3 年／10000 |
| F3b | 再試算一次 IVV／2 年／5000，按「設為我的預設」 | 按鈕變成「已是我的預設」；API `/api/v1/etfs` 的 `plan` 是 `etf:"IVV", years:2, monthlyTwd:5000`；離開再進來仍是 IVV／2 年／5000。之後改回 VOO／3 年／10000 並再按一次「設為我的預設」 |
| F4 | 右上「我的規劃」→ 把「考慮出場漲幅 %」改成 `150` | 「儲存」不能按，並顯示中文說明（範圍 0–100%）；按「取消」不會存 |
| F5 | 我的規劃 →「每批投入」改成 60000、儲存；離開再進來 | 顯示 60000；API `/api/v1/etfs` 的 `plan.trancheTwd` 是 60000。之後改回 50000 並儲存 |
| F6 | 更多 → 下月展望 | 上漲機率、歷史基準率、判讀、條件表（目前的條件有標記）、機構觀點區塊都有；機率與基準率等於 API `outlook.pick.p`、`outlook.pick.base.p`（顯示成 %） |
| F7 | 更多 → 推播設定 | 有「每日收盤摘要」「名單個股大漲大跌」「門檻」「財報與 FOMC 當天提醒」。**這是未簽章的模擬器版，頂端出現「這個版本無法註冊推播」的說明是預期的，算 pass**，只要文字是中文、看得懂 |
| F8 | 關掉「每日收盤摘要」、門檻加到 ±6.0%，離開再進來 | 設定保留；API `/api/v1/push` 的 `prefs` 是 `daily:false`、`moveThresholdPct:6`。之後改回 開、±5.0% |
| F9 | 更多 → 帳號 | 顯示測試帳號 email；有「登出」「刪除帳號」 |

## G. 推播通知（用 simctl 模擬送達）

先把下面兩個 payload 存成檔案：

`/tmp/mo-codex-qa/daily.json`
```json
{"aps":{"alert":{"title":"S&P 500 10/23 收盤 −0.52%","body":"7,623.68（−39.75 點） · VIX 19.4 · 名單 −11.1 點（28%） · NVDA −3.5"},"sound":"default","thread-id":"daily"},"kind":"daily","screen":"overview","date":"2026-10-22"}
```
`/tmp/mo-codex-qa/events.json`
```json
{"aps":{"alert":{"title":"今天（美東 10/28）的事件","body":"Microsoft 財報（盤後）、FOMC 利率決議（10/27–28）"},"thread-id":"events"},"kind":"events","screen":"news","date":"2026-10-28"}
```

| 編號 | 步驟 | 正確 |
| --- | --- | --- |
| G1 | App 在前景（任一分頁），送 daily.json | 頂端出現橫幅，標題與內文完整可讀（內文最多兩行，關鍵的指數漲跌與 VIX 要看得到） |
| G2 | 切到主畫面讓 App 在背景（`xcrun simctl launch <UDID> com.apple.Preferences`），送 daily.json，點橫幅 | App 回到前景、切到總覽，而且顯示 **2026-10-22** 那天（標題 10/22） |
| G3 | App 在背景，送 events.json，點橫幅 | App 切到新聞分頁的**日曆**段落 |

## H. 通用

| 編號 | 步驟 | 正確 |
| --- | --- | --- |
| H1 | `xcrun simctl ui <UDID> appearance dark`，逐一看五個分頁 | 文字與背景對比足夠、紅綠仍可辨識、沒有白底白字。看完改回 `light` |
| H2 | `xcrun simctl ui <UDID> content_size accessibility-large`，看總覽、名單、新聞日曆、ETF | 文字放大後仍可讀，沒有重疊、沒有關鍵數字被裁掉（可以改成上下排列）。看完改回 `large` |
| H3 | 整輪結束 | 沒有閃退（`ls ~/Library/Logs/DiagnosticReports | grep -i MarketObservatory` 沒有本輪的新檔） |
| H4 | 整輪有沒有看到英文錯誤訊息、原始 JSON、`Optional(...)`、`nil` 之類的字樣 | 沒有 |

## Z. 收尾（必做）

| 編號 | 步驟 | 正確 |
| --- | --- | --- |
| Z1 | 更多 → 帳號 → 登出 | 回到登入畫面（同時驗證 A5：錯誤密碼、再用正確密碼登入） |
| Z2 | 更多 → 帳號 → 刪除帳號 → 先按取消 | 帳號還在、仍是登入狀態 |
| Z3 | 再刪除一次並確認 | 回到登入畫面；用同一組 email 與密碼登入失敗；API 登入也失敗 |
