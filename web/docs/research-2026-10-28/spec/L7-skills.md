# L7 skills：verify 模擬器生命週期與三個維護技能（§6 #18）

> 依據 `report.md` §6 #18（來源 J-04～J-07）、`results/J-pipeline-skills.md` §5、`verify/V-J.md` 第 8、10 條與 §5。程式現況以 2026-10-28 的 HEAD `8eaac29` 為準，行號親自開檔確認。實作分支 `r1028-l7-skills`；下文的 `<worktree>` 指工作流程分配給 L7 的 worktree 根目錄（實際路徑由工作流程決定）。路徑除另註外相對於 repo 根。

## 目標

1. **verify 跟 `AGENTS.md` 一致**：iOS 驗證只重用 `MO iPhone 16 Plus` 與 `MO iPhone 18 Pro Max`，一次開一台，驗完關機並保留；腳本與文件都不再新增或刪除模擬器（J-07）。
2. **研究回合 skill**：把 2026-10-28 這一輪實際走過的流程（範圍 → 平行研究 → 逐條查核 → 整合 → 方向複查）固定下來，並擋住「研究時順手算市場歷史」：計算只在事前登記合併之後（J-04）。
3. **策略師表月檢 skill**：每月逐列查核 `web/src/lib/strategists.ts`，產出「變了／沒變／衝突／未核實」報告與候選 diff，不直接發布數字（J-05）。
4. **AI 月抽查 skill**：用 L2 #3 的批次回執判定哪些 AI 輸出真的寫進去，固定規則抽樣，逐句對照當時輸入，錯誤回填 #16 的案例；不以排程顯示 completed 當完成（J-06、N-09）。

這四件都不碰買賣、加碼、停扣、評等、目標價建議或綜合評分，也不碰 `/api/v1`、forecast 或 Orca 排程本身。

## 現況與證據

### J-07：verify 仍教新增與刪除模擬器（仍存在）

`AGENTS.md:8` 與 `features/README.md:7` 是 6a3df64（2026-10-28 08:43）加的**手動繞道**：自己把既有 UDID 寫進 `sim.udid`、不要跑 `ios-up.sh` 與 `down.sh`。腳本與其他文件沒改，所以照 skill 做仍會建新機、刪機：

| 位置 | 現在寫的或做的 |
| --- | --- |
| `.claude/skills/verify/scripts/ios-up.sh:11` | `xcrun simctl create "MO Verify $RUN_ID" … iPhone-18-Pro …`，一般 Pro，AGENTS.md 明文不用 |
| `.claude/skills/verify/scripts/ios-up.sh:8` | 本 run 已有 `sim.udid` 就 die，無法換第二台 |
| `.claude/skills/verify/scripts/down.sh:13` | `xcrun simctl delete "$UDID"`，不分來源；對既有兩台跑會刪掉 |
| `.claude/skills/verify/scripts/ios-test.sh:14` | 證據固定寫 `$RUN/evidence/ios/`；兩台跑同一個 walkthrough 時 `02-overview.png` 等同名檔互相覆蓋 |
| `.claude/skills/verify/SKILL.md:45-51` | Launch 第 3 步教建「MO Verify <run-id>」（iPhone 18 Pro） |
| `.claude/skills/verify/SKILL.md:225`、`:229-233` | Cleanup 說 down.sh 刪掉「這次建的模擬器」；`:233` 還把 `MO iPhone 18 Pro Max` 列成「別人的模擬器、不要動」，與 AGENTS.md 相反 |
| `.claude/skills/verify/SKILL.md:244` | Gotcha 以「剛建好的模擬器」為前提 |
| `.claude/skills/verify/features/README.md:7` vs `:10` | 同一節先說跳過 ios-up，下一行又說用 ios-up 建好的 MO Verify 機 |
| `.claude/skills/verify/features/push.md:22` | 前提寫「MO Verify <run-id>」模擬器 |
| `.claude/skills/verify/features/account.md:40`、`features/watchlist.md:34` | 證據路徑是平的 `evidence/ios/01-login.png`、`ios/04-watchlist.png` |

這台 Mac 現有：`MO iPhone 18 Pro Max`（3323AA1F-…，iOS 27.0）與 `MO iPhone 16 Plus`（612AC897-…，iOS 27.0），兩台都 Shutdown（2026-10-28 `xcrun simctl list devices -j`）。兩台重用的做法已在 2026-10-28 實跑通過（`ios/QA/results-2026-10-28-ui.json` UI-01～UI-04，「既有 MO 模擬器，未新增裝置」），證明重用時 App 的既有 cookie、通知權限不擋測試（`WalkthroughTests.swift:37-54`、`VerifyInteractionTests.swift:49-65` 都是「有登入畫面才登入、有權限視窗才按」）。

### J-04：沒有研究回合 skill（仍存在）

`.claude/skills/` 只有 `verify` 與安裝副本 `ios-release`。已發生的越界：上一輪 `web/docs/research-2026-10-27/prompts/P3-drawdown.txt:29-31` 問歷史校準與其他門檻比例，沒有禁止計算條款；`results/P3-drawdown.md:105-122` 自述「本次自行重算」並列六種 baseline，已登記為暴露（`web/docs/forecast.md`「外部接觸與既有暴露」一節）。V-J #8 只核實到「結果已暴露」，不核實試算確實執行過。這一輪的做法是可借的正例：`parts/_context.md:28-37` 作答規則第 4 條禁止跑新回測、`prompts/V-J.md` 查核者規格、`parts/_review-common.md` 反方審查規格。

### J-05：沒有策略師表月檢 skill（仍存在）

`web/src/lib/strategists.ts:1-3` 宣告人工月更；`:9` `STRATEGIST_TARGETS_CHECKED = "2026-10-25"`；`:12` 45 天 stale 政策；`:94` `medianEligible` 一家一票、依部門不依數字；`:121` `isStrategistStale`；`:128` `strategistTable` 同時供網頁 loader 與 `/api/v1/outlook`（`web/src/server/outlook.ts:88`、`:105`）。13 列中 3 列 `verified: true`。改任何一列都會改到 `ios/MarketObservatoryTests/Fixtures/generated/generated-outlook.json`（它含策略師列，`web/tests/api-contract.test.ts:18` 凍結了 stale 的日期），所以月檢之後必須走 fixture 更新。功能地圖 `.claude/skills/verify/features/outlook.md:14`、`:40` 描述這張表的呈現。

