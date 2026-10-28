# 任務 E：個股／ETF／權重／基本面／新聞／總經資料源的替代與擴充

ID 前綴：`E-`。輸出檔：`/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-28/results/E-data-sources.md`

## 為什麼問

現在主力是 Yahoo chart（條款禁止未經許可的自動收集）、Nasdaq 非官方端點與 SSGA 持股檔。10-27 已盤點過指數層級的資料（^SP500TR、DTB3、French RF、FactSet 歸檔、HY OAS），不要重複。這次看個股與其他層級。網站跑在 Cloudflare Workers（每次執行有子請求上限、不能用本機瀏覽器 cookie），開放註冊、會公開顯示數字。

## 要盤點的類別

1. 個股與 ETF 日線替代：Stooq、Tiingo、Alpha Vantage、Polygon（現名 Massive）、EODHD、Financial Modeling Prep、Finnhub、Nasdaq Data Link、Cboe 官方、交易所官方資料。
2. 基本面：SEC EDGAR `companyfacts`／`frames` XBRL API（point-in-time 怎麼做：用 filed 日期）、財報 8-K。
3. 內部人交易 Form 4、13F（EDGAR 全文與結構化資料集）。
4. 分析師預估與評等：Nasdaq（現用）、Zacks、FMP、Finnhub 等的免費層。
5. 指數權重：SSGA SPY（現用）、iShares IVV 持股 CSV、Vanguard VOO；官方 S&P 權重的取得成本。
6. 放空資料：FINRA 雙月 short interest、Reg SHO 每日放空量（FINRA API）。
7. 選擇權：免費的隱含波動或財報隱含波動來源（Cboe delayed quotes 等）與條款。
8. 財報日曆與電話會議逐字稿的合法來源。
9. 總經：FRED／ALFRED（vintage API，需要 key）、BLS API、BEA、Treasury Fiscal Data、Atlanta Fed GDPNow、聯準會 H.15；以及經濟數據公布日程的官方來源（BLS release calendar 的 ICS？）。
10. 新聞：Nasdaq（現用）、SEC 新聞稿 RSS、GDELT、公司 IR RSS。

## 每個來源寫

端點網址、需不需要 key、免費額度與速率限制、歷史起點、更新時間與延遲、是否 point-in-time（或只有修訂後版本）、**條款是否允許公開顯示或再散布**（附條款原文連結與條款版本日期）、對 Cloudflare Worker 的友善度（UA 擋不擋、會不會轉址、回應大小）。對不需要 key 的前幾名候選，用 curl 實測一次（記下指令、HTTP 狀態、是否轉址、回應前幾行的欄位名稱）。

## 結論要給

每一類的「首選 + 備援」，以及要替換掉 Yahoo 的哪些用途最划算；標出哪些只適合本機回補（`web/scripts/`）而不適合 Worker 每日抓取。

## 停止條件

十類都有結論、前幾名候選有 curl 實測就停。
