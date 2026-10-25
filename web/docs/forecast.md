# S&P 500 下月展望模型

`src/lib/forecast.ts` 估計「約 21 個交易日後 S&P 500 是否高於今天」的機率。本文件記錄模型為什麼長這樣、試過哪些條件，以及接下來要測什麼。路徑相對於 `web/`。

## 現行設計

- **預設輸出歷史基準率。** 條件機率只在有效樣本 nEff = 天數 ÷ 21 ≥ 30（`MIN_EFFECTIVE_N`），且 Wilson 95% 區間不含基準率時才採用。
- **條件只有兩個：** 收盤是否站上 200 日線、VIX 是否 ≥ 30。先試兩者組合，樣本不夠再退到單一條件。
- **滾動驗證：** 每 21 個交易日預測一次（不重疊），burn-in 504 天，每次只用當天已知的標籤；以 Brier skill score 對比「永遠用基準率」，用區塊 bootstrap 算區間。
- **給方向的條件：** 條件機率顯著不同於基準率，而且滾動驗證的 BSS 下界 > 0，才給「up／down」，否則是「inconclusive」。
- **只當背景、不進機率：** 策略師年底目標（`src/lib/strategists.ts`）、分析師共識與 EPS 修正廣度（`src/lib/consensus.ts`）、FactSet 由下而上目標價。

## 試驗登記

新條件要先寫在這裡（定義、資料源、採用與否決門檻）才能測，測完把結果補上。這樣才算得出一共試了幾次，避免事後挑結果。

| 條件 | 狀態 | 結果 |
| --- | --- | --- |
| 站上 200 日線 | 採用 | 與基準率有微弱差異，樣本少 |
| VIX ≥ 30 | 在模型中，目前從未被選用 | 部署的 10 年窗口（3660 天）只有 155 天 VIX ≥ 30，nEff≈7.4，低於 `MIN_EFFECTIVE_N`，`pickProbability` 一律退到 trend 或基準率；1990 年以來共 737 天（Cboe `VIX_History.csv`，算到 2026-10-23）。要先補歷史才可能用到 |
| 分析師目標價隱含漲幅 | 放棄 | 對一個月方向沒有穩定預測力 |
| 策略師年底目標 | 放棄 | 與實際報酬相關約 0 |
| 市場廣度（RSP/SPY 等） | 放棄 | 對一個月方向沒有穩定預測力 |
| VIX 期限結構 | 放棄 | 對一個月方向沒有穩定預測力 |
| VRP 取代 VIX ≥ 30 | 待測（名額 1） | 未跑；門檻見下方路線圖第 8 項 |
| 11 月–4 月季節性 | 待測（名額 2） | 未跑；門檻見下方路線圖第 9 項 |

前六列是模型最初版本（2026-10-25）的研究結論，當時的回測數字沒有留存。

## 2026-10 研究：投行做法與我們的差距

以下是 2026-10-26 的研究整理，涵蓋四個視角（基本面、戰術指標、學術證據、社群討論）。每一項差距都經過三個角度審查：統計、資料可得性、設計。投行的觀點與數字有時效性，引用前請對照日期。

> 範圍：四個研究視角（基本面、戰術、學術證據、社群）、20 個差距候選（G01–G20）、三位審查者（stats／data／design）的判定，以及一份完整性批評。**本報告提到的所有改動都還沒跑過回測**，門檻都是事前寫下的假設。
>
> 證據等級：`none`（沒有公開績效）／`bank_claim`（投行自述，沒有樣本外檢驗）／`anecdotal`（軼事或從業者自己的回測）／`academic_oos`（學術文獻有報告樣本外檢驗，但不代表結果是正面的）／`independently_tested`（有獨立第三方檢驗過）。完整性批評的 A–E 等級對應如下：A→academic_oos，B→學術但只有樣本內，C→anecdotal，D→bank_claim，E→未驗證。
>
> 程式位置都是 repo 相對路徑，已逐行複核過：`web/src/lib/forecast.ts`、`web/src/server/jobs.ts`、`web/src/server/outlook.ts`、`web/pages/outlook.tsx`、`web/src/lib/strategists.ts`、`web/src/lib/sources/factset.ts`、`web/src/lib/calendar.ts`、`web/src/lib/universe.ts`。

### 1. 摘要

- **最值得先做的不是加指標，是把地基補好。** 第一步是把 SPX 與 VIX 的完整歷史補回來。目前 DB 只存約 10 年（`jobs.ts:256`），walk-forward 只有約 85 列，VIX≥30 的 nEff 只有約 7.4，所以任何新 flag 的檢驗在現況下都沒有意義。第二步是預測紀錄要能追溯：加上模型版本與 regime 狀態，資料列不可覆寫。第三步是維護本文件的試驗登記，把試過的 flag 與門檻都記下來。
- **方法論上值得改的有三處。** 把條件機率與基準率之間的硬切換改成往基準率收縮（G01）；改用「當下這個 basis 自己的 BSS」決定是否出結論，而不是用全域 BSS（G03）；把 UI 的「不確定」改寫為「偵測不到 skill」，並同時顯示最小可偵測的 BSS（G08）。
- **新輸入最多只測兩個：** 一是 variance risk premium（VRP），只拿來取代 `vixStress`，不是另外加一個 flag；二是 11 月到 4 月的季節性 flag。對每月定期定額的使用者，最有用的新增輸出是 21 日內最大回撤超過 5% 的機率，因為現有 flag 帶的主要是風險資訊，不是方向資訊。
- **刻意不做的事：** 不做投行那套 EPS×本益比年底目標、估值或 ERP 擇時、專有情緒合成指標（SSI、Bull & Bear、GS SI、Levkovich）、自己湊一個 DIY 情緒合成指標，也不把樣本 n<20 的事件研究（首次升息、期中選舉）放進機率。利率衝擊、信用利差、CTA、市場廣度、CFTC 部位這幾項只當有日期標示的背景資訊顯示，不進機率。

