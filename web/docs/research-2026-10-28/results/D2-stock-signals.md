# D2：個股訊號的證據、可投資性與大型股適用性

研究／來源查閱日：2026-10-28。用途限於觀察名單背景資訊；沒有對市場歷史資料做任何新回測、排名、探索統計或報酬計算，也沒有呼叫正式站管理端點。本文的數字來自文獻；公式中的窗口是訊號定義，文末的檢驗門檻則明標為提案。

**結論：優先考慮 EPS 修正背景、gross profitability，以及不帶買賣標籤的相對動能。** 這是資訊價值與實作成本的產品判斷，證據等級為 `none`，不是宣稱這些值能提高使用者投資報酬。經典異常投組的報酬，不能直接變成觀察名單個股的上漲機率；觀察名單本身也不是適合重製橫斷面異常的樣本。

## 範圍與判讀方法

- 本文的「正」指文獻支持預定方向的報酬差；「零」指未偵測到可靠差異，並非證明效果精確為零；「負」指特定交易實作或持有方向的報酬為負。高 short interest 預測低報酬屬於「正」，不是訊號失效。
- `academic_is`：原作者在研究樣本內的結果；機械排序不會自動使它成為 OOS。`academic_oos`：明確的樣本外延伸。`independently_tested`：另一研究團隊重製／檢驗過指定結果；不代表今日仍有效、可免費重製、或已扣成本。
- **VW 不等於大型股限定。** VW 仍可讓小股票進入極端組；capped VW 也不等於 S&P 500 權重。只在全市場 VW 通過的結果，本文不寫成「七巨頭有效」。
- 除特別註明的事件風險量測外，下面報酬研究主要是**股票橫斷面選股**，不是指數擇時。沒有一項用來重開指數方向、扣款調整或部位管理。
- 讀過的本地邊界：`web/docs/research-2026-10-27/proposal.md:405` 的排除清單、`:414` 的指數動能排除、`:416` 的 insider／short interest 排除、`:425` 的部位調整永久否決。本文只討論本題明確允許的個股背景用途。
- 目前名單上限在 `web/src/lib/watchlist.ts:9`；定投警語在 `web/pages/outlook.tsx:124`；`web/src/lib/plan.ts:17` 只是規劃欄位驗證，不是交易規則。以上位置均於研究日親自開檔確認。

## 十類訊號：結論總表

每列的等級針對該列明寫的主張；更細的定義、不同版本及未核實處見後文。期限為文獻的投資／預測期限，不是 App 應提供的操作建議。

