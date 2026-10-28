# R2：工程可行性、相依與優先序複查

## 1. 總評

這份方向可作為待辦候選清單，尚不能直接照排序執行。最大問題是整合時省略了查核已指出的交付前提：P0 的「即時發布」資格仍會納入停更後的舊資料，API 與私人資料的相容／隔離要求沒有落入方向，AI 批次則只要求留存、沒有要求修正假成功。應先補這些完成標準與相依，再做新面板、帳本及換源；現有證據不足以把合成重現寫成正式事故，也不足以要求立即重建排程架構。

## 2. Findings 表

以下證據路徑一律相對於 **repo 根目錄**；嚴重度評的是照現稿交付的風險，不代表正式站已發生事故。

| # | 嚴重度（高／中／低） | 報告位置（章節與條目編號） | 問題 | 證據（檔案:行號或網址） | 建議的具體改法（寫出要改成什麼） |
| --- | --- | --- | --- | --- | --- |
| 1 | 高 | §5 A-01／B-03；§6 P0 #3、#4 | 「存生成時間、只計即時列」仍沒有可執行的發布資格。`created_at` 其實已存；真正缺的是與市場應有交易日／發布時限的比較。`recordedLagSessions=0` 只代表 DB 最後一列，停更一週後補寫仍可能符合現行 R2-6。V-A、V-B 已明列這個反例；R2-6 又只規範 dd5，不能直接代替 P(up) 的新資格。#3「併入 R2-6」與 #4「規則內文不動」也欠缺修訂方式。 | `web/src/server/jobs.ts:520`、`:546`、`:554`；`web/src/server/outlook.ts:63`；`web/docs/research-2026-10-28/verify/V-A.md:49`、`:75`；`web/docs/research-2026-10-28/verify/V-B.md:59`；`web/docs/forecast.md:120`、`:149` | #3 改成：「先新增並合併發布資格修訂條目，分別規範 up／dd5 的可接受發布時限、交易日對齊、資格不明舊列與固定格線；不回改 R2-6 原文或 forecasts 舊列。之後才實作 #4 的前瞻分數。」驗收加入「DB 最新日落後應有收盤日、lag=0」的合成 fixture，確認它不會成為即時實績，並保留排除原因與數量。 |
| 2 | 高 | §6 P0 #3～#7、P1 #8～#11、P2 #20 的資料契約 | 方向會擴充或調整共用 view／API，卻沒有舊版 iOS 解碼新回應的交付條件。這不是只同步修改最新版 Codable 即可：既有 `Plan` 七個欄位、`Pick.p/base`、`Drawdown.scored` 等有必填值；重命名規劃欄位、把單一 liveTrack 改成版本陣列或直接替換既有 evaluation 語意，均需要先定相容方案。現有 fixture 測試主要用目前模型解碼舊／新 fixture，不能自行證明已發布舊模型可讀新 payload。 | `AGENTS.md:4`；`ios/MarketObservatory/Models.swift:336`、`:417`、`:447`、`:503`；`ios/MarketObservatoryTests/FixtureDecodingTests.swift:15`；`web/docs/research-2026-10-27/codex-review.md:115`；`.claude/skills/verify/SKILL.md:12` | §6 增加共同前置條款：「既有必填欄位與型別保留；phase summary、dd5 分版本紀錄、帳本與時間 metadata 用新增欄位／端點表達。新 App 以 optional 接新欄位；另凍結已發布舊 Codable 解碼新 payload。」每次 view 變更跑 `node --test tests/api-contract.test.ts`、檢查 fixture diff、跑 Swift 解碼與雙端實際操作；UI 移除命中率不等於刪 API 欄位。 |
| 3 | 中 | §5 J-01；§6 P1 #12，與 P0 #7、P1 #13 的先後 | #12 把 J-01 縮成「不可覆寫＋寫入回執」，漏掉會讓排程完成狀態失真的三個已核實分支：missing／skipped 仍 exit 0、已刪 news id 仍累計 points、daily precheck 看不到仍待翻譯的工作。只保存目前回傳計數，仍能存下一張錯誤的成功回執；後續 heartbeat 的「最後成功日」也會跟著誤判。另有 translate 排程可能稍後處理，因此不能宣稱翻譯必然永久漏失。 | `web/scripts/ai-batch.ts:221`、`:232`；`web/src/server/ai-batch.ts:79`、`:177`、`:178`；`web/docs/research-2026-10-28/verify/V-J.md:14`、`:15`、`:16`；`web/docs/research-2026-10-28/results/J-pipeline-skills.md:165`、`:167`、`:169` | 從 #12 拆出 P0「批次成功判定與不可覆寫」：receipt 分 expected／實際 accepted／missing／rejected／source unavailable，對 DB 命中或讀回核對；partial 不得記為整批成功，明訂 CLI 狀態與 precheck 的 idle 慣例。daily 應先檢查翻譯依賴。用上述三情境及第二次 pull 不清空前批的合成測試驗收；完整 manifest 與獨立 heartbeat 可留 P1，#13 再依此建立可追溯樣本。 |
| 4 | 中 | §5 缺口選取；§6 P0／P1 排序，尤其 #8～#10 | 「先讓已顯示的數字正確」沒有完整落到排序。A-07 的舊 forecast 可出現在最新快照卡片而不標預測日期；A-11 的定投首筆／FX 文案、A-12 的圖表與表格起點不一致，都已核實卻未進方向。#8 又把既有錯誤涵蓋率與新增 high／low 等擴充一起留到 P1，沒有拆出先修部分。它們不是尚待研究的新指標。 | `web/docs/research-2026-10-28/verify/V-A.md:21`、`:25`、`:26`；`web/src/server/views.ts:77`、`:109`、`:169`、`:183`、`:299`、`:303`；`web/src/lib/analytics.ts:158`；`web/src/lib/consensus.ts:48`；`web/docs/research-2026-10-28/report.md:157`、`:175` | 補 P0「首頁預測明列資料日；與快照不同日標待更新，不冒充當日」及 #8 的「各 KPI 有效分母／一致 freshness／空列與來源失敗狀態」修正；新增欄位擴充留 P1。把 A-11、A-12 列為 #9／#10 前的既有試算修正：固定首個不完整月政策、揭露 FX 實際取值日、統一圖表／統計 anchor。均可用合成日期與價格對照 API／畫面，不跑新市場統計。 |
| 5 | 中 | §6 P1 #10、#11；P2 #20 | 帳本、成本假設與研究筆記都是每人資料，但方向未定使用者歸屬、讀寫路徑及快取邊界。現有 `notes` 只是可覆寫的 2000 字欄位，沒有逐次歷史；現行 ETF view 特別把 plan 放在共用快取外、從主庫讀。若把新帳本直接加進同一個 cachedPage 結果，快取鍵沒有 user，便會產生跨帳號資料問題。這是新功能必須遵守的現有契約，並非指控現在已洩漏。 | `web/AGENTS.md:27`、`:28`；`web/src/server/views.ts:254`、`:257`、`:272`、`:279`、`:311`；`web/src/server/page-cache.ts:33`、`:36`；`web/docs/research-2026-10-28/verify/V-F.md:58` | #11／#20 前先決定「只試手動模板」或「新增有 user ownership 的歷次紀錄儲存」；後者才估含 migration、API、雙端編輯的成本。個人假設與帳本在快取外組裝並經既有 gate 讀寫，共用計算才可快取。完成標準加入 A／B 帳號交錯讀取、寫後從另一端讀回、保留前次理由；不能把單一 notes 欄位驗收成修改歷史。 |
| 6 | 中 | §6 P2 #16；「新增或替換的資料」日線列 | 換源前提只列授權，漏掉 E-02 的價格語意與完整來源範圍。現在 `close` 的程式契約是拆股調整、不含股息，Tiingo 的 raw 與股息調整價不能任選其一直接接上；現有 Yahoo 清單還含 `TWD=X`、`^GSPC`，個股／ETF 合約不保證涵蓋它們。V-E 另已指出，保留權詢問須列到「被核對的既有資料集」，否則既有凍結輸入／不可改紀錄的存續條件仍不清楚。 | `web/src/lib/sources/yahoo.ts:25`；`web/src/lib/universe.ts:60`；`web/docs/research-2026-10-28/results/E-data-sources.md:267`、`:269`、`:270`、`:277`；`web/docs/research-2026-10-28/verify/V-E.md:15`、`:69`；`web/docs/forecast.md:169` | #16 改成：「Tiingo 優先詢價；契約與資料規格驗收後才選型遷移。列出股票／ETF／SPX／VIX／FX 每類去向，固定 raw／split-only／dividend-adjusted 對照、公司行動、日界、可得時間與更正政策；書面保留權列明 raw、衍生、既有被核對資料、快照與備份。」用人工拆股／除息 fixture 驗 adapter，分開供應商 quota 與 Worker Budget；缺 FX 或指數方案時明列殘留依賴，不稱全部 Yahoo 日線已移除。 |
| 7 | 中 | §6 P2 #22 的前提欄 | 「口徑與過去表現標示」不足以交付兩種新值。D2-13 要的是略過最近月的含息表現及同期 SPY 含息基準，現在管線明定不含息；D2-12 的 GP/A 需要可對齊的 revenue、COGS、assets，缺 COGS／金融業還有不可比較情況。單靠現有價格或 #17 的申報連結，不能認定原始資料已齊。 | `web/docs/research-2026-10-28/results/D2-stock-signals.md:169`、`:171`、`:173`、`:175`；`web/src/lib/sources/yahoo.ts:25`；`web/src/lib/sources/http.ts:90`；`web/docs/research-2026-10-28/report.md:194` | #22 拆成兩列並補相依：「含息過去表現：先有獲授權且含公司行動的 total-return series 與 SPY 同口徑基準；若只做價格報酬，明確改名且不稱 D2-13 重製。GP/A：待 #17 或另一已確認財報源提供同口徑欄位、期別與發布時間；缺值／金融業顯示不可比較。」用合成配息、拆股、缺 COGS、跨期資料驗收；不新增市場績效研究。 |
| 8 | 中 | §6 全部方向的完成條件；P1 #15 的 verify 修正排序 | 除 #1 提到測試外，§6 沒有共同驗收門檻，也未把部署約束帶入新來源與批次改動。現行規則要求完整 SCHEDULES 共用額度驗證、雙端畫面與功能地圖；Orca 又依賴主 checkout 分支、絕對路徑及 translate／daily 協定。verify 的建／刪模擬器修正被放在 P1，但 P0 已包含 iOS 改動，不能等到 P1 才處理驗收入口。單列「有回歸門檻」也尚未決定何時阻擋正式寫入。 | `web/AGENTS.md:22`、`:25`、`:30`；`web/src/server/jobs.ts:43`、`:770`、`:783`；`AGENTS.md:8`、`:10`、`:11`；`.claude/skills/verify/SKILL.md:14`、`:18`、`:51`、`:233`；`web/docs/research-2026-10-28/results/H-llm-evidence.md:188`、`:198` | §6 加共同完成條款：受影響功能的合成測試、typecheck、API 契約、網頁／iOS 操作證據及功能地圖更新；抓取部署後以整支 `/api/admin/cron?name=` 核對各工作 status／subrequests，包含轉址、重試、6 連線與供應商限額。AI 在 worktree 開發、主 checkout 保持可跑版本；改 CLI／路徑時同步 Orca precheck／prompt。#13 凍結金標、重大錯誤與涵蓋門檻，明訂發布前阻擋。verify 生命週期修正提前到首個 iOS P0 驗收前，或明訂照 AGENTS 手動重用／shutdown 的替代路徑；新三個 skills 可留 P1。 |
| 9 | 低 | §5 A-14、A-08／A-10／J-07 的位置；§6 P0 #4 | A-14 的來源 ID 被換了問題：原研究 A-14 是 forecast「現行設計」仍寫硬切換、與 shrinkK 實作不符，V-A 還指出文獻更正未落實；報告卻只拿它指第二輪「草稿」標題，#4「只改標題」便漏了原缺口。此外，報告宣告路徑相對 web，但 `ios/...` 與 `.claude/...` 實際在 repo 根，A-13 則沒有位置。這會妨礙逐條派工與追溯。 | `web/docs/research-2026-10-28/results/A-judgment-audit.md:66`；`web/docs/research-2026-10-28/verify/V-A.md:28`；`web/docs/forecast.md:7`；`web/src/lib/forecast.ts:306`、`:310`；`web/docs/research-2026-10-28/report.md:3`、`:149`、`:151`、`:152`、`:153`、`:166` | 第二輪標題另編 DOC ID；A-14 恢復「更新現行設計為 k=40 收縮、distinct 另供方向閘門」，未落實的文獻更正列為待核文件工作，不宣稱已重新讀過原文。報告路徑規則改成「預設相對 web，ios／.claude 相對 repo 根」；A-13 補 `web/src/lib/snapshot.ts:252`、`web/pages/index.tsx:75`、`ios/MarketObservatory/Views/OverviewView.swift:323`。 |