### 2. 各家投行怎麼研究美股

#### 2.1 基本面流程與目前預期（2026 年）

所有投行建構指數觀點的骨架都一樣：**12 個月 EPS 路徑 × 假設的本益比，外加情境分析**。2026 年的目標價上調幾乎都發生在財報優於預期之後（調高 EPS，本益比持平或調低）；下調（Wells Fargo、Yardeni）則完全來自本益比。換句話說，目標價在追已實現的盈餘與價格，這也解釋了策略師目標價與實際報酬的相關約為 0 [31][30]。

| 機構 | 基本面流程 | 戰術指標 | 1–12 個月預期與理由 | 證據等級 |
|---|---|---|---|---|
| Goldman Sachs（Snider；Kostin 團隊；Mueller-Glissmann） | 由上而下的 EPS 模型：GDP 每增 100bp，EPS 成長約多 3–4pp；平均關稅每升 5pp，EPS 少 1–2%；另外明確估算 AI capex 的貢獻。本益比約 22x 持平 [1][89] | Equity Sentiment Indicator（6 個週頻、3 個月頻的部位指標組成 z-score，視角 1–8 週）；Risk Appetite Indicator（RAI，跨資產）；首次升息事件研究（n≈7）[3][5] | 年底目標從 7600 上調到 8000 [2]。10/12 把 3 個月股票觀點調為加碼 [78]。RAI 約在 10/20 轉負，GS 解讀為反向買點（X 轉述）[62]。SI 讀數有爭議：roic 報 46 百分位 [4]，X 轉述為 −1.26／−0.37 [62]，兩組數字沒有一份原始報告能對上 | 目標：none；SI／RAI：bank_claim |
| Morgan Stanley（Wilson） | 盈餘修正廣度 ERB =（上修−下修）/總數，3 個月滾動，季節性明顯；以「滾動式盈餘衰退／復甦」為主架構 [7][80] | 債市波動是短期主驅動；觀察市場廣度（10 月時 Russell 3000 有過半成分股自 6 月以來跌 20% 以上）[9] | 2027 年中目標 8300，樂觀情境 8500。研判修正在時間與幅度上都已「成熟」，再亂流 2–3 週後走強 [8][79]。支撐區數字各來源不一致 | bank_claim |
| BofA（Subramanian；Hartnett） | 把五個模型（含 SSI、fair value）的隱含報酬平均成目標價。SSI 約 56% 對應約 12% 的 12 個月報酬，BofA 自稱 R²=25–28%，但門檻被重新校準過（60.1 → 57.8）[12][13] | Bull & Bear（0–10，>8 為賣訊）、FMS 現金法則（≤4.0% 為賣訊）、EPFR 資金流、實質利率約 3% 時偏向避險 [14][34] | Hartnett 10/15 起轉偏避險，到 11 月中。B&B 從 8.1 回到 7.2（X 轉述）[63]；FMS 現金 3.9% [34]。B&B 歷次賣訊的次數，BofA 自己的報告寫 11、16、17、32 都有，彼此對不上 [35][36] | bank_claim |
| Citi（Chronert；Levkovich） | 2025 年 12 月的基準情境：$320 × 約 24x = 7700，樂觀 8300、悲觀 5700。盈餘品質警告：私人 AI 持股的市價評價利益讓 Q2 EPS 成長多了約 18pp，可能導致 2027 年負成長 [17][32] | Panic/Euphoria 指標。唯一一份獨立檢驗（Advisor Perspectives 2011）結果為負面，2008 年初還發出錯誤訊號 [18] | 以盈餘撐目標；強調估值起點高，風險不對稱 | 目標：none；P/E 指標：independently_tested（負面） |
| JPMorgan（Lakos-Bujas；Panigirtzoglou） | 2026 EPS 逐步上調（$330 → $350 → $365），本益比約 20x；情境以 Fed 路徑分歧 [19][20] | 部位與資金流（CTA、風險平價、波動控制、散戶）；Tactical Positioning Monitor | 7200 → 7600 → 7800 → 8000。10/22 有轉述說部位已大幅重置、拋售接近極限，但原始報告沒找到 [65] | none |
| Barclays（Krishna） | 2026 EPS 調到 $365、2027 調到 $414；因利率偏鷹，**刻意壓住本益比** [21] | — | 目標上調幅度小於 EPS 上調幅度 | none |
| Wells Fargo Securities（Kwon） | 用正常化 EPS 檢視 capex 與折舊（明年 EPS 比正常化值高約 42%）；估算 AI 需求要多大才撐得起 capex（約 $1.4–2.2 兆）[22] | 家庭股票配置約 72%，為 1969 年以來最高 | 9 月因本益比壓縮風險把目標從 7950 下調到 7700，提醒可能回檔 5–10% [22] | bank_claim |
| Evercore ISI（Emanuel） | 公布明確的情境機率：基準 7750，給 9000 的樂觀情境 30% [23] | 檢查部位 | 悲觀情境的數字各報導不一致，未驗證 | none |
| UBS GWM／HSBC／Deutsche Bank | 以 EPS 重設為主（UBS 2026/27 EPS 為 $350/$400，8100 約等於 20.3x）[24][25] | DB 的綜合部位指標（4/20 為 0.18 SD，約第 51 百分位）[38]；HSBC 提醒季節性 | 都在上調；悲觀 5500、樂觀 9500（UBS） | bank_claim |
| Yardeni | 前瞻 EPS × 前瞻 P/E，加上主觀情境機率（Roaring 2020s 從 80% 調為 70%）[26] | — | 9 月下調完全來自本益比（19.8x → 18.6x），2027 EPS $425 不變 | none |
| Nomura／GS／UBS／Citadel（系統化資金流） | — | 模擬 CTA 趨勢單與波動控制部位：多種回看期、按波動縮放，算出觸發價位 | CTA 曝險 z-score 在 9 月從 +2.35 降到 −0.80 [37]；BofA 10/5 稱 CTA 在美國大型股的多單最集中、跌勢路徑約會賣 $84B [64]。各來源的觸發價位互相衝突 | none（流量模擬，不是報酬預測） |

