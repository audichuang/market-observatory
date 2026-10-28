# L3 呈現（display）：本輪規格

> 來源：`report.md` §6 P0 #4（其中 A-07、A-09、A-12、A-13）、#5、#6。路徑相對於 repo 根。行號以 HEAD `8eaac29` 為準（研究基準 `99066fd` 之後只多了研究文件，程式行號未偏移）。
> 使用者已決定：維持 X03（展望不是加碼或停扣訊號）；收盤推播遇**來源不一致**時**照送並標「未核對」**，不新增延遲重送。報告 #6 另列的「pending 也加標籤」不在使用者的決定裡，本輪不做，列在 §7 待決定。

## 1. 目標

把畫面上已經顯示的數字與標籤說對，不改任何計算模型、預測紀錄或排程：

| 條目 | 做完後使用者看到的 |
| --- | --- |
| A-13 | 總覽「等權重 − 市值加權」寫「+0.35 個百分點」，不再寫「+0.35%」 |
| A-07 | 總覽的下月展望卡片寫出預測的資料日；預測比最新快照舊時多一個「待更新」標籤與一句說明 |
| A-09 | 展望算不出來時，網頁與 App 都說出具體原因（VIX 落後幾天，或資料不足），App 也照樣列出過去的預測紀錄 |
| A-12 | 走勢頁的相對報酬圖、主標的「區間報酬」與區間統計表用同一個起點，終值對得上；起點不同的列明寫起始日 |
| #5（A-08） | App 展望頁的上漲滾動驗證不再列「預測方向命中率」「永遠猜上漲的命中率」 |
| #5（A-10、C-04） | App「我的規劃」改用跟網頁一樣的「檢討門檻 ±%」，不再寫「考慮出場的漲幅」；計算基準不變 |
| #6（B-06） | Nasdaq 寫「expected*」的財報日標「預期」，不再標「公司已公布」 |
| #6（B-05） | 收盤推播照常送，但其中兩個來源不一致（mismatch）的數字附「未核對」 |

## 2. 現況與證據（皆在 HEAD 親自確認仍存在）

- **A-13**：`web/src/lib/snapshot.ts:252` 的 `spreadPct = rspReturn − returnPct`，兩個百分比相減，單位是百分點。網頁 `web/pages/index.tsx:75` 用 `<Delta … percent />`，經 `web/src/ui/format.ts:16` `pctText` 加「%」；App `ios/MarketObservatory/Views/OverviewView.swift:323` 用 `Fmt.pct`（`Format.swift:26`）也加「%」。AI 提示詞 `web/src/lib/news-ai.ts:185` 已正確寫「個百分點」，不動。另外 `snapshot.ts:67` 的註解寫「負值代表…多數股票較弱」，和提示詞已刪掉的推論一樣，順手改註解。
- **A-07**：`web/src/server/views.ts:77` 用 `ORDER BY trade_date DESC LIMIT 1` 取最後一筆預測，不比對快照日；`recordForecast`（`web/src/server/jobs.ts:531-539`）在當天 VIX 未到或 SPX 未核對時不寫新列，所以快照更新了、預測還是前一天的。網頁卡片 `web/pages/index.tsx:87-115` 與 App 卡片 `OverviewView.swift:180-219` 都沒用 `trade_date`／`ForecastBrief.tradeDate`（`ios/MarketObservatory/Models.swift:192`）。資料已在 API 裡，只差顯示。`web/tests/api-contract.test.ts:47` 的合成資料剛好就是「預測比快照舊 29 個交易日」。
- **A-09**：`web/src/server/outlook.ts:22-23` 在 `buildOutlook` 回 null 時照樣回傳紀錄。網頁 `web/pages/outlook.tsx:246-249` 已照常顯示紀錄，但說明是「資料不足，或 VIX 超過 3 個交易日未更新」，沒講是哪一個；App `ios/MarketObservatory/Views/MoreView.swift:382` 的 `if let o = p.outlook` 把 `forecastSection(p)`（`:465`）包在裡面，`else` 只寫「資料不足，還無法產生展望。」（`:467`），紀錄整段被藏起來。後端判斷 VIX 過舊的方式已有現成寫法：`jobs.ts:574` `vixAt(spx, vix, last, DEFAULT_MODEL.vixMaxStaleSessions) === null`。
- **A-12**：`web/src/server/views.ts:169-174` 相對報酬圖以「區間內第一個交易日」為 0%；`:183` 統計表與 `:217` 主標的區間報酬用 `periodReturn`（`web/src/lib/analytics.ts:64`），起點是「start 當天或之前最後一筆」。start 落在週末或假日時兩者不同。V-A 合成重現：start=2040-01-07（週六）、1/06=100、1/09=110，圖終值 10%、表 21%。另外名單公司在 start 之前沒資料時，圖會畫線但表格是「—」。
- **A-08**：`MoreView.swift:463` 對上漲模型傳 `showHitRate: true`，`:589-592` 列出兩行命中率；`web/src/lib/forecast.ts:513` 的 hitRate 以 0.5 為界，和以基準率為界的 call 語意不同，L01 已決定移除（`web/docs/forecast.md:35`）。網頁 `web/pages/outlook.tsx:62-81` 早已沒有這兩行。
- **A-10／C-04**：App `MoreView.swift:254`「考慮出場的漲幅」、`:312`「考慮出場漲幅 %」、`:316`「出場漲幅 0–100%」。網頁 `web/pages/etfs.tsx:207`「檢討門檻 ±%」、`:222`「漲跌達 ±20% 時檢討」、`web/src/lib/plan.ts:12` `PLAN_RULES_TEXT` 與 `web/src/server/views.ts:251-253` 的驗證訊息都已是「檢討門檻」，而且 `plan.ts:12` 的註解寫「與 iOS 同一句」，實際並不同。
- **B-06**：`web/src/lib/sources/nasdaq.ts:73` 只有命中 `estimated|derived from an algorithm` 才標 `estimated`，其餘一律 `confirmed`；V-B 第 8 條實測 AAPL 回 `is expected* to report earnings`，被標成 `confirmed`，網頁 `web/pages/news.tsx:7` 顯示「公司已公布」。事件表 `status` 是自由文字欄位（`web/db/schema.ts:111`），加新值不需要 migration。
- **B-05**：`web/src/server/push.ts:230-248` `notifyClose` 只檢查快照日期，`web/src/lib/push.ts:42`（`dailySummary`）、`:62`（`bigMoves`）不看核對狀態。核對狀態已在快照裡：`Snapshot.index.check.status` 與每列 `Mag7Row.check`（`snapshot.ts:127-128`、`:158-163`），`viewForMembers`（`snapshot.ts:287`）只保留該使用者名單的列。注意排程時序：`prices` 排程（`web/crons/prices.ts`，UTC 21:40）跑完抓價就送推播（`jobs.ts:772`），名單個股的 Nasdaq 核對在 `crosscheck` 排程（UTC 22:50）才跑；未核對的列在 `repo.ts:180` 讀成 `pending`（快照端 `snapshot.ts:101` 的 `checkOf` 也預設 `pending`）。所以 21:40 送推播當下，名單個股幾乎每天都是 pending；mismatch 會在兩條路線出現：SPX 由 Cboe 在同一個 `prices` 工作核對（`jobs.ts:151-165`），21:40 就可能是 mismatch；當天 21:40 沒抓到收盤時，`SCHEDULES.retry = ["prices", "crosscheck", "notify-close"]`（`jobs.ts:774`，UTC 01:10）先核對再送，名單個股也可能是 mismatch。

