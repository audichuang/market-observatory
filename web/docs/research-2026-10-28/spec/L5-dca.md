# L5 定投（dca）：本輪規格

> 來源：`report.md` §6 P0 #4（其中 A-11、C-01 文字部分）、P1 #11、#12、#13；證據見 `results/C-dca-entry-exit.md`、`verify/V-C.md`、`results/K-products.md`（K-02、K-04）、`verify/V-K.md`、`results/G-x-practitioners.md`（G-01）、`review/R1-evidence.md`（R1-5、R1-6）、`review/R3-value.md`（R3-2、R3-3、R3-4）。路徑相對於 repo 根；行號以 HEAD `8eaac29` 為準（研究基準 `99066fd` 之後只多了研究文件，程式行號未偏移）。
> 使用者已決定：維持 X03（展望不是加碼或停扣訊號）。本領域所有功能都只呈現事實、使用者自己的假設與算術，不給買賣、加碼、停扣、評等或配置建議，不做綜合評分。

## 1. 目標

| 條目 | 做完後使用者看到的 |
| --- | --- |
| #4 A-11 | 定投試算的說明寫出「試算起點」與「首筆日期」，講清楚首月可能不完整、匯率當天沒有時沿用之前最近一筆；不再寫「用當日 USD/TWD 換匯」。試算數字不變 |
| #4 C-01 | 「同金額期初單筆」下方多一句「假設整筆資金在期初已備妥；逐月新收入無法照此提前投入。」，網頁與 App 同字 |
| #11 資金類型 | 試算多一個「資金類型」：每月新收入（預設）不列一次投入對照；期初已有整筆資金才列「一次投入」對「分批投入」，附資金前提與「等待中的現金不計利息」 |
| #11 ETF 資料卡 | 每檔 ETF 可展開「產品資料」：註冊地、配息、ISIN、費用率與資料日、倍數與每日重設、出處與查閱日；1x 與槓桿／反向各有一句證據邊界說明，定投試算選到槓桿／反向時也會出現 |
| #12 成本與稅費情境 | 使用者填自己的費率、換匯價差、固定費、假設配息率、口徑與稅務身分，看到每次扣款的成本拆解與分層的年化項目（基金費用、基金層預扣、投資人層預扣各列一行、不加總），附來源與查閱日；不存檔、不比較券商 |
| #12 檢查清單 | 「稅務與傳承檢查清單」兩份：台灣家庭海外所得（最低稅負）資料檢查、美國遺產稅申報資料檢討；每份附官方頁面更新日與查閱日；不算稅額、不給建議 |
| #13 重疊預覽 | ETF 頁列出觀察名單公司在 S&P 500 的權重（股類合併）、名單合計覆蓋、指數前十大公司合計；寫明「以 YYYY-MM-DD 的 SPY 持股作指數代理推估」；只有使用者填了金額才算假設曝險；槓桿／反向不適用 |

## 2. 現況與證據（皆在 HEAD 親自確認仍存在，沒有已修好的項目）

- **A-11**：`web/src/server/views.ts:303` 的 `startDate = end − round(years × 365.25)` 天，不對齊月初；`web/src/lib/analytics.ts:158` 先 `filter(p.date >= startDate)`，`:162`、`:167` 以 `lastMonth = ""` 判斷新月份，所以首筆落在起點當天或之後第一個交易日（可能月中）。匯率在 `views.ts:299` 用 `fx.onOrBefore(p.date)`，當天沒有就沿用之前最近一筆。說明卻寫「每月第一個交易日以收盤價買入，用當日 USD/TWD 換匯」（`web/pages/etfs.tsx:187`）與「用當天 USD/TWD 換匯」（`ios/MarketObservatory/Views/MoreView.swift:248`）；`analytics.ts:154` 的註解與 `views.ts:294` 的註解也寫「每月第一個交易日」。V-A 第 11 條合成重現：start=2040-01-15 時首筆在 2040-01-16。
- **C-01 文字**：`analytics.ts:177` 的 `lumpUnits = invested / pts[0].close` 把整段累計投入放在第一天；網頁 `etfs.tsx:174` 與 App `MoreView.swift:209-214` 只標「同金額期初單筆」，沒有資金前提（V-C 第 1 條）。
- **#11 資金類型**：`etfsView`（`views.ts:270-312`）與兩端畫面沒有區分「每月新收入」與「期初已有整筆」；一次投入對照對所有人都顯示。
- **#11 資料卡**：`EtfProduct`（`web/src/lib/universe.ts:28-41`）只有倍數、費率、AUM、來源網址與備註，沒有註冊地、ISIN、配息政策（V-C 第 2 條）。定投選單含 SSO、UPRO、SPXL、SH、SDS、SPXU、SPXS（`universe.ts:50-56`，網頁 `etfs.tsx:140`、App `MoreView.swift:182`），表格頁尾 `etfs.tsx:122` 有每日重設提醒，但定投試算區沒有 1x 與槓桿／反向的證據邊界（V-C §4、R1-5）。
- **#12 成本情境**：`DEFAULT_PLAN.notes`（`views.ts:231`）仍把「交易券商與手續費、換匯成本」列為待定；全專案沒有成本或稅費試算（V-K 第 4 條）。試算只說不含配息、手續費、換匯價差與稅（`etfs.tsx:187`）。
- **#12 檢查清單**：全專案沒有台灣海外所得或美國遺產稅的內容（R3-3）。財政部頁面（V-C 第 15 條）我於 2026-10-28 再開一次：內容更新 115-04-15（頁尾另顯示 115-10-28），第十至十三題與研究一致，**頁面沒有標明 100 萬元、750 萬元適用的所得年度**。
- **#13 重疊**：名單頁已有股類合併後的權重與 as-of（`views.ts:389-399`、`web/pages/watchlist.tsx:141`），ETF 頁沒有任何重疊資訊。持股檔仍是 upsert、不刪消失的代號（`web/src/server/repo.ts:188-193`）、`latestHoldings` 只取最大 as_of（`web/src/server/watchlist.ts:83-88`），這是 L1 的 B-07（L1-T5），#13 依賴它。

## 3. 共用約束