#### 2.2 市場對未來 1–12 個月的共識（只列跨來源一致的部分）

- **短期（到 11 月中）偏謹慎：** Hartnett 偏避險、Wilson 預期再亂流 2–3 週、GS 提醒波動放大，市場廣度也弱 [14][8][4]。
- **6–12 個月仍是盈餘驅動的偏多：** MS、UBS、DB、HSBC、Barclays、JPM 都在上調 2026–27 年 EPS [24][21]。
- **主要風險：** 利率與實質利率（壓本益比）、AI capex 的融資壓力（Meta 的自由現金流轉負、CDS 創紀錄）、盈餘品質（Citi 指出的約 18pp）[32][22]。
- **21 日窗口內的事件：** FOMC 10/27–28、期中選舉 11/3、大型科技股財報 [32]。

**有爭議或未核實的數字：**

- 「10 年期公債殖利率 10/7 達 5.36%」：FRED 上 2026 年最高是 5.31%（10/05）。
- 「9 月升息到 3.75–4.00%」「Warsh 任主席」：只見於二手報導 [5][33]，沒有對過 FOMC 聲明。
- GS SI 的各項數字：只有 X 轉述與聚合站來源。
- B&B 歷次賣訊次數：BofA 各報告寫法不一。
- MS 的支撐區、Evercore 的悲觀情境：各來源不一致。
- roic、CNBC 等多個原始頁面回 403，部分 2026 年數字只能當參考值。

### 3. 學術與獨立證據：一個月視角下什麼有用、什麼沒用

| 項目 | 一個月視角下的結論 | 等級 | 來源 |
|---|---|---|---|
| 歷史均值（基準率） | 最難打敗。Goyal-Welch-Zafirov 2024 重新檢驗 46 個預測變數，多數月頻樣本外 R² 為負；正值只有 0.1–0.7%，而且樣本內並不顯著 | academic_oos | [28][29] |
| 技術、均線訊號（≈ 我們的 SMA200） | 有樣本外證據（Neely 等 2014），但 GWZ 表上的月頻樣本外 R² 只有約 0.20。用在單一指數的時間序列動能時，Huang 等 2020 的結果偏弱。均線規則的主要價值是減少回撤，而不是提高命中率 | academic_oos | [39][28][50][49][90] |
| Variance risk premium（VIX²−已實現變異數） | 幅度小，但有學術支撐；BTZ 2009 原文指出可預測性在約一季時最強，而且是樣本內結果。ECB WP1675 對這個量測方式有批評。BTZ 原文連結沒有核實（研究輸入所附的 duke 連結其實是另一篇論文） | academic_oos（有爭議） | [82] |
| 波動與漲跌方向 | Christoffersen-Diebold：平均報酬沒有可預測性時，波動仍可能帶來漲跌方向的可預測性。這是我們 VIX flag 的理論依據 | academic_oos（理論為主） | [51] |
| VIX 水準本身 | 預測力弱（Johnson）；從業者的分桶統計沒有樣本外檢驗，而且壓力事件高度群聚 | anecdotal | [52][85] |
| 波動管理（以 1/RV 縮放部位） | 能即時實作的版本，表現輸給不管理的投組（Cederburg 等 2020） | academic_oos（負面） | [53] |
| 期限利差、違約利差 | 月頻下沒有穩健打敗歷史均值；比較像 6–18 個月的衰退指標 | academic_oos（負面） | [28] |
| 情緒指標（BW、AAII、NAAIM） | BW 對整體市場的月頻樣本外 R² 約 0.15%；AAII 的效果在 2001 年後衰退；NAAIM 官方自己說「不具預測性」 | academic_oos／anecdotal | [54][43][44] |
| 加總盈餘修正 | 主要是同期關係，沒有找到獨立的指數層級擇時檢驗 | anecdotal | [10] |
| 策略師目標 | Söderlind 2010：像是過度配適的模型；從業者整理的年均誤差約 10–15pp | academic_oos／independently_tested | [55][30][31] |
| 收縮與組合方法（CT 2008、PTV 2014、RSZ 2010） | 讓弱預測變數在樣本外勝過歷史均值的關鍵，是往基準收縮。RSZ 的組合預測能帶來小幅改善；Löffler 2021 指出相對買進持有，經濟上的好處大多消失 | academic_oos | [45][46][47][48] |
| 資料窺探校正（White RC、HLZ t>3、deflated Sharpe） | 把整個規則宇宙都算進去之後，技術規則在 S&P 500 上的超額報酬消失（原文 403，未開啟） | academic_oos（未讀全文） | [56] |
| 樣本外檢定力 | Hjalmarsson：效果即使真的存在，標準的樣本外檢驗也很少能偵測到。因此「不確定」應該寫成「偵測不到 skill」 | academic_oos | [57] |
| 計分方式 | Brier 與 log score 都是嚴格正當計分；建議分開評估校準度與鋒利度 | 理論 | [59] |

一項本地計算（社群視角，^GSPC 2009-01-02 到 2026-10-23）：21 日上漲比例的無條件基準為 67.9%（重疊窗）／66.7%（213 個不重疊窗），平均 21 日報酬 1.14%。GS SI 轉述的「顯著」訊號命中率約 60%，**比基準率還低**，只有平均報酬比較高。這正是 `forecast.ts:110` 那條「區間必須排除基準率」的規則會擋下來的情況 [62]。

### 4. 與我們模型的差距表

三位審查者為 stats（統計）、data（資料可得性）、design（設計與使用者適配）。判定欄寫的是「判定／理由」，最後一欄是綜合結論：以多數決為準，並註明少數意見。

