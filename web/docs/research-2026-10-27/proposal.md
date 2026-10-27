# 2026-10-27 研究總結與改善方案

> 本文件尚未回測任何新條件；所有新條件都必須先寫進 forecast.md 的事前登記。
>
> **以 Codex 審閱為準：** 本文件與 [codex-review.md](codex-review.md) 衝突時，以 codex-review.md 為準。主要推翻處：
>
> - **R2-1／M-02：** 波動族的 p ≤ 0.025 是政策性加嚴，不能宣稱已消除偷看的影響。歷史通過後仍要標「經探索選出的回溯驗證」；否決後禁止在同一段歷史換窗口重測，但不永久禁止所有波動研究。
> - **R2-5(e)／M-03：** 「事件群 ≥ 8」刪除。在 offset 0 的 21 日格線上，幾乎每個正例自成一群，實際上等於「正例列數 ≥ 8」。另外，R2-5「在任何 per-cell dd5 bssLow 計算之前生效」已不成立（現行程式已計算並留存 dd5 cell 診斷），要如實登記既有暴露。
> - **R2-8：** EWMA 比較基準延後，規格不完整（variance 遞迴式、初始化、當日報酬納入時點都沒定）。
> - **M-06：** 刪除。第三個 flag 通過不代表等權組合也通過，組合方法日後要獨立登記。
> - **§7 第 1 題：** 1976–1989 的 trend-only 模型驗證不了含 VIX 的現行 dd5 模型，不是現行模型的乾淨保留期。
> - **§5.2：** 原本把 P3 的 RV BSS 0.052 與 incumbent 0.049 直接比較的句子已改寫，兩者不可比。
>
> 其餘逐 ID 判定（R2-2 的理由、R2-5 的 bootstrap 規格、R2-6、M-07、ST-02 等）見 codex-review.md。

這份文件整理 2026-10-27 這一輪的七份外部研究（P1–P7）、驗證者的查核結果、三份規劃（統計、產品、資料）與兩份審查（規則、完整性），以及一次策略師戰術呼叫的描述性計分，最後給出改善方案。路徑相對於 `web/`。

七份研究都是另一個 LLM 產出的二手材料：連結大多帶 `utm_source=chatgpt.com`，裡面的引用、數字和網址都可能是幻覺。本文只把驗證者實際讀到原文的內容列為「已核實」，其餘依查核程度標「部分」「被推翻」「無法核實」。三份規劃互相衝突時，合規問題以規則審查為準；仍有分歧的地方在 §5.9 說明。

## 1. 摘要

1. **這輪研究沒有找到任何能改善 P(up) 的條件。** GWZ 2024 的月頻 OOS 結果裡，variance 類變數大多為負；技術指標主成分 tchi 在 2009 年後持續落後；單一指數 TSM 的 OOS R² 為 −1.78%（都已核實）。下一輪不給 P(up) 任何試驗名額。
2. **下一輪最多 1 個名額，只給 dd5：用 21 日已實現波動（`rvHigh`）取代 `vixStress`。** 這個選擇已經受到污染：P3 與本次協調者都看過 trailing RV 對 dd5 的探索結果。所以採用門檻要比一般候選更嚴（虛無 p ≤ 0.025），否決後同族條件下一輪不得重開。
3. **開名額之前要先補四條規則：** 把外部偷看記進試驗登記；L08 增補 dd5 標籤的虛無分佈；虛無次數由 20 提高到 199；dd5 的 cell 層級閘門。dd5 目前只有全域閘門；依程式推導（網站上尚未實際看到），今天的 cell 換到「跌破 200 日線」時，頁面仍會標成已計分。
4. **頁面上最需要改的是 dd5 的定義。** 正確說法是「未來 21 個交易日內，至少一天收盤比今天低 5% 以上」，網頁與 iOS 要一起改。另外要補 dd5 的上線後紀錄（L09 的第三種分數），網格與標籤定義要在第一次顯示前寫進 forecast.md。
5. **`strategists.ts` 有 5 列已過時，其中 Yardeni、Wells Fargo 有原文可證。** Yardeni 8,400 → 7,900（2026-09-15）；Wells Fargo 要拆成 WFS 7,700 與 WFII 7,800–8,000。BofA、UBS 兩列有二手來源一致，標「媒體轉述」後更新。MS、GS、Citi 等列要等人工核對原文。
6. **策略師戰術呼叫的計分結果：看空呼叫 21 日命中率 27.9%，低於基準 32.8%；看多 66.7%，基準 67.2%。** 這是便利樣本、規則未事前登記、每家 n ≤ 12 的探索性描述，只寫進文件，不上頁面，也不當條件。它本身也是一次偷看，要記進登記。
7. **每日「為什麼漲跌」改提示詞的資訊順序。** 現在是先告訴模型漲跌、再給新聞、再問原因，屬於 hindsight 順序。改成先列結構、再列事件、最後才問原因，並明確允許回答「沒有可清楚辨識的單一催化因素」。黑名單與策略師語句的護欄，要先在實際輸出裡找到觸發例子才加。
8. **「勝過現金（含股息）」標籤的資料前提已經解開**（`^SP500TR` 從 1988 年起、DTB3）。但這個標籤只顯示、不計分，加上 Yahoo 條款限制自動抓取，優先序放在 P2；現金門檻全程只用 DTB3。

## 2. 這輪研究學到什麼

驗證結果分四種：已核實（驗證者讀到原文，數字對得上）、部分（主旨對，但有細節沒讀到或不準）、被推翻、無法核實（沒有一手來源可對，或屬於設計提案）。

### 2.1 模型方法與學術證據

| 主題 | 學到什麼 | 出處 | 驗證 |
| --- | --- | --- | --- |
| VRP 原文 | BTZ 2009 正式版 Table 2 的 adj R² 在 1／3／6 個月分別是 1.07／6.82／5.42，季度最強；樣本 1990-01..2007-12，全樣本重疊迴歸，沒有 OOS。forecast.md §3 VRP 列的等級應改為 academic_is，[81] 可補上 DOI 10.1093/rfs/hhp008。 | P1-C01 | 已核實 |
| variance 類月頻 OOS | GWZ 2024 Internet Appendix「Table IA.6 Panel A」的 OOS R²（unrestricted／OOSCT）：vp −0.42/−0.23、impvar −3.32/−3.19、vrp −8.61/+0.21（不顯著）、rsvix −4.78/−3.27、svar −0.31/−0.01。VIX 水準本身對下月報酬均值沒有 OOS 預測力，與 P(up) BSS≈0 一致。 | P1-C04 | 已核實（表名是 IA.6 Panel A，不是 IA.6A） |
| 技術指標 | tchi 月度 OOS R² +0.26%／OOSCT +0.48%，全期顯著，但原文寫 "Since 2009, tchi has consistently underperformed."。forecast.md §3 寫的「約 0.20」其實是 IS 係數，不是 OOS R²。 | P1-C05 | 已核實 |
| 單一指數動能 | Huang 等 2020 Table 2，S&P 500 期貨：12 個月報酬預測下月，OOS R² −1.78%（OOS 2000–2015）。 | P1-C16 | 已核實 |
| 波動與方向 | Christoffersen–Diebold 的實證是全樣本 logit（舊 VIX、S&P 100、1986–2003），屬 academic_is；51–72% 是樣本內 fitted 機率。Chronopoulos 等 2018 是每日方向，表上標「Brier」的 0.6907／0.7041 不符合標準二元 Brier 的尺度，原因未解，不可換算成 BSS；而且該文的 C&D 用 GARCH 波動，不是 VIX，不能當 VIX 的 OOS 佐證。 | P1-C17、P2-C18 | 已核實／部分 |
| 波動可預測 | Risk Everywhere（RFS 2018）Table 5：21 日滾動平方報酬預測未來 20 日 variance，OOS R² 8.1%，static 2.9%。限制：預測目標是 5 分鐘日內資料算的 RV，對象是一籃股指期貨，不只 S&P；這是 variance 預測，不是二元回撤預測。 | P2-C02 | 已核實 |
| dd5 的機制 | 零 log drift 時，波動不影響期末漲跌的對稱性，但會改變觸及下方門檻的機率。這可以解釋為什麼 dd5 比 P(up) 容易有 skill，但沒有證明它就是 skill 的全部來源。 | P3-C01 | 已核實（標準推導） |
| 監測方式 | 連續監測會把「盤中觸及、收盤沒觸及」的路徑也算進去：σ=20% 時連續 37.43%、每日收盤約 31%。要貼合我們的標籤，用每日收盤模擬或 BGK 修正（b* = b − 0.5826σ√Δt）。 | P3-C02、P3-C03 | 已核實（驗證者重算 31.32%／30.98%） |
| raw VIX 代入 GBM | VIX 是風險中性、又用日曆日，直接當 physical σ 會高估。P3 試算的平均預測 32.6% 對實際 16.8%，這組數字是 P3 自算。 | P3-C04 | 部分 |
| 組合方法 | BMA 在美國月度 OOS 的 Theil U 為 1.0009，沒有勝過歷史均值（Schrimpf）。算術平均的 Brier 不高於成分 Brier 的平均（凸性），但不保證勝過最佳成分；乘 likelihood ratio 需要條件獨立。 | P2-C15 | 已核實 |
| SKEW | Bevilacqua–Tunaru：重建的 total SKEW 對下月「跌 ≥5%」指標的 OOS R² 1.30%，只在 10% 顯著；方向是低 SKEW 較危險；加入其他尾部風險控制後不顯著；序列是作者自行重建的。forecast.md 略過 SKEW 的結論不變。 | P2-C06 | 已核實 |
| 月份結構 | Guo 2025 的 recursive OOS R² 約 3.6–4.3%（月度、CRSP 含息）；但 P2 提出的日頻 F_EC 旗標是研究 LLM 自創，論文裡沒有。 | P2-C05 | 已核實（論文）；F_EC 為 none |
| 期權密度 | Shackleton–Taylor–Yu 2010：4 週期限、176 個不重疊預測，轉換後的 option density 在 log-likelihood 上勝過 ARCH density。這是 density 對 ARCH 的比較，不是對基準率的 Brier 比較，不支持 N(d2) 轉 P(up)。 | P2-C13 | 部分 |
| 置換檢定解析度 | Phipson–Smyth：m 個置換時 p 的最小值是 1/(m+1)；m=20 時約 0.048。正確的 p 是 (b+1)/(m+1)。 | P3-C20 | 已核實 |
| 偷看 | P3 在 1992-01-02..2025-11-10 上，用 dd5 標籤比較了 6 個波動基準，作者自承這是探索資料。 | P3-C08 | 已核實 |
| purge | forecast.ts:264 已經只用 knownOn ≤ asOf 的標籤，P7 的 purge／embargo 建議不適用。 | P7-C5 | 已核實 |
| 其他 P1 文獻 | STW 1999（Reality Check p=0.908）、Hsu–Kuan 2005、Fisher–Statman 2000、Brown–Cliff 2004、EBP、Cederburg 2020 Table 5A：P1 自報讀過原文，本次驗證者沒有覆核。 | P1-C07、C09、C10、C13–C15 | 無法核實（本次未覆核） |

### 2.2 dd5 目標與回撤

