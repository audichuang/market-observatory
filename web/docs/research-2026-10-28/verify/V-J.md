# V-J：任務 J 研究結果獨立查核

查核日：2026-10-28。先讀 `prompts/J.md`，再從 `results/J-pipeline-skills.md` 的「給整合者的摘要」與 J-01～J-08 建議追到正文，選出以下 15 條關鍵主張。判定計數：**已核實 12／部分 3／被推翻 0／無法核實 0**。這是被選主張的計數，不表示報告所有細節都已驗證。

程式來源為本機 commit `99066fd3ad63ec7b040f6fd447f255b2d3c3964a`；與原報告所列版本相同。表中「原報告」均指 `web/docs/research-2026-10-28/results/J-pipeline-skills.md`。除了本檔未寫入其他 repo 檔案；未呼叫正式站 admin、未讀正式 D1、未跑市場歷史回測或探索統計。工程反證只使用原始碼、記憶體 SQLite 與 stub，未啟動排程或模型。

外部文件親自開啟官方頁面／論文原文；GitHub 只用 `gh repo view` 與 `gh api`，共 **6 次**，未使用 agent-reach 的 X／GitHub 管道。Orca 只讀 `automations list` 的設定與 usage，不以 completed 當作寫入證明。

## 1. 主張查核表

| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
|---|---|---|---|---|---|
| 1 | J-01：再次 pull 同 kind 會覆寫既有答案與任務。 | :74、:159–169、:314、:328 | 已核實 | `dir` 固定為 `.ai-batch/<kind>`；pull 無條件執行 `writeFileSync(...answers.json, "{}\n")`，也覆寫 tasks。嘗試找存在檢查／備份，未見；`existsSync` 只用在 push 找 tasks。把原始尾段放入記憶體檔案 stub 重播，第二次空 pull 後答案確為 `{}`，即使 `--check` 最後 exit 1 也已清空。 | `web/scripts/ai-batch.ts:22`、`:194`、`:199`、`:200`、`:210`。 |
| 2 | J-01：缺答案或 parser 略過不必然讓 push 失敗；completed 不代表全部匯入。 | :75、:167、:314、:328 | 已核實 | 缺答案只加進 `missing`；HTTP 成功後只印 missing／skipped，沒有依其內容設定非零 exit。重播一個缺 `m1`、另一個空 points 被略過的情境，輸出「寫入：翻譯 0 則、文章重點 0 則、每日重點 0 則；沒有答案：m1；略過：重點 n1：格式不對」，exit 0。反證邊界：HTTP 非成功會 throw，外層 Zod 也驗格式，所以這不是「所有錯誤都成功」。Orca 當前兩項 usage 的 `lastRunStatus` 均為 completed，但沒有逐任務 receipt。 | `web/scripts/ai-batch.ts:61`、`:68`、`:221`、`:232`；`web/src/server/ai-batch.ts:139`、`:201`；`web/routes/api/admin/ai.ts:18`。Orca IDs：`08e79897-22c8-4835-af38-9d0140417a5e`、`b5c65aa3-c7ca-46b6-b3c6-be429c1444e5`。 |
| 3 | J-01：daily precheck 可能忽略仍待翻譯的新聞，讓 daily agent 內的補翻譯步驟不啟動。 | :45、:73、:167、:328 | 已核實 | Orca daily precheck 確為 `pull daily --check`；agent prompt 第一步卻是 `pull translate`。合成 D1 中，先替最新快照的全部追蹤公司與 SPX 寫入 digest，再放一則未翻譯、`focus=null` 新聞，結果 `translationPending=1, points=0, digests=0, market=null`。因此 buildTasks 為空，check exit 1。反證邊界：另有每四小時的 translate 排程，可能稍後處理；這只能證明 daily 依賴判斷不完整，不能證明翻譯永久漏失。 | `web/src/server/ai-batch.ts:60`、`:79`、`:88`、`:109`；`web/scripts/ai-batch.ts:131`、`:201`；Orca daily ID `b5c65aa3-c7ca-46b6-b3c6-be429c1444e5` 的 precheck 與 prompt。 |
| 4 | J-01：points 的新聞 id 不存在仍會增加「寫入」計數。 | :76、:167、:328 | 已核實 | `UPDATE news ... WHERE id = ?` 後直接 `points++`，`db.batch` 回傳的命中資訊未被使用。用已套全部 migration 的記憶體 SQLite 呼叫真正 `importResults`：id=`VJ-absent`、合法 points，得到 `points:1, skipped:[]`，查回該 id 的列數為 0。反證：POST 的 Zod 只驗 id 字串長度，不驗資料列存在；SQL 無命中也不是錯誤。 | `web/src/server/ai-batch.ts:170`、`:177`、`:201`；`web/routes/api/admin/ai.ts:23`；`web/tests/helpers/fake-cloudflare.ts:10`。 |
| 5 | J-01／J-02：缺 output→版本／來源連接，生成後無法還原當時證據。 | :88–89、:165、:177、:314 | 部分 | 持久追溯缺口成立：D1 digest 只有 model、news_ids、指紋、時間等欄位；model 預設 `claude-orca`；Yahoo `article()` 只回正文、不回實際 URL；`latestDigests` 不回 news_ids。但「生成後無法還原」過廣：`tasks.json` 會存完整 `Task.prompt`，`tasks.md` 也存規則與內容，當輪尚未被下一次 pull 覆寫時，仍可讀回生成輸入，包括截斷正文。應改成「缺跨批次、逐筆持久連接，且實際轉載 URL／版本未保留」，不能說當輪證據全無。 | `web/scripts/ai-batch.ts:111`、`:169`、`:177`、`:188`、`:200`、`:216`；`web/db/schema.ts:85`；`web/src/server/news-ai.ts:17`；`web/src/lib/news-ai.ts:293`。 |
| 6 | J-02：發布時間證據缺失，market 輸入只有同日標題，N-07 尚未完成。 | :99、:115、:177–185、:315、:329 | 已核實 | `parseNasdaqCreated` 只擷取月日年並回 `YYYY-MM-DD`；server 以 `published_at = date` 選新聞。`MarketWork.news` 是 `string[]`，內容是 title_zh 或 title；prompt 沒有逐則發布時刻／時區，也沒有禁止把未知時間推定為盤前的規則。反證邊界：現有 prompt 已禁止編造，這是一般要求，並未提供核對盤後事件所需的時間資料。未測上游現在是否另有時間欄，不能據此宣稱 Nasdaq 本身不提供。 | `web/src/lib/sources/nasdaq.ts:96`、`:106`；`web/src/server/ai-batch.ts:56`、`:91`、`:110`、`:125`；`web/src/lib/news-ai.ts:149`、`:184`、`:193`。 |
| 7 | J-03／J-06：N-02、N-03、N-05 有程式修正，但現有測試不是模型品質 eval；指定範圍未見 N-09 內容抽查產物。 | :109–119、:191、:243–253、:315、:330、:333 | 已核實 | digest／market prompt 確實允許「沒有可清楚辨識的單一催化因素」，digest 已改問實際事件與具名說法；market 接全部 movers，前六家外另加未列追蹤公司合計。現有測試使用固定字串、合成 D1、prompt 字句斷言與點數加總，未呼叫生成模型或比較人工標籤。以 `rg` 搜 source／scripts／tests／skills 的 golden、faithfulness、promptfoo、月抽查、cause_status、published_ts 等未找到內容 eval／抽查實作；檔名盤點亦未見獨立新聞 eval。僅核實這個有界範圍，不推論 repo 外沒有人工紀錄。 | `web/src/lib/news-ai.ts:140`、`:173`、`:193`；`web/src/server/ai-batch.ts:119`；`web/tests/news-ai.test.ts:19`、`:33`、`:131`；`web/tests/ai-batch.test.ts:82`；`web/docs/research-2026-10-27/codex-review.md:67`。 |
| 8 | J-04：上一輪 P3 已自行跑未登記歷史試算，屬已發生的流程失敗。 | :215、:221–227、:319、:331 | 部分 | 親讀 P3 原題，確實問歷史校準與其他門檻基準率，沒有本輪明確的禁止計算條款；P3 結果 :107 自稱「本次自行重算」，:122 起列六種 baseline。`forecast.md:132` 也已登錄這項暴露。因此「文件已暴露探索數字、必須記帳」成立。但這些仍是另一個 LLM 的自述；本輪沒有看到其可執行試算包、原執行 log 或原始輸出，不能把「確曾實際執行、計算正確」一併核實。J 的 :215「已發生」應限定為已發生的結果暴露。 | `web/docs/research-2026-10-27/prompts/P3-drawdown.txt:29`、`:31`；`web/docs/research-2026-10-27/results/P3-drawdown.md:105`、`:107`、`:122`；`web/docs/forecast.md:128`、`:132`。未重新下載市場歷史或重算那些數值。 |
| 9 | J-05：策略師表已人工月更、有 verified／verifiedOn，且中位數一家一票。 | :231–239、:332 | 已核實 | 檔首明寫人工月更與背景用途；型別有 verified、verifiedOn，實際列也有填寫。`medianEligible` 先限年底，再按 institution 分組，研究部門優先，同部門以日期／名稱排序，不依目標高低選。`STRATEGIST_STALE_DAYS=45` 是維護政策。這核實的是程式規則，沒有重新核實各銀行目前目標價，更不證明每月查核已準時執行。 | `web/src/lib/strategists.ts:1`、`:9`、`:12`、`:37`、`:47`、`:79`、`:94`。 |
| 10 | J-07：verify 與 release 有規則漂移，應修模擬器生命週期並讓專案路由先被選定。 | :255–267、:320、:334 | 部分 | verify 漂移明確：repo 只准重用兩台；features README :7 已教跳過 ios-up／down，:10 卻仍教用新建機；SKILL :51 教 create、:233 教 delete；腳本確實會做，down 不區分裝置來源。但 release 的「先綁定專案」其實已在 installed SKILL :17–28，projects :5 已訂 repo 優先，:21 明說市場觀測室的手動時間戳沒有衝突。一般 :47 禁時間戳與專案例外需要釐清適用範圍，不能當成本站 release 缺路由或 build 已壞的證據。 | `AGENTS.md:8`；`.claude/skills/verify/features/README.md:7`；`.claude/skills/verify/SKILL.md:51`、`:233`；`.claude/skills/verify/scripts/ios-up.sh:11`、`down.sh:13`；`.claude/skills/ios-release/SKILL.md:17`、`:47`；其 `references/projects.md:5`、`:11`、`:21`；`ios/scripts/testflight.sh:14`。 |
| 11 | J-03：ALCE 分開評正確性、citation recall／precision，並發現特定互動檢索與事後補引用的負面結果。 | :127、:201、:316、:330 | 已核實 | 論文 §3.3 明確分引用覆蓋與不相關引用；§5.1 寫「Retrieving text on the fly does not improve performance」，另指出 closed-book 加 post-cite 的引用品質差。也看到反向限制：簡單先檢索的 VANILLA 接近最佳，rerank 可改善引用品質，因此不能概括為 RAG 全無效。§2 是一般 QA 的評估資料，非股票報酬。原報告已限定特定方法與非金融範圍，主旨相符。 | [ALCE 原文](https://aclanthology.org/2023.emnlp-main.398.pdf)，PDF 第 3 頁 §2、第 4 頁 §3.3、第 6–7 頁 §5.1；出版頁碼 6467–6471。 |
| 12 | J-03 工具選擇：OpenAI 託管 Evals 2026-10-31 起唯讀，2026-11-30 預定關閉；prompt objects 同日預定關閉。 | :138–142、:317 | 已核實 | 官方停用頁的兩個 2026-06-03 條目逐一列出上述日期；reusable prompts 條目明寫 `v1/prompts`／prompt objects 預定關閉，並建議把 prompt 內容搬到應用程式。核實的是公告與預定時間，不能把未來關閉寫成已發生，也不涵蓋 `openai/evals` 開源 repo。 | [OpenAI 官方停用表](https://developers.openai.com/api/docs/deprecations#2026-06-03-evals-platform) 的「Reusable prompts」與「Evals platform」。透過 ego-browser 開啟頁面正文核對，非只讀搜尋摘要。 |
| 13 | J-08／J-03：Anthropic 金融模板有來源追溯、草稿審核與權限分隔，但 earnings skill 也要求 rating／price target，不宜整套搬入。 | :146–155、:271–279、:318、:335 | 已核實 | `gh` 確認官方 repo 與固定 commit 日期 2026-09-21。Earnings Reviewer 原碼 :19 要 FactSet／Daloopa 與完整 transcript，:24 只交草稿，:28–30 把外部文件視為不可信且每個數字須來源；earnings-analysis :165、:184 要 rating／price target，best-practices :127–135 要公告前 consensus 與前後 guidance。Managed README :21–29 確實描述 reader／connector／writer 三層隔離。這只證明模板定義存在，未部署測其權限，更未證明本站改善。官方公告頁 time 欄亦確認 2026-05-05。 | [官方公告](https://www.anthropic.com/news/finance-agents)；固定 commit `574ed3624aebd0418c7e96cd101262f30210ab26` 的 [Earnings Reviewer](https://github.com/anthropics/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/agent-plugins/earnings-reviewer/agents/earnings-reviewer.md)、[earnings-analysis](https://github.com/anthropics/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/equity-research/skills/earnings-analysis/SKILL.md)、[best-practices](https://github.com/anthropics/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/equity-research/skills/earnings-analysis/references/best-practices.md)、[Managed README](https://github.com/anthropics/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/managed-agent-cookbooks/earnings-reviewer/README.md)。 |
| 14 | J-03：Promptfoo context-faithfulness 拆 factual claims，分數為支持主張／總主張，judge 有限制。 | :136、:211 | 已核實 | 官方頁的 How it works 確為上述流程／比例；Limitations 列 judge 品質、漏掉隱含主張、長 context 表現降低。頁尾更新日為 2026-10-26。文件只支持功能與限制，沒有證明中文財經因果／數字判斷的準確率；原報告維持 `none` 並不自動放行，正確。 | [Promptfoo context-faithfulness 官方文件](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/context-faithfulness/)，How it works、Limitations、Last updated。 |
| 15 | J-03 方法借鏡：Koijen–Levy 的官方摘要自述即時 OOS，以公告時資訊解釋財報附近個股 contemporaneous return。 | :129、:348 | 已核實 | NBER 官方頁確為該作者／題名、Working Paper 35431、July 2026；摘要寫 real-time out-of-sample benchmark，使用公告當時可得資料（含公告文字）解釋財報附近的 contemporaneous 個股報酬。核實限於作者摘要自述；本輪未取得全文切分／最佳化程序，沒有驗證投資策略，也沒有引用其績效數字。原報告已明說這些限制，不宜反過來把它判成獨立複製。 | [NBER 作者摘要](https://www.nber.org/papers/w35431)，題名、作者、Issue Date 與摘要。以 ego-browser 親讀官方正文。 |

補充反證邊界：原報告「收盤推播不依賴新聞 AI」也與實際呼叫鏈一致：`notifyClose` 從 snapshot／watchlist 建 `dailySummary`、`bigMoves`，文字函式不查新聞摘要（`web/src/server/push.ts:230`、`web/src/lib/push.ts:42`）。這是第 2、3 項的影響範圍說明，不另增加第 16 條主張。

本輪合成重播的可核對輸出如下。第一組呼叫真正 server 函式與已套 migrations 的記憶體 D1；第二組取本機 batch 原始碼的執行尾段，在 VM 中替換登入、API、檔案操作，不接正式站，也不寫 `.ai-batch`。它們證明具體程式分支可達，不能估計正式站事故率。

```text
missing-news-id:
  receipt = {translated:0, points:1, digests:0, skipped:[]}; rows = 0
all-current-digests-exist-translation-remains:
  translationPending = 1; points = 0; digests = 0; market = null
second-pull-clears-existing-answer:
  answers = "{}\n"; exitCode = 1  // --check、沒有待辦，清空已先發生
missing-and-skipped-still-exit-zero:
  exitCode = 0
  寫入：翻譯 0 則、文章重點 0 則、每日重點 0 則；沒有答案：m1；略過：重點 n1：格式不對
```

## 2. 與事前登記或排除清單的衝突表

逐條對照第一輪事前登記、第二輪草稿與 proposal §6。**八項建議在原報告所限用途內，均未發現直接衝突或實際重開已否決項目。** 下表列出此結論依賴的規則與會跨線的具體擴張，不能把「不需市場登記」理解成可任意跑市場計算。

| 建議 ID | 衝突的規則 | 說明 |
|---|---|---|
| J-01 | 無直接衝突。相關：`forecast.md:112` G02；`:149` R2-6；`web/AGENTS.md` 的本機 AI 路徑。 | 批次 manifest／receipt 是新聞流水線工程，不占候選名額，也不改 forecast。保留本機執行位置符合現行路徑。補生成 digest 可以留修訂，但不可改寫既有 forecast 紀錄，或把延遲補生成稱成當時已即時發布；報告 :173 已保留這個界線。 |
| J-02 | 無直接衝突。相關：`forecast.md:114` X03／L17、`:144` R2-2、`:151` R2-8；`proposal.md:417`、`:425`、`:430–431`。 | 加時間、出處與內部 claim sidecar 不等於新增預測因子；沒有重開策略師訊號、rates／USD／oil beta、consensus surprise。日曆只證明事件發生，不能自動當 surprise 或收盤原因。若把萃取結果轉成 P(up)／dd5 輸入，必須另登記，且不得拿本文擴張第二輪名額。 |
| J-03 | 無直接衝突。相關：`forecast.md:118`、`:142–146`、`:150–151`；`proposal.md:418`、`:421`、`:423`、`:427`。 | 對合成報酬提示做文字忠實性測試，不是市場回測；本機內容 eval 也不等於 R2-7 的 dd5 校準診斷。不得因用了 benchmark 就放行新的波動／跌幅門檻，或拿真實歷史新聞加後續報酬評交易效果。原報告 :195、:203、:207 已作相應限制。 |
| J-04 | 無直接衝突；直接落實 `forecast.md:118`、`:128–136`、`:142–152`、`:159–180`；`proposal.md:409–425`。 | 研究範圍登錄不是市場計算授權。第二輪仍只給 dd5 的 rvHigh 一個名額；P(up) 不新增名額，EWMA 延後，組合方法須獨立登記。skill 必須引用正本、確認合併 hash、reference、資料 hash、target 隔離與 R2-3a 方法檢查，不能把舊研究章節或 proposal §6 :424 已被 R2-9 取代的 M-06 當有效承諾。J 報告引用正本而非複製門檻的方向正確。 |
| J-05 | 無直接衝突。相關：`forecast.md:11`、`:144` R2-2；`proposal.md:417`、`:428`，以及其首頁 :5 的審查優先序。 | 逐列核實策略師目標價、部門與 horizon 屬背景維護；沒有重開戰術呼叫當 flag 或投行命中率排行。不應悄悄擴成 U-05 的前瞻呼叫計分；那項另有來源全集、收集頻率、遺漏與計分登記要求。 |
| J-06 | 無直接衝突。相關：`forecast.md:111` L09、`:150` R2-7；`proposal.md:366` N-09、其 `codex-review.md:75`。 | 每月 10 篇來自既有維護提案，不是新的市場統計門檻，也不能估成全站錯誤率。J 已把固定抽樣與問題案例分開，並拒絕調 unclear 配額，符合修正版。內容抽查不得擴為按新聞後報酬選例或調 forecast。未找到當時原文時應不可判定。 |
| J-07 | 無市場登記衝突；對應 `AGENTS.md:8–11` 的既有交付門檻。 | 修正驗證指示與腳本不占名額，也未重開 proposal §6 項目。研究階段不能為了驗新聞技能直接啟動會抓市場歷史並計算 forecast 的整套 web-up；本輪未啟動。模擬器應重用並保留兩台。release 一般規則已有專案例外，不應借此任務自行更動 build 編號。 |
| J-08 | 無直接衝突。相關：`forecast.md:114` X03／L17、`:142` R2-0、`:144` R2-2；`proposal.md:421`、`:425`、`:431`。 | IR 事實變更卡沒有自動加減定投、dd5 調部位、個股評等或事件報酬檢驗，未重開排除項目。沒有真正公告前 consensus 就不寫 beat／miss，亦未重開爬受限網站算 surprise。把卡標成 b 的資料準備，不等於已有加碼預算決策規則；後續不得由事實卡自動推出買賣。 |

另外，J-02 與 J-06 是補做／細化既有 N-07、N-09，不是新的已驗證方法；J-05 延續 ST-04 的月檢。這些是尚未完成的維護項目，與「重開已否決項目」不同。

## 3. 證據等級高估清單

1. **J-04 把執行事實說得比證據強。** P3 的 LLM 自述與下游暴露帳本，足以確認那些數字已進入研究決策環境，不能證明原始試算確曾正確執行。應把原報告 :215、:319 的執行斷言收斂成「研究文件含未登記探索結果自述，且已造成暴露」。不採用 P3 自標的 `independently_tested`，也不引用其 0.064／0.052／0.056 作模型優劣證據。J 本身沒有把那些數字拿來採用新條件，這點應保留。

2. **工程存在與工程效果要分開。** 第 1–4 條已能以 source／合成重播成立，但這不會把 J-01～J-03 升格為 `independently_tested`：尚未實作提案，也沒有事故率下降或內容品質提升的量測。第 5 條的追溯缺口與第 10 條的文件歧義更不能推成已發生資料遺失／發版事故。原表將八項建議都標 `none`，此正式等級沒有高估。

3. **ALCE 的 `academic_oos` 只能按文字 benchmark 理解。** 原文 §2 從三個 QA 資料集的 development set 抽評估問題，沒有金融時序保留期，也不證明大模型預訓練未看過材料。可借 citation 評分與「特定方法未改善」結果；不可說是金融樣本外因果辨識或指數擇時證據。原報告已寫非市場期限、非選股，因此沒有查到把橫斷面選股偷換成指數擇時的情況。[ALCE 原文](https://aclanthology.org/2023.emnlp-main.398.pdf)，§2、§3.3、§5.1。

4. **NBER 是學術作者的 OOS 主張，驗證深度限摘要。** 官方摘要可支持研究定位；全文的切分、訊號最佳化與潛在污染未審，應寫 `academic_oos（作者摘要自述，設計細節未核）`。不是 `bank_claim`，因為來源是學術 working paper；也不是獨立複製。它衡量公告附近個股的 contemporaneous 解釋度，不能轉成本站 21 日 SPX 預測、選股獲利或新聞因果正確性的證據。J 已披露摘要限制，無須刪除方法參考。[NBER 官方摘要](https://www.nber.org/papers/w35431)。

5. **Reche et al. 的保留測試集分數不是投資 OOS。** 親讀原文 §3.2 有訓練／測試切分，§3.4 用 ROUGE／BERTScore；§4 自承參考摘要品質不佳、高分未必能泛化。J :128 已限定文字相似度與資料品質，不足以證明 hallucination 受控；未發現額外升格。若整合時只保留 `academic_oos／正` 而刪掉這些限定，就會高估。[原文](https://arxiv.org/html/2512.08764)，§3.2–§4。

6. **官方模板與工具文件不是有效性驗證。** Anthropic 原始碼證明有 guardrails／工作流定義，README 的隔離描述不等於本機已受實際權限強制；Promptfoo 文件證明計分功能，不證明 judge 在繁中金融文字上的準確度。J :155、:136 均以 `none` 並揭露限制，沒有把廠商自述升成本站獨立測試。每月 10 篇與 45 天 stale 也只是維護政策，不能說成文獻校準的最佳值。

## 4. 最重要的遺漏

最重要的遺漏是**沒有任何固定選取規則的已發布 AI 輸出基線抽查**：J 盤點出可達程式缺口，卻沒有看哪幾則真實摘要缺出處、日期是否實際誤導讀者、目前保留的 tasks 能支持多少核對，因此 J-01／J-02／J-03 的先後只能視為工程判斷，不能說已按使用者受害程度排序。這不必先執行 admin 或市場回測；可另以已授權、唯讀的既有畫面／輸出與當輪留存任務，固定抽樣、逐項連回原文並記不可判定原因；公司摘要日期可見性尤其值得核對，因網頁已顯示 `d.date`、iOS DigestRow 卻只顯示代號、公司、tone 與摘要（`web/src/ui/NewsFeed.tsx:75`、`ios/MarketObservatory/Views/NewsAI.swift:169`）。原報告已坦承未讀正式 D1，但「未核實」揭露不能替代現況品質證據；在取得這份基線前，不應宣稱新增整套 skills 的維護成本已值得。

## 5. 結論

- **保留並優先 J-01、J-02、J-03**：批次覆寫、partial exit 0、錯 id 計數及時間資料缺口有直接證據；「生成後無法還原」改成「缺持久追溯」。成效仍為 `none`。
- **保留 J-04、J-05、J-06**：J-04 改稱已發生「探索結果暴露」，不把 P3 自述當執行證明；J-05、J-06 延續既有維護規則，先補實際輸出基線，不宣稱月抽查能證明全站無誤。
- **限縮 J-07**：保留模擬器指示與腳本修整；release 部分降為釐清既有專案例外，已有先綁定專案的入口，沒有證據支持改 build 編號。
- **J-08 維持人工試用、低優先**：只做有來源的財報事實卡；不因官方模板存在就常態化或加入評等、目標價與買賣訊號。

未發現需整項刪除的建議，也沒有被推翻的主張；八項均不得藉工程優化重開第二輪名額或既有排除項目。
