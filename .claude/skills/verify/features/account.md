# 帳號：註冊、登入、登出、刪除

任何人都能用 email／密碼註冊（App 另有 Apple 登入）；登入後才看得到任何頁面，未登入的網頁一律導到 `/login`、API 回 401。App 內可以刪除帳號，刪完回到登入畫面、同一組帳密不能再登入。

## Sub-features

- `account-signup-web`：網頁登入頁切到「建立帳號」，註冊後進總覽。
- `account-signup-short`（A2）：密碼少於 8 字時顯示中文錯誤、留在登入畫面。
- `account-signin-app`（A3、A4）：App 用 email 登入進總覽；重開 App 不用再登入。
- `account-signin-wrong`（A5）：錯誤密碼顯示中文錯誤；再用正確密碼成功。
- `account-apple-cancel`（A6）：App 點「使用 Apple 登入」後取消，回登入畫面。
- `account-signout`（Z1）：網頁右上「登出」、App「更多 → 帳號 → 登出」。
- `account-delete`（Z2、Z3）：App 刪除帳號，先取消一次、再確認一次。
- `account-gate`：未登入打開 `/watchlist` 會導到 `/login?next=%2Fwatchlist`，登入後回到原頁。

## How to get to it (user POV)

- 網頁：打開任何網址未登入時到 `/login`；「還沒有帳號？建立帳號」／「已有帳號，改為登入」切換模式；右上 email 旁的「登出」。
- App：第一次啟動的登入畫面（標題「市場觀測室」、「使用 Apple 登入」、Email／密碼欄位、「還沒有帳號？建立帳號」、底部「個人研究用途，非投資建議。」）；「更多 → 帳號」有「登出」「刪除帳號」。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、`doctor.sh` 全 ✓；`verify-<run-id>@example.test` 還沒註冊。

- **網頁註冊。** `page.goto("http://localhost:5181/login")`，`page.click("text=還沒有帳號？建立帳號")`，等 `loc=role:button[name='建立帳號']` 出現（等不到＝頁面沒 hydrate，跑 doctor），`fill("input[type=email]", …)`、`fill("input[type=password]", …)`，按「建立帳號」。20 秒內出現 `text=S&P 500 收盤`，網址是 `/`，右上顯示這個 email。
- **短密碼。** 建立帳號模式下密碼填 `short` 按送出。瀏覽器的 `minLength=8` 原生提示擋下（網頁）；App 顯示中文「密碼至少 8 個字」類訊息（A2）。
- **登入閘門。** 登出後 `goto("/watchlist")`：網址變 `/login?next=%2Fwatchlist`；登入後回到 `/watchlist`。`page.fetch("/api/v1/me")` 在登出狀態回 401。
- **App 登入。** `ios-walkthrough.sh <run-id> <email> <密碼檔>`：`01-login.png` 是登入畫面，`02-overview.png` 已在總覽，底部五個分頁：總覽、走勢、新聞、更多（名單在總覽右上星號）。再 `simctl terminate` + `simctl launch` 一次，直接進總覽（A4）。
- **App 刪除帳號。** 只對一次性帳號：`-only-testing:MarketObservatoryUITests/WalkthroughTests/test2_DeleteAccount`（環境變數同 walkthrough）。`11-delete-confirm.png` 是確認對話框、`12-after-delete.png` 回到登入畫面；之後用同帳密打 `POST /api/auth/sign-in/email` 要失敗。
- **Proof。** `evidence/web/account-signup.png`（總覽＋右上 email）、`evidence/ios/01-login.png`、`02-overview.png`；刪除時加上登入失敗的 API 回應。

## Gotchas

- 本機登入頁所有按鈕沒反應＝頁面沒 hydrate（gate 擋了 `/pages/login.tsx`）；doctor 會抓到。
- App 的 Apple 登入在沒登入 Apple ID 的模擬器跳不出視窗，記 not-run 並寫明看到什麼。
- 站長帳號（`OWNER_EMAIL`）不能從 App 刪除，正式站的站長帳號絕不能拿來測刪除。
- 註冊後 App 會跳通知權限詢問；walkthrough 會按「允許」。