已檢查、無問題：§5 B-01 的參數超限引用與「合成重現、正式站未查」限定；B-02／B-11 的 granularity／空重抓解除 pending 路徑；B-06 的 expected 分類；B-05 的品質未攔推播與同日去重描述；A-02／A-03「已登記待實作」的定位；A-08／A-10 的 iOS 字句事實；J-07 的模擬器規則衝突本身。

已檢查、無問題：#1 的 SQL 分塊方向、#2 的不插假價原則、#4 引用 R2-4／R2-5／R2-6 的登記依據、#5 的中性用語、#6 的先決定推播降級政策、#9 靜態 ETF 事實卡、#10 非歷史成本情境、#14 授權清冊與停用開關、#17 的 UA／出口前提、#18 的先確認持股使用權、#19 的事件日期不進機率、#21 先建立內容評估。這些方向可保留；仍須套用表中的共同交付條件。

## 3. 檢查過的範圍清單

### 審查界線與基準

- 程式基準：本機 HEAD `99066fd3ad63ec7b040f6fd447f255b2d3c3964a`。已讀根目錄與 web 的 AGENTS；兩層均無 `.codegraph/`，因此直接讀 source。
- 已核對 `955d8d3` 為 2026-10-28 08:37:20 +0800 合併 commit，且是本機 main 的 ancestor；「草稿」標題不會推翻 `forecast.md:118` 的合併生效條款。
- 主查報告 §5 所有 15 列、§6 #1～#22 與新增資料表；連帶讀 §1、§2、§4、§7、§10，確認沒有在其他地方補齊上述缺口。
- 規則對照：`web/docs/forecast.md:5`、`:43` 起第一輪登記、`:116`～`:180` 第二輪；`web/docs/research-2026-10-27/proposal.md:403` 起 §6；`codex-review.md:19`～`:36`、`:96`～`:140`。第二輪優先於舊 proposal 的 EWMA／自動組合重開文字。
- 本次只做文件與程式靜態查核；未跑回測、未探索市場歷史、未操作正式 DB／推播／Orca、未改排程或程式。未逐字重審 `logs/` 的外部研究過程；需要的研究主張以指定 results／verify 及目前 source 交叉核對。本文唯一寫入是指定審查檔。