| 主題 | 學到什麼 | 出處 | 驗證 |
| --- | --- | --- | --- |
| 文案錨點 | `pages/outlook.tsx:65`「下個月出現 ≥5% 跌幅的機率」、`src/lib/communication.ts:65`「出現 ≥5% 回撤」、`pages/index.tsx:94`「≥5% 跌幅機率」都沒寫錨點，可能被讀成「從高點回撤」。 | P3-C24 | 已核實（驗證者多找到 index.tsx） |
| 上線後紀錄缺口 | `src/server/jobs.ts:549` 已存 `detail.drawdown.{p,base}`，但 `liveTrackOf`（communication.ts:34-54）只算上漲，`src/server/outlook.ts:63-64` 也只撈上漲用的欄位。dd5 少了 L09 的第三種分數。 | P3-C26 | 已核實 |
| 主報數字 | G09 列同時記了 offset 0 的 0.049 [0.016, 0.083] 與相位平均 0.038 [0.014, 0.064]。L02 規定相位平均是主要結果，但頁面與 `drawdownScored` 的 live gate 用 offset 0（`forecast.ts:699` 單一相位 walk-forward，`:722` 傳給 `drawdownScored`）。兩者都通過 G09，所以不是違規，只是不一致。 | 規則審查 | 已核實（讀程式） |
| cell 閘門缺口 | `drawdownScored`（forecast.ts:611）只看全域 `bssLow > 0` 加上所選 cell 的 nEff ≥ 30、段數 ≥ 8。P(up) 有 G03 (b)(c)(d) 的逐 cell bootstrap，dd5 沒有。G09 規則文字和程式一致，所以是規則缺口，不是 bug。 | 完整性審查 | 讀程式推導，網站上沒看到這個情境（今天 cell 是站上 200 日線） |
| 基準率 | 21 日內跌 5%：1950 起 15.18%、1990 起 16.78%；3% 為 31.17／32.60%；10% 為 3.07／4.06%；63 日 5% 為 32.02／31.93%、10% 為 11.13／14.04%（Yahoo ^GSPC，到 2025-12-31）。和 G09 的 16.6% 一致。 | P3-C14 | 已核實（無條件描述統計） |
| 主目標維持 | 5%／21 日維持主要目標；3%、10%、63 日不要看完結果才換題。 | P3-C15 | 方法建議，與 G09 一致 |
| 媒體的「拉回」 | 「每年約 3 次 5% 拉回」是高點到低點的年頻次，和 D4 是不同事件，不能直接對照。原說法裡「10% 每年一次」被歸給 Wilson，實際出自 Subramanian 的另一次受訪。 | P7-C18 | 部分 |

### 2.3 資料源

| 主題 | 學到什麼 | 出處 | 驗證 |
| --- | --- | --- | --- |
| 含息總報酬 | Yahoo chart `^SP500TR` 用 period1／period2 指定區間：200、1d、1988-01-04 起、9,777 筆。「最長的免費端點」是比較性說法，沒驗證。 | P4-C01 | 部分 |
| Yahoo 陷阱 | `range=max&interval=1d` 會靜默降成 3mo（157 筆）；Python UA 回 429；Yahoo Terms（2026-08-04 版）禁止未經許可的自動收集。 | P4-C02 | 已核實 |
| 現金報酬 | French daily RF 從 1926-07-01 起，落後約兩個月，每月重建全史；2024-06 起改用 ICE BofA 1M T-bill。DTB3 從 1954-01-04 起，是 discount basis；DGS1MO 2001-07-31 才開始。H.15 在 16:15 ET 公布。 | P4-C04、P4-C05 | 已核實 |
| 股息推導 | 用 TR 比值就已含股息，不必另建股息序列。S&P 原文 403，沒讀到。 | P4-C03 | 部分 |
| VIX 回算 | SEC Release 34-48807：新版 VIX 2003-09 推出，回算到 1990-01-02。1990–2003 的 walk-forward 屬 pseudo-OOS。 | P4-C07、P3-C18 | 已核實 |
| HY OAS | FRED 上的起點會往後移（forecast.md [41] 看到 2023-10-24，P4 看到 2023-10-27），「2026-04 起改為滾動 3 年」的政策日期沒核實。 | P4-C11、P3-C17 | 部分（只能寫「觀察到起點在移動」） |
| FactSet 歸檔 | 入口 302 到最新 PDF；舊檔在 `insight.factset.com/hubfs/Earnings%20Insight/`；`012723A.pdf` 有、`012723.pdf` 404；索引頁 `/topic/earnings/page/N` 到第 84 頁。最早文章是 2010-06-19，不是 P4 寫的 2012-11-09。 | P4-C15 | 部分（日期被推翻） |
| 序列無 vintage | Cboe、Yahoo、FRED 都是現行修訂版；FactSet 週報本身是 point-in-time 快照。 | P4 多條 | 部分 |

### 2.4 策略師目標價

| 機構 | 現況（strategists.ts） | 查到的 | 出處 | 驗證 |
| --- | --- | --- | --- | --- |
| Yardeni | 8400，asOf 2026-09，note「今年第三次上調」 | 2026-09-15 下調為 7,900，8,400 移到 2027 年中 | P1-C18 | 已核實（官方原文） |
| Wells Fargo | 7950，asOf 2026-08，沒分部門 | WFS（Kwon）2026-09-14 由 7,950 下調到 7,700；WFII 2026-06-15 區間 7,800–8,000 | P1-C19 | WFII 官方 PDF 已核實；WFS 只有 Reuters 經 Kitco 轉載 |
| BofA | 7100，note「目前最保守」 | 7,100 → 7,400；同篇的 7,800 是 rolling 12 個月 | P1-C20 | 部分（多個二手來源一致，原 note 與日期沒看到） |
| UBS GWM | 7900 | 官方 2026-09-16「around 8,100 by December 2026」 | P1-C21 | 已核實 |
| UBS Global Research | 7500 | InvestingLive 2026-07-21 寫 8,100，但沒寫部門；2026-08 Reuters factbox 仍列 7,500 | P1-C21 | 部分，且有矛盾 |
| GS、Citi、JPM、DB、HSBC、Barclays、Evercore | 數值相同，asOf 多數不準 | GS 官方 2026-05-28；Citi 稱 2026-06-05 note；DB 官方 2025-12-02 | P1-C22 | 無法核實（本次未覆核） |
| MS Research | 表上沒有 | P1 稱官方 2026-05-15 為 8,000；MS WM 2026-10-14 年底 8,000、2027 年中 8,300 | P1-C22 | 無法核實（P1 附了官方網址，驗證者沒開；不等於沒有原文） |
| HSBC Private Bank | 表上沒有 | P1 稱 8,100（2026-09-14） | 完整性審查 | 無法核實 |
| RBC | 表上沒有 | 公布的是 rolling 12 個月 8,150，不能放進年底中位數 | P1-C23 | 無法核實 |

另外，forecast.md §2.1 MS 列的「2027 年中 8300」是 MS WM／GIC 的數字，不是 Wilson 的 Research。這和 Wells Fargo 的部門混用是同一類問題（P1 red flag，未覆核）。

### 2.5 策略師戰術呼叫

| 主題 | 學到什麼 | 出處 | 驗證 |
| --- | --- | --- | --- |
| 廣義評分 | CXO Guru Grades（2005–2012 收集，6,582 筆、68 位）：依筆數加權準確率 46.9%、依人等權 47.4%；期限混合，評分含去趨勢與文字判讀。 | P5-C02 | 已核實 |
| 重評 | Bailey 等 2017 用同一份 CXO 資料重新加權：多數 forecaster 與隨機無異（整體約 48%，Wilcoxon p=0.185）。這和 CXO 是同一份資料，不是兩份互相佐證的研究。 | P5-C03 | 已核實 |
| 有沒有稽核 | 沒找到符合我們定義（固定短期期限、SPX 價格、可交易起點）的稽核。這是否定式主張，只能寫「沒找到」。 | P5-C01 | 部分 |
| B&B 改版 | BofA Bull & Bear 2025-12 改版為 2.0，並畫了新舊兩條線。 | P5-C06 | 已核實（報導；銀行方法原文未讀） |
| 訊號日期 | BofA 表列起點與當時公開日有差：2020-03（Reuters 03-17 已報、表列 03-18）與 2026-05（Newsquawk 05-22、TheStreet 05-26）沒解決；2019 的兩筆只是正常的發布時差。 | P5-C08 | 部分（「回溯表有 look-ahead 風險」講太重） |
| 呼叫的形式 | 多數戰術呼叫是條件式、路徑式、區間式，或是全球股票的相對配置，不能直接當成「21 日後 SPX 漲跌」來計分。 | P5-C10、P7-C25 | 已核實／部分 |
| 短期股價不可預測 | Tetlock：短期股價連 superforecasters 也難有可觀進展；要對 pseudo-diagnostic news 打折。 | P7-C3 | 已核實（逐字稿） |
| meta-labeling | López de Prado 的 meta-labeling 是用次級模型決定部位大小；套到我們身上會抵觸 X03／L17。 | P7-C8 | 已核實 |

### 2.6 每日漲跌說明

| 主題 | 學到什麼 | 出處 | 驗證 |
| --- | --- | --- | --- |
| hindsight | Fischhoff 1975：知道結果會提高事後判斷的可能性，也會改變哪些資訊看起來重要，當事人多半沒察覺。現行 `marketPrompt` 正是「先給漲跌、再給新聞、再問為什麼」。套到 LLM 上是推論，沒人驗證過。 | P6-C06 | 已核實（原文與程式） |
| 找不到原因很正常 | Cutler–Poterba–Summers 1988：1946 年後最大的 50 個單日變動裡，有幾天 NYT 自己說找不到原因；全文沒給比例。 | P6-C03 | 已核實（OCR） |
| 允許「沒有催化因素」 | MS WM 2020-09-25 例文："There was no obvious catalyst to point to for the day's rally"。 | P6-C07 | 部分（Reuters 例文 401 沒讀到） |
| 盤後新聞 | `nasdaq.ts:106-111` 只解析日期、丟掉時間；`ai-batch.ts:91` 用日期相等撈新聞，分不出盤後新聞。 | P6-C20 | 部分（程式行為已核實；SF Fed 論文只談 FOMC） |
| 事件日曆 | BLS CPI 日程（08:30 ET）與 FOMC 日程是免費官方靜態資料；`calendar.ts` 的 `MACRO_EVENTS` 只有 FOMC。empsit 頁 403。 | P6-C18 | 已核實 |
| consensus | TE 的 Consensus 與 Forecast 是兩種東西，API 要訂閱；Investing.com 授權沒查到。 | P6-C19 | 部分 |
| 產業點數 | Select Sector 指數有 cap，「SPX 產業權重 × XLK 報酬」算出來不是真實產業貢獻。 | P6-C13 | 部分 |
| 已經做了的 | 價格口徑（`yahoo.ts:25` 用不含股息的 close）、remainder（`snapshot.ts:252`）、權重 as-of 註記、RSP−SPY，程式裡都已經有了。 | P6-C10–C12、C14 | 已核實（讀程式） |
| 分級與黑名單 | 原因句四級分類（observed／model_estimate／reported_interpretation／unclear）與句型黑名單是 P6 的設計提案，沒有外部出處。 | P6-C08、C09 | 無法核實（設計提案） |

