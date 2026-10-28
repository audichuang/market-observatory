# L6 個股：共識口徑修正、共識面板擴充、逐股研究表

> 範圍：report.md §6 #4 中的 A-05、A-06、B-04；#10；#14a。路徑相對於 repo 根目錄。
> 基準：HEAD `8eaac29`。研究基準 `99066fd` 到 HEAD 之間 `web/src`、`web/pages`、`web/db`、`web/tests`、`ios/` 沒有改動（`git diff --stat 99066fd 8eaac29 -- …` 為空），所以研究與查核引用的行號仍然有效；下表行號都是這次重新打開檔案確認的。

## 1. 目標

1. **共識數字的口徑要對（P0 #4）。** 展望頁「成分股分析師共識」的每個指標各自寫出有效分母；Nasdaq 回「沒有資料」的空列不再算進涵蓋權重；上榜表與彙總使用同一條新鮮度界線；畫面寫出股價日、權重日與指數收盤日；分析師工作的股價改用已收盤交易日，EPS 請求失敗不再被吞掉。
2. **共識面板擴充（P1 #10）。** 個股目標價均值旁列出最低／最高；EPS 寫成「近四週上修／下修次數＋財年＋估計數」；明寫這些欄位成效未證實、不是買賣訊號。
3. **逐股手動研究表（P1 #14a）。** 走勢頁選到名單公司時，給 SEC EDGAR 與公司 IR 的純外連，以及一張可複製的研究表範本。不存檔、不新增 API、沒有評等或目標價欄位。

這些都是顯示與資料品質修正：不新增上游請求、不改 `DEFAULT_MODEL`、不跑回測、不需要事前登記（V-A §2 對 A-05／A-06 的判定、V-D1 §2 對 D1-01～03 的判定、V-D2 §2 對 D2-11 的判定都是「無直接衝突」；依據 `web/docs/forecast.md:11`、`:21`）。

## 2. 現況與證據（全部仍存在，沒有已修好的項目）

| 問題 | 證據 | 影響 |
| --- | --- | --- |
| A-05 空列算進涵蓋 | `web/src/lib/consensus.ts:48-50`：`covered += w` 在檢查目標價、評等、EPS 之前就加上去；`web/src/server/jobs.ts:634-638`：Nasdaq 回 `No record found` 時寫入 `EMPTY_VIEW`（目標價 null、評等 0、EPS null）。正式站舊回應 `ios/MarketObservatoryTests/Fixtures/outlook.json` 的 `BRK-B` 就是這種列，仍計入 `symbols: 200`、`coveredWeightPct: 87.4` | 單一「涵蓋權重」比任一指標的實際分母大 |
| A-05 單一涵蓋數字 | `web/pages/outlook.tsx:271` 隱含指數目標旁寫的是 `coveredWeightPct`，不是目標價那一項的分母；`:316-317` 只有一個涵蓋數字與一個「不到一半」警告；iOS `ios/MarketObservatory/Views/MoreView.swift:696` 同樣只有一列「涵蓋權重」 | 三個指標的分母其實各不相同（`consensus.ts:53-66` 的 `upW`／`buyW`／`revW`） |
| A-06 上榜表與彙總新鮮度不同 | 彙總以 UTC 今天往回 7 天篩（`consensus.ts:31`、`web/src/server/outlook.ts:77-78`）；SQL 卻以展望資料日往回 10 天預篩（`outlook.ts:75`），上榜表只按權重排序、去重（`outlook.ts:79-84`），沒有套 7 天界線 | 8～10 天前的列可能出現在表上，卻不在上面的彙總裡 |
| A-06／B-04 日期遺失 | `analyst_views` 已存 `price_date`（`web/db/schema.ts:148`、寫入 `jobs.ts:645-657`），但 `outlook.ts:74` 的 SELECT 沒取；權重查詢 `outlook.ts:69-71` 只取 ticker／weight，沒有 `as_of`；`outlook.ts:100` 把子集的加權漲幅乘上最新 SPX 收盤，`outlook.tsx:264` 寫成「把每檔成分股的目標價按權重加總」 | 讀者看不出各檔股價日不同、權重是哪天的 SPY 持股，容易把外推讀成全部成分股同日加總 |
| B-04 股價可能是盤中 | `web/src/lib/sources/yahoo.ts:118-127` `fetchYahooLastCloses` 取 spark 的最後一根 K 線，不看是否已收盤；`news` 排程每 4 小時跑（`web/crons/news.ts:5`，UTC 16:00、20:00 在美股盤中或收盤前），分析師工作在其中（`jobs.ts:778`、`:630`） | 隱含漲幅混入盤中價 |
| B-04 EPS 失敗被吞 | `web/src/lib/sources/nasdaq.ts:228` `.catch(() => null)`：EPS 請求失敗與「權重前 100 名以外不抓 EPS」都變成 null，工作照樣回 `ok`（`jobs.ts:670`） | 看不到來源失敗；EPS 分母變小卻沒有任何紀錄 |
| #10 欄位已有卻沒顯示 | `nasdaq.ts:173-187` 的 `AnalystView` 有 `targetLow`／`targetHigh`／`fiscalEnd`／`estimates`，DB 也存了（`schema.ts:150-160`），但 `consensus.ts:4-14` 的 `ViewRow` 與 `outlook.ts:74` 的 SELECT 都沒帶；表格 `outlook.tsx:321-331` 只有均值與隱含漲幅；iOS `Models.swift:562-570` 的 `Top` 也沒有 | 只看得到單一均值與隱含漲幅 |
| #14a 沒有逐股研究入口 | 走勢頁 `web/pages/history.tsx:39-54`、iOS `HistoryView.swift:90-199` 只有價格與比較；名單頁 `web/pages/watchlist.tsx:125` 的「走勢」連到 `/history?symbol=<key>`。現有唯一的文字欄位是「我的規劃」的單一備註 | 沒有原始申報入口，也沒有研究流程的骨架 |

