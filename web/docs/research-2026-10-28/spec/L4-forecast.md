# L4 展望模型（forecast）實作規格

> 範圍：`report.md` §6 P0 #8（R2-5 dd5 cell 閘門、R2-4 相位平均主報、R2-6 dd5 上線後紀錄、`forecast.md` 文件修正）與 #9（前瞻發布資格）。來源 ID：A-01、A-02、A-03、A-14、B-03、DOC-1。
> 路徑預設相對於 `web/`；`ios/`、`.claude/` 相對於 repo 根。行號以 HEAD `8eaac29` 為準。驗收指令的 `<worktree>` 是本 lane 的 worktree 根目錄；指令裡的 `main` 指本 lane 開分支時的基底（從 main 開出）。
> 使用者已定：維持 X03（展望不是加碼或停扣訊號）。本 lane 不改 `DEFAULT_MODEL` 的旗標、候選、門檻、收縮或 bootstrap 參數，不跑 `scripts/backtest.ts`，不對 `.backtest/*.csv` 或正式 D1 做任何計算。

## 1. 目標

1. dd5 的「已計分」改照已登記的 R2-5（G09 修訂一）：全域條件之外，今天所選 cell 的 offset 0 閘門也要通過；每筆紀錄看得出 (a)–(d) 的值與未通過原因。
2. 展望頁的 BSS 主報改為相位平均（R2-4／L02），附資料日與模型版本，不寫成頁面常數；offset 0 的數字保留並標「單一相位（offset 0）」。
3. dd5 的上線後實際紀錄照 R2-6 上線：紀錄存 dd5 專屬版本與 regime／basis／historyStart，頁面分「即時發布／延遲補記／資格不明」，依版本分組計分。
4. 在發布資格新條目合併前，不把 lag=0 的列稱為乾淨的即時紀錄；條目合併後，P(up) 與 dd5 的前瞻紀錄都改用「讀 `created_at`、比對排程當時應有收盤日」的資格。
5. `forecast.md` 的文件與實作對齊：第二輪標題改「已登記」、現行設計改寫為 k=40 收縮、R2-10 指定的文獻更正標待核。

## 2. 現況與證據（全部在 HEAD 仍存在，沒有已修好的項目）

| 項目 | 現況 | 證據 |
| --- | --- | --- |
| A-02 dd5 cell 閘門 | `drawdownScored` 只看全域 bssLow 與所用條件的 nEff／段數；`buildOutlook` 另外算了 dd5 的 `cellGate` 卻沒接進 `scored`。V-A 以合成輸入得到 `scored=true, gate=false` | `src/lib/forecast.ts:611-614`、`:748`；`targetOutlookOf` 同樣 `:709`；規則 `docs/forecast.md:148` |
| A-03 單一相位主報 | 展望頁 KPI 與兩個滾動驗證面板直接用 `buildOutlook` 的 offset 0 evaluation，沒標相位；相位平均只存在離線工具 | `src/lib/forecast.ts:721`、`:725`；`pages/outlook.tsx:168-169`、`:198-201`；`ios/MarketObservatory/Views/MoreView.swift:457-464`；離線 `src/lib/forecast-eval.ts:172`、`:200`；規則 `docs/forecast.md:147` |
| A-01／B-03 前瞻資格 | `recordForecast` 只比對資料庫最後 5 個 SPX 日的相對位置算 lag；`created_at` 有存但沒人讀；頁面的 P(up) 上線後紀錄 SELECT 只取 `date,p,base,close`，`liveTrackOf` 只看格點與到期 | `src/server/jobs.ts:520`、`:546`、`:554`、`:558-563`；`src/server/outlook.ts:63-64`；`src/lib/communication.ts:41-61` |
| R2-6 dd5 前瞻紀錄 | `detail.drawdown` 只有 `p/base/scored/cellGate`，沒有 dd5 專屬 `modelVersion`、regime、basis、historyStart；頁面只有 P(up) 一條 liveTrack | `src/server/jobs.ts:562`；`src/server/outlook.ts:64`、`:96`；規則 `docs/forecast.md:149` |
| lag=0 不等於即時 | V-A 合成重現：DB 最新 2040-01-06、時鐘 2040-01-13T23:00Z，仍寫 `recordedLagSessions=0` | `verify/V-A.md:75`；`verify/V-B.md:59` |
| DOC-1 | 第二輪標題仍寫「草稿，未合併前不得執行」，實際已隨 `955d8d3`（2026-10-28 08:37:20 +0800，PR #35）合併 | `docs/forecast.md:116`；`verify/V-A.md:7` |
| A-14 現行設計 | 仍寫「條件機率只在 Wilson 區間不含基準率時才採用」，實作 `shrinkK=40` 後一律收縮，`distinct` 只供方向閘門；bootstrap 寫「區塊」實為 G08 stationary；沒提 dd5 | `docs/forecast.md:7-10`；`src/lib/forecast.ts:90`、`:306-313`；正確描述已在 `src/lib/communication.ts:83-88` |
| R2-10 文獻更正 | BTZ 列仍標 `academic_oos（有爭議）`，§8 自己記了原文是全樣本樣本內但「等級還沒跟著改」；技術均線、C-D、Citi 列也未照 M-07 更正 | `docs/forecast.md:153`、`:210`、`:240-242`、`:374`；指定內容 `docs/research-2026-10-27/proposal.md:227` 與 `codex-review.md:48` |
| 第二輪執行順序 | `:180` 字面把「以合成資料驗證 target 隔離、R2-3a 合成資料檢查」排在「R2-5 與 R2-6 程式上線」之前；`:120` 規定第二輪只能以新編號條目修改。兩份複查都把 R2-3a 讀成名額 A 的先決條件，但這是解讀，不是登記 | `docs/forecast.md:120`、`:180`；`review/R1-evidence.md:32`；`review/R2-engineering.md:66` |

另外查到、會影響實作的事實：

- `cellEvaluations` 的 `runs` 是「連續區段個數」，(d) 是「先重抽完整列序列再篩 cell」、空重抽跳過、有效重抽 < 1900 為 null，正好就是 R2-5 (b)(c)(d) 的寫法（`src/lib/forecast.ts:433-479`、`:625-630`）。R2-5 的程式改動因此只是把 `cellGate.passed` 接進 `scored`，不用改閘門算法。
- 總覽卡片的「未通過驗證」讀的是**存下的** `detail.drawdown.scored`（`src/server/views.ts:51-60`、`pages/index.tsx:97`、`ios/.../OverviewView.swift:191`），所以舊列自動維持原 G09 判定，符合 R2-5「生效日之前的紀錄照原 G09 判定，不重算」。
- 本機在合成的 13,063 點 SPX 序列（與正式站 1975 年起的長度相當）上量到：`buildOutlook` 約 0.25 秒，`phaseAveraged(…, "dd5")` 與 `(…, "up")` 各約 2.1 秒（Apple Silicon；Worker 會更慢）。所以相位平均不能放在頁面請求或 `prices` 排程裡每次算。
- 排程時間：抓價 `crons/prices.ts:6`（週一至五 UTC 21:40）、補抓 `crons/retry.ts:7`（週二至六 UTC 01:10）、核對 `crons/crosscheck.ts:6`（週一至五 UTC 22:50）。`latestExpectedClose`（`src/lib/calendar.ts:77`）以美東 16:30 為界；NYSE 日曆只覆蓋 2025-01-01～2027-12-31（`src/lib/calendar.ts:3-8`）。
- `outlookView` 的上線後紀錄（`src/server/outlook.ts:63-64`）不依賴 `outlook`，`outlook` 為 null 時照樣算；App 的 `forecastSection(p)` 卻在 `if let o = p.outlook`（`MoreView.swift:382`）裡面（`:465`），L3-T3 會把它搬出來。
- `npm test` 就是 `node --test tests/*.test.ts`（`package.json:6`），含 `api-contract.test.ts`；它比對 generated fixture，API 一改就失敗，所以驗收要先重產 fixture 再跑 `npm test`。

