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

- **設定頁。** walkthrough 的 `09-push.png`、`09b-push-more.png`。改偏好要點擊，用 XCUITest 補 test 或 Codex DeviceHub；改完 `curl -b <測試帳號 cookie> http://localhost:<port>/api/v1/push` 讀回，再改回。
- **送推播。** 把下面兩個 payload 存到 `$RUN/daily.json`、`$RUN/events.json`（日期改成本機快照裡有的交易日），`xcrun simctl push <UDID> com.audichuang.observatory $RUN/daily.json`。前景時截圖看橫幅；`xcrun simctl launch <UDID> com.apple.Preferences` 讓 App 到背景，再送一次、點橫幅，截圖確認導向。

  ```json
  {"aps":{"alert":{"title":"S&P 500 10/23 收盤 −0.52%","body":"7,623.68（−39.75 點） · VIX 19.4 · 名單 −11.1 點（28%） · NVDA −3.5"},"sound":"default","thread-id":"daily"},"kind":"daily","screen":"overview","date":"2026-10-22"}
  ```
  ```json
  {"aps":{"alert":{"title":"今天（美東 10/28）的事件","body":"Microsoft 財報（盤後）、FOMC 利率決議（10/27–28）"},"thread-id":"events"},"kind":"events","screen":"news","date":"2026-10-28"}
  ```

- **Proof。** `09-push.png`、偏好讀回的 API JSON、`push-banner.png`、`push-open-daily.png`、`push-open-events.png`。

## Gotchas

- 未簽章的模擬器版註冊不了 APNs：設定頁頂端的「這個版本無法註冊推播（模擬器或未簽章版本）」與「這台裝置註冊失敗」是預期的，算 pass；真正的 APNs 送達只能在 TestFlight 版實機驗。
- `simctl push` 不經過後端，驗的是 App 收到後的呈現與導向，不是收盤推播的排程邏輯（那個看 `npm test` 的 push 測試與 runs 紀錄）。
- 點橫幅需要點擊座標或 XCUITest 的 springboard 元素；拿不到時記 not-run 並寫原因。