#### 4.1 方法論

| ID | 差距 | 我們現況 | 建議改動 | 免費資料源 | 怎麼進 pickProbability／walkForward | stats | data | design | 綜合 |
|---|---|---|---|---|---|---|---|---|---|
| G01 | 硬切換改為收縮 | `forecast.ts:110-112`：`distinct ? r.p : base.p`，是 pre-test estimator，輸出會跳動 | Beta-binomial：p=(k·p_base+n·p_cond)/(k+n)，k 事前登記（例如 40）；n 改用考慮事件群聚的值 | 不需要 | pickProbability 回傳收縮後的 p 與 shrinkWeight；walkForward 在 `forecast.ts:161` 直接對它計分 | keep：程式碼與 CT 2008 都支持；但「配對 bootstrap 下界 ≥0」的要求永遠過不了，要改成「沒有顯著變差就採用」 | keep：目前只有 85 列，等於做不回歸檢查；要等歷史補齊才有檢定力 | keep：k=40 對 trend cell 幾乎不收縮，作用集中在小 cell；頁面要並列基準率、cell 比例、收縮權重 | **keep** |
| G02 | 預測紀錄要能追溯 | `jobs.ts:386-392` 只存 probability、base_rate、basis、call、close，`ON CONFLICT` 會覆寫整列；`outlook.ts:51-58` 的 track 只有 Brier 與上漲比例 | 加 model_version、regime JSON、cond_p、cond_nEff、bssLow、history_start；過了收盤時間的列不可再改 | 自有 D1 | 基礎建設，是其他所有改動的前提 | keep：live 紀錄一年只增加約 12 個獨立列，校準要用粗分組 | keep：補歷史會讓基準率跳動，所以一定要記 history_start | keep：成本最低、效益最高 | **keep** |
| G03 | 只用當下 basis 的 skill 決定能否出結論 | `forecast.ts:225`：`conclusive = pick.distinct && bssLow > 0`，bssLow 是全域值（`:220`） | 每個 walk-forward 列記下 basis；當下 basis 的 bssLow>0、列數 ≥30、事件數 ≥8 才出結論 | 不需要 | 只改 buildOutlook 的出結論條件，不改 p | keep：壓力 cell 在實務上幾乎永遠不會出結論，這是誠實的結果 | keep：85 列下只有 trend／base 可能過門檻 | keep | **keep** |
| G04 | 事前登記試過的設定，並校正選擇偏誤 | 研究前沒有試驗紀錄（已由本文件的「試驗登記」補上）；`:29` 用 z=1.96；`:40` nEff=days/21；VIX≥30 的日子群聚 | 維護試驗登記；增加 MIN_EPISODES（≥8 段），事件之間至少隔 21 個交易日才算不同段；z 放寬與 G01 收縮兩者只能擇一 | 不需要 | 改 MIN_EFFECTIVE_N 的邏輯；新 flag 必須先登記才能測 | keep：設測試預算，下一輪最多測 2 個 flag | keep：1990 年以來 VIX≥30 共 737 天，但部署中的 10 年窗口只有 155 天（nEff≈7.4）；連續日分段會切出 93 段，高估了獨立性 | keep：用 G01 的話 z 留在 1.96 | **keep** |
| G07 | 多訊號組合，取代「先到先用」 | `forecast.ts:100-113` 依序試三個 cell，取第一個合格的 | 對各 flag 的收縮預測取等權平均 | 不需要 | 取代候選迴圈 | downgrade：目前只有 2 個 flag 且彼此相關，等權平均會重複計算 | keep（但目前沒東西可組合） | downgrade：會失去「這個 cell 歷史上漲比例 X%」這種直白解釋 | **延後**，等到有第 3 個 flag 過關再做 |
| G08 | 檢定力與用語 | `forecast.ts:148` blockSize=3；`outlook.tsx:11` 把結果標成「不確定」 | 改用 stationary bootstrap（平均區塊長 6–12 個月）或 HAC Diebold-Mariano；UI 改寫為「偵測不到 skill（最小可偵測 BSS 約 X%）」；**不加 Clark-West** | 不需要 | 只改評估方式；`tests/forecast.test.ts:54-90` 的測試必須照樣通過 | downgrade：Clark-West 不適用於 Brier | keep：85 列時平均區塊長取 6 | downgrade：Clark-West 會放寬門檻 | **部分採用**（bootstrap 與用語） |
| G09 | 多個預測目標 | `forecast.ts:11` HORIZON 固定為 21，只輸出 P(up) | **只加一個目標：** 21 日內 P(最大回撤>5%)；分位數只顯示、不計分 | 現有 SPX | 沿用同一組 Regime，各目標自己做 walkForward，knownOn=t+21 | downgrade：多期限×多目標會造成多重檢定 | downgrade：10 年窗口下 63 日期限只有約 28 列 | keep：對每月定期定額最有決策價值 | **keep（僅限 21 日回撤）**，5 日與 63 日延後 |

#### 4.2 模型輸入候選