另外發現一個跨年風險：`medianEligible` 只看 `horizonType`，不分年份。機構開始公布 2027 年底目標時（通常 11–12 月），若把新列直接加進表，中位數會混兩個年度。這不在 #18 範圍，由 skill 在這種情況停下回報（見 L7-T3）。

### J-06：沒有 AI 月抽查，且現在的批次無法支撐抽查（仍存在，依賴 L2）

- 指定範圍內沒有月抽查產物或金標樣本（V-J #7）。
- `web/scripts/ai-batch.ts:22` 固定目錄、`:199` 每次 pull 先把 `answers.json` 清成 `{}`、`:200` 覆寫 `tasks.json`：上一批的輸入與答案會消失，事後無從核對。
- `:221-233` 缺答案只列在訊息裡、exit 0；`web/src/server/ai-batch.ts:178` 新聞 id 不存在仍 `points++`：寫入計數不是實際命中。
- `web/src/server/news-ai.ts:17-26` `latestDigests` 不回 `news_ids`。

所以抽查的「母體」（哪些輸出真的寫進 D1）與「當時輸入」都要等 L2。L2 spec 已定案的對應票：

- **L2-T1**（#3）：`importResults` 依 `db.batch` 每個敘述的 `meta.changes` 回 `accepted: string[]`、`rejected: {key, reason}[]`，`accepted` 就是 D1 實際命中。回執鍵 `translate:<newsId>`、`points:<newsId>`、`digest:<symbol>:<date>`（大盤 `SPX`，L2 spec §3-1）；整批 `ok`／`partial`／`failed`（§3-2）。
- **L2-T2**（#3）：`pull` 先把上一批的 `tasks.json`、`tasks.md`、`answers.json`、`manifest.json`、`receipt.json` 搬到 `web/.ai-batch/<kind>/runs/<runId>/`，不刪歸檔；`push` 把 server 回應存成 `receipt.json`；正文取不到的列在 `unavailable`。
- **L2-T7**（#15）：`manifest.json` 含 `runId`、`kind`、`pulledAt`、`gitCommit`、`promptSourceSha256`、schema hash、`tasksSha256`、`requestedModel`、daily 的 `snapshot.date`。
- **L2-T10**（#16）：凍結規格 `web/docs/news-ai-eval.md` 與 dev 案例目錄 `web/evals/news-ai/dev/`；規格寫明月抽查的錯誤回填到 dev、不改 holdout。

L7-T4、L7-T5 引用上面的格式；欄位名與路徑以 L2 合併進整合分支後的程式為準。

## 票

實作順序：L7-T1 → L7-T2 → L7-T3 →（L2 合併進整合分支、L7 rebase 後）L7-T4 → L7-T5。寫或改 SKILL.md、AGENTS.md 前先載入 `writing-for-agents` skill；新 skill 的觸發評估用 `skillgenie`。

### 跨領域整合規則（L7 相關）

- **L7 最後合併。** 合併前把 L7 分支 rebase 到已含其他領域的整合分支。L7-T1 與其他領域共用的檔：`.claude/skills/verify/SKILL.md`（L3-T6 改 `:124`）、`features/README.md` 與 `features/watchlist.md`（L5-T9）、`features/push.md`（L3-T8）。解衝突以整合分支上的版本為基底，只重套模擬器生命週期那幾句，不動其他領域寫的內容；票裡的行號是 `8eaac29` 的位置，rebase 後依段落內容重新定位。rebase 後重跑 `verify-sim-lifecycle.test.ts`：第 7 項會掃到其他領域新寫的功能檔。其他領域的 spec 都沒有寫 `MO Verify`、`simctl create`、`simctl delete`（2026-10-28 grep L1～L6 spec 無命中），正常情況不會被擋。
- **iOS 全域模擬器鎖。** 整個工作流程同一時間只有一個領域能開 MO 模擬器，用完 shutdown 再交下一個。L7-T1 的整合驗收也要先拿到這個鎖。新的 `ios-up.sh` 在另一台 MO 機開著時會停下，可以當成最後一道防線，但不取代工作流程的鎖：其他領域用 `xcodebuild … -destination 'name=MO iPhone 16 Plus'` 開機時不經過 `ios-up.sh`。
- **L7-T1 合併前後的流程。** 合併前，任何領域都不執行現行的 `ios-up.sh`、`down.sh`（會新增、刪除模擬器），照 `AGENTS.md:8` 的手動流程：把既有 UDID 寫進 `$RUN/sim.udid`，直接用 `ios-test.sh`，結束時自己 `xcrun simctl shutdown`。合併後手動流程停用：新的 `ios-test.sh` 也要讀 `$RUN/sim.device`，只寫 `sim.udid` 會停在「先跑 ios-up.sh <run-id> <機型>」，要改用 `ios-up.sh <run-id> 16-plus|18-pro-max`。
- **L7-T4、L7-T5 的前提**是 L2（至少 L2-T1、T2、T7、T10）已合併進整合分支，且 L7 分支已 rebase 到整合分支；不必等合併到 main。

### L7-T1　verify 只重用兩台 MO 模擬器（腳本＋文件一起改）

**行為（改完之後）**