### §5 每列的程式引用

| 報告列 | 實際核對的檔案與位置 | 核對結果／證據邊界 |
| --- | --- | --- |
| B-01 | `web/src/server/repo.ts:44`、`:144`、`:172`；`web/docs/research-2026-10-28/results/B-data-pipeline.md:119`；`web/docs/research-2026-10-28/verify/V-B.md:13` | 三個 SELECT 均未分塊，與綁定參數說明一致；另有 `repo.ts:204` 權重 anchors 的同根因查詢，#1 實作應一起涵蓋。未測正式超限事故。 |
| A-01／B-03 | `web/src/server/jobs.ts:515`～`:562`；`web/src/server/outlook.ts:42`～`:64`；`web/docs/research-2026-10-28/verify/V-A.md:15`、`:49`、`:75`；`web/docs/research-2026-10-28/verify/V-B.md:16`、`:59` | 已有 created_at 與 lag，讀取／計分未使用；發布資格另有 finding 1。 |
| B-02／B-11 | `web/src/lib/sources/yahoo.ts:13`～`:54`；`web/src/server/jobs.ts:114`～`:123`、`:174`～`:190`；`web/src/lib/rebase.ts:32`～`:39`；`web/docs/research-2026-10-28/verify/V-B.md:14`～`:15` | parser 沒有 granularity 閘門，空陣列可走 fulfilled；recovered 名單直接刪 pending。未把合成 3mo 說成正式站正在用 3mo。 |
| A-02 | `web/src/lib/forecast.ts:611`、`:625`、`:748`；`web/docs/forecast.md:148`；`web/docs/research-2026-10-28/verify/V-A.md:16` | 新 cell gate 尚未接 scored；舊實作符合原 G09，不能稱原來寫錯。 |
| A-03 | `web/src/lib/forecast.ts:528`、`:721`、`:725`；`web/src/lib/forecast-eval.ts:146`、`:172`；`web/docs/research-2026-10-28/verify/V-A.md:17` | runtime 用單相位，離線有 phase average 函式；R2-4 主報與 offset 0 gate 要分開。未量測 21 相位上線成本，不能據此宣稱必超時。 |
| A-04／H-01 | `web/src/lib/sources/nasdaq.ts:106`～`:123`；`web/src/server/ai-batch.ts:91`、`:103`、`:125`；`web/docs/research-2026-10-28/verify/V-A.md:18`；`web/docs/research-2026-10-28/verify/V-J.md:18` | 只存日期、daily 以日期等值選取，market 只有標題。未證明正式文章曾用盤後消息倒置因果，也未證明每則上游都有可信時間。 |
| A-05／A-06／B-04 | `web/src/lib/consensus.ts:30`～`:75`；`web/src/server/outlook.ts:69`～`:84`；`web/src/server/jobs.ts:645`～`:657`；另核對 `web/src/lib/sources/nasdaq.ts:224`～`:229` | 分母、top freshness、價格／權重日缺口成立；EPS catch 實際在 nasdaq adapter，報告 jobs 行只證明同日覆寫。 |
| B-06 | `web/src/lib/sources/nasdaq.ts:63`～`:76`；`web/docs/research-2026-10-28/verify/V-B.md:20` | expected 不在 estimated regex 內；只是來源確認狀態錯分類，不據此判公司究竟是否已另行公告。 |
| B-05 | `web/src/server/push.ts:182`～`:211`、`:230`～`:246`；`web/src/lib/push.ts:42`～`:75`；`web/docs/research-2026-10-28/verify/V-B.md:18`～`:19` | 日期／數字非空是現有條件，未攔 quality；同使用者同日 claim 保留後不因 revision 自動更正。APNs 接受不等於裝置送達，報告已避開該被推翻主張。 |
| J-01 | `web/scripts/ai-batch.ts:194`～`:234`；`web/src/server/ai-batch.ts:170`～`:198`；`web/docs/research-2026-10-28/verify/V-J.md:13`～`:17` | 固定批次覆寫與只印 missing／skipped 成立；當輪尚未覆寫的 tasks 仍保留 prompt，不能說任何輸入都已無法還原。 |
| A-08 | `ios/MarketObservatory/Views/MoreView.swift:589`～`:591`；`web/src/lib/forecast.ts:513`；`web/docs/research-2026-10-28/verify/V-A.md:22` | iOS 字句與以 0.5 計 hitRate 的 source 對得上；路徑根目錄例外見 finding 9。 |
| A-10／C-04 | `ios/MarketObservatory/Views/MoreView.swift:254`；`web/src/server/views.ts:244`～`:259`；`web/docs/research-2026-10-28/verify/V-A.md:24` | 文案超出純檢討語意；現有欄位沒有自動出場引擎。 |
| A-13 | `web/src/lib/snapshot.ts:252`；`web/pages/index.tsx:75`；`ios/MarketObservatory/Views/OverviewView.swift:323`；`web/docs/research-2026-10-28/verify/V-A.md:27` | 單位為百分點，非數值尺度錯誤；報告缺程式位置，見 finding 9。 |
| J-07 | `.claude/skills/verify/SKILL.md:51`、`:233`；其 `features/README.md:7`、`:10`；`scripts/ios-up.sh:11`、`scripts/down.sh:13`；`AGENTS.md:8` | 建／刪衝突確實存在；已有 README 手動重用替代，並非 P0 完全無法驗收。 |
| A-14（報告所用） | `web/docs/forecast.md:116`～`:124`；`web/docs/research-2026-10-28/results/A-judgment-audit.md:66`；`web/docs/research-2026-10-28/verify/V-A.md:28` | 標題問題存在且已合併，但不是研究 A-14 的問題，見 finding 9。 |