| ID | 差距 | 我們現況 | 建議改動 | 免費資料源 | 怎麼進模型 | stats | data | design | 綜合 |
|---|---|---|---|---|---|---|---|---|---|
| G05 | 利率衝擊、實質利率 | `forecast.ts:15` 的 Regime 只有兩個欄位，沒有利率 | 10y 殖利率 21 日變化超過 2σ；DFII10 在 80 百分位以上 | FRED DGS10（1962 起）、DFII10（2003 起），不需金鑰 [77][16] | 原構想是新增 Regime 欄位 | downgrade：`forecast.ts:59-60` 缺 VIX 時 regime 會是 null，所以 1990 年前的資料用不到；2σ 事件的 nEff 只有約 10–20；2022 與 2026 早就影響了這個構想 | downgrade：FRED 用 '.' 標假日；FRED 上沒有「5.36%」 | downgrade：跟著當下敘事走，正是過度配適的溫床 | **只顯示**（G16） |
| G06 | VRP | 只有二元的 VIX≥30（`forecast.ts:60`） | VRP=VIX²/12−21 日已實現變異數，以 expanding 中位數切分 | 已抓的 Cboe VIX 與 SPX，不增加 subrequest | **只能取代** vixStress，不能新增 | keep（作為取代）：引用要修正 | downgrade：目前只有 85 列，要先補歷史 | downgrade：一個月視角大概仍是不確定 | **測試名額之一**（排在補歷史之後） |
| G10 | FactSet 週報變成有日期版本的資料 | `jobs.ts:492` 只保留 104 期；`factset.ts:30-50` 沒解析 forward EPS | 改成不設上限的表；擴充 forward EPS 與財測解析；離線回補 | FactSet EarningsInsight PDF [76] | 只顯示，並開始累積 | downgrade：探測結果約從 2019 年起（2017 年 1 月回 404） | downgrade：約從 2017 年起（`011317` 回 200）；檔名不規則（`102023A`），版面也改過 | downgrade：只做基礎建設 | **只做基礎建設**。兩次探測結果衝突，可能原因是檔名後綴 A／B 不規則，要改抓索引頁 |
| G11 | 用 Nasdaq analyst_views 累積的快照算廣度 | `jobs.ts:437` 會一直累積版本（沒有刪除）；consensus 只用 7 日內的資料 | 每天寫一筆 as-of-D 的指數層級聚合 | 已在抓 | 2028–29 年以前只顯示 | downgrade：廣度以前試過、被放棄 | keep：確認資料沒被刪 | downgrade | **只做基礎建設** |
| G12 | 多速趨勢、CTA 代理 | 只有 SMA200（`forecast.ts:60`） | ctaScore（20/60/120/250 日訊號的平均） | SPX | 原構想是取代 SMA200 | reject：等於事後重搜趨勢定義 | keep | reject | **reject**（可當背景值顯示） |
| G13 | Fed 路徑、信用利差 | 沒有 | DGS2−DFF>0；BAA10Y 21 日變化超過 2σ | FRED DGS2、DFF、BAA10Y [75] | — | reject | downgrade：BAA10Y 是投資級信用，不是 HY 的好代理；HY OAS 在 FRED 上從 2023-10-24 才有資料 [41] | reject | **reject**（只顯示） |
| G14 | VIX 期限結構逆價差 | `forecast.ts:3` 記錄已試過並放棄 | 與 VIX≥30 合併成一個壓力 flag | Cboe VIX3M（2009 起） | — | reject：屬於分叉路徑式的重測 | downgrade | reject | **reject** |
| G15 | RSP/SPY 廣度 | 已試過並放棄 | 63 日變化 | RSP 已經在抓（`universe.ts:5`），不增加 subrequest | — | reject | downgrade：要先以 range=max 回補 | reject | **reject**（只顯示） |

#### 4.3 顯示與刻意不採用

| ID | 項目 | 現況 | 建議 | stats | data | design | 綜合 |
|---|---|---|---|---|---|---|---|
| G16 | 驅動因子清單與事件日曆 | outlook.tsx 沒有；`calendar.ts:111` 的 MACRO_EVENTS 已有 FOMC 日期 | 列出 asOf+21 日內的事件，加 3–4 個標明日期的背景值，並標註「不進機率」 | keep：事件研究要附 n 與 Wilson 區間 | keep：每個值都要附資料日期 | downgrade：清單太長會讓人用敘事推翻數字 | **keep 精簡版**：不放事件研究表 |
| G17 | CFTC TFF 部位 | 沒有 | 資產管理人淨部位 z-score，以週五發布日為準 | downgrade：極端 cell 的 nEff≈23，永遠過不了門檻 | keep：Socrata 一次查詢就能拿到 2006 年以來的資料 [60] | reject | **最多只顯示**，不排測試 |
| G18 | 市場隱含情境分布 | 沒有 | 標示「選擇權隱含 ±1σ」帶（VIX/√12），註明是風險中性、通常比實際波動寬 | keep | keep | downgrade：不要 Polymarket | **只做 VIX 帶** |
| G19 | 估值、ERP、EPS×本益比 | 只顯示 forward P/E | 不進 21 日 P(up)；可以顯示 ERP | keep | keep：P/E 的歷史版本只到約 2017 年 | keep | **刻意不採用** |
| G20 | 專有情緒合成指標與散戶調查 | 不用 | 不自己湊合成指標 | keep | keep：AAII 的 xls 回 403 | keep；也不要放媒體報的讀數 | **刻意不採用** |

### 5. 建議路線圖

> **以下各項的回測都還沒跑。** 排序原則是期望價值加上依賴關係，所有門檻都要在看到結果之前寫進上方「試驗登記」。共用的採用門檻用到兩個現有常數：MIN_EFFECTIVE_N=30（`forecast.ts:12`）與 burn-in 504 日（`forecast.ts:148`）。

