# V-C：任務 C 研究結果獨立查核

查核日：2026-10-28。先讀 `web/docs/research-2026-10-28/prompts/C.md`，再讀報告全文、`web/docs/forecast.md` 的兩輪事前登記與 `web/docs/research-2026-10-27/proposal.md` §6。以下選取十五條主張，優先涵蓋摘要及 C-01 至 C-09 的依據。原報告位置以 `C-dca-entry-exit.md` 表示同目錄上層 `results/` 的受查報告；本地程式來源以 repo 根目錄為準，查核時 HEAD 為 `99066fd3ad63ec7b040f6fd447f255b2d3c3964a`。

判定計數：**已核實 13／部分 1／被推翻 0／無法核實 1**。核實文獻的數字，是確認作者確實如此報告，並非重算或認證其底層市場資料。未執行任何市場回測或探索統計、未呼叫正式站管理 API；GitHub API 使用 0 次，未使用 agent-reach 的 X／GitHub 管道。

## 1. 主張查核表

| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
| --- | --- | --- | --- | --- | --- |
| 1 | 期初單筆對照把整段累計投入都放在第一天，不能視為薪資族可行的錯失報酬；支撐 C-01。 | `C-dca-entry-exit.md:21、191、246` | 已核實 | `invested += monthlyAmount` 在每個新月份累計；之後直接 `const lumpUnits = invested / pts[0].close`。頁面標「同金額期初單筆」，沒有期初資金已備妥的說明。**反駁檢查：**函式只有價格序列、開始日與月投入額，沒有資金到帳或借款模型可阻止這個假設。這是比較前提與呈現問題，不能稱為計算錯誤。 | `web/src/lib/analytics.ts:157、165、177`；`web/pages/etfs.tsx:174` |
| 2 | 現有試算不含配息、稅費；不能直接拿它排配息型與累積型 ETF 的稅後優劣；支撐 C-02、C-03。 | `C-dca-entry-exit.md:22、193、195、240` | 已核實 | Yahoo parser 實際取 `result.indicators?.quote?.[0]` 的 `close`；`simulateDca` 只有買入單位與市值，沒有股息再投入。`etfsView` 再以 `p.close * rate` 換成台幣。**反駁檢查：**沒有發現隱藏的 `adjclose` 或稅費步驟；網頁第 187 行已有明確不含項目，故不是未揭露的稅後試算 bug。另核對 `EtfProduct` 現有欄位，確實尚無 ISIN、註冊地及配息政策欄位。 | `web/src/lib/sources/yahoo.ts:18、25、39、42`；`web/src/lib/analytics.ts:153、168、176`；`web/src/server/views.ts:294、299、304`；`web/pages/etfs.tsx:187`；`web/src/lib/universe.ts:28` |
| 3 | ±20% 目前只是規劃文字，網頁雙向檢討與 iOS 上漲出場用語不一致；支撐 C-04、C-05、C-06。 | `C-dca-entry-exit.md:23、24、86、205、237` | 已核實 | 預設 `exitConsiderationPct: 20`；網頁寫「檢討門檻 ±%」及「漲跌達…時檢討」；iOS 顯示「考慮出場的漲幅」，編輯欄還寫「考慮出場漲幅 %」。**反駁檢查：**全域查欄位使用處，找到儲存、驗證及呈現，沒有把損益與門檻相比的觸發程序；`PUT /api/v1/etfs` 只存設定。網頁另明寫「只是規劃，不是持倉或交易紀錄」，所以確認的是措辭落差，並非實際自動賣出。 | `web/src/server/views.ts:224、230、244、257`；`web/pages/etfs.tsx:195、207、222`；`ios/MarketObservatory/Views/MoreView.swift:254、312`；`web/routes/api/v1/etfs.ts:8` |
| 4 | Vanguard 2023 的全球股票一次投入比較：1976–2022、三個月分批、計入等待現金利息後，勝率 65%；支撐 C-01、C-09。 | `C-dca-entry-exit.md:36、234` | 已核實 | 原 PDF 第 3 頁 Figure 2 註解交代 MSCI World、1976–2022、三筆相隔一個月、一年後比較；第 5 頁另將未投入現金按三個月美國國庫券利率計息，明列一次投入勝率 65%。研究對象是已持有整筆現金；`anecdotal` 與適用限制標得恰當。 | [Vanguard 原 PDF，第 3、5 頁](https://corporate.vanguard.com/content/dam/corp/research/pdf/cost_averaging_invest_now_or_temporarily_hold_your_cash.pdf) |
| 5 | AQR 的 BTD 自家歷史檢驗平均 Sharpe 落後持有指數 0.04，含現金利息；支撐不採行情加碼及 C-09。 | `C-dca-entry-exit.md:51、235、258` | 已核實 | 原 PDF 第 4 頁：1965-01-01 至 2025-09-30、196 組規則，等待期間持現金；註腳 6 指定 ICE BofA 3M T-Bill Index，註腳 5 說長樣本為價格報酬。第 5 頁列平均 Sharpe 差 −0.04；含息的 1989-10 至 2025-09 子樣本差 −0.27。第 7 頁註腳 13 確實把逐期資金流的完整研究留待後續。不是本 App 有限額外預算的直接檢驗。官方文章日期也確為 2025-12-01。 | [AQR 原 PDF，第 4–7 頁](https://www.aqr.com/-/media/AQR/Documents/Alternative-Thinking/AQR-Alternative-Thinking---Hold-the-Dip.pdf)；[官方發布頁](https://www.aqr.com/Insights/Research/Alternative-Thinking/Hold-the-Dip) |
| 6 | Hayley 指出 VA 的較高 IRR／MIRR 不等於較高預期財富；支撐 C-05 的現金與總帳比較。 | `C-dca-entry-exit.md:55、201、235、260` | 已核實 | 作者稿內頁標「This version: 7 October 2014」。摘要及導論明指動態投入會使 IRR、MIRR 成為有偏的預期利潤指標；後文將 IRR 優勢與期末財富分開。這是理論與模擬批評，原報告已明說不是市場 OOS，沒有把它升為已驗證的台幣交易策略。 | [City Research Online 作者稿，PDF 第 2–4 頁及正文](https://openaccess.city.ac.uk/6298/1/VALUE%20AVERAGING%207%20October%202014.pdf) |
| 7 | Edleson 的 VA 有 `anecdotal`、正向提高報酬的經驗依據。 | `C-dca-entry-exit.md:54`，與 C-05 的 VA 討論相關 | 無法核實 | Wiley 頁面直接 HTTP 抓取為 403，經瀏覽器可讀到書名、作者、ISBN 978-0-470-04977-8、2006-10 與 256 頁；沒有讀到績效表、比較資金供給、side fund 或方法。書籍與提高報酬的宣傳方向存在，但**策略有效的經驗證據未取得**。原報告已承認未核實全書，本判定不指稱書中沒有檢驗。 | [Wiley 原連結](https://www.wiley.com/en-ca/value-averaging-the-safe-and-easy-strategy-for-higher-investment-returns-p-9780470049778)，瀏覽器轉往 [目前產品頁](https://www.wiley.com/en-ca/shop/general-finance-investments/value-averaging-the-safe-and-easy-strategy-for-higher-investment-returns-p-9780470049778) |
| 8 | Concretum 外部延伸有 CAGR 6.05%、Sharpe 0.68、最大回撤 11.7%，可列近似趨勢規則的獨立檢驗；報告概括其未含交易成本。 | `C-dca-entry-exit.md:72、74、215、236` | 部分 | PDF 第 1 頁為三名外部作者、2025-04，五類資產、200 日均線、月末訊號、T-bill；第 2 頁確實列出 2006 至 2025-03 的三個數字。**但第 4 頁 §2.4 另對週三分批變體加入一日執行延遲與每次名目交易額 10 bps 成本，報告成本使績效下降約 41 bps。**應限稱「6.05% 那組基本延伸未扣成本」，不能概括整篇未處理佣金滑價。外部作者做過近似規則回測可以核實；精確原規則複驗、未受選擇影響的 OOS 與台灣定投有效性仍不能由此認證。原報告對 2006 起點早於正式發表、均線不同及多資產適用限制已有揭露。 | [Concretum 原 PDF，第 1–4 頁](https://concretumgroup.com/wp-content/uploads/2026/06/GlobalTacticalAssetAllocation.pdf) |
| 9 | Morningstar 2026 的十年投資人報酬 8.7%、基金報酬 9.9%、差 1.2 個百分點，且合理儲蓄與再平衡也會造成落差；支撐 C-06 的不承諾報酬。 | `C-dca-entry-exit.md:94、96、238、261` | 已核實 | 官方 PDF 第 1 頁標 2026-08-06、期間截至 2025-12-31，三個數字一致；第 3 頁另列美股基金 12.8%／13.3%。第 5 頁明說薪資定期投入及再平衡也可能打開落差，不能當投資人犯錯的直接證明。注意母體是美國共同基金與 ETF，並非台灣 S&P 500 定投者；不能移植成 App 可挽回的年報酬。 | [Morningstar 原 PDF，第 1、3、5 頁](https://www.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/blt852a4301adc2f5db/US_Mind_the_Gap_2026.pdf) |
| 10 | 非居民一般美國來源股利，在無適用減免下通常預扣 30%；台灣不在 IRS 所得稅協定名單；支撐 C-03、C-07。 | `C-dca-entry-exit.md:136、137、239` | 已核實 | 親讀 IRS Publication 515 (2026)，一般外國人美國來源所得原則為 30%，可依協定減免；股利章亦有分配性質例外。IRS A–Z 的 T 段列 Tajikistan、Thailand、Trinidad、Tunisia、Turkey、Turkmenistan，沒有 Taiwan。核實範圍是報告附條件的一般規則，**不是把每筆 ETF 分配都認定 30%**，也不是完整個人稅務結論。 | [IRS Publication 515：Withholding of Tax、Dividends](https://www.irs.gov/publications/p515)；[IRS 所得稅協定 A–Z](https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z) |
| 11 | US$60,000 是非居民非公民的 Form 706-NA 申報門檻，非立即賣出門檻；支撐 C-07。 | `C-dca-entry-exit.md:138、239、252` | 已核實 | 官方頁更新日確為 2026-06-28。原文稱死亡日美國所在地資產，加上 gift tax specific exemption 與 adjusted taxable gifts，超過 60,000 美元即須申報；未按通膨調整，通常死亡後九個月內申報。故要涵蓋相關贈與調整，不能把它簡化成單一券商市值或一筆應納稅額。原報告正文的「資產等合計」及不做硬式稅額結論方向正確。 | [IRS 非居民非公民遺產稅官方頁](https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax-for-nonresidents-not-citizens-of-the-united-states) |
| 12 | 愛爾蘭 UCITS 持有美股的內層股利通常扣 15%，非居民外層免扣有文件條件，累積型不免內層稅；支撐 C-03。 | `C-dca-entry-exit.md:140、141、239` | 已核實 | State Street 官方頁日期確為 2026-06-02。結構表及正文分基金層與投資人層，明載美股內層通常 15%，非愛爾蘭投資人一般可提供非居民證明取得外層預扣豁免；累積股份仍承受底層美股股利預扣。這核實的是通常產品結構，沒有核實每一帳戶的條件或台灣可扣抵稅額。 | [State Street 官方結構比較：Tax treatment](https://www.ssga.com/hk/en/institutional/insights/considerations-for-non-us-investors-us-etfs-vs-irish-ucits) |
| 13 | 006205 是富邦上証，並非 S&P 500 ETF；支撐 C-02。 | `C-dca-entry-exit.md:148、240、247` | 已核實 | 富邦頁面在 `stkId=006205` 直接顯示「006205 / 富邦上証」「上証180基金」。另查看現有 `ETFS`，沒有 006205；因此這是擴充時的身分校正，**不是現有 App 已誤收 006205 的 bug**。 | [富邦官方產品淨值頁](https://websys.fsit.com.tw/FubonETF/Fund/Nav.aspx?stkId=006205)；`web/src/lib/universe.ts:45` |
| 14 | 00646 的 2026-07-29 公開說明書列 2024、2025 年實際費用率皆 0.36%；支撐 C-02、C-03。 | `C-dca-entry-exit.md:150、152、153、240` | 已核實 | 直接取得元大 PDF 並解析：封面刊印「115 年 7 月 29 日」；PDF 第 92 頁「最近五年度各年度基金之費用率」中，標普 500 基金的 2021–2025 欄依序為 0.61、0.45、0.48、0.36、0.36。表註確含交易直接成本及會計帳列費用；經理費另列依規模 0.50%／0.40%／0.30%。沒有把槓桿或反向子基金的數字讀到 00646，也不能把往年實際費用率寫成未來保證。 | [元大公開說明書，封面、經理費節、PDF 第 92 頁費用表](https://www.yuantafunds.com/fund/download/1129%E6%A8%99%E6%99%AE500%E5%82%98%E5%9E%8B-%E5%85%AC%E9%96%8B%E8%AA%AA%E6%98%8E%E6%9B%B8.pdf) |
| 15 | 家庭海外所得達 100 萬元全數計入；基本所得額扣 750 萬元後按 20% 算基本稅額，再比較一般稅額；支撐 C-07。 | `C-dca-entry-exit.md:175、177、252` | 已核實 | 財政部原頁第十題明列未達 100 萬元免計、達門檻全數計入；第十一、十二題明列 750 萬元及基本稅額公式，超過一般所得稅額後仍可依規定扣抵海外已納稅額。第十三題要求限額及來源地稅務機關同年度納稅證明。這是申報戶所得規則，不是海外資產市值達 750 萬元就加課 20%。 | [財政部稅務入口網，第十至十三題](https://www.etax.nat.gov.tw/etwmain/tax-info/understanding/tax-saving-manual/national/individual-income-tax/6xKrvGR) |

## 2. 與事前登記或排除清單的衝突表

逐項對照的是建議本身；研究引述曾被否決的策略，與把該策略重新放進 App，是兩件不同的事。沒有把「尚未獲准執行」誤寫成「已違規回測」。

| 建議 ID | 衝突的規則 | 說明 |
| --- | --- | --- |
| C-01 | 無直接衝突。`forecast.md:51、52、114`；`proposal.md:425`。 | 區分期初現金與逐月收入、補現有比較假設，不改預測標籤、條件或定投指令，不是重開被否決模型。若另做資金流政策的歷史績效比較，才需要另立規格；不能以文字修正名義附帶跑政策回測。 |
| C-02 | 靜態資料無衝突；歷史比較受 `forecast.md:15、52、113、118、704` 約束。 | ISIN、註冊地、配息政策等可作產品事實。006205 現在不在目錄，保留「擴充時排除」即可。新增含息或台幣績效不能沿用 21 日美元價格標籤作有效性宣稱；原報告已要求歷史比較另登記，這個限制須留下。不是重開 §6 的因子或資料輸入。 |
| C-03 | 非歷史成本情境無衝突；`forecast.md:52、114、118`；`proposal.md:425`。 | 固定使用者假設的費用與稅情境沒有市場訊號。若改為按 P(dd5)、VIX 或行情安排匯款／加碼，便跨到 X03／永久否決的部位政策；稅後歷史排行榜亦非本輪名額 A 的附帶工作。原案未如此提議。 |
| C-04 | 無直接衝突；`forecast.md:114`；`proposal.md:425`。 | 中性檢討用語與不自動觸發符合 X03。預設 ±20% 存在，不代表其交易有效性已登記；後續若研究觸發事件，需另登記，不得拿 UI 預設值當採用證據。API 既有 Plan 欄位為非 optional（`ios/MarketObservatory/Models.swift:336`），文字修正亦不需要改其線上資料意義。 |
| C-05 | 原案無衝突；變成市場門檻即衝突。`forecast.md:114、720`；`proposal.md:425`。 | 使用者自訂與行情無關的日期、現金來源與帳本，不屬 meta-labeling。倘由預測決定下一批金額、延後或提前扣款，就重開永久否決項目；「只動研究預算，不動月扣」不能自動豁免部位大小建議的產品邊界。 |
| C-06 | 無直接衝突；`forecast.md:114、720`；`proposal.md:425`。 | 用途、收入、流動性與決定理由是非行情的規劃工具。不能把檢討表轉成「根據模型應減碼」的指令，也不能由 Morningstar 的總體落差推導其能增加報酬。原案已列 `none`，可保留。 |
| C-07 | 無直接衝突；`forecast.md:114`；`proposal.md:425`。 | 家庭所得與傳承入口不改市場預測。US$60,000 要作法律資料檢討，不能推出應立刻賣出或停扣。這些法規門檻不是模型試驗，沒有占用第二輪名額；仍須保留適用身分與年度。 |
| C-08 | **須獨立審議，未被現有登記授權。** `forecast.md:118、142、159、197、324、704`；`proposal.md:414、418、425`。 | 原案新增「相對歷史高點跌 20%」條件、252 日含息終點及台幣版本，超出第二輪唯一 dd5／rvHigh 名額。它不是 §6 已否決的「52 週高點回撤」旗標的精確重測，也不是 §6 點名的 3%／21 日或 10%／63 日目標，所以不能判成已直接違反那些明文排除；但若以「只是描述」迴避另案審議，或據結果挑買點、改部位，就重開趨勢搜尋／X03 問題。設定事件數不足 30 不顯示分位數，不能證明剩餘事件具獨立性、代表性或統計力，也不取得新試驗名額。**維持本輪不執行，暫不納入實作清單。** |
| C-09 | 無衝突，直接遵守 `forecast.md:114` 的 L17／X03；`proposal.md:425`。 | 保留固定句，另說明收入或資金用途改變時可重新檢討，不涉及看行情改扣款。這不是利用新文獻修改 X03，也沒有重開永久否決的 meta-labeling。 |

補充：`proposal.md` §6 留有較早的重開路徑文字，不能覆蓋 `forecast.md:120` 指定的優先序。例如 EWMA 已在較新的 `forecast.md:151` 明確延後；本報告沒有把舊 proposal 的路徑視為現在可執行的授權。同理，C-08 的設計文字本身不等於一份已合併的登記。

## 3. 證據等級高估清單

- **Edleson：`anecdotal`、正，超過本次可讀證據。** 原報告第 54 行一面承認未核實書中檢驗，一面給正向經驗證據等級。親讀 Wiley 產品頁只確認出版資訊，沒有取得回測方法或結果。應改為「有效性 `none`／未核實；原作者的提高報酬主張」，不要當成已讀到的正向回測；出版商宣傳也不是獨立檢驗。這項降級不影響 Hayley 批評的獨立成立。
- **Concretum：等級可保留窄義，效果與 OOS 意義必須收窄。** 外部作者確實檢驗了近似規則，故按任務的分類，不能只因它是從業者研究就斷言 `independently_tested` 一定錯。但它不是 Faber 十個月規則的精確複驗；2006 起的回溯延伸、另外探索的再平衡日期與分批變體，也不是已凍結的台灣定投政策前瞻試驗。6.05% CAGR 為正及 Sharpe 0.68，不自行證成勝過同資金流、同成本的持續定投。「正」只能限定在該外部歷史延伸，不能升為可修改 X03 的政策證據。並應補上同篇 §2.4 的延遲及交易成本敏感度，避免把它整篇描述為完全未處理成本。[原 PDF，第 1–4 頁](https://concretumgroup.com/wp-content/uploads/2026/06/GlobalTacticalAssetAllocation.pdf)
- **C-08 的「30」沒有證據等級可升。** 第 224 行已正確稱它為顯示門檻提案，整合時不得省略這句，把三十事件、非重疊或登記本身寫成 OOS／有效性的保證。此處仍是 `none`。

本次抽查的 Vanguard、AQR 與 Morningstar 都維持 `anecdotal`，Hayley 也明載理論／合成模擬的限制；這些沒有查到把機構自述升為獨立驗證的情形。受查核心證據不是橫斷面選股，亦未發現原報告把選股 alpha 直接套到指數擇時。法規及產品事實標 `none` 符合原題分類，不應因此被說成法規沒有一手證據。

## 4. 最重要的遺漏

**報告沒有處理 App 真正可選的槓桿／反向 ETF，與其引用的一般長期定投證據之間的適用落差。** `web/src/lib/universe.ts:50` 起列 SSO、UPRO、SPXL、SH、SDS、SPXU、SPXS；`web/pages/etfs.tsx:139` 讓所有列都進定投選單，`web/src/server/views.ts:246` 亦接受任一目錄標的作規劃，這是實際輸入情境。網頁第 122 行已提醒每日重設與偏離，因此不能指稱 App 完全沒有揭露；但報告只校正註冊地與稅費，沒有查明一般 1x 股票的 lump sum／DCA 文獻能否套到這些產品。SEC 投資人教育辦公室 2023-08-29 的[原文公告](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec)明說每日目標不等於長期目標，長期持有可能與指數倍數顯著偏離。至少應將 C-01、C-02、C-03 的證據適用範圍明定為非槓桿 1x 產品；這是產品與文獻口徑核對，不需要新回測，也不能據此武斷推出所有槓桿策略永遠無效。

## 5. 結論：哪些建議應降級、刪除或保留

- **保留 C-01、C-04、C-09，優先處理。** 資金前提與跨平台措辭問題均經程式碼確認；維持 X03 的結論不需改變。
- **保留 C-02、C-03、C-07。** 產品身分、主要稅務門檻與費用率有一手依據；限定為附日期與適用條件的資訊／情境工具，不能宣稱已驗證稅後歷史排名，並補清楚 1x 與槓桿／反向產品的證據邊界。
- **保留 C-05、C-06 為 `none` 的產品設計。** 不宣稱提高報酬，也不把行情接成資金指令。
- **C-08 降為另案待審，本輪不納入實作或計算。** 它沒有取得第二輪名額；若日後重提，須獨立登記與審議，不能以描述統計繞過 X03。
- **沒有建議需要整項刪除。** 刪除 Edleson「已取得正向經驗證據」的解讀；更正 Concretum 整篇未處理交易成本的概括，保留其三個數字及近似外部延伸的窄義結論。
