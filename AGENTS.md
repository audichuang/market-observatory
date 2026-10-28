## 分層

- `web/` 是 Void 專案：改它底下的檔案前先讀 `web/AGENTS.md`（從 repo 根目錄開的 session 不一定會自動載入）；`npm`、`npx void`、`node scripts/*` 都在 `web/` 底下跑。
- `ios/` 是獨立的 Xcode 專案（XcodeGen），只透過 `/api/v1` 與 Better Auth 的 `/api/auth/*`（登入）跟後端溝通。改了 `/api/v1` 的回應欄位，App 的 Codable 模型要一起改；要拿掉欄位，先確認 App 那邊是 optional，否則已安裝的舊版 App 會整頁解碼失敗。

## 交付

- iOS UI 驗證只重用既有的 `MO iPhone 16 Plus` 與 `MO iPhone 18 Pro Max`，一次只開一台；驗完 `shutdown` 並保留這兩台。不新增模擬器、不使用 SE 或一般 Pro。`ios-up.sh` 的預設仍會新增機型，這台改將既有 UDID 寫入本輪 `sim.udid` 後用 `ios-test.sh` 建置操作；不要對既有兩台執行會刪除裝置的 `down.sh`，改手動關閉本輪服務與暫存。

- 宣告完成、合併、部署或上傳 TestFlight 之前，照 `/verify`（`.claude/skills/verify/`）把改到的功能實際操作一遍並留證據；單元測試與 build 通過不等於驗證過。網頁用 ego-browser 點；iOS 畫面用 `scripts/ios-walkthrough.sh`、互動（切換、輸入、左滑、推播點開）用 `scripts/ios-test.sh` 跑 `VerifyInteractionTests`，細節在 SKILL.md 的 Drive。驗不到的項目要明說「未驗證：缺什麼」。
- 功能地圖（`.claude/skills/verify/features/`）跟著功能改：新增或改變使用者看得到的行為時一起更新；定期用 `/maintain-verification-skill` 對帳。