- `ios-up.sh <run-id> <16-plus|18-pro-max>`：機型必填；缺或不在清單就停並列出兩個選項。用名稱查既有裝置（`xcrun simctl list devices -j`＋`jq`，名稱完全相符、`isAvailable`，恰好一台），找不到或不只一台就停，訊息說明「依 AGENTS.md 不新增模擬器，請使用者處理」，**絕不 create**。
- 一次一台：若有任何 `MO ` 開頭的裝置已開機、且不是本 run 的 `sim.udid` → 停（「可能有別的驗證在用；確認後 `xcrun simctl shutdown <UDID>` 再重跑」），不碰那台。若本 run 的 `sim.udid` 是另一台 → 先 shutdown 它再換機。之後 `xcrun simctl bootstatus <UDID> -b`（未開機就開、已開就等），寫 `$RUN/sim.udid` 與 `$RUN/sim.device`（機型代稱），`xcodegen generate`、`build-for-testing`、`simctl install` 照舊。
- `ios-test.sh`：證據寫 `$RUN/evidence/ios/<機型代稱>/`；`:13` 的訊息改為「先跑 ios-up.sh <run-id> <機型>」，讀不到 `sim.device` 時同樣停下（不能寫進 `evidence/ios//`）。兩台的同名截圖不再互蓋；`G4-push-ready.txt`（`:60-62`）、`B11-ready.txt`（UI test 寫進 `MO_SHOTS`）跟著進子目錄。
- `doctor.sh` 不改：「一次一台」由 `ios-up.sh` 在開機前擋，doctor 現有的「已開機、已安裝 App」檢查照舊適用。
- `down.sh`：只 `xcrun simctl shutdown`，**不 delete**，訊息「模擬器 … 已關機（保留）」；刪 `sim.udid`、`sim.device`；dev server、DerivedData、密碼、ego-browser 收尾不變。
- 機型清單（`16-plus` → `MO iPhone 16 Plus`、`18-pro-max` → `MO iPhone 18 Pro Max`）只在 `lib.sh` 定義一次，用 `case`（`/bin/bash` 是 3.2，沒有關聯陣列、`mapfile`、`${x,,}`）。
- 文件：
  - `AGENTS.md:8` 保留規則句（兩台、一次一台、shutdown 保留、不新增、不用 SE 與一般 Pro），把「`ios-up.sh` 的預設仍會新增機型……改手動關閉本輪服務與暫存。」換成「用 `ios-up.sh <run-id> 16-plus|18-pro-max` 開其中一台，`down.sh` 只關機不刪」。
  - `SKILL.md:45-51` Launch 第 3 步改寫為開既有機、換機重跑 ios-up；`:113`、`:165`、`:172`、`:222` 證據路徑加 `<機型>`；`:144` 補「兩台時先跑完 18-pro-max 的清單，再 ios-up 換 16-plus 跑同一份；`test11_DeleteAccount` 只在最後一台的最後單獨跑」（它刪帳號，第二台就登不進去）；`:225`、`:229-233` Cleanup 改為關機保留，「別人的模擬器」例子改成其他代號（例如 `OKI`、`CB` 開頭）；`:244` 措辭改為「第一次在這台機上跑」。
  - `features/README.md:7`、`:10` 合成一條一致的說法；`features/push.md:22` 改成「本輪 `ios-up.sh` 開的 MO 機」；`features/account.md:40`、`features/watchlist.md:34` 的 iOS 證據路徑加 `<機型>`。
  - 文件裡不出現 `MO Verify`、`simctl create`、`simctl delete` 字樣（要表達「不新增、不刪除」用中文說）。

**改的檔**：`.claude/skills/verify/scripts/{lib.sh,ios-up.sh,ios-test.sh,down.sh}`、`.claude/skills/verify/SKILL.md`、`.claude/skills/verify/features/{README.md,push.md,account.md,watchlist.md}`、`AGENTS.md`；新增 `web/tests/verify-sim-lifecycle.test.ts`。

**改到的符號與呼叫端**

- `ios-up.sh`（介面加必填機型）：`SKILL.md:48`、`features/README.md:7`、`:10`、`AGENTS.md:8`、`ios-test.sh:13`（訊息）、`ios-up.sh:4`（註解）。
- `down.sh`（不再刪機）：`SKILL.md:225`、`:230`、`:233`、`features/README.md:7`、`AGENTS.md:8`、`web-up.sh:16`（訊息，不用改）、`web-up.sh:47`（註解，不用改）。
- `$RUN/sim.udid`：寫 `ios-up.sh:8`、`:12`；讀 `ios-test.sh:13`、`doctor.sh:21-24`（不用改）、`down.sh:10-14`。新增 `$RUN/sim.device` 由 ios-up 寫、ios-test 讀、down 刪。
- iOS 證據目錄：`ios-test.sh:6`、`:14`、`:60-62`；`web-up.sh:41`（建上層目錄，不用改）；`SKILL.md:113`、`:165`、`:172`、`:222`；`features/account.md:40`、`features/watchlist.md:34`。UI test 由 `MO_SHOTS` 決定路徑（`WalkthroughTests.swift:10`、`VerifyInteractionTests.swift:10`），不用改 Swift。
- Orca 與 `web/` 程式都不呼叫這些腳本。

**不准碰**：`ios/**`（不改 Swift，也不改 `ios/README.md`）、`web/src/**`、`web/scripts/**`、`web/docs/**`、`.aghub/**`、`.codex/**`；不新增、刪除或 erase 任何模擬器，不開其他代號的模擬器。

**測試**：新增 `web/tests/verify-sim-lifecycle.test.ts`，用假 PATH 跑真的腳本，不碰真模擬器：

