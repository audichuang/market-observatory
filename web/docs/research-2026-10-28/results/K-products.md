# 任務 K：同類產品怎麼呈現「判斷」

研究日：2026-10-28（Asia/Taipei）。對象：以台幣定投 S&P 500 ETF、另有美股觀察名單的台灣長期投資人。

**結論：值得補的是研究與檢討流程、費用及現金流假設、持倉穿透與來源追溯；本輪沒有找到可讓我們把新綜合分數、景氣燈號或 AI 意見包裝成指數交易判斷的證據。** 個股選股證據與指數擇時證據必須分開；Seeking Alpha 有一項本輪讀到作者全文的新證據，詳見下文。

## 範圍、查核方式與證據語意

- 已讀 `web/docs/forecast.md` 的既有產品／判斷流程研究，以及 `web/docs/research-2026-10-27/proposal.md` 的排除清單與下一輪問題。Morningstar、TradingView、Seeking Alpha、Yardeni 與既有章節重疊的部分僅保留比較所必需的短述，重點放在新功能、價格、查核限制與新證據。
- 比較下列指定產品，台灣券商選國泰證券與富邦證券；台灣資訊平台選 CMoney「美股夢想家 PC」。研究只讀官方公開網頁、官方說明文件與作者論文。沒有使用 ego-browser、Playwright 或任何瀏覽器自動化；沒有登入、訂閱、開戶或操作付費介面。**官方文件可讀，不代表實際 App 畫面已查看。**
- 所有產品現況、價格與更新頻率的查閱日均為 **2026-10-28**；每個數值敘述另附一手連結。價格保留頁面實際幣別、帳期及地區，不換算台幣、不推算未顯示的月繳／年繳價格。網站返回錯誤或只剩 JavaScript 外殼時，索引摘錄一律標「未核實」，登入後畫面標「未查看」。
- `bank_claim` 在本報告也涵蓋非銀行的產品提供者自述。功能存在、方法可解釋、附免責，均不等於預測有效。`none` 表示本輪沒有核實相應預測效度；**不把未檢驗寫成零效果**。只有實際提出「有效／有預測力」的主張才列正、零或負；純描述工具的結果為「不適用」。
- 沒有下載市場歷史供計算、沒有執行新回測、探索性統計或線上工具的預設回測。報告中的歷史績效只引用文獻。不修改程式、事前登記、功能地圖或其他研究檔；本輪只交付本檔。

## 功能矩陣

符號：●＝公開官方文件可確認此功能；△＝間接服務此需求，或只有索引摘錄／公開說明而未看介面；？＝本輪未查看或無法確認。格內描述不代表功能有效。每列來源與限制見後面的同名產品段落。

| 產品 | 指數／總經判讀 | 個股判讀／分數 | 定投／現金流 | 不確定性呈現 | 公開歷史戰績／檢驗 | AI／來源追溯 | 台灣實際執行 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MacroMicro | △ 景氣循環、自編指標 | ● 財報與研究平台 | △ ETF 研究 | ？ 專有指標校準未核實 | ？ 未核實合格 OOS | ● 財報會議 AI 摘要 | △ 中文，非下單 |
| Koyfin | ● 跨資產儀表板 | ● 財務、估值、共識 | △ 個人組合追蹤 | ● 資料時間戳；非機率區間 | ？ 未見統一訊號戰績 | ● filings／transcripts 入口 | △ 未確認台幣扣款 |
| Finviz | ● 熱圖、群組 | ● 篩選、圖形辨識 | △ ETF 持股與交易紀錄 | ？ 未見校準 | ？ 付費回測介面未查看 | ● SEC filings 提醒；AI？ | ？ 未確認 |
| TradingView | ● 多週期 Technical Ratings | ● 技術評等 | △ 提醒、圖表 | ● 方法文件；非機率 | ● 自訂策略測試，非平台有效性證明 | △ 腳本可查，依作者 | ？ 未確認台幣流程 |
| Seeking Alpha | △ 市場文章，非 Quant 擇時 | ● Quant／作者／sell-side | △ Portfolio Health、提醒 | ● 因子拆解；非預測區間 | ● 學術 OOS，限個股橫斷面 | ● AI research 功能文件 | ？ 台幣定投未確認 |
| Morningstar Investor | △ 市場估值背景 | ● 估值、護城河、評等 | ● 組合管理 | △ Uncertainty 方法；當前頁受阻 | △ 個股評等證據本輪未重做 | ● 研究報告；組合穿透△ | △ 中文／台幣執行未確認 |
| Simply Wall St | △ 市場／產業摘要 | ● Snowflake、估值 | ● 組合、股息分析 | ● 評分拆解、明說非買賣建議 | ？ 未見可核實 Snowflake OOS | ● Notes、Charlie AI 方案 | △ 非券商 |
| StockCharts | ● 市場圖表、輪動圖 | ● SCTR 技術相對排名 | △ ChartLists／提醒 | ● 指標教育；非機率 | ？ 未核實 SCTR OOS | ● 方法教育與圖表註記 | ？ 未確認 |
| Yardeni 圖表庫 | ● 指數、獲利、總經圖庫 | △ 產業／研究敘事 | △ 長期背景 | △ 情境敘事，非校準機率 | ？ 圖庫本身非績效檢驗 | ● 研究助理有引文，介面未查看 | △ 非下單 |
| Fiscal.ai | ？ 終端未查看 | ● API 財務、KPI、兩種共識 | △ 研究工具 | ● 原始／標準化數據分開 | ？ 未見 AI estimates OOS | ● 數值連回 filing 圖片／PDF | ？ 未確認 |
| Portfolio Visualizer | ● 資產類別／組合分析 | △ 因子與風險分析 | ● 現金流、費用、模擬 | ● 模擬分位與方法 | ● 使用者歷史回測，非預測認證 | ● 資料來源表 | △ 台灣費稅須自行設定 |
| testfol.io | ● 資產／組合／戰術工具 | △ 資產、因子分析 | ● 現金流、退休模擬、Tactical DCA | ● 歷史與模型路徑明確分開 | ● 使用者回測，非預測認證 | ● 真實／模擬序列來源表 | △ 台幣流程未確認 |
| Yahoo Finance | △ 指數、報價與市場資訊 | △ Morningstar／fair value | △ 組合風險、分散度 | ？ 付費畫面未查看 | ？ 本輪未核實 | △ 資料供應商表；原頁受阻 | △ 可作資訊入口 |
| Perplexity Finance | △ 搜尋式市場研究 | △ 財務、共識、AI 故事 | ？ 未確認專屬定投 | △ 引文不是校準 | ？ 未核實 AI 投資戰績 | △ Finance 頁受 JS 限制 | ？ 未確認 |
| Robinhood Gold | △ 市場／公司研究 | ● Morningstar research | △ recurring investments 與研究不同功能 | △ 繼承研究方法，App 呈現未查看 | ？ 未核實 Gold 帶來的增益 | △ Cortex／研究，畫面未查看 | ？ 台灣開戶資格未查 |
| Public.com | ● AI 市場／資產研究文件 | ● Alpha、analyst research | ● Investment Plans 文件 | ● AI 可能出錯警語 | ？ 未核實 Alpha 戰績 | ● filings／calls；畫面未查看 | ？ 台灣開戶資格未查 |
| 國泰證券 App | △ 市場資訊，介面未查看 | ？ 美股評分未確認 | ● 美股定期投資 | ● 費用、交易流程與限制 | ？ 未見美股加減碼效度 | ？ 美股 AI 未確認 | ● 美元定額與扣款流程 |
| 富邦證券 AI PRO | ● 市場與事件資訊文件 | △ 智慧分析，美股覆蓋未查看 | ● 美股定期定額文件 | △ 費用／庫存條件 | ？ 未核實 AI 選股績效 | ● AI 晨報／摘要宣傳，適用市場未確認 | ● 複委託與定期庫存分開 |
| CMoney 美股夢想家 PC | ？ 指數專屬判斷未查看 | ● 便宜／昂貴價；燈號△ | △ 股息組合研究 | ？ 模型敏感度未查看 | ？ 沒核實訊號完整戰績 | △ 中文化研究，AI 未確認 | △ 資訊軟體，非下單 |

