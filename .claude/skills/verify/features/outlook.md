# 下月展望

兩個目標的機率，對照歷史基準率：跌幅機率（dd5，以資料日收盤為起點，未來 21 個交易日內至少有一天收盤比它低 5% 以上，放在前面）與上漲機率（約 21 個交易日後收盤高於資料日）；列出目前符合的條件、樣本內與滾動驗證的表現、上線後的實際紀錄，以及機構觀點（FactSet 由下而上目標價、分析師共識、投行年底目標價，只當背景）。

## Sub-features

- `outlook-pick`（F6）：上漲機率＝API `outlook.pick.p`、基準率＝`outlook.pick.base.p`（顯示成 %）；dd5＝`outlook.drawdown.pick.p`、平常＝`outlook.drawdown.pick.base.p`，網頁標題與「定義：」一行用上面的 dd5 定義，App 定義在「機率與模型說明」。dd5「已計分」依 R2-5：G09 全域條件與今天所選 cell 的 offset 0 閘門都通過；「未通過驗證，只供參考」出現與否等於 `outlook.drawdown.scored === false`，且 API `outlook.drawdown.gate.failed` 非空、列出未通過原因（畫面不列原因）；退回基準率時 (d) 一律未過，p 照常顯示。P(up) 不顯著時的說法是「尚未偵測到增額預測力」（自然頻率句；沒有收縮、採歷史基準率時主數字下方那行也有），不出現「與平常差不多」。
- `outlook-app-reading`：App 比較摘要依各自 `pick.distinct`，true 才顯示「估計比平常高／低」；上漲段為 false 或 nil 時省略摘要行，下跌段保留「尚未偵測到與平常的差別」。兩個目標的定義與自然頻率句移入「機率與模型說明」；不新增百分點門檻。
- `outlook-validation`：兩個分開標目標的滾動驗證區塊。網頁 KPI「跌幅機率（dd5）滾動驗證 BSS」主數字＝API `phaseSummary.dd5.mean`、「上漲機率滾動驗證 BSS」＝`phaseSummary.up.mean`（三位小數），附「相位平均（21 個起始相位）」、各目標 `low`～`high`、資料截至 `phaseSummary.asOf` 與模型 `phaseSummary.modelVersion`。另一行「單一相位（offset 0）」各自對 `outlook.drawdown.evaluation`／`outlook.evaluation`，dd5 註明「『已計分』判定用這個」、上漲註明「方向判定用這個」。摘要或目標為 null 時，KPI 退回 offset 0 並寫「相位平均尚未計算」。兩個面板標題仍為「滾動驗證：跌幅機率（dd5）」「滾動驗證：上漲機率」，內文首行為「單一相位（offset 0）」。App 同名 DisclosureGroup 展開後首行顯示相位平均數字、區間、資料日與版本，原 BSS 列標「BSS（單一相位 offset 0）」；兩個目標都不列命中率，API 與 App Codable 的 `hitRate`、`baseHitRate` 保留。區間標「歷史平均預測力 95% 區間（不是今天這個數字的區間）」。
- `outlook-intervals`：條件比例的區間（主數字下方、評估項「差異」、條件表表頭）標「這類時期的歷史比例 95% 區間」，跟 BSS 的預測力區間分名。
- `outlook-conditions`：條件表、目前條件有標記。
- `outlook-legend`：機率條的可見圖例列出目前機率、歷史基準、50% 中線與歷史比例 95% 區間，390px 觸控寬度也看得到。
- `outlook-records`：上線後實際紀錄：上漲機率（forecast 工作寫入；每列以紀錄日收盤為起點）。依 L09 增補一，只計 lag 0 且 PUB-1 準時的列；缺 lag、存下的 probability／base_rate／close 或時限不明先歸資格不明，lag ≥ 1 或逾時為延遲補記。API `liveTrack.realtime/delayed/unknown` 各為分類列數。網頁標題下、App footer 原樣顯示伺服器 `liveTrack.note`：「只計即時發布的列（寫入時是最新交易日，且在下一個交易日美東 16:30 前寫入）；延遲補記 X 列、資格不明 Y 列另列、不計分。合併所有已發布的模型版本。」X／Y 對 `delayed/unknown`。App 將既有說明「合併所有已發布的模型版本；每列以紀錄日收盤為起點。這是和樣本內、滾動驗證分開的第三種分數。」與 `liveTrack.note` 以換行串成單一 footer，note 原文完整保留。格線從第一筆即時列起每 21 個 SPX 交易日，無即時列的格點略過、不遞補；n 只算已到期格點，合併版本。網頁與 App 的「樣本太少」說明寫明「只取不重疊的列：從第一筆即時發布的紀錄起每 {horizon} 個交易日一列。」
- `outlook-records-dd5`：同頁「上線後實際紀錄：跌幅機率（dd5）」，App 位於機構觀點之前、if／else 之外，`outlook` 為 nil 也顯示。依 R2-6 修訂一：缺 lag、drawdown.p／base／modelVersion 或 PUB-1 時限不明先歸資格不明；lag ≥ 1 或逾時為延遲補記，其餘即時。每個版本一行，模型、n、樣本太少／BSS、實際發生比例對 API `liveTrackDd5.groups` 的 `modelVersion/n/tooFew/bss/eventShare`；無到期列顯示空狀態。`realtime/delayed/unknown` 為分類列數；「延遲補記 X 列、資格不明 Y 列，保留、不計分」對 `delayed/unknown`。下方原樣顯示伺服器 `note`，資格與計數句同 P(up)，最後一句為「依模型版本分開計分。」格線從 PUB-1 分類後第一筆即時列起每 21 個 SPX 交易日，全部版本共用、略過無即時列的格點，再分組計分；少於 12 個獨立月份不報 BSS。
- `outlook-unavailable`：`outlook` 為 null 時，網頁與 App 依 `outlookUnavailable` 說明 VIX 最新日、落後的 SPX 交易日數與上限；完全沒有 VIX 或歷史資料不足時各有提示。App 顯示橘色 Notice，兩端的過去預測紀錄與機構觀點照常顯示；舊後端缺欄位或未知 reason 用原有網頁提示。有展望時 `outlookUnavailable` 為 null，版面順序不變，M5 上限仍為 3 個交易日。
- `outlook-views`：機構觀點區塊有內容或明確空狀態。
- `outlook-consensus`（網頁）：三張共識 KPI 各顯示「N 檔 · X% 權重」，依序對 API `consensus.coverage.target`、`ratings`、`revisions`；各自權重不到 50% 時顯示「（不到一半，數字不完整）」。`symbols`／`coveredWeightPct` 是三組有效列聯集，空列另列 `noData`，為 0 時省略空列說明。「本站反推（權重前 200 檔）」的涵蓋率＝`coverage.target.weightPct`，收盤日＝`indexCloseDate`；上方說明為「涵蓋子集的外推，各檔股價日不同，不是全部成分股同一天的加總」。說明行抓取日＝`oldest`～`newest`、股價日＝`priceOldest`～`priceNewest`（各檔不同日）、權重持股日＝`weightsAsOf`。表格股價下方列 `priceDate`（MM-DD）；目標價 null 且評等家數為 0 的列顯示「Nasdaq 無資料」。目標價均值下方列「最低 {targetLow}～最高 {targetHigh}」，任一缺值即省略；「EPS 近四週修正」欄顯示 `epsUp`／`epsDown`，0／0 為「沒有修正」，任一為 null 為「缺資料」，下方列「會計年度 {fiscalEnd} · 估計數 {estimates}」。EPS KPI 副標為「近四週各檔（上修−下修）÷（上修＋下修），依權重平均後 ×100，−100～+100」。表下說明個別分析師目標價範圍不是機率區間、EPS 是近四週修正次數而非幅度且不一定是不同分析師家數、會計年度為來源第一個年度；標「成效未證實」與「不是買賣訊號」。390px 時 EPS 欄隱藏，其他欄不破版。上榜表與彙總只含 UTC 今天往回 7 天內（含界線）的每檔最新列；`consensus` 為 null 時顯示「7 天內沒有更新的分析師共識…」。
- `outlook-consensus`（App）：三列指標的第二行依序對 `coverage.target`／`ratings`／`revisions`，顯示「N 檔 · X% 權重」，不到 50% 加「不到一半」；EPS 說明為「近四週各檔（上修−下修）÷（上修＋下修），依權重平均後 ×100，−100～+100」。「資料狀態」顯示「有可用數字 N 檔 · X%」，`noData.symbols > 0` 才加「；K 檔沒有可用數字」。展開「權重前 N 檔」後，目標下方列「區間 low–high」（兩端都有值才顯示），另列「EPS 上修 u／下修 d · 會計年度 FY · 估計數 n」；0／0 顯示「EPS 近四週沒有修正」，任一為 null 顯示「EPS 缺資料」，缺年度或估計數即省略該片段。footer 對 `weightsAsOf`、`oldest`～`newest`、`priceOldest`～`priceNewest` 與 `indexCloseDate`，說明各檔不同日、涵蓋子集外推而非全部成分股同日加總，以及區間不是機率區間、EPS 次數不是幅度、成效未證實與不是買賣訊號。舊回應缺少的涵蓋、日期與區間片段省略，既有必填 `symbols` 型別不變；最大 Dynamic Type 時所有說明、日期與個股列可換行、不截字。
- `outlook-strategists`：投行年底目標價表。中位數＝API `strategists.median`、家數＝`medianCount`（一家一票、只算年底目標：UBS GWM 與 Wells Fargo Investment Institute 標「不計入中位數」）；每列有「資料日期」、「已核對原文」或「媒體轉述，待原文核對」標章，資料日期超過 `staleAfterDays`（45）天的列標「待重新核對」（中性灰，不是紅綠）；WFII 顯示「區間 7,800–8,000 的中點」；註腳有一家一票規則與全表核對日 `checked`。App 同一區塊用小字列出同樣的標章。
- `outlook-overview-card`：總覽卡片先列 dd5，再列上漲機率；只在看最新日且有 forecast 時顯示，數字取已存預測，不重算。卡片「資料日」取 `/api/v1/overview` 的 `forecast.trade_date`（網頁 `dateWithWeekday`、App `Fmt.fullDate`）；早於 `snapshot.data.tradeDate` 時顯示橘色「待更新」與完整說明。展望頁用最新資料即時試算，可能與卡片不同。

