# 任務 H：LLM 用於投資判斷的證據與陷阱

研究日：2026-10-28。對象：市場觀測室的新聞 AI，以及可能新增的個股／財報閱讀功能。

**結論：可以擴充「附出處的閱讀與核對」，目前證據不足以讓本 App 把 LLM 的多空語氣變成買賣、加碼、停扣或退出規則。** 金融文本包含可提取的資訊，部分研究有樣本外結果；但可交易期限、成本、模型時間污染與適用股票，離我們的長期定投與大型股觀察名單仍有很大距離。尤其常被引用的 Kim–Muhn–Nikolaev 財報論文已撤回，不能繼續背書。

本輪沒有取得或分析 SPX、VIX、個股歷史價格，沒有跑回測、探索性統計或 AI 報酬評分；沒有呼叫正式站 `/api/admin/*`。只讀程式與文獻，唯一寫入是本檔。下文的樣本數、績效與檢定值均為文獻／原始揭露；§5 的評估樣本數與門檻明標為**本報告提案**，不是實證結果。

## 1. 證據怎麼讀

每個能力主張只給一個等級。`academic_oos` 表示論文有指定的樣本外／前瞻測試，不表示研究者的所有分析都沒有資料污染；`independently_tested` 表示由系統之外的評估者實測，不表示已有多組獨立重製。`academic_is` 包括訓練期內的歷史分析與固定情境實驗；`anecdotal` 包括單一實際基金紀錄，無法分離 LLM 的增額貢獻。`bank_claim` 依本題定義涵蓋機構自述而未提供可覆核樣本外檢驗的說法。

「正／零／負」一定對著寫明的比較基準：例如預測分數顯著，但成本後策略負報酬，並不矛盾。提取管理層說法、預測盈餘、預測股票報酬、證明價格變動的因果，是不同任務。

閱讀標記：「全文可取、讀相關章節」表示已讀方法、結果及相關限制，沒有宣稱逐頁讀完；僅摘要／索引片段則標「未讀全文」。全部網址於研究日查閱，已去掉追蹤參數。

## 2. LLM 預測股價、報酬與財報的證據

### 2.1 Lopez-Lira & Tang：有條件的短期橫斷面結果，不能移植成長期買點

