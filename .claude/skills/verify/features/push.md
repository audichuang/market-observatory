# 推播

App 登入後註冊 APNs；每個帳號可以設定每日收盤摘要、名單個股大漲大跌（門檻 %）、財報與 FOMC 當天提醒。收到推播點開會導到對應畫面（收盤摘要 → 那天的總覽；事件 → 新聞的日曆）。

## Sub-features

- `push-prefs`（F7、F8）：推播設定頁四個項目；關掉每日摘要、門檻改 ±6.0%，離開再進來仍保留，API `/api/v1/push` 的 `prefs` 是 `daily:false`、`moveThresholdPct:6`；之後改回開、±5.0%。
- `push-banner`（G1）：前景收到推播出現橫幅，標題與內文可讀。
- `push-open-daily`（G2）：背景點收盤推播 → 總覽、顯示 payload 的那天。
- `push-open-events`（G3）：背景點事件推播 → 新聞的日曆。

## How to get to it (user POV)

- App：「更多 → 推播設定」；系統通知橫幅。網頁沒有推播。

## Driving it with ego-browser / XCUITest

Preconditions:

- 「MO Verify <run-id>」模擬器上 App 已登入測試帳號（跑過 walkthrough）。

- **設定頁。** walkthrough 的 `09-push.png`、`09b-push-more.png`。改偏好跑 `ios-test.sh … VerifyInteractionTests/test07_PushPrefs`：關「每日收盤摘要」、門檻按兩次＋變 ±6.0%，離開再進來寫 `F8-reopen.txt`，再改回寫 `F8-restored.txt`。在改回之前要讀 API 的話，另用網頁的 `page.fetch("/api/v1/push")`（同一個測試帳號）比 `prefs`。
- **送推播與點開。** 把下面兩個 payload 存到 `$RUN/daily.json`、`$RUN/events.json`。`date` 要是本機有快照的交易日，而且要等於 test 斷言的日子（test08 斷言 `10/22`，資料日期不同時兩邊一起改）；事件的 `date` 用 `/api/v1/news` 的 `events` 裡有的日子。再照 SKILL.md Drive 的「08／09 要 shell 同時送推播」跑 `test08_PushOpenDaily`（daily.json：G1 前景橫幅 `G1-foreground-banner.png`、G2 回桌面後點橫幅 → 10/22 總覽 `G2-opened-daily.png`）與 `test09_PushOpenEvents`（events.json：G3 點開 → 新聞的日曆 `G3-opened-events.png`）。

  ```json
  {"aps":{"alert":{"title":"S&P 500 10/23 收盤 −0.52%","body":"7,623.68（−39.75 點） · VIX 19.4 · 名單 −11.1 點（28%） · NVDA −3.5"},"sound":"default","thread-id":"daily"},"kind":"daily","screen":"overview","date":"2026-10-22"}
  ```
  ```json
  {"aps":{"alert":{"title":"今天（美東 10/28）的事件","body":"Microsoft 財報（盤後）、FOMC 利率決議（10/27–28）"},"thread-id":"events"},"kind":"events","screen":"news","date":"2026-10-28"}
  ```

- **Proof。** `09-push.png`、`F8-changed.png`、`F8-reopen.png`／`.txt`、`F8-restored.txt`、`G1-foreground-banner.png`、`G2-opened-daily.png`、`G3-opened-events.png`。

## Gotchas

- 未簽章的模擬器版註冊不了 APNs：設定頁頂端的「這個版本無法註冊推播（模擬器或未簽章版本）」與「這台裝置註冊失敗」是預期的，算 pass；真正的 APNs 送達只能在 TestFlight 版實機驗。
- `simctl push` 不經過後端，驗的是 App 收到後的呈現與導向，不是收盤推播的排程邏輯（那個看 `npm test` 的 push 測試與 runs 紀錄）。
- 已知 bug（另案修）：點推播橫幅 App 閃退（`AppDelegate` 的 `didReceive` 用 async delegate，在非主執行緒跑 UI 導向）。修好前 G2、G3 會 fail（G1 前景橫幅會過）；記 fail 並附 `~/Library/Logs/DiagnosticReports` 裡新的 MarketObservatory crash 檔名。