- `outlook-disclosure`：App 下跌風險與上漲展望都依「標題 → 本次估計與歷史基準 → 比較摘要（上漲段僅 distinct 為 true）→ 模型狀態／警示」排序；大字時數字自動直排。「未通過驗證，只供參考」、模型判斷、整體模型限制 `globalCaveat` 與定投提醒預設可見。「機率與模型說明」是兩段之後的共用展開區，依下跌風險、上漲展望列定義與頻率（`outlook-dd5-definition`／`outlook-up-definition`、`outlook-dd5-frequency`／`outlook-up-frequency`），再列原有模型細節。`test12_Outlook` 驗定義、頻率預設收合，操作說明與兩個滾動驗證展開／收合；`test17_OutlookCaveatVisibleByDefault` 檢查可見限制。
- `outlook-readability`：`test21_ReadabilityPolish` 拍 `polish-<variant>-outlook-collapsed-*.png`、`outlook-model-collapsed.png`、`outlook-expanded-*.png`，小幅捲動覆蓋兩段摘要、警示及展開後兩段定義／頻率。使用同 ETF 的裝置／字級矩陣，逐張看文字、數字與 tab bar 邊界；只重驗展望時設定 `TEST_RUNNER_MO_POLISH_SCREEN=outlook`，跳過 ETF 與總覽。
- `outlook-expanded-reading`：`test25_OutlookExpandedReading` 用相同矩陣重拍展開區直到報酬分位數及長註腳（`outlook-quantiles`／`outlook-quantile-meta`）完整進入畫面，再捲到「差異」評估列，拍 `polish-<variant>-outlook-assessment.png`。評估列兩段文字完整換行，OCR 限定在該列像素範圍，檢查 AX 提供的區間上下限均可見且沒有省略號，結果存 `outlook-assessment-ocr.txt`。證據沿用 `polish-<variant>-outlook-expanded-*.png`。跨頁閱讀回歸 `test16_Readability` 以摘要標題等待資料，並確認定義只在展開後出現。
- `outlook-unvalidated`：`test24_UnvalidatedDrawdownWarning` 檢查 `drawdown.scored=false` 時，一般與最大字級的「未通過驗證，只供參考」在模型說明收合時仍可讀。若本機完整歷史資料算出 true，先備份並暫時移開 `prices` 中 SPX／VIX 早於 2025-10-01 的真實歷史資料，bump `data_version`，讀 API 確認 false 才跑；完成或失敗都還原資料並再次 bump 版本。這只是本機資料準備，不改模型門檻。