- 臨時 `MO_VERIFY_ROOT`，每個 case 寫自己的 `state.env`（`DEV_PID` 用不存在的 PID）。
- 假件目錄放 `xcrun`、`xcodegen`、`xcodebuild`：每次呼叫把參數記進 log；`xcrun simctl list …` 印出該 case 的裝置 JSON（兩台 MO 機＋一台 `OKI iPhone 17` Booted），其他子命令 exit 0。`PATH=<假件>:/usr/bin:/bin`，用 `/bin/bash` 執行。
- **先斷言 PATH 下的 `xcrun` 是假件**，不是就直接 fail：修正前的 `ios-up.sh` 會真的 `simctl create`，假件沒生效時不能讓它跑到真的 xcrun。
- 斷言（★ 為修正前會失敗）：
  1. ★ `ios-up.sh r1 18-pro-max`：log 沒有 `simctl create`；`sim.udid` 等於清單裡 Pro Max 的 UDID；開機指令對的是那台；log 沒出現 OKI 那台的 UDID。
  2. ★ 本 run `sim.udid` 是 Pro Max（裝置 JSON 標 Booted）時跑 `ios-up.sh r1 16-plus`：log 先 `simctl shutdown <ProMax>` 再開 Plus；`sim.udid` 換成 Plus。（修正前 `:8` 直接 die。）
  3. ★ 別的 run 讓 Plus 開著時跑 `ios-up.sh r2 18-pro-max`：exit ≠ 0，log 沒有開 Pro Max、沒有 shutdown Plus。
  4. ★ `ios-up.sh r3`（沒給機型）與 `ios-up.sh r3 pro`：exit ≠ 0，沒有 `simctl create`。
  5. ★ 裝置 JSON 沒有 `MO iPhone 18 Pro Max`：`ios-up.sh r4 18-pro-max` exit ≠ 0，沒有 `simctl create`。
  6. ★ `down.sh r1`（`sim.udid`＝Plus）：log 有 `simctl shutdown <Plus>`、沒有 `simctl delete`；`sim.udid`、`sim.device` 已刪；`evidence/` 裡的檔還在。
  - `ios-test.sh` 要登入本機站，不在這支測試裡跑；它的證據子目錄由整合驗收的真機操作確認。
  7. ★ 文件一致：`SKILL.md`、`features/*.md`、`AGENTS.md` 都不含 `MO Verify`、`simctl create`、`simctl delete`；`SKILL.md` 同時提到 `16-plus` 與 `18-pro-max`。

**合併基底**：見上方「跨領域整合規則」。L7-T1 可以先在 L7 分支實作，合併前 rebase 到已含 L3-T6、L3-T8、L5-T9 的整合分支，只重套模擬器生命週期的句子，rebase 後重跑本票全部驗收。

**驗收**（`<worktree>` 為 L7 的 worktree 根目錄）

```sh
cd <worktree>/web && npx void prepare
cd <worktree>/web && npm run typecheck
cd <worktree>/web && node --test tests/verify-sim-lifecycle.test.ts
cd <worktree>/web && npm test
cd <worktree>/.claude/skills/verify/scripts && shellcheck -s bash -S error lib.sh ios-up.sh ios-test.sh doctor.sh down.sh
```

（`-S error` 是因為現有腳本本來就有 SC2164 warning，與本票無關；基準已確認 `-s bash -S error` 通過。）

**整合驗收（真機操作）**：先拿到工作流程的 iOS 全域模擬器鎖，在整合分支的乾淨 worktree，開始前與結束後各跑一次 `xcrun simctl list devices | grep "MO "`，兩次都只有那兩台、結束時都 Shutdown，`grep -c "MO Verify"` 為 0。中間：`web-up.sh` → 網頁註冊測試帳號 → `ios-up.sh <run> 18-pro-max` → `doctor.sh` 全 ✓ → `ios-walkthrough.sh` → `ios-up.sh <run> 16-plus`（確認 Pro Max 先被關機）→ `ios-walkthrough.sh` → `down.sh`。`$RUN/evidence/ios/18-pro-max/02-overview.png` 與 `16-plus/02-overview.png` 都在，兩張都要看；總覽數字與同帳號 `/api/v1/overview` 對得上。

**功能地圖**：`features/README.md`、`features/push.md`、`features/account.md`、`features/watchlist.md`。

### L7-T2　研究回合 skill＋專案 skill 結構測試

**行為**：新增 `.claude/skills/research-round/`。使用者說「開一輪新研究」「深度研究」「派 agent 研究其他機構怎麼判斷」「核實某主張」「評估新條件或新資料」時載入；修錯字、單純改文件、實作已定的 spec 不載入。SKILL.md 內容：

1. **範圍登錄**：建 `web/docs/research-<YYYY-MM-DD>/`，寫 `parts/_context.md`（使用者原話、決策問題、現有功能、現行立場、已研究過的排除清單、作答規則）與各面向 `parts/<ID>.md`，組成 `prompts/<ID>.md`。現行立場與排除清單**引用** `web/docs/forecast.md` 的章節與上一輪 report 的「刻意不做的事」，不抄門檻。寫明「範圍登錄不是計算授權」。
2. **平行研究**：每個面向派一個 Codex（用 `codex` skill），只寫 `results/<ID>-<slug>.md`，原始回覆存 `logs/`；共用同一份背景與禁止計算條款。
3. **逐條查核**：每份結果另派一個查核者（`prompts/V-<ID>.md`），最多 15 條關鍵主張，判定已核實／部分／被推翻／無法核實，寫 `verify/V-<ID>.md`；不以「另一個 agent 說驗過」代替讀來源。
4. **整合**：整合者讀摘要與查核，親自抽查影響最大的主張（寫明抽了哪幾條），寫 `report.md`；結構沿用 2026-10-28：怎麼做、結論、現況缺口（含 file:line）、優化方向（P0／P1／P2，標服務哪個決策與要不要事前登記）、刻意不做、未處理風險、方向複查、需要使用者決定的事、查核計數。
5. **方向複查**：派 R1 證據與規則紀律、R2 工程可行性、R3 使用者價值三個反方審查者；每條 finding 由沒參與的代理試著推翻，推翻不了才改，處置寫進 report。
6. **暴露帳本**：report 內一節，列本輪看到的市場結果（文獻數字、既有計算），欄位照 `forecast.md`「外部接觸與既有暴露」那張表（日期、內容、期間、結果、出處）。日後起草新登記時照抄進該登記的暴露表；已合併的列不改。
7. **計算閘門**：研究階段不跑任何市場歷史回測或探索統計，包括「順手算一下」；需要的計算寫成「建議事前登記的計算」附定義與門檻。只有登記合併後（`forecast.md` 第二輪開頭：「本節合併進 main 即為登記」）才可執行，執行者核對合併 commit hash、reference commit、輸入資料 hash、target 與精確命令，順序照 `forecast.md` 的「執行順序」。門檻、名額、虛無組數只引用章節名，不寫進 skill。
8. **停止條件**：文獻不足就寫「未找到」，不自動消耗試驗名額；沒有授權不改程式、不 commit；交接物是 report 的方向清單（之後走 to-spec／build-crew）。
9. **反例**：上一輪 P3（`web/docs/research-2026-10-27/prompts/P3-drawdown.txt`、`web/docs/research-2026-10-27/results/P3-drawdown.md`）。

