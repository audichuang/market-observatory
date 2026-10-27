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

| 條件 | 狀態 | 機制 | 退場規則 | 結果 |
| --- | --- | --- | --- | --- |
| 站上 200 日線 | 採用 | 趨勢延續／時間序列動能 | 補完歷史後，該 basis 的相位平均 BSS bootstrap 上界 < 0 即撤下。上線後紀錄的退場規則，待 live 不重疊列數足以算出檢定力後另行登記。 | 與基準率有微弱差異，樣本少 |
| VIX ≥ 30 | 在模型中，目前從未被選用 | 壓力期波動與方向的關聯 | 補完歷史後，該 basis 的相位平均 BSS bootstrap 上界 < 0 即撤下。上線後紀錄的退場規則，待 live 不重疊列數足以算出檢定力後另行登記。 | 部署的 10 年窗口（3660 天）只有 155 天 VIX ≥ 30，nEff≈7.4，低於 `MIN_EFFECTIVE_N`，`pickProbability` 一律退到 trend 或基準率；1990 年以來共 737 天（Cboe `VIX_History.csv`，算到 2026-10-23）。要先補歷史才可能用到 |
| 分析師目標價隱含漲幅 | 放棄 | — | — | 對一個月方向沒有穩定預測力 |
| 策略師年底目標 | 放棄 | — | — | 與實際報酬相關約 0 |
| 市場廣度（RSP/SPY 等） | 放棄 | — | — | 對一個月方向沒有穩定預測力 |
| VIX 期限結構 | 放棄 | — | — | 對一個月方向沒有穩定預測力 |
| VRP 取代 VIX ≥ 30 | 已否決（2026-10-26） | 風險趨避上升時保險溢酬較高，之後報酬較高（BTZ 2009） | 補完歷史後，該 basis 的相位平均 BSS bootstrap 上界 < 0 即撤下。上線後紀錄的退場規則，待 live 不重疊列數足以算出檢定力後另行登記。 | 參考模型 2026-10-g09（候選 2026-10-g09+vrp）。完整歷史，配對於交集：候選 404 列（1993-01-25..2026-09-10，history_start 1990-12-28，累積 252 個 VRP 值後才有 regime），格 403/405、捨去 2。配對相位平均 BSS −0.001 [−0.007, 0.005]；配對相位平均 Brier 差（候選−參考）+0.00022 [−0.00115, +0.00173]；決策用下界 MC 標準誤 0.0003（種子 1..5：−0.008, −0.007, −0.007, −0.008, −0.008）。L08 虛無門檻 0.007（20 個虛無值，種子 20261026+j：0.0016, −0.0017, −0.0021, −0.0014, −0.0019, −0.0006, −0.0001, −0.0050, −0.0017, −0.0005, −0.0007, −0.0002, −0.0007, −0.0040, 0.0002, −0.0012, −0.0035, 0.0069, −0.0006, 0.0029）。適用規則：點估計 ≤ 0 即否決；最終模型 = DEFAULT_MODEL。 |
| 11 月–4 月季節性 | 已否決（2026-10-26） | 跨市場冬半年效應（Jacobsen-Zhang） | 補完歷史後，該 basis 的相位平均 BSS bootstrap 上界 < 0 即撤下。上線後紀錄的退場規則，待 live 不重疊列數足以算出檢定力後另行登記。 | 參考模型 2026-10-g09（名額 1 否決，沿用 vix 與跳過規則；候選 2026-10-g09+season）。完整歷史 416 列（1992-01-28..2026-09-11），格 415/417、捨去 2。配對相位平均 BSS −0.002 [−0.006, 0.002]；配對相位平均 Brier 差（候選−參考）+0.00040 [−0.00052, +0.00127]；決策用下界 MC 標準誤 0.0001（種子 1..5：−0.006, −0.005, −0.006, −0.006, −0.006）。L08 虛無門檻 0.002（20 個虛無值，種子 20261026+j：0.0002, −0.0003, −0.0010, −0.0001, −0.0036, −0.0059, −0.0004, −0.0029, −0.0011, −0.0024, −0.0012, −0.0002, −0.0014, −0.0008, −0.0011, −0.0003, 0.0000, 0.0016, −0.0013, 0.0003）。適用規則：點估計 ≤ 0 即否決，且未高於 L08 門檻；最終模型 = DEFAULT_MODEL。 |
| M0 補歷史 | 已完成（2026-10-26 正式站） | — | — | Cboe SPX 1975 起補 10,548 列、VIX 1990 起補 6,698 列；SPX 重疊核對通過。walk-forward 由 85 列增為 416 列（1992-01-28 起）。 |
| M1 窗口 | 已採用（model 2026-10-m1m5） | — | — | 正式站 historyStart = 1990-01-02；基準率由 10 年窗口的 68.5% 變為 64.0%。 |
| M5 VIX 日期對齊 | 已採用（model 2026-10-m1m5） | — | — | 1990 年以來 VIX 最多落後 SPX 1 個交易日，未改變任何歷史 regime。 |
| G01 收縮 | 已採用（2026-10-26，model 2026-10-g01） | — | — | 已採用（2026-10-26）。完整歷史 416 列（1992-01-28..2026-09-11），配對相位平均 Brier 差（收縮−硬切換）−0.00073 [−0.00229, +0.00080]，下界 MC 標準誤 0.00003；未達否決門檻。收縮後相位平均 BSS +0.003 [−0.003, +0.010]，仍偵測不到 skill。附帶：硬切換模型在完整歷史上 BSS = 0（從未偏離基準率）。k=20／80 敏感度方向一致，不用於決策。 |
| G03 方向門檻 | 已採用（2026-10-26，model 2026-10-g03g08） | — | — | 全域相位平均 BSS 不變（只改出結論條件）。完整歷史 416 列：方向判定 0 up／0 down／416 inconclusive，與 G03 前相同。列數 ≥ 30 且段數 ≥ 8 的 cell 只有「站上 200 日線、VIX<30」（223 列、18 段，bssLow −0.004）與「跌破 200 日線、VIX<30」（43 列、17 段，bssLow −0.086）。 |
| G04 MIN_EPISODES | 已採用（2026-10-26，model 2026-10-g04） | — | — | 正式站 10 年窗口：所有 walk-forward 列都退回基準率（85 列，BSS 0）。完整歷史（G01 試驗的 hard 變體）：416 列，BSS 0，從未偏離基準率。 |
| G08 bootstrap 與 MDE | 已採用（2026-10-26，model 2026-10-g03g08） | — | — | 採用條件 (1)–(4) 的合成測試全部通過。完整歷史：BSS 0.001 [−0.007, 0.009]，最小可偵測 BSS 0.011。 |
| G09 dd5 回撤目標 | 已採用、計分（2026-10-26，model 2026-10-g09） | — | — | 完整歷史 416 列：BSS 0.049 [0.016, 0.083]，MDE 0.047；相位平均 0.038 [0.014, 0.064]，下界 MC 標準誤 0.0002。今日 cell（站上 200 日線、VIX<30）nEff 328、24 段 → scored。as-of 2026-10-23：P(dd5) 11.9%（基準 16.6%）。審查以獨立 Python 重算得 BSS 0.0488。對照：不收縮的硬切換模型 bssLow −0.001，不會通過。 |
| L01 相對基準率的方向語意 | 已採用（2026-10-26，model 2026-10-l01） | — | — | 方向改以基準率為界（高於平常／低於平常），API 的 call 值不變；移除以 50% 為界的命中率。完整歷史上 G03 判定全為 inconclusive，故不改變任何已記錄的判定。同批上線：L09 三種分數分開呈現、L11 自然頻率（每 100 次）、L12 四個固定檢查項、L16 幣別副標、L17 定投說明。 |

前六列是模型最初版本（2026-10-25）的研究結論，當時的回測數字沒有留存。

名額 1、2 都已否決，最終模型 = DEFAULT_MODEL（2026-10-g09）不變。`VRP_MODEL` 與 `SEASON_MODEL` 仍保留在 `src/lib/forecast.ts`，作為非預設變體（`scripts/backtest.ts --offline --as-of 2026-10-23 --target up --variant base,vrp --null` 與 `base,season`）供重現。

## 事前登記（2026-10-26）

這一節在任何新回測之前寫下，commit 時間即為證明。以下都是規則，不是建議。結果出來後不得改門檻；要改只能另開新條目並註明原因。

本節與下方研究章節衝突時，以本節為準。

### 決策

| 編號 | 規則 |
| --- | --- |
| D1 窗口 | 基準率與所有條件都只用 1990-01-02 起、regime 不為 null 的觀測（expanding，不滾動）。SPX 1975–1989 只用來暖機 200 日線。每筆預測記錄 `history_start`。 |
| D2 標籤 | 維持「21 個交易日後收盤高於今天」（美元、不含股息的價格指數）。「勝過現金（含股息）」延後，等有股息與短期利率資料。 |
| D3 舊版 App | 採用收縮後，舊版 App 會在 p≠基準率時仍顯示「採歷史基準率」。接受此落差，直到 iOS 更新。 |
| D4 回撤目標 dd5 | t+1..t+21 任一收盤 ≤ 今天收盤 × 0.95 即為 1（以今天收盤為起點的最大跌幅 ≥ 5%）。t+21 收盤後才已知。 |
| M5 VIX 對齊 | 使用的 VIX 最多比 SPX 日期舊 3 個 SPX 交易日，否則該日 regime 為 null（不產生預測）。 |

### 模型規則

| 編號 | 規則 |
| --- | --- |
| G04 | `MIN_EPISODES` = 8。條件成立的日子，若距上一個成立日 ≥ 21 個交易日，算新的一段。候選條件需 nEff ≥ 30 且段數 ≥ 8；基準率不受此限。無條件採用。 |
| G01 收縮 | p = (k·p_base + n·p_cond)/(k+n)，k = 40，n = cond.nEff。k = 20、80 只做敏感度分析，不用來挑選。採用規則：配對 Brier 差（收縮 − 硬切換）的 95% 區間下界 > 0（顯著變差）才否決，否則採用。 basis 為 base 時 p = p_base。否決用相位平均的配對 Brier 差，區間依 L02 方法。 |
| G03 方向 | 要給方向須同時滿足：(a) pick.distinct；(b) cell = 今天所選候選條件的各旗標及其值（例如 aboveSma200=true、vixStress=false），basis 名稱只是標籤，驗證一律以 cell 為單位；在現行單一相位（offset 0）walk-forward 中，屬於該 cell 的列數 ≥ 30；(c) 在 offset 0 walk-forward 的列序列裡，相鄰列都屬於該 cell 的最長連續區間，數量 ≥ 8；(d) 該 cell 的 bssLow > 0：對全部 walk-forward 列做 G08 stationary bootstrap，每次重抽只用屬於該 cell 的列計算 BSS，取 2.5% 分位。採用：全域相位平均 BSS 不變即採用（它只改出結論條件，不改 p）。 |
| G08 不確定度 | stationary bootstrap，平均區塊長 6 列，2000 次重抽，固定種子（不依賴列數）。最小可偵測 BSS（MDE）= 2.8 × BSS 的 bootstrap 標準差；標準差為 0 時為 null。UI 把「不確定」改成「偵測不到 skill（最小可偵測 BSS 約 X）」。 採用：(1) 新增一組合成測試，trend 兩側各有至少 8 段（段與段相隔 ≥ 21 個交易日），在 G04 生效下 p 與基準率可區分、walk-forward BSS > 0；(2) 隨機漫步序列在每個相位都是 inconclusive；(3) `tests/forecast.test.ts` 原本段數不足的 regime fixture 改為斷言 G04 生效時退回基準率。三項都通過才採用，否則否決。 |
| L01 方向語意 | 方向判斷相對基準率：conclusive 時 p > base 叫「高於平常」，p < base 叫「低於平常」，不再以 50% 為界。API 的 call 值仍是 up/down/inconclusive（App 相容），只改語意與文字。 |
| G09／L04 | dd5 是第二個計分目標，排在補歷史與預測紀錄之後優先做。採用條件：該目標 bssLow > 0，且所用 cell nEff ≥ 30、段數 ≥ 8；否則只顯示並標「未通過驗證」。21 日報酬第 10／50／90 百分位只顯示、不計分。 |

### 評估規則（所有採用比較都適用）