## 3. 共同規則（每張票都適用）

**不准碰：**

- `src/lib/forecast.ts` 的 `DEFAULT_MODEL` 除 `version` 以外的欄位（flags、candidates、skipSingleWhen、minEffectiveN、minEpisodes、shrinkK、bootstrap、baseWindowStart、vixMaxStaleSessions），以及 `pickProbability`、`walkForwardRows`、`cellEvaluations`、`evaluateRows` 的算法。
- `docs/forecast.md` 第一輪（`:41-114`）與第二輪（`:116-180`）的條文內文，第二輪只有 L4-T1 改 `:116` 標題一行；`:124`「與 main 的實作狀態對齊」那段是登記原文，不改。
- `forecasts` 表既有列（G02）；不寫 migration、不回填舊列的 `detail`。
- `recordForecast` 的寫入條件（同日 VIX、SPX 核對 match、`FORECAST_CATCHUP_SESSIONS`、`ON CONFLICT DO NOTHING`）。
- 不新增 `DD5_MODEL`、不做名額 A、R2-3a、R2-7、R2-8，不把 R2-7 的校準診斷放上頁面。
- 其他 lane 的範圍：`src/server/views.ts`（總覽卡片，L3）、`pages/index.tsx`、`ios/MarketObservatory/Views/OverviewView.swift`、`MoreView.swift` 的命中率列（`showHitRate`，L3-T5）與 `outlook == nil` 的 else 分支內容（L3-T3）、`scripts/ai-batch.ts`、Orca 排程。
- iOS 的 `滾動驗證：跌幅機率（dd5）`、`滾動驗證：上漲機率` 兩個 DisclosureGroup 標題與 `outlook-validation-up-details`／`outlook-validation-dd5-details` 識別碼：`MarketObservatoryUITests/VerifyInteractionTests.swift:778-782` 依它們找元素。

**驗收指令的基本組（照順序跑）：**

```sh
cd <worktree>/web && npx void prepare
cd <worktree>/web && npm run typecheck
cd <worktree>/web && node --test tests/<該票的測試檔>.test.ts
# 動到 /api/v1 時：先重產 fixture 並審 diff（npm test 含 api-contract，不先重產會失敗）
cd <worktree>/web && MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts
cd <worktree>/web && git diff --stat -- ../ios/MarketObservatoryTests/Fixtures/generated/
cd <worktree>/web && git diff -- ../ios/MarketObservatoryTests/Fixtures/generated/
cd <worktree>/web && npm test
cd <worktree>/web && node --test tests/api-contract.test.ts
# 動到 ios/ 時：取得全域模擬器鎖後才跑；只用既有模擬器，跑完 shutdown 再釋放鎖
cd <worktree>/ios && xcodegen generate
cd <worktree>/ios && xcodebuild build-for-testing -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'generic/platform=iOS Simulator'
cd <worktree>/ios && xcodebuild test -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'platform=iOS Simulator,name=MO iPhone 16 Plus' -only-testing:MarketObservatoryTests
xcrun simctl shutdown "MO iPhone 16 Plus"
```

「fixture diff 只能多出某些欄位」這類預期寫在各票的 `apiChange`／`tests`，由審查者讀 `git diff` 判斷。

**API 相容：** 只新增 optional 欄位；既有欄位的型別不變。iOS 新 struct 的內層欄位一律 optional（外層 optional 不能擋住內層缺鍵造成的整頁解碼失敗）。

**跨 lane 整合規則（本 lane 遵守；鎖與合併順序由整合者執行）：**

- **模擬器全域鎖：** 整個工作流程同一時間只有一個領域能開模擬器，用完 `shutdown` 再交下一個；`MO iPhone 16 Plus` 與 `MO iPhone 18 Pro Max` 不同時開（`AGENTS.md:8`）。`web` 的 `npm test` 可以平行。
- **L7-T1 合併前**不執行 `scripts/verify/ios-up.sh`、`down.sh`（前者會新建、後者會刪除模擬器）；UI 驗收照 `AGENTS.md:8` 的手動流程：把既有那台的 UDID 寫進本輪 `sim.udid`，用 `ios-test.sh`／`ios-walkthrough.sh`，收尾手動關 dev server 與暫存、`shutdown` 模擬器。
- **合併順序：** L3 → L4 → L6。L4 在整合分支 rebase 時保留 L3-T3 的 `outlookUnavailable` 與搬到 `if let` 之外的 `forecastSection(p)`、L3-T5 的 `evaluationSection(…, id:)` 參數與兩個識別碼，不還原 `showHitRate` 與命中率列。
- **`tests/api-contract.test.ts` 種子：** 衝突一律取聯集，各領域的列都保留。L4 只改 `:47` 那一列 forecasts 的內容（L4-T5、L4-T7），L4-T6 的 settings 是 `:47` 之後**新增一行**，不改 `:35` 的 watchlist settings。`generated-*.json` 不手動合併：每併入一個領域，就在整合分支跑 `MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts`，審 diff 只多出該領域宣告的欄位，再在模擬器鎖下跑 iOS `MarketObservatoryTests`（L4 的 `FixtureDecodingTests` 斷言 `liveTrackDd5`、`liveTrack.note`、`phaseSummary.dd5.mean` 非 nil，依賴上述種子存活）。
- **`src/lib/communication.ts` 與 `tests/communication.test.ts`：** L4 新增的函式與測試放檔尾，用 `// --- L4: forecast live tracks ---` 註解起頭成一塊；檔尾衝突照合併順序串接。
- **功能地圖：** 各票只改 `outlook.md`、`overview.md`、`sources-admin.md` 裡自己功能的小節；全部合併後由整合者統一對帳一次。

## 4. 票

**實作順序（同一分支依序）：L4-T1 → L4-T6 → L4-T3 → L4-T4 → L4-T5 →（L4-T2 合併進 main 後）L4-T7。** L4-T2 不在這條分支上：從 main 另開獨立分支與 PR，最早送出。L4-T6 排在 L4-T3 之前，是為了讓 R2-4 不受下面的部署閘門牽連：T3–T5 是 T6 之後連續的三張，必要時能單獨 revert。

**部署閘門（R2-5、R2-6 上線）：** `docs/forecast.md:180` 字面把 R2-3a 合成檢查排在「R2-5 與 R2-6 程式上線」之前，本 lane 不做 R2-3a。處置是在 L4-T2 的新節登記「執行順序修訂一」（§5）：R2-3a 只約束名額 A。因此：

- L4-T3、L4-T4、L4-T5 現在照常實作、審查，並依 §3 的合併順序（L3 → L4 → L6）隨 L4 分支完整併入整合分支。部署是手動的（repo 沒有自動部署的 workflow，`web/AGENTS.md:25` 寫「部署後」才跑排程），併進整合分支不等於上線。
- **整合分支合併進 main、以及任何部署，都要等 L4-T2 已合併進 main。**
- 本輪使用者沒簽 L4-T2：在整合分支上 revert T3–T5（L4 分支上連續的三個 commit，排在 T6 之後，revert 不碰 T6）再合併進 main；revert 後重產 fixture、跑 iOS 測試。回報寫「#8 的 R2-5／R2-6 已實作、未上線：登記未合併」與「#9 未完成：登記未合併」（L4-T7 不做）。

### L4-T1 文件：第二輪標題、現行設計、R2-10 待核（DOC-1、A-14、R2-10）

只改 `docs/forecast.md` 三處：

