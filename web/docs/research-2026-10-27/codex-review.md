**整體方向值得採納，但 §5.2 尚不能直接合併執行。** 最有價值的是釐清 dd5、補齊發布紀錄、修正資料與日報；`rvHigh` 可以保留為唯一的探索性挑戰者，但目前沒有證據支持它優於 incumbent，也不能靠把 p 門檻改成 0.025 就消除先前偷看的影響。

本次未修改、建立或 commit 任何 repo 檔案，未計算任何新候選條件的歷史表現。既有 `npm test` **203/203 通過**；指定的 call-scoring 腳本可重現看多 **18/27**、看空 **12/43**。

**整體判斷**

提案做對的部分：

- 維持 21 日／5% 目標、限制試驗預算、揭露外部探索結果、不把策略師敘事放進機率。
- 優先修 dd5 的固定起點定義，以及樣本內、walk-forward、發布後紀錄的區分。
- 用配對比較檢驗增額價值，沿用 G01、G04、L02、L03，方向正確。

主要過度推論：

- 報酬均值的 OOS \(R^2\)、二元方向的 BSS、波動預測力是不同問題。文獻足以支持「本輪不花名額在 P(up)」，不足以支持「改善 P(up) 的期望價值接近零」。GWZ 的研究目標是含息、扣現金的 equity premium，並非本站的價格指數方向。[原文](https://www.ivo-welch.org/research/journalcopy/goyal2024comprehensive.pdf)
- 提案第 222 行說 P3 的 RV BSS 0.052「可以直接」與 incumbent 0.049 比較，**應刪除**。資料、日期、實作與評分方式未完全一致；P3 自己也明確否認這種比較。
- 「永久排除整個波動族」是研究預算政策，不能當成統計結論；跨目標共用平方報酬，也不足以證明 `rvHigh` 等同已否決的 VRP。

**§5.2：第二輪事前登記需要修改的地方**

| 項目 | 判斷與修改 |
|---|---|
| **R2-0、名額 A：`rvHigh`** | **保留、補齊規格。** 21 個平方 log returns、含當日的 expanding median、252 筆暖機、固定候選順序都清楚，沒有明顯前視問題。保留 G01 k=40、G04、交集訓練、共同格線及完整失敗判定。另固定 reference 的 commit／設定、資料截止日與輸入雜湊，避免執行時 reference 漂移。 |
| **R2-1：污染懲罰** | **修改。** p≤0.025 可作事前承諾的較嚴門檻，應明稱「政策性加嚴」，不能宣稱已校正六個探索模型及未知搜尋歷程。歷史通過後仍應標示「經探索選出的回溯驗證」，等待凍結版本的前瞻紀錄。否決後禁止在同一段歷史換窗口重測，合理；永久禁止所有未來波動研究，過廣。 |
| **R2-2：策略師永久排除** | **修改理由。** 作為產品範圍與維護成本決定可以保留；這份便利樣本不能證明所有策略師訊號永遠無效。 |
| **R2-3：199 次虛無** | **保留、修正宣稱。** 公式 `(1+b)/200` 正確；p≤0.025 等於 `b≤4`，嚴格超過第五大的虛無值；一般門檻 p≤0.045 等於 `b≤8`。固定 N、種子、ties 用 `≥`，不得接近門檻就追加抽樣或換 seed。 |
| **L08 的統計意義** | **需明寫限制。** 199 次提高解析度，並未讓時間序列區塊置換自動成為「精確檢定」。它打亂所有標籤關係，連 incumbent 的既有訊號也消除，未必精確代表「候選沒有增額價值」的虛無假設。保留為已登記的搜尋閘門，先用合成資料檢查誤通過率；不能只引用加一公式就宣稱整個程序精確。[Phipson–Smyth](https://gksmyth.github.io/pubs/PermPValuesPreprint.pdf) |
| **L02、L03** | 草稿的主要終點與配對下界 MC 檢查**基本遵循規則**：各相位先算 BSS 再平均，共同格索引重抽；固定 seed 20261026，另報 seeds 1..5 下界的標準差。L03 衡量 bootstrap 下界的 MC 誤差，沒有涵蓋虛無 p 值本身的抽樣波動。 |
| **R2-4：主報與 live gate** | **保留區分。** L02 本來就規定主要結果用相位平均，修正報告不需要重新選門檻。保留 offset 0 live gate 可以，但必須明確標示。0.038 是已登記截止日的結果，不能寫死為未來頁面的常數。 |
| **R2-5：cell gate** | **修改後登記。** 目前 G09 與 `drawdownScored` 一致；新增 cell skill gate 是規則變更。bootstrap 應明定「先重抽完整 walk-forward 序列，再篩該 cell」，沿用有效重抽至少 1900 次。`runs` 應明寫為**連續區段的個數**，現行程式算的並非最長區段長度。 |
| **R2-5(e)：事件群 ≥8** | **刪除目前版本。** 在 offset 0 每隔至少 21 個交易日取列，按「距上一事件列 ≥21 日」分群，幾乎每個正例都自成一群；它實際上成了「正例列數 ≥8」，不能防止同一場危機主導。若真的需要危機群閘門，先另定每日事件群與歸屬方法，再登記。 |
| **R2-6：發布後紀錄** | **修改。** 固定格線、成熟日、使用存下的 `close`／`base` 都合理；但要先區分即時發布與延遲補記，見下方程式問題。300 列約需 25 年，沒有提供檢定力理由，不宜當成延後制定退場規則的唯一門檻。 |
| **R2-7：校準診斷** | **保留、補規格。** 固定日期／相位、bin 邊界歸屬、計分方式。分 bin 的 Murphy 分解不能直接冒稱精確分解原始連續機率 Brier；`clip` 後應稱 clipped log score。禁止用診斷結果重新挑門檻。 |
| **R2-8：EWMA 比較** | **延後。** λ 固定不等於沒有設計選擇；目前欠缺 variance 遞迴式、初始化日期／值、當日報酬納入時點。BGK 是離散監測近似。[原論文](https://www.columbia.edu/~sk75/mfBGK.pdf) 若保留，仍須完整登記；可以不占選模名額的前提，是永不據此挑下一個候選或改模型。 |

另外，R2-5 的「在任何 per-cell dd5 BSS 計算之前生效」已經無法成立：現行 `evaluateRows` 已計算 dd5 的 `byCell`，發布紀錄也會存 cell gate。應如實登記既有暴露，不能重新描述成完全未看過。

**§5 其餘項目逐 ID 判定**

| ID | 決定 | 具體建議 |
|---|---|---|
| M-01 | 保留 | dd5 的 L08 擴充須先合併；參考與候選使用同一置換。 |
| M-02 | 修改 | 採上述固定 199 次／計數門檻；保留舊輪 20 次的重現方式。 |
| M-03 | 修改 | 依上述 R2-5；刪掉目前事件群算法。 |
| M-04 | 修改 | 主報遵循既有 L02；不要改寫舊結果或混用相位。 |
| M-05 | 修改 | 依 R2-7，限定描述診斷。 |
| M-06 | 刪除目前承諾 | 第三個 flag 通過，不代表等權組合也通過；組合本身日後須獨立登記。扣除 baseline log-odds 也不能消除成分相關性。 |
| M-07 | 修改 | 更正證據等級；但刪掉「0.69 不符標準二元 Brier 尺度」：Brier 可以介於 0 與 1。該文數值與公式／表格的一致性仍待釐清，不能因此換算本站 BSS。[論文 Table 4](https://ueaeprints.uea.ac.uk/id/eprint/87121/1/1_s2.0_S0261560617301912_main.pdf) |
| D-01 | 保留 | 統一寫「以資料日收盤為起點，未來 21 個交易日內至少一天收盤低 5% 或以上」。歷史紀錄用「紀錄日」，避免「今天」漂移。 |
| D-02 | 修改 | 先登記即時／補記資格與固定格線；缺少舊 drawdown 資料應略過。 |
| D-03 | 修改 | 屬 G09 修訂；版本、啟用日、失敗原因須可追溯。 |
| D-04 | 保留 | 分清歷史比例區間、歷史 skill 區間；不要把歷史比例說成今日收縮機率的區間。 |
| D-05 | 保留 | 維持單一主要 dd5 目標。 |
| C-01 | 修改、低優先 | 公式對應固定 91 日貼現報價的收益率換算；它提供的是**現金報酬代理**，並非持有 21 個交易日的實現國庫券報酬。還要固定資料公布時點、對齊方式。 |
| C-02 | 修改 | 刪除「相鄰日期≤5個日曆日」硬判定；2001 年 9/11 停市就會誤擋。改按實際交易日對齊。[SEC 重開公告](https://www.sec.gov/investor/mktrecovery.shtml) |
| C-03 | 延後 | 待 C-01 與資料使用條件確定，再增加排程。 |
| S-01 | 保留 | 明確區分回算資料、現行修訂版與真正 PIT。 |
| S-02 | 修改、延後 | 索引頁數不可寫死 84；同 URL 的 PDF 改版也須留版本，不能只有最新 hash。先證明現有使用情境需要多年歷史。 |
| S-03 | 保留 | 先做來源／使用條件盤點；條款解讀與可行架構仍有未核實部分。 |
| S-04 | 本輪不做 | 跨國 prior 同時增加資料、相關性與模型複雜度，偏離目前最重要的缺口。 |
| S-05 | 保留延後 | 日報資料豐富度不是目前首要問題。 |
| ST-01 | 修改 | 加明確 `targetYear`／目標日期、機構與部門識別，以及程式可執行的中位數納入規則；不要只寫在註解。缺省 `horizonType` 與嚴格 `=== "year_end"` 篩選也要一致。 |
| ST-02 | 修改 | 見下方逐列判斷；不能整包照抄。 |
| ST-03 | 保留 | 原文核實後才更新；發布／重申日與首次調整日分開。 |
| ST-04 | 修改 | 顯示逐列資料日期與整表查核日期；每月查核可保留，45 天是維護政策。 |
| ST-05 | 修改 | 保留背景用途與中性色；未附樣本、期間與來源時，不新增「相關約零」的精確斷言。 |
| N-01 | 修改 | 可重排資訊，但效果未核實；重點應是證據、時間與出處，不能宣稱換順序就解決 hindsight。 |
| N-02 | 保留 | 找不到催化因素時允許明說，並描述可觀察的漲跌結構。 |
| N-03 | 保留 | 移除日報中的自行前瞻推演。 |
| N-04 | 保留條件式執行 | 先找實際輸出；按是否有出處處理，避免詞語黑名單。正式輸出本次未核實。 |
| N-05 | 修改 | 同步修正前 6 家與 remainder 的算術問題；網頁、iOS、prompt 都改用近似貢獻語意。 |
| N-06 | 修改 | 保留官方事件日期；事件發生本身不構成因果證據。新增 CPI／非農後，排程摘要也不能繼續把全部 `MACRO_EVENTS` 稱作 FOMC。 |
| N-07 | 提前 | 盤後新聞時間限制比資訊順序更重要；缺時間時限制因果措辭，不能推定盤前。 |
| N-08 | 暫不做 | 先驗證編輯流程是否需要分類；`news=[]` 也不妨礙描述算術事實。 |
| N-09 | 修改 | 抽查出處、時間與結論是否越界；不要把 `unclear` 比例調成某個「好看」水準。 |
| U-01 | 保留、調字 | dd5 在前合理；P(up) 改寫「尚未偵測到增額預測力」，避免「接近平常」被讀成已證明相等。 |
| U-02 | 修改 | 增加明確的 dd5 驗證區塊；目前頁面 BSS 實際顯示 P(up)，詳見下方。 |
| U-03 | 修改 | 保留兩種跌幅定義的區別；省略未充分核實的「每年三次」數字即可。 |
| U-04 | 保留 | 資料性質註記。 |
| U-05 | 延後、補規格 | 先固定來源全集、收集頻率與遺漏處理，避免再成便利樣本；撤回不應事後改寫原預測的主要評分期限。 |
| P-01 | 保留 | 保存 claim、查核、輸入雜湊與可重現方法；目前 repo 已有部分材料，先補缺口。 |
| P-02 | 保留 | 完整記錄探索暴露，承認不可逆。 |
| P-03 | 修改 | 區分已否決試驗、資料不足、產品排除；不要一律寫成永久無效。 |
| P-04 | 保留 | 用「本輪未找到」等可支持的措辭，更正錯誤歸屬。 |
| P-05 | 保留 | 日報與 forecast 計算管線保持分離。 |

ST-02 具體應這樣處理：

- **Yardeni 7,900**：本次核實官方原文，支持更新。[原文](https://www.yardeniquicktakes.com/proceed-with-caution/)
- **UBS GWM 8,100**：本次核實官方原文；9/16 是可證明的發布／重申日，不能因此認定為首次調整日。[原文](https://www.ubs.com/global/en/wealthmanagement/insights/chief-investment-office/house-view/daily/2026/latest-16092026.html)
- **WFII 7,800–8,000**：本次核實官方 PDF。若為相容舊 App 保留 `target: 7900`，必須明寫「區間中點」，不能呈現成銀行公布的點估計。[官方 PDF](https://fa.wellsfargoadvisors.com/michele-kief/mediahandler/media/813828/institute_alert_061526.pdf)
- **WFS 7,700、BofA 7,400**：本次未核實可支持更新的媒體全文；取得後標媒體轉述。
- **UBS Global Research 8,100**：暫緩。提案自身已指出部門未確認、較晚來源仍列 7,500，不能用註記替代解決矛盾。
- 一家一票須固定選擇政策；不能看各部門目標高低之後才挑代表。

**提案漏掉的程式問題**

1. **dd5 試驗會順便計算新候選的 P(up)。**  
   [backtest.ts:152](/Users/audichuang/Project/market-observatory/web/scripts/backtest.ts:152) 呼叫 `buildOutlook`；後者在 [forecast.ts:692](/Users/audichuang/Project/market-observatory/web/src/lib/forecast.ts:692) 與第 695 行計算 up 的 pick／evaluation。這會違反草稿「不計算 rvHigh 的 P(up)」。執行名額 A 前，須改成只評估指定 target 的路徑。

2. **日報的點數結構不完整。**  
   [ai-batch.ts:119](/Users/audichuang/Project/market-observatory/web/src/server/ai-batch.ts:119) 只傳前 6 家，但 `restPts` 使用扣除**全部追蹤公司**後的餘額；其定義見 [snapshot.ts:197](/Users/audichuang/Project/market-observatory/web/src/lib/snapshot.ts:197)。第七家有非零貢獻時，prompt 中的加總便不等於指數漲跌。應傳全部公司，或另列「未列出的追蹤公司」。此外 [news-ai.ts:172](/Users/audichuang/Project/market-observatory/web/src/lib/news-ai.ts:172) 把等權落後解讀為「多數股票較弱」，也超出了這個指標能證明的內容。

3. **「發布後實績」混入延遲重建。**  
   [jobs.ts:507](/Users/audichuang/Project/market-observatory/web/src/server/jobs.ts:507) 會補最近 5 個交易日；雖截斷價格到預測日，但可能使用後來才確定的程式版本與修訂資料。[outlook.ts:63](/Users/audichuang/Project/market-observatory/web/src/server/outlook.ts:63) 沒有讀取建立時間或 `recordedLagSessions`，全部交給 `liveTrackOf`。因此不能直接宣稱這些全是真正即時 OOS。正式 DB 有多少延遲列：**未核實**。應保留原始紀錄，另登記前瞻評分資格與固定格線。

4. **頁面目前沒有展示 dd5 的驗證數字。**  
   [outlook.tsx:55](/Users/audichuang/Project/market-observatory/web/pages/outlook.tsx:55) 的 `ev` 是上漲模型；iOS [MoreView.swift:458](/Users/audichuang/Project/market-observatory/ios/MarketObservatory/Views/MoreView.swift:458) 也只顯示 `o.evaluation`。U-02 需要新增清楚標示目標的區塊，不能把現有 P(up) 的 BSS 改成 dd5 數字。

5. **dd5 的 cell 診斷已經計算並留存。**  
   [forecast.ts:523](/Users/audichuang/Project/market-observatory/web/src/lib/forecast.ts:523) 一律呼叫 `cellEvaluations`；[jobs.ts:549](/Users/audichuang/Project/market-observatory/web/src/server/jobs.ts:549) 已存 dd5 cell gate。目前 [forecast.ts:611](/Users/audichuang/Project/market-observatory/web/src/lib/forecast.ts:611) 的 `drawdownScored` 則忠實實作 G09。**新增 gate 要登記，但不應把現況稱為實作錯誤。**

另有一個研究設計問題：§7 的 1976–1989 trend-only 模型無法直接驗證含 VIX 的現行模型；它也是 D1 範圍外的不同實驗。可以研究可移植性，但不宜稱為現行模型唯一「乾淨保留期」。

**iOS／API 相容性**

新增 optional metadata 通常可以相容；「同步更新最新版 Codable」並不能保護已安裝的舊版。

- [Models.swift:480](/Users/audichuang/Project/market-observatory/ios/MarketObservatory/Models.swift:480) 的 `aboveSma200`、`vixStress` 都是必填。**不得把頂層 `regime.vixStress` 換成 `rvHigh`**；dd5 的新 regime 應放在新增欄位。
- `Strategists.Target.target` 是必填 `Double`；不得換成區間字串或 null。新增 `targetLow`／`targetHigh`，保留數值與明確註記。
- 保留 `drawdown.pick`、`drawdown.scored`、首頁 drawdown 的 `p/base/scored`。新 phase summary／live track 應另加欄位，不改掉既有欄位用途。
- `DD5_MODEL` 若採用，須獨立記錄 dd5 的版本、regime、basis、history start；目前單一頂層 `modelVersion` 不夠追溯兩個模型。
- 現有 fixture 測試主要驗證「新 App 讀舊回應」；後續還要用舊版模型解碼新 payload。已發布 TestFlight 二進位的實際相容性：**未核實**。

**建議實作順序**

**(a) 現在可做，不必新增統計事前登記**

| 批次 | 具體檔案與變更 |
|---|---|
| 定義與呈現 | `web/pages/outlook.tsx`、`web/pages/index.tsx`、`web/src/lib/communication.ts`；iOS `MoreView.swift`、`OverviewView.swift`、`Models.swift`：統一 dd5 定義、區間名稱、分清兩個目標。 |
| 策略師資料 | `web/src/lib/strategists.ts`：先更新已核實列與 metadata；`web/src/server/outlook.ts`：固定中位數資格與去重；網頁、iOS 顯示範圍、來源與日期，保留舊 API 必填欄位。 |
| 日報修正 | `web/src/server/ai-batch.ts`、`web/src/lib/news-ai.ts`、相關 `web/scripts/ai-batch.ts` 型別：修正貢獻加總、傳遞來源／日期、允許原因不明、移除自行前瞻推演。N-07 的時間資料先查證再接入。 |
| 事件與來源 | `web/src/lib/calendar.ts`、`web/src/server/jobs.ts`：補經核實的官方日期與正確摘要；`web/pages/sources.tsx` 補資料性質註記。 |
| 計分基礎設施 | `forecast-eval.ts`、`backtest.ts`：隔離 target、支援明確 N／p 計數與輸入版本，保留第一輪重現方式；此階段只用合成資料測試。 |
| 文件與驗收規格 | `web/docs/forecast.md` 更正既有描述與證據；補研究帳本。同步更新 `.claude/skills/verify/features/` 的 `outlook.md`、`overview.md`、`news-calendar.md`、`history.md`、`sources-admin.md`。 |

**(b) 必須先在 `forecast.md` 登記並合併，才能計算／上線**

依序固定：外部暴露與資料快照 → dd5 L08／199 次與門檻 → 修正版 cell gate → 即時發布評分資格與格線 → `rvHigh` 完整試驗規格。之後才執行唯一名額 A，按原規則記錄採用或否決。

校準診斷、EWMA 歷史比較、TR／DTB3 新標籤、跨國 prior、戰術呼叫評分，各自先完成登記；不必綁成這一輪的大包。

**(c) 不做**

不以 P3 的未重現 BSS 排名；不把 0.025 包裝成消除污染；不採用目前事件群算法；不直接替換 UBS Research 數字；不承諾第三個 flag 通過就自動等權組合；不因診斷結果重開窗口或門檻；不依模型調整定投。

本次未逐一重新核實全部 63 項外部主張、P3 試算包、TR 資料管線或正式 D1／App 畫面。現行模型 BSS 引用試驗登記，未另行重跑。

Codex session ID: 01a17d4c-163e-7083-8e38-0807c66701b4
Resume in Codex: codex resume 01a17d4c-163e-7083-8e38-0807c66701b4
