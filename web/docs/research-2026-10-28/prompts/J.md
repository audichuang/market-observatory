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

# 任務 J：判斷流水線與 agent 技能（skills）的優化

ID 前綴：`J-`。輸出檔：`/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-28/results/J-pipeline-skills.md`

## 目標

使用者問「判斷的流水線、技能要如何優化」。這裡同時涵蓋兩層：(1) 產生判斷內容的流水線（排程抓資料 → 計算 → 本機 Orca 排程叫 Claude 產生新聞 AI → 寫 D1 → 網頁／App／推播），(2) 維護這套判斷的人機流程與 agent skills（研究回合、事前登記、驗證、策略師表更新、發版前驗證）。

1. **現況盤點**：讀 `web/scripts/ai-batch.ts`、`web/src/server/ai-batch.ts`、`web/src/lib/news-ai.ts`（所有提示詞）、`web/src/server/news-ai.ts`、`web/AGENTS.md`、`.claude/skills/verify/`、`.claude/skills/ios-release/`、`web/docs/research-2026-10-27/`（prompts、results、codex-review、scripts，看上一輪研究怎麼跑的）、`web/docs/forecast.md` 的事前登記流程。可以執行 `orca automations list`（唯讀）看排程名稱開頭「市場觀測室：」的設定；不要修改任何排程。
2. **流水線問題**：可靠性（Mac 關機、Claude 額度用完、輸出驗證失敗時怎樣）、提示詞的 hindsight 與因果敘事風險（10-27 已提 N-01..N-09，看執行了沒）、AI 輸出有沒有任何評估（抽查、黃金樣本、回歸測試）、提示詞版本與輸出可追溯性、成本。
3. **業界與開源做法**：上網查 LLM 金融摘要／新聞解讀的評估方法（faithfulness、attribution、hindsight 控制）、prompt 版本管理與 eval 回歸（例如 promptfoo、OpenAI evals、Anthropic 的評估建議）、Anthropic 或其他廠商公開的金融分析 agent skills／plugins（例如 Anthropic financial services 相關的 Claude plugins／skills，查 GitHub 與官方文件）。只採用有一手來源的。
4. **技能建議**：具體提出要新增或改寫的 skills／排程（例如「研究回合」skill：事前登記 → Codex 平行研究 → 逐條核實 → 帳本入 repo；「策略師表月檢」skill；「AI 輸出月抽查」skill；財報季摘要），每個寫觸發時機、輸入、輸出、驗收方式、和現有 `verify` skill 的關係。也指出哪些現行流程不該變成 skill（太少用或手動更好）。

## 限制

不要修改任何檔案或排程，只寫輸出檔。agent-reach 的 GitHub 管道暫停中；要查 GitHub 直接用 `gh search repos "<關鍵字>" --limit 10 --json fullName,stargazersCount,pushedAt,description` 與 `gh repo view <owner/repo>`，總共不超過 15 次 `gh` 呼叫。

## 停止條件

四部分完成、每個建議都附「為什麼」與驗收方式就停。