| 編號 | 規則 |
| --- | --- |
| 配對 | 變體一律在參考變體的同一批日期上配對比較，報告被丟掉的日期數。 配對比較時，兩變體用來估計基準率與條件機率的歷史觀測都只取兩者 regime 皆不為 null 的日子（交集）。 |
| L02 相位 | 主要結果是相位平均 BSS：offset 0..20 各自做不重疊 walk-forward，各算 BSS 後取平均（不是把所有相位的列合併算一個 BSS）。區間：burn-in 結束後每 21 個交易日為一格，每格各相位至多一列；以 G08 參數的 stationary bootstrap 對格的索引重抽（各相位用同一組格），每次重抽各相位算 BSS 再平均，取 2.5%／97.5% 分位。最後一格若有相位缺列，該格整格捨去。同時報告各相位 BSS 的最小～最大值。 |
| L03 MC 誤差 | MC 標準誤 = 以種子 1..5 各跑一次 bootstrap 得到的 5 個下界之標準差（不除以 √5）。下界的絕對值 < 2 × MC 標準誤時視為「不確定」，不算通過。決策用 G08 的固定種子 20261026。 |
| L08 搜尋折扣 | 試驗名額的虛無分佈：產生 20 組虛無序列，第 j 組用種子 20261026+j。每組把 1990-01-02 起每日觀測的上漲標籤以區塊置換，區塊長 = 21 × b 個交易日，b 由該組種子在 {6,…,12} 均勻抽出；regime 與 knownOn 不動。每組跑該名額的參考模型與候選模型，計算相位平均配對 BSS（定義見名額規則）。門檻 = 20 個虛無值中的最大值（偽通過率約 1/21）。 |
| 名額上限 | 這一輪最多 2 個新 flag。 |


### 增補一（2026-10-26，G03／G08 測試與任何完整歷史回測之前）

審查第 3 輪留下的三個未定義處，在相關測試跑之前補上：

| 編號 | 規則 |
| --- | --- |
| G03 空重抽 | (d) 的 bootstrap 重抽中，若該 cell 沒有任何列，該次重抽跳過、不計入分位。有效重抽少於 1900 次（2000 次的 95%）時，bssLow 視為 null，不給方向。 |
| G08 正向對照 | 採用條件加第 (4) 項：一組訊號強、且滿足 G04 與 G03 (b)(c) 門檻的合成序列，必須得到 bssLow > 0 並給出方向。四項都通過才採用。 |
| 配對日期 | 「參考變體的同一批日期」指取交集之後的參考模型，以它自己的 burn-in 與格線產生的日期；候選模型的暖機期因此可能讓參考模型少掉最早幾格，報告被捨去的格數。 |

### 試驗名額

| 名額 | 定義 | 候選順序 | 採用與否決 |
| --- | --- | --- | --- |
| 1：G06 VRP（取代 `vixStress`，不新增） | VRP_t = VIX_t²/12 − Σ_{k=0..20}(100·ln(S_{t−k}/S_{t−k−1}))²。VRP 高於「1990-01-02 起到今天（含）的 expanding 中位數」為 true；累積 252 個 VRP 值前為 null。 | [[trend, vrp],[vrp],[trend]]，不跳過任何一側 | 配對 BSS = 1 − Brier(候選)／Brier(參考)，在同一批日期上計算。參考模型 = 執行當下的 DEFAULT_MODEL（記下其 version）。採用：相位平均配對 BSS 的 bootstrap 下界 > 0，且高於 L08 門檻；候選條件的選用仍受 G04（nEff ≥ 30、段數 ≥ 8）約束。否決：相位平均配對 BSS 點估計 ≤ 0。不論結果都記入試驗登記。 |
| 2：季節性 winter | 11–4 月為 true，basis 為 `season`。 | [[trend,vix,winter],[trend,vix],[vix],[trend,winter],[winter],[trend]] | 同名額 1。 |

執行順序：名額 1 先定案，名額 2 的參考模型是名額 1 定案後的 DEFAULT_MODEL。若 VRP 採用，名額 2 候選順序中的 vix 一律改為 vrp，且不跳過任何一側；否則沿用現行 vix 跳過規則。basis 名稱為成員以 + 連接（如 trend+vix+season）。winter 以預測日 t 的月份判定。最終模型 = 名額 2 定案後的 DEFAULT_MODEL。未達採用條件的任何結果（包括點估計 > 0 但下界 ≤ 0、未高於 L08 門檻、L03 判為不確定、統計量無法計算）一律視為否決：保留參考模型，該名額即定案。

機制與事前驗屍（L13）：

| 名額 | 機制 | 最可能的失敗方式 |
| --- | --- | --- |
| VRP | 風險趨避上升時，投資人為保險付出較高溢酬，之後報酬較高（BTZ 2009，樣本內為主）。 | 與 VIX 高度重疊；壓力段數不足。 |
| 季節性 | Jacobsen-Zhang 跨市場冬半年效應。 | 1990 年後效應衰退；只是 2 個 cell 的分割。 |

退場規則：補完歷史後，該 basis 的相位平均 BSS bootstrap 上界 < 0 即撤下。上線後紀錄的退場規則，待 live 不重疊列數足以算出檢定力後另行登記。

### 責任與呈現

| 編號 | 規則 |
| --- | --- |
| L09 | 頁面與文件分開呈現三種分數：樣本內、walk-forward、上線後實際紀錄（只用不重疊的列），永不合併。 |
| G02 | 預測紀錄寫入後不可改（同一交易日第一次寫入為準），記 `model_version`、`regime`、`cond_p`、`cond_n_eff`、`bss_low`、`history_start`、`detail`（JSON）。 |
| L16 | 頁面副標寫明「以美元計、不含股息的 S&P 500 價格指數；台幣結果另受匯率影響」。 |
| L17／X03 | 頁面固定一句「對每月定期定額：這不是加碼或停扣的訊號，它描述下個月可能的波動」。不提供依風險調整扣款的建議（X03）。 |

## 事前登記（第二輪，草稿，未合併前不得執行）

> **本節合併進 main 即為登記；登記日 = 合併 commit 的日期。執行名額 A 之前，試驗登記的名額 A 列必須先寫上這個合併 commit 的 hash，沒有 hash 不得執行。** 合併前本節只是草稿，不得據以做任何計算。

以下都是規則，不是建議。結果出來後不得改門檻；要改只能另開新條目、註明原因與生效日。本節修改第一輪規則時，一律以新編號條目寫（L08 增補二、G09 修訂一），不改第一輪原文；第一輪試驗登記的結果與其重現方式（20 個虛無值）保持原樣。優先順序：本節 > 第一輪事前登記（含增補一）> 下方研究章節。未提到的規則沿用第一輪。

依據：`docs/research-2026-10-27/proposal.md` §5.2 的草稿，以及 `docs/research-2026-10-27/codex-review.md` 對 §5.2 與 M-01..M-07、D-02、D-03 的修改；兩者不一致時以 codex-review.md 為準。

### 外部接觸與既有暴露（非試驗）

下列結果在本節登記之前已被看過或已被程式算出並存下。它們不是試驗，但會影響候選的選擇與解讀，所以如實記錄；這些暴露不可逆，不能事後重新描述成「未看過」。

| 日期 | 看過的目標 | 期間 | 看過什麼 | 來源 |
| --- | --- | --- | --- | --- |
| 2026-10-27 | dd5（相對 expanding 基準率的 BSS） | 1992-01-02..2025-11-10 | 外部研究 P3 比較了 6 個波動基準：raw VIX（連續監測兩種 drift、每日收盤）、以過往 variance ratio 校正的 VIX、trailing 21 日 RV、EWMA λ=0.94。P3 自算點估計：校正 VIX 0.064、trailing RV 0.052、EWMA 0.056（區間皆跨零），raw VIX 每日收盤 −0.010、連續監測為負。試算包不可取得，數字無法核實。資料、日期、實作與評分方式都與本專案不同，**不得與 incumbent 的 0.049 或 0.038 比較**，也不得用來排序候選。研究 LLM 與本專案協調者都看過。 | `docs/research-2026-10-27/results/P3-drawdown.md` |
| 2026-10-27 | 21 日漲跌與 dd5，條件為「策略師發出看多／看空呼叫」 | 2018-01..2026-10 | 協調者自訂規則、未事前登記，對 99 筆便利樣本呼叫做描述性計分（可計分 75 筆）。進場 = 發布後第一個交易日收盤；dd5 = 進場後 21 日內任一收盤 ≤ 進場收盤 × 0.95。看空後 dd5 發生率 9/43 = 20.9%（同期基準 18.1%）；看多 21 日命中 18/27、看空 12/43（基準 67.2%／32.8%）。 | `docs/research-2026-10-27/scripts/score-calls.mjs`、`results/P5-tactical-calls.md`、`results/P7-youtube-gemini.md`、proposal.md §4 |
| 2026-10-26 起 | dd5 的 per-cell 驗證（cell 的列數、段數、bssLow） | 1990-01-02 起的完整歷史與正式站每日紀錄 | 現行程式每次評估都會算 dd5 的 cell 診斷：`evaluateRows` 一律呼叫 `cellEvaluations`（`src/lib/forecast.ts:523`），`scripts/backtest.ts` 在 `--target dd5` 時印出所用 cell 的 cellGate（標「僅參考」），`recordForecast` 把 `detail.drawdown.cellGate` 存進每筆預測紀錄（`src/server/jobs.ts:549`）。因此 **不能宣稱 G09 修訂一是在任何 per-cell dd5 BSS 計算之前定的**；本節只能宣稱門檻數字沿用第一輪 G03 的 30／8 與增補一的 1900，沒有依 dd5 的 cell 結果另選。 | 程式本身 |

沒有可用的保留期：P3 看到 2025-11-10，之後只有約 11 個不重疊列。名額 A 即使通過，也只是「經探索選出的回溯驗證」（R2-1）。

### 規則

