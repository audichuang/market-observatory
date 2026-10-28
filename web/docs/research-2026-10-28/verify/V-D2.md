# V-D2：D2 個股訊號研究的獨立查核

查核日：2026-10-28。先讀 `prompts/D2.md`，再以 `results/D2-stock-signals.md`「給整合者的摘要」及 D2-11～D2-15 建議為入口，抽查最多 15 項關鍵主張；不是替十類訊號的全部引文背書。以下原報告行號皆指 `web/docs/research-2026-10-28/results/D2-stock-signals.md`。核對版本 SHA-256：`3f3dd915922412ae972c35045d29ff9fb59ac540aec1f9cba23b322211669871`。

論文 PDF 已實際下載並讀取本文／指定表格；瀏覽器實際開啟 Wiley、SSRN、SEC。SSRN 的網頁工具請求回 403，但 ego-browser 能讀到摘要並下載 Martineau 作者稿，故未把 403 當作無法查證的終點。PDF 頁碼以下一律從檔案第一頁算起，另外標期刊頁碼或表號。只對 Nasdaq 公開上游做一次唯讀 GET；沒有碰正式站管理端點、沒有對市場歷史資料做新回測或探索統計。程式驗證只輸入人造缺值／零值。GitHub API／`gh repo view` 使用 0 次，未使用 agent-reach。

**判定計數：已核實 13／部分 2／被推翻 0／無法核實 0。**「已核實」只表示表中限定的主張與一手來源相符，不表示今日仍有可投資淨收益。

## 1. 主張查核表

| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
| --- | --- | --- | --- | --- | --- |
| 1 | McLean–Pontiff 研究 97 個橫斷面變數；原樣本外報酬下降 26%，發表後下降 58% | 39、200；支撐所有建議的保守解讀 | 已核實 | Wiley 一手摘要列出 97、26%、58%，明指 cross-sectional stock returns。短引：「26% lower out-of-sample and 58% lower post-publication」。這是合併樣本的衰退，沒有逐一替 EPS／GP／動能估計固定折減。 | [JF 正式摘要，2015-10-13 首刊／2016 卷期](https://onlinelibrary.wiley.com/doi/abs/10.1111/jofi.12365)，Abstract |
| 2 | CZ 的 161 個原文明確顯著特徵，98% 重製 t > 1.96；列出的 EPS／動能／GP t 值正確 | 40、52、58～60；D2-11～13 | 已核實 | 2021-03 FEDS 稿摘要確有 161、98%；Appendix A／Table 2 的 `AnalystRevision` 為 1975–1980、t=5.12，`Mom12m` 為 1964–1989、t=4.58，`GP` 為 1963–2010、t=2.38；另核到 `ShortInterest` t=5.30、`BetaFP` t=0.08。這些是表列原始樣本重製，不能解讀為發表後成功率。 | [CZ 作者稿](https://www.federalreserve.gov/econres/feds/files/2021-037pap.pdf)，PDF 頁 2、58～61，Appendix A／Table 2 |
| 3 | HXZ 的 452 個異常在 NYSE breakpoints＋VW 下，65% 單項不顯著，多重檢驗失敗率 82% | 41；所有建議 | 已核實 | 正式 PDF 摘要直接列 452、65%、82%；單項門檻為絕對 t ≥ 1.96，多重檢驗門檻為 2.78。這不是 82% 的原論文都無法按原方法重現，也不是扣交易成本後的失敗率。 | [HXZ 2020 正式 PDF](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf)，PDF 頁 1，期刊頁 2019 |
| 4 | HXZ 的 EPS 修正 Re1／Re6 有 VW 支持，Re12 不顯著；不能把它等同 Nasdaq 四週修正計數 | 22、52、69～73、201；D2-11 | 已核實 | Table 3 第一組 NYSE-VW 欄：Re1 月報酬 0.75%、t=3.18；Re6 0.47%、t=2.24；Re12 0.24%、t=1.30。Appendix A.1.3 的訊號使用 EPS 預估變動、價格縮放及過去修正平均；不是 up／down 次數。Re6 僅通過單項門檻，未達上述 2.78。 | [HXZ](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf)，Table 3，PDF 頁 20／期刊頁 2038；Appendix A.1.3 |
| 5 | 12-1 動能有 NYSE-VW 重製支持，短期反轉未通過；較長持有版本較弱 | 28、58、125～129、201；D2-13／14 | 已核實 | 同表 `R11` 的 1／6／12 月持有版本 t 分別為 3.99／3.13／1.93；Appendix A.1.5 明定 t−12 至 t−2。§3.2.6 的 Srev 高減低月報酬為 −0.27%、t=−1.4，不能拿它當大型股反轉策略已成立。以上均為股票橫斷面投組，不是 SPX 擇時。 | [HXZ](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf)，Table 3，PDF 頁 20；§3.2.6，PDF 頁 50；Appendix A.1.5 |
| 6 | GP 有 VW 正結果，但改成 lagged-assets 分母後變弱 | 29、59、135、201；D2-12 | 已核實 | Table 3 的 Gpa：0.37%／月、t=2.63；Gla：0.17%、t=1.13。§3.2.4 不只說變弱，還指出 Gpa 混入 investment premium；其「獨立獲利能力溢酬」解讀受到限制。Gpa 本身也未達摘要的多重檢驗門檻 2.78。 | [HXZ](https://theinvestmentcapm.com/uploads/1/2/2/6/122679606/houxuezhang2020rfs.pdf)，Table 3，PDF 頁 30／期刊頁 2048；§3.2.4 |
| 7 | JKP 美國重製率 82.4%，mega／large 為 77.3%／79.8%；capped VW，排除 IBES | 42、203；D2-11～13 的大型股適用界線 | 已核實 | §III.A／Figure 4 的正面原研究分母為 119；Figure 5 確列 mega 77.3%、large 79.8%。§II.A 採 terciles、NYSE 市值第 80 百分位封頂；註 4 明寫「we exclude factors based on IBES data」。因此這組總體重製率不能替 EPS 修正背書，也不是各訊號的發表後淨效果。 | [JKP 2023 正式全文](https://onlinelibrary.wiley.com/doi/full/10.1111/jofi.13249)，§II.A、§III.A、Figure 4／5、註 4 |
| 8 | Martineau 找到非微型股自 2006 年傳統 PEAD 消失的證據 | 23、79、202；不優先做 PEAD 標籤 | 已核實 | 親讀 SSRN 2021-03-27 作者稿，不只搜尋摘要：本文與 Table 3 Panel B 說 2005 年後非微型股 surprise 對 BHAR[2,60] 不顯著；樣本到 2019 年。非微型股是 NYSE 市值第 20 百分位以上，不是 S&P 500 專屬樣本。作者官網另確認 2022 年刊於 CFR。可核實「該研究有消失證據」，不能延伸成 2020–2026 每種 PEAD 都已失效。 | [SSRN 作者頁與下載入口](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3111607)，作者稿 PDF 頁 3、15、Table 3 Panel B；[作者出版清單](https://www.charlesmartineau.com/) |
| 9 | 財報公告波動 Q／P 均值為 8.22%／7.42%；2011–2015 為 6.78%／7.35% | 89、204；不做財報期權價差交易 | 已核實 | Table 9 的 Q-vol mean、P-vol (CC) 四個數值逐格相符。Std 欄在子期仍低於 1，本文的標準化檢驗支持風險溢酬；不能因其中一段 P 均值較高就推翻整個量測方法，也不能把 pooled Q−P 差當每檔固定溢價。 | [Dubinsky 等 2019 正式 PDF](https://research.vu.nl/ws/files/108247883/Option_Pricing_of_Earnings_Announcement_Risks.pdf)，Table 9，PDF 頁 26／期刊頁 670，及相鄰本文 |
| 10 | Xing–Zhang–Zhao 摘要稱 smirk 最陡組每年風險調整後落後 10.9%，至少延續六個月 | 91，明稱「已核實一手摘要」；不優先做 smirk | 已核實 | Cambridge 一手摘要確有 10.9% 及至少六個月；短引：「underperform … by 10.9% per year」。這項判定只核實摘要中的原始樣本結論；大型股分組及扣成本效果仍未由該摘要建立，原報告對此有保留。 | [Cambridge 正式摘要，2010-03-31](https://www.cambridge.org/core/journals/journal-of-financial-and-quantitative-analysis/article/abs/what-does-the-individual-option-volatility-smirk-tell-us-about-future-equity-returns/ECFD16BA9ACBDC8D577D1BD866FBEA72)，Abstract |
| 11 | 現有 Nasdaq／consensus 資料可低成本支援帶年度、四週修正、涵蓋及來源更新日的背景值 | 14、73、167、213；D2-11 | 部分 | 行號及計數語意正確：`rows?.[0]`、`fiscalEnd`、up／down／estimates 均存在。唯讀 AAPL GET 回 HTTP 200、無轉址；yearly headers 明示 Last 4 Weeks，首列 fiscalEnd=`Sep 2026`、up=1、down=1、estimates=6，但來源 `asOf=null`。因此現況可顯示計數與擷取日，尚不能承諾「來源更新日」。反駁 bug：`revisions > 0` 已擋住兩側皆缺值或皆為零；人造輸入實跑兩者都回 `revisionBreadth:null`，不能指認目前把它們當「全部維持不變」的 bug。另只有 SPY 權重前 100 檔抓 EPS，不保證任意 30 檔名單都有資料；同日 upsert 也不保留每次版本。 | `web/src/lib/sources/nasdaq.ts:181`、`:203`、`:214`、`:228`；`web/src/lib/consensus.ts:62`、`:73`；`web/src/server/jobs.ts:605`、`:622`、`:642`、`:647`；`web/db/schema.ts:141`；[實測上游](https://api.nasdaq.com/api/analyst/AAPL/earnings-forecast) |
| 12 | Novy-Marx 的 GP/A 定義正確，原始研究確有最大、最流動股票的支持 | 135、169～171；D2-12 | 已核實 | 作者 2012-06 稿定義為 revenue 減 COGS 再除 assets，非 gross margin。§2／Table 4 確研究大型股；但最大組的原始報酬差 t=1.88，而論證也依賴因子調整後表現。另有最大 500 家非金融公司的策略分析。它支持限定的橫斷面研究結論，不支持每一大型公司 GP 都能預測上漲。 | [Novy-Marx 作者稿](https://mysimon.rochester.edu/novy-marx/research/OSoV.pdf)，PDF 頁 2、13～14、§3／Table 7 |
| 13 | 字典新聞研究涵蓋 1980–2004 的 S&P 500 個股，依賴及時全文，合理成本可消除簡單策略利潤 | 31、157、205；不優先做情緒交易儀表 | 已核實 | 2006-08 作者稿資料段明列 WSJ／DJNS、S&P 500、1980–2004；成本段與 Table VI 說 10 bp 往返成本下簡單策略不再有利潤。短引：「no longer profitable」。這不是所有新聞方法的普遍零效果，原文亦保留較精細規則的可能性。 | [Tetlock 等作者稿](https://www.columbia.edu/~pt2238/papers/TSM_More_Than_Words_08_06.pdf)，PDF 頁 2～3、24、Table VI |
| 14 | 2026-10-12 的 The Buffett Effect 確實存在，使用 2000–2025 資料，摘要宣稱跟單有持續 alpha | 111、222；不優先做 Berkshire 跟單 | 已核實 | arXiv 的日期、Smolinski／Saridevi、樣本期間及摘要相符。全文 §VI.D 更直說 headline alpha 不太可能構成可執行交易規則，且未扣成本；進場時點可高估跟單可得收益。短引：「gross of transaction costs」。因此保留 `academic_is`，不能升為獨立 OOS 或可複製淨 alpha。 | [arXiv 原始紀錄](https://arxiv.org/abs/2610.17231)；[v1 全文 §VI.D、IA.7](https://arxiv.org/html/2610.17231v1) |
| 15 | Form 13F 必須「季底後最遲 45 天」提交 | 109；D2-15 與不跟單的時間限制 | 部分 | SEC FAQ 25 確定標準為季底後 45 天，但同段明定週末／假日順延至下一營業日，且表列 2026 Q3 截止日為 2026-11-16。因此「最遲 45 天」太絕對；應寫「通常 45 天，遇非營業日順延」。這不改變必須用實際公開時點、不能用季底當可交易時點的結論。 | [SEC Form 13F FAQ，2026-03-06 更新](https://www.sec.gov/rules-regulations/staff-guidance/frequently-asked-questions-about-form-13f)，Question 25、期限表與 Rule 0-3(a) 說明 |

## 2. 與事前登記或排除清單的衝突表

逐一核對建議表五項。這些規則主要管 SPX 機率模型與定投指令；不能只因都叫「動能」，就把個股過去表現的純顯示誤判為已否決的指數預測試驗。反過來，改稱背景也不授權把值放入模型或輸出買賣判斷。

| 建議 ID | 衝突的規則 | 說明 |
| --- | --- | --- |
| D2-11 | `forecast.md:11`、`:114`（背景不進機率、L17／X03）；第二輪 `:142`、`:159`（R2-0、只限 dd5 名額 A）；`proposal.md:425`（部位／扣款永久否決） | **依原建議文字無直接衝突。** 顯示個股 EPS 計數仍是背景。若用它產生 SPX P(up)、替 P(dd5) 加條件，或映射加碼金額，即超出已登記範圍；原文已禁止。現有資料欠來源更新時間屬可行性問題，非事前登記違規。 |
| D2-12 | `forecast.md:15`、`:43`（新條件先登記，規則優先）；`:114`（不改扣款）；第二輪 `:152`（組合方法亦須獨立登記）；`proposal.md:425` | **純財報比率無直接衝突。** 不可因文獻有 GP 正結果就把任意「品質」總分納入 SPX 模型或用來調部位。報告說排名／計分須另登記，這是給新個股研究加的限制，不代表現有 SPX 登記已批准該研究。 |
| D2-13 | `proposal.md:414`（52 週高點／12 個月動能已排除）；`forecast.md:142`（R2-0）；`:113`（SPX 的 USD、不含息標籤） | **名稱重疊，未構成重開。** 原建議限個股含息過去表現及基準差；沒有測 SPX 方向，也沒有改既有 SPX 價格指數標籤。若把個股橫斷面文獻當作重新測指數動能的理由，就重開已否決項目。含息個股畫面須與現有不含息 SPX 機率清楚分開。 |
| D2-14 | `forecast.md:43`、`:118`（事前規格先合併）；第二輪 `:142`、`:145`、`:159`（R2-0、R2-3、名額 A）；`proposal.md:414`、`:425` | **是尚未獲准的新研究範圍，不是現有名額。** 本文的 S&P 500 個股五分位多空、次月含息淨報酬終點，不等同已否決的 SPX 擇時，故不能直接判為重開；但也不能用「不占 dd5 名額」推定已獲准執行。資料源、切分、解封日等尚未定，原文亦承認不可執行。若日後變成 SPX 候選，不能拿其 95% 區間取代已登記的 BSS／搜尋閘門。 |
| D2-15 | `forecast.md:111`、`:112`（L09 分開樣本內／walk-forward／即時紀錄，G02 不可改寫）；第二輪 `:149`（R2-6 即時與補記分開）；`proposal.md:433`（full-sample 非 vintage 資料不能當新 OOS） | **方向一致，無直接衝突。** 應區分資料期、來源發布時間、首次觀測時間及擷取時間；目前 `analyst_views` 的日內覆寫不能直接充當完整 PIT 修訂紀錄。新資料紀錄不會自動成為 R2-6 合格的 SPX 前瞻預測列，也不能重寫既有預測紀錄。 |

另查 `proposal.md:416` 的 insider／short interest 排除及 `:425` 的永久否決：D2 的摘要只建議不優先實作相關交易訊號，並明文禁止調整扣款／部位（原報告 222～224），沒有在五項建議中把它們重新加回 SPX。第二輪較新規則優先：`forecast.md:152` 已要求組合方法本身獨立登記，不能沿用 proposal `:424`「第 3 個 flag 通過後等權平均」的舊說法；D2 目前沒有提出合成模型。

## 3. 證據等級高估清單

本次 15 項抽查沒有證據顯示原報告把 `bank_claim` 改標成 `independently_tested`，或把十類個股訊號直接當作指數擇時證據。五項產品建議均標 `none` 是適當的；不應因文獻數字通過查核就上調。需要收窄的地方如下，主要是摘要可能放大正結果，而非來源不存在：

- **「GP 有 VW 支持」須保留口徑與檢驗門檻。** 原報告 135 行有提分母改變後變弱，但摘要 201 行省略 HXZ 對 investment premium 混淆的較強批評。Gpa 的 t=2.63 低於 HXZ 多重檢驗門檻，原始最大市值組未調整報酬差 t=1.88。不能整合成「純 GP 在大型股已穩健、獨立且扣成本有效」；來源見查核 #6、#12。
- **「EPS 修正有 VW 支持」不涵蓋來源四週次數。** Re6 只過單項門檻；CZ `AnalystRevision` 又是不同原文與公式。將文獻等級套到 D2-11 的 Nasdaq up／down 值，會把描述性資料升成已驗證訊號。原報告已區分，整合時必須保留；見 #2、#4、#11。
- **PEAD 的「現代大型股零結果」有資料截止與母體限制。** Martineau 作者稿可核到的是 2019 年以前、非微型股、特定 surprise 與持有窗；不能寫成目前任何 S&P 500 PEAD 都沒有預測力。`independently_tested` 可保留給該項歷史再檢驗，不能表示 2026 年或所有構造均被檢驗；見 #8。D2 自己另列不同構造與未讀表格的限制，不能在摘要合併時刪掉。
- **JKP 的大型股百分比是整體重製證據，非前三項個別淨效果。** 其全樣本 CAPM-alpha 重製率與 post-publication 檢驗是不同分析，且排除 IBES；不能把 77.3%／79.8% 轉成 EPS、動能或 GP 在今日大型股的成功機率。原報告有正確警語，應原樣保留；見 #7。
- **The Buffett Effect 應把可交易時點與未扣成本寫進證據限制。** 原報告只讀摘要，已保留 `academic_is` 並拒絕淨 alpha 推論；本次全文查到作者自己明說 headline 不太可能是可執行交易規則。不能因研究很新就提高等級或優先序；見 #14。

上述限制不等於訊號效果為零，也不要求將所有歷史學術重製降成 `none`；應精確限制每個等級所指的母體、公式、期間、統計終點與成本處理。

## 4. 最重要的遺漏

原題要求逐一回答十類訊號的後續重製、發表後衰退、大型股／VW 與扣成本結果，但 D2 的主要缺口仍是**逐訊號、同公式的發表後證據對照**：目前用 McLean–Pontiff 的 pooled 衰退、CZ 的舊樣本重製、HXZ 的全期 VW 及 JKP 的總體大型股重製率，無法判定前三項候選各自在發表後的大型股淨效果；原報告 63、228～230 行誠實承認未完成，仍未滿足這部分研究題。最有價值的補查是從現成論文及附錄填明每個對應公式的 post-publication 期間、毛／淨報酬、交易時點與大型股限制，沒有對應就留缺口，不能另跑歷史探索，也不能把總體成功率當個別證據。這個缺口不妨礙把值當有標註的歷史背景，卻足以阻止它們升成預測分數或啟動 D2-14。

## 5. 結論：哪些建議應降級、刪除或保留

- **D2-11 有條件保留並降級可行性承諾**：先顯示可核對的年度、計數與擷取日；來源更新日目前缺失，不能冒稱已有，也不保證涵蓋任意 30 檔名單。
- **D2-12、D2-13 保留為背景值候選，證據等級維持 `none`**：不因 VW 重製而升成預測力、排名或買賣訊號；GP 的口徑限制及動能的過去表現標示必須保留。
- **D2-14 降為待補齊、待另行決定的研究備案**：現有登記未授權執行；不得開新回測、占用或繞過 dd5 名額。
- **D2-15 保留**：公開時間、首次觀測、擷取時間與修訂版本須分清楚；13F 的期限文字補上非營業日順延例外（[SEC FAQ 25](https://www.sec.gov/rules-regulations/staff-guidance/frequently-asked-questions-about-form-13f)）。
- **本次沒有主張被一手來源推翻，沒有建議需要因偽造引用而刪除**；不優先做交易標籤、跟單推薦及定投／部位調整的結論保留。未抽查部分不在此保證範圍內。
