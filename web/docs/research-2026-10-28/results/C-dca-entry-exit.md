# 任務 C：定期定額投資人的進出場紀律、證據與台灣條件

研究及查核日：2026-10-28。範圍是每月新收入投入、既有加碼研究預算，以及漲跌門檻觸發的檢討。本報告沒有執行市場回測、探索性統計、正式站 API 或寫入其他專案檔案；下列歷史結果全部來自文獻或機構已發布的研究。末節提案並不代表已核准新增試驗。

**結論：沒有足以支持修改 X03 的直接證據。** 有證據支持少延後可投入資金、控制成本、按目標管理配置；這與依市場訊號調整定投是不同決策。趨勢策略也有正面發表後證據，不能說所有擇時都無效；但其資產、規則、成本與資金流，仍不足以驗證本 App 的台幣定投加減碼政策。

## 研究邊界與證據標示

已閱讀既有 `web/docs/forecast.md` 的研究、X03／L17 與第二輪登記，以及 `web/docs/research-2026-10-27/proposal.md` 的排除清單。本輪不重述投行目標、指數預測因子、CTA 或 vol targeting 的既有整理；涉及均線、VIX、CAPE，只處理「現金怎麼投入／出場」的新證據與適用性。

每個有效性主張只指定一個等級：`none`、`bank_claim`、`anecdotal`、`academic_is`、`academic_oos` 或 `independently_tested`。正／零／負，是相對該列比較對象的結果，不是保證。機構自行做的歷史回測列 `anecdotal`；只有主張、未讀到檢驗內容才列 `bank_claim`。理論或合成模擬不等於歷史樣本外，本分類沒有理論專用欄，列 `academic_is` 時會明說。法規、產品規則、程式現況列 `none`，意思是沒有預測效果主張，**不是法規證據不足**。除特別註明，下面都不是橫斷面選股。

查核狀態分清楚：讀到原文、只讀到作者／出版社摘要、原文副本、未核實。未取得全文的研究不以搜尋片段補出樣本、現金利息或交易成本。

## 先確認 App 現在真的做了什麼

以下行號均於研究日親自開檔確認，屬本地一手來源；沒有執行其中任何歷史計算。

| 位置 | 確認的行為與研究含義 |
| --- | --- |
| `web/src/lib/analytics.ts:153`、`web/src/lib/analytics.ts:177` | `simulateDca` 按資料中每月第一筆價格買入；期初單筆對照把期末累計投入額全部放在第一天。這假設整筆資金起初已存在；對薪資逐月到帳的人，不能稱為錯失的可行報酬。 |
| `web/src/server/views.ts:294`、`web/pages/etfs.tsx:187` | 每日價格乘當日或之前最近的 USD/TWD，再做台幣投入試算；網頁明示不含配息、手續費、換匯價差與稅。這不能拿來排美國配息型與愛爾蘭累積型 ETF 的稅後優劣。 |
| `web/src/server/views.ts:224`、`web/pages/etfs.tsx:222` | 有研究預算、每批金額與檢討百分比，但目前只列可分幾批及文字提醒，沒有實際持倉、交易帳本、觸發基準或出場規則。 |
| `web/pages/etfs.tsx:207`、`ios/MarketObservatory/Views/MoreView.swift:254` | 網頁寫「檢討門檻 ±%」，iOS 卻寫「考慮出場的漲幅」。後者把雙向檢討縮成上漲出場，容易形成未經驗證的停利暗示。 |
| `web/src/lib/universe.ts:29`、`web/src/lib/universe.ts:45` | 產品有費率與來源網址，尚無註冊地、配息／累積、稅務身分與交易通路等成本比較所需欄位。 |
| `ios/MarketObservatory/Models.swift:336` | `Plan` 的既有欄位不是 optional；後續資料結構擴充須兼容已安裝的 App，不宜直接換掉既有意義。 |
| `web/docs/forecast.md:114`、`web/docs/forecast.md:720` | X03／L17 禁止依風險或 regime 提供加碼、停扣建議；`web/docs/forecast.md:118` 另明定登記合併前不得執行候選計算。 |

## 一次投入與定期定額：先問資金何時存在