### §6 #1～#22：來源、相依與可驗收性

以下「完成檢查」是審查要求，並不聲稱報告已有這些規格或本次已執行測試。

| 條目 | 對照過的來源／現行位置 | 相依與完成檢查 |
| --- | --- | --- |
| #1 | B-01、V-B #1；`repo.ts:44`、`:144`、`:172`、`:204` | 所有 IN 路徑各自扣除其他參數空間；fake D1 加 bound-parameter 上限檢查，驗全站聯集＋多股類及結果完整性。分塊會增加 statement 數，也要驗整支排程。 |
| #2 | B-02／B-11、V-B #2～#3；`yahoo.ts:28`、`jobs.ts:184`、`rebase.ts:32` | 人工 granularity／空表／短覆蓋／衝突日 fixture 不落庫，pending 保留；完整區間才解除。不變更已凍結試驗輸入或補假交易日。 |
| #3 | A-01／B-03、V-A #1／§4、V-B §4；`jobs.ts:515`、`outlook.ts:63` | 先合併發布資格新條目，再驗即時／延遲／未知／停更四種分類、不可覆寫與輸入版本。見 finding 1。 |
| #4 | A-02／A-03；`forecast.md:147`～`:149`、`:180`；`forecast.ts:611`、`forecast-eval.ts:172` | 依 R2-5 升版本、列 a～d 失敗原因、不回算舊列；依 R2-6 分版本與固定格線；相位平均另加摘要，不改 offset 0 gate。若日後要執行名額 A，仍須先完成 R2-3a 合成方法檢查、reference／輸入 hash 登錄，不能把 #4 當成全部研究前提。 |
| #5 | A-08／A-10、C-04；`MoreView.swift:254`、`:589`；V-A #8／#10 | 兩端文字、編輯／存後讀回；只移 UI 列、保留舊 API。幣別與錨點未決時維持純備忘。 |
| #6 | B-05／B-06、V-B #6～#8；`nasdaq.ts:73`、`push.ts:230` | expected／estimated／confirmed fixtures；先決定 mismatch／pending 是等候或標籤，分別驗摘要及 bigMoves。更正重送不是現稿明確要求，不擅加；不宣稱裝置送達。 |
| #7 | A-04／H-01／J-02；V-A #4、V-J #6；`nasdaq.ts:106`、`ai-batch.ts:91` | 先保留 raw 時間／時區與 unknown；新增時間時須維持或明確遷移既有按日選取契約，不能把 published_at 換成 timestamp 後仍做 `= YYYY-MM-DD`。驗盤前／盤後／未知時間的選取與文字；逐句出處還需可留存的來源 packet。 |
| #8 | A-05／A-06／B-04、D1-01～03、D2-11；V-A #5～#6、V-B #5、V-D1 §2～§4、V-D2 #11 | 現有錯誤與新展示拆批。驗各分母、空／無修正／EPS 失敗、共同 freshness、價格日／權重日；四週計數不等於分析師人數占比。新欄位擴充仍先過 #14 的授權範圍查明。 |
| #9 | C-01／C-02、V-C §2；`universe.ts:28`、`:45`；`analytics.ts:157` | 產品資料附來源與有效日；期初比較說清楚資金已備妥。先補 A-11；一般 1x ETF 文獻不自動涵蓋目錄內槓桿／反向產品，這點 V-C §4 已提示。 |
| #10 | C-03／C-07、V-C §2；`views.ts:294`；`analytics.ts:153` | 純假設計算與歷史 DCA 分開；成本／基金內外稅層分清，避免重扣 NAV 已含費用。人工案例驗算、兩帳號隔離、附法規版本與適用身分，不宣稱稅後歷史排名。 |
| #11 | C-05／C-06、V-C §2、V-F #F-05；`views.ts:254`、`:257`、`:272` | 先定每人帳本／修改歷史的儲存契約；雙端輸入與讀回、使用者隔離、無行情觸發。見 finding 5。 |
| #12 | J-01、F-01、H-04、B-08；V-J #1～#5、V-B #10；`scripts/ai-batch.ts:194` | 先修假成功／覆寫，再驗每 accepted 結果追到 run／輸入／來源版本。未知實際模型標 unknown；獨立觀測端才能偵測 Mac 停機，不能只由 Mac 自報心跳。Orca 路徑／branch 前提見 finding 8。 |
| #13 | J-03／J-06、H-05／H-03、F-02、G-05；V-J #7、V-H §2、V-G §2 | #7 的來源 packet 與 #12 的追溯先到位；凍結 gold／holdout、盲評及拒答／遺漏規則，定發布前門檻。離線 runner 不可直接 import 會登入／push 的 CLI（H:188）。此工程不需要市場登記，但也不授權市場計分。 |
| #14 | B-09、V-B #12～#15；E 與 V-E、V-D1 §4 | 每源用途與許可證據、未知範圍、停用後資料／畫面狀態可驗；清冊完成不等於取得許可。停用不可默默銷毀 G02 ledger 或凍結輸入。 |
| #15 | J-04～J-07、V-J §2／§5；verify SKILL 與 scripts | 模擬器修正／明確替代入口先於 iOS P0 驗收；三個新 skills 維持低成本草稿，驗 transcript、逐列來源與月抽查產物。不能以建了 skill 代替執行或證明效果。 |
| #16 | E-01／E-02、V-E #1～#4、§4；`universe.ts:60`、`yahoo.ts:25`、`jobs.ts:630` | 授權／保留權、價格調整、涵蓋、供應商可得時間與配額、Worker 整支排程共同驗收，見 finding 6；詢價不是已完成供應商品質排名。 |
| #17 | E-03／E-09、V-E #6／#14；E:272～277 | UA 與預定 Worker 出口連通性尚待實測；少量增量進 Worker，全量 ZIP 留本機；accession／接受時間／取得版本可回原文，不把最新 frames 當歷史 PIT。 |
| #18 | E-04、V-E #9～#10 | 確認使用權、獨立 CSV adapter、基金／as-of／首次取得時間；IVV CSV 不能直接餵 SPY XLSX parser。最新檔 schema 核對可先做，歷史點數誤差另登記。 |
| #19 | E-06、V-E #13；前輪 codex-review N-06 | 403 只核實本機 ICS 失敗；HTML 也須先驗預定出口。解析日期／時區／修訂、UI 及事件推播稱呼對帳，不把所有總經事件叫 FOMC。 |
| #20 | D1-05、F-05、G-03；V-D1 §2、V-F §5、V-G §2 | 先手動模板亦可；如要逐次歷史則先定儲存與使用者歸屬，不能把 notes 覆寫欄位當已有版本史。見 finding 5。 |
| #21 | H-06／H-07、J-08；V-H §2、V-J §5 | #13 是必要前提；只限離線試辦、來源與缺口可定位，不產生淨多空／部位。新增常態化排程前還需確認資料權與現有 translate／daily 承載方式，不能只因工具模板存在就常態上線。 |
| #22 | D2-12／D2-13；D2:169～175；`http.ts:90`、`yahoo.ts:25` | GP/A 與含息表現的原始資料／會計口徑是獨立前提，見 finding 7；若改做純價格表現，須明寫產品範圍，不挪用研究定義。 |