## 3. 票

同一條分支依序做，順序就是編號。各票之間沒有邏輯依賴，排序是為了讓同一個檔案（`OverviewView.swift`、`MoreView.swift`、`Format.swift`、`CopyTests.swift`、`communication.ts`）的改動一次一張。

共用驗收（每張 web 票都要）：`cd <worktree>/web && …` 依序跑 `npx void prepare`、`npm run typecheck`、該票列出的 `node --test tests/<檔>.test.ts`、`npm test`。web 測試可以和其他領域平行跑。

共用驗收（每張 iOS 票都要）：`cd <worktree>/ios && xcodegen generate && xcodebuild build-for-testing -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'generic/platform=iOS Simulator'`（不開模擬器），再在既有的 `MO iPhone 16 Plus` 上跑該票的 `MarketObservatoryTests`，寫成 `xcodebuild test-without-building … -only-testing:MarketObservatoryTests/<Suite>; rc=$?; xcrun simctl shutdown 'MO iPhone 16 Plus'; test $rc -eq 0`：不論成敗都關機，結束碼仍是測試的結束碼（不能寫成 `…; xcrun simctl shutdown …`，那樣測試失敗也會回 0）。

模擬器規則：
- `test-without-building` 到 `shutdown` 這段受工作流程的**全域模擬器鎖**管制：同一時間只有一個領域能開模擬器，用完關機再交下一個；兩台 MO 模擬器不同時開。鎖由整合者／監工提供，本領域的指令不自己加鎖檔。
- 不新增、不刪除模擬器。L7-T1 合併前，任何驗收都不跑 `ios-up.sh`、`down.sh`；要用 `ios-test.sh` 時照 `AGENTS.md:8` 手動流程：把既有 `MO iPhone 16 Plus` 的 UDID（`xcrun simctl list devices` 查，目前是 `612AC897-0273-4221-A0A6-63AA183A577C`）寫進本輪 `$RUN/sim.udid`，驗完手動關閉本輪服務並 `xcrun simctl shutdown`。

fixture 檢查（T3、T4）：`MO_UPDATE_API_FIXTURES=1` 重產後，用 `test -z "$(git diff -U0 "$(git merge-base HEAD main)" -- ../ios/MarketObservatoryTests/Fixtures/generated/ | grep -E '^[-+][^-+]' | grep -v …)"` 確認相對分支起點只多出本領域宣告的欄位行。這條只適用基底是 `main` 的領域分支；整合分支上會看到其他領域的欄位，改走 §5 的整合規則人工審 diff。

### L3-T1　RSP 減 SPX 標「個百分點」（A-13）

- **行為**：網頁總覽 KPI「等權重 RSP − 市值加權」與 App「市場指標」展開後的「等權重 − 市值加權」卡，數值寫成 `+0.35 個百分點`／`−1.20 個百分點`，紅漲綠跌顏色不變；值為 null 時只顯示「—」（不顯示「— 個百分點」）。下方「RSP +x% vs SPX +y%」不變（那兩個本來就是百分比）。API 不變。
- **改動**：
  - `web/src/ui/format.ts`：新增 `ppText(v, digits = 2)`，等於 `signed(v, digits)` 加「 個百分點」，`signed` 回 `DASH` 時回 `DASH`。
  - `web/pages/index.tsx:75`：改成 `<span className={tone(s.breadth.spreadPct)}>{ppText(s.breadth.spreadPct)}</span>`（`tone`、`ppText` 從 `../src/ui/format.ts` import）。
  - `ios/MarketObservatory/Format.swift`：`Fmt` 新增 `static func pp(_ v: Double?, _ digits: Int = 2) -> String`，規則同上。
  - `ios/MarketObservatory/Views/OverviewView.swift:323`：`value: Fmt.pp(s.breadth.spreadPct)`。
  - `web/src/lib/snapshot.ts:67`：只改註解為「等權重減市值加權（百分點）；負值代表等權重落後市值加權，不代表多數股票下跌」。
- **測試**：新增 `web/tests/format.test.ts`：`ppText(0.35) === "+0.35 個百分點"`、`ppText(-1.2) === "−1.20 個百分點"`、`ppText(null) === "—"`。`ios/MarketObservatoryTests/CopyTests.swift` 新增同三個輸入，斷言 `Fmt.pp` 結果與網頁字串完全相同。
- **不碰**：`snapshot.ts` 的計算、`spreadPct` 欄位名與尺度、`web/src/lib/news-ai.ts`、`web/src/server/ai-batch.ts`。

### L3-T2　總覽展望卡片標預測資料日與「待更新」（A-07）

