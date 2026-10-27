---
name: verify
description: 像使用者一樣實際操作市場觀測室（網站 web/ 與 iOS App ios/）並留下證據：從空資料庫啟動本機站、用 ego-browser 點網頁、用模擬器跑 App、截圖與 API 對帳、收尾。改了網頁畫面、/api/v1、排程資料呈現或 iOS 畫面後，宣告完成、開 PR 合併、部署或上傳 TestFlight 之前用；「驗證」「實際點點看」「跑一遍 App」「畫面有沒有壞」也用。
---

# 驗證市場觀測室

單元測試（`npm test`、`MarketObservatoryTests`）證明函式對；這個技能證明**使用者碰得到的東西**對：真的點、真的看、真的對帳。需要 Claude Code 2.1.200 以上，`/verify` 才會叫到這個專案技能而不是內建的那個。所有腳本在 `.claude/skills/verify/scripts/`，從 repo 任何地方用絕對路徑或 `"$(git rev-parse --show-toplevel)"/.claude/skills/verify/scripts/…` 呼叫。

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
await page.waitForFunction(() => { const a = [...document.querySelectorAll("a,button")].find(e => e.textContent.includes("還沒有帳號")); return a && Object.keys(a).some(k => k.startsWith("__react")); }, undefined, { timeout: 15000 });
await page.click("text=還沒有帳號？建立帳號", { label: "switch to sign up" });
await page.waitForSelector("loc=role:button[name='建立帳號']", { timeout: 5000 });
await page.fill("input[type=email]", "verify-<run-id>@example.test");
await page.fill("input[type=password]", "verify-<run-id>-pw");
await page.click("loc=role:button[name='建立帳號']", { label: "submit sign up" });
await page.waitForSelector("text=S&P 500 收盤", { timeout: 20000 });
await page.screenshot({ path: "<RUN>/evidence/web/01-overview.png" });
EOF
```

- 把手：網頁幾乎沒有 ARIA label 或 data-testid（登入欄位沒有 accessible name），用**畫面上的中文字**、`input[type=email]`、`input[placeholder="…"]` 與網址（`/watchlist`、`/history?symbol=NVDA`）。各功能的實際把手在功能檔。
- 選擇器要**只對到一個**：`text=NVIDIA` 這類寫法常同時對到表格連結與新聞標題，點到哪個看運氣。改用精確寫法：
  - 標籤＋精確文字：`a.chip:text-is("NVDA")`、`h1:text-is("下月展望")`、`button:text-is("SPY 持股權重")`
  - 網址：`loc=href:/history?symbol=NVDA`
  - 角色：`loc=role:button[name='加入']`

  `:has-text()` 只能放在選擇器最後（`li:has-text("AVGO") button` 會被拒）；要點某一列裡的按鈕，先用 `evaluate` 在那個按鈕標 `data-verify-target`，再點那個屬性。
- **整頁導覽後先等 hydrate 再點。** `goto`、送出表單後跳頁，畫面先是伺服器輸出的 HTML，React 還沒接手前點擊會靜默失效（實測：登入後立刻按「登出」沒反應）。點之前等按鈕掛上 React：

  ```js
  await page.waitForFunction(() => { const b = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "登出"); return b && Object.keys(b).some(k => k.startsWith("__reactFiber")); }, undefined, { timeout: 10000 });
  ```

- 等待用 `waitForSelector`／`waitForFunction` 等畫面上的結果，不要用固定秒數。
- 對帳：`await page.fetch("/api/v1/<端點>")` 用同一個登入 cookie 讀 API，跟畫面比。
- 收尾：最後一輪 `await task.finish({ keep: [] })`。

### iOS：XCUITest（walkthrough＋互動測試）

```sh
printf '%s' 'verify-<run-id>-pw' > "$RUN/user.pw"; chmod 600 "$RUN/user.pw"
"$S/ios-walkthrough.sh" <run-id> verify-<run-id>@example.test "$RUN/user.pw"
"$S/ios-test.sh" <run-id> verify-<run-id>@example.test "$RUN/user.pw" VerifyInteractionTests/test02_Overview,VerifyInteractionTests/test03_History
```

帳號要先在本機站註冊（網頁 drive 第一步就會建）。`ios-test.sh <run-id> <email> <密碼檔> <Class/test>[,...]` 先增量 `build-for-testing`（改過測試檔會帶進去）再跑指定的 test，連這次的本機站；截圖、`<ID>.txt` 與 xcresult 寫到 `$RUN/evidence/ios/`。`ios-walkthrough.sh` 就是它跑 `WalkthroughTests/test1_SignInAndVisitEveryScreen`：登入後逐頁截圖約 20 張（總覽、走勢、名單、新聞、日曆、更多 → ETF、展望、推播、帳號），只確認找得到按鈕。

實際操作（切換、輸入、左滑、對話框、存了再讀回）在 `ios/MarketObservatoryUITests/VerifyInteractionTests.swift`，會改資料的 test 結束前改回基準：

| test | 測案 |
| --- | --- |
| `test00_DumpTree` | 不是驗證：把總覽、走勢、ETF、我的規劃的無障礙樹寫成 `dump-*.txt`，摸索新畫面的 label 時用 |
| `test02_Overview` | B2 市場指標展開、B5 其他交易日與回到最新、B4 點公司到走勢、B8 完整日曆 |
| `test03_History` | C2 區間、C3 快速連點、C4 標的選單、C6 點統計表的列 |
| `test04_Watchlist` | D2 加入 AVGO、D4 ZZZZ、D5 已在名單、D6–D8 左滑與確認、D9 點公司 |
| `test05_NewsCalendar` | E3 代號篩選、E4 快速連點、E5 點 10/28、換月、今天 |
| `test06_EtfsPlan` | F2 期間、F3 試算、F3b 設為預設再讀回、F4 出場漲幅 150、F5 每批投入 |
| `test07_PushPrefs` | F8 關每日摘要、門檻 ±6.0%，離開再進來讀回，再改回 |
| `test08_PushOpenDaily`、`test09_PushOpenEvents` | G1 前景橫幅、G2／G3 背景點開推播（要 shell 送推播，見下） |
| `test12_Outlook` | H1 展望頁從上捲到底逐段截圖（`H1-outlook-NN.png`），斷言 dd5 與上漲兩個驗證區塊都在；文字存 `H1-outlook.txt` |
| `test10_SignOutAndErrors` | Z1 登出、A5 錯誤密碼、A2 短密碼，最後用正確密碼登回 |

每個 test 把看到的畫面文字寫成 `<ID>.txt`（例如 `B5-older.txt`、`D2-added.txt`），拿去跟同帳號的 `/api/v1/*` 對帳。這些 test 寫死了寫測試當時本機站的資料（`2026-10-22`／`10/23` 交易日、`7/30 家 · 合計權重 34.01%`、事件日 10/28）；資料日期不同時先改 test 裡的字串，否則會 fail 在找不到元素。

**08／09 要 shell 同時送推播**：test 只等橫幅出現再點，推播由 shell 在背景每 8 秒送一次，test 跑完用旗標檔停掉迴圈。迴圈、test、停止要寫在**同一個 Bash 呼叫**裡（shell 狀態不跨呼叫，`S`、`RUN` 也要在這個呼叫裡設）：

```sh
UDID=$(cat "$RUN/sim.udid"); STOP="$RUN/push.stop"; rm -f "$STOP"
( while [ ! -f "$STOP" ]; do xcrun simctl push "$UDID" com.audichuang.observatory "$RUN/daily.json"; sleep 8; done ) &
"$S/ios-test.sh" <run-id> verify-<run-id>@example.test "$RUN/user.pw" VerifyInteractionTests/test08_PushOpenDaily; touch "$STOP"; wait
```

（test09 換成 `$RUN/events.json`；payload 在 [推播功能檔](features/push.md)，daily 的 `date` 要等於 test08 斷言的 `2026-10-22`。）

**跑完要逐張看截圖。** 測試通過只代表找得到元素、斷言的那一項成立，不代表畫面對：例如「市場指標」點了沒展開時，只斷言存在的舊版測試照樣過。字有沒有被切掉、顏色、數字是不是 0，都只能看圖。

寫或改 XCUITest 時的坑（`VerifyInteractionTests` 裡都有對應寫法，照抄）：

- 只有登入欄位有 identifier（`email`、`password`、`submit`），其他用畫面上的中文 label；不知道 label 就跑 `test00_DumpTree` 或在 test 裡 `note(..., app.debugDescription)`。
- List 是 lazy 的：畫面外的列不在無障礙樹裡，`exists` 是 false。先捲到它出現（`reveal`）。
- 數字鍵盤不會自己收，鍵盤擋住時清單也捲不動：按鍵盤上方的「完成」（取樹裡最後一個 label 為「完成」的按鈕）。
- 清欄位：點欄位**右端**（`coordinate(withNormalizedOffset: (0.98, 0.5))`）再按 n+2 次刪除鍵；點中間時游標可能在字首，刪除鍵什麼都沒刪。
- Picker 選單的選項會跟頁面上同名按鈕撞名（ETF 頁的「標的」選單 VOO 與 ETF 列表的 VOO）：取 `allElementsBoundByIndex.last`。
- sheet 開著時，後面的畫面仍在樹裡：名單 sheet 的 AVGO 列與總覽的 AVGO 列同名，用「label 不含 收盤」指名 sheet 那列。斷言畫面切換要看 `isHittable` 或 sheet 的導覽列消失，只看元素 `exists` 會被 sheet 後面的畫面騙。
- `xcodebuild` 測完常卡著不退出（`ios-test.sh` 看到結果行 60 秒後會停掉它），所以 xcresult 可能不完整、沒有錄影。失敗時靠 test 自己存的截圖與 `fail-*.txt`／dump，比 xcresult 可靠。

不用點擊的操作直接用 `simctl`：

- `xcrun simctl io <UDID> screenshot <路徑>` 截圖。
- 推播：`xcrun simctl push <UDID> com.audichuang.observatory <payload.json>`。
- 外觀與字級：`xcrun simctl ui <UDID> appearance dark|light`、`content_size accessibility-large|large`。

## Evidence

- 全部放在 `$RUN/evidence/web/` 與 `$RUN/evidence/ios/`，檔名用功能檔裡的子功能 ID（例如 `watchlist-add.png`、`watchlist-add.api.json`）。
- 每個證據記下：功能 ID、入口、帳號、commit（doctor 印的那個）。
- 回報（PR 描述或給使用者的訊息）寫：驗了哪些功能與入口、證據目錄、發現的問題、**沒驗到的項目與原因**。不要把沒走到的入口說成驗過。
- 證據在 `down.sh` 之後仍留著；`~/.cache` 不會自動清，舊的 run 目錄可以手動刪。

## Cleanup

```sh
"$S/down.sh" <run-id>
```

只收這次啟動的東西：dev server 的整棵程序樹（vite＋workerd，用記下的 PID，不用 process 名稱）、這次建的模擬器（刪除）、DerivedData、密碼與 cookie 檔。證據保留，腳本最後確認 `$RUN/evidence` 不是空的並印出位置。ego-browser 那邊在最後一輪呼叫 `task.finish({ keep: [] })`；忘了的話 `down.sh` 會收掉名為 `mo-verify-<run-id>` 的 task space。失敗中斷的嘗試也要跑 `down.sh`，別留下佔著 port 的 dev server。不要動別人開著的模擬器（例如 `okinawa-e2e`、`MO iPhone 18 Pro Max`）；不要用 `killall` 收 CoreSimulatorService。

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