| ID | 訊號與帶等級的結論 | 期限、資產、橫斷面？ | 大型股／VW 與成本後 | 免費資料能否計算？必要欄位 |
| --- | --- | --- | --- | --- |
| D2-01 | EPS 修正：`independently_tested`，正；HXZ 的修正動能通過部分持有期限，不能把所有版本視為一個訊號。[HXZ，2020](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf) | 月至年度；美股；是 | 全市場 VW 有支持，大型股限定的現代淨效果未核實；頻繁換手的成本不能忽略 | 現況廣度可做；完整歷史修正動能不能假定免費齊全。需同一 fiscal period 的 EPS consensus、歷次公開時間、修正前值、分析師數、價格；廣度另需 up／down 計數 |
| D2-02 | 傳統 SUE／PEAD：`independently_tested`，零，指現代非微型股檢驗；原始樣本正結果仍可重製。財報公布溢酬另為 `academic_is`，正，不能混為 PEAD。[Martineau，2022；全文未核實、僅見索引摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3111607)、[Savor–Wilson，2016](https://onlinelibrary.wiley.com/doi/10.1111/jofi.12361) | 公布後數週至下一季；溢酬是公布事件窗；美股；是 | 現代大型股的傳統 PEAD 不宜宣稱可交易；事件溢酬可能是承擔公告風險的補償，淨利未核實 | 季報 EPS 可免費建季節性 SUE；分析師版另需公布前的同口徑 consensus。都需 actual EPS、季度、正式公布時間、歷史公布版本、價格 |
| D2-03 | 財報隱含波動：`academic_is`，正，限預測波動幅度；volatility smirk 對後續股票報酬：`academic_is`，正。[Dubinsky 等，2019](https://research.vu.nl/ws/files/108247883/Option_Pricing_of_Earnings_Announcement_Risks.pdf)、[Xing–Zhang–Zhao，2010](https://www.cambridge.org/core/journals/journal-of-financial-and-quantitative-analysis/article/abs/what-does-the-individual-option-volatility-smirk-tell-us-about-future-equity-returns/ECFD16BA9ACBDC8D577D1BD866FBEA72) | 公告日波動／後續月度股票報酬；美股期權及其標的；後者是橫斷面選股 | 活躍期權標的有研究，不能等同超大型股淨 alpha；買／賣 straddle 與持有股票是不同策略 | 即時近似值可能；可重製歷史通常缺免費資料。需整條 option chain 的 bid／ask、IV、strike、expiry、timestamp、volume、OI、標的價與公告時間 |
| D2-04 | 內部人：`academic_is`，正，限 Cohen–Malloy–Pomorski 的 opportunistic 分類；一般買進的原始效果偏小型股。[CMP，2012](https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.2012.01740.x)、[Lakonishok–Lee，2001](https://www.lsvasset.com/pdf/research-papers/Insider-Trades-Informative.pdf) | 次月及後續月份；美股；是 | CMP 有 VW 結果，但缺現代大型股、揭露後跟單且扣成本的獨立確認 | 原始事件可免費；分類需跨年人別歷史。需 insider ID／身分、交易 code、日期、股數、價格、持股變動、衍生品別、filing acceptance time、修正申報與註腳 |
| D2-05 | 13F「best ideas」：`academic_is`，正；一般機構持股率或 Berkshire 跟單的今日大型股淨效果：`none`，未確立。[Best Ideas，2021 作者版摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1364827)、[Buffett’s Alpha，2018](https://www.aqr.com/insights/research/journal-article/buffetts-alpha) | 季資料、後續月份至年度；美股；前者是橫斷面，Berkshire 是選定管理人個案 | 高 conviction 不等於持股比例高；Berkshire 的槓桿與融資不能靠 13F 複製。成本後未確立 | SEC 事件可免費重建，但工程中至高。需 manager／CUSIP／股類、季度、股數、價值、filing time、amendment、保密延後、經理人完整可見投組與市場基準 |
| D2-06 | short interest：`independently_tested`，正，較高放空持倉與較低後續股票報酬相關；DTC 有另外的學術支持。[CZ，2021 作者稿](https://www.federalreserve.gov/econres/feds/files/2021-037pap.pdf)、[Hong 等，2015／2026 修訂紀錄](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2607356) | 月度；美股及跨國股票；是 | 全球研究效果偏低流動性、較高借券費，不能推成大型股淨收益。做空端還有借券費及 squeeze 風險 | 定期公布存量可計算現況；歷史可得性待 E。需 settlement date、公開日期、short shares、outstanding／float 的明確口徑、平均每日成交股數 |
| D2-07 | 12-1 動能：`independently_tested`，正；短期反轉：`independently_tested`，零，限 HXZ 的 NYSE-VW 標準。[HXZ，2020](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf) | 次月及中期；美股；是 | 動能在 VW 較有支持，極端反彈有崩盤風險；短期反轉的成本問題尤其嚴重，不能直接照毛報酬做 | 描述性動能最容易。需含配息／拆併股的 total-return series、共同交易日、基準序列；正式重製另需下市報酬、歷史成分與市值 |
| D2-08 | gross profitability：`independently_tested`，正；傳統 accruals 的現代延續性：`independently_tested`，零；回購事件的早期樣本外延伸：`academic_oos`，正。[HXZ，2020](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf)、[Green 等，2011](https://pubsonline.informs.org/doi/10.1287/mnsc.1110.1320)、[Peyer–Vermaelen，2009](https://www.insead.edu/faculty-research/publications/journal-articles/nature-and-persistence-buyback-anomalies) | 後續年度；回購可跨年；美股；是 | GP 有大型流動股原始證據及 VW 重製；「品質」不能任意換公式。accruals／回購不能沿用舊文宣稱今日有淨 alpha | 財報比率多可免費。需 revenue、COGS、assets、NI、CFO、期末與公開日期；回購另需實付金額、發行／股酬、稀釋股數與公告／執行區分 |
| D2-09 | 低波動：`independently_tested`，零，限 HXZ 的總波動率 VW 報酬異常；BAB 原始槓桿化策略另有正結果，不能互換。[HXZ，2020](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf)、[Frazzini–Pedersen，2014](https://www.aqr.com/insights/research/journal-article/betting-against-beta) | 月度調整、長期持有；股票；是 | 較低歷史波動是風險描述；是否有超額報酬取決於權重、beta 調整、槓桿及因子基準。本文未核實其大型股成本後優勢 | 風險背景可免費。需日 total returns、交易日、窗口；beta 另需同期市場 total returns、無風險利率與估計定義 |
| D2-10 | 字典新聞情緒：`academic_is`，正，限舊樣本次日價格反應；相同研究指出合理成本可吃掉交易利潤，今日免費新聞的淨效果為 `none`。[Tetlock–Saar-Tsechansky–Macskassy，2008；所讀作者稿為 2006-08](https://www.columbia.edu/~pt2238/papers/TSM_More_Than_Words_08_06.pdf) | 次一交易日；S&P 500 個股；是。Tetlock 2007 的指數欄目研究另屬市場時間序列 | 大型股確實是原始研究對象，但使用及時全文新聞；不能套用到延後取得的標題／譯文 | 可算文字比例，不等於可算可交易訊號。需原始全文、首次發布與修訂時間、ticker mapping、去重、字典版本、原語言與來源 |

## 四份大規模研究究竟驗證了什麼

### pooled 衰退與重製率：不能套用到每一個訊號

| 來源與日期 | 單一等級、結果 | 可核實的數字／方法 | 對本題的限制 |
| --- | --- | --- | --- |
| [McLean–Pontiff，JF 2016；線上首刊 2015-10-13](https://onlinelibrary.wiley.com/doi/full/10.1111/jofi.12365) | `academic_oos`，正但衰退 | 研究 97 個已發表的橫斷面預測變數；原文樣本截止後報酬平均減少 26%，發表後減少 58% | 這是跨訊號平均，不是 EPS、insider、動能各自的折減係數；不能把任何原始 alpha 乘固定保留率。本文沒有核實十類訊號各自的發表後百分比 |
| [Chen–Zimmermann，2021-03 作者稿；正式刊物 2022](https://www.federalreserve.gov/econres/feds/files/2021-037pap.pdf) | `independently_tested`，正，指重製原始結果 | 對原文明確顯著的 161 個 characteristics，98% 的重製 long-short t-stat 高於 1.96；主要比較原始研究樣本及其實作 | 不是「發表後仍有 98% 可交易」；也不是一律 VW 或扣成本。下表引用 Appendix A 的原始樣本重製，不能拿當現代 OOS |
| [Hou–Xue–Zhang，RFS 2020；樣本主要 1967–2016](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf) | `independently_tested`，零，指大量聲稱的普遍性 | 452 個定義中，NYSE breakpoints＋VW 下 65% 未過單項顯著門檻；更嚴的多重檢驗失敗率為 82% | 相同研究的部分動能／修正／獲利能力仍為正。不能用總失敗率否定它們，也不能將通過單項檢驗當作多重檢驗通過 |
| [Jensen–Kelly–Pedersen，JF 2023](https://onlinelibrary.wiley.com/doi/full/10.1111/jofi.13249) | `independently_tested`，正，限該套因子與建構方式 | 以原文有正面證據的 119 項為重製分母，美國 Bayesian replication rate 為 82.4%；mega、large 子樣本分別 77.3%、79.8%。採 terciles、capped VW、月持有；另做發表後檢驗 | 其 NYSE 第 80 百分位市值 cap 會降低最大股票權重；不是 S&P 500 VW。主文明說排除 IBES 因子。不能拿整體結果替分析師修正背書，也未證明每個因子的淨效果 |

上述數字分別取自所連結版本，查閱日均為 2026-10-28。HXZ PDF 已從作者網站讀取全文與表格；CZ 的 FEDS 版本可由網頁工具讀到全文，但本機直接請求曾回 403。**這不是對重製危機的二選一投票：研究的問題、分母、原始研究是否顯著、權重與持有期不同。**

### 本題訊號與重製項目的逐項對照

以下 CZ 數字均為上述 **2021-03 稿 Appendix A、各列註明的原始樣本**；HXZ 為上述 **2020 Table 3／4 的 NYSE-VW**，不是本文計算。JKP 的涵蓋核對使用[官方 Documentation](https://jkpfactors-data.s3.amazonaws.com/documents/Documentation.pdf)；該現行文件是論文因子的超集，不能把現行所有欄位都說成 2023 主文已驗過。沒有對應不等於無效。

| 訊號 | CZ：原始樣本重製 | HXZ：VW 結果 | JKP 2023／官方定義的適用界線 |
| --- | --- | --- | --- |
| EPS 修正 | `AnalystRevision`，1975–1980，t=5.12；但對應 Hawkins 等 1984，**不是 CJL 1996 的同一公式** | `Re1`／`Re6` 正；`Re12` 不顯著 | 明確排除 IBES 因子，不能援引整體成功率 |
| SUE／PEAD | `EarningsSurprise`，1974–1981，t=4.94；是舊樣本正結果 | `Sue1` 正，較長持有不顯著；`Abr` 為公告報酬訊號 | 有 `niq_su`；不代表現代大型股的分析師 surprise 或公布溢酬通過 |
| 期權 smirk／財報波動 | 現行 browser 有 `skew1` 近價平版本；本次未核實其重製績效，也不等同完整 OTM smirk | 本次未核實對應列 | 官方定義未找到對應；不能用股票低風險因子替代 |
| opportunistic insiders | 未找到同一分類的對應列 | 未核實對應列 | 官方定義未找到同一分類 |
| 13F best ideas／Berkshire | 未找到直接對應列 | 未核實對應列 | 官方定義未找到直接對應列 |
| short interest／DTC | `ShortInterest`，1976–1993，t=5.30；**不是 DTC** | 本次未核實對應列 | 官方定義未找到 short interest；不可用流動性因子替代 |
| 動能／短期反轉 | `Mom12m`，1964–1989，t=4.58；舊樣本 `STreversal` 亦正 | 11 個月價格動能正；短期反轉未通過 | 有 `ret_12_1`、短期報酬特徵；未逐項核實其發表後大型股淨結果 |
| GP／accruals／回購 | `GP`，1963–2010，t=2.38；有 `Accruals`；`ShareRepurchase` 是財報回購支出指標 | GP、operating accruals 在單項門檻正；net issues 正，並非回購公告重製 | 有 `gp_at`、accruals、`chcsho_12m`；不能合稱品質或回購公告 |
| 低波動 | `BetaFP` 簡單分組重製，1929–2012，t=0.08；原文 BAB 權重不同 | 總波動率與部分 residual volatility 未通過 | 有 beta／volatility 因子；未逐項核實大型股淨結果 |
| 字典新聞情緒 | 未找到直接對應列 | 未核實對應列 | 官方定義未找到直接對應列 |

CZ 現行定義另由 [Signal Browser，查閱 2026-10-28](https://openassetpricing.com/SignalDoc-Browser.html) 親讀。**不能把分類欄 `Predictor` 當成發表後績效證明。** McLean–Pontiff 的 pooled 衰退適用於整張表的閱讀戒律；本次未取得可逐項套用的發表後折減估計，故不捏造各列數字。

## 訊號定義、後續證據與實作界線

### D2-01：EPS 預估修正動能

**定義。** CJL 的 earnings momentum 包括對同一財政年度 consensus EPS 的歷次修正，不等於 EPS 成長率，也不等於「近來上修次數」。其修正動能使用過往修正的移動平均；必須固定 forecast period，才能避免 FY 切換造成假跳動。EPS 為負或接近零時，百分比修正也不是穩定尺度。[Chan–Jegadeesh–Lakonishok，1996，作者存檔](https://www.lsvasset.com/pdf/research-papers/Momentum-Strategies-Papers.pdf)；本文可見 PDF，但網頁抽取沒有本文文字，精確公式以 HXZ Appendix A.1.3 的可讀定義核對。

**後續結果。** `independently_tested`，正：HXZ 的 Re 仍有 VW 支持，較長持有則較弱，見對照表。`academic_oos`，正：CJL 的 1999 後續文章摘要報告，研究延伸至 1994–1998，並在大型股中保留較小的 spread。**未核實全文與淨成本**：本次真正看到的是出版者搜尋索引摘要，直接開頁回 403；不引用其報酬幅度。[The Profitability of Momentum Strategies，1999](https://www.tandfonline.com/doi/abs/10.2469/faj.v55.n6.2315)。沒有找到足以確認「免費來源、今日 S&P 500、公開後、扣成本」這四項同時成立的證據。

**我們能做的版本。** `web/src/lib/sources/nasdaq.ts:181` 定義最近年度的共識與近四週 up／down；`:205` 選第一列，`:214` 有 `fiscalEnd`；`web/src/lib/consensus.ts:62` 把個股計數轉成廣度後再按權重彙總。這是**修正廣度背景值**，不是論文的歷次 EPS 修正幅度。顯示個股值時帶 fiscalEnd、上修／下修計數、來源更新日與分析師涵蓋；沒有 revisions 應標「沒有可計算的修正比例」，不能把它寫成「所有分析師都維持不變」。是否能累積到完整 PIT 共識由任務 E 判斷。

### D2-02：PEAD／SUE 與財報公布溢酬

**定義。** 季節性 SUE 以本季 EPS 減去年同季 EPS，扣除預先定義的預期成長，再按歷史誤差標準差縮放；分析師版則用「actual EPS−公布前 consensus」，二者不可混用。PEAD 問的是公布後延遲反應；`AnnouncementReturn`／HXZ `Abr` 則先用公告窗價格反應作排序，不能把它當會計 earnings surprise。[CZ，2021-03，定義與原始重製](https://www.federalreserve.gov/econres/feds/files/2021-037pap.pdf)。經典原文為 [Bernard–Thomas，1989，Post-Earnings-Announcement Drift: Delayed Price Response or Risk Premium?](https://www.jstor.org/stable/2491062)；**未核實原始全文與成本表，本次只核對期刊目錄及後續研究對其定義的引用**，不重抄經典報酬數字。

**現代大型股的負面結果。** `independently_tested`，零：Martineau 的摘要稱大型股自 2006 年已無 PEAD。**未核實全文**：nowpublishers 入口轉至 Emerald 的安全驗證，SSRN 直接頁回 403；實際看到的是 SSRN 搜尋索引的一手摘要與 [UCLA，2026-01-21 的二手說明](https://anderson-review.ucla.edu/is-post-earnings-announcement-drift-a-thing-again/)。[Martineau，2022](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3111607)。另有 `independently_tested`、零的近期批評稿，認為非微型股結果依舊為零，且正面結果受定義左右；**只核實作者摘要，全文未核實**。[Subrahmanyam，2025-12-16 稿、2026 修訂](https://doi.org/10.2139/ssrn.5930255)。

**不能把「PEAD 已死」寫成所有盈餘資訊都沒用。** `academic_is`，正：Gérard–Jehl 研究累積過往公告窗報酬，而非最近一次 SUE，摘要及搜尋可見本文稱在大股票也有後續動能。**未核實全文表格與成本，直接頁回 403**；這是不同構造，不能因此宣布傳統 PEAD 復活。[The Many Facets of Stock Momentum，線上發表 2025-10-15，FAJ 2026](https://doi.org/10.1080/0015198X.2025.2562790)。

**公布溢酬是另一題。** `academic_is`，正：Savor–Wilson 報告公司在預定公告時承擔較高系統性風險並有較高報酬；這是知道公告日就能定義的事件風險，不需要知道 EPS 是否 beat，不能把年化事件投組報酬當個股公告日預期漲幅。[2016 正式版摘要](https://onlinelibrary.wiley.com/doi/10.1111/jofi.12361)；[Frazzini–Lamont，2007](https://www.nber.org/papers/w13090) 則討論 attention／volume。兩者的現代大型股淨交易策略未在本次核實。對 App，保留日曆、列 actual／事前 consensus／口徑差異，比放 PEAD 分數有用。

### D2-03：財報隱含波動與 volatility smirk

**分成兩項。** 財報 event variance 從跨到與未跨到公告日的期權期限結構，拆出日常 variance 與公告跳躍 variance；單純 ATM straddle 價格除以股價是含其他日子風險及風險溢酬的市場價格近似，不能直接命名為單一標準差或實際世界信賴區間。smirk 則是 OTM put IV 相對 ATM call IV 的差，問的是負面資訊是否先進入期權。

`academic_is`，正，限公告波動量測：Dubinsky–Johannes–Kaeck–Seeger 的美股活躍期權樣本為 2000–2015；全樣本公告日 Q-vol 平均 8.22%，P-vol 為 7.42%。**同一張表的 2011–2015 子期平均 Q-vol 6.78%，P-vol 7.35%**；標準化檢驗仍支持風險溢酬，因此不能拿 pooled 平均說每一子期、每一檔都被高估。這些都是作者 Table 9，不是本文計算。[RFS 2019 正式 PDF](https://research.vu.nl/ws/files/108247883/Option_Pricing_of_Earnings_Announcement_Risks.pdf)。對股票方向或「賣 straddle 必賺」的主張為 `none`；日後實際波動不是下單當時可用的訊號。

`academic_is`，正，限橫斷面股票報酬：Xing–Zhang–Zhao 的出版者摘要稱 smirk 最陡的一組相對最平的一組，每年風險調整後落後 10.9%，效果至少延續六個月。**已核實一手摘要；全文與大型股分組、成本表未核實**。[2010-03-31 線上版／2010-06 期刊](https://www.cambridge.org/core/journals/journal-of-financial-and-quantitative-analysis/article/abs/what-does-the-individual-option-volatility-smirk-tell-us-about-future-equity-returns/ECFD16BA9ACBDC8D577D1BD866FBEA72)。

OSAP 的 `skew1` 是近價平 put／call 的實作，附 option liquidity screens；不是任何網站上一個「skew」欄位都能替代原文。股票價格算出的 return skewness 更完全是另一件事。[OSAP 定義，查閱 2026-10-28](https://openassetpricing.com/SignalDoc-Browser.html)。若沒有歷史同時點 bid／ask、到期日、除息／利率假設與公告時間，免費現況 chain 只夠做附註清楚的事件價格背景。本產品目前不值得優先投入。

### D2-04：內部人買進與 opportunistic insiders

**定義。** 用 open-market purchase，而非獲授股票、option exercise、繳稅扣股或所有增加持股。CMP 的 routine 分類看個別內部人過往是否在相同日曆月份規律交易；用未來交易反過來分類過去，會產生 look-ahead。只有剩餘的 opportunistic 才對應其主張，不等於「這筆交易違法」或「公司所有非固定月份買進」。

`academic_is`，正，但大小公司差異重要：Lakonishok–Lee 研究 NYSE／AMEX／Nasdaq 的 1975–1995，摘要明說可預測性由較小公司驅動，資訊來自買進，賣出沒有相同訊息。[2001 正式 PDF](https://www.lsvasset.com/pdf/research-papers/Insider-Trades-Informative.pdf)。`academic_is`，正：CMP 正式版摘要報告 opportunistic 策略 VW 每月異常報酬 82 bp，而 routine 約零；不能將它寫成單筆買進或一般 Form 4 都有這個收益。[2012-05-21 正式摘要](https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.2012.01740.x)。

**外部可跟到的時間很重要。** SEC 指引要求 Form 4 通常於交易後兩個營業日內申報；對外訊號必須從實際公開時間開始，不能從交易日開始。[SEC／Investor.gov 指引，2026-10-28 查閱](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-69)。本次沒有核實現代、超大型股、揭露後跟單且扣成本的獨立延伸；也沒有在指定三套重製資料中找到同一 CMP 分類可直接援引的列。可放原始申報連結當公司事件，但不值得先做 opportunistic 標籤或「內部人看多分數」。

### D2-05：13F 機構持股、best ideas 與 Berkshire 跟單

**定義。** 機構持股率是機構持有股數／分母股數；conviction 則是該股在經理人投組的權重相對市場基準的主動偏離。前者高，可能只是指數化持有；經理人最大的名目持倉也可能只是市場最大股票。單一管理人的 13F 可見持股不是其完整資產負債表。

`academic_is`，正：原始 Cohen–Polk–Silli 的 [2008 LSE 稿](https://eprints.lse.ac.uk/24471/1/Best%20ideas%28published%29.pdf) 與目前 [2021-04-21 SSRN 版](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1364827) 作者不同，後者為 Anton–Cohen–Polk；不能混引作者與績效。2021 版一手索引摘要報告 best ideas 年度超越約 2.8–4.5%，視基準而定。**未核實新版全文的資訊落後、交易成本與大型股表**，也沒有把這個範圍當成可複製收益。

SEC 規則為季底後最遲 45 天提交，且存在保密揭露與 amendment；季度持股變化只能在申報公開後使用，無法知道交易發生在季度哪一天，也不能把季底市值當成本。[SEC Form 13F 官方 FAQ，查閱 2026-10-28](https://www.sec.gov/rules-regulations/staff-guidance/frequently-asked-questions-about-form-13f)。

`academic_is`，正，限已挑選的成功管理人：Buffett’s Alpha 對 Berkshire 的說明包含便宜、安全、品質與廉價槓桿；這不是「公開揭露後複製股票」的驗證。[2018-09-30，作者研究說明](https://www.aqr.com/insights/research/journal-article/buffetts-alpha)。最新的 *The Buffett Effect* 使用 2000–2025 資料、從申報新持倉建立跟單投組，作者摘要宣稱有持續 alpha，等級 `academic_is`、正；**只核實摘要，未核實全文的管理人挑選、超大型股、成本及真正 OOS**，不能升格為獨立驗證。[Smolinski–Saridevi，2026-10-12 preprint](https://arxiv.org/abs/2610.17231)。

結論是資訊可讀、跟單 edge 未確立。對只追大型股的個人產品，重建完整經理人樣本、避免挑贏家、處理保密申報的成本，高於一張「某機構也持有」表的決策價值。

### D2-06：short interest 與 days-to-cover

**定義。** `SI = short shares / shares outstanding`；用 float 作分母必須另標，不能跨來源混排。`DTC = short shares / average daily share volume`；分子是某結算日的未平倉存量，分母是明定窗口的成交股數。short-sale volume 是交易流量，不能直接代入持倉存量公式；DTC 也不保證持倉真的能在相同天數全數回補。

`independently_tested`，正：CZ 的 `ShortInterest` 重製為較高持倉對應較低未來報酬，但該列是 Dechow 等的 short-interest 版本，並非 DTC，見對照表。`academic_is`，正：Hong 等的 DTC 研究指出其衡量擁擠部位退出成本，比單純 short ratio 更有理論意義；**只核實作者摘要，未核實 2026 修訂全文及成本後結果**。[2015 稿、SSRN 顯示 2026-05-03 最後修訂](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2607356)。

`independently_tested`，正：*Can Shorts Predict Returns? A Global Perspective* 找到 DTC／utilization 較穩健，但效果偏低流動性、高 shorting fees、價格效率較低的股票；這對大型股與淨收益都是限制，而非可忽略的腳註。[2022 正式 PDF](https://eng.pbcsf.tsinghua.edu.cn/Can.pdf)。本次僅核實摘要，未核對大型股分組及淨成本表。就 App，若要顯示，應先解決結算日與公開日、分母口徑；不要標「軋空機率」或「聰明錢看空」。優先序低於已存在的公司／財報背景。

### D2-07：12-1 動能、動能崩盤與短期反轉

**定義。** 月底形成訊號時，12-1 動能通常指累積第 t−12 至 t−2 月的 total returns，略過最近一個月；不能用含當月反轉的「過去一年股價漲幅」替代。短期反轉則反向使用最近月／週報酬，是另一個高週轉策略。[Jegadeesh–Titman，1993，原始文獻入口](https://doi.org/10.1111/j.1540-6261.1993.tb04702.x)；本次原文數值以 CZ／HXZ 的獨立重製為準，未核實原始全文的成本。

`independently_tested`，正：HXZ 對 prior 11-month momentum 的 VW 結果仍為正，見對照表；較長持有版本會變弱。`academic_is`，負，限動能投組的崩盤事件：Daniel–Moskowitz 指出跌市後、高波動且市場急彈時，過去輸家反彈可重創 long-winner／short-loser。**這是選股多空策略的風險，不能類推成每月定投要避開反彈，也不採用其動態部位規則。**[2016 正式文獻所對應的 NBER 稿](https://www.nber.org/papers/w20439)。

**成本證據有方向差別。** `academic_is`，正：Frazzini–Israel–Moskowitz 以機構實際成交校準成本，研究認為動能可承受較大交易規模；對短期反轉則為零，指其可規模化實作不具同樣結果。這是作者用自身機構資料估算策略淨績效，不是我們免費資料策略的獨立 live 驗證。[2012-12-05 研究說明；成交資料 1998–2011](https://www.aqr.com/insights/research/working-paper/trading-costs-of-asset-pricing-anomalies)。`independently_tested`，零：HXZ 也把短期反轉列為 NYSE-VW 無法重製的著名例子。[HXZ，2020](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf)。

對 App 可顯示「略過最近月的累積含息表現，及同期基準差」，保持連續數值，不在使用者自選名單內做 winner／loser 排名。這是描述過去；相對 SPY 報酬也不是 beta-adjusted alpha。

### D2-08：獲利能力、應計項目、回購

**獲利能力。** `GP/A = (revenue−COGS)/total assets`。這不是 gross margin，也不等於 ROE、營益率或任意品質綜合分數。`academic_is`，正：Novy-Marx 特別指出在最大、最流動股票仍有資訊。[2013 正式文獻；親讀作者檔為 2012-06 稿](https://mysimon.rochester.edu/novy-marx/research/OSoV.pdf)。`independently_tested`，正：CZ 與 HXZ 均有 GP 支持；但 HXZ 的 current-assets 分母改成 lagged-assets 後結果變弱，operating profitability 也不能任意替換。這提醒我們先固定會計口徑，不能把「品質很穩」當成可換公式的授權。

**應計項目。** Sloan 原始 balance-sheet accruals 把營運資產／負債變動與折舊區分；常見的 `(net income−CFO)/average assets` 是較易從現金流量表建的版本，並非每個原始 balance-sheet 實作都精確相同。`academic_is`，正，限原始樣本：[Sloan，1996，原始作者摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2598)；原始全文未核實。`independently_tested`，零，限較晚期間延續性：Green–Hand–Soliman 指出 hedge return 已衰退到不再可靠為正。[2011-04-11 正式摘要](https://pubsonline.informs.org/doi/10.1287/mnsc.1110.1320)。這與包含早年資料的 HXZ 全期 operating-accruals 正結果不矛盾。不能用 accruals 高直接標會計造假。

**回購。** 公告授權、實際回購支出、以及扣發行／股酬後的 net share reduction 是三個不同量。`academic_is`，正，限原始回購公告樣本：[Ikenberry–Lakonishok–Vermaelen，1995，對應作者 NBER 稿](https://www.nber.org/papers/w4965)。`academic_oos`，正，限後來延伸：Peyer–Vermaelen 不支持「早期回購異常已完全消失」的假設；**只核實作者機構摘要，未核實成本及今日大型股表**。[2009 正式文獻](https://www.insead.edu/faculty-research/publications/journal-articles/nature-and-persistence-buyback-anomalies)。CZ 的 `ShareRepurchase` 只看財報回購支出是否為正，不是原始公告研究；HXZ／JKP 的 net issues 也不是公告授權。

**免費可做但不等於經濟效果已證明。** GP、CFO／NI 與實際稀釋股數可作基本面背景，必須留 fiscal period、申報時間、當時版本與計算口徑；金融業不能直接沿用非金融業 GP 排名。對三者，本次未核實以免費資料重建、現代大型股、完整交易成本後的共同優勢。

### D2-09：低波動與 low beta

**定義要拆開。** total volatility 是股票日報酬標準差；idiosyncratic volatility 是從指定因子模型取 residual 的標準差；beta 是對市場的曝險。低波動不保證低 beta，更不保證下一次跌市不會下跌。選哪個歷史窗口，也是訊號定義的一部分。

`academic_is`，正：BAB 原始研究是買入低 beta、賣出高 beta，並把兩邊按 beta 縮放的槓桿／融資策略；不是簡單買波動最低的股票。[Frazzini–Pedersen，2014-01-01 研究說明](https://www.aqr.com/insights/research/journal-article/betting-against-beta)。`independently_tested`，零：CZ 對 BetaFP 的簡單分組不重現原文 BAB，作者 notes 明說權重、beta normalization 不同；不能用該零結果證明原文錯。另一方面，HXZ 的總波動率 VW 異常未通過，確實限制了「低波動股票普遍有更高收益」的說法。

另有對 BAB microcap／交易成本的批評 *Betting against Betting against Beta*；**未核實全文，本次只有出版者搜尋索引摘要，直接開頁回 403**，不引用其成本數字，也不把它當已查核的定論。[Novy-Marx–Velikov，2022](https://www.sciencedirect.com/science/article/pii/S0304405X21002051)。

對 App 的低成本用途是標明窗口的歷史風險，證據等級 `none`，只描述已發生的波動，不宣稱報酬預測力。它可以排在未來風險說明功能，沒有必要與品質、動能一起變成分數，更不能衍生成定投扣款調整。

### D2-10：傳統字典新聞情緒

**定義。** 用原文新聞的 negative-word share，或明定正／負字典計數，不能把文章標題、中文譯文與全文情緒當同一量；必須按首次公開時間去重與分配交易日。

`academic_is`，正：Tetlock–Saar-Tsechansky–Macskassy 用 S&P 500 個股新聞發現負面用字對基本面與次日反應有資訊；親讀的作者稿樣本為 1980–2004，並明說及時 DJ News Service 有潛在交易利潤，延後刊出的 WSJ 不同，合理成本可以消除高頻策略利潤。[2008 正式文獻，作者稿日期 2006-08](https://www.columbia.edu/~pt2238/papers/TSM_More_Than_Words_08_06.pdf)。這是少數原始對象就接近本產品大型股的題目，卻不代表今日免費新聞有淨 edge。

不要把 Tetlock 2007 的「悲觀後價格壓力、接著反轉」與上述個股基本面研究拼成一套固定方向規則；前者是單一市場欄目的市場時間序列。[2007-06-01，作者大學頁](https://business.columbia.edu/faculty/research/giving-content-investor-sentiment-role-media-stock-market)。Loughran–McDonald 也指出通用字典在財務文字誤判用字，改用金融字典改善量測，不等於已驗證投資 alpha。[2011 正式摘要](https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.2010.01625.x)。

我們現有 `web/src/lib/news-ai.ts:132` 的個股整理與 `:143` 的 tone 是編輯性 LLM 輸出，不是上述字典指標；LLM 的預測證據交叉參照任務 H。本次沒有找到同時涵蓋現代免費來源、S&P 500、大型股且扣交易成本的可靠獨立確認，故不建議增加情緒 alpha 儀表。

## 最值得顯示的背景值與升級前的登記

### D2-11：EPS 修正背景，先完成現有資料的語意

顯示來源原有 up／down 計數、固定 fiscalEnd、分析師涵蓋與資料日；可以保留「來源所定義的修正廣度」這個名稱，不能叫「上漲機率」或「修正動能策略」。現有 source 與 consensus 計算位置見 D2-01。若任務 E 無法確認來源計數的定義與可公開使用條件，便不把它列為上線候選。

### D2-12：gross profitability，作公司基本面量尺

顯示原始比率、財報期與發布日，允許使用者檢查長期論點；同頁說明它不是估值，也不是未來報酬。先不做跨產業百分位或品質總分。資料缺 COGS、財報口徑不能對齊或屬金融業時，明標無法比較，不改用另一公式冒充同一指標。

### D2-13：相對動能，作過去表現背景

顯示明確起訖日、跳過最近月的含息累積表現、同期 SPY 含息基準與兩者差；幣別先明寫 USD。不能叫 alpha、勝率或「加碼機會」，也不在自選名單內給高低名次。需要與現有走勢畫面避免重複；資料源若只有未調整收盤，就不能冒稱已完整重製經典動能。上述窗口依 D2-07 定義，本文沒有計算任何股票數值。

上述三項的**產品效益主張皆為 `none`**；選它們是因為有可解釋原始量、相對符合大型股研究、容易對照公司論點，並非已證明使用者決策會變好。對每月定投不輸出任何操作；對加碼研究預算與漲跌檢討只提供查資料入口，不產生金額或退出條件。

### D2-14：建議事前登記的計算——僅在整合者另決定研究預測力時

**本輪不開試驗、不執行；不把三個背景值合成模型。** 若日後仍要宣稱某值有可投資預測力，建議先只登記下列單一動能候選；這不是重開指數動能，也不占用或修改既有 dd5 試驗。以下門檻為本報告於 2026-10-28 提出的研究政策，證據等級 `none`，不是引用文獻的發現。

| 登記項目 | 草案；執行前須獨立審定並合併 |
| --- | --- |
| 問題／母體 | 個股橫斷面；使用當時 S&P 500 成分及所有進出成分股，不能用今天成分或個人自選名單回填歷史；同公司多股類固定代表規則 |
| 訊號定義 | 每月最後交易日形成；累積第 t−12 至 t−2 月含息 total returns，略過最近月，不試別的窗口；按訊號分成固定五分位，使用形成時市值加權 |
| 資料源 | 交由 E 確認的唯一固定價格／股息／拆股來源、歷史成分及下市來源；在登記時填入實際 provider、版本、可用起點與可用時間。**本報告未選定可用資料源，這一格未完成前不得執行** |
| 標籤 | 形成後下一個月的 USD 含息報酬；主終點是高減低五分位淨報酬，非個股 P(up)、非 SPX 方向；SPY 同期表現只作背景，不叫 beta-adjusted alpha |
| PIT／OOS | 形成當時只看已公開資料；訓練、保留期與解封日先鎖定。既已被文獻使用的歷史不稱全新資料；從登記後累積的前瞻紀錄另列。資料確認前不查看候選結果 |
| 成本 | 先固定每側完整往返 20 bp 的交易成本假設，另扣歷史實際借券費；借券資料缺漏時只評毛報酬，不得宣稱可投資的淨 alpha。20 bp 為政策假設，並非目前市場成本估計 |
| 門檻 | 主要 OOS 淨平均報酬差的 95% 區間下界須大於零；月度 stationary bootstrap 平均區塊六個月、重抽 2,000 次；只檢驗此一候選與一個主終點。若將來增加候選，先另登記 family 與多重檢驗，不能事後從三項挑最佳 |
| 失敗與產品後果 | 任一資料／成本前提不完整、或門檻未過，就不宣稱預測力、不換窗口補考。即使通過，也須另決定是否值得提供研究統計；不自動升成個股買賣、定投、加碼預算或部位規則 |

這份草案目前**不具可執行條件**；資料源、樣本切分、借券可得性仍待 E 與整合者決定。免費資料若無法支撐此標準，維持描述性背景即足夠。

## 給整合者的摘要

### 關鍵發現（3–8 條，每條附證據等級與來源）

- `academic_oos`，正但衰退：McLean–Pontiff（2016）發現已發表橫斷面訊號的報酬平均在原文樣本外減少 26%、發表後減少 58%；這不是每個訊號各自的折減率。[一手摘要](https://onlinelibrary.wiley.com/doi/full/10.1111/jofi.12365)
- `independently_tested`，正：EPS 修正、價格動能與 gross profitability 有 VW 重製支持；但 OSAP 的 `AnalystRevision`、`ShareRepurchase` 不是本題經典研究的完全相同實作，不能只按名稱借用績效。[HXZ，2020](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf)、[OSAP 定義，2026-10-28 查閱](https://openassetpricing.com/SignalDoc-Browser.html)
- `independently_tested`，零：現代大型股的傳統 PEAD 有消失證據，不能沿用舊 SUE 投組績效；另有 `academic_is`、正的研究使用累積公告報酬，構造不同。**原文表格未核實，實際只讀到一手索引摘要與 UCLA 說明。**[Martineau，2022](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3111607)、[不同構造的 Gérard–Jehl，2025 線上版](https://doi.org/10.1080/0015198X.2025.2562790)
- `independently_tested`，正，限整體因子：JKP（2023）的大型股結果反對「異常全靠微型股」的概括；但其 capped VW、月持有、因子母體與 HXZ 不同，且明確排除 IBES 因子，不能替 EPS 修正或任意訊號背書。[一手全文](https://onlinelibrary.wiley.com/doi/full/10.1111/jofi.13249)
- `academic_is`，正，限波動幅度：財報期權含事件風險資訊，不能轉成股票方向或賣期權保證收益；隱含與實際波動的價差也不是固定常數。[Dubinsky 等，2019，樣本 2000–2015](https://research.vu.nl/ws/files/108247883/Option_Pricing_of_Earnings_Announcement_Risks.pdf)
- `academic_is`，正，限原始樣本：字典新聞研究直接涵蓋 S&P 500 個股，但效果短、依賴及時全文，原文已指出合理成本可消除交易利潤；不能替免費延後新聞或現有 LLM tone 建立 alpha 主張。[Tetlock 等，2008；親讀作者稿 2006-08](https://www.columbia.edu/~pt2238/papers/TSM_More_Than_Words_08_06.pdf)

### 對我們 App 的建議

表中 `none` 指產品效益或新檢驗尚未證明；文獻的訊號證據見上文，兩者不混用。

| ID | 建議 | 服務哪個決策（a 每月定投／b 加碼研究預算／c ±20% 檢討／d 觀察名單個股／資料／流水線／呈現） | 證據等級 | 成本（低／中／高） | 需事前登記？ | 與既有規則或排除清單衝突？ |
| --- | --- | --- | --- | --- | --- | --- |
| D2-11 | 優先顯示帶 fiscalEnd、up／down、涵蓋與更新日的 EPS 修正背景；不冒稱 CJL 動能 | d／資料／呈現；b、c 僅供查研究資料 | none | 低 | 純顯示否；宣稱預測力須另登記 | 不衝突；不進指數機率、不改扣款 |
| D2-12 | 顯示明確口徑的 gross profitability 與財報日期；不做品質總分 | d／c／資料／呈現 | none | 中 | 純顯示否；排名或計分須先登記 | 不衝突；不得變買賣建議 |
| D2-13 | 顯示略過最近月的含息表現及同期基準差，清楚標示過去表現 | d／c／呈現 | none | 低 | 純描述否；預測檢驗須先登記 | 只限個股描述；不得重開已排除的指數動能 |
| D2-14 | 若另決定研究預測力，只先登記單一橫斷面動能候選；草案尚缺資料源與 OOS 切分，不執行 | d／資料 | none | 高 | 是，完整規格合併前不得計算 | 不可進 SPX 模型、不可改定投或部位；新研究範圍需另決定 |
| D2-15 | 所有新增背景留公開時間、資料期、口徑與版本；免費歷史／授權可得性交 E | 資料／流水線 | none | 中 | 只建紀錄否；研究使用前需固定 | 不衝突；不觸及正式站管理端點 |

### 建議不要做的事與理由

- 不做綜合 alpha／Strong Buy 分數，不把十類訊號投票，不在自選名單內回測或挑贏家；文獻的投組母體、成本與資料版本不一致。
- 不優先做 PEAD 買進標籤、短期反轉訊號、期權 smirk／財報價差交易、opportunistic insider 分類、13F／Berkshire 跟單推薦或新聞情緒交易儀表；對本產品，現代大型股淨證據與免費 PIT 資料不足以支撐其工程與誤讀成本。
- 不把回購授權當實際減少股數，不把 short-sale volume 當 short interest，不把 low volatility 當高預期報酬，也不把公告日風險溢酬當財報後漂移。
- 不用上述值調整每月定投、加碼金額、停扣、部位或退出條件；維持 X03／L17 與個股不給買賣建議的邊界。

### 未核實、不確定、需要人判斷的地方

- 未核實：Martineau、近期 PEAD 爭論、Best Ideas 新版、DTC 修訂與 BAB 批評的完整表格／成本；報告已逐項標出實際看到的是一手摘要、搜尋索引或二手說明。沒有替十類訊號捏造個別發表後衰退百分比。
- 未核實：多數訊號在「今日 S&P 500、公開後才交易、免費資料、完整成本後」同時成立的效果；找不到不能寫成效果精確為零。
- 需 E：EPS 歷史 consensus、期權歷史 bid／ask、借券費、歷史成分／下市、財報 PIT 與公開顯示權利。抓得到現況不代表能重製文獻。
- 需整合者：是否新增上述三個背景值，以及是否值得另開個股預測力研究。D2-14 只是待補齊的登記草案；本輪沒有跑新回測、沒有改模型或產品行為。
