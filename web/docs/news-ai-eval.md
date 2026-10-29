狀態：計畫。本輪已移除評估工具；之後重做時改用『AI 輸出附引用片段，檢查只確認片段原樣出現在來源』的設計，不用正則解析數字

# 新聞 AI 離線內容評估計畫

本文件對應研究報告 §6 #16（J-03、H-05、F-02、G-05、J-06）。案例格式、40 案金標、holdout 案例、正式盲評及首輪 baseline 均保留為後續計畫；目前沒有可執行的評估工具或正式閘門，不宣稱金標品質或實際模型成效。

整合 PR 請單獨列出本文件並寫：「目前是計畫、沒有拘束力，凍結前請先讀」。重做及凍結由使用者決定。

## 目的與生效點

只評內容忠實度、消息時間與必要事實涵蓋；不評投資報酬、預測力，不讀歷史行情。案例可帶合成的單日收盤數字，僅用來核對內容與時間，不能反推交易成效。任務為 translate、points、digest、market；不含財報證據卡、tone 定義變更或 AI 月抽查 skill。

未來凍結點為使用者審閱、站長確認金標與簽核紀錄完成，將狀態改為「已凍結」並與首次 holdout hash 登記一起合併的 commit；閘門自此起才約束候選提示詞／模型改動。第一輪只建立 baseline，沒有現行版可比。

## 案例與資料分組

預計一檔一案，UTF-8 JSON，分為 dev 與 holdout；案例 id 在同組內唯一。以下為待確認的案例與人工金標草稿，檔案位置及最終格式待重做時決定。

```json
{
  "id": "synthetic-points",
  "task": "points",
  "group": {"company": "FICT", "event": "earnings-2026q3", "article": "original-wire-id"},
  "tags": ["正文截斷"],
  "input": {"title": "Fictitious revenue $12M", "body": null, "summary": "Revenue was $12M.", "symbols": ["FICT"]},
  "gold": {
    "tone": "neutral",
    "requiredFacts": [{"id": "revenue", "description": "保留營收數字與單位"}],
    "forbidden": [{"kind": "advice", "reason": "不得改成買賣建議"}]
  }
}
```

`input` 預計沿用 `src/lib/news-ai.ts` 的型別：translate 是單一 `EnrichInput`；points 是 `PointsInput`；digest 是 `DigestInput`；market 是 `MarketInput`。消息時間使用該模組的 `before-close`／`after-close`／`unknown` 與 `unconfirmed` 分桶。translate 金標預計必填 `focus` 字串陣列，可空陣列；`category`、`tone` 可選。所有案例至少一個必要事實，每個事實 id 唯一。

`requiredFacts` 是站長應檢查的事實清單；`forbidden` 是該案特定的禁止推論，每條記 `kind` 與 `reason`，由人工核對。kind 預計為 `format`／`number`／`company`／`timing`／`advice`／`inference`。自動檢查只確認 AI 所附引用片段原樣出現在實際來源，不能代替人工忠實度與必要事實涵蓋率判定。

公司、事件分組切 dev／holdout，同篇轉載共用 article 群組，不可跨組。dev 可用於調提示詞，holdout 只用於驗收，不得用來調提示詞。未來需核對兩組的 company／event／article 是否交集，站長另須確認別名、轉載與事件關係。

holdout 預計以 `{"files":{"case-id.json":"sha256"}}` 登記每個原始檔案位元組的 SHA-256，檔名與清單必須完全一致。空登記即未登記；任何案例改動都要重新登記並由站長簽核，在 commit／PR 保存簽核，不能偷偷改保留集。

## 阻擋與人工疑點

未來閘門預計阻擋所有重大錯誤：格式解析失敗、數字無出處、公司認錯、把無法確認在收盤前發布的消息寫成當日收盤原因、買賣建議、個案禁止推論。人工仍須逐句核對，引用片段存在不代表主張受到支持。

人工抽查預計涵蓋完整輸出、缺答案、錯序號、錯欄位及翻譯 focus 與金標的差異，不因解析器略過或截短而漏看原始文字；category／tone 差異保留待人工判定。

