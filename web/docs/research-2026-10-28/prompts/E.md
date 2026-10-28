# 背景（研究前先讀完）

我維護一個個人用、開放註冊的美股觀測站「市場觀測室」（repo：`/Users/audichuang/Project/market-observatory`，網站在 `web/`（Cloudflare Workers + D1，Void 框架），iOS App 在 `ios/`）。使用者主要是**台灣的長期投資人**：以台幣每月定期定額買 S&P 500 ETF，另有一份觀察名單（預設七巨頭，每人最多 30 檔 S&P 500 成分股）。

## 現有功能（判斷相關）

- 總覽：S&P 500 每日收盤、觀察名單對指數的點數歸因（SPY 持股權重推算）、VIX、RSP 等權重對照、每日推播。
- 歷史：走勢與 SMA20／60／200。
- ETF：S&P 500 ETF 比較、台幣定投試算（每月第一個交易日收盤買入，不含配息與稅費）；「我的規劃」：每月定投金額、`researchBudgetTwd` 加碼研究預算（預設 20 萬）分 `trancheTwd` 一筆筆加碼、`exitConsiderationPct` 漲跌達 ±20% 時「檢討」（目前只是文字提醒，沒有任何規則或計算）。
- 展望（`web/src/lib/forecast.ts`，文件 `web/docs/forecast.md`）：S&P 500 價格指數 21 個交易日後高於今天的機率 P(up)，與 21 日內任一收盤比今天低 5% 以上的機率 P(dd5)。只有兩個條件（站上 200 日線、VIX ≥ 30），收縮往 1990 起 expanding 基準率（P(up) 約 64%，dd5 約 16.6%），不重疊 walk-forward、相位平均 Brier skill score、stationary bootstrap、置換虛無門檻。結果：**P(up) 偵測不到 skill**（BSS 0.001 [−0.007, 0.009]）；**dd5 有 skill**（相位平均 BSS 0.038 [0.014, 0.064]）。
- 只當背景、不進機率：策略師年底目標（`web/src/lib/strategists.ts`）、Nasdaq 分析師目標價與 EPS 修正廣度的權重彙總（`web/src/lib/consensus.ts`，權重前 200 檔每 4 小時輪替 16 檔）、FactSet Earnings Insight 由下而上目標價。
- 新聞：Nasdaq 個股新聞；本機 Orca 排程叫 Claude 跑 `web/scripts/ai-batch.ts` 產生標題翻譯、文章重點、「今天為什麼漲跌」（提示詞在 `web/src/lib/news-ai.ts`），經 `/api/admin/ai` 寫入 D1。
- 日曆：財報日（Nasdaq，沒有時用 Zacks 推估）、FOMC（人工維護）。
- 資料來源總表在 repo 根目錄 `README.md`「資料從哪裡來」。

## 現行立場（研究可以質疑，但要用證據）

- **X03／L17**：展望頁固定寫「對每月定期定額：這不是加碼或停扣的訊號」，不提供依風險調整扣款的建議。meta-labeling 或依 P(dd5) 調整部位已永久否決。
- **事前登記**：任何新條件要先寫進 `web/docs/forecast.md` 的事前登記並合併，才能回測；有試驗名額上限、置換虛無門檻、偷看要記錄。第二輪草稿只給 dd5 一個名額（`rvHigh` 取代 `vixStress`）；P(up) 不再給名額。
- 個股：目前**不給任何個股買賣建議**，只顯示歸因、新聞、分析師共識。

## 已經研究過、不要再整理一次

兩輪研究都在 repo 裡：`web/docs/forecast.md`（「2026-10 研究：投行做法與我們的差距」、「判斷流程研究：媒體、資產管理公司、預測科學」兩章）與 `web/docs/research-2026-10-27/proposal.md`（§6「刻意不做的事」是排除清單、§7 是下一輪問題）。已涵蓋：GS／MS／BofA／Citi／JPM／Barclays／WF／Evercore／UBS／Yardeni 怎麼做年底目標與戰術指標；Vanguard VCMM、GMO、Research Affiliates、AQR、NDR、Fidelity、Hussman；Good Judgment、SPF、NY Fed probit；CTA 與 vol targeting；指數層級月頻預測變數（GWZ 2024 等）；指數層級資料源（^SP500TR、DTB3、French RF、FactSet 歸檔、HY OAS）。已否決當指數 21 日方向輸入的：分析師目標價隱含漲幅、策略師年底目標、廣度、VIX 期限結構、VRP、季節性、利率衝擊、信用利差、多速趨勢、CFTC 部位、各種情緒合成指標、估值／ERP／CAPE 擇時、小樣本事件研究。

這一輪要的是**上面沒涵蓋的新地方**。若你的主題和上述重疊，只寫「新證據或與既有結論不同之處」，不要重抄。

## 作答規則

1. 每個數字附日期與一手來源網址。打不開一手來源（付費牆、403）就標「未核實」並寫你實際看到的是什麼（例如二手轉述）。網址去掉追蹤參數（utm_* 等）。
2. 每個「有預測力／有效」的主張只標一個證據等級：`none`／`bank_claim`（機構自述、無樣本外檢驗）／`anecdotal`（軼事或從業者自己的回測）／`academic_is`（學術、僅樣本內）／`academic_oos`／`independently_tested`；並寫結果是正、零或負。註明證據的期限、資產與是否為橫斷面選股。
3. 負面與無效的結果和正面結果一樣有價值。不要灌水，找不到就寫找不到。
4. **不得對任何市場歷史資料（SPX、VIX、個股價格）跑新的回測或探索性統計**：這會污染事前登記。需要數字只能引用文獻；若你認為某個計算值得做，把它寫成「建議事前登記的計算」，附定義與門檻，不要執行。
5. 不要修改 repo 的任何檔案，只寫入下方指定的輸出檔；不要 git commit、不要部署、不要呼叫正式站任何 `/api/admin/*`。對公開上游端點做少量唯讀 curl 確認可以。
6. 用繁體中文寫；論文標題、代號、API 名稱與技術詞保留原文。程式位置寫 repo 相對路徑加行號（例如 `web/src/lib/forecast.ts:146`），並親自打開檔案確認。

## 輸出格式

把完整報告寫進下方「輸出檔」指定的絕對路徑（只寫這個檔）。報告最後一節固定為：

```
## 給整合者的摘要
### 關鍵發現（3–8 條，每條附證據等級與來源）
### 對我們 App 的建議
| ID | 建議 | 服務哪個決策（a 每月定投／b 加碼研究預算／c ±20% 檢討／d 觀察名單個股／資料／流水線／呈現） | 證據等級 | 成本（低／中／高） | 需事前登記？ | 與既有規則或排除清單衝突？ |
### 建議不要做的事與理由
### 未核實、不確定、需要人判斷的地方
```

ID 用下方指定的前綴編號。最後回覆給我的訊息只要：輸出檔路徑，加上「給整合者的摘要」整節原文。

---

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