| 編號 | 規則 |
| --- | --- |
| R2-0 名額上限 | 第一輪的「最多 2 個新 flag」屬於第一輪。第二輪最多 1 個新 flag（名額 A），目標只限 dd5。這是研究預算的決定，不是「P(up) 不可能改善」的統計結論：本輪不花名額在 P(up)；日後要開 P(up) 名額，須另開一輪，並先寫出預期效果大於 MDE 0.011 的理由。 |
| R2-1 波動族與政策性加嚴 | 「波動族」指任何以已實現或隱含波動定義的 dd5 條件，包括 trailing RV、EWMA、校正 VIX、raw VIX 的任何變換。波動族候選的 L08 採用門檻為 p ≤ 0.025（R2-3），一般候選為 p ≤ 0.045。0.025 是**事前承諾的政策性加嚴**，不是對六個探索模型或未知搜尋歷程的校正，不得宣稱它已消除偷看的影響。波動族候選即使通過全部採用條件，紀錄與頁面一律標「經探索選出的回溯驗證」，直到依 R2-6 累積凍結版本的前瞻紀錄。若名額 A 被否決：不得在同一段歷史上換窗口長度、換分位切點或換變換再測同族條件；日後的波動族研究須另有登記的不同機制，或只用前瞻資料檢驗。這不是永久禁止所有波動研究。 |
| R2-2 策略師呼叫排除 | 「策略師或銀行的看空／看多呼叫」及其衍生（含 B&B、FMS 訊號）不登記為 P(up) 或 P(dd5) 的候選條件。這是**產品範圍與維護成本的決定**（模型只用可自動、可回溯取得的價格資料；呼叫的期限、條件與發布時點無法機械判定），不是統計結論：上方那份便利樣本不能證明所有策略師訊號永遠無效。要重開須另行登記，先說明資料來源全集、收集方式與計分規則。 |
| R2-3 L08 增補二（dd5 標籤的虛無分佈） | 適用於第二輪的 dd5 名額。虛無序列：把 1990-01-02 起每日觀測的 **dd5 標籤**以區塊置換，區塊長 = 21 × b 個交易日，b 由該組種子在 {6,…,12} 均勻抽出；regime 與 knownOn 不動。**參考模型與候選模型在同一組虛無序列上執行（同一個置換）**，計算相位平均配對 BSS（L02，以 label = dd5）。虛無組數 N = 199，固定；第 j 組種子 20261026+j（j = 1..199）。b = #{虛無值 ≥ 觀測值}（相等算入），p = (1 + b) / (N + 1) = (1 + b) / 200。一般候選需 p ≤ 0.045（等於 b ≤ 8）；波動族候選需 p ≤ 0.025（等於 b ≤ 4，即觀測值嚴格大於第 5 大的虛無值）。不得在結果接近門檻時追加抽樣、換種子或改 N。任何一組虛無值無法計算時，該組不剔除也不補抽，整個名額視為「統計量無法計算」而否決。第一輪名額 1、2 的重現維持原 L08 的 20 組（門檻 = 最大值），不用本條改算。 |
| R2-3a 虛無的限制 | 199 組只提高 p 的解析度，不讓區塊置換成為精確檢定：置換打亂了標籤與所有 regime 的關係，連參考模型既有的 dd5 訊號也一併消除，所以它不完全對應「候選沒有增額價值」的虛無假設，區塊置換也只近似保留時間相依。本條把它定位為**已登記的搜尋閘門**，不得只憑 (1+b)/(N+1) 公式宣稱整個程序精確。第一次在 SPX／VIX 上使用前，須先在合成資料（候選與標籤無關、參考有訊號）上跑一次，報告誤通過率；這個檢查只用合成資料。 |
| R2-4 dd5 主報 | 遵循 L02：今後 dd5 的採用與否決一律用相位平均。`drawdownScored` 的 live gate 維持 offset 0 單一相位，兩者並列時明確標示「單一相位（offset 0）」。G09 列不改寫，也不混用相位。0.038 [0.014, 0.064]（相位平均）與 0.049 [0.016, 0.083]（offset 0）是 as-of 2026-10-23 的已登記結果，頁面引用時要附日期，不得寫成頁面常數。 |
| R2-5 G09 修訂一（dd5 cell 閘門） | 規則變更：dd5 標「已計分」須同時滿足 (a) 第一輪 G09 的全域條件（全域 bssLow > 0、所用 cell nEff ≥ 30、段數 ≥ 8）；(b) 今天所選 cell 在 offset 0 walk-forward 的列數 ≥ 30；(c) 該 cell 在 offset 0 walk-forward 列序列中的**連續區段個數** ≥ 8（相鄰列都屬於該 cell 的一段算一個，數段數，不是最長一段的長度）；(d) 該 cell 的 dd5 bssLow > 0：以 G08 stationary bootstrap **先重抽完整的 walk-forward 列序列，再篩出屬於該 cell 的列**計算 BSS，取 2.5% 分位；某次重抽沒有該 cell 的列就跳過，有效重抽 < 1900 次時 bssLow 為 null，視為不通過。30、8、1900 沿用 G03 與增補一，不是推導，也不是依 dd5 的 cell 結果選的。不通過時 p 照常顯示，標「未通過驗證」。不設 dd5 事件群數下限（proposal 草稿的 (e) 刪除：在 offset 0 每 21 日一列的格線上，它幾乎等於「正例列數 ≥ 8」，擋不住單一危機主導）；若日後需要危機群閘門，須先另定每日事件群與歸屬方法再登記。版本與追溯：上線時 `DEFAULT_MODEL.version` 要升，並在試驗登記新增一列「G09 修訂一」，寫明生效日（上線 commit 的日期）與版本；生效日之前的紀錄照原 G09 判定，不重算。每筆紀錄的 `detail.drawdown` 要能看出 (a)–(d) 各項的值與未通過的原因。 |
| R2-6 dd5 前瞻紀錄（L09 第三種分數） | 資格：只有「即時發布」的列計入前瞻紀錄。即時發布 = `forecasts` 列的 `detail.recordedLagSessions` 為 0（該次排程寫入時，這一天就是最新的 SPX 交易日）且 `detail.drawdown.p`、`detail.drawdown.base` 都存在。`recordForecast` 會補記最近 5 個交易日（`FORECAST_CATCHUP_SESSIONS`，`src/server/jobs.ts:507`），補記列雖把價格截到預測日，仍可能用到之後的程式版本與修訂資料，所以 `recordedLagSessions` ≥ 1 的列是「延遲補記」，缺這個欄位或缺 drawdown 的列是「資格不明」：兩者都保留原始紀錄（G02 不可改），不計入前瞻分數，另外報告各自的列數。格線：從第一筆即時發布列的交易日起，每 21 個 SPX 交易日一個格點；格點當天沒有即時發布列就略過，不遞補相鄰日、不改用補記列。標籤 = 該列交易日之後 21 個 SPX 交易日內任一收盤 ≤ 0.95 × 該列存下的 `close`（D4），第 21 個交易日收盤後才計（成熟日）。計分：Brier、相對該列存下的 `detail.drawdown.base` 的 BSS、計分列數 n；n < `LIVE_MIN_N`（12）時顯示「樣本太少」、不報 BSS。列出計分列涵蓋的 `model_version`，不默默跨版本合併。前瞻紀錄只顯示，不作退場依據；退場檢定另行登記，登記時須附檢定力論證（可用合成資料），不以固定列數（例如 300 列，約 25 年）作為唯一觸發條件。 |
| R2-7 dd5 校準診斷（描述性） | 只對已採用的 dd5 模型做，不對候選做。固定輸入：與名額 A 相同的資料快照與 as-of（見名額 A 的 reference 固定）；offset 0 單一相位與 21 個相位各自報告，相位平均另列。內容：calibration-in-the-large（平均預測 − 實際發生率）；**clipped log score**（p 先截到 [0.005, 0.995]，名稱一律寫 clipped log score）；4 個 bin 的可靠度表，邊界為 [0, 0.10)、[0.10, 0.15)、[0.15, 0.25)、[0.25, 1]，每格列數、事件數、段數（G04 定義）；分 bin 的 Murphy 分解，標明它是分 bin 近似，不等於原始連續機率 Brier 的精確分解（expanding 基準的 resolution 接近 0、不是剛好 0）。bin 邊界是在已知 as-of 2026-10-23 的 P(dd5)=11.9%、基準 16.6% 之後才定的，照實註明。結果只寫進試驗登記的結果欄，不上頁面；**永不用來挑門檻、bin、窗口或做採用、否決、調參**。 |
| R2-8 EWMA 比較 | 延後，不在本輪。現有草稿缺 variance 遞迴式、初始化日期與初值、當日報酬納入時點；BGK 修正也只是離散監測的近似。要做須另行完整登記，並寫明它永不用來挑下一個候選或改模型；在那之前不在 SPX／VIX 歷史上計算任何 EWMA 首達機率。 |
| R2-9 組合方法（M-06） | 第一輪草稿「第 3 個 flag 通過後自動採等權組合」的承諾不採用：第 3 個 flag 通過不代表等權組合也通過，扣除基準 log-odds 也不能消除成分相關性。日後任何組合方法本身都要獨立登記、獨立檢驗。 |
| R2-10 證據等級更正（M-07） | 不是規則，不需登記；在 §2.1、§3 另外更正（BTZ → academic_is；tchi 與 Huang 的 OOS 數字；Christoffersen–Diebold 為全樣本、C&D 用 GARCH 非 VIX；Citi 降為 anecdotal）。Chronopoulos 2018 只寫「數值與公式／表格的一致性待釐清，不可換算成本站 BSS」，不寫「不符 Brier 尺度」（Brier 可介於 0 與 1）。 |

### 試驗名額

| 名額 | 定義 | 候選順序 | 採用與否決 |
| --- | --- | --- | --- |
| A：`rvHigh` 取代 dd5 模型的 `vixStress`（波動族） | RV_t = Σ_{k=0..20}(ln(S_{t−k}/S_{t−k−1}))²，共 21 個平方 log 報酬，**含當日 t**；S 為 Cboe SPX 收盤（M0 已補，不用 Yahoo）。`rvHigh` = RV_t 高於「1990-01-02 起到 t（含 t）所有 RV 值的 expanding 中位數」；累積滿 252 個 RV 值之前為 null（regime 為 null 的日子不產生預測，依 D1）。新增獨立的 `DD5_MODEL`（自己的 version 字串），P(up) 用的 `DEFAULT_MODEL` 不動。只評估 P(dd5)：**不計算、不報告 `rvHigh` 在 P(up) 上的任何結果**；執行前 `scripts/backtest.ts` 必須改成只走指定 target 的路徑（現行 `--target dd5` 會經 `buildOutlook` 順便算 up 的 pick 與評估），這項改動只用合成資料測試。 | 固定為 [[aboveSma200, rvHigh],[rvHigh],[aboveSma200]]，不跳過任何一側；G01 k = 40、G04（nEff ≥ 30、段數 ≥ 8）、M5 照舊。配對時兩模型都只用兩者 regime 皆不為 null 的日子（交集訓練），在參考模型的格線上配對（共同格線，增補一「配對日期」），報告捨去的格數。 | 主要終點：dd5 的相位平均配對 BSS = 1 − Brier(候選)／Brier(參考)，label = dd5。採用：(1) 相位平均配對 BSS 的 bootstrap 下界 > 0（L02，固定種子 20261026）；(2) R2-3 的 p ≤ 0.025（b ≤ 4）；(3) L03 不判為不確定；三者都成立。否決：任何一項未達成（含點估計 > 0 但下界 ≤ 0、統計量無法計算）。通過也標「經探索選出的回溯驗證」（R2-1）。不論結果都記入試驗登記。 |

名額 A 的 reference 固定（執行前寫進試驗登記名額 A 列，寫不齊不得執行）：

| 項目 | 固定為 |
| --- | --- |
| 登記 | 本節合併 commit 的 hash |
| 執行程式 | 實作 `DD5_MODEL` 與 target 隔離的 commit hash；執行時工作目錄無未提交變更 |
| 參考模型設定 | 執行當下的 `DEFAULT_MODEL`，記下其 version；決定 p 的欄位必須等於登記時的值：flags = aboveSma200（close > 200 日線）、vixStress（VIX ≥ 30）；candidates = [[aboveSma200, vixStress],[vixStress],[aboveSma200]]；minEffectiveN 30；minEpisodes 8；shrinkK 40；bootstrap stationary、平均區塊 6、2000 次、種子 20261026；baseWindowStart 1990-01-02；vixMaxStaleSessions 3。任何一項不同就不得執行，須另行登記。 |
| 資料截止 | `--as-of 2026-10-23`（與第一輪及 G09 列相同） |
| 輸入資料 | 與 `docs/research-2026-10-27/data-snapshot.md` 同一份 Cboe CSV，執行時在試驗登記照同一格式記錄並比對：`SPX_History.csv sha256 9a2d92ae30eb4d440de1475c1ea1218881f93ace4c315bba86c33ffe55c47f98 rows 13063 range 01/02/1975..10/26/2026`、`VIX_History.csv sha256 8e67801e46bab11ab543ac8d575544db4e8cd6fd7e4c7e9dc419b498de8a77ff rows 9302 range 01/02/1990..10/26/2026`。雜湊不符就不得執行。 |
| 指令 | `node scripts/backtest.ts --offline --as-of 2026-10-23 --target dd5 --variant <ref>,<cand> --null`，虛無組數與種子依 R2-3（腳本須能明確指定 N = 199，並保留第一輪 N = 20 的重現方式） |

機制與事前驗屍（L13）：

| 名額 | 機制 | 最可能的失敗方式 |
| --- | --- | --- |
| A | 波動聚集：近期實現波動高時，未來 21 日觸及 −5% 的機率上升（Risk Everywhere 的 variance OOS；零 drift 下首達機率隨 σ 上升）。 | (i) 中位數切分約一半時間為 true，是 regime 切分不是壓力旗標。(ii) 目前承載 skill 的「站上 200 日線、VIX<30」cell 會被切成兩半，各自的收縮變強。(iii) 與已否決的 VRP 共用 Σr² 項；目標不同所以不算重開，但屬同族。(iv) 外部研究與本專案協調者都看過 trailing RV 的 dd5 探索結果，因此適用 R2-1 的政策性加嚴，通過也只是經探索選出的回溯驗證。(v) 最可能的結果：配對差點估計 > 0，但下界 ≤ 0，因為 SMA200 已吸收大部分波動資訊；依規則照樣否決，不得換窗口重跑。 |

退場規則：補完歷史後，該 basis 的相位平均 BSS bootstrap 上界 < 0 即撤下。前瞻紀錄依 R2-6 只顯示，退場檢定另行登記。

執行順序：本節合併 → R2-3a 合成資料檢查與 `backtest.ts` 的 target 隔離、明確 N／種子（只用合成資料測試）→ R2-5（G09 修訂一）與 R2-6 程式上線 → 名額 A 的 reference 寫進試驗登記 → 執行名額 A → 結果依上方規則寫回試驗登記。R2-7 只在名額 A 定案後，對當時採用的 dd5 模型做。

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
| 4 | **G01 收縮** | 收縮後的 Brier 不會顯著比硬切換差 | k=40 事前登記；以事前登記 G01 列為準：配對 Brier 差（收縮 − 硬切換）的下界 > 0 才否決，否則採用；k∈{20, 80} 只當敏感度分析，不從中挑 | 收縮後的配對 Brier 差顯著較差 |
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
| 指標投票（X01：TradingView、NDR 的「N% 指標看多」） | 12 條均線是同一條價格序列投 12 次票，一致程度會高估確定性；門檻在回測中挑選會吃掉試驗名額。若 G07 日後要做，一個概念只投一票，且不輸出 Strong Buy/Sell 類標籤 |
| extremizing（X02：GJP 把聚合機率推離 0.5） | 前提是許多獨立、資訊不完整的預測者；我們是一個模型，失敗方式是過度自信，該做的是收縮回基準率（G01），方向相反 |
| 依風險調整定投金額（X03：vol targeting、趨勢 CTA 的部位調整） | 可實作的 vol-managed 組合樣本外表現較差（Cederburg 2020；DeMiguel et al. JF 2024），好處是尾端較小而非 Sharpe 較高；產品不提供加碼或停扣建議（L17） |
| 在我們樣本上擬合權重或 HMM（X04：Seeking Alpha、Zacks、HMM regime） | 約 85 個 walk-forward 列、2 個 flag，任何擬合的權重都是樣本內；Quantpedia 的 HMM 檢驗未能拒絕「沒有擇時 skill」。全樣本估計的權重一律視為樣本內，補完歷史後也只經試驗登記並用 L08 折扣門檻重審 |

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

## 判斷流程研究：媒體、資產管理公司、預測科學

