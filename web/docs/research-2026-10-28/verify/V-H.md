# V-H：任務 H 研究結果的獨立查核

查核日：2026-10-28。先讀 `prompts/H.md`，再由 `results/H-llm-evidence.md` 的摘要與 H-01～H-07 反查正文和一手來源。以下「已核實」只表示該列限定的主張有直接證據，不代表整篇論文已獨立重製、產品效果已證明，或正式站曾發生所述錯誤。

共抽查 15 條：**已核實 14／部分 1／被推翻 0／無法核實 0**。未使用 agent-reach，GitHub 查詢 0 次；未取得市場歷史序列、未跑回測或探索統計、未呼叫正式站 `/api/admin/*`。程式反證只使用合成文字、合成價格及 `node:sqlite` 記憶體資料庫；只寫本檔。論文有 HTML 時直接讀作者原文，另直接開 PDF 核對 Lopez-Lira–Tang 的 OA7、成本定義，以及 Jha 等人的 §6.1、IA.6。未列入下表的研究不算本次覆核通過。

## 1. 主張查核表

「原報告位置」均指 `web/docs/research-2026-10-28/results/H-llm-evidence.md`；程式行號為本次親自讀取的工作目錄版本。

| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
| --- | --- | --- | --- | --- | --- |
| 1 | Kim–Muhn–Nikolaev 財報論文因資料與分析不一致，於 2025-02-20 撤回；目前不能用原正面結果背書 H-06 | §2.3，43–47；摘要 214 | 已核實 | arXiv 當前頁顯示 withdrawn，最新為 v3、2025-02-20；撤回說明明載共同作者重製時發現資料與分析不一致。短引：`identified inconsistencies in the data and analyses`。只能核實撤回及原因，不能從撤回推出 LLM 沒有能力，也不以此宣稱其他地方絕無更正稿。 | [作者提交的 arXiv 紀錄與撤回聲明](https://arxiv.org/abs/2407.17866) |
| 2 | Lopez-Lira–Tang 隔夜新聞、等權策略 Sharpe：零成本 2.971，10 bps 1.289，20 bps −0.394；成本為 round-trip | §2.1，21–25、29；摘要 215 | 已核實 | v6 PDF Table OA7、Panel A 的 **100% 每日再平衡**列確為上述數字；§6.1 與 Online Appendix F 明訂固定來回成本。樣本為 2021-10～2024-05 美國普通股；隔夜新聞後的開盤至收盤漂移，屬橫斷面多空。50%／25% 再平衡有別列，不能把本列說成所有設定共同結果。不是券商實際成交、借券與成本的獨立驗證。 | [v6 PDF，Table OA7（PDF 第 89 頁）、§6.1、Online Appendix F](https://arxiv.org/pdf/2304.07619v6) |
| 3 | 同一策略改市值加權：零成本 Sharpe 0.559，5 bps 後 −0.398；不足以直接移植為七巨頭買點 | §2.1，26、31；摘要 215 | 已核實 | OA7 同一 100% 再平衡列，市值加權兩欄確為 0.559、−0.398。這是全樣本的市值加權組合，**沒有直接檢驗七巨頭／本 App 名單**。因此報告限制可移植性的說法成立；若整合者改寫成「已證明大型股新聞無效」就超出來源。 | [v6 PDF，Table OA7](https://arxiv.org/pdf/2304.07619v6) |
| 4 | 時間一致 Chrono 模型在 2008-01～2023-07 的次日股票橫斷面，仍有 gross 正面結果 | §3.1，78–82；摘要 216 | 已核實 | §2.3 用過往月份 ridge 係數平均產生 OOS 預測；§3.4 用前一年已可得 checkpoint 做當年 embeddings。Table 7 是等權、每日再平衡、多空 decile；兩個實時模型都有正向 gross 結果。不是純聊天選股，也不是成本後實績或指數擇時。原報告沒有把未查的成本後效果冒充已核實。 | [作者 v3 原文，§2.3、§2.4、§3.4、Table 7](https://arxiv.org/html/2502.21206v3) |
| 5 | ForecastBench 2026-10-24 榜單已有系統未被檢出落後 superforecasters；不是等效／超越證明 | §3.3，96–98；摘要 217 | 已核實 | 本次實際頁面更新日仍為 2026-10-24。fire hedgehog Overall 68.9、CI [67.6,70.2]，superforecaster median 68.5、CI [67.1,70.3]；前者的 `Supers > Forecaster?` 為 No。頁面明載人類最後調查於 2024-07，以難度調整比較不同題組，允許工具與集成。不能只靠 CI 重疊判定，也不能把 No 當等效檢定通過。 | [ForecastBench 官方榜單及頁尾說明](https://forecastbench.org/leaderboards/index.html) |
| 6 | FinanceBench 共享向量庫 GPT-4-Turbo 為 19% 正確、13% 錯誤、68% 未回答；81% 不是幻覺率 | §4.2，126–128；摘要 219；支撐 H-02／H-05 | 已核實 | Table 2 的實際計數是 29／20／101，分母 150；oracle 是 128 正確、22 錯誤、0 未回答。研究者人工評估財報 open-book QA。報告保留錯答與未回答的區別正確；來源既不是目前 Claude 的測試，也不是本產品繁中摘要的錯誤率。 | [FinanceBench v1，§4–5、Table 2](https://arxiv.org/html/2311.11944v1) |
| 7 | GPT ETF 2025-07-01～2026-06-30 NAV 報酬 26.78%，Solactive 24.50%、S&P 500 TR 22.32%；有 LLM 也有人類流程 | §2.5，62–64；摘要 220 | 已核實 | SEC 年報明列基金名稱、期間與三個報酬；正文確認比較指數為 total return，並說稅未扣。官方方法頁寫人類收集資料、下指令並覆核，三個 LLM 參與。基金自身把該期超額表現主要歸因於 AI 題材持股；這仍不是「移除 LLM」的對照試驗。`anecdotal` 的限制合理。 | [SEC N-CSR，Annual Shareholder Report](https://www.sec.gov/Archives/edgar/data/1592900/000159290026004195/ck0001592900-20260630.htm)；[官方方法](https://iaetfs.com/etf/) |
| 8 | Turpin 等人顯示模型可受暗示影響，再產生未揭露影響來源的合理化解釋 | §4.1，116、120–122；摘要 218；支撐 H-01／H-02 | 已核實 | 作者直接操弄 few-shot 選項次序與 Suggested Answer；研究 GPT-3.5、Claude 1.0，任務為 BBH／BBQ。摘要短引：`CoT explanations can be plausible yet misleading`。它測的是模型解釋忠實度，不能直接證明金融市場因果錯誤率，也沒有證明分兩階段生成必然改善日報；原報告已正確標為設計推論與產品效果 `none`。 | [Turpin et al. v2，§2–4、Table 1](https://arxiv.org/html/2305.04388) |
| 9 | Jha 等人的 IA.6 支持「LLM 提取後續 capex 資訊」為 `academic_oos`，可支撐 H-06 可行性 | §2.4，51–58；H-06，176–178 | 部分 | **期間、應變數及正向關係均正確**：IA.6 是 2021Q4～2022Q4、10,470 筆公司季度觀測，應變數為 capex，含控制變數與當期固定效果。但表格是對該子樣本估計回歸係數，沒有另列凍結係數的訓練／測試切分或預測誤差；「OOS」主要指 GPT-3.5 訓練截止日之後。就金融預測檢驗而言不能與 Chrono 的過往係數逐期預測同等看待。應限縮為「cutoff 後子樣本的正向回歸證據」；若只能給一個經濟預測證據等級，宜採 `academic_is` 並另註模型 cutoff 穩健性。報告沒有挪用 IA.6 為股票報酬 OOS，這點保留。 | [2025-02 作者稿，§6.1、Table IA.6（PDF 第 72 頁）](https://arxiv.org/pdf/2409.17933) |
| 10 | H-01：目前沒有單則完整發布時點，且來源 metadata 在進 prompt 前被省略；同日盤後消息可能混入收盤素材 | §5.1，142、148；§5.2，154–160；建議 228 | 已核實 | `parseNasdaqCreated` 只回 YYYY-MM-DD；server 用 `published_at = date` 選新聞，個股輸入保留 id 卻省略 url／publisher／發布時間，大盤只送標題。**反證檢查**：DB 雖有 publisher、url、fetched_at，但沒有盤前／盤後篩選；prompt 的不編造規則也不能恢復被丟掉的時間。合成 08:00 與 17:30 都解析為同日；另把 17:30 合成新聞送進記憶體 DB，`dailyWork` 的 market.news 確含該則。本次唯讀 Nasdaq 回 HTTP 200，兩則 `created` 都是 `Oct 27, 2026`，沒有時分。這只證明抽到的兩則與可觸發路徑，不證明全站都無 timestamp，亦不證明正式日報已寫錯。 | `web/src/lib/sources/nasdaq.ts:106`、`:123`、`:135`；`web/src/server/ai-batch.ts:33`、`:91`、`:103`、`:125`；`web/src/lib/news-ai.ts:129`、`:163`；[本次唯讀端點](https://www.nasdaq.com/api/news/topic/articlebysymbol?q=NVDA%7Cstocks&offset=0&limit=2) |
| 11 | H-02：schema／parser 沒有逐句來源與語意驗證，整篇 news_ids 不能證明每句受支持 | §5.1，149；§5.2，162–164；建議 229 | 已核實 | `DIGEST_SCHEMA` 只有 summary／tone；`POINTS_SCHEMA` 只有 points／tone。**反證檢查**：route 有站長檢查與外層 Zod，但 answer 是 `z.unknown()`；import 只解析文字、tone、日期後寫入，沒有 span／entailment。合成測例把不存在的 `nonexistent-source` 當 newsIds，`importResults` 回 digests=1、skipped=[]，記憶體 DB 存下合成句。既有字數與型別驗證擋不住此例。未打正式端點，也未測量實際內容錯誤率。 | `web/src/lib/news-ai.ts:42`、`:49`、`:220`、`:260`；`web/routes/api/admin/ai.ts:18`、`:24`、`:27`；`web/src/server/ai-batch.ts:183`、`:193`、`:197` |
| 12 | H-03：tone 混合對股價的判斷與當日行情，沒有固定未來期限或機率定義 | §5.2，166；建議 230 | 已核實 | enrich 寫「對 focus 裡的公司股價而言」，digest／points 也問對股價偏正負；market 寫「這天整體偏」。**反證檢查**：digest 已禁止自行推測後市，points 已禁止投資建議，不能說現行 prompt 完全沒有護欄，也不能斷言 tone 已是未來勝率。所證實的是任務語意混用；改為「來源立場」是否更易懂，仍需產品評估。 | `web/src/lib/news-ai.ts:85`、`:142`、`:143`、`:194`、`:212` |
| 13 | H-04：預設 model 是 claude-orca，新聞 fingerprint 只看 ids，不能靠它還原模型／prompt／原文版本 | §5.2，168；建議 231 | 已核實 | CLI 預設值、fingerprint 的 sorted ids 雜湊均相符。**反證檢查**：已有 `AI_BATCH_MODEL` 覆寫、DB model／created_at，以及本機 tasks.json（包含 prompt／schema）與 answers.json；所以不能改寫成「完全沒存模型或輸入」。但每次 pull 會覆寫工作檔，沒有不可覆寫的版本鏈，fingerprint 本身不含內容。另 `dailyWork` 依 symbol/date 是否已有 digest 跳過，**不是**靠指紋自動失效；H-04 應補可追溯封存，不能拿來順便改成歷史自動重生。 | `web/scripts/ai-batch.ts:194`、`:199`、`:200`、`:213`、`:216`；`web/src/lib/news-ai.ts:292`；`web/src/server/ai-batch.ts:88`、`:93`、`:142`、`:183` |
| 14 | 現行 daily 會跳過取不到正文的 points；真正限制是 6000 字元截斷與缺結構化 sourceScope | §5.2，170；支撐 H-01／H-04／H-05 | 已核實 | `bodies[i] && tasks.push(...)` 確實阻止 null 正文進 points 任務；抽取函式預設 maxChars=6000，合成長文實跑得到 bodyLength=6000。**反證檢查**：prompt 已明寫「原文正文（可能被截斷）」；因此不能宣稱模型完全未被提醒。仍欠的是實際是否截斷、取得哪一版原文等結構化 metadata，而非新增一個現有 daily 已擋住的「無正文 fallback bug」。 | `web/scripts/ai-batch.ts:111`、`:162`、`:165`；`web/src/lib/news-ai.ts:208`、`:229`、`:244` |
| 15 | H-05：現有 CLI 不適合直接當純離線評估器；沒有以現有字串測試取代內容 gold 的依據 | §5.1，150；§5.4，188–202；建議 232 | 已核實 | 在有效 pull/push 參數下，CLI 頂層先 signIn，push 會 POST `/api/admin/ai`；沒有離線 eval 分支。**反證檢查**：無效參數會先 exit(2)，所以「任意 import 一定登入」並不精確；純 `src/lib/news-ai.ts` 可以安全匯入，本次合成測例即如此。現有 news-ai／ai-batch 測試涵蓋 parser、過濾、算術與 prompt 字串，未提供逐句人工 gold／盲評。這不能推出沒有 repo 外人工抽查。40 案、95%／90% 門檻均是報告提案，本次未驗證其有效性。 | `web/scripts/ai-batch.ts:17`、`:51`、`:194`、`:232`；`web/tests/news-ai.test.ts:131`；`web/tests/ai-batch.test.ts:35`、`:48`、`:82`；`web/tests/helpers/fake-cloudflare.ts:10` |

補充可重現的反證輸出（全部為合成案例，無正式資料）：

```json
{"sameParsedDate":true,"earlyDate":"2026-10-28","lateDate":"2026-10-28"}
{"parsedDate":"2000-01-04","marketInput":["合成盤後消息"],"marketNewsIds":["nasdaq:synthetic-after-close"]}
{"result":{"translated":0,"points":0,"digests":1,"skipped":[]},"stored":{"symbol":"SYNTH","summary":"虛構來源聲稱這是當日上漲原因。","news_ids":"nonexistent-source"}}
{"bodyLength":6000,"promptHasTruncationWarning":true}
```

Nasdaq 本次樣本 id 為 28650916、28649996，publisher 均為 The Motley Fool；兩則 created 均只有 `Oct 27, 2026`。日期不足時不能以 fetched_at 代替發布時間；這兩個欄位的意義不同。以上合成結果核實的是管線能力邊界，不是「正式站有多少篇錯誤」的估計。

## 2. 與事前登記或排除清單的衝突表

已逐條對照第一輪規則、第二輪草稿與 proposal §6。第二輪草稿的優先序以 `forecast.md:118`、`:120` 為準；proposal §6 仍寫 EWMA／等權組合的舊重開路徑，已由 `forecast.md:151`（R2-8 延後）、`:152`（R2-9 組合獨立登記）覆蓋，不能反用舊路徑替 H 建議開名額。

| 建議 ID | 衝突的規則 | 說明 |
| --- | --- | --- |
| H-01 | **現稿無直接衝突**；對照 `forecast.md:142`（R2-0）、`:144`（R2-2）、proposal `:416`、`:417`、`:430` | 新聞 metadata 與缺時間時限制因果措辭不改 P(up)／dd5，不重開利率、美元、油價或策略師 flag。與 N-07（proposal `:364`）重疊，是延續待辦。若日後把 news timestamp／事件抽取分數當 forecast 輸入，就超出本建議，須遵守名額及登記限制；「內容品質」不能當豁免名義。 |
| H-02 | **現稿無直接衝突；涉及先前暫緩項目的相鄰設計**；對照 proposal `:365`（N-08）、codex-review `:74`、forecast `:142`、proposal `:425` | 逐句證據型別與「整篇 cause_status」不同；原報告限於本機中間 metadata，沒有直接恢復被暫緩的公開三級標籤。若整合者直接新增公開 cause_status，便跳過前輪「先驗證編輯流程需要」的條件。任何型別、引用數或來源一致度均不得被轉成 meta-labeling／部位訊號。 |
| H-03 | **現稿無直接衝突**；對照 `forecast.md:114`（L17／X03）、`:718`（X01）、proposal `:425` | 文章立場與當日行情分開，不是投票式多空分數；與前輪 N-03 移除自行前瞻一致。若把多篇 tone 合成「N% 看多」、未來勝率或加碼指令，就重開 X01／X03；現稿沒有提出這些做法。 |
| H-04 | **現稿無直接衝突**；對照 `forecast.md:111`（L09）、`:112`（G02）、`:149`（R2-6）及 proposal §6 `:425` | 封存新聞與生成版本有助區分回溯重讀與真正前瞻。新聞檔案和 forecasts 紀錄是不同資料；不能因補 hash／新模型而覆寫既有預測，或把晚生成的結果算成即時紀錄。原稿已說版本變動不自動重生全部歷史，沒有重開任何 §6 指標。 |
| H-05 | **現稿無直接衝突；評分範圍必須保持內容品質**；對照 `forecast.md:118`、`:142`、`:145`（R2-3）、`:150`（R2-7）、proposal `:423`、`:425` | 合成行情與固定來源的忠實度、涵蓋率、盲評不占 forecast 試驗名額；95%／90% 是編輯驗收門檻，不能替代 BSS、置換虛無或 cell 閘門。也不是被排除的頁面機率可靠度圖。若拿歷史報酬調 prompt、挑模型或驗證買賣效果，就超出純內容評估，不能沿用「免登記」。 |
| H-06 | **現稿無直接衝突；不得升成決策規則**；對照 `forecast.md:52`、`:54`（既定標籤）、`:114`、`:142`、proposal `:411`、`:425`、`:431` | 財報 actual／guidance／風險原文整理可作 d，或 b／c 的閱讀材料；現稿明確不輸出加碼筆數、停扣或賣出。沒有以財報分析重開 P(up) 名額或 meta-labeling。不得為了 beat／miss 去爬被排除的 consensus，也不能用 capex 回歸背書 21 日指數預測。 |
| H-07 | **現稿無直接衝突；不得恢復評級或投票**；對照 `forecast.md:144`、`:718`、`:720`，proposal `:417`、`:425`、`:428` | 具名支持／反對觀點及缺口是背景資料，與策略師呼叫作 flag、命中率排行榜不同。原稿排除淨多空評級、目標價、勝率、部位大小，沒有重開已否決項目。若後續以來源數、看多／看空票數、LLM 共識算綜合分數，則越過現稿邊界。 |

**對帳結論：七項建議依其現稿範圍，沒有直接違反事前登記或重開 proposal §6 的已否決試驗。** 這個結論來自上述逐條規則，並非因作者在建議表自行填「否」就照收。H-02 的公開分類仍須遵守先前暫緩條件；H-06／H-07 的閱讀用途不能被整合成新的交易功能。

## 3. 證據等級高估清單

1. **需拆分評級口徑：Jha 等人的 `academic_oos` 指基礎模型的時間截止，不代表整個 capex 預測系統的 OOS（查核 #9）。** 該表是「cutoff 後文字」的回歸穩健性，不是將 capex 預測方程預先凍結後，在未參與係數估計的資料上計分。原稿已有 cutoff 後的說明；若沿用作者定義，可保留 `academic_oos` 並把「模型時間截止檢查」緊貼標籤。若評級單位是可部署的經濟預測系統，則宜寫 `academic_is`，另註 cutoff 後穩健性；兩種口徑不得合併。原報告已把主樣本股票 abnormal returns 列 `academic_is`，也明說不能把 IA.6 挪到報酬，這兩項沒有高估。[作者方法與表格](https://arxiv.org/pdf/2409.17933)
2. **Lopez-Lira–Tang 不必整體降成無證據，但必須保留「cutoff 後回溯」限定（#2–3）。** 原文的 OOS 依據主要是 gpt-4-0314 的 nominal cutoff；附錄另承認 fine-tuning／其他資料接觸疑慮。報告本來就沒有稱為封存的 live trading，不能在整合時把 `academic_oos` 擴寫成已排除全部污染或可直接交易。[v6 方法與 Online Appendix C](https://arxiv.org/pdf/2304.07619v6)
3. **本次未發現所抽查的 `independently_tested` 被拿來冒充獨立重製。** FinanceBench 是第三方測基礎模型，但仍由 benchmark 作者評其自建題組；ForecastBench 是外部榜單測 submitted systems，但人類對照並非新模型全部同期同題。兩者可支持各自限定的測試結果，不能變成本 App 的忠實度或股票 alpha 證據；原報告有寫這些限制（#5–6）。[FinanceBench](https://arxiv.org/html/2311.11944v1)、[ForecastBench](https://forecastbench.org/leaderboards/index.html)
4. **ETF 的 `anecdotal`、Turpin 的 `academic_is`，以及 H-01～H-07 的產品效果 `none` 均應保留。** 前者是基金揭露、後者是固定 QA 實驗；都不能提升成個股／SPX 預測、財報摘要或產品護欄已有效。H-05 的 40 案與門檻不是文獻估出的最佳值。抽查範圍內沒有把 bank_claim 升成 independently_tested，也沒有把橫斷面選股結果直接套成指數擇時（#2–8，及原報告 `:224`、`:238`–`:242`）。

## 4. 最重要的遺漏

最重要的遺漏是**沒有用實際管線的一小包封存輸入與既有輸出，建立「哪些錯誤真的發生、出在哪一層」的基線**。報告坦承未查 D1，但仍由文獻與介面缺口推進到七項工程提案；現行 digest 只看標題／短摘要，points 看的是透過 Yahoo 配對後最多 6000 字元的正文，兩者的來源覆蓋與可支持主張不同（`web/src/server/ai-batch.ts:103`、`:125`，`web/scripts/ai-batch.ts:111`、`:169`）。本次補查已證實日期不足與驗證器缺口，仍不能回答實際錯例頻率、重要遺漏，或 H-03 改 tone 是否能改善讀者理解。下一步應在既有授權範圍內，先對各種任務分層封存少量真實案例、逐句對原文標錯，再固定 H-05 的評估集與成本；反覆用來挑版本的 holdout 也須標成已暴露，不能一直當全新驗證。這些都只評內容，不需也不得碰後續歷史報酬。

## 5. 結論：建議的保留、降級與刪除

- **保留 H-01、H-02、H-04、H-05。** 時間／來源傳遞、逐句驗證與持久追溯的缺口有程式及合成案例支持；H-01 先處理時間不明的措辭，不能假定上游已有完整 timestamp。H-04 應補強既有 tasks.json／model 紀錄；H-05 先建立內容基線。產品改善證據仍是 `none`。
- **保留 H-03 作待評估的語意調整。** 現行 tone 確有混用，但「改成來源立場較好」尚未實測；不要宣稱已消除買賣暗示。
- **H-06、H-07 維持小範圍離線試辦，不升為正式功能或交易能力承諾。** H-06 的文獻背書限於 capex 回歸證據；財報閱讀與觀點卡的繁中忠實度、涵蓋及使用者理解，仍由 H-05 驗證。
- **本次沒有被推翻的抽查主張，也沒有建議須因虛構來源而整條刪除。** §2.4 的 `academic_oos` 須緊貼「模型 cutoff 後檢查，非凍結預測方程 OOS」限定；不得新增「正式日報已大量錯誤」或「模型完全沒有截斷提醒」等本次證據不支持的敘述。
- **維持既有排除。** 不新增 LLM forecast 名額，不以 tone／證據卡調整定投、P(dd5) 部位、加碼筆數或賣出規則；本輪證據不足以重開 X03／L17 或 proposal §6。
