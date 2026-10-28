# 任務 G：X 實務者的數據分析、判斷檢驗與 AI 工作流程

研究日：2026-10-28（Asia/Taipei）。對象為市場觀測室的台灣長期投資人。本文整理十五位個人／團隊、二十三條貼文或文章，另以一份 S&P DJI 原文查核集中度口徑。

**結論：最值得借的是把判斷變成可核對的紀錄，以及把集中度寫成曝險描述。這些來源沒有提供可直接採用的指數短期新條件。** Mauboussin 最接近「先基準率、再條件」；Callum Thomas 和 Liz Ann Sonders 提供實際的失敗回顧；Kris Abdelmessih 提供具體的 Claude／agent 研究構想，但他自己明說仍在早期，不能當選股成效證據。

## 範圍、取得方式與證據判準

- 已讀 `web/docs/forecast.md` 的研究、事前登記與判斷流程章節，以及 `web/docs/research-2026-10-27/proposal.md` 的排除清單與下一輪問題。本輪不重整投行年底目標、既有指標文獻或 vol targeting；涉及廣度、季節性、資金流時，只評估作者如何交代口徑與限制。
- X 使用 `agent-reach twitter search`，共五次呼叫；前三次成功。第四次回 `TIMEOUT: opencli did not finish within 30s`，第五次回 `TIMEOUT: opencli is temporarily paused after TIMEOUT; retry later`，隨即停止。未換帳號、後端或瀏覽器，也未再試。兩次搜尋之間保留至少十秒。其後改用一般搜尋，包括 `site:x.com`；部分帳號限定搜尋回傳無關內容，因此改查作者公開原文。沒有使用 Reddit。
- X 成功結果取得作者、日期、貼文文字與永久網址；**沒有檢視附圖**，故圖中獨有的數字不列為已核實。文章則以實際開到的正文為準；搜尋摘要、轉址、空殼與抓取錯誤另列。
- 引文以短引為主。`anecdotal` 包含實務者自述、自己做的回測及未獨立複核的績效。作者使用「out-of-sample」一詞，不會自動升為 `academic_oos` 或 `independently_tested`。官方揭露能證實方法或數字的出處，也不能因此證明 alpha。
- 「正／零／負」只用於作者實際檢驗的預測或策略效果；純描述、方法建議與尚未公布結果的計畫標「未檢驗」，不把缺證據誤寫成零效果。下文每項效果主張只給一個等級，並標期限、資產及是否為橫斷面選股。
- 未下載或運算市場歷史資料，未執行回測、探索統計、正式站管理 API、commit 或部署。程式只讀，唯一寫入為本報告。本文的數字均為下列原文引述，不是本輪重算。

## 十五位實務者：本輪實際觀察到什麼

這是目的性取樣，不是全體 FinTwit 的代表性調查。「沒找到」均限於本輪取得的來源。

| 實務者／帳號 | 本輪觀察到的資料與圖表 | 不確定性與自我檢驗 | 對我們的用途 |
| --- | --- | --- | --- |
| Corey Hoffstein／@choffstein | 回測分布、策略對樣本與實作設定的敏感性 | 明說單一路徑只是隨機過程的一次實現；要求看到回撤。方法評論，不是實證績效稽核（G-S01–02） | 判讀研究報告，不新增模型搜尋 |
| Charlie Bilello／@charliebilello | 年內回撤與全年結果並列；大型權值集中度長圖 | 用歷史背景降低「跌了就是異常」的敘事；本輪貼文沒有獨立預測計分（G-S03–04） | 風險教育、集中度日期標示 |
| Aswath Damodaran／@AswathDamodaran | 估值假設、敘事可行性、AI 估值教學實驗 | 區分 possible／plausible／probable；公開承認 bot 比賽尚未結算（G-S05–06） | 情境與已校準機率分開 |
| Nick Maggiulli／@dollarsanddata | 現金流、定投與等待低點的終值比較；文章對應 code | 展示有利與不利期間，揭露完美事後資訊的假設；另公開談自己的 AI 寫作經驗（G-S07–08） | 分清每月收入與額外研究預算 |
| Ben Carlson／@awealthofcs | 集中度圖與長期持有敘事 | 對集中度保持相對不擔心的看法，但沒有用該文章驗證未來報酬（G-S09） | 保留與集中度警報不同的解讀 |
| Michael Mauboussin／@mjmauboussin | 同起始規模公司的營收成長分布、reference class | 先 prior，再隨新資料更新；後續回應通膨、產業切樣本與世界改變的質疑（G-S10–11） | 最接近本專案原則；限個股基本面研究，不移植成指數訊號 |
| Liz Ann Sonders／@LizAnnSonders | 就業、盈餘、集中度與市場結構；圖下注明資料日期 | 年中對帳明寫預期失業率上升是錯的；集中度討論偏再平衡紀律（G-S12–13） | 自評寫清錯在哪；不照搬部位操作 |
| Callum Thomas／@Callum_Thomas | 估值、貨幣環境、景氣、情緒、技術圖；idea inventory | 年末分「有效／無效的圖」，保留原始判斷日期、期限與信心；績效仍是自評（G-S14） | 研究理由的版本與撤回紀錄 |
| Meb Faber／@MebFaber | 年度報酬直方圖 | 先問無條件分布；該篇轉貼圖的完整資料方法未核實（G-S15） | 借呈現順序，不借未核實的機率數字 |
| Bespoke／@bespokeinvest | 事件後逐次結果表、ETF／市場內部結構、pros／cons | 有明確承認小樣本不能推論的文章，也有以極小樣本支持方向的報告（G-S16–17） | 逐篇審核，不能按品牌貼可信標章 |
| Jason Goepfert／@jasongoepfert、SentimenTrader | mutual fund cash reserves 與利率調整、資料發布落差 | 舊論文有時間切分，亦公開修訂引用；測試門檻有變化，未見獨立複製（G-S18） | 借時點與修訂揭露，不重開情緒指標 |
| Warren Pies／@WarrenPies、3Fourteen | 多資產模型、quality／trend 選股、模型年度回顧 | 區分 discretionary research 與 model；實際基金揭露還指出模型／實盤可能不同（G-S19–20） | 模型績效、基金績效、分析師判斷分開 |
| Jurrien Timmer／@TimmerFidelity | 大型股權重、等權比較、盈餘分配與 capex | 用「may」「if」講市場領導權；本輪文章沒有固定期限的校準計分（G-S21） | 集中度是曝險與解讀，不是賣出觸發器 |
| Eric Balchunas／@EricBalchunas | ETF flow、AUM、費用及產品結構 | 區分資金流與市場上漲造成的資產增加；承認無法準確認出全部持有人（G-S22） | flow 的分母、持有人推論限制 |
| Kris Abdelmessih／@KrisAbdelmessih | options 資料、研究信件、Claude Projects 與 agent 流程 | 交代正在試做、工具不好用之處及尚未接好的環節；沒有選股收益驗證（G-S23） | 有來源的研究草稿與人工檢查 |