1. `:116` 標題改為「## 事前登記（第二輪，已登記：2026-10-28 隨 `955d8d3` 合併）」。第二輪其餘文字不動。
2. `:5-11`「現行設計」整段改寫，描述目前的 `DEFAULT_MODEL`，開頭一句寫「規則與門檻以下方各輪事前登記為準」。要涵蓋：
   - 機率一律收縮（G01）：p = (k·p_base + n·p_cond)/(k+n)，k = 40、n = 所選條件的 nEff；沒有候選可用時 p = 基準率。`distinct`（Wilson 區間不含基準率）不影響 p，只用在方向閘門。
   - 條件與候選順序：兩者組合 → 只看 VIX（VIX < 30 時跳過）→ 只看 200 日線；候選要 nEff ≥ 30 且段數 ≥ 8（G04）；只用 1990-01-02 起的觀測（D1）。
   - 滾動驗證：每 21 個交易日一次（單一相位 offset 0）、burn-in 504 天、G08 stationary bootstrap（平均區塊 6 列、2000 次、固定種子）；採用與否決的比較用 21 個相位的相位平均（L02）。
   - 方向（G03、L01）：`distinct`、cell 列數 ≥ 30、連續區段 ≥ 8、cell BSS 下界 > 0、四個固定評估項都通過，才給「高於平常／低於平常」（相對基準率）。
   - dd5（G09）：同一套條件與收縮；寫成目前的全域條件（L4-T3 上線時再改這一句）。
   - 「只當背景、不進機率」一條保留原文。
3. R2-10 待核標記，只加註、不改任何等級或數字，註明「本文件尚未依原文重新核對」：
   - `:241` VRP 列：「待核（R2-10）：§8 已記 BTZ 原文為全樣本、樣本內結果（2026-10-27）；R2-10 指定改為 `academic_is`。」
   - `:240` 技術均線列：「待核（R2-10）：10-27 查核指出『約 0.20』是樣本內係數；指定改為 tchi 月度 OOS R² +0.26%／OOSCT +0.48%（2009 年後持續落後）、Huang 等單一指數 TSM OOS R² −1.78%。」
   - `:242` 波動與方向列：「待核（R2-10）：C-D 的實證是全樣本 logit（`academic_is`）；Chronopoulos 2018 的 C&D 用 GARCH 波動、不是 VIX，該文數值與公式／表格的一致性待釐清，不可換算成本站 BSS。」（不寫「不符 Brier 尺度」，依 `codex-review.md:48`）
   - `:210` Citi 列：「待核（R2-10）：指定降為 `anecdotal` 並刪『2008 年初錯誤訊號』（§8 也記此句未找到佐證）。」

測試：純文件，無程式測試。審查者確認：`git diff --stat main` 只有 `web/docs/forecast.md`；`git diff -U0 main -- docs/forecast.md` 的改動行只落在 `:5-11`、`:116`、`:210`、`:240-242`（R2-10 的註可以接在該列末端）；`grep -c "待核（R2-10）"` 為 4。

驗收：

```sh
cd <worktree> && git diff --stat main
cd <worktree>/web && git diff -U0 main -- docs/forecast.md
cd <worktree>/web && ! grep -q "草稿，未合併前不得執行" docs/forecast.md
cd <worktree>/web && grep -c "待核（R2-10）" docs/forecast.md
```

功能地圖：無。

### L4-T2 新登記條目：發布時限、R2-6 修訂一、L09 增補一、執行順序修訂一（#9 的文件票）

在 `docs/forecast.md` 第二輪之後、「## 2026-10 研究」之前新增一節，內容逐字照本文件 §5 的草稿。這是規則，合併就生效：

- **Blocked：合併進 main 需使用者先審閱 §5 條文並同意以獨立 PR 先合併。** 條文已逐字寫在 §5，使用者可以直接審；工作流程可以從 main 開獨立分支起草並開 PR 供審，但不得自動合併，也不併進 L4 分支或整合分支。
- 報告 #9：「若希望新資格從 dd5 上線後紀錄的第一筆就套用，就在 R2-6 上線前先合併」。依 §4 的部署閘門，T3–T5 本來就要等本票合併才上線，所以本票一合併，新資格就從 dd5 第一筆前瞻紀錄起適用。
- 四列可以分開同意：使用者不同意的列，從 PR 刪掉再合併，之後另開條目。刪掉 PUB-1、R2-6 修訂一或 L09 增補一 → L4-T7 照未簽處理；刪掉執行順序修訂一 → T3–T5 照未簽處理。
- 本輪沒簽：L4-T7 延到下一輪，T3–T5 在整合分支 revert、不上線（見 §4 部署閘門）。
- 寫條文時不得查詢正式 D1 的 `forecasts`（不能先看 `created_at` 分佈或受影響筆數再定時限，`verify/V-A.md:75`）。
- 不改第二輪 `:180` 執行順序原文、不改 R2-6 或 L09 原文；不改任何程式。

驗收：

```sh
cd <worktree> && git diff --stat main
cd <worktree>/web && git diff main -- docs/forecast.md
cd <worktree>/web && grep -n "PUB-1\|R2-6 修訂一\|L09 增補一\|執行順序修訂一" docs/forecast.md
```

審查者確認：diff 只有 `docs/forecast.md`、改動全在新節；新節與 §5 逐字相同；開頭有「合併進 main 即為登記」的條款。功能地圖：無。

### L4-T3 R2-5：dd5 cell 閘門接進「已計分」並升版本（A-02）

**行為：** dd5「已計分」＝ (a) 原 G09 全域條件（`drawdownScored`）且 (b)(c)(d) 今天所選 dd5 cell 的 offset 0 閘門通過（`cellGateOf(ddEval.byCell, ddPick.cell).passed`）。p 不變；不通過時照常顯示 p，標「未通過驗證」。舊紀錄不重算。

**改動：**

- `src/lib/forecast.ts`
  - 新增 `DrawdownGate` 型別與 `drawdownGateOf(pick, evaluation, cellGate, cfg)`：回傳 `{ globalBssLow, nEff, episodes, failed }`，`failed` 是未通過項目代碼的陣列，依序可能有 `a-global-bss`、`a-n-eff`、`a-episodes`、`b-cell-rows`、`c-cell-runs`、`d-cell-bss`（bssLow 為 null 或 ≤ 0；null 的原因由 `cellGate.validReplicates` 看出）。(b)(c)(d) 的值沿用既有 `cellGate`，不重複存。
  - `buildOutlook`（`:748`）與 `targetOutlookOf`（`:709`）的 `scored` 改為 `drawdownGateOf(...).failed.length === 0`；`drawdown` 物件多一個 `gate: DrawdownGate`。`drawdownScored` 保留，作為 (a)。
  - `DEFAULT_MODEL.version`（`:81`）由 `2026-10-l01` 升為 `2026-10-g09r1`（R2-5「上線時 `DEFAULT_MODEL.version` 要升」）。這不是旗標或門檻；p 的計算完全不變，所以不需回測，`web/AGENTS.md:32` 的登記要求已由 R2-5 滿足。`VRP_MODEL`、`SEASON_MODEL` 的版本字串會跟著變（`:102`、`:116`），只是標籤。
  - 檔頭與 `Outlook.drawdown` 的註解（`:546`）改寫成新規則。
- `src/server/jobs.ts:562`：`detail.drawdown` 多存 `gate`（R2-5「每筆紀錄的 `detail.drawdown` 要能看出 (a)–(d) 各項的值與未通過的原因」）。
- `scripts/backtest.ts:163-165`：「cellGate …（G03，僅參考）」改成 R2-5 的說法，印出 `gate.failed`。只改輸出文字，不執行這支腳本。
- `docs/forecast.md`：
  - 試驗登記表（`:17-35` 之後）新增一列「G09 修訂一（R2-5 dd5 cell 閘門）」：狀態「已實作（model 2026-10-g09r1）；生效日＝合併進 main 的 commit 日期（合併後補 hash 與日期）」；結果欄寫「只改 dd5『已計分』判定，p 與 P(up) 不變；未跑回測；生效日之前的紀錄照原 G09 判定，不重算；上線依據執行順序修訂一」。
  - 「現行設計」dd5 那句改寫為：全域條件（G09）與今天所選 cell 的 offset 0 閘門（R2-5：列數 ≥ 30、連續區段 ≥ 8、cell BSS 下界 > 0、有效重抽 ≥ 1900）都通過才標「已計分」。