外部連結這次實測（2026-10-28，用瀏覽器開，curl 會被 SEC 以「Undeclared Automated Tool」擋成 403）：

- `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=NVDA&owner=include&count=40` → NVIDIA CORP 申報清單；`CIK=GOOGL` → Alphabet；`CIK=BRK-B` → Berkshire Hathaway；**`CIK=BRK.B` → 「No matching Ticker Symbol.」**。EDGAR 要用本專案內部的連字號寫法，**不要**像 Nasdaq 那樣轉成點。
- 預設名單 7 家的 IR 首頁都能開：`https://investor.nvidia.com/`、`https://investor.apple.com/`、`https://www.microsoft.com/en-us/investor`、`https://ir.aboutamazon.com/`、`https://abc.xyz/investor/`、`https://investor.atmeta.com/`、`https://ir.tesla.com/`。

## 3. 已決定的設計

- **`symbols`／`coveredWeightPct` 的意思改了，欄位名稱與型別不變。** 改成「至少有一個可用指標的列」（目標價可算隱含漲幅、評等家數 > 0、或近四週修正次數 > 0，三者任一）。舊版 App 仍在「涵蓋權重」這個標籤下顯示，只是數字變正確（例如 BRK-B 這種空列不再算進去）。這是刻意接受的語意修正。
- **不加 migration。** EPS 狀態只在工作結果（`status`、`summary`、`detail.epsFailed`）呈現；畫面上 EPS 為 null 一律寫「缺資料」，0／0 寫「沒有修正」（D1 §6.4 的要求用現有欄位就能做到）。要逐列分辨「抓取失敗」與「沒抓」需要新欄位，本輪不做。
- **股價日照實標示，不湊同一天。** 每檔用自己已收盤的交易日；UTC 20:00 那一輪是美東 16:00，早於 `CLOSE_READY_MINUTES`（16:30，`web/src/lib/calendar.ts:71`），所以會取前一個交易日：這是刻意的保守行為，不是 bug。彙總混合不同股價日，用文字寫明。
- **研究表放在走勢頁**，只在選到名單公司（`watch` 包含 `symbol`）時出現：網頁與 App 都已有 `watch`、`label`、`symbol`（`web/src/server/views.ts:218`、`ios/MarketObservatory/Models.swift:255-257`），不用改 API。範本是唯讀、可複製的清單，不是輸入框：不存檔時輸入框會讓填的字靜默消失。
- **IR 連結只收錄預設名單 7 家**（上面實測過的網址），其他公司只給 EDGAR 並說明。沒有資料源能自動取得 IR 網址，也不在 Worker 抓。
- **範本文字網頁與 App 逐字相同**，沿用 `web/src/lib/communication.ts` ↔ iOS `Copy`（`ios/MarketObservatory/Format.swift:122`）＋ `ios/MarketObservatoryTests/CopyTests.swift` 的鏡像做法，兩邊測試比對同一段字面值。

### 研究表範本（網頁與 App 共用的確切文字）

欄位（標籤：提示）：

1. 企業驅動：營收靠哪些業務與客戶？競爭、供應鏈與監管風險是什麼？
2. 盈餘假設：營收的量、價、組合，利潤率與股數各怎麼假設？每個假設附來源與日期。
3. 與共識的差異：你的理解和市場共識差在哪個假設？不知道就寫不知道。
4. 估值敏感度：用哪種方法看估值？哪個假設改變時，結論會跟著改變？
5. 下一個核對事件：哪一次財報、產品或法規事件可以核對？到時要看哪個數字？不預填漲跌方向。
6. 反證：哪些看得到的結果會讓目前的理解不成立？有利與不利的證據都記下來。
7. 論點失效條件：如果論點錯了，最可能是哪個營運假設錯了？

說明句 `RESEARCH_NOTE`：`這張表只整理研究問題，不是評等、目標價或買賣建議；本站不保存你填的內容。`

複製出來的全文＝下列各行以 `\n` 串接（沒有 IR 時省略「公司 IR」那一行），結尾不加換行：

```
{company}（{ticker}）研究表 {YYYY-MM-DD}
SEC 申報：{EDGAR 網址}
公司 IR：{IR 網址}

1. 企業驅動：營收靠哪些業務與客戶？競爭、供應鏈與監管風險是什麼？

2. 盈餘假設：…（依序到 7，每題後空一行）

7. 論點失效條件：如果論點錯了，最可能是哪個營運假設錯了？

這張表只整理研究問題，不是評等、目標價或買賣建議；本站不保存你填的內容。
```

日期是按下「複製範本」當下使用者裝置的本地日期，不在伺服器輸出（避免 SSR 與 hydrate 不一致）。欄位不得出現：評等、目標價、多空、加碼、減碼、停損、停利、買進、賣出、conviction、分數、總分（說明句例外）。

## 4. 票

實作順序：T1 → T2 → T3 → T4 → T5 → T6（同一分支依序）。T2、T5 不依賴其他票。T3 另依賴 L1-T7（授權清冊）：這是合併順序的相依，T3 不 import `registry.ts`，可以先在 L6 分支實作，但 L1 要先合併進整合分支，L6 才合併。跨領域的共用資源與合併規則見 §8。

驗收指令裡的 `<worktree>` 是本 lane 的 worktree 根目錄。含 `test-without-building` 與 `simctl shutdown` 的兩行要在工作流程的全域模擬器鎖內執行（§8）。

### L6-T1 共識彙總口徑：有效分母、空列、同一條新鮮度、日期（#4 A-05、A-06、B-04 日期部分）

