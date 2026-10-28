狀態：草案，未凍結。使用者審閱後由 L2-T11 改為『已凍結』；草案期間沒有拘束力。

# 新聞 AI 離線內容評估規格草案

本文件對應研究報告 §6 #16（J-03、H-05、F-02、G-05、J-06），並接受 N-09 月抽查的錯誤回填。L2-T10 交付工具、案例格式、草案及 dev 合成正反例，只能證明工具會擋，不能宣稱金標品質或實際模型成效。40 案金標、holdout 案例、正式盲評及首輪 baseline 都由 L2-T11 處理。

整合 PR 請單獨列出本文件並寫：「目前是草案、沒有拘束力，凍結前請先讀」。凍結由使用者在 L2-T11 決定。本票的測試刻意要求第一行保留「草案，未凍結」。

## 目的與生效點

只評內容忠實度、消息時間與必要事實涵蓋；不評投資報酬、預測力，不讀歷史行情。案例可帶合成的單日收盤數字，僅用來核對內容與時間，不能反推交易成效。任務為 translate、points、digest、market；不含財報證據卡、tone 定義變更或 AI 月抽查 skill。

凍結點是 L2-T11 將第一行改為「已凍結」並與首次 holdout hash 登記一起合併的 commit；使用者審閱、站長確認金標與簽核紀錄都須完成。閘門自此起約束候選提示詞／模型改動。第一輪只建立 baseline，沒有現行版可比。草案工具的 exit code 是試算結果，並不表示本規格已生效。

## 案例與資料分組

一檔一案，UTF-8 JSON。dev 在 `evals/news-ai/dev/*.json`（排除 `answers-*.json`），holdout 在 `evals/news-ai/holdout/*.json`，不使用子目錄。案例 id 在同組內唯一。

```json
{
  "id": "synthetic-points",
  "task": "points",
  "group": {"company": "FICT", "event": "earnings-2026q3", "article": "original-wire-id"},
  "tags": ["正文截斷"],
  "input": {"title": "Fictitious revenue $12M", "body": null, "summary": "Revenue was $12M.", "symbols": ["FICT"]},
  "gold": {
    "tone": "neutral",
    "requiredFacts": [{"id": "revenue", "description": "保留營收數字與單位", "pattern": "營收.*\\$12M"}],
    "forbidden": [{"kind": "advice", "pattern": "建議現在買進", "reason": "不得改成買賣建議"}]
  }
}
```

`input` 直接沿用 `src/lib/news-ai.ts` 的型別：translate 是單一 `EnrichInput`（工具包成一則批次）；points 是 `PointsInput`；digest 是 `DigestInput`；market 是 `MarketInput`。消息時間使用該模組的 `before-close`／`after-close`／`unknown` 與 `unconfirmed` 分桶。translate 金標必填 `focus` 字串陣列，可空陣列；`category`、`tone` 可選。所有案例至少一個必要事實，每個事實 id 唯一。

`requiredFacts` 是站長應檢查的事實清單，`pattern` 可省略；自動匹配只計有 pattern 的分母，不能代替人工涵蓋率。`forbidden` 是該案特定的禁止推論，每條填 `kind`、JavaScript Unicode 正規表示式字串 `pattern`、`reason`。不使用 `/…/` 包裝或旗標；錯誤 pattern 拒收。kind 為 `format`／`number`／`company`／`timing`／`advice`／`inference`。

公司、事件分組切 dev／holdout，同篇轉載共用 article 群組，不可跨組。dev 可用於調提示詞，holdout 只用於驗收，不得用來調提示詞。holdout 命令會核對與 dev 的 company／event／article 是否交集。站長另須確認別名、轉載與事件關係，工具只認群組字串，無法替人辨認。

`evals/news-ai/holdout.lock.json` 以 `{"files":{"case-id.json":"sha256"}}` 登記每個原始檔案位元組的 SHA-256，檔名與清單必須完全一致。空登記即未登記；任何案例改動都要重新登記並由站長簽核，在 commit／PR 保存簽核，不能偷偷改保留集。工具不自動寫登記檔。

## 阻擋與人工疑點

重大錯誤一律阻擋：格式解析失敗、數字無出處、公司認錯、把無法確認在收盤前發布的消息寫成當日收盤原因、買賣建議、個案禁止推論。人工發現的重大錯誤與確定性檢查合併，不能用人工標註取消確定性阻擋。

確定性檢查先驗完整輸出 schema，再用既有 `parseEnrich`／`parsePoints`／`parseDigest` 解析。缺答案、錯序號、錯欄位與 parser 失敗皆列 `format`。檢查原始完整文字，不能靠 parser 的略過或截短隱藏錯誤。翻譯用原始 focus 集合比對金標；不同列 `company`，category／tone 差異只標待人工看。

答案中帶 `%`／`$`／小數點／億／萬／B／M 的數字須能在實際提供給模型的來源內容或單日數值找到相同值。忽略千分位，允許較少位數的四捨五入與 B／M／億／萬的等值換算；保留正負號與百分比／貨幣的區別。摘要被提示詞截去的部分、gold、提示詞的字數指令都不是證據。找不到列 `number`。數字相同不代表對象、actual／estimate、GAAP／adjusted 正確，仍需個案 pattern 與人工核對。百分點／百分比等合理換算若誤擋，要修檢查器，不得改 holdout。

