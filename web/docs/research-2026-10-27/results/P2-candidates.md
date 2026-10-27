**我會把下一個 slot 用在「21 日 realized-volatility 高於 expanding median」，primary endpoint 設為 P(dd5)。** 如果下一個 slot 必須研究 P(up)，我會選下文的 **earnings-calendar × past newsy-month returns**，但把它視為有文獻依據、尚未驗證能轉成 binary probability 的研究假說。

**我沒有找到足以誠實填滿五個名額的合格候選。** 以下只排三個：RV 是本輪推薦；earnings-calendar 互動與低 SKEW 是保留候選。其餘想法逐項說明為何不占用 slot。

查核截至 **2026-10-27**。下文區分：

- **文獻結果**：每項預測證據標示一個指定等級，以及 positive／null／negative。
- **我提出的 binary 規格**：尚未測試你指定的 outcome，統一屬於 **none；未檢驗**。文獻的 continuous predictor 有效，不代表其 binary 版本已有效。
- **樣本覆蓋計算**：我只計算旗標、出現次數與重疊，**沒有計算這些新旗標的未來報酬、條件命中率或 BSS**。窗長、門檻與公式常數是以下建議的事前規格；你提供的模型統計則視為題設。

# 1. 排名與精確規格

## 資料與樣本數口徑

以下 shortlist 的資料源，均於 **2026-10-27 實際讀取**：