**行為**

- `web/src/lib/consensus.ts`
  - 新增 `CONSENSUS_MAX_AGE_DAYS = 7`、`consensusCutoff(today, maxAgeDays?)`（沿用 `:31` 的算法）與 `freshLatestViews(rows, weights, cutoff)`：每檔取 `asOf ≥ cutoff`、在權重表內的最新一列（就是 `:33-38` 現有邏輯抽出來）。
  - `aggregateConsensus` 簽名不變，內部改用上面兩個函式；回傳新增 `coverage: { target, ratings, revisions }`（各為 `{ symbols, weightPct }`，就是三個指標各自進加權平均的列）、`noData: { symbols, weightPct }`（新鮮但三項都不可用的列）、`priceOldest`／`priceNewest`（目標價那組列的 `priceDate` 範圍）。`symbols`／`coveredWeightPct` 改為三組的聯集。`oldest`／`newest` 仍是全部新鮮列的抓取日範圍。
  - `ViewRow` 新增 optional `priceDate?: string | null`。
- `web/src/server/outlook.ts`
  - `today`、`cutoff` 在共識區塊開頭各算一次；SQL 預篩改用 `cutoff`（取代 `:75` 的「資料日 −10」）；SELECT 加 `price_date AS priceDate`；權重查詢加 `as_of`。
  - 上榜表改由 `freshLatestViews(...)` 依權重排序取 12 檔，和彙總用同一組列。
  - `consensus` 回應新增 `weightsAsOf`、`indexCloseDate`（`outlook?.asOf ?? lastSpx?.date ?? null`，就是 `close` 的日期）。`top[]` 每列多出 `priceDate`。
  - 順手把 `:68` 過時的註解「權重前 100 檔」改成 200。
- `web/pages/outlook.tsx`
  - `:264` 改寫：「把涵蓋到的成分股 12 個月共識目標價的隱含漲幅按 SPY 權重平均，再套到 S&P 500 收盤，推算『分析師隱含的指數目標』。這是涵蓋子集的外推，各檔股價日不同，不是全部成分股同一天的加總。」
  - `:271` 改成 `涵蓋 {coverage.target.weightPct}% 權重 · 以 SPX {indexCloseDate} 收盤推算`。
  - 三張 KPI 卡各加一行 `{n} 檔 · {w}% 權重`，`w < 50` 時接「（不到一半，數字不完整）」；拿掉 `:317` 的單一警告。
  - `:316` 改為：「有可用數字的 {symbols} 檔約占指數 {coveredWeightPct}% 權重；另有 {noData.symbols} 檔（{noData.weightPct}%）沒有可用數字，例如 Nasdaq 沒有分析師資料（為 0 時省略這句）。分析師資料 {oldest}～{newest} 抓取；股價日 {priceOldest}～{priceNewest}，各檔不同日；權重用 SPY {weightsAsOf} 持股。」後面保留原有「目標價為 12 個月共識」與 FactSet 口徑那兩句。
  - 表格股價格加小字股價日（MM-DD）；目標價為 null 且評等家數為 0 的列，目標價格寫「Nasdaq 無資料」。
  - `consensus` 為 null（`:307`）改寫「7 天內沒有更新的分析師共識。每 4 小時輪流更新 SPY 權重前 200 檔中的 16 檔。」
- API 契約：`web/tests/api-contract.test.ts:46` 的 NVDA 列補 `price_date='2026-10-27'`，另插一列 AVGO（權重 2，已在 `:34`）的空列（目標價、股價、EPS 為 null，評等 0），讓 fixture 帶出 `noData`。重產 `generated-outlook.json` 並審 diff。

**測試（修正前會失敗的斷言）**

- `web/tests/consensus.test.ts` 新增「空資料列不算涵蓋，各指標回報自己的分母」：A（權重 7，股價 100、目標價 null、評等 0、EPS null）、B（權重 3，完整）。斷言 `coveredWeightPct === 3`（修正前是 10）、`symbols === 1`、`noData` 為 `{symbols:1, weightPct:7}`、`coverage.target.weightPct === 3`。另一案：A 只有股價＋目標價、B 只有評等 → `coverage.target` 只有 A、`coverage.ratings` 只有 B、`coveredWeightPct` 為兩者相加；`priceOldest`／`priceNewest` 取自有目標價的列。既有三個測試照常通過（兩列都可用，涵蓋仍是 10）。
- 新檔 `web/tests/outlook-consensus.test.ts`（`migratedDb`，`t.mock.timers` 固定 `2026-10-28T23:00:00Z`）：權重 NVDA 6、AAPL 5.5（`as_of` 2026-10-27）；SPX 一筆 2026-10-27；`analyst_views` NVDA `as_of` 2026-10-27（`price_date` 2026-10-27）、AAPL `as_of` 2026-10-19（超過 7 天，但在舊的 −10 天預篩內）。斷言 `consensus.top.map(s => s.symbol)` 等於 `["NVDA"]`（修正前是 `["AAPL","NVDA"]`）、`consensus.weightsAsOf === "2026-10-27"`、`consensus.indexCloseDate === "2026-10-27"`、`top[0].priceDate === "2026-10-27"`（修正前都是 undefined）。
  - 寫法提醒：`outlookView` 在共識區塊之前會先跑 `buildOutlook`、`liveTrackOf`。只放一筆 SPX 時至少也放一筆 VIX；若稀疏資料讓 `outlookView` 丟錯，直接照 `api-contract.test.ts:22-30` 用 `weekdays(900)` 填 SPX／VIX，不要去改預測路徑。此時 `indexCloseDate` 改成斷言等於 SPX 最後一天。AAPL 的日期仍要落在「舊預篩 −10 天之內、7 天界線之外」。