**決策 a 是「薪水到帳後投入」；決策 b 才可能是「已有整筆現金而分批」。** 一次投入研究不能叫薪資族把尚未賺到的錢提前買進，也不支持借款加速投入。Vanguard 更新版自己就把兩種情境分開，研究對象是已可立即投入的 lump sum。[Vanguard，2023-02，Clarifying cost averaging](https://corporate.vanguard.com/content/dam/corp/research/pdf/cost_averaging_invest_now_or_temporarily_hold_your_cash.pdf)

| 原文與日期 | 比較、期限、市場、現金報酬 | 證據等級與結果 | 限制／對我們的意義 |
| --- | --- | --- | --- |
| Vanguard，Shtekhman／Tasopoulos／Wimmer，*Dollar-cost averaging just means taking risk later*，2012-07 | 基本比較是已有全部資金，一次投入 vs 分十二個月投入，滾動十年終值；美國 1926–2011、英國 1976–2011、澳洲 1984–2011。股債配置的代表例中，一次投入勝率依序為 67%、67%、66%；未投入資金放現金投資，**有現金報酬**。 | `anecdotal`；正：一次投入通常有較高終值。 | **官方原發布路徑未核實**：現在轉往新聞室，未回原 PDF；實際讀到的是標示 Vanguard 作者與版權的完整原文副本，而非二手文章。數字僅按該副本引用，不宣稱官方現站仍可驗證。 [原發布路徑](https://pressroom.vanguard.com/nonindexed/7.23.2012_Dollar-cost_Averaging.pdf)、[原文副本，方法及 Figure 1](https://indexacapital.files.wordpress.com/2017/07/dollar-cost-averaging-just-means-taking-risk-later-vanguard-2012.pdf) |
| Vanguard，Finlay／Zorn，*Cost averaging: Invest now or temporarily hold your cash?*，2023-02 | MSCI World，1976–2022；整筆 vs 三個月等額分批，比一年後財富。基本圖未投入現金利息為零，一次投入勝率 68%；另給等待現金三個月美國國庫券利息後，勝率仍為 65%。 | `anecdotal`；正：一次投入終值；負：最差下行情境的初期損失較大。 | 有計息敏感度，不能只引未計息版本。不是台幣、不是單獨 S&P 500、不是前瞻試驗。高損失厭惡者選短期分批有其效用理由。 [原文 Figure 2、現金利息敏感度及 loss-aversion 分析](https://corporate.vanguard.com/content/dam/corp/research/pdf/cost_averaging_invest_now_or_temporarily_hold_your_cash.pdf) |
| Morningstar，Amy Arnott，*When Dollar-Cost Averaging Can Help (or Hurt)*，2020-09-04，轉述自家 2019 研究 | 股票組合自 1926 起，考察不同長度；文中報告 DCA 在十個月期間勝率 27.8%，十年期間為 10.0%。 | `anecdotal`；負：DCA 的報酬優勢不普遍。 | 文章本身已讀到；**底層完整研究方法未核實**，文章未完整交代現金計息、終值與 IRR 的可比性，不拿這兩個勝率與 Vanguard 合併。文章也明說有些人的錢只能逐月投入。 [Morningstar 原文](https://www.morningstar.com/markets/when-dollar-cost-averaging-can-help-or-hurt) |
| Constantinides，*A Note on the Suboptimality of Dollar-Cost Averaging as an Investment Policy*，1979-06 | 理論比較預先固定投入政策與可行的最適政策；不是市場歷史勝率研究。 | `academic_is`；負：DCA 不是該模型下的最適政策；此處為理論，無歷史 IS／OOS。 | **全文未核實**：出版社頁本次未成功取得。實際讀到 RePEc 摘要及 Hayley 原文的引述；不據此說現實中「全部投入股票」必然最適，也不補寫現金假設。 [出版社原文入口](https://www.cambridge.org/core/product/identifier/S0022109000005408/type/journal_article)、[實際可讀摘要](https://ideas.repec.org/a/cup/jfinqa/v14y1979i02p443-450_00.html) |
| Rozeff，*Lump-Sum Investing Versus Dollar-Averaging*，1994 冬季 | 作者摘要說在正風險溢酬下，應先匹配兩種政策的風險；十二個月比較及 S&P 500 年度資料支持一次投入，風險厭惡者可一次建立較低股票配置。 | `academic_is`；正：風險匹配後的一次投入政策。 | **全文與現金報酬細節未核實**；實際讀到作者 SSRN 摘要，沒有足夠資料把它升為 OOS。不是叫每人把全部資產放股票。 [作者摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=820004) |
| Williams／Bacon，*Lump Sum Beats Dollar-Cost Averaging*，1993-04；作者於 AAII 重刊，1993-06 | 美國股票，1926–1991 的滾動一年比較，等待資金放 Treasury bills；研究各種投入安排的整體結果偏向一次投入，但承擔更多風險。 | `academic_is`；正：一次投入的歷史平均報酬。 | 「所有研究安排整體較好」不是「每個起點都贏」。有利息，未證明未來或台幣稅後結果。 [期刊頁](https://www.financialplanningassociation.org/article/lump-sum-beats-dollar-cost-averaging)、[作者重刊](https://www.aaii.com/journal/article/10425-dollar-cost-averaging-vs-lump-sum-investing) |

行為面的反方不是「DCA 預測得更準」。Statman 的 *A Behavioral Framework for Dollar-Cost Averaging*（1995 秋季）以 regret、mental accounting 等解釋其吸引力；本次讀到作者研究頁及作者上傳版本的摘要，未核實完整實驗，對「DCA 造成較高持續投入率」列 **`none`，結果未確立**。Vanguard 的效用模型則容許高度損失厭惡者偏好分批，但不是實際投資人的隨機對照試驗。[作者研究頁](https://www.scu.edu/business/finance/faculty/statman/statman-research/)、[作者上傳版本入口](https://www.researchgate.net/publication/240315400_A_Behavioral_Framework_for_Dollar-Cost_Averaging)、[Vanguard，2023-02](https://corporate.vanguard.com/content/dam/corp/research/pdf/cost_averaging_invest_now_or_temporarily_hold_your_cash.pdf)

**產品推論**：對已持有現金、但真的會因恐懼而無限延後的人，使用者事先選定、有限期、與行情無關的分批計畫可以作為執行工具。App 應呈現「承受初期風險與延後曝險的取捨」，不宣稱找到更便宜的買點，也不拿一次投入結果責備逐月領薪的人。

## 條件式加碼：價格便宜於昨天，未必便宜於開始等待時

| 規則／新證據 | 等級、結果、期限與資產 | 現金及驗證問題 | 判定 |
| --- | --- | --- | --- |
| 跌 X% 才投入：Nick Maggiulli，2021-09-21 | `anecdotal`；負：文中美股 1920–2020 的滾動二十年，從歷史高點回撤後才花累積現金；下跌門檻 10% 時，中位終值落後 DCA 約 5%；門檻 50% 時約落後 13%。 | 文中有逐月儲蓄、買後不再賣出的清楚規則；但沒有完整揭露現金計息、價格／總報酬底層實作，**這些細節未核實**，不能把差距全解釋為純訊號效果。 | 可說明等待的風險；不把作者挑出的失敗或成功年代當普遍定律。 [作者原文](https://ofdollarsanddata.com/why-buying-the-dip-is-a-terrible-investment-strategy/) |
| AQR，*Hold the Dip*，2025-12-01 | `anecdotal`；負：自行檢驗 S&P 500 多種回撤與持有期組合，1965-01–2025-09，平均 Sharpe 較持有指數低 0.04；含息資料的 1989-10–2025-09 子期間差距更差。 | 現金用 ICE BofA 3M T-Bill Index，**有現金利息**；長樣本用價格報酬，較短樣本用總報酬；不含費用。它有賣回現金的持有期，不等同只拿額外預算加碼。 | 提供與既有因子研究不同的政策層負證據；原文也明說逐月 DCA 的完整比較留待後續研究，不能稱它已直接驗證我們的 b。 [原文 pp.4–7、註腳 13](https://www.aqr.com/-/media/AQR/Documents/Alternative-Thinking/AQR-Alternative-Thinking---Hold-the-Dip.pdf) |
| 低於 SMA200 加碼 | `none`；結果未確立：本次未找到同資金流、有限預算、含現金與台灣成本的直接 OOS 檢驗。 | Faber 是「低於均線減少既有曝險」，與「低於均線加碼」方向相反；不能挪其證據。 | 不新增買點提示。這不是證明所有此類政策無效，而是缺少匹配本問題的證據。 |
| VIX 高時加碼：Lim／Ong，*Weighted and Pure Dollar-Cost Averaging Strategies in Various Asset Classes*，2023-12-21 | `academic_is`；負：出版社摘要報告所測 VIX 加權規則均落後純 DCA。研究期間為 2017-01-02–2021-12-27，跨美股指數與其他資產。 | **全文未核實，付費牆**；實際讀到出版社摘要。尤其摘要寫的是 VIX 低時增額、高時減額，不能把負結果翻面當成「高 VIX 加碼有效」。多規則搜尋、有限研究預算與現金帳戶細節均未核實。 | 對題目指定「高 VIX 加碼」仍無直接可靠 OOS；不因摘要事後提議反向做法而產生候選。 [出版社摘要](https://link.springer.com/chapter/10.1007/978-981-99-8369-8_8) |
| Value averaging：Edleson 的目標財富路徑 | `anecdotal`；正：原作者主張可提高投資報酬；本次未核實全書檢驗。 | 先訂目標市值，每次補足「目標－當下市值」，超額時可能賣出。加碼所需資金不固定，須另備 side fund，與有限研究預算不同。出版商頁確認原作與更新版，但不能當獨立檢驗。 | 不能只展示投資部位 IRR。 [Wiley，更新版 2006-10、提及原作 1991](https://www.wiley.com/en-ca/value-averaging-the-safe-and-easy-strategy-for-higher-investment-returns-p-9780470049778) |
| Hayley，*Dynamic Strategy Bias of IRR and Modified IRR – the Case of Value Averaging*，稿本 2014-10-07 | `academic_is`；負：理論與合成模擬顯示，VA 能提高 IRR／MIRR 而未提高預期金額利潤；不是新的市場 OOS。 | 這是對 VA 的**外部學術批評**。投入額回應已發生報酬，會改變衡量權重；加入 side fund 或改用 MIRR 並不能自動消除其衡量偏誤。 | 本 App 若比較 b，需同一外部資金供給與總帳戶終值，包含未動用現金；不能拿較高 IRR 證明加碼有效。 [大學原文庫，尤其 §3–4 及 side-fund 註腳](https://openaccess.city.ac.uk/6298/1/VALUE%20AVERAGING%207%20October%202014.pdf) |
| CAPE 調整投入：Luskin，*Dollar-Cost Averaging Using the CAPE Ratio: An Identifiable Trend Influencing Outperformance*，2017-01 | `academic_is`；正：高起始 CAPE 組的分批策略歷史上較好。美國 1950–2015，滾動十五年，分批也持續十五年，未投入部分按三個月 T-bill 計息。 | 作者明說也看過較短期限，再選 DCA 最有利的十五年；全文的資料描述把 S&P 指數 adjusted close 視為含再投資股息，本次未能核實其資料處理是否成立。沒有獨立保留樣本與台幣成本。 | 這是本輪新增的 DCA 場景證據；不重開既有 CAPE 擇時排除。更不是每月薪水依 CAPE 加減扣款的直接檢驗。 [原文 Methodology、Limitations](https://www.financialplanningassociation.org/article/journal/JAN17-dollar-cost-averaging-using-cape-ratio-identifiable-trend-influencing-outperformance) |

cash drag 不是固定保證損失：其大小取決於股票相對現金的報酬與等待時間。Vanguard 的計息版本與 AQR 的國庫券對照顯示，負結果不只出於「把現金利率設成零」。但台幣銀行存款、美元國庫券及尚未換匯的現金不是同一資產；不可拿美元利率直接替代台灣使用者的等待成本。

「有獨立檢驗嗎」的精確答案：VA 有 Hayley 的外部理論與模擬批評；趨勢有下節的外部近似延伸；本次沒有找到可直接驗證我們有限 b 預算、維持 a 扣款、含完整台幣成本的條件加碼 OOS。文獻缺口不是可偷偷跑一遍歷史來補的理由。

## 出場、停損與檢討：不能省掉重新進場規則

### 停損、移動停損、趨勢出場

Kaminski／Lo，*When Do Stop-Loss Rules Stop Losses?*（作者早期稿 2007-01-03）推導：在其 random-walk 假設下，簡單全進全出停損降低預期報酬；有 momentum 才可能增加價值。該版本實證是美股與長期美國政府債，月頻 1950-01–2004-12，不是台幣股票 ETF 停損後放銀行。**`academic_is`；結果：有條件為正，random-walk 特例為負**，沒有證明固定損失百分比普遍最適。作者摘要已核實，完整版本差異未核實；後來期刊版改用日頻期貨，不把不同版本的數字混在一起。[作者早期稿與摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=968338)、[期刊版入口，2014](https://doi.org/10.1016/j.finmar.2013.07.001)

移動停損以持有期間高點為基準；固定停損以成本或另一個固定錨點為基準。兩者不是同一規則。若沒有成交時點、跳空處理、賣出後資產、重新進場條件與成本，單說「跌到門檻賣」還不是可驗證政策。**對台灣 S&P 500 定投的移動停損優勢：`none`，結果未確立**；本輪未取得足以直接採用的 OOS 證據。

Faber 的 *A Quantitative Approach to Tactical Asset Allocation*（最初 2006 工作稿、2007 春季發表；本次讀作者提供的 2013 更新版）規則是月末價格相對十個月均線，全進或改持短期國庫券，按總報酬資料計算，含國庫券現金利息，不含稅、佣金與滑價。這是既有部位出入政策，並非跌深後加碼。**原始歷史檢驗 `academic_is`，風險調整結果為正；發表後更新 `anecdotal`，作者報告結果為正**，兩項主張分開，不把作者更新叫獨立複驗。[作者原文，規則與 Figure 16 的 2006–2012 更新](https://mebfaber.com/wp-content/uploads/2016/05/SSRN-id962461.pdf)

有一項較新的外部證據值得保留：Gabriel／Pagani／Zarattini 的 *Global Tactical Asset Allocation: Updated Results and Real-Market Implementation Using Python and IBKR*，PDF 標示 **2025-04**，網站推介文章日期 **2026-06-23**。其 2006–2025-03 延伸期報告 CAGR 6.05%、Sharpe 0.68、最大回撤 11.7%。**`independently_tested`；正：外部作者對近似多資產趨勢規則的歷史延伸有正面結果**。[研究 PDF pp.1–2](https://concretumgroup.com/wp-content/uploads/2026/06/GlobalTacticalAssetAllocation.pdf)、[發布文章](https://concretumgroup.substack.com/p/global-tactical-asset-allocation)

這個等級只指有外部作者實際檢驗，並不等於原規則精確複製或實盤認證：它用 **200 日**均線代替原十個月均線；涵蓋股票、海外股票、債券、商品與 REIT；含 T-bill 現金、不含稅佣金滑價；「OOS」起點還包含正式發表前的資料。文中又探索再平衡日期與新分批變體，不能把後者也當未調整的發表後驗證。上述數字沒有直接證明單獨 S&P 500 的停扣優於持續扣款。這是對「所有趨勢必然無效」的反證，但不是修改 X03 的充分證據。

### 再平衡：價格門檻和配置偏離是兩回事

Vanguard 的 *Best practices for portfolio rebalancing*（2010-07）研究目的在維持資產配置風險；不是追求最準出場點。它比較美國長期股債資料，報告月、季、年再平衡的風險調整結果相近，而交易次數差很多；建議合理頻率檢查、配合配置偏離門檻。**`anecdotal`；零：沒有單一普遍最優頻率；正：配置風險較接近目標**。本次取得原文副本；**官方原刊檔案未核實**，不把副本當官方現站。[原文副本，2010-07](https://indexacapital.com/bundles/unaiadvisor/docs/papers/2010-Vanguard-Best-practices-for-portfolio-rebalancing.pdf)、[官方目前教育頁，查核 2026-10-28](https://investor.vanguard.com/investor-resources-education/portfolio-management/rebalancing-your-portfolio)

有新證據，不能只停在舊版口訣：Vanguard 在 2025-08-20 公開說明其 Target Retirement Funds／Trusts 於前一年末更新門檻政策，配置偏離 **200 bps** 時交易，回到距目標 **175 bps**，而非一律回到精確目標。**`bank_claim`；正：機構預期可降低成本**，有模擬及成本估計，仍非台灣小額帳戶的獨立 OOS。門檻是「權重的百分點」，不是投資報酬率，不能抄成 ETF 上下漲跌門檻。[官方更新說明，2025-08-20](https://workplace.vanguard.com/insights-and-research/perspective/portfolio-rebalancing-navigating-volatility-in-vanguard-target-retirement-funds.html)、[研究原文](https://corporate.vanguard.com/content/dam/corp/research/pdf/the_rebalancing_edge_optimizing_target_date_fund_rebalancing_through_threshold_based_strategies.pdf)

只有一檔 S&P 500 ETF 時，ETF 內部成分調整不等於個人的股債再平衡。App 沒有整體持倉與配置目標，就無法判斷其 S&P 500 部位是否偏高；觀察名單也不是持倉。

### 固定 ±20% 有沒有依據？

對「廣泛市場 ETF 達固定正負報酬率就該賣、停扣」：**`none`，結果未確立**。本輪沒有找到把 App 這個門檻驗證為最適交易規則的文獻；`web/src/server/views.ts:230` 只有預設值，`web/pages/etfs.tsx:222` 只有文字，不存在計算結果可支持它。台灣金融機構確實也有相近停利話術，但那是機構主張，見下節，不能當學術根據。

更基本的問題是分母：指數相對前高、個人總帳戶相對高點、目前市值相對累計投入、單筆成本，會觸發完全不同的事件；台幣與美元也不同。現階段不應自動替使用者選一個，然後把提醒稱為已驗證。

可先把檢討表做成：資金用途或期限是否變了、緊急預備金與收入是否改變、目前配置是否超過自己原訂風險、賣出成本及當年度海外實現所得、若賣出是否已有再投入安排。這是 **`none` 的產品設計提案**，不是能提高報酬的經驗定律；即使沒有門檻事件也應容許修改規劃。

### 投資人報酬落差：不能全部叫「情緒成本」

Morningstar *Mind the Gap US 2026*（2026-08-06）對截至 2025-12-31 的十年估計：美國基金與 ETF 的平均投資人美元年報酬 **8.7%**，基金總報酬 **9.9%**，差 **1.2 個百分點**；美股基金子群則為 **12.8% vs 13.3%**。**`anecdotal`；負：投資人金額加權報酬低於基金時間加權報酬**，是基金資金流描述，不是選股或市場方向預測。[原報告 pp.1、3、5](https://www.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/blt852a4301adc2f5db/US_Mind_the_Gap_2026.pdf)

新報告自己警告：逐月儲蓄、再平衡等合理行為也能造成落差，不能當成投資人愚笨或犯錯的直接證明。故「停看展望能替每人省下固定行為損失」仍是 **`none`，結果未確立**，不能拿上述落差作 App 承諾。

DALBAR QAIB 的當期完整方法與結果本次**未核實**；實際讀到官方顧問行銷／訂閱頁，不引用網路流傳的最新投資人落後數字。**`bank_claim`；負：其對投資人落後的機構主張，效果量不採用**。[DALBAR 官方入口，查核 2026-10-28](https://advisorstudio.dalbar.com/)

Edesess／Tsui／Fabbri／Peacock（2014-06-17）對 DALBAR 的直接批評是：例行新增儲蓄遇到不同報酬順序，便可能使金額加權報酬落後時間加權報酬，不能據此推論錯誤擇時。**`anecdotal`；零：無法從報酬落差直接辨識行為因果**。本次已讀到批評原文；不接受其中「全部群體不可能落後市場」作萬用否定，因為研究基金母體未涵蓋整個市場。Morningstar 新版也明示這個母體差異。[批評者原文](https://www.advisorperspectives.com/articles/2014/06/17/a-simple-explanation-for-dalbar-s-misleading-results)

## 機構替散戶做什麼：自動化目標，而非給市場燈號

### Robo-advisor 與 target-date funds

下表的公開操作規則均為 **`none`：規則事實，沒有因果績效主張**。它們通常處理長期多資產配置，而非 S&P 500 短期買點；美國稅務帳戶與台灣客戶不能直接類推。

| 服務、來源日期 | 新資金／加碼與再平衡規則 | 不擇時的理由與不能借用的部分 |
| --- | --- | --- |
| Betterment，說明更新 2026-06-19；法律揭露 2026-09-30 | 存入、提領、股息優先拿來修正低配／超配；不足時再買賣。會考慮稅批次、短期資本利得、避免過小交易；目前公開頁指向適用漂移容忍度與 ADV，不能把舊文章的固定門檻當成現行全產品通則。 [官方說明](https://www.betterment.com/help/portfolio-rebalancing-methods)、[法律揭露](https://www.betterment.com/legal/auto-adjust-disclosure) | 依既有風險配置修正 drift，不需要預測反彈；「稅後更好」屬機構設計目標，並未提供台灣稅後超額報酬驗證。 |
| Wealthfront，white paper 2026-03-09 | 存提款、股息及相對配置偏離觸發檢查；用新錢買低配資產，採 threshold-based、考慮賣出稅負。來源沒有提供可直接抄用的單一數值門檻。 [官方白皮書](https://research.wealthfront.com/whitepapers/investment-methodology/) | 官方明說 rebalance 通常降低風險，未必提高報酬；用短期行情修改風險分數屬 market timing。後一判斷為 `bank_claim`、負，沒有在該說明提供 OOS。 [官方 risk-score 說明，2026-03](https://www.wealthfront.com/blog/ask-wealthfront-risk-score-explainer/) |
| Vanguard Digital Advisor，現行文件 2026-08-20 | 通常每個開市日評估；正常情況資產類別相對目標偏離超過 5% 才再平衡，也會依原訂 glide path 調整。這是配置偏離，不是 ETF 報酬。 [Form ADV，Portfolio Rebalancing](https://personal.vanguard.com/pdf/vanguard-digital-advice-brochure.pdf) | 文件明寫方法由長期目標驅動，不從事 market-timing trading。這是公開政策，不是沒有擇時能力的實驗結果。 |
| Schwab Intelligent Portfolios，官網查核 2026-10-28 | 每日監測、需要時交易；將超配資產轉到低配資產，存提款後維持使用者風險配置；每日監測不等於每日交易。 [官方 FAQ](https://www.schwab.com/intelligent-portfolios) | 現金亦是配置的一部分，但不能因叫 robo 就把現金比例當最適。SEC 在 2022-06-13 說明其過往現金配置揭露與 cash drag 問題；這是監管事實，`none`，不當績效回測。 [SEC 原文](https://www.sec.gov/newsroom/press-releases/2022-104) |
| Target-date funds，DOL 說明及 Vanguard 新政策 | 新資金按基金當時配置投入，基金隨目標日期改變股債配置，並按其再平衡政策修正偏離；不同基金有 to retirement／through retirement 等不同 glide paths。 [DOL，2013-02](https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/resource-center/fact-sheets/target-date-retirement-funds-tips-for-erisa-plan-fiduciaries)、[Vanguard，2025-08-20](https://workplace.vanguard.com/insights-and-research/perspective/portfolio-rebalancing-navigating-volatility-in-vanguard-target-retirement-funds.html) | 目標日期與資金用途會改變需要承擔的風險；它不是看到新聞、VIX 或市場下跌就停扣。前節的新門檻成本主張仍只列 `bank_claim`。 |

### 台灣的「停利不停扣」「跌深加碼」產品

不能把外國機構全部描寫為不擇時、再假設台灣也相同。台灣有真正把報酬門檻接到交易的產品，但「能執行」與「勝過同資金條件的定投」須分開。

| 官方產品／查核日 | 已核實的規則 | 效果證據與限制 |
| --- | --- | --- |
| 玉山銀行，2026-10-28 | 官方列「More利扣」定期不定額；另有臨櫃停損停利自動贖回、全部贖回後續扣。頁面沒有披露唯一適用的加碼數值。 [官方說明](https://event.esunbank.com.tw/mkt/wealth/smart-dollar-cost-averaging/index.html) | 規則 `none`；「掌握市場機會」為 `bank_claim`、正，沒有在本次看到的官方資料中附獨立 OOS。 |
| 富蘭克林「集富母子基金」，2026-10-28 | 約定日子基金報酬跌到使用者基礎跌幅，按原金額兩倍或三倍轉申購；有平均／個別報酬設定與停利機制，資金先在母基金。 [官方產品頁](https://event.franklin.com.tw/smartfund/index.html) | 規則 `none`；「提升紀律」為 `bank_claim`、正，沒有因果檢驗。母基金不是無風險現金，須把其風險、費用、轉換與剩餘市值算在總帳。 |
| 台北富邦「奈米投趨勢燈號」，2026-10-28 | 官方明說綠燈時建議加碼；網頁有 2008 年初至 2023 年底的示例：每月底投入 1,000 元，低點增至 3,000 元，並提及停利可考慮 15%–20%。 [官方說明及試算條件](https://nmplusinvestment.taipeifubon.com.tw/nmi-frontend/signalguide) | `anecdotal`；正：機構自家示例。**完整訊號定義、同總資金比較、等待資金報酬與獨立 OOS 未核實**；投入不同不能只比報酬百分比，停利範圍也不是最適門檻證據。這類燈號與 X03 明確衝突。 |

三種產品都不能據此當作本 App 應給買賣建議的背書。可借用的是使用者事先設定、現金來源與已執行紀錄；若 App 自己替使用者決定市場門檻，就已跨入另一項尚未驗證的服務。

## 台灣投資人的實際條件：優先改善可核實的成本

以下皆為 **`none`，法規／產品／成本事實，非市場有效性證據**。適用情境為台灣稅務居住者、非美國公民且非美國稅務居民；美國 estate-tax domicile 又是不同判定。不得只用國籍預設所有使用者都適用。

### 美國 ETF、愛爾蘭 UCITS 與遺產

| 項目 | 核實內容、日期、一手來源 | 對 App 的含義 |
| --- | --- | --- |
| 美國股利預扣 | IRS *Publication 515 (2026)* 及 *Publication 519 (2025)*：非居民的美國來源一般股利，無適用減免時通常按 30% 預扣。這是股利，不是每年資產扣 30%，也不是一般股票資本利得的通則。 [IRS 515](https://www.irs.gov/publications/p515)、[IRS 519](https://www.irs.gov/publications/p519) | W-8BEN 用來證明身分，不會讓沒有適用協定的台灣居民自動享優惠。不同分配性質可能有不同處理，不能把所有 ETF 配息一律硬編成同一稅率。 |
| 台美協定狀態 | 財政部 2026-09-04 所得稅協定表中，美國列在海空運輸單項協定，未列全面性協定；IRS 現行所得稅與遺贈稅協定列表也未列台灣（查核 2026-10-28）。本次沒有看到可把一般台灣居民美股股利直接改成較低協定稅率的生效來源。 [財政部協定表](https://www.mof.gov.tw/singlehtml/191?cntId=63930)、[IRS 所得稅協定](https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z)、[IRS 遺贈稅協定](https://www.irs.gov/businesses/small-businesses-self-employed/estate-gift-tax-treaties-international) | 不把法案或新聞等同生效稅率；資料應有有效日期與官方來源。 |
| 美國遺產稅 | IRS 頁更新 2026-06-28：非居民非公民的美國所在地資產等合計超過 US$60,000，通常須申報 Form 706-NA；不是超過部分一律按最高稅率，也不是立即賣出的投資訊號。 [IRS 官方說明](https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax-for-nonresidents-not-citizens-of-the-united-states) | 用跨帳戶資產與法律身分做「傳承資料檢討」提示，不能只看單一券商，也不能做硬式應納稅額結論。 |
| 美國資產的認定 | IRS *706-NA Instructions*，2025-09：美國法設立公司的股票，不論股票憑證實際放哪，一般屬美國所在地資產；其他公司股票一般在美國境外。 [IRS Stock 規則](https://www.irs.gov/instructions/i706na) | 換到台灣複委託通常不改變直接持有美國 ETF 的法律註冊地。對持有愛爾蘭公司型基金股份的普通非美國投資人，依這項規則推論，其股份一般不屬美國公司股票；這是法律結構推論，特殊信託、聯名、棄籍等個案仍需人判斷。 |
| 愛爾蘭實物 UCITS 的內層股利稅 | 美國—愛爾蘭稅約 Article 10；發行商 State Street 2026-06-02 說明：愛爾蘭 UCITS 持有美股，內層一般承受 15% 美國股利預扣。累積型也先扣內層稅再累積，不是股利免稅。 [IRS 稅約原文](https://www.irs.gov/pub/irs-trty/ireland.pdf)、[發行商結構比較](https://www.ssga.com/hk/en/institutional/insights/considerations-for-non-us-investors-us-etfs-vs-irish-ucits) | 分清楚「底層股票→基金」與「基金→投資人」；內層稅不能冒充投資人本人可拿來抵台灣稅的完稅證明。 |
| 愛爾蘭外層稅 | State Street 同頁說明一般非愛爾蘭投資人符合非居民文件條件時，外層可免預扣；BlackRock 發行商指南同樣說明海外投資人分配的處理。不是說台灣也免稅。 [State Street，2026-06-02](https://www.ssga.com/hk/en/institutional/insights/considerations-for-non-us-investors-us-etfs-vs-irish-ucits)、[BlackRock 指南，2025](https://www.blackrock.com/institutions/en-zz/literature/investor-guide/etf-guide-for-institutional-investors-2025.pdf) | 先呈現規則與文件條件，不承諾每個帳戶自動相同。愛爾蘭註冊也不是避開台灣海外所得規則。 |
| CSPX／VUAA 的費用與股份類型 | CSPX 官方頁查核 2026-10-28，頁面資料更新至 2026-10-27：Ireland、physical、accumulating，TER 0.07%；VUAA 官方 factsheet 2026-03-31：Ireland、physical、accumulating，OCF 0.07%。 [CSPX 發行商](https://www.ishares.com/uk/individual/en/products/253743/CSSPX)、[VUAA factsheet](https://fund-docs.vanguard.com/SandP_500_UCITS_ETF_USD_Accumulating_9694_EU_INT_UK_EN.pdf) | 同一股份類型可有不同交易所、報價幣別與代碼。以 ISIN、註冊地、配息政策識別產品；交易幣別不是匯率避險。 |

因此不能只比 expense ratio 就宣布哪個「最好」：股利內外層稅、零碎股資格、海外電匯與交易最低費、交易所價差、持有與傳承需求都可能改變選擇。本輪未做任何假想殖利率的稅差試算；若後續要做，應讓使用者輸入假設，明示為情境而非預測。

### 台灣上市 ETF：先校正標的，再談追蹤誤差

**006205 是富邦上証，不是 S&P 500 ETF。** 富邦官方現頁與下載頁都標示該產品，不能拿它當美股同指數替代品（查核 2026-10-28）。[富邦淨值頁](https://websys.fsit.com.tw/FubonETF/Fund/Nav.aspx?stkId=006205)、[官方文件入口](https://websys.fsit.com.tw/FubonETF/Fund/Download.aspx?stkId=006205)

00646 的官方公開說明書刊印日 **2026-07-29**，本次從發行商下載頁開啟，並用唯讀方式解析全文：

- 經理費依規模為 **0.50%／0.40%／0.30%**，保管費依規模為 **0.11%／0.10%／0.08%／0.06%**；這是分別適用的契約費率，不等於把最高費率直接相加就是當前總費用。
- 同份公開說明書「最近五年度費用率」表列 **2024 年 0.36%、2025 年 0.36%**；其定義包括交易直接成本與會計帳列費用，相較費率加總更接近該年度基金實際負擔，但不是未來保證。
- 公開說明書說明基金可能用股票、ETF 與期貨達成曝險；匯率、股利、基金費用、交易、時差均可能造成偏離，不能把所有差距當經理人失誤。

以上數字共同來源：[元大公開說明書，2026-07-29，費用表及最近年度費用率](https://www.yuantafunds.com/fund/download/1129%E6%A8%99%E6%99%AE500%E5%82%98%E5%9E%8B-%E5%85%AC%E9%96%8B%E8%AA%AA%E6%98%8E%E6%9B%B8.pdf)；[發行商目前基本資訊，查核 2026-10-28](https://www.yuantaetfs.com/product/detail/00646/Basic_information)。網路搜尋曾出現較舊或不同用途的費率，未拿來替代本次原始文件。

**官方現成追蹤差距，不是本研究計算：** 元大歐美時區 ETF 表在 **2026-10-27** 的 00646 列，年初至今基金漲跌 **17.00%**、台幣計價參考指數 **16.64%**，公布累計追蹤差距 **+0.36%**。只引用它已經發布的表，不自行重算。表註說明累計起點為前一年度最後營業日，參考指數使用指定台灣時間外匯報價換算。[官方追蹤差距頁](https://www.yuantaetfs.com/tradeInfo/trackingDifference/European)

這個正數不代表「沒有費用」或可持續 alpha，也不是報酬差異標準差定義的 **tracking error**。本次沒有找到／核實相同總報酬基準、相同匯率時點的官方統計 tracking error 數字，故不補算，也不拿它與美元基金的 NAV 績效排名。台幣掛牌便利不代表免除底層美元曝險；盤中市場價格相對 NAV 的折溢價，亦與上述淨值追蹤差距不同。

### 複委託與海外券商：要看實際金額及通路

| 官方價目與查核日 | 已讀到的例子 | 不可外推的地方 |
| --- | --- | --- |
| 國泰證券，2026-10-28 | 美股定期定額買進每筆 **US$0.1**；定期投資 ETF 賣出每筆 **US$3**。一般網路股票交易另有 **0.08%** 優惠，頁面註至 **2026-12-31**；應按產品與通路核對，不能混用。 [官方價目](https://www.cathaysec.com.tw/cathaysec/Products/TradeFee/USS.aspx) | 優惠有期限，另有換匯價差與可能的代收費。不要把一般大額複委託舊低消套到現在的小額定投。 |
| 富邦證券，2026-10-28 | 美股定期定額 **2025-11-01–2026-12-31** 優惠買進 **0.1%**、無最低手續費；原牌告另列。 [官方產品頁](https://www.fbs.com.tw/OverseasStocks/US_StocksRegularQuota) | 這是特定活動，不是所有海外股票或未來永久費率。 |
| IBKR Pro，2026-10-28 | 美股 tiered 的一般整股訂單最低 **US$0.35**，fixed 最低 **US$1**，另依方案與交易有外部費用；零碎股費用有自己的註腳。 [官方佣金](https://www.interactivebrokers.com/en/pricing/commissions-stocks.php) | 不把 IBKR Lite 的免佣金當台灣使用者必然可用，也不把美股費率套到倫敦 UCITS。 |
| IBKR 換匯，2026-10-28 | 官方 spot 手動換匯最低 **US$2**；auto currency conversion 通常在匯率加減 **0.03%**、不另收該次換匯佣金。 [官方說明](https://investors.interactivebrokers.com/en/index.php?f=49654) | 手動換匯與自動換匯不能同時計入；也尚未包含銀行匯出、收款行與中轉行費用。 |

沒有查到某位使用者的銀行與券商契約，就不能可靠計算其總成本或宣布哪家最省。成本工具先讓使用者填入自己實際的最低費、比例費、匯款費、換匯價差與買賣通路；官方例子只作有日期的參考，不做推薦排行。合併匯款省固定費與暫留現金的取捨，也不能改包裝成匯率擇時能力。

### 台灣海外所得與最低稅負

財政部稅務入口網更新 **2026-04-15** 的說明：申報戶全年海外所得**未達新台幣 100 萬元**免計入基本所得額；達門檻時是**全數計入**，不是只算超過部分。基本所得額超過 **750 萬元**，先扣該金額、餘額按 **20%** 算基本稅額，再與一般所得稅額比較，另依規定處理海外已納稅額扣抵，並非海外所得一律另課 **20%**。以上是家庭申報戶、所得與年度概念，不是海外資產市值門檻。[財政部原文，尤其第十至十三題](https://www.etax.nat.gov.tw/etwmain/tax-info/understanding/tax-saving-manual/national/individual-income-tax/6xKrvGR)

同頁亦明示海外財產交易的成本費用、實現年度及損失扣除規則；匯回多少錢不能直接取代所得計算。這使「達停利門檻就全賣再買」可能增加報稅與成本問題；實際應納額仍需完整家庭資料。**UCITS 累積型不是海外獲利免稅工具**：賣出實現的所得仍須按台灣規則判定；基金內層股利稅不可未經確認就當成本人外國稅額扣抵。[同一官方說明](https://www.etax.nat.gov.tw/etwmain/tax-info/understanding/tax-saving-manual/national/individual-income-tax/6xKrvGR)

台灣上市基金的分配，應依當年分配性質與憑單辨認；不能因台幣交易就一律填「國內股利」，也不能把所有現金分配全當海外所得。此處未核實個別使用者年度憑單，成本／稅務工具必須保留人工輸入與來源紀錄。

### 換匯時機有沒有證據？

Rossi，*Exchange Rate Predictability*（作者稿 **2013-02-14**；期刊 **2013-12**）整理樣本外證據後的答案是依 predictor、期限、樣本、模型與評估方法而異；無漂移 random walk 是強基準，並不是「任何外匯都永遠不可預測」。**`academic_oos`；結果：有條件為正、跨設定常為零，無普遍穩定優勢**。這是多匯率與不同期限的研究綜述，不是 USD/TWD ETF 定投策略，也不是橫斷面選股；原文 PDF 已以唯讀方式取得。[作者大學原文](https://repositori.upf.edu/bitstream/handle/10230/20816/1369.pdf)

對「台幣升到某價、跌到某條均線才換美元，能改善台灣投資人的稅費後定投」：**`none`，結果未確立**。本輪沒有取得匹配資金到帳、美元投資同步機會成本、交易價差與保留樣本的直接證據。App 可以記錄實際成交匯率、價差、到帳日及未投資現金，不該輸出換匯買點。

## 對 a／b／c 的可落地含義與 X03 判定

### a：每月扣款，先讓比較有相同的資金條件

讓使用者選「每月新收入」或「現在已有整筆資金」。前者顯示到帳、投入與交易成本；後者才有可行的一次投入／預定分批比較。既有「同金額期初單筆」至少補上「假設整筆資金期初已備妥」；不能顯示成使用者應追補的報酬差距。參照位置是 `web/pages/etfs.tsx:174` 與 `web/src/lib/analytics.ts:177`。

產品資料先加註冊地、ISIN、累積／配息、費用日期、交易幣別與稅率適用身分。**不得直接用現有不含配息曲線排 CSPX／VUAA 與美國配息型 ETF**。這是不同配息處理造成的機械差異，不是擇時能力。

成本試算要區分兩條路：從基金淨值／已公布總報酬出發時，基金內費用及內層稅已反映在淨值，不重扣；從假設的稅前指數報酬推導時，才逐層列出內部成本。美國 ETF 另有投資人收到分配的預扣；累積型不能再當成沒有分配就零稅。這些是會計與產品規則情境，沒有必要為此跑任何市場回測。

### b：有限預算可以有紀律，但不要暗藏無限加碼

保留使用者自己定的額外預算與每批金額，另外列預算來源、已投入／未投入、保留現金放哪、何時重新檢討尚未投入的安排。**不由 P(dd5)、VIX、均線或 CAPE 自動決定下一批。** 若使用者自行決定與行情無關的日期表，App 可以提醒與記帳，但不能標「最佳進場」。

不能用 VA 要求補足任意目標市值；有限預算耗盡後，沒有更多資金就是事實，而不是觸發借款或挪動緊急預備金的理由。若比較分批政策，總帳戶必須包含所有現金與外部資金流，不只比較股票部位的 IRR。

### c：把檢討做完整，才談提醒

先統一網頁與 iOS 為中性的「漲跌檢討門檻」，保留使用者自行選值，明寫不是自動賣出或停扣規則。要做真正觸發，先決定幣別、基準、持倉來源與現金流算法；目前資料不足不能假裝 App 已監看其真實投資損益。觀察名單個股不套相同出場規則，持股與研究清單也不混用。

可優先做以目標、收入、流動性、成本、傳承及稅務為內容的檢討表，並保存「為何維持／修改規劃」。這種理由紀錄有可審核性，但本輪沒有證據可聲稱它一定改善報酬。

### 有沒有足以支持修改 X03 的證據？

**沒有，建議維持。** 理由不是所有 timing 都已被證明不可能，而是：

- 已有 lump sum 文獻回答延後既有現金的取捨，不是展望機率如何轉成每月扣款。
- buy-the-dip 的負結果有含現金利息版本，正面 CAPE／VA 主張則受事後選擇、財富衡量或資金需求限制。
- 外部趨勢研究確有正面結果，但其多資產、近似規則、成本與資金流都不匹配本 App，無法驗證「按我們的預測機率調扣款」。
- 模型能描述風險，並不自動給出最適交易量；還需要使用者目標、資金、成本、偏好，以及事前固定且另經驗證的政策。本輪沒有這組直接證據，也不能因研究而重開已永久否決的 meta-labeling。

若只是擔心 X03 被誤讀為「任何情況都不准停扣」，可以另加說明而不改市場訊號禁令：「收入、必要支出、資金用途或可承受風險改變時，可重新檢討原規劃；本頁市場機率不替你決定加碼、停扣或出場。」這是產品範圍澄清，不是新投資策略，也不是本報告要求修改現有固定句。

### 建議事前登記的計算——僅設計，不執行

優先順序是先把成本、資料口徑與規劃欄位做對；本輪不建議為加碼訊號新增試驗名額。若整合者仍認為「歷史類似回撤後的報酬分布」值得研究，可另行審核以下描述性計算，**不是第二輪 dd5 名額 A 的附帶工作**。

本段所有參數是 **2026-10-28 的設計提案**，不是文獻效果量：只設一個事件「S&P 500 美元價格指數收盤，首次低於過去已知歷史最高收盤的 80%」；只看事件後 252 個交易日的美元總報酬與同步台幣總報酬；同一事件窗內不重複起算。先凍結資料來源、可用起始日、暖機、匯率時點、股息與稅的處理，以及完整與不完整後續窗的處置。事件列數不足 30 時，只公開事件清單及資料不足說明，不發布分位數、成功率或「類似今天」卡；這是顯示門檻提案，不是「足夠統計力」的保證。

不能看完結果再改跌幅、持有期、分組或起點；不得在同一份資料另搜尋最佳加碼規則。報告只與預先定義的無條件年度分布作描述比較，不宣稱樣本外 skill，不產生買賣指令；即使看起來非常好，也沒有自動修改 X03 的決策後果。若要主張政策有效，就須另訂同資金條件、現金計息、完整成本、保留期與採用門檻，現階段不提出亦不執行。

**偷看風險**：本輪已接觸 AQR、Maggiulli、CAPE、Faber 的公開結果，也知道長期股票基準率；提案的事件與期限並非在完全無暴露下產生。登記時必須記錄這些外部接觸，不能叫它「純事前全新假說」。這種分布卡容易被讀成買點，故低於成本／稅務工具優先序，並非必做功能。

## 給整合者的摘要

### 關鍵發現（3–8 條，每條附證據等級與來源）

- **保留 X03。** 一次投入文獻支持少延後已可投入的現金，不能轉成依展望調扣款。Vanguard 2023-02：1976–2022 的全球股票比較中，等待現金計息後，一次投入仍有 65% 勝率；等級 `anecdotal`，結果正，非台幣定投 OOS。[原文](https://corporate.vanguard.com/content/dam/corp/research/pdf/cost_averaging_invest_now_or_temporarily_hold_your_cash.pdf)
- **條件加碼缺少直接可靠驗證。** AQR 2025-12-01 的 buy-the-dip 研究含國庫券利息，整體結果偏負，等級 `anecdotal`；Hayley 2014-10-07 指出 VA 的 IRR 優勢不等於較高預期財富，等級 `academic_is`，結果負。兩者都不是我們有限研究預算的直接 OOS。[AQR](https://www.aqr.com/-/media/AQR/Documents/Alternative-Thinking/AQR-Alternative-Thinking---Hold-the-Dip.pdf)、[Hayley](https://openaccess.city.ac.uk/6298/1/VALUE%20AVERAGING%207%20October%202014.pdf)
- **不能說所有趨勢都無效。** Concretum 的 2025-04 稿對 Faber 近似多資產規則做發表後延伸，等級 `independently_tested`，結果正；但用了不同均線口徑、未含完整成本，也不是每月 S&P 500 定投，尚不足以改 X03。[研究原文](https://concretumgroup.com/wp-content/uploads/2026/06/GlobalTacticalAssetAllocation.pdf)
- **固定 ±20% 不是已驗證的出場規則。** 等級 `none`，結果未確立；本地只存預設值與文字提醒，且 iOS 寫成「考慮出場的漲幅」。再平衡機構管的是配置權重偏離，並非持有報酬達標。[本地來源：`web/src/server/views.ts:230`、`web/pages/etfs.tsx:222`、`ios/MarketObservatory/Views/MoreView.swift:254`]；[Vanguard，2025-08-20](https://workplace.vanguard.com/insights-and-research/perspective/portfolio-rebalancing-navigating-volatility-in-vanguard-target-retirement-funds.html)
- **報酬落差不能全部算成錯誤行為。** Morningstar 2026-08-06 報告截至 2025 年底十年落差為每年 1.2 個百分點，等級 `anecdotal`，結果負；原文同時明說例行儲蓄與再平衡也可能造成落差，不能把它當 App 可挽回的保證利益。[原文](https://www.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/blt852a4301adc2f5db/US_Mind_the_Gap_2026.pdf)
- **台灣使用者優先需要產品與稅費資訊。** 一般美國股利預扣 30%、非居民美國資產 US$60,000 的遺產申報門檻，以及愛爾蘭基金通常 15% 的內層股利稅，應分層呈現；等級 `none`，屬法規／結構事實，非預測。資料版本為 IRS 2026、IRS 頁更新 2026-06-28、發行商 2026-06-02。[IRS 股利](https://www.irs.gov/publications/p515)、[IRS 遺產](https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax-for-nonresidents-not-citizens-of-the-united-states)、[發行商結構比較](https://www.ssga.com/hk/en/institutional/insights/considerations-for-non-us-investors-us-etfs-vs-irish-ucits)
- **先校正 ETF 身分與比較口徑。** 006205 是富邦上証；00646 公開說明書 2026-07-29 列 2025 年實際費用率 0.36%。等級 `none`，屬產品事實。累積型與配息型不能用現有不含配息曲線排名，也不能重扣已在 NAV 反映的基金費用。[富邦](https://websys.fsit.com.tw/FubonETF/Fund/Nav.aspx?stkId=006205)、[元大公開說明書](https://www.yuantafunds.com/fund/download/1129%E6%A8%99%E6%99%AE500%E5%82%98%E5%9E%8B-%E5%85%AC%E9%96%8B%E8%AA%AA%E6%98%8E%E6%9B%B8.pdf)

### 對我們 App 的建議

| ID | 建議 | 服務哪個決策（a 每月定投／b 加碼研究預算／c ±20% 檢討／d 觀察名單個股／資料／流水線／呈現） | 證據等級 | 成本（低／中／高） | 需事前登記？ | 與既有規則或排除清單衝突？ |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | 區分每月新收入與期初已有現金；期初單筆對照明示資金已備妥假設。 | a／b／呈現 | anecdotal | 低 | 否，僅釐清既有試算前提 | 無 |
| C-02 | 建立註冊地、ISIN、配息政策、來源及有效日的 ETF 資料卡；擴充 S&P 500 比較時排除 006205。 | a／資料／呈現 | none | 中 | 靜態資料否；新增歷史績效比較須先登記口徑 | 無 |
| C-03 | 做使用者可輸入的交易、匯款、換匯與分層股利稅成本情境；不重扣 NAV 已含費用，不先做稅後歷史排名。 | a／b／資料／呈現 | none | 中 | 非市場歷史情境否；歷史模擬須先登記 | 無 |
| C-04 | 統一網頁與 iOS 為中性「漲跌檢討門檻」；先補幣別、基準及所需資料定義，不做自動交易提醒。 | c／呈現 | none | 低 | 文字與定義否；歷史觸發研究另議 | 無 |
| C-05 | 額外預算增加資金來源、已用／未用與使用者自訂日期紀錄；不由行情或預測決定下一批。 | b／呈現 | none | 中 | 記帳與非行情排程否 | 無；若改成市場門檻觸發即衝突 |
| C-06 | 檢討表聚焦用途、收入、流動性、配置、成本及賣後安排，保留決定理由；不宣稱提高報酬。 | c／呈現 | none | 低 | 否 | 無 |
| C-07 | 顯示家庭海外所得規則與傳承資料檢查入口；遺產門檻做資料檢討，不做立即賣出訊號。 | a／c／資料／呈現 | none | 中 | 否；法規須有版本與適用身分 | 無 |
| C-08 | 歷史類似回撤分布僅列低優先候選；另登記事件、期限、非重疊及顯示門檻，記錄已接觸文獻，本輪不執行。 | b／c／資料／呈現 | none | 高 | 是；不可挪用現有 dd5 試驗名額 | 描述可相容；若變買點或部位訊號即衝突 |
| C-09 | 保留 X03 固定句；需要時另說明收入與用途變更可檢討規劃，不將此包裝成市場擇時。 | a／b／c／呈現 | none | 低 | 否 | 無 |

### 建議不要做的事與理由

- 不接 P(dd5)、VIX、均線、CAPE 到加碼、停扣或賣出指令；缺少匹配台幣資金流與完整成本的直接證據，也抵觸 X03。
- 不把固定檢討門檻做成停利／停損最適解，不抄 robo 的配置偏離百分點當報酬門檻。
- 不用 VA 部位 IRR、未含現金的績效，或投入金額不同的產品示例證明加碼有效。
- 不用 Morningstar／DALBAR 的總落差宣稱 App 可以替每位使用者挽回相同報酬。
- 不用不含配息價格曲線比較配息型與累積型 ETF，不把官方 tracking difference 當 tracking error 或未來 alpha。
- 不對觀察名單個股套用指數進出場結論；本輪沒有提供個股買賣證據。

### 未核實、不確定、需要人判斷的地方

- Vanguard 2012 官方舊網址已轉新聞室，實際讀的是原文副本；Constantinides、Rozeff 與 VIX 加權會議論文僅部分摘要／引用核實，完整方法不能補寫。Morningstar 的舊 DCA 文章已讀，底層完整方法未取得。
- DALBAR 當期完整報告與算法未核實；未引用流傳的最新落差。Faber 外部延伸也不是原十個月規則的精確複驗或台灣定投 OOS。
- 未核實 00646 在統一總報酬與匯率時點下的官方 tracking error，未自行計算；官方現成追蹤差距不能代替它。
- 美國身分、estate-tax domicile、聯名／信託、家庭申報與境外完稅證明須個案確認。UCITS 累積型不等於台灣免稅；實際券商與銀行成本亦需使用者契約。
- 本輪未找到直接適用台灣 USD/TWD 定投的可靠換匯擇時 OOS；這是查核範圍內的缺口，不是宣稱外匯永遠不可預測。
- C-08 只是已知文獻暴露後的描述性研究草案，需整合者先判斷是否值得佔用研究與呈現成本；本輪沒有回測、統計或交易執行。