`gold.forbidden` 命中依 kind 阻擋，不做全域因果詞黑名單。具名來源在收盤前已發布、且原文確有歸因的句子可以保留；盤後或只有日期的消息可陳述事件，不能寫成同日收盤原因。全域買進、賣出、加碼、減碼、停利、停損只標「待人工看」，因為引用或否定句不必然是建議；個案 pattern 或站長判定為建議才阻擋。模型只能標疑點，不能當裁判。

## 計分與門檻

正式門檻：holdout 的確定性＋人工重大阻擋合計 0 件；逐句支持率 ≥95%；必要事實涵蓋率 ≥90%；有 baseline 後兩個比例均不得低於 baseline。這是維護政策，不是統計保證。以全組分子／分母合併，不平均各案百分比；首輪仍須通過絕對門檻，然後保存為 baseline。

逐句支持率＝人工標為 supported 的句數／全部句數。工具以 `。！？!?` 或換行分句，小數點不切句；多句重點仍逐句評。人工標註須逐句保留原文、布林 supported，支持句必填來源 evidence。必要事實涵蓋率＝人工 coveredFacts 的有效唯一 id 數／全組 requiredFacts 數。未完整標註或沒有可評句子時，正式比率為 null、閘門不過；自動 pattern 的 referenceCoverage 永遠只當參考。

一般人工標註檔格式：

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

人工阻擋格式為 `{"kind":"timing","detail":"該消息只有日期，卻寫成收盤原因"}`。評審由站長擔任；可加第二位 `role: "second"`，並將 singleReviewer 設 false。單人評估必須明寫，雙人時先形成共識標註，工具不投票。閘門只驗資料格式，無法驗證填表人的身分或來源真實性。

## 離線操作與重現

所有命令在 `web/` 跑。runner 只讀本機檔、產生任務與計分，不登入、不打網路、不呼叫模型、不匯入正式批次腳本。`--prompts` 只能指向可信的本機 `news-ai.ts`，用於舊 commit 的提示詞（需保留其本機相依檔）；它會執行該模組程式碼。

```sh
node scripts/eval-news-ai.ts prepare --set dev --out /tmp/mo-eval-dev
node scripts/eval-news-ai.ts prepare --set dev --out /tmp/mo-eval-old --prompts /tmp/old-tree/web/src/lib/news-ai.ts
node scripts/eval-news-ai.ts score --set dev --answers evals/news-ai/dev/answers-bad.json --out /tmp/mo-eval-bad.json
node scripts/eval-news-ai.ts score --set dev --answers /tmp/mo-eval-dev/answers.json --labels /tmp/mo-eval-dev/labels.json --out /tmp/mo-eval-dev/report.json
node scripts/eval-news-ai.ts blind --set dev --a /tmp/current-answers.json --b /tmp/candidate-answers.json --seed 1028 --out /tmp/mo-eval-blind
node scripts/eval-news-ai.ts score --set dev --answers /tmp/candidate-answers.json --labels /tmp/mo-eval-blind/labels.json --key /tmp/mo-eval-blind/key.json --baseline /tmp/current-report.json --out /tmp/candidate-report.json
```

prepare 產生正式任務相同欄位的 `tasks.json`／`tasks.md`，另加 model alias；不含金標。`manifest.json` 保存案例與提示詞來源 hash、任務 hash、準備時間與模型 alias。translate＝haiku，其餘＝sonnet，與正式排程相同。生成由操作者用已登入的本機模型工具另行進行，每案只生成一次，不重抽。每輪候選最多改 2 版，每版提示詞、manifest、原始答案與報告都記錄；即使不採用也保留。工具不替操作者執行或保證這個流程。

答案檔是 `{ "case-id": 模型原始 JSON 物件或原始回覆字串 }`。缺答案列格式阻擋，多出別組 id 則拒收。prepare／blind 檔案不覆寫，請每版用新目錄。score 可覆寫指定的 report；保留原始答案與人工標註。

盲評每案獨立用 uint32 seed 的固定 LCG 隨機交換 A／B，seed 寫入輸出。`blind.json` 只有輸入、必要事實與匿名答案，`labels.json` 是 A／B 標註範本（supported 初值 null，必須人工填寫）；兩份公開檔都不含版本名稱。`key.json` 記版本名稱、每案 A／B 對照及原始答案，由協調者另外保管，別給評審。score 搭配 --key 依原始答案對回匿名標註；換掉答案就拒收。相同答案兩側標註若矛盾，請站長釐清。這裡只交付盲評工具，dev 測試不算正式盲評。

score 報告保留每案阻擋、疑點、參考涵蓋率、人工分子／分母與評審資料。--baseline 只接受同組、案例 hash 相同、完整人工評估且通過門檻的報告；候選不能低於它。exit 0＝工具檢查／試算通過；exit 1＝閘門試算未過（含缺人工標註）；exit 2＝輸入、參數或 holdout 登記錯誤。任何 --set holdout 命令在未登記、hash 或清單不符時，都先拒絕，不產生評估結果。

## 維護與後續工作

N-09 每月固定規則抽查 10 篇 digest 的錯誤，回填 dev 作回歸案例，不修改 holdout。月抽查 skill 屬研究報告 §6 #18，另票實作。新錯誤先加會失敗的 dev 測試，再修提示詞或檢查器；保留原始失敗與修正後報告。

L2-T11 還需使用者審稿決定凍結、站長確認金標／分組與 hash 簽核、正式生成、人工逐句評分及首次 baseline。tone 重新定義是後續 L2-T12 的候選，須等生效後走閘門。本票沒有凍結或正式 holdout 成效宣稱。