| 順序 | 項目 | 可驗證假設 | 採用門檻 | 否決條件 |
|---|---|---|---|---|
| 0 | **補歷史（M0）＋凍結基準率窗口（M1）＋ VIX 陳舊上限（M5）** | SPX 從 Cboe 補到 1975 年起、VIX 補到 1990 年起之後，walk-forward 列數會從約 85 增加到約 400 | 達成即採用（基礎建設）；同時事前登記基準率窗口（固定起點、expanding）並記下 history_start；`vix.onOrBefore` 超過約 3 個交易日沒更新就視為缺值 | — |
| 1 | **G02 預測紀錄可追溯** | 每一筆 live 預測都能還原到產生它的模型版本 | 無條件採用 | — |
| 2 | **G04 試驗紀錄與事件數規則** | 加上 MIN_EPISODES≥8 之後，壓力 cell 的區間會變寬 | 無條件採用。用語選定為「1990 起約 737 個 VIX≥30 日」，以「事件間隔 ≥21 個交易日」重新計算段數 | — |
| 3 | **標籤定義（M2）** | 「21 日後高於今天」與「21 日後勝過現金（含股息）」差幾個百分點 | 事前選定一種標籤，另一種只顯示 | — |
| 4 | **G01 收縮** | 收縮後的 Brier 不會顯著比硬切換差 | k=40 事前登記；配對 Brier 差的上界沒有顯著變差就採用；k∈{20, 80} 只當敏感度分析，不從中挑 | 收縮後的配對 Brier 差顯著較差 |
| 5 | **G03 依 basis 決定能否出結論** | 壓力 regime 下出結論的次數會降到幾乎 0 | 全域 BSS 不受影響就採用（它只改出結論條件，不改 p） | — |
| 6 | **G08 bootstrap 與用語** | stationary bootstrap 的 bssLow 會比現行 3 個月區塊更保守 | `tests/forecast.test.ts:54-90` 的合成 regime 測試仍然通過、隨機漫步仍然不確定，就採用 | 合成測試失敗 |
| 7 | **G09：21 日 P(最大回撤>5%)** | SMA200 與 VIX flag 對回撤機率的 BSS 大於 0，即使對方向沒有 skill | 該目標的 bssLow>0，且各 cell 的 nEff≥30、事件數 ≥8 | bssLow≤0 就只顯示經驗分位數 |
| 8 | **測試名額 1：G06 VRP 取代 vixStress** | 在相同的資料列上，VRP 版的配對 BSS 比 VIX≥30 版高 | cell 與基準率可區分、配對 BSS 下界 >0、nEff≥30 | BSS 點估計 ≤0 就否決，VRP 改為只顯示 |
| 9 | **測試名額 2：11 月到 4 月季節性 flag**（完整性批評補，三位審查者沒評過） | 冬半年的 21 日 P(up) 比夏半年高 | 同上，而且必須在看 1990 年後的結果之前登記 | 同上 |
| 10 | **顯示層** | 不計分 | G16 精簡版（事件日曆加 3–4 個背景值）；G18 VIX 帶；可選擇另外顯示 N(d2) 風險中性 P(up) 當下限參考（M3）；G05、G13、G15、G17 的背景值都標資料日期 | — |
| 11 | **長期累積** | — | G10 改成不設上限的表並抓索引頁；G11 每天寫聚合 | — |

延後的項目：G07（等到有 3 個 flag 過關）、63 日期限（等補完歷史）。否決的項目：G12、G13、G14、G15 作為模型輸入。

### 6. 投行有做、我們刻意不做的事

| 投行做法 | 我們不做的理由 |
|---|---|
| 年底目標＝EPS 路徑×本益比 | 策略師目標與實際報酬的相關約 0 [31][30]；Söderlind 說它像過度配適的模型 [55]；`strategists.ts:3` 已經只把它當背景資訊 |
| 估值、ERP、Fed model 擇時 | 是 12–36 個月的慢變數，Asness 與 GWZ 都找不到短期預測力 [27][28]，預期 21 日 BSS 約為 0 |
| 專有情緒合成指標（SSI、B&B、FMS、GS SI、Levkovich） | 沒有免費的歷史版本；門檻會重新校準（SSI 從 60.1 改到 57.8）；事件次數各報告不一致；唯一一份獨立檢驗是負面的 [18] |
| 自己湊 DIY 合成指標（AAII、NAAIM、put/call、COT） | 擬合權重本身就是資料窺探；AAII 回 403，NAAIM 自 2026-08 起要付費 |
| 小樣本事件研究（首次升息 n≈7、期中選舉 n≈19） | 永遠到不了 nEff≥30；頂多附 n 一起顯示 |
| 主觀情境機率（Evercore 30%、Yardeni 80→70%） | 沒有計分紀錄；我們只顯示市場隱含的區間（G18） |
| 依敘事追加指標（2026 年的利率衝擊） | 構想來自當下事件，事後想做事前登記已經不可能；GWZ 也顯示利率變數在月頻失效 |
| 策略師推翻自家訊號（Hartnett「不急著減碼」） | 我們的核心紀律是機率要誠實，敘事放在旁邊另外呈現 |

這些取捨站得住，是因為在一個月視角下基準率本來就幾乎打不敗。我們和投行的差距在於輸入的廣度與敘事脈絡，不在統計嚴謹度；在嚴謹度上，沒有任何一份賣方報告公布過樣本外 skill。

### 7. 完整性批評補上的缺口

**結構性缺口**

- **M0：補歷史是前提，但原本的差距清單沒有列。** 目前資料只有 10 年（`jobs.ts:256`），walk-forward 約 85 列，從 2019-09 起算。可以另外事前登記一個 1990 年前的壓力代理（例如 VXO 或已實現波動），但這個構想沒有驗證。
- **M1：基準率窗口沒有定案。** 1990 年起、2009 年起、部署中的 10 年窗口，三者的基準率可能差幾個百分點（2009 年起為 66.7–67.9%；長期數字沒有驗證）。這個差距大於多數條件效果。
- **M2：標籤定義。** `forecast.ts:62` 用的是價格指數，沒有算股息，也沒有現金門檻；學術基準看的是 equity premium。
- **M3：市場隱含基準。** N(d2) 可以作為第二個參考基準，但它是風險中性機率，會低估實際 P(up)。
- **M4：審查者之間的衝突。** 已在第 4 節逐列處理。G10 歸檔起點有兩種探測結果，可能是檔名後綴不規則造成的。
- **M5：** `forecast.ts:59` 的 `vix.onOrBefore` 沒有陳舊上限，VIX 斷線時會悄悄沿用舊值。

**沒涵蓋到的機構與指標**

