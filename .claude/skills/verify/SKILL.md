---
name: verify
description: 像使用者一樣實際操作市場觀測室（網站 web/ 與 iOS App ios/）並留下證據：從空資料庫啟動本機站、用 ego-browser 點網頁、用模擬器跑 App、截圖與 API 對帳、收尾。改了網頁畫面、/api/v1、排程資料呈現或 iOS 畫面後，宣告完成、開 PR 合併、部署或上傳 TestFlight 之前用；「驗證」「實際點點看」「跑一遍 App」「畫面有沒有壞」也用。
---

# 驗證市場觀測室

單元測試（`npm test`、`MarketObservatoryTests`）證明函式對；這個技能證明**使用者碰得到的東西**對：真的點、真的看、真的對帳。所有腳本在 `.claude/skills/verify/scripts/`，從 repo 任何地方用絕對路徑或 `"$(git rev-parse --show-toplevel)"/.claude/skills/verify/scripts/…` 呼叫。

## 怎樣才算交付

改動碰到哪個介面，就照 [功能地圖](features/README.md) 把**被改到的功能**實際操作一遍，並在 PR 或回報裡附上證據位置。少一項就不能說「完成」，只能說「已寫好、未驗證：缺 X」。

| 改了什麼 | 交付前要有的證據 |
| --- | --- |
| `src/lib/`、排程、`src/server/` 的計算 | `npm test`＋`npm run typecheck` 通過；本機實例上受影響的畫面數字跟 API 對得上（截圖＋API JSON） |
| 網頁畫面（`pages/`、`src/ui/`） | ego-browser 在本機實例走過受影響功能的每個入口，截圖＋動作後的狀態；有寫入的，換一個畫面或 API 讀回來 |
| `/api/v1` 欄位 | 網頁與 App 都看過受影響的畫面；欄位刪改要確認 App 舊版解得開（`ios/MarketObservatoryTests` fixture） |
| iOS 畫面 | 模擬器上親眼看過改到的畫面（walkthrough 截圖＋針對改動的截圖），**上傳 TestFlight 前一定要**；看不了就明說「畫面未實看」 |
| 部署後 | 正式站用站長跑 `POST /api/admin/cron?name=<排程>` 看 `status` 與 `detail.subrequests`（見 `web/AGENTS.md`） |

證據標準（每項都要）：

- 走使用者真的會走的路：網頁從登入頁登入、點導覽列；App 從登入畫面登入。不要用 `/api/admin/*`、直接改 D1、或只打 API 來代替畫面操作（它們只能用來**準備資料**與**對帳**）。
- 拍「動作」與「結果」，不是只拍最後一張：例如加入名單前後各一張，再加上 API 讀回來的名單。
- 驗副作用：寫入的東西（名單、定投規劃、推播偏好）要從**另一個畫面或 API**讀回來；網頁改了名單，App 的名單頁也要看到。
- 數字對帳：畫面數字等於同一帳號 `/api/v1/*` 的值（只容許顯示位數的四捨五入）。台灣慣例：紅＝漲、綠＝跌。
- 失敗就是失敗：資料不夠讓某個步驟無法進行時，回報失敗並把原因寫進那個功能檔的 Gotchas，不要把步驟改簡單讓它過。

## Launch

一次驗證＝一個 run-id，狀態與證據放在 `~/.cache/mo-verify/<run-id>/`（可用 `MO_VERIFY_ROOT` 改）。

1. **開一個乾淨的 checkout。** 本機 D1 存在各 checkout 的 `web/.void/v3/d1`。要驗的分支本來就在 worktree 裡（`git worktree add …`，見 `web/AGENTS.md`）就直接用；`web/.env` 從主 checkout 複製（要有 `OWNER_EMAIL`）。**不要在主 checkout 跑**：那裡的 D1 是使用者的開發資料，Orca 排程也在那裡跑。
2. **網站**（約 1 分鐘）：

   ```sh
   S="$(git rev-parse --show-toplevel)/.claude/skills/verify/scripts"
   "$S/web-up.sh" <run-id> [port，預設 5181]
   ```

   做的事：`void db migrate` → 背景啟動 vite（`--strictPort`，記下 PID）→ 用隨機密碼註冊站長（存 `$RUN/owner.pw`，不印出）→ `scripts/backfill.ts --sessions 60`（十年日線、Cboe 歷史、核對、60 天快照）→ 跑 `daily-reference`、`news` 排程與 `forecast`。**就緒＝腳本印出 `RUN=…`**：這時總覽、走勢、新聞、日曆、ETF、展望都有資料。同一個 worktree 要重來：`MO_VERIFY_RESET=1 "$S/web-up.sh" <新 run-id>`。