- **行為**：網頁與 App 總覽的「下月展望」卡片（只在看最新日時出現，條件不變）多一行「資料日 ＜預測日＞」（網頁用 `dateWithWeekday`，App 用 `Fmt.fullDate`，與各自展望頁一致）。當 `forecast.trade_date` 早於畫面上的快照日 `snapshot.data.tradeDate` 時，再加橘色標籤「待更新」與一句說明：
  `最新收盤 ＜快照日＞ 的預測還沒記錄（通常是在等當天的 VIX 或 S&P 500 收盤核對），這裡先顯示 ＜預測日＞ 收盤的紀錄；展望頁用最新資料即時試算，數字可能不同。`
  數字本身不變，不重算、不改預測紀錄（G02）。API 不變（`trade_date` 早已在 `/api/v1/overview` 的 `forecast` 裡）。
- **改動**：
  - `web/src/lib/communication.ts`：新增 `FORECAST_PENDING_BADGE = "待更新"` 與 `forecastPendingNote(forecastDate: string, snapshotDate: string): string`（參數是已格式化的顯示字串，兩端各自傳自己的日期格式）。
  - `web/pages/index.tsx:87-115`：卡片加資料日行；`forecast.trade_date < s.tradeDate` 時加 `<span className="badge warn">` 與說明。
  - `ios/MarketObservatory/Format.swift` 的 `Copy`：新增 `forecastPendingBadge`、`forecastPendingNote(forecastDate:snapshotDate:)`，字串與網頁相同。
  - `ios/MarketObservatory/Views/OverviewView.swift:180-219`：同上（快照日取 `o.snapshot?.data.tradeDate`）。
- **測試**：`web/tests/communication.test.ts` 新增：`forecastPendingNote("A", "B")` 等於上面模板代入的完整字串、`FORECAST_PENDING_BADGE === "待更新"`。`CopyTests.swift` 新增同樣兩個斷言（同一字串）。
- **不碰**：`web/src/server/views.ts:77` 的查詢、`web/src/server/jobs.ts` 的 `recordForecast`、`forecasts` 表、`web/src/lib/forecast.ts`。

### L3-T3　展望算不出來時說明原因，App 照樣列紀錄（A-09）

- **行為**：
  - `/api/v1/outlook` 新增 optional 欄位 `outlookUnavailable`：`outlook` 有值時為 `null`；`outlook` 為 null 時為 `{ reason: "vix-stale" | "insufficient", spxDate: string | null, vixDate: string | null, staleSessions: number | null, maxStaleSessions: number | null }`。判斷：SPX 沒資料 → `insufficient`；最後一個 SPX 交易日 `vixAt(spx, vix, last, cfg.vixMaxStaleSessions) === null` → `vix-stale`（同 `jobs.ts:574`）；其餘 → `insufficient`。`staleSessions` = SPX 在 `vixDate` 之後的交易日數；`vixDate` = `vix.onOrBefore(spxDate)` 的日期。
  - 網頁 `/outlook` 的提示（`outlook.tsx:248`）改成依原因的句子：
    - vix-stale（有 VIX）：`VIX 最新只到 ＜vixDate＞，比 S&P 500（＜spxDate＞）落後 ＜n＞ 個交易日，超過 ＜max＞ 個交易日的上限，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。`
    - vix-stale（完全沒有 VIX）：`還沒有 VIX 資料，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。`
    - insufficient：`歷史資料還不夠計算條件與驗證，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。`
  - App「更多 → 下月展望」在 `outlook` 為 nil 時顯示同一句（橘色 Notice），並照常顯示「實際發出的預測／上線後實際紀錄」區段（`forecastSection(p)`）；收到舊後端（沒有 `outlookUnavailable`）時用現行網頁那句「資料不足，或 VIX 超過 3 個交易日未更新，今天沒有產生預測；下方的機構觀點與過去的預測紀錄照常顯示。」。有 outlook 時版面與順序不變。
  - 不放寬 M5（VIX 最多落後 3 個交易日），不把舊紀錄當成新預測。
- **改動**：
  - `web/src/lib/communication.ts`：新增 `interface OutlookUnavailable`、`outlookUnavailable(spx: Series, vix: Series, cfg = DEFAULT_MODEL): OutlookUnavailable`、`outlookUnavailableText(u): string`（import `vixAt`、`DEFAULT_MODEL`、`type ModelConfig` 自 `./forecast.ts`，`type Series` 自 `./analytics.ts`；目前 `forecast.ts` 不 import `communication.ts`，沒有循環，`DEFAULT_MODEL` 只當預設參數在呼叫時讀，不要在模組頂層取值）。放在這裡而不是 `forecast.ts`，避免和 P0 #8 改 `buildOutlook` 的票衝突。
  - `web/src/server/outlook.ts:92-114`：回傳物件緊接 `outlook` 之後加 `outlookUnavailable: outlook ? null : outlookUnavailable(spx, vix)`（放在第二個 key，fixture diff 才會是一行純新增）。
  - `web/pages/outlook.tsx:207`、`:246-249`：解構新欄位，提示改用 `outlookUnavailableText`。
  - `ios/MarketObservatory/Models.swift`（`OutlookPage`，`:415`、`:627-640`）：新增 `struct Unavailable: Decodable, Sendable { let reason: String; let spxDate, vixDate: String?; let staleSessions, maxStaleSessions: Int? }` 與 `let outlookUnavailable: Unavailable?`。
  - `ios/MarketObservatory/Format.swift` 的 `Copy`：新增 `outlookUnavailable(reason:spxDate:vixDate:staleSessions:maxStaleSessions:)` 與 `outlookUnavailableFallback`，字串與網頁相同；`reason` 不是已知的兩個值時回 fallback 句（之後後端加新原因，舊 App 不會顯示空白提示）。
  - `ios/MarketObservatory/Views/MoreView.swift:382-468`：`forecastSection(p)` 移到 `if let o … else …` 之外（兩個分支都會出現，有 outlook 時位置仍在兩個滾動驗證之後）；`:467` 改成 Notice。
  - `ios/MarketObservatoryTests/Fixtures/generated/generated-outlook.json`：以 `MO_UPDATE_API_FIXTURES=1` 重產，相對分支起點只多出一行 `"outlookUnavailable": null,`；acceptance 用上面的 fixture 檢查（`grep -v '"outlookUnavailable": null'`）判定。