- `outlook-records-layout`（UX-01）：App 一般字級每筆紀錄首行顯示完整單行日期與機率，判讀、模型與結果分列。跑 `VerifyInteractionTests/testUX01_OutlookRecords`，兩台 MO 機逐張看 `UX-01-records.png`；日期不能拆尾碼，其他資訊須完整。

## How to get to it (user POV)

- 網頁：導覽列「下月展望」→ `/outlook`；總覽的展望卡片（右側箭頭）。
- App：「更多 → 下月展望」；總覽的下月展望區塊。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態（`web-up.sh` 跑過 `forecast` 與 `daily-reference`）、測試帳號登入。
- 站長先在 `/sources` 手動執行「展望相位平均」，確認執行紀錄 status ok；計算用本機合成或回補資料，不用試驗登記的固定數字。
- 驗證 R2-5 前，站長在本機 `/sources` 手動執行「重算下月展望」；新寫入 recent 列的版本應為 `2026-10-g09r1`。網頁 dd5 與 App「更多 → 下月展望」下跌風險區的驗證提示對 `outlook.drawdown.scored`；App「機率與模型說明」版本對 `outlook.modelVersion`。
- 驗證兩個紀錄面板前，只在本機 D1 新增至少 22 個交易日以前、位於 2025–2027 NYSE 日曆覆蓋內的 forecasts 已到期列，detail 帶 `recordedLagSessions` 與 `drawdown.p/base/modelVersion`：各一筆 lag 0 且 created_at 為當晚準時時間、lag 0 但 created_at 在下一交易日美東 16:30 之後、準時 lag 2、created_at='x'，另留無 detail 舊列；不回填既有列。PUB-1 以 created_at 的美東日期檢查覆蓋，再比較 `latestExpectedClose(created_at)` 與 trade_date；解析失敗、任一日期超出覆蓋或應有收盤早於 trade_date 均不明。bump `data_version` 後確認逾時 lag 0 不計入 n、兩句正式說明的 X／Y 分別等於各自 API 的 delayed／unknown，保存 `outlook-records.png`／`outlook-records.api.json` 與 `outlook-records-dd5.png`／`outlook-records-dd5.api.json`；App「更多 → 下月展望」兩區塊顯示同樣伺服器字串。依 L3-display.md §6 T3 的 VIX 暫存步驟讓 `outlook` 為 null，再確認網頁與 App 的 dd5 區塊仍顯示，驗完還原 VIX 並 bump 版本。