- fixture 重產後人工審 `git diff --stat` 與內容：只有 `generated-outlook.json` 變動；`consensus` 新增 `coverage`、`noData`、`priceOldest`、`priceNewest`、`weightsAsOf`、`indexCloseDate`，`top` 多一列 AVGO 與每列的 `priceDate`；其他 view 不變。

**驗收**

```
cd <worktree>/web && npx void prepare
cd <worktree>/web && npm run typecheck
cd <worktree>/web && node --test tests/consensus.test.ts tests/outlook-consensus.test.ts
cd <worktree>/web && MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts
cd <worktree> && git diff --stat -- ios/MarketObservatoryTests/Fixtures/generated/
cd <worktree>/web && node --test tests/api-contract.test.ts
cd <worktree>/web && npm test
cd <worktree>/ios && xcodegen generate
cd <worktree>/ios && xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build-for-testing
cd <worktree>/ios && xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'platform=iOS Simulator,name=MO iPhone 16 Plus' -derivedDataPath build CODE_SIGNING_ALLOWED=NO -only-testing:MarketObservatoryTests test-without-building
xcrun simctl shutdown 'MO iPhone 16 Plus'
```

### L6-T2 分析師抓取：已收盤股價、EPS 失敗要回報（#4 B-04 抓取部分）

**行為**

- `web/src/lib/sources/yahoo.ts:118` `fetchYahooLastCloses(symbols, budget?, onOrBefore?)`：給了 `onOrBefore` 就取「日期 ≤ onOrBefore 的最後一根」；不給時行為不變。lib 不讀時鐘。
- `web/src/server/jobs.ts:630` 改傳 `latestExpectedClose()`。
- `web/src/lib/sources/nasdaq.ts`：`AnalystView` 新增 `epsError: string | null`；`fetchAnalystView`（`:224-231`）的 EPS 請求失敗時記下錯誤文字（不再 `.catch(() => null)` 吞掉），沒要求 EPS（`withEpsRevisions=false`）或成功時為 null。`parseAnalystView` 簽名不變。
- `jobs.ts`：`EMPTY_VIEW`（`:608`）補 `epsError: null`；`jobAnalysts` 收集 `epsFailed`（代號清單），放進 `detail.epsFailed`；有 EPS 失敗時 `status` 為 `partial`（照 `:670` 的 `priceError` 寫法），`summary` 在原句後接「；EPS 失敗 N 檔」。`summary` 開頭的「分析師共識 x/y 檔」格式不變（`web/tests/cron-budget.test.ts:234` 用正則比對）。失敗的列照常寫入（目標價有效），EPS 欄為 null。
- 不改 `ANALYST_UNIVERSE`／`EPS_REVISION_UNIVERSE`／`ANALYST_PER_RUN`（`:605-607`），請求數不變。

**測試（修正前會失敗的斷言）** 新檔 `web/tests/analysts-job.test.ts`（`migratedDb`＋`FakeUpstream`，先寫 3 檔權重）：

- EPS 失敗：規則讓 `/earnings-forecast` 一律回 500，`runJob(db, "analysts", "test", {}, new Budget(40))`。斷言 `status === "partial"`（修正前 `ok`）、`detail.epsFailed` 含 3 檔、`summary` 符合 `/EPS 失敗 3 檔/`；`analyst_views` 有 3 列、`target_mean` 不是 null、`eps_up` 是 null。
- 盤中股價：`t.mock.timers` 固定 `2026-10-27T19:00:00Z`（美東 15:00），spark 規則回每檔兩根 K 線：2026-10-26 收 100、2026-10-27 收 105。斷言每列 `price_date === "2026-10-26"`、`price === 100`（修正前是 2026-10-27／105）。
- `web/tests/cron-budget.test.ts:225-235` 不改，必須照常通過（預設路徑仍 `ok`、8/8 檔、15～18 個請求）。

**驗收**

```
cd <worktree>/web && npx void prepare
cd <worktree>/web && npm run typecheck
cd <worktree>/web && node --test tests/analysts-job.test.ts tests/cron-budget.test.ts tests/budget.test.ts
cd <worktree>/web && npm test
```

部署後：站長 `POST /api/admin/cron?name=news`（不含 `notify-close`，隨時可跑），看 `analysts` 的 `status`、`detail.subrequests`（應與改前相同量級）、`detail.epsFailed`；再查 `analyst_views` 新寫入列的 `price_date` 不晚於當時的 `latestExpectedClose()`。

### L6-T3 共識面板擴充：目標價最低／最高、EPS 次數＋財年＋估計數（#10 D1-02、D1-03、D2-11）

**行為**

- `consensus.ts` `ViewRow` 新增 optional `targetLow`、`targetHigh`、`fiscalEnd`、`estimates`；`outlook.ts` SELECT 加 `target_low AS targetLow, target_high AS targetHigh, fiscal_end AS fiscalEnd, estimates`。`top[]` 每列因此多出這四個欄位（`epsUp`／`epsDown` 本來就在）。不新增計算（不算相對範圍、廣度以外的比例）。
- `outlook.tsx` 表格：
  - 目標價格：均值，下一行小字「最低 {targetLow}～最高 {targetHigh}」（任一為 null 就不顯示這行）。
  - 新欄「EPS 近四週修正」（`hide-sm`）：「上修 {epsUp}／下修 {epsDown}」，小字「會計年度 {fiscalEnd} · 估計數 {estimates}」；兩者都是 0 →「沒有修正」；兩者都是 null →「缺資料」。畫面一律用台灣用語「會計年度」（`nasdaq.ts:181` 的註解也這樣寫），報告裡的「財年」只是同義簡稱。
  - KPI「EPS 修正廣度」的副標從「−100～+100」改成「近四週（上修−下修）÷ 總次數，−100～+100」。
  - 表格下加一段：「最低～最高是 Nasdaq 收錄的個別分析師目標價範圍，不是機率區間；EPS 欄是來源提供的近四週上修／下修次數，不是修正幅度，也不一定是不同分析師的家數；會計年度是來源列出的第一個年度。這些欄位只描述資料，能否預測報酬未經驗證（成效未證實），不是買賣訊號。」
  - 不出現「動能」「信賴區間」「多數分析師上修」。