AI 輸出預計附上引用片段；檢查只確認片段原樣出現在實際提供給模型的來源，不用正則解析數字或自動換算單位。對象、數字／單位、actual／estimate、GAAP／adjusted 與時間關係由人工核對。摘要被提示詞截去的部分、gold、提示詞的字數指令都不是證據。

人工依 `gold.forbidden` 核對個案禁止推論，不做全域因果詞黑名單。具名來源在收盤前已發布、且原文確有歸因的句子可以保留；盤後或只有日期的消息可陳述事件，不能寫成同日收盤原因。買進、賣出、加碼、減碼、停利、停損等詞須看上下文，引用或否定句不必然是建議；由站長判定是否越界。模型只能標疑點，不能當裁判。

## 計分與門檻

計畫門檻：holdout 的引用檢查失敗與人工重大阻擋合計 0 件；逐句支持率 ≥95%；必要事實涵蓋率 ≥90%；有 baseline 後兩個比例均不得低於 baseline。這是待凍結的維護政策，不是統計保證。以全組分子／分母合併，不平均各案百分比；首輪仍須通過絕對門檻，然後保存為 baseline。

逐句支持率＝人工標為 supported 的句數／全部句數，多句重點仍逐句評。人工標註須逐句保留原文、布林 supported，支持句必填來源 evidence。必要事實涵蓋率＝人工 coveredFacts 的有效唯一 id 數／全組 requiredFacts 數。未完整標註或沒有可評句子時，比率為 null，未來閘門不過。

計畫中的人工標註檔格式：

```json
{
  "reviewers": [{"name": "站長姓名", "role": "owner"}],
  "singleReviewer": true,
  "cases": {
    "synthetic-points": {
      "sentences": [{"text": "營收 $12M。", "supported": true, "evidence": "來源標題／正文原句或欄位"}],
      "coveredFacts": ["revenue"],
      "blockers": []
    }
  }
}
```

人工阻擋格式預計為 `{"kind":"timing","detail":"該消息只有日期，卻寫成收盤原因"}`。評審由站長擔任；可加第二位 `role: "second"`，並將 singleReviewer 設 false。單人評估必須明寫，雙人時先形成共識標註。

## 重現與盲評計畫

後續重做時，評估資料與正式批次分開。任務使用與正式任務相同的輸入欄位，另記 model alias，不含金標；保存案例與提示詞來源 hash、任務 hash、準備時間與模型 alias。模型配置對齊當時正式排程，不把 alias 當作精確模型版本。

生成由操作者用已登入的本機模型工具另行進行，每案只生成一次，不重抽。每輪候選最多改 2 版，每版提示詞、manifest、原始答案與報告都記錄；即使不採用也保留。

答案保留模型原始 JSON 物件或原始回覆字串；每版用新目錄，保留原始答案與人工標註，不覆寫前一輪證據。

盲評預計每案獨立用固定 seed 隨機交換 A／B，seed 寫入紀錄。評審只看輸入、必要事實與匿名答案，A／B 標註的 supported 初值為 null，必須人工填寫，不附版本名稱。版本名稱、每案 A／B 對照及原始答案由協調者另外保管，別給評審；依原始答案對回匿名標註。相同答案兩側標註若矛盾，請站長釐清。dev 合成案例不算正式盲評。

報告預計保留每案引用檢查結果、人工阻擋、疑點、人工分子／分母與評審資料。baseline 須為同組、案例 hash 相同、完整人工評估且通過門檻的報告；候選不能低於它。holdout 未登記、hash 或清單不符時，不作正式驗收。

## 維護與後續工作

N-09 月抽查目前保留固定抽樣與人工逐句核對，交付證據報告與待修正清單。日後評估工具重做後，再決定如何將已確認錯誤改寫為虛構公司、合成新聞的 dev 回歸案例；不修改 holdout，保留原始失敗與修正後報告。

後續仍需使用者審稿決定凍結、站長確認金標／分組與 hash 簽核、正式生成、人工逐句評分及首次 baseline。tone 重新定義保留為後續候選，須等閘門生效後再驗收。本輪沒有凍結或正式 holdout 成效宣稱。