另有 `references/templates.md`：從 2026-10-28 的 `parts/_context.md`「作答規則」「輸出格式」、`prompts/V-J.md`、`parts/_review-common.md` 抽出**與日期無關**的通用範本（研究者作答規則、查核者任務、反方審查任務）；當輪背景每輪重寫。`evals/evals.json` 照 `.aghub/ios-release/evals/evals.json` 的格式（`skill_name`、`evals[]` 含 `id`、`name`、`prompt`、`expected_output`、`files`），至少三案：

- 正例：「開一輪新研究：專業機構怎麼看個股估值，派 Codex 平行查，最後給我優化方向」→ 建目錄、範圍登錄含禁止計算條款、查核、複查，不跑市場計算。
- 越界例：「研究 dd5 時順便用 SPX 歷史算一下 RV 在 80 分位以上的 dd5 發生率給我參考」→ 會載入，但拒絕在研究階段計算，改寫成建議事前登記的計算並指向 `forecast.md`。
- 不觸發：「把 report.md §6 #12 的錯字修掉」→ 直接改字。

**新增測試 `web/tests/project-skills.test.ts`**（之後的 T3、T5 擴充它）：

- 掃 repo 根 `.claude/skills/` 下**不是 symlink** 的目錄（`ios-release` 是 aghub 安裝副本，在新 worktree 不存在，略過）。
- 每個 skill：`SKILL.md` 有 frontmatter，`name` 等於目錄名，`description` 非空且 ≤ 1024 字元。
- 該 skill 底下所有 `*.md`：反引號內以 `web/src/`、`web/scripts/`、`web/docs/`、`web/tests/`、`web/db/`、`web/routes/`、`web/pages/`、`.claude/skills/`、`ios/MarketObservatory` 開頭的路徑（去掉 `:行號`；含 `<`、`*`、`{` 的略過）要存在；Markdown 相對連結要解析得到（略過 `http(s)://`、`mailto:` 與只有 `#錨點` 的連結）。不用裸的 `ios/` 前綴：`features/watchlist.md:34` 的 `ios/04-watchlist.png` 是證據目錄裡的相對路徑，會誤報。以這組前綴手動跑過現有 verify，沒有誤報。
- 有 `evals/evals.json` 的：`skill_name` 等於目錄名、至少 3 案、每案有 `id`、`name`、`prompt`、`expected_output`。
- 必備清單 `REQUIRED = ["verify", "research-round"]`，除 verify 外都必須有 evals。
- `research-round` 底下所有 `*.md` 不得出現 `0.025`、`0.045`、`N = 199`、`k=40`、`k = 40`、`0.011`（J §5.1：門檻只在 `forecast.md`）。
- 修正前會失敗：`research-round` 目錄不存在 → 必備清單斷言失敗。

**改的檔**：新增 `.claude/skills/research-round/SKILL.md`、`.claude/skills/research-round/references/templates.md`、`.claude/skills/research-round/evals/evals.json`、`web/tests/project-skills.test.ts`。

**驗收**：

```sh
cd <worktree>/web && npx void prepare
cd <worktree>/web && npm run typecheck
cd <worktree>/web && node --test tests/project-skills.test.ts
cd <worktree>/web && npm test
```

觸發行為另用 `skillgenie` 跑 evals.json 的三案，留 transcript；結構測試只證明檔案結構，不證明會觸發。

### L7-T3　策略師表月檢 skill

**行為**：新增 `.claude/skills/strategist-monthly-check/`。觸發：每月查核、使用者指出某列過期或錯、機構公布新年度目標。不觸發：改中位數規則、展望頁畫面問題。SKILL.md 內容：

1. **列現況**：在 `web/` 用 `node --input-type=module -e` import `web/src/lib/strategists.ts` 的 `STRATEGIST_TARGETS`、`STRATEGIST_TARGETS_CHECKED` 與 `strategistTable(…, 今天)`，印出每列機構、部門、目標或區間、`horizon`、`asOf`、`verified`、`verifiedOn`、`stale`、`inMedian`。
2. **逐列查核**：先找機構官方原文（研究頁、PDF、新聞稿），打不開才用 Reuters factbox 或主要媒體，並標「二手」。記：原文目標期間、點估計或區間（區間就記中點並標 `targetIsMidpoint`）、首次調整日與發布／重申日分開、來源網址與實際看到的段落。
3. **判定**：changed／unchanged／conflict／unverified。沒讀到一手原文不能標 verified；搜尋沒看到更新 ≠ unchanged，記 unverified；來源互相矛盾記 conflict，不擇一；同一家不同部門分開（UBS Global Research／UBS GWM、Wells Fargo Securities／WFII），中位數規則照 `medianEligible`，不依數字高低挑。
4. **報告**：寫 `web/docs/strategist-checks/<YYYY-MM-DD>.md`：逐列表格＋候選 diff。沿用 `STRATEGIST_STALE_DAYS`，不另訂時限。
5. **套用（使用者同意後才做）**：改 `web/src/lib/strategists.ts`；`STRATEGIST_TARGETS_CHECKED` 只有每一列都查過才改成查核日。依序跑 `node --test tests/strategists.test.ts`、`node --test tests/api-contract.test.ts`；後者失敗且差異只在策略師列時，用 `MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts` 更新、審 `ios/MarketObservatoryTests/Fixtures/generated/generated-outlook.json` 的 diff、跑 iOS `MarketObservatoryTests`；再照 `.claude/skills/verify/features/outlook.md` 的 `outlook-strategists` 在網頁與 App 看展望頁。
6. **跨年停止**：要放進不同年份的年底目標（例如 2027 年底）時停下回報：`medianEligible` 不分年份，混入會讓中位數混期限，要另開票改程式。
7. **不做**：放進機率或任何條件（X03，永不進機率）；算策略師命中率或排行（10-27 的 U-05 要另登記）；排程自動發布。

`evals/evals.json` 至少三案：正例「這個月的策略師目標價幫我月檢」；越界例「順便把各家投行過去一年的命中率排個名」（拒絕並說明要另登記）；不觸發「展望頁 dd5 的數字跟 API 對不上，幫我查」。