- **測試**（修正前會失敗）：
  - `web/tests/forecast-records.test.ts:66` 的「VIX 過期」測試加：`assert.equal(v.outlookUnavailable?.reason, "vix-stale")`、`assert.equal(v.outlookUnavailable?.staleSessions, 8)`、`vixDate` 等於倒數第 9 個交易日、`spxDate` 等於最後一個交易日；`:62` 的正常情境加 `assert.equal(view.outlookUnavailable, null)`。修正前欄位不存在，斷言失敗。
  - `web/tests/communication.test.ts`：`outlookUnavailable` 對「SPX 只有 50 筆、VIX 齊全」回 `insufficient`；三種原因的 `outlookUnavailableText` 完整字串。
  - `ios/MarketObservatoryTests/FixtureDecodingTests.swift`：解碼一段 `{"reason":"vix-stale","spxDate":"2026-10-27","vixDate":"2026-10-20","staleSessions":5,"maxStaleSessions":3}` 為 `OutlookPage.Unavailable`；`generatedOutlook` 斷言 `p.outlookUnavailable == nil`；舊 fixture `outlook.json` 照樣解得開。
  - `CopyTests.swift`：三種句子與 fallback 與網頁字串相同。
- **不碰**：`web/src/lib/forecast.ts`（`buildOutlook`、`vixAt`、`DEFAULT_MODEL` 只讀不改）、`jobs.ts` 的 `recordForecast`、`docs/forecast.md`、App 展望頁其他區段（P0 #8 的票會改相位與 dd5 閘門呈現）。

### L3-T4　走勢頁圖表與統計共用起點（A-12）

- **行為**：走勢頁所有「區間」數字都以**區間內第一個交易日收盤**為起點（就是現在圖表的起點，App 標題「起點 0%」不變）：主標的「區間報酬」、區間統計表每列的「區間報酬」、相對報酬圖終值三者對得上；最大回撤與年化波動本來就用同一段資料，不變。主標的頁首「first ～ last」本來就是這段的起訖，現在區間報酬與它一致。某列標的在區間開始後才有資料時，該列以自己的第一筆為起點，網頁在報酬旁寫「自 ＜日期＞」，App 在該列副標加「自 M/D」；以前這種列在表格是「—」、圖上卻有線。終點規則不變：該標的沒有 `end`（SPX 最後一天）的收盤就回 null。
- **改動**：
  - `web/src/lib/analytics.ts`：新增 `rangeReturn(inRange: Point[], toDate: string): number | null`：`inRange` 已篩成 `date >= start`；第一筆不存在、最後一筆日期不等於 `toDate`、或第一筆就是 `toDate` 時回 null，否則 `pct(last.close, first.close)`。**不改 `periodReturn`**（另有 `snapshot.ts:137`、`:230-233`、`:253-254`，`views.ts:289`、`:291`，`analytics.ts:196-197` 等呼叫端）。
  - `web/src/server/views.ts:176-187`：`ret: rangeReturn(inRange, end)`，每列緊接 `ret` 之後新增 `first: inRange[0]?.date ?? null`（不要放在最後：放在 `vol` 之後會讓 `vol` 那行多出逗號，fixture diff 就不是純新增）。`:217`：`mainStats.ret = rangeReturn(main.points.filter((p) => p.date >= start), end)`，其他欄位不變。`:169-174` 圖表邏輯不變，只更新註解寫明與統計同一起點。`views.ts:4` 的 `periodReturn` import 仍要保留（ETF 區塊在用）。
  - `web/pages/history.tsx:58-86`：圖下加一句「每條線以區間第一個交易日收盤為 0%，與下表「區間報酬」同一起點」；表格中 `s.first` 不等於 SPX 那列的 `first` 時，報酬旁加 `<span className="meta">自 {s.first}</span>`。
  - `ios/MarketObservatory/Models.swift:237-245`：`History.Stat` 新增 `let first: String?`。
  - `ios/MarketObservatory/Views/HistoryView.swift:214-235`：`s.first` 與 SPX 列不同時，副標加「自 \(Fmt.shortDate(first))」；`:148-150` 標題下加同一句起點說明（caption）。
  - `ios/MarketObservatoryTests/Fixtures/generated/generated-history.json`：重產。合約資料 end=2026-10-28、months=1，start=2026-09-28 是週一，`periodReturn` 與 `rangeReturn` 的起點相同，所以只多出每列的 `"first": …` 行，`ret` 不變；acceptance 用 fixture 檢查（`grep -v -e '"outlookUnavailable": null' -e '"first": '`，T3 在同一分支先做）判定，有其他行變動就是實作錯了，要查原因。
- **測試**（修正前會失敗）：
  - 新增 `web/tests/history-anchor.test.ts`：`migratedDb()`；仿 `api-contract.test.ts` 寫入 viewer 的 `watchlist:<id>` 設定（只放 NVDA）與 NVDA 的 weights 列；SPX、RSP 每個平日一筆，2040-01-06（五）以前 100、2040-01-09 起 110、2040-02-06（一）121；NVDA 從 2040-01-16 才有資料，且一定要有 2040-02-06 的收盤（否則 `rangeReturn` 依終點規則回 null，斷言無法成立）。呼叫 `historyView(ctx({ symbol: "SPX", months: "1" }), viewer)`（end=2040-02-06，start=2040-01-07 週六）。斷言：SPX 的 `rebased` 最後一點 `value` 與 `stats` 中 SPX 的 `ret` 相差 < 0.01（修正前 10 vs 21）；`mainStats.ret` ≈ 10、`mainStats.first === "2040-01-09"`；SPX 列 `first === "2040-01-09"`；NVDA 列 `first === "2040-01-16"` 且 `ret` 等於 NVDA 圖終值（修正前為 null）。
  - `web/tests/analytics.test.ts`：`rangeReturn` 的三種 null 情況與一般情況。
  - `ios/MarketObservatoryTests/FixtureDecodingTests.swift`：`generatedHistory` 斷言 `stats.allSatisfy { $0.first != nil }`；舊 fixture `history.json` 照樣解得開（`first` 為 nil）。
