# 推播

App 登入後註冊 APNs；每個帳號可以設定每日收盤摘要、名單個股大漲大跌（門檻 %）、財報與總經事件（FOMC、CPI、非農）當天提醒。收到推播點開會導到對應畫面（收盤摘要 → 那天的總覽；事件 → 新聞的日曆）。

## Sub-features

- `push-device-health`：同帳號同環境重新註冊保留上次失敗，換帳號或環境清除；送達成功清錯誤，BadDeviceToken／Unregistered 刪 token；每人最多保留最近 10 台。
- `push-prefs`（F7、F8）：推播設定頁四個項目；關掉每日摘要、門檻改 ±6.0%，離開再進來仍保留，API `/api/v1/push` 的 `prefs` 是 `daily:false`、`moveThresholdPct:6`；之後改回開、±5.0%。
- `push-banner`（G1）：前景收到推播出現橫幅，標題與內文可讀。
- `push-open-daily`（G2）：背景點收盤推播 → 總覽、顯示 payload 的那天。
- `push-open-events`（G3）：背景點事件推播 → 新聞的日曆。

## How to get to it (user POV)

- App：「更多 → 推播設定」；系統通知橫幅。網頁沒有推播。

## Driving it with ego-browser / XCUITest

Preconditions:

- 「MO Verify <run-id>」模擬器上 App 已登入測試帳號（跑過 walkthrough）。

- **裝置衛生。** 本機測試跑 `cd web && node --test tests/devices.test.ts tests/push.test.ts`，涵蓋重新註冊、換帳號／環境、成功清錯、APNs reason 分類與第 11 台淘汰。真實 APNs 驗收需 TestFlight 實機：推播設定按「測試推播」，成功後「上次失敗」清空；模擬器僅驗呈現與點開導向。
- **設定頁。** walkthrough 的 `09-push.png`、`09b-push-more.png`。改偏好跑 `ios-test.sh … VerifyInteractionTests/test07_PushPrefs`：關「每日收盤摘要」、門檻按兩次＋變 ±6.0%，離開再進來寫 `F8-reopen.txt`，再改回寫 `F8-restored.txt`。在改回之前要讀 API 的話，另用網頁的 `page.fetch("/api/v1/push")`（同一個測試帳號）比 `prefs`。
- **送推播與點開。** payload 由 `ios-test.sh` 產生（`$RUN/daily.json`、`$RUN/events.json`）：daily 的 `date` 是本機站第二新的交易日，並同時傳給 test08 當斷言；events 的 `date` 是 `/api/v1/news` 今天以後第一個事件日。照 SKILL.md Drive 的「08／09 各自單獨跑一次」跑 `test08_PushOpenDaily`（G1 前景橫幅 `G1-foreground-banner.png`、G2 回桌面後點橫幅 → 那天的總覽 `G2-opened-daily.png`）與 `test09_PushOpenEvents`（G3 點開 → 新聞的日曆 `G3-opened-events.png`）。產生的格式如下（日期依當次資料）：

  ```json
  {"aps":{"alert":{"title":"S&P 500 M/D 收盤","body":"驗證用推播（ios-test.sh 產生）"},"sound":"default","thread-id":"daily"},"kind":"daily","screen":"overview","date":"YYYY-MM-DD"}
  ```
  ```json
  {"aps":{"alert":{"title":"今天（美東 M/D）的事件","body":"驗證用推播（ios-test.sh 產生）"},"thread-id":"events"},"kind":"events","screen":"news","date":"YYYY-MM-DD"}
  ```

- **Proof。** `09-push.png`、`F8-changed.png`、`F8-reopen.png`／`.txt`、`F8-restored.txt`、`G1-foreground-banner.png`、`G2-opened-daily.png`、`G3-opened-events.png`。

## Gotchas

- 未簽章的模擬器版註冊不了 APNs：設定頁頂端的「這個版本無法註冊推播（模擬器或未簽章版本）」與「這台裝置註冊失敗」是預期的，算 pass；真正的 APNs 送達只能在 TestFlight 版實機驗。
- `simctl push` 不經過後端，驗的是 App 收到後的呈現與導向，不是收盤推播的排程邏輯（那個看 `npm test` 的 push 測試與 runs 紀錄）。
- 點推播橫幅曾經閃退（async 版 `didReceive` 在非主執行緒呼叫 completion handler，SIGABRT），已改成 completion-handler 版並在主執行緒處理。G2、G3 每輪都要跑，並確認 `~/Library/Logs/DiagnosticReports` 沒有新的 MarketObservatory crash。