**改的檔**：新增 `.claude/skills/strategist-monthly-check/SKILL.md`、`.claude/skills/strategist-monthly-check/evals/evals.json`；改 `web/tests/project-skills.test.ts`（`REQUIRED` 加 `strategist-monthly-check`）。

**測試**：`REQUIRED` 加入後，目錄不存在時失敗；結構測試會檢查 SKILL.md 引用的 `web/src/lib/strategists.ts`、`web/tests/api-contract.test.ts`、`.claude/skills/verify/features/outlook.md` 存在。觸發用 `skillgenie` 跑三案。

**驗收**：同 L7-T2 的四條指令（`node --test tests/project-skills.test.ts`）。本票不跑第一次月檢，也不改策略師資料。

### L7-T4　AI 月抽查的抽樣腳本（等 L2）

**為什麼要腳本**：J §5.1 要求確定性的步驟由程式做；J-06 要求抽樣規則先固定、保存抽樣全集。讓模型手算雜湊排序容易錯，也無法重現。

**行為**：新增 `web/scripts/ai-audit-sample.ts`，本機跑、唯讀、不連網、不登入、**不 import `web/scripts/ai-batch.ts`**（它在模組頂層就登入）。

```text
node scripts/ai-audit-sample.ts --month YYYY-MM [--batches <目錄>] [--case <回執鍵> …] [--out <檔>]
```

- `--batches` 預設為主 checkout（`git worktree list --porcelain` 第一筆）的 `web/.ai-batch`（Orca 的工作目錄，只讀）。腳本讀每個 `<kind>/runs/<runId>/` 歸檔，**也讀還沒歸檔的 `<kind>/` 工作檔**：L2-T2 只在下一次 `pull` 才歸檔，最新一批還在工作目錄。檔名照 L2-T2、L2-T7（`tasks.json`、`answers.json`、`manifest.json`、`receipt.json`）。
- **覆蓋**：用 `web/src/lib/calendar.ts` 的 `expectedSessions` 列出當月（到今天為止）交易日。daily 批次用 `manifest.json` 的 `snapshot.date` 對到交易日（不用 pull 時間）；translate 批次用 `pulledAt` 的日期。依回執的整批狀態列出沒有批次、`partial`、`failed` 的日子。只看回執，不看 Orca 的 completed。
- **母體**：回執 `accepted` 的項目（L2-T1 的 `accepted` 已是 D1 `meta.changes > 0` 的實際命中，腳本不另做 DB 檢查），依回執鍵分三類：digest（`digest:<symbol>:<date>`，公司與大盤 `SPX`）、translate（`translate:<newsId>`）、points（`points:<newsId>`）。missing、rejected、`unavailable`（正文取不到）列入「問題案例」，不進母體；同一個鍵同時出現在 missing 與 rejected（L2-T1 把缺答案的翻譯也列 rejected）時只列一次，兩個原因都記。`--case` 指定的使用者回報（直接給回執鍵，例如 `digest:NVDA:2026-11-18`）也列入問題案例，不占抽樣名額。
- **抽樣**（看內容前就固定）：排序鍵＝`sha256("<YYYY-MM>|<回執鍵>")` 升冪。digest 先依序補齊格子：大盤 SPX、tone positive、tone negative、tone neutral、新聞不足（公司輸入新聞只有 1 則；大盤的新聞標題 0 則）、輸入含「財報」類別；每格取排序最前且還沒選的一筆，沒有就記不足。再依排序補到 10 篇（10-27 N-09 的每月 10 篇，維護政策，不是統計樣本量）。translate 與 points 各依排序取 10 則（起始政策，使用者可調）。不足就全列並記不足。
- **輸出**：JSON（鍵順序固定），含月份、規則說明、覆蓋、三類母體全集、樣本、不足、問題案例；有 `--out` 就寫檔，否則印到 stdout。參數錯誤 exit 2；母體為空也 exit 0（這是報告，不是閘門）。

**改的檔**：新增 `web/scripts/ai-audit-sample.ts`、`web/tests/ai-audit-sample.test.ts`（fixture 寫在測試裡或 `web/tests/fixtures/ai-audit/`）。只 import `web/src/lib/calendar.ts` 的 `expectedSessions`（`:49`），以及 L2 匯出的回執型別（若有，例如 `web/scripts/ai-batch-lib.ts`；那支檔 import 時不登入、不打網路），不改它們。

**測試**（新功能；以子程序執行腳本，比照 `web/tests/backfill-script.test.ts`；fixture 照 L2-T2 的歸檔目錄與 L2-T1 的回執鍵合成）：

1. 同一份輸入跑兩次，輸出逐字相同。
2. fixture 各格都有時，10 篇 digest 含 SPX、三種 tone、新聞不足、財報各至少一篇。
3. 只有 4 篇 accepted digest：4 篇全選，並記數量不足與缺的格子。
4. 回執 rejected、missing 或 unavailable 的 digest 不在母體，在問題案例裡。
5. `--case digest:NVDA:2026-11-18` 出現在問題案例，不在樣本裡。
6. 當月只有部分交易日有批次、其中一天 partial：覆蓋列出缺的日子，該天標 partial。
7. `HOME` 指向空的臨時目錄、沒有 `MO_EMAIL`／`MO_PASSWORD` 也正常結束（證明沒登入、沒讀 1Password）。
8. 最新一批只在 `<kind>/` 工作目錄、還沒歸檔：它的 accepted 項目在母體裡。

**驗收**：

```sh
cd <worktree>/web && npx void prepare
cd <worktree>/web && npm run typecheck
cd <worktree>/web && node --test tests/ai-audit-sample.test.ts
cd <worktree>/web && npm test
```

**阻擋**：L2-T1、L2-T2（#3 回執與歸檔）與 L2-T7（#15 manifest）已合併進整合分支，且 L7 分支 rebase 到整合分支後才實作（不必等合併到 main）。欄位名、目錄結構以 L2 合併後的程式為準，本票不自己定義回執格式。L2 不自動清理歸檔（L2 spec §5），保存期限足以涵蓋下個月的抽查；若之後 L2 改成會清理，回報 L2，不在本票加保存機制。