**呼叫端：** `drawdownScored` → `forecast.ts:709`、`:748`、`tests/forecast.test.ts:582-587`。`buildOutlook().drawdown` → `src/server/jobs.ts:562`（寫入）、`src/server/outlook.ts:23`（API）、`pages/outlook.tsx:95-97`、`:168`、`:199`、`ios/MarketObservatory/Models.swift:447-452`、`tests/forecast.test.ts:843`。`DEFAULT_MODEL.version` → `forecast.ts:102`、`:116`、`tests/forecast.test.ts:264`、`:614`、`:774`、`:805`、`tests/forecast-records.test.ts:48`、`.claude/skills/verify/features/outlook.md:39`。`targetOutlookOf` → `scripts/backtest.ts:159`。

**測試：**

- `tests/forecast.test.ts`（修正前失敗）：
  - 單元：一組 `pick`／`evaluation` 讓 `drawdownScored` 為 true，配上 `passed: false`（rows 29、runs 7、bssLow 0、bssLow null 各一）的 `CellGate`，斷言 `drawdownGateOf(...).failed` 分別含 `b-cell-rows`、`c-cell-runs`、`d-cell-bss`，且 `failed.length > 0`。
  - 整合（不變式）：多組合成序列上斷言 `buildOutlook(...).drawdown.scored === (drawdownScored(ddPick, ddEval) && drawdown.cellGate.passed)`。若找到兩者分歧的序列（`drawdownScored` 為 true 但 `cellGate.passed` 為 false），加一個斷言 `scored === false`；找不到不算失敗，修正前必失敗的斷言以上面的單元測試為準。
  - `targetOutlookOf(dd5)` 與 `buildOutlook` 的 `drawdown` 仍完全相同（`:843` 那個測試照舊要過，含新的 `gate`）。
  - `:264`、`:614` 的版本字串改成 `2026-10-g09r1`。
  - 今天所選退回基準率（cell `base`）時：該 cell 的 BSS 恆為 0，(d) 不可能通過，斷言 `failed` 含 `d-cell-bss`（這是 R2-5 原文的直接結果，不加例外）。
- `tests/forecast-records.test.ts:28-64`：`detail.drawdown.gate` 等於 `buildOutlook` 的 `drawdown.gate`。

**驗收：** 基本組＋`node --test tests/forecast.test.ts tests/forecast-records.test.ts`；重產 fixture，`outlook.modelVersion` 變、`drawdown.gate` 新增，diff 只有這兩類。`generated-outlook.json:89` 的 `drawdown.scored` 目前已是 `false`，新規則只會更嚴，不會翻成 true；審查者確認 `scored === (gate.failed.length === 0)`。`FixtureDecodingTests.swift:75` 的 `scored == true` 斷言讀的是舊的靜態 fixture `outlook_2026-10-l01`，不受影響。iOS 跑 `MarketObservatoryTests`（Swift 程式不改，只確認新 fixture 解得開）。

**部署：** 受 §4 部署閘門約束（R2-5 程式上線）。

**功能地圖：** `.claude/skills/verify/features/outlook.md`（`:39` 版本字串改 `2026-10-g09r1`；`outlook-pick` 註明 dd5「未通過驗證」依 R2-5，API `drawdown.gate.failed` 列出原因）；`features/overview.md:45`（卡片的「未通過驗證」讀存下的紀錄，G09 修訂一之前的列維持原規則）。

### L4-T4 R2-6 寫入端：`detail.drawdown` 存 dd5 版本與 regime／basis／historyStart

**行為：** 每筆新紀錄的 `detail.drawdown` 多存 `modelVersion`、`regime`、`basis`、`cell`、`historyStart`。在名額 A 之前 dd5 與 P(up) 用同一個 `DEFAULT_MODEL`，所以 `modelVersion = outlook.modelVersion`、`regime = outlook.regime`、`historyStart = outlook.historyStart`、`basis／cell = outlook.drawdown.pick.basis／cell`；程式註解寫明「名額 A 採用、新增 `DD5_MODEL` 後改用它的版本」。頂層 `model_version` 欄位維持 P(up) 的版本。

**改動：** 只有 `src/server/jobs.ts:558-563` 的 JSON 與註解；`buildOutlook` 的回傳形狀不變，所以 `/api/v1` 不變。

**測試（修正前失敗）：** `tests/forecast-records.test.ts` 的「新欄位都有值」與「(c) 補記」兩個測試加斷言：`detail.drawdown.modelVersion === DEFAULT_MODEL.version`、`deepEqual(detail.drawdown.regime, outlook.regime)`、`detail.drawdown.basis === outlook.drawdown.pick.basis`、`detail.drawdown.historyStart === outlook.historyStart`；補記列（lag 2）也要有這些欄位。

**驗收：** 基本組＋`node --test tests/forecast-records.test.ts`；`api-contract` 不需重產 fixture。

**部署：** 受 §4 部署閘門約束（R2-6 寫入端）。

**功能地圖：** 無（使用者看不到；以本機 D1 最新一列的 `detail.drawdown` 對帳）。

### L4-T5 R2-6 讀取端：dd5 上線後實際紀錄（含暫時說明）

**行為：**

- 新的純函式（放 `src/lib/communication.ts` 檔尾的 L4 區塊）：
  - `dd5ClassOf(detail)`：解析 `forecasts.detail`，依序判定 (1) 缺 `recordedLagSessions`、缺 `drawdown.p`／`drawdown.base`（非數字）或缺 `drawdown.modelVersion`（非空字串），或 `detail` 解析失敗 →「資格不明」；(2) `recordedLagSessions ≥ 1` →「延遲補記」；(3) 其餘 →「即時發布」（R2-6 原文定義）。
  - `dd5LiveTrackOf(rows, points)`：rows 是 `{ date, close, detail }`；格線從**第一筆即時發布列**的 SPX 交易日起，每 21 個 SPX 交易日一個格點，格點當天沒有即時發布列就略過，不遞補、不用補記列；標籤＝該列之後 21 個 SPX 交易日內任一收盤 ≤ 0.95 × 該列存下的 `close`，第 21 個交易日收盤存在才算到期；依 `detail.drawdown.modelVersion` 分組，每組回 `{ modelVersion, n, tooFew, brier, brierBase, bss, eventShare }`，`n < LIVE_MIN_N` 時 `tooFew = true`、`bss = null`；BSS 用該列存下的 `detail.drawdown.base`、Brier 用存下的 `detail.drawdown.p`。整體回 `{ realtime, delayed, unknown, groups, note }`。格線只有一條（全部即時發布列共用），計分才分組，這是 R2-6「格線：從第一筆即時發布列起」與「依版本分組計算」的字面讀法，寫進函式註解。
  - 兩句暫時說明（常數）：
    - dd5：「依 R2-6：只計寫入時就是資料庫最新 SPX 交易日（延遲 0 個交易日）、且存有 dd5 模型版本的列；尚未比對排程當時應有的收盤日，資料來源停更後才補寫的列仍可能被算入。」
    - P(up)：「合併所有已寫入的紀錄，包含延遲補記的列；尚未依發布時間區分即時與補記。」