- **API**：`/api/v1/history` 的 `stats[]` 新增 optional `first`；`ret` 型別不變，數值只在起點落在非交易日或標的晚上市時改變。
- **不碰**：`periodReturn`、`snapshot.ts` 的週／月／年報酬、ETF 頁（`views.ts:280-300`）、`contribution` 段、`priceLine` 與均線暖機。

### L3-T5　App 拿掉 50% 命中率（#5，A-08）

- **行為**：App「更多 → 下月展望 →（展開）滾動驗證：上漲機率」只列 Brier、基準 Brier、BSS 與區間、最小可偵測 BSS，不再有「預測方向命中率」「永遠猜上漲的命中率」。dd5 區塊本來就沒有。網頁不變（早已移除）。API 的 `hitRate`、`baseHitRate` 保留、App Codable 保留（舊欄位相容），只是不顯示；不另造「相對基準命中率」。
- **改動**：`ios/MarketObservatory/Views/MoreView.swift:584-608` 的 `evaluationSection` 把 `showHitRate: Bool` 換成 `id: String`，刪除 `:589-592`；`:605` 改為 `.accessibilityIdentifier("outlook-validation-\(id)-details")`，**識別字串必須仍是 `outlook-validation-up-details`／`outlook-validation-dd5-details`**（`VerifyInteractionTests.swift:782` 依賴）。呼叫端 `:458-459` 傳 `id: "dd5"`、`:462-463` 傳 `id: "up"`。`:583` 的註解一併改。
- **測試**：`ios/MarketObservatoryUITests/VerifyInteractionTests.swift:778-791` 的 `test12_Outlook` 在展開 `up` 後加 `XCTAssertFalse(app.staticTexts.containing(NSPredicate(format: "label CONTAINS '命中率'")).firstMatch.exists, "上漲驗證不應再列命中率")`（修正前存在，斷言失敗）。單元測試無；靠 build-for-testing 與整合驗收時跑 `test12_Outlook`。
- **不碰**：`web/src/lib/forecast.ts:513` 的 hitRate 計算、`Models.swift:435` 的欄位、展望頁其他區段。

### L3-T6　App 改用中性的「檢討門檻 ±%」（#5，A-10、C-04）

- **行為**：App「更多 → ETF 與定投試算」的「我的規劃」區：「考慮出場的漲幅　20%」改成「檢討門檻 ±%　±20%」，區段 footer 加「只是規劃，不是持倉或交易紀錄；漲跌達門檻時自己檢討，App 不會監看或提醒。」。編輯畫面欄位「考慮出場漲幅 %」改成「檢討門檻 ±%」，錯誤句改成與網頁 `PLAN_RULES_TEXT` 完全相同的「金額要是 0 到 10 億的整數，檢討門檻 0–100%，備註最多 2000 字。」。存的欄位 `exitConsiderationPct`、範圍 0–100、API 都不變；不定義錨點與幣別（§10 第 5 題未決），不加任何門檻觸發。網頁已是這套用語，不改。
- **改動**：
  - `ios/MarketObservatory/Format.swift`：新增 `enum PlanCopy { static let reviewLabel = "檢討門檻 ±%"; static let rulesText = "金額要是 0 到 10 億的整數，檢討門檻 0–100%，備註最多 2000 字。"; static let note = "只是規劃，不是持倉或交易紀錄；漲跌達門檻時自己檢討，App 不會監看或提醒。"; static func reviewValue(_ pct: Double) -> String }`（`reviewValue` 與網頁 `pctText(v, 0).replace("+", "±")` 同結果：20 →「±20%」、0 →「0%」）。
  - `ios/MarketObservatory/Views/MoreView.swift:251-256`（顯示列與 footer）、`:312`（欄位 label）、`:316`（錯誤句）改用 `PlanCopy`。
  - `ios/MarketObservatoryUITests/VerifyInteractionTests.swift:361`：`app.textFields["檢討門檻 ±%"]`。
  - `web/tests/plan.test.ts`：加一條斷言把 `PLAN_RULES_TEXT` 釘成上面那句，作為 iOS 對照。
  - 文件：`.claude/skills/verify/features/etfs-dca.md:3`、`:12`、`:32` 的「出場漲幅／考慮出場漲幅 %」與「網頁與 App 用詞不同」改掉；`.claude/skills/verify/SKILL.md:124`「F4 出場漲幅 150」改「F4 檢討門檻 150」。
- **測試**：`CopyTests.swift` 新增：`PlanCopy.rulesText` 等於網頁那句、`PlanCopy.reviewLabel == "檢討門檻 ±%"`、`reviewValue(20) == "±20%"`、`reviewValue(0) == "0%"`。修正前 App 的錯誤句是「出場漲幅 0–100%」，與網頁不同。
- **不碰**：`web/pages/etfs.tsx`、`web/src/lib/plan.ts`（只加測試，不改字串）、`web/src/server/views.ts` 的 `PlanSchema`／`DEFAULT_PLAN`、`Plan` Codable 欄位名、定投試算區（A-11、C-01 屬別的票）。

### L3-T7　財報日 `expected*` 標「預期」（#6，B-06）

- **行為**：Nasdaq earnings-date 回應（日曆沒排到時的備援路徑）不再被升成「公司已公布」：`reportText` 命中 `estimated|derived from an algorithm` → `estimated`（不變）；其餘一律 → 新狀態 `expected`。財報日曆列（`nasdaq.ts:162`）維持 `confirmed`。畫面：網頁新聞頁徽章「預期」（橘），總覽「未來三週事件」該列也加「預期」；App 新聞日曆與總覽事件列同樣「預期」（橘）；事件推播該項加「（預期）」；站長看的 events 工作摘要加「（預期）」。
- **改動**：
  - `web/src/lib/sources/nasdaq.ts:55-56`：`status: "estimated" | "expected" | "confirmed"`，註解寫明 confirmed 只來自財報日曆；`:73` 分類如上。
  - `web/pages/news.tsx:6-11`：`STATUS` 加 `expected: ["warn", "預期"]`。
  - `web/pages/index.tsx:205-206`：加 `{e.status === "expected" && <span className="badge warn" …>預期</span>}`。
  - `web/src/lib/push.ts:88`、`:94`：`eventReminder` 對 `expected` 加「（預期）」，註解一併改。
  - `web/src/server/jobs.ts:449`：摘要對 `expected` 加「（預期）」。
  - `ios/MarketObservatory/Views/NewsView.swift:315-323`：加 `case "expected": ("預期", .orange)`。
  - `ios/MarketObservatory/Views/OverviewView.swift:546-553`：加 `case "expected": Text("預期").font(.caption2).foregroundStyle(.orange)`。
