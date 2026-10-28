# V-K：任務 K 研究結果獨立查核

查核日：2026-10-28（Asia/Taipei）。先讀 `web/docs/research-2026-10-28/prompts/K.md`，再由 `results/K-products.md:295` 起的摘要及 K-01～K-06 回溯依據，選取下表 15 條關鍵主張。原報告位置均指 `web/docs/research-2026-10-28/results/K-products.md`；程式行號依本機 HEAD `99066fd3ad63ec7b040f6fd447f255b2d3c3964a`。

**結果：已核實 14／部分 1／被推翻 0／無法核實 0。** 六條建議的描述性版本可保留；主要需要修正國泰費率引用，並把完整資料管線的落地優先序與授權、報價查核綁在一起。「已核實」只代表所選主張有一手依據，不代表操作過產品、廠商模型有效或已取得資料使用權。本次未登入付費產品、未呼叫正式站管理端點、未執行任何市場歷史計算；GitHub API 呼叫 0 次，未使用 agent-reach。

## 1. 主張查核表

| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
| --- | --- | --- | --- | --- | --- |
| 1 | SA Quant 的等權 Strong Buy－Strong Sell，下一個月 six-factor alpha 1.52%、t=3.50；報酬期 2016-01～2022-12 | :89、:245、:300 | 已核實 | 作者版封面為 January 2025；Table 3 Panel A 最後一欄確為 1.52%，下一列括號為 3.50。表註區分組合形成期 2015-12～2022-11 與下一個月報酬期，原報告沒有把兩者弄反。這是個股多空組合。 | [作者 PDF，印刷頁 52，Table 3](https://russelljame.com/quant_1_23_25.pdf#page=53) |
| 2 | SA 的 `academic_oos` 有作者依據，但回填不是當時發布；不能用來擇時指數 | :89–91、:245、:300、:329 | 已核實 | 頁 9 註 9 明寫「all the estimates are out-of-sample」，並舉 2015 評等僅用 2015 年以前資料；同註承認回填沒有即時提供給使用者。正文把用途限於 sector 內選股，排除 sector picking／market timing；也說公式不公開。保留作者所述的 OOS 等級，不能升為獨立重現。 | [作者 PDF，印刷頁 9、註 9](https://russelljame.com/quant_1_23_25.pdf#page=10) |
| 3 | 現有規劃只有預算、門檻與備註，沒有 K-01 所需的逐次檢討帳本或 ±% 觸發器 | :257、:271、:311、:330 | 已核實 | `etfs.tsx:195` 寫「只是規劃，不是持倉或交易紀錄」；`:222` 只算預算可分幾次並插入門檻文字。反證檢查：現有 textarea 能記手動備註，但 `savePlan` 透過 settings upsert 覆寫同一份內容，沒有逐次紀錄；`planIssue` 只驗範圍。另有 `bigMoves` 推播，但比較的是個股單日報酬，沒有讀取 `exitConsiderationPct`，不能反駁這個缺口。 | `web/pages/etfs.tsx:195`、`:211`、`:222`；`web/src/server/views.ts:257`；`web/src/server/repo.ts:319`；`web/src/lib/plan.ts:17`；`web/src/lib/push.ts:62` |
| 4 | 券商、手續費與換匯成本仍是待定事項，K-02 補的是結構化假設 | :258、:272、:312 | 已核實 | `DEFAULT_PLAN.notes` 明列「交易券商與手續費、換匯成本」；PlanSchema 沒有獨立券商、交易模式、費率或優惠有效日欄位。反證檢查：ETF 表其實已顯示 `netFeePct`／`grossFeePct`，所以缺口不能寫成「完全沒有費用資料」；K-02 所指的券商執行成本欄位確實尚缺。 | `web/src/server/views.ts:224`、`:231`、`:244`；`web/pages/etfs.tsx:104` |
| 5 | 既有台幣歷史定投試算沒有納入配息、交易手續費、換匯價差與稅；K-06 應另列假設 | :259、:276、:316 | 已核實 | 頁面 `:187` 逐項寫出限制。反證檢查不只看註解：views 將 ETF 收盤乘當日或之前最近匯率後呼叫 `simulateDca`；後者以金額除價格累加 units，沒有券商費率或稅的輸入，也沒有股息現金流。已有基金費用率展示不等於已模擬交易成本。 | `web/pages/etfs.tsx:187`；`web/src/server/views.ts:294`；`web/src/lib/analytics.ts:157`、`:165` |
| 6 | 國泰定期定額買進 US$0.1／筆、ETF 賣出 US$3、個股賣出 0.08%，並附 2026-12-31 優惠期限 | :217、:272、:312 | 部分 | 三項費率可在正式費用表核對：定額買進 0.1 美元，定期庫存 ETF 賣出 3 美元，股票賣出比照一般股票；一般股票 0.08% 列優惠至 2026/12/31。但原引用 `usstock/index` 開到的主活動日期是 2024/5/30～7/31，數字須循其連結到正式費用表。費用表把期限明列在 0.08% 等費項旁，沒有逐項證明 0.1／3 美元共用同一到期日；DCA 入口雖列整體優惠至 2026/12/31，也不能替代逐費項口徑。應換直接引用並分列期限，不把整組視為同一優惠。 | [原活動入口](https://istockapp.cathaysec.com.tw/Marketing/usstock/index)；[正式費用表，「一般股票」「定期定股(額)」](https://www.cathaysec.com.tw/cathaysec/Products/TradeFee/USS.aspx)；[DCA 入口](https://istockapp.cathaysec.com.tw/Marketing/DCA/) |
| 7 | 國泰「智慧加減碼」與季均價規則位於台股章節，美股適用未核實 | :213、:284、:302 | 已核實 | 官方標題就是「台股定期定額 智慧加減碼功能」，後文才說用 60 個交易日均價及指定日之前一交易日收盤比較。同頁另有美股定期定額區塊；這不足以把台股規則移植給美股。核實的是章節歸屬，不是證明全公司美股產品永遠沒有此功能。 | [國泰 DCA，「台股定期定額／智慧加減碼功能」](https://istockapp.cathaysec.com.tw/Marketing/DCA/) |
| 8 | 富邦複委託與定期定額分開庫存，同日賣同標的分別收費；定期買進頁沒有統一費率數字 | :227、:272、:302 | 已核實 | 「台美股定期定額」段寫買進優惠、無最低費，詳情洽分公司，賣出按客戶原複委託費率；註文明寫「複委託及定期定額為獨立庫存系統」且同日同標的賣出分開計費。不能拿一般複委託或其他舊活動費率填入。 | [富邦官方活動頁，「台美股定期定額」](https://www.fubon.com/securities/open-now/index.html) |
| 9 | Fiscal.ai 分 as-reported／standardized，數值可追到原申報表圖片與 PDF，適合 K-03 來源追溯 | :141、:145、:273、:303、:313 | 已核實 | API Introduction 的 Financials & Ratios 明列兩種資料；Sourcing to Filing 說每個數據點連至來源表格圖片與 PDF。關鍵補充：該功能標成「Add-on to Financials & Ratios」，不是僅有 API 帳號就全部包含。這核實的是文件能力，沒有測真實回應或零售終端。 | [Fiscal.ai API，Financials & Ratios／Sourcing to Filing](https://docs.fiscal.ai/docs/introduction) |
| 10 | Fiscal.ai 的 Agentic 與 Street Consensus 不同，並能按會計期間對齊，支撐 K-03／K-05 分欄與快照 | :141、:273、:275、:303、:313、:315 | 已核實 | Estimates 段把前者定義為 guidance、統計模型、AI estimate 組合，後者為第三方 Wall Street 共識；兩者都用 financials 的 `periodId`。History 註記又限定 Agentic 在 2026 年 8 月下旬以後的已公布期間才保留事前預估，更早只有 actual。原文的「前瞻留存」可保留，不能據此推定已有完整多年事前版本。 | [Fiscal.ai API，Estimates／History](https://docs.fiscal.ai/docs/introduction) |
| 11 | Koyfin 公開文件確認 portfolios、ETF holdings、filings／transcripts，可作 K-04／K-05 流程參考 | :57、:274–275、:299、:314–315 | 已核實 | 價格頁 Free 欄列「My Portfolios」；Plus 欄列「ETF holdings」及「Press releases, filings & transcripts」。只核實這些入口與功能存在；頁面沒有證明 K-04 重疊算術會改善報酬，也沒有驗收到逐欄修訂比較畫面。K 的相應建議已標設計推論。 | [Koyfin 價格頁，Free／Plus 功能](https://www.koyfin.com/Pricing/) |
| 12 | Simply Wall St 的 Notes／Alerts 可作 K-01 手動研究連續性的參考 | :111、:271、:311 | 已核實 | 方案頁「All plans include」確有「Stock Notes & Alerts」與週度組合更新。這支持紀錄及提醒功能的存在，不等於其具備 K-01 全套反證欄位，也不證明投資效益；K-01 的欄位設計是作者推論。 | [Simply Wall St 方案頁](https://simplywall.st/portal/plans) |
| 13 | SWS 說分析師目標價較接近時較可靠；只能標 `bank_claim`，不是合格 OOS 證據 | :113、:246 | 已核實 | 官方 Valuation 文件在 Analysts Price Targets 下說做過資料分析，預估較接近則較可靠；Confidence 用最高、最低預估相對共識的 15% 範圍判讀。該段沒有交代凍結樣本外設計、基準比較或誤差表，因此「廠商自述正結果」的標法恰當。不能把 15% 直接當本 App 門檻。 | [SWS Valuation 方法，Analysts Price Targets](https://support.simplywall.st/hc/en-us/articles/4751563581071-Understanding-the-Valuation-section-in-the-company-report) |
| 14 | Portfolio Visualizer 有現金流匯入與費用建模，可參考 K-06 的假設拆分 | :151、:276、:299、:316 | 已核實 | Documentation 的 Importing Cashflows 說正值為投入、負值為提款，可指定月／年頻率；Modeling Advisor Fees 列定額、比例、級距等，並說明扣費順序。前者是 Monte Carlo 的匯入功能，後者用於 portfolio backtesting；不是一套已驗證的台灣券商費稅模型。本次只讀文件，沒有執行工具。 | [Portfolio Visualizer Documentation，Importing Cashflows／Modeling Advisor Fees](https://www.portfoliovisualizer.com/faq) |
| 15 | testfol 明確分歷史已發生路徑與 Monte Carlo 模型路徑，兩者不預測未來報酬 | :163、:276、:286、:301、:316 | 已核實 | start 頁 FAQ 說 backtest 套用一條已觀察報酬序列，Monte Carlo 創造多條模型路徑，並明寫「neither predicts future returns」。工具目錄另列 Tactical DCA；存在工具不能替 X03 的相反做法背書。 | [testfol 導覽，Backtesting／Monte Carlo FAQ](https://testfol.io/start/) |

程式類反證檢查以目前 source 與引用路徑為限，沒有啟動 App 或檢查正式 DB。上表第 3～5 條是功能缺口的靜態核對，不是宣稱發生了錯誤成交、遺失紀錄或錯誤推播。原報告 `etfs.tsx:194` 的引用相差一行，實際免責文字在 `:195`，不影響主旨。

## 2. 與事前登記或排除清單的衝突表

逐條對照第一輪事前登記、第二輪草稿與 proposal §6。第二輪依 `web/docs/forecast.md:118` 仍是未合併不得執行的草稿；不能把 K 表中的「需要事前登記」讀成已取得新的研究名額。

| 建議 ID | 衝突的規則 | 說明 |
| --- | --- | --- |
| K-01 | 無直接衝突；邊界為 `forecast.md:114` L17／X03、`proposal.md:425` 永久否決部位／扣款調整 | 手動理由、反證與檢討紀錄沒有依市場調部位。自動提醒若只是使用者自訂的觀察門檻，也不是 dd5 的 D4 標籤；須標明參照資產、價格、幣別與口徑，不能改寫成停利停損、加碼指令或模型退場規則。未重開已否決項目。 |
| K-02 | 無直接衝突；對照 `forecast.md:52` D2、`:113–114` L16／X03，`proposal.md:434` TWD／含息機率限制 | 保存費率和計算假設現金流不改標籤，也不依波動調扣款。不得由此順帶計算 TWD／含息預測機率或重新比較扣款策略；原文已限制純算術，符合邊界。第 6 條查核要求修引用，屬來源缺口。 |
| K-03 | 無直接衝突；對照 `forecast.md:11` 共識只作背景、`:21–24` 已放棄輸入、`:142` R2-0、`:159` 唯一名額；`proposal.md:411`、`:416–417`、`:433` 排除輸入 | filing／guidance／estimate 分列是資料呈現，沒有轉為買賣分數。表中「新預測研究須登記」不是允許重測已排除變數：第二輪只有 `rvHigh` 的 dd5 名額，P(up) 要另開輪次；敘事、情緒或分析師目標換包裝也不取得名額。K 的原方案本身沒有重開。 |
| K-04 | 無直接衝突；對照 `proposal.md:429` 不用 Select Sector ETF × 權重推產業點數，以及 `forecast.md:114` X03 | 使用者輸入的假設權重做公司重疊加總，與產業點數歸因不同；原文也禁止配置建議。現有資料管線明確是 SPY（`web/src/lib/sources/ssga.ts:4`、`web/db/schema.ts:28`）；若代替 VOO／IVV，必須保留近似標示，不能稱實際持有 ETF 的精確穿透。未重開被否決的產業點數算法。 |
| K-05 | 無直接衝突；對照 `forecast.md:111–112` L09／G02、`:149` R2-6、`:718` X01，`proposal.md:417`、`:424–425` | 公司的前瞻資料快照不是預測分數；逐欄顯示修訂沒有投票合成。若以後拿它評分模型，才須遵循樣本內／回溯／即時紀錄分開、版本與發布資格規則；不能把事後抓到的舊值稱 live。也不能藉變更次數產生未登記的訊號。原文已禁止變更計數投票，沒有重開。 |
| K-06 | 無直接衝突；對照 `forecast.md:52`、`:113–114` D2／L16／X03、`:151` R2-8 延後，`proposal.md:418–420`、`:425`、`:434` | 使用者輸入報酬、匯率、費用，做確定性現金流算術，不等於估計 TWD 上漲機率或 EWMA 首達機率。原文排除成功機率、歷史挑最佳時點與 tactical DCA。若改成依行情建議加碼、歷史／bootstrap 績效比較，就超出原建議且須重新處理登記及排除規則。未重開。 |

本表的「無直接衝突」只針對 K 原文的最小交付與明示限制。先登記是必要程序，不會自動撤銷排除項目，也不會讓本輪多出 P(up) 或第二個 dd5 名額。

## 3. 證據等級高估清單

1. **本次抽查沒有查到明確的等級誤升。** SA 可保留 `academic_oos`，限定作者描述的回填構造；SWS 的可靠度敘述可保留 `bank_claim`。原報告沒有將兩者升成 `independently_tested`，也已排除把個股橫斷面結果套到指數擇時。依據見查核表第 1、2、13 條。
2. **功能矩陣的欄名仍容易給過強印象。** `K-products.md:22` 把時間戳放進「不確定性呈現」；時間戳只顯示資料新鮮度，不是預測誤差或校準。`:24`、`:31–32` 的策略測試／使用者回測也不能算平台預測戰績。原文已有「非機率」「非有效性證明」等限制，整合時仍應保留，不能只摘取 ●。這是呈現層的誤讀風險，不另判為被推翻。工具與路徑差別可由 [PV 文件](https://www.portfoliovisualizer.com/faq)、[testfol 方法說明](https://testfol.io/start/)直接核對。
3. **六條產品建議仍只到 `none`。** 官方功能文件支持「有這個功能」，不支持「能改善本 App 使用者的報酬或決策品質」。K 已明寫是設計推論，優先序也不是經過使用者實驗驗證的成效排名。來源追溯不會自動讓 AI 預估變成已校準；[Public 原文](https://help.public.com/en/articles/9354354-what-is-alpha)也確實警告回應可能不準確，不能作為投資決策基礎。

## 4. 最重要的遺漏

**缺的是把「值得學的功能」接到本 App 可取得、可保存並可對註冊使用者顯示的資料授權與費用。** K-03／K-05 以 Fiscal.ai 為主要參考，卻沒查完整管線的授權範圍與報價；官方 API 已把 Sourcing to Filing 標為加購，且明示事前 estimate 歷史的起點（查核表第 9～10 條）。本次另開到 [Fiscal.ai Terminal Terms，2026-09-04 版](https://fiscal.ai/terms-of-service/)：§2.2(h) 明寫程式擷取須另有 Data Feed API／MCP 訂閱，並以 Order Form 界定權利；這不能證明本 App 已取得 API 資料的公開展示或長期快照保存權。我沒有取得其 API 合約或報價，因此不推定可用、不可用或費用數字。報告應把直接連往 SEC／公司 IR 的最小版本，與購買第三方財報／共識資料、保留版本並供多人使用的完整版本分開估算，否則 K-03／K-05 的排程與成本仍不夠具體。

## 5. 結論：應降級、刪除或保留的建議

- **K-01、K-02 保留高優先。** 先做手動紀錄與使用者成本假設；K-02 改引國泰[正式費用表](https://www.cathaysec.com.tw/cathaysec/Products/TradeFee/USS.aspx)，逐費項記有效日。
- **K-03、K-05 保留方向，完整資料管線降為待授權與報價查明後排程。** 可先做來源連結與手動紀錄；可追溯不等於資料可免費供 App 使用，授權仍須核對。[Fiscal.ai 條款](https://fiscal.ai/terms-of-service/)
- **K-04 保留假設重疊預覽。** 使用 SPY 權重時須標近似，不能當成 VOO／IVV 的精確持股。
- **K-06 保留後續順位。** 限使用者假設算術，不加入成功機率、最佳加碼時點或歷史策略搜尋。
- **本次沒有整條建議需要刪除，也沒有被推翻的抽查主張。** SA 的 `academic_oos` 可保留既有限制（[作者原文](https://russelljame.com/quant_1_23_25.pdf)）；應撤下的是國泰舊活動入口可直接支持整組現行費率與共同到期日的引用方式。六條建議均維持 `none`，不升格為投資績效證據。