> 範圍：2026-10-26 的第二輪研究。上一輪（第 2–8 節）問的是「投行對美股怎麼看」，這一輪問的是「各家**怎麼做判斷**」：用什麼方法、怎麼呈現不確定性、有沒有回頭對帳、有沒有證據證明判斷有用，以及哪些做法值得我們借鑑。
>
> **這次怎麼研究：** 分四個視角收集來源：媒體與資訊平台、資產管理公司、預測科學（superforecasting、預測市場、Fed 模型、民調模型）、系統化量化（CTA、波動目標、regime 模型、過度配適防護）。每個來源都記錄六件事：判斷什麼、方法、不確定性怎麼呈現、怎麼對帳、預測力證據、可借鑑之處。接著整理出 17 條可借鑑的做法（L01–L17）與 4 條刻意不借鑑的做法（X01–X04），由兩位審查者各自判定：**evidence**（證據站不站得住）與 **fit**（放進我們的模型與定投使用者是否合適）。只要有一位判定 downgrade，該條就標為 **downgrade**。
>
> **本節所有改動都還沒跑過回測。** 預測力證據沿用本文件的等級：`none`／`bank_claim`（機構自述，本節也用於非銀行機構的自述）／`anecdotal`／`academic_oos`／`independently_tested`。另外補一級 `academic_is`，指學術研究但只有樣本內結果。程式行號已在 2026-10-26 用 grep 複核。引用編號用 `[J1]` 起算，與第 8 節的 `[1]–[90]` 分開。

### 1. 各家怎麼判斷

#### 1.1 媒體與資訊平台

| 來源 | 判斷什麼 | 方法 | 怎麼呈現不確定性 | 有沒有對帳 | 預測力證據 |
|---|---|---|---|---|---|
| CNN Fear & Greed [J1][J2][J3] | 當下美股情緒，0–100。不做預測，沒有期限，常被拿來當幾天到幾週的反向指標 | 7 個成分（125 日均線動能、52 週新高減新低、McClellan 成交量總和、put/call 5 日均、VIX 對 50 日均、20 日股債報酬差、垃圾債對投資級利差）。每個成分算「偏離自身平均、相對於平常的離散程度」，類似 z-score，再等權平均。標準化窗口、映射函數、截斷規則都沒有公開，社群複製版承認無法完全重現。**官方頁面對我們的抓取回 HTTP 451，方法文字來自轉載** | 沒有。只有指針儀表、五段標籤，以及與前日、週、月、年的比較；沒有區間、沒有 n | 沒有。不公布績效，也沒有官方歷史。學術研究只能用 GitHub 爬蟲加 Wayback Machine 自行重建，中間有缺口 [J4] | `academic_is`：Farrell & O'Connor（FRL 2024/25）只做樣本內 Granger 因果，2011–2020 成立，2021–2024「明顯變弱」，效果集中在 2014 年前 [J4][J5]。一份從業者回測（SPY，持有 21 日）各十分位勝率約 62–78%，但沒有列無條件基準 [J6]；我們自己算 2009 年以來 21 日上漲基準率約 67–68%，所以多數十分位與「永遠做多」分不出差別 |
| Bloomberg Economics 衰退機率模型 [J7][J8] | 1–24 個月內美國進入衰退的機率期限結構 | 依轉載報導，用 13 個總經與金融指標。統計方法、權重、校準方式都沒有公開；常被假設是 Estrella-Mishkin 式 probit，**未證實** | 只有各期限的點機率，例如 2022-10「12 個月內 100%」，沒有區間 | 沒有公開校準紀錄。100% 那次後來沒有 NBER 認定的衰退（**出自我們的知識，本輪未重新核實**）。Gelman 稱之為「令人尷尬的校準錯誤」[J8]；模型後來改版，沒有公開檢討 | `none`。唯一的公開審視是負面的；文獻支持 yield-curve probit [J11]，但不代表這個專有版本有效 |
| Bloomberg 金融狀況指數 BFCI [J9][J10][J11] | 今天的美國金融狀況偏緊還是偏鬆，描述現況，不預測報酬 | BIS 與 Richmond Fed 的描述：10 個貨幣、債券、股票變數，等權；每個都以相對 **固定的 1994 至 2008 年中基準期** 的標準差表示。**成分數有爭議**：Fed FCI-G 附註把它歸到 PCA 類，TradingView 的社群代理版說約 50 個變數。我們採信 BIS 與 Richmond Fed | 以標準差單位呈現，讀者看得出讀數有多不尋常；讀數本身沒有誤差 | 不做預測，所以沒有對帳；基準期固定，跨年可比 | `none`（不是報酬預測工具） |
| Bloomberg 策略師目標調查、BI 股票策略 [J12] | 華爾街年底 S&P 500 目標的中位數與平均；BI 約 12 個月的由上而下觀點 | 年初收集各家目標，年中再問一次，取簡單中位數或平均，不按過去準確度加權。BI 只描述為「基本面＋量化＋技術」，細節在 Terminal 內 | 只有原始表格看得到高低 | 沒有。第三方指出目標多在追價。年中重新調查會讓「預測」朝已實現價格修正 | 已在第 2、6 節處理：與實際報酬相關約 0 |
| Bloomberg MLIV Pulse [J13] | 讀者對市場方向的看法 | 便利樣本，不加權。**樣本數差很多**：某期約 1,700 人，2025-06 某期 27 人 | 沒有誤差範圍，27 人與 1,700 人用同樣方式呈現 | 沒有 | `none` |
| Reuters 策略師調查 [J14] | 年底指數水準共識 | 約 40–50 位專業人士，約每季一次。標題用 **中位數**，副題附子樣本 n（例如「14 人中 7 人」） | 中位數，有時附高低區間；**固定附註「專業人士的歷史預測紀錄很差」** | 沒有計分，但把歷史準確度很差的警語印在數字旁邊 | `none`（策略師共識整體為負面） |
| WSJ 經濟學家調查、FT-Booth 調查 [J15][J16] | 12 個月內衰退機率、GDP、利率；FT-Booth 調查的是學界總經學者 | WSJ：各人主觀機率的簡單平均。FT-Booth：中位數加第 10、90 百分位 | FT-Booth 顯示跨人離散（10–90 百分位）；WSJ 很少顯示離散 | 都沒有計分。FT-Booth 有公開存檔，可以自己核對。WSJ 平均在 2022–23 年停在 50–60%，但沒有發生衰退 | `none`；WSJ 的例子屬 `anecdotal` 的校準不良 |
| Morningstar 星等與市場 price/fair value [J17][J18][J19] | 個股價格相對分析師內在價值的位置，以及市場中位股貴或便宜。定位為長期估值訊號 | 分析師 DCF 估 fair value，另給 Uncertainty Rating（Low 到 Extreme）。**不確定性越高，拿到 5 星或 1 星需要的折溢價越大**。市場層級同時呈現中位數與市值加權兩條線，兩者可能分歧 | 最明確的商業來源：不確定性是一級輸出，而且直接放寬門檻 | 有自我檢討：2010 年自家研究發現費用率比星等更能預測基金表現，是誠實的負面結果 [J19]。對市場層級，Morningstar 自己說「短期往往說明不了什麼」 | 個股、基金：`bank_claim`，效果小。市場層級的報酬預測：`none` |
| TradingView 技術評等、Investing.com 技術摘要 [J20][J21] | 任一標的在任一週期的 Strong Sell 到 Strong Buy | TradingView 有完整文件：15 個均線類訊號加 11 個振盪指標，各給 +1/0/−1，分組平均後再平均，±0.1、±0.5 為標籤門檻。Investing.com 數 12 條均線與約 12 個振盪指標的買賣票數，門檻沒有公開 | 只有同意票的比例。這些票高度相關，同意數會高估信心 | 沒有。TradingView 註明僅供「教育與娛樂」 | `none`。相關學術研究（Sullivan-Timmermann-White 1999）做完資料窺探校正後，技術規則的績效大致消失 [J22] |
| Zacks Rank [J23] | 個股 1–3 個月的相對表現（橫斷面選股，不是指數方向） | 4 個盈餘預估修正因子，權重專有，每晚重算；強制分配（#1 約 5%、#3 約 60%） | 沒有 | 公布 #1 股票年化報酬，Baker Tilly 證實的是 **算術正確**，不是預測效度，也沒算交易成本 | `bank_claim`。底層的盈餘修正動能異象有學術支持，但 Zacks Rank 本身沒有獨立樣本外檢驗 |
| Seeking Alpha Quant Ratings [J24][J25][J99] | 個股相對同業的吸引力 | 100 多個指標組成 5 個因子等級，權重「為了最大化預測力」而擬合，細節不公開 | 只有一般性免責 | **把 2010–2019 擬合回測與 2020 起由 S&P Global 計算的 live 期間分開報告** | `bank_claim`。Jame & Guo（SSRN 4540580）報告有預測力，但我們只看到 Seeking Alpha 自己的宣傳文，**獨立性與處理方式未核實** |

#### 1.2 資產管理公司

| 來源 | 判斷什麼 | 方法 | 怎麼呈現不確定性 | 有沒有對帳 | 預測力證據 |
|---|---|---|---|---|---|
| Vanguard VCMM [J26][J27] | 資產類別 10 年（也有 5、30 年）報酬、波動、相關的聯合分佈，用於戰略配置。**不判斷 1 個月或 1 年方向** | 全球 Bayesian VAR，用 Litterman 式收縮「把較弱的關係壓小」防過度配適。總經觀點以 steady-state prior 進入。估值向 **隨時間變動的** CAPE 重心回歸。每類資產 10,000 次厚尾模擬。本身不出手，分佈交給最適化器 | 百分位帶（四分位距、5–95 百分位），刻意淡化中位數；明說「不確定性就是重點」，也承認可能低估歷史沒出現過的極端下跌 | 公布 10 年前預測與實際的對照，但只有 60/40 組合。自家估值回測標註為「說明模型行為，不是正式預測評估」 | `bank_claim`。「1 年訊號解釋力約 0、CAPE 約解釋 10 年實質報酬 40%」是 **二手轉述**（2012 年論文的評論），沒有讀原文 |
| Fidelity AART 景氣循環法 [J28] | 美國經濟在四個循環階段中的哪一個，以及各資產、產業的相對表現 | 以長期平均為基準，循環層在其上做調整。階段輸入為獲利、信用、庫存、就業、貨幣政策，組合數學沒有公開。**信心分級：全期平均、月中位差、循環命中率三者都同向才給 ++，混合只給 +，沒有規律就留白** | 明說命中率「樣本小，只有 8 個完整循環」，也承認階段可能跳過或倒退 | 沒有公開的階段判斷紀錄 | `none`（樣本內，n=8 個循環） |
| BlackRock Investment Institute [J29] | 6–12 個月戰術、5 年以上戰略的加減碼 | 委員會判斷，參考總經、大趨勢主題與系統化研究；以情境決定何時轉向。信心用跨期限的風險預算表達 | 情境敘事；不確定時縮短期限、少說 | 沒有公開的戰術判斷計分 | `none` |
| JPM LTCMA [J30] | 200 多類資產 10–15 年預期報酬 | 積木法，每年更新，標明資料截止日 | 附波動與相關矩陣 | 沒有找到回顧 | `none`。JPM 自己說明 **不適用於短期戰術** |
| GMO 7 年預測 [J31][J32][J33] | 各資產 7 年實質報酬 | 估值均值回歸：殖利率加 fair value 成長加估值與利潤率回歸 | 點預測，常附範圍 | 自己挑過去準確的例子宣傳（2012 年 94.5% 的說法屬 **自述且二手**）。CXO 批評那是事後挑選、橫斷面的單一快照，而且是對隨機猜測比較，不是對簡單演算法比較 [J32]；部落格比對 2010 年預測發現平均低估，但排序大致正確 [J33] | `independently_tested`（結果混合，非正式，只有橫斷面） |
| Research Affiliates AAI [J34][J35] | 10 年實質報酬 | 收益加成長加估值變化，CAPE **部分** 均值回歸；自承「沒有單一模型是銀彈」，CAPE 曾連贏數十年後失靈 [J35] | 附波動；部分回歸是對過度自信的避險 | **2025 年自評「好、不太差、醜」**，指名寫出失誤（美股、匯率）。原 PDF 已轉址，AP 轉載回 403 | `bank_claim`（自評，沒有獨立複製） |
| Ned Davis Research [J36][J37][J38] | 數日到一年的股市方向與配置 | 測試數百個指標，檢查沒有單一概念權重過大，跨 regime 審查，委員會判斷能否延續，失效就修。經典組合是「看多指標的百分比」，門檻在回測中選定（例如 94 個指標中 ≥65.5%，**二手轉述**） | 「證據的權重」：分散到很多弱指標；沒有機率或區間 | 部分策略據稱有 GIPS 報告（要另外索取，沒拿到）。分區報酬表混合回測與即時期間 | `bank_claim` |
| Bridgewater All Weather [J39] | **刻意不預測**：組合在成長與通膨四種情境下都能接受 | 成長驚奇 × 通膨驚奇兩軸，各情境約 25% 風險，以風險平價配置；Pure Alpha 的方法不公開 | 用「不預測」處理不確定性 | live 紀錄經基金公開，本輪沒有評估；2022 年股債齊跌廣受討論 | `none`（不是預測工具） |
| AQR（Asness、Ilmanen 等）[J40][J41][J42] | 要不要擇時、擇時多少 | 「Sin a Little」：價值擇時在樣本內很強，樣本外變弱，加入趨勢會比較穩健；部位只做小幅偏離。因子擇時「沒有穩健證據」。「Craftsmanship alpha」：實作細節造成的差異不亞於訊號本身 | 堅持樣本外、經濟理由、跨樣本穩健；用小部位表達謙遜 | 同儕審查論文；公開與 Research Affiliates 辯論檢驗設計 | `academic_oos`（結論：擇時價值頂多很小） |
| Hussman [J43][J44] | 長期估值報酬與短期風險偏好 | 估值決定長期，市場內部結構與信用利差決定短期。2014 年後要「高估 **且** 內部結構轉弱」才全面避險 | 明確區分期限；承認 QE 造成 regime 斷裂 | **第一人稱檢討**：把 2009 年後的落後歸咎於自己 2009 年的模型決定。但 2014 年的修正是在同一段歷史上調出來的；「事前會否決三分之二以上」是 **事後回測** | `bank_claim`（自述 live 紀錄不佳） |