- `src/server/outlook.ts:63-64`：SELECT 加 `detail`；回傳新增 optional `liveTrackDd5`；既有 `liveTrack` 物件多一個 optional `note`（P(up) 那句）。`liveTrackOf` 的計算與既有欄位不變。`liveTrackDd5` 與 `liveTrack` 一樣不依賴 `outlook`，`outlook` 為 null 時照算。
- 網頁 `pages/outlook.tsx`：在 `trackPanel` 之後加「上線後實際紀錄：跌幅機率（dd5）」面板，兩個分支（有無 `outlook`）都顯示。內容：每個版本一行（「模型 2026-10-g09r1：樣本太少，只有 n 個獨立月份」或「BSS x.xxx（對照紀錄當時存下的基準率）· n = … · 實際發生 …%」）；沒有任何到期列時寫「每天收盤後記錄一次，21 個交易日後才能對帳；目前還沒有到期的紀錄」；下方一行「延遲補記 X 列、資格不明 Y 列，保留、不計分」與 `note`。P(up) 面板在既有標題下加 `liveTrack.note` 一行。
- iOS：`Models.swift` 的 `OutlookPage.LiveTrack` 加 `let note: String?`；新增 `Dd5LiveTrack`（`groups`、`realtime`、`delayed`、`unknown`、`note`，內層全 optional）與 `OutlookPage.liveTrackDd5: Dd5LiveTrack?`。`MoreView.swift` 新增 `dd5TrackSection(p)`，標題「上線後實際紀錄：跌幅機率（dd5）」，文字與網頁相同，只讀 `p.liveTrackDd5`、不依賴 `p.outlook`。**位置：`content(_:)` 裡 `if let o = p.outlook { … } else { … }` 整段之後（HEAD `:468` 的 `}` 之後、`:470`「機構觀點」Section 之前）**，`outlook` 為 nil 時也顯示；L3-T3 把 `forecastSection(p)` 搬到同一位置後，`dd5TrackSection(p)` 緊接在 `forecastSection(p)` 之後。不改 if／else 兩個分支的內容。`forecastSection` 的 footer 加 `liveTrack.note`（只改函式本體 `:610-659`，不動呼叫處）。

**測試：**

- `tests/communication.test.ts`（新功能）：分類三種情況各一（lag 0＋完整欄位、lag 2、缺 lag／缺 modelVersion／壞 JSON）；格線起點是第一筆**即時發布**列而不是第一筆列（第一筆是資格不明時，格點要從下一筆即時列算）；格點上是延遲補記列時略過、不遞補；21 日內跌到 0.95 以下為 1、第 22 日才跌為 0、未到期不計；兩個版本分兩組、不合併；n = 11 → `tooFew`、`bss` null，n = 12 → 依存下的 base 算 BSS（手算值比對）；用存下的 `close` 對帳，改歷史價不影響（同 `:125-135` 的 A2 測試）。
- `tests/forecast-records.test.ts`：`recordForecast` 後 `outlookView` 的 `liveTrackDd5.realtime` 等於新寫入的 lag 0 列數、`delayed` 等於補記列數；手動插一筆沒有 `detail` 的列，`unknown` 加 1；`liveTrack.note` 存在；`:66` 的 VIX 過期情境（`outlook` 為 null）`liveTrackDd5` 仍非 null。
- `tests/api-contract.test.ts:47`：只改這一列的 `detail`，帶 `recordedLagSessions: 0` 與 `drawdown.modelVersion`，讓 generated fixture 有非空的 `liveTrackDd5`。
- iOS `FixtureDecodingTests.swift`：`generatedOutlook` 斷言 `p.liveTrackDd5 != nil`、`p.liveTrack?.note != nil`；`oldOutlookHasNoNewFields` 斷言舊 fixture 的這兩個為 nil。

**驗收：** 基本組＋`node --test tests/communication.test.ts tests/forecast-records.test.ts`；重產 fixture，diff 只多 `liveTrackDd5` 與 `liveTrack.note`；iOS build-for-testing＋`MarketObservatoryTests`。

**部署：** 受 §4 部署閘門約束（R2-6 讀取端）。

**功能地圖：** `features/outlook.md`：`outlook-records` 加 P(up) 說明句；新增 `outlook-records-dd5`（入口、對帳欄位 `liveTrackDd5`、本機要先準備帶 `recordedLagSessions`／`drawdown.modelVersion` 的已到期列，見 §8；`outlook` 為 nil 時也顯示）。

### L4-T6 R2-4：相位平均主報（A-03）（實作順序第二，在 L4-T3 之前）

**行為：** 展望頁 dd5 與上漲機率的 BSS 主數字改為相位平均（21 個起始相位，L02 的格線與 cycle bootstrap），旁邊寫資料日與模型版本；offset 0 的數字保留，標「單一相位（offset 0）」並註明它是「已計分」（dd5）與方向判定（上漲）用的。相位平均每天由排程算一次存起來，頁面只讀，不寫成頁面常數，也不在頁面請求裡算。R2-4 不在 `:180` 的執行順序裡，不受部署閘門約束。

**改動：**

- `src/lib/forecast-eval.ts`：新增 `phaseSummaryOf(obs, cfg)`，用 `phaseAveraged(obs, cfg, label)`（G08 預設：平均區塊 6、2000 次、種子 20261026）分別算 `up` 與 `dd5`，回 `{ asOf, modelVersion, phases: 21, up, dd5 }`，每個目標 `{ mean, low, high, min, max, cycles }`；非有限數字（沒有可用格）一律存 `null`。最後一筆觀測沒有 regime 時回 null。
- `src/server/jobs.ts`：新增工作 `forecast-phase`（`JobName`、`JOB_NAMES`、`JOBS`），讀 SPX／VIX（同 `outlookView` 的 `loadPrices(..., "0000-01-01")`）、`buildObservations`，若 settings `forecast-phase-summary` 已是同一個 `asOf` 與 `modelVersion` 就略過（status ok、摘要「已是最新」）；否則計算、存入（含 `computedAt`），摘要寫兩個目標的相位平均。資料不足或最後一天沒有 regime 時 status 仍是 ok、摘要寫「資料不足，略過」（`cron-budget` 測試要求排程內工作都 ok）。不打外部請求。
- `SCHEDULES.crosscheck`（`src/server/jobs.ts:773`）改為 `["crosscheck", "forecast-phase"]`：與 `prices`／`notify-close` 分開，萬一超過 CPU 上限也不會拖垮收盤推播；每個交易日晚上算一次。`pages/sources.tsx:8-23` 的 `JOB_LABEL` 加「展望相位平均」；`:35` 交叉核對那列說明加「；之後重算展望相位平均」。
- `src/server/outlook.ts`：回傳新增 optional `phaseSummary`（讀 settings，沒有就 null）。
- 網頁 `pages/outlook.tsx`：兩個 `BssKpi`（`:168-169`）主數字改用 `phaseSummary.{dd5,up}.mean`，下方「相位平均（21 個起始相位）{SKILL_INTERVAL} low～high · 資料截至 {asOf} · 模型 {modelVersion}」，再一行「單一相位（offset 0）{bss}（low～high）」＋用途（dd5：「『已計分』判定用這個」；上漲：「方向判定用這個」）。`phaseSummary` 為 null 或該目標為 null 時，主數字退回 offset 0 並標「單一相位（offset 0）」、加一句「相位平均尚未計算」。兩個 `WalkForwardPanel`（`:198-201`）標題不改，內文第一行加「單一相位（offset 0）」。
- iOS：`Models.swift` 新增 `PhaseSummary`（含 `Target`，內層全 optional）與 `OutlookPage.phaseSummary: PhaseSummary?`。`MoreView.swift` 的 `evaluationSection` 新增**最後一個**參數 `phase: OutlookPage.PhaseSummary.Target?`，呼叫端 `:458-459` 傳 `p.phaseSummary?.dd5`、`:462-463` 傳 `p.phaseSummary?.up`；DisclosureGroup 內第一行顯示相位平均（數字、區間、資料日、版本），原本的 BSS 列標籤改成「BSS（單一相位 offset 0）」。簽名規則：基底已有 L3-T5 時是 `(…, id:, phase:)`；基底還沒有時先加在 `showHitRate:` 之後，rebase 到 L3-T5 之後改成 `(…, id:, phase:)`，不還原 `showHitRate` 與命中率列。DisclosureGroup 標題與兩個識別碼不改。
- 不要宣稱頁面的 offset 0 等於相位格線的第 0 相位：`walkForwardRows` 從第一個有 regime 且 known ≥ 504 的列起算，`phaseGrid` 從 known ≥ 504 的索引起算、不因 regime 為 null 位移，兩者起點可能不同。

