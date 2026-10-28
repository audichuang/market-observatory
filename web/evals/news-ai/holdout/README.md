# 保留集尚未建立

本票 L2-T10 只交工具與合成 dev 正反例。這裡不放案例，不是金標集，也沒有正式 baseline 或盲評結果。

L2-T11 由使用者審閱 `docs/news-ai-eval.md`，站長建立／審定案例與金標。公司、事件與同篇轉載不得跨 dev／holdout；保留集不得拿來調提示詞。

每個案例是一個本目錄下的 JSON 檔，格式見規格草案。以原始檔案位元組的 SHA-256 登記到 `../holdout.lock.json`：`{"files":{"case-id.json":"完整小寫 SHA-256"}}`，清單必須完整且精確。空登記、漏登、多登或 hash 不符，所有 `--set holdout` 子命令都以 2 拒絕執行。

凍結狀態列與首次 holdout 登記必須在 L2-T11 的同一個合併 commit，並由站長簽核（在該 commit／PR 留下簽核紀錄）；這才是閘門生效點。之後任何 holdout 改動都要重新登記並簽核。工具不代替人工簽核，不自動改 lock。