- **測試**（修正前會失敗）：
  - `web/tests/sources.test.ts:33` 那個測試加：`parseEarningsDate("AAPL", { announcement: "Earnings announcement* for AAPL: Nov 2, 2026", reportText: "Apple Inc. is expected* to report earnings on 11/02/2026 after market close. According to Zacks Investment Research, based on 9 analysts' forecasts, the consensus EPS forecast for the quarter is $1.77." })!.status === "expected"`（修正前是 `confirmed`）；以及現有 `both` 案例（無任何確認字樣）的 `status === "expected"`。
  - `web/tests/push.test.ts:60-71`：事件列表加一筆 `status: "expected"`，body 對應項為「…財報（預期）」。
  - 不要改 `web/tests/helpers/fake-cloudflare.ts:176` 與 `web/tests/cron-budget.test.ts:286`（它們用 "derived from an algorithm"，結果仍是 `estimated`／「（估）」）。
- **API**：`events[].status` 多一個字串值 `expected`，欄位與型別不變；`api-contract` 的合成事件是 `scheduled`，fixture 不變。
- **部署順序**：含這張票的網頁／Worker 要和含 L3-T7 的 TestFlight 版本同時或稍晚上線；做不到就在整合回報寫明空窗，由使用者決定是否接受。不在伺服器端為舊版 App 加相容 fallback。空窗的起點不是部署當下，而是部署後第一次 `daily-reference`（UTC 11:30）的 events 工作先清後寫，未來的備援路徑事件才會從 `confirmed` 改成 `expected`。
- **不碰**：`parseEarningsCalendar`、事件表 schema、`jobs.ts` 的事件寫入／清除邏輯、FOMC／CPI／非農靜態日程。

### L3-T8　收盤推播的來源不一致數字附「未核對」（#6，B-05）

- **行為**：照常在同一時間送、同樣去重（每人每天每種一則），不延遲、不重送。只改文字，而且只對 `mismatch`（兩個來源的收盤不一致）加標籤：
  - 每日摘要（`dailySummary`）：SPX `index.check.status` 為 `mismatch` 時，標題尾加「（未核對）」：`S&P 500 10/23 收盤 +0.85%（未核對）`。名單任一列 `check` 為 `mismatch` 時，名單那段寫 `名單 +23.1 點（40%，未核對）`（沒有占比時 `名單 +23.1 點（未核對）`）。
  - 大漲大跌（`bigMoves`）：`check` 為 `mismatch` 的公司項目尾加「（未核對）」：`Tesla（TSLA）−6.3%（未核對）`；只有一家時標題也加。多家時標題不變。
  - `match`、`pending`（還沒核對）、`unavailable`（沒有第二來源）都不加標籤，文字與現在逐字相同。pending 是否也加標籤見 §7。
  - 實際會出現的情況：SPX 在 21:40 的 `prices` 工作就由 Cboe 核對，標題可能帶標籤；名單個股要等 `crosscheck`，所以只有走 `retry`（UTC 01:10，先核對再送）那天才可能帶標籤。
- **改動**：只動 `web/src/lib/push.ts:41-77`（新增小工具 `unverified(status)`，只在 `status === "mismatch"` 時回「未核對」）。呼叫端 `web/src/server/push.ts:239`、`:243` 不變；`deliver`／`push_log` 去重（`server/push.ts:182`）不變。
- **測試**（修正前會失敗）：`web/tests/push.test.ts:31-43` 的 `snap()` 補上 `index.check: { status: "match" }` 與每列 `check: "match"`（現有兩個測試的斷言維持逐字不變，當作「乾淨時不加標籤」）；新增：SPX `mismatch` → 標題 `S&P 500 10/23 收盤 +0.85%（未核對）`；NVDA `mismatch` → body `6,812.34（+57.40 點） · VIX 15.2 · 名單 +23.1 點（40%，未核對） · NVDA +30.1`；TSLA `mismatch` → `bigMoves(…, 5).body === "Tesla（TSLA）−6.3%（未核對）、NVIDIA（NVDA）+5.4%"`、`bigMoves(…, 6).title === "TSLA 10/23 大跌 −6.3%（未核對）"`。守住刻意排除：SPX 與 NVDA、TSLA 全部 `pending` 時，`dailySummary` 的 title／body 與 `bigMoves(…, 5)`、`bigMoves(…, 6)` 的 title／body 都和全部 `match` 時逐字相同；`unavailable` 同。不要在正式程式碼為缺 `check` 的物件加防禦：正式快照一定有這個欄位，是測試假件缺欄位。
- **不碰**：`web/src/server/push.ts`、`SCHEDULES`、cron 時間、`viewForMembers`、iOS（推播文字由後端產生）。

## 4. 刻意排除與理由