**呼叫端：** `SCHEDULES` → `crons/crosscheck.ts:9`、`routes/api/admin/cron.ts:13-14`、`tests/cron-budget.test.ts:93`、`:126-142`、`tests/news-ai.test.ts:93`。`JOB_NAMES` → `routes/api/admin/run.ts:13`、`pages/sources.server.ts:49`。`outlookView` → `pages/outlook.server.ts:6`、`routes/api/v1/outlook.ts:4`、`tests/api-contract.test.ts:55`、`tests/forecast-records.test.ts:62`、`:70`。`evaluationSection` → `MoreView.swift:458-459`、`:462-463`（L3-T5 也改這兩處與 `:584-605`）。

**測試：**

- `tests/forecast-eval.test.ts`：`phaseSummaryOf` 在合成序列上的 `up`／`dd5` 等於直接呼叫 `phaseAveraged` 的 `mean`、`ci.low`、`ci.high`、`min`、`max`、`cycles`；沒有可用格時各數字為 null（不是 NaN）；最後一天 regime 為 null 回 null。
- 新檔 `tests/forecast-phase.test.ts`（D1 用 `fake-cloudflare`）：第一次 `runJob(db, "forecast-phase")` 寫入 settings、`asOf`／`modelVersion`（等於 `DEFAULT_MODEL.version`）正確；第二次摘要為「已是最新」且 `computedAt` 不變；之後 `outlookView` 的 `phaseSummary` 等於 settings 內容；空資料庫時 status ok、不寫入。
- `tests/cron-budget.test.ts`：既有「五支排程」測試要看到 crosscheck 執行 `forecast-phase` 且 status ok、subrequests 為 0（必要時加斷言）。
- `tests/api-contract.test.ts`：在 `:47` 之後**新增一行**插入固定數字的 `forecast-phase-summary` settings（不改 `:35`），讓 generated fixture 有 `phaseSummary`。
- iOS `FixtureDecodingTests.swift`：`generatedOutlook` 斷言 `p.phaseSummary?.dd5?.mean != nil`；舊 fixture 為 nil。
- 量 CPU：在合成的 13,000 點序列（不是 `.backtest/*.csv`、不是正式資料）上量 `phaseSummaryOf` 的時間，寫在 PR 說明；超過 15 秒就停下來回報，不要去改 `pickProbability` 等模型函式來加速。

**驗收：** 基本組＋`node --test tests/forecast-eval.test.ts tests/forecast-phase.test.ts tests/cron-budget.test.ts`；重產 fixture，diff 只多 `phaseSummary`；iOS build-for-testing＋`MarketObservatoryTests`。部署後站長跑 `POST /api/admin/cron?name=crosscheck`，看 `forecast-phase` 的 status、摘要與 `detail.subrequests` = 0。

**功能地圖：** `features/outlook.md` 的 `outlook-validation`（主數字是相位平均、對 API `phaseSummary`，另有「單一相位（offset 0）」一行對 `evaluation`；前置條件加「在 `/sources` 手動執行『展望相位平均』」）；`features/sources-admin.md`（交叉核對排程現在跑兩個工作）。

### L4-T7 #9 實作：讀 `created_at` 比對排程應有收盤日（blocked）

**Blocked：L4-T2 的登記合併進 main 之後才能寫這張票的程式。** 合併前不得據以做任何計算。本輪 L4-T2 沒合併就延到下一輪，回報寫「#9 未完成：登記未合併」。

**行為：**

- 新純函式（`src/lib/communication.ts` 檔尾的 L4 區塊，用 `src/lib/calendar.ts` 的 `latestExpectedClose`、`inCalendarCoverage`）：`publishStatusOf(tradeDate, createdAt)` → `on-time`／`late`／`unknown`，完全照 PUB-1：`created_at` 解析失敗、`trade_date` 或 `created_at` 的美東日期不在 NYSE 日曆覆蓋範圍、或 `latestExpectedClose(created_at) < trade_date` → `unknown`；`> trade_date` → `late`；相等 → `on-time`。
- dd5 分類改照 R2-6 修訂一（缺欄位或 `unknown` → 資格不明；lag ≥ 1 或 `late` → 延遲補記；其餘即時發布）；格線起點改為新分類下的第一筆即時發布列。
- P(up) 改照 L09 增補一：`outlookView` 先用同一套分類（lag 取 `detail.recordedLagSessions`，缺 → 資格不明）篩出即時發布列再交給 `liveTrackOf`；`liveTrack` 多 optional 的 `realtime`、`delayed`、`unknown`。`liveTrackOf` 本身不改（它的格線起點自然變成第一筆即時列）。
- 兩句 `note` 改為正式說明，伺服器組字串，iOS Swift 不用改：
  - P(up)：「只計即時發布的列（寫入時是最新交易日，且在下一個交易日美東 16:30 前寫入）；延遲補記 X 列、資格不明 Y 列另列、不計分。合併所有已發布的模型版本。」
  - dd5：同上的資格說明，加「依模型版本分開計分」。
- `src/server/outlook.ts`：SELECT 加 `created_at`。

**測試（修正前失敗）：**

- `tests/forecast-records.test.ts` 新增 V-A §4 情境，但日期放在 NYSE 日曆覆蓋內：`weekdays(900, "2026-03-06")` 播種、`t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-03-13T23:00:00Z") })`、`recordForecast` 寫入 `trade_date = 2026-03-06`、`recordedLagSessions = 0`。斷言 `outlookView` 的 dd5 與 P(up) 都把它算成延遲補記、不進 n。L4-T5 時這筆會被算成即時發布，所以這個斷言在 T7 前會失敗。
- 另一組完全照 V-A 的 2040 日期：落在日曆覆蓋外，斷言為「資格不明」（同樣不是即時）。
- `tests/communication.test.ts`：`publishStatusOf` 的邊界：美東 16:29／16:31（夏令與冬令各一）；補抓排程 `2026-03-07T01:10Z` 對 `2026-03-06` 為 on-time；感恩節 `2026-11-26T22:00Z` 對 `2026-11-25` 為 on-time；下一個交易日 22:00Z 為 late；`created_at = "x"` 為 unknown（`tests/forecast-records.test.ts:215` 的測試資料就是這種）。
- 既有 `liveTrackOf` 測試不動且照過。
- `tests/api-contract.test.ts:47`：只改這一列。它的 `created_at` 是 `STAMP`（2026-10-28），`trade_date` 卻早約 29 個交易日；T7 之後它會變成延遲補記，fixture 的 `realtime` 掉成 0。改成該 `trade_date` 當晚的準時時間（例如 `trade_date` 的 UTC 22:00），讓 fixture 仍走得到即時發布路徑。

**驗收：** 基本組＋`node --test tests/communication.test.ts tests/forecast-records.test.ts`；重產 fixture，diff 是 `liveTrack` 多三個計數、兩句 note 改字；iOS 只需確認 `MarketObservatoryTests` 仍過（Swift 不改，fixture 有改）。

**功能地圖：** `features/outlook.md` 的 `outlook-records`、`outlook-records-dd5` 改寫資格說明與計數。

## 5. L4-T2 的登記條文草稿

放在 `docs/forecast.md` 第二輪之後、「## 2026-10 研究」之前。標題不寫「草稿」，避免合併後又出現 DOC-1 那種標題落後的情形：

