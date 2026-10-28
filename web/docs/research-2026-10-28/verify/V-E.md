# 任務 V-E：資料源研究獨立查核

查核日：2026-10-28。先讀任務題目 `web/docs/research-2026-10-28/prompts/E.md`，再由摘要的 E-01～E-10 反查正文與一手來源。以下 `R` 指 `web/docs/research-2026-10-28/results/E-data-sources.md`；原報告位置均為本次讀到的行號。

抽查 **15 條：已核實 15／部分 0／被推翻 0／無法核實 0**。這是下表明確限定的主張計數，不代表整份報告的所有供應商配額、合約或歷史資料均已覆核。沒有以搜尋摘要代替條款全文；Tiingo 條款在 web 抽取與 curl 回 403 後，改用正常瀏覽器載入，最後親眼讀到全文。Finnhub 的勾叉也另讀前端表格 SVG，沒有把文字抽取的空格當成「未提供」。

只讀本機原始碼、官方文件與少量公開端點；沒有執行市場歷史回測、探索統計、正式站管理 API，也沒有使用 agent-reach。GitHub API／`gh repo view` 使用次數為 **0**。本輪只寫本檔。

## 1. 主張查核表

| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
| --- | --- | --- | --- | --- | --- |
| 1 | Tiingo 公開列出 startup 顯示再散布 $250／月；$50 internal commercial 不等於顯示權 | R:69、R:287；E-01 | 已核實 | 官方產品表把 Commercial 的授權列為 Internal Use Only、價格 $50；另列 **Display Redistribution**，startup $250、enterprise $500，包含 EOD 與 IEX。這是公開方案表，並非本站已拿到含所有用途的商務報價，也不能據此推定保存與終止條件均已談妥。 | [Tiingo EOD 產品頁，Pricing Summary](https://www.tiingo.com/products/end-of-day-stock-price-data) |
| 2 | Tiingo Starter／Trial 不允許持久保存原始資料及 Derived Products；付費終止後也有刪除義務 | R:69、R:287；E-01 | 已核實 | 瀏覽器讀到 Effective Date 2022-01-16、Last Updated 2026-10-06。§1.6(a) 明列禁止 **persistent or durable storage**，涵蓋 DB、logs、queues、backups，也涵蓋 Derived Products。§1.6(b) 要求付費結束刪除 Tiingo Data；§1.6(c) 則允許符合不可替代、不可重建條件的付費衍生結果保留，不能概括成「所有付費衍生結果都須刪」。對原報告實際措辭並無反證，但它漏述核對其他資料集的連帶刪除條款，見 §4。 | [Tiingo Terms，§1.6(a)～(c)](https://app.tiingo.com/tos/) |
| 3 | 現有程式把 `close` 定義為拆股調整、不含股息，不能直接換成含股息 adjusted close | R:20、R:267；E-02 | 已核實 | `yahoo.ts:25` 寫「close 是拆股調整後、不含股息的收盤價（不是 Adj Close）」；`:39`、`:42` 實際讀 `indicators.quote[0].close`。**只核實程式定義及取欄路徑，沒有核實 Yahoo 每筆歷史價格的經濟語意。** 反駁「現有管線完全沒處理拆股」：`repo.ts:69`～`:72` 已在偵測 rebase 時先擋寫入；`jobs.ts:174`～`:190` 有待修及重抓歷史。原報告的遷移警告成立，但不是現有拆股 bug 的證明。 | `web/src/lib/sources/yahoo.ts:25`、`:39`、`:42`；`web/src/server/repo.ts:69`；`web/src/server/jobs.ts:174` |
| 4 | 只換主要日線管線，分析師共識仍會呼叫 Yahoo 取現價 | R:23、R:266、R:299；E-02 | 已核實 | `jobAnalysts` 在 `jobs.ts:630` 直接呼叫 `fetchYahooLastCloses(picks, budget)`；該函式在 `yahoo.ts:119` 再呼叫 Yahoo spark。嘗試找阻擋條件：沒有權重或沒有 picks 時會提前返回（`:616`、`:626`），但正常有 picks 就會進這條路；catch 只留下錯誤及空價格，沒有改從 D1 取價或換供應商的路徑。因此這是具體的殘留依賴。 | `web/src/server/jobs.ts:611`、`:616`、`:625`、`:630`；`web/src/lib/sources/yahoo.ts:118` |
| 5 | 只換 Worker 新聞來源，不會解除本機新聞正文對 Yahoo 的依賴 | R:26、R:268、R:304；E-07 | 已核實 | `ai-batch.ts:99` 打 Yahoo search；`:113` 以標題配對、`:116` 抓配對 URL；`:163` 的 daily 文章重點工作確實呼叫 `article`。反例界線：translate 分支在 `:132`～`:140` 就返回，不是所有 AI 工作都抓 Yahoo；`news-ai.ts:256` 也只要求配對網址是 HTTPS，未限定 Yahoo 網域。但**搜尋依賴**仍確定存在；標題完全配對與抓不到就不寫的保護只處理內容品質，不會移除依賴或提供使用權。 | `web/scripts/ai-batch.ts:94`、`:99`、`:111`、`:132`、`:163`；`web/src/lib/news-ai.ts:252` |
| 6 | SEC 最新 frames 不是歷史已知截面；只靠財務期末或 `filed` 日期不能保證完整 PIT | R:93、R:101～106、R:289；E-03 | 已核實 | SEC API 文件說 frames 選每個 entity **last filed** 且最接近日曆期的 fact；XBRL 彙整只收標準 taxonomy、整個 entity 層級 facts。Accessing EDGAR Data 另明列接受、傳播可能跨日，以及事後更正／刪除、週末重建索引。由此推論應保存 accession、實際可用時間與收到版本，主旨成立。**這是文件與資料定義的核實，不是已做出完整 PIT 資料庫的驗收。** | [SEC API：XBRL／frames](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)、[EDGAR：Business hours／Post-acceptance corrections](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data) |
| 7 | FMP 顯示／再散布資料需要獨立的 Data Display and Licensing Agreement | R:73、R:131、R:288；E-05 | 已核實 | 價格頁正文明說顯示或再散布 **requires a specific Data Display and Licensing Agreement with FMP**。同頁 Basic 的 250 calls/day 並沒有推翻這個要求。這支持先詢授權及樣本，不能證明 FMP 必然提供與現用 EPS 上下修家數同義的欄位。 | [FMP Pricing Plans，方案表下方授權說明](https://site.financialmodelingprep.com/pricing-plans) |
| 8 | Finnhub Free 不含 OHLC、Price Target、EPS Estimates，包含 Recommendation Trends；免費配額不能無縫替代現用共識 | R:60、R:132、R:288；E-01／E-05 | 已核實 | 在實際載入的 Free／All-In-One 表中，Free 的 OHLC、Price Target、EPS Estimates 是叉號 SVG（兩條交叉路徑）；Recommendation Trends 是綠色勾號。Free 表頭是 Personal Use、60 calls/minute，EPS Surprises 另列 4 quarters。這是**該方案／欄位的核實**，沒有取得 key 驗證每個 API entitlement；也不表示 earnings calendar 裡絕不出現個別事件的 EPS estimate。 | [Finnhub Pricing，Free 欄](https://finnhub.io/pricing)（ego-browser 前端 DOM／SVG） |
| 9 | IVV 新 `latest-holdings.csv` 可無 cookie 讀取，舊 ajax 路徑雖回 200 卻是 HTML；不能沿用 SPY parser | R:21、R:141、R:247～248、R:290；E-04 | 已核實 | 05:11 UTC 各 GET 一次：新 URL **200、0 轉址、91,540 bytes**，前兩行是基金名及 `Fund Holdings as of,"Oct 26, 2026"`；表頭含 `Market Weight`、`Notional Weight`。舊 URL **200、0 轉址、2,314,548 bytes**，雖聲稱 `text/csv`，body 為 `<!DOCTYPE html>`、title 為 IVV 產品頁。反駁靜默錯讀：現有 SSGA adapter 已驗 PK 檔頭（`:82`）及 `Weight` 表頭（`:55`），直接塞 CSV 會拒絕，而不是已存在的靜默成功 bug；確實需要不同 adapter。 | [IVV 新 CSV](https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv)、[舊 ajax URL](https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/1467271812596.ajax?fileType=csv&fileName=IVV_holdings&dataType=fund)；`web/src/lib/sources/ssga.ts:55`、`:79` |
| 10 | BlackRock 對外公開 CSV 不等於本站取得公開再利用授權 | R:141、R:290；E-04 | 已核實 | IVV 美國產品頁 footer 的 Terms & Conditions 確實連到原報告引用的 BlackRock corporate 條款，沒有僅憑品牌共用假定適用。該條款 Trademarks／Copyrights 段寫 **solely for your personal, non-commercial use**；公共／商業再用須書面同意，另有限制自動擷取。未看到授予本站持股資料公開顯示權的文字。本判定核實頁面連結及條款文字，不代替特定資料合約。 | [IVV 產品頁及 footer](https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf)、[BlackRock Terms：Trademarks／Prohibited Uses](https://www.blackrock.com/corporate/compliance/terms-and-conditions) |
| 11 | FINRA consolidated short interest 是每月兩次持倉快照，與 daily short volume 不同 | R:155～156、R:291；E-08 | 已核實 | 官方 catalog 明列 exchange-listed 與 OTC、每月兩次、settlement 後第 7 個營業日發布、API 最多滾動 5 年；修訂只提供最新資料及 Revision Flag。FINRA 自己的解釋另說 daily volume 為場外、公開傳播範圍內的 short-sale 成交流量，未與交易所資料合併；同日開平倉可進 volume 卻不留在 interest。這支持分開命名與顯示，沒有支持交易訊號。 | [FINRA Equity Short Interest：About the Data](https://www.finra.org/finra-data/browse-catalog/equity-short-interest)、[FINRA Short Interest — What It Is, What It Is Not](https://syndication.finra.org/content/short-interest-what-it-what-it-not) |
| 12 | FINRA Equity Specific Terms 對 `otcMarket` 有有條件的再散布例外 | R:162～164、R:291；E-08 | 已核實 | 親讀 2022-12-20 的兩頁 PDF：§1.1 涵蓋 `otcMarket`；§1.2 要有有效 Public／Firm／Organization credentials；§2.3 允許給終端使用者作非商業個人／專業用途，須標 FINRA、不得另收資料費、禁止下游再散布、合理確保遵守；§2.4 可做衍生資料。2026-03-19 General Terms §2 也確定 Specific Terms 優先。**免費 App 本身仍不足以完成所有條件。** | [FINRA Equity Specific Terms，p.1 §1～2](https://developer.finra.org/sites/default/files/2022-12/Developer%20API%20-%20Specific%20Terms%20-%20Equity%20Data%20%2812-2022%29%5B10%5D.pdf)、[General Terms，§2、§3.4](https://developer.finra.org/terms-and-conditions) |
| 13 | BLS 有官方 ICS；本機抓取目前失敗，不能宣稱 Worker 已可用 | R:206～207、R:253、R:292；E-06 | 已核實 | BLS 的訂閱說明直接列出 `https://www.bls.gov/schedule/news_release/bls.ics`，頁尾最後修改 2008-07-19，並說日程按需要更新。05:11 UTC 本機獨立 GET 得 **403、0 轉址、1,325 bytes**，title `Access Denied`，沒有 `BEGIN:VCALENDAR`。這確認端點存在於官方文件及本機失敗；沒有測 Cloudflare Worker 出口，HTML 備援也不能因此視為已通。 | [BLS iCal 說明](https://www.bls.gov/help/hlpiCAL.htm)、[BLS ICS](https://www.bls.gov/schedule/news_release/bls.ics) |
| 14 | 13F 可晚至季後 45 日申報，且不包含 short equity／short option positions；應延後跨管理人歷史彙整 | R:118～119、R:306；E-09 | 已核實 | SEC FAQ Q25 明列季後 45 日及假日順延；Q41 不報 short positions，Q43 不報賣出的 put／call。資料集頁另確認 as-filed flattened XML、季更新、2024-03 改批次期間並曾重處理；本次看到列示的單季 ZIP 約 96 MB。這支持「非即時持倉」與本機批次的取捨；不能把延遲揭露解讀成已證明無預測力。 | [SEC Form 13F FAQ，Q25／Q41／Q43](https://www.sec.gov/rules-regulations/staff-guidance/frequently-asked-questions-about-form-13f)、[SEC Form 13F Data Sets](https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets) |
| 15 | Cboe 免費網站下載許可不等於公開顯示／衍生／交叉核對許可 | R:77、R:170、R:307；E-10 | 已核實 | 官網條款版日為 2022-11-16。§2 先允許個人非商業查看／列印／下載一份，再限制儲存、顯示、再散布、衍生及 **use to verify or correct other data or information**，原文保留 fair use 例外及書面同意途徑；§1 另說特定頁面附加條款可能優先。因此可支持先不抓 delayed quotes 的產品決定，不能延伸成「任何利用均絕對違法」或 DataShop 合約也完全相同。 | [Cboe Website Terms，§1～2](https://www.cboe.com/terms/) |

端點重測的共同命令如下，`URL` 分別換成第 9、13 列所列網址；回應只在記憶體中檢視檔頭與表頭，未做價格或持股統計，沒有使用 cookie：

```sh
curl -g -sS -L --max-redirs 3 --max-time 25 \
  -A 'market-observatory verification (https://github.com/audichuang/market-observatory)' \
  -w '\n__PROBE__%{http_code}|%{num_redirects}|%{size_download}|%{url_effective}|%{content_type}' \
  'URL'
```

程式類反駁的結果：共識與 daily 文章搜尋的 Yahoo 路徑成立；拆股與 SSGA 檔案格式則已有保護，不能把「新來源需重寫 adapter」誇大成「目前完全沒有防護的 bug」。沒有為了查核啟動會登入或寫正式站的 `ai-batch.ts`。

## 2. 與事前登記或排除清單的衝突表

對照的是檔案當前文字，包含第二輪草稿；沒有查 Git 歷史來認定草稿已合併。`forecast.md:120` 明定第二輪高於第一輪、高於研究章節；因此較舊 proposal 的重開路徑不能覆蓋更新的草稿限制。

| 建議 ID | 衝突的規則 | 說明 |
| --- | --- | --- |
| E-01 | 目前無直接衝突；邊界為 `web/docs/forecast.md:51` D1、`:52` D2、`:112` G02、`:159` 與 `:169` 名額 A 固定輸入 | 個股／ETF 商務詢價不新增 flag。原報告 R:270 也把 SPX／VIX 排除於這次替換。若實作擴成用新 feed 重寫模型歷史或已發表預測，就超出本建議，不能只稱「換資料源免登記」。Tiingo 合約對核對資料集的刪除義務若擴及應保留的紀錄，須先解決，不能靠刪除既有紀錄滿足它。 |
| E-02 | 目前無直接衝突；`web/docs/forecast.md:52` D2、`:113` L16；`web/docs/research-2026-10-27/proposal.md:434` 排除含股息／TWD 機率標籤 | 維持現有不含股息的試算、先做欄位規格及合成 fixture，與規則一致；不能順便把含配息 adjusted close 接成新的展望標籤。E-02 不是一個額外模型試驗名額。 |
| E-03 | 純溯源無衝突；`web/docs/forecast.md:321` 估值／ERP 擇時排除；`web/docs/research-2026-10-27/proposal.md:416` insider 等指數輸入排除 | 保存 accession、版本與發布時間、顯示財報事實，不是估值擇時或個股建議。若後續把基本面卡轉成指數機率或買賣評分，才是新範圍；不能由「資料已可抓」推論可採用。 |
| E-04 | 目前無衝突；`web/docs/research-2026-10-27/proposal.md:429` 排除 Select Sector ETF 推產業點數、`:433` 排除 N-PORT 權重回補 | 建議是 SPY／IVV 最新持股核對及來源標示，並未提被排除的產業 ETF 或 N-PORT 方法。不得把目前持股回填成當時已知權重，也不能把兩個 ETF 的一致當成官方 SPX 權重已核實。 |
| E-05 | 背景顯示無衝突；`web/docs/forecast.md:11`、`:21`、`:22` 共識／目標價不進機率；`:142` R2-0 只有一個 dd5 名額 | 原表明寫不得進既有模型，與規則一致。不過「預測用途另議」不是新的試驗許可；拿新的分析師資料商重測已放棄的 21 日指數方向輸入，屬重開已否決項目，不能占用或另加本輪名額。 |
| E-06 | 事件資訊無衝突；`web/docs/forecast.md:114` L17／X03；`web/docs/research-2026-10-27/proposal.md:416`、`:431` 總經指數 flag 與商業 consensus surprise 排除 | 官方日程、時間及修訂來源可以顯示。若把日程擴成 Fed／利率指數 flag、爬商業 consensus 算 surprise，或指示停扣／加碼，就跨進已排除範圍；原建議明確沒有這樣做。 |
| E-07 | 事實與來源連結無衝突；`web/docs/forecast.md:114` L17／X03、`:142` R2-0、`:326` 依敘事追加指標排除；`web/docs/research-2026-10-27/proposal.md:430` | 改新聞來源及確認 AI 使用權不新增模型。原表「若做情緒績效研究則是」只表示還有登記需求，不得讀成已有額度、可以回饋 P(up)／P(dd5)，或可改成交易分數與部位建議。 |
| E-08 | 顯示無衝突；指數訊號會重開 `web/docs/research-2026-10-27/proposal.md:416` 的 short interest 排除；另有 `web/docs/forecast.md:142` R2-0、`:114` X03 | 背景 short interest 與 daily volume 分開顯示是允許的。原表已提示指數 flag 衝突；其「訊號研究是」不能脫離這個限制，變成「另登記就可重測 short interest」。也不能據此提供風險調整扣款或部位規則。 |
| E-09 | 連結與延後批次無衝突；`web/docs/research-2026-10-27/proposal.md:416` insider 排除、`:425` 部位／扣款調整永久否決 | Form 4 申報事實、13F 原文連結及本機整理，沒有等於 insider 指數 flag、機構跟單或排名。若從這些資料另做訊號，須先面對排除清單與產品範圍，不能只把它稱為一般市場統計後登記。 |
| E-10 | 不新增與排除一致；`web/docs/forecast.md:25` VRP 已否決、`:24` VIX 期限結構已放棄、`:151` R2-8 延後；`web/docs/research-2026-10-27/proposal.md:409`、`:410`、`:415`、`:419`、`:420` | 可以日後詢選擇權資料授權；資料合約不會重開 VRP、VIX 期限結構、raw-VIX-GBM dd5 或 N(d2) 機率。尤其舊 proposal §6 寫可經 R2-8 間接比較，不代表目前可算：更新的 forecast 第二輪已將 EWMA 比較延後。 |

逐條對照後，E-01～E-10 **目前明寫的行動沒有直接要求重開已否決試驗**；上表列的是需要保留的限定及後續擴張時會觸碰的規則。第二輪仍只有 `rvHigh` 取代 `vixStress` 的 dd5 名額（`web/docs/forecast.md:142`、`:159`）；任何資料源研究均不額外增加名額。

## 3. 證據等級高估清單

- **沒有發現預測證據等級被升格。** R:11 與 R:298～307 一律用 `none`、結果未檢驗，沒有把機構自述寫成 `independently_tested`，也沒有把樣本內、橫斷面選股或資料可得性轉成指數擇時 OOS 證據。「未檢驗」也不等於效果已被證明為零。
- **「首選」只足以支持先詢價，不能支持資料品質或完整成本排名。** 第 1、7、8 列核實了方案／授權障礙，沒有比較 Tiingo、Massive、FMP、Finnhub 的實際全名單覆蓋、錯值、EPS 修正定義、推播及終止保存權。R:80、R:319 已承認這些限制，整合者不能省略限定後升格為已完成選型。
- **本機 HTTP／官網規格不能升格成 Worker 生產驗證或整份資料已驗真。** 第 9、13 列只核實本次回應與檔案格式；沒有測正式 Worker、付費 key 或 IVV 每一欄的計算。第 3 列也只證明程式對 `close` 的定義，不能援引註解當 Yahoo 全歷史已驗真的證據。這是核實範圍限制，不是找到相反的歷史數字。
- **資料授權與 PIT 完整性也不能由局部條件直接升格。** FINRA 的 credentials、終端用途、attribution 與不得下游再散布要同時成立，免費網站不足以單獨通過。SEC 的 `filed`／accession 可支持溯源，不能保證已保留所有當時可得或其後移除的版本。原報告大致有正確區分。
- **GDELT 是連結發現候選，不是已驗收的媒體全文授權。** 我另讀 [GDELT 自有 datasets 條款](https://gdeltproject.org/about.html#termsofuse)，確實允許商用及再散布並要求引用／連結；條款沒有給本站新聞出版社全文／圖片的授權。05:11 UTC 對 R:258 同一個 DOC 查詢獨立 GET 一次仍得 429、444 bytes，並要求每 5 秒至多一次。其 [2018 官方更新](https://blog.gdeltproject.org/doc-geo-2-0-api-updates-full-year-searching-and-more/)確實說可搜近一年，但本次未取得當前長窗口結果，不能當 2026 年可用性驗收。這些限制與 R:220 的保留相符。

## 4. 最重要的遺漏

最重要的遺漏是 **Tiingo 對「被它核對的其他資料集」也可能產生停訂刪除義務**。報告 R:69、R:319 雖已提醒 cross-check 與解約保留權，卻沒有寫出 [2026-10-06 Terms §1.6(c)](https://app.tiingo.com/tos/) 的具體範圍：用 Tiingo 驗證另一份 EOD 資料後，觸發 §1.6(b) 刪除時，要求刪除 **both the Tiingo Data and the validated dataset**。所以若照選源構想拿它核對既有 Yahoo／Cboe 歷史，影響可能超過新供應商資料，並波及歷史快照、備份及重現所需輸入；不能只取得 raw feed 的保留權就假定足夠。遷移前應逐項列出會被核對的既有資料集與衍生紀錄，取得書面排除／存續權，再決定接入範圍；既有 G02 不可改紀錄與第二輪凍結輸入也不能因此被默默刪改。這是由已讀條款推得的遷移風險，不表示目前程式已接入 Tiingo 或現在就有刪除義務。

## 5. 結論：哪些建議應降級、刪除或保留

保留 E-02、E-03、E-06、E-07；保留 E-09 的延後批次處理與 E-10 的不新增決定。E-04、E-05、E-08 維持附條件採用，分別完成持股使用權、分析師顯示合約、FINRA 憑證及終端條件後才接入。

E-01 保留「優先詢價」，遷移暫緩至書面釐清 Tiingo 對既有核對資料集、備份及解約保存的限制；$250／月不能當成完整需求已獲授權的總價。依據：[產品方案](https://www.tiingo.com/products/end-of-day-stock-price-data)、[條款 §1.6](https://app.tiingo.com/tos/)。

本次 15 條核心主張均核實，沒有建議因主張被推翻而必須刪除；但任何「訊號研究另登記」都不代表可重開 insider、short interest、VRP 等已否決項目，也不增加第二輪名額。