這張表顯示的是產品定位。Portfolio Visualizer／testfol.io「有回測」與 Seeking Alpha「有文獻檢驗」是不同事情；圖表工具能產生漂亮的歷史曲線，不構成平台訊號可預測未來的證據。

## 各產品查核

### MacroMicro 財經 M 平方

**提供的判讀。** 指數／總經端以景氣循環、自編指標和研究解讀連結資產；個股端，官方幫助中心可確認高階方案包含美股財報與 AI 財報會議摘要；對定投者較接近 ETF 研究、行事曆與總經閱讀入口，未核實有台幣定投現金流計算。官方的「MM 美國景氣循環圖」原頁返回 **403**，本輪實際只讀到搜尋索引關於景氣位置與風險資產修正的文字，該預測敘述**未核實**。[方案權益](https://dev-support.macromicro.me/zh-tw/faq/142)、[景氣循環圖](https://www.macromicro.me/charts/64/econ-cycle)

**不確定性／戰績。** 未查看付費儀表板、AI 回答與完整方法；在可讀的權益說明中沒有可核實的基準率、校準表或事前凍結的樣本外成績。景氣分類不等於指數上漲機率。證據：`none`；結果未檢驗，期限／市場依各自指標，不能視為 S&P 500 指數報酬證據，也不是本輪已檢驗的橫斷面選股。

**資料／頻率。** 權益頁公開列出總經資料庫、研究工具、日曆與財報資料，但不能由此確認各資料供應商或每項數據延遲；應以個別圖表標示為準，這些圖表本輪多未查看。報告與摘要的出版頻率不等於底層數據更新頻率。[方案權益](https://dev-support.macromicro.me/zh-tw/faq/142)

**收費／存取。** 2026-10-28 可確認 MM PRO、MM Prime、MM Max／Max AI 等方案名稱；[公開訂閱頁](https://www.macromicro.me/subscribe)與 `/pro` 都返回 403，**金額未查看**，不引用舊價或促銷碼頁價格。

### Koyfin

**提供的判讀。** 指數端是 market／macro dashboards；個股端是財務、估值、analyst estimates、filings、transcripts 與 screener；對定投者是 My Portfolios、ETF holdings 與投資組合分析。本輪可讀的方案頁沒有把所有資訊合成平台統一買賣分數。[功能與方案](https://www.koyfin.com/Pricing/)

**不確定性／戰績。** 最直接的借鑑是每個報價有 last-trade timestamp，以及明說 live／delayed 混合。未查看登入後的分析與績效畫面；公開方案／資料說明未提供統一判斷的基準率、命中率或 OOS 檢驗。證據：`none`，結果不適用；這裡是資料工作台，沒有核實一項固定期限的指數或選股策略。

**資料／頻率。** 2026-10-28 官方 FAQ 說美股混合 live 與 **15 分鐘延遲**，加拿大延遲 **15 分鐘**，其他國家為 EOD；價格預設調整股息與拆股。資料類別可查，但本輪未逐項核實 vendor 與基本面傳輸延遲。[即時性 FAQ](https://www.koyfin.com/help/faq/is-your-data-live-or-delayed/)、[Data Overview](https://www.koyfin.com/help/data-overview/)

**公開價格。** 2026-10-28 價格頁列 Free **US$0／月**、Plus **US$39／月**、Premium **US$79／月**、Advisor Core **US$209／月**、Advisor Pro **US$299／月**。擷取也有 annual 切換與優惠字樣，未操作切換／結帳，這裡只記當次顯示的數字，不推算年費。官方 `llm-info` 對 Free 是否含 portfolio 的描述與價格頁不同，本報告以價格頁列的 My Portfolios 為準，實際權限未查看。[價格頁](https://www.koyfin.com/Pricing/)、[另一官方說明](https://www.koyfin.com/llm-info/)

### Finviz

**提供的判讀。** 指數端以 heatmaps、Groups、ETF holdings 解釋市場結構；個股端用基本面／技術條件篩選與 automatic pattern recognition。對定投者可研究 ETF 組成、觀察名單與 portfolio transactions；這些不是扣款建議。[Finviz Elite](https://finviz.com/elite)

**不確定性／戰績。** 公開頁能確認篩選與圖形工具，但未查看 Elite 的技術策略回測介面，也沒有核實圖形訊號的固定預測期限、基準率或完整 OOS 戰績。證據：`none`，結果未檢驗；股票篩選通常是橫斷面條件，不能變成指數方向機率。舊的官方 Elite 入口索引仍出現 Technical Studies Backtest，現行落地頁偏重互動圖表；不把索引中的舊功能視為已驗收。[舊入口](https://elite.finviz.com/elite)、[現行頁](https://finviz.com/elite)

**資料／頻率。** 2026-10-28 現行 Elite 頁明列 real-time stock quotes 與盤前盤後；screener auto-refresh 為 **10 秒**。這是畫面刷新頻率，不表示財報也同頻更新；本輪沒在該頁核實基本面供應商及其延遲。[資料與功能表](https://finviz.com/elite)

**公開價格。** 2026-10-28 現行頁顯示 Elite **US$24.96／月、年繳**；沒有據舊頁推定現行月繳價。付費圖表、匯出 API、portfolio 介面未查看。[價格頁](https://finviz.com/elite)

### TradingView

**與前輪不同的重點。** 指數與個股都可顯示 Technical Ratings；本輪新增確認同一體系另有 **Technical Ratings Strategy**，允許使用者把條件放進策略測試。這只是測試介面，並非官方已證明 Technical Ratings 可獲利。定投者可用價格／技術提醒與圖表，但未確認台幣扣款規劃。[Ratings 方法](https://www.tradingview.com/support/solutions/43000614331-technical-ratings/)、[Strategy 說明](https://www.tradingview.com/support/solutions/43000628415-technical-ratings-strategy/)

**不確定性／戰績。** 方法公開，跨週期評等與歷史策略測試能查規則；「Buy」不是機率，跨週期一致也不是獨立證據。Strategy 說明直接提醒不可只靠該評等買賣。此輪未找到固定凍結版本、含成本且勝過適當基準的官方 OOS 證明，未重抄前輪技術分析文獻。證據：`none`，結果未檢驗；可涵蓋指數與個股，未確認任何特定持有期策略有效。

**資料／頻率。** 依交易所、symbol、資料訂閱與 chart timeframe 而異；訂閱方案與額外 real-time exchange data 分開。頁面更新、bar 內訊號與已收盤訊號須分別理解，不能把畫面即時性當成財報即時性。[定價與資料說明](https://www.tradingview.com/pricing/)、[Ratings 方法](https://www.tradingview.com/support/solutions/43000614331-technical-ratings/)

**公開價格。** 2026-10-28 擷取頁面實際顯示的是 **AUD**：Free **A$0**、Essential **A$21.95／月**、Plus **A$45.95／月**、Premium **A$95.95／月**，付費欄明列 **billed annually／Special price**。不改寫成美元或台灣售價；其他層級及結帳價未查看。[價格頁](https://www.tradingview.com/pricing/)

### Seeking Alpha

**與前輪不同的重點。** 個股端把 Quant Rating、SA Authors 與 sell-side opinion 分開，提供因子拆解、Portfolio Health、price／rating alerts 與 AI research。指數端的市場文章不能視為 Quant 的指數擇時功能；對定投者較有關的是組合追蹤，而非調整扣款。[Quant FAQ](https://help.seekingalpha.com/premium/quant-ratings-and-factor-grades-faq)、[Premium 功能](https://help.seekingalpha.com/premium/seeking-alpha-premium-feature-list)

**新增證據：讀到作者全文。** Guo & Jame，*Quantitative Analysis and the Value of Social Media Investment Research*，作者版 **2025-01**，Table 3 以 **2016-01 至 2022-12** 的下一個月個股報酬檢驗 Quant 排序；等權 Strong Buy 減 Strong Sell 的 monthly six-factor alpha 為 **1.52%**、**t=3.50**。作者註明歷史回填評等用當時以前資料建構，例如 **2015** 年評等只用其前年資料。證據標為 **`academic_oos`；結果正；期限一個月；美國個股、橫斷面選股**。[作者全文，Table 3／資料註腳](https://russelljame.com/quant_1_23_25.pdf)

**這項升級的界線。** 這是依作者所述的 OOS ratings，而非我們取得凍結模型自行複製；資料由平台提供、完整公式不公開，文中感謝平台人員。回填區間並非當時訂戶真的拿到的 live 訊號；上述 alpha 也不能當台灣使用者成本後可得報酬，本輪未核實完整交易成本處理。論文明說用途是同 sector 內選股，不是選 sector 或 market timing。不能延伸到目前所有 AI 功能、現行模型版本、S&P 500 方向或定投加減碼。這補足前輪「只看到平台宣傳」的缺口，**不改變本 App 不提供個股買賣建議的範圍**。[作者全文](https://russelljame.com/quant_1_23_25.pdf)

**不確定性／公開戰績。** 因子可拆解，但不是報酬機率區間。官方資料頁確認 ClariFI／S&P Global 支援回測資料，並明說組合方法由 Seeking Alpha 設計，並非 S&P 的投資意見；這項關係本身不能升格為獨立驗證。平台當前完整績效頁、付費評等史與 AI 回答均未查看；舊研究已述的擬合／live 分段本輪不重新背書。[資料來源與免責](https://help.seekingalpha.com/basic/where-do-you-source-your-market-data-from)

**資料／頻率。** 官方列 Quodd／Xignite 報價、Cboe BZX real-time、Nasdaq UTP delayed，以及 S&P Global 的 fundamentals、estimates、sell-side ratings。作者文獻描述 Quant daily update，現行付費介面的更新時間未查看。[資料來源](https://help.seekingalpha.com/basic/where-do-you-source-your-market-data-from)、[作者全文](https://russelljame.com/quant_1_23_25.pdf)

**收費／存取。** 可確認 Basic、Premium、PRO 等名稱；2026-10-28 [正式價格比較頁](https://seekingalpha.com/subscriptions)回傳空白，**金額未查看**。客服說明另有定價文字，但依本題「只寫公開價格頁看得到的」限制，不以它替代價格頁。

### Morningstar Investor

**與前輪不同的重點。** 個股的 fair value、moat 與 Uncertainty Rating 已研究過，不重抄估值門檻。這輪較有價值的是 portfolio management、watchlists、custom views、研究變更提醒，以及檢查組合分散度的工具。[Investor 功能](https://www.morningstar.com/mm/investor/learn)

**不確定性／戰績。** 新增查核限制：本輪 [Uncertainty 詞條](https://www.morningstar.com/investing-terms/uncertainty-rating)返回 403；[portfolio／X-Ray 產品頁](https://www.morningstar.com/tools/portfolio/all)也返回 403，實際只在官方搜尋索引看到「total／personal return、index benchmark、X-Ray、allocation」說明，這些細部功能本輪**未核實**，訂戶畫面未查看。可讀的 Investor 功能頁仍確認組合管理與評等，但沒有足以新增投資績效主張的檢驗。證據：`none`，結果不適用；沒有把長期估值意見當短期指數預測，也不混同股票與基金星等。

**資料／頻率。** 公開產品頁稱自家分析師持續覆蓋並提供 research、news、alerts；本輪未核實各證券資料供應商與固定更新 SLA，不能從「continuous」推成逐秒更新。[功能說明](https://www.morningstar.com/mm/investor/learn)

**公開價格。** 2026-10-28：Investor **US$249／年**，或 **US$34.95／月**，與頁面呈現的年繳月均金額分開看；實際訂閱與試用未操作。[公開價格頁](https://www.morningstar.com/mm/)

### Simply Wall St

**提供的判讀。** 個股 Snowflake 將 valuation、future growth、past performance、financial health、dividend 視覺化，另有估值及 analyst target 分析；市場端可摘要一群股票，不能因此當成指數上漲機率。對定投者提供 transaction-based portfolio、股息分析、Notes／Alerts 與組合更新。[Snowflake 方法](https://support.simplywall.st/hc/en-us/articles/360001740916-How-does-the-Snowflake-work)、[方案功能](https://simplywall.st/portal/plans)

**不確定性／戰績。** 官方明說 Snowflake 不是買賣建議，ETF／fund 的 Snowflake 不能與普通股票直接比較。估值說明用 analyst target 的離散程度作為一項可靠度判準，但本輪沒讀到對該可靠度主張的公開 OOS 評估；這項有效性只能列 `bank_claim`，結果正（機構自述），期限為分析師目標期限、資產為個股，並非已驗證的指數擇時或完整選股策略。Snowflake 整體績效證據則為 `none`，未檢驗。[方法與限制](https://support.simplywall.st/hc/en-us/articles/360001740916-How-does-the-Snowflake-work)、[估值方法](https://support.simplywall.st/hc/en-us/articles/4751563581071-Understanding-the-Valuation-section-in-the-company-report)

**資料／頻率。** 2026-10-28 官方文件列 S&P Global Market Intelligence；Company Reports **每日**更新、股價為 **EOD**，共識預估變動一般在 **24–48 小時**反映。頁首稱多數變動 intraday、後文又列股價 EOD，應保留資料集別的時間戳，不自行概括全站 real-time。[更新頻率](https://support.simplywall.st/hc/en-us/articles/8881088158991-When-is-your-data-and-stock-prices-get-updated)

**收費／存取。** 2026-10-28 公開頁可讀 Free、Premium、Unlimited 與功能差異，但擷取未出現付費金額，**金額未查看**。Charlie AI 的實際輸出、完整個股報告及 brokerage sync 未查看。[方案頁](https://simplywall.st/portal/plans)

### StockCharts

**提供的判讀。** 指數端有市場圖表、RRG、MarketCarpets；個股端有 SCTR 技術相對排名、掃描、圖表與提醒。定投者可以存 ChartLists、追蹤研究，但這不是定投資金配置模型。[指標與教育](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays)、[方案頁](https://stockcharts.com/pricing/)

**不確定性／戰績。** SCTR 的定位是同群股票的 technical strength 排名，不是報酬機率。ChartSchool 的規則、範例圖與 PublicChartLists 都有解釋價值，但本輪未核實 SCTR 的固定期限、含成本 OOS 勝率或校準紀錄。證據：`none`，結果未檢驗；屬個股技術橫斷面排名，沒有核實指數方向效度。[官方指標說明](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays)

**資料／頻率。** 2026-10-28 現行價格頁說免費 data plan 為美股 **BATS real-time**、其他市場 delayed；official exchange real-time data 另購。這比舊的概括「未買即時方案皆至少延遲」說明細，報告採現行頁並保留來源差異。歷史價格會調整拆股、股息與 distributions，不能直接與本 App price-only 圖比較。[當前 data plans](https://stockcharts.com/pricing/)、[資料政策](https://help.stockcharts.com/learning-more/policies-and-limitations/data-policies)

**公開價格。** 2026-10-28：Basic **US$19.95／月**、Extra **US$29.95／月**、PRO **US$49.95／月**；US Real-Time 加購 **US$9.95／月**。付費掃描、RRG 與提醒實際操作未查看。[價格頁](https://stockcharts.com/pricing/)

### Yardeni 圖表庫／QuickTakes

**與前輪不同的重點。** 不重述 Yardeni 年底目標與戰術呼叫。圖表庫是指數獲利、估值、產業與總經背景的研究介面，官方 Getting Started 描述可依主題搜尋、隨新數據發布更新；AI Research Assistant 的回答連回 underlying briefings。這不是個股綜合評分，也未確認台幣定投規劃。[使用說明](https://yardeni.com/getting-started)

**不確定性／戰績。** 圖表與研究敘事不能當預測戰績；未查看登入後圖庫、AI 助理或任何統一校準表。對圖庫／AI 可改善投資報酬的主張，證據 `none`，結果不適用；研究常涉及指數／產業，不應混成個股橫斷面模型。前輪已處理的戰術呼叫評分本輪不重做。

**資料／頻率。** 官方稱圖表隨新資料自動更新；各圖 supplier、release date 與 lag 本輪未逐張查看，不能宣稱整個圖庫盤中即時。研究助理提供來源連結是可學的呈現方式，不是預測證明。[Getting Started](https://yardeni.com/getting-started)

**公開價格。** 2026-10-28 QuickTakes：Free **US$0**、Premium **US$29／月**或 **US$290／年**，包含 Live Charts 存取。這是 QuickTakes 價格，**不是完整機構版 Yardeni Research 的報價**；後者本輪未核實。[QuickTakes membership](https://www.yardeniquicktakes.com/membership/)

### Fiscal.ai（原 FinChat）

**提供的判讀／查看邊界。** 終端首頁和價格頁返回 403，終端介面**未查看**；本輪可讀的是官方 API 文件。可確認財務、segments／KPIs、filings 追溯與 estimates。文件把 Agentic Consensus（公司 guidance＋statistical model＋AI estimate）與第三方 Street Consensus 分開；不能說它們是同一群分析師的共識，也不能由 API 存在推定所有零售方案都有同功能。指數評分與台幣定投功能未確認。[API 文件](https://docs.fiscal.ai/docs/introduction)

**不確定性／戰績。** 可追到 filing 的數值不等於 AI estimates 已校準。未在可讀文件看到 Agentic Consensus 勝過 guidance／Street Consensus 的凍結 OOS 結果。證據 `none`，結果未檢驗；對象是公司財務／盈餘預估，不是指數報酬，也不是已驗證的橫斷面選股策略。[Estimates 說明](https://docs.fiscal.ai/docs/introduction)

**資料／頻率。** 2026-10-28 API 明列 as-reported 與 standardized financials，Sourcing to Filing 可連到原始表格圖片和 PDF；stock prices 有 EOD 歷史與 **15 分鐘延遲**盤中資料。這只核實 API 文件，不保證終端畫面相同；財務更新 SLA、Street Consensus vendor 名稱未在本輪讀到的段落核實。[資料與 sourcing](https://docs.fiscal.ai/docs/introduction)

**收費／存取。** 2026-10-28 [公開價格頁](https://fiscal.ai/pricing/)返回 403，方案金額**未查看**，不引用舊 FinChat 價格。API 商業費用與零售 terminal 訂閱也不混用。

### Portfolio Visualizer

**提供的判讀。** 指數／資產類別與個股組合可做 historical backtest、factor analysis、optimization、Monte Carlo 及 tactical allocation；對定投者尤其有 cashflow import、advisor fee 與現金流／提款模型。輸出是指定規則與假設下的結果，不是平台給的「現在該買」分數。[Documentation](https://www.portfoliovisualizer.com/faq)

**不確定性／戰績。** 文件說明 Monte Carlo percentiles、drawdown、recovery、underwater period 與 methodology。歷史實現、模擬分布及最適化結果各有假設；本輪沒有操作任何模型、沒有執行任何歷史比較。證據 `none`，結果不適用；工具能力不證明某個配置或 market-timing rule 有 OOS skill。不可把 Monte Carlo 達標比例直接當個人未來真實成功機率。[方法與定義](https://www.portfoliovisualizer.com/faq)

**資料／頻率。** 公開資料表列 EOD Historical Data、CSI 等市場來源，以及 French／AQR 等因子資料；不同資產類別有不同來源與拼接歷史。這輪不重述前輪已研究的 RF 取得問題。文件沒有足以概括全站的固定刷新 SLA，本輪未確認某一日資料何時到齊。[資料來源表](https://www.portfoliovisualizer.com/faq)

**公開價格。** 2026-10-28 價格頁列 Free、Basic **US$30／月**、Pro **US$55／月**；免費層有歷史與當期結果限制。未切換年繳或登入，其他帳期與工具實際權限未查看。[價格頁](https://www.portfoliovisualizer.com/pricing)

### testfol.io／testfolio

**提供的判讀。** 這次不能再把它簡稱「免費 Portfolio Visualizer 替代品」：現行公開頁列 portfolio／asset analysis、tactical allocation、optimization、Monte Carlo、retirement、factor research，並出現 **Tactical DCA** 與 signal analysis。這些是研究與策略測試工具，並不是已通過驗證的個股／指數分數。對定投者有現金流與 sequence-risk 視角。[工具導覽](https://testfol.io/start/)、[方案功能](https://testfol.io/pricing/)

**不確定性／戰績。** 官方導覽明說 historical backtest 只是一條已發生路徑，Monte Carlo 是模型路徑，兩者都不預測未來報酬。Help 另列真實 ticker、模擬 ticker 與來源拼接；上市前 synthetic history 不能當 live 戰績。證據 `none`，結果不適用；本輪沒開工具或評估任何 tactical／DCA 策略。[導覽與限制](https://testfol.io/start/)、[方法與資料](https://testfol.io/help/)

**資料／頻率。** 官方 Help 說 ordinary tickers 使用 Tiingo，preset series 另列 FRED、學術資料或合成來源；本輪沒有確認其固定入庫時間／SLA，不把 EOD 資料推定成 real-time。[Data Sources](https://testfol.io/help/)

**收費／存取。** 2026-10-28 公開頁列 Free **US$0**、Pro、Pro+、Max，付費數字在本次擷取未顯示，**付費金額未查看**。部分功能表數值仍是破折號，不能用它推定無限額；未使用登入、MCP 或任何 backtester。[價格頁](https://testfol.io/pricing/)

### Yahoo Finance

**提供的判讀。** 指數與市場資訊、個股報價／analyst consensus 之外，官方價格頁的搜尋索引列出 Bronze 的 portfolio risk／diversification、Silver 的 Morningstar ratings／fair value，以及 Gold 的進階資料與工具。對定投者較相關的是 portfolio monitoring，未核實有台幣扣款與實際換匯費用管理。[官方方案頁](https://finance.yahoo.com/plus/select-plan/)

**存取與證據限制。** 上述方案頁及資料供應商表在直接開啟時都返回 **429**，本輪實際看到的是官方搜尋索引摘錄，相關現況**未核實**；付費畫面**未查看**。本輪未核實任何平台綜合判讀或 AI 功能的 OOS 紀錄。證據 `none`，結果未檢驗；不能把外部研究商的星等或 fair value 當 Yahoo 自己的校準機率。[方案頁](https://finance.yahoo.com/plus/select-plan/)、[資料商表](https://help.yahoo.com/kb/SLN2352.html)

**資料／頻率（未核實）。** 2026-10-28 索引摘錄列股價歷史／daily updates 的 CSI、財務與估值的 Morningstar、公司 EPS／營收 estimates／analyst targets 的 S&P Global，並依交易所列 quote delay；原表未打開，不補猜延遲分鐘數。[官方 data providers](https://help.yahoo.com/kb/SLN2352.html)

**價格摘錄（未核實，不作現行報價）。** 2026-10-28 官方價格頁索引顯示年繳 Bronze **US$95.40／年**、Silver **US$239.40／年**、Gold **US$479.40／年**；不同官方路徑索引也有略異金額，因此不能視為已確認結帳價。這是「實際看到什麼」的紀錄，正式價格原頁**未查看**。[摘錄所屬官方價格頁](https://finance.yahoo.com/plus/select-plan/)

### Perplexity Finance

**提供的判讀／未查看部分。** 以自然語言查公司與市場、聚合財務、analyst estimates、news／stories，重點是回答附引文。直接打開 Finance 個股頁只得到圖片外殼，**互動頁、AI 回答、指數分數與定投功能未查看**。官方 Finance 頁的索引摘錄列資料與 stories，不等於本輪驗收過其準確性。[Finance AAPL](https://www.perplexity.ai/finance/AAPL)

**不確定性／戰績。** 一般價格頁確認答案帶 citations；citation 可讓人檢查來源，不能保證正確或形成市場預測區間。本輪未核實 Finance AI 的基準率、forecast calibration 或投資 OOS 成績。證據 `none`，結果未檢驗；資產／期限依問題而變，不是固定期限指數或橫斷面選股模型。[官方 plans／citation 說明](https://www.perplexity.ai/hub/pricing)

**資料／頻率（部分未核實）。** 2026-10-28 Finance 官方搜尋索引頁腳列 Financial Modeling Prep、Quartr、Fiscal.ai、FactSet 等不同欄位來源；因原頁僅圖片，這些 provider 對應本輪**未核實**，亦未確認資料時效 SLA。Enterprise 的 licensed connector／Computer 宣傳不能直接套到免費 Finance 頁。[索引所屬 Finance 頁](https://www.perplexity.ai/finance/AAPL)

**公開價格。** 2026-10-28 官方價格頁可讀 Free **US$0／月**，Pro **US$17／月、年繳**，Max **US$167／月、年繳**。這是 Perplexity 一般方案，不宣稱某一 Finance 資料集一定包含其中，也不據此推定 Finance 無限制免費。[價格頁](https://www.perplexity.ai/hub/pricing)

### Robinhood Gold research

**提供的判讀。** Gold 把 Morningstar 公司 research、進階資料與其他券商功能綁在會員中；不是自己替每月定投者產生已校準的指數分數。recurring investments 與 Gold research 是不同功能，不能把訂閱當定投績效保證。[官方 research 介紹](https://robinhood.com/newsroom/a-new-gold-experience/)、[Gold](https://robinhood.com/us/en/gold/)

**不確定性／戰績。** 本輪未登入，Morningstar 報告全文、Uncertainty 在 App 的實際位置、Cortex 的生成輸出與評估方式均**未查看**。未核實 Gold 訂戶因研究而取得超額績效的對照證據。證據 `none`，結果未檢驗；個股研究與短期 index call 分開。台灣居民開戶可用性不在本輪已查範圍內。

**資料／頻率。** 官方發布資料可確認 Morningstar 與 Nasdaq Level II 的來源定位；前者是 research、後者是 order book，不混為公司估值更新頻率。當前 research 的固定更新 SLA 本輪未核實；歷史發布文不能證明今天每個介面權限相同。[官方 research 發布文](https://robinhood.com/newsroom/a-new-gold-experience/)

**公開價格。** 2026-10-28 Gold 正式價格頁列 **US$5／月**；本輪不由歷史公告推定年繳方案。訂閱與各項其他交易服務費用分開，未下單或訂閱。[Gold 公開頁](https://robinhood.com/us/en/gold/)

### Public.com

**提供的判讀。** 官方 Alpha 文件描述以 SEC filings、earnings calls／transcripts、quotes、analyst ratings、news 進行 AI research；Investment Plans 可設定資產組合及 recurring contributions。這裡把「研究」與「執行規劃」放在同一平台，值得借鑑其工作流程。[What is Alpha](https://help.public.com/en/articles/9354354-what-is-alpha)、[Premium 功能說明](https://help.public.com/en/articles/6097323-public-premium)

**不確定性／戰績。** Alpha 文件明說實驗性技術可能提供不準確回應、輸出不應作為投資決策依據。警語比只寫「非投資建議」具體；沒有看到校準或投資 OOS 紀錄。證據 `none`，結果未檢驗；涵蓋股票與其他資產，期限由提問決定，非固定的指數／選股預測。實際 Alpha 回答與會員畫面**未查看**。[Alpha 限制](https://help.public.com/en/articles/9354354-what-is-alpha)

**資料／頻率。** Alpha 文件說可用 real-time 與 historical 資訊；獨立 Alpha 宣傳頁頁腳列 Xignite。本輪沒有逐欄核實其延遲或將舊模型名稱當成現行規格。[Alpha 文件](https://help.public.com/en/articles/9354354-what-is-alpha)、[資料與 AI 免責](https://public.com/betterwatchlist)

**收費／現況衝突。** 2026-10-28 `/premium` 轉向首頁，較舊 FAQ／合約仍有 Premium 與 recurring-fee 的方案說明，但本輪開到的當前 fee schedule PDF 沒找到 Premium。**現行 Premium 金額與豁免條件未核實，價格頁未查看**；不拿舊合約數字冒充現行報價，也不由沒找到字樣推論 Premium 已取消。[產品入口](https://public.com/premium)、[現行費用文件](https://public.com/disclosures/fee-schedule/)、[官方 Premium FAQ](https://help.public.com/en/articles/6097323-public-premium)

### 國泰證券 App

**提供的判讀。** 本輪可確認美股定期投資與 App 的申購、扣款設定、費用 FAQ；對長期投資者的直接價值是把執行條件說清楚。未查看登入後指數／個股研究，沒有核實美股綜合評分或 AI 摘要。[定期投資說明](https://istockapp.cathaysec.com.tw/Marketing/DCA/)

**必須避免的誤讀。** 同一頁的「智慧加減碼」與季均價規則位在**台股**章節；本輪沒有證據證明美股定期定額也支援。即使其他市場確有依均線調整扣款功能，也不是其優於固定定投的績效證明。證據 `none`，結果未檢驗；對象為自動扣款規則，非可核實的美股指數或個股 OOS 選股研究。[頁面章節與 FAQ](https://istockapp.cathaysec.com.tw/Marketing/DCA/)

**資料／頻率。** 美股說明可讀交易與扣款流程；但本輪未在此頁核實報價與 research vendor、延遲或研究刷新頻率。不能把台股章節的資料與美股套用。

**公開費用。** 2026-10-28 官方美股頁列定期定額買入 **US$0.1／筆**、賣出 ETF **US$3**、賣出個股 **0.08%**，優惠寫至 **2026-12-31**；這些是特定交易模式費率，不是全 App 訂閱價，也不能套到一般單或人工單。本輪未操作下單、確認換匯成交價或核實登入後個人費率。[官方美股費用頁](https://istockapp.cathaysec.com.tw/Marketing/usstock/index)

### 富邦證券 AI PRO／美股定期定額

**提供的判讀。** 目前官方主打 AI PRO，公開頁列智慧分析、重要財報與事件、法說會摘要、AI 盤前晨報，支援市場包含美股；但沒有證據可把每項 AI 功能都歸為美股功能，**美股實際研究畫面與個股分數未查看**。定投端可確認美股定期定額與複委託服務，不能用銀行信託版規則替代證券版。[AI PRO](https://www.fubon.com/securities/Aipro/index.html)、[證券官方活動／費用說明](https://www.fubon.com/securities/open-now/index.html)

**不確定性／戰績。** 沒有在本輪可讀頁核實 AI 分析的固定期限、基準率、完整命中率或 OOS 結果。證據 `none`，結果未檢驗；無法判定是股票橫斷面策略或指數預測，因此不作有效性推論。

**資料／頻率。** 官方有 research／event 功能說明，但本輪未核實美股資料供應商與刷新 SLA。投顧研究網站可見報告日期與登入要求，全文**未查看**，不能把每日出報告說成每一檔財務數字每日更新。[投顧公開入口](https://fubonresearch.fubon.com/Research/)

**公開費用。** 2026-10-28 目前活動頁只寫美股定期買入費率優惠、無最低手續費，詳細優惠洽分公司，賣出依客戶原複委託費率；**未看到可引用的統一數字，不填費率**。另外明說複委託與定期定額分開庫存、同標的同日賣出會分別計費，這是我們現金流／成本卡值得提醒的差異。[目前官方頁](https://www.fubon.com/securities/open-now/index.html)

本輪搜尋也曾命中仍可開啟的「存股優」舊活動頁，但內容屬過去活動；沒有把那份舊優惠視為現價。[歷史活動頁](https://www.fubon.com/securities/hot_new/rsp/)

### CMoney「美股夢想家 PC」

**提供的判讀。** 官方商品頁以便宜／昂貴價、基本面研究與股息現金流組合為訴求；landing page 的索引另有價格區間燈號、財報視覺化與教學。未確認指數專屬評分或台幣定投規劃，也沒有核實 AI 功能。**本報告比較的是 PC 商品，不拿同名手機 App 的價錢或權限混用。**[PC 商品頁](https://www.cmoney.tw/app/itemcontent.aspx?id=4004)

**不確定性／戰績。** 商品頁可讀，但 landing page 直接擷取失敗；「燈號」具體公式與門檻本輪**未核實**。創作者故事、退休經歷、用戶評價與行銷績效敘述不能視為完整、可重現的訊號戰績。在已讀商品頁沒有核實評價帶的 OOS 檢驗或不確定區間。證據 `none`，結果未檢驗；便宜價屬個股估值意見，不是已驗證的指數擇時／橫斷面策略。[商品頁](https://www.cmoney.tw/app/itemcontent.aspx?id=4004)、[未成功開啟的 landing page](https://www.cmoney.tw/Landing/UsStockDreamer/default.aspx)

**資料／頻率。** 本輪可讀商品頁未找到可確認的美股資料供應商、行情延遲與估值帶重算頻率；付費軟體、VIP 文章與運算細節**未查看**。

**公開價格。** 2026-10-28 PC 商品頁顯示 **NT$12,988／年**、**NT$1,099／月**；其他 landing page 有多組促銷殘留，本報告不混用。未試用、付款或查看續訂結帳條件。[公開商品價格](https://www.cmoney.tw/app/itemcontent.aspx?id=4004)

## 預測證據的邊界

| 主張 | 唯一等級 | 結果 | 期限／資產／是否橫斷面 | 可以與不可以推論的事 |
| --- | --- | --- | --- | --- |
| SA Quant 排序與後續報酬 | `academic_oos` | 正 | 下一個月、美國股票、是橫斷面；作者版 2025-01，報酬樣本 2016-01 至 2022-12 | 可說作者資料中排序有預測力；不能說本 App 應提供個股買賣、現行版本必然有效或能預測指數。[作者全文](https://russelljame.com/quant_1_23_25.pdf) |
| Simply Wall St 以分析師預估接近程度判斷較可靠 | `bank_claim` | 正（自述） | 個股 analyst-target 期限；不是已核實橫斷面投組 | 官方說做過資料分析，但本輪未取得可重現的 OOS 設計；不採其閾值。[估值方法](https://support.simplywall.st/hc/en-us/articles/4751563581071-Understanding-the-Valuation-section-in-the-company-report) |
| 其餘產品的分數、圖表、AI 能提升本 App 使用者的投資結果 | `none` | 未檢驗，不冒充零 | 多數沒有固定期限；部分是財務預估、部分是個股相對排名、部分根本不做預測 | 功能文件是功能證據；未找到效度不等於已證明無效。各產品來源見上文。 |

沒有為了湊「正、零、負」而把缺資料填成零或負，也沒有為每個產品重跑市場測試。前輪已處理的指數預測負面文獻不再抄錄；本輪新增的 SA 證據仍不跨越資產、期限與橫斷面／時間序列的界線。

## 對照目前程式：真正的缺口

以下位置均在 2026-10-28 親自開檔確認；不把前輪已上線功能再列成缺項。

| 現況與一手程式位置 | 本輪產品比較帶來的差異 |
| --- | --- |
| `web/pages/etfs.tsx:194` 明說「只是規劃，不是持倉或交易紀錄」；`:199`、`:203`、`:207` 是預算、單筆與檢討門檻，`:222` 只輸出摘要文字 | 缺的是研究決定與檢討的紀錄／參照定義，不是買賣訊號。不能從規劃金額扣掉推測的「已成交」交易。 |
| `web/src/server/views.ts:224` 的 DEFAULT_PLAN 只存規劃；`:231` 的備註仍列券商、費用與換匯等待定事項 | 先做券商模式、費率有效日與使用者假設卡，比搬進綜合分數更貼近實際決策。 |
| `web/pages/etfs.tsx:187` 已明說以指定歷史買入日／USD-TWD 換匯，且不含配息、費用、換匯價差與稅；`web/src/lib/analytics.ts:155` 也標註限制 | 新增假設型成本／現金流沙盒應另列，不悄悄改既有歷史結果，不新增一批策略比較。 |
| `web/pages/outlook.tsx:94` 已先顯示 dd5，`:96` 有平常基準，`:97` 有驗證狀態，`:118` 有自然頻率，`:124` 有定投說明 | 不再建議「風險置前／加基準率／加定投免責」等已存在的功能；也不把同行燈號接到機率或扣款。 |
| `web/src/lib/consensus.ts:16` 已有 coveredWeight、oldest／newest 等彙總欄位；`:30` 起做個股資料聚合 | 新缺口是個股原始估計／申報資料的來源與變動脈絡，不重建另一個指數 consensus score。 |
| `web/src/lib/news-ai.ts:139` 至 `:145` 已要求具名說法、不要推測走勢、無催化因素可直說 | 不重提已修好的提示詞；新增個股研究抽屜時，延伸原始報告連結與會計期間，AI 不生成買賣意見。 |
| `web/src/lib/forecast.ts:1` 至 `:7` 明定目標、已知資料與驗證邊界；`web/docs/forecast.md:116` 起為未合併不得執行的第二輪草稿 | 所有本輪建議均不要求測新條件、不占 P(up) 名額、不改 dd5 模型。 |

## 建議的功能與順序

這些是產品設計推論，證據一律 `none`（未證明能提升報酬），不借產品行銷話術升級等級。成本按本 App 目前只有規劃、沒有真實持倉／交易帳本估計；不是廠商報價。

| 順位／ID | 具體行為與最小交付 | 對應決策與參考 | 成本／事前登記 |
| --- | --- | --- | --- |
| 優先／K-01 | **研究與檢討紀錄卡。** 加碼前記研究理由、反證、資金用途與來源；之後記「續研／擱置／已檢討」和當時看到的資料。先做手動檢討。若要啟用漲跌門檻提醒，必須先讓使用者指定標的、參照日期／價格、幣別、price 或 total-return 口徑；未指定前不算觸發，也不等同停利停損。 | b、c。現況僅備註與門檻文字（`web/pages/etfs.tsx:207`、`:222`）；借鑑 Notes／Alerts 的研究連續性。[SWS 方案](https://simplywall.st/portal/plans) | 低（手動卡）；自動提醒另估。純紀錄不需；若要聲稱哪種檢討規則有效或測歷史，先登記。 |
| 優先／K-02 | **扣款與成本假設卡。** 儲存券商／帳戶模式、定額或定股、扣款幣別、換匯方式、手續費及最低費、優惠到期日與官方連結。只顯示假設下投入現金的拆解，不代替券商成交回報。把「待確認」留下，不能把一般單、定期投資、銀行信託與人工單混在一起。 | a、b。直接補 `web/src/server/views.ts:231` 的待定事項。[國泰美股費用](https://istockapp.cathaysec.com.tw/Marketing/usstock/index)、[富邦庫存／費用規則](https://www.fubon.com/securities/open-now/index.html) | 中；純費率／現金算術不需。不得順手重跑不同歷史扣款策略。 |
| 次優先／K-03 | **個股證據抽屜。** 每家公司列原始 filing／IR、會計期間、發布日、已報告數據、公司 guidance、sell-side estimate；點數值能回原表。先做來源入口與固定欄位，AI 摘要只回答「發生何事／哪個數字變了」，不新增研究評分。 | d、資料、流水線。Fiscal.ai 的 sourcing 比它的 AI estimates 更值得學；對既有新聞 AI 是資料脈絡增量。[Fiscal API](https://docs.fiscal.ai/docs/introduction) | 高（完整財報／KPI 管線）；只做來源入口可縮小。資料呈現不需；用新欄位做預測須另登記。 |
| 次優先／K-04 | **ETF＋個股的重疊預覽。** 只有使用者明確輸入金額／權重時才算假設曝險；顯示 ETF 內含公司與額外個股相加後的集中度。未輸入時只列研究名單與 ETF 的重疊，不將名單當持倉。SPY 推算與實際持有 ETF 必須分清，不做產業點數歸因或推薦配置。 | a、d。借鑑 ETF holdings 與 portfolio 分散度的工作流程。[Koyfin 方案](https://www.koyfin.com/Pricing/)、[Morningstar 組合管理](https://www.morningstar.com/mm/investor/learn) | 中；目前截面算術不需，不跑歷史集中度與擇時研究。 |
| 後續／K-05 | **「自上次檢討後改變了什麼」紀錄。** 保留使用者檢討時看到的已報告財務、guidance、研究連結與資料版本，之後逐欄列變更。明確區分資料修訂、公司新公告與分析師修正；不以變更筆數投票、排名或產生下一步指令。 | b、c、d、流水線。比新增更多即時噪音更貼近定期研究。[Koyfin filings／transcripts](https://www.koyfin.com/Pricing/)、[Fiscal period 對齊](https://docs.fiscal.ai/docs/introduction) | 中至高；前瞻留存不需。若要統計變更後報酬或評分「當時判斷」，先登記。 |
| 後續／K-06 | **假設型現金流沙盒。** 使用者自行輸入投資報酬、匯率變動、費用與加碼日期的情境，呈現預算剩餘、投入／期末金額與假設敏感度。明寫「你輸入的假設」，不附模型成功機率、不以歷史挑最佳加碼時點、不使用 Monte Carlo 偽裝精準。 | a、b、c。借鑑 PV／testfol 的現金流與情境分離，不學其 tactical DCA。[PV 方法](https://www.portfoliovisualizer.com/faq)、[testfol 方法區別](https://testfol.io/start/) | 中；純假設算術不需。若改成歷史、bootstrap 或績效比較，必須先登記。 |

本輪沒有建議事前登記新的市場計算。上述「不需」只適用於標明的描述／紀錄／假設算術，不是允許繞過既有事前登記流程。未執行任何功能或試算。

## 常見功能中不該照做的部分

- **綜合分數直接翻成買進、停扣或加碼。** Technical Ratings、Snowflake、SCTR、估值帶各回答不同問題；公開公式與視覺一致性不能補上缺失的指數 OOS／基準率。尤其不能把個股相對排序的正證據移植成指數訊號。[TradingView](https://www.tradingview.com/support/solutions/43000614331-technical-ratings/)、[SWS](https://support.simplywall.st/hc/en-us/articles/360001740916-How-does-the-Snowflake-work)、[SA 作者全文](https://russelljame.com/quant_1_23_25.pdf)
- **把更多相似指標當信心票數。** 同一價格序列的技術指標與多週期票數不等於獨立樣本；本輪不重開前輪已否決的趨勢、廣度、情緒合成或季節性候選。這是現有研究邊界，不是本輪做了新的統計否決。
- **照抄 tactical DCA／智慧加減碼。** 工具存在不等於策略比固定定投有效；即使廠商方便實作，也抵觸 X03／L17。國泰的台股章節更不能被當成已驗證的美股方法。[國泰章節](https://istockapp.cathaysec.com.tw/Marketing/DCA/)、[testfol 方案](https://testfol.io/pricing/)
- **用 AI 自信語氣、資料商名氣或 citations 代替戰績。** 能指出原表是資料品質功能；不能因此賦予其買賣或報酬預測資格。Agentic Consensus 也不能與分析師共識無標示混合。[Fiscal API](https://docs.fiscal.ai/docs/introduction)、[Public 的具體限制](https://help.public.com/en/articles/9354354-what-is-alpha)
- **將回測、模擬、live 與訂戶實績放同一條曲線。** 未上市 ticker 的合成歷史、重新設計後回填的分數、Monte Carlo 分位與使用者真實報酬，必須分開。工具展示能力不構成未來保證。[testfol Help](https://testfol.io/help/)、[PV 方法](https://www.portfoliovisualizer.com/faq)
- **先做完整交易／券商同步系統。** 現況是規劃資料，還不是交易帳本；開放註冊服務增加帳戶整合、交易成本口徑與授權維運，成本高。本輪先建研究紀錄和使用者假設，不把所有平台功能都列成待辦。

## 查核限制與停止點

指定產品皆已有來源與存取紀錄；功能矩陣、可借鑑的優先清單及不該學的功能已完成，因此停止擴張研究。

整體限制是**文件比較，未做產品互動驗收**。登入／付費內的實際畫面、試用後完整權限、地區差異、隱藏費用與即時性未核實之處已逐項註明。沒有根據產品名含 AI、研究報告數量或畫面顏色推斷有效性。沒有找到其他足以引用為本 App 新判斷訊號的合格檢驗；這個結論僅限本輪讀到的官方文件和作者全文，不聲稱全世界不存在。

## 給整合者的摘要

### 關鍵發現（3–8 條，每條附證據等級與來源）

- **值得補的是研究流程與執行條件。** 現金流、費用、研究紀錄、ETF／個股重疊與原始文件追溯，能服務既有決策而不新增市場訊號；這是設計推論，未證明能提高報酬。證據 `none`，結果不適用。[Koyfin](https://www.koyfin.com/Pricing/)、[Portfolio Visualizer](https://www.portfoliovisualizer.com/faq)、[Fiscal.ai](https://docs.fiscal.ai/docs/introduction)
- **Seeking Alpha 有前輪未讀到的作者全文。** Guo & Jame（2025-01）對下一個月美國個股 Quant 排序得到正結果，作者稱歷史評等以當時以前資料建構。證據 `academic_oos`，結果正，限橫斷面選股；不是目前版本的獨立複製，更不是指數擇時或定投加減碼證據。[作者全文](https://russelljame.com/quant_1_23_25.pdf)
- **「有回測」不等於「判斷有效」。** testfol 明確區分已發生路徑與模型路徑；TradingView 可測 Technical Ratings Strategy，但不建議僅據該評等買賣。證據 `none`，未核實這些工具對我們投資決策的預測增益。[testfol](https://testfol.io/start/)、[TradingView](https://www.tradingview.com/support/solutions/43000628415-technical-ratings-strategy/)
- **台灣券商最有用的新資訊是交易口徑。** 國泰的智慧加減碼在台股章節，美股適用未核實；富邦明說複委託與定期定額庫存分開、賣出分別計費。證據 `none`（功能／費用文件，非策略效度）；不能借此支持 X03／L17 的反面主張。[國泰](https://istockapp.cathaysec.com.tw/Marketing/DCA/)、[富邦](https://www.fubon.com/securities/open-now/index.html)
- **資料可追溯與預測不確定性要分開。** Fiscal.ai 把數值連回 filing，並區分 Agentic 與 Street Consensus；Public 明說 AI 可能出錯。證據 `none`，本輪沒有核實兩者 AI 預測的 OOS 成績。[Fiscal.ai](https://docs.fiscal.ai/docs/introduction)、[Public](https://help.public.com/en/articles/9354354-what-is-alpha)

### 對我們 App 的建議

下表由優先到後續；`none` 均表示產品設計建議，沒有投資績效主張。「不需事前登記」只限描述、前瞻留存與使用者假設算術。

| ID | 建議 | 服務哪個決策（a 每月定投／b 加碼研究預算／c ±20% 檢討／d 觀察名單個股／資料／流水線／呈現） | 證據等級 | 成本（低／中／高） | 需事前登記？ | 與既有規則或排除清單衝突？ |
| --- | --- | --- | --- | --- | --- | --- |
| K-01 | 研究與檢討紀錄卡；先手動，參照標的／日期／幣別未定前不計門檻觸發 | b、c、呈現 | `none` | 低 | 純紀錄否；測規則效度則是 | 否；不產生買賣或停扣指令 |
| K-02 | 券商模式、扣款、換匯、費率及優惠期限假設卡 | a、b、資料、呈現 | `none` | 中 | 純算術否；歷史策略比較則是 | 否；不依行情改扣款 |
| K-03 | 個股證據抽屜：原始申報、會計期間、guidance／consensus 分列 | d、資料、流水線 | `none` | 高 | 資料呈現否；新預測研究則是 | 否；不給個股買賣建議 |
| K-04 | ETF 與額外個股的假設重疊預覽；名單不當持倉 | a、d、呈現 | `none` | 中 | 目前截面算術否 | 否；不做產業點數或配置建議 |
| K-05 | 保留上次檢討快照，逐欄列財務／guidance／來源變更 | b、c、d、流水線 | `none` | 高 | 前瞻留存否；歷史報酬計分則是 | 否；變更不組成綜合評分 |
| K-06 | 使用者自行輸入報酬、匯率及費用的現金流情境沙盒 | a、b、c、呈現 | `none` | 中 | 純假設否；歷史／bootstrap 則是 | 否；不給成功機率或最佳加碼時點 |

### 建議不要做的事與理由

- 不新增沒有適用證據的綜合買賣評分、景氣燈號或 AI 方向結論；個股橫斷面結果不能移植成指數方向。
- 不學 tactical DCA、智慧加減碼或依 P(dd5) 改部位；抵觸 X03／L17，產品有功能不等於策略有效。
- 不新增一批可自由挑起訖、門檻與指標的市場回測；會污染事前登記，也沒有補上研究流程缺口。
- 不把規劃當持倉、名單當配置、模擬當 live 戰績，或把 AI／資料商品牌當效度證明。

### 未核實、不確定、需要人判斷的地方

- 本輪是公開文件比較，所有登入／付費介面均未查看。MacroMicro／Fiscal 終端受阻；Yahoo 原頁受限；Perplexity Finance 只取得圖片外殼，相關索引摘錄已標未核實。
- Public 的 Premium 舊文件仍在、產品入口卻轉向首頁；現行方案及費率未核實。各站價格僅代表查閱時公開頁所見，不保證台灣結帳條件。
- SA 作者研究使用平台資料及回填評等、公式未公開；本輪未核實完整交易成本處理，不能當作台灣訂戶可得收益或現行版本認證。
- 自動化檢討前仍需使用者決定參照價格、幣別及報酬口徑；目前程式只存規劃與文字門檻。本輪沒有執行市場計算、修改程式、commit 或部署。