- **季節性（11 月到 4 月）：** Jacobsen-Zhang 用 1693–2011 年 108 個市場的資料，冬半年比夏半年多 4.52%（t=9.69），作者也聲稱樣本外仍然成立 [67][68]。這是唯一有深厚證據的日曆類候選，已列為測試名額 2。
- **月初月底效應：** 每個 21 日窗口都恰好包含一次，沒有條件化的資訊 [69]。
- **FOMC 前漂移：** 只有 1–2 天，放到 21 日窗口就消失了 [70]。
- **總統、期中選舉週期：** n 太小 [71]。
- **淨流動性（WALCL−TGA−RRP）：** 證據屬於偽迴歸 [72]。
- **其他略過的項目：** 庫藏股靜默期、dealer gamma、NDR、Fidelity AART、增長通膨四象限、Citi Economic Surprise Index、SKEW、融資餘額。原因不外乎沒有免費的歷史版本、期限不對，或符號隨年代翻轉。
- **RBC（Calvasina）：** 用 5 個模型取中位數訂目標，是另一個組合預測的實例，支持「有 3 個以上 flag 之後再做 G07」[73]。

**資料品質提醒（`strategists.ts:19-32`）**

- Yardeni 表上寫 8400，有報導指出 9 月已下調到 7900 [26]。
- Wells Fargo 表上寫 7950，但 WF Securities（Kwon）已下調到 7700 [22]。WFII 是另一個部門，6 月的區間是 7800–8000 [74]，表格可能把兩個部門混在一起。
- BofA 可能已經改為 7400。
- 這些都沒有重新收集，請維護者對照原始報告。

**沒驗證過的東西**

- 多個 SSRN 與 macrosynergy 頁面回 403，G04、G14 的文獻只靠名聲背書。
- G06 引用的 duke 連結是錯的論文。
- Fisher-Statman、Brown-Cliff、EBP 的樣本外結果、Cederburg、Advisor Perspectives 2011 的全文都沒有開啟。
- 沒有人回頭檢查任何一家投行戰術呼叫的實際命中率（例如 Wilson 2022–23 年的呼叫）。
- **今天的 regime 狀態（SMA200 上下、VIX 水準、當下 basis）沒有算**，所以不知道上述改動會不會改變今天的輸出。

### 8. 參考來源