## 可引用來源帳本

### G-S01｜Corey Hoffstein：漂亮曲線會掩蓋風險

- 帳號、日期、原文：@choffstein，2019-02-23，[X 貼文](https://x.com/choffstein/status/1099418725634080769)。取得貼文文字，未看附圖。
- 短引： “You *want* to see drawdowns in a backtest!”
- 重點：只偏好好看的回測會丟掉風險資訊；應問風險在哪、可能造成什麼影響。
- 證據：`anecdotal`；方法意見，效果未檢驗。不限期限／多策略，非橫斷面選股證據。

### G-S02｜Corey Hoffstein：一次回測不是所有可能世界

- 帳號、日期、原文：@choffstein，2023-08-28，[X 長文](https://x.com/choffstein/status/1696200568383979851)。已取得完整文字。
- 短引：“A backtest is just a single draw of a stochastic process.”
- 重點：討論參數、交易時點、slippage、投資宇宙與不同時段對結果的影響，也把刻意加入 look-ahead 當成理論上界的教學工具。
- 證據：`anecdotal`；方法意見，效果未檢驗。多資產／策略設計，不是指數短期方向檢驗。**這不是本專案現在可以試一堆設定的授權**；本輪不得照做，任何市場資料敏感度研究仍受事前登記限制。

### G-S03｜Charlie Bilello：回撤與全年報酬要一起看

- 帳號、日期、原文：@charliebilello，2026-10-04，[X 貼文](https://x.com/charliebilello/status/2106790573541646701)。已取得文字，未核對影片或圖的報酬口徑，因此不搬運其平均報酬數字。
- 短引：“there's no upside without downside”。
- 重點：把年內最大跌幅與全年結果並列，而非把下跌直接當成投資失敗。
- 證據：`anecdotal`；歷史描述，效果未檢驗。年度／S&P 500，非橫斷面。其「從年內高點回撤」與我們「從今天起、固定期限內的收盤跌幅」是不同事件，不能混稱。

### G-S04｜Charlie Bilello：集中度先交代觀察窗口

- 帳號、日期、原文：@charliebilello，2026-10-13，[X 貼文](https://x.com/charliebilello/status/2109822680375644364)。已取得文字，未看圖。
- 短引：“the highest concentration we've seen”。
- 原作者數字：貼文稱 S&P 500 前十大持股合占 **39.5%**，其比較資料從 **1980 年**起；數字是該日作者陳述，精確權重 as-of 與底層資料未獨立核對。
- 證據：`anecdotal`；當期結構描述，效果未檢驗。S&P 500，非橫斷面選股。只能稱「作者資料窗口內最高」，不能寫成史上最高，也不能由此推出即將下跌。

### G-S05｜Damodaran：有可能，不等於大概會發生

- 帳號、日期、原文：@AswathDamodaran，2026-03-04，[X 貼文](https://x.com/AswathDamodaran/status/2029329735160086811)。已取得貼文；其連結的 [部落格文章](https://aswathdamodaran.blogspot.com/2026/03/ai-scenarios-from-economic-doomsday-to.html) 本輪抓取回 **429**，文章全文未核實。
- 短引：“possible (the weakest) to plausible to probable”。
- 重點：讀 AI 末日或成功情境時，先分辨是可能、合理，還是有足夠理由視為較可能。
- 證據：`anecdotal`；方法意見，效果未檢驗。AI 經濟／企業情境，沒有固定市場期限，也不是橫斷面報酬驗證。這套詞彙不是數值校準機率。

### G-S06｜Damodaran：公開 bot 實驗也要區分進行中與結果

- 帳號、日期、原文：@AswathDamodaran，2024-08-28，[Beat your Bot: Building your moat against AI](https://aswathdamodaran.blogspot.com/2024/08/beat-your-bot-building-your-moat.html)。第一次抓取回 429，後續已讀到正文。
- 短引：“The results of the contest are still being tabulated”。
- 重點：Vasant Dhar 的 bot 讀其公開教材、影片與估值，準備和學生估值比較；作者寫作當時尚未公布比賽結果。他區分機械計算與需要原則判斷的估值。
- 證據：`anecdotal`；實驗與工作方法自述，效果未檢驗。企業估值教學，非固定持有期限的選股績效。不能把「模仿知名教授」推成已證實打敗市場。

### G-S07｜Nick Maggiulli：先把現金流與對照策略說清楚

- 帳號、日期、原文：@dollarsanddata，2019-02-05，[Even God Couldn’t Beat Dollar-Cost Averaging](https://ofdollarsanddata.com/even-god-couldnt-beat-dollar-cost-averaging/)。正文可讀，文末附對應 code repository；本輪沒有執行。
- 短引：“how dependent we are on timing luck”。
- 原作者結果：每月投入與先累積現金、再以完美事後資訊買低點相比，在作者的 **40 年**滾動期間中，Buy the Dip 有**超過 70%**的期間輸給定投。原文起始年取 **1920–1979**；使用美股含息、通膨調整資料，並展示等待買點有利與不利的期間。
- 證據：`anecdotal`；結果**負**，對象為等待低點策略相對持續定投。期限四十年／美股／非橫斷面。不是 OOS，也不等於台幣、稅後結果。
- 本輪新增的產品辨識：這個問題是「每月新收入是否先擱置」，不能拿來替獨立的一筆 `researchBudgetTwd` 推導加碼規則；兩者的現金來源與可投資起點不同。

### G-S08｜Nick Maggiulli：AI 產出多，不代表分析更好

- 帳號、日期、原文：@dollarsanddata，2025-12-02，[There is No Substitute for Thinking](https://ofdollarsanddata.com/there-is-no-substitute-for-thinking/)。正文可讀。
- 短引：“How people use AI is.”
- 重點：作者公開談自己曾用 AI 做 SEO 內容、後來停止的經驗，反對把思考整包外包。這是可查的自省，不是 AI 選股驗證。
- 證據：`anecdotal`；工作方法與主觀評價，市場效果未檢驗。不能把該文的文風辨識或教育因果推論當成已證實研究，也不應用文風自動判斷內容真偽。

### G-S09｜Ben Carlson：集中度的另一種解讀

- 帳號、日期、原文：@awealthofcs，2024-04-09，[Two Things I’m Not Worried About](https://awealthofcommonsense.com/2024/04/two-things-im-not-worried-about/)。正文可讀。
- 短引：“So what?”
- 重點：他把集中度視為大型成功企業表現強的結果，並提醒未來仍會有風格落後時期；不是看到集中就預測市場崩盤。
- 證據：`anecdotal`；長期投資意見，效果未檢驗。美股市場結構，非橫斷面預測。文中圖表引用 Goldman Sachs；本輪沒有取得該圖的銀行原始資料，因此不搬運其數字。

### G-S10｜Mauboussin：同起始規模的公司作為 reference class

- 帳號、日期、原文：@mjmauboussin，與 Dan Callahan 合著，2026-02-10，[Bayes and Base Rates](https://www.morganstanley.com/im/publication/insights/articles/article_bayesandbaserates_ltr.pdf)。官方 PDF 正文可讀。
- 短引：“beliefs that are held lightly and open to revision”。
- 重點：先問相似起始營收規模的公司曾達成哪些成長，再隨企業實際公布的結果更新，而不是由熱門故事直接設定高成長假設。
- 證據：`anecdotal`；實務基本面分析，對投資效果未檢驗。多年企業營收成長／美國公司，屬跨公司基本面比較，**不是橫斷面股票報酬檢驗**。官方出版不使其成為學術 OOS。

### G-S11｜Mauboussin：基準率不是「從沒發生，所以不可能」

- 帳號、日期、原文：@mjmauboussin，與 Dan Callahan 合著，2026-05-13，[Bayes and Base Rates 2.0](https://www.morganstanley.com/im/publication/insights/articles/article_bayesandbaserates2_ltr.pdf)。官方 PDF 正文可讀。
- 短引：“base rates are dynamic distributions”。
- 重點：回應 nominal／real、產業 reference class 與 AI 新技術是否改變分布的批評；指出營收成長分布並非完美常態，不應把 z-score 硬翻成精確的極端事件機率。也區分營收成長與創造股東價值。
- 證據：`anecdotal`；描述性基本面研究，投資效果未檢驗。原文比較五年營收成長／美國企業／跨公司基本面，非股票報酬選股。
- 對既有結論的新補充：基準率需要合適的 reference class，且不能被當成世界永不改變的保證；這不構成改動我們已凍結窗口的理由。

### G-S12｜Liz Ann Sonders：自評可以具體承認錯誤

- 帳號、日期、原文：@LizAnnSonders，與 Kevin Gordon 合著，2026-06-03，[2026 Mid-Year Outlook: U.S. Stocks and Economy](https://advisorservices.schwab.com/story/us-stock-market-outlook)。正文可讀。
- 短引：“We were, however, wrong”。
- 重點：明說對失業率輕微上升的預期錯誤；也說明 household survey 較波動、曾給出假訊號。不是只保留看對的圖。
- 證據：`anecdotal`；對該項總經判斷的回顧結果**負**。半年左右／美國勞動市場，非資產報酬、非橫斷面選股。自認錯誤不等於整套策略已被獨立評分。

### G-S13｜Liz Ann Sonders：集中度與再平衡紀律

- 帳號、日期、原文：@LizAnnSonders，與 Collin Martin，2026-07-24，[AI Concentration & the Case for Rebalancing](https://www.schwab.com/learn/story/ai-concentration-case-rebalancing)。已讀官網文字介紹，未收聽整集或取得逐字稿。
- 短引：“Rather than trying to predict which AI winners will emerge next”。
- 重點：把 AI 相關大型股集中度連到組合分散與再平衡，而不是宣稱知道下一家贏家。
- 證據：`anecdotal`；實務建議，報酬效果未檢驗。長期組合曝險／美股，非選股 OOS。此處只借曝險溝通，不把其修剪部位的建議接到我們的定投或機率輸出。

### G-S14｜Callum Thomas：有原始日期的成功與失敗回顧

- 帳號、日期、原文：@Callum_Thomas，**2025 年末版，PDF 未標發布月日**，[2025 End of Year Special Edition 官方 PDF](https://www.topdowncharts.com/_files/ugd/542496_11fe6959db2b49a0b80cca452d7cbf0f.pdf)；[官網入口](https://www.topdowncharts.com/2025-special-edition)。正文可讀。
- 短引：“Charts That Didn’t Work”。
- 重點：失敗章保留原始判斷日期，承認中國房地產未反轉、衰退擔憂未實現、油價反彈落空；idea inventory 另列提出日期、題目、方向、初始期限與信心，並分 open／closed。
- 證據：`anecdotal`；作者對 **2020–2025** ideas 與 TAA 的自評為**正**，但對上述個別判斷自評為**負**。多資產、期限混合，非固定期限的指數機率，也不是橫斷面選股測試。原文以命中率優於 **50/50** 論證價值；這不足以排除各資產的方向基準率、選題及結案偏差。
- 可借「原始文字＋日期＋錯誤原因」，不能借其命中率當我們的信心加成。這是對既有 L14／U-05 的新實例，不另提相同功能。

### G-S15｜Meb Faber：先問無條件分布

- 帳號、日期、原文：@MebFaber，2026-02-04，[What’s The Most Likely Stock Market Outcome?](https://mebfaber.com/2026/02/04/whats-the-most-likely-stock-market-outcome/)。正文可讀，附圖未檢視。
- 短引：“which bucket would have the most years?”
- 重點：先讓讀者猜年度報酬分布，再揭示結果，是基準率教育的呈現範例。
- 證據：`anecdotal`；歷史描述，效果未檢驗。年度／美股，非橫斷面。作者明列圖來自 Deutsche Bank 與 Finaeon；本輪未核對該圖的底層資料、含息與樣本定義，**不引用其眾數區間或推導短期機率**。

### G-S16｜Bespoke：承認事件表沒有告訴我們方向

- 帳號、日期、原文：@bespokeinvest，2024-01-04，[Morning Lineup – Better Jobs Data](https://www.bespokepremium.com/morning-lineup/bespokes-morning-lineup-1-4-24-better-jobs-data/)。可讀的是免費節錄，付費全文未取得。
- 短引：“doesn’t shed much light”。
- 原作者資料：年初連續下跌條件只有**四次**先例；列出 **1980、1991、2000、2005 年**，明說往後結果無清楚趨勢，而且當年的跌幅與先例也不一致。
- 證據：`anecdotal`；作者描述的方向結果**零／不明確**。當月剩餘期間與當年剩餘期間／S&P 500／非橫斷面；不是正式零效果檢定。
- 這是現成反例：有歷史表格也可以得出「無法判斷」，不必硬給市場方向。

### G-S17｜Bespoke：附了 n，也不代表可以用

- 帳號、日期、原文：@bespokeinvest，2023-01-06，[The Bespoke Report: Equity Market Pros and Cons](https://media.bespokepremium.com/uploads/2023/01/Bespoke-Report-010623-Pros-and-Cons.pdf)，PDF 第十二頁。正文與表格可讀。
- 短引：“While the sample size is small”。
- 原作者資料：**1901–2022 年**國會會期表中，Democratic President／Democratic Senate／Republican House 只有 **n=2**，上漲比例 **100%**；同表 All Periods 為 **n=61、70.5%**。因此這不是「未附基準率」的例子，而是**附了基準率仍受極小樣本限制**。
- 證據：`anecdotal`；作者描述的條件結果為**正**，但未證實可預測。期限為國會會期／**DJIA**，不是 S&P 500 的短期期限，非橫斷面。對本專案的意義只在審核陷阱，季節性與政治事件條件不重開。

### G-S18｜Jason Goepfert：有 OOS 字樣仍須查切分與門檻

- 帳號、日期、原文：@jasongoepfert／SentimenTrader，論文 **2004-10**；修訂信 **2004-11-19**，[Mutual Fund Cash Reserves, the Risk-Free Rate, and Stock Market Performance 與修訂信](https://cmtassociation.org/wp-content/uploads/2025/08/2004DowAwardRevised.pdf)。CMT 官方存檔正文可讀；網址中的上傳年月不是論文日期。
- 短引：“without the perfect knowledge of hindsight”。
- 原文方法：以 **1954–1976 年**估回歸，稱 **1977–2003 年**為 OOS；同段相關係數的起點另寫成 **1976 年**。全樣本的現金比率殘差 extreme 門檻為 **±2.25 個百分點**，OOS 改為 **±1.75 個百分點**；未見該門檻變動的事前凍結證明。交易示範有依一個月的資料發布延遲調整進場時點。
- 證據：`anecdotal`；作者的歷史時間切分結果**正**，期限十二個月／S&P 500／非橫斷面。是實務論文，沒有本輪可核實的獨立複製，不能升為 `academic_oos`。獲獎也不等於獨立重算。
- 修訂信公開補上 Fosback 的相關先行研究；委員會未認定抄襲。可借的是來源修訂與可得時點，不能由此重開已排除的資金／情緒指標。

### G-S19｜Warren Pies：模型回顧與主觀策略分開

- 帳號、日期、原文：@WarrenPies／@3F_RESEARCH，2025-01-02，[Model Update: 2024 Review](https://www.3fourteenresearch.com/samples/3fr-model-review-2024.pdf)。正文可讀，部分圖表文字編碼錯亂；不引用那些圖中的數字。
- 短引：“our strategy recommendations … are discretionary”（刪節短引）。
- 原作者結果：封面列 Core RAAM **2024 年績效 18.9%**；文字把模型與長篇 discretionary research 分開，並與 **60/40**比較。這是多資產組合，不能用來評定某次 S&P 方向呼叫。
- 證據：`anecdotal`；自報模型效果**正**。年度／多資產配置；不是橫斷面選股或指數機率的獨立驗證。單一正年度也不足以驗證 alpha。

### G-S20｜Warren Pies：正式基金與 newsletter 模型也不相同

- 帳號、日期、原文：@WarrenPies，FCTE 發行人 **2025-04-30** [SEC prospectus](https://www.sec.gov/Archives/edgar/data/1771146/000199937125005134/fcte-485bpos_043025.htm)。已讀文件的 strategy、performance history 與 performance deviation risk。
- 短引：“may or may not vary”。
- 重點：FCT 選 quality／trend 股票、定期調整；基金可以在數量、買賣時間與權重上不同於 newsletter 模型。該版當時尚無完整日曆年績效，不能把較早模型數字當成基金實盤紀錄。
- 證據：`none`（此文件沒有證實預測效果）；官方可核實的是揭露內容。長期美股組合、屬橫斷面選股策略，但不是其有效性的檢驗。**「SEC 存檔」不等於 SEC 認可準確度或績效。**

### G-S21｜Jurrien Timmer：集中度、盈餘與再投資分開看

- 帳號、日期、原文：@TimmerFidelity，2026-07-27，[Opportunity beyond concentration](https://www.fidelity.ca/en/insights/articles/timmer-global-macro-view-july-27-2026/)。已讀 Fidelity 的官方整理，非完整談話逐字稿。
- 短引：“may be giving way”。
- 原作者數字：官文稱前十大約占總市值 **40%**；文章沒有為該句提供精確收盤 as-of。因此可核實「官方當日這樣說」，未獨立核實當日精確權重。
- 證據：`anecdotal`；對市場領導權轉移的判斷未檢驗，沒有指定固定結算期限。美股市場結構，沒有橫斷面選股 OOS。其股東分配／capex 討論是基本面背景，不是機率輸入。

### G-S22｜Eric Balchunas：flow、價格變動與持有人不能混為一談

- 帳號、日期、原文：@EricBalchunas，2025-01-30，[Alpha Exchange 原始訪談與逐字稿](https://www.axpod.com/podcast/eric-balchunas-senior-etf-analyst-bloomberg-intelligence/)。逐字稿可讀。
- 短引：“You can’t ever tell exactly who owns the ETFs”。
- 重點：談 ETF 資產增加時區分淨流入與市場上漲；也說公開持倉申報不能精確認出全部持有人，券商名下可能是客戶資產。
- 證據：`anecdotal`；市場結構與資料限制，效果未檢驗。ETF 產業／年度回顧，非橫斷面預測。不能從 flow 反推「聰明錢看多」，更不能把 AUM 的全部增加當成新買盤。

### G-S23｜Kris Abdelmessih：最具體的 Claude／agent 研究流水線，也最清楚說尚未完成

- 帳號、日期、原文：@KrisAbdelmessih，2026-01-25，[innovator’s dilemma in homine](https://moontower.substack.com/p/innovators-dilemma-in-homine)。正文可讀。
- 短引：“Status: very early…need to get email agent running”。
- 流程：研究信件 → agent 擷取作者的 bullish／bearish 觀點、時點等欄位 → 交給連接 Moontower options database 的 agent 對照 option surfaces → 另一個 agent 呈現結果。他用 Claude Projects 分隔研究，將每次工作的結論與不滿意方向寫回持續更新的文件。
- 真實限制：信件入口尚未接好，涉及作者 IP；另自述某些瀏覽器操作仍笨拙、部分 spreadsheet 工具不好用。這些是具體工作痛點，但不是統計化的錯誤率測試。
- 證據：`anecdotal`；流程自述，選股或報酬效果未檢驗。個股／options 研究，無固定投資期限，沒有橫斷面績效驗證。文中有用 Claude Code、ChatGPT 等工具的說明，不能推成各工具的品質比較已獨立成立。

### G-S24｜官方補核：集中度下降不必等於大盤下跌

- 作者、日期、原文：S&P DJI 的 Tim Edwards、Nick Didio，**2026-04**，[In the Shadows of Giants](https://www.spglobal.com/spdji/en/documents/research/research-in-the-shadows-of-giants.pdf)。官方 PDF 正文可讀。
- 短引：“the relationship between concentration and market performance is quite subtle”。
- 官方數字：截至 **2025-06-30**，S&P 500 最大十家公司權重接近 **40%**。Exhibit 1 明確採當時最大十家公司；註腳明列 Alphabet 合併兩種股類。
- 重點：集中度可因大型股相對落後而下降，也可因其他股票更強而下降。某一固定 cohort 的後續變化，與每期重新選前十大，不是同一條時間序列。
- 證據：`none`（未提供未來報酬預測力檢驗）；官方支持的是描述口徑與歷史現象。美股指數、跨數十年描述，非橫斷面選股 OOS。官方日期不等於目前的最新讀數。

## 新證據：好的分析實際如何被檢查

### 基準率不是一條裝飾線，還要問它是否回答同一個問題

最接近我們原則的是 **Mauboussin**：同起始規模、明確研究目標、可更新的 prior，並承認分布與 reference class 的限制（G-S10–11）。**Maggiulli** 次之：先定義資金什麼時候到手，再設定對照策略與完美資訊假設（G-S07）。**Bilello、Faber** 適合風險教育與無條件分布的開場，不能因為圖簡潔就視為校準預測（G-S03、G-S15）。

一個新且可核查的陷阱是 **Callum 的自評以高於隨機猜測論證價值**：多資產、混合期限、主觀結案的勝率，不能與固定標籤的機率模型直接比較（G-S14）。另一個是 **Bespoke 明列了 All Periods，仍不足以補救極小的條件樣本**（G-S17）。這比泛稱「社群都不附基準率」更準確。

### 有 OOS、獲獎或基金包裝，不等於同一種證據

Goepfert 舊論文的時間切分與發布延遲值得學，但 extreme 門檻在樣本間改變；因此不能只看 OOS 字樣就採信（G-S18）。3Fourteen 的模型年度結果、newsletter、實際基金及主觀文章也不是同一個績效對象；prospectus 把差異寫得很清楚（G-S19–20）。

這些是本輪對「公開戰績」找到的實際來源，**未找到可把上述帳號排成公允名次的共同前瞻計分資料**。本輪未做新的戰績統計，亦不把帳號知名度、獲獎或基金存在視為準確度代理。

### 自我檢討要能指出原句與失敗原因

Callum 的失敗圖附原始判斷日期，Liz Ann 的年中報告直接指出哪項預期錯誤，比只寫「市場很難預測」更有檢驗價值（G-S12、G-S14）。但作者自行挑選的失敗與成功仍可能有選樣偏誤，不能把誠實語氣換算成預測技能。

這補充既有 L14／U-05 的來源證據；不重新提一套命中率排行榜，也不重做上一輪的策略師計分。

## AI 實作分享：我們可以借哪一段

Kris 的例子是本輪最具體的市場研究 agent 流程：有輸入文件、結構化欄位、外部資料對照及呈現階段，也公開說明尚未完成的部分（G-S23）。Damodaran bot 的例子則顯示，教材覆蓋與完成估值任務仍是不同問題，當時也沒有公布比較結果（G-S06）。Nick 的自省提供反方意見，但不是 AI 導致判斷退步的因果證據（G-S08）。

**沒有找到這些來源中可核實的 Codex 選股前瞻戰績，亦沒有找到能支持「多 agent 互評就能產生 alpha」的證據。** 不補上未核實的收益截圖或匿名挑股挑戰。

對 App 的新用途是降低「研究文字不可查」的成本：保留輸入原文、發布日期、擷取時間、可用內容層級，以及產出句子的來源對應。這是資料忠實度工作，不是讓 LLM 產生新的市場條件。

本機現況已親讀：

- `web/src/lib/news-ai.ts:140` 的個股 prompt 已要求依新聞寫作、找不到原因就明說；`web/src/lib/news-ai.ts:192` 的大盤 prompt 也禁止編造因果。**不是建議把現有規則再寫一遍。**
- 真正可補的是來源可見性：`web/src/lib/news-ai.ts:198` 定義 `body`／`summary`，`web/src/lib/news-ai.ts:207` 依有無正文切換輸入；當只有標題摘要時，提示詞還要求不要在重點裡提到抓不到正文。使用者因而未必能從文字知道資料層級。可在內容旁以欄位標示「全文／標題摘要」，不必讓 AI 自己口頭報告。
- `web/src/lib/news-ai.ts:220` 的 `parsePoints` 主要檢查輸出陣列與 tone，不是來源支持度驗證。未發現這裡已有逐句 evidence mapping；本輪也沒有假設模型已發生哪種數字錯誤。

建議的流水線不授權 agent 取得 SPX、VIX 或個股歷史後自行找規律。若未來要評估 AI 摘要品質，應先固定人工標註的新聞材料與錯誤分類，檢查出處、單位、日期及推論是否被原文支持；這不需要市場報酬回測。它的產品效益仍是待驗假設，不能宣稱提高投資績效。

## 集中度：先做曝險描述，不做市場時鐘

本輪呈現三種不同立場：Bilello 強調高集中度、Timmer 關注領導權可能擴散，Carlson 則相對不擔心；Liz Ann 連到組合再平衡（G-S04、G-S09、G-S13、G-S21）。這些差異沒有共同固定期限與校準紀錄，不能把多個人的語氣票選成風險分數。

官方核對給了更有用的共同基礎：分清當期前十大公司、固定歷史 cohort、持股證券與公司，以及權重資料日期（G-S24）。集中度下降與指數下跌不是同義詞。

對我們可設計、但本輪未執行的當期描述：

- **公司合併權重**：同公司各股類先相加，再排序；「前十大公司」不等於持股檔前十列。
- **觀察覆蓋**：名單公司在指數代理中的合計權重。它衡量「你關注了多少指數」，不是「你個人資產有多集中」。
- **個人總曝險**：只有知道 ETF 與直接持股的實際金額，才有資格合併計算。現有觀察名單與定投規劃不能代替持倉，不應顯示假精確的個人集中度。
- **明示代理**：若沿用目前 SPY holdings，寫「SPY 持股推估」、保留 holdings as-of；不能把它直接標成官方 SPX 最新權重，也不以他人貼文數字覆蓋當期資料。

程式落點已親讀：`web/src/lib/watchlist.ts:51` 與 `web/src/lib/watchlist.ts:62` 已把同公司股類一起加入；`web/src/server/views.ts:389` 取得 holdings as-of，`:393` 合併名單公司的股類權重，`:398` 加總名單覆蓋。**既有公司合併邏輯應重用，不另發明 ticker 等於公司的假設。**

以上只描述當期權重，不做歷史相關或新回測，也不設「集中度超過某值就減碼」門檻。若日後想研究它能否預測報酬，須另外提出明確問題、定義與採用門檻，先完成事前登記；本輪沒有理由替它申請模型名額。

## 加碼研究預算與檢討：本輪可補的是紀錄，而非訊號

`web/src/server/views.ts:224` 的 plan 是規劃參數；`web/pages/etfs.tsx:222` 目前只顯示分筆數及漲跌達門檻時檢討的文字。這不是持倉損益或自動化規則引擎。

可以從 Callum 的有日期判斷紀錄與 Mauboussin 的 reference-class 思考，借出一張**手動研究筆記**：研究哪個問題、什麼原文支持、預計何時檢討、什麼觀察會推翻理由；修改時保留舊理由。這能服務 b／c，沒有證據證明它能改善投資結果。不要把「理由改變」自動轉成下單或停止定投。

`web/src/lib/forecast.ts:80` 的現行條件與 `web/src/lib/forecast.ts:150` 的標籤定義均已讀過。本輪不提出集中度、flow、季節性、AI 情緒等新 flag；不改 P(up) 名額或 dd5 候選，也不以任一帳號的敘事推翻 X03／L17。

## 查核缺口與停止紀錄

- 已取得十五個實務個人／團隊的來源，二十三條可引用貼文／文章，以及官方集中度補核，結論完成後停止擴搜。未檢視的付費內容或圖片不計入已讀全文。
- Schwab 的舊網址 `https://advisorservices.schwab.com/story/every-breadth-you-take-market-concentration-risks` 搜尋摘要仍顯示舊集中度文章；實際開啟卻導向 `us-stock-market-outlook`。**舊文與舊數字未核實**，不把新正文當舊文佐證。本文 G-S12 明確引用實際取得的新文。
- Bespoke 的 `https://www.bespokepremium.com/interactive/posts/think-big-blog/big-winners` 搜尋摘要有小樣本評論，但實際開到空殼；**未核實、不計入來源數量**。G-S16 只使用實際可見的免費節錄。
- Damodaran 情境部落格回 429，G-S05 僅引用已取得的 X 文字。其較早 bot 文章後續已取得正文，狀態不同，不能一概稱無法讀取。
- Bilello 的精確權重、Timmer 官文的精確權重 as-of、Faber 轉貼圖的資料方法及 Callum 年末 PDF 的發布日仍不完整；相關數字或日期缺口已在來源卡標出。沒有自行重算來補洞。
- 本文無真實市場資料運算、無 App 行為改動，故沒有啟動 App 的功能驗收；交付驗證限於報告來源、程式行號與指定檔案的靜態檢查。

## 給整合者的摘要

### 關鍵發現（3–8 條，每條附證據等級與來源）

- **最接近「先基準率、再條件」的是 Mauboussin**，其次是把現金流與對照策略先定義清楚的 Maggiulli。這是方法借鑑，未證明能改善指數短期預測。`anecdotal`；[Mauboussin／Callahan，2026-05-13](https://www.morganstanley.com/im/publication/insights/articles/article_bayesandbaserates2_ltr.pdf)、[Maggiulli，2019-02-05](https://ofdollarsanddata.com/even-god-couldnt-beat-dollar-cost-averaging/)。
- **公開自評有可學的實例，但不能直接當戰績認證**：Callum 保留原始判斷日期與失敗圖；Liz Ann 明說某項失業率預期錯誤。`anecdotal`；[Callum，2025 年末版、發布日未標](https://www.topdowncharts.com/_files/ugd/542496_11fe6959db2b49a0b80cca452d7cbf0f.pdf)、[Sonders／Gordon，2026-06-03](https://advisorservices.schwab.com/story/us-stock-market-outlook)。
- **有 n、基準率或 OOS 字樣仍須查設計**：Bespoke 的政治條件只有 n=2；Goepfert 舊文的 OOS extreme 門檻與全樣本不同。兩者作者結果為正，證據均僅 `anecdotal`，不重開既有排除項目。[Bespoke，2023-01-06，PDF 第十二頁](https://media.bespokepremium.com/uploads/2023/01/Bespoke-Report-010623-Pros-and-Cons.pdf)、[Goepfert，2004-10／2004-11-19 修訂](https://cmtassociation.org/wp-content/uploads/2025/08/2004DowAwardRevised.pdf)。
- **集中度應是曝險描述，不能直接變成減碼訊號**。S&P DJI 明確區分公司股類與當期前十大，也指出集中度下降可來自其他股票更強。預測力等級 `none`；[S&P DJI，2026-04；資料截至 2025-06-30](https://www.spglobal.com/spdji/en/documents/research/research-in-the-shadows-of-giants.pdf)。
- **Claude／agent 的具體研究流程已有人公開，但成效未證實**：Kris 的信件擷取、options 資料對照、呈現流水線當時仍未接好入口。`anecdotal`，報酬效果未檢驗；[Abdelmessih，2026-01-25](https://moontower.substack.com/p/innovators-dilemma-in-homine)。
- **回測、模型組合與基金實盤必須分開**。3Fourteen 自述模型結果為正，但 prospectus 明列基金可能偏離模型；不能拿其中一種結果替其他判斷背書。模型成效 `anecdotal`；[Pies，2025-01-02](https://www.3fourteenresearch.com/samples/3fr-model-review-2024.pdf)、[FCTE prospectus，2025-04-30](https://www.sec.gov/Archives/edgar/data/1771146/000199937125005134/fcte-485bpos_043025.htm)。

### 對我們 App 的建議

| ID | 建議 | 服務哪個決策（a 每月定投／b 加碼研究預算／c ±20% 檢討／d 觀察名單個股／資料／流水線／呈現） | 證據等級 | 成本（低／中／高） | 需事前登記？ | 與既有規則或排除清單衝突？ |
| --- | --- | --- | --- | --- | --- | --- |
| G-01 | 重用公司股類合併，呈現名單的指數覆蓋與當期公司集中度，附 SPY 代理及 as-of；不稱個人持倉曝險 | d／資料／呈現 | none（無預測主張；官方描述口徑） | 中 | 當期描述否；若連到未來報酬則是，本輪不做 | 無；不進機率、不設減碼門檻 |
| G-02 | 研究引用卡顯示原始來源、日期、對象、期限、樣本／基準與「作者自述／獨立驗證」，不按帳號給可信度分數 | b／d／呈現 | anecdotal（實務呈現借鑑） | 中 | 否；不新增歷史計算 | 無；補個股研究出處，不改 forecast |
| G-03 | 在規劃旁提供手動研究筆記：理由、來源、預定檢討日、推翻理由的觀察，保留修改前文字 | b／c | anecdotal（流程借鑑，效益未驗） | 中 | 筆記否；若日後計分或回測則須先登記 | 無；不自動觸發買賣或停扣 |
| G-04 | AI 內容旁標示「全文／標題摘要」，保存輸入版本與來源對應；沿用本機 ai-batch 路徑 | d／資料／流水線／呈現 | anecdotal（流程借鑑，效益未驗） | 中 | 否 | 無；補現有來源層級可見性，不增加預測 |
| G-05 | 先固定人工標註新聞材料與錯誤分類，再評估 AI 摘要的出處、單位、日期及推論支持度；不以收益評分 | 流水線 | none（待驗品質方案） | 中 | 不需市場模型登記；品質評估規格先凍結 | 無；禁止 agent 自行探索市場歷史 |

### 建議不要做的事與理由

- 不新增集中度、flow、季節性或社群語氣 flag；本輪沒有合格證據支持重開既有排除項目。
- 不因集中度、P(dd5) 或實務者看法調整定投、研究預算或部位；維持 X03／L17，不給個股買賣建議。
- 不做帳號命中率排行榜，不把小樣本全勝、獲獎、SEC 存檔或單年模型收益當成獨立技能證明。
- 不讓多 agent 相互同意代替來源查核，也不授權它們找市場歷史規律；好看的研究稿不等於有效選股。

### 未核實、不確定、需要人判斷的地方

- X 管道因 TIMEOUT 暫停後已停止；後續一般搜尋覆蓋有限。未找到可核實的 Codex 選股前瞻戰績，不能推論這類紀錄不存在。
- Bilello 的精確權重、Timmer 的精確權重 as-of、Faber 轉貼圖的方法及 Callum 年末報告發布日未完整核實；不應直接作為 App 最新數字。
- Damodaran 情境文章回 429；Bespoke 部分全文付費；Schwab 舊文章轉址。報告已分清可讀正文、貼文文字與未核實摘要。
- 手動研究筆記與來源標示能否實際幫助使用者理解，仍需產品驗證；沒有證據可承諾改善投資報酬。本輪未跑任何市場資料計算。
