# 任務 F：GitHub 投資分析與 AI agent 流水線研究

查核日：2026-10-28（Asia/Taipei）。結論：**可借的是證據留存、資料時點與輸出評估；本輪沒有找到足以讓本 App 採用 LLM 個股買賣指令、或重開指數方向試驗的證據。** 這是本次查核範圍內的結論，不代表所有 LLM 投資方法都無效。

## 範圍、證據與查核限制

- 已讀 `web/docs/forecast.md` 既有研究章節與第二輪草稿，以及 `web/docs/research-2026-10-27/proposal.md:405` 的排除清單。本報告只補開源實作與評估的新證據，不重做投行指標整理。
- 完成下列 **24 個專案**的 README／文件、維護資料、授權及 issues 查核。主要 agent 加讀評估、資料或回測原始碼；這不是逐行安全審計，也沒有安裝或啟動這些專案。
- GitHub 資料來自認證的 `gh api graphql`、`gh issue list/view`、`gh api .../git/trees`；共 **49 次 gh 呼叫**，包含失敗的名稱查詢；沒有使用 GitHub search API 搜 repository。issues 搜尋逐次間隔至少三秒。其他內容以公開原始檔與論文唯讀取得。沒有 clone、執行下載程式、市場回測、探索性市場統計或正式站 admin 呼叫。
- 每個專案都搜過全部狀態 issues，查詢為 `lookahead OR "look-ahead" OR survivorship OR backtest OR leakage OR calibration`，取相關搜尋結果；Anthropic 另外查 `"mcp.json"`。下文「未找到」只限這組查詢，**不是宣告 issue tracker 沒有問題**。backtrader 的 issues 已停用。issues 的抱怨與自行計算，不當成已獨立驗證的事實；有讀目前程式確認的另外寫明。
- 證據等級只用指定的 `none／bank_claim／anecdotal／academic_is／academic_oos／independently_tested`。工程能力與預測效益分開：`none` 表示沒有可採信的效益檢驗，**不能把它解讀成統計上的零效果**。有績效主張時標正／零／負；沒有績效主張的函式庫標「不適用」，避免捏造零結果。作者論文的時間切分可以是 `academic_oos`，仍不等於獨立複製或真實前瞻紀錄。
- 除明列的論文版本日期外，程式、文件、issue 狀態及授權均為查核日看到的版本；原始碼連結固定到本次 commit。下文的建議門檻、欄位和成本是本報告的設計判斷，非外部測得的效果數字。

## 專案維護與授權快照

表內所有 stars 與 push 日期均為 **2026-10-28 查詢 GitHub GraphQL 的 `Repository.stargazerCount`／`pushedAt`** 所得；各列 repository 連結是一手來源，commit 固定檢視版本。push 不等於 release 或穩定性；stars 也不表示預測力。程式授權不包含上游市場資料的再散布權。