#### 1.3 預測科學

| 來源 | 判斷什麼 | 方法 | 怎麼呈現不確定性 | 有沒有對帳 | 預測力證據 |
|---|---|---|---|---|---|
| Superforecasting / Good Judgment Project [J45][J46][J47][J48] | 有固定結算日的二元或多元問題，期限數週到一年 | 篩選值得花力氣的問題；拆解；**先用外部視角（參考類別基準率）再做調整**；機率要細到 1–5pp（Friedman 等人 2018，88 萬筆預測：粗化會降低準確度）；**常更新、每次小幅度**（超級預測者每題約 11 次，GJ Open 使用者約 2.8 次）；全部用 Brier 計分並回饋 | 校準與解析度分開計分 | 每題結算後計分，排行榜靠紀錄而不是頭銜 | `academic_oos`（錦標賽設計）。**訓練與組隊的效果有爭議**：2025 年 Psychological Science 重新分析認為控制混淆後效果變小 [J47]。證據來自地緣政治題，不是股市月方向 |
| GJP 聚合與 extremizing；預測調查 vs 預測市場 [J49][J50] | 怎麼把多人機率合成一個 | 先在 log-odds 平均，再往遠離 0.5 的方向推。理由是每個人只掌握部分資訊，又傾向往 0.5 收。Atanasov 等人：加上時間衰減、依過去績效加權、再校準的團隊調查，可以贏過市場 | 只有點機率 | 錦標賽內計分 | `academic_oos`。Tetlock 自己警告，已經充分分享資訊的團隊不要再 extremize |
| Mediating Assessments Protocol、《Noise》[J51] | 怎麼結構化重複性的專業判斷 | 事先定好幾個獨立評估項，各自用事實尺度評分，最後才形成整體判斷；用 noise audit 測量判斷變異。**全文沒有取得，步驟數各摘要說法不一** | 把判斷之間的變異當成要量測的誤差 | noise audit 量的是離散，不是準確度 | `none`（類比結構化面試研究） |
| 事前驗屍（Klein）[J52] | 想像計畫已經失敗，列出原因 | 每人先獨立寫，再彙整 | 質化 | 沒有 | `none`。常被引用的「+30%」是 1989 年實驗室研究中「想出的理由數」，不是結果改善 |
| 參考類別預測（Flyvbjerg）[J53] | 參考類別的結果分佈 | 選類別、建立經驗分佈、把當前個案放進去，只有可辯護的證據才調整 | 整個分佈的分位數（例如 P80） | 多為實務案例 | `bank_claim`（多出自作者團隊） |
| Philadelphia Fed SPF [J54][J55][J56] | 季度總經，以及未來 5 季 GDP 下滑機率（Anxious Index 為其中的 RECESS2） | 專業預測者對固定區間給機率，公布各區間平均機率、離散度與匿名個人回答；文件明說區間、期限、產出概念歷年有變 | 主觀機率直方圖加上預測者之間的分歧 | **公開的預測誤差統計頁**，以及 1968 年起的個人層級存檔 | `academic_oos`（結果混合：密度預測有方向資訊但過度自信；Rudebusch-Williams 發現 SPF 輸給簡單殖利率利差 probit）[J67] |
| CFO 調查（Ben-David、Graham、Harvey）[J57][J58] | CFO 對 S&P 500 一年報酬的點預期與區間 | 把回答的區間當成 80% 區間，檢查實際報酬落入的比例 | 主觀區間 | 學術論文做對帳，不是調查本身的固定計分 | `academic_oos`：80% 區間只有 36% 涵蓋實際結果（早期版本 38%），不確定性高時最差；落空之後區間會變寬，表示人會從回饋學習 [J58] |
| 預測市場（Kalshi、Polymarket）[J59][J60][J61][J62] | 指數收在某價位以上或某區間內的價格隱含機率 | 以金錢加權的交易價格 | 價格就是機率；薄市場有微結構雜訊 | 平台自己發布校準頁（Kalshi 研究 PDF 回 429，數字來自其新聞摘要）；資料有 API，可以重算 | `bank_claim`。**有爭議**：Vanderbilt 的政治市場研究結果與 Kalshi 的說法相左，Kalshi 有反駁 [J62]。沒有 S&P 市場專屬的獨立校準證據。整體 Brier 很漂亮，主要是因為多數題目很容易 |
| NY Fed 期限利差 probit、Fed Board 近端遠期利差 [J63][J64][J65][J66][J98] | 12 個月後是否處於衰退 | 單一變數 probit：10 年減 3 個月利差的月平均，要求倒掛持續。規格固定數十年並公開。Board 版改用近端遠期利差，理由是 **機制**（長端受期限溢價污染），不只是擬合 | 點機率沒有區間；**把 1959 年以來整段歷史連同誤判一起畫出來** | 每月重新發布整段序列；第三方反覆檢驗；2022–24 年倒掛而沒有衰退的失誤也留在圖上 | `academic_oos`（Rudebusch-Williams 2009、Croushore-Marsten 2015），但 1959 年以來只有約 8 次衰退 |
| FiveThirtyEight / Silver Bulletin [J68][J69][J70] | 選舉與運動賽事結果機率 | 民調依品質、新近度、樣本數加權，加上基本面 prior 與不確定性指數，做 Monte Carlo 模擬；2016 年同時呈現 polls-only、polls-plus、now-cast 三個版本 | 自然頻率（「10 次模擬贏 7 次」）、模擬分佈、扇形圖 | 「說 70% 就真的是 70%」的校準圖，也把信心不足算成失誤。**原頁面現在 302 轉址到 ABC News，紀錄隨主機消失** | `bank_claim`（自述，但 n 很大） |

#### 1.4 系統化量化

| 來源 | 判斷什麼 | 方法 | 怎麼呈現不確定性 | 有沒有對帳 | 預測力證據 |
|---|---|---|---|---|---|
| 趨勢 CTA（AQR TSMOM、Man AHL）[J71][J72][J73][J74] | **不判斷漲跌，判斷部位大小**：依各市場過去 1–12 個月報酬的正負 | 部位 = 訊號 × 目標波動 ÷ 已實現波動；不同回看速度等風險平均，不挑最佳參數 | 用部位大小處理：波動升高部位自動縮小；不給方向機率 | 最強：live 基金與產業指數有稽核過的淨值紀錄，2009 年後表現不佳也公開承認 | **有爭議**：Kim-Tse-Wald 發現多數 alpha 來自波動縮放；Huang 等人（JFE 2020）發現逐資產的 TSM 很弱，用歷史平均也差不多 |
| 波動目標、風險平價 [J75][J76][J77][J78][J79][J80] | 現在該持有多少風險 | 權重 = 目標波動 ÷ 預測波動；**只預測波動**，因為波動有持續性 | 明確假設均值不可預測、二階動差可預測 | 基金有 live 報酬；學術主張部分由 Man 員工共同撰寫 | 波動可預測：`academic_oos`，強（Corsi HAR）。波動管理股票組合提高報酬：**有爭議**，Cederburg 等人與 Barroso-Detzel 發現可實作版本在樣本外或扣成本後失效 [J79][J78]。Man 自己說好處在左尾，不在 Sharpe |
| HMM／Markov-switching regime 模型 [J81][J82][J83] | 市場處於哪個潛在狀態 | Baum-Welch 擬合，只用 filtered 機率。Quantpedia 2026：4 個狀態、5 個週頻特徵、參數在訓練窗凍結、2024 年起封存 holdout | 後驗狀態機率；稀有狀態在短樣本裡幾乎是空的 | 沒有 live 紀錄；Quantpedia 公開 holdout 設計與 permutation test，是這組裡最誠實的 | 擇時：負面。Quantpedia 發現 regime 模型能降回撤，但贏不過曝險匹配的靜態組合或簡單波動目標，permutation test 無法拒絕「沒有擇時能力」 |
| Goldman Bear Market Risk Indicator、Risk Appetite Indicator [J84][J85] | 12–24 個月內出現熊市的「類機率」；跨資產風險偏好 | BMRI：5 個總經與估值輸入各自轉成歷史百分位後 **簡單平均，不擬合權重**，>60% 為警戒。RAI：1 年滾動 z-score，成分與權重專有 | 沒有區間；百分位刻度容易被誤讀為機率 | 沒有。2018 年讀數 73%，GS 自家分析師公開說不相信，之後 12 個月窗口內沒有熊市（2018 年第 4 季跌約 19.8%），也沒有檢討 | `none`／`bank_claim` |
| 回撤與崩盤機率模型（Greenwood-Shleifer-You、Adrian-Boyarchenko-Giannone、Minneapolis Fed）[J86][J87][J88][J89] | 2 年內出現大跌的機率；GDP 的下尾分位；選擇權隱含的大跌機率 | GSY：產業漲幅加波動等變數，用 logit 估崩盤機率。ABG：金融狀況對 **下尾分位** 做分量迴歸 | 輸出本身就是尾部機率或分位數 | 學術樣本內與樣本外；ABG 複製研究發現樣本延長到 2021 年後係數變弱 [J88] | `academic_oos`：GSY 發現漲幅能預測崩盤機率，**但不能預測較低的平均報酬**。ABG 的對象是 GDP 而不是股價，對我們只是間接支持 |
| 分量與 conformal 預測 [J90][J91] | 下期報酬的分佈，以及長期涵蓋率受控的區間 | 分量迴歸；Adaptive Conformal Inference：每次落空就放寬，命中就收窄 | 區間本身就是輸出 | 跑出來的涵蓋率就是計分表 | 分量可預測性：`academic_oos`，程度不大。ACI 只有數學上的涵蓋保證，沒有股票指數專屬研究；保證的是涵蓋頻率，不代表區間有資訊量 |
| Basel 交通燈（Kupiec、Christoffersen）[J92] | 銀行 99% 一日 VaR 是否校準 | 數 250 天內的例外次數：0–4 綠、5–9 黃、≥10 紅；Kupiec 檢驗例外率，Christoffersen 另外檢驗例外是否成群 | 明說檢定力低：250 天只預期 2.5 次例外，所以黃燈交給監理裁量 | **唯一被強制公布、而且校準不佳要付代價的來源** | 不是預測模型，是問責標準 |
| Newfound tranching、AQR craftsmanship [J93][J94][J42] | 結果對任意實作選擇（再平衡日、回看期）有多敏感 | 拆成多個 tranche、在不同日期再平衡，報告離散度；組合用等權或中位數 | 把實作選擇當成要平均掉並報告的變異 | Newfound 公開指數方法 | `anecdotal`。**「某指數同一年差距 >40%」未核實**（Newfound 頁面回 403） |
| 過度配適防護（Deflated Sharpe、PBO/CSCV、CPCV、Arnott-Harvey-Markowitz）[J95][J96][J97] | 回測優勢在校正試驗次數與資訊洩漏後是否還在 | 把觀察值與「N 次虛無試驗的預期最大值」比較；CSCV 計算樣本內贏家在樣本外落到中位數以下的機率；purge 與 embargo；AHM 的協定要求不得依 live 結果調參 | 把「一次漂亮的回測」換算成「是運氣的機率」 | 方法論文 | 學術方法，以模擬驗證；不是預測模型 |

### 2. 共通模式：好的判斷者和差的判斷者差在哪裡