3. **iOS**（第一次 build 約 2–4 分鐘）：

   ```sh
   "$S/ios-up.sh" <run-id>
   ```

   建一台專用模擬器「MO Verify <run-id>」（iPhone 18 Pro、iOS 27.0）、開機、`xcodegen generate`、`build-for-testing`、安裝 App。App 是 Debug 版，啟動參數 `-debugBaseURL http://localhost:<port>` 讓它連這次的本機站（UserDefaults 的參數網域，不會寫進 App 設定）。

沒有本機站可用時（例如只想看正式站上已部署的 App），才連正式站，而且只用一次性帳號，見下方「正式站」。

## Doctor

```sh
"$S/doctor.sh" <run-id>
```

唯讀，逐項 ✓／✗：dev server PID 活著、port 是這個 PID 在聽（不是別人的 dev server）、`/login` 200、**未登入也拿得到 `/pages/login.tsx`**（否則登入頁不會 hydrate、按鈕都沒反應）、站長 cookie 有效、有最新快照；有模擬器時檢查已開機、已安裝 App。最後印出 commit 與是否有未提交改動——證據要對得上這個 commit。第一次 drive 前跑、任何操作結果怪怪的時候再跑；有 ✗ 就先修，不要繼續點。

## Drive

### 網頁：ego-browser

先跑 `ego-browser skill` 讀當版用法（每個 session 一次）。整次驗證用**同一個** task space，名字用 `mo-verify-<run-id>`；腳本在 Node 裡跑，不吃 shell 的環境變數，網址與路徑直接寫進腳本。

```sh
ego-browser nodejs <<'EOF'
const task = await taskSpace("mo-verify-<run-id>");
const page = task.page("p1");
await page.goto("http://localhost:5181/login");
await page.click("text=還沒有帳號？建立帳號", { label: "switch to sign up" });
await page.waitForSelector("loc=role:button[name='建立帳號']", { timeout: 5000 });
await page.fill("input[type=email]", "verify-<run-id>@example.test");
await page.fill("input[type=password]", "verify-<run-id>-pw");
await page.click("loc=role:button[name='建立帳號']", { label: "submit sign up" });
await page.waitForSelector("text=S&P 500 收盤", { timeout: 20000 });
await page.screenshot({ path: "<RUN>/evidence/web/01-overview.png" });
EOF
```

- 把手：網頁幾乎沒有 ARIA label 或 data-testid（登入欄位沒有 accessible name），用**畫面上的中文字**（`text=…`、`loc=role:button[name='加入']`）、`input[type=email]`、`input[placeholder="…"]` 與網址（`/watchlist`、`/history?symbol=NVDA`）。各功能的實際把手在功能檔。
- 等待用 `waitForSelector`／`waitForFunction` 等畫面上的結果，不要用固定秒數。
- 對帳：`await page.fetch("/api/v1/<端點>")` 用同一個登入 cookie 讀 API，跟畫面比。
- 收尾：最後一輪 `await task.finish({ keep: [] })`。

### iOS：XCUITest walkthrough＋針對改動的操作

```sh
printf '%s' 'verify-<run-id>-pw' > "$RUN/user.pw"; chmod 600 "$RUN/user.pw"
"$S/ios-walkthrough.sh" <run-id> verify-<run-id>@example.test "$RUN/user.pw"
```

帳號要先在本機站註冊（網頁 drive 第一步就會建）。`WalkthroughTests/test1_SignInAndVisitEveryScreen` 登入後走過總覽、走勢、名單（打開加入畫面再取消）、新聞、日曆、更多 → ETF、展望、推播、帳號，共約 20 張截圖到 `$RUN/evidence/ios/`，xcresult（含錄影）在同目錄。**跑完要打開截圖看**：測試只確認找得到按鈕，不檢查字有沒有被切掉、顏色對不對、數字是不是 0。