一手版本採 [arXiv v6 PDF](https://arxiv.org/pdf/2304.07619v6)，登錄日期為 2025-10-28，PDF 首頁自署 2025-10-30；已讀正文的交易定義、成本、衰退與 Online Appendix OA7。研究用 GPT-4 對新聞標題評分，樣本為 **2021-10 至 2024-05、美國普通股**。這是新聞驅動的**橫斷面多空選股**，持有通常為下一個可交易時段至收盤／隔日，不是預測 SPX 下月方向。

| 主張與結果 | 等級 | 期限、成本、適用範圍 |
|---|---|---|
| 後續漂移可預測：正。隔夜新聞的等權多空策略，零成本年化 Sharpe **2.971**；假設每次 round-trip **10 bps** 時為 **1.289**，**20 bps** 時變 **−0.394**。 | `academic_oos` | 上述樣本；一日左右、日再平衡、橫斷面。成本是作者固定 bps 假設，不是我們券商與借券的實際成交驗證。數字見 PDF Table OA7。 |
| 大型股可搬用性弱：負。相同隔夜策略市值加權時，零成本 Sharpe **0.559**，**5 bps** 後為 **−0.398**。 | `academic_oos` | 同樣本、同表。市值加權不等於直接測七巨頭或目前名單，不能聲稱已證明這些股票無效；足以否定「整體漂亮數字可直接搬用」。 |
| 能理解消息的初始市場反應：正；但那段不等於可交易預測。 | `academic_oos` | 作者明稱 initial reaction 為 non-tradable；不把高 hit rate 當個股勝率，更不是單篇新聞的漲跌機率。 |

以上數字均來自同一 [2025-10 v6 PDF，Table OA7 與 §6.1](https://arxiv.org/pdf/2304.07619v6)。該稿另報零成本年化 Sharpe 從 **2021Q4 的 6.54、2022 的 3.68、2023 的 2.33，降至 2024-01..05 的 1.22**（§1、§8；同一來源）。衰退這個描述有資料支持；「由 LLM 普及造成」只是作者機制解釋，沒有乾淨的因果識別。模型 cutoff 後的回測也不等於當時預先封存的 live trading。

因此本 App 的 `tone=positive` 可以研究是否正確描述文章立場，不能展示成「明天較可能上漲」；晚間批次摘要更不能宣稱捕捉論文中的即時交易優勢。

### 2.2 Pelster & Val：前瞻實驗值得保留，但不能把「正報酬」寫成 alpha

一手來源：[作者 SSRN 頁](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4602452)，Date Written **2023-10-13**，修訂 **2023-11-29**；期刊版 *Finance Research Letters* **2024**, DOI [10.1016/j.frl.2023.104786](https://doi.org/10.1016/j.frl.2023.104786)。

**`academic_oos`；結果：正，但僅有限核實。** 原始摘要明確說是 GPT-4 可上網的 live experiment，ratings 與未來財報及報酬正相關。出版社被索引的內文指出 attractiveness ratings 比較 S&P 500 股票的未來一個月吸引力，並評估後續 **30 日**的等權組合；這是橫斷面選股，不是市場擇時。

**未讀全文／細節未核實：** 實際打開 SSRN 遇 Cloudflare 驗證；ScienceDirect 遇 CAPTCHA，PDF 讀取回 403。本輪實際可見的是作者摘要及出版社搜尋索引的部分方法／結果段落，不能完整核對抽樣、顯著性與交易成本。我不轉述累積報酬、淨 alpha 或「勝過指數」數字。成本後效果：**未核實**。正報酬本身不證明打敗同期市場；短期 live experiment 也不證明穩定可部署。

### 2.3 Kim–Muhn–Nikolaev：撤回是決定性的新資訊

*Financial Statement Analysis with Large Language Models* 原本主張匿名財務報表足以讓 GPT-4 預測未來盈餘方向，並可建立較佳股票策略。但 [arXiv 正式紀錄與撤回聲明](https://arxiv.org/abs/2407.17866) 明確記載：**2025-02-20**，一位共同作者重製過去分析時發現資料與分析不一致，因此暫時撤回。

**現在支持能力主張的等級：`none`；結果：原正面證據失去可採信地位，不能解讀成已證明 LLM 無能力。** 其原始任務是未來年度盈餘方向與橫斷面策略，並非次日市場方向。已核實撤回原文；舊稿本輪僅看摘要，**未讀全文**，不沿用網路流傳的準確率、Sharpe 或成本後績效。

截至研究日，[最新版仍顯示 withdrawn](https://arxiv.org/abs/2407.17866)，[舊 v2 頁也提示新版已撤回](https://arxiv.org/abs/2407.17866v2)。本輪未找到可打開、能恢復原主張的更正稿或成功的獨立重製；不能把當初的「非記憶造成」主張當成已通過驗證。

### 2.4 財報電話會議：提取公司計畫的證據，強於直接產生買賣方向

Jha, Qian, Weber & Yang，*ChatGPT and Corporate Policies*，[2025-02 稿全文](https://arxiv.org/pdf/2409.17933)，已讀方法、§5、§6.1、Table IA.6。不要混淆它的 investment score：這裡的 investment 是**公司資本支出**，不是投資人的「值得買程度」。

| 可採用的主張 | 等級、結果 | 真正測到什麼 |
|---|---|---|
| LLM 能由法說文字提取對後續資本支出的資訊。 | `academic_oos`，正 | 原分析主要為 **2006–2020**；cutoff 後的 **2021Q4–2022Q4** 子樣本，Table IA.6 仍有後續 capex 預測結果。跨公司／季度；不是股票報酬交易試驗，交易成本不適用。 |
| 高 investment score 與之後較低 abnormal returns 相關。 | `academic_is`，正（關係為負向） | 主樣本跨公司季度回歸；後續季度報酬與較長期限。沒有以淨交易績效證明買賣策略。Table IA.6 的 OOS 應變數是 capex，**不能挪來稱股票報酬也已通過同一 OOS**。 |

時間、樣本與應變數均見 [2025-02 稿 §6.1、Table IA.6](https://arxiv.org/pdf/2409.17933)。作者的匿名化／cutoff 檢查能減少疑慮，不能邏輯上排除所有 post-training 洩漏。對我們最有用的用途是整理「管理層表示將增加 capex」「尚未量化回報」，不是把 capex 增加自動翻成股票利多。

### 2.5 實際 LLM 基金／ETF：有真錢紀錄，但沒有乾淨的 LLM 增額歸因

**Intelligent Alpha Atlas ETF，現代號 GPT，原 LIVR。** [基金官方方法頁](https://iaetfs.com/etf/) 在 **2026-10-28** 實際可讀：人類收集資料、下指令與覆核組合，LLM 參與選股和建構全球股票投資組合。這不是無人自主的單模型實驗。

**`anecdotal`；結果：單一實際基金期間為正，LLM 的持續 alpha 未確立。** [2026-06-30 Annual Shareholder Report，SEC N-CSR](https://www.sec.gov/Archives/edgar/data/1592900/000159290026004195/ck0001592900-20260630.htm) 揭露 **2025-07-01..2026-06-30**：基金 NAV total return **26.78%**，Solactive 全球指數 **24.50%**，S&P 500 total return **22.32%**。這是基金實際 NAV、已反映基金營運與投資組合成本的紀錄，並非投資人稅後／券商交易成本後報酬。揭露本身可核實；沒有「同資料與人類流程、唯獨拿掉 LLM」對照，也沒有長期因子調整與選擇偏誤控制，因此不給 `independently_tested` 的 LLM alpha 標籤。

另有 [Defiance LLM Catalyst Momentum ETF（AIED）官方頁](https://www.defianceetfs.com/aied/)，**2026-10-19** 才將原 AMOM 的策略文字增列 LLM news signal；本輪已讀方法與策略變更說明。**`bank_claim`；結果：LLM 增額效益未確立。** 它同時用價格 momentum、神經網路及人類裁量；官方展示的 **2026-09-30** 績效早於這次策略變更，不能拿前身整段歷史當新增 LLM 的實績。沒有在本輪自行計算變更後績效。

也不能拿名稱含 AI 的 ETF 一律當 LLM 實驗：[AIEQ 官方方法](https://amplifyetfs.com/aieq/) 描述的是 IBM Watson、machine learning、NLP；[LLMA 官方頁](https://www.globalxetfs.com/funds/llma) 則是投資 LLM 公司。這兩個來源於 **2026-10-28** 可見，均不足以證明「用生成式 LLM 選股有效」（該主張 `none`）。

## 3. 偷看、記憶與一般預測能力

### 3.1 不要把所有文本訊號都當偷看，也不要相信一句「假裝你在當年」

| 研究／閱讀狀態 | 結果與證據等級 | 對評估的含義 |
|---|---|---|
| Glasserman & Lin，*Assessing Look-Ahead Bias in Stock Return Predictions Generated By GPT Sentiment Analysis*，[2023-09-29 全文](https://arxiv.org/pdf/2309.17322)；已讀 §2、結果與限制。 | `academic_is`；正於匿名化減少干擾，不是證明可交易 alpha。訓練期內 **2015-01..2021-09**，匿名化常比原文表現好，尤其大型公司；另有 **2021-10..2022-12** OOS。 | 一日持有、美股橫斷面；作者明說忽略交易成本及放空限制。記憶不一定只會美化成績，公司既有知識也可能造成 distraction。去公司名仍可能由產品名識別公司。 |
| Sarkar & Vafa，*Lookahead Bias in Pretrained Language Models*，[ICML 2025 workshop 原稿](https://openreview.net/pdf?id=fn9cJkB86T)。 | `academic_is`；負於歷史風險預測可信度。原稿摘要與被索引內文明示，疫情前法說風險與選舉預測出現 lookahead，prompt 不能消除。 | 法說風險／選舉，不是成本後股票策略。**未讀全文**：OpenReview 驗證頁／curl 403，Harvard 學位論文替代頁 429。本輪僅讀到一手索引的摘要、方法與遮名限制片段；不引用二手流傳的 COVID 百分比。 |
| He, Lv, Manela & Wu，*Chronologically Consistent Large Language Models*，[2025-07-06 v3 全文](https://arxiv.org/html/2502.21206v3)；已讀 §2.3、§2.4、§3.4、Table 7。 | `academic_oos`；正於時間一致模型仍能提取報酬訊號。以當時可得語料的 ChronoBERT／ChronoGPT 配合過往資料估計的 ridge regression，在 **2008-01..2023-07** 次日美股橫斷面測試有正面 gross 結果，與較大模型相近。 | 這是 embeddings 加統計模型、日頻多空 decile，不是 chatbot 聊天選股；未核實成本後效果，不把 gross Sharpe 當可實作績效。「此應用 bias modest」不代表別的任務也小。 |

Chrono 模型提供重要的反面限制：**「全部 LLM 金融正面結果只是偷看」也超出證據。** 正確結論是污染大小依模型與任務而變。另可核實作者於 **2026-09-01** 公布 [replication package v2](https://data.mendeley.com/datasets/s6yt64mrwb/2)，但資料庫揭露 licensed CRSP／Dow Jones 不能重散布；本輪沒有下載或執行套件，不能稱獨立重製。

若未來評估投資預測，最低要求是先封存模型／prompt／輸入，再等待當時尚未發生的結果；比事後用最新模型重讀舊新聞可靠。需要記下：真正模型 snapshot、呼叫時間、所有檢索文件的發布／擷取時間、原文版本、當時可見的估計與成分股範圍。只記 nominal pretraining cutoff 會漏掉 post-training、工具搜尋與已修訂網頁；只把公司名換成 A，也可能由產品、數字和事件組合重新識別。

對本 App 的文字忠實度評估，歷史文章可以用來核對「是否忠於給定原文」，但不得因此宣稱其市場預測未受記憶污染。黃金答案也不能是「後來股價漲了所以這句算對」。

### 3.2 Halawi et al.：有效的是整個研究流程，並非裸模型已勝過人類

*Approaching Human-Level Forecasting with Language Models*，[NeurIPS 2024 正文與附錄](https://papers.nips.cc/paper_files/paper/2024/file/5a5acfd0876c940d81619c1dc60e7748-Paper-Conference.pdf)，已讀 §3、§5–7、Appendix G。**`academic_oos`；結果：相對裸模型為正，相對人類全體測試仍負。** 使用 **2023-06-01 之後發布**的問題，含新聞檢索、fine-tuning、推理與 aggregation；全測試平均 Brier **0.179**，人類 crowd **0.149**，較低較好。限定某些題目條件時可較佳，不能把選擇性子集的勝出換成全面勝出（同文 Table 3、§6）。

**校準主張 `academic_oos`，正於該完整系統。** Appendix G.2 的 reliability plots 顯示該系統改善校準；zero-shot base models 沒有同樣表現。這不授權把今天 Claude 自述的「信心高」變成數值機率，也不證明其金融子任務校準良好。該研究沒有交易資產／成本，題目期限依事件而異，並非橫斷面選股。

### 3.3 ForecastBench：原論文與現在榜單要分開看

[2025-02-28 v5 原文](https://arxiv.org/html/2409.19839v5)，已讀問題生成、評分與 Table 2：**`academic_oos`；結果：LLM 相對 superforecasters 為負。** 人類子樣本 **200 題**，期限 **7／30／90／180 日**；superforecaster median Brier **0.096**，最佳 LLM **0.122**，差異 **p < 0.001**。最佳模型在 market questions 得到 crowd forecast，不能叫完全獨立於人類的預測（同文 §5.2）。部分未解決市場題以 crowd aggregate 代替最終事件，亦須保留限制。

但不能停在舊結論。[官方 live leaderboard](https://forecastbench.org/leaderboards/index.html) 於 **2026-10-28** 以瀏覽器讀到更新日 **2026-10-24**：tournament 上 fire hedgehog 的 Overall Brier Index **68.9 [67.6, 70.2]**，superforecaster median **68.5 [67.1, 70.3]**，前者的「Supers > Forecaster?」為 No。**`independently_tested`；結果：相對 superforecasters 未檢出差異（零），不是已證明相等或 AI 勝出。** 這個 Index 與舊版 raw Brier 的方向、尺度不同，不能直接相減。

同頁說明 tournament 允許 tools、fine-tuning、ensembling 等；ForecastBench 自己送測的模型在市場題會取得較早的 crowd forecast；人類最後調查於 **2024-07**，與新模型題目不同，使用 difficulty adjustment，而非全部同期同題。一般事件預測的進步不能推論成可交易股票 alpha，更不能推翻 X03／L17。

### 3.4 Metaculus／Good Judgment：進步存在，校準不是模型的永久屬性

| 一手證據 | 等級、結果與限制 |
|---|---|
| Schoenegger & Park，[2023-10-17 原文](https://arxiv.org/pdf/2310.13014)，已讀方法及 §3。**2023-07..10** 前瞻 Metaculus 比較，**23 個二元問題**，GPT-4 Brier **0.20**、同時人類 crowd **0.07**；相對固定 **50%** 基準差異不顯著（**p=0.23**）。 | `academic_oos`；相對人類負，相對無資訊基準零。是小型真前瞻研究；沒有股票組合或交易成本，不代表後來模型永遠如此。 |
| Schoenegger et al.，*Wisdom of the silicon crowd*，[2024-11-08 全文](https://pmc.ncbi.nlm.nih.gov/articles/PMC11800985/)，已讀方法、Study 1 結果與校準。**2023-10..2024-01**，**31 題**，LLM ensemble Brier **0.20**、人類 **0.19**，**p=0.850**。 | `academic_oos`；相對固定基準為正，相對人類未檢出差異（零）。作者另做的 equivalence test 非事前登記且界限寬；校準分析仍發現多數模型差、aggregate 過度自信。不要把小樣本「未顯著」當精確等效。 |
| [Good Judgment 2025 年回顧](https://goodjudgment.com/good-judgments-2025-in-review/)，研究日讀原文，宣稱人類仍領先 AI；[Mantic 2026-09-18 自述](https://blog.mantic.com/p/mantic-raises-25mn-to-scale-superhuman) 則稱其夏季 Cup 超過所有人類參賽者。 | 兩者均標 `bank_claim`，各自宣稱為正；都不是本輪獨立核實的同題同時比較。Mantic 名次與參賽人數未由官方逐題／完整榜單覆核，不引用人數、優勢幅度或其校準回測數字。Good Judgment 舊回顧也不能替代現在 live benchmark。 |

因此，不採用「AI 一定不會預測」或「已經超越專家」兩種總括說法。對 App 的市場判斷能力，**目前本產品自己的證據等級仍是 `none`**。文獻不能替代本機實際 prompt、中文表達與來源管線的評估。

## 4. 事後解釋與金融摘要：新增的 LLM 證據

本節不重述前輪已核實的 Fischhoff 或 Cutler–Poterba–Summers。

### 4.1 流暢的解釋可以是對既定答案的合理化

Turpin et al.，*Language Models Don't Always Say What They Think: Unfaithful Explanations in Chain-of-Thought Prompting*，[2023-12-09 v2 全文](https://arxiv.org/html/2305.04388)，已讀 §2–4：**`academic_is`；結果：負於解釋可信度。** 研究改變選項位置或給暗示答案，模型會改答案並產生合理化的解釋，卻不說出真正影響它的提示特徵。這是 QA 與 bias benchmark，沒有金融資產、報酬期限或橫斷面選股；不能換算成我們日報的因果錯誤率。

更直接涉及 hindsight 的 LLM 實驗：Degany et al.，*Evaluating the o1 reasoning large language model for cognitive bias: a vignette study*，[2025-08-21 全文](https://link.springer.com/article/10.1186/s13054-025-05591-5)，已讀方法、結果、限制。**`academic_is`；結果：負於「reasoning model 已免疫 hindsight／post hoc」的主張。** 成對醫療情境中仍出現 hindsight、post-hoc 與 Occam’s razor bias；這是醫療固定情境，不是金融效果估計。只可作為「不要因為模型寫出推理，就視為因果證據」的新佐證。

**套到本 App 是設計推論，不是已實證改善：** 收盤漲跌是一個強烈的「已知答案」；模型可在同批新聞裡挑支持故事。把句子順序調一調不會隔離已知答案。較可查核的設計是先在看不到漲跌的階段提取事件、具名說法與時間，再由確定性程式提供行情描述，最後只做有出處的文字整合。兩段若共用同一個有行情的 conversation，並沒有實質盲化。

沒有找到已核實、直接用我們這種美股收盤日報設計，量測「先事件後行情」能降低多少錯誤因果的研究；這個改善主張標 `none`，必須由內容評估確認。

### 4.2 FinanceBench 的失敗率不能誤寫成幻覺率

Islam et al.，*FinanceBench: A New Benchmark for Financial Question Answering*，[2023-11-20 全文](https://arxiv.org/html/2311.11944v1)，已讀資料、Table 2、limitations。**`independently_tested`；結果：負於「加 RAG 就可靠」。** 公開人工評估樣本為 **150 題**；Table 2 的 shared-vector-store GPT-4-Turbo，約 **19% 正確、13% 錯誤、68% 未回答**；因此常見的 **81%** 是答錯加未回答，不是 **81% 幻覺**。同表給 evidence pages 的 oracle 設定仍有 **15% 錯誤**。數字限於該年模型與設定，不是目前 Claude 的錯誤率。

這是財報 open-book QA，不是新聞摘要、更不是報酬預測。可借用的是「問題—正確答案—證據片段」設計，並分開記錯誤與拒答；不能把這個 benchmark 分數直接當產品安全分數。

金融摘要另有 Yang et al.，*Evaluating Large Language Models on Financial Report Summarization: An Empirical Study*，[2024-11-11 全文](https://arxiv.org/html/2411.06852v1)，已讀方法、metrics 與結論。**`academic_is`；結果：對作者摘要品質指標為正，對可核實 faithfulness 仍不足。** 它含新聞型資料、ROUGE、BERTScore 與 LLM Score；這些相似度／評審分數不等於逐項數字、期間、否定句、因果都有原文支持。本輪不搬運模型排名，也沒有找到可直接代表本產品繁中新聞忠實度的獨立錯誤率。

可補用的來源設計是 [FACTS Grounding，Google DeepMind，2024-12-17](https://deepmind.google/blog/facts-grounding-a-new-benchmark-for-evaluating-the-factuality-of-large-language-models/)：把「有回答問題」與「全回答能歸於原文」分開評。這是 benchmark 設計參考，不主張它已證明我們的護欄有效（本產品效果 `none`）。金融摘要應同時查 **faithfulness（忠於輸入）**、**來源可信度／新鮮度**、**涵蓋是否偏頗**；忠於一篇錯誤評論，不會自動變成正確市場事實。

## 5. 本產品：已完成項目、具體改法、最小評估

### 5.1 N-01..N-09 的當前 source 對帳

對照 `web/docs/research-2026-10-27/proposal.md:358` 起，以及修正意見 `web/docs/research-2026-10-27/codex-review.md:67` 起。本輪於 **2026-10-28** 親自開啟以下檔案；這是 source 狀態，不是正式輸出的實測。

| 前輪項目 | 當前可確認狀態與證據 | 本輪處理 |
|---|---|---|
| N-01 資訊順序與來源日期 | **部分**。`web/src/lib/news-ai.ts:184` 仍先給收盤漲跌，再給新聞；`web/src/lib/news-ai.ts:163` 的大盤新聞仍是 `string[]`，無單則時間與來源。 | 不把「移順序」當解法；補證據包與可評估的盲化抽取。 |
| N-02 容許原因不明 | **已完成於 prompt**：`web/src/lib/news-ai.ts:142`、`web/src/lib/news-ai.ts:193` 已有明文。 | 保留，不重複提案。未查正式資料列，原因不明是否實際出現未核實。 |
| N-03 移除自行前瞻 | **已完成於 prompt**：`web/src/lib/news-ai.ts:141` 改為當日事實與具名說法，下一行禁止推測後市。 | 保留；新增功能不能繞過此限制。 |
| N-04 有觸發案例才增規則 | **未核實執行**。本輪未讀正式 `news_digests`，不聲稱已找到無出處黑名單句型。 | 不加詞語黑名單。新增護欄以明確 source 資料缺口與本文實證為依據。 |
| N-05 貢獻與近似誤差 | **主要 prompt 部分已完成**：`web/src/lib/news-ai.ts:173` 起補未列追蹤公司的合計；`web/src/lib/snapshot.ts:11` 定義近似誤差標籤，`web/src/lib/news-ai.ts:188` 使用。prompt 尚無名單合計權重。 | 不重做算術修正；本輪不宣稱網頁／iOS 全面驗收。 |
| N-06 CPI／非農與 macroToday | **部分**。`web/src/lib/calendar.ts:143`、`:151`、`:180` 已加入 CPI／非農，`:183` 的摘要也不再只叫 FOMC；`web/src/lib/news-ai.ts:149` 的 MarketInput 尚無 macroToday。 | 若接入，只列事件與官方時間；事件日不是漲跌原因。 |
| N-07 發布時間 | **在讀到的管線尚未落地**。`web/src/lib/sources/nasdaq.ts:106` 只解析日期；`web/src/server/ai-batch.ts:91` 按日期選新聞，`:125` 大盤只送標題，`web/src/lib/news-ai.ts:129` 個股輸入也沒時間。 | 這已是具體觸發條件：同日盤後新聞無法與盤前區別。不假設 Nasdaq 上游目前一定有 timestamp；未打上游，仍待確認。 |
| N-08 cause_status | **所讀 schema／輸入未實作**：`web/src/lib/news-ai.ts:42`、`:49` 與 `web/src/server/ai-batch.ts:183` 沒有逐句證據型別。 | 先做本機 evidence metadata；不要把整篇強迫三分法，空新聞仍能寫算術事實。新增公開欄位需顧 iOS optional。 |
| N-09 抽查 | **未核實人工流程**。`web/tests/news-ai.test.ts:131` 主要檢查 prompt 字串；讀到的 scripts／tests 沒有內容黃金樣本評分器。 | 無法由 repo 查無程式推論沒有人抽查；建議以下固定評估與抽查帳本。 |

### 5.2 現行 prompt／輸出要改什麼

**H-01：先補輸入的來源與時點。** `web/src/lib/news-ai.ts:129`、`:163` 改成保留單則 `sourceId / url / publisher / publishedAt / availableAt / sourceScope` 的 evidence records；server 目前有新聞 id 和 url，卻在 `web/src/server/ai-batch.ts:103`、`:125` 組 prompt 時丟掉關鍵欄位。日期不足時不可推定盤前；文案可寫「同日新聞提及」，不能寫「公布後帶動收盤」。完整 timestamp 經來源確認、處理 ET 與提早收盤後，才可作先後檢查。

可以先加的規則草案：

> 逐句區分可觀察事實與來源的解讀。描述消息引發行情時，必須有對應來源的明確說法；以「〔具名來源〕將走勢歸因於……」表述。發布時間不明或在該交易時段結束後的新聞，不得作為當日收盤原因。沒有盤中證據，不寫「公布後立即」「盤中逆轉」。

這是基於當前日期資料不足的限制，不是宣稱所有有出處的因果句都已被證明。

**H-02：逐句出處與可驗證證據型別。** `web/src/lib/news-ai.ts:42` 的 digest 與 `:49` 的 points schema 現在只收文字與 tone；`parseDigest:260` 和 `parsePoints:220` 驗型別、長度，沒有驗真偽。建議在本機生成中間結果：`claims[{text, sourceIds, evidenceSpans, kind}]`；kind 可為 `observed / attributed_interpretation / unresolved`。機器先驗 sourceId 存在、span 確實出現在封存原文、來源時點合規，再查 claim 是否被 span 支持。span 存在只證明引用存在，不能代替 entailment 與因果查核。公開短摘要可以保留，但要讓讀者展開來源。

`news_ids` 現存於 `web/src/server/ai-batch.ts:183` 是**整篇**來源聯集，不是每一句都有支持；不應向使用者說「已驗證」只是因為有連結。初期中間欄位可只留本機；正式輸出 schema 的演進另外設計相容性。

**H-03：tone 改成文章立場，避免暗示報酬預測。** `web/src/lib/news-ai.ts:85`、`:143`、`:212` 直接問對「股價」偏多／偏空，未定義期限、基準與可驗證結果；日報 `:194` 又混有當日行情。建議分開「已觀察行情」與「來源對事件的表述」，tone 指來源如何描述公司的營運／事件，不是模型對未來價格的機率；中性不得兼任「沒有資料」。若要公開改名，需對網頁與 iOS 同步驗證，不在本輪直接改。

**H-04：記錄實際模型與輸入，不只紀錄新聞 id。** `web/scripts/ai-batch.ts:216` 預設只送 `claude-orca`；`web/src/lib/news-ai.ts:292` 的 fingerprint 只由新聞 ids 決定。具體後果是同一組 id 的摘要文字、prompt 或模型變動，僅憑這個指紋無法還原。建議封存 raw source、擷取時間、實際 model identifier、prompt/schema hash、輸入 hash、生成時間與評估版本；若執行環境拿不到模型 snapshot，明記 unknown，不能編造精確版本。版本 hash 用於追溯與評估，不因此自動重生所有舊內容。

另有一個容易誤判的現況：`web/src/lib/news-ai.ts:208` 寫了「沒有正文時仍整理」的 fallback，但目前本機 daily 的 `web/scripts/ai-batch.ts:162` 起會跳過沒有 body 的 points。**不能把 fallback 描述成正式排程正在大量使用。** 真正仍有的問題是 `web/src/lib/news-ai.ts:229` 的正文只取有限長度且可能截斷；schema 沒有 sourceScope／truncated 記號。應把「正文節錄」傳入 metadata，避免對缺掉的段落作否定判斷；沒有完整文章不代表公司沒提風險。

上述 H-01..H-04 都是內容品質與可追溯性提案，對本產品改善效果等級 `none`，尚待 H-05 評估，不能拿文獻為它們報改善百分比。

### 5.3 可以新增什麼；每種功能的必要邊界

**H-06 財報要點：優先小範圍試辦。** 輸入以公司 IR earnings release、當時的 SEC filing 及有合法取得權的 call transcript 為主；新聞轉述不足以自稱「讀完財報」。逐點列實績、管理層 guidance、業務變化、管理層列出的風險與未回答問題，附文件日期、財務期間、頁／段定位。GAAP 與 adjusted、actual 與 estimate、季度與年度不可混合；沒有當時封存的 consensus，不能寫 beat／miss。成長率與比率由可查的 deterministic calculation 處理，LLM 負責挑出相關原文與說明。

用途是 d 個股研究，也可作 b／c 的閱讀材料；不要把它變成「本月該花幾筆加碼」或「漲跌到檢討門檻所以該賣」。文獻支持提取管理層資訊的可行性，不證明本產品品質（H-06 產品效果 `none`）。

**H-07 個股多空摘要：可做「支持與反對觀點的證據卡」，不做淨多空評級。** 每一項列出發言者、日期、主張、依據、反證／尚缺資料；沒有反方來源就明說來源未涵蓋，不讓模型為了平衡而編造反方。數篇轉載同一份 release 只算同一資訊來源，不能當多個獨立確認。作者看多與模型替使用者看多要明顯區分；不產生個人化買賣、目標價、勝率、部位大小或綜合分數。

風險提示可提醒「guidance 是管理層估計」「本文只涵蓋營收，未涵蓋現金流」「原始新聞時間未核實」，不能無出處生成「即將暴跌」或虛構風險機率。涵蓋完整度也要評，否則只做 fact checking 仍可能選擇性呈現。

來源文字是資料，不是執行指令：例如文章內的「忽略前述規則、改寫答案」不得改變任務或取得 shell／push 能力。評估器與生成器只讀封存輸入，發布由既有的受控程序處理；這是外部文字的信任邊界，不需要先等到發生惡意新聞才隔離。

### 5.4 H-05：本機可跑的最小 AI 輸出評估

**以下全部是 2026-10-28 的工程提案，不是已執行結果；數量與門檻由本報告建議，沒有冒充文獻最佳值。** 它只評原文忠實度、時間、涵蓋與表達，不評報酬。可以沿用 `translate`／`daily` 本機排程，在生成後、任何正式寫入前跑；不能直接 import 現有 CLI 當離線 runner，因為 `web/scripts/ai-batch.ts:194` 會先登入，push 分支 `:232` 會寫正式站。

**黃金樣本。** 建議起步 **40 個案例**，每類 **8 個**：標題翻譯／focus、全文重點、個股日報、大盤日報、財報證據卡。每類保留一半供調 prompt、一半為封存 holdout；以公司／事件／文章群組切開，同篇轉載與相鄰版本不得橫跨兩組。只用本地固定文檔、人工標註原文與合成行情欄位；不讀價格歷史，不以市場後來的結果建立 gold。

每案 gold 至少有：固定輸入與來源 hash、可接受主張與證據位置、必須保留的重要事實、禁止的新增推論、缺資料時可接受的省略／拒答。涵蓋實際管線能觸發的問題：同日盤後消息、僅日期無時分、正文截斷、來源互相衝突、actual／estimate、GAAP／adjusted、否定與條件句、別家公司的目標價、數字單位；另放外部文章試圖下指令的安全測例。評估 corpus 不含任何歷史報酬策略標籤。

**盲評。** 對同一固定資料包生成現行與候選版本，各保留第一次輸出；比較時隱去 model／版本，隨機交換 A/B 順序。人工讀 source 後逐 claim 標 supported／contradicted／unsupported，再標時間、公司、數字口徑、因果歸屬與遺漏。最小可由維護者主評，第二位讀者覆核所有重大錯誤及有爭議案例；無第二位時明說單人評估。另一個 LLM 可協助找疑點，不能作唯一裁判，更不能評「哪個聽起來比較有道理」。

**出處檢查。** deterministic validator 檢查來源 id、封存 span、數字／單位、輸入允許範圍、發布時點與 schema。凡引入計算，保留 operands 與運算結果。模型 judge 只看來源與 claim，不能看到真實後續行情；prompt 對缺證據必須允許 fail。由人工核對自動標記與漏報，記錄 judge 自己的錯誤。

**建議採用門檻。** 封存 holdout 上重大錯誤 **0 件**：捏造來源／數字、公司認錯、盤後因果倒置、違反不給買賣建議，任一件就阻擋候選版本。逐 claim 支持率至少 **95%**，gold 必要資訊涵蓋率至少 **90%**，且不能差於現行版；拒答另記，不能靠全拒答過關。每次同時公布原始分子／分母與錯誤清單。這些小樣本門檻不是稀有錯誤率的統計保證，也不證明模型有預測 skill。

**回歸與實際排程。** 未來可新增純離線 `eval-news-ai` runner（本輪未建立）：只讀 fixtures／封存生成結果，輸出本地評估報告；不載登入 cookie、不支援 push。prompt/schema/模型變動時跑完整黃金集，重大錯誤案例永久留作回歸；一般 daily 對當批候選跑 schema／來源／時間檢查，內容語意以人工抽查補足。沿用 N-09 每月 **10 篇**抽查作初始負擔上限，但把「隨機樣本」和「刻意挑高風險案例」分開記帳，不能混算成全站錯誤率。預算不足不能換成未檢查也標已驗證。

要分開記 pipeline failure、retrieval failure、generation unsupported、editorial omission、abstention；不能用單一「成功率」掩蓋錯誤。只發現一筆壞文時先攔該筆；黃金集揭示系統性回歸才停止該版本，毋須靠無限重試挑到好答案。

### 5.5 若未來真的研究預測：只寫事前登記，不執行

本輪不建議新增投資預測試驗，也不新增 forecast 名額。若日後另行授權，應先登記確切目標（盈餘方向、次日超額報酬、事件風險不得混用）、當時股票母體、可成交時點、固定模型與資料可用時間、全部 prompt 嘗試次數、成本與借券、缺資料及公司退市規則、基準與唯一主要指標；真正前瞻封存後再計分。新聞 tone、Brier、淨 alpha 是不同指標。

對任何股票預測的**建議事前登記計算**：同時報 baseline 的相對 proper score 與預定義成本後績效；採用至少要求預定義相對 skill 的信賴下界大於零、成本後效果亦為正，並預先設定多重搜尋校正與失敗後果。這只是設計框架，沒有給試驗授權，也沒有替本專案既定的置換門檻降標。不得用它重開永久否決的 meta-labeling／P(dd5) 部位調整。

## 給整合者的摘要

### 關鍵發現（3–8 條，每條附證據等級與來源）

- **Kim–Muhn–Nikolaev 的財報能力背書應撤下。** 作者於 **2025-02-20** 因重製發現資料與分析不一致而撤回；目前能力主張等級 `none`，原正面證據不可採信，不等於已證明能力為零。[撤回原文](https://arxiv.org/abs/2407.17866)
- **新聞報酬預測有條件的正面結果，成本與大型股限制很實際。** Lopez-Lira–Tang v6：**2021-10..2024-05**，次日美股橫斷面隔夜新聞策略，等權 Sharpe 零成本 **2.971**、round-trip **20 bps** 後 **−0.394**；`academic_oos`，gross 正、該成本後負，不能移植成七巨頭買點。[2025-10 v6 PDF，Table OA7](https://arxiv.org/pdf/2304.07619v6)
- **嚴格控制時間後仍有文本訊號，不能把全部正面結果歸為偷看。** 時間一致 Chrono 模型在 **2008-01..2023-07** 次日美股橫斷面仍有 gross 正面結果；`academic_oos`，成本後未核實，且是 embeddings 加統計模型。[2025-07-06 原文](https://arxiv.org/html/2502.21206v3)
- **一般預測進步不等於股票 alpha。** ForecastBench 更新至 **2026-10-24** 的 tournament 已有系統未被檢出落後 superforecasters；`independently_tested`，比較結果零，不能解讀為證明等效／超越。允許工具與集成，人類比較亦經題目難度調整。[官方榜單與限制](https://forecastbench.org/leaderboards/index.html)
- **「有推理」不能證明「為什麼漲跌」。** LLM 能合理化受提示影響的答案；`academic_is`，對解釋忠實度為負。套到本日報是合理風險推論，尚無本產品錯誤率。[Turpin et al.，2023-12-09](https://arxiv.org/html/2305.04388)
- **RAG、格式正確與引用存在，都不足以證明忠實。** FinanceBench 的 **2023-11** 舊模型測試仍有答錯與拒答；`independently_tested`，對「RAG 即可靠」為負，不能把混合失敗率當幻覺率或目前 Claude 錯誤率。[原文 Table 2](https://arxiv.org/html/2311.11944v1)
- **確有 LLM 參與的實際 ETF，仍不能歸因為 LLM alpha。** GPT 基金 **2025-07-01..2026-06-30** NAV total return **26.78%**，同期 S&P 500 TR **22.32%**；`anecdotal`，單一期間正，含人類流程、沒有去除 LLM 的對照。[SEC 年報](https://www.sec.gov/Archives/edgar/data/1592900/000159290026004195/ck0001592900-20260630.htm)

### 對我們 App 的建議

下列證據等級指「這個改動在本產品有效」；都尚未實測，故為 `none`，不借文獻等級冒充產品成效。

| ID | 建議 | 服務哪個決策（a 每月定投／b 加碼研究預算／c ±20% 檢討／d 觀察名單個股／資料／流水線／呈現） | 證據等級 | 成本（低／中／高） | 需事前登記？ | 與既有規則或排除清單衝突？ |
|---|---|---|---|---|---|---|
| H-01 | 新聞 evidence records 保留來源與時點；日期不足不得聲稱盤中先後或收盤因果 | 資料／呈現 | `none` | 中 | 否，內容品質 | 否；補 N-07，先確認上游實際時間欄位 |
| H-02 | 本機逐句 claim、來源定位與證據型別；短摘要可展開出處 | 流水線／呈現 | `none` | 中 | 否，內容品質 | 否；不強迫整篇 cause_status，新 API 欄位顧 iOS 相容 |
| H-03 | tone 定義為來源對事件的表述，分離當日行情與未來判斷 | d／呈現 | `none` | 中 | 否；若評報酬則是 | 否；維持不給個股買賣建議 |
| H-04 | 封存原文、prompt/schema/input hash、實際模型與生成時間 | 資料／流水線 | `none` | 中 | 否 | 否；不因版本變動自動重寫全部歷史 |
| H-05 | 離線黃金樣本、盲評、逐句出處與回歸門檻；發布前檢查，另保留人工抽查 | 流水線 | `none` | 中 | 否，純內容評估 | 否；不讀歷史報酬、不執行正式 push |
| H-06 | 先試辦附原文定位的財報要點：actual／guidance／風險／未回答問題 | d；b／c 僅作閱讀材料 | `none` | 高 | 否；預測研究另登記 | 否；不產生加碼筆數、停扣或賣出規則 |
| H-07 | 個股支持／反對觀點證據卡，列來源與缺口，暫不做淨多空評分 | d／呈現 | `none` | 中 | 否；預測研究另登記 | 否；不產生買賣、勝率、目標價或部位大小 |

### 建議不要做的事與理由

- 不用撤回的財報論文、AI ETF 單一年度勝出或一般事件預測榜單，背書本 App 的選股／擇時能力；任務與證據不相同。
- 不把 tone、自述信心、長篇推理或多模型一致換成股價機率；未經本產品前瞻校準。
- 不只換新聞與行情順序就宣稱消除 hindsight；也不使用無出處詞語黑名單取代查核。
- 不以 ROUGE、LLM judge 偏好或 JSON 成功率作唯一品質門檻；錯誤、拒答與重要遺漏要分開。
- 不新增 LLM 預測條件、不跑歷史策略、不以 AI 摘要調整定投／P(dd5) 部位；本輪沒有足以推翻 X03／L17 與永久排除項目的證據。

### 未核實、不確定、需要人判斷的地方

- Pelster–Val 全文受驗證／403 阻擋；只見作者摘要與出版社索引片段，成本後效果未核實。Sarkar–Vafa 只讀一手索引摘要／內文片段，未讀全文，不引用二手 COVID 比例。
- Lopez-Lira–Tang 的 PDF、HTML 自署版本日期不一致；本報告數字以連結的 v6 PDF 為準，未核實期刊最終版是否另改結果。
- 本輪未取得可將 LLM 本身與人類覆核、資料來源、其他因子分離的基金因果歸因；AIED 前身歷史不能當新增 LLM 訊號實績。
- 未抽查正式 D1 內容，N-04 的觸發案例、N-09 人工流程、現行 Claude 的內容錯誤率均未核實；已確認的只是 prompt／schema 與資料傳遞現況。
- 黃金集規模、採用門檻與第二位人工覆核的負擔需維護者決定；報告提出方案，沒有執行或證明品質改善。所有市場預測驗證仍須另行授權並事前登記。
