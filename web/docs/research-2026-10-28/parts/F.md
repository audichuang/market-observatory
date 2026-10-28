# 任務 F：GitHub 開源的投資分析／AI agent 流水線，別人怎麼做數據分析與評估

ID 前綴：`F-`。輸出檔：`/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-28/results/F-github.md`

## 工具

- agent-reach 的 GitHub 管道目前被暫停（RATE_LIMITED），**改用 `gh`**：`gh search repos "<關鍵字>" --limit 10 --json fullName,stargazersCount,pushedAt,description,url`、`gh repo view <owner/repo>`（讀 README）、`gh issue list -R <owner/repo> --search "<關鍵字>" --limit 10`、`gh api repos/<owner>/<repo>/contents/<path>`（讀特定檔）。GitHub search API 每分鐘 30 次、REST 每小時 5000 次是整個帳號共用的：**總共不超過 60 次 `gh` 呼叫**，兩次 search 之間至少隔 3 秒。也可以用一般網頁搜尋找專案。
- 不要 clone 大型 repo；不要安裝或執行任何下載的程式碼。

## 要調查（至少涵蓋這些，再自己用搜尋補）

- LLM 多代理交易／研究：TauricResearch/TradingAgents、virattt/ai-hedge-fund、virattt/dexter、AI4Finance-Foundation 的 FinRobot、FinGPT、FinRL、FinMem、microsoft/RD-Agent（量化部分）。
- 資料與分析平台：OpenBB、microsoft/qlib、vectorbt、zipline-reloaded、backtrader、bt、Lean（QuantConnect）。
- 預測評估與校準：properscoring、scoringrules、各種 calibration／reliability diagram 套件；point-in-time 資料處理範例。
- Claude Code／Codex 用的金融分析 skills、plugins、MCP server（例如 Anthropic 官方或社群的 financial services plugins、financial-datasets MCP、EDGAR MCP）。
- 個人或小團隊做的市場儀表板（market dashboard、breadth dashboard、S&P 500 attribution）。

## 每個專案寫

stars、最後 push 日期、它做了哪些「判斷」（例如 bull/bear 辯論、風險經理、反思記憶）、資料源、**評估嚴謹度**（有沒有處理 look-ahead、存活者偏差、交易成本、樣本外期間；issues 裡有沒有人指出回測問題——要去翻 issues）、授權（license）。

## 結論要給

1. 這些專案的共通架構與常見缺陷（特別是 LLM 交易代理的回測可信度）。
2. **我們可以採用的具體做法**（例如某個評估套件、某種資料快取或 PIT 設計、某種多代理辯論格式用於觀察名單摘要），每項說明對應到我們哪個檔案或流程、成本、風險。
3. 明確不該抄的東西與理由。

## 停止條件

至少 20 個專案有評估、結論三部分完成就停。