- **`Plan` 不加任何欄位。** `savePlan`（`views.ts:257`）整筆覆寫，App 的 `Plan` Codable（`ios/MarketObservatory/Models.swift:336-344`）讀進來再整筆送回（`MoreView.swift:112-117`、`:298-303`）；新欄位放進 Plan 會被舊版與新版 App 的 PUT 洗掉。本領域的資金類型、成本假設、重疊金額全部是查詢參數，`PUT /api/v1/etfs` 與 `PlanSchema` 不變。
- **每人資料不進快取。** `cachedPage`（`views.ts:279`）的鍵只有 `etf`、`years`、`monthly`。funding、成本情境、重疊預覽一律在 `cachedPage` 回呼之外算好、接在回傳物件上（照 `views.ts:311` 對 `plan` 的做法）；重疊用到的名單用唯讀的 `loadWatchlist(c.env.DB, watchlistKey(v))`，不用會寫入、重算快照的 `membersOf`。本領域不新增任何 D1 寫入、設定鍵或 migration。
- **API**：只在 `GET /api/v1/etfs` 新增欄位：`dca.firstBuyDate`、頂層 `funding`、`rows[].facts`、頂層 `costScenario`、`checklists`、`overlap`。既有欄位的型別與語意不變；Swift 端一律 optional，舊 fixture `ios/MarketObservatoryTests/Fixtures/etfs.json` 必須仍能解碼。每張動到 view 的票都要 `MO_UPDATE_API_FIXTURES=1` 重產 `generated-etfs.json` 並審 diff（只能多出本票的欄位）；`generated-watchlist.json` 在整個領域都不得改變。
- **網頁頁面測試**：`web/tests/etf-save-feedback.test.ts:16-40` 把 `pages/etfs.tsx` 去掉 import 後用固定參數清單注入名稱（`:31-32`）。L5-T1 把這個 harness 抽到 `web/tests/helpers/etf-page.ts`（可覆寫 props、注入全部 import 名稱），之後每張票在 `etfs.tsx` 新增 import 時一起更新注入清單。
- **雙端字串**：試算區的固定句子放 `web/src/lib/etf-copy.ts`（新檔），App 放 `ios/MarketObservatory/EtfCopy.swift`（新檔，`extension Copy`），由 `web/tests/etf-copy.test.ts` 與 `ios/MarketObservatoryTests/EtfCopyTests.swift` 逐字比對同一組字串。用新檔是為了不和 L3 在 `Format.swift`、`CopyTests.swift`、`communication.ts` 的改動衝突。成本情境、檢查清單、重疊預覽的說明句由 API 帶給 App（`notes`、`footer` 等欄位），App 不複製一份。
- **App 新區段**放 `ios/MarketObservatory/Views/EtfSections.swift`（L5-T4 建立，之後的 iOS 票追加），`MoreView.swift` 只加插入點與 `load()` 的查詢參數，減少和其他領域的衝突。
- **不碰（整個領域）**：`MoreView.swift:251-353`（「我的規劃」與 `PlanEditor`，L3-T6）、`web/pages/etfs.tsx:193-224`（「我的規劃」面板）、`web/src/lib/plan.ts`、`PlanSchema`／`DEFAULT_PLAN`／`savePlan`（`views.ts:224-259`）、`web/src/lib/forecast.ts`、`web/docs/forecast.md`、`web/src/server/repo.ts`、`web/src/server/watchlist.ts`（L1 B-07）、`web/src/server/jobs.ts`、`web/crons/`、`web/db/`、`web/scripts/`、`ETFS` 的代號清單與 `yahooSymbols`／`nasdaqCheckSymbols`（不新增抓取）、`.claude/skills/verify/SKILL.md`、`.claude/skills/verify/scripts/`、`ios/MarketObservatoryUITests/`。
- **驗收指令**（每張票照列；每一條都是可直接執行的完整指令，`<worktree>` 由監工換成本領域 worktree 的絕對路徑，指令裡不夾說明文字）：
  - web：`cd <worktree>/web && npx void prepare`；`cd <worktree>/web && npm run typecheck`；`cd <worktree>/web && node --test tests/<該票的檔>.test.ts …`；動到 view 的票再跑 `cd <worktree>/web && MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts`、`cd <worktree>/web && git diff --stat -- ../ios/MarketObservatoryTests/Fixtures/generated/`、`cd <worktree>/web && git diff --exit-code -- ../ios/MarketObservatoryTests/Fixtures/generated/ ':(exclude)../ios/MarketObservatoryTests/Fixtures/generated/generated-etfs.json'`（除了 `generated-etfs.json` 之外的 generated 檔有任何變動就非 0，`generated-watchlist.json` 不變也由這條把關；要在本票 commit 前跑）、`cd <worktree>/web && node --test tests/api-contract.test.ts`；最後 `cd <worktree>/web && npm test`。「`generated-etfs.json` 只多出本票欄位、既有欄位的值不變」是審閱項目，寫在各票的「測試」裡，由審查者對 `git diff --stat` 列出的檔看 diff。
  - iOS：`cd <worktree>/ios && xcodegen generate`；`cd <worktree>/ios && xcodebuild build-for-testing -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO`（generic destination 不開模擬器，可和其他領域平行）；最後一條把測試與關機合成一條，測試失敗也會關機、結束碼等於測試結果：`cd <worktree>/ios && xcodebuild test-without-building -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'platform=iOS Simulator,name=MO iPhone 16 Plus' -derivedDataPath build CODE_SIGNING_ALLOWED=NO -only-testing:MarketObservatoryTests; rc=$?; xcrun simctl shutdown "MO iPhone 16 Plus"; [ $rc -eq 0 ]`。
  - **模擬器全域鎖**：上面最後那條會開 `MO iPhone 16 Plus`，必須在工作流程的全域 iOS 模擬器鎖內執行：同一時間只有一個領域能開模擬器，關機後才交給下一個；`MO iPhone 16 Plus` 與 `MO iPhone 18 Pro Max` 不同時開（`AGENTS.md:8`）。web 的 `npm test` 與 iOS `build-for-testing` 不受鎖限制。不新增、不刪除模擬器。
  - **L7-T1 合併前**任何驗收都不跑 `ios-up.sh`、`down.sh`（現行版本會新增與刪除模擬器）；最後整合 UI 驗收照 `AGENTS.md:8` 的手動流程：拿全域鎖、開既有 MO 機、把它的 UDID 寫進本輪 `$RUN/sim.udid`，再用 `ios-test.sh`／`ios-walkthrough.sh`，驗完 `xcrun simctl shutdown` 並手動關本輪 dev server 與暫存。
- **合併與整合**（交叉審稿後補）：
  - 合併順序：L5 排在 L1、L3 之後。L5-T9 依賴 L1-T5（持股同日集合原子替換）；L3-T6 改 `MoreView.swift:251-256`、`:312`、`:316` 與 `etfs-dca.md:3`、`:12`、`:32`。L5 在整合分支 rebase 解衝突時，保留 L3-T6 的「檢討門檻」用語與 `PlanCopy`、L1-T5 的 `replaceWeights` 與 L1-T6 的「權重未更新」，不改寫先合併領域的語意。若整合者排的順序不同，照同一原則由後合併者保留先合併者的語意。
  - `web/tests/api-contract.test.ts`：本領域只改 `:52` 那行 etfs 的查詢參數（L5-T5 加 `cost*`、L5-T9 加 `ovEtf`／`ov`）；與其他領域在 `:44-47` 的種子列、L4-T6 新增的 settings 列相鄰，衝突一律取聯集、各領域的列都保留。L5 的 `FixtureDecodingTests.generatedEtfs` 斷言（`costScenario?.perBuy?.costPct != nil`、`overlap?.exposure != nil`）依賴 `:52` 的這些參數，以及既有種子 `:35`（`watchlist:contract-user` 為 `DEFAULT_WATCHLIST`，含 NVDA）與 `:31-34`（NVDA 等持股列），合併時不得丟掉。
  - generated fixture 不手動合併：每合併一個領域，就在整合分支跑 `cd <worktree>/web && MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts`，審 diff 只多出該領域宣告的欄位（L5 只動 `generated-etfs.json`：`dca.firstBuyDate`、`funding`、`rows[].facts`、`costScenario`、`checklists`、`overlap`），再在全域模擬器鎖內跑 iOS `MarketObservatoryTests`。
  - 功能地圖：本領域只改 `etfs-dca.md`，以及 `features/README.md`「功能」清單裡 ETF 那一行（`:54`）；`README.md:7`、`:10` 與 `watchlist.md:34` 屬 L7-T1。`watchlist.md` 要不要加「ETF 頁的重疊預覽會讀同一份名單」的交叉引用，由整合者在全部合併後統一對帳時決定，L5 不改。

## 4. 票

同一條分支依序做，順序就是編號。web 票先做、iOS 票接在對應的 web 票之後。

### L5-T1　定投說明對齊實作，「同金額期初單筆」補資金前提（P0 #4：A-11、C-01 文字）