### L7-T5　AI 月抽查 skill（等 L2 與 L7-T4）

**行為**：新增 `.claude/skills/ai-monthly-audit/`。觸發：每月抽查、使用者回報某則 AI 摘要或翻譯有誤、回執出現 partial／rejected、換模型或改提示詞上線後。不觸發：只問排程有沒有跑（看回執與 Orca 狀態）、要改提示詞（走 #16 的離線 eval）。SKILL.md 內容：

1. 在 `web/` 跑 `node scripts/ai-audit-sample.ts --month <YYYY-MM> --out <檔>`，把輸出原樣附在報告；先記覆蓋缺口（沒有批次、partial、失敗的交易日）。
2. 對每個樣本找當時的輸入（L2-T2 歸檔的 `tasks.json`，L2-T7 的 `manifest.json` 記提示詞 hash 與 `requestedModel`）。把 AI 輸出拆成句子層級的主張，逐條標 supported／contradicted／unsupported／不可判定，附定位（runId／回執鍵／輸入段落序號）。只用當時輸入判斷；找不到當時輸入就是不可判定，不用今天改版後的文章回溯。
3. 錯誤類型：錯公司、錯數字或單位、反轉原意、無出處的因果句、用盤後消息解釋收盤、未知時間被當成盤前、投資建議越界。前三類與後四類都列為重大錯誤。逐條寫能否重現（manifest 有沒有當批的提示詞 hash 與模型）、要不要回填成 #16 的案例。
4. 問題案例另列，不混入 10 篇樣本。
5. 報告寫 `web/docs/ai-audit/<YYYY-MM>.md`：覆蓋、抽樣全集與規則（腳本輸出）、主張帳、錯誤彙總、待修正清單、回填的案例。新聞原文不抄進 repo，只寫定位（授權見 #17）；自家 AI 輸出可引用。
6. **錯誤回填（L2-T10）**：照 `web/docs/news-ai-eval.md` 的案例格式寫進 `web/evals/news-ai/dev/`，當回歸案例。dev 案例是虛構公司與合成新聞，回填時要改寫成合成案例：保留失敗的樣態（例如盤後同日消息被寫成收盤原因），不抄原文、不用真實公司的原句。只進 dev，不碰 `web/evals/news-ai/holdout/` 與 `holdout.lock.json`（改 holdout 要站長重新登記）。回填的案例檔要使用者同意才 commit；改提示詞照 `news-ai-eval.md` 的流程，不在月抽查裡做。
7. 規則：不改正式 D1；要更正內容由使用者決定，只能走 `scripts/ai-batch.ts`＋`/api/admin/ai`（`web/AGENTS.md`）；抽查時不要執行 `scripts/ai-batch.ts` 的 pull 或 push（pull 開新批次、push 寫正式站）。不訂「原因不明」的理想比例，抽到不扣分。全部通過只代表這批沒發現，不能說全站零錯誤。

`evals/evals.json` 至少四案：正例「做 11 月的 AI 摘要月抽查」；問題案例「使用者說 11/18 NVDA 的『今天為什麼漲跌』拿盤後財報解釋收盤，幫我查」（列為問題案例、對照當時輸入、改寫成合成案例回填 dev）；越界例「原因不明太多，改提示詞讓它少寫原因不明」（拒絕調比例，改提示詞走 `news-ai-eval.md` 的流程）；不觸發「每日 AI 重點的排程今天有沒有跑？」。

**改的檔**：新增 `.claude/skills/ai-monthly-audit/SKILL.md`、`.claude/skills/ai-monthly-audit/evals/evals.json`；改 `web/tests/project-skills.test.ts`（`REQUIRED` 加 `ai-monthly-audit`；路徑檢查前綴加 `web/evals/`）。

**不准碰**：`web/docs/news-ai-eval.md`、`web/evals/news-ai/**`（只引用）、`web/scripts/eval-news-ai.ts`、`web/scripts/ai-batch.ts`、`web/scripts/ai-audit-sample.ts`、`web/.ai-batch/**`。

**測試**：`REQUIRED` 加入後目錄不存在時失敗；結構測試檢查 SKILL.md 引用的 `web/scripts/ai-audit-sample.ts`、`web/scripts/ai-batch.ts`、`web/routes/api/admin/ai.ts`、`web/docs/news-ai-eval.md`、`web/evals/news-ai/dev/` 存在（`web/evals/` 前綴是本票加的）。觸發用 `skillgenie` 跑四案。

**驗收**：同 L7-T2 的四條指令（`<worktree>/web`）。

**阻擋**：L2-T1、T2、T7、T10 已合併進整合分支，L7 分支 rebase 到整合分支後，且 L7-T4 已合入本分支。

## 已修好或已存在（不重做）

- J-07 的 ios-release「先綁定專案」：`.aghub/ios-release/SKILL.md:17` 第 0 節已先綁定專案，`references/projects.md:5` 定 repo 優先、`:21` 寫明市場觀測室只有手動上傳、時間戳 build 號沒有衝突（V-J #10 已把這部分降為「釐清既有例外」）。
- 兩台重用的**規則**已在 `AGENTS.md:8`（6a3df64），但腳本與 skill 文件沒跟上，所以 J-07 本身仍要做（L7-T1）。

## 刻意排除與理由

| 排除 | 理由 |
| --- | --- |
| 修改 ios-release skill | 安裝副本，`.aghub/ios-release/SKILL.md:14-15` 規定改 repo 外的正本 `~/Project/audi-skill/ios-release`；V-J #10 指出專案路由已存在；#18 只點名 verify |
| J-07 的「verify 增補 AI 缺摘要、舊日期、來源入口案例」 | 屬呈現功能，由實作 §6 #4（R3-5 摘要日期）與 #15（摘要參考來源）的票更新 `features/news-calendar.md`，避免兩個 lane 改同一個功能檔 |
| `ios/README.md:42` 的 `simctl shutdown all` 與 `killall CoreSimulatorService` | 會關到別的專案的模擬器，與 SKILL.md:233 牴觸，但不在 #18；記下來另案處理 |
| 為月檢、月抽查新增 Orca 排程 | 規則是不改 Orca；排程屬正式設定，由使用者決定要不要加；skill 先人工觸發 |
| 本輪就跑第一次策略師月檢與 AI 月抽查 | 是維護工作，不是實作；月抽查要等 L2 保存足夠的批次 |
| J-08 財報事實變更卡 | 不在 #18（對應 P2 #24，要先有 #16） |
| 把新 skill 連到 `.codex/skills` | 那裡是 aghub 管理、沒進版控的安裝目錄，verify 也沒連；這些 skill 給主控的 Claude Code session 用 |
| 改 `doctor.sh`、或為重用機加 uninstall／重設 App 資料 | 「一次一台」已由 `ios-up.sh` 在開機前擋；2026-10-28 兩台實跑已證明既有 App 狀態不擋測試，指不出會失敗的輸入 |

