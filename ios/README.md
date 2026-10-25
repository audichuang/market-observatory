# 觀測室 iOS App

SwiftUI，最低 iOS 27。專案用 [XcodeGen](https://github.com/yonaskolb/XcodeGen) 從 `project.yml` 產生（`.xcodeproj` 不進版控，新增檔案放進 `MarketObservatory/` 後重新產生即可）。

```sh
cd ios
xcodegen generate
# 模擬器建置（iOS 27.1 的 runtime 只支援 iPhone Duo 機型）
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory \
  -destination 'platform=iOS Simulator,OS=27.1,name=<iPhone Duo 裝置名>' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
```

- Bundle ID `com.audichuang.observatory`、Team `37HFR5V2JJ`，能力：Push Notifications、Sign in with Apple。
- 後端：`https://market-observatory.kzfvvwnwhp.workers.dev` 的 `/api/v1/*`（見 `routes/api/v1/`）。Debug 版可在「更多 → 帳號」改伺服器。
- 登入是 Better Auth 的 session cookie（`HTTPCookieStorage.shared`）；POST／PUT／DELETE 一律帶 `Origin`（`API.raw` 自動加）。
- 推播：登入後要求通知權限、註冊 APNs，把 token 送到 `POST /api/v1/devices`；Debug 版標 `sandbox`、Release（TestFlight）標 `production`。

## UI 測試（模擬器走一遍並截圖）

```sh
TEST_RUNNER_MO_EMAIL=… TEST_RUNNER_MO_PASSWORD=… TEST_RUNNER_MO_SHOTS=/tmp/mo-ios \
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory \
  -destination 'id=<模擬器 UDID>' -derivedDataPath build CODE_SIGNING_ALLOWED=NO \
  -only-testing:MarketObservatoryUITests/WalkthroughTests/test1_SignInAndVisitEveryScreen test
```

`test2_DeleteAccount` 會刪掉登入的帳號，只用一次性的測試帳號跑。

## 推播測試（模擬器）

```sh
xcrun simctl push <UDID> com.audichuang.observatory payload.json
```

## 上傳 TestFlight

見 `ios/scripts/`（archive → export → 上傳 App Store Connect）。