- **頁面。** `goto("/outlook")`，等 `text=下月展望`；`fetch("/api/v1/outlook")`，比 `pick.p`、`pick.base.p`、`drawdown.pick.p`；兩個 KPI 主數字各自對 `phaseSummary.dd5.mean`／`phaseSummary.up.mean`，日期、版本與區間也對 API。單一相位一行與滾動驗證面板各自對 `drawdown.evaluation`／`evaluation`（數字不能對調）。另在尚未計算的本機資料庫確認退回 offset 0 與「相位平均尚未計算」。截圖 `outlook.png`（整頁：`page.screenshot` 前捲動，或分段截）。
- **共識（網頁）。** 在「成分股分析師共識」逐卡對帳 `consensus.coverage`，再核對「本站反推」的目標價涵蓋率、SPX 收盤日、說明行的三種日期與 `noData` 檔數／權重。對照 `top[].priceDate` 與股價下方日期，檢查空列「Nasdaq 無資料」，並確認所有 `top[].asOf` ≥ UTC 今天減 7 天。逐列核對最低／最高＝`targetLow`／`targetHigh`，EPS 上修／下修＝`epsUp`／`epsDown`，會計年度／估計數＝`fiscalEnd`／`estimates`；缺目標價任一端點時沒有範圍行，EPS 0／0 顯示「沒有修正」、null 顯示「缺資料」。確認 EPS KPI 副標完整，按有修正次數的各檔先算比例、再按其持股權重平均並乘 100，數字等於 `consensus.revisionBreadth * 100`（四捨五入到整數）；表下有「成效未證實」與欄位口徑說明；390px 時 EPS 表頭與儲存格均隱藏，其他欄不破版，另留 `outlook-consensus-390.png`。留 `outlook-consensus.png` 與同次 `outlook-consensus.api.json`；本機沒有新鮮資料時驗證明確空狀態，數字對帳標「未驗證：缺 7 天內共識資料」；本機缺 0／0 或 null 案例時分別標示未驗證。
- **共識表桌機換行（網頁）。** 準備 12 列，含 `fiscalEnd: "Jan 2027"`、`estimates: 64`、四位數股價與「Nasdaq 無資料」列；「成分股分析師共識」與「投行年底目標價」兩個面板（`.outlook-views` 格線）在視窗寬度 ≥1088px 時並排兩欄，低於 1088px 時各自單欄全寬；「由下而上」面板在任何寬度都是全寬。依 `web/tests/outlook-consensus-layout.mjs` 的 1280／1100／1024／960／768／728／720／390 八種寬度，確認 `.table-wrap` 滿足 `scrollWidth === clientWidth`、`scrollLeft === 0`，整頁 `scrollWidth <= clientWidth`；除 390px 隱藏 EPS 欄外，其餘寬度的 EPS 表頭與各列完整位於可視範圍，表頭、年度／估計數及缺資料文字可換行。可在 `web/` 跑 `node tests/outlook-consensus-layout.mjs <證據目錄>`，用實際頁面 JSX 與 CSS 重現，留下兩組資料、八種寬度的截圖與 `metrics.json`；本機實例仍須依上段登入、點導覽並對 API。
- **共識（App）。** 「更多 → 下月展望 → 成分股分析師共識」，對同帳號 `/api/v1/outlook` 的三組 `coverage`、資料狀態與 footer 四種日期。展開「權重前 N 檔」，逐列核對目標價區間、EPS 次數、會計年度與估計數；另檢查 0／0 與 null 的兩種文案及舊回應缺欄位的省略行為。共識證據由整合驗收人工操作取得：

  1. 依 [verify 的 Launch／Drive](../SKILL.md)，在全域模擬器鎖內沿用本輪已開的 `MO iPhone 16 Plus`；首次啟動或換機才執行 `ios-up.sh <run-id> 16-plus`。`ios-up.sh` 只安裝 App；接著在同一個 shell 載入本輪本機站位址、建立證據目錄並啟動 App，再登入本機測試帳號、捲到共識區塊：

     ```sh
     RUN="${MO_VERIFY_ROOT:-$HOME/.cache/mo-verify}/<run-id>"
     source "$RUN/state.env"
     mkdir -p "$RUN/evidence/ios/16-plus"
     xcrun simctl launch "$(cat "$RUN/sim.udid")" com.audichuang.observatory -debugBaseURL "$BASE"
     ```

  2. 先截三項指標及資料狀態，再展開「權重前 N 檔」逐屏截個股列並捲到 footer。每屏用 `xcrun simctl io "$(cat "$RUN/sim.udid")" screenshot "$RUN/evidence/ios/16-plus/outlook-consensus-<階段>-<序號>.png"` 存圖，階段分 `summary`、`expanded`、`footer`。
  3. 最大 Dynamic Type 重走一次，階段加 `largest-`，實看所有新文字完整換行；以同帳號存下的 `outlook-consensus.api.json` 對帳，EPS 數字＝`revisionBreadth * 100`（四捨五入到整數）。缺對應案例時各自標「未驗證：缺 0／0、null 或舊回應案例」。
  4. 繼續下列 App 滾動驗證等本輪其餘步驟；整輪驗證結束後才依 [verify 的 Cleanup](../SKILL.md) 執行 `down.sh <run-id>` 一次。

  `test12_Outlook` 產出的是 `H1-outlook-summary.png`、`H1-model-*` 與 `H1-validation-*`，涵蓋摘要、模型與滾動驗證的展開收合；共識沒有自動捲動及展開，須另留上述人工截圖。

