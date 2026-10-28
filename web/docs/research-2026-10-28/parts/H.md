# 任務 H：LLM 用於投資判斷的證據與陷阱（影響新聞 AI 與任何 AI 判斷功能）

ID 前綴：`H-`。輸出檔：`/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-28/results/H-llm-evidence.md`

## 為什麼問

我們用 Claude 產生新聞翻譯、文章重點、每家公司與大盤「今天為什麼漲跌」（提示詞在 `web/src/lib/news-ai.ts`，請先讀）。使用者想知道 AI 能不能做更多判斷（例如觀察名單個股的多空摘要、財報解讀），以及怎麼做才可信。

## 要回答

1. **LLM 預測股價／報酬的證據**：Lopez-Lira & Tang（ChatGPT 新聞情緒預測次日報酬；後續版本的衰退）、Pelster & Val、Kim–Muhn–Nikolaev 2024 "Financial Statement Analysis with Large Language Models"（及其批評或重製）、LLM 對財報電話會議的分析、LLM 選股基金或 ETF 的實際表現（若有）。每條標證據等級、期限、是否交易成本後。
2. **偷看與記憶偏差**：Glasserman & Lin 2023、Sarkar & Vafa 的 lookahead bias、"chronologically consistent" LLM 或時間截斷模型的研究；評估 LLM 投資判斷時怎麼避免模型「記得答案」。
3. **LLM 預測能力的一般證據**：Halawi et al. 2024、ForecastBench、Metaculus／Good Judgment 對 AI 的比較；LLM 的校準度。
4. **事後解釋（hindsight）與敘事風險**：用 LLM 解釋「為什麼漲跌」的風險（10-27 已核實 Fischhoff 1975 與 Cutler–Poterba–Summers 1988，不要重抄，只補 LLM 相關的新證據），以及金融摘要的 faithfulness／hallucination 評估（例如 FinanceBench 等）。
5. **對我們的含義**：(i) 現行提示詞具體要改什麼（引用 `news-ai.ts` 行號；先看 10-27 的 N-01..N-09 有沒有已經做）；(ii) 新增 AI 判斷功能（個股多空摘要、財報要點、風險提示）的可行性與必要護欄；(iii) 一套最小的 AI 輸出評估方案（黃金樣本、盲評、出處檢查、回歸測試），可以在本機排程裡跑。

## 停止條件

五題完成就停。論文以原文為準，只讀到摘要的標「未讀全文」。