| 面向 | 好的判斷者 | 差的判斷者 |
|---|---|---|
| 錨點 | 對參考值說話：SPF、NY Fed 對照歷史；GJP 先看外部視角；Fidelity 以長期平均為基準；Reuters 把歷史紀錄很差的警語放在數字旁 | 單獨一個數字或標籤：CNN 的指針、Strong Buy、「100% 衰退」 |
| 調整幅度 | 有證據才動，而且按比例小步動：Vanguard 的 Bayesian 收縮、RA 的部分回歸、GJP 的小幅頻繁更新、AQR 的「Sin a Little」 | 全有或全無：門檻一過就整個切換 |
| 不確定性 | 呈現分佈與 n：Vanguard 5–95 百分位、FT-Booth 10–90 百分位、Morningstar 不確定性越高門檻越寬、538 的自然頻率 | 不附 n 與區間：MLIV 的 27 人和 1,700 人看起來一樣；主觀區間太窄（CFO 80% 區間只涵蓋 36%） |
| 組合 | 每個概念只投一票，不擬合權重：NDR 不讓單一概念過重；GS BMRI 百分位等權；AQR 價值加趨勢 | 同一個價格序列算 12–15 條均線，各算一票；為了「最大化預測力」擬合專有權重 |
| 計分基準 | 對簡單參考預測計分（skill score），並分 regime 看；CXO 要求打敗簡單演算法，不只是打敗隨機猜測 | 只報原始 Brier 或原始命中率；簡單題目多，分數自然好看 |
| 紀錄 | 不可改、可下載、外人能重算：SPF 1968 年起、NY Fed 1959 年起、預測市場 API | 沒有官方歷史（CNN）；年中修正目標（策略師調查）；改版不留紀錄（Bloomberg 衰退模型）；紀錄隨主機消失（538） |
| 改規格 | 規格凍結並公開（NY Fed 單變數 probit 數十年不變）；新變數先講機制（Engstrom-Sharpe） | 痛過之後才改，又在同一段歷史上調參（Hussman 2009、2014；BofA SSI 門檻 60.1→57.8） |
| 檢討 | 指名寫出失誤（RA「醜」的部分、Hussman 第一人稱、538 把信心不足也算失誤） | 不寫：Bloomberg 100%、GS BMRI 73% 之後都沒有公開檢討 |
| 判斷對象 | 判斷看得到 skill 的東西：系統化公司預測 **風險**，不預測方向（波動持續性、左尾）；Bridgewater 乾脆不預測 | 拿別的問題的答案回答短期方向：選股訊號、12 個月目標、描述現況的指數，被當成 21 日指數方向來讀 |

三個觀察：

1. **沒有任何一家公布過一個月指數方向的樣本外 skill。** 證據可信的機構（Vanguard、JPM、GMO、RA、AQR）都看 7–15 年，而且都主動聲明不適用短期。這從外部再次印證本文件的結論：21 日基準率幾乎打不敗。
2. **可以借的是流程與溝通，不是新輸入。** 這與 G20（不自己湊合成指標）和兩個測試名額的預算一致。
3. **我們的採用門檻（區間不含基準率，而且 walk-forward BSS 下界 >0）比這一輪看到的所有從業者都嚴格。** 差距在三處：對帳紀錄（G02）、判斷對象（G09），以及幾個實作細節。最後這點正是 AQR 說的 craftsmanship：0.5 錨點、bootstrap 種子、單一相位。

### 3. 值得借鑑的做法

判定規則：兩位審查者都判 keep 才標 **keep**，否則標 **downgrade**。下方「具體改動」是 **已經依審查意見修正過的版本**，不是原始提案。

| ID | 一句話 | 層 | evidence／fit | 結論 | 對應既有項目 |
|---|---|---|---|---|---|
| L01 | 方向判斷改成相對基準率，不再相對 0.5 | decision_rule | keep／keep | **keep** | 新 |
| L02 | 21 個起始相位都跑一次 walk-forward | estimation | keep／downgrade | **downgrade** | G08 |
| L03 | bootstrap 種子固定，避免蒙地卡羅雜訊讓判斷翻面 | estimation | keep／downgrade | **downgrade** | G08 |
| L04 | 風險當主角，P(up) 當參考 | output_target | keep／keep | **keep** | G09、G18 |
| L05 | 往基準率收縮（G01）的外部佐證 | estimation | downgrade／downgrade | **downgrade** | G01 |
| L06 | 檢查自己區間的涵蓋率 | accountability | downgrade／downgrade | **downgrade** | G04 |
| L07 | 三個指標同向才算一致 | communication | downgrade／downgrade | **downgrade** | 新 |
| L08 | 依實際做過的搜尋次數收緊門檻 | process | keep／downgrade | **downgrade** | G04 |
| L09 | 樣本內、walk-forward、live 三種分數分開 | accountability | keep／keep | **keep** | G02 |
| L10 | 以 resolution 判斷 skill，分 basis 報告 | accountability | keep／downgrade | **downgrade** | G03 |
| L11 | 自然頻率、事件數、紀錄放在數字旁 | communication | keep／keep | **keep** | G08 |
| L12 | 固定評估項，補上資料新鮮度 | decision_rule | downgrade／keep | **downgrade** | M5 |
| L13 | 試驗登記加機制、事前驗屍、退場規則 | process | downgrade／downgrade | **downgrade** | G04 |
| L14 | 年度自評檢討 | accountability | downgrade／downgrade | **downgrade** | G02 |
| L15 | 標準化時基準窗口要凍結 | estimation | downgrade／downgrade | **downgrade** | G06、M1 |
| L16 | 寫清楚幣別與標籤 | output_target | keep／keep | **keep** | M2 |
| L17 | 對定投使用者：信心只改變風險描述，不改變指令 | communication | downgrade／downgrade | **downgrade** | 新 |

#### L01 方向判斷改成相對基準率（keep）

- **誰在做：** 538 的相對框架與自然頻率、SPF Anxious Index、NY Fed probit 圖、Reuters 的警語。所有可信的發布者都拿數字對照參考值。538 用 50% 線，是因為選舉本來就是二選一。
- **我們現況：** `web/src/lib/forecast.ts:235` 寫的是 `call: !conclusive ? "inconclusive" : pick.p >= 0.5 ? "up" : "down"`，但 `forecast.ts:112` 在基準率落在條件區間外時（兩個方向都算）就判定 distinct。結果是條件機率 0.58 對上基準 0.67、與基準可區分、bssLow>0，仍然會被標成 `up`，`down` 幾乎不會出現。`web/pages/outlook.tsx:9-10` 卻告訴使用者偏多／偏空的意思是「明顯高於／低於歷史基準」，**程式與頁面說法不一致**。`forecast.ts:187` 的 hitRate 同樣用 p>0.5，只要 p 一直高於 0.5，它就等於永遠做多的命中率。
- **具體改動：** conclusive 時，`pick.p > pick.base.p` 標為「高於平常」，反之標為「低於平常」。標籤從 偏多／偏空 改成 高於平常／低於平常。從 `Evaluation` 與頁面拿掉 hitRate，改用 BSS，不另外發明一套相對基準的命中率。新定義要在 G01、G03 改動數字 **之前** 寫進試驗登記，並提升 model_version。
- **怎麼驗證：** 單元測試：合成 regime 的條件機率 0.58、與基準 0.67 可區分、bssLow>0，必須回傳「低於平常」。另外在 walk-forward 約 85 列上統計兩種錨點各會產生哪些標籤。這是定義修正，不需要採用回測。
- **審查：** evidence keep（bug 已從程式確認，不需要外部證據）；fit keep（不增加參數，建議直接以 BSS 取代 hitRate）。

#### L02 21 個起始相位（downgrade）

- **誰在做：** Newfound Research（再平衡時點運氣，用 tranche 分散）；AQR craftsmanship。
- **我們現況：** `forecast.ts:152,159-160` 只取 burn-in 結束後的一組 21 日網格，所以約 85 列的 BSS 只是 21 種相位裡的一次抽樣。
- **具體改動：** walkForward 加一個 `offset` 參數，**只在測試或離線診斷時** 跑完 21 個 offset，記錄 BSS 的最小值到最大值範圍。不當作出結論的門檻，門檻仍由 G08 的 stationary bootstrap 決定（審查者認為「21 個中至少 15 個」是新的分岔選擇）。也不要在 Worker 渲染頁面時跑：pickProbability 每列都要重掃全部觀察值，補完歷史（M0）之後成本太高。
- **怎麼驗證：** 現有合成 regime 測試（`web/tests/forecast.test.ts:54-90`）在每個 offset 都要通過，隨機漫步在每個 offset 都要維持不確定。如果真實資料上現行的單一相位 bssLow 落在 21 相位分佈的邊緣，就代表目前的判斷靠運氣。
- **審查：** evidence keep（概念成立；「>40%」未核實；21 個相位共用大部分標籤，所以範圍會低估真正的抽樣不確定性）；fit downgrade（新的分岔加上效能成本，只當診斷用）。

#### L03 bootstrap 種子（downgrade）

- **誰在做：** Kahneman 等人《Noise》的 noise audit：同一份證據在不同場合得出不同結論，也算誤差。
- **我們現況：** `forecast.ts:173` 寫的是 `mulberry32(rows.length * 7919 + 17)`，每多一列就換一次種子。bssLow 是 1000 次重抽的 2.5% 分位，當真值接近 0 時，判斷可能因為種子改變而翻面，而不是因為證據改變。
- **具體改動：** 併入 G08 的 bootstrap 改寫：種子改成不依賴列數的固定常數，重抽次數提高（約 400 列時 5,000 次仍然便宜）。蒙地卡羅標準誤只用在內部檢查，**不放進 `Evaluation` 或 UI**。
- **怎麼驗證：** 用 10 個不同種子跑同一組資料，bssLow 的正負號必須一致，否則標為邊際。原提案的「新增一列無資訊的資料不得改變結論」不成立，因為新增任何一列都會移動 BSS 點估計，所以不採用。
- **審查：** evidence keep（從程式確認，修正成本低；《Noise》的框架只是裝飾）；fit downgrade（應併入 G08，不應單獨成項，MC-SE 放上頁面是假精確）。

#### L04 風險當主角，P(up) 當參考（keep）

- **誰在做：** 波動目標與 CTA（只預測波動）；Vanguard 以百分位帶和中位回撤為主；SPF 把分佈濃縮成一個與決策相關的數字。
- **我們現況：** `forecast.ts` 只輸出 P(up)；`web/pages/outlook.tsx:43` 主畫面只有「上漲機率」；G09（21 日內最大回撤超過 5% 的機率）與 G18（VIX 帶）已規劃，尚未實作。
- **具體改動：** 照原順序做 G09，它依賴 G04 的事件數，所以不能排在路線圖第 2 項之前。**G09 通過自己已登記的門檻（bssLow>0、nEff≥30、事件數 ≥8）之後**，主畫面才改為兩個數字：「下個月出現 ≥5% 回檔的機率 X%（平常 Y%）」與「21 日後收高的機率 Z%（平常 W%）」。通過之前只顯示當前 basis cell 的 21 日報酬第 10、50、90 百分位，並標明是描述統計。
- **怎麼驗證：** 以回撤標籤跑 walk-forward（標籤 = t+1 到 t+21 的最低收盤 ÷ t 日收盤 − 1 < −5%，knownOn = t+21），套用 G09 的門檻。分位數只顯示，不需要採用測試。
- **審查：** evidence keep（波動持續性的樣本外證據強；ABG 講的是 GDP，支持力弱）；fit keep（最貼近定投使用者；依據應引 HAR 與波動群聚 [J80]，GSY 與 ABG 的對象不對）。

#### L05 G01 收縮的外部佐證（downgrade）

- **誰在做：** Vanguard 的 Bayesian 收縮、RA 的部分回歸、Fidelity 以長期平均為基準、GJP 的小步更新。
- **我們現況：** `forecast.ts:112` 寫的是 `p: distinct ? r.p : base.p`；G01 已登記 k=40。
- **具體改動：** 照 G01 原本的登記實作，**不要順手把 n 改成事件數**。k=40 是在 n≈天數÷21 的前提下校準的，改用常低於 40 的事件數會讓每個 cell 都被大幅收縮，那是另一個估計式，必須另外登記。唯一要新增的是內部診斷：記錄每日 |Δp| 的分佈，比較硬切換與收縮的差別。
- **怎麼驗證：** 沿用路線圖第 4 項的門檻。
- **審查：** evidence downgrade（GJP 講的是人如何更新信念，不能證明統計模型的硬切換比較差；而且有 2025 年的爭議）；fit downgrade（與 G01 重複，還會悄悄改掉已登記的規格）。

#### L06 區間涵蓋率（downgrade）

- **誰在做：** CFO 調查的涵蓋率檢驗、Basel 的 Kupiec 與 Christoffersen、ACI。
- **我們現況：** `forecast.ts:40` 寫的是 `nEff = days / HORIZON`，前提是各期獨立，但 VIX≥30 的日子是成群出現的；目前沒有任何涵蓋率檢查。
- **具體改動：** 只做模擬版本，當作 G04 的單元測試證據：在獨立同分佈的合成資料上，Wilson 區間的涵蓋率約 95%；在 regime 成群的合成資料上，nEff=天數÷21 的涵蓋率應該低於 95%，改用 G04 的事件數後應該回升。**不在真實資料上算「下 K 列的實際比例是否落入區間」**，因為該比例本身帶抽樣雜訊，即使模型正確也不會是 95%。Basel 式的落空次數等 G09 與 G18 的區間做出來再說。
- **審查：** evidence downgrade（真實資料上的做法定義錯誤）；fit downgrade（約 85 列、VIX nEff≈7，沒有檢定力）。