```md
## 事前登記（增補：前瞻紀錄的發布資格與執行順序）

> **本節合併進 main 即為登記；登記日＝合併 commit 的日期。合併前本節只是草稿，不得據以做任何計算或分類。** 本節不改第一輪、第二輪任何條文原文，以新編號條目修訂；`forecasts` 既有列一律不改（G02），只在計分時分類。

依據：`docs/research-2026-10-28/report.md` §6 #8、#9；`verify/V-A.md` §4、`verify/V-B.md` §4；`review/R1-evidence.md` #1 與 `:32`、`review/R2-engineering.md` #1 與 `:66`。

外部暴露：寫本節時沒有查詢正式 D1 的 `forecasts`（沒看過 `created_at`、`recordedLagSessions` 的分佈或受影響筆數）。程式上 P(up) 的上線後紀錄在獨立月份 n < 12 時不報 BSS，dd5 尚無前瞻紀錄。

| 編號 | 規則 |
| --- | --- |
| PUB-1 發布時限 | 一筆 `forecasts` 列「準時」＝ `created_at`（UTC ISO 8601）可解析，且以 `created_at` 為時點「應已有收盤的最近 NYSE 交易日」等於該列 `trade_date`。「應已有收盤的最近交易日」：美東 16:30 以後算當天，否則算前一天，再往前找最近的 NYSE 交易日（`src/lib/calendar.ts` 的 `latestExpectedClose`）。白話：在 `trade_date` 之後下一個 NYSE 交易日的美東 16:30 之前寫入。該日晚於 `trade_date` 為「逾時」；早於 `trade_date`、`created_at` 無法解析，或 `trade_date`／`created_at` 的美東日期不在 `NYSE_CALENDAR` 覆蓋範圍內，為「時限不明」。時限依排程設計定：抓價排程週一至五 UTC 21:40、補抓週二至六 UTC 01:10，正常都在下一個交易日收盤前。 |
| R2-6 修訂一（dd5 即時發布加發布時限） | R2-6 的「即時發布」另須符合 PUB-1 準時。依序判定：(1) 缺 `detail.recordedLagSessions`、缺 `detail.drawdown.p`／`base`／`modelVersion`，或 PUB-1 為時限不明 →「資格不明」；(2) `recordedLagSessions` ≥ 1 或 PUB-1 逾時 →「延遲補記」；(3) 其餘 →「即時發布」。格線起點為依本條判定的第一筆即時發布列；格線、標籤、計分、`LIVE_MIN_N`、依 `detail.drawdown.modelVersion` 分組、只顯示不作退場依據，照 R2-6 原文。生效後計分一律依本條分類，含生效前寫入的列。 |
| L09 增補一（P(up) 前瞻資格） | 頁面「上線後實際紀錄：上漲機率」只計「即時發布」列：`detail.recordedLagSessions` = 0、`probability`／`base_rate`／`close` 有值，且 PUB-1 準時。判定順序同 R2-6 修訂一（缺 `recordedLagSessions` 或時限不明 → 資格不明；lag ≥ 1 或逾時 → 延遲補記）。延遲補記與資格不明保留原列、不計分，頁面另列兩者的列數。格線：從第一筆即時發布列的交易日起每 21 個 SPX 交易日一個格點，格點當天沒有即時發布列就略過，不遞補、不改用補記列。標籤：第 21 個 SPX 交易日收盤 > 該列存下的 `close`，到期後才計。計分：Brier、相對該列存下的 `base_rate` 的 BSS、列數 n；n < `LIVE_MIN_N`（12）顯示「樣本太少」、不報 BSS。版本：沿用現行頁面，合併所有已發布的頂層 `model_version` 並在頁面寫明（P(up) 本輪沒有試驗名額，R2-0）。只顯示，不作退場依據；退場檢定另行登記。 |
| 執行順序修訂一（R2-5、R2-6 上線不以 R2-3a 為前提） | 第二輪「執行順序」中的「以合成資料驗證既有 target 隔離、明確 N／種子路徑」與「R2-3a 合成資料檢查」，是名額 A 的先決條件，不是 R2-5（G09 修訂一）與 R2-6 程式上線的先決條件：R2-5 只改 dd5「已計分」的判定，R2-6 只記錄與顯示前瞻紀錄，兩者都不使用 R2-3 的虛無分佈或置換檢定。本節合併後，R2-5、R2-6 即可上線。名額 A 的順序不變：target 隔離驗證與 R2-3a 檢查未超過上限 → R2-5、R2-6 已上線 → 名額 A 的 reference 寫進試驗登記 → 執行名額 A；R2-3a 未通過時依 R2-3a 停止名額 A 並另行登記，已上線的 R2-5、R2-6 不撤下。 |

執行順序：本節合併 → R2-5、R2-6 可上線（執行順序修訂一）；實作讀 `created_at` 的分類 → 部署後兩個前瞻紀錄改依本節分類。
```

## 6. 刻意排除

| 不做 | 理由 |
| --- | --- |
| 改 `DEFAULT_MODEL` 旗標、候選、門檻、收縮；跑 `scripts/backtest.ts`；在 `.backtest/*.csv` 或正式 D1 上算任何數字 | 使用者指示；R2-5 只改「已計分」判定、R2-4 只改呈現，都不需要新回測 |
| `DD5_MODEL`、名額 A（`rvHigh`）、R2-3a 合成檢查、target 隔離的合成驗證、R2-7 校準診斷 | 不在 #8；名額 A 另有先決（`forecast.md:180`）。R2-3a 字面排在 R2-5／R2-6 上線之前，本 lane 以 L4-T2 的「執行順序修訂一」登記它只約束名額 A，並以 §4 的部署閘門確保修訂合併前整合分支不進 main、R2-5／R2-6 不上線 |
| P(up) 前瞻紀錄依 `model_version` 分組 | 報告 #9 沒有要求；頁面已明寫「合併所有已發布的模型版本」，不是默默合併。要分組須另行登記 |
| 回填或改寫舊 `forecasts` 列的 `detail` | G02 不可改；缺欄位的舊列依 R2-6 歸「資格不明」 |
| 在畫面上列出 R2-5 未通過的原因 | R2-5 只要求紀錄看得出原因；API 的 `drawdown.gate.failed` 與 D1 的 `detail` 已有 |
| 實際更正 R2-10 的證據等級與數字 | 本輪沒有重讀原文；報告 #8 要求只標待核 |
| 第二輪內文（含 `:124` 的實作狀態段落、`:180` 執行順序原文） | 已登記原文；實作狀態改記在試驗登記的「G09 修訂一」列，執行順序以新條目修訂 |
| dd5 前瞻紀錄的退場檢定 | R2-6：另行登記並附檢定力論證 |
| iOS 命中率列、`outlook == nil` 時的提示文字、總覽卡片預測日 | 屬 L3（L3-T5、L3-T3 等，P0 #4、#5） |

## 7. 風險與部署注意