### 未作成事故／擴架構 finding 的項目

- **D1 容量與備份**：B-10／V-B 說明了平台上限與缺少量測，但沒有正式 database_size／成長／還原結果；可先量測，不據此聲稱即將滿庫或要求 P0 分庫。
- **Workers／推播規模**：目前 `SUBREQUEST_BUDGET=1000`（`web/src/server/jobs.ts:43`），完整排程共用一份 Budget；不能誤用 Free 50 的上限判定目前不能做。未取得裝置數／實際 skip 規模，不要求現在導入 queue。新源另有供應商配額，仍需驗收。
- **相位平均成本**：已確認 runtime／離線路徑差異，未做效能量測；報告「中」是規劃估級，不是已量到可在 Worker 冷快取計算的保證。實作時須決定計算位置、資料版本快取及量測，不能僅憑靜態呼叫就宣稱超時。
- **成本估計界線**：#1／#2／#3／#8／#12／#13 的「中」與原研究粗估相容，但本輪無人時或報價資料可獨立確認。#11 的成本須待儲存範圍決定；#15「低」限 skill 編寫，不包含每月人工維護；#16～#22 只有前提、沒有完整成本估計，不能與 P0／P1 的成本欄直接相比。
- **實際驗收**：本輪沒有交付使用者行為變更，故未啟動網站／App／verify。正式事故頻率、付費 key 的涵蓋／延遲、Worker 出口連通、實際 AI 輸出品質與舊 TestFlight 二進位讀新 payload 均未驗證；這些是各實作條目的後續驗收，不是本審查已取得的結果。