walkthrough 沒走到的互動（滑動刪除、對話框、選期間、推播點開）用：

- `xcrun simctl io <UDID> screenshot <路徑>` 截圖。
- 推播：`xcrun simctl push <UDID> com.audichuang.observatory <payload.json>`（payload 在 [推播功能檔](features/push.md)）。
- 外觀與字級：`xcrun simctl ui <UDID> appearance dark|light`、`content_size accessibility-large|large`。
- 需要點擊的：在 `WalkthroughTests` 加一個 test（用畫面上的中文 label；只有登入欄位有 identifier：`email`、`password`、`submit`），或交給 Codex 桌面版用 DeviceHub（`/Applications/Xcode.app/Contents/Applications/DeviceHub.app`）手動操作（codex skill）。

## Evidence

- 全部放在 `$RUN/evidence/web/` 與 `$RUN/evidence/ios/`，檔名用功能檔裡的子功能 ID（例如 `watchlist-add.png`、`watchlist-add.api.json`）。
- 每個證據記下：功能 ID、入口、帳號、commit（doctor 印的那個）。
- 回報（PR 描述或給使用者的訊息）寫：驗了哪些功能與入口、證據目錄、發現的問題、**沒驗到的項目與原因**。不要把沒走到的入口說成驗過。
- 證據在 `down.sh` 之後仍留著；`~/.cache` 不會自動清，舊的 run 目錄可以手動刪。

## Cleanup

```sh
"$S/down.sh" <run-id>
```

只收這次啟動的東西：dev server 的整棵程序樹（vite＋workerd，用記下的 PID，不用 process 名稱）、這次建的模擬器（刪除）、DerivedData、密碼與 cookie 檔。證據保留，腳本最後確認 `$RUN/evidence` 不是空的並印出位置。ego-browser 那邊在最後一輪呼叫 `task.finish({ keep: [] })`。失敗中斷的嘗試也要跑 `down.sh`，別留下佔著 port 的 dev server。不要動別人開著的模擬器（例如 `okinawa-e2e`、`MO iPhone 18 Pro Max`）；不要用 `killall` 收 CoreSimulatorService。

## 正式站（只在必要時）

- 網址 `https://market-observatory.kzfvvwnwhp.workers.dev`。只能用**一次性帳號**（自己註冊、用完在 App「更多 → 帳號 → 刪除帳號」或 `DELETE /api/v1/me` 刪掉）。
- 站長帳號的觀察名單是使用者真的在用的資料：不要拿來測加減名單；不得不動時，測完改回原狀並讀回確認。
- `WalkthroughTests/test2_DeleteAccount` 會刪掉登入的帳號，只對一次性帳號跑。

## Gotchas

- 本機登入頁按鈕沒反應：未登入時 `middleware/01.gate.ts` 把 `/pages/*.tsx` 導去 `/login`，頁面不會 hydrate。dev 時已放行 `/pages/`、`/src/`、`/node_modules/`、`/@`；doctor 會檢查。有人改 gate 時再看一次。
- 剛建好的模擬器第一次跑 walkthrough，送出登入的那一下可能被鍵盤上的密碼建議列吃掉；測試已經會在 8 秒後還停在登入畫面時再點一次。
- 未簽章的模擬器版註冊不了推播，推播設定頁頂端的紅色說明（「這個版本無法註冊推播」）是預期的。
- ego-browser 的 cookie 以主機區分、不分 port：`localhost:5181` 的登入會蓋掉同一個瀏覽器裡 `localhost:5173` 的 session（使用者自己的 dev server）。驗證完告訴使用者 5173 可能要重新登入。`127.0.0.1` 繞不過去：vite 只聽 `[::1]`，連不上。
- 回補打的是 Yahoo／Nasdaq／Cboe 真實端點，本機 IP 被限流時 `web-up.sh` 會失敗在回補步驟；隔幾分鐘再跑，不要改成假資料。
- 排程與 AI 文字：本機沒有翻譯與「今天為什麼漲跌」（那是本機 Orca 排程寫進正式站 D1 的），新聞會是英文標題、沒有 AI 摘要；要驗 AI 內容的呈現，用正式站一次性帳號看，或自己用 `/api/admin/ai` 寫一筆。
