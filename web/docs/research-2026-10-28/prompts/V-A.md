# 任務 V-A：獨立查核任務 A 的研究結果

## 角色

你是查核者，不是作者。另一個模型寫了 `/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-28/results/A-judgment-audit.md`（它收到的題目與作答規則在 `/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-28/prompts/A.md`，先讀）。這些內容是 LLM 產出的二手材料，引用、數字、網址、行號都可能是錯的或幻覺。你的預設立場是「沒親眼看到就不算數」。

## 要做

1. 讀報告的「給整合者的摘要」，找出建議表裡每條建議所依賴的**關鍵主張**（數字、證據等級、論文結論、端點與條款事實、程式碼位置與 bug 描述）。挑最多 15 條，優先挑：支撐高優先建議的、數字精確到小數的、說「已核實」的、看起來最令人意外的。
2. 每條**親自打開一手來源**（論文原文或作者頁、官方文件、條款頁、repo 裡的檔案與行號；端點可以 curl 唯讀測一次），給判定：`已核實`／`部分`（主旨對但細節不符或沒讀到全部）／`被推翻`／`無法核實`（打不開或找不到一手來源），寫下你實際看到的內容（短引原文或行內容）。程式碼類主張要試著反駁：找出擋住該 bug 的程式碼、或確認觸發情境真的會發生。
3. 每條建議逐一對照 `/Users/audichuang/Project/market-observatory/web/docs/forecast.md` 的事前登記規則（含第二輪草稿）與 `/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-27/proposal.md` §6「刻意不做的事」，列出衝突或「重開已否決項目」的情況。
4. 指出證據等級被高估的地方（例如把 bank_claim 寫成 independently_tested、把樣本內寫成樣本外、把橫斷面選股證據套到指數擇時）。
5. 一段話寫最重要的遺漏（報告該查但沒查的）。

## 限制

不要修改 repo 任何檔案，只寫輸出檔。不要對市場歷史資料跑任何新回測或探索統計。agent-reach 的 X／GitHub 管道不要用（另一個任務在用）；GitHub 主張用 `gh repo view`／`gh api` 查，最多 15 次。繁體中文作答。

## 輸出

寫進 `/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-28/verify/V-A.md`：

1. 主張查核表：| # | 主張（短述） | 原報告位置 | 判定 | 實際看到 | 來源網址或檔案:行號 |
2. 與事前登記或排除清單的衝突表：| 建議 ID | 衝突的規則 | 說明 |
3. 證據等級高估清單
4. 最重要的遺漏
5. 結論：哪些建議因查核結果應該降級、刪除或保留

最後回覆給我的訊息只要：輸出檔路徑、判定計數（已核實／部分／被推翻／無法核實各幾條）、被推翻的主張清單、第 5 節原文。