- API 契約：`api-contract.test.ts` 的 NVDA 列再補 `target_low=90, target_high=150, fiscal_end='Dec 2026', estimates=20`，重產 fixture。

**相依** L6-T1（同一條 SELECT 與表格）；L1-T7（授權清冊，報告 §6 資料一覽把 #17 列為顯示這些 Nasdaq 欄位的前提，`L1-data.md:156`、`:204` 也要求 L6 #10 排在 L1-T7 之後）。後者只是合併順序：L1 先合併，本票不 import `registry.ts`。

**測試（修正前會失敗）** `web/tests/outlook-consensus.test.ts` 加一案：NVDA 列寫入 `target_low 90、target_high 150、fiscal_end 'Dec 2026'、estimates 20、eps_up 2、eps_down 1`，斷言 `top[0]` 的 `targetLow === 90`、`targetHigh === 150`、`fiscalEnd === "Dec 2026"`、`estimates === 20`（修正前都是 undefined）。fixture 重產後人工審 diff：只有 `generated-outlook.json` 的 `top[]` 各列多出這 4 個鍵。

**驗收**

```
cd <worktree>/web && npx void prepare
cd <worktree>/web && npm run typecheck
cd <worktree>/web && node --test tests/outlook-consensus.test.ts tests/consensus.test.ts
cd <worktree>/web && MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts
cd <worktree> && git diff --stat -- ios/MarketObservatoryTests/Fixtures/generated/
cd <worktree>/web && node --test tests/api-contract.test.ts
cd <worktree>/web && npm test
cd <worktree>/ios && xcodegen generate
cd <worktree>/ios && xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build-for-testing
cd <worktree>/ios && xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'platform=iOS Simulator,name=MO iPhone 16 Plus' -derivedDataPath build CODE_SIGNING_ALLOWED=NO -only-testing:MarketObservatoryTests test-without-building
xcrun simctl shutdown 'MO iPhone 16 Plus'
```

### L6-T4 App 的共識區塊（T1、T3 的 iOS 部分）

**行為**

- `ios/MarketObservatory/Models.swift:561-581` `OutlookPage.Consensus`：新增 optional `coverage`（`target`／`ratings`／`revisions`，各為 `{symbols: Int, weightPct: Double}`）、`noData`、`priceOldest`、`priceNewest`、`weightsAsOf`、`indexCloseDate`；`Top` 新增 optional `asOf`、`priceDate`、`targetLow`、`targetHigh`、`epsUp`、`epsDown`、`fiscalEnd`、`estimates`。既有欄位名稱與型別不動（`symbols: Int` 仍必填）。
- `ios/MarketObservatory/Views/MoreView.swift:685-719` `consensusSection`：
  - 「隱含漲幅」「買進評等占比」「EPS 修正廣度」三列的第二行標籤寫各自的 `{n} 檔 · {w}% 權重`（不到 50% 加「不到一半」）；EPS 那列的說明改成「近四週（上修−下修）÷ 總次數，−100～+100」。
  - 「涵蓋權重」改成「資料狀態」：「有可用數字 {symbols} 檔 · {coveredWeightPct}%」，`noData.symbols > 0` 時接「；{n} 檔沒有可用數字」。
  - 「權重前 N 檔」每列：目標下方加「區間 {low}–{high}」；再一行「EPS 上修 {up}／下修 {down} · 會計年度 {fiscalEnd} · 估計數 {estimates}」，0／0 寫「EPS 近四週沒有修正」、null 寫「EPS 缺資料」。
  - footer 改為：「依 SPY {weightsAsOf} 持股權重加權；分析師資料 {oldest}～{newest} 抓取，股價日 {priceOldest}～{priceNewest}（各檔不同日）。隱含指數目標是涵蓋子集的加權隱含漲幅套用 SPX {indexCloseDate} 收盤推算，不是全部成分股同日加總。目標價區間不是機率區間，EPS 是修正次數不是幅度；這些欄位成效未證實，不是買賣訊號。」新欄位為 nil（舊伺服器、舊 fixture）時省略對應片段，不另寫備援邏輯。
  - 大字級：數字列用既有 `LabeledContent`／`VStack`，確認換行不截字。

**測試（修正前會失敗＝編譯不過）** `ios/MarketObservatoryTests/FixtureDecodingTests.swift` 新增 `consensusCoverageAndRange`：解 `generated-outlook`，期望 `coverage?.target?.weightPct` 不是 nil 且等於 `coveredWeightPct`（不寫死 6：種子在整合時取聯集，用關係式在合併後仍成立）、`noData?.symbols == 1`（AVGO 空列只有 L6 加）、`weightsAsOf == "2026-10-28"`、`top.first?.targetLow == 90`、`top.first?.fiscalEnd == "Dec 2026"`、`top.first?.estimates == 20`、`top.first?.priceDate == "2026-10-27"`；解舊的 `outlook` fixture，期望 `coverage == nil`、`top.first?.targetLow == nil`。

**驗收**

```
cd <worktree>/ios && xcodegen generate
cd <worktree>/ios && xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build-for-testing
cd <worktree>/ios && xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'platform=iOS Simulator,name=MO iPhone 16 Plus' -derivedDataPath build CODE_SIGNING_ALLOWED=NO -only-testing:MarketObservatoryTests test-without-building
xcrun simctl shutdown 'MO iPhone 16 Plus'
cd <worktree>/web && node --test tests/api-contract.test.ts
```

