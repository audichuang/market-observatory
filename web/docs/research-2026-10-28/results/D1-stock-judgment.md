# D1：專業機構、個股評等與可借鑑的判斷流程

研究／查閱日：2026-10-28。對象是美國個股，重點是大型股觀察名單；本報告沒有跑任何市場歷史資料回測、探索性統計或績效重算，也沒有呼叫正式站管理 API。只寫本檔。

**結論：可以借鑑專業研究的問題結構與問責方式；目前證據不足以把任何商業評等、單一目標價或分析師排行榜變成本站的買賣判斷。** 評等變動與盈餘修正在部分文獻有橫斷面資訊，但資料定義、交易成本、反應速度及大型股適用性都會改變結論。對 App 最有把握的改善是解釋「這份共識由什麼組成、何時更新、分歧有多大、哪些假設需要重看」。

## 1. 範圍、判讀規則與既有研究的差異

本輪新增的是**個股橫斷面**與機構研究流程，不重述指數方向研究。個股之間的相對報酬差，不能移植成 S&P 500 的時間序列方向訊號。沒有提出 forecast 新條件，也不重開 X03／L17、meta-labeling 或 P(up) 名額。既有排除清單已核讀：`web/docs/research-2026-10-27/proposal.md:405`；定投邊界在 `web/docs/forecast.md:114`。

證據等級每一項主張只給一個：`none`／`bank_claim`／`anecdotal`／`academic_is`／`academic_oos`／`independently_tested`。其中：

- `academic_is`：對既有歷史做學術檢驗；用當時評等解釋後續報酬，**本身不等於**模型、選樣及規則先凍結的樣本外檢驗。
- `academic_oos`：原文明確描述樣本外或前瞻紙上追蹤；仍須另外看是否能交易、是否足夠獨立。
- `independently_tested`：第三方自行檢驗；不代表已稽核、已扣成本或已排除資料探勘。
- `bank_claim` 也用於評等商與資產管理公司的自述；有明確自家回測的主張用 `anecdotal`。
- 結果標「正／零／負」針對該項明確主張。「零」指未偵測到所述優勢，不代表證明效果精確為零。只有方法文件而未檢驗成效者標 `none`，不捏造正負結論。

下文每個實證數字都標研究或資料日期及原始文件連結。學術全文未取得者明寫「未讀全文」；只有搜尋索引、轉述或鏡像者另註明。日期不明的網頁以本次查閱日標示，不能當作文件出版日期。

## 2. 賣方分析師實際在做什麼

### 2.1 從營運假設到評等，不只是套一個倍數

CFA Institute 的 **2026 curriculum** 把流程拆成理解企業、預估營運、選估值模型、轉成價值、形成結論；研究報告要讓讀者看得出假設、風險、事實與意見的界線，以及利益衝突。這是專業規範，**流程能帶來超額報酬的證據：`none`**。已讀公開摘要，未讀付費完整課程。[CFA：Equity Valuation: Applications and Processes](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/equity-valuation-applications-and-processes)

可把這個流程具體化如下；這是依方法文件整理的工作結構，不是每家券商都照同一張表執行：

| 階段 | 分析師要回答的問題 | 對大型股研究的意義 |
| --- | --- | --- |
| 理解企業與產業 | 收入由什麼驅動？競爭對手、客戶、供應商、資本需求及監管風險是什麼？ | 對多事業公司分開看業務，避免把一則熱門新聞當整家公司。 |
| 盈餘模型 | 營收的量、價、組合；成本與費用；利息、稅；股數與稀釋；資本支出及營運資金如何連動？ | EPS 上升可能來自業務、利潤率或股數，不能只看同一個成長百分比。GAAP／adjusted EPS 要同口徑。 |
| 與市場比較 | 自己與 consensus 的差異在哪個假設？市場價格已反映多少？ | 「好公司」和「價格反映的期待合理」是兩個問題。 |
| 估值 | 模型適不適合現金流、產業與生命週期？關鍵假設改變時價值如何變？ | 應展示敏感度與替代情境；複雜模型不自動較準。 |
| 催化劑與期限 | 哪個可觀察事件可能讓市場重估？何時發生？若沒有發生，論點是否仍成立？ | 財報、產品、合約或法規事件是「待驗證事項」，不是保證漲跌。 |
| 評等及維護 | 相對誰、看多久、是否含股息、何時更新、什麼事會推翻論點？ | 原評等的定義與修改理由，比單一 Buy 字樣更重要。 |