- **紅漲綠跌與圖例（網頁）。** 本機 forecasts 準備 call=up 的上線紀錄，bump data_version 後開展望頁，確認該列徽章是紅色（tone-pos）；call=down 為綠色（tone-neg）。設 viewport 390px，機率條下四項圖例均可見並截圖。
- **App。** walkthrough 的 `08-outlook.png`、`08b-outlook-more.png`。
- **上漲機率紀錄（App，V1／V2b）。** 沿用上方紀錄資料準備，從「更多 → 下月展望」捲到「上線後實際紀錄：上漲機率」，逐筆核對 API `recent` 前 8 筆的日期、上漲機率、判讀、模型與結果。一般字級維持橫排；輔助字級改為每筆直式依序顯示日期、「上漲機率」及其數值、判讀（「高於平常／低於平常／偵測不到預測力」）、模型（「模型 {版本}」，缺版本為「模型 舊版紀錄」）、結果（「後來上漲／後來下跌／待到期」）。最大輔助字級須逐屏查看所有欄位完整、不截字或互相擠壓，模型列在 `liveTrack` 存在時顯示。捲到 footer，確認既有說明後換行完整顯示 API `liveTrack.note`：即時發布資格、下一交易日美東 16:30 時限、延遲補記與資格不明計數及不計分說明逐字一致，X／Y 分別等於 `liveTrack.delayed`／`unknown`。保存 `outlook-records-app-normal.png`、`outlook-records-app-largest-<序號>.png`、footer 截圖、畫面文字與同次 API JSON；以實看截圖確認 note 全文可見，不能只查無障礙樹。
- **App 滾動驗證。** 在全域模擬器鎖下用 `ios-test.sh` 跑 `VerifyInteractionTests/test12_Outlook`，確認 dd5 與上漲兩個區塊都可展開、收合；上漲驗證展開後不含「命中率」。核對 `H1-validation-up-expanded.png` 與 `H1-validation-up.txt`，dd5 區塊維持原樣。
- **總覽入口與預測日期。** 依 [總覽的展望資料日與待更新驗證](overview.md#driving-it-with-ego-browser--xcuitest) 準備同日與落後兩種狀態；核對卡片資料日、標籤與說明後，網頁及 App 各從總覽卡片進入下月展望。卡片機率對 `/api/v1/overview` 的已存 forecast，展望頁機率對 `/api/v1/outlook` 的即時計算，不要求兩者數字相等；驗完還原本機 forecasts 與 data_version。
- **無法產生展望。** 僅在本機 worktree D1，先確認沒有 `verify_held_vix`，暫停 prices 工作，執行 `CREATE TABLE verify_held_vix AS SELECT * FROM prices WHERE symbol='VIX' AND date > (SELECT date FROM prices WHERE symbol='VIX' ORDER BY date DESC LIMIT 1 OFFSET 5); DELETE FROM prices WHERE symbol='VIX' AND date IN (SELECT date FROM verify_held_vix);` 並 bump `data_version`。兩端從導覽入口進入下月展望，確認同句「VIX 最新只到 …落後 5 個交易日…超過 3 個交易日的上限」，App 為橘色 Notice；網頁「上線後實際紀錄」與 App「實際發出的預測／上線後實際紀錄」仍在。儲存 `outlook-unavailable.png`、`outlook-unavailable.api.json` 與 App 截圖，對帳 `outlook === null`、`outlookUnavailable.reason === "vix-stale"`、兩個日期、落後天數及 `recent` 筆數。驗完執行 `INSERT INTO prices SELECT * FROM verify_held_vix; DROP TABLE verify_held_vix;` 再 bump，確認兩端正常版面與 `outlookUnavailable === null`，App 再跑 `test12_Outlook`。iOS 操作須持有全域模擬器鎖並重用既有 MO 裝置，依本輪整合流程執行。
- **Proof。** `outlook.png`、`outlook.api.json`、App 兩張截圖。

## Gotchas

- 本機的 FactSet 與分析師共識只有 `daily-reference`、`news` 排程當次抓到的（分析師每次輪替 16 檔），區塊內容比正式站少是正常的。
- 模型定義改動要走 `web/docs/forecast.md` 的事前登記（`web/AGENTS.md`），驗證只看呈現，不改門檻。
- 現行模型版本為「2026-10-g09r1」；recent 舊列維持寫入時的版本與判定，不重算。
- 策略師表的數字是人工維護的常數（`web/src/lib/strategists.ts`），本機與正式站相同；「待重新核對」依當天日期算，多數列被標是維護提醒，不算 fail。
- 「偵測不到預測力」（總覽卡片與此頁、網頁與 App 都有）是展望模型的狀態（樣本外沒有預測力，對應 API `call: "inconclusive"`），畫面上不該出現英文 skill。