- **行為**：試算數字不變，首月政策維持現行實作（不改成跳過不完整首月；任務是說明對齊實作，改政策會讓兩端既有數字一起變）。
  - `simulateDca` 的回傳多一個 `firstBuyDate`（第一筆買入日）；API `dca.firstBuyDate`。
  - 網頁 `etfs.tsx:186-188` 改成：`試算起點 {sim.startDate}，首筆 {dca.firstBuyDate}。{DCA_BUY_RULE}；{DCA_FX_RULE}（最新 {fx}，{fxDate}）。不含配息、手續費、換匯價差與稅。歷史試算不代表未來。`
  - App `MoreView.swift:248` footer：有 `dca` 時開頭加 `試算起點 {Fmt.fullDate(startDate)}，首筆 {Fmt.fullDate(firstBuyDate)}。`，接著 `{Copy.dcaBuyRule}；{Copy.dcaFxRule}。不含配息、手續費、換匯價差與稅。改標的、期間或金額只是試算，按「設為我的預設」才會存起來。` 與原本的最新匯率句；沒有 `dca` 時省略起點與首筆那句。
  - 「同金額期初單筆」KPI 下方（網頁 `etfs.tsx:174` 的 `.kpi` 內加 `<div className="meta">`；App `MoreView.swift:209-214` 的 `LabeledContent` 下加 caption）顯示 `DCA_LUMP_PREMISE`。
  - 字串（兩端逐字相同）：
    - `DCA_LUMP_PREMISE`＝`假設整筆資金在期初已備妥；逐月新收入無法照此提前投入。`
    - `DCA_BUY_RULE`＝`首筆在試算起點當天或之後的第一個交易日、之後每月第一個交易日，以收盤價買入；首月可能不是完整月份`
    - `DCA_FX_RULE`＝`換匯用買入日的 USD/TWD，當天沒有匯率時沿用之前最近一筆`
- **改動**：`web/src/lib/analytics.ts`（`DcaResult` 加 `firstBuyDate: string`、`simulateDca` 設定它、`:153-156` 註解改寫首筆規則）；`web/src/lib/etf-copy.ts`（新）；`web/src/server/views.ts:294`（只改註解）；`web/pages/etfs.tsx:174`、`:186-188`；`web/tests/helpers/etf-page.ts`（新，自 `etf-save-feedback.test.ts:16-40` 抽出）；`web/tests/etf-save-feedback.test.ts`（改用 helper，斷言不變）；`web/tests/etf-copy.test.ts`（新）；`web/tests/analytics.test.ts`；`ios/MarketObservatory/EtfCopy.swift`（新）；`ios/MarketObservatory/Models.swift:380-396`（`Dca` 加 `let firstBuyDate: String?`）；`ios/MarketObservatory/Views/MoreView.swift:209-214`、`:248`；`ios/MarketObservatoryTests/EtfCopyTests.swift`（新）；`ios/MarketObservatoryTests/FixtureDecodingTests.swift:23-27`；`generated-etfs.json`；`etfs-dca.md`。
- **測試（修正前會失敗）**：
  - `analytics.test.ts`：序列 2040-01-02＝10、2040-01-16＝10、2040-02-01＝20、2040-02-02＝20，`simulateDca(x, "2040-01-15", 1000)`：`firstBuyDate === "2040-01-16"`、`path[0].date === "2040-01-16"`、`months === 2`、`invested === 2000`、`lumpSumValue === 2000 / 10 * 20`。修正前 `firstBuyDate` 是 undefined。
  - `etf-copy.test.ts`：三個常數逐字等於上列字串；用 helper 渲染 `dca`（`firstBuyDate: "2040-01-16"`）、`sim.startDate: "2040-01-15"`、`fxLast: { date: "2040-02-02", close: 31 }`：頁面文字含「首筆 2040-01-16」、`DCA_FX_RULE`、`DCA_LUMP_PREMISE`，不含「用當日 USD/TWD」「錯失」「少賺」。修正前失敗。
  - `EtfCopyTests.swift`：`Copy.dcaLumpPremise`、`Copy.dcaBuyRule`、`Copy.dcaFxRule` 與網頁字串相同（修正前不存在、編譯失敗）。`FixtureDecodingTests.generatedEtfs` 加 `#expect(p.dca?.firstBuyDate != nil)`；舊 `etfs.json` 仍解得開。
  - 審閱：`generated-etfs.json` 只多出 `dca.firstBuyDate`，`invested`、`value`、`lumpSumValue` 等既有值不變。
- **呼叫端**：`simulateDca` ← `views.ts:304`、`tests/analytics.test.ts:33`；`DcaResult` 經 `views.ts:306` 展開進 `etfsView` ← `pages/etfs.server.ts:8`、`routes/api/v1/etfs.ts:6`、`tests/etf-query.test.ts:10`、`:25`、`:39`、`tests/api-contract.test.ts:52`；`etfs.tsx` 的 import 名稱 ← `tests/etf-save-feedback.test.ts:31-32`；App `Etfs.Dca` ← `MoreView.swift:205-231`、`FixtureDecodingTests.swift:24`、`:111`。
- **不碰**：首月政策與匯率補值邏輯（`analytics.ts:158-177` 的買入規則、`views.ts:297-304`）；資金類型（L5-T2）。`etfs-dca.md:3` 只改括號裡的定投規則（「每月第一個交易日買入、當天匯率換匯」），同一行的規劃用語與 `:12`、`:32` 屬 L3-T6。

### L5-T2　資金類型：每月新收入／期初已有整筆資金（#11，C-01）

- **行為**：
  - `etfsView` 讀查詢參數 `funding`：`lump` 為「期初已有整筆資金」，其他值或沒帶都是 `monthly`；在 `cachedPage` 之外回傳頂層 `funding`。`dca` 所有數字不因 funding 改變，快取鍵不加 funding。
  - 網頁試算表單在「期間」之後加 select「資金類型」（選項：每月新收入、期初已有整筆資金），改選時 `router.visit`；`simUrl`（`etfs.tsx:47-50`）保留 `funding`，改標的、期間或金額不會把它洗掉。「設為我的預設」不存 funding。
  - **每月新收入**（預設）：KPI 列「投入 N 個月」「目前市值」「最大帳面虧損」；不顯示一次投入 KPI，改顯示 `DCA_MONTHLY_NO_LUMP`。
  - **期初已有整筆資金**：金額欄 label 改「每月分批金額（台幣）」；KPI 列「期初資金」＝`dca.invested`、「一次投入（{firstBuyDate} 全部買入）」＝`lumpSumValue`／`lumpSumReturnPct`、「分 {months} 個月投入」＝`value`／`returnPct`、「分批的最大帳面虧損」＝`maxDrawdownPct`；下方 `DCA_LUMP_PREMISE` 與 `DCA_IDLE_CASH`。
  - App：試算 Section 在「期間」Picker 之後加 Picker「資金類型」，`load()`（`MoreView.swift:86-90`）多帶 `funding`，回應的 `funding` 存回 state（同 `simEtf` 的作法）；兩種呈現與網頁相同。
  - 字串（兩端逐字相同）：`FUNDING_MONTHLY_LABEL`＝`每月新收入`；`FUNDING_LUMP_LABEL`＝`期初已有整筆資金`；`DCA_MONTHLY_NO_LUMP`＝`每月新收入無法在期初一次投入，所以這裡不列一次投入對照；期初已有整筆資金時，資金類型改選「期初已有整筆資金」。`；`DCA_IDLE_CASH`＝`分批期間還沒投入的現金不計利息。`
- **改動**：`web/src/server/views.ts`（`etfsView` 回傳處 `:311`）；`web/src/lib/etf-copy.ts`；`web/pages/etfs.tsx:47-50`、`:128-176`；`web/tests/etf-query.test.ts`；`web/tests/etf-copy.test.ts`；`web/tests/helpers/etf-page.ts`；`ios/MarketObservatory/Models.swift`（`Etfs` 加 `let funding: String?`）；`ios/MarketObservatory/Views/MoreView.swift:52-60`、`:81-103`、`:177-234`；`ios/MarketObservatory/EtfCopy.swift`；`ios/MarketObservatoryTests/EtfCopyTests.swift`；`FixtureDecodingTests.swift`；`generated-etfs.json`；`etfs-dca.md`。
- **測試（修正前會失敗）**：
  - `etf-query.test.ts`：同一個 viewer 依序以 funding 未帶、`lump`、`xyz` 呼叫 `etfsView`：`funding` 依序為 `monthly`、`lump`、`monthly`，三次的 `dca` `deepEqual`。修正前 `funding` 是 undefined。
  - `etf-copy.test.ts`：`monthly` 渲染不含「一次投入」「同金額期初單筆」、含 `DCA_MONTHLY_NO_LUMP`；`lump` 渲染含「一次投入（2040-01-16 全部買入）」、`DCA_LUMP_PREMISE`、`DCA_IDLE_CASH`；`funding: "lump"` 時觸發標的 select 的 onChange，`visits[0]` 含 `funding=lump`。新字串逐字比對。
  - `EtfCopyTests.swift` 新字串相同；`generatedEtfs` 的 `funding == "monthly"`。
  - 審閱：`generated-etfs.json` 只多出頂層 `funding`。
