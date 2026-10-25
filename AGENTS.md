## 分層

- `web/` 是 Void 專案（Cloudflare Worker：網頁、`/api/v1`、排程、D1）；npm 指令都在 `web/` 底下跑。
- `ios/` 是獨立的 Xcode 專案（XcodeGen），只透過 `/api/v1` 跟後端溝通，建置與 UI 測試見 `ios/README.md`。改了 `/api/v1` 的回應欄位，App 的 Codable 模型要一起改；要拿掉欄位，先確認 App 那邊是 optional，否則已安裝的舊版 App 會整頁解碼失敗。