## 風險

- **bash 3.2**：`/bin/bash` 是 3.2.57；腳本與測試都用它。`lib.sh` 有 `set -euo pipefail`，`jq` 用 `/usr/bin/jq`（`ios-test.sh` 已依賴，不是新依賴）。
- **併行的 lane**：iOS 驗證受工作流程的全域模擬器鎖管制，一次只有一個領域開機（見「跨領域整合規則」）。新 `ios-up.sh` 在另一台 MO 機開著時會停下，是最後一道防線，不取代鎖。
- **L7 最後合併**：L7-T1 與 L3-T6、L3-T8、L5-T9 改同一批 verify 文件；rebase 時若誤刪對方段落，結構測試抓不到（只掃模擬器字樣），整合者要對照 L3、L5 的票檢查那幾段還在。
- **沒有這兩台機的 Mac**（例如 Mac mini）：`ios-up.sh` 會停下，要使用者決定；不會像以前一樣自動建機。
- **證據路徑改變**：iOS 證據多一層 `<機型>/`；舊 run 的目錄不動。手冊與功能檔一起改，外部筆記若寫死平的路徑要對照。
- **重用機保留 App 資料**：cookie、通知權限、UserDefaults 會留到下一輪；測試已處理（見現況），若之後有測試假設全新安裝要另外處理。
- **skill 成效 `none`**：結構測試只證明檔案與引用正確；是否在對的時機觸發、會不會越界，只有 transcript（skillgenie 評估）能證明。
- **研究回合 skill 與 `forecast.md` 漂移**：skill 只引用章節名，章節改名時結構測試抓不到，要靠下次 `/maintain-verification-skill` 類的對帳。
- **策略師表跨年**：2027 年底目標很快會出現，`medianEligible` 不分年份；skill 只負責停下回報，程式修正要另開票。
- **L7-T4 是 #18 唯一的新程式**：理由是 J §5.1（確定性步驟交給程式）與 J-06（抽樣規則先固定、保存抽樣全集）。審查若判定過度，可降級為 skill 內的手動程序：候選鍵逐行 `printf '%s' "<YYYY-MM>|<回執鍵>" | shasum -a 256` 後 `sort`，照同樣的格子順序人工挑；L7-T5 只要把呼叫腳本那一步換成這段，不用重新規劃。
- **AI 月抽查依賴本機保存**：資料在跑 Orca 的那台 Mac 的主 checkout（`web/.ai-batch/<kind>/runs/`）；L2 不自動清理，但手動清掉的批次只能標不可判定。抽查報告不含新聞原文，日後重查要靠那台機的保存；回填 dev 的案例是合成改寫，不是原文。
- **部署與 Orca**：L7 不改部署的程式、不改 `scripts/ai-batch.ts` 的 CLI，部署時主線不用同步任何 Orca 設定。

## 審稿處置

| # | 問題 | 判定 | 處置 |
| --- | --- | --- | --- |
| 1 | iOS 驗收搶同一台模擬器；L7-T1 合併前照 verify 跑會新增、刪除模擬器 | 成立（鎖由工作流程實作） | 新增「跨領域整合規則」：全域模擬器鎖、L7-T1 合併前一律手動流程、合併後手動流程停用（新 `ios-test.sh` 要 `sim.device`）；L7-T1 整合驗收先拿鎖；風險改寫 |
| 2 | `api-contract.test.ts` 種子與 `generated-*.json` 多領域衝突 | 對 L7 不成立 | L7 沒有任何票改這兩處，L7-T3 只在 skill 裡寫日後月檢的 fixture 更新程序，與審稿者的整合規則一致；L7 合併後重產 fixture 應該沒有 diff。L2 spec 的行號由 L2 自己改 |
| 3 | 多領域改同一檔或區塊 | 成立 | L7 的重疊是 verify 文件：`SKILL.md`（L3-T6）、`features/README.md` 與 `features/watchlist.md`（L5-T9），另補審稿者沒列的 `features/push.md`（L3-T8）。L7-T1 只改模擬器生命週期的句子，其他段落以整合分支為準 |
| 4 | 絕對路徑、T4／T5 前提照字面永遠開不了工、T5 沒連到 L2-T10 | 成立 | 所有驗收改 `<worktree>`；T4、T5 前提改成「L2 合併進整合分支、L7 rebase 後」，dependsOn 改成具體票號 L2-T1、T2、T7（T5 再加 T10）；T5 引用 `web/docs/news-ai-eval.md` 與 `web/evals/news-ai/dev/`，回填改寫成合成案例、只進 dev。同時把 T4 綁到 L2 已定的格式：排序鍵與 `--case` 用 L2 回執鍵（原本 translate／points 沒有日期，鍵定義不清），母體只看 `accepted`，覆蓋用 `snapshot.date`，也讀尚未歸檔的工作目錄 |
| 5 | 驗收指令夾中文說明、相對路徑 | 成立，L7 原本就是純指令 | 只換成 `<worktree>` 佔位，沒有尾端說明要移 |
| 6 | L7-T1 與 L3-T6、L5-T9 同改 verify 文件 | 成立 | L7 最後合併；L7-T1 可先在 L7 分支實作，合併前 rebase 到已含 L3、L5 的整合分支，以整合分支的檔為基底只重套模擬器句子，rebase 後重跑驗收。「L3-T6 改 `:124` 時不碰 Launch／Cleanup 段」屬 L3 的票，L7 不改 |
