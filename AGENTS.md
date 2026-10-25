## 分層

- `web/` 是 Void 專案：改它底下的檔案前先讀 `web/AGENTS.md`（從 repo 根目錄開的 session 不一定會自動載入）；`npm`、`npx void`、`node scripts/*` 都在 `web/` 底下跑。
- `ios/` 是獨立的 Xcode 專案（XcodeGen），只透過 `/api/v1` 與 Better Auth 的 `/api/auth/*`（登入）跟後端溝通。改了 `/api/v1` 的回應欄位，App 的 Codable 模型要一起改；要拿掉欄位，先確認 App 那邊是 optional，否則已安裝的舊版 App 會整頁解碼失敗。