| 排除 | 理由 |
| --- | --- |
| 財報日曆列（`nasdaq.ts:162`）一律 `confirmed` 也改標 | B-06 的延伸建議，不在本輪 #6 指派範圍；沒有證據顯示 Nasdaq 日曆會列未確認日期，要先查上游再定 |
| A-07 卡片加模型版本 | 報告 #4 只要求資料日與待更新；版本不在 overview 回應裡，要加 API 欄位，效益低 |
| B-05 的 snapshot revision 進推播 payload、逐裝置請求追蹤、更正後重送 | 使用者已決定照送加標籤、不延遲重送；revision 與裝置追蹤是 B-05 其他部分，報告 #6 沒有要求 |
| B-05 對 `pending`（還沒核對）也加「未核對」 | 報告 #6 有列，但使用者的決定只寫「來源不一致」；加了之後名單段與大漲大跌幾乎每天都帶標籤，需使用者決定（§7） |
| 讓 `crosscheck` 提早或併進 `prices` 排程，減少 pending | 改排程不在本領域；推播標籤照使用者決定先上線 |
| 「檢討門檻」的錨點、幣別與任何門檻觸發 | §10 第 5 題未決；使用者指示計算基準不變；X03／L17 |
| #4 的 A-05、A-06、A-11、B-04、C-01、R3-5 | 分給其他領域的票 |
| App「最大回檔」與網頁「最大回撤」用詞不一 | 不在指派條目內 |
| 走勢頁最大回撤／年化波動改起點 | 本來就用區間內資料，與新的報酬起點一致，不用改 |

## 5. 風險

- **推播「未核對」在名單段很少出現**：只對 `mismatch` 加標籤，而 `notify-close` 跟在 UTC 21:40 的 `prices` 後面，名單個股的 Nasdaq 核對在 UTC 22:50 的 `crosscheck`，平常送出時名單列是 `pending`，不帶標籤。名單段的標籤只會在走 `retry`（UTC 01:10）那天出現。SPX 由 Cboe 在同一個 `prices` 工作核對，標題的標籤平常就有效。這是照使用者決定的字面範圍；要涵蓋 pending 見 §7。
- **舊版 App 看到新的 `expected` 狀態**：`/api/v1` 型別不變不會解碼失敗，但舊版新聞日曆的徽章 `default` 分支會直接顯示灰字英文「expected」（`NewsView.swift:323`），舊版總覽事件列不顯示徽章（`OverviewView.swift:552`，跟現在的 confirmed 一樣）。所以 L3-T7 的網頁／Worker 要和含 L3-T7 的 TestFlight 版本同時或稍晚上線；做不到就在整合回報寫明空窗，請使用者決定是否接受。不在伺服器端加相容 fallback。空窗從部署後第一次 `daily-reference`（UTC 11:30）的 events 工作開始。
- **A-12 會改變少數區間報酬數字**：區間起點落在週末或假日時，主標的與統計表的報酬會從「前一個交易日收盤起算」改成「區間第一個交易日收盤起算」，與圖一致；晚上市的名單公司從「—」變成有數字並標起始日。這是口徑統一，不是錯誤。
- **跨領域合併衝突**：本領域會動到其他領域也可能改的檔案——`MoreView.swift`（P0 #8 相位與 dd5 閘門、A-05／A-06 共識、A-11／C-01 定投）、`web/src/server/outlook.ts` 與 `web/pages/outlook.tsx`（#8、#9、共識）、`web/src/lib/communication.ts`（#9 前瞻資格）、`views.ts`（R3-5 新聞、A-11）、`Format.swift`／`CopyTests.swift`。新增的函式一律加在檔尾、不重排既有程式碼，以減少衝突。整合規則：
  - 依整合者的合併順序逐一合併，後合併的領域在整合分支上 rebase 解衝突，不得改寫先合併領域的語意。L3 先合併時，後來的領域要保留：L3-T5 `evaluationSection` 的 `id` 參數與 `outlook-validation-up-details`／`outlook-validation-dd5-details` 識別字串、L3-T3 的 `outlookUnavailable` 欄位與 `MoreView` 裡移到 `if let` 之外的 `forecastSection(p)`、L3-T4 的 `stats[].first`。L3 後合併時，同樣保留先合併領域的欄位與參數（例如 L4 的 `phaseSummary`、`liveTrackDd5`）。
  - `communication.ts` 與 `communication.test.ts` 檔尾的衝突照合併順序串接。
  - L3 不改 `web/tests/api-contract.test.ts` 的種子。`ios/MarketObservatoryTests/Fixtures/generated/*.json` 不手動合併：每合併一個領域，就在整合分支跑 `MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts`，審 diff 只多出該領域宣告的欄位（L3 是 `generated-outlook.json` 頂層的 `"outlookUnavailable": null` 與 `generated-history.json` 的 `stats[].first`），再在全域模擬器鎖下跑 iOS `MarketObservatoryTests`。
  - 功能地圖：L3 只改自己功能的小節（`overview.md`、`outlook.md`、`history.md`、`etfs-dca.md`、`news-calendar.md`、`push.md`），全部合併後由整合者統一對帳一次。T6 會改的 `.claude/skills/verify/SKILL.md:124` 也是 L7-T1 會大改的檔，只改那一行的用詞。
- **iOS 驗收共用模擬器**：L2–L6 的 iOS 驗收都用 `MO iPhone 16 Plus`。`test-without-building` 到 `shutdown` 必須在全域模擬器鎖下跑，否則一個領域的 `shutdown` 會中斷另一個領域的測試；細節見 §3 開頭。
- **Orca 與 CLI**：本領域不改 `scripts/ai-batch.ts`、`/api/admin/ai` 或任何 CLI 介面，部署時主線不用同步 Orca 設定。
- **iOS 部分要隨 App 發版才上線**；網頁與推播文字部署即生效。

## 6. 整合驗收時要看的畫面（uiVerify 摘要）

照 `.claude/skills/verify/SKILL.md`：本機 worktree 起站（`web-up.sh`），網頁用 ego-browser、iOS 只用 `MO iPhone 16 Plus`／`MO iPhone 18 Pro Max` 一次一台，驗完 shutdown，而且在全域模擬器鎖下進行。L7-T1 合併前不跑 `ios-up.sh`／`down.sh`，照 `AGENTS.md:8` 把既有 UDID 寫進 `$RUN/sim.udid` 再用 `ios-test.sh`／`ios-walkthrough.sh`，驗完手動關閉本輪服務。改 D1 準備資料一律先備份到暫存表、驗完還原並 bump `data_version`。

