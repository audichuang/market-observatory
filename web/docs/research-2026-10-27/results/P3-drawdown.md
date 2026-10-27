**我會優先改善「volatility → 每日收盤觸及門檻機率」的映射與校準，再考慮增加 predictor。** 已找到的樣本外研究，主要支持預測 future realized volatility 或期末 VaR；能直接支持你這個 **S&amp;P 500 PRICE index、以今天為固定基準、期間內任何一次收盤跌破門檻** 的證據少得多。

我也另外做了可重現的歷史試算。結果值得保留，但沒有足夠證據宣稱新基準勝過你的現有模型：校正過的 volatility baseline 有正的 BSS 點估計，信賴區間仍跨過零。

**查核日期：2026-10-27。** 以下 `positive / null / negative` 都是相對於該研究自己的比較基準；`none` 表示未找到相符的可核實測試，**不等於統計上的 null**。你指定的門檻、期限及既有模型結果視為使用者提供的設定，其他數字均附樣本日期與來源。

## 1. 預測變數：哪些證據真的適用？

### 證據表


| 預測變數                                      | 定義                                                                                                                                 | 免費資料源與起始年                                                                                                                                                                                               | 期限                                                          | 證據等級                                                          | 效果大小                                                                                                                                                                    | 備註                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Realized volatility／HAR-RV**            | 用 daily、weekly、monthly realized volatility 的不同平均值預測 future RV                                                                      | [Yahoo `^GSPC`](https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=-631152000&period2=1767225600&interval=1d)，1950 起的 close 可做 proxy；不能完整複製原文 intraday RV                                | Corsi 原文測 daily、weekly、**two-week**，不是直接測你的 monthly barrier | **academic\_oos；positive，對 RV**                               | S&amp;P 500 futures，1990-01–2007-07；rolling OOS 的 two-week RMSE：AR(3) **4.381 → HAR 3.539**，為原表單位                                                                       | *A Simple Approximate Long-Memory Model of Realized Volatility*，2009-02-19。[全文](https://statmath.wu.ac.at/~hauser/LVs/FinEtricsQF/References/Corsi2009JFinEtrics_LMmodelRealizedVola?utm_source=chatgpt.com)。沒有提供 P(dd5) 的 probability-point 或 BSS 改善。[statmath.wu.ac.at](http://statmath.wu.ac.at)                                                                                  |
| **VIX level**                             | 用 option-implied variance 資訊預測 future volatility／return distribution                                                               | [Cboe VIX CSV](https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv)，**1990-01-02** 起                                                                                                | **20 trading days，期末 VaR**                                  | **academic\_oos；positive，對 terminal VaR**                     | Louzis 等，樣本 1997–2009，OOS **2000-12-20–2009-09-30**；nominal **5% tail VaR** 的 exception rate：VIX 模型 **5.97%**，RV 模型 **7.21%**                                           | 這裡的「5%」是 VaR tail probability，並非跌幅。模型為 Realized GARCH、非對稱分布與 simulation，不能解讀成 raw VIX Gaussian baseline 已獲驗證。[2011-10-29 working paper](https://mpra.ub.uni-muenchen.de/35252/1/MPRA_paper_35252.pdf?utm_source=chatgpt.com)，後於 2013 發表。[mpra.ub.uni-muenchen.de](http://mpra.ub.uni-muenchen.de)                                                                                    |
| **VIX changes／jumps**                     | 研究使用從 VIX 估出的 time-varying jump intensity；不只是簡單的 ΔVIX                                                                              | 同上，VIX history 自 **1990**                                                                                                                                                                               | **22 trading days，future RV**                               | **academic\_oos；positive，對 monthly RV**                       | Dutta–Das，總樣本 **2000-01–2020-06**，OOS **2018-07–2020-06**；monthly RMSE：HAR-RV **0.000302 → 0.000296**，加入 jump intensity 後改善                                             | *Forecasting realized volatility: New evidence from time-varying jumps in VIX*，**2022-08-04**。[全文](https://onlinelibrary.wiley.com/doi/full/10.1002/fut.22372?utm_source=chatgpt.com)。OOS 短且包含 pandemic；沒有測 P(dd5)。[Wiley Online Library](https://onlinelibrary.wiley.com/doi/full/10.1002/fut.22372?utm_source=chatgpt.com)                                                         |
| **VVIX**                                  | VVIX 衡量 VIX 的 implied volatility；相關研究使用 **ΔVVIX**                                                                                  | [Cboe VVIX CSV](https://cdn.cboe.com/api/global/us_indices/daily_prices/VVIX_History.csv)，**2006-03-06** 起，早期有缺日                                                                                        | **One-day，S&amp;P 500 terminal VaR**                        | **academic\_oos；positive（未含 VIX）；null（控制 VIX 後的增額 accuracy）** | 樣本 **2007-01-03–2019-06-25**，OOS **2015-01-02–2019-06-25**。Student-t、99% VaR：加入 ΔVVIX，LR conditional-coverage statistic **8.718 → 3.269**；但已含 ΔVIX 時為 **3.269 → 3.269** | Hung–Liu–Yang，*Does the tail risk index matter in forecasting downside risk?*，online **2022-02-07**。[全文](https://onlinelibrary.wiley.com/doi/10.1002/ijfe.2602?utm_source=chatgpt.com)。作者也指出控制 VIX 後，VVIX 的增額資訊很有限；部分 dynamic-quantile tests 仍拒絕模型。不能外推成 monthly VVIX level 的成功。[Wiley Online Library](https://onlinelibrary.wiley.com/doi/10.1002/ijfe.2602?utm_source=chatgpt.com) |
| **SKEW index**                            | option-implied、risk-neutral asymmetry 指標；上述研究測 **ΔSKEW**                                                                           | [Cboe SKEW CSV](https://cdn.cboe.com/api/global/us_indices/daily_prices/SKEW_History.csv)，**1990-01-02** 起的回溯序列                                                                                         | **One-day terminal VaR**；同上樣本與 OOS                          | **academic\_oos；null，對穩健的增額 coverage 改善**                     | 控制 ΔVIX 後，未見穩健新增 accuracy；沒有適用於你目標的 probability-point 或 BSS 效果大小                                                                                                        | 同一篇 **2022-02-07** [原文](https://onlinelibrary.wiley.com/doi/10.1002/ijfe.2602?utm_source=chatgpt.com)。這是日頻 **changes** 的結果，不能直接宣稱 monthly SKEW **level** 已被證偽。[Wiley Online Library](https://onlinelibrary.wiley.com/doi/10.1002/ijfe.2602?utm_source=chatgpt.com)                                                                                                                   |
| **Implied–realized gap**                  | 同單位的 VIX-implied variance 減 trailing realized variance                                                                             | VIX 與 close-return proxy 可共同覆蓋 **1990** 起；來源如上                                                                                                                                                          | 你的 **21-day fixed-barrier** 事件                              | **none；增額效果未建立**                                              | 未找到已核實、在 VIX／RV 之外改善此事件 OOS BSS 的效果大小                                                                                                                                   | backward-looking realized variance 不是 future physical expected variance，因此該 gap 不宜直接叫作精確的 ex-ante VRP。本次的 variance calibration 另列下節；它也不等於證明 gap 是有效新 predictor。                                                                                                                                                                                                                      |
| **Greenwood–Shleifer–You run-up**         | 依 Table 3：過去 **2 年** raw 與 net-of-market return 均至少 **100%**，過去 **5 年** raw return 至少 **50%**；另分析 acceleration、volatility change 等 | [Kenneth French industry portfolios](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/Data_Library/det_48_ind_port.html?utm_source=chatgpt.com)，**1926-07** 起；完整 firm-level issuance 等資料不能只靠此免費檔 | 未來 **2 年**內 **40% peak-to-trough drawdown**                 | **academic\_is；positive，美國樣本**                                | 美國 industry data **1926–2014**；**40** 個 run-up episodes，後續 crash 比例 **53%**，unconditional 約 **14%**                                                                     | *Bubbles for Fama*，online **2018-09-14**、2019 journal。[原文](https://www.hbs.edu/ris/Publication%20Files/Bubbles%20for%20Fama_e680848b-4f23-478a-b6cd-e5564e6a431b.pdf?utm_source=chatgpt.com)。是 industry portfolios、長期限、會移動的 peak；與你的事件有根本差異。[hbs.edu](http://hbs.edu)                                                                                                                |
| **Credit spreads**                        | 例如 Moody’s Baa yield 減 Treasury yield；`BAA10Y` 不是 OAS                                                                              | [FRED `BAA10Y`](https://fred.stlouisfed.org/data/BAA10Y?utm_source=chatgpt.com)，**1986-01-02** 起                                                                                                        | 你的 **21-day fixed-barrier** 事件                              | **none；增額效果未建立**                                              | 未找到符合此目標、控制 volatility／trend 後的可信 OOS 效果大小                                                                                                                              | 不把 recession、long-horizon crash 或 return-direction 的結果移植過來。免費 HY OAS 的完整歷史可得性也已改變，見下方。                                                                                                                                                                                                                                                                                               |
| **目前已處於 drawdown 的狀態**                    | \\(D\_t=S\_t/\\max\_{s\\le t}S\_s-1\\)，或預先指定 rolling peak                                                                          | close series 同上，Yahoo 自 **1950**；原始 S&amp;P 長期檔的限制見下節                                                                                                                                                   | 你的 **21-day fixed-current-price barrier**                   | **none；增額效果未建立**                                              | 未找到符合此定義的 OOS probability-point／BSS 結果                                                                                                                                  | 今天已距離舊高點很遠，不會機械性地讓「從今天再跌」的門檻更容易到達；可能有用的是其攜帶的 volatility／leverage／regime 資訊，須做 incremental test。                                                                                                                                                                                                                                                                                      |
| **首次大跌後的 volatility clustering／leverage** | 用負報酬及其不同期間累積量，預測 volatility 的持續與不對稱反應                                                                                              | close-only proxy 同上；原文 intraday futures RV 不等於免費 close 資料                                                                                                                                               | **1–22 trading days，future RV**                             | **academic\_oos；positive，對 RV**                               | Corsi–Renò：S&amp;P 500 futures **1982-04-28–2009-02-05**，expanding OOS；LHAR-CJ 相對 HAR／HAR-CJ 改善 volatility forecast loss；未報 P(dd5) 效果大小                                 | **2012-01-10 author version**，[全文](https://ssl.lu.usi.ch/entityws/Allegati/pdf_pub6476.pdf?utm_source=chatgpt.com)。研究排除了 **1987 crash week**。這不是「第一次大跌後再跌至固定門檻」的直接 event study。[ssl.lu.usi.ch](http://ssl.lu.usi.ch)                                                                                                                                                                 |


GSY 有值得保留的外部驗證，但範圍要說清楚：international sector sample **1985–2014** 中，**107** 個 run-up episodes 約 **50%** crash，unconditional 約 **24%**。我給 **academic_oos；positive**，限於作者的跨市場驗證，並非按時間 walk-forward 的廣泛美股月頻預測。另有反例：turnover 不能有效區分後來 crash 與未 crash 的 run-up，屬 **academic_is；null**。來源同上述 *Bubbles for Fama*。[hbs.edu](http://hbs.edu)

**資料可得性有兩個實務修正：**

- 截至 **2026-10-27**，[Oxford-Man Realized Library 官方頁](https://oxford-man.ox.ac.uk/research/realized-library/?utm_source=chatgpt.com)已表示關閉，不能再當作持續更新的免費 HAR-RV 資料源。[oxford-man.ox.ac.uk](http://oxford-man.ox.ac.uk)
- [FRED `BAMLH0A0HYM2`](https://fred.stlouisfed.org/series/BAMLH0A0HYM2?utm_source=chatgpt.com) 官方說明：自 **2026-04** 起，只提供 **3 年** observations。不能再無條件建議從 FRED 取得完整早期 HY OAS history。[St. Louis Fed](https://fred.stlouisfed.org/series/BAMLH0A0HYM2?utm_source=chatgpt.com)

此外，**history 起始日不代表當時已公開可用**。尤其早期 VIX 與其他 Cboe 回溯序列，會使長期 backtest 成為 reconstructed／pseudo-OOS，而非 archived real-time OOS。[Cboe historical data 說明](https://www.cboe.com/tradable-products/vix/vix-historical-data/?utm_source=chatgpt.com)。[cboe.com](http://cboe.com)

## 2. 應該打敗什麼 baseline？

### 2.1 先把事件定義鎖定

你的 label 是：

\\[ Y\_{t,H,d} = \\mathbf 1\\!\\left\\{ \\min\_{j=1,\\ldots,H}\\frac{S\_{t+j}}{S_t}\\le 1-d \\right\\}. \\]

它是 **discretely monitored、fixed-barrier first passage**。下列三件事需要分開：

- 期間內**任何一次收盤**跌到門檻；
- 期末報酬低於門檻；
- 從期間內某個新高點開始計算的 maximum drawdown。

這個區別也解釋了為什麼 P(dd5) 可能比 P(up) 容易預測：在 zero-log-drift Gaussian model 中，改變 volatility 不改變期末報酬正負的對稱性，卻會改變碰到下方門檻的機率。這是模型內的機制推論，尚未證明它就是你現有模型 skill 的全部來源。

### 2.2 Continuous-monitoring closed form：有，但不是你的 label

設

\\[ X_s=\\log(S\_{t+s}/S_t)=ms+\\sigma W_s,\\qquad b=\\log(1-d)&lt;0,\\qquad T=H/252. \\]

則

\\[ \\Pr\\!\\left(\\min\_{0\\le s\\le T}X_s\\le b\\right) = \\Phi\\!\\left(\\frac{b-mT}{\\sigma\\sqrt T}\\right) + \\exp\\!\\left(\\frac{2mb}{\\sigma^2}\\right) \\Phi\\!\\left(\\frac{b+mT}{\\sigma\\sqrt T}\\right). \\]

若 **log drift \\(m=0\\)**：

\\[ p\_{\\rm continuous} = 2\\Phi\\!\\left(\\frac{\\log(1-d)}{\\sigma\\sqrt T}\\right). \\]

若你說的「driftless GBM」是 **price drift 為零**，即 \\(dS/S=\\sigma dW\\)，則應使用 \\(m=-\\sigma^2/2\\)。兩者不可混稱。公式來源為 [Yibi Huang，2021，Brownian motion with drift／reflection principle 講義](https://www.stat.uchicago.edu/~yibi/teaching/stat317/2021/Lectures/Lecture25.pdf?utm_source=chatgpt.com)。[stat.uchicago.edu](http://stat.uchicago.edu)

**純理論示例，計算日 2026-10-27：**以你的期限與跌幅、annualized \\(\\sigma=20\\%\\)：


| 監測方式與 drift 假設                         | 觸及機率       |
| -------------------------------------- | ---------- |
| Continuous monitoring、zero log drift   | **37.43%** |
| Continuous monitoring、zero price drift | **38.40%** |
| 每日收盤監測、zero log drift，Monte Carlo      | **31.29%** |


這些是模型內計算，**不是歷史預測效果**；公式來源如上，計算程式與結果見文末試算包。

同一模型下，continuous monitoring 包含「盤中碰到、收盤未碰到」的路徑，所以其機率較高。要貼合你的 label，最直接的方法是模擬每日 log returns，**只檢查未來收盤點**；不要加上會補判盤中穿越的 Brownian bridge。

若要解析近似，可用 Broadie–Glasserman–Kou 的 continuity correction，把 downward log barrier 近似移至

\\[ b^*=b-0.5826\\,\\sigma\\sqrt{\\Delta t}, \\]

再套 continuous formula；它仍是近似。[原文，1997-10](https://www.columbia.edu/~sk75/mfBGK.pdf?utm_source=chatgpt.com)。[columbia.edu](http://columbia.edu)

### 2.3 VIX／HAR-RV 不能不經處理就變成 physical tail probability

**VIX 的問題是 measure 與期間。** 它提供 option-implied variance 資訊；把它代入 physical GBM，並不自動得到 calibrated physical probability。即使要稱為 option-implied probability，也需要對 drift、smile 與 path distribution 做更多假設。VIX 的 calendar-day 期限與你的 trading-day 期限亦只是近似對齊。[Cboe 說明](https://www.cboe.com/tradable-products/vix/vix-historical-data/?utm_source=chatgpt.com)及 [Minneapolis Fed，2015-01-07](https://www.minneapolisfed.org/-/media/files/banking/mpd/optimal_outlooks_dec22.pdf?utm_source=chatgpt.com)。[cboe.com](http://cboe.com)

**HAR-RV 的問題是識別不足。** 預測 future integrated variance，尚不足以唯一決定 first-passage probability。你還必須指定 variance 在期間內怎麼分布、是否有 leverage、jumps、fat tails。把 HAR 的預測值放進 constant-volatility Gaussian simulation 是合理的簡單 benchmark，但該 benchmark 的 tail calibration 仍須另測。

若 HAR 輸出已是整個預測期間的 integrated variance，不應再乘一次 horizon；若輸出 daily variance forecasts，才把相應期間加總。

### 2.4 有沒有已發表的「完全相同」比較？

我沒有找到已核實、直接比較下列組合的歷史校準研究：

> S&amp;P 500 PRICE index ＋ daily closes ＋ 以當前價格為固定基準 ＋ 你的期限與跌幅 ＋ raw VIX／HAR-RV first-passage baseline。

對這個精確比較，證據等級為 **none；結果未建立**。

相關方法文獻確實存在，例如 [*MaxVaR: Long-Horizon Value at Risk in a Mark-to-Market Environment*，2004](https://faculty.haas.berkeley.edu/stanton/abstracts.html?utm_source=chatgpt.com)。另有 [*Option-Implied Intrahorizon Value at Risk*，online 2019-07-03、journal 2020](https://pubsonline.informs.org/doi/10.1287/mnsc.2018.3157?utm_source=chatgpt.com)，但我只核實到出版社摘要，其研究使用 S&amp;P 100 options；**全文樣本與 backtest 細節未核實**，因此不把摘要中的效果當成你目標的驗證。[c02562fd-73e9-44ad-9034-0f7ecaacb94d.filesusr.com](http://c02562fd-73e9-44ad-9034-0f7ecaacb94d.filesusr.com)

### 2.5 本次自行重算：raw VIX baseline 校準如何？

**以下為 2026-10-27 的獨立試算，證據等級統一為** `independently_tested`**。** 這裡指本回答附程式重算、另行檢查計算，**不是已發表或外部第三方驗證**。

**資料限制先列清楚：**

- 價格固定截止 **2025-12-31**，實際讀取 [Yahoo `^GSPC` JSON](https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=-631152000&period2=1767225600&interval=1d) 與 [Cboe VIX 官方 CSV](https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv)。
- **長期價格資料對 S&amp;P 原始歷史檔：未核實。** 取得的是 Yahoo 分銷資料；與可取得的近期 [FRED `SP500`](https://fred.stlouisfed.org/series/SP500?utm_source=chatgpt.com) 區間交叉比對後，以 FRED 價格替換沒有改變本次門檻／期限組合的事件 labels，但這不等於全長歷史都經原始管理人確認。
- 預測起點為 **1992-01-02–2025-11-10**，最後 outcome 為 **2025-12-10**；每個 phase 約 **404–406** 筆，正例 **61–76** 筆。只用當時已成熟的 labels，保留交易日曆，不把 VIX 缺日壓縮成更短的 horizon。
- BSS 先在各 phase 計算，再平均。下表為 **95% stationary-block-bootstrap CI**，**2,000** 次重抽，平均 block 對應 **126 trading days**；未做候選模型多重比較校正。
- 所有 daily-close simulation 列均採 **zero log drift、預測期間內固定 volatility**。早期 VIX 回溯資料使此處屬 reconstructed OOS。

以上期間、方法、原始 URL 與完整結果均收錄於文末試算包。

評估區間的實際事件頻率為 **16.83%**：


| Baseline                                  | 平均預測機率 | BSS vs expanding base | 95% CI             | 結果                              |
| ----------------------------------------- | ------ | --------------------- | ------------------ | ------------------------------- |
| Expanding base                            | 14.72% | 0                     | —                  | 比較基準                            |
| Raw VIX，continuous，zero log drift         | 32.56% | −0.121                | \[−0.291, 0.005\]  | **null**；點估計負，且監測事件不符           |
| Raw VIX，continuous，zero price drift       | 33.39% | −0.143                | \[−0.323, −0.012\] | **negative**；監測事件不符的 diagnostic |
| Raw VIX，**daily closes**                  | 27.25% | −0.010                | \[−0.129, 0.080\]  | **null**                        |
| 以過往 realized variance 校正 VIX，daily closes | 19.03% | 0.064                 | \[−0.005, 0.125\]  | **null**；點估計正                   |
| Trailing close-based RV，daily closes      | 17.97% | 0.052                 | \[−0.029, 0.124\]  | **null**；點估計正                   |
| EWMA，daily closes                         | 18.66% | 0.056                 | \[−0.030, 0.131\]  | **null**；點估計正                   |


此表的 trailing RV 使用你指定期限長度的過往 squared log returns；EWMA 使用 RiskMetrics 的 daily \\(\\lambda=0.94\\)，但只把當前 volatility estimate 放入固定 volatility 的 forward simulation，沒有模擬未來動態更新。參數來源為 [RiskMetrics Technical Document，1996-12-17](https://www.msci.com/documents/10199/5915b101-4206-4ba0-aee2-3449d5c7e95a?utm_source=chatgpt.com)。[Fourth Edition 1996, December](https://www.msci.com/documents/10199/5915b101-4206-4ba0-aee2-3449d5c7e95a?utm_source=chatgpt.com)

VIX 校正使用的是簡單、僅依賴過往成熟資料的 variance ratio：

\\[ c_t^2 = \\frac{ \\sum\_{s:\\,s+H\\le t}\\sum\_{j=1}^{H}r\_{s+j}^{\\,2} }{ \\sum\_{s:\\,s+H\\le t}(VIX_s/100)^2H/252 }, \\qquad \\sigma_t=c_tVIX_t/100. \\]

這裡沒有用 binary crash labels 擬合校正係數；但它仍是一個需要驗證的模型設計。

**從這份試算可以支持的結論：**

- Raw VIX 加 continuous reflection formula 同時受到 **monitoring mismatch** 與 **physical-volatility calibration** 的影響；不能直接當成 dashboard 機率。
- 改為 daily closes 後，raw VIX 仍高估平均事件頻率。
- 校正 VIX、RV、EWMA 的點估計值得作為 challenger，但 **所有新增 daily-close baseline 的 BSS CI 都跨零**。
- 我沒有重建你現有 conditional model 的完全相同 implementation，因此不能拿這裡的點估計與你的 BSS 直接比大小，宣稱新模型勝出。
- 本次沒有把 close-only proxy 冒稱為原文 intraday HAR-RV；HAR 的直接 barrier backtest 仍待完成。

## 3. 銀行 risk desks 與 vendors 公開了什麼？

公開資料主要描述 **期末損益分布、VaR／ES、stress loss**。要得到你的 first-passage event，還需要建立整段路徑並在各收盤日檢查門檻。下表描述公開方法，不把產品說明當成 P(dd5) 的績效證據。


| 機構／文件日期                             | 可核實的公開方法                                                                                                                                                                                                                                             | 對本題的限制                                                                                                                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RiskMetrics，1996-12-17**          | EWMA covariance；daily dataset 的 \\(\\lambda=0.94\\)，monthly dataset 的 \\(\\lambda=0.97\\)；討論 square-root-of-time scaling 及其假設。[Technical Document](https://www.msci.com/documents/10199/5915b101-4206-4ba0-aee2-3449d5c7e95a?utm_source=chatgpt.com) | 是歷史公開方法，不代表今天銀行的完整 production model；volatility scaling 不等於 first-passage calibration。[Fourth Edition 1996, December](https://www.msci.com/documents/10199/5915b101-4206-4ba0-aee2-3449d5c7e95a?utm_source=chatgpt.com) |
| **MSCI Barra，2012-08**              | Factor covariance＋specific risk、exponential weighting、Volatility Regime Adjustment；利用標準化預測殘差調整風險水準。[官方方法文件](https://www.msci.com/documents/10199/8426a871-688b-4705-ae65-aee7c4c9a0c5?utm_source=chatgpt.com)                                        | 可讀到方法設計；未找到同一定義的 P(dd5) OOS calibration。[msci.com](http://msci.com)                                                                                                                                                    |
| **Axioma Trading Model，2026 官方文章**  | 目標約 **20 trading days** 的 risk forecast；展示不同危機時段的風險反應。[官方文章](https://www.simcorp.com/resources/insights/industry-articles/2026/When-markets-turn-turn-to-a-Trading-Model?utm_source=chatgpt.com)                                                     | 選定 stress-period 圖表不足以建立你的事件的 OOS skill；未取得可完整重現的 production 參數。[SimCorp](https://www.simcorp.com/resources/insights/industry-articles/2026/When-markets-turn-turn-to-a-Trading-Model?utm_source=chatgpt.com)          |
| **Bloomberg PORT，2015 white paper** | 可讀到的 Bloomberg-authored 文件包含 parametric、historical、Monte Carlo 方法，以及 factor covariance 的 EWMA／shrinkage。[文件鏡像](https://www.crescat.net/wp-content/uploads/CVaR-Whitepaper-Bloomberg.pdf?utm_source=chatgpt.com)                                      | **現行官方版本／設定未核實**：[官方頁](https://www.bloomberg.com/professional/insights/trading/predicting-value-at-risk-in-times-of-financial-crisis/)回傳 403；實際讀到的是舊白皮書鏡像，不能視為目前完整 PORT 設定。[crescat.net](http://crescat.net)           |


實際銀行揭露也常是更短期限。例如 JPMorgan 的 [**2025 Annual Report**](https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/investor-relations/documents/annualreport-2025.pdf?utm_source=chatgpt.com) 描述 risk-management VaR 使用先前 **12 個月**歷史資料、**one-day／95% confidence** 的方法；它並未公開一個可直接搬用的月內 S&amp;P 500 barrier probability。[jpmorganchase.com](http://jpmorganchase.com)

**Backtesting 對你的啟示：**

- Kupiec 檢查固定 nominal tail probability 的 exception coverage；Christoffersen 再檢查 exception dependence／conditional coverage。
- Basel 的公開框架包含 daily **99% VaR** backtesting，以及 **97.5% ES**、基礎 **10-day** horizon 的市場風險計量；這些是特定監管目的，不能當成你的機率已 calibrated 的證明。[MAR32，2020-03-27 公布](https://www.bis.org/committees/bcbs/basel-framework/standard/mar/32/inforce/2023-01-01/published/2020-03-27?utm_source=chatgpt.com)；[MAR33，2020-06-05 公布](https://www.bis.org/committees/bcbs/basel-framework/standard/mar/33/inforce/2023-01-01/published/2020-06-05?utm_source=chatgpt.com)。[Bank for International Settlements](https://www.bis.org/committees/bcbs/basel-framework/standard/mar/32/inforce/2023-01-01/published/2020-03-27?utm_source=chatgpt.com)
- 你的 \\(p_t\\) 本來就會變，重疊期間的 \\(Y_t\\) 也會聚集。因此應檢查 **\\(Y_t-p_t\\) 的 conditional calibration，並保留時間相依性**；不應要求原始事件序列看起來像固定機率的獨立 Bernoulli draws。

## 4. 其他門檻與期限：base rates 與 DCA 的取捨

以下是 **2026-10-27 重算、價格截止 2025-12-31** 的結果。事件定義保持相同：**相對起始日價格，期間內至少一次收盤跌至門檻**。

來源為前述 [Yahoo `^GSPC` 完整下載](https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=-631152000&period2=1767225600&interval=1d)；**對 S&amp;P 原始全長歷史檔未核實**。試算包有逐項 counts、截止起點及程式。


| 跌幅門檻    | 1950 起／21 trading days | 1990 起／21 trading days | 1950 起／63 trading days | 1990 起／63 trading days |
| ------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- |
| **3%**  | **31.17%**             | **32.60%**             | **50.36%**             | **50.33%**             |
| **5%**  | **15.18%**             | **16.78%**             | **32.02%**             | **31.93%**             |
| **10%** | **3.07%**              | **4.06%**              | **11.13%**             | **14.04%**             |


這些是 daily forecast origins 的頻率，**不是獨立 crash episodes 的比例**。另外，S&amp;P 官方資料指出指數於 **1957-03-04** launch；更早歷史屬 back-tested history，所以「1950 起」也不等於全段都是當時 live index。[S&amp;P 官方歷史文件，2023-01](https://www.spglobal.com/spdji/en/documents/campaigns/sp-500-through-history-202301.pdf?utm_source=chatgpt.com)。

**哪個最適合 monthly DCA？** 未找到可核實的比較能證明某個門檻／期限最優，等級為 **none；效果未建立**。

我的研究設計建議是：

- 保留你原本的 **5%／21 trading days** 為 primary target，避免看完結果後換題目。
- **3%／21 trading days** 可作較常見事件的補充校準檢查；正例較多不代表預測 signal 必然較強。
- **10%／63 trading days** 可作 severe-risk 描述，但較長期限會讓相鄰月度決策高度重疊。

DCA 的決策效益需要另測：先固定觸發規則、最多等待多久、未觸發時何時買入、現金收益與成本。**「期間內可能出現較低收盤」並不足以證明延後買入有利**；它沒有告訴你何時到達、之後是否反彈，以及沒發生時等待的代價。

## 5. Scoring：這麼少的事件，應如何報告？

我會保留 Brier 為主，增加以下資訊。


| 項目                              | 建議做法                                                                                  | 避免的誤讀                                |
| ------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------ |
| **Brier／BSS**                   | 用相同 forecast origins，報相對 base 與相對現有模型的 **paired score difference**，共用 block resamples | 對 base 有 skill，不代表對現有模型有增額 skill     |
| **Log score**                   | 作 secondary proper score；對所有預測計算。事前固定 probability regularization，處理極接近邊界的預測           | 只看 crash 日的 loss，或事後改 clipping 來美化分數 |
| **Calibration-in-the-large**    | 報平均預測機率、實際事件頻率及差值；附 block-aware uncertainty                                           | 整體平均吻合，不代表高風險與低風險區間都 calibrated      |
| **Reliability diagram**         | 用少數、事先固定的 bins；每個 bin 報平均預測、實際頻率、總筆數、事件數與 episode 集中程度                                | 平滑曲線看起來精密，卻沒有足夠獨立事件支撐                |
| **Calibration intercept／slope** | 可作診斷，理想值分別為 **0／1**；誠實呈現寬 CI                                                          | 用同一 OOS 樣本重新校準，再把改善當成新的 OOS skill    |
| **ROC/AUC、PR/AP**               | 作排序能力的補充；PR/AP 需連同 prevalence 解讀                                                      | AUC 高不等於概率準確，也不等於 DCA policy 有效      |


Proper scoring 的依據是 [Gneiting–Raftery，*Strictly Proper Scoring Rules, Prediction, and Estimation*，2007-03](https://sites.stat.washington.edu/people/raftery/Research/PDF/Gneiting2007jasa.pdf?utm_source=chatgpt.com)；calibration 層次與圖表限制見 [Van Calster 等，2019-12-16](https://link.springer.com/article/10.1186/s12916-019-1466-7?utm_source=chatgpt.com)。後者是醫學預測方法論，並非金融樣本的效果證據。PR 的解讀見 [Saito–Rehmsmeier，2015-03-04](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0118432&utm_source=chatgpt.com)。[sites.stat.washington.edu](http://sites.stat.washington.edu)

**Murphy decomposition 可以報，但要小心計算對象。** 對連續概率先任意分 bins，再計算 reliability／resolution，不一定精確分解原始 Brier score。可參考 CORP／isotonic reliability diagram，但其 uncertainty 也要改成適合時間相依資料的做法。[Dimitriadis–Gneiting–Jordan，*Stable reliability diagrams for probabilistic classifiers*，2021-02-17](https://publikationen.bibliothek.kit.edu/1000130510/106591216?utm_source=chatgpt.com)。[publikationen.bibliothek.kit.edu](http://publikationen.bibliothek.kit.edu)

對你的樣本量，尤其要守住兩點：

- **Start phases 不是額外獨立樣本。** 它們主要反映起始日敏感性；`days/21` 也只是有效樣本的 heuristic，不是自動成立的統計 ESS。事件相隔一個 horizon，仍可能處於同一 crisis regime。
- **目前的 permutation null 太粗，較適合探索。** 依常用 Monte Carlo permutation rank formula，使用你提供的 **20** 次 permutations，最小非零 p-value resolution 為 \\[ \\frac{1}{20+1}\\approx 0.0476. \\]這使尾端 threshold 很不穩定。公式來源為 [Phipson–Smyth，2010-10-31，corrected 2011-02-09](https://gksmyth.github.io/pubs/PermPValuesPreprint.pdf?utm_source=chatgpt.com)。應增加 null replications，而且每次重跑整個候選選擇／校準流程；若挑最佳模型，就比較 null 下的最佳 skill。這不否定你目前結果，但會影響新增 predictor 的接受標準。[gksmyth.github.io](http://gksmyth.github.io)

## 6. 如何向非專家溝通？

這些來源最值得借用的是表達方法，以下不主張它們證明了你的預測有效：


| 來源                                         | 可借用的表達方式                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Minneapolis Fed，2015-01-07**             | 明確區分 market-based／risk-neutral probabilities 與 physical forecasts。文件甚至直接說明 market-based probabilities 不擅長預測未來；它們也反映壞狀態的價格權重。[原文](https://www.minneapolisfed.org/-/media/files/banking/mpd/optimal_outlooks_dec22.pdf?utm_source=chatgpt.com)。[minneapolisfed.org](http://minneapolisfed.org)                                                          |
| **Fed Financial Stability Report，2026-05** | 分開說明可觀察的 vulnerabilities 與難預測的 shocks。風險狀態升高，不等於已知道 crash 的發生日期。[框架說明](https://www.federalreserve.gov/publications/2026-may-financial-stability-report-purpose-and-framework.htm?utm_source=chatgpt.com)。[May 2026](https://www.federalreserve.gov/publications/2026-may-financial-stability-report-purpose-and-framework.htm?utm_source=chatgpt.com) |
| **Man Group，2020-05-18**                   | 在 drawdown simulation 圖旁直接列 horizon、volatility、Sharpe、dependence 等假設，並標示 illustrative。其研究是 manager maximum drawdown，不能搬成你的短期固定門檻機率。[原文](https://www.man.com/insights/youre-fired?utm_source=chatgpt.com)。[Man Group](https://www.man.com/insights/youre-fired?utm_source=chatgpt.com)                                                                 |
| **AQR，2021-02-28**                         | 把 tail protection 的有效性與長期成本分開呈現。對 dashboard 而言，也應把「風險預測」與「是否暫停 DCA」分開驗證。[原文](https://www.aqr.com/insights/research/white-papers/tail-risk-hedging-contrasting-put-and-trend-strategies?utm_source=chatgpt.com)。[aqr.com](http://aqr.com)                                                                                                              |


你的 dashboard 可固定呈現以下欄位：

- **事件：**未來 21 個交易日內，至少一次收盤比今日低 5% 或以上。
- **機率：**模型估計，以及同一定義、同資料截止日的歷史 base rate。
- **驗證：**歷史上相近預測區間的實際事件率、事件數與 uncertainty。
- **解讀：**事件可能發生後又反彈，期末仍可能高於今天；此數值不預測最低點。
- **不確定性：**BSS 的 CI 描述歷史平均 skill，不是今日這一筆概率的 confidence interval。

### 我會採用的下一步

先把 **daily-close Gaussian first passage、EWMA、過往 variance 校正的 VIX** 作為固定 benchmark suite，與你的 incumbent 在完全相同 origins 上作 paired comparison。新增變數只有在這個比較中提供增額價值，才值得進入模型。

本次看過的結果屬探索資料；若據此挑選 challenger，後續需用未參與選擇的測試期，或把選擇流程完整納入你的 snooping null。**目前最有價值的發現，是找到了需要校正的映射與可重現的比較基準，尚未找到已證實更好的 P(dd5) 模型。**

可重現試算包包含程式、逐日 forecasts、base-rate counts、bootstrap 結果與資料限制：

[sp500_drawdown_research\_](https://chatgpt.com/library?file_id=libfile_129ec87abacc8191b0ed4f2a81ad23e5&account_id=personal)[2026-10-27.zip](http://2026-10-27.zip)