- **呼叫端**：`etfsView` ← 同 L5-T1；`simUrl` ← `etfs.tsx:38`、`:134`、`:139`、`:145`；App `load()` ← `MoreView.swift:74`、`:78`、`:119`、`:180`、`:186`、`:199`。
- **不碰**：`Plan`／`PlanSchema`、`PUT /api/v1/etfs`、`simulateDca`、`dca` 既有欄位的值。

### L5-T3　ETF 產品資料卡與 1x／槓桿證據邊界（#11，C-02、R1-5；資料、API、網頁）

- **行為**：
  - `universe.ts` 新增 `interface EtfFacts { domicile: string; distribution: string | null; isin: string | null; sourceUrl: string; checkedAt: string }`，`EtfProduct` 加 `facts: EtfFacts`，11 檔全填。**每個值都要在發行商官方頁或公開說明書查到**，`sourceUrl` 填實際查到該值的頁面，`checkedAt` 填查閱日（YYYY-MM-DD）；查不到的欄位填 null，畫面顯示「未查核」，不得憑記憶填。PR 描述附 11 列「代號／欄位／值／出處網址／查閱日」表供審查抽查。`distribution` 用中文寫配息政策（例如「配息（每季）」），以發行商頁的寫法為準。
  - `ETFS` 代號清單不變；在 `ETFS` 上方加註解：「擴充台灣上市的 S&P 500 ETF 時注意 006205 是富邦上証，不是 S&P 500（研究 V-C 第 13 條）」。
  - `etfsView` 的 rows 已用 `...e` 展開（`views.ts:291`），`facts` 自動進 API，`views.ts` 不必改。
  - 網頁：ETF 表格代號欄（`etfs.tsx:98-102`）與窄螢幕卡片（`:62-78`）各加 `<details><summary>產品資料</summary>`：註冊地、配息、ISIN、費用率（淨／總，`{catalogAsOf}` 查核）、倍數（1x 寫「1x，不每日重設」；其他寫「{n}x，每日重設」或「反向 {n}x，每日重設」）、出處連結與查閱日；最後一行證據邊界句（1x 用 `EVIDENCE_1X`，其他用 `EVIDENCE_LEVERAGED`）。
  - 定投試算面板（`etfs.tsx:186` 說明之上）：所選 `sim.etf` 的 `multiple === 1` 顯示 `EVIDENCE_1X`（一般 meta 樣式），否則顯示 `EVIDENCE_LEVERAGED`（警示樣式，沿用既有 class）。
  - 字串（兩端逐字相同，App 在 L5-T4）：
    - `EVIDENCE_1X`＝`一次投入與定期定額的歷史研究只涵蓋非槓桿、正向 1x 的股票產品；這裡的試算是過去一段期間的算術結果，不代表未來。`
    - `EVIDENCE_LEVERAGED`＝`這是每日重設的槓桿或反向產品：持有超過一天，報酬會偏離「倍數 × 指數報酬」，盤整或大波動時偏離通常更大。一般定投與一次投入的研究結論不適用這類產品，這裡的試算只是這段歷史的算術結果。`
- **改動**：`web/src/lib/universe.ts:28-57`；`web/src/lib/etf-copy.ts`；`web/pages/etfs.tsx:62-122`、`:186`；`web/tests/etf-facts.test.ts`（新）；`web/tests/etf-copy.test.ts`；`web/tests/helpers/etf-page.ts`；`generated-etfs.json`；`etfs-dca.md`。
- **測試（修正前會失敗）**：`etf-facts.test.ts`：(1) 每檔 `facts` 存在、`domicile` 非空、`sourceUrl` 以 `https://` 開頭、`checkedAt` 是合法 ISO 日期；(2) `isin` 為 null，或符合 `^[A-Z]{2}[A-Z0-9]{9}\d$` 且 ISIN 檢查碼（字母轉數字後 Luhn）正確；(3) 非 null 的 ISIN 不重複；(4) `etfsView` 回傳的每列 `facts` 與 `ETFS` 同代號那列 `deepEqual`。修正前 `facts` 是 undefined。`etf-copy.test.ts`：rows 含 UPRO（multiple 3）且 `sim.etf = "UPRO"` 時渲染含 `EVIDENCE_LEVERAGED`；`sim.etf = "VOO"` 時含 `EVIDENCE_1X`；資料卡含「註冊地」「ISIN」「每日重設」。審閱：`generated-etfs.json` 只多出 `rows[].facts`。
- **呼叫端**：`EtfProduct`／`ETFS` ← `views.ts:131`（走勢標籤，只讀 ticker）、`:246`（PlanSchema 驗證 ticker）、`:276`、`:282`、`:286`；`universe.ts:66`、`:75`；`tests/api-contract.test.ts:23`。新欄位不影響這些只讀 ticker 的呼叫端。
- **不碰**：代號清單、費率與 AUM 數字（除非查閱時發現與官方不符，那要另開票）、`yahooSymbols`、`nasdaqCheckSymbols`。

### L5-T4　App：產品資料卡與證據邊界（#11）

- **行為**：App ETF 列（`MoreView.swift:152-157` 的說明區之後）加 `DisclosureGroup("產品資料")`，內容與網頁相同；出處用 `Link`。定投試算 Section 依所選標的的倍數顯示 `Copy.evidence1x` 或 `Copy.evidenceLeveraged`（後者用 `Notice` 警示樣式）。大字級時文字完整換行、不截斷。
- **改動**：`ios/MarketObservatory/Models.swift:354-371`（`Row` 加 `let facts: Facts?`；`struct Facts: Decodable, Sendable { let domicile: String; let distribution: String?; let isin: String?; let sourceUrl: String; let checkedAt: String }`）；`ios/MarketObservatory/Views/EtfSections.swift`（新，`EtfFactsDisclosure`）；`MoreView.swift:152-157`、`:205` 附近（插入點）；`EtfCopy.swift`；`EtfCopyTests.swift`；`FixtureDecodingTests.swift`；`etfs-dca.md`。
- **測試**：`EtfCopyTests` 兩句與網頁逐字相同（修正前編譯失敗）；`generatedEtfs` 斷言 VOO 的 `facts?.domicile` 非 nil；舊 `etfs.json` 解碼後 `facts == nil`。
- **呼叫端**：`Etfs.Row` ← `MoreView.swift:135-170`、`:182`。
- **不碰**：`MoreView.swift:251-353`。

### L5-T5　成本與稅費情境（#12，K-02、C-03、R1-6；計算、API、網頁）

- **行為**：
  - 新增 `web/src/lib/costs.ts`（純函式，不碰 D1）：
    - `parseCostQuery(get: (k: string) => string | undefined)`：讀 `costCcy`（`twd`｜`usd`，預設 `twd`）、`costFx`（換匯價差 %，0–5）、`costFee`（手續費比例 %，0–5）、`costMinUsd`（最低手續費美元，0–100）、`costFixed`（每次扣款／匯款固定費台幣，整數 0–10000）、`costPromo`（優惠到期日 YYYY-MM-DD，可省略）、`costYield`（假設年配息率 %，指一般股利，0–10）、`costBasis`（`nav`｜`index`，預設 `nav`）、`costTax`（`tw`｜`other`，預設 `tw`）。完全沒有 `cost*` 參數回 null；有但不合法回 `{ issue }`（中文，例如「手續費比例要在 0–5% 之間」）；缺的數字欄位當 0。
    - `costScenario(input, { monthlyTwd, fxRate, fxDate, etf: EtfProduct, today })`：
      - `perBuy`：`amountTwd = monthlyTwd`；`fxSpreadTwd = ccy === "twd" ? amount × costFx% : 0`；`fixedTwd = costFixed`；`tradeTwd = amount − fxSpread − fixed`；`commissionTwd = max(tradeTwd × costFee%, costMinUsd × fxRate)`；`investedTwd = tradeTwd − commission`；`costTwd = amount − invested`；`costPct = costTwd / amount × 100`。
      - `annualTxCostTwd = costTwd × 12`（每月扣一次、一年 12 次的交易成本）。
      - `layers`（年化、占持有市值的 %，**各自列出、不加總、不和交易成本相加**）：(1) `fundExpense`：`index` 口徑＝`etf.netFeePct`；`nav` 口徑＝null 並註明「已反映在基金淨值，不重扣」。(2) `fundWithholding`：`etf.facts.domicile === "美國"` 時＝0，註明「美國註冊基金持有美股，基金層不預扣美國股利稅」。(3) `investorWithholding`：`costTax === "tw"` 且美國註冊時＝`costYield × 30%`，註明「美國註冊 ETF 分配的一般股利通常預扣 30%（無適用協定）；資本利得分配、資本返還等其他分配性質不計」；`other` 時＝null 並註明「不套用：請依你的稅務身分確認」。
      - `promo`：沒填為 null，否則 `{ until, expired: until < today }`。
      - `notes`：固定一句 `這是你填的假設算出的情境，不是券商實際收費，也不是應納稅額；不比較券商，也不代表哪個產品比較好。`；`etf.multiple !== 1` 時加 `槓桿與反向產品的分配性質與頻率不同，本情境只按你填的配息率估算。`；換算最低手續費時加 `最低手續費以 {fxDate} 的 USD/TWD {fxRate} 換算。`
      - `sources`：用到的規則（名稱、網址、來源日期、查閱日）。
      - `inputs`：正規化後的輸入（兩端用來重建表單與網址）。
      - 不可算的情況回 `{ issue }`：`tradeTwd ≤ 0` 或 `investedTwd ≤ 0`→「每月金額扣掉固定費用、換匯價差與手續費後已不夠買進」；`costMinUsd > 0` 但沒有匯率→「沒有匯率資料，無法換算最低手續費」。
  - 新增 `web/src/lib/tax-facts.ts`（純資料）：`US_DIVIDEND_WITHHOLDING`（30%；適用：台灣稅務居民、非美國公民且非美國稅務居民、無適用協定；來源 IRS Publication 515 (2026) `https://www.irs.gov/publications/p515` 與 IRS 所得稅協定 A–Z（未列台灣）`https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z`；查閱 2026-10-28）、`US_FUND_LEVEL_WITHHOLDING`（0%；State Street 2026-06-02 `https://www.ssga.com/hk/en/institutional/insights/considerations-for-non-us-investors-us-etfs-vs-irish-ucits`；查閱 2026-10-28）。只放 V-C 已查核的事實，不新增稅率。
  - `etfsView` 在 `cachedPage` 之外：`monthlyTwd` 用 `sim.monthlyTwd`、匯率用 `computed.fxLast`、`etf` 用 `ETFS` 中 `sim.etf` 那檔、`today` 用 `new Date().toISOString().slice(0, 10)`，回傳頂層 `costScenario`（null、`{ issue }` 或情境）。不讀寫 D1、不存設定。
  - 網頁：試算面板之後新增面板「成本情境（你的假設）」：表單欄位「扣款幣別」「換匯價差 %」「手續費比例 %」「最低手續費（美元）」「每次固定費用（台幣）」「優惠到期日」「假設年配息率 %」「報酬口徑」（基金淨值／總報酬、稅前指數）「稅務身分」（台灣稅務居民、非美國公民且非美國稅務居民；其他）；按「試算成本」以 `router.visit` 帶上全部 `cost*` 參數，「清除」移除它們。結果：每次扣款拆解表、一年交易成本、三層年化項目各一列、優惠提醒（過期時醒目標示「你填的優惠已過期」）、`notes`、來源連結與查閱日。`simUrl` 依 `costScenario.inputs` 保留 `cost*` 參數。
- **改動**：`web/src/lib/costs.ts`（新）、`web/src/lib/tax-facts.ts`（新）、`web/src/server/views.ts`（`etfsView` 回傳處）、`web/pages/etfs.tsx`、`web/tests/costs.test.ts`（新）、`web/tests/etf-query.test.ts`、`web/tests/etf-copy.test.ts`、`web/tests/helpers/etf-page.ts`、`web/tests/api-contract.test.ts:52`（etfs 的 query 加 `costFee: "0.1", costMinUsd: "1", costFx: "0.3", costYield: "1.2"`，讓 fixture 涵蓋非 null 分支）、`generated-etfs.json`、`etfs-dca.md`。
- **測試（修正前會失敗：模組不存在、`costScenario` undefined）**：`costs.test.ts` 手算案例：
  - A：月 10000、`twd`、價差 0.5%、固定 0、費率 0.1%、最低 0、匯率 32 → 價差 50、手續費 9.95、買進 9940.05、成本 59.95（0.5995%）、一年 719.4。
  - B：月 3000、價差 0、費率 0.1%、最低 US$1、匯率 32 → 手續費 32（最低費生效）、買進 2968、成本率 ≈ 1.0667%。
  - C：`usd` 且價差填 1 → `fxSpreadTwd === 0`。
  - 口徑：VOO（淨費 0.03）、配息率 1.2、`tw`：`nav` → `fundExpense` null、`investorWithholding` 0.36；`index` → `fundExpense` 0.03、`investorWithholding` 0.36（費用只出現一次）；`other` → `investorWithholding` null。
  - 例外：固定費 ≥ 月額回 `issue`；`costFee=9` 回 `issue`；`costMinUsd=1` 且匯率 null 回 `issue`；`costPromo=2026-01-01`、today 2026-10-28 → `expired === true`。
  - 回傳物件沒有任何把各層加總或「稅後報酬」的欄位（斷言 key 集合）。
  - `etf-query.test.ts`：同 etf／years／monthly 先帶 `costFee=0.1` 再不帶，第二次 `costScenario === null`（證明不在快取裡）；`costFee=9` → `costScenario.issue` 是中文。
  - `etf-copy.test.ts`：渲染含「成本情境（你的假設）」與 `notes` 第一句；`costScenario.issue` 時顯示 issue、不顯示數字。
  - 審閱：`generated-etfs.json` 只多出非 null 的頂層 `costScenario`。
- **呼叫端**：`etfsView` ← 同 L5-T1；`simUrl` ← 同 L5-T2；`ETFS` 只讀。
- **不碰**：既有 `dca` 數字（不把成本套進歷史試算）、`Plan`、`PUT /api/v1/etfs`、任何 D1 寫入。

### L5-T6　App：成本情境（#12）

- **行為**：App 試算 Section 之後新增 Section「成本情境（你的假設）」：沒有情境時一個「設定假設」按鈕；按下開 sheet（欄位與網頁同名，預設值同網頁），按「試算」把參數存進 `EtfView` 的 state 並 `load()`；「清除」移除參數。結果呈現同網頁（拆解、一年交易成本、三層各一列、優惠提醒、notes、來源 `Link`），文字全由 API 帶。不儲存，sheet 註明「只是試算，不會儲存」。
- **改動**：`ios/MarketObservatory/Models.swift`（`Etfs` 加 `let costScenario: CostScenario?`，內部欄位全 optional）；`ios/MarketObservatory/Views/EtfSections.swift`（`CostScenarioSection`、`CostEditor`、`CostQuery`：把輸入轉成與網頁相同的 `cost*` 查詢鍵）；`MoreView.swift:52-60`、`:86-90`（查詢合併 `CostQuery`）與插入點；`ios/MarketObservatoryTests/EtfCostQueryTests.swift`（新）；`FixtureDecodingTests.swift`；`etfs-dca.md`。
- **測試**：`EtfCostQueryTests`：輸入（twd、0.5、0.1、1、0、無優惠、1.2、nav、tw）轉出的 dictionary 正好是 `costCcy=twd, costFx=0.5, costFee=0.1, costMinUsd=1, costFixed=0, costYield=1.2, costBasis=nav, costTax=tw`（修正前不存在）；`generatedEtfs` 斷言 `costScenario?.perBuy?.costPct != nil`；舊 `etfs.json` 解碼 `costScenario == nil`。
- **呼叫端**：`EtfView.load()` ← 同 L5-T2。
- **不碰**：`MoreView.swift:251-353`、`PlanEditor`。

### L5-T7　稅務與傳承檢查清單（#12，C-07、R3-3；資料、API、網頁）

- **行為**：`tax-facts.ts` 加 `TAX_CHECKLISTS`（靜態），`etfsView` 回傳頂層 `checklists`。網頁在成本情境之後新增面板「稅務與傳承檢查清單」，兩個 `<details>`，每份列項目、`note`、`footer`、來源連結與「頁面更新日／查閱日」。內容照下列字句實作，不得自行增減數字或結論：
  - `id: "tw-overseas-income"`，標題「台灣家庭海外所得（最低稅負）資料檢查」：
    1. 以申報戶全年合計的海外所得來看，不是單一帳戶。
    2. 申報戶全年海外所得未達新台幣 100 萬元，免計入基本所得額；達 100 萬元時要全數計入，不是只算超過的部分。
    3. 基本所得額未達 750 萬元，沒有繳納基本稅額的問題；超過時先扣除 750 萬元，餘額按 20% 計算基本稅額。
    4. 基本稅額要和一般所得稅額比較，基本稅額較高時才有差額問題；不是海外所得一律另課 20%。
    5. 海外已納稅額可以扣抵，但有扣抵限額，並以所得來源地稅務機關發給的同一年度納稅證明為準。
    6. 海外財產交易所得依成本費用、實現年度與損失扣除規則計算；匯回多少錢不等於所得。
    7. 基金在基金層被扣的股利稅（例如愛爾蘭註冊 UCITS 的內層扣繳），不能未經確認就當成你個人可扣抵的外國稅；累積型基金賣出實現的所得仍依台灣規則判定，不是免稅工具。
    - `note`：「財政部頁面沒有標明這些金額適用的所得年度；申報前以財政部當年度公告為準。」
    - 來源：財政部稅務入口網（第十至十三題）`https://www.etax.nat.gov.tw/etwmain/tax-info/understanding/tax-saving-manual/national/individual-income-tax/6xKrvGR`，頁面更新 2026-04-15，查閱 2026-10-28。
  - `id: "us-estate"`，標題「美國遺產稅申報資料檢討」：
    1. 先確認身分：本清單只適用非美國公民、非美國居民；美國遺產稅的居住地（domicile）另外判定。
    2. 把所有帳戶（含複委託、海外券商）持有的美國所在地資產合計，不能只看單一券商；美國公司股票與美國註冊 ETF 一般屬美國所在地資產，不論憑證放在哪裡。
    3. 加上相關的贈與調整（gift tax specific exemption 與 adjusted taxable gifts）。
    4. 合計超過 US$60,000 時，身故後通常須申報 Form 706-NA（一般在死亡後九個月內）；這是申報門檻，不是稅額，也不是賣出訊號。
    5. 愛爾蘭等非美國註冊基金的股份，依 IRS 706-NA 說明的股票規則推論一般不屬美國公司股票；信託、聯名、棄籍等情況要個案確認。
    - 來源：IRS「Estate tax for nonresidents not citizens of the United States」`https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax-for-nonresidents-not-citizens-of-the-united-states`（頁面更新 2026-06-28）、IRS Instructions for Form 706-NA `https://www.irs.gov/instructions/i706na`（2025-09）；查閱 2026-10-28。
  - 兩份共同 `footer`：「這是資料檢查清單，不計算你的應納稅額或遺產稅額，也不提供買賣、持有或換產品的建議；實際以主管機關規定與你的申報資料為準。」
- **改動**：`web/src/lib/tax-facts.ts`、`web/src/server/views.ts`（`etfsView` 回傳處）、`web/pages/etfs.tsx`、`web/tests/tax-checklists.test.ts`（新）、`web/tests/etf-copy.test.ts`、`web/tests/helpers/etf-page.ts`、`generated-etfs.json`、`etfs-dca.md`。
- **測試（修正前會失敗）**：`tax-checklists.test.ts`：兩份都在、每份至少一個來源且 `url` 以 `https://` 開頭、`updatedAt`／`checkedAt` 是合法日期；台灣清單文字含「100 萬元」「全數計入」「750 萬元」「20%」「同一年度納稅證明」；遺產清單含「US$60,000」「706-NA」「贈與」「不是賣出訊號」；任何項目都不符合 `/(建議|應該|應)(賣出|買進|加碼|停扣|持有|換成)/`；資料結構沒有任何金額計算欄位。`etfsView` 回傳 `checklists` 與 `TAX_CHECKLISTS` `deepEqual`。渲染含「稅務與傳承檢查清單」與 `footer`。審閱：`generated-etfs.json` 只多出頂層 `checklists`。
- **呼叫端**：`etfsView` ← 同 L5-T1。
- **不碰**：成本計算（L5-T5）、任何個人金額輸入。

### L5-T8　App：稅務與傳承檢查清單（#12）

- **行為**：App 成本情境之後新增 Section「稅務與傳承檢查清單」，每份一個 `DisclosureGroup`，列項目、note、footer、來源 `Link` 與日期；文字全由 API 帶。
- **改動**：`Models.swift`（`Etfs` 加 `let checklists: [Checklist]?`）、`EtfSections.swift`（`TaxChecklistSection`）、`MoreView.swift` 插入點、`FixtureDecodingTests.swift`、`etfs-dca.md`。
- **測試**：`generatedEtfs` 斷言 `checklists?.count == 2` 且每份 `items` 非空；舊 `etfs.json` 解碼 `checklists == nil`。
- **呼叫端**：`EtfView.content` ← `MoreView.swift:63`。
- **不碰**：`MoreView.swift:251-353`。

### L5-T9　ETF 與觀察名單的重疊預覽（#13，K-04、G-01、R3-4；計算、API、網頁）