- **登記與部署順序：** L4-T2 是本 lane 唯一新增的規則，合併即有拘束力，使用者先讀 §5 再決定。它同時是 #9 的前提與 R2-5／R2-6 上線的前提（執行順序修訂一）。整合分支合併進 main 與任何部署都要等它合併。沒簽的後果：在整合分支 revert T3–T5 後才合併進 main，#8 只有 L4-T1、L4-T6 上線，R2-5／R2-6 已實作未上線；#9 延到下一輪。
- **版本號：** `2026-10-g09r1` 會出現在 P(up) 的 `model_version`，雖然 P(up) 沒變；P(up) 前瞻紀錄本來就合併版本並寫明，不影響。`VRP_MODEL`／`SEASON_MODEL` 的版本字串跟著變，只是重現時的標籤。L4-T6 先上線時，`phaseSummary.modelVersion` 會是 `2026-10-l01`，T3 上線後下一次排程因版本不同自動重算。
- **基準率 cell：** 今天所選退回基準率時，依 R2-5 (d) 一律「未通過驗證」。這是原文的直接結果，不另加例外；若使用者覺得不合理，要另開修訂條目。
- **G09 修訂一的生效日：** 合併後要補一個文件 commit，把合併 commit 的 hash 與日期寫進試驗登記那一列。
- **CPU：** 相位平均每個目標在 Apple Silicon 約 2 秒，Worker 會更慢。放在 `crosscheck` 排程的獨立工作、同一個 `asOf`／版本只算一次；部署後用 `POST /api/admin/cron?name=crosscheck` 看 `forecast-phase` 有沒有完成。若被 CPU 上限中斷，該次 run 會停在未完成，頁面退回 offset 0 並寫「相位平均尚未計算」。
- **數字口徑：** 頁面上的相位平均每天依正式站資料（Yahoo `^GSPC`＋Cboe 核對）重算，與試驗登記的 0.038（Cboe 原始檔、as-of 2026-10-23）資料不同，不要拿來比較或回寫登記。
- **暫時說明：** L4-T5 上線而 L4-T7 還沒上線時，dd5 面板用暫時說明，不稱乾淨即時。
- **NYSE 日曆：** 覆蓋到 2027-12-31。L4-T7 上線後，日曆沒延長前，2028 年起的新列都會是「資格不明」，頁面的計數會顯示出來，當作更新日曆的訊號。
- **同檔衝突：** `src/server/outlook.ts`、`pages/outlook.tsx`、`pages/sources.tsx`、`ios/.../MoreView.swift`、`Models.swift`、`src/server/jobs.ts`、`src/lib/communication.ts`、`tests/communication.test.ts`、`tests/api-contract.test.ts`、`FixtureDecodingTests.swift` 與 generated fixtures 也會被 L1、L2、L3、L6 改；照 §3 的跨 lane 整合規則處理（L3 先合併、種子取聯集、fixture 在整合分支重產、`communication.ts` 檔尾照順序串接）。`jobs.ts` 裡 L1-T8 的 `runJob` 與 L4-T6 的 `JOBS`／`SCHEDULES` 相鄰，rebase 時兩者都保留。
- **模擬器：** iOS 驗收受全域模擬器鎖管制；L7-T1 合併前不執行 `ios-up.sh`／`down.sh`。
- **iOS 上線時間：** 網頁部署即生效；App 的新區塊要等 TestFlight 發版。舊版 App 不認得新欄位，會照舊顯示。
- **Orca：** 本 lane 不碰 `scripts/ai-batch.ts` 與 Orca 排程，部署時主線不需要同步 Orca 設定。

## 8. 最後整合驗收要看的畫面

- **網頁 `/outlook`（站長登入，本機站）：** 先在 `/sources` 手動執行「重算下月展望」與「展望相位平均」。dd5 卡片的「未通過驗證，只供參考」與 API `outlook.drawdown.scored` 一致，`drawdown.gate.failed` 非空時才出現；兩個 KPI 的相位平均等於 API `phaseSummary.dd5.mean`／`phaseSummary.up.mean`（三位小數），旁邊有資料日、模型版本（等於 API `outlook.modelVersion`；T3 上線後為 `2026-10-g09r1`）與「單一相位（offset 0）」那一行（等於 `outlook.drawdown.evaluation.bss`／`outlook.evaluation.bss`）；兩個滾動驗證面板有「單一相位（offset 0）」；「上線後實際紀錄：跌幅機率（dd5）」面板的列數與計數等於 API `liveTrackDd5`（需先在本機 D1 準備 22 個交易日以前、帶 `recordedLagSessions` 與 `drawdown.modelVersion` 的 forecasts 列，另各準備一筆 lag 2 與無 detail 的列）；P(up) 紀錄面板有 `liveTrack.note`。讓 VIX 過期（照 `L3-display.md` §6 T3 那列的 VIX 暫存步驟，驗完還原）時，dd5 紀錄面板仍在。
- **iOS（`MO iPhone 16 Plus` 或 `MO iPhone 18 Pro Max`，取得模擬器鎖後一次一台，用完 shutdown；L7-T1 合併前照 `AGENTS.md:8` 把既有 UDID 寫進 `sim.udid` 再用 `ios-test.sh`，不跑 `ios-up.sh`／`down.sh`）：** 更多 → 下月展望：下跌風險區的「未通過驗證，只供參考」與 API 一致；展開兩個滾動驗證，看到相位平均那行與「BSS（單一相位 offset 0）」；最下方有「上線後實際紀錄：跌幅機率（dd5）」區塊與 P(up) 紀錄的說明句；「機率與模型說明」的模型版本等於 API。VIX 過期、`outlook` 為 nil 時，dd5 紀錄區塊仍顯示。`test12_Outlook` 照舊能展開收合。
- **總覽：** 卡片的「未通過驗證」讀的是最新一筆存下的紀錄，新寫入的列依 R2-5。
- L4-T7 上線後：兩個紀錄面板的說明句換成正式資格與「延遲補記 X 列、資格不明 Y 列」。

## 9. 審稿處置

| 審稿意見 | 處置 |
| --- | --- |
| L4-T2 blocked 欄是空的，會被當普通文件票自動合併 | 成立。T2 `blocked` 改為「合併進 main 需使用者審閱 §5 並同意以獨立 PR 先合併」，寫明可起草、開 PR，但不得自動合併、不併進 L4 或整合分支；T7 延期時回報「#9 未完成：登記未合併」 |
| `forecast.md:180` 把 R2-3a 排在 R2-5／R2-6 上線之前，spec 沒交代 | 成立。採 (a)＋(b)：§5 新增「執行順序修訂一」（R2-3a 只約束名額 A），新節標題改為「發布資格與執行順序」；T3–T5 照常實作、隨 L4 完整併入整合分支（維持 L3 → L4 → L6 的順序），但 §4 部署閘門規定整合分支合併進 main 與任何部署都要等 T2 合併，沒簽就在整合分支 revert T3–T5。為了讓 revert 不碰 R2-4，L4-T6 改排在 L4-T3 之前（T6 原本依賴 T5 只是同檔的先後，沒有邏輯相依）。§2、§6、§7 跟著補 |
| iOS `forecastSection` 在 `if let o` 裡，dd5 區塊照原寫法 outlook 為 nil 時看不到；與 L3-T3、L3-T5 改同一段 | 成立。`dd5TrackSection(p)` 改放在 if／else 整段之後，不依賴 outlook，L3-T3 之後與 `forecastSection(p)` 相鄰；T6 的 `evaluationSection` 只加最後一個 `phase:` 參數，rebase 後用 L3-T5 的 `id:` 簽名；T5、§8 的驗收加 outlook 為 nil 的情境 |
| 模擬器全域鎖、L7-T1 前不跑 `ios-up.sh`／`down.sh` | 成立。§3 新增跨 lane 規則，§7、§8 與各 iOS 票的風險寫明；鎖由整合者執行 |
| `api-contract.test.ts` 種子與 generated fixture 多 lane 衝突 | 成立。§3 寫明種子取聯集、L4 只改 `:47` 一列並在其後新增一行 settings、fixture 每併一個領域就在整合分支重產並跑 iOS 測試；L2 的行號不在本 spec 範圍 |
| 多個 lane 同改 `outlook.ts`、`outlook.tsx`、`communication.ts`、`jobs.ts`、`sources.tsx`、`Models.swift`、功能地圖 | 成立。§3 寫明合併順序 L3 → L4 → L6、要保留的 L3 語意、`communication.ts` L4 區塊用註解起頭、功能地圖只改自己的小節；§7 同檔衝突改用實際票號 |
| acceptance 不能原樣執行 | 成立。全部改成 `cd <worktree>/web && …`、`cd <worktree>/ios && …`；L4-T1 的 `\|\| echo none` 改成 `! grep -q`；`git diff` 改比對 `main`（每票 commit 後工作區 diff 會是空的）；人工判斷移到 `tests`／`apiChange`。另外發現原本 `node --test tests/api-contract.test.ts` 排在重產 fixture 之前、`npm test` 也含 api-contract，照字面跑會先失敗，順序改成先重產再跑 `npm test` |