| 代號          | 免費資料、exact ID／URL                                                                                                                                               | 實際讀到的歷史起點                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **D-price** | Yahoo 原始資料端點：[`^GSPC` **daily**](https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=-1325635200&period2=1793059200&interval=1d)，使用 `quote.close` | **1927-12-30**；這是供應商歷史起點，本次未與 S&amp;P 官方檔案逐筆對帳 |
| **D-VIX**   | Cboe：[`VIX_History.csv`](https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv)，使用 `CLOSE`                                                    | **1990-01-02**                                 |
| **D-SKEW**  | Cboe：[`SKEW_History.csv`](https://cdn.cboe.com/api/global/us_indices/daily_prices/SKEW_History.csv)，使用 `SKEW`                                                   | **1990-01-02**                                 |


下表的所有 **nEff、episodes、重疊率**，都是本次依上述資料計算，統一使用 **1992-01-02—2026-09-25** 的 forecast-origin window；資料本身讀至 **2026-10-26**，末端排除尚未走完題設預測窗的 origins。

- nEff 沿用你的 **true days／21** 口徑，並不聲稱它等於統計上真正獨立的樣本數。
- episodes 採較保守定義：兩段 true 狀態中間，至少隔開 **21 個 false 交易日**才另算一段。
- 重疊率指「候選為 true 時，同時**低於 SMA200**／**VIX≥30**的比例」。它是 conditional overlap，不是相關係數，也不是增量預測能力。
- D-SKEW 在該窗口有 **16 個缺值日**；沒有補值，缺值時應回到模型的既定 fallback。以上數字的日期與來源均為本節所列查核日、窗口及原始資料 URL。

## Shortlist


| 條件／順位                                                        | 精確定義，事前寫死                                                                             | 經濟機制                                                                               | 免費資料與起始年                                    | 預估 true 側 nEff／episodes | 最佳證據：等級、結果、期限                                                                                                         | 最可能的失敗方式                                                                                  | 與 SMA200／VIX≥30 的重疊                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **第一：高 RV regime；用於 P(dd5)**                                 | 過去 **21 個交易日 squared log returns 的總和**，大於自 **1990-01-02** 起、截至前一日的 expanding median   | Volatility clustering；若未來報酬尺度較大，固定起點下方的跌幅障礙更容易被觸及                                  | D-price；**1927** 起，median reference 從題設起點開始 | **215.2／53**            | **academic\_oos；positive**：*Risk Everywhere*，下一個 **20 交易日 variance** 的股指期貨預測；不是 binary drawdown 預測。詳見 E-RV            | 改善可能只來自更廣的觸發覆蓋與較早通過樣本門檻；也可能把極端風險日稀釋進大量中等波動日                                               | **41.2%／15.6%**；與壓力狀態相關，但覆蓋遠廣於 VIX 高門檻         |
| **第二：earnings-calendar × past newsy-month returns；用於 P(up)** | 下文的 **\\(F\_{\\mathrm{EC},t}=\\mathbf1\[Z\_tK\_t&lt;0\]\\)**；只用歷史價格、固定季度月份與已知日曆       | 投資人外推早期 earnings news，卻錯估它對下一個新季度與同季度後續月份的延續程度；產生交替的 reversal／continuation         | D-price；**1927** 起，不需購買 earnings revisions  | **191.4／123**           | **academic\_oos；positive**：Guo，月度 broad US **CRSP total return**，OOS **1926–2021**；不是 S&amp;P 500 PRICE 的方向機率。詳見 E-EC | 文獻的 calendar-month expected-return 效果，可能無法移植到每日滾動的預測窗；binary cut 也可能丟失主要訊息                | **27.1%／8.6%**；直接重疊較低，但不代表已證明獨立資訊              |
| **第三：低 SKEW regime；只保留作 P(dd5) 候選**                          | `SKEW_t < expanding median(SKEW_s, s<t)`，reference 自 **1990-01-02** 開始；注意是 **低** SKEW | 作者提出 perceived tail risk 降低、冒險增加、脆弱性累積的解釋；但 standardized skewness、實際風險與保險價格的關係並不單純 | D-SKEW；**1990** 起                           | **111.7／60**            | **academic\_oos；positive**：Bevilacqua–Tunaru，OOS **2006–2017**，下一個月 terminal loss indicator；不是 path P(dd5)。詳見 E-SKEW  | 官方 SKEW 與作者重建序列未證明逐日等價；效果弱、可能與既有 tail-risk 訊息重複，而且 expanding median 可能受長期 level change 影響 | **38.0%／11.1%**；不能把它當成與 VIX 完全獨立的 tail-risk 維度 |


**第四、第五名留空。** 下方的 drawdown-from-high 與 absolute momentum 雖有足夠樣本，仍不足以排進值得使用本輪 slot 的名單。

## E-RV：支持的是風險尺度預測，不是方向

Bollerslev、Hood、Huss、Pedersen 的 [*Risk Everywhere: Modeling and Managing Volatility*](https://academic.oup.com/rfs/article/31/7/2729/5001472?utm_source=chatgpt.com)，發表於 **2018-05-22**。Table 5 的股指期貨平均結果中，使用 daily returns 的 **21-daily** 模型，對下一個 **20 交易日 variance** 的 OOS \\(R^2\\) 為 **8.1%**，static risk model 為 **2.9%**。各 equity series 起點不同，最早從 **1996 年**開始，資料截至 **2014-09**。**等級：academic_oos；結果：positive，限 variance forecasting。** [academic.oup.com](http://academic.oup.com)

這是三個候選中，我認為最有說服力的 transfer：

\\[ RV\_{21,t}=\\sum\_{i=0}^{20} \\left[\\log(C\_{t-i}/C\_{t-i-1})\\right]^2, \\]\\[ F\_{\\mathrm{RV},t} =\\mathbf1\\!\\left[ RV\_{21,t}&gt; \\operatorname{median}\\{RV\_{21,s}:1990\\text{-}01\\text{-}02\\le s&lt;t\\} \\right]. \\]

這裡使用 close-to-close squared returns；不是把需要 intraday data 的研究成果直接冒充成免費 daily RV 的成果。

**為什麼 median 合理？** 它定義「高於自身歷史常態的波動狀態」，不靠 outcome 選門檻，也不要求估計報酬預測係數。

**為什麼主要測 P(dd5)？** 在 drift 與 standardized return shape 沒有大幅反向改變的條件下，較高未來波動會提高固定跌幅障礙的觸及機率。這是 transfer 的機制假設；它不推導出 P(up) 必然下降，更不證明 P(up) 有 Brier skill。

### 我會如何使用這個 slot

我會把問題寫成：

> **保留 SMA200 與目前的 shrinking、eligibility、routing 規則，只以高 RV flag 替換 VIX≥30；primary endpoint 為 P(dd5)。**

同時報告相對 expanding base rate，以及相對**凍結的目前模型**之 paired Brier improvement。既然目前模型對 P(dd5) 已有題設中的正面結果，僅僅再次打敗 base rate，不足以證明這次替換值得採用。

這個設計也承認：你測的是「RV median regime 對比 VIX 固定高門檻」這個完整規格，不能把成功完全歸因於 realized 比 implied 更好。

## E-EC：新增的方向候選，但移植成本明顯

Hongye Guo 的 [*Earnings Extrapolation and Predictable Stock Market Returns*](https://academic.oup.com/rfs/article/38/6/1730/8101501?utm_source=chatgpt.com)，發表於 **2025-03-31**。其 broad US market 月度 forecasting exercise，在 **1926–2021** 的 OOS evaluation 中，Table 4 的 mean-centered 規格報告 **\\(R^2\_{\\mathrm{OS}}=3.60\\%\\)**，benchmark 是 expanding historical mean。原始市場報酬為 CRSP value-weighted **含股息**報酬。**等級：academic_oos；結果：positive，限月度 expected return。** [academic.oup.com](http://academic.oup.com)

這不是單純把你已排除的月份季節性重新命名：它的方向取決於**過去 newsy-month returns 與未來月份類型的互動**。但是，文獻採用歷史資料中的 recursive OOS，尚不是發表後的獨立驗證。

### 可預註冊的單一旗標

以下是我提出的日頻版本，**none；未檢驗**：

1. **Newsy months** 固定為 **January、April、July、October**。
2. \\(A_t\\)：最近四個已完整結束的 newsy months，其 S&amp;P 500 PRICE 月度 simple returns 加總。只在完整月度收盤已知後更新。
3. \\(Z_t=A_t-\\bar A_t\\)，其中 \\(\\bar A_t\\) 是自題設起點以來、已知月末 \\(A\\) 值的 expanding mean。這個 cut 表示消息相對歷史常態偏強或偏弱。
4. 取 \\(t\\) 之後的 **21 個 Monday–Friday 日期**，固定忽略所有交易所假日，記為 \\(B\_{21}(t)\\)。這是完全可事前生成的 calendar proxy。
5. 定義：

\\[ K_t=\\sum\_{d\\in B\_{21}(t)} \\left[1-2\\,\\mathbf1\\{\\operatorname{month}(d)\\in \\{\\mathrm{Jan,Apr,Jul,Oct}\\}\\}\\right], \\]\\[ F\_{\\mathrm{EC},t}=\\mathbf1[Z_tK_t&lt;0]. \\]

這是一個 bearish flag：歷史消息偏強，而未來窗口主要落在應 reversal 的月份；或歷史消息偏弱，而未來窗口主要落在應 continuation 的月份。

**最重要的缺口**是：這個日頻版本假設月份效果可以按未來窗口中的日期占比移植。實際 earnings news 未必均勻分布，兩種月份的效果幅度也未必對稱。上表雖有足夠 episodes，很多段落只是日曆切換，並不代表同樣數目的獨立經濟衝擊。

若你只願意使用已直接驗證 **P(up)**、而非由 expected-return evidence 移植的候選，這個 slot 應繼續保留。

## E-SKEW：有相關 OOS，但符號與常見解讀相反

Bevilacqua、Tunaru 的 [*The SKEW index: Extracting what has been left*，作者全文](https://livrepository.liverpool.ac.uk/3179596/1/SKEW_Index_JFS_Final.pdf?utm_source=chatgpt.com)，刊於 **2021-04**。我已讀取全文，並非只看摘要。

作者以 OptionMetrics 重建 total SKEW，採用 Cboe 的 transformation；在 **1996–2005** 訓練、**2006–2017** OOS evaluation 中，Table 10 的 total SKEW 對下一個月「terminal market loss 至少 **5%**」指標，報告 **\\(R^2\_{\\mathrm{OS}}=1.30\\%\\)**，相對的是 **AR benchmark**，Clark–West 僅達 **10%** significance。**等級：academic_oos；結果：positive。**

但有幾個限制直接影響排名：

- 原文月度關係是 **SKEW 越低，後續下跌機率越高**；所以不能事前寫成「高 SKEW 危險」，之後再翻方向。
- 原文加入其他 tail-risk controls 後，total SKEW 的月度係數不顯著。**這項另外的結果：academic_is；null。**
- 免費官方 SKEW 是合理 proxy，但原文沒有驗證它與重建 total SKEW 逐日相同。
- Terminal loss 與你的「窗口內任一收盤跌破起點障礙」不同；對 AR 的改善也不是對你的 expanding base rate 或現行模型的改善。

因此，我保留這個候選，但不會把原文較強的 bespoke **SKEW−** 結果套在免費 headline SKEW 上，也不會現在就優先測它。

# 2. 排除名單

下表的 feature counts，沿用前述 **2026-10-27 查核、1992-01-02—2026-09-25 窗口、D-price／D-VIX**。標示 **none** 的項目，意思是本次未找到符合要求的檢驗，**不等於研究已證明 null**。


| 想法                                                  | 本輪判定與證據                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **距離 52-week high 至少下跌 10%**                        | **不占 slot。** 用 rolling **252 交易日**高點定義，nEff **77.1**、episodes **20**，但 true 時 **88.6%** 已低於 SMA200。Goyal–Welch–Zafirov 的 **2024** [*A Comprehensive 2022 Look at the Empirical Performance of Equity Premium Prediction*](https://www.ivo-welch.org/research/journalcopy/goyal2024comprehensive.pdf?utm_source=chatgpt.com)，延伸至 **2021** 的檢驗不支持把單一 high-anchor predictor 當成穩健月度方向來源。**independently\_tested；negative**，但不是對這個精確 binary P(dd5) flag 的直接否證。                                             |
| **12-month absolute momentum sign**                 | **不重新占方向 slot。** 以 **252 交易日**為 proxy，nEff **81.8**、episodes **19**，true 時 **79.4%** 低於 SMA200。Huang et al.，**2020-03**，[*Time series momentum: Is it there?*](https://down.aefweb.net/WorkingPapers/w717.pdf?utm_source=chatgpt.com)：S&amp;P 500 futures 下一個月報酬，OOS **2000-01—2015-12**、**192 個月**，\\(R^2\_{\\mathrm{OS}}=-1.78\\%\\)。**academic\_oos；negative**；不是此 binary flag 的直接測試。                                                                                                              |
| **Dispersion／Cboe ICJ、JCJ、KCJ implied correlation** | **資料條件不過。** Cboe 的 [**2009 methodology**](https://cdn.cboe.com/resources/indices/documents/impliedcorrelationindicator.pdf?utm_source=chatgpt.com) 所列回算起點為 **2007-01-03**，且這些 ticker 不是一條固定 near-month maturity 序列。若改做 realized dispersion，還需要 point-in-time constituents／stock returns。**none；未核實符合要求的免費長歷史與目標 OOS。**                                                                                                                                                                                |
| **Index-level earnings-revision momentum**          | **資料條件未過。** [LSEG I/B/E/S](https://www.lseg.com/en/data-catalogue/company-data/ibes-estimates/broker-estimates?utm_source=chatgpt.com) 有長期商業資料，但本次未核實免費、daily／weekly、point-in-time 的 aggregate revision history。Cross-sectional stock-selection evidence 不能補足 aggregate index direction 的證據。**none；未找到合格組合。**                                                                                                                                                                                         |
| **Fed easing／tightening cycle**                     | **不占 slot。** [Durham，**2001-10**](https://www.federalreserve.gov/pubs/feds/2001/200142/200142pap.pdf?utm_source=chatgpt.com) 的 monthly／quarterly 分析不能直接當成這個 cycle flag 的逐期 OOS probability validation；降息同時反映政策反應與壞消息。**none；未找到符合你定義的 OOS 證據。**                                                                                                                                                                                                                                                       |
| **Dollar trend**                                    | **不占 slot。** [FRED `DTWEXM`](https://fred.stlouisfed.org/series/DTWEXM?utm_source=chatgpt.com) 提供歷史資料，但本次未找到可核實、符合期限的 broad-US-index OOS 結果，足以支持單一 dollar-trend flag；出口／海外盈餘與避險需求機制亦可能反向。**none；未找到合格檢驗。**                                                                                                                                                                                                                                                                                            |
| **Oil shock／oil-price increase**                    | **暫不占 slot。** Pönkä，[*Real oil prices and the international sign predictability of stock returns*](https://mpra.ub.uni-muenchen.de/68330/1/MPRA_paper_68330.pdf?utm_source=chatgpt.com)，**2015-12-11 working paper／2016 發表**，美國市場 excess-return 方向的 OOS **1995-01—2010-12**、**192 個月**：不含 oil 的 AUC **0.573**，加入 positive oil-return component 後 **0.564**。**academic\_oos；negative，指增量點估計**；不聲稱差異顯著，也不是對 PRICE-index Brier score 的直接測試。                                                              |
| **Aggregate insider buying**                        | **不占 slot。** Knewtson–Sias–Whidbee，**2010**，[*Style Timing with Insiders*](https://www.ivey.uwo.ca/media/3775517/style_timing_with_insiders.pdf?utm_source=chatgpt.com)，held-out **2004-07—2009-09**、**63 個月**，aggregate market-return prediction 未成立；style timing 是另一目標。**academic\_oos；null。** 免費 [SEC structured insider data](https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets?utm_source=chatgpt.com) 又僅自 **2006-01** 開始。                                       |
| **IPO／issuance volume**                             | **不占 slot。** [Ritter 的 IPO 資料](https://site.warrington.ufl.edu/ritter/ipo-data/?utm_source=chatgpt.com)可作資料來源，但不能把 IPO 長期表現或 hot-market 描述當成 market timing。較接近 aggregate issuance 的 RSZ **2010** [研究](https://didattica.unibocconi.it/mypage/dwload.php?nomefile=Rapach_Strauss_and_Zhou_RFS_200920200301133941.pdf&utm_source=chatgpt.com)，OOS **1965Q1—2005Q4** 的 net equity issuance 個別 predictor，季度 equity-premium \\(R^2\_{\\mathrm{OS}}=-0.91\\%\\)。**academic\_oos；negative**，且此結果不是 IPO 數量旗標。 |
| **Margin debt growth**                              | **資料條件不過。** [FINRA 官方 margin statistics](https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics?utm_source=chatgpt.com) 自 **1997-01** 開始，而且是月頻、有發布延遲；把月值每日 forward-fill 不會產生 daily／weekly 資訊。**none；未達資料門檻。**                                                                                                                                                                                                                                                              |
| **Aggregate short interest**                        | **有值得尊重的正面證據，但本輪資料條件不過。** GWZ **2024** [獨立更新](https://www.ivo-welch.org/research/journalcopy/goyal2024comprehensive.pdf?utm_source=chatgpt.com)仍有正面月度 OOS 結果：**independently\_tested；positive**。然而 [作者免費 `SII`](https://sites.google.com/site/ringgenberghomepage/data?utm_source=chatgpt.com) 是 **1973-01—2021-12 的月頻**，不是你要求的長期 daily／weekly 可持續序列。                                                                                                                                                 |
| **Time since last 5% drawdown**                     | **不占 slot。** 本次查核未找到符合要求的 OOS hazard evidence；「很久沒跌」本身沒有被驗證的風險方向，也容易重複低 RV 狀態。**none；未找到合格檢驗。**                                                                                                                                                                                                                                                                                                                                                                                                       |


**Oil 的正面反證也應保留。** Wang et al.，**2019-05**，[*Oil price increases and the predictability of equity premium*](https://www.sciencedirect.com/science/article/pii/S0378426619300640?utm_source=chatgpt.com)，報告正面月度 OOS：**academic_oos；positive，作者報告**。但這篇的**全文未核實**：我僅讀到出版社搜尋索引中的摘要／導言，全文存取失敗；其 continuous predictor 與預測限制也不能直接等同事前固定的 binary flag。因此，它不足以推翻本輪的 defer 決定。

# 3. a — 跨國 pooling：方法可行，資料前提要縮小

## 有誰做過？有沒有 OOS 支持？

有直接的學術先例。Hjalmarsson 的 [*Predicting Global Stock Returns*](https://www.federalreserve.gov/Pubs/ifdp/2008/933/ifdp933.htm?utm_source=chatgpt.com)，**2008-06**，使用 **40 個市場、其中 24 個 developed markets** 的月度資料，直接比較 country-specific 與 pooled predictive regressions。

例如 Table 5 的美國 short-rate predictor，完整資料區間為 **1952-01—2004-05**，先用 **20 年**初始化，再做 recursive OOS；美國單獨估計的 \\(R^2\_{\\mathrm{OS}}\\) 為 **−1.134%**，pooled estimate 為 **+0.902%**。**等級：academic_oos；結果：positive，限該 pooling／expected-excess-return 設定。** 這是 pooling 的方法證據，不是重新推薦利率輸入。原研究用商業 GFD 資料，也不是免費 daily panel 的證明。 [federalreserve.gov](http://federalreserve.gov)

## 免費資料：目前核實的是較小 panel

以下為 **2026-10-27** 實際讀取每日非空 `close` 的首筆日期；所有連結都是本次讀取的資料供應商原始端點：


| 市場  | Exact series ID／原始 URL                                                                                                         | 首筆 daily close |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| 美國  | [`^GSPC`](https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=-1325635200&period2=1793059200&interval=1d)        | **1927-12-30** |
| 英國  | [`^FTSE`](https://query1.finance.yahoo.com/v8/finance/chart/%5EFTSE?period1=-1325635200&period2=1793059200&interval=1d)        | **1984-01-03** |
| 法國  | [`^FCHI`](https://query1.finance.yahoo.com/v8/finance/chart/%5EFCHI?period1=-1325635200&period2=1793059200&interval=1d)        | **1990-03-01** |
| 瑞士  | [`^SSMI`，SMI PR](https://query1.finance.yahoo.com/v8/finance/chart/%5ESSMI?period1=-1325635200&period2=1793059200&interval=1d) | **1990-11-09** |
| 日本  | [`^N225`](https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=-1325635200&period2=1793059200&interval=1d)        | **1965-01-05** |
| 澳洲  | [`^AORD`](https://query1.finance.yahoo.com/v8/finance/chart/%5EAORD?period1=-1325635200&period2=1793059200&interval=1d)        | **1984-08-03** |
| 加拿大 | [`^GSPTSE`](https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPTSE?period1=-1325635200&period2=1793059200&interval=1d)    | **1979-06-29** |
| 香港  | [`^HSI`](https://query1.finance.yahoo.com/v8/finance/chart/%5EHSI?period1=-1325635200&period2=1793059200&interval=1d)          | **1986-12-31** |
| 新加坡 | [`^STI`](https://query1.finance.yahoo.com/v8/finance/chart/%5ESTI?period1=-1325635200&period2=1793059200&interval=1d)          | **1987-12-28** |


因此，本次核實的是含美國 **9 個市場**，其中 **7 個**在 **1990-01-02** 已有 coverage；這些數目由上表直接計算。這不是完整 point-in-time quality audit，也不是其他免費來源不存在的證明。

最容易混入的問題是德國：長歷史 [`^GDAXI`](https://query1.finance.yahoo.com/v8/finance/chart/%5EGDAXI?period1=-1325635200&period2=1793059200&interval=1d) 是 DAX performance index；真正 PRICE 版 [`^GDAXIP`](https://query1.finance.yahoo.com/v8/finance/chart/%5EGDAXIP?period1=-1325635200&period2=1793059200&interval=1d) 在這次免費來源中只讀到 **2013-03-05** 起。STOXX 官方也明確區分 [DAX](https://stoxx.com/index/DAX/?utm_source=chatgpt.com) 的股息再投資版本與 [DAXK](https://stoxx.com/index/DAXK/?utm_source=chatgpt.com) 的 Price Return 版本。查核日同為 **2026-10-27**。 [STOXX](https://stoxx.com/index/DAX/?utm_source=chatgpt.com)

## 我會怎麼 shrink

我會 shrink **相對各國自身 base rate 的 effect**，保留美國自己的 baseline：

\\[ \\delta\_{c,t} = \\operatorname{logit}P_c(Y=1\\mid F=1) - \\operatorname{logit}p\_{\\mathrm{base},c,t}. \\]

先用不含美國的其他市場，建立固定權重的 \\(\\bar\\delta\_{\\mathrm{foreign},t}\\)，再轉成美國 prior center：

\\[ p\_{\\mathrm{prior,US},t} = \\operatorname{logit}^{-1} \\left[ \\operatorname{logit}p\_{\\mathrm{base,US},t} +\\bar\\delta\_{\\mathrm{foreign},t} \\right]. \\]

之後才把美國自己的 conditional estimate 向這個中心 shrink。這是建議的設計，**none；尚未驗證你的 binary targets**。不要把 Hjalmarsson 的 full pooling 結果，直接說成這個特定 hierarchical probability model 已有 OOS 成功。

需要預先處理的問題：

- **共同危機不能重複算成獨立證據。** Walk-forward 按 calendar time 切分；bootstrap 應共同抽取各國相同的時間區塊，保留跨國危機相關性。
- **Foreign prior 必須真正排除美國。** 否則美國資料先進 panel、再進本國 likelihood，會被重複使用。
- **所有 training labels 必須成熟。** 在某個美國預測日，只能使用當時已完整走完預測窗的海外 outcomes。
- **統一 PRICE 與貨幣定義。** 我會以各國 local-currency PRICE return 估計 effect；外國 USD return 額外包含 FX，不是同一條件的乾淨移植。
- **不同 VIX equivalent 不宜直接套相同絕對門檻。** 歷史起點、options universe、期限與方法不同。Local RV 相對自身 expanding median 較容易統一，但 universal effect 仍需檢驗。
- **跨國異質性可能使 shrink 變差。** 產業集中、政策制度、流動性與市場結構不同；應保留 US-only benchmark，讓 pooled prior 接受真正的美國 OOS 評分。

我的實作偏好是先用已核實的小 panel，而不是先假設完整的大 panel 已經存在。

# 4. b — Risk-neutral probability 如何轉成 physical probability？

## VIX 本身不足以給出 options-implied P(up)

在 Black–Scholes／lognormal 假設下，才有：

\\[ Q(S_T&gt;S_t) = \\Phi\\!\\left( \\frac{(r_f-d-\\sigma_Q^2/2)\\sqrt T}{\\sigma_Q} \\right), \\]

其中 \\(d\\) 是 dividend yield。把 VIX 當成 \\(\\sigma_Q\\) 代入，是**模型近似**；完整的 risk-neutral terminal distribution 需要 option smile／不同 strikes 的資訊。

Malz 的 [*A Simple and Reliable Way to Compute Option-Based Risk-Neutral Distributions*](https://www.newyorkfed.org/medialibrary/media/research/staff_reports/sr677.pdf?utm_source=chatgpt.com)，**2014-06**，正是從 option prices 建構 \\(Q\\)-distribution 的實務方法。它本身不驗證轉成 \\(P\\) 後能打敗你的方向 base rate。 [newyorkfed.org](http://newyorkfed.org)

## 可核實的轉換方式

### Risk-aversion adjustment

一般關係是：

\\[ q_t(s)\\propto m_t(s)f_t(s), \\]

所以 physical density \\(f_t\\) 需要 pricing kernel \\(m_t\\) 的額外假設。若採 representative-agent CRRA，並將 terminal index wealth 作為財富 proxy：

\\[ f_t(s) = \\frac{s^\\gamma q_t(s)} {\\int z^\\gamma q_t(z)\\,dz}. \\]

這是 Bliss–Panigirtzoglou 類方法的核心；不是無模型、唯一的轉換。其 [*Option-Implied Risk Aversion Estimates*，**2003-03 revised working paper／2004 發表**](https://www.chicagofed.org/-/media/publications/working-papers/2001/wp2001-15r3-pdf.pdf?utm_source=chatgpt.com) 有 utility-adjusted density fit 的正面結果，但不能當成你要求的 chronological OOS binary-probability 勝利。**等級：academic_is；結果：positive，限校準／distribution-fit 結果。** [Bliss-Panigirtzoglou #2 v12.doc](https://www.chicagofed.org/-/media/publications/working-papers/2001/wp2001-15r3-pdf.pdf?utm_source=chatgpt.com)

### 歷史 PIT calibration

較少結構假設的方式，是用過去已成熟預測的 PIT：

\\[ u_i=F^Q_i(S\_{i+T}), \\]

估計其歷史分布 \\(H_t\\)，再做：

\\[ F^P_t(s)=H_t(F^Q_t(s)). \\]

實作可用 parametric beta calibration，或經平滑的 nonparametric calibration。必要條件是 \\(H_t\\) 只能使用當時已知的 realized outcomes；不能用全樣本校準後再稱為 OOS。

### 更簡單的 drift replacement

若接受 lognormal approximation，也可以直接用 physical drift 與 physical volatility：

\\[ P(S_T&gt;S_t) = \\Phi\\!\\left( \\frac{(\\mu\_{\\mathrm{price}}-\\sigma_P^2/2)\\sqrt T} {\\sigma_P} \\right). \\]

這容易做，但短期 \\(\\mu\\) 的估計誤差會直接進入 P(up)。它不是「VIX 加上一個固定修正」就能產生已驗證的實體機率。

## 轉完真的比較準嗎？

有接近期限的正面證據，但沒有完成你要求的那個比較。

Shackleton、Taylor、Yu 的 [*A multi-horizon comparison of density forecasts for the S&amp;P 500 using index returns and option prices*](https://eprints.lancs.ac.uk/id/eprint/45542/1/10.pdf)，**2010 發表**，在 **1991-01—2004-12** 的 OOS 中比較 transformed option-implied densities 與 return-based ARCH densities；**四週 horizon 有 176 個 non-overlapping forecasts**，轉換後的 option-based densities 有正面表現。研究標的是 **S&amp;P 500 futures**。**等級：academic_oos；結果：positive，限 density forecasting 相對 ARCH。** [Lancaster EPrints](https://eprints.lancs.ac.uk/id/eprint/45542/?utm_source=chatgpt.com)

**我未核實到它證明「S&amp;P 500 PRICE 的月度 P(up)，Brier score 優於 expanding historical up-rate」。這個特定主張是 none；未找到合格檢驗。**

此外，即使 terminal density 完全正確，也不能單靠它識別你的 P(dd5)：中途是否碰到障礙，需要 joint path dynamics。

# 5. c — 弱 binary flags 如何組合？

**在你這種樣本規模，我會先用已 shrink 的 component probabilities 做固定 arithmetic average，作為組合方法的基準。** 這是控制估計誤差的選擇，不是聲稱它已在你的設定勝出。

\\[ p\_{\\mathrm{comb},t} = \\frac{1}{K}\\sum\_{j=1}^{K}\\tilde p\_{j,t}. \\]

每個 \\(\\tilde p_j\\) 仍使用你的 shrink 與資格規則；該 component 不適用時，按事前規則回到 base rate。不要看到哪些旗標亮起，才臨時改變模型權重。


| 方法                                           | 有何證據／限制                                                                            | 我對你設定的判斷                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Arithmetic probability pool**              | 有 forecast-combination 的 OOS 支持，但主要是 expected return 或 density，並非你的少數 binary flags | 最適合做事前固定的 benchmark；精確設定的 predictive claim 為 **none；未檢驗** |
| **Equal-weight log-odds**                    | 本次未找到與你期限、目標、旗標數相符的優勢證據；它與 arithmetic pool 對極端機率的處理不同                              | 可預先選定，但沒有依據說它更準：**none；未找到合格比較**                          |
| **Product of likelihood ratios，加 shrinkage** | 需要事件條件下及非事件條件下的 conditional independence；SMA、RV、VIX 很難自然滿足                         | 相關旗標容易重複計算證據：**none；未找到你的設定下的合格 OOS 優勢**                  |
| **Bayesian model averaging**                 | 有真正 OOS 研究，也有美國月度負面結果；模型與 prior 不會自動解決弱訊號                                          | 不會為目前規模優先增加這層估計                                           |


### 正面與負面證據

**Arithmetic combinations 的正面例子。** Rapach、Strauss、Zhou 的 [*Out-of-Sample Equity Premium Prediction: Combination Forecasts and Links to the Real Economy*](https://didattica.unibocconi.it/mypage/dwload.php?nomefile=Rapach_Strauss_and_Zhou_RFS_200920200301133941.pdf&utm_source=chatgpt.com)，**2010-02**，Table 1 的 **1965Q1—2005Q4** OOS，mean combination 的 \\(R^2\_{\\mathrm{OS}}\\) 為 **3.58%**，相對 historical-average benchmark。**等級：academic_oos；結果：positive。** 但這是**季度 S&amp;P 500 equity premium、較多 continuous predictors**；不能把它改稱已驗證月度 binary probability averaging。本文月頻結果僅稱可向作者索取，並非我已核實的公開表格。

**更直接的 probability-distribution pooling 證據。** Gneiting–Ranjan 的 [*Combining Predictive Distributions*，**2011 working paper**](https://arxiv.org/pdf/1106.1638?utm_source=chatgpt.com)，包含 S&amp;P 500 **日頻 density** 的 OOS combination exercise；支持資料不足時以 parsimonious linear pool 作為重要基準。**等級：academic_oos；結果：positive，但期限是日頻。** [arxiv.org](http://arxiv.org)

**BMA 的負面例子。** Schrimpf 的 [*International Stock Return Predictability Under Model Uncertainty*，**2008-07-08**](https://ftp.zew.de/pub/zew-docs/dp/dp08048.pdf?utm_source=chatgpt.com)，美國資料為 **1958–2005**，先用 **十年**初始化，再做 recursive monthly OOS。Table 8 的 BMA Theil’s U 為 **1.0009**，沒有優於 historical-mean benchmark。**等級：academic_oos；結果：negative，指該美國月度設定。** [ftp.zew.de](http://ftp.zew.de)

也有後續反證：Denk–Löffler 的 [*Predicting the Equity Premium with Combination Forecasts: A Reappraisal*，**2024-04-10**](https://academic.oup.com/raps/article-abstract/14/4/545/7643730?utm_source=chatgpt.com)，報告較近期缺乏組合預測能力。**independently_tested；null，作者報告。全文未核實**：我讀到出版社索引中的摘要，全文存取失敗，因此不引用未讀到的表格數字。

### 為什麼我不優先乘 likelihood ratios？

如果所有 component posteriors 共用同一個 prior，即使 conditional independence 成立，也應是：

\\[ \\operatorname{logit}p\_{\\mathrm{joint}} = \\sum_j\\operatorname{logit}p_j -(K-1)\\operatorname{logit}p\_{\\mathrm{base}}, \\]

而不是直接相乘 posterior odds。否則連 prior 都會重複計算；修正 prior 後，相關旗標的 evidence duplication 仍然存在。

Arithmetic average 有一個純數學性質：

\\[ \\left(\\frac{1}{K}\\sum_jp_j-y\\right)^2 \\le \\frac{1}{K}\\sum_j(p_j-y)^2. \\]

所以它的 Brier loss 不高於 component losses 的平均；**這不保證勝過最佳 component，更不保證勝過 base rate**。

我也不會在 RV slot 裡同時更換 combination method。否則成功之後，很難辨認是哪一項改動帶來改善。

# 6. d — 有沒有可靠、實質低於題設上漲 base rate，甚至低於你的門檻的條件？

**本次沒有找到能同時核實以下要求的條件：**

即時可觀察、事前固定的 flag；相同的 S&amp;P 500 PRICE 方向目標；相近預測期限；逐期 OOS；並且報告 true-side 的 realized up-frequency 與樣本數，足以支持你所問的 **P(up)&lt;55%**。

這個結論是 **none；未找到合格證據**，不是「已證明不存在」。

容易被誤讀成答案的兩種結果如下：


| 看似接近的證據                                                                                                                                                                                                                                                                                                                                   | 等級與結果                                               | 為什麼不能填入你的合格條件清單？                                                                                   | 所需的 OOS true-side \\(n\\)                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Christoffersen–Diebold，[*Financial Asset Returns, Direction-of-Change Forecasting, and Volatility Dynamics*，**2003-09-22 working paper／2006 發表**](https://rodneywhitecenter.wharton.upenn.edu/wp-content/uploads/2014/04/0405.pdf?utm_source=chatgpt.com)：以舊 VIX 等資訊建立方向模型，**1986-01-02—2003-05-15** 的 fitted probabilities 約 **51%–72%** | **academic\_is；positive**                           | 是 **S&amp;P 100、約月度 excess return** 的 fitted probability range；不是事前固定低機率旗標的 OOS realized frequency | **未報告符合此問題的 \\(n\\)**                          |
| Guo，前述 **2025** [研究](https://academic.oup.com/rfs/article/38/6/1730/8101501?utm_source=chatgpt.com)：某些狀態的 expected return 可以為負                                                                                                                                                                                                            | **academic\_oos；positive，限 mean-return prediction** | \\(E\[R\\mid F\]&lt;0\\) 不推出 \\(P(R&gt;0\\mid F)&lt;55\\%\\)；負均值可能來自少數大跌                           | **未報告符合此 threshold 的 OOS conditional \\(n\\)** |


因此，若日後某個旗標真的顯示較低 P(up)，我會要求報告的是：**該旗標為 true 的完整 OOS origins、實際上漲比例、保留時間相依性的信賴區間，以及相對 expanding base rate 的 paired Brier improvement**。不能用平均報酬為負、模型輸出的低機率、或分類器整體 hit rate，代替這些量。