- **前提**：L1-T5（B-07：持股檔以同日完整檔原子替換、保存更正紀錄）要在同一個整合 PR 裡、並在本票之前合進分支。L1-T6 的「權重未更新」目前只寫進快照 `quality.notes` 與 `/sources`，不在 `latestHoldings`／`watchlistView`；若整合時 L1 已把檔齡／未更新狀態放進這兩個函式，本票沿用同一判斷並顯示同一字樣；沒有就只顯示 as-of，不自訂檔齡門檻。
- **行為**：
  - `web/src/lib/watchlist.ts` 新增 `memberWeights(list, holdings)`，邏輯就是 `views.ts:390`、`:393`、`:398` 那三行（同公司股類權重相加、`outOfIndex`、`totalWeight`）；`watchlistView` 改用它，輸出逐位元不變。
  - 新增 `web/src/lib/overlap.ts`（純函式）：
    - `parseOverlapQuery(get, list)`：`ovEtf`＝ETF 金額（台幣整數 0–10 億）；`ov`＝`KEY:金額,KEY:金額`，KEY 必須在名單內、金額同範圍、最多 `MAX_WATCH` 筆；都沒帶回 null；不合法回 `{ issue }`（中文）。
    - `overlapPreview({ list, holdings, asOf, etf, input })` 回：`asOf`、`proxy: "SPY"`、`applicable: etf.multiple === 1`、`members`（`key`、`company`、`tickers`、`weightPct`、`outOfIndex`，來自 `memberWeights`）、`totalWeight`、`top10CompanyWeight`（`isConstituent` 的持股依 `companyKey(name)` 合併、排序後前十家合計）、`exposure`、`inputs`、`issue`、`notes`。
    - `exposure`：`applicable` 為 false 或沒填任何金額時為 null；否則每家 `viaEtfTwd = ovEtf × weightPct / 100`、`directTwd`、`combinedTwd`、`sharePct = combined / totalTwd × 100`，`totalTwd = ovEtf + Σdirect`，`watchlistSharePct = Σcombined / totalTwd × 100`，`otherViaEtfTwd = ovEtf × (100 − totalWeight) / 100`。
    - `notes`：`以 {asOf} 的 SPY 持股作指數代理推估`（`etf !== "SPY"` 時接「；{etf} 的實際持股可能略有不同」）、`觀察名單不是持倉；只有你填了金額才算假設曝險，這不是配置建議。`；`applicable` 為 false 時加 `槓桿與反向 ETF 用衍生工具達成每日倍數，不適用持股重疊推估。`
  - `etfsView` 在 `cachedPage` 之外：`loadWatchlist(c.env.DB, watchlistKey(v))`、`latestHoldings(c.env.DB)`（只讀），回傳頂層 `overlap`。
  - 網頁：新增面板「與觀察名單的重疊」：notes 第一句（含 as-of）、名單公司表（公司、代號、指數權重）、名單合計覆蓋、指數前十大公司合計；輸入「{etf} 金額（台幣）」與每家「另外持有（台幣）」，按「計算假設曝險」以 `router.visit` 帶 `ovEtf`、`ov`；結果表（經 ETF、另外持有、合計、占你填的總額）。不顯示任何「建議」「過度集中」之類的判斷字。`simUrl` 保留 `ovEtf`、`ov`。
- **改動**：`web/src/lib/watchlist.ts`、`web/src/lib/overlap.ts`（新）、`web/src/server/views.ts`（`watchlistView:390-398` 改用 helper、`etfsView` 回傳處）、`web/pages/etfs.tsx`、`web/tests/overlap.test.ts`（新）、`web/tests/etf-query.test.ts`、`web/tests/etf-copy.test.ts`、`web/tests/helpers/etf-page.ts`、`web/tests/api-contract.test.ts:52`（etfs query 加 `ovEtf: "300000", ov: "NVDA:50000"`）、`generated-etfs.json`、`etfs-dca.md`、`features/README.md:54`（只改 ETF 那一行，補上產品資料、成本情境、稅務清單、重疊預覽）。`watchlist.md` 不改（見 §3「合併與整合」）。
- **測試（修正前會失敗）**：
  - `overlap.test.ts`：持股 NVDA 7（`NVIDIA CORP`）、GOOGL 2（`ALPHABET INC CL A`）、GOOG 1.8（`ALPHABET INC CL C`）、AAPL 6（`APPLE INC`），名單 NVDA、GOOGL（tickers GOOGL+GOOG）：`members` 中 GOOGL 的 `weightPct === 3.8`、`totalWeight === 10.8`；`top10CompanyWeight` 用 `companyKey` 把 GOOGL＋GOOG 算一家（只有三家時等於 16.8）；`ovEtf=100000`、`ov=NVDA:50000` → NVDA `viaEtfTwd 7000`、`combinedTwd 57000`、`totalTwd 150000`、`sharePct 38`；沒填金額 → `exposure === null`；UPRO → `applicable false`、即使有金額 `exposure === null`；`ov=ZZZZ:1` 或金額超過 10 億 → `issue`。
  - `etf-query.test.ts`：兩個 viewer 名單不同、同樣的 etf／years／monthly，各自拿到自己的 `overlap.members`（證明不在快取裡）。
  - `api-contract.test.ts`：`generated-watchlist.json` 不變（由 §3 的 `git diff --exit-code … ':(exclude)…generated-etfs.json'` 把關）；審閱 `generated-etfs.json` 只多出 `overlap` 且 `exposure` 非 null。
  - `etf-copy.test.ts`：渲染含「以 2026-10-28 的 SPY 持股作指數代理推估」這種 as-of 句與「觀察名單不是持倉」；UPRO 時含「不適用持股重疊推估」。
- **呼叫端**：`watchlistView` ← `pages/watchlist.server.ts:8`、`routes/api/v1/watchlist.ts:7`、`:14`、`:22`、`tests/api-contract.test.ts:54`；`latestHoldings` ← `views.ts:389`、`jobs.ts:807`（本票只新增唯讀呼叫，不改函式）；`loadWatchlist` 只新增唯讀呼叫；`etfsView` ← 同 L5-T1。
- **不碰**：`web/src/server/watchlist.ts`、`web/src/server/repo.ts`、`web/pages/watchlist.tsx`、`membersOf`、名單增刪流程、`.claude/skills/verify/features/watchlist.md`（L7-T1 改 `:34`）、`features/README.md` 除了 `:54` 以外的行。

### L5-T10　App：重疊預覽（#13）

- **行為**：App 新增 Section「與觀察名單的重疊」：notes、名單公司與權重、合計覆蓋、前十大公司合計；「填金額」sheet 輸入 ETF 金額與每家另外持有，按「計算」帶 `ovEtf`、`ov` 重新 `load()`；結果表同網頁。槓桿／反向顯示不適用句。
- **改動**：`Models.swift`（`Etfs` 加 `let overlap: Overlap?`，內部欄位 optional）、`EtfSections.swift`（`OverlapSection`、`OverlapEditor`、`OverlapQuery`）、`MoreView.swift:86-90` 與插入點、`ios/MarketObservatoryTests/EtfOverlapQueryTests.swift`（新）、`FixtureDecodingTests.swift`、`etfs-dca.md`。
- **測試**：`EtfOverlapQueryTests`：ETF 300000、NVDA 50000、AAPL 0 → `["ovEtf": "300000", "ov": "NVDA:50000"]`（金額 0 的不送）；`generatedEtfs` 斷言 `overlap?.exposure != nil`；舊 `etfs.json` 解碼 `overlap == nil`。
- **呼叫端**：`EtfView.load()` ← 同 L5-T2。
- **不碰**：`WatchlistView.swift`、`Watchlist` Codable。

## 5. 刻意排除與理由

| 不做 | 理由 |
| --- | --- |
| 改首月政策（跳過不完整首月或對齊月初） | 任務是「說明對齊實作」；改政策會改變兩端既有試算數字，不在本輪範圍 |
| 匯率逐筆取值日的統計（例如「N 筆沿用前一日匯率」） | 規則句已說清楚取值方式；逐筆統計要多傳陣列或重寫買入判斷，價值低 |
| 把成本、稅或配息套進歷史定投試算；配息型與累積型的稅後歷史比較 | V-C C-02／C-03：新增歷史績效比較要先登記口徑；K-02「不得順手重跑不同歷史扣款策略」 |
| 儲存成本假設（每人設定） | 屬每人資料，與 #14 帳本的儲存決定一起處理，本輪 #14 不做；查詢參數已能試算 |
| 券商費率預設組（國泰、富邦、IBKR 等數字） | 研究只部分核實國泰（V-K 第 6 條，到期日沒有逐項標示），其他未核實；預設組容易被讀成推薦或比價，費率又會過期 |
| 定股扣款模式 | 試算本身是定額；定股要逐月股價換算，與既有口徑不同 |
| 新增台灣上市或愛爾蘭 UCITS ETF（00646、CSPX、VUAA） | 要新增抓價代號、額度與資料來源；006205 只留註解提醒 |
| 個人應納稅額、遺產稅額試算；依門檻提醒賣出 | 使用者指定只做檢查清單；V-C 結論是申報門檻不是賣出訊號 |
| 「過度集中」門檻、配置建議、名單當持倉 | K-04、G-01 都限定為描述；設門檻會變成減碼訊號 |
| C-08 歷史類似回撤分布、K-06 現金流沙盒 | P2，要另行登記或依 #12 之後再排 |
| 「檢討門檻 ±%」用語（#5） | L3-T6 負責；本領域不碰「我的規劃」區塊 |
| 新增 `VerifyInteractionTests` 的步驟 | 留給最後整合驗收；避免和其他領域改同一個 UI 測試檔 |