[1] https://www.goldmansachs.com/insights/articles/the-sp-500-expected-to-rally-12-this-year
[2] https://www.newsquawk.com/headlines/goldman-sachs-lifts-its-end-2026-sp-500-target-to-8000-prev-7600-amid-ai-driven-growth-following-a-strong-q1-reporting-season-
[3] https://stockwirex.com/?p=19158
[4] https://www.roic.ai/news/goldman-sachs-sounds-alarm-on-market-positioning-as-volatility-risk-mounts-10-19-2026
[5] https://investinglive.com/Education/fed-s-first-hike-since-2023-what-history-says-about-the-s-p-500-over-the-next-year/
[6] https://www.lpl.com/research/blog/how-stocks-performed-historically-after-initial-fed-rate-hikes.html
[7] https://www.finnewsnetwork.com.au/archives/finance_news_network3152234.html
[8] https://www.benzinga.com/node/62475470
[9] https://investinglive.com/es/actualizacion-del-mercado-bursatil/morgan-stanley-el-sp-500-oculta-un-mercado-debil-ya-que-mas-de-la-mitad-de-las-acciones-de-ee-uu-han-caido-un-20-desde-junio/
[10] https://ibkrcampus.com/?p=184159
[11] https://federalreserve.gov/econres/feds/files/2024049pap.pdf
[12] https://www.newsquawk.com/headlines/bofa-says-its-sell-side-indicator-was-unchanged-at-562-in-june-its-highest-since-february-2025-as-strategists-kept-equity-allocations-steady
[13] https://www.tickmill.com/blog/institutional-insights-bofa-sell-side-indicator
[14] https://www.roic.ai/news/bofas-hartnett-warns-of-imminent-risk-off-period-as-inflation-yields-bite-10-16-2026
[15] https://www.itiger.com/news/1142930936
[16] https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFII10
[17] https://www.morningstar.com/news/marketwatch/2025121518/the-last-major-wall-street-bank-to-set-its-2026-target-forecasts-double-digit-gains-for-the-sp-500
[18] https://www.advisorperspectives.com/articles/2011/08/02/does-citigroup-s-panic-euphoria-model-work
[19] https://finance.yahoo.com/news/jpmorgan-sees-sp-500-reaching-7500-in-2026--or-surging-past-8000-if-the-fed-keeps-cutting-rates-142602366.html
[20] https://www.cnbc.com/2026/06/24/jpmorgan-hikes-2026-sp-500-target-but-sees-hurdles-ahead-for-stocks.html
[21] https://www.cnbc.com/2026/09/09/barclays-raises-sp-500-year-end-target-citing-standout-earnings-driven-by-ai.html
[22] https://247wallst.com/investing/2026/09/24/wells-fargo-says-the-ai-spending-math-breaks-in-2028-and-just-cut-its-sp-500-target-to-7700/
[23] https://www.roic.ai/news/evercores-emanuel-sees-sp-500-hitting-9000-in-bull-case-08-17-2026
[24] https://www.roic.ai/news/ubs-lifts-sp-500-targets-sees-bull-run-extending-into-2027-08-21-2026
[25] https://www.kitco.com/news/off-the-wire/2026-09-08/hsbc-lifts-sp-500s-year-end-target-8100-earnings-strength
[26] https://www.roic.ai/news/yardeni-cuts-sp-500-target-to-7900-as-market-risks-rise-10-15-2026
[27] https://alphaarchitect.com/2017/05/fight-the-fed-model/
[28] https://www.ivo-welch.org/home/card-eqpredict.html
[29] https://sfi.ch/en/publications/a-comprehensive-2022-look-at-the-empirical-performance-of-equity-premium-prediction
[30] https://www.nationwide.com/financial-professionals/blog/markets-economy/articles/be-skeptical-of-stock-market-predictions-for-the-coming-year
[31] https://www.livewiremarkets.com/wires/don-t-listen-to-wall-street-if-you-want-to-know-what-markets-will-do-in-2025
[32] https://atranicapital.substack.com/p/week-43-market-update-for-october-13c
[33] https://investinglive.com/central-banks/icymi-citi-now-expects-a-december-fed-rate-hike-after-hotter-september-us-inflation/
[34] https://macenews.com/bofa-global-research-fund-manager-survey-lower-growth-and-lower-inflation-expectations-lead-to-tweaking-of-asset-allocations-in-october/
[35] https://fortune.com/2025/12/19/stocks-bank-of-america-warns-contrarian-sell-signal
[36] https://www.investing.com/news/stock-market-news/bofas-hartnett-sees-sell-signal-for-risk-assets-but-no-rush-to-cut-exposure-4706152
[37] https://www.kucoin.com/blog/us-stocks-q4-2026-ctas-unwind-longs-as-buyback-authorizations-hit-1-3-trillion
[38] https://www.tickmill.com/blog/institutional-insights-deutsche-bank-investor-flows-positioning-20426
[39] https://profiles.wustl.edu/en/publications/forecasting-the-equity-risk-premium-the-role-of-technical-indicat/
[40] https://macrosynergy.com/?p=41000（回 403，未開啟）
[41] https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2
[42] https://www.chicagofed.org/publications/blogs/chicago-fed-insights/2020/nfci-revisions
[43] https://www.cxoadvisory.com/?p=2041
[44] https://naaim.org/programs/naaim-exposure-index/faqs/
[45] https://nber.org/papers/w11468
[46] https://repec.cepr.org/repec/cpr/ceprdp/DP9377.pdf
[47] https://ideas.repec.org/a/oup/rfinst/v23y2010i2p821-862.html
[48] https://cfr.ivo-welch.info/published/papers/loeffler2021buyandhold.pdf
[49] https://papers.ssrn.com/abstract=2677212
[50] https://ideas.repec.org/a/eee/jfinec/v135y2020i3p774-794.html
[51] https://www.nber.org/papers/w10009
[52] https://www.bauer.uh.edu/departments/finance/documents/seminars/Johnson_020712.pdf
[53] https://www.lehigh.edu/~xuy219/research/COWY.pdf
[54] https://ideas.repec.org/a/oup/rfinst/v28y2015i3p791-837..html
[55] https://ideas.repec.org/a/taf/apeclt/v17y2010i9p869-874.html
[56] https://researchonline.lse.ac.uk/id/eprint/119144 ；https://papers.ssrn.com/abstract=2513152 ；https://papers.ssrn.com/abstract=2460551
[57] https://ideas.repec.org/p/fip/fedgif/855.html
[58] https://papers.ssrn.com/abstract=862285
[59] https://apps.dtic.mil/sti/html/tr/ADA459827/index.html
[60] https://publicreporting.cftc.gov/resource/gpe5-46if.json
[61] https://cdn.cboe.com/data/us/options/market_statistics/daily/2026-10-23_daily_options
[62] https://x.com/i/status/2112508880496238799
[63] https://x.com/i/status/2113597805679821101
[64] https://x.com/i/status/2107048155229630578
[65] https://x.com/i/status/2113260959837851693
[66] https://x.com/i/status/2114494495169642950
[67] https://www.bnains.org/backtest/periode/The_Halloween_Indicator_everywhere_and_all_the_time_-_Ben_Jacobsen_%26_Cherry_Y._Zhang.pdf
[68] https://blogs.cfainstitute.org/investor/2012/10/30/the-halloween-indicator-a-stock-market-anomaly-that-is-stronger-than-ever
[69] https://www.atlantafed.org/research/publications/wp/2000/11.aspx
[70] https://libertystreeteconomics.newyorkfed.org/2018/11/the-pre-fomc-announcement-drift-more-recent-evidence.html
[71] https://www.nber.org/papers/w23184.pdf
[72] https://eco3min.fr/en/net-liquidity-index-dataset/
[73] https://www.rbccm.com/en/insights/2025/06/tweaking-our-target
[74] https://www.kitco.com/news/off-the-wire/2026-06-16/wells-fargo-raises-year-end-sp-500-target-stronger-earnings-outlook
[75] https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAA10Y
[76] https://advantage.factset.com/hubfs/Website/Resources%20Section/Research%20Desk/Earnings%20Insight/EarningsInsight_101025.pdf
[77] https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10
[78] https://www.roic.ai/news/goldman-sachs-turns-bullish-on-both-stocks-and-bonds-10-12-2026
[79] https://www.roic.ai/news/morgan-stanleys-wilson-says-stock-selloff-nearing-end-but-no-bottom-yet-10-19-2026
[80] https://www.investinglive.com/stock-market-update/morgan-stanley-sees-rolling-recovery-driving-sp-500-to-7200-20250729/
[81] （刻意留空：BTZ 2009 的原文連結沒有核實）
[82] https://ECB.eu/pub/pdf/scpwps/ecbwp1675.pdf
[83] https://papers.ssrn.com/abstract=2089463
[84] https://www.etftrends.com/etf-strategist-channel/pulling-volatile-markets-can-lead-lost-gains/
[85] https://www.stonex.com/en-us/insights/the-vix-goldilocks-zone-what-volatility-can-tell-us-about-future-sandp-500-returns/
[86] https://longportapp.cn/news/295227962
[87] https://www.lpl.com/research/weekly-market-commentary/what-history-says-about-fed-hikes-and-stocks.html
[88] https://tech-insider.org/will-sp-500-increase-in-2026-prediction-market/
[89] https://goldmansachs.com/insights/articles/the-sp-500-may-rise-less-than-expected-as-gdp-growth-slows
[90] https://www.etf.com/sections/index-investor-corner/swedroe-why-financial-trends-persist