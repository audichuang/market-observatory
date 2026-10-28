# 任務 A：判斷邏輯全貌審計與 10-27 待辦執行狀態（只讀 repo，不需上網）

ID 前綴：`A-`。輸出檔：`/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-28/results/A-judgment-audit.md`

## 目標

1. **判斷清單**：列出產品所有「做出判斷或顯示判斷用數字」的地方（展望 P(up)／dd5、分析師共識彙總、策略師表、FactSet、點數歸因、RSP 等權對照、VIX、均線、新聞 AI 的 tone 與「為什麼漲跌」、每日推播內容、定投試算與「我的規劃」、觀察名單）。每一項寫：輸入資料、計算位置（檔案:行號）、網頁與 iOS 在哪裡呈現（頁面檔與 Swift 檔:行號）、使用者可能拿它做什麼決策（背景中的 a/b/c/d）、驗證狀態（已計分／只顯示／沒有驗證）、你看到的缺口。
2. **正確性與一致性**：找判斷邏輯裡的 bug、口徑不一致、可能誤導使用者的呈現（例如 consensus 的 7 日新鮮度與輪替 16 檔造成的涵蓋率、權重來源與 as-of、單位或幣別、網頁與 iOS 文字不一致、快取把個人資料混用）。每條附檔案:行號、觸發情境、嚴重度（高／中／低），只報你能用程式碼指出的。
3. **10-27 待辦執行狀態**：`web/docs/research-2026-10-27/proposal.md` §5 的每個 ID（M-01..M-07、D-01..D-05、C-01..C-03、S-01..S-05、ST-01..ST-05、N-01..N-09、U-01..U-05、P-01..P-05）與 `web/docs/forecast.md`「事前登記（第二輪，草稿）」：已完成／部分／未開始，附證據（檔案:行號或 commit，`git log` 可用）。也看 `web/docs/research-2026-10-27/codex-review.md` 推翻了哪些。
4. **買賣進場相關的現況**：「我的規劃」的 `researchBudgetTwd`、`trancheTwd`、`exitConsiderationPct` 在網頁與 iOS 實際怎麼被用（有沒有任何計算、提醒、推播），和 X03／L17 的文字放在哪裡。

## 要讀的檔（自己打開，必要時往呼叫端追）

`web/src/lib/forecast.ts`、`forecast-eval.ts`、`communication.ts`、`consensus.ts`、`strategists.ts`、`analytics.ts`、`snapshot.ts`、`rebase.ts`、`plan.ts`、`push.ts`、`news-ai.ts`、`calendar.ts`、`universe.ts`、`watchlist.ts`；`web/src/server/views.ts`、`outlook.ts`、`jobs.ts`、`push.ts`、`ai-batch.ts`、`repo.ts`；`web/pages/*.tsx`；`ios/MarketObservatory/Views/*.swift` 與 Models；`web/docs/forecast.md`；`web/docs/research-2026-10-27/`。

## 停止條件

四個部分都有表格、每條有檔案:行號證據就停。不需要上網。