#### L07 三個指標一致（downgrade）

- **誰在做：** Fidelity AART 的 ++/+/空白分級；Hussman 2014 年後的雙條件。
- **我們現況：** `web/src/server/outlook.ts` 的 cell 只顯示上漲比例、區間、nEff。
- **具體改動：** 不加「一致／分歧」標籤：三個輸入用的是同一批日子與標籤，彼此高度相關，這正是 X01 否決的重複計票。最多在 L04 的分位數旁邊附上各 cell 的 21 日報酬中位數。
- **審查：** evidence downgrade（Fidelity 是樣本內、n=8 個循環）；fit downgrade（標籤看起來像信心等級，屬於假精確；nEff≈7 的 cell 按事件算勝率只是雜訊）。

#### L08 依實際搜尋次數收緊門檻（downgrade）

- **誰在做：** Deflated Sharpe、White's Reality Check（Sullivan-Timmermann-White）、Arnott-Harvey-Markowitz 協定。
- **我們現況：** 試驗登記已經記下 N（6 個歷史試驗加 2 個名額），但 `forecast.ts` 的出結論門檻仍然是 `bssLow > 0`。
- **具體改動：** 原提案「跑 N=8 條打亂序列，取最大 BSS 的第 95 百分位」做不成：8 條序列取不出第 95 百分位，6 個歷史試驗也無法重新打亂，打亂標籤還會破壞門檻必須尊重的群聚結構。改成對剩下的 2 個名額做 Bonferroni：bssLow 改用 1.25% 下界。在套用到 VRP 與季節性之前，先跑隨機漫步模擬，確認誤通過率 ≤5%。另外在文件寫明 PBO、CSCV、CPCV 因為設定組合與資料列太少而略過。
- **審查：** evidence keep（原則正確；擔心與 bssLow>0 疊加後在約 85 列時過嚴）；fit downgrade（程序本身不成立，改用 Bonferroni）。

#### L09 三種分數分開（keep）

- **誰在做：** Seeking Alpha 把擬合回測與第三方計算的 live 期分開；Vanguard 把自家回測標為「說明性質」；AHM 的「不依 live 結果調參」；Zacks 的第三方證明。
- **我們現況：** `web/src/server/jobs.ts:389` 寫的是 `ON CONFLICT(trade_date) DO UPDATE` 覆寫，沒有 model_version。`web/src/server/outlook.ts:42` 取最多 400 筆 **互相重疊的每日紀錄**，n 被灌水約 21 倍，而且只有原始 Brier（`:55`）。`outlook.tsx:138` 顯示「已到期 n 筆」。
- **具體改動：** 搭配 G02：收盤後的紀錄不得覆寫，並加上 model_version。live 計分只用不重疊的列（每 21 個交易日一列），頁面改顯示「獨立月份：n」。live BSS 附區間，與 walk-forward BSS 並列，分別標為「歷史回測」與「實際上線後」。本文件寫入規則：**不得因 live 結果調參；任何變更都要提升 model_version 並新增一筆登記**。提供紀錄的 CSV 匯出，讓任何人都能重算。預期 live BSS 區間會很寬，一年只有約 12 個獨立列，照實顯示就是誠實的結果。
- **怎麼驗證：** 單元測試：同一個 21 日窗口內的兩筆每日紀錄在 live 計分只算一個獨立觀察；收盤後對同一 trade_date 重算，結果必須是失敗或新增一筆，不得覆寫。
- **審查：** evidence keep；fit keep（皆已從程式確認，成本低、不增加參數）。

#### L10 以 resolution 判斷 skill（downgrade）

- **誰在做：** 538 依區間分組做校準；Murphy 分解；Quantpedia 的 HMM 研究（整體樣本外分數被平靜期主導，可能選到看不見危機的模型）；預測市場是反面例子（題目容易，Brier 就好看）。
- **我們現況：** `forecast.ts` 的 walk-forward 只有整體 Brier 與 BSS，各列沒有存 basis；`outlook.tsx` 顯示原始 Brier。
- **具體改動：** 每列存 basis（這是 G03 的前置條件），分 basis 計算 BSS。頁面上用 BSS ± 區間取代原始 Brier，**絕不單獨顯示原始 Brier**。Murphy 分解只在內部使用，依不同的預測值分組。注意：walk-forward 的基準率是 expanding window，會隨時間漂移，所以基準率預測者的 resolution 是 **接近 0，不是剛好 0**。單元測試要用常數基準，才能斷言 resolution = 0。
- **審查：** evidence keep（標準做法；修正「剛好 0」的說法）；fit downgrade（分解對定投使用者是術語，頁面只放 BSS ± 區間）。

#### L11 自然頻率與紀錄放在數字旁（keep）

- **誰在做：** Reuters（中位數、n、固定警語）；FT-Booth（10–90 百分位）；538（「10 次贏 7 次」）；NY Fed（把約 8 次衰退與所有誤報攤開）。反面例子：CNN 的指針、Strong Buy、100% 衰退的標題、MLIV n=27。
- **我們現況：** `outlook.tsx:11` 寫「不確定／目前的訊號不足以把機率拉離歷史基準」；`:43` 主畫面只有百分比；live 紀錄放在另一個區塊（`:138`）。
- **具體改動：** 主畫面寫「過去像今天這樣的月份，大約每 3 個月有 2 個月收高（平常也是 2/3）」，附「依據 N 段獨立時期」（G04 做完後）。「不確定」改成 G08 的「偵測不到 skill（最小可偵測 BSS ≈ X%）」。數字旁邊加一行 live 紀錄（L09 做完後）。固定附註：一個月指數方向接近不可預測，基準率就是很難打敗的標準。百分位那一行依賴 L04 與 G09。
- **怎麼驗證：** 溝通層改動，不需要回測；用 snapshot 測試確認每個顯示的機率都帶著基準率與 n。
- **審查：** evidence keep（自然頻率有 Gigerenzer、Hoffrage 的理解度研究支持；這裡不宣稱預測力）；fit keep。

#### L12 固定評估項與資料新鮮度（downgrade）

- **誰在做：** Mediating Assessments Protocol。
- **我們現況：** reasons 是自由文字；`forecast.ts:59` 寫的是 `vix.at(p.date) ?? vix.onOrBefore(p.date)?.close`，沒有陳舊上限（M5）。
- **具體改動：** 主要是實作 M5：VIX 超過約 3 個交易日沒更新就視為缺值。注意 `forecast.ts:216` 寫的是 `if (!last?.regime) return null`，regime 變成 null 時頁面目前會顯示「歷史資料不足」，而不是「不確定」，這條路徑要另外處理。上限也要一致套用到 buildObservations 的歷史觀察值。四列固定評估項（差異、樣本、紀錄、資料新鮮度）的顯示可以選擇做，不是必要。
- **怎麼驗證：** 單元測試：VIX 序列比 SPX 早 5 個交易日結束時，資料新鮮度判為失敗、regime 為 null、頁面顯示不確定，而不是資料不足。
- **審查：** evidence downgrade（MAP 沒有預測面的證據，改成四列是外觀調整；有價值的是 M5）；fit keep（M5 已排在路線圖第 0 項，並指出 null 路徑的問題）。

#### L13 試驗登記加欄位（downgrade）

- **誰在做：** NY Fed 與 Engstrom-Sharpe（先講機制）；Klein 的事前驗屍；NDR 的指標衰退委員會；Hussman 與 RA 的「CAPE 疲勞」是反面教材。
- **我們現況：** 試驗登記只有「條件／狀態／結果」三欄；SMA200 標為採用，但沒有退場條件。
- **具體改動：** 新增兩欄：「機制（為什麼應該有效）」與「事前驗屍（最可能的失敗原因，包括使用者傷害，例如定投者看到 down 停扣而錯過反彈）」，並替 SMA200、VIX≥30 補填。**不採用原提案的退場規則**（上線 24 個月、live BSS 點估計 ≤0 就退場）：24 個月的點估計標準誤遠大於任何合理的 edge，會讓真正有用的 flag 約一半機會被誤殺。退場只用補完歷史後的 walk-forward bssHigh<0，或預先算好檢定力目標的 live 證據。
- **審查：** evidence downgrade（事前驗屍的證據是想出的理由數，不是準確度）；fit downgrade（退場規則統計上不成立）。

#### L14 年度自評（downgrade）

- **誰在做：** RA 的「好、不太差、醜」、Hussman、538。反面例子：Bloomberg 100%、GS BMRI 73%、CNN 沒有存檔、538 頁面隨主機消失。
- **我們現況：** 本文件沒有檢討章節；forecasts 表可以被覆寫，也沒有匯出。
- **具體改動：** 只保留兩件事：（1）把紀錄匯出到 repo 或 R2，讓紀錄不會跟著網站消失（與 L09 的匯出合併）；（2）每年 10 月在本文件寫一段簡短檢討，只列累積 live BSS 與區間、區間做出來後的涵蓋率，以及 model_version 的變更與理由。**不做逐年分 basis 的可靠度圖，也不列 top-5 失誤**：一年約 12 個獨立列，p≈0.67 時 top-5 失誤就只是那幾個下跌月份。
- **審查：** evidence downgrade（證據是自述的例子，實質內容 L09、L10 已涵蓋）；fit downgrade（樣本太小，多數報表是雜訊）。

#### L15 標準化基準窗口要凍結（downgrade）

- **誰在做：** BFCI 用固定的 1994 至 2008 年中基準；CNN（窗口不公開，無法複製）與 GS RAI（1 年滾動，刻度會漂移）是對照。
- **我們現況：** `forecast.ts:13` 寫的是絕對門檻 `VIX_STRESS = 30`；G06 已規劃用 expanding 中位數；M1 已要求凍結基準率窗口；G02 會記錄 history_start。
- **具體改動：** 只在 G06 的登記列加一行：不用滾動窗口的 z-score；任何標準化後的 VIX 只能在名額 1 **取代** vixStress，不能成為第三個 flag；要在測試前選定採用 VRP 還是 z-score。
- **審查：** evidence downgrade（CNN 只有樣本內證據，BFCI 只描述現況；滾動窗口不算偷看未來，選哪種窗口是設計偏好）；fit downgrade（大多與 G06、M1、G02 重複）。

#### L16 寫清楚幣別與標籤（keep）

- **誰在做：** Vanguard 以當地幣別建模，另外用 FX 模型轉換；JPM LTCMA 標明日期、版本與資料截止日。
- **我們現況：** `forecast.ts:62` 的標籤是 `future.close > p.close`，即美元計價、不含股息的價格指數；頁面副標題沒有說明。使用者以新台幣定投，美元計價上漲的 21 日，換成新台幣仍可能是虧損。
- **具體改動：** `outlook.tsx` 副標題寫「以美元計、不含股息的 S&P 500 價格指數」，並註明新台幣結果還取決於 USD/TWD。M2 照已登記的方式定案。任何新台幣報酬的觀點都要另外登記成新目標，不能直接沿用 S&P 的 flag。
- **審查：** evidence keep（標籤準確性，不需要預測證據）；fit keep。

#### L17 信心只改變風險描述（downgrade）

- **誰在做：** AQR「Sin a Little」（最多小幅偏離）；Bridgewater 依 regime 調整風險組合，不調整方向；BlackRock 不確定時少說；Morningstar 不確定性越高門檻越寬。
- **我們現況：** 偏多／偏空 的 badge 讀起來像指令；`outlook.tsx:262` 只有一般性的「這不是投資建議」。
- **具體改動：** 主畫面固定加一行：「對每月定期定額：這個數字不是加碼或停扣的訊號，它告訴你下個月可能的波動。」與 L01 的改標籤一起做。**刪除原提案的顯示上限**（|p − 基準| 最多顯示 5pp），那等於扭曲模型自己的輸出；讓偏離保持小的正確方法是 G01 收縮。
- **審查：** evidence downgrade（定投那一行有 AQR 的樣本外證據支持；顯示上限隱藏資訊）；fit downgrade（同樣理由）。

### 4. 不借鑑的做法與理由