### L6-T5 逐股研究表＋EDGAR／IR 外連（網頁）（#14a D1-05、F-05、K-01、K-03）

**行為**

- 新檔 `web/src/lib/research.ts`（純函式，不碰 D1）：`RESEARCH_FIELDS`（§3 的 7 組標籤與提示）、`RESEARCH_NOTE`、`edgarFilingsUrl(ticker)`（`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(ticker)}&owner=include&count=40`，代號照內部連字號寫法，不轉點）、`IR_URLS`（§2 的 7 家，以名單 key 為鍵）、`researchTemplate({ company, ticker, date })`（§3 的全文格式）。
- 新檔 `web/src/ui/ResearchPanel.tsx`（不 import `src/server/`）：標題「研究表與原始資料」；連結「SEC EDGAR 申報清單」與「公司投資人關係（IR）」（`target="_blank" rel="noreferrer"`，同 `outlook.tsx:299`）；沒有 IR 時寫「這家公司未收錄 IR 網址；可從 EDGAR 的年報（10-K）找到公司網站。」；`<details>` 摘要「研究表範本（7 題）」內列出 7 題；按鈕「複製範本」用 `navigator.clipboard.writeText(researchTemplate(...))`，日期取按下當下的本地日期；成功顯示「已複製，可貼到你自己的筆記保存」，Promise 被拒時顯示「無法複製，請手動選取上方文字」；最下方小字 `RESEARCH_NOTE`。
- `web/pages/history.tsx`：主圖面板（`:39-54`）之後加 `{watch.includes(symbol) && <ResearchPanel company={label} ticker={symbol} />}`。選 S&P 500、VIX、RSP 或 ETF 時不出現。
- 不改 `historyView`、不改 API、不存任何東西。

**測試（新功能）** 新檔 `web/tests/research.test.ts`：

- `researchTemplate({ company: "NVIDIA", ticker: "NVDA", date: "2026-10-28" })` 等於 §3 格式展開後的完整字面值（同一段字面值也放進 iOS 的測試）。
- `edgarFilingsUrl("BRK-B")` 等於 `…CIK=BRK-B&owner=include&count=40`（不得含 `BRK.B`）。
- `IR_URLS` 剛好 7 個鍵（NVDA、AAPL、MSFT、AMZN、GOOGL、META、TSLA），全是 `https://`；`IR_URLS.AVGO` 為 undefined，且 AVGO 的範本沒有「公司 IR」那一行。
- 每個欄位的標籤與提示都不含：評等、目標價、多空、加碼、減碼、停損、停利、買進、賣出、conviction、分數、總分。

**驗收**

```
cd <worktree>/web && npx void prepare
cd <worktree>/web && npm run typecheck
cd <worktree>/web && node --test tests/research.test.ts
cd <worktree>/web && npm test
```

### L6-T6 逐股研究表（App）

**行為**

- 新檔 `ios/MarketObservatory/Research.swift`：`enum Research`，內容與 `web/src/lib/research.ts` 逐字相同（`fields`、`note`、`edgarFilingsURL(_:)`、`irURLs`、`template(company:ticker:date:)`）。檔頭註明正本在網頁那份，改一邊要改另一邊。
- `ios/MarketObservatory/Views/HistoryView.swift` `content(_:)`：在第一個 Section（主圖，`:95-137`）之後，`h.watch.contains(h.symbol)` 時加一個 Section，標題「研究表與原始資料」：`Link("SEC EDGAR 申報清單", destination:)`、有 IR 時 `Link("公司投資人關係（IR）", destination:)`、沒有時同網頁那句說明；`DisclosureGroup("研究表範本（7 題）")` 列 7 題；按鈕「複製範本」寫入 `UIPasteboard.general.string`（日期用裝置本地 `yyyy-MM-dd`），之後顯示「已複製，可貼到你自己的筆記保存」；footer 為 `Research.note`。選 S&P 500／RSP／ETF 時不出現。
- 互動測試：在 `ios/MarketObservatoryUITests/VerifyInteractionTests.swift` 新增一個 test，編號取實作當下未用的號碼（目前 19、21 起空著；其他 lane 也可能加測試，不要寫死）：在「走勢」用標的選單選 NVIDIA（照 `test03_History` 的寫法）、捲到「研究表與原始資料」、確認「SEC EDGAR 申報清單」連結存在、點「複製範本」後出現「已複製」、再切回 S&P 500 確認區塊消失；截圖與文字存成 `C8-research.png`／`C8-research.txt`。不改 `.claude/skills/verify/SKILL.md` 的測試表（避免和改 SKILL.md 的其他 lane 衝突），改記在 `history.md`。

**測試（新功能）** `ios/MarketObservatoryTests/CopyTests.swift` 新增：`Research.template(company: "NVIDIA", ticker: "NVDA", date: "2026-10-28")` 等於 T5 測試的同一段字面值；`Research.edgarFilingsURL("BRK-B")?.absoluteString` 含 `CIK=BRK-B`；`Research.irURLs.count == 7`、`Research.irURLs["AVGO"] == nil`。

**驗收**

```
cd <worktree>/ios && xcodegen generate
cd <worktree>/ios && xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build-for-testing
cd <worktree>/ios && xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'platform=iOS Simulator,name=MO iPhone 16 Plus' -derivedDataPath build CODE_SIGNING_ALLOWED=NO -only-testing:MarketObservatoryTests test-without-building
xcrun simctl shutdown 'MO iPhone 16 Plus'
cd <worktree>/web && node --test tests/research.test.ts
```