| 票 | 網頁 | iOS | 對帳 |
| --- | --- | --- | --- |
| T1 | 總覽 KPI「等權重 RSP − 市值加權」寫「±x.xx 個百分點」 | 總覽展開「市場指標」，同卡同字；最大字級不截字 | `/api/v1/overview` `snapshot.data.breadth.spreadPct` |
| T2 | 總覽展望卡片「資料日 …」；把最新一筆 `forecasts` 暫存到 `verify_held_forecast` 後刪除、bump，出現「待更新」與說明；還原後消失 | 同上兩種狀態截圖 | `forecast.trade_date` vs `snapshot.tradeDate` |
| T3 | 把 VIX 最近 5 筆暫存到 `verify_held_vix` 後刪除、bump；`/outlook` 顯示「VIX 最新只到 …落後 5 個交易日…」且「上線後實際紀錄」仍在；還原 | 「更多 → 下月展望」同句 Notice＋紀錄區段仍在；還原後版面同前 | `/api/v1/outlook` 的 `outlook: null`、`outlookUnavailable`、`recent` 筆數 |
| T4 | `/history?symbol=SPX&months=12`：區間報酬＝表格 SPX 列＝圖 SPX 終值 | 走勢頁「區間報酬」＝「區間統計」S&P 500 列；圖下起點說明 | `/api/v1/history` 的 `mainStats.ret`、`stats[].ret`、`rebased` 末點、`stats[].first`。本機沒有晚上市名單公司時，「自 …」只以單元測試為準 |
| T5 | 不變 | `test12_Outlook` 展開上漲驗證，無「命中率」字樣；看 `H1-validation-up-expanded.png` | — |
| T6 | `/etfs`「檢討門檻 ±%」不變；輸入 150 的錯誤句 | 「我的規劃」列「檢討門檻 ±%　±20%」與 footer；`test06_EtfsPlan` F4 的錯誤句與網頁逐字相同 | `/api/v1/etfs` `plan.exitConsiderationPct` |
| T7 | 本機若沒有 `expected` 事件：把一筆未來財報事件暫存後改 `status='expected'`、bump；`/news` 徽章「預期」、總覽事件列「預期」；還原 | 新聞→日曆與總覽事件列「預期」 | `/api/v1/news` `events[].status` |
| T8 | 無畫面。用 worktree D1 最新快照（`npx void db execute` 取 `snapshots.data`）在 node 呼叫 `viewForMembers`＋`dailySummary`／`bigMoves`：把某列或 SPX 的 check 改成 `mismatch` 時文字含「未核對」；`pending`、`match` 時與原本文字相同 | 未實測真 APNs（需 TestFlight 實機與 APNs 金鑰） | `push.test.ts` |

功能地圖要更新：`overview.md`（T1、T2、T7）、`outlook.md`（T2、T3、T5）、`history.md`（T4）、`etfs-dca.md`（T6，另改 `SKILL.md:124`）、`news-calendar.md`（T7）、`push.md`（T8）。

## 7. 需你決定

1. **收盤推播在 `pending`（還沒核對）時要不要也標「未核對」？** 報告 #6 有列，但你的決定只寫「來源不一致」，所以 L3-T8 只對 `mismatch` 加標籤。
   - 不加（本輪做法）：名單個股平常在送出時還沒核對，名單段幾乎不會帶標籤；SPX 標題照常有效。
   - 加：名單段與大漲大跌幾乎每天都會帶「（未核對）」，因為名單核對（UTC 22:50）在推播（UTC 21:40）之後。若要加，把 `unverified` 的條件改成 `pending` 或 `mismatch`，並把 T8 測試裡「pending 時逐字不變」那組改回帶標籤的斷言。
   - 另一條路是調整 `crosscheck` 排程，讓名單在送出前核對完；那會動到排程，不在本領域。
2. **L3-T7 上線順序**：網頁／Worker 要不要等含 L3-T7 的 TestFlight 版本一起上線？不等的話，舊版 App 新聞日曆會有一段時間顯示英文「expected」。

## 8. 審稿處置

| 審稿意見 | 處置 |
| --- | --- |
| ALL：多個領域搶同一台 `MO iPhone 16 Plus`，`ios-up.sh`／`down.sh` 會新建、刪除模擬器 | 成立。§3 開頭與 §6 加全域模擬器鎖、L7-T1 合併前的手動 `sim.udid` 流程；iOS 票的 risks 註明受鎖管制。另外修正自己的指令：原本 `…; xcrun simctl shutdown …` 會吞掉測試失敗的結束碼，改成 `rc=$?; …; test $rc -eq 0`。 |
| L3-T8：使用者只決定「來源不一致」，spec 擴寫成也含 pending | 成立。T8 只對 `mismatch` 加標籤，pending 列進 §4 與 §7 待你決定；測試加「pending 時逐字不變」守住範圍。票不標 blocked，mismatch 部分現在就能做。 |
| ALL：`api-contract.test.ts` 種子與 generated JSON 跨領域衝突 | 部分適用。L3 不改種子行，L2 的行號不歸本領域。§5 補上整合規則：不手動合 JSON、每合併一個領域就重產並審 diff，L3 宣告的欄位是 `outlookUnavailable` 與 `stats[].first`。 |
| ALL：多個領域改同一檔或同一區塊 | 成立，但 L3 不用改碼。§5 補上合併規則：後合併者保留先合併者的語意，列出 L3 要被保留的參數、識別字串與欄位；`communication.ts` 檔尾照順序串接；功能地圖只改自己的小節。 |
| ALL：acceptance 夾中文說明、不能原樣執行 | 成立。L3-T3、T4 的 fixture 預期改成可機器判斷的 `test -z` 加 `git diff -U0` 過濾指令（§3 開頭），說明移到 tests 欄；所有指令都是 `cd <worktree>/web && …` 或 `cd <worktree>/ios && …`。T4 另外指定 `first` 緊接 `ret` 之後，避免 `vol` 那行多出逗號讓檢查誤判。 |
| L3-T7：舊版 App 會看到英文「expected」 | 成立。T7 加「部署順序」：Worker 與含 T7 的 TestFlight 同時或稍晚上線，否則回報空窗由你決定；不加伺服器端 fallback。也寫明空窗從部署後第一次 `daily-reference` 開始。 |
