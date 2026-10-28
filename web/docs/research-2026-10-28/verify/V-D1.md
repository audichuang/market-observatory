# V-D1：個股判斷研究的獨立查核

查核日：2026-10-28。先讀任務原題，再從「給整合者的摘要」與 D1-01～D1-08 回溯選出 15 條關鍵主張。原報告位置均指 `web/docs/research-2026-10-28/results/D1-stock-judgment.md`；本檔的程式路徑從 repo 根目錄起算。

**判定計數：已核實 12／部分 3／被推翻 0／無法核實 0。**「已核實」只涵蓋表列的具體主張，不認證整套策略或報告其他段落；「部分」保留只讀到原摘要、無法覆核完整研究設計的限制。被推翻的主張：無。

本次親自讀取期刊原摘要、作者／大學託管論文、機構官方文件、目前程式與 schema，對相關 PDF 頁面另作畫面核對。Nasdaq 兩個公開端點各做一次唯讀 GET；另以純合成資料在記憶體 SQLite 執行現有 upsert，沒有使用市場歷史資料。未跑新回測或探索統計、未查正式 DB、未呼叫管理 API、未使用 agent-reach 的 X／GitHub 管道；GitHub API 呼叫 0 次。repo 內只寫入本查核檔；下載與畫面核對的中間檔均位於系統暫存目錄。未列入的 Womack 效果數字、AAII 績效、Value Line 衰退及 CAN SLIM 樣本外等級等，不在本次 15 條認證範圍。

## 1. 主張查核表

| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
| --- | --- | --- | --- | --- | --- |
| 1 | Barber 等（2001）：最有利評等組合年化 gross 異常報酬 4.13%；扣成本後未可靠大於零，最大型公司沒有可靠評等報酬差。 | §4.1:108；摘要:284；支撐 D1-04、D1-08 | 已核實 | 原文 p.533 明列 4.13%；pp.534–535 說最大數百家公司沒有可靠高低評等差，活躍策略 net 異常報酬「not reliably greater than zero」。報酬期間是 1986–1996。這是未偵測到優勢，不是證明所有策略效果精確等於零，更不是今日七巨頭的檢驗。 | [作者大學提供的原文](https://www.anderson.ucla.edu/documents/areas/fac/accounting/trueman_5.pdf)，pp.533–535 |
| 2 | Jegadeesh 等（2004）：季度共識評等變動含其他變數以外的資訊；評等水準在不利特徵股可能方向相反。 | §4.1:110；摘要:284；D1-04:298 | 部分 | 期刊原摘要確實區分水準與「quarterly change in consensus recommendations」，並稱後者有增額資訊；不利特徵股票的高評等伴隨較差後續報酬。未讀到全文，未覆核完整樣本、持有期與成本；更未看到 Nasdaq 買／持／賣家數差的直接驗證。原報告已揭露未讀全文。 | [Wiley 原期刊摘要](https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.2004.00657.x)，Abstract |
| 3 | Bradshaw 等（2013）：2000–2009、12 個月目標價，平均樂觀差 15%、平均絕對誤差 45%、到期達標 38%、期間達標 64%；持續能力經濟上弱。 | §4.1:112；摘要:285；D1-02、D1-08 | 部分 | Springer 原摘要逐一載有 15%、45%、38%、64%，並明說持續能力統計顯著但經濟上弱；頁面出版日是 2012-11-20、卷期年份 2013。四個數字並未被推翻；全文仍需訂閱，45% 的完整分母與計算定義未覆核，故保留「部分」。不能把 38% 解讀為本站當前共識目標價的達標機率。 | [Springer 原摘要及公開 Notes](https://link.springer.com/article/10.1007/s11142-012-9216-5)，Abstract、Notes 10、17–22 |
| 4 | Palley 等（2025）：高分歧時，目標價隱含報酬與後續報酬關係為負；最高減最低的範圍也做過替代檢驗。 | §4.3:126、128；摘要:285；D1-02:296 | 已核實 | Yale 作者稿 §3 的樣本為 1999-07～2020-12，主要結果是未來 12 個月個股報酬；摘要及結果確有低分歧正、高分歧負的關係。§6.3／Table 11 將 RANGE 定義為最高目標減最低目標、除當月股價，結果方向相近。作者研究頁列此文為 2025。沒有本站大型股固定門檻或 UI 改善成效的檢驗。 | [Yale 作者稿](https://insights.som.yale.edu/sites/default/files/2025-01/Consensus%20target%20prices.pdf)，正文 pp.11–12、34–35、Table 11（PDF 第 55 頁）；[作者研究頁](https://www.asapalley.com/research.html) |
| 5 | Morningstar 股票星等有兩篇方向相反的獨立學術研究，不能只選正面結果。 | §5.1:141–142；摘要:286；D1-08 | 部分 | Bolster 等原論文 §4 確為 2001-06-26～2012-10-01；摘要與成本段認為適度成本降低但未消除好處。Liu–Peabody 的 SSRN 原摘要則稱最低評等組合風險調整後仍最佳。兩篇相反結論確實存在；本次未取得後者全文，不能判定差異究竟來自期間、組合或風險調整。Bolster 全文為原論文公開副本，並非出版社原站。 | [Bolster 原論文公開頁](https://www.researchgate.net/publication/297600234_Assessing_performance_of_Morningstar%27s_star_rating_system_for_equity_investment)，§4、成本段、§6；[原論文 PDF 副本](https://pdfs.semanticscholar.org/5a6a/3c97cc01acfa58d01dd02ba5201a387ac5e5.pdf)；[Liu–Peabody 原摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2838992) |
| 6 | Seeking Alpha Quant 的獨立作者研究得到市值加權 six-factor alpha 1.21%／月、t=2.97，但包含回填歷史。 | §5.5:181–183；摘要:286；D1-08 | 已核實 | 2023-09 作者稿 Table 3 Panel B 最右欄的確是 Strong Buy 減 Strong Sell：1.21%，括號 2.97。表註的後續報酬期為 2016-01～2022-12；§2 與註 6 說明公開前歷史包含回填，產品在 2019-06 推出。不是 long-only 報酬，也不是成本後 alpha；本表不能證明樣本外。原報告保留 `academic_is` 合理。 | [Guo–Jame 作者稿](https://russelljame.com/quant_Ratings_9_15_23.pdf)，§2.1、註 6、Table 3 Panel B（正文 p.44／PDF 第 45 頁） |
| 7 | Zacks 官方截至 2026-10-05 的 Rank #1 年化 23.82%，基準 11.58%；假設組合未扣多項成本，會計師核閱不等於可交易 alpha。 | §5.2:152–154；摘要:287；D1-08 | 已核實 | 官方表格確列 23.82% 與 11.58%，期間 1988-01-01～2026-10-05；揭露從月再平衡改為週再平衡，缺期末價格會排除，未扣佣金、價差及衝擊。Independent Confirmation 指按 Zacks 自訂準則核閱績效表；頁面列的最近會計師期間只到 2024-07-01，不能替截至 2026-10 的全期背書。官方亦特別稱 Rank #1 紀錄不是回測，勿與其 Research Wizard 回測混用。 | [Zacks 官方績效及計算揭露](https://www.zacks.com/performance_disclosure/)，Zacks Rank Disclosure、Independent Confirmation |
| 8 | CFRA STARS 是模型績效，未扣費；2014-02-03 引入新工作流程，不能把全歷史當同一程序。 | §5.7:197；摘要:287；D1-08 | 已核實 | 官方 Performance Disclosure 明說並非實際帳戶交易，模型未扣稅、佣金及顧問等費用；新流程自 2014-02-03 生效，增加量化工具及建議模型，但評等仍由分析師定性決定。自稱 independent research firm 不會把自家績效升成獨立驗證。 | [CFRA 官方 STARS 績效揭露](https://www.cfraresearch.com/legal/performance-disclosure-stars-performance-charts/)，新流程及 Model performance 段 |
| 9 | Validea 的 optimal portfolios 是事後挑最佳再平衡期間；股票模型與基準不含股息、未扣交易成本。 | §5.8:205；摘要:287；D1-08 | 已核實 | 官方 disclaimer 的 Performance Disclaimer 直接承認模型非實盤、未扣成本，部分紀錄混合回測及 live model；optimal 使用起始時不可知的績效資訊，事後選最佳再平衡期間。股票模型及基準不含股息，ETF／trend 系統另有不同口徑。原報告未把這些自述升格為獨立淨績效。 | [Validea 官方 Disclaimer](https://www.validea.com/disclaimer)，Performance Disclaimer、Optimal portfolios 段 |
| 10 | Capital Group 共享研究、各經理自己決策；Baillie Gifford 分開研究與組合決策，記錄假設及監測點；可借流程但未證明能提高報酬。 | §3.1:65、67；摘要:288；D1-05、D1-06 | 已核實 | Capital System 正文說分享洞見但各自作決策。Baillie Gifford 方法正文 p.10 明列研究備忘錄、少數關鍵監測因素，以及另開 portfolio review 討論買賣和部位，最終由 lead managers 決定。這是機構對流程的描述，並非隔離每項流程的因果實驗；`none` 恰當。這裡的「分開」指會議與決策階段，沒有證據說人員互不重疊。 | [Capital Group 官方方法](https://www.capitalgroup.com/advisor/about-us/capital-system.html)，How it works；[Baillie Gifford 官方 PDF](https://media.bailliegifford.com/mws/5qvlncac/20241122142158_sustainable-growth-p-p.pdf)，正文 p.10（PDF 第 12 頁） |
| 11 | low/high、EPS 財年、估計數、抓取與價格日已在 parser／DB，大部分未送進共識展示層。 | §6.1:223–230；D1-01:295、D1-02:296 | 已核實 | `AnalystView` 有 low/high、fiscalEnd、estimates；schema 有 target_low/high、price_date、fetched_at。反查 loader 的 SELECT 只取 target_mean、評等、eps_up/down 等，`ViewRow` 也無 low/high、財年、估計數；不是被另一段 UI 隱藏，資料傳遞確實未帶。注意 price_date／fetched_at 在 DB，不是 Nasdaq parser 自帶的原發布時點；未查 DB 實際填值完整性。 | `web/src/lib/sources/nasdaq.ts:173`、`:203`；`web/db/schema.ts:142`；`web/src/lib/consensus.ts:4`；`web/src/server/outlook.ts:74`；`web/pages/outlook.tsx:321` |
| 12 | EPS 只讀首列 yearly，來源欄位是近四週修正次數，forecast asOf 為 null；首列不能一律稱未來年度。 | §6.1:226；§6.2:238；摘要:289；D1-03:297 | 已核實 | 唯讀 GET 的 yearly／quarterly headers 均寫「Over the Last 4 Weeks Number of Revisions - Up／Down」，各自 asOf=null；AAPL 首列 fiscalEnd=Sep 2026，另有 Sep 2027 等列。程式 `const row = forecast?.yearlyForecast?.rows?.[0] ?? null`，沒有日期篩選會自動改選下一年度，故「首列必是未來年度」確實站不住。header 不足以證明去重分析師家數，保守標次數合理；也不能反向宣稱已證明一定重複計次。 | [Nasdaq AAPL earnings-forecast](https://api.nasdaq.com/api/analyst/AAPL/earnings-forecast)，2026-10-28 單次 200 JSON；`web/src/lib/sources/nasdaq.ts:192`、`:205` |
| 13 | 抓取 universe 是 SPY 權重前 200，EPS 僅前 100，每次最多 16；任意名單股沒有完整資料保證。 | §6.1:227；D1-01、D1-03 | 已核實 | 常數為 200／100／16；SQL 依最新 weights 排序後 LIMIT 200，EPS 用前 100 集合，`fetchAnalystView(s, top.has(s), budget)` 控制第二個請求。反查名單 loader：成員及可選股票來自使用者名單和持股，不會擴大分析師 universe；budget 不足還可少於 16。這只確認程式規格，不表示已知哪位正式使用者真的缺哪檔。 | `web/src/server/jobs.ts:604`、`:612`、`:622`、`:625`、`:637`；`web/src/lib/sources/nasdaq.ts:224`；`web/src/server/views.ts:387` |
| 14 | as_of 是抓取當日美東日期，同股同日會覆寫，不能當不可變逐事件 vintage。 | §6.1:228–229；摘要:289；D1-07:301 | 已核實 | `asOf = easternDate()`；主鍵為 symbol＋as_of；SQL 明列 `ON CONFLICT(symbol, as_of) DO UPDATE`。我嘗試找阻擋覆寫的路徑：輪替只選最久未嘗試者，沒有同日拒寫規則；手動工作入口與 runJob 也可再執行。將現有 SQL 用合成 SYNTH 列連寫兩次，target_mean 120→121、eps_up 1→null，列數仍為 1。故覆寫能力確實存在；未聲稱正式站已發生資料遺失，正常輪替也不代表每股每天必覆寫。 | `web/src/server/jobs.ts:642`、`:645`、`:747`；`web/src/lib/consensus.ts:83`；`web/db/schema.ts:162`；`web/routes/api/admin/run.ts:16`；本次記憶體 SQLite 合成驗證 |
| 15 | targetprice 有歷月共識，但沒有逐分析師升降評事件；現有 parser 未保留歷月資料。 | §6.2:237、240；D1-04:298 | 已核實 | AAPL 200 JSON 有 consensusOverview 的 low/high/mean、買持賣，historicalConsensus 的 z 含 date、buy、hold、sell、consensus；回應內沒看到 analyst ID、broker 事件鍵或各目標發布日。反查 `TargetPriceData` 只宣告 consensusOverview，parseAnalystView 回傳欄位也沒有 historicalConsensus。因此家數差不能識別「某券商升評」。只認證此單股單次回應，不宣稱 Nasdaq 所有產品都沒有事件資料，也不認證現回傳歷史不可修訂。 | [Nasdaq AAPL targetprice](https://api.nasdaq.com/api/analyst/AAPL/targetprice)，2026-10-28 單次 200 JSON；`web/src/lib/sources/nasdaq.ts:189`、`:203` |

程式主張的反駁結果：現有新鮮度篩選確實存在（`web/src/lib/consensus.ts:30`），但只按抓取日期挑快照，不能補出分析師原發布日、EPS 期別選擇或逐事件 ID；輪替也不能把 upsert 變成不可變儲存。這些是資料能力限制，原報告並未提供、我也未認證一份正式站事故紀錄。

## 2. 與事前登記或排除清單的衝突表

逐條對照第一輪事前登記、第二輪草稿（包含其「未合併前不得執行」限制）及 proposal §6。**就八條建議原文限定的用途，未見直接衝突或重開已否決候選。** 下表同時標明哪些延伸會越界；這不是授權執行那些延伸。

| 建議 ID | 衝突的規則 | 說明 |
| --- | --- | --- |
| D1-01 | 無直接衝突。對照 `forecast.md:15`、`:51`、`:111`；proposal §6 `proposal.md:433`。 | 顯示原始來源、期別與抓取日不改 forecast 條件或標籤，不需模型名額。已有欄位不等於已取得重新散布授權，見第 4 節。 |
| D1-02 | 無直接衝突。邊界為 `forecast.md:21`（目標價隱含漲幅已放棄）、`:142`（R2-0）、`:159`（唯一 dd5 名額）；proposal `proposal.md:411`。 | 原始 low/high 及降低 upside 視覺權重是呈現；個股橫斷面論文不能重開指數 21 日方向輸入。§6.4 的相對範圍定義是另行固定的描述規格，不是第二輪草稿授權新增回測。 |
| D1-03 | 無直接衝突。邊界為 `forecast.md:114`（L17／X03）、`:142`（R2-0）；proposal `proposal.md:425`。 | 展示修正次數、財年與估計數，不等於依修正控制 ETF 加碼或出場。金額變化或廣度若只描述資料，先固定規格；若要驗證預測力，須另案登記，不能挪用僅給 rvHigh 的名額。 |
| D1-04 | 無直接衝突。對照 `forecast.md:111`（L09）、`:118`、`:142`；proposal `proposal.md:428`（命中率排行只能經前瞻紀錄）。 | 共識構成差異不是投行命中率排行，也不是升降評事件。原文要求先定義比較與用語，沒有回測新訊號。若日後加「評等變動有效」或排行榜，另訂凍結資料、樣本與評分協定；不能借 Jegadeesh 摘要跳過。 |
| D1-05 | 無直接衝突。對照 `forecast.md:679`（L13）、`:718`（X01）；proposal §6。 | 手動記錄企業論點、反證與事件，不做指標投票、不計總分、不產生 Strong Buy，沒有重開排除項目。是否值得增加筆記產品功能仍是設計判斷，非已有報酬證據。 |
| D1-06 | 無直接衝突，且延續 `forecast.md:114`、`:720` 的 L17／X03；proposal `proposal.md:425`。 | 原文明確保留使用者的檢討門檻，不把 ±20% 變成停損停利、配置或扣款規則。現在規劃頁也只寫「漲跌達…時檢討」（`web/pages/etfs.tsx:222`）。不得進一步解讀成已驗證的買賣紀律。 |
| D1-07 | 無直接衝突。對照 `forecast.md:111`、`:112`（G02）、`:118`、`:149`（R2-6）；proposal `proposal.md:428`。 | 保存日後研究需要的原始快照與版本符合前瞻問責方向；但 G02 的不可覆寫規則適用 forecasts，不能據此指控現有 analyst_views 已違反 G02。R2-6 只規範 dd5 前瞻計分，不能拿來當股票評等試驗協定。資料蒐集不等於授權計分、排序或調參；上游授權另見第 4 節。 |
| D1-08 | 無直接衝突，符合 `forecast.md:718`、`:720`、`:721` 的 X01／X03／X04；proposal `proposal.md:425`、`:428`。 | 只提供教學與外連、暫不匯入商業評等，不會建立指標投票、權重模型或依評等停扣。Seeking Alpha 有一篇正面個股研究，並不能撤銷原先針對本站指數組合方法的排除。 |

第二輪草稿的優先順序寫在 `web/docs/forecast.md:118`、`:120`：未合併前不得據以做計算；第二輪最多一個 dd5 flag，P(up) 不分配名額。D1 報告 §6.4 自提的描述計算沒有凌駕這些規則。本次沒有執行那些計算。

## 3. 證據等級高估清單

- **D1-02：分開「文獻有分歧資訊」與「這個展示方式已有效」。** Palley 的橫斷面關係及 RANGE 替代檢驗有原文支持；但並列 low/high、降低 upside 的視覺優先度，並未經投資決策或使用者理解實驗。建議本身若必須只有一個成效等級，應為 `none`，把 `academic_is` 留在理由欄。也不能將觀察到的極值範圍稱成機率區間。
- **D1-03：文獻不能替本站代理升格。** [Gleason–Lee 原摘要](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=370425) 區分修正的新資訊程度；它沒有檢驗這個四週計數代理。原報告也已明寫「此代理未驗證」（:297）；其建議列卻先標 `academic_is：修正資訊正`，整合時容易省掉限制。對「Nasdaq 近四週次數＋首列財年」這個具體功能，成效等級仍是 `none`。Number of Estimates 與修正次數不是同一分母；沒有逐筆分析師資訊就不能宣稱是多數分析師投票，也未驗證本站大型股選股效果。
- **D1-04：季度評等變動不等於快照家數差。** Jegadeesh 原摘要不能驗證本站的共識構成差；新增、退出覆蓋也能改變家數。建議列的 `academic_is` 只能指背景論文，本站代理應為 `none`。改成真正升降評還需個人／券商事件鍵與發布時點。
- **三條「部分」不能在整合時變成全文已核實。** #2 的成本／樣本、#3 的誤差定義、#5 的跨研究可比性仍未讀全。這些限制不推翻摘要原數字或結論，但阻止把它們升成 `academic_oos`、成本後 alpha 或今日七巨頭的直接結論。

以上前三項是**建議表把背景研究等級與功能成效混在同一格**的風險；原報告正文多已主動警示，不能反過來指控作者宣稱本站代理已通過驗證。就表內已查的商業績效，Zacks／CFRA 維持 `bank_claim`、Validea 維持 `anecdotal`，沒有看到被偷升為 `independently_tested`；Seeking Alpha 保留 `academic_is` 並指出回填，沒有把樣本內寫成樣本外。摘要與建議也明確拒絕把個股橫斷面結果移到指數擇時，這項邊界應保留。

## 4. 最重要的遺漏

最重要的遺漏是：**報告把 Nasdaq 授權留在「未知」，卻沒有對照官方一般條款來決定 D1-01～D1-04、D1-07 的資料擴充與保存能否交付。** 我實際打開 [Nasdaq Legal](https://www.nasdaq.com/legal)：§2 限制以自動或手動程序擷取內容，§6 授予的是「personal, non-commercial use」並限制未授權複製散布，§7 另要求將內容及 metadata 提供第三方前取得書面同意。這比「端點可讀不代表有授權」更具體；開放註冊 App 的保存、歷史展示及重新散布，應逐項核對此 API 有無另行有效授權或第三方資料條件。一般網頁條款不能單獨證明 api.nasdaq.com 的個別授權狀態，更不能據此宣稱現有服務必然違約；缺的是適用契約與許可範圍的查明。原始數字能拿到，是技術可行性的證據，還不是可擴充發布的依據。（條款查閱日 2026-10-28；頁面未據此認定版本生效日。）

## 5. 結論：建議的處置

- **保留 D1-01、D1-05、D1-06、D1-08**：資料語義、研究紀錄與產品邊界有來源支持；流程成效維持 `none`。
- **有條件保留 D1-02～D1-04**：具體功能的成效等級改為 `none`，學術結果留作背景；不得把範圍、EPS 次數或家數差包裝成已驗證訊號。資料擴充展示另須釐清 Nasdaq 適用授權。
- **D1-07 保留為研究基礎待辦**：不可變快照的需求成立，但新增保存須先釐清授權與收集規格；沒有因此取得新的回測名額。
- **本次不因主張被推翻而刪除整條建議**：15 條中沒有被一手來源推翻者；三條僅部分核實的文獻，保留未讀全文及適用性限制。八條建議按原文範圍均未重開事前登記已否決項目。