（新增的 XCUITest 只在 build-for-testing 確認編譯；實際執行放到最後整合的 UI 驗收，用 `ios-test.sh` 對本機站跑，開模擬器的方式見 §8。）

## 5. 最後整合 UI 驗收要看的

網頁（本機站，`web-up.sh` 會跑 `news` 排程，分析師約有 16 檔）：

- `/outlook` →「成分股分析師共識」：三張 KPI 卡各有「N 檔 · X% 權重」，與 `/api/v1/outlook` 的 `consensus.coverage.target／ratings／revisions` 相符；「本站反推」旁的涵蓋等於 `coverage.target.weightPct`、收盤日等於 `indexCloseDate`；說明行的抓取日、股價日、權重日等於 `oldest/newest`、`priceOldest/priceNewest`、`weightsAsOf`；上榜表每列 `asOf` 都不早於今天往回 7 天。
- 同一表：目標價下方「最低～最高」等於 `top[].targetLow/targetHigh`；「EPS 近四週修正」欄等於 `epsUp/epsDown/fiscalEnd/estimates`；「成效未證實」那段在表下方。390px 寬時 EPS 欄隱藏、其他欄不擠壞。
- `/history?symbol=NVDA`：主圖下方「研究表與原始資料」；點「SEC EDGAR 申報清單」開到 NVIDIA CORP 的 EDGAR 頁、「公司投資人關係（IR）」開到 investor.nvidia.com；展開「研究表範本（7 題）」；按「複製範本」出現「已複製」，剪貼簿文字等於範本（日期為當天）。ego-browser 讀剪貼簿前先 `page.cdp("Browser.grantPermissions", { permissions: ["clipboardReadWrite"] })`；做不到就以「已複製」加上展開後的範本文字比對 `researchTemplate`。按鈕要等 hydrate 後再點（`.claude/skills/verify/SKILL.md:93`）。`/history?symbol=SPX`、`RSP`、`VOO` 沒有這個面板。名單加入一家非預設公司（例如 AVGO，測完移除）時只有 EDGAR 與「未收錄 IR 網址」那句。

App（`MO iPhone 16 Plus`，一次一台，驗完 shutdown；取得全域模擬器鎖後才開機。L7-T1 合併前不執行 `ios-up.sh`、`down.sh`，照 `AGENTS.md:8` 把既有那台的 UDID 寫進本輪 `sim.udid` 再用 `ios-test.sh`；L7-T1 合併後證據路徑多一層 `<機型>/`，由 `MO_SHOTS` 決定，不用改 Swift）：

- 「更多 → 下月展望 → 成分股分析師共識」：各列的「N 檔 · X% 權重」、「資料狀態」、footer 的日期，與同帳號 `/api/v1/outlook` 對帳；展開「權重前 N 檔」看區間與 EPS 行。用 `test12_Outlook` 的 `H1-outlook-NN.png` 與 `H1-outlook.txt` 對帳；最大字級各看一次不截字。
- 「走勢」選 NVIDIA：「研究表與原始資料」區塊、兩個連結（點 EDGAR 會開 Safari）、範本展開、「複製範本」→「已複製」；切 S&P 500 區塊消失。跑新增的研究表互動 test，看 `C8-research.png`。

## 6. 刻意不做與理由

| 不做 | 理由 |
| --- | --- |
| 抓更多檔、改 `ANALYST_UNIVERSE`／`EPS_REVISION_UNIVERSE`／`ANALYST_PER_RUN` | A-05 原文明說不要用增加抓取檔數處理口徑問題；也會改變子請求預算 |
| 新增 `eps_status` 欄位（migration） | 逐列分辨「抓取失敗」與「沒抓」對讀者價值低；失敗已在工作結果與資料來源頁的執行紀錄呈現，畫面以「缺資料」誠實標示。避免和其他 lane 的 migration 撞 journal |
| 讓 200 檔用同一天收盤價 | 每輪要多約 10 個 spark 請求；改為各檔用已收盤價並寫明股價日範圍（B-04 允許「清楚標為混合時點快照」） |
| 同日覆寫改成保留每次版本（D1-07、B-04 vintage） | 那是為日後研究保存歷史，屬儲存設計，本輪只修顯示 |
| 目標價相對範圍 `(high−low)/price`、EPS 金額變化、共識構成變化（D1 §6.4、D1-04） | 都要先寫定義並登記；本輪只顯示原始欄位 |
| `historicalConsensus` 歷月共識、季度 EPS、EPS high/low | parser 沒存、需要新解析與儲存；不在 #10 範圍 |
| 名單個股的共識卡（每人名單） | #10 是展望頁的共識面板；名單是每人資料，要放在快取外另組，且權重 200 名以外沒有資料，另案評估 |
| 研究表存檔、修改歷史、結構化欄位（#14、#23） | #14a 明定不新增儲存或 API；要存就照「每人資料」規則另開票 |
| 預設名單以外公司的 IR 網址、自動取得 IR | 沒有可用資料源；不在 Worker 抓外部網站 |
| SEC 申報資料抓取（#20） | P2，Worker 出口與 UA 未驗證 |
| 總覽或推播帶共識數字 | 共識只當背景，不進機率與推播 |

## 7. 風險