| 專案／一手 repository 來源 | stars | 最後 push（UTC） | 授權 | 本次檢視 commit |
|---|---:|---|---|---|
| [TradingAgents](https://github.com/TauricResearch/TradingAgents) | 117,437 | 2026-10-27 08:43:04 | Apache-2.0 | `c4544913a14e` |
| [ai-hedge-fund](https://github.com/virattt/ai-hedge-fund) | 64,303 | 2026-10-27 19:40:08 | MIT | `b33175caa128` |
| [Dexter](https://github.com/virattt/dexter) | 27,716 | 2026-09-23 19:56:36 | README 宣稱 MIT；本次 root tree 沒有 LICENSE，授權文本未核實 | `534f6be45552` |
| [FinRobot](https://github.com/AI4Finance-Foundation/FinRobot) | 8,322 | 2026-10-24 13:58:26 | Apache-2.0 | `63e1884a42ea` |
| [FinGPT](https://github.com/AI4Finance-Foundation/FinGPT) | 21,481 | 2026-10-25 13:49:15 | MIT | `ac5c5443fbee` |
| [FinRL](https://github.com/AI4Finance-Foundation/FinRL) | 16,840 | 2026-10-25 13:49:47 | MIT | `7e98df461cbc` |
| [FinMem](https://github.com/pipiku915/FinMem-LLM-StockTrading) | 967 | 2024-08-18 01:58:13 | MIT | `be814aa47970` |
| [RD-Agent](https://github.com/microsoft/RD-Agent) | 15,108 | 2026-10-21 16:01:22 | MIT | `484776c211e4` |
| [OpenBB（目前轉向 openbq-org/OpenBB）](https://github.com/openbq-org/OpenBB) | 74,808 | 2026-10-24 09:08:28 | Apache-2.0（親讀 LICENSE；API 為 NOASSERTION） | `7df7d0c5592b` |
| [Qlib](https://github.com/microsoft/qlib) | 49,765 | 2026-10-22 06:22:15 | MIT | `543552324638` |
| [vectorbt](https://github.com/polakowo/vectorbt) | 9,566 | 2026-10-23 12:07:43 | Apache-2.0 + Commons Clause（有 Sell 限制） | `8e30b8ce102f` |
| [zipline-reloaded](https://github.com/stefan-jansen/zipline-reloaded) | 1,991 | 2026-10-26 19:11:55 | Apache-2.0 | `f131a72e2705` |
| [backtrader](https://github.com/mementum/backtrader) | 23,600 | 2024-08-19 17:47:36 | GPL-3.0 | `b853d7c90b67` |
| [bt](https://github.com/pmorissette/bt) | 3,012 | 2026-10-25 22:27:22 | MIT | `5dbfbedb24ec` |
| [LEAN](https://github.com/QuantConnect/Lean) | 22,275 | 2026-10-27 19:57:17 | Apache-2.0 | `22404ea28b8d` |
| [properscoring](https://github.com/properscoring/properscoring) | 188 | 2023-03-09 16:00:06 | Apache-2.0 | `a465b5578d4b` |
| [scoringrules（Python）](https://github.com/frazane/scoringrules) | 107 | 2026-07-25 16:02:35 | Apache-2.0 | `e48aa74fdbf2` |
| [PyCalib](https://github.com/classifier-calibration/PyCalib) | 20 | 2024-05-03 09:24:13 | BSD-3-Clause | `8208ab907d5b` |
| [Anthropic financial-services](https://github.com/anthropics/financial-services) | 40,868 | 2026-09-21 21:10:41 | Apache-2.0 | `574ed3624aeb` |
| [financial-datasets MCP](https://github.com/financial-datasets/mcp-server) | 2,314 | 2025-06-05 19:50:38 | MIT | `08e7a3dbb949` |
| [SEC EDGAR MCP](https://github.com/stefanoamorelli/sec-edgar-mcp) | 380 | 2026-10-03 09:11:21 | AGPL-3.0 | `86646eb0e23f` |
| [MarketBreadth](https://github.com/jwbradley/MarketBreadth) | 1 | 2026-08-10 16:56:54 | CC0-1.0 | `06ff7685a30d` |
| [open-spx](https://github.com/wgeul/open-spx) | 1 | 2026-06-17 21:12:54 | Apache-2.0 | `0532db5ab121` |
| [Alpha Terminal](https://github.com/ronitg1/alpha-terminal) | 14 | 2026-07-15 16:48:13 | MIT（親讀 LICENSE；API 為 NOASSERTION） | `fbbd244fa0be` |

授權覆核：OpenBB 的 [LICENSE](https://github.com/openbq-org/OpenBB/blob/7df7d0c5592bf25be88e87e130a05c71e243d2d8/LICENSE)、vectorbt 的 [LICENSE.md](https://github.com/polakowo/vectorbt/blob/8e30b8ce102f302bec0c0226e05b59714453bebd/LICENSE.md)、Alpha Terminal 的 [LICENSE](https://github.com/ronitg1/alpha-terminal/blob/fbbd244fa0be7a8b68e208e691cb6f4452826314/LICENSE) 已直接讀取，不能只採 GitHub 的 `NOASSERTION`。Dexter 的 [README](https://github.com/virattt/dexter/blob/534f6be455523c5926eba72bdaf4f914555be5c9/README.md#L190) 宣稱 MIT，但本次根目錄 tree 沒有 LICENSE、API 的 licenseInfo 為空，故不把它列為已核實的完整授權。

## LLM 研究與交易 agent：逐案評估

### TradingAgents

**判斷與資料。** 基本面、新聞、情緒與技術分析師，交給 bull／bear 研究員辯論，再經 trader、不同風險立場與 portfolio manager；另有決策記憶與事後 reflection。資料有 Yahoo、Alpha Vantage、SEC EDGAR、FRED 等 vendor 路徑。來源：[README](https://github.com/TauricResearch/TradingAgents/blob/c4544913a14ed3df5f1ed7b9e8483270ce20682a/README.md)、[資料 vendor 目錄](https://github.com/TauricResearch/TradingAgents/tree/c4544913a14ed3df5f1ed7b9e8483270ce20682a/tradingagents/dataflows/vendors)。

**評估嚴謹度。** 本次的 [backtest.py:9](https://github.com/TauricResearch/TradingAgents/blob/c4544913a14ed3df5f1ed7b9e8483270ce20682a/tradingagents/backtest.py#L9) 明說評的是獨立決策格子，不是持倉、現金與成交模擬，因此不能把 alpha 平均值當可交易組合報酬。現行 [settlement.py:66](https://github.com/TauricResearch/TradingAgents/blob/c4544913a14ed3df5f1ed7b9e8483270ce20682a/tradingagents/memory/settlement.py#L66) 已從決策日期之後首個收盤入場；[FRED vendor:195](https://github.com/TauricResearch/TradingAgents/blob/c4544913a14ed3df5f1ed7b9e8483270ce20682a/tradingagents/dataflows/vendors/fred.py#L195) 同時鎖 observation 與 realtime vintage；[EDGAR vendor:154](https://github.com/TauricResearch/TradingAgents/blob/c4544913a14ed3df5f1ed7b9e8483270ce20682a/tradingagents/dataflows/vendors/sec_edgar.py#L154) 依 filed date 選當時版本。這些是實質進步；但日期級 cutoff 不是盤中 acceptance time，指定股票也不是歷史 universe，基礎模型的後見知識並未因此消失。README 另承認歷史同日重跑的文字資料未必相同；不能宣稱完全重現。

**issues 與結果。** [#1518](https://github.com/TauricResearch/TradingAgents/issues/1518) 是收盤後新聞、當日收盤起評的錯配，維護者於 **2026-10-16** 回覆已修，與現行程式吻合；不能繼續稱它是當前未修漏洞。[#805](https://github.com/TauricResearch/TradingAgents/issues/805) 的模型權重時間污染疑慮仍開啟。原論文 **2024-12-28 v1** 用 **2024-01-01 至 2024-03-29** 的美股歷史交易模擬自報優勢：`academic_is，正`（本報告保守視為回溯展示，未建立乾淨的模型時間外驗證；單股時序交易，不是 SPX 月方向，也不是完整橫斷面選股）。[論文 §Experiments](https://arxiv.org/html/2412.20138v1)。未核實成本完整性、依同版資料與模型獨立重現的績效。

**可借／不抄。** 借固定資料契約、理由與結果分開留存；不抄交易角色數量、rating 或 reflection 作為已驗證 alpha。

### virattt/ai-hedge-fund

**判斷與資料。** 投資人 persona／量化模型產生 conviction 與 thesis，strategy 混合，fund 做總風險，確定性程式處理部位與執行。用 Financial Datasets 的價格、財報與 earnings；cache、session ledger、paper／backtest 共用流程。特別注意版本差異：根 [README](https://github.com/virattt/ai-hedge-fund/blob/b33175caa1289e180b535d663c89b7a0c04b4726/README.md) 已轉向新互動流程，但 [hedge_fund/README.md:3](https://github.com/virattt/ai-hedge-fund/blob/b33175caa1289e180b535d663c89b7a0c04b4726/hedge_fund/README.md#L3) 仍自稱 v2 WIP、與舊 app 並行，不能把新核心能力反推到所有舊展示。

**評估嚴謹度。** [fund.py](https://github.com/virattt/ai-hedge-fund/blob/b33175caa1289e180b535d663c89b7a0c04b4726/hedge_fund/backtesting/fund.py) 記 universe、benchmark、每個 session、成交成本；新核心使用下一個 session 收盤執行，broker 可建 half-spread／commission，研究結果與執行狀態分開。這比單純 prompt→buy/sell 更可稽核。但 universe 由使用者給定，未提供普遍的歷史成分股／退市資料保證；[v2 README:129](https://github.com/virattt/ai-hedge-fund/blob/b33175caa1289e180b535d663c89b7a0c04b4726/hedge_fund/README.md#L129) 將 CPCV／PBO 列 planned，不能算已實作。未找到固定未觸碰期間與模型版本下、扣成本後可獨立重現的收益主張：`none，效益未判定`。

**issues。** [#572](https://github.com/virattt/ai-hedge-fund/issues/572) 回報舊 backtest prefetch 忽略 start_date；[#724](https://github.com/virattt/ai-hedge-fund/issues/724) 指 earnings cache 未過期；都是讀到的具體資料契約問題，但檔案路徑屬舊／不同版本，沒有在本次新核心重現，不宣告目前全案都中招。

**可借／不抄。** 借同一純計算流程做 replay、輸入快照及 append-only 紀錄；不抄名人 persona 的權威感、conviction 混成部位或 PEAD 策略。

### virattt/dexter

**判斷與資料。** 自主研究 agent 以規劃、tool calling、自我檢查與反思回答問題，核心資料供應商是 Financial Datasets；它更接近資料查詢與研究工作台，不是交易策略。[README](https://github.com/virattt/dexter/blob/534f6be455523c5926eba72bdaf4f914555be5c9/README.md)。

**評估嚴謹度。** [evaluator.ts:48](https://github.com/virattt/dexter/blob/534f6be455523c5926eba72bdaf4f914555be5c9/src/evals/evaluator.ts#L48) 把參考答案拆成 atomic correctness／contradiction rubric；有矛盾可直接歸零，另接受等價單位與合理四捨五入。這對我們的新聞事實驗證有用，但仍是 LLM judge，不能驗證引文實際存在、行情 PIT 或交易績效。沒有投組執行，成本／存活者偏差／交易 OOS 不適用；涉及過去時點的問答仍須另管資料 vintage。沒有核實金融收益或比單 agent 更準的獨立結果：`none，效益未判定`。上述 issues 查詢未找到相關回測質疑；授權文本有前表所述缺口。

**可借／不抄。** 借 atomic rubric 與錯誤分類；不用自我檢查「通過」取代可驗證參考答案，也不直接 fork 授權尚未核實的整套程式。

### FinRobot

**判斷與資料。** 目前 README 並存多代架構；本次重點看 desktop 的 data→research→valuation／backtest 與驗證層，而非把舊 AutoGen notebook 當成現行唯一架構。舊版有 SEC filings 與 earnings call 抽取流程；desktop 的 DataLayer 統一讀取調整行情。[README](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/README.md)、[adapter](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/backtest/backtrader_adapter.py)。

**評估嚴謹度。** [backtrader_adapter.py:189](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/backtest/backtrader_adapter.py#L189) 主動附零 commission／零 slippage 警語，並限制適用市場；typed BacktestConfig 能驗日期／現金，不會自動排除資料時點與選股偏差。[prompt eval script](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/scripts/_prompt_eval_equity_research.py) 用人工構造的新聞／數字／prompt injection 案例，評 task fit、數字紀律、來源使用與 workflow safety，值得借鑑；它不是持續封存的投資 OOS，也沒有證明更會選股。`none，投資效益未判定`；未核實可獨立複製的交易優勢。

**issues。** 查到 [#100](https://github.com/AI4Finance-Foundation/FinRobot/issues/100) 討論 strategy 表示與 provenance，但只是外部提案，不是已修正評估漏洞的證據。沒有從本次查詢找到更具體的回測偏差 issue。

**可借／不抄。** 借數字由程式計算、模型只解讀，以及有故意錯誤的 synthetic eval；不抄零摩擦績效或估值生成器作個股推薦。

### FinGPT

**判斷與資料。** 金融 LLM fine-tuning、情緒／NER／問答 benchmark 與 Forecaster；Forecaster 把 Yahoo 價格、Finnhub 新聞與財務 basics 組成週頻描述／預測。[README](https://github.com/AI4Finance-Foundation/FinGPT/blob/ac5c5443fbeeafad801e7a3c188e4f24cfaad4d8/README.md)、[data.py](https://github.com/AI4Finance-Foundation/FinGPT/blob/ac5c5443fbeeafad801e7a3c188e4f24cfaad4d8/fingpt/FinGPT_Forecaster/data.py)。文字分類分數與報酬預測是不同任務，不將前者轉為 alpha。

**評估嚴謹度與修正。** [#280](https://github.com/AI4Finance-Foundation/FinGPT/issues/280) 揭露以 fiscal period end 當可用日，已於 **2026-10-25** 關閉；目前 data.py 確實改呼叫 select_published_basic。然而 [basics.py:1](https://github.com/AI4Finance-Foundation/FinGPT/blob/ac5c5443fbeeafad801e7a3c188e4f24cfaad4d8/fingpt/FinGPT_Forecaster/basics.py#L1) 明寫尚未接實際發布日，暫以季末加 **45 日**當可用日（本次檢視版本，來源同檔）。這是近似延遲，無法處理較晚申報、年度資料差異或事後重編，不能稱精確 PIT。也未確認已發布的訓練／測試資料集是否全部重建。

**issues 與結果。** [#145](https://github.com/AI4Finance-Foundation/FinGPT/issues/145) 直接要求 Forecaster 回測與績效；[#33](https://github.com/AI4Finance-Foundation/FinGPT/issues/33) 批評挑成功標的的影片。後者是批評，非正式效益估計。本輪未核實 Forecaster 的固定樣本外交易績效、成本與歷史 universe：`none，投資效益未判定`。金融 NLP 測試集不是時間外市場驗證。

**可借／不抄。** 借把下游任務分開評估；不抄固定延遲就宣稱 PIT、不以 sentiment F1 背書買賣。

### FinRL

**判斷與資料。** DRL 把價格、指標、VIX／turbulence 等轉成多股票行動，reward 來自組合價值變化；來源包括 Yahoo 與其他可選 provider。[README](https://github.com/AI4Finance-Foundation/FinRL/blob/7e98df461cbc7772f16a545a2f13b521e5d0b8f4/README.md)。這是資產配置／交易，而非我們現有的文字檢討。

**評估嚴謹度。** 有 train/test/trade 分隔、環境的 [buy_cost_pct／sell_cost_pct](https://github.com/AI4Finance-Foundation/FinRL/blob/7e98df461cbc7772f16a545a2f13b521e5d0b8f4/finrl/meta/env_stock_trading/env_stocktrading.py#L24)；但費率存在不代表所有示範都是真實執行。查核日的新 [2026 data example](https://github.com/AI4Finance-Foundation/FinRL/blob/7e98df461cbc7772f16a545a2f13b521e5d0b8f4/examples/FinRL_StockTrading_2026_1_data.py) 已用 DOW_30_HISTORICAL_UNIVERSE、membership mask，且歷史 active 成分缺價格會中止。因此 [#1458](https://github.com/AI4Finance-Foundation/FinRL/issues/1458) 雖仍 OPEN，不能描述成最新範例完全沒修；該 issue 自算的偏差報酬數字未覆算、不引用。

另一方面，舊 [fundamental_stock_trading.py:305](https://github.com/AI4Finance-Foundation/FinRL/blob/7e98df461cbc7772f16a545a2f13b521e5d0b8f4/finrl/applications/stock_trading/fundamental_stock_trading.py#L305) 仍對依 ticker／date 排序後的整張表做 bfill，沒有依公司分組，且資料日期來自 datadate。這與 [#1463](https://github.com/AI4Finance-Foundation/FinRL/issues/1463) 的未公布財報／跨公司向後填值回報吻合，屬本次靜態確認的具體缺陷。[#1434](https://github.com/AI4Finance-Foundation/FinRL/issues/1434) 另質疑 adjusted 股價與價格指數 baseline 的口徑不一致；未逐條重現。

**結果。** 對本次檢視的示範流程，不接受「RL 本身已有效」的推論：`none，效益未判定`；未核實把上述資料問題排除後的固定 OOS 淨收益。不能把個別舊檔問題反推為整個 FinRL 家族沒有價值。

**可借／不抄。** 借歷史 membership 與缺資料直接暴露的測試方式；不引進 DRL、turbulence 清倉或 reward 導向的自動調倉。

### FinMem

**判斷與資料。** 正確原始 repository 是 pipiku915/FinMem-LLM-StockTrading，不是 AI4Finance-Foundation/FinMem。profile、分層 memory、重要性／新近度、reflection，再產生買賣／持有；資料為 Yahoo 價格、Alpaca／Benzinga 新聞及 SEC 財報。[README](https://github.com/pipiku915/FinMem-LLM-StockTrading/blob/be814aa47970de9bf2fdd6a1d5a60ae5cf361b46/README.md)、[論文](https://arxiv.org/html/2311.13743)。

**評估嚴謹度。** 論文 **2023-12-03 v2** 有明確 train/test：訓練 **2021-08-17 至 2022-10-05**、測試 **2022-10-06 至 2023-04-10**；有 baseline 與 memory／persona ablation，屬 `academic_oos，正`（依論文宣告的時間切分；每日美股單股交易，不是橫斷面因子，也不是 SPX 月方向）。日期與結論來源：[論文 §5.1](https://arxiv.org/html/2311.13743)、[版本頁](https://arxiv.org/abs/2311.13743v2)。這個等級不保證基礎 LLM 的時間污染已排除。選新聞多的少數股票、成本／滑價與 survivorship 控制，沒有找到足以支持泛化的完整驗證。

**issues。** [#17](https://github.com/pipiku915/FinMem-LLM-StockTrading/issues/17) 質疑模型已看過測試歷史；作者回覆其 GPT-4 checkpoint cutoff 早於測試，但論文不同實驗還使用其他 backbone。這是作者答辯，未獨立核實所有 backbone、資料與參數搜尋歷程；不能用較早模型贏過較晚模型，邏輯上證明毫無 contamination。

**可借／不抄。** 借決策理由與當時證據分開記錄；不把事後反思寫成「已學到可重現的交易規則」，不在相同期間反覆調 memory 容量。

### Microsoft RD-Agent（量化部分）

**判斷與資料。** hypothesis→生成 factor／model code→執行→驗證→分析回饋，並自動選下一個研究方向；量化底層用 Qlib。它是自動搜尋研究系統，不只是金融問答。[README](https://github.com/microsoft/RD-Agent/blob/484776c211e4fbbeef03e0ec00d6bbee7362a4f4/README.md)。

**評估嚴謹度。** 論文 **2025-09-25 v2** 的主實驗是中國 CSI 300 橫斷面選股：train **2008–2014**、validation **2015–2016**、test **2017-01-01 至 2020-08-01**，另列較晚／跨市場測試；含交易成本與多次 seed。作者報告勝過若干 factor／model baseline：`academic_oos，正`（以論文宣告切分為準；每日橫斷面排名及投組，不是指數月方向）。來源：[論文 §3、Appendix C](https://arxiv.org/html/2505.15155v2)、[版本頁](https://arxiv.org/abs/2505.15155v2)。未獨立確認全部 feedback 僅用 validation、全體搜尋次數及測試集完全未被研究者看過；不複述其行銷倍數。主文與附錄的執行／費率敘述還須對照實際 config，不直接拿收益作 App 訊號佐證。

**issues。** [#520](https://github.com/microsoft/RD-Agent/issues/520) 的作者回報 pct_change 未按 instrument 分組，維護者承認生成碼錯誤，提出對部分 instruments／dates 重算比對的 evaluator。這證明「能執行且得到分數」不足以代表公式正確；本次不宣稱該提案已全數實作。[#1372](https://github.com/microsoft/RD-Agent/issues/1372) 另有 backtest timeout／無有效 experiment。

**可借／不抄。** 借 instrument 子集不變性、時間截斷不變性等合成資料測試；不能讓 agent 自動搜尋 forecast 新條件、依評分反覆改模型，這會直接衝突事前登記。

## 資料、分析平台與回測引擎：逐案評估

以下工具本身通常不提供固定投資訊號，預測效益均為 `none，正／零／負不適用`。支援 PIT／commission／slippage 是工程能力，不表示採用該工具的策略已通過樣本外驗證。授權、stars 與最後 push 見前表。

### OpenBB

**判斷／資料。** 現行定位是 Open Data Platform：把專有、已授權與公開 provider 資料接到研究 dashboard／AI copilot，而非自行產生一套市場方向機率；本次原 owner 名稱查詢導向 openbq-org/OpenBB。[README](https://github.com/openbq-org/OpenBB/blob/7df7d0c5592bf25be88e87e130a05c71e243d2d8/README.md)。

**嚴謹度／issues。** 統一資料介面有利於把來源差異露出，但不能保證每個 provider 都保留歷史 revision、publication time 或退市公司；成本與交易 OOS 不是這層的任務。[#6917](https://github.com/openbq-org/OpenBB/issues/6917) 要求 backward adjusted close，顯示還原口徑仍須 provider 級處理；未驗證其預設全體 provider 的口徑一致。沒有採納 issues 裡陌生使用者貼出的 live portfolio 獲利宣稱。

**借法。** 借來源 adapter 與明確 provenance，不為目前少量來源搬進整套 Python 平台，也不把 provider 切換當「自動有備援且資料同義」。

### Microsoft Qlib

**判斷／資料。** ML pipeline 從 feature、模型到排名、投組、執行；資料可由使用者／collector 匯入，不是免費且無偏資料的保證。[README](https://github.com/microsoft/qlib/blob/54355232463878d2eebb91fe0ee5fa7fa1f5976c/README.md)。

**嚴謹度。** 本輪最值得借的實作是 [PIT 文件](https://github.com/microsoft/qlib/blob/54355232463878d2eebb91fe0ee5fa7fa1f5976c/docs/advanced/PIT.rst)：同一 period 保留多次公布值，用 publication date 決定當時可見版本。這能處理 restatement，與「只有 fiscal date 的歷史表」不同。原生 PIT 格式是日期級，不能直接解決美股盤中 acceptance time。範例 [LightGBM config](https://github.com/microsoft/qlib/blob/54355232463878d2eebb91fe0ee5fa7fa1f5976c/examples/benchmarks/LightGBM/workflow_config_lightgbm_Alpha158.yaml) 有 train／valid／test、開平倉成本與最低費用；沒有替所有輸入補齊退市價格／歷史 universe。套件支援 OOS，不代表任一研究結果就是乾淨 OOS。

**issues。** [#2080](https://github.com/microsoft/qlib/issues/2080) 回報同一天的預測會隨 test segment 範圍改變，屬重要的時間不變性警訊，但本次未重現；[#2315](https://github.com/microsoft/qlib/issues/2315) 質疑等權組合相對市值加權 benchmark 的解讀，這是 benchmark 設計問題，不直接證明 look-ahead。

**借法。** 借 publication／period 分離的資料契約與 replay 測試，不移植整套 factor zoo；也不照抄其市場別成本。

### vectorbt

**判斷／資料。** 使用者提供訊號、價格矩陣或資料 adapter，做向量化參數比較、交易與投組分析；沒有自帶可採信的投資判斷。[README](https://github.com/polakowo/vectorbt/blob/8e30b8ce102f302bec0c0226e05b59714453bebd/README.md)。

**嚴謹度／issues。** 支援費用、slippage 與驗證工作流，但時間對齊仍由使用者負責。原始碼 [portfolio/base.py:2313](https://github.com/polakowo/vectorbt/blob/8e30b8ce102f302bec0c0226e05b59714453bebd/vectorbt/portfolio/base.py#L2313) 直接提醒 close 產生的訊號須往後移，成交價應在訊號之後；這是文件警語，不是保證所有呼叫都會強制 shift。歷史 universe 與 OOS 搜尋紀律也不是引擎自動提供。[#722](https://github.com/polakowo/vectorbt/issues/722) 是初學者回測提問、[#506](https://github.com/polakowo/vectorbt/issues/506) 搜 TP／SL 組合，顯示工具很容易被拿來大量搜尋，但不能單憑這些 issue 判定引擎有 bug。

**借法。** 可讀其訊號／成交時點說明；不為我們的固定機率模型引進參數掃描。授權為 Apache 加 Commons Clause，README 明標 fair-code；不能因它在 GitHub 公開，就視為沒有附加限制的標準 Apache 軟體。

### zipline-reloaded

**判斷／資料。** Event-driven 策略回放；資料 bundle 結合 pricing、adjustments、asset database，可自訂 ingestion。[官方 bundles 文件](https://zipline.ml4trading.io/bundles.html)。

**嚴謹度／issues。** 保存不同 ingestion timestamp 的 bundle 有助重現，**但 ingestion date 不等於每個財報的 publication date**。資產生命週期與 corporate actions 能否排除 survivorship，取決於輸入 bundle；有 commission／slippage 模型不等於使用者配置正確，OOS 分段也要研究者決定。[#313](https://github.com/stefan-jansen/zipline-reloaded/issues/313) 是 slippage／取消政策等 simulation correctness 回報，[#198](https://github.com/stefan-jansen/zipline-reloaded/issues/198) 是 futures commission 問題；查核時均 CLOSED，未逐一確認每個修正版本，不稱為現行未修 bug。

**借法。** 借可選 ingestion snapshot 的設計。另 [README](https://github.com/stefan-jansen/zipline-reloaded/blob/f131a72e2705c5bfbc23ae1be93d58a2d432e7fc/README.md) 已把新功能重心移往 ML4T Backtest，zipline-reloaded 維持 bug／安全／相容性；若將來真有交易模擬需求，須重新比較維護方向，本輪不裝。

### backtrader

**判斷／資料。** 使用者 Strategy／indicator，加 CSV、pandas 或 live data feed；broker 模擬委託、佣金、滑價等。[README](https://github.com/mementum/backtrader/blob/b853d7c90b6721476eb5a5ea3135224e33db1f14/README.rst)。

**嚴謹度／issues。** Event-driven 不能自行補齊 PIT 財報、退市證券或歷史 universe。尤其 [broker 文件](https://www.backtrader.com/docu/broker/) 允許 cheat-on-close／cheat-on-open；應視為需清楚宣告的模擬選擇，不能以「事件驅動」保證無前視。OOS 須另設計。本次 `gh issue list` 明確回應 repository disabled issues，**沒有 issue tracker 證據可查**，不拿「沒搜到」背書品質。

**借法。** 可參考執行模型拆層；舊維護日期與 GPL 授權增加引入成本，不符合現有產品需求。

### bt

**判斷／資料。** 將 Run／Select／Weigh／Rebalance 組成策略樹，使用者提供價格與額外資料；適合比較投組流程。[README](https://github.com/pmorissette/bt/blob/5dbfbedb24ec83d7a43c8d55741b72b1642a62a6/README.md)。

**嚴謹度／issues。** 支援 commission／交易成本模型；[官方 examples](https://pmorissette.github.io/bt/docs/source/examples.html) 明示預設 backtest 不收交易成本。沒有內建保證輸入是 PIT／survivorship-free，時間外選參數仍須外部設計。[#386](https://github.com/pmorissette/bt/issues/386) 詢問 walk-forward optimization；[#323](https://github.com/pmorissette/bt/issues/323) 詢問 taxes，不能由 library 名稱推論已把稅、換匯、定投摩擦算進去。

**借法。** 借排程／選擇／權重的明確分離；不重寫我們既定買入日的定投試算，不把最適化後的加碼排程帶回 App。

### QuantConnect LEAN

**判斷／資料。** 使用者 algorithm 接 event stream、security／universe、歷史與 live feeds；QuantConnect Dataset Market 與自行匯入資料分開。核心涵蓋 corporate actions 與 fee／fill／slippage／brokerage models。[repo](https://github.com/QuantConnect/Lean/blob/22404ea28b8d3f3c9eb74d6ed9f0444426f8e417/readme.md)、[官方 reality modeling](https://www.quantconnect.com/docs/v2/writing-algorithms/reality-modeling/key-concepts)。

**嚴謹度／issues。** [官方 Research Guide](https://www.quantconnect.com/docs/v2/writing-algorithms/key-concepts/research-guide) 清楚區分 fiscal period、真正 release、restatement 與動態 universe，屬成熟研究規範；但自己匯入當前成分股／晚修資料仍會污染，不能靠 event frontier 洗乾淨。支援模型不是任何市場與券商下都已核實的成交精度，也不替研究者提供未觸碰 holdout。[#9929](https://github.com/QuantConnect/Lean/issues/9929) 回報 GoodTilDate 忽略日內時間；[#9616](https://github.com/QuantConnect/Lean/issues/9616) 要求更多 robustness report，都是具體執行／報表邊界，未由本次實測確認。

**借法。** 借 timestamp frontier／資料可用時間的契約；現階段不需要 Docker、C#／Python trading engine 或 broker 整合。

## Proper scoring 與 calibration：逐案評估

### properscoring

**判斷／資料。** 對提供的預測及真實結果計算 binary Brier、CRPS、threshold Brier 等；不是市場資料供應商，也不產生投資訊號。[README](https://github.com/properscoring/properscoring/blob/a465b5578d4b661e662933e84fa7673a70e75e94/README.rst)、[_brier.py](https://github.com/properscoring/properscoring/blob/a465b5578d4b661e662933e84fa7673a70e75e94/properscoring/_brier.py)。

**評估／維護。** 公式與可檢視程式適合作為離線參照，但沒有替使用者處理日期切分、重疊標籤、block bootstrap、選擇偏差或交易成本。查核日 GitHub 已 archived，最後 push 及授權見前表。issues 關鍵字查詢無結果，不能解讀成數值實作完美。預測效益 `none，不適用`；計分公式正確性與打敗基準率是不同主張。

**借法。** 可以閱讀 binary Brier 定義，不優先新增已封存的依賴。

### scoringrules（frazane 的 Python 版）

**判斷／資料。** 使用者提供 outcomes／probabilities／ensemble，支援 Brier、log score、RPS、CRPS 與多種後端；名稱相近的 R scoringRules 是另一個專案，本次 metadata 只屬 Python repository。[README](https://github.com/frazane/scoringrules/blob/e48aa74fdbf2d916ade569e1b7516286dbc8b303/README.md)、[exports](https://github.com/frazane/scoringrules/blob/e48aa74fdbf2d916ade569e1b7516286dbc8b303/scoringrules/__init__.py)。

**評估／issues。** [_brier.py:10](https://github.com/frazane/scoringrules/blob/e48aa74fdbf2d916ade569e1b7516286dbc8b303/scoringrules/_brier.py#L10) 的介面為 obs 在前、fct 在後，輸出逐點平方誤差；不內建我們的相位平均 BSS、expanding baseline、stationary bootstrap 或置換虛無。交易成本、survivorship 不適用；OOS 資料仍須呼叫端控制。[#21](https://github.com/frazane/scoringrules/issues/21) 是 coverage／quantile CRPS 功能討論；[#137](https://github.com/frazane/scoringrules/issues/137) 為外部使用案例提議，沒有把它當金融有效性的獨立測試。`none，預測效益不適用`。

**借法。** 本輪最適合的低成本工具：只作離線、合成資料的 reference oracle，與 `web/src/lib/forecast.ts:481` 逐點 Brier 對照；不把 Python 放進 Worker，不跑任何新市場資料評分。

### PyCalib

**判斷／資料。** classifier 的 sigmoid／isotonic／beta／binning calibration，以及 reliability diagram；輸入是分類結果與分數，不是市場資料。[models](https://github.com/classifier-calibration/PyCalib/blob/8208ab907d5b9c5149b2d45b1c8b6e4b2d763317/pycalib/models/__init__.py)、[visualisations](https://github.com/classifier-calibration/PyCalib/blob/8208ab907d5b9c5149b2d45b1c8b6e4b2d763317/pycalib/visualisations/plot.py)。

**評估／issues。** 它能把 probability bin、histogram 與觀測比例畫出來，但使用者若在測試結果上擬合 calibrator，一樣會漏資料；一般比例區間亦不自動處理時間相依。沒有任何我們標籤上的校準或預測效果數字：`none，效益未判定`。交易成本／survivorship 不適用。[#14](https://github.com/classifier-calibration/PyCalib/issues/14) 是 calibrator 介面擴充，[#18](https://github.com/classifier-calibration/PyCalib/issues/18) 是 BetaCalibration 呼叫錯誤，不能當方法效果證據。

**借法。** 只參考圖的介面，不加校準層，也不重提公開 reliability 圖；既有 L10／R2-7 的範圍與樣本限制不變。若日後改 bins、選 calibration 方法或拿結果選模型，必須另登記。

## 金融 skills、plugins 與 MCP：逐案評估

### Anthropic financial-services

**判斷／資料。** 官方開源的是研究、估值、財報、thesis／catalyst tracking 等工作流程與 connector 設定，不是一套已驗證的交易策略。資料 MCP 列 FactSet、S&P Global、Morningstar、Daloopa 等；使用者仍需各供應商的權限／訂閱。[README](https://github.com/anthropics/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/README.md)。

**評估嚴謹度。** 最適合本 App 的不是 DCF 目標價，而是 [thesis-tracker](https://github.com/anthropics/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/equity-research/skills/thesis-tracker/SKILL.md) 的 original expectation／current status、反證、事件日與 update log。原 skill 同時含 Increase／Trim／Exit、conviction 與 stop-loss 欄位，與我們邊界衝突，不能整份啟用。README 的人工覆核原則也不是成本、PIT、survivorship 或 OOS 績效驗證；`none，投資效益未判定`。

**實際查核／issues。** 目前 commit 的 [financial-analysis/.mcp.json](https://github.com/anthropics/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/financial-analysis/.mcp.json) 缺逗號／閉合括號，本次只用標準 JSON parser 讀取原始文字，得到：
`JSONDecodeError: Expecting ',' delimiter: line 47 column 5 (char 1100)`。
這是 **2026-10-28 親自重現的設定語法失敗**，不是執行第三方程式或投資回測。[#355](https://github.com/anthropics/financial-services/issues/355)、[#264](https://github.com/anthropics/financial-services/issues/264) 也回報相同問題，查核時仍 OPEN。沒有實際在 Claude Code／Cowork 安裝，故「連接器完全不載入」是 issue 回報與設定推論，非本次 GUI 實測。

**借法。** 借可反證的研究紀錄欄位；只做非交易摘要。Markdown 的方法可改寫給既有 Orca 工作流，不能將 Claude plugin manifest 原封當 Codex plugin，亦未找到本輪已核實的 Codex 專用金融 alpha plugin。

### financial-datasets/mcp-server

**判斷／資料。** Financial Datasets API 的工具封裝：三表、當前／歷史價格、新聞等；MCP 決定怎麼呼叫資料，投資判斷仍由上層模型做。[README](https://github.com/financial-datasets/mcp-server/blob/08e7a3dbb949d3d99bbd6d6f3a22e5f02973ec58/README.md)。

**評估嚴謹度／issues。** [server.py:44](https://github.com/financial-datasets/mcp-server/blob/08e7a3dbb949d3d99bbd6d6f3a22e5f02973ec58/server.py#L44) 的報表工具只收 ticker、period、limit；價格工具可給日期，但不能因此把財報查詢稱為歷史 as-of。current price 工具更應限制在 live context。沒有執行／成本模型，沒有 survivorship-free universe 或金融 OOS；`none，預測效益不適用`。本次 issues 關鍵字查詢無結果，也沒有用憑證打付費 API 驗證資料完整性。

**借法。** 借小而明確的工具 schema；不直接替換現有來源、不因 API 有 historical prices 就宣稱全部資料都是 PIT。

### stefanoamorelli/sec-edgar-mcp

**判斷／資料。** 用 SEC EDGAR filing／XBRL 提供公司、財報、insider 與可追溯 filing reference；資料取得／抽取工具，不是方向模型。[README](https://github.com/stefanoamorelli/sec-edgar-mcp/blob/86646eb0e23f84eb2b2d1a793c888ad63a8a82bc/README.md)。

**評估嚴謹度。** [financial.py:21](https://github.com/stefanoamorelli/sec-edgar-mcp/blob/86646eb0e23f84eb2b2d1a793c888ad63a8a82bc/sec_edgar_mcp/tools/financial.py#L21) 的 get_financials 明確取 latest matching filing，介面沒有歷史 as_of，因此不能直接放入歷史回放。[evals](https://github.com/stefanoamorelli/sec-edgar-mcp/blob/86646eb0e23f84eb2b2d1a793c888ad63a8a82bc/evals/promptfooconfig.yaml#L225) 有 Promptfoo、JSON／成功狀態／determinism 等檢查；所讀 financial cases 多只檢查可解析且沒有 error，**未逐個比對已凍結 filing 的精確數值、期間與單位**。CI badge 不能當資料全正確或投資有效的證據。無交易／成本、OOS 選股與 survivorship 模型，`none，預測效益不適用`。issues 查詢無相關結果。

**借法。** 借 accession／filing reference 和依工具分組的 eval；若之後要用，優先獨立讀取有 accession 的原始 filing，先確認 XBRL context／期間／單位，再決定是否需要 AGPL MCP server。不是本輪必須新增的依賴。

## 個人／小團隊市場儀表板：逐案評估

### jwbradley/MarketBreadth

**判斷／資料。** S&P 500／sector breadth、股票 setup／entry score、規則 pass/fail 與 earnings expected move，Yahoo／Nasdaq 為主要來源。判斷多是技術分數與操作標籤，與現有個股邊界不相容。[README](https://github.com/jwbradley/MarketBreadth/blob/06ff7685a30d0161faa5591d11abaa832c2660fa/README.md)。

**評估嚴謹度／issues。** [cache 文件](https://github.com/jwbradley/MarketBreadth/blob/06ff7685a30d0161faa5591d11abaa832c2660fa/README-market_cache.md) 解釋跨腳本共用 OHLCV／calendar／earnings cache，而且特別區分仍在形成的日線與收盤資料；也有失敗時回傳舊 cache 的路徑，不能無標示照抄。沒有找到 PIT membership、完整成本、封存 OOS 的 setup／entry 效益驗證：`none，效益未判定`。issues 關鍵字查詢無結果。文件中的範例輸出與快取節省宣稱未由本輪實跑覆核。

**借法。** 借「快取種類有不同有效期／可用狀態」的契約。現有 `web/scripts/ai-batch.ts:95` 已按 symbol 共用 Yahoo 搜尋 Promise，所以不再建議重做同次批次去重。breadth 不進機率，也不新增技術評分作選股。

### wgeul/open-spx

**判斷／資料。** 最接近本 App 歸因問題：歷史 constituents 建 membership matrix，使用者供應價格、market cap／shares 與指數 CSV；可算前一日權重乘當日報酬，也可用 prior-constrained RNN 擬合權重。[README](https://github.com/wgeul/open-spx/blob/0532db5ab12162c4443ae681141edc6c170a8160/README.md)。

**評估嚴謹度。** 作者明說不是官方 float-adjusted weights／divisor，歷史成分名單來自非官方整理。更重要的是 [README:296](https://github.com/wgeul/open-spx/blob/0532db5ab12162c4443ae681141edc6c170a8160/README.md#L296) 及 [methodology](https://github.com/wgeul/open-spx/blob/0532db5ab12162c4443ae681141edc6c170a8160/docs/rnn_methodology.md) 明說 RNN 在完整要求期間訓練，是 ex-post smoothing；即使每天用「前日擬合權重」也不會變成當日已知。其複製誤差是樣本內示範，不是 PIT 權重的獨立驗證；不引用該示例數字當 SSGA 對官方 SPX 的誤差估計。`none，預測效益不適用；官方權重還原有效性未證實`。

**issues／借法。** issues 關鍵字查詢無結果。可以借 membership／ticker mapping／corporate-action anomaly 的資料品質清單；不抄 RNN 回推權重、不把高擬合度當真實歸因，亦不為此跑新的市場統計。

### ronitg1/alpha-terminal

**判斷／資料。** 個人研究 dashboard 有 S&P heatmap、watchlist、catalyst calendar、新聞對 thesis 的影響、agent panels，以及股票／options 回測。README 列 Polygon 歷史 option chain 與 broker／公開市場來源；本次未登入或打付費行情確認。[README](https://github.com/ronitg1/alpha-terminal/blob/fbbd244fa0be7a8b68e208e691cb6f4452826314/README.md)。

**評估嚴謹度。** 文件聲稱 next-bar execution、options spread friction、walk-forward／permutation／bootstrap；但本次讀 [validation.py:158](https://github.com/ronitg1/alpha-terminal/blob/fbbd244fa0be7a8b68e208e691cb6f4452826314/src/backtesting/vibe_engine/validation.py#L158) 發現 walk_forward_analysis 是把**已算好的淨值曲線切成時間區段**，沒有逐段訓練、選參數及生成未見資料預測。它是分期間描述，不等於 OOS walk-forward。[同檔:30](https://github.com/ronitg1/alpha-terminal/blob/fbbd244fa0be7a8b68e208e691cb6f4452826314/src/backtesting/vibe_engine/validation.py#L30) 的 Monte Carlo 只打亂既有 trade PnL 順序，測路徑順序，沒有建立「沒有選股／擇時能力」的交易虛無；bootstrap 則逐點重抽 returns，不能替我們的時間相依處理提供替代。這是程式語義查核，沒有執行任何市場資料。

survivorship、LLM cutoff 及 sleeves 模式的 PIT 文本資料，未核實有完整處理；不能把 options 模式的摩擦直接推到所有 agent sleeves。效益證據 `none，效益未判定`；README 描述了工具能力，沒有據此接受已核實的樣本外優勢，也沒有找到足以另列零或負投資效果的獨立重現。

**issues／借法。** [#15](https://github.com/ronitg1/alpha-terminal/issues/15) 是外部預測平台推介，非對它回測的正式審查；不把 issue 內聲稱的已結算預測量當證據。可借 news→thesis-impact、事件日與來源並列；不抄 agent 票數、confidence anchors 或把統計函式名稱當品質標章。

## 共通架構，以及回測為何常不可信

### 可辨識的共通架構

| 層 | 常見做法 | 本 App 值得保留的界線 |
|---|---|---|
| Ingestion | API／filing／新聞→cache→統一欄位 | 確定性程式取得資料；保留原來源與時點 |
| Analysis | 專業角色、persona 或研究 agent 解讀 | 模型可整理文字；價格、點數、單位計算留在程式 |
| Synthesis | 辯論／投票／portfolio manager | 可列支持與反證；不從 agent 人數產生機率或交易權重 |
| Validation | JSON schema、LLM judge、回測工具 | schema、事實忠實度、時間正確性、預測效益分開驗 |
| Persistence | cache、memory、reflection、ledger | 留存當時輸入與原始輸出；不讓事後答案覆寫原記錄 |
| Feedback | 依分數反覆改提示詞、模型或 factor | 內容品質可另設固定 eval；市場模型仍受本 repo 的事前登記約束 |

此表是以上已讀原始碼的歸納，不是效果研究。代表實作：[TradingAgents backtest](https://github.com/TauricResearch/TradingAgents/blob/c4544913a14ed3df5f1ed7b9e8483270ce20682a/tradingagents/backtest.py)、[ai-hedge-fund v2 hierarchy](https://github.com/virattt/ai-hedge-fund/blob/b33175caa1289e180b535d663c89b7a0c04b4726/hedge_fund/README.md)、[Dexter evaluator](https://github.com/virattt/dexter/blob/534f6be455523c5926eba72bdaf4f914555be5c9/src/evals/evaluator.ts)、[FinRobot prompt eval](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/scripts/_prompt_eval_equity_research.py)。

### 常見缺陷：依本次查到的實例排列

- **同一天不代表同一資訊集。** 決策時點、新聞 published_at、filing accepted_at、成交起點需同一時區／交易日契約。TradingAgents 的已修 #1518 是實例；「date-aware」這個名稱不夠。[issue 與修正回覆](https://github.com/TauricResearch/TradingAgents/issues/1518)。
- **期間末日、公布日、重編日、抓取日被混成一個 date。** FinGPT 目前的固定延遲沒有變成精確 publication；FinRL 舊檔的 bfill 還會把後來值搬回去。反面對照是 Qlib 的 date／period／version 設計。[FinGPT](https://github.com/AI4Finance-Foundation/FinGPT/blob/ac5c5443fbeeafad801e7a3c188e4f24cfaad4d8/fingpt/FinGPT_Forecaster/basics.py)、[FinRL](https://github.com/AI4Finance-Foundation/FinRL/blob/7e98df461cbc7772f16a545a2f13b521e5d0b8f4/finrl/applications/stock_trading/fundamental_stock_trading.py#L305)、[Qlib](https://github.com/microsoft/qlib/blob/54355232463878d2eebb91fe0ee5fa7fa1f5976c/docs/advanced/PIT.rst)。
- **基礎 LLM 的知識污染，不能只靠 API 的 as_of 解決。** 使用較新的模型重跑舊歷史，即使工具輸入時間正確，也無法單靠 prompt 證明 weights 沒有後來資訊。本輪只有質疑與作者答辯，沒有核實通用的排除方法；所以不把模型自述「只用當時資料」升級為獨立檢驗。[TradingAgents #805](https://github.com/TauricResearch/TradingAgents/issues/805)、[FinMem #17](https://github.com/pipiku915/FinMem-LLM-StockTrading/issues/17)。
- **選中的股票、可取得新聞的股票、目前成分股，不是歷史完整 universe。** FinRL 新範例有修正，open-spx 也明列非官方 membership 的不完整性；不能把它們的誠實限制省掉。這是資料偏差，不是多加一位 risk manager 會消失的問題。[FinRL 新範例](https://github.com/AI4Finance-Foundation/FinRL/blob/7e98df461cbc7772f16a545a2f13b521e5d0b8f4/examples/FinRL_StockTrading_2026_1_data.py)、[open-spx](https://github.com/wgeul/open-spx/blob/0532db5ab12162c4443ae681141edc6c170a8160/README.md#L196)。
- **評估名稱比實作強。** Alpha Terminal 的切段報表並非重新訓練的 OOS；打亂已發生 trade PnL 的虛無也不是無擇時能力虛無。EDGAR MCP 的成功回應斷言，不等於數字與期間精確核對。[validation](https://github.com/ronitg1/alpha-terminal/blob/fbbd244fa0be7a8b68e208e691cb6f4452826314/src/backtesting/vibe_engine/validation.py)、[financial evals](https://github.com/stefanoamorelli/sec-edgar-mcp/blob/86646eb0e23f84eb2b2d1a793c888ad63a8a82bc/evals/promptfooconfig.yaml#L225)。
- **投資收益與其他指標被混用。** NLP benchmark／研究回答正確度、獨立決策 alpha、投組淨報酬、二元 Brier，是不同輸出；本輪不能由任何前者推論能改善我們既定 horizon 的機率。[Dexter](https://github.com/virattt/dexter/blob/534f6be455523c5926eba72bdaf4f914555be5c9/src/evals/evaluator.ts)、[TradingAgents scope](https://github.com/TauricResearch/TradingAgents/blob/c4544913a14ed3df5f1ed7b9e8483270ce20682a/tradingagents/backtest.py#L9)。
- **無限 feedback loop 與記憶不等於學到穩健規則。** RD-Agent 的迭代目標是自動搜尋，FinMem 也會調 memory／profile；與我們的試驗名額與禁止偷看直接相撞。這是使用方式衝突，不是否認作者在另一任務的結果。[RD-Agent 論文](https://arxiv.org/html/2505.15155v2)、[FinMem 論文](https://arxiv.org/html/2311.13743v2)。

**效益結論的邊界。** FinMem 與 RD-Agent 有作者宣告的學術時間切分正結果，不能寫成「所有 LLM 都沒有用」；但它們的資產、目標、資料時點與搜尋程序，不構成我們的新輸入採用證據。本輪也沒有完成任何已排除污染、可獨立複製的交易收益核驗，故不頒給任何專案 `independently_tested` 的金融有效性標章。工程缺陷是負面發現；不是把未重算的投資效果硬寫成顯著負報酬。

## 對應本專案的具體採用方案

以下全是提案，未實作。成本以本專案既有 TypeScript／D1／本機 Orca 架構判斷，沒有虛構工時或 API 費用估算。

### F-01：把每次 AI 批次保存成可重播的證據包

**已確認缺口。** `web/scripts/ai-batch.ts:196` 每次 pull 覆寫 tasks／answers；`web/scripts/ai-batch.ts:216` 預設 model 只有 claude-orca 標籤；`web/src/server/ai-batch.ts:183` 的日摘要是 upsert，保留 newsIds／model／created_at，但沒有完整 prompt／原文輸入版本。現有 snapshot revisions（`web/db/schema.ts:43`）已是不可變版本，**不用再替它重建另一套 ledger**；新缺口在 AI 批次。

**借哪裡。** ai-hedge-fund 的 session record 與資料快取，以及 zipline 的 ingestion snapshot 概念。[v2 ledger](https://github.com/virattt/ai-hedge-fund/blob/b33175caa1289e180b535d663c89b7a0c04b4726/hedge_fund/README.md#L87)、[bundle 文件](https://zipline.ml4trading.io/bundles.html)。

**具體規格。** 本機每批保留 run ID、實際模型識別（取得不到就標不詳）、prompt／schema／程式版本、原始答案、輸入 hash、文章來源／轉載 URL／抓取時間、所用 snapshot revision。派生摘要可以更新，原始包不覆寫。若想存 R2，先處理容量與原文保存／再散布範圍；不預設把付費或完整文章公開。現有 Yahoo Promise cache 已有，不再重做同次批次去重。

**成本／風險。** 中；主要是留存與查閱，非多開 agent。風險為內容版權、儲存、可取得的模型版本不精確。`none`：有可追溯性設計依據，沒有收益改善證據。服務資料／流水線／d；不碰 forecast 計算，不需市場事前登記。

### F-02：新聞 eval 用 atomic facts，分開處理算術、來源與推論

**對應。** `web/src/lib/news-ai.ts:19`、`:42`、`:49` 是結構 schema；`:132`／`:172` 是摘要 prompt；`web/src/server/ai-batch.ts:139` 匯入驗證格式。目前這些不是事實驗證器。`web/scripts/ai-batch.ts:162` 已要求有正文才產生文章重點，保留此既有規則，不再當成新建議。

**借哪裡。** [Dexter atomic rubric](https://github.com/virattt/dexter/blob/534f6be455523c5926eba72bdaf4f914555be5c9/src/evals/evaluator.ts#L48)、[FinRobot synthetic prompt eval](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/scripts/_prompt_eval_equity_research.py)。先設可人工核對的內容金標：金額／幣別／期間是否對、引用是否真的支持句子、標題與內文是否混淆、沒有催化因素時是否硬編因果、是否違規輸出買賣建議。數字與來源 ID 先確定性比對，LLM judge 只判語義，保留人工裁決。不拿 self-rating 直接當金標。

**成本／風險。** 低至中；人工金標是主要成本。只評文章忠實度，不以未來股價當答案，不跑市場回測。`none`：待驗證的內容品質方案，不能宣稱提高報酬。服務 d／流水線／呈現；不用新 forecast 名額。這補的是評估，沒有重提前輪已決定的摘要資訊順序。

### F-03：新增資料才採 publication／observation／retrieval 分離契約

**對應。** `web/db/schema.ts:32` 的權重已有 asOf 與 fetchedAt；`:64` 的新聞已有 publishedAt 與 fetchedAt。不是宣稱這些欄位不存在。若未來接 EDGAR／analyst vintage，才加 period／published或accepted_at／retrieved_at／source document ID／revision，並保留原版本；只有當可用時間不晚於研究 cutoff 的資料才可進當時輸入。

**借哪裡。** [Qlib PIT](https://github.com/microsoft/qlib/blob/54355232463878d2eebb91fe0ee5fa7fa1f5976c/docs/advanced/PIT.rst) 的同 period 多版本、[TradingAgents FRED vintage](https://github.com/TauricResearch/TradingAgents/blob/c4544913a14ed3df5f1ed7b9e8483270ce20682a/tradingagents/dataflows/vendors/fred.py#L195)。publication 無法確認時就標不詳，不用 fiscal date、today 或任意固定 lag 冒充。快取鍵需要含查詢條件與 vintage，**TTL cache 不能當 PIT archive**。

**成本／風險。** 中；若要完整回補過去 publication／revision 則高，本輪不建議回補。供應商只給 latest 的資料無法靠 schema 補救。`none`：資料正確性方案，不是新預測變數。服務資料／流水線；純前向存證不需市場登記，若日後拿新資料改標籤／條件／歷史樣本，必須先登記，且現有排除清單仍有效。

### F-04：scoringrules 只作合成資料的計分參照

**對應。** `web/src/lib/forecast.ts:481`／`:482` 計算 binary Brier／BSS；`:264` 已管 knownOn，不需要再建 purge／embargo。以 [scoringrules Brier](https://github.com/frazane/scoringrules/blob/e48aa74fdbf2d916ade569e1b7516286dbc8b303/scoringrules/_brier.py#L10) 作離線 reference oracle，確認逐點平方誤差、平均、事件互補及模型等於 baseline 時 BSS 為零的約定；缺值與基準 Brier 為零的政策由我們明定，不能默默繼承另一套件。

**建議計算（未執行）。** 僅生成沒有市場意義的 outcomes／probabilities 合成 fixture，對照 TS 與 reference 的逐點 Brier。另對獨立單股公式作 instrument 排序／子集不變性，對已知時間輸入作 future append 不變性；**跨公司排名與名單總和本來會隨 universe 變，不套錯這個不變性**。這個界線來自 [RD-Agent #520](https://github.com/microsoft/RD-Agent/issues/520)，不借機重算真實 SPX／VIX。

**成本／風險。** 低；可只參照公式／固定輸出，不新增 production Python runtime。`none`：核對計分實作，沒有預測力主張。服務資料／流水線；不改公式或模型、不碰歷史市場結果，不需市場事前登記。若發現須改已登記計分規則，另依原流程處理。

### F-05：把「加碼研究／檢討」做成有反證的研究紀錄，先維持手動

**對應。** `web/src/server/views.ts:224` 是規劃預設；`web/pages/etfs.tsx:222` 目前只算可分筆數、顯示門檻文字；`web/src/lib/plan.ts:17` 只驗輸入範圍。沒有持倉成本、批次成交或檢討觸發器，不能假定已能自動算出門檻事件。

**借哪裡。** [Anthropic thesis-tracker](https://github.com/anthropics/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/equity-research/skills/thesis-tracker/SKILL.md) 的 original expectation、支持／反證、已發生變化、待查證事項、下一個事件、來源與版本。讓使用者每次研究預算或主動檢討時填一張紀錄，可先用現有 notes 的人工格式試用，再決定是否結構化儲存。

**產品界線。** 不採 Long／Short、conviction、Increase／Trim／Exit、stop-loss、目標價或自動投票。若日後真的計算漲跌檢討門檻，需要人先決定相對成本、上次檢討價或其他基準；這是尚未定案的產品語義，不是 agent 自行選的規則。紀錄不宣告「現在應該加碼」。

**成本／風險。** notes 範本低；多使用者歷史紀錄與 UI 中。主要風險是把「資料支持程度」誤讀成「報酬信心」。`none`，未證明改善投資決策或收益。服務 b／c／d／呈現；只做文字與留存不需市場登記；任何機率／交易規則都不在此提案授權範圍。

### F-06：如要試多角色，只試同一證據包的「事實／反證／編輯」

**對應。** 延伸既有本機 Orca→`web/scripts/ai-batch.ts:131` 任務→`web/src/lib/news-ai.ts:132`／`:172` 摘要流程，不在 Worker／route 接模型。角色共用 F-01 的凍結資料：先抽可核對事實，再指出哪些敘事缺證據，最後編輯成短摘要；編輯可保留「尚無結論」。原始來源 ID 由程式還原，避免模型重打 URL。

**借哪裡。** 借 [TradingAgents 結構化角色分工](https://github.com/TauricResearch/TradingAgents/blob/c4544913a14ed3df5f1ed7b9e8483270ce20682a/README.md#L72)，以 [Dexter rubric](https://github.com/virattt/dexter/blob/534f6be455523c5926eba72bdaf4f914555be5c9/src/evals/evaluator.ts) 評價內容。僅是品質實驗，不預設比既有單次摘要更好；先按 F-02 凍結金標做人工盲評，再決定是否值得額外模型呼叫。不得用漲跌命中率或同一段市場史選版本。

**成本／風險。** 中；多輪增加延遲與費用，而且同一模型／資料的角色高度相關，不能當獨立專家樣本。`none，內容效益未判定`。服務 d／流水線／呈現；不更動數值展望，也不把共識比例轉 P(up)、P(dd5) 或部位。不需市場事前登記，但內容 eval 規格應事先固定。優先度低於 F-01／F-02，沒有品質改善就不採。

## 明確不該抄的東西

| 做法 | 本輪新增的具體理由 | 與既有規則的關係 |
|---|---|---|
| 把 bull／bear／risk manager 共識變成交易指令或 confidence 機率 | TradingAgents 當前評估不是投組模擬；persona／辯論數量沒有獨立預測效益證據 | 抵觸個股不給建議；票數合成也碰 X01 |
| 依 AI conviction、dd5 或 DRL reward 分配定投／加碼 tranche | 這些 repo 的目標是交易／配置，並沒有驗證我們的台幣定投決策 | 抵觸 X03／L17 與永久否決的 meta-labeling |
| 用 RD-Agent 自動探索 forecast 條件 | 它的主要功能就是以回饋反覆搜尋，會消耗／繞過我們的登記名額 | 抵觸新條件先登記及 P(up) 不開名額 |
| 把 cutoff 參數／固定延遲當精確 PIT | FinGPT 現行近似 lag、MCP latest 查詢都有實際原始碼反例 | 不得用它們重建乾淨 holdout 的幻覺 |
| 把 open-spx RNN 權重／誤差當官方 SPX 史或本 App 誤差 | 作者明言 full-window ex-post、不可識別；高擬合不證明真權重 | 不重開前輪權重誤差統計；沒有執行新估計 |
| 整套搬入 DCF／目標價、stop-loss、投票選股 skill | thesis-tracker 的 action 欄位實際包含加減碼與退出 | 與 d 的目前邊界衝突；只能改寫紀錄欄位 |
| 把「walk-forward／Monte Carlo／evals」字樣當採用證據 | Alpha Terminal 切段曲線、PnL 順序虛無；EDGAR MCP 成功斷言的實例 | 不降低我們既有 BSS／bootstrap／置換門檻 |
| 為本 App 導入整套交易引擎／金融終端 | 僅需少量確定性計算與文字管線，資料清洗問題不因引擎變大而解決 | 不新增資料源／執行層的無必要負擔 |
| 在測試結果上學 calibrator、重選 bins 或拚最低 ECE | PyCalib 是工具，不提供可免除資料窺探的外衣 | 不重提已排除的頁面 reliability 圖，不改 L10 |
| 靜默用舊 cache／latest／BSM 等替代值填滿答案 | MarketBreadth／Alpha Terminal 的便利路徑會改變時點或估值口徑 | 本 App 需先有具體失敗與清楚來源語義，不能為「完整」偷偷換資料 |

## 核實缺口與停止點

一手原始碼與所引 GitHub issues 可讀；本輪主要限制不是付費牆，而是「沒有跑市場實驗、沒有供應商憑證、沒有獨立重現」。未讀到的績效細節已明標未核實，沒有拿二手部落格的 Sharpe、報酬或偏差估計補空白。

外部文獻搜尋另看到 StockBench 的摘要與結果表對「多數模型是否打敗 baseline」敘述不一致；本報告沒有拿摘要當統一的負結果，也未將其列入已完成 metadata／issues 的專案清單。它不是本輪任何採用建議的證據。來源：[StockBench 原文](https://arxiv.org/html/2510.02209)（2026-10-28 讀取）。

**未實測：** 本輪依研究限制沒有啟動第三方平台、下載模型、交易 paper account 或本 App，也沒有 GUI 驗收；唯一執行的外部內容檢查是對官方 MCP 設定文字做標準 JSON 解析。這不影響上述靜態缺陷的證據層次，但不能延伸宣稱已測其實際安裝／效能。

達到專案涵蓋及共通架構、可採方案、不採方案的要求後停止；沒有為填更多專案而繼續搜尋，也沒有重開任何市場模型試驗。

## 給整合者的摘要

### 關鍵發現（3–8 條，每條附證據等級與來源）

- **沒有找到可直接採用的 LLM 交易 alpha。** TradingAgents 現行 backtest 明說評獨立決策，不是投組與成交模擬；角色辯論、stars 與自我反思不能背書我們的指數機率或個股推薦。證據等級：`none`，投資效益未判定。[現行評估範圍](https://github.com/TauricResearch/TradingAgents/blob/c4544913a14ed3df5f1ed7b9e8483270ce20682a/tradingagents/backtest.py#L9)（2026-10-28 查核）。
- **有正面的學術時間外結果，但任務不同。** FinMem 是美股單股交易，RD-Agent 主要是中國股票橫斷面排名／投組；兩者皆為 `academic_oos，正`，依作者宣告切分，未獨立複製，不能外推到本 App 的指數月方向。[FinMem 論文](https://arxiv.org/html/2311.13743v2)（2023-12-03 v2）、[RD-Agent 論文](https://arxiv.org/html/2505.15155v2)（2025-09-25 v2）。
- **PIT 修正必須讀目前程式。** FinGPT 關閉 issue 後仍以固定延遲近似公布日；FinRL 新範例已加入歷史 membership，舊基本面範例仍有整表 bfill。證據等級：`none`；這是負面工程發現，不是已估出的投資效果。[FinGPT](https://github.com/AI4Finance-Foundation/FinGPT/blob/ac5c5443fbeeafad801e7a3c188e4f24cfaad4d8/fingpt/FinGPT_Forecaster/basics.py)、[FinRL 舊檔](https://github.com/AI4Finance-Foundation/FinRL/blob/7e98df461cbc7772f16a545a2f13b521e5d0b8f4/finrl/applications/stock_trading/fundamental_stock_trading.py#L305)、[新範例](https://github.com/AI4Finance-Foundation/FinRL/blob/7e98df461cbc7772f16a545a2f13b521e5d0b8f4/examples/FinRL_StockTrading_2026_1_data.py)（2026-10-28 查核）。
- **評估名稱可能比實作強。** Alpha Terminal 的 walk-forward 是切割既有曲線；其 permutation 只打亂既有 trade PnL，不能證明選股／擇時能力。證據等級：`none`，投資效益未判定；靜態查核結果為負面。[validation.py](https://github.com/ronitg1/alpha-terminal/blob/fbbd244fa0be7a8b68e208e691cb6f4452826314/src/backtesting/vibe_engine/validation.py)（2026-10-28 查核）。
- **最合適的工具是離線計分參照。** scoringrules 可核對合成資料的 Brier；properscoring 已 archived；PyCalib 不自動處理時間相依或防止測試集校準。證據等級：`none`，不主張提高預測力。[scoringrules](https://github.com/frazane/scoringrules/blob/e48aa74fdbf2d916ade569e1b7516286dbc8b303/scoringrules/_brier.py)、[properscoring](https://github.com/properscoring/properscoring)、[PyCalib](https://github.com/classifier-calibration/PyCalib/blob/8208ab907d5b9c5149b2d45b1c8b6e4b2d763317/pycalib/visualisations/plot.py)（2026-10-28 查核）。
- **官方金融 plugin 也需要驗證，且不能整份照搬。** Anthropic 的 thesis-tracker 可借反證紀錄，但含加減碼／退出欄位；其核心 MCP 設定本次標準 JSON 解析失敗，與公開 issues 相符。證據等級：`none`，沒有投資效益檢驗。[thesis-tracker](https://github.com/anthropics/financial-services/blob/574ed3624aebd0418c7e96cd101262f30210ab26/plugins/vertical-plugins/equity-research/skills/thesis-tracker/SKILL.md)、[設定缺陷 issue](https://github.com/anthropics/financial-services/issues/355)（2026-10-28 查核）。

### 對我們 App 的建議

| ID | 建議 | 服務哪個決策（a 每月定投／b 加碼研究預算／c ±20% 檢討／d 觀察名單個股／資料／流水線／呈現） | 證據等級 | 成本（低／中／高） | 需事前登記？ | 與既有規則或排除清單衝突？ |
|---|---|---|---|---|---|---|
| F-01 | 在 `web/scripts/ai-batch.ts:196` 保存不可覆寫的輸入、原始答案、版本、來源與 snapshot revision | d／資料／流水線 | none；可稽核性設計 | 中 | 否，純存證 | 無；沿用本機 Orca，不另接 Worker 模型 |
| F-02 | 在 `web/src/lib/news-ai.ts:132` 對應流程建立 atomic-fact 金標，分開驗數字、來源、因果與越界建議 | d／流水線／呈現 | none；內容效益待驗 | 中 | 不需市場登記；內容 eval 先固定 | 無；不以未來股價選提示詞 |
| F-03 | 新來源採 publication／period／retrieval／revision 分離；借 [Qlib PIT](https://github.com/microsoft/qlib/blob/54355232463878d2eebb91fe0ee5fa7fa1f5976c/docs/advanced/PIT.rst)，不把 latest 或固定 lag 當精確 PIT | 資料／流水線 | none；資料契約 | 中 | 前向存證否；改模型／歷史輸入須先登記 | 無；不新增被否決的變數 |
| F-04 | 用 scoringrules 對照 `web/src/lib/forecast.ts:481`，僅使用合成 fixture，保留既有 BSS／bootstrap 規格 | 資料／流水線 | none；計分正確性 | 低 | 否；若須改登記規則則另處理 | 無；不跑真實市場資料、不新增校準層 |
| F-05 | 先用 notes 試有來源與反證的研究紀錄，對應 `web/pages/etfs.tsx:222`；維持手動檢討 | b／c／d／呈現 | none；決策效益待驗 | 低 | 純紀錄否 | 刪去 action／conviction／stop-loss；不產生買賣或扣款建議 |
| F-06 | 只在既有批次試「事實／反證／編輯」，先盲評內容品質，再決定是否增加模型呼叫 | d／流水線／呈現 | none；內容效益待驗 | 中 | 不需市場登記；內容 eval 先固定 | 不得投票成機率或部位；優先度低於 F-01／F-02 |

### 建議不要做的事與理由

- 不採 agent 共識、persona conviction、DRL 或 reflection 調整定投／加碼部位；沒有本產品決策的合格證據，且碰觸 X03／L17。
- 不讓 RD-Agent 自動挖 forecast 條件，不在同一段市場史改提示詞、校準器或門檻；會污染登記與試驗名額。
- 不用 open-spx 全期擬合的 RNN 權重當歷史真實權重，不把其樣本內複製誤差當本 App 的近似誤差。
- 不為目前需求搬入大型交易引擎或整套金融 plugin；資料授權、PIT 與評估責任仍需自己處理。

### 未核實、不確定、需要人判斷的地方

- 沒有安裝第三方平台、操作 GUI、打付費行情或執行市場回測；交易收益、完整成本、退市資料與所有模型 checkpoint 的時間污染未獨立核實。
- issues 的自行計算未覆算；OPEN／CLOSED 不能單獨代表仍有漏洞或已完全修好。Dexter 的 README 宣稱 MIT，但授權文本未核實。
- 多角色能否改善我們的摘要尚無證據；需要內容金標與人工盲評，不能以辯論較長作結論。
- 若日後將檢討門檻做成實際觸發器，仍須人決定比較錨點與資料定義；本輪沒有替使用者發明交易規則。

