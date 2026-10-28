# 任務 G：X（Twitter）上的實務者怎麼做數據分析、怎麼檢驗自己的判斷

ID 前綴：`G-`。輸出檔：`/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-28/results/G-x-practitioners.md`

## 工具（只有你這個任務會用 X 管道）

- `agent-reach twitter search "<關鍵字>" --limit 20`、`agent-reach twitter profile <handle>`、`agent-reach twitter tweets <handle>`、`agent-reach twitter thread <連結>`。輸出是一行 JSON，`ok: true` 時內容在 `items`。
- **同一平台兩次搜尋之間至少隔 10 秒**；遇到 `RATE_LIMITED`、`PLATFORM_BLOCKED`、`NEED_LOGIN`、`BUSY` 就停止使用該管道，不換帳號或後端、不反覆重試，改用一般網頁搜尋（`site:x.com`）並在報告寫明。總共不超過 40 次 agent-reach 呼叫。
- Reddit 只用 `agent-reach reddit search "<關鍵字>" --backend public-web --limit 10`（不要登入）；失敗就跳過。
- 也可以讀這些人公開的部落格或電子報原文（例如 Of Dollars And Data、A Wealth of Common Sense、Bespoke、Topdown Charts、Damodaran 部落格、Mauboussin 的公開論文），比 X 貼文更可引用。

## 要調查

1. 以數據分析著稱的帳號（自己用搜尋找，例如 Charlie Bilello、Jeff deGraaf／Renaissance Macro、Liz Ann Sonders、Callum Thomas、Meb Faber、Nick Maggiulli、Ben Carlson、Aswath Damodaran、Jurrien Timmer、Eric Balchunas、Bespoke、Jason Goepfert／SentimenTrader、Warren Pies／3Fourteen、Michael Mauboussin、Corey Hoffstein、Jim Reid／DB）：他們常用哪些數據與圖（盈餘修正、廣度、部位與資金流、季節性、回撤基準率、估值、集中度），怎麼呈現不確定性，有沒有公開且可查的戰績或自我檢討。
2. 圈內對「好的數據分析」的共識與常見陷阱（例如 n 太小的事件研究、條件機率不附基準率、回測偷看、只貼成功案例）。找具體貼文當例子。
3. 有人怎麼用 Claude、Codex、ChatGPT 或 agent 做選股／市場分析的公開分享（工作流程、遇到的問題、被批評的地方）。
4. 觀察名單大型股的集中度風險（例如前 10 大占 S&P 500 權重）在實務圈怎麼被量化與討論。

## 每條引用

寫帳號、日期、貼文或文章網址、原文重點（短引），證據等級一律至少降為 `anecdotal`，除非貼文附了可查的學術或官方來源。

## 結論要給

我們 App 可以借鑑的呈現方式或數據（附可信度）、應避免的做法、以及哪些帳號的做法最接近我們「先講基準率、再講條件」的原則。

## 停止條件

至少 15 位實務者、20 條可引用的貼文或文章，結論完成就停。