## 3. 被推翻或可疑的說法

以下說法日後不要再引用，或引用時必須照這裡的修正寫。

| 說法 | 出處 | 問題 |
| --- | --- | --- |
| FactSet 最早文章是 2012-11-09 | P4-C15 | 被推翻：索引第 84 頁最早是 2010-06-19。 |
| Wilson 2023-10 說 "The issue is the timing of it." | P7-C2 | 被推翻：影片上傳日是 2023-04-13；逐字稿原話是 "we've been wrong on the timing"，而且 Wilson 把 12 個月目標和戰術路徑分開講。 |
| Rubner 2024-09 發報告「Cancels The Fall Correction」 | P7-C2 | 無法核實：引用頁沒有這個標題，兩次搜尋都找不到。 |
| Rubner 日曆轉折日的三支 YouTube 出處 | P7-C14 | 被推翻：三支影片都不是 Rubner（JPM Tyler、與 GS 無關的頻道、瑞典節目）。內容本身另有 Fortune 等出處。 |
| Wilson 2023 年「3,200 探底目標」、Kolanovic「預警跌 20%」 | P7-C1 | 部分：3200 是主持人說的；Kolanovic 是條件句、沒給期限。 |
| 「10% 修正每年約一次」出自 Wilson | P7-C18 | 被推翻：是 Subramanian；Wilson 的版本只出自 Reddit。 |
| 「拉回 5–10%」類呼叫可以客觀計分 | P7-C25 | 講太滿：多數呼叫沒有期限，門檻也模糊，沒有事前定義的對映規則就無法計分。 |
| 21 個相位平均能把雜訊壓到 1/21 | P7-C6（第一份報告） | 錯：相位共用路徑，有效樣本仍約為 days/21（L02 審查已註明）。 |
| expanding window 有標籤洩漏，需要 purge | P7-C5 的套用 | 不適用：forecast.ts:264 已經只用已知標籤。 |
| 把約 20 個歷史否決項併入置換虛無 | P7-C12 | 做不到：那些項目不是在同一份資料、同一套程序上測的。 |
| strategists.ts 只有 asOf、sourceUrl、note 欄位 | P5-C12 | 錯：還有 firm、target、horizon；而且它存的是年底目標，不是戰術呼叫。 |
| BofA 回溯表有 look-ahead 風險 | P5-C08 | 講太重：2019 兩筆是正常發布時差，只有 2020-03 與 2026-05 兩筆真正沒解決。 |
| Citi Panic/Euphoria「2008 年初還發出錯誤訊號」 | forecast.md §2.1 | 本次查核沒有任何佐證，在對過原文之前先刪掉。 |
| Citi 指標等級「independently_tested（負面）」 | forecast.md §2.1 | 應降為 anecdotal：Advisor Perspectives 原文 403 沒讀到，關於 vintage 改寫的說法也沒核實。 |
| UBS Global Research 已上調到 8,100 | P1-C21 | 可疑：來源沒寫部門，2026-08 Reuters factbox 仍列 7,500。 |
| Minneapolis Fed 檔名與日期不符 | P3-C04 | 這個「紅旗」本身是誤報：PDF 內文日期 2015-01-07 是對的，只是檔名寫 dec22。 |
| Chronopoulos 2018 的 0.69 是「疑似 log loss」 | P1 red flag | 不要這樣寫：原文表上就標 Brier。只能說數值不符標準二元 Brier 尺度，原因未解。 |
| HLZ t>3 當我們的採用門檻 | P1-C12 | 那是 cross-section 因子發現的情境，作者自己說不該機械套用；L08 已依實際搜尋次數處理。 |
| Hsu–Taylor–Wang 2016 支持 S&P 500 均線 | P1-C11 | 資產錯置：那是外匯研究。 |
| 「已核實 9 個市場」可做跨國 pooling | P2-C12 | 是研究 LLM 自報，驗證者沒有核實。 |
| P2 的重疊率與 nEff（RV 41.2%、52 週高點 88.6%、動能 79.4%、RV nEff 215.2／53 段等） | P2-C03、C07 | 只能當估計：用 Yahoo ^GSPC、窗口從 1992-01-02 起、段數定義與 G04 不同。 |
| P3 試算的 RV／EWMA／校正 VIX 的 dd5 BSS（0.052／0.056／0.064） | P3-C07 | 偷看後的數字，試算包在 chatgpt.com 無法取得；只能出現在「外部接觸」紀錄裡。 |
| Avow.ai 對 Tom Lee 的評分（+14，[−1, +28]） | P5-C04 | 陌生來源，沒有其他佐證，不引用。 |
| BBDS「unknown」比例 17.42%／10.54% | P6-C04 | 無法核實版本與數字；沒有任何提案依賴它。 |

## 4. 投行戰術呼叫的實際成績

本次協調者用 Cboe SPX 收盤，對 P5、P7 整理出的 99 筆呼叫做了描述性計分。這份計分**沒有事前登記**，規則是協調者自訂，樣本是媒體與 LLM 挑出來的便利樣本，**只能當探索性描述，不得上頁面，也不得當成條件**。

做法摘要：

- 進場點是發布日之後第一個交易日的收盤；另外做了一組「發布當日收盤」的敏感度測試。
- 有自述期限就用自述期限（「1–3 個月」取 63 日、「3–4 週」取 20 日、「1–2 週」取 10 日），沒講期限的用 21 日；另外一律附上 21 日、63 日與 21 日內最大回撤。
- 基準率用 2018-01-02 起所有重疊視窗：P(21 日上漲) 67.2%、P(63 日上漲) 74.1%、P(21 日內最大回撤 ≤ −5%) 18.1%（n=2195）。
- 99 筆中可計分 75 筆（看多 31、看空 44）；unclear 11、neutral 3、只有年月 9、重複 1。
- 腳本在 `/tmp/mo-research/scripts/score-calls.mjs`（暫存路徑，見 §5.9 P-01，要收進 repo）。

### 合併結果

| 合併方式 | 方向 | 自述期限命中 | 21 日命中 | 63 日命中 | 基準率 21／63 日 |
| --- | --- | --- | --- | --- | --- |
| 全部 | 看多 | 16/27 = 59.3% [40.7, 75.5] | 18/27 = 66.7% [47.8, 81.4] | 19/26 = 73.1% | 67.2／74.1 |
| 全部 | 看空 | 11/39 = 28.2% [16.5, 43.8] | 12/43 = 27.9% [16.7, 42.7] | 9/39 = 23.1% | 32.8／25.9 |
| 排除「全球股票」代理 | 看多 | 15/24 = 62.5% | 17/24 = 70.8% | — | |
| 排除「全球股票」代理 | 看空 | 11/33 = 33.3% | 12/37 = 32.4% | — | |
| 去群聚 | 看多 | 14/25 = 56.0% | 16/25 = 64.0% | — | |
| 去群聚 | 看空 | 10/33 = 30.3% | 11/36 = 30.6% | — | |
| 進場改發布當日收盤 | 看多 | 18/27 = 66.7% | 20/27 = 74.1% | 19/26 | |
| 進場改發布當日收盤 | 看空 | 12/39 = 30.8% | 15/43 = 34.9% | 10/39 | |

括號為 Wilson 95% 區間。看空呼叫後 21 日內回撤 ≤ −5% 的比例是 9/43 = 20.9%，基準 18.1%。

### 各來源（21 日命中，k/n）

| 來源 | 看多 | 看空 |
| --- | --- | --- |
| MS／Wilson | 2/3 | 5/11 [21, 72] |
| BofA Hartnett／B&B／FMS | 3/6 | 3/11 |
| GS 策略 | 3/3 | 1/5 |
| Rubner（GS→Citadel） | — | 1/4 |
| JPM | 2/3 | 0/5 |
| Fundstrat／Tom Lee | 5/9 | 2/3 |
| NDR／Clissold | 2/2 | — |

### 解讀

- 看空呼叫的命中率沒有高於「隨便猜跌」，點估計還略低；看多呼叫和無條件基準率差不多。區間都覆蓋基準率，結論只能是「看不出擇時能力」，不能說「顯著比較差」。
- 進場時點會左右結果：改用發布當日收盤，看空 21 日命中由 12/43 變成 15/43，Wilson 的看空由 5/11 變成 7/11。部分看空呼叫是在當天大跌、收盤之後才發布的。
- 每家 n ≤ 12，不能用來排名。

### 限制

1. 選樣偏誤：呼叫是媒體與 LLM 研究挑出來的，偏向有名、戲劇性的案例，事後回顧又偏好「錯得很明顯」或「對得很漂亮」的。
2. 來源未核實：#62、#67–#70、#76、#77、#83、#97 等只有影片標題、轉述或自動字幕；P7 第一份報告大量標「This content isn't available」；§3 已列出幾筆被推翻的出處。
3. 期限是協調者的詮釋；條件式（#2、#75、#94）與路徑式（#7、#63）用單一報酬判定並不公平。
4. 規則沒有事前登記，是協調者自訂。
5. 同一來源、同一天發多空兩種期限的呼叫（#79/#80 等）各自計分，彼此重疊。

### 對模型的意涵

這份計分不提供任何 P(up) 或 dd5 條件。它在 SPX 歷史上算了「策略師看空」這個潛在條件的 dd5 發生率，等於一次沒有登記的條件查詢，所以要記進「外部接觸」，並永久禁止把「策略師看空」登記成候選（§5.2）。它可以寫回 forecast.md §7，把「沒有人回頭檢查戰術呼叫命中率」改成「做過一次探索性描述，含上述限制」。

## 5. 改善方案

欄位說明：「需事前登記」指必須先寫進 forecast.md 的事前登記並合併，才能跑任何相關計算或上線。成本：低＝只改文件或字串；中＝改程式加測試；高＝新資料管線或大量計算。優先序：P0＝開新一輪或上線任何新數字之前要先完成；P1＝下一輪內完成；P2＝之後。

### 5.1 模型方法