- **API 語意改變：** `consensus.symbols`／`coveredWeightPct` 不再算空列，舊版 App 的「涵蓋權重」數字會變小（變正確）。型別不變，舊版解得開。iOS 的新顯示（T4、T6）要隨 App 發版才會上線；網頁部署後立即生效。
- **fixture 合併衝突：** L2-T8、L4-T5、L4-T6、L3-T3 也會改 `api-contract.test.ts` 的種子（本 lane 改 `:46` 並在其後加 AVGO 空列，緊鄰 L4 的 `:47`）與 `generated-outlook.json`。照 §8 取聯集、在整合分支重產，不手改 JSON。
- **同檔衝突：** `web/src/server/outlook.ts`、`web/pages/outlook.tsx`、`ios/.../MoreView.swift`、`Models.swift`（L3-T3、L4-T5、L4-T6）；`HistoryView.swift`、`web/pages/history.tsx`（L3-T4）；`web/src/server/jobs.ts`（L1、L2、L3、L4 多張票）；`yahoo.ts`、`nasdaq.ts`（L1-T3 改日線解析與空歷史；本 lane 只動 `fetchYahooLastCloses`、`AnalystView`／`fetchAnalystView`）。本 lane 只動上面列的區段，合併規則見 §8。
- **授權：** #10 顯示的欄位已在抓、已存，不增加上游請求，但會擴大公開顯示的 Nasdaq 資料。依 report §6 資料一覽，這些欄位的前提是 #17 授權清冊（L1-T7），所以 T3 依賴 L1-T7、L1 先合併；V-D1 §4 指出 Nasdaq 一般條款限制自動擷取與再散布。`nasdaq-analyst` 被停用時，依 L1-T8 只停取得（`L1-data.md:168`、`:188`），新欄位跟既有欄位一樣在 7 天新鮮度界線（`consensusCutoff`）後自然消失，不另做隱藏。
- **模擬器：** 多個 lane 的 iOS 驗收都用 `MO iPhone 16 Plus`，平行時會互搶、互相 shutdown；照 §8 的全域鎖執行。
- **快取：** 展望頁快取鍵不含日期（`web/src/server/page-cache.ts:33`，max-age 86400），新鮮度界線在算頁時決定；每個工作都會 bump 資料版本（`jobs.ts:755`），`news` 每 4 小時一次，平常最多晚 4 小時。排程全停時可能晚到 24 小時；本輪不改快取鍵。
- **工作狀態：** EPS 請求失敗時 `analysts` 會變 `partial`，資料來源頁會比以前多黃燈，這是要的結果。
- **外連：** IR 網址可能改版；網址都是 2026-10-28 用瀏覽器確認過的首頁。EDGAR 用連字號（`BRK-B`），轉成點會查不到。
- **剪貼簿：** 網頁 `navigator.clipboard` 需要安全來源（正式站 https、本機 localhost 都符合）；失敗時有提示，不靜默。
- **測試編號：** 多個 lane 可能同時加 `VerifyInteractionTests`，實作時取當下未用的編號。
- **Orca：** 本 lane 不動 `scripts/ai-batch.ts` 與任何排程，部署時主線不需同步 Orca 設定。

## 8. 整合規則（跨領域，交叉審稿後加入）

- **合併順序：** L6 在 L1、L3、L4 之後合併；後合併的 L6 在整合分支上 rebase 解衝突，不改寫先合併領域的語意：保留 L3-T3 的 `outlookUnavailable`、L4-T5 的 `liveTrackDd5` 與 `liveTrack.note`、L4-T6 的 `phaseSummary`（`outlook.ts` 回傳物件、`outlook.tsx`、`Models.swift` 的 `OutlookPage`），以及 L3-T4 在 `history.tsx:58-86`、`HistoryView.swift:148-150`、`:214-235` 的改動。
- **iOS 全域模擬器鎖：** 同一時間只有一個 lane 能開模擬器，兩台不同時開；`test-without-building` 跑完立刻 `xcrun simctl shutdown`，再交下一個 lane。`build-for-testing`（generic destination，不開機）與 web 的 `npm test` 可以平行。L7-T1 合併前任何 lane 都不執行 `ios-up.sh`、`down.sh`（現行版會新增或刪除模擬器），照 `AGENTS.md:8` 手動把既有 UDID 寫進 `sim.udid` 再用 `ios-test.sh`。
- **API 契約種子：** `web/tests/api-contract.test.ts` 的種子衝突一律取聯集，各領域的列都保留。不手動合併 `generated-*.json`：每合併一個領域，就在整合分支上跑 `MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts`，審 diff 只多出該領域宣告的欄位（L6：§4 T1、T3 測試段列的鍵），再於模擬器鎖內跑 `MarketObservatoryTests`。
- **功能地圖：** 本 lane 只改 `outlook.md`、`history.md`、`sources-admin.md` 裡自己功能的小節；全部合併後由整合者統一對帳一次。

## 9. 審稿處置

| 審稿意見 | 處置 |
| --- | --- |
| L6-T3 與 L1-T8「停用」定義衝突、缺 L1-T7 相依 | 成立。T3 `dependsOn` 加 L1-T7（合併順序），風險改成「停用只停取得，新欄位在 7 天界線後自然消失，不另做隱藏」；§4 T3 段與 §7 授權那條一起改 |
| 各 lane 共用 `MO iPhone 16 Plus` | 成立。§8 加全域模擬器鎖與「L7-T1 合併前不用 `ios-up.sh`／`down.sh`」；T1、T3、T4、T6 的風險與 uiVerify、§5 App 段落都註明 |
| `api-contract.test.ts` 種子與 fixture 合併 | 成立。§8 寫聯集與逐領域重產；T4 的 `weightPct == 6` 改成與 `coveredWeightPct` 的關係式，種子合併後仍成立 |
| 多領域同檔改動 | 成立。§8 寫合併順序與要保留的欄位；§7 與票的風險原本用報告代號（A-02、A-03、A-09、A-12、B-02）指稱其他 lane，改成實際票號 |
| acceptance 不能原樣執行 | 成立。全部改成 `cd <worktree>/web && …`、`cd <worktree>/ios && …`；重產與 `git diff --stat` 拆成兩行，「diff 只能多出…」移到測試段 |