## 6. 風險

- **ISIN 與配息資料的正確性**：靠實作時逐檔查發行商頁。檢查碼測試只能抓到打錯字，抓不到「抄成另一檔的合法 ISIN」；審查要抽查 PR 表格裡的出處。
- **法規內容會過期**：30% 預扣、US$60,000、100 萬元、750 萬元都是 2026-10-28 查到的靜態內容，沒有自動更新；畫面一律帶來源日期與查閱日，台灣金額另註明「以財政部當年度公告為準」。日後需要人工或月檢 skill 定期重看。
- **跨領域衝突**：`etfs-dca.md`（L3-T6 改 `:3`、`:12`、`:32`）、`MoreView.swift`（L3-T5、L3-T6，以及其他領域的展望區；本領域 `:248` 的 footer 與 L3-T6 的 `:251-256` 只隔兩行）、`views.ts`（L3、L1 的其他函式；本領域動 `etfsView` 回傳處與 `watchlistView:390-398`）、`tests/api-contract.test.ts:52`（與 `:44-47` 其他領域的種子相鄰）、`FixtureDecodingTests.swift`（本領域只改 `:23-27` 的 `generatedEtfs` 與 `:110` 起的 `etfs`，相鄰的 `:22`、`:28` 屬 L6、L4）。新增程式一律加在檔尾或新檔，不重排既有程式碼；解衝突照 §3「合併與整合」。L1 若也動 `watchlistView`，以 L1 為準後再套 `memberWeights` 重構，並確認 `generated-watchlist.json` 不變。
- **fixture 重產**：照 §3「合併與整合」，每合併一個領域就在整合分支重產並審 diff，不手動合 JSON；合錯 `api-contract.test.ts:52` 的參數或 `:31-35` 的種子，iOS 的 `generatedEtfs` 斷言會失敗。
- **模擬器搶用**：各領域的 iOS 驗收都用 `MO iPhone 16 Plus`，平行執行時會互相搶機、一方的 `shutdown` 會打斷另一方；本領域 iOS 票的最後一條驗收必須在工作流程的全域模擬器鎖內跑（§3）。
- **重疊預覽依賴 L1 B-07**：沒合進分支前，持股集合可能殘留舊代號，`top10CompanyWeight` 與名單覆蓋會偏差；L5-T9 不能單獨上線。
- **頁面變長與查詢數**：ETF 頁每次多兩個唯讀 D1 查詢（名單、最新持股），不在快取內；量很小，但要在 320px 寬度與 App 大字級確認版面。
- **成本情境被讀成比價**：靠固定免責句、不預設券商、不加總成「稅後報酬」來控制；審查時要看畫面上沒有排序或「最省」字樣。
- **成本與重疊的輸入不保存**：App 離開頁面就要重填，網頁靠網址保留；這是本輪刻意的取捨。
- **Orca 與排程**：本領域不改 CLI、排程、抓取或 AI 批次，部署時主線不需同步任何 Orca 設定。

## 7. 整合驗收時要看的畫面

| 票 | 網頁（`/etfs`） | iOS（更多 → ETF 與定投試算） | 對帳 |
| --- | --- | --- | --- |
| T1 | 試算說明有「試算起點 …，首筆 …」與匯率規則句，沒有「用當日 USD/TWD」；「同金額期初單筆」下有前提句 | footer 同樣兩句、字樣一致；IVV／2 年／5000 的首筆日期 | `/api/v1/etfs?etf=IVV&years=2&monthly=5000` 的 `sim.startDate`、`dca.firstBuyDate` |
| T2 | 「資金類型」切換：每月新收入沒有一次投入 KPI、有說明句；期初已有整筆資金顯示期初資金、一次投入、分批、前提與不計利息句；改標的後資金類型不被洗掉 | Picker「資金類型」切換，兩種呈現同網頁 | `?funding=lump` 的 `funding`、`dca.lumpSumValue`、`dca.value` |
| T3／T4 | VOO、SPY、UPRO、SPXS 展開「產品資料」；試算選 UPRO 出現槓桿證據邊界句、選 VOO 出現 1x 句 | 同四檔的「產品資料」與試算區證據句；最大字級不截斷 | `rows[].facts` |
| T5／T6 | 填 價差 0.5、費率 0.1、最低 1、配息率 1.2 試算；切口徑 nav／index、稅務身分其他；填過期的優惠日；填超過範圍的費率看中文錯誤；「清除」 | 「設定假設」sheet 填同一組數字，結果同網頁 | `/api/v1/etfs?…&costFee=0.1&costMinUsd=1&costFx=0.5&costYield=1.2` 的 `costScenario` |
| T7／T8 | 兩份清單展開，來源連結可點、日期顯示 | 兩個 DisclosureGroup 展開 | `checklists` |
| T9／T10 | 重疊面板的 as-of 句、各公司權重、合計覆蓋、前十大；填 ETF 300000、NVDA 50000 計算；試算選 UPRO 顯示不適用；名單頁加入或移除一家後回 ETF 頁立即反映；兩個帳號名單不同時各看到自己的 | 同網頁；「填金額」sheet | `overlap.asOf` 等於 `/api/v1/watchlist` 的 `asOf`，`overlap.members[].weightPct`、`totalWeight` 等於名單 API；`?ovEtf=300000&ov=NVDA:50000` 的 `overlap.exposure` |

網頁另在 320px、360px 與深淺模式各拍一次 ETF 頁，確認沒有水平捲動。iOS 一律照 §3 的模擬器規則：拿全域鎖、只開既有 MO 機；L7-T1 合併前不跑 `ios-up.sh`／`down.sh`，把既有 UDID 寫進 `$RUN/sim.udid` 後用 `ios-test.sh`／`ios-walkthrough.sh`，驗完 shutdown。功能地圖要更新：`etfs-dca.md`（每張票新增子功能、把手與 Gotchas）、`features/README.md:54` 的 ETF 那一行（L5-T9）；`watchlist.md` 交給整合者統一對帳。

## 8. 審稿處置

交叉審稿四條都成立，處理如下：

1. **iOS 驗收搶同一台模擬器、ios-up.sh／down.sh 會新增與刪除模擬器**：§3 加「模擬器全域鎖」與「L7-T1 合併前」兩條；iOS 測試與關機合成一條指令（測試失敗也會關機），各 iOS 票的風險與整合驗收註明要在鎖內跑；§7 的 iOS 驗收改成 `AGENTS.md:8` 的手動流程。
2. **`api-contract.test.ts` 種子相鄰、generated fixture 多領域重產**：§3 加「合併與整合」：`:52` 衝突取聯集，列出 L5 斷言依賴的參數與種子行；每合併一個領域就重產並審 diff。報告提到的 L2 行號錯誤屬 L2 spec，本檔不改。
3. **多領域同檔**：§3 寫明 L5 排在 L1、L3 之後合併、要保留的先合併語意；L5-T9 的依賴改成具體票號 L1-T5；功能地圖只改 `etfs-dca.md` 與 `README.md:54`，拿掉原本要改的 `watchlist.md`（L7-T1 會改 `:34`），交叉引用交給整合者。
4. **acceptance 不能原樣執行**：所有票改成 `cd <worktree>/web && …`、`cd <worktree>/ios && …` 的完整指令，拿掉「(web/)」前綴與行尾註解；「其他 generated 檔不變」改成可機器判斷的 `git diff --exit-code … ':(exclude)…generated-etfs.json'`，「只多出本票欄位」移到各票「測試」當審閱項目，並附 `git diff --stat`。
