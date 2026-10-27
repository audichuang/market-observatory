# 觀測室 iOS App

SwiftUI，最低 iOS 27。專案用 [XcodeGen](https://github.com/yonaskolb/XcodeGen) 從 `project.yml` 產生（`.xcodeproj` 不進版控，新增檔案放進 `MarketObservatory/` 後重新產生即可）。

```sh
cd ios
xcodegen generate
# 模擬器建置
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
```

- Bundle ID `com.audichuang.observatory`、Team `37HFR5V2JJ`，能力：Push Notifications、Sign in with Apple。
- 後端：`https://market-observatory.kzfvvwnwhp.workers.dev` 的 `/api/v1/*`（見 [`web/routes/api/v1/`](../web/routes/api/v1/)）。Debug 版可在「更多 → 帳號」改伺服器。
- 登入是 Better Auth 的 session cookie（`HTTPCookieStorage.shared`）；POST／PUT／DELETE 一律帶 `Origin`（`API.raw` 自動加）。
- 推播：登入後要求通知權限、註冊 APNs，把 token 送到 `POST /api/v1/devices`；Debug 版標 `sandbox`、Release（TestFlight）標 `production`。

## 單元測試

`MarketObservatoryTests` 同時解碼舊正式站回應（`Fixtures/*.json`）與真正 view 函式產生的合成回應（`Fixtures/generated/*.json`）。後者由 `web/tests/api-contract.test.ts` 在完整 migration 的記憶體 D1 上、固定時間 `2026-10-28T23:00:00Z` 產生，涵蓋總覽、走勢、ETF、新聞、名單與展望。

`cd web && node --test tests/api-contract.test.ts` 比對目前 view 與已提交 fixture；差異一律失敗。API 有意變更時，先檢查 `Models.swift` 的 Codable 相容性，再從 `web/` 執行 `MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts`，審查 JSON diff，最後跑下列 iOS 測試。舊 fixture 保留，確保新增 optional 欄位仍可解開舊回應。這個流程不連正式站、不讀憑證。

```sh
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory \
  -destination 'id=<模擬器 UDID>' -derivedDataPath build CODE_SIGNING_ALLOWED=NO \
  -only-testing:MarketObservatoryTests test
```

## UI 測試（模擬器走一遍並截圖）

```sh
TEST_RUNNER_MO_EMAIL=… TEST_RUNNER_MO_PASSWORD=… TEST_RUNNER_MO_SHOTS=/tmp/mo-ios \
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory \
  -destination 'id=<模擬器 UDID>' -derivedDataPath build CODE_SIGNING_ALLOWED=NO \
  -only-testing:MarketObservatoryUITests/WalkthroughTests/test1_SignInAndVisitEveryScreen test
```

`test2_DeleteAccount` 會刪掉登入的帳號，只用一次性的測試帳號跑。

模擬器報 `Mach error -308` 或 `SimError 405` 時，先 `xcrun simctl shutdown all`、`killall -9 com.apple.CoreSimulator.CoreSimulatorService`，再重開模擬器。

Xcode 27 沒有 Simulator.app，要看或點模擬器畫面（例如交給 Codex 做 GUI 驗收）用 `Xcode.app/Contents/Applications/DeviceHub.app`。

## 推播測試（模擬器）

```sh
xcrun simctl push <UDID> com.audichuang.observatory payload.json
```

## 上傳 TestFlight

```sh
scripts/testflight.sh            # archive → 匯出（發佈簽章）→ 上傳；build 號用時間 yyyymmddHHMM
```

- 簽章與上傳用 team 層級的 App Store Connect API key（`~/.appstoreconnect/private_keys/AuthKey_PSZ89WD7LP.p8`，備份在 1Password `Agent` vault），Xcode 自動簽章會自己建或更新描述檔。
- 匯出時 `aps-environment` 會從 development 換成 production（archive 本身是開發簽章，這是正常的）；App 的 Release 版向後端註冊 `production` 環境。
- 腳本會把 `/usr/bin` 排到 PATH 最前面：Homebrew 的 rsync 3.x 會讓 Xcode 打包 IPA 失敗（`exportArchive Copy failed`）。
- App Store Connect：App「市場觀測室」（Apple ID 6826800828）。TestFlight 內部群組「自己」設成所有 build 自動開放，內部測試不用審核；處理完約 5～15 分鐘。

## Apple 後台設定（已完成）

- App ID `com.audichuang.observatory`：Push Notifications、Sign in with Apple。
- APNs 金鑰 `687ZW28C3T`（Sandbox & Production、Team Scoped）→ Worker secret `APNS_KEY_ID`／`APNS_PRIVATE_KEY`。
- Sign in with Apple 金鑰 `AG293PDLLW`（primary App ID 是本 App）→ `SIWA_KEY_ID`／`SIWA_PRIVATE_KEY`，刪除帳號時用來撤銷 Apple 授權。
- 兩把 .p8 都只能下載一次，備份在 1Password `Agent` vault。
