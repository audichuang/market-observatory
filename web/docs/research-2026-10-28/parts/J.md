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