| 做法 | 誰在做 | 不借鑑的理由 | 審查（evidence／fit） |
|---|---|---|---|
| **X01 指標投票、「看多指標百分比」合成** | TradingView、Investing.com、NDR、CNN F&G 七成分等權 | 同一個價格序列的 12–15 條均線，其實是一個趨勢訊號被投了 12–15 次；F&G 的成分大多是同一個風險偏好因子；回測選出的門檻會在分岔路徑上消耗試驗預算 [J22]。維持一個趨勢 flag 加一個壓力 flag。若 G07 真的要組合，每個概念一票，用收縮後的校準機率，等權或事前登記的權重；**不數票，也不輸出 Strong Buy 這類標籤** | keep／keep |
| **X02 extremizing** | GJP（Satopää、Baron 等） | extremizing 修正的是「平均很多各自只知道一部分的獨立預測者」造成的信心不足。我們是一個在小樣本、群聚資料上擬合的模型，失效方向是過度自信，正確做法正好相反：往基準率收縮（G01）。第 6 節補一行記錄，避免再被提出 | keep／keep |
| **X03 依波動或 regime 調整定投金額、暫停扣款** | 波動目標基金、CTA | 可實作的波動管理股票組合在樣本外不如買進持有（Cederburg 等人 2020；DeMiguel 等人 JF 2024）[J79][J78]；Man 自己也說好處在尾部，不在 Sharpe [J76]。產品只借風險溝通（L04、L17）。第 6 節補寫明：部位大小建議不在範圍內 | keep／keep |
| **X04 擬合權重、HMM regime、機器學習組合** | Seeking Alpha、Zacks、Kritzman、Nystrup、Quantpedia | 約 85 列、補完歷史後約 400 列、2 個 flag 的條件下，任何擬合權重都是樣本內。Quantpedia 2026 的 permutation test 無法拒絕「沒有擇時能力」[J81]。補完歷史後若要重新考慮，只能走試驗登記，並套用 L08 修正後的門檻 | keep／keep |
| 把 CNN F&G、BFCI、MLIV、策略師調查當輸入 | 媒體 | CNN 沒有官方歷史、只有樣本內證據，而且效果在 2014 年後變弱；BFCI 描述的是現況；MLIV 是不具代表性的便利樣本；策略師目標與報酬相關約 0。G13、G20 已經只允許當背景 | 研究彙整（非 L 條目） |
| 預測市場價格當輸入或當正確答案 | Kalshi、Polymarket | S&P 價位市場等於薄量、散戶定價版的選擇權隱含機率，VIX 的 N(d2) 已經免費而且歷史長（M3）；校準證據是平台自述，還有相反的研究；Atanasov 的結果也顯示統計聚合後的調查可以贏過市場 | 研究彙整 |
| 主觀情境機率、委員會判斷 | BlackRock、Fidelity 的階段判斷 | 沒有計分紀錄；CFO 研究顯示主觀區間系統性太窄 | 研究彙整 |
| 痛過之後在同一段歷史上改模型 | Hussman（2009、2014）、BofA SSI 門檻 | 這就是分岔路徑；L09 已寫入「不依 live 結果調參」 | 研究彙整 |
| L17 原提案的 5pp 顯示上限、L13 原提案的 24 個月退場規則、L08 原提案的 N=8 打亂門檻、L02 的 15/21 門檻 | 本輪原始提案 | 分別會扭曲輸出、誤殺有效 flag、程序不成立、新增分岔；已在第 3 節以修正版取代 | fit 審查否決該部分 |

### 5. 參考來源

標註「403／429／451／轉址」的頁面，我們的抓取沒有取得原文，內容來自轉載或搜尋摘要。

[J1] https://www.cnn.com/markets/fear-and-greed （HTTP 451）
[J2] https://seekingalpha.com/article/4453044-fear-and-greed-index
[J3] https://capital.com/fear-and-greed-index
[J4] https://research.ucc.ie/en/publications/the-cnn-fear-and-greed-index-as-a-predictor-of-us-equity-index-re/
[J5] https://www.cxoadvisory.com/?p=45907
[J6] https://backtest.substack.com/p/i-backtested-the-cnn-fear-and-greed
[J7] https://www.advisorperspectives.com/articles/2022/10/17/forecast-for-us-recession-within-year-hits-100-in-blow-to-biden
[J8] https://statmodeling.stat.columbia.edu/2023/10/22/bloomberg-news-and-its-embarrassing-calibration-error/
[J9] https://www.bis.org/publ/bisbull80_annex.pdf
[J10] https://www.richmondfed.org/publications/research/economic_brief/2021/eb_21-01
[J11] https://www.federalreserve.gov/econres/notes/feds-notes/a-new-index-to-measure-us-financial-conditions-20230630.htm ；https://www.federalreserve.gov/econres/notes/feds-notes/predicting-recession-probabilities-using-the-slope-of-the-yield-curve-20180301.htm
[J12] https://www.schwab.com/learn/story/time-season-year-end-targets
[J13] https://www.bloomberg.com/news/articles/2025-06-06/stocks-will-rally-despite-extended-dollar-declines-mliv-pulse
[J14] https://www.kitco.com/news/off-the-wire/2025-05-28/trump-tariff-jitters-sp-500-finish-year-nearly-even-2024-reuters-poll
[J15] https://kentclarkcenter.org/ft-booth-us-macroeconomists-survey/
[J16] https://www.advisorperspectives.com/commentaries/2023/11/01/economists-no-longer-expect-recession-lance-roberts
[J17] https://cdn.freefincal.com/wp-content/uploads/2018/05/Morningstar_Equity_Research_Methodology_Guide_Final.pdf
[J18] https://morningstar.co.uk/uk/news/227180/what-is-the-morningstar-uncertainty-rating.aspx
[J19] https://practicalstockinvesting.com/2010/08/11/a-new-morningstar-study-expense-ratios-a-better-performance-indicator-than-stars/
[J20] https://in.tradingview.com/support/solutions/43000614331
[J21] https://www.investing.com/equities/orion-a-technical
[J22] https://ideas.repec.org/p/fmg/fmgdps/dp303.html
[J23] https://www.zackspro.com/zind_zrank.asp
[J24] https://help.seekingalpha.com/premium/quant-ratings-and-factor-grades-faq
[J25] https://seekingalpha.com/article/4683185-university-of-kentucky-study-finds-seeking-alpha-quant-ratings-beat-the-market-sa-quant
[J26] https://corporate.vanguard.com/content/dam/corp/research/pdf/vanguard_capital_markets_model.pdf
[J27] https://thereformedbroker.com/2012/12/16/the-one-thing/ （二手轉述）
[J28] https://fidelity.com/bin-public/060_www_fidelity_com/documents/fixed-income/Business_Cycle_Sector_Approach.pdf
[J29] https://www.blackrock.com/institutions/en-us/insights/blackrock-investment-institute/global-weekly-commentary
[J30] https://am.jpmorgan.com/de/en/asset-management/institutional/insights/portfolio-insights/ltcma/
[J31] https://www.advisorperspectives.com/commentaries/2023/03/17/gmo-7-year-asset-class-forecast-february-2023
[J32] https://www.cxoadvisory.com/individual-gurus/gmos-stunningly-accurate-forecast
[J33] https://mymoneyblog.com/gmo-asset-return-forecasts-vs-actual-returns-2011-2018.html
[J34] https://www.advisorperspectives.com/commentaries/2025/01/14/asset-allocation-10-years-good-not-bad-ugly （403；RA 原 PDF 已轉址）
[J35] https://www.researchaffiliates.com/content/dam/ra/publications/pdf/618-cape-fatigue-v4.pdf
[J36] https://info.bcaresearch.com/hubfs/NDR_January2025/pdfs/NDR_Investment_Solutions_Capabilities_Brochure.pdf （404）
[J37] https://businessinsider.nl/the-stock-market-just-flashed-3-bullish-buy-signals-strategists-say/ （二手）
[J38] https://www.advisorperspectives.com/commentaries/2019/01/22/being-right-or-making-money
[J39] https://monevator.com/asset-allocation-for-all-weathers
[J40] https://www.aqr.com/Insights/Perspectives/Sin-a-Little
[J41] https://www.Aqr.Com/Insights/Research/Journal-Article/Contrarian-Factor-Timing-is-Deceptively-Difficult-Supplement
[J42] https://www.aqr.com/Insights/Research/Journal-Article/Craftsmanship-Alpha-An-Application-to-Style-Investing
[J43] https://hussmanfunds.com/wmc/wmc150112.htm
[J44] https://www.hussmanfunds.com/wmc/wmc141006.htm
[J45] https://goodjudgment.com/wp-content/uploads/2021/10/Superforecasters-A-Decade-of-Stochastic-Dominance.pdf
[J46] https://www.psychologicalscience.org/journals/psychological-science/0956797614524255/
[J47] https://ifp.nyu.edu/2025/journal-article-abstracts/09567976241266481/
[J48] https://www.hks.harvard.edu/publications/value-precision-probability-assessment-evidence-large-scale-geopolitical-forecasting
[J49] https://dblp.org/pid/41/2093
[J50] https://pubsonline.informs.org/stoken/default+domain/EC-crowds/full/10.1287/mnsc.2015.2374
[J51] https://sloanreview.mit.edu/?p=65293 （全文未取得）
[J52] https://archive.phf.org/resourcestools/Documents/Pre_Mortem_Analysis.pdf
[J53] https://risknet.de/fileadmin/eLibrary/Flyvbjerg-Nobel-PMJ2006.pdf
[J54] https://www.philadelphiafed.org/surveys-and-data/real-time-data-research/survey-of-professional-forecasters
[J55] https://www.philadelphiafed.org/surveys-and-data/real-time-data-research/error-statistics
[J56] https://www.philadelphiafed.org/surveys-and-data/real-time-data-research/anxious-index
[J57] https://www.nber.org/papers/w16215.pdf
[J58] https://bfi.uchicago.edu/wp-content/uploads/Managerial-Recalibrations_Boutros_Graham_Harvey.pdf
[J59] https://news.kalshi.com/p/prediction-market-calibration-how-accurate-is-kalshi
[J60] https://kalshi.com/research/kalshi-research-calibration.pdf （429）
[J61] https://www.lesswrong.com/posts/Hruc6Gwo3vBZFGb6v/empirical-calibration-of-polymarket-analysis-of-7-661
[J62] https://dlnews.com/articles/markets/polymarket-kalshi-prediction-markets-not-so-reliable-says-study/
[J63] https://www.newyorkfed.org/research/capital_markets/ycfaq （本文沒有渲染）
[J64] https://www.newyorkfed.org/medialibrary/media/research/capital_markets/Prob_Rec.pdf
[J65] https://www.newyorkfed.org/medialibrary/media/research/current_issues/ci12-5.pdf
[J66] https://www.federalreserve.gov/econres/feds/the-near-term-forward-yield-spread-as-a-leading-indicator-a-less-distorted-mirror.htm
[J67] https://ideas.repec.org/a/bes/jnlbes/v27i4y2009p492-503.html
[J68] https://fivethirtyeight.com/features/when-we-say-70-percent-it-really-means-70-percent
[J69] https://projects.fivethirtyeight.com/checking-our-work （302 轉址至 ABC News）
[J70] https://statmodeling.stat.columbia.edu/2020/10/15/calibration-problem-in-our-election-forecast/
[J71] https://papers.ssrn.com/abstract=2089463
[J72] https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing
[J73] https://ideas.repec.org/a/eee/jfinec/v135y2020i3p774-794.html
[J74] https://quantpedia.com/deconstructing-the-time-series-momentum-strategy/
[J75] https://www.man.com/insights/the-impact-of-volatility-targeting
[J76] https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf
[J77] https://www.nber.org/papers/22208
[J78] https://lbsresearch.london.edu/id/eprint/3716/1/The%20Journal%20of%20Finance%20-%202024%20-%20DeMIGUEL%20-%20A%20Multifactor%20Perspective%20on%20Volatility%E2%80%90Managed%20Portfolios.pdf
[J79] https://www.lehigh.edu/~xuy219/research/COWY.pdf
[J80] https://academic.oup.com/jfec/article/7/2/174/856522
[J81] https://quantpedia.com/does-more-history-help-a-market-regime-hmm-and-the-trouble-with-out-of-sample-evaluation/
[J82] https://rpc.cfainstitute.org/research/financial-analysts-journal/2012/regime-shifts-implications-for-dynamic-strategies-corrected
[J83] https://www2.imm.dtu.dk/pubdb/pubs/6808-full.html
[J84] https://www.cnbc.com/2018/03/27/goldman-sachs-computer-model-warns-bear-market-is-near-but-the-firms-analysts-dont-believe-it.html
[J85] https://hedgefundalpha.com/news/global-risk-appetite-indicator/
[J86] https://www.nber.org/system/files/working_papers/w23191/w23191.pdf
[J87] https://www.newyorkfed.org/research/staff_reports/sr794.pdf
[J88] https://crawford.anu.edu.au/sites/default/files/2025-05/30_2022_Chernis_Coe_Vahey.pdf
[J89] https://minneapolisfed.org/banking/current-and-historical-market--based-probabilities
[J90] https://arxiv.org/abs/2106.00170v3
[J91] https://www.dept.aueb.gr/sites/default/files/ode/seminars/Equity_premium_quantile.pdf
[J92] https://metricgate.com/docs/var-backtesting-kupiec/
[J93] https://blog.thinknewfound.com/2013/08/the-luck-of-the-rebalance-timing/ （403）
[J94] https://blog.thinknewfound.com/2019/07/ensemble-multi-asset-momentum/
[J95] https://papers.ssrn.com/abstract=2460551
[J96] https://papers.ssrn.com/abstract=2326253
[J97] https://papers.ssrn.com/abstract=3275654
[J98] https://facultystaff.richmond.edu/~dcrousho/docs/FRBP%20wp14-5%20Croushore%20Marsten%20Continuing%20Power%20of%20Yield%20Spread.pdf
[J99] https://help.seekingalpha.com/premium/have-seeking-alphas-quant-ratings-been-back-tested