關於模型與催化劑，James J. Valentine 的 *Best Practices for Equity Research Analysts*（**©2011，McGraw-Hill 出版**），CFA 網站提供的原書節錄強調 out-of-consensus 的營運／估值假設及價格催化劑；也提醒較複雜的 DCF 不保證較好的目標價。**`none`：從業方法，沒有由此建立的獨立績效檢驗。** 已讀公開節錄，未讀整本書。[CFA 託管的原書節錄 PDF](https://www.cfainstitute.org/sites/default/files/-/media/documents/support/research-challenge/challenge/best-practices-equity-sample.pdf)

### 2.2 目標價方法的差異

| 方法 | 核心結構 | 需要公開的關鍵假設／常見誤讀 |
| --- | --- | --- |
| DCF | 預估可分配現金流並折現；FCFF 先得到 enterprise value，再轉 equity value。 | 成長、利潤率、再投資、折現率及終值。不能只有模型產出的單點數字。 |
| P/E | 對指定期間、指定口徑的 EPS 乘合理倍數。 | FY／NTM、GAAP／adjusted、同業選擇、正常化盈餘及倍數為何應改變。 |
| EV/EBITDA | EBITDA 乘 enterprise multiple，再調整淨負債及其他權益／資產。 | EBITDA 沒扣資本支出，不能直接當股東自由現金流；也不能把 enterprise value 當市值。 |
| SOTP | 分部估值加總，再處理總部成本、淨負債、非營運資產及股數。 | 分部倍數、共同成本與交叉持股，避免重複計價；集團折價不應是任意塞進去的答案。 |

依據是 CFA 的估值分類及 CFRA 原始方法文件；上表為定義整理，**各方法何者能穩定預測個股超額報酬：`none`，本輪不做這個主張**。CFRA **2023-11-03** 方法說明及其 **©2025** 方法 PDF 明說依企業特性使用 intrinsic／relative valuation，多方法交叉核對，而非單一通用模型。[CFRA 方法頁](https://www.cfraresearch.com/insights/cfra-equity-research-methodology/)、[CFRA 原作、Julius Baer 提供的 PDF](https://www.juliusbaer.com/fileadmin/legal/cfra-qualitative-equity-research-methodology.pdf)

實務也不完全等於教科書。Imam、Barker、Clubb（**2008**）的訪談與報告分析指出，DCF 常被用來組織及傳達研究，但未必是決定目標價的主要工具；P/E 等簡單倍數仍重要。**`none`：描述分析師行為，沒有證明 DCF 較有效。未讀全文，只讀作者所屬大學保存的原摘要。** [King’s College London 原始研究紀錄](https://kclpure.kcl.ac.uk/portal/en/publications/the-use-of-valuation-models-by-uk-investment-analysts-2/)

### 2.3 Buy／Hold／Sell 不能當統一尺度

Morgan Stanley 的公開揭露明說 Overweight／Equal-weight／Underweight 不等於 Buy／Hold／Sell；監理揭露才做分類對應。其定義是相對國家 MSCI 指數或分析師產業覆蓋組合的風險調整總報酬，期限 **12–18 個月**；一般目標價也採該期限。這是 **2026-10-28 查閱、頁上評等分布截至 2026-09-30** 的現行文件。**`none`：制度定義，不是有效性證據。** [Morgan Stanley General Research Disclosures](https://www.morganstanley.com/eqr/disclosures/webapp/generalresearch)

因此 Nasdaq 將來源壓成買／持／賣家數之後，會遺失原本的基準、期限、風險調整與持有條件。這是**對資料壓縮的推論**；本輪沒有取得 Nasdaq 的逐券商映射規則，不能斷言它把哪家評等映射錯了。App 應稱為「Nasdaq 收錄的評等分類」，而不是分析師一致認定某股票會上漲的機率。

## 3. 買方基本面團隊：可借流程，不能把流程當 alpha

### 3.1 決策權與研究討論不必綁在同一個委員會

| 機構與原始文件 | 公開可確認的做法 | 證據及對單人研究的適用性 |
| --- | --- | --- |
| Capital Group；現行頁，2026-10-28 查閱 | 多位經理分享研究，但各自作投資決策；分析師、經理、經濟及量化團隊合作。 | **`none`**：不能從公司宣傳分離出這套治理的因果成效。可借「先有獨立判斷，再吸收別人意見」；不能說所有買方都靠投委會多數決。[The Capital System](https://www.capitalgroup.com/advisor/about-us/capital-system.html) |
| Fidelity；基金原始策略簡報，2026-10-28 查閱 | 官方 PDF 搜尋索引描述：藉公司／產業接觸及研究形成個股假設，找自家對 earning power 的看法與 consensus／價格不同之處；另管組合層級風險。 | **`none`；未核實正文**：直開轉到 reports 頁，實際只讀到官方文件的搜尋索引。是工作方法，非成效證據；本輪建議不依賴此項單獨成立。[Fidelity Mid-Cap Stock Fund 原始 PDF 網址](https://consultant.fidelity.com/app/proxy/content?literatureURL=%2F9897836.PDF) |
| Baillie Gifford Sustainable Growth；2024-11 版本 | 研究討論先記錄少數關鍵假設及 way-markers；買、賣、部位大小另開 portfolio review；最後由 lead managers 決定，並持續檢討研究假設。 | **`none`**：文件屬機構自述，未隔離檢驗流程成效。可借研究備忘錄、反證及固定檢視；不照抄它的持倉權重。[官方 Philosophy and Process PDF](https://media.bailliegifford.com/mws/5qvlncac/20241122142158_sustainable-growth-p-p.pdf) |
| Berkshire；1987 年股東信 | 依企業營運、管理及估值評估持有；不因上漲或持有已久就賣，也會因價格過高或更好的用途而出售。 | **`none`**：經理人的原則，不能用 Berkshire 整體績效證明每條規則有效。可借「股價變了」與「投資論點變了」分開記錄。[1987 原信，Marketable Securities 段落](https://www.berkshirehathaway.com/letters/1987.html) |

**沒有找到上述機構可公開核對的完整內部投資備忘錄、全套投委會表決紀錄及逐項 checklist 績效。** 不能把網路上通用的 hedge-fund memo 模板冠上這些機構的名字。上表只確認公開文件真的描述了什麼。

### 3.2 部位大小與賣出紀律

Baillie Gifford 的文件把 position sizing 放在整個組合的分散限制之下；其 **2025 Q1** 原始更新更明說會考慮相關性、個股波動、報酬潛力與 resilience。**`none`：未有該部位決策規則的獨立成效證據。** 這說明「對企業有信心」不等於單獨由評等決定權重。[Sustainable Growth quarterly insights](https://www.bailliegifford.com/en/ireland/professional-investor/insights/ic-article/2025-q1-quarterly-letters-q125-sustainable-growth-quarterly-insights-10054077/)

賣出紀律方面，上述 **2024-11** 方法文件列的是成長／競爭／管理論點受損、不再符合策略要求、估值不再提供足夠長期回報或有更佳機會；不是通用的固定價差出場線。這對本站只能支持「檢討哪些假設」的提示，不能支持自動減碼。

本站並沒有完整持倉、成本與總資產資料；ETF 頁也明說只是規劃、不是交易紀錄（`web/pages/etfs.tsx:195`）。`researchBudgetTwd`、`trancheTwd` 與門檻屬規劃設定（`web/src/server/views.ts:224`），不能拿來冒充一個已知風險的投資組合。這輪不把加碼預算重新定義成個股交易資金。

### 3.3 The Base Rate Book 的新借鑑點

Mauboussin、Callahan、Majd 的 **2016-09-26** *The Base Rate Book*，重點是**企業結果的參考類別**：營收成長、毛利／營業利潤、operating leverage、盈餘成長及資本報酬的持續性與均值回歸。這和前兩輪的「指數基準上漲率」不同。**`none`：本報告不主張套用該書就能創造個股超額報酬。** [Credit Suisse 原始文件鏡像](https://josephnoko.com/wp-content/uploads/2024/04/The-Base-Rate-Book-Michael-Mauboussin.pdf)

可借的問題是：「目前的成長或高利潤，是否假設會維持太久？參考類別應是相似規模、生命週期與商業模式的企業，還是只挑幾家事後成功者？」不能把全市場的歷史平均直接套給七巨頭，也不能從該書的跌深／漲多章節另做本站擇時條件。本輪只讀企業基準率的框架，沒有重算書中市場結果。

**來源限制：原 Credit Suisse 官方託管版本未取得；實際讀到的是帶作者、日期與機構頁眉的原報告鏡像，官方存檔同一性未核實。** 不把第三方網站的導讀或自行轉錄數字當原文數字；本報告也未引用其數值表。

### 3.4 適合單人追蹤名單的最小研究備忘錄

以下是**本報告建議的模板**，不是宣稱哪家機構的內部原表，成效等級 `none`：

- **在看什麼**：商業模式、主要業務及少數真正關鍵的營運指標；連到原始財報／公司 IR。
- **目前論點**：市場共識與自己的理解差在哪裡；資訊不足就明寫不知道。
- **假設與來源**：成長、利潤率、再投資或競爭優勢的依據及日期，不只填一個目標價。
- **反證**：什麼可觀察結果會讓這個理解不成立？同時記錄有利與不利證據。
- **下一次可核對事件**：財報、產品或法規事件，以及打算檢查什麼；不預填價格反應方向。
- **檢討紀錄**：原看法、這次改變了什麼、為何改變；保留原紀錄，避免事後重寫。

pre-mortem 已在既有研究處理過（`web/docs/forecast.md:473` 起的判斷流程章）；本輪僅新增「若公司研究論點失敗，最可能是哪個營運假設錯了」這個個股用法。仍為 `none`，沒有新增「能提高報酬」的主張。單人情境不需要模擬一個有正式投票權的投委會，也不必把名單每家公司都做成完整券商模型。

## 4. 分析師輸出的獨立證據

### 4.1 評等水準、評等變動、盈餘與目標價是不同訊號

| 研究／讀取狀態 | 結果與唯一證據等級 | 期限、資產、橫斷面及限制 |
| --- | --- | --- |
| Womack（1996-03），*Do Brokerage Analysts’ Recommendations Have Investment Value?*；已讀期刊原摘要，**未讀全文** | **`academic_is`，正**：新買進建議後 drift 約 **+2.4%**，賣出建議約 **−9.1%**；不是「任何一天 Buy 都有同樣效果」。[原期刊摘要](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1540-6261.1996.tb05205.x) | 美國個股、依評等事件選股；買方後續反應短，賣方延續 **6 個月**（原摘要）。不是指數擇時，也未在此確認可扣成本交易。樣本為 **1989–1991**，此樣本期間另由下列 Barber 原文確認。[Barber 原文 pp.532–533](https://www.anderson.ucla.edu/documents/areas/fac/accounting/trueman_5.pdf) |
| Barber、Lehavy、McNichols、Trueman（2001-04），*Can Investors Profit from the Prophets?*；已讀作者大學提供的原文方法及結果 | **`academic_is`，正（gross）／零（net）**：每日調整最有利評等組合的年化風險調整 gross 約 **4.13%**；交易成本後，各主策略的 net 異常報酬未可靠大於零。[作者原文 pp.533–535](https://www.anderson.ucla.edu/documents/areas/fac/accounting/trueman_5.pdf) | 報酬樣本 **1986–1996**，美國個股橫斷面、日／週／月再平衡；反應延遲會削弱買方優勢。對最大型公司，原文稱最佳與最差評等沒有可靠報酬差異。不是對今日低佣金或今日七巨頭的直接檢驗。 |
| 同作者後續 *Prophets and Losses*（2001-05）；已讀作者上傳原摘要，**未讀全文** | **`academic_oos`，負**：原研究以後的 **2000 年**，最高評等組合反而嚴重落後最低評等組合；不能假設 consensus 水準的排序關係跨時期固定。[作者原始摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=269119) | 美國個股橫斷面；用後續年份對照既有研究，單一後續年份不是長期定論；沒有從摘要確認成本後策略結果。 |
| Jegadeesh、Kim、Krische、Lee（2004-06），*Analyzing the Analysts: When Do Recommendations Add Value?*；已讀期刊原摘要，**未讀全文** | **`academic_is`，正（變動）；負（水準在不利特徵股）**：季度 consensus 評等變化有其他變數以外的資訊；高評等水準只在部分有利特徵組合有用，對不利特徵股甚至方向相反。[原期刊](https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.2004.00657.x) | 美國個股橫斷面；季度變動／後續報酬，摘要未給足以確認的全部持有期與成本規格，因此不填策略報酬數值。不能宣稱是已證明的現代大型股 alpha。 |
| Gleason、Lee（2003），*Analyst Forecast Revisions and Market Price Discovery*；已讀作者原摘要，**未讀全文** | **`academic_is`，正**：EPS revision 的新資訊程度與後續 drift 有關；只向 consensus 靠攏的修正和真正新增資訊不是同一件事。覆蓋較多的公司，價格反映較快且完整。[作者原摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=370425) | 個股橫斷面、修正後及後續財報／修正事件。原摘要未載精確持有期限與完整樣本日期，**未核實這兩項**；不從其他論文轉引一個效果數字。不能直接證明 Nasdaq 的四週修正次數比例就是同一訊號。 |
| Bradshaw、Brown、Huang（2013；線上 2012-11-20），*Do sell-side analysts exhibit differential target price forecasting ability?*；已讀原期刊摘要及公開註釋，**未讀全文** | **`academic_is`，負（目標價精準度）；零（具經濟重要性的持續優勢未建立）**：樣本 **2000–2009**，**12 個月**目標隱含報酬平均比實際高 **15%**，原摘要報平均 absolute target price forecast error **45%**；到期達標 **38%**，期間曾達標 **64%**。有統計顯著、但經濟上弱的個人持續能力。[原期刊摘要](https://link.springer.com/article/10.1007/s11142-012-9216-5) | 美國個股預測準確度及分析師間比較；不是一個多空組合的 net alpha。到期與期間曾觸及不可混用；上述 **45%** 沿用摘要名稱，本輪未確認全文分母定義，不能解讀成「誤差為目標價的 45%」。 |

**大型股是否更弱？** 經典評等水準研究對大型股較不利，EPS 修正文獻也指出高覆蓋公司資訊反映較快；但不能據此說「所有分析師訊號在大型股都無效」。§5 的 Seeking Alpha 研究反而在市值加權組合找到正面結果。這些訊號和樣本不同；本輪**沒有找到專門對今日七巨頭、沿用 Nasdaq 現有欄位、扣成本且規則凍結的樣本外驗證**。

### 4.2 羊群與利益衝突：有證據，但不能一概而論

- **Welch（2000-12），`academic_is`，正（羊群假說）**：推薦變動受其他分析師最近建議與 consensus 影響，consensus 的影響不因其較能預測後續股價而更強。資產是個股，研究對象是推薦形成及後續價格資訊，不是可交易報酬策略；不支持把每位分析師當獨立一次投票。[作者原文](https://ivo-welch.info/research/journalcopy/2000-jfe.pdf)
- **Bernhardt、Campello、Kutsoati（2006），`academic_is`，負（羊群假說）**：*Who herds?* 在控制共同資訊等問題的設計下，摘要結論是預估有偏誤、但沒有 herd，反而有向外偏離的現象。這是 **EPS 預估**，不能和 Welch 的評等推薦當成同一檢驗。**未核實全文：期刊直開 403，實際只讀到出版社搜尋索引的原摘要；精確樣本及期限未核實。** [出版社原始紀錄](https://www.sciencedirect.com/science/article/pii/S0304405X06000213)
- **Michaely、Womack（1999），`academic_is`，負（承銷關聯建議的可信度）**：承銷券商分析師推薦的股票，相對非關聯券商的買進推薦表現較差。是 IPO 相關個股的橫斷面，不能直接推成今日成熟大型股必有相同程度偏誤。**已讀原摘要，未讀全文；精確樣本與完整績效期限未核實，故不引效果數字。** [原期刊](https://academic.oup.com/rfs/article-abstract/12/4/653/1578436)

這支持 App 解釋評等來源及潛在利益衝突，不能支持標記特定分析師「不可信」。SEC 目前的投資人說明也要求讀者看利益關係，別只依賴推薦；此為規範與溝通依據，**`none`，不是預測力證據**（2026-10-28 查閱）。[SEC Investor.gov](https://www.investor.gov/introduction-investing/investing-basics/glossary/securities-analyst-recommendations)

### 4.3 新證據：目標價分歧會改變「隱含漲幅」的解讀

Palley、Steffen、Zhang 的 *The Effect of Dispersion on the Informativeness of Consensus Analyst Target Prices*，**2025 年期刊研究、Yale 於 2025-01-21 公開解說；已讀作者稿的方法與相關結果**。美國個股樣本 **1999-07 至 2020-12**，主要結果看往後 **12 個月**報酬。**`academic_is`：正（低分歧下的隱含報酬關係）；負（高分歧下的隱含報酬關係）。** [作者稿全文](https://insights.som.yale.edu/sites/default/files/2025-01/Consensus%20target%20prices.pdf)

關鍵不是「分歧越大一定越跌」，而是**相同的高隱含漲幅，在高分歧時可能是部分分析師對壞消息更新太慢留下的假象**。原文也以最高／最低目標價範圍做替代檢驗。因此範圍可作資訊品質背景，但不是機率信賴區間，也不能把同業不同意見等同於壞消息延遲。這是橫斷面研究，未有適用本站名單的固定門檻或成本後樣本外證據。[Yale 原始研究解說](https://insights.som.yale.edu/insights/the-key-information-hiding-behind-consensus-target-stock-prices)

對 D1 的新增價值是：**先避免大字呈現一個孤立的 upside，再考慮範圍與時間。** 沒有理由因此重新把分析師目標價放進指數方向模型。

## 5. 商業評等系統：方法、績效口徑與獨立檢驗

### 5.1 Morningstar 股票星等、fair value 與 moat

方法文件 **2022-09-29**：股票星等結合估計 fair value、市價及 uncertainty；moat 影響超額企業利潤維持多久及 DCF 假設。**`none`：方法本身不是預測成效。** 股票星等不是基金過往績效星等；wide moat 也不等於今天便宜。[官方方法 PDF](https://www.morningstar.com/content/dam/marketing/shared/research/methodology/705988Morningstar_Equity_Research_Methodology.pdf)

| 證據 | 結果與等級 | 期限、資產、限制 |
| --- | --- | --- |
| Morningstar 自評，2018-04-30；官方網頁已透過瀏覽器讀到正文 | **`bank_claim`，正（橫斷面迴歸）／零（典型最高星等的超額表現）**。作者承認舊方法受危機期間大量推薦影響；改 benchmark event study 後，最高星等的 **3 年 median excess total return 為 0.0%**。 | 股票橫斷面，官方研究涵蓋自 **2001-06** 起的評等；不是持有期末確定的買進保證，也不是獨立複製。[官方自評原文](https://www.morningstar.com/stocks/analyzing-performance-our-stock-recommendations) |
| Bolster、Trahan、Wang（2016），*Assessing performance of Morningstar’s star rating system for equity investment*；讀到原論文全文的公開轉呈 | **`academic_is`，正**：高低星等可區分長期報酬；文中所設 modest transaction cost 降低、未完全消除好處。 | 美國股票，**2001-06-26 至 2012-10-01**，依星等形成組合。未見獨立封存 holdout；不外推今日可交易 net alpha。[原論文公開全文](https://www.researchgate.net/publication/297600234_Assessing_performance_of_Morningstar%27s_star_rating_system_for_equity_investment)。原 DOI 站未能開啟，實際來源為 ResearchGate 的論文全文，並非二手評論。 |
| Liu、Peabody，期刊列 2015，作者稿日期 2016-09-14；已透過瀏覽器讀到 SSRN 原摘要，**未讀全文** | **`academic_is`，負**：摘要稱最低評等組合反而最佳，風險調整後亦然。 | 個股橫斷面；摘要未載完整樣本期與持有期，故**期限與可比性未核實**。不能自行替兩篇相反研究找出已證實的解釋。[作者原始摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2838992) |

**moat 的獨立證據另看，不能借星等研究代答。** Kanuri、McLeod（**2016-05-13**）的 *Sustainable competitive advantage and stock performance: the case for wide moat stocks*，出版社原摘要稱 wide-moat 組合創造價值，**`academic_is`，正；年度再平衡、個股橫斷面**。**未核實全文及樣本期：直開 403，實際僅讀到出版社搜尋索引摘要，不引績效數字。** [原期刊](https://doi.org/10.1080/00036846.2016.1170938)

另找到 **2017** 年 *Is sustainable competitive advantage an advantage for stock investors?* 的原期刊紀錄，但瀏覽器遇驗證、正文未取得；**不採用其效果結論**。[原期刊](https://www.sciencedirect.com/science/article/pii/S1062976916300151) 本輪不足以聲稱「moat 已有一致獨立證據」，更不能以 MOAT ETF 的整體報酬單獨證明 moat 標籤：該類策略還涉及估值、選樣及再平衡。

### 5.2 Zacks Rank

官方模型以 earnings estimate revision 的 agreement、magnitude、upside、surprise 組成，和券商評等共識不是同一東西（**2026-04-22** 官方說明）。[Zacks 模型說明](https://www.zacks.com/stock/news/2905261/the-zacks-rank-explained-how-to-find-strong-buy-computer-and-technology-stocks)

**`bank_claim`，正（官方假設組合）**：官方截至 **2026-10-05**，宣稱 **1988-01-01 至 2026-10-05** 的 Rank #1 年化 **23.82%**，比較基準 **11.58%**。已透過瀏覽器讀到官方 disclosure：先月後週再平衡，排除多項交易成本；缺期間末價格的股票不納入該期，且歷年 universe／方法不同。[官方績效與計算揭露](https://www.zacks.com/performance_disclosure/)

其所稱 Independent Confirmation 是會計師按 **Zacks 自訂績效準則**檢查 performance schedule；不等於已檢驗風險調整、倖存者偏誤、成本後 alpha 或未來延續性。本輪未取得會計師完整意見書，也未找到足以核對 **Zacks Rank 專有模型**的獨立樣本外淨績效研究。一般 EPS revision 論文及使用 Zacks 資料庫的評等論文，不是該產品的績效驗證。期限是短期選股，資產是股票橫斷面，不是每月 ETF 定投。

### 5.3 Value Line Timeliness：曾有 enigma，不等於永遠有效

官方目前定義為未來 **6–12 個月**在覆蓋股票間的相對價格表現，輸入含相對盈餘／價格趨勢及 surprise；和長期企業估值、安全性是不同評等（**2026-10-28** 查閱）。**`bank_claim`，正（官方的有效性自述）**。[官方 Ranking System](https://www.valuelinepro.com/ranking-system-1)

獨立證據須分時期：

- **Black（1973）原論文未讀到全文，不引用經常轉述的超額報酬數字。** 早期 Value Line enigma 的原始研究脈絡可由後續原論文及文獻回顧追查；不能拿這個著名名稱當成目前有效的證明。
- **Lacey、Phillips-Patrick（1992），`academic_is`，正（辨識落後股）**：原摘要檢驗 **1977–1987**，稱異常績效由辨認贏家轉向辨認輸家，並有小型股效果。個股橫斷面；**未讀全文，精確持有期未核實**。[原期刊摘要](https://www.tandfonline.com/doi/abs/10.1080/758516631)
- **CXO，2025-09-24 更新，`independently_tested`，零（穩定排序優勢）／負（樣本末段排序差）**：用 Value Line 公布的 **1965–2008** 年資料，年度重組的高低評等差呈衰退，末段平均為負。是股票橫斷面組合、年度期限；作者承認樣本短、極端年份影響大，且未扣交易摩擦。[獨立分析原文](https://www.cxoadvisory.com/investing-expertise/performance-trend-for-value-lines-timeliness-ranking/)

因此「後來衰退」有有限獨立支持，不能改寫成已證明從某一天永久失效。也未找到本輪可核對的現代大型股、扣成本固定規則驗證。

### 5.4 IBD／CAN SLIM

它結合企業盈餘成長、催化劑、相對強弱、供需／機構支持、技術進場與市場狀態；不是純粹的基本面 fair-value 排名。官方 **©2021** 的買股指南也把基本面與技術型態並用；**`none`：指南沒有本輪可核對的獨立績效檢驗**。[IBD 官方指南](https://get.investors.com/wp-content/uploads/2024/08/IBDD-How-to-buy-Stocks-infographic.pdf)

- **Lutey、Rayome（2022-04-27），`academic_oos`，正**：原摘要描述 **2014-07 至 2017-02** 的 live paper-traded CAN SLIM 詮釋，超過 S&P 500 等基準。但只有 **5 檔**的組合，仍依研究者選技術買點；**未讀全文、未獨立核實紙上紀錄與成本**。美國個股橫斷面、上述整段持有期，不是已複製的完整商業系統績效。[原期刊摘要](https://articlegateway.com/journals/index.php/JAF/article/view/5134)
- **AAII 的獨立 screen 追蹤，`independently_tested`，正（很長期官方表列）／負（較近的比較）**：實際開到的頁面資料截至 **2026-09-30**，**5 年**欄位 CAN SLIM **3.9%**、S&P 500 **12.4%**。AAII 明說這是自己的詮釋與假設組合，並非 O’Neil 親定，也不是完整 IBD 買賣規則。不要把較早搜尋快取的數字混入。[AAII 原始追蹤頁](https://www.aaii.com/stock-investor-pro/screens?sid=76)

這足以否定「只有正面見證、沒有逆風紀錄」的呈現；不夠支持對本站名單發出 CAN SLIM 交易指令。尤其市場狀態濾網若拿來控制 ETF 扣款，會直接抵觸 X03／L17。

### 5.5 Seeking Alpha Quant Ratings

官方將 valuation、growth、profitability、EPS revisions、momentum 相對同 sector 評分，再專有加權。其公開 Sell 績效頁明確混合 backtest 與 simulated trading，**`anecdotal`，正（官方回測自述）**；股票橫斷面，不能當實際投資人稽核報酬。**2026-10-28** 查閱，頁面方法敘述的歷史區段為 **2010–2024**。[官方績效與 backtest 說明](https://about.seekingalpha.com/quant-sell-ratings)

**確實有獨立學術檢驗，不應寫成只有官宣。** Guo、Jame，*Quantitative Analysis and the Informativeness of Social Media Research*（**2023-09** 作者稿），**`academic_is`，正**：**2016-01 至 2022-12**，月末排序後下一月的 Strong Buy minus Strong Sell，市值加權 six-factor alpha **1.21%／月**，Table 3 的 t 值 **2.97**。資產是美國個股橫斷面多空組合，非指數方向。[作者原文，§2–3、Table 3](https://russelljame.com/quant_Ratings_9_15_23.pdf)

重要限制：作者明說早期 Quant 歷史有 **back-filled** 資料；產品 **2019-06** 才公開，文內另列 **2020–2022** 公開後區段的正面 CAPM 結果。這仍未證明模型版本與完整歷史都不可改寫，故本報告保守不升為 `academic_oos`。沒有在上述主表看到交易、融券及訂閱成本扣除，也沒有今日七巨頭的單獨驗證。它推翻「完全沒有獨立研究」，沒有推翻本站不給個股買賣建議的立場。

### 5.6 TipRanks 分析師戰績排名

官方說明結合 success rate、average return、recommendation count／statistical significance；預設以 **1 年或改評時**結算，另可切 S&P 500／sector benchmark（**2026-10-28** 查閱）。這是可讀的歷史問責設計，但 hit rate 預設是賺賠，並非必然打贏基準。[官方排名方法](https://www.tipranks.com/experts/how-experts-ranked)、[官方 FAQ](https://www.tipranks.com/glossary/f/faq)

**排名能預測下一期分析師表現：`none`，本輪未找到可核對的獨立樣本外驗證。** 原網站顯示過去戰績，不等於「先選當時的高星分析師，再看之後績效」已通過。關聯股票與同一檔反覆推薦也不一定是獨立試驗；來源方法未給足夠細節讓本輪確認其完整處理。不能拿今天的榜單回選過去推薦。

EPS 預測誤差、目標價誤差、買賣評等後的相對報酬，是三種不同的「準確度」；不能合成一個未說明的個人權威分數。本輪不建議付費匯入排行榜後據以重加權 Nasdaq consensus。

### 5.7 CFRA STARS

**2023-11-03** 方法頁及 **©2024** 官方 stock report guide 說明：透過企業基本面與股價內含期待形成 STARS，目標是未來 **12 個月**相對基準的總報酬；由分析師作定性判斷，並非 Morningstar fair-value 星等。[官方研究方法](https://www.cfraresearch.com/insights/cfra-equity-research-methodology/)、[官方 Stock Report Guide](https://services.marketscope.com/reports/aidata/dynamic/CFRA_StockReportGuide.pdf)

**`bank_claim`，正（官方部分模型表現主張）**：官方 disclosure 說明部分評等類別、部分區段優於 S&P 500，但結果是 model performance，沒有實際資金交易，未扣各項費用。方法在 **2014-02-03** 引入新 analyst workflow 與量化輔助，不能假設更早紀錄與現在是同一程序（**2026-10-28** 已讀正文）。[官方績效揭露](https://www.cfraresearch.com/legal/performance-disclosure-stars-performance-charts/)

官方績效頁把完整比較導向 MarketScope Advisor；本輪未取得完整逐期序列，也未找到可核對、針對目前 STARS 的獨立成本後樣本外檢驗。**「independent research firm」描述公司關係，不代表其績效已由別人獨立驗證。** 其他 CFRA 模型組合、基金星等或舊 S&P 品牌研究，不能替目前個股 STARS 代答。

### 5.8 Validea

它把公開的名人投資原則編成 guru models，顯示個股通過／不通過的條件及 model portfolios；官方明說是 Validea 的詮釋，非名人背書（**2026-10-28** 查閱）。[官方 FAQ](https://www.validea.com/faq)、[官方 Disclaimer](https://www.validea.com/disclaimer)

**`anecdotal`，正（廠商部分模型績效自述）**。官方揭露：模型報酬沒有實際交易成本；部分模型結合 backtested 與 live model returns；所稱 optimal portfolios 是**事後挑最佳再平衡期間**；股票模型與比較基準均不含股息。這些是評估圖表前必須看見的條件，不是已驗證 alpha。標的是個股橫斷面組合，期限依模型與再平衡版本改變。[官方完整績效聲明](https://www.validea.com/disclaimer)

本輪未找到可核對的獨立樣本外、成本後 Validea 平台模型績效研究。原始 Piotroski／Mohanram 等學術訊號即使有研究，也不能自動驗證平台後來的選樣、再平衡與模型組合。可借「逐項列假設」，不借 guru 名稱當權威。

### 5.9 這些實績不能放在同一個排行榜

有的是 price return，有的是 total return；有的是每日換股、有的是長期持有；有的是模型回填、有的是當時可見的評等；有的多空、有的 long-only。**本報告沒有把它們換算成統一報酬、沒有用現在名單篩過去、也沒有自行重算差距。**

對 Zacks Rank、TipRanks 分析師排名、目前 CFRA STARS、Validea，已分別查官方方法／performance disclosure 與針對產品名稱的獨立研究搜尋；找到的材料如上。「本輪未找到」是本次檢索範圍的結果，不是宣告世界上不存在。一般分析師研究、基金評等研究及平台心得均未當作這些產品的驗證。

## 6. App 現有資料能做什麼、不能做什麼

### 6.1 程式核對：共識目前主要在展望頁，不是名單頁的完整個股研究資料

以下位置均於 **2026-10-28** 親自開檔核對：

| 位置 | 已確認的內容 | 對建議的限制 |
| --- | --- | --- |
| `web/src/lib/consensus.ts:4` | `ViewRow` 只有目標均值、買持賣及 EPS up/down 等部分欄位。 | 沒有逐分析師 ID、評等事件、原報告時間，也沒有目標分布。 |
| `web/src/lib/consensus.ts:30` | 選新近快照，再依 SPY 權重彙總；`web/src/lib/consensus.ts:62` 計算修正廣度。 | 是指數層級的背景彙總，不能直接當個股研究模組，也不是已驗證的選股模型。 |
| `web/src/lib/sources/nasdaq.ts:173` | `AnalystView` 已有 `targetLow/High/Mean`、評等家數、`fiscalEnd`、`epsForecast`、`epsUp/Down`、`estimates`。 | 目標價 low/high 及 EPS 期別／樣本數不需新增上游請求即可取得，但未全數傳到展望顯示層。 |
| `web/src/lib/sources/nasdaq.ts:203` | EPS 只取 `yearlyForecast.rows[0]`；`web/src/lib/sources/nasdaq.ts:224` 只呼叫 targetprice／earnings-forecast。 | 不能把第一列無條件叫作未來年度，也沒保留其他年度、季度與 EPS high/low。 |
| `web/src/server/jobs.ts:604` | 目標價取 SPY 權重前 **200**，EPS 修正只取前 **100**，每次最多 **16** 檔。 | 使用者可選的名單股不保證都有完整分析師資料；不能承諾任一名單股都有 EPS 修正。這是本地程式規格，非外部統計數字。 |
| `web/src/server/jobs.ts:642` | `as_of` 是本次抓取的美東日期；同股同日資料會更新覆寫。 | 不是上游分析師發布日期，也不是不變的逐事件 vintage。 |
| `web/db/schema.ts:141` | `analyst_views` 已存 low/high、期別、EPS、估計數及 fetched_at，每股每日一列。 | 可查已保存的日快照；仍不能重建日內事件或個人歷史準確度。未查正式 DB，本報告沒有宣稱實際歷史完整。 |
| `web/src/server/outlook.ts:74` | loader 只選部分欄位；`web/pages/outlook.tsx:305` 才顯示共識及表格。 | 顯示 low/high 等要改資料傳遞與呈現，不是改 `consensus.ts` 一個公式就完成。 |
| `web/pages/watchlist.tsx:107`、`web/pages/watchlist.server.ts:8` | 名單頁目前是成員、權重、走勢連結與增刪管理。 | 「個股研究卡」是新呈現，不是原頁已藏著完整研究資料。 |

### 6.2 少量公開端點確認：有歷月共識，但沒有逐位分析師的事件

**2026-10-28** 僅對 AAPL 各做一次公開唯讀請求，均取得可解析 JSON；不取其股價序列、不做計算、不新增歷史統計：

- [Nasdaq `targetprice`](https://api.nasdaq.com/api/analyst/AAPL/targetprice)：`consensusOverview` 有 `lowPriceTarget`、`highPriceTarget`、`priceTarget`、`buy/hold/sell`；另有 `historicalConsensus`，其中 `z` 帶日期、買持賣及 consensus。**現行 parser 沒有保留這段歷月資料。** 回應沒有逐位分析師 ID、逐筆升降評、各目標的發布日或目標價標準差。
- [Nasdaq `earnings-forecast`](https://api.nasdaq.com/api/analyst/AAPL/earnings-forecast)：除 yearly 外也有 quarterly；各列有 `highEPSForecast/lowEPSForecast`、`noOfEstimates`、`fiscalEnd`。`up/down` 的 header 原文是 **“Over the Last 4 Weeks Number of Revisions”**，不能保證是去重後的分析師家數。回應的 forecast `asOf` 為 null；不能用 fetched_at 冒充分析師最後更新時間。

這是單一股票、單次結構確認，不代表所有股票或永久都有欄位。`historicalConsensus` 是現在回傳的歷史，沒有核實不可修訂性；也不能把其中 `y` 未經文件確認就改稱歷史股價。公開可讀端點並不自動證明可長期大量擷取或重新散布；本輪沒有取得正式資料授權文件。

### 6.3 功能候選與資料差距

| 候選 | 現有資料／Nasdaq API 是否已有？ | 證據支持到哪裡 | 建議 |
| --- | --- | --- | --- |
| 單股目標均值＋最低／最高、來源及抓取日 | **已有**：parser 與 DB 有 low/high；`consensus.ts` 的 `ViewRow` 與 loader 未帶。 | 目標價誤差與分歧研究支持附上下文；沒有支持把範圍當實際價格機率區間。 | 先顯示原始範圍，不用單一 upside 作主視覺，不畫「達標機率」。 |
| 真正 target dispersion（標準差／分位數） | **沒有**逐筆目標與標準差；只有 extrema 不能還原分布。 | Yale 研究是 dispersion 的資訊效果，不是任意風險等級門檻。 | 不把 max–min 標成標準差；可保留原始範圍，日後比例化先定義。 |
| 近四週 EPS 修正及 estimates、所屬 fiscal period | **已有部分**：現有只抓第一個 yearly row；來源有更多期別。 | EPS revision 文獻支持關注變化，但尚未驗證目前這個計數代理。 | 標「上修／下修次數」，附財年與估計數；不稱「多數分析師上修」或「修正動能強」。 |
| EPS 共識金額的修正幅度 | **可前瞻收集**同 fiscalEnd 快照；現行不保留完整期限結構。 | 不能拿年度換檔造成的跳動當升降修；EPS basis 一致性也要確認。 | 本輪不算。若做，先登記同年、同 basis 的比較規格。 |
| 評等變動 | **部分有**：日快照、上游歷月家數；**沒有**逐分析師事件。 | Jegadeesh 的評等變動不等於買進家數差。 | 最多稱「共識構成改變」，並顯示總家數改變；真正「某券商升評」需新事件資料源。 |
| 分析師歷史準確度 | **沒有**：缺 analyst ID、原始預測／撤回、期限、split-adjusted target 及同時點 benchmark。 | Bradshaw 發現的持續能力經濟上弱；TipRanks 排名的未來有效性本輪未建立。 | 暫不做個人排行榜，更不以其重加權共識。 |
| 個股研究備忘錄與下一次核對事項 | **沒有**逐股結構化筆記；現在規劃頁只有整體 notes。 | 專業流程是可追溯性的參考，沒有報酬提升證據。 | 可先給手動模板；逐股保存是新功能，需要產品決定。 |
| moat、商業星等與綜合評分 | **沒有**；Nasdaq 兩個端點不供應這些專有評等。 | 各系統不同，獨立證據有衝突、成本及資料版本問題。 | 只提供方法教學與原站外連，不建立「本站 Strong Buy」。 |

所有個股證據留在 d（觀察名單）及資料說明層。對 a（每月定投）沒有新指令；對 b／c 只借規劃紀錄與假設檢討，不把個股訊號移到 ETF 操作上。

### 6.4 若日後要計算，先登記什麼（本輪全部未執行）

以下是**建議事前登記的計算定義及展示門檻**，不宣稱預測力、不占用現行 forecast 試驗名額。不得先看報酬再把它們改成選股門檻；若要驗證報酬／排名／警示效果，須另訂實驗且先合併登記。

| 計算 | 先寫死的定義 | 展示／採用門檻 |
| --- | --- | --- |
| 目標價相對範圍 | `(targetHigh − targetLow) / price`；`price` 必須標明自己的 `price_date`，不得混用日內價與其他日期目標快照。 | 只有 low、high、price 均有值，price 為正且 low 不大於 high 才展示；價格日與快照不同日就不計比例。只叫「相對範圍」，**不設定高低風險或買賣門檻**。這是產品規格，不是由文獻估出。 |
| EPS 計數廣度 | `(up − down) / (up + down)`；保留原次數、fiscalEnd、estimates。 | 只在 up/down 都有值且總修正次數為正時展示；已知兩者均為零顯示「沒有修正」，缺資料顯示「缺資料」。不把 `estimates` 當作目標價分析師數，也不把同一滾動窗口的每日數字加總。 |
| 同期別 EPS 共識變化 | 同 symbol、同 fiscalEnd、同 EPS basis 的新舊快照差；先顯示原 EPS 金額差，不用接近零或負 EPS 算百分比。 | 比較日期與抓取時間先公開；財年／basis 不同就不產生「修正」。資料對齊方式先登記，**本輪不挑最佳回看窗**。 |
| 共識構成變化 | 新舊買／持／賣各分類與總家數並列；保留新增／消失覆蓋未知的事實。 | 只能稱快照差異；沒有同 analyst／broker 的事件鍵與原發布時間，就不得稱升評／降評家數。 |

這些定義只處理「可不可以如實顯示」。任何「高分歧就避開」「上修越多就買」「高星分析師應加權」的有效性計算，都不是本表授權的延伸；現有文獻未提供一個可直接移植到本站大型股名單的門檻，所以**本輪不建議開新的股票交易模型試驗**。

## 7. 來源覆核與剩餘缺口

- **讀到原始正文／方法／表格**：Barber 的作者原文；Palley–Steffen–Zhang 作者稿；Guo–Jame 作者稿（含 back-filled 註腳及 Table 3）；Morningstar 自評正文與方法；Baillie Gifford 方法；Capital System；Berkshire 原信；Zacks、CFRA、TipRanks、Validea 的官方揭露；AAII 的自有追蹤表。部分網頁在文字擷取器 403，但瀏覽器可讀，不能因此錯報未取得。
- **只讀原摘要，未讀全文**：Womack；Jegadeesh 等；Gleason–Lee；Bradshaw 等；Liu–Peabody；Lacey–Phillips-Patrick；Lutey–Rayome。未載的樣本期、期限、成本與檢定細節不補猜。
- **原論文全文轉呈、非官方期刊主機**：Bolster 等讀到 ResearchGate 上的原論文；期刊 DOI 主機未能開。Base Rate Book 讀到原報告鏡像，官方存檔未核實。
- **只有出版社搜尋索引摘要／驗證受阻**：Bernhardt 等 *Who herds?*、Kanuri–McLeod 的 moat 研究；未拿到全文。另一篇 moat 原期刊亦遇驗證，不採結論。
- **只有官方文件搜尋索引**：Fidelity 基金策略 PDF 的正文網址轉至 reports 頁，未取得正文；表格已標未核實，不作單獨推薦依據。
- **未獲獨立前瞻績效驗證**：Zacks Rank 專有排名、TipRanks 分析師排名、目前 CFRA STARS、Validea 平台組合。本輪沒有以心得文章或一般 EPS 文獻補成「有」。
- **資料待判斷**：Nasdaq EPS 的 basis、修正是否去重、目標價實際 analyst count、個別目標的年齡／期限、歷月共識修訂政策、可散布授權。本輪只驗證端點實際回應，不替它補一份不存在的資料字典。

## 給整合者的摘要

### 關鍵發現（3–8 條，每條附證據等級與來源）

1. **評等變動比孤立水準更值得研究，但不等於可交易指令。** Jegadeesh 等（2004）支持季度共識變動的橫斷面資訊；Barber 等（2001；報酬樣本 1986–1996）則發現交易成本後優勢未可靠大於零，最大型公司亦無可靠評等報酬差。**`academic_is`，正（變動資訊）／零（成本後與大型股水準差）**。[Jegadeesh 原摘要](https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.2004.00657.x)、[Barber 原文](https://www.anderson.ucla.edu/documents/areas/fac/accounting/trueman_5.pdf)
2. **目標價應附範圍、期限與資料年齡。** Bradshaw 等（2013；2000–2009 的 12 個月預測）發現精準度差、持續能力經濟上弱；Palley 等（2025；1999–2020、後續 12 個月）發現高分歧時，高隱含漲幅與未來報酬的關係反而為負。**`academic_is`，負**。範圍是背景，不是價格機率區間。[Bradshaw 原摘要](https://link.springer.com/article/10.1007/s11142-012-9216-5)、[Palley 作者稿](https://insights.som.yale.edu/sites/default/files/2025-01/Consensus%20target%20prices.pdf)
3. **商業評等有正反獨立結果，不能全寫成有效或全寫成官宣。** Morningstar 股票星等的獨立學術研究結論相反；Seeking Alpha Quant 的作者研究在 2016–2022 月頻橫斷面得到正結果，但含回填歷史，未證明不可改寫的模型及成本後績效。**`academic_is`：Morningstar 正／負分歧，Seeking Alpha 正**。[Bolster 原論文全文](https://www.researchgate.net/publication/297600234_Assessing_performance_of_Morningstar%27s_star_rating_system_for_equity_investment)、[Liu 原摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2838992)、[Guo–Jame 作者稿](https://russelljame.com/quant_Ratings_9_15_23.pdf)
4. **漂亮績效先看計算揭露。** Zacks 的正面結果屬 **`bank_claim`**，官方承認未扣多項成本；CFRA 同為 **`bank_claim`** 的模型績效；Validea 自家模擬屬 **`anecdotal`**，且 optimal portfolios 事後挑選。三者均不能當獨立成本後 alpha（2026-10-28 查閱）。[Zacks](https://www.zacks.com/performance_disclosure/)、[CFRA](https://www.cfraresearch.com/legal/performance-disclosure-stars-performance-charts/)、[Validea](https://www.validea.com/disclaimer)
5. **買方最可借的是研究假設、反證、核對事件與檢討紀錄。** Capital Group 不是一律由委員會決定，Baillie Gifford 分開研究與組合決策；這些做法改善報酬的證據是 **`none`**，適合作為可追溯流程，不能包裝成 alpha。[Capital System](https://www.capitalgroup.com/advisor/about-us/capital-system.html)、[Baillie Gifford 2024-11 方法](https://media.bailliegifford.com/mws/5qvlncac/20241122142158_sustainable-growth-p-p.pdf)
6. **資料口徑先修正：EPS 是修正次數，快照變化不是升降評。** 2026-10-28 的 Nasdaq 唯讀回應有目標價範圍與歷月共識，沒有逐分析師事件；EPS header 稱近四週 revisions，forecast asOf 為 null。**`none`：資料事實，沒有預測力主張。** 現行取值見 `web/src/lib/sources/nasdaq.ts:203`，抓取／同日覆寫見 `web/src/server/jobs.ts:642`。[Nasdaq targetprice](https://api.nasdaq.com/api/analyst/AAPL/targetprice)、[Nasdaq earnings-forecast](https://api.nasdaq.com/api/analyst/AAPL/earnings-forecast)

### 對我們 App 的建議

| ID | 建議 | 服務哪個決策（a 每月定投／b 加碼研究預算／c ±20% 檢討／d 觀察名單個股／資料／流水線／呈現） | 證據等級 | 成本（低／中／高） | 需事前登記？ | 與既有規則或排除清單衝突？ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1-01 | 先補來源、抓取日、價格日、EPS 財年、估計數及缺資料說明；現有 DB 多已保存，名單股不保證都在抓取 universe。 | d／資料／呈現 | none：資料語義 | 中 | 否，僅原始欄位展示 | 無；不產生訊號 |
| D1-02 | 目標價均值旁並列原始最低／最高；降低單一 upside 的視覺優先度。現有 parser／DB 已有，loader 未全帶；不稱機率區間。 | d／呈現 | academic_is：精準度負面及分歧資訊 | 中 | 原始欄位否；若算相對範圍，先登記 §6.4 定義 | 無；不得接入指數模型或交易規則 |
| D1-03 | EPS 顯示「近四週上修／下修次數＋財年＋估計數」，保留原計數；不要直接叫修正動能。來源有、現行只取首列 yearly，且僅部分股票抓 EPS。 | d／資料／呈現 | academic_is：修正資訊正；此代理未驗證 | 中 | 原始欄位否；金額變化／廣度計算先登記 | 無；不映射成加碼或出場 |
| D1-04 | 如顯示歷史，只稱共識構成變化並附總家數；真正升降評須新事件源。現有快照／上游歷月資料不足以辨認個別升評。 | d／流水線／呈現 | academic_is：變動資訊正，代理未驗證 | 中 | 是，先定義快照比較及事件用語 | 無；不得把家數差冒充升降評訊號 |
| D1-05 | 提供逐股研究筆記模板：企業論點、來源、反證、下一次核對事件與修改理由；不計總分。現在沒有逐股筆記儲存。 | d／呈現 | none：流程參考 | 中 | 否；不做預測或報酬宣稱 | 無；不提供買賣建議 |
| D1-06 | b／c 的筆記只借「原假設是否改變、是否需要重做研究」；±20% 保持使用者的檢討門檻，不改成停損停利或個股配置。 | b／c／呈現 | none：產品邊界與流程 | 低 | 否；不新增計算或規則 | 無；保留 X03／L17，a 不變 |
| D1-07 | 若未來要研究共識，先前瞻保存來源快照、抓取時間、期別與版本；現在的同日覆寫及可變上游歷史不冒充不變 vintage。 | 資料／流水線 | none：驗證基礎 | 中 | 收集規格先固定；任何績效測試須另案登記 | 無；本輪不跑測試、不開 forecast 名額 |
| D1-08 | 提供評等制度、利益衝突與績效口徑的原站教學外連；暫不匯入商業星等或分析師排行榜來組成本站評分。 | d／呈現 | none：資訊說明；未主張評等有效 | 低 | 否 | 無；不建立 Strong Buy 或依評等控制扣款 |

### 建議不要做的事與理由

- 不以單一目標價隱含漲幅當個股主判斷；不把 low/high 當信賴區間，也不自訂「高分歧＝賣出」。有誤差與分歧證據，沒有可直接移植的交易門檻。
- 不把 EPS 四週修正次數稱為不同分析師家數，不累加重疊窗口；不把共識家數差稱為升降評。
- 不依今天的 TipRanks／guru／星等榜單回選歷史，不用不同策略的官宣報酬做排名；本輪未找到這樣選人的獨立前瞻成效證據。
- 不把個股橫斷面結果變成 ETF 加碼、停扣或 ±20% 自動賣出規則；不重開 meta-labeling 或已否決的指數輸入。
- 不因公開方法看起來專業，就替名單股生成沒有資料支持的 DCF、公允價、部位大小或買賣評語。

### 未核實、不確定、需要人判斷的地方

- 多篇經典研究只讀原摘要，完整樣本、持有期或成本細節未核實者已逐項標示；不能拿摘要補出可交易 alpha。
- Morningstar 相反研究的可比性尚未釐清；moat 的獨立證據未完整覆核；Base Rate Book 官方存檔未取得，只讀原報告鏡像。
- Seeking Alpha 的正面學術結果值得保留，但回填歷史、模型版本不變性與成本後表現仍有限制；Zacks 會計師核閱原件未取得。
- Nasdaq 尚缺 EPS basis、修正去重規則、目標價樣本數／個別年齡、歷史修訂政策與正式散布授權；單次 AAPL 回應不能保證整個名單都有資料。
- 個股筆記是否值得新增持久儲存，由產品決定；專業流程可追溯的價值合理，但本輪沒有證據證明它提高投資報酬。