| ID | 做什麼 | 依據 | 規格 | 需事前登記 | 成本 | 優先序 |
| --- | --- | --- | --- | --- | --- | --- |
| M-01 | L08 增補二：dd5 標籤的虛無分佈 | L08 原文只寫上漲標籤；`nullPairedBss` 已支援 `label`（forecast-eval.ts:306-307），`backtest.ts:136` 已傳 `target`（P2-C04 部分） | 以新增條目寫，不改第 75 行原文。dd5 名額的虛無序列把 1990-01-02 起每日的 dd5 標籤做區塊置換，區塊長、種子、regime 與 knownOn 不動的規則同 L08。參考與候選都用 `label="dd5"`。指令固定為 `scripts/backtest.ts --offline --as-of <登記日> --target dd5 --variant <ref>,<cand> --null`。 | 是 | 低 | P0 |
| M-02 | 虛無次數 20 → 199，門檻改為精確 p | Phipson–Smyth（P3-C20 已核實）；P3-C08 偷看 | N=199，種子 20261026+j（j=1..199）；p = (1 + #{虛無值 ≥ 觀測值})/(N+1)。一般候選採用條件 p ≤ 0.045，與原規則的偽通過率 1/21≈0.048 同一水準、不放鬆，只是解析度提高。波動族候選（定義見 §5.2 R2-1）p ≤ 0.025，這是偷看的懲罰，事前固定。原有條件（bootstrap 下界 > 0、L03、G04）照舊。 | 是 | 中（計算量約上一輪 10 倍，離線） | P0 |
| M-03 | dd5 的 cell 層級閘門 | 完整性審查：`drawdownScored` 只看全域 bssLow；P(up) 有 G03 (b)(c)(d) | 比照 G03 (b)(c)(d)，標籤換成 dd5：今天所選 cell 在 offset 0 walk-forward 的列數 ≥ 30、最長連續區間 ≥ 8、該 cell 的 dd5 bssLow > 0；空重抽依增補一。另加 dd5 事件群數下限：cell 內 dd5=1 的列，距上一個事件列 ≥ 21 個交易日算新的一群，群數 ≥ 8。這個 8 是比照 G04 的事前承諾，不是推導。不通過時頁面標「未通過驗證」，p 照常顯示。規則必須在計算任何 per-cell dd5 bssLow 之前 commit。 | 是 | 中 | P0 |
| M-04 | dd5 主報數字統一為相位平均 | L02；規則審查確認 live gate 用 offset 0 | 不改寫 G09 列（它已同時記兩個數字）。另開條目：「今後 dd5 的採用與否決一律用相位平均；`drawdownScored` 的 live gate 維持 offset 0（每日計算成本），兩者並列時標明」。頁面與文件主報 0.038 [0.014, 0.064]，offset 0 的 0.049 標為「單一相位」。 | 是（決策用哪個數字） | 低 | P1 |
| M-05 | 離線 dd5 校準診斷（L10 延伸到 dd5） | P3-C22、P7-C13（部分）；P3-C23 不可用 Kupiec | 只對已採用的 dd5 模型做，不對候選做。輸出：calibration-in-the-large、log score（clip [0.005, 0.995]）、4 個固定 bin（p < 0.10、0.10–0.15、0.15–0.25、≥ 0.25）的可靠度表（每格列數、事件數、段數）、Murphy 分解（expanding 基準的 resolution 接近 0、不是剛好 0）。註明 bin 邊界是在已知今天 p=11.9%、基準 16.6% 之後才定的。只寫進試驗登記的結果欄，不上頁面，不作為採用、否決或調參依據。 | 是（「不作決策用」與 bin 邊界） | 低 | P1 |
| M-06 | G07 組合方法事前寫死 | P2-C15（已核實）、P2-C16 | 寫在 G07 延後條目下：日後有第 3 個 flag 通過時，唯一的組合方法是「已收縮各成分機率的等權算術平均」，成分不適用時回到基準率；不用 likelihood ratio 乘積或 BMA；改用 log-odds 須減 (K−1)·logit p_base。組合方法不和新旗標在同一名額裡一起換。 | 是 | 低 | P2 |
| M-07 | 證據等級更正（forecast.md §3、§2.1） | P1-C01、C04、C05、C08、C16、C17 | BTZ → academic_is（季度最強）；技術均線列改 tchi +0.26%／+0.48% 並加「2009 年後持續落後」、Huang −1.78%；波動與方向列改「理論＋academic_is（S&P 100，全樣本）」，並寫 Chronopoulos 的數值不可換算、C&D 用 GARCH 非 VIX；Citi 降為 anecdotal、刪掉 2008 錯誤訊號；§8 [81] 補 BTZ 連結與 DOI；GWZ 表名寫 IA.6 Panel A。只寫驗證者讀到的數字。 | 否 | 低 | P2 |

### 5.2 下一輪試驗名額候選

只開 1 個名額，給 dd5。理由：P(up) 的 G08 MDE 是 0.011，這輪查到的月頻 OOS 證據（P1-C04、C05、C16）全部偏負，P2-C18 也找不到能讓 P(up) 可靠地低於 55% 的條件，把名額花在 P(up) 的期望價值接近 0。dd5 已有 skill，波動聚集的 OOS 證據強（P2-C02），機制直接對應首達事件（P3-C01）。

這個候選不算重開已否決項目：VRP 是在上漲標籤上否決的，M0 也早就提過已實現波動可以當代理（forecast.md:273）。但它和 VRP 共用 Σr² 這一項，屬於同族；而且 P3 與本次協調者都看過 trailing RV 對基準率的 dd5 BSS（P3 自算 0.052，CI 跨零）。這個數字的資料、日期、實作與評分方式都和試驗登記裡 incumbent 的結果不同，兩者不能直接比較，也不能拿來排名。所以門檻政策性加嚴（見 codex-review.md R2-1），否決後同族不得在同一段歷史重測。

EWMA Gaussian 首達基準的處理採規則審查的選項 (a)：只當描述性比較，唯一的後果是頁面措辭，不占名額、不成為下一輪候選。理由見 §5.9。

下面是可以直接貼進 forecast.md 的草稿。日期欄寫 commit 當天；`<登記日>` 由執行者填入。

---

```markdown
## 事前登記（第二輪，<登記日>）

這一節在任何第二輪回測之前寫下，commit 時間即為證明。以下都是規則，不是建議。結果出來後不得改門檻；要改只能另開新條目並註明原因。本節與第一輪事前登記衝突時，以本節為準；未提到的規則沿用第一輪（含增補一）。

### 外部接觸（非試驗）

下列結果在本節登記之前已被看過。它們不是試驗，但會影響候選的選擇，所以記在這裡，並適用下方 R2-1 的加嚴門檻。

| 日期 | 看過的目標 | 期間 | 看過什麼 | 來源 |
| --- | --- | --- | --- | --- |
| 2026-10-27 | dd5（相對 expanding 基準率的 BSS） | 1992-01-02..2025-11-10 | 6 個波動基準：raw VIX（連續監測兩種 drift、每日收盤）、以過往 variance ratio 校正的 VIX、trailing 21 日 RV、EWMA λ=0.94。P3 自算的點估計：校正 VIX 0.064、trailing RV 0.052、EWMA 0.056（CI 皆跨零），raw VIX 每日收盤 −0.010、連續監測為負。數字無法核實（試算包不可取得）。研究 LLM 與本專案協調者都看過。 | `docs/research-2026-10-27/` 的 P3 結果檔 |
| 2026-10-27 | 21 日漲跌與 dd5，條件為「策略師發出看多／看空呼叫」 | 2018-01..2026-10 | 99 筆便利樣本呼叫，進場 = 發布後第一個交易日收盤，dd5 = 進場後 21 日內任一收盤 ≤ 進場收盤 × 0.95。看空後 dd5 發生率 9/43 = 20.9%（同期基準 18.1%）；看空 21 日命中 27.9%（基準 32.8%）。 | `docs/research-2026-10-27/` 的 call scoring 腳本與輸出 |

沒有可用的保留期：P3 看到 2025-11-10，之後只有約 11 個不重疊列。

### 規則

| 編號 | 規則 |
| --- | --- |
| R2-0 名額上限 | 第一輪的「最多 2 個新 flag」屬於第一輪。第二輪最多 1 個新 flag，目標只限 dd5。任何 P(up) 新條件都要另開一輪，並先寫出預期效果大於 MDE 0.011 的理由。 |
| R2-1 波動族 | 「波動族」指任何以已實現或隱含波動定義的 dd5 條件，包括 trailing RV、EWMA、校正 VIX、raw VIX 的任何變換。波動族候選的 L08 採用門檻為 p ≤ 0.025（R2-3）。若本輪波動族候選被否決，下一輪不得再登記任何波動族 dd5 條件。 |
| R2-2 永久排除 | 「策略師或銀行的看空／看多呼叫」及其任何衍生（含 B&B、FMS 訊號）永久不得登記為候選條件。 |
| R2-3 L08 增補二 | dd5 名額的虛無分佈：把 1990-01-02 起每日觀測的 dd5 標籤以區塊置換，區塊長 = 21 × b 個交易日，b 由該組種子在 {6,…,12} 均勻抽出；regime 與 knownOn 不動。虛無組數 N = 199，第 j 組種子 20261026+j。每組以 label = dd5 跑參考模型與候選模型，計算相位平均配對 BSS。p = (1 + #{虛無值 ≥ 觀測值}) / 200。一般候選需 p ≤ 0.045；波動族候選需 p ≤ 0.025（觀測值嚴格大於第 5 大的虛無值）。指令：`scripts/backtest.ts --offline --as-of <登記日> --target dd5 --variant <ref>,<cand> --null`。 |
| R2-4 dd5 主報 | 今後 dd5 的採用與否決一律用相位平均（L02）。`drawdownScored` 的 live gate 維持 offset 0，兩者並列時標明。G09 列不改。 |
| R2-5 dd5 cell 閘門 | dd5 標「已計分」須同時滿足：(a) G09 全域條件；(b) 今天所選 cell 在 offset 0 walk-forward 的列數 ≥ 30；(c) 該 cell 相鄰列的最長連續區間 ≥ 8；(d) 該 cell 的 dd5 bssLow > 0（G08 stationary bootstrap，每次重抽只用該 cell 的列；空重抽依增補一）；(e) 該 cell 內 dd5=1 的列分群（距上一個事件列 ≥ 21 個交易日算新的一群），群數 ≥ 8。不通過時 p 照常顯示，標「未通過驗證」。數字 30、8 比照 G03／G04，不是推導。本規則在計算任何 per-cell dd5 bssLow 之前生效。 |
| R2-6 dd5 上線後紀錄 | L09 的第三種分數補 dd5：從第一筆有 `detail.drawdown.p` 的紀錄起，網格規則同 `liveTrackOf`（每 21 個交易日一列，當天沒有紀錄就略過）；標籤 = 紀錄日之後 21 個交易日內任一收盤 ≤ 0.95 × 紀錄當時的 `close`，第 21 個交易日收盤後才計；計算 Brier、相對 `detail.drawdown.base` 的 BSS、獨立月份數 n；n < `LIVE_MIN_N` 時顯示「樣本太少」。上線後紀錄只顯示，不作退場依據；獨立列數 ≥ 300 時另行登記退場檢定（300 是事前承諾，不是推導）。 |
| R2-7 dd5 校準診斷 | 只對已採用的 dd5 模型做：calibration-in-the-large、log score（clip [0.005, 0.995]）、4 個 bin（p < 0.10、0.10–0.15、0.15–0.25、≥ 0.25）的可靠度表（列數、事件數、段數）、Murphy 分解。bin 邊界是在已知 as-of 2026-10-23 的 p=11.9%、基準 16.6% 之後定的。結果只寫進試驗登記，不上頁面，不作為採用、否決或調參依據。 |
| R2-8 EWMA 比較基準（非試驗） | 在名額 A 的同一批日期上，計算零參數基準對參考模型的相位平均配對 Brier 差與區間。基準：σ_t 為日報酬的 EWMA，λ = 0.94 固定，用 1990-01-02 以前的資料初始化；零 log drift，21 日內 σ 固定；p_t = P(min_{j=1..21} S_{t+j}/S_t ≤ 0.95) 用 BGK 修正的閉式解：b* = ln 0.95 − 0.5826·σ_d，σ_d 為日波動，P = 2Φ(b*/(σ_d·√21))。唯一的後果：若基準對參考模型的配對 BSS 下界 > 0，頁面 dd5 說明加註「現有條件未勝過單純波動基準」。不改模型，不成為任何一輪的候選，不跑虛無。不另測校正 VIX、raw VIX、HAR 或 t 分配版本。 |

### 試驗名額

| 名額 | 定義 | 候選順序 | 採用與否決 |
| --- | --- | --- | --- |
| A：rvHigh 取代 dd5 模型的 `vixStress`（波動族） | RV_t = Σ_{k=0..20}(ln(S_{t−k}/S_{t−k−1}))²，S 為 M0 已補的 Cboe SPX 收盤（不用 Yahoo）。`rvHigh` = RV_t 高於「1990-01-02 起到 t（含）的 expanding 中位數」；累積 252 個 RV 值之前為 null。新增 `DD5_MODEL`，P(up) 的 `DEFAULT_MODEL` 不動。 | [[aboveSma200, rvHigh],[rvHigh],[aboveSma200]]，不跳過任何一側；G01 k=40、G04、M5 照舊 | 主要終點：dd5 的相位平均配對 BSS，參考模型 = 執行當下的 `DEFAULT_MODEL` 以 label = dd5 執行（記下其 version），配對規則同第一輪與增補一。採用：bootstrap 下界 > 0、R2-3 的 p ≤ 0.025、L03 不判為不確定，三者都成立。否決：任何一項未達成（含點估計 > 0 但下界 ≤ 0、統計量無法計算）。不計算、不報告 rvHigh 在 P(up) 上的任何結果。不論結果都記入試驗登記。 |

機制與事前驗屍（L13）：

| 名額 | 機制 | 最可能的失敗方式 |
| --- | --- | --- |
| A | 波動聚集：近期實現波動高時，未來 21 日觸及 −5% 的機率上升（Risk Everywhere 的 variance OOS；首達機率隨 σ 上升）。 | (i) 中位數切分約一半時間為 true，是 regime 切分不是壓力旗標（P2 自算的重疊率未核實，只能當估計）。(ii) 目前承載 skill 的「站上 200 日線、VIX<30」cell 會被切成兩半。(iii) 與已否決的 VRP 共用 Σr² 項，目標不同所以不算重開，但屬同族。(iv) P3 與本專案協調者都看過 trailing RV 的 dd5 探索結果，因此適用 p ≤ 0.025。(v) 最可能的結果：配對差點估計 > 0，但下界 ≤ 0，因為 SMA200 已吸收大部分波動資訊。依規則照樣否決，不得重跑。 |

退場規則：補完歷史後，該 basis 的相位平均 BSS bootstrap 上界 < 0 即撤下。上線後紀錄依 R2-6 只顯示。

執行順序：本節合併 → R2-5 cell 閘門與 R2-6 程式上線 → 名額 A 與 R2-8 同一次執行 → 結果寫回試驗登記。
```

---

### 5.3 dd5 與回撤目標

| ID | 做什麼 | 依據 | 規格 | 需事前登記 | 成本 | 優先序 |
| --- | --- | --- | --- | --- | --- | --- |
| D-01 | dd5 文案改成固定錨點 | P3-C24（已核實）、P3-C01 | 網頁：`pages/outlook.tsx:65` 改「21 個交易日內，曾收盤比今天低 5% 以上的機率」；`pages/index.tsx:94` 改「21 日內曾比今天低 5%」；`src/lib/communication.ts:65` 改「21 個交易日內，至少一天收盤比當天低 5% 以上」；`outlook.tsx:222` 副標補 dd5 定義。iOS：`MoreView.swift:374`、`OverviewView.swift:169/174`、`Models.swift:198`（註解）。API 欄位不變。 | 否 | 低（要跑 /verify，網頁 ego-browser、iOS `scripts/ios-walkthrough.sh`；更新功能地圖） | P0 |
| D-02 | dd5 上線後紀錄 | P3-C26（已核實） | 依 R2-6。`outlook.ts:44` 的查詢加 `json_extract(detail,'$.drawdown.p')` 與 `$.drawdown.base`；`communication.ts` 新增純函式 `liveTrackOfDd5(rows, points)`；舊紀錄沒有 drawdown 就跳過，不當成 0；在 `outlook.tsx:191-202` 的 panel 加一行，與 walk-forward 分開。iOS 若顯示，新欄位必須 optional。 | 是（R2-6 要在第一次顯示前合併） | 中 | P0 |
| D-03 | dd5 cell 閘門上線 | 完整性審查 | 依 R2-5，在 `drawdownScored` 加入 cell 檢查；`detail.drawdown` 加記 cell 閘門結果（G02 可記）。 | 是（R2-5） | 中 | P0 |
| D-04 | 反彈警語與兩種「95% 區間」分名 | P3-C25（未查，設計主張）、P3-C16 | dd5 數字下加一句：「碰到之後可能反彈，月底仍可能高於今天；這個數字不預測最低點，也不預測何時發生。」cell 比例區間（`outlook.tsx:32, 79, 82`；iOS `MoreView.swift:503/507/529`）改標「這類時期的歷史比例區間」；BSS 區間（`outlook.tsx:135, 178`；iOS `MoreView.swift:581`）改標「歷史平均預測力區間（不是今天這個數字的區間）」。live track 旁加「單一個月有沒有發生，不代表模型對或錯」。說明可收進 `<details>`。 | 否 | 低 | P1 |
| D-05 | 不開多目標 | P3-C15、G09 | 3%／21 日、10%／63 日只當 forecast.md 裡的無條件描述（P3-C14 的數字），不上頁面、不計分。 | 否 | 低 | 維持 |

### 5.4 勝過現金標籤（D2／M2）

| ID | 做什麼 | 依據 | 規格 | 需事前登記 | 成本 | 優先序 |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | 登記 M2 標籤定義，只顯示基準率 | P4-C01（部分）、C03（部分）、C04、C05（已核實） | label_tr(t) = 1 若 TR(t+21)/TR(t) > 1 + cash(t,21)；knownOn = t+21；history_start = 1990-01-02。現金門檻全程只用 DTB3，不和 French 拼接（拼接會在交界處換口徑；French 落後兩個月、每月重建全史）。換算：先轉 investment basis，y = 365·d/(360 − 91·d)，d 為 DTB3 小數；再用日曆日單利，cash(t,21) = y × D/365，D 為 t 到 t+21 之間的日曆日數。用 t 日已公布的 DTB3；缺值取 t 以前最近一筆，最多回溯 5 個交易日，否則該日 null。換算式在登記前最後確認一次，登記後不改。French RF 只做離線對帳。只顯示這個標籤下的基準率，不進 G03、不計分；D2 主標籤與 dd5 不變；升級成計分目標要另開名額。 | 是（任何回補或計算之前） | 低 | P2 |
| C-02 | 本機回補 `^SP500TR` 與 DTB3 | P4-C02（已核實） | 只在 C-01 合併之後做。用 period1／period2，不用 `range=max`；斷言 `meta.dataGranularity === "1d"`，並檢查相鄰日期間隔 ≤ 5 個日曆日（觸發條件已實測：range=max 降成 3mo）。存 `prices` 表 symbol `SPXTR`（source `yahoo-chart`）與 `DTB3`（source `fred`，存原始 discount rate）。寫入沿用 `jobBackfillIndexHistory` 的分段（每次 ≤ 2400 列）。`backtest.ts` 快取加 `SPXTR.json`、`DTB3.csv` 並記 sha256。交界處比照 `HISTORY_MIN_OVERLAP`，不一致就不往前接。 | 是（依 C-01） | 中 | P2 |
| C-03 | 每日更新 | data 規劃 | TR 先 curl 確認 spark 是否支援 `^SP500TR`，支援就併入 spark 批次，否則單檔 chart +1；DTB3 放 `daily-reference`，先 curl 確認 `fredgraph.csv?id=DTB3` 不轉址。每日約多 1–2 個子請求（`SUBREQUEST_BUDGET=1000`）。 | 是（依 C-01） | 中 | P2 |

### 5.5 資料源

| ID | 做什麼 | 依據 | 規格 | 需事前登記 | 成本 | 優先序 |
| --- | --- | --- | --- | --- | --- | --- |
| S-01 | point-in-time 註記 | P4-C07、P3-C18（已核實）；P4-C11（部分） | 在試驗登記「VIX ≥ 30」列、M0 列、D1 各加一行：1990-01-02..2003-09 的 VIX 是用新方法回算，walk-forward 在這段屬 pseudo-OOS；D1 不因此變更。Cboe、Yahoo、FRED 都是現行修訂版、沒有 vintage，只靠 `fetched_at` 追蹤。G13 的 HY OAS 改寫「FRED 上的起點會移動」，不寫政策日期。FactSet 週報本身是 PIT 快照。 | 否 | 低 | P1 |
| S-02 | FactSet 改存 D1 表、本機依索引回補（G10） | P4-C15（部分） | 新 migration `factset_insights`（`report_date`、`pdf_url` PK、`sha256`、`fetched_at`、目標價、漲幅、買持賣比例、forward P/E 與 5y／10y、`parse_ok`）。`jobFactset` 去掉 `.slice(0, 104)`。新增 `scripts/backfill-factset.ts`：翻 `/topic/earnings/page/1..84` 取實際 PDF 連結，兩個目錄與 A 後綴都收，不枚舉週五猜檔名；本機 `pdftotext` 後餵 `parseInsightText`；原檔存 `.backtest/factset/`。只顯示。forward P/E 歷史不得拿來當 G19 估值擇時候選。 | 否（日後要當 flag 須另占名額） | 中 | P2 |
| S-03 | 背景值授權盤點 | P4-C02（Yahoo，已核實）；P4-C21（Cboe、ICE 部分未讀） | 在 docs 列一張表：顯示值｜來源｜條款摘要｜是否改成只顯示衍生狀態或只給站長看。只盤點，不改架構。 | 否 | 低 | P2 |
| S-04 | 跨國 price-only pooling 列為長期研究 | P2-C11（方法先例，未覆核）、P2-C12、P4-C19（研究 LLM 自報） | 只能給 trend cell 的 dd5 收縮目標當跨國先驗；foreign prior 排除美國；bootstrap 各國同抽同一時間區塊；只用 local-currency price 指數（排除 ^GDAXI）；放 `scripts/` 離線。登記前不抓、不算。 | 是，且占名額 | 高 | P2 |
| S-05 | 同日 10 年期殖利率（^TNX）進日報 prompt | 完整性審查；P6-C16 | 本輪不做。前提是先 curl 確認 spark 第二批有空位、不增加子請求，並確認報價時點（Treasury 15:30 ET 與股市收盤不同步）。列入 §7 下一輪問題。即使日後加，也只當 observed 事實，永不進 forecast.ts。 | 否 | 低 | 延後 |

### 5.6 策略師表更新

`web/src/lib/strategists.ts` 目前 `STRATEGIST_TARGETS_CHECKED = "2026-10-25"`。中位數要在本機用改完的表重算，不沿用 P1 自算的 7975 → 8000。

**schema（ID ST-01，P0，低成本，不需事前登記）**：`StrategistTarget` 加三個選填欄位：`verified?: "primary" | "media"`、`horizonType?: "year_end" | "rolling_12m"`（預設 `year_end`）、`targetLow?` / `targetHigh?`。中位數只收 `horizonType === "year_end"`；同一家有兩個部門時一家一票，取哪個部門寫在註解。頁面在 `verified === "media"` 的列加「媒體轉述」（`outlook.tsx:332`）。若 `/api/v1` 回傳這張表，iOS 新欄位要 optional。

**逐列更新（ID ST-02，P0）**：

| 列 | 現值 | 改成 | asOf | verified | 依據 |
| --- | --- | --- | --- | --- | --- |
| Yardeni Research（:20） | 8400，note「今年第三次上調」 | 7900，note「2026-09-15 由 8,400 下調；8,400 移到 2027 年中」，sourceUrl 改 yardeniquicktakes 原文 | 2026-09-15 | primary | P1-C18 已核實 |
| Wells Fargo（:27） | 7950，2026-08 | 拆兩列：Wells Fargo Securities 7700；Wells Fargo Investment Institute 7900（targetLow 7800、targetHigh 8000，note「區間 7,800–8,000」） | WFS 2026-09-14；WFII 2026-06-15 | WFS media；WFII primary | P1-C19 |
| BofA（:31） | 7100，note「目前最保守」 | 7400，刪 note；另註「7,800 是 rolling 12 個月，不入中位數」 | 2026-09 | media | P1-C20 部分 |
| UBS GWM（:28） | 7900，2026-08 | 8100，sourceUrl 改官方 house view 頁 | 2026-09-16 | primary | P1-C21 |
| UBS Global Research（:30） | 7500 | 8100，note「部門未經原文確認；2026-08 Reuters factbox 仍列 7,500」 | 2026-07-21 | media | P1-C21 部分 |
| `REUTERS_POLL` | 2026-08、roic.ai 轉載 | 頁面明標「2026-08 調查」 | — | — | product 規劃 |
| `STRATEGIST_TARGETS_CHECKED` | 2026-10-25 | 實際核對日 | — | — | — |

**待人工核對原文後才改（ID ST-03，P1）**：P1-C22／C23 在本次未覆核，不照抄；但 P1 附了官方網址，不等於沒有原文。核對後再寫入：

| 列 | 待核對內容 |
| --- | --- |
| Goldman Sachs | asOf 改 2026-05-28（官方 7,600 → 8,000）；2026-09-23 的 8,700 是 12 個月目標，不入中位數 |
| Citi | asOf 改 2026-06-05 |
| JPMorgan | asOf 2026-08-10（Reuters），現有 sourceUrl 是 6 月的 CNBC |
| Deutsche Bank | asOf 2025-12-02（官方） |
| Evercore ISI | 7,750 是 base case，只有 2025-09 的報導 |
| Morgan Stanley Research（新增） | 8,000，官方 2026-05-15 |
| Morgan Stanley WM（新增或併入一家一票） | 年底 8,000、2027 年中 8,300（2026-10-14）；同時修正 forecast.md §2.1 把 8300 歸給 Wilson |
| HSBC Private Bank（新增或併入） | 8,100（2026-09-14） |
| RBC（新增，`rolling_12m`） | 8,150（2026-06-29，2026-09-10 重申），列出但不入中位數 |

**逾期提示與流程（ID ST-04，P1，低成本）**：依 L12 的精神，`STRATEGIST_TARGETS_CHECKED` 超過 45 天時頁面顯示「目標價表已逾期」。每月 checklist：先找官方原文，再用 Reuters factbox 交叉比對，部門分開列，期限型別標清楚。

**面板附註（ID ST-05，P2）**：`outlook.tsx:336` 加「策略師年底目標與實際報酬的相關約為 0；廣義專家預測的評分（CXO Guru Grades 及其重分析 Bailey 等 2017）顯示多數與隨機無異」。不寫 CXO 的 47%，因為它含去趨勢與文字判讀，不能和 64% 基準率並列。目標價隱含漲幅的 Delta 改中性色。

### 5.7 每日漲跌說明

| ID | 做什麼 | 依據 | 規格 | 需事前登記 | 成本 | 優先序 |
| --- | --- | --- | --- | --- | --- | --- |
| N-01 | `marketPrompt` 改資訊順序 | P6-C06（已核實） | `src/lib/news-ai.ts:167-183`：先列算術結構（點數、主要正負貢獻者、其他成分股＋近似誤差、等權減市值），再列新聞（每則附日期），最後才問原因。不要開頭就寫「收 X、跌 Y 點」接著問「為什麼這樣走」。 | 否 | 低 | P0 |
| N-02 | 明確允許「沒有可清楚辨識的單一催化因素」 | P6-C07（部分）、P6-C03（已核實） | 寫進 `marketPrompt` 與 `digestPrompt`：有當日新資訊且與結構相符時照寫；找不到時才用這句；漲跌幅大小不決定要不要找故事。 | 否 | 低 | P0 |
| N-03 | 改 `digestPrompt:139` 的前瞻引導 | 驗證者確認原文措辭 | 「以及可能怎麼影響股價」改為「這天實際發生了什麼、新聞裡有無具名人士對股價的說法」。 | 否 | 低 | P0 |
| N-04 | 策略師前瞻語與句型黑名單 | P7-C3（已核實）、G20；P6-C09（無法核實，屬編輯規則） | 先 grep 近期 `news_digests` 與 market 輸出，確實找到「把策略師看法寫成下月方向」或黑名單句型（獲利了結、資金由 A 流向 B、已反映、CTA 賣壓導致、殖利率上升壓低股市等）沒附出處的例子，才加規則。規則寫法是「沒有出處才改寫成具名引述或刪除」，不是禁用詞。不引用本次 call scoring 的數字當依據。 | 否 | 低 | P1（有觸發例子才做） |
| N-05 | `rest` 改名 | P6-C11、P6-C12 | `pages/index.tsx:157-159`、`pages/history.tsx:98` 的「其餘成分股」改為「其他成分股＋近似誤差」，並註明權重來自 SPY 持股（不是 SPX 指數權重，as-of 可能不同）。名單合計權重 `mag7Total.weightPct` 放進 prompt。價格口徑已正確（`yahoo.ts:25` 用不含股息的 close），在註解寫明，避免日後被「修正」。 | 否 | 低 | P1 |
| N-06 | 事件日曆補 CPI 與非農 | P6-C18（已核實） | `src/lib/calendar.ts` 的 `MACRO_EVENTS` 照 FOMC 模式補 BLS CPI 與 Employment Situation（08:30 ET）的靜態日期；empsit 頁 403，日期人工抄、逐筆核對。outlook 頁列出 asOf 後 21 個交易日內的事件，標「只列日期，不代表方向，不進機率」，不附歷史反應統計（G16 精簡版）。`MarketInput` 加 `macroToday: string[]`，由 `src/server/ai-batch.ts` 組好。 | 否 | 低–中 | P1 |
| N-07 | 新聞發布時間 | P6-C20（部分） | 先 curl 看 Nasdaq 實際回應的 `created` 有沒有時間。有：新增 `published_ts`（保留 `published_at`），`MarketInput.news` 改 `{title, ts}[]`，16:00 ET 以後另列「收盤後消息」。沒有：prompt 加一條，禁止「公布後立即…」這類要靠盤中資料才能核對的句子。 | 否 | 中 | P2 |
| N-08 | `cause_status` 欄位 | P6-C08（無法核實） | 等 N-02 上線後，「原因未明」實際出現夠頻繁再做。enum 三級 `observed`／`reported_interpretation`／`unclear`；`news` 為空時強制 `unclear`；`news_digests` 加 nullable 欄位；iOS optional。 | 否 | 中 | P2 |
| N-09 | 每月抽查 | 完整性審查 | 每月抽 10 篇 digest，看有沒有無出處的因果句、有沒有用盤後新聞解釋收盤；N-08 上線後追蹤三類比例（`unclear` 太高代表沒資訊，太低代表還在硬找故事）。 | 否 | 低 | P2 |

### 5.8 呈現與溝通

| ID | 做什麼 | 依據 | 規格 | 需事前登記 | 成本 | 優先序 |
| --- | --- | --- | --- | --- | --- | --- |
| U-01 | 首頁卡片 dd5 在前 | L04、G08（P(up) BSS 0.001） | `pages/index.tsx:86-99` 改成 dd5 在前，P(up) 那格加小字「接近平常」，與 outlook hero 一致。 | 否 | 低 | P1 |
| U-02 | dd5 主報數字改相位平均 | M-04 | 頁面主報 0.038 [0.014, 0.064]，offset 0 標「單一相位」。看起來 skill 變小了，照實寫。 | 是（依 M-04） | 低 | P1 |
| U-03 | 「拉回」定義區分 | P7-C18（部分） | 說明區加一句：「這裡的跌幅是從今天收盤起算、21 個交易日內任一收盤低 5% 以上；媒體常說的『每年約 3 次 5% 拉回』是從高點到低點的算法，兩者不能直接比。」不具名策略師。 | 否 | 低 | P2 |
| U-04 | /sources 頁資料性質註記 | P4-C07 | 1990–2003 的 VIX 是回算的；幣別與股息已由 L16 處理。 | 否 | 低 | P2 |
| U-05 | 前瞻式戰術呼叫紀錄 | P5-C10–C13（欄位設計）；§4 | 只往前記（從登記日起才收）。欄位：公開日與時間（盤前／盤後）、note 日期、new／reiteration／reversal／withdrawal、標的範圍（SPX／美股／全球／產業）、unconditional／conditional／path／range／observation、原述期限、評分期限、原稿存取狀態。計分規則在第一筆之前寫死：期限映射、條件式與路徑式怎麼二元化或排除、重申併入原呼叫、撤回提前結束、比較基準是同日 expanding 基準率。只顯示、不進模型（G20、R2-2）。 | 是（計分規則） | 中 | P2 |

### 5.9 流程

| ID | 做什麼 | 依據 | 規格 | 需事前登記 | 成本 | 優先序 |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | 研究帳本收進 repo | 完整性審查：`/tmp` 路徑會消失，`web/docs` 裡沒有任何 claim ID | 在 `web/docs/research-2026-10-27/` 存：七份結果檔、claim → 判定 → 驗證者讀到的來源對照表、`score-calls.mjs` 與其輸入和輸出、驗證者讀過的原文清單。原文 PDF 有授權疑慮的只存 URL 與 sha256。 | 否（但要在 P-02 之前） | 低 | P0 |
| P-02 | 外部接觸寫進試驗登記 | P3-C08（已核實）；§4 | 依 §5.2 草稿的「外部接觸」表，附方法摘要，不只給路徑。 | 是（本身就是登記） | 低 | P0 |
| P-03 | 排除清單 | P2 提案、stats 否決表 | forecast.md 新增「已研究、不占名額（2026-10-27）」，內容見 §6，每列附重開路徑。 | 否 | 低 | P1 |
| P-04 | §7 結案與 §8 修正 | 完整性審查 | 「沒有人回頭檢查戰術呼叫」改為「做過一次探索性描述（§4 限制），符合本題定義的獨立稽核仍沒找到；廣義評分有 CXO 與 Bailey（同一份資料）」。「今天的 regime 沒算」已由 G09 列回答。Fisher–Statman、Brown–Cliff、EBP、Cederburg、Advisor Perspectives 標「P1 自報讀過，本專案未覆核」，不標已查核。補 BTZ 連結。資料品質提醒 1–3 點在 ST-02 完成後標已處理。 | 否 | 低 | P1 |
| P-05 | 每日歸因與模型切開 | P6-C05（BBDS Table 6，未覆核）、P6-C15 | forecast.md 加一句：日報的任何內容（含原因分級、新聞清晰度）都不回饋到 P(up) 或 P(dd5)，不登記成候選；rates／USD／oil 共變 beta 若日後做，只當描述性診斷，永不進 forecast.ts。 | 否 | 低 | P2 |

**執行順序**：P-01 帳本 → P-02 外部接觸 → §5.2 第二輪事前登記（含 R2-3 L08 增補二與 199 次虛無、R2-5 cell 閘門、R2-6 上線後紀錄、R2-8 EWMA 基準）合併 → D-02、D-03 程式上線 → 名額 A 與 R2-8 同一次執行 → 結果寫回試驗登記。D-01、N-01～N-03、ST-01～ST-02 不依賴登記，可以平行做。C-01 登記之前不做任何 TR／DTB3 回補。

**仍有分歧、本文的判定**：

| 議題 | 各方主張 | 判定與理由 |
| --- | --- | --- |
| EWMA 基準的後果 | stats：勝過 incumbent 就成為下一輪唯一 dd5 候選；P3：要計入搜尋次數；規則審查：二選一，(a) 刪掉決策後果，(b) 明寫占名額、k=2 | 採 (a)。沒有保留期，「下一輪在同一份資料再測」沒有意義；占名額會讓本輪搜尋次數變 2、檢定力更低。代價是 P3「計入搜尋次數」的要求沒有照做：因為 R2-8 沒有任何模型決策，不需要搜尋折扣，但它的結果會影響頁面措辭，這點明寫在 R2-8。 |
| 拒絕校正 VIX 的理由 | stats 寫「P3 偷看後的選項」 | 偷看對 EWMA、trailing RV、校正 VIX 一樣適用，不能只拿來排除校正 VIX。唯一能區分的理由是「與已否決的 VRP 構造相近（implied 與 realized 的比例）」。 |
| 一般候選的 L08 門檻 | stats 說 p ≤ 0.05 是「加嚴」 | 0.05 其實略鬆於原規則的 1/21≈0.048；改為 p ≤ 0.045，文字寫「同一水準、解析度提高」。真正加嚴的只有波動族 0.025。 |
| M2 現金門檻 | stats：歷史用 French、近期用 DTB3；data：全程 DTB3 | 全程 DTB3（規則審查）。日數慣例統一用日曆日單利，登記前再確認一次。 |
| M2 優先序 | data：P0；stats：P2；product：不採用 | P2。只顯示、P(up) 本來沒有 skill、Yahoo 條款風險、每日多 1–2 個子請求。 |
| MS／GS／Citi 是否寫入 | product：照寫；data：等核對 | 等核對（P1-C22 未覆核），但附上 P1 給的官方網址。 |
| schema 拼法 | `year-end` vs `year_end` | `year_end`／`rolling_12m`，並納入 `targetLow`／`targetHigh`。 |
| dd5 上線後紀錄要不要登記 | data：不用；product：L09 補一句；stats：登記「不作退場依據」 | 合併：網格、標籤與「不作退場依據」都在第一次顯示前寫進 R2-6。上線後資料是唯一真正的樣本外資料。 |
| `rvHigh` 含不含當日 | P2：到 t−1；stats：含當日 | 含當日，與名額 1 VRP（forecast.md:93）一致；登記時凍結。 |
| cause_status | product：P1 | 降為 P2，先看 N-02 上線後的實際輸出。 |

## 6. 刻意不做的事與理由

| 項目 | 理由（claim／驗證） | 重開路徑（日後有人想重提會從哪裡來） |
| --- | --- | --- |
| 因 Byun 2018 重測 VRP | 名額 1 已否決（配對 BSS −0.001）；GWZ 的 vrp unrestricted OOS R² −8.61%（P1-C04 已核實）；Byun 的正數只來自作者稿（P1-C03，未覆核） | 重開已否決項目＝分岔路徑 |
| 校正 VIX（σ = c·VIX）當 dd5 flag | 與已否決的 VRP 構造相近；P3 偷看過（P3-C08） | 只能經 R2-8 的固定基準間接比較 |
| 下一輪 P(up) 名額 | MDE 0.011；P1-C04、C05、C16 全部偏負；P2-C18 找不到合格條件 | R2-0：要先寫出預期效果大於 MDE 的理由 |
| 低 SKEW | 低 SKEW 較危險、只在 10% 顯著、加控制後 null、序列是重建的（P2-C06 已核實）；forecast.md:287 已略過 | 當成「新的尾部指標」重提 |
| EC 旗標（Guo 2025 的日頻構造） | F_EC 是研究 LLM 自創，論文裡沒有（P2-C05 已核實）；緊接在季節性否決之後 | 季節性換一種月份切法 |
| 52 週高點回撤、12 個月動能 | 與 trend 重疊（重疊率是 P2 自算估計）；Huang OOS −1.78%（已核實）；G12 已否決 | 事後重搜趨勢定義 |
| VIX 期限結構、VIX3M、VVIX、COR3M | G14 已否決；COR3M 2021-07 前是回算（P4-C09 未覆核）；VVIX 控制 ΔVIX 後 null（P3-C09，效果量未核實） | 「壓力 flag 換個成分」 |
| 信用利差、EBP、Fed 週期、美元、油價、insider、IPO、margin debt、implied correlation、short interest | G13 已否決；EBP 沒有月度股市 OOS（P1-C15，未覆核）；其餘沒有合格 OOS 或資料頻率不符（P2-C08～C10，未覆核） | 依敘事追加指標（§6） |
| 策略師或銀行的戰術呼叫、B&B、FMS、Citi Panic/Euphoria 當 flag | G20、§6；R2-2 永久排除；B&B 改版並重畫歷史（P5-C06 已核實）；訊號起點不一致（P5-C08 部分） | 永久污染 |
| 3%／21 日、10%／63 日當計分目標或頁面數字 | G09 只限 21 日；多重檢定（P3-C15） | 看完結果才換題 |
| raw-VIX-GBM 的 dd5「市場隱含」數字 | 風險中性加連續監測，雙重高估（P3-C03 已核實、P3-C04 部分）；terminal density 推不出 path 事件（P2-C14） | 若做 G18，只畫 VIX ±1σ 帶並標風險中性 |
| N(d2) 或 Bliss–Panigirtzoglou 轉 P(up) | 沒有證據顯示勝過基準率；Shackleton–Taylor–Yu 是 density 對 ARCH 的 log-likelihood 比較，不是對基準率的 Brier（P2-C13 部分） | 有對基準率的二元 Brier OOS 證據才重提 |
| HLZ t>3 機械套用 | cross-section 情境（P1-C12） | 不需要 |
| 把歷史上約 20 個否決項併入置換虛無 | 不同資料、不同程序，做不到（P7-C12） | 不需要 |
| Kupiec 式例外檢定、頁面可靠度圖 | 標籤重疊、p 隨時間變（P3-C23）；L10 只限內部 | 只做 R2-7 的離線診斷 |
| BMA、likelihood ratio 乘積、在名額內順手換組合方法 | 只有 2 個 flag 且彼此相關；BMA Theil U 1.0009（P2-C15 已核實）；無法歸因（P2-C16） | 第 3 個 flag 通過後，用 M-06 事前固定的等權平均 |
| meta-labeling、依 P(dd5) 調整部位或扣款 | 抵觸 X03／L17（P7-C8 已核實） | 永久否決 |
| purge／embargo 改動 | forecast.ts:264 已只用已知標籤（P7-C5 已核實） | 不需要 |
| 預先計算配對差的 MDE 或檢定力 | 要看 dd5 結果才算得出，等於偷看 | 只能用合成資料模擬（§7 第 5 題） |
| 頁面顯示各投行命中率排行 | §4 是未登記的便利樣本、每家 n ≤ 12 | 只能經 U-05 的前瞻紀錄 |
| 用 Select Sector ETF × 權重推產業點數 | capped weights 會算錯（P6-C13 部分）；個股加總超出子請求預算 | 不需要 |
| 日報做 rates／USD／oil beta 瀑布圖 | 資料時點與收盤對不上（P6-C16、C17）；容易被讀成 G05 回鍋 | 只當 P-05 的描述性診斷 |
| 爬 Trading Economics／Investing.com consensus 算 surprise | 授權限制、Consensus 與 Forecast 混用（P6-C19 部分） | 只寫「某來源報導的預期」 |
| DGS1MO、French RF 當 live 現金門檻 | DGS1MO 2001-07-31 才開始；French 落後兩個月、每月重建（P4-C04、C05 已核實） | 不需要 |
| Shiller、CRSP、S&P DJI eps 檔、AAII、NAAIM、CFTC TFF 進模型、N-PORT 權重回補、Oxford-Man RV、GWZ 更新 CSV 當輸入 | 月頻或插值、付費、403／404、已否決（G17、G20、G15），或是 full-sample 非 vintage（P4-C06、C12～C14、C17、C20、P3-C19、P1-C06，多數未覆核） | 抓得到資料不等於新的 OOS 證據 |
| 以 TWD 計價或含股息標籤的機率 | 要新標籤與登記；股息每 21 日約 0.1%，對定投使用者價值低；L16 副標已足夠 | C-01 只顯示基準率 |

## 7. 下一輪研究問題

1. **1976–1989 年當 dd5 現行模型的保留期。** dd5 標籤與 `aboveSma200` 只需要 SPX，Cboe SPX 從 1975 起已補，1976–1989 從來沒有人對 dd5 看過，是目前唯一沒被偷看的樣本。只設計、不執行：只用 trend 條件的 dd5 模型、驗證規則（BSS 下界、虛無門檻、200 日線暖機怎麼扣）與失敗後果都事前登記；明寫這是驗證現行模型，不改 D1。要先回答：這段的事件數夠不夠檢定力？1987 年 10 月會主導結果，要怎麼事前處理單一極端事件？
2. **條件式、路徑式、區間式戰術呼叫的 proper scoring 設計。** 原述期限怎麼映射到固定評分期限、條件沒觸發時怎麼計分、重申與撤回怎麼處理，有沒有文獻（含對 CXO、Bailey 方法的批評）可以避免主觀判讀。目的是讓 U-05 的計分規則可以登記。
3. **G04（段數規則）與 G14（VIX 期限結構）的原文查核。** forecast.md §7 列為只靠名聲背書的文獻（SSRN、macrosynergy 回 403），找替代全文（作者頁、期刊版），比照 P1 的格式記錄 OOS 等級與原文數字。同時覆核 P1 自報讀過但本次沒覆核的 STW 1999、Hsu–Kuan 2005、Fisher–Statman、Brown–Cliff、Cederburg Table 5A；STW 與 Hsu–Kuan 若屬實，可以當 L08 加嚴的文獻依據。
4. **SPY／IVV 持股權重與官方 SPX 權重的落差。** as-of 落差、浮動調整、現金部位造成多大的每日點數誤差，有沒有公開資料可以量化；有的話，N-05 的「近似誤差」可以附上數量級。
5. **Gaussian／EWMA 首達基準在肥尾與 GARCH 下的偏誤。** 只用合成資料（t 分配、GARCH(1,1)、跳躍），研究 R2-8 這個基準的 Brier 偏誤方向與大小，確認它不會系統性地太容易或太難被打敗。不碰 SPX／VIX 歷史，不違反事前登記。也可以用合成資料估名額 A 在 p ≤ 0.025 下的檢定力，寫進事前驗屍。
6. **同日 10 年期殖利率能不能低成本進日報。** curl 確認 `^TNX` 能否併入 spark 第二批而不增加子請求、Yahoo 報價時點與 Treasury 15:30 ET 的關係；只當 observed 事實，不做 beta。

## 8. 來源

連結已去掉追蹤參數。只列驗證者讀到原文（已核實）或部分讀到（部分核實）的來源。

### 已核實

- Bollerslev, Tauchen & Zhou 2009, RFS 22(11) 4463–4492, DOI 10.1093/rfs/hhp008. https://public.econ.duke.edu/~get/wpapers/btz.pdf（P1-C01）
- Goyal, Welch & Zafirov 2024, RFS 37(11) 3490–3557, 主文與 Internet Appendix Table IA.6 Panel A. https://www.ivo-welch.org/research/journalcopy/goyal2024comprehensive.pdf（P1-C04、C05）
- Huang, Li, Wang & Zhou 2020, "Time series momentum: Is it there?", JFE 135. https://down.aefweb.net/WorkingPapers/w717.pdf（P1-C16、P2-C07）
- Christoffersen & Diebold, NBER w10009（2003）；Wharton WP 05-04. https://rodneywhitecenter.wharton.upenn.edu/wp-content/uploads/2014/04/0405.pdf（P1-C17、P2-C18）
- Chronopoulos, Papadimitriou & Vlastakis, "Information demand and stock return predictability", JIMF. https://ueaeprints.uea.ac.uk/id/eprint/87121/1/1_s2.0_S0261560617301912_main.pdf（P1-C17）
- Yardeni Research, "Proceed With Caution", 2026-09-15. https://www.yardeniquicktakes.com/proceed-with-caution/（P1-C18）
- Wells Fargo Investment Institute, Institute Alert, 2026-06-15. https://fa.wellsfargoadvisors.com/michele-kief/mediahandler/media/813828/institute_alert_061526.pdf（P1-C19）
- UBS GWM CIO daily, 2026-09-16. https://www.ubs.com/global/en/wealthmanagement/insights/chief-investment-office/house-view/daily/2026/latest-16092026.html（P1-C21）
- Bollerslev, Hood, Huss & Pedersen 2018, "Risk Everywhere", RFS 31(7) 2729–2773. https://pure.au.dk/ws/files/154593513/Bollerslev_2018_Risk_everywhere_VOR.pdf（P2-C02）
- Guo 2025, "Earnings Extrapolation and Predictable Stock Market Returns", RFS 38(6). https://academic.oup.com/rfs/article/38/6/1730/8101501（P2-C05）
- Bevilacqua & Tunaru, "The SKEW Index: Extracting What Has Been Left", preprint 2020. https://livrepository.liverpool.ac.uk/3179596/1/SKEW_Index_JFS_Final.pdf（P2-C06）
- Schrimpf, ZEW DP 08-048. https://ftp.zew.de/pub/zew-docs/dp/dp08048.pdf（P2-C15）
- Broadie, Glasserman & Kou 1997, Mathematical Finance 7(4). https://www.columbia.edu/~sk75/mfBGK.pdf（P3-C03）
- Phipson & Smyth 2010, "Permutation P-values Should Never Be Zero". https://gksmyth.github.io/pubs/PermPValuesPreprint.pdf（P3-C20）
- Yahoo Terms（2026-08-04 版）. https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html（P4-C02）
- Kenneth French, F-F Research Data Factors daily. https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/F-F_Research_Data_Factors_daily_CSV.zip（P4-C04）
- FRED DTB3、DGS1MO. https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTB3 、https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS1MO ；H.15 https://www.federalreserve.gov/releases/h15/（P4-C05）
- Cboe VIX_History.csv. https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv ；SEC Release 34-48807（SR-CBOE-2003-40）（P4-C07）
- CXO Advisory Guru Grades. https://www.cxoadvisory.com/gurus/ 、https://www.cxoadvisory.com/investing-expertise/guru-grades-project-milestones/（P5-C02）
- Bailey, Borwein, Salehipour & López de Prado 2017, "Evaluation and Ranking of Market Forecasters". https://www.davidhbailey.com/dhbpapers/forecaster.pdf（P5-C03）
- Heisenberg Report, 2025-12-12, B&B 2.0 改版報導. https://heisenbergreport.com/2025/12/12/famous-risk-indicator-picks-up-ai-bubble-after-revamp/（P5-C06）
- Morgan Stanley, Thoughts on the Market, 2025-04-14 逐字稿；Reuters via Investing.com, Goldman upgrades global equities, 2026-10-12. https://www.investing.com/news/stock-market-news/goldman-upgrades-global-equities-on-earnings-optimism-4944481（P5-C10）
- Cutler, Poterba & Summers 1988, NBER w2538. https://economics.mit.edu/sites/default/files/publications/w2538.pdf（P6-C03）
- Fischhoff 1975, "Hindsight ≠ Foresight", JEP:HPP 1(3). https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Behavioral_Decision_Theory/Fischhoff_1975_Hindsight_is_not_equal_to_foresight.pdf（P6-C06）
- BLS CPI release schedule. https://www.bls.gov/schedule/news_release/cpi.htm ；Fed FOMC calendars. https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm（P6-C18）
- Tetlock, Knowledge at Wharton 2015 與 AEI Lecture 2015（YouTube 逐字稿）. https://www.youtube.com/watch?v=-07DJ7xVBis 、https://www.youtube.com/watch?v=xBXDTQdmNyw（P7-C3）
- López de Prado, QuantCon 2018（YouTube 逐字稿）. https://www.youtube.com/watch?v=BRUlSm4gdQ4（P7-C5、C8）

### 部分核實

- Advisor Perspectives 2011, Citi Panic/Euphoria 檢驗（原文 403，只讀到搜尋摘要）. https://www.advisorperspectives.com/articles/2011/08/02/does-citigroup-s-panic-euphoria-model-work（P1-C08）
- Reuters 經 Kitco 轉載, Wells Fargo trims year-end target to 7,700, 2026-09-15（P1-C19 的 WFS 部分）
- TheStreet, BofA resets its S&P 500 price target（原文 403；Newsquawk 等二手一致）. https://www.thestreet.com/investing/stocks/bank-of-america-resets-its-sp-500-price-target-with-a-clause（P1-C20）
- InvestingLive, UBS lifts S&P 500 target to 8,100, 2026-07-21（部門未寫明）. https://investinglive.com/stock-market-update/ubs-lifts-s-p-500-target-to-8-100-sees-earnings-rally-underestimated/（P1-C21）
- Shackleton, Taylor & Yu 2010, JBF 34. https://eprints.lancs.ac.uk/id/eprint/45542/1/10.pdf（P2-C13）
- Minneapolis Fed, "Market-Based Probabilities: A Tool for Policymakers", 2015-01-07（P3-C04；P3 的 32.6% 對 16.8% 是 P3 自算）
- Yahoo chart `^SP500TR`（period1／period2）. https://query2.finance.yahoo.com/v8/finance/chart/%5ESP500TR（P4-C01）
- FactSet Earnings Insight 索引與舊檔. https://insight.factset.com/topic/earnings 、https://insight.factset.com/hubfs/Earnings%20Insight/EarningsInsight_120916.pdf（P4-C15）
- BofA, The Flow Show "Buy Signal", 2023-10-19 原稿副本；Newsquawk 2026-05-22；TheStreet Pro 2026-10-18（P5-C08）
- Morgan Stanley WM, Move Report 2020-09-25. https://www.morganstanley.com/campaigns/wealth-management/move-report/move-report2020sep25（P6-C07）
- S&P DJI Select Sector capping 說明（Indexology 原文 403，經搜尋摘要與 S&P 影響分析 PDF）（P6-C13）
- Trading Economics calendar 與 API pricing（P6-C19）
- Acosta 等, "Financial Market Effects of FOMC Communication", FRBSF WP 2025-30（日期 2026-08-27）. https://www.frbsf.org/wp-content/uploads/wp2025-30.pdf（P6-C20）
- Bloomberg TV, Wilson 2023-04-13（YouTube ZXg8PgBCzMU）；CNBC, Kolanovic 2023-10-05（YouTube K-v02Xfj_Ys）；AdvisorHub 2023-07-24 "We were wrong"（P7-C1）
- Fortune 2024-07-17 等關於 Rubner 日曆轉折日的報導（P7-C14 的內容部分；原引 YouTube 出處被推翻）
- Bloomberg TV, Subramanian 2026-09-17（YouTube GnI1JAllg48，逐字稿 429 未抓到）（P7-C18）
- P7 第二份報告 B 表的帶日期呼叫（抽查 4 列上傳日相符）（P7-C24、C25）

### 無法核實（不得當證據引用）

- P1 自報讀過、本次未覆核：Sullivan–Timmermann–White 1999、Hsu–Kuan 2005、Fisher–Statman 2000、Brown–Cliff 2004／2005、Gilchrist–Zakrajšek EBP、Cederburg 等 2020 Table 5A、Byun–Frijns–Roh 2018 的 OOS 數字、Bekaert–Hoerova 2014。
- P1-C22／C23 的目標價與 asOf（GS、JPM、Citi、Barclays、DB、HSBC、Evercore、MS Research、MS WM、RBC）：本次未覆核，P1 附有部分官方網址，待人工核對。
- P2 自算的 nEff、段數與重疊率；P2 引用但未覆核的效果量（Hjalmarsson IFDP 933、Pönkä 2016、RSZ 2010、Denk–Löffler 2024）。
- P3-C07 的 6 個基準 BSS（試算包在 chatgpt.com，不可取得）；P3 引用的 Corsi 2009、Louzis 2011、Hung–Liu–Yang 2022、Dutta–Das 2022 效果量；FRED HY OAS「2026-04 起滾動 3 年」的政策日期。
- P4 的 Cboe 個人非商用與 ICE internal use 條款（P4-C21）、COR3M 回算（P4-C09）、put/call 停更（P4-C10）、ALFRED（P4-C18）、N-PORT（P4-C20）。
- Avow.ai 對 Tom Lee 的評分（P5-C04）；FT 關於 Kolanovic 離職（P5-C15，付費牆）。
- P6 的原因四級分類與句型黑名單（P6-C08、C09，設計提案）、方法對照表綜述（P6-C02）、BBDS 的 17.42%／10.54% 與 Table 6（P6-C04、C05）。
- P7 第一份報告的 B 表（多數只有月份、影片不可用、出處為 Reddit 或聚合站）；Rubner "Cancels The Fall Correction"；Wilson "The issue is the timing of it."；koXUnYBBKCo 書摘頻道。
