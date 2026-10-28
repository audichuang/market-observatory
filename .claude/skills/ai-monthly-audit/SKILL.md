---
name: ai-monthly-audit
description: 抽查市場觀測室的 AI 摘要、翻譯與文章重點，逐句對照當批輸入並產出可追溯報告。用於每月抽查、使用者回報摘要／翻譯錯誤或「今天為什麼漲跌」歸因／消息時序有誤（即使沒說 AI 或月抽查）、回執出現 partial／rejected、換模型或改提示詞上線後的內容抽查。只問每日 AI 排程有沒有跑不觸發；要求改提示詞（包括減少「原因不明」比例）走 web/docs/news-ai-eval.md 的離線評估，不啟動月抽查。
---

# AI 月抽查

完成於 `web/docs/ai-audit/<YYYY-MM>.md` 的證據報告與合成回歸案例草稿；缺少證據的項目明列不可判定，也算完成紀錄。抽查不是內容更正或提示詞調整授權。

## 1. 固定抽樣，先記覆蓋

確認使用者要查的年月。在 repo 的 `web/` 跑下列唯讀腳本（入口：`web/scripts/ai-audit-sample.ts`），`--out` 指向檔案路徑，放在批次目錄以外、已存在的暫存目錄底下：

```sh
node scripts/ai-audit-sample.ts --month <YYYY-MM> --out <檔>
```

腳本預設讀跑 Orca 那台 Mac 的主 checkout `web/.ai-batch`；在 worktree 執行也不改讀 worktree 的空目錄。資料在另一台機器時，取得當批本機歸檔的唯讀副本後用 `--batches <目錄>` 指定，報告記來源與缺口。保留原始歸檔，不啟動新批次補證據。

使用者回報的個案先轉成回執鍵，將 `--case <回執鍵>` 加在同一次抽樣指令，可重複指定。例如 11/18 NVDA 的公司摘要對應 `digest:NVDA:<YYYY>-11-18`；年份待確認時先記待定位，不猜鍵。另兩種鍵為 `translate:<newsId>`、`points:<newsId>`。

先記 `coverage` 中沒有批次、partial、failed、unknown 的交易日及 `undatedBatches`，再看內容。整批狀態來自 `receipt.run.status`（ok／partial／failed），rejected 是回執項目，不是整批狀態；Orca completed 不能代替回執。

把輸出檔的完整 JSON **原樣**附進報告，保留 `rules`、三類 `population` 全集、`samples`、`shortages` 與 `problemCases`。沿用腳本看內容前已固定的 hash 排序及 digest 補格規則：digest 10 篇、translate 與 points 各 10 則；不足就全列並記不足，空母體或 exit 0 都不表示內容通過。只採 accepted 的實際寫入證據，不自行重抽或換樣本。

## 2. 找回當批證據，建立主張帳

對每個樣本與另列的問題案例，以輸出的 `source.directory`、`runId`、`taskId` 定位：L2-T2 歸檔在 `<批次根>/<kind>/runs/<runId>/`，最新一批可能仍在 `<批次根>/<kind>/`。唯讀檢視 `tasks.json`、`answers.json`、`receipt.json` 與 L2-T7 的 `manifest.json`，按 task meta 與回執鍵對回答案；翻譯批次需對到該新聞的列，不能把同批別篇當證據。

以 `tasks.json` 的 prompt 內**實際提供給模型的輸入**為判定範圍。將輸入段落依出現順序從 1 編號，欄位型輸入註明欄位；提示詞指令本身不是新聞證據。新聞被截斷的部分不算已提供。找不到當時輸入就標不可判定，列缺的檔名／段落；不用今天改版的文章、搜尋結果或事後行情補成當時證據。

把自家 AI 輸出逐句拆成主張；同句含可分開核對的事實時分列，保留句序與主張序。每條都記：AI 句子／主張、判定、理由、證據定位（runId／回執鍵／taskId／輸入段落序號或欄位）。沒有支撐段落時定位仍保留，段落欄寫「無」或「缺檔」，不能編號假證據。

| 判定 | 使用條件 |
| --- | --- |
| supported | 當時輸入直接支持對象、數字／單位、原意及時間關係。 |
| contradicted | 當時輸入明確與主張矛盾；指出矛盾所在。 |
| unsupported | 當時輸入可讀，但未提供該主張或因果歸因的依據。 |
| 不可判定 | 當時輸入或必要證據缺失，無法判讀；不當作 supported。 |

## 3. 列重大錯誤與重現條件

以下七類皆為重大錯誤：錯公司、錯數字或單位、反轉原意、無出處因果句、用盤後消息解釋收盤、未知時間當盤前、投資建議越界。只陳述盤後事件不等於收盤歸因；時間與因果都依當時輸入判讀。資料不足時保留疑點與不可判定，不把使用者指控直接當已證實錯誤。

逐條記錯誤類型／嚴重度、關聯主張、是否能重現（是／否／受限與原因），以及是否回填成案例（候選／已寫草稿／已同意 commit／不回填與原因）。核對 manifest 的 `promptSourceSha256`、`requestedModel` 有無當批值，並記 `gitCommit`、`gitDirty`、`tasksSha256` 及檔案缺口；只有 hash、取不回當版提示詞時仍須寫重現受限。requestedModel 可能只是 alias，不能當作精確模型版本，也不保證同樣輸入逐字重現；本次未重新生成要明記。

missing、rejected、unavailable 與使用者回報一律另列「問題案例」，不混入固定 10 篇 digest 或另兩類樣本的名額、分母；沿用腳本去重與原因。accepted 全集仍保留其寫入紀錄，問題案例與抽樣結論分開說明。

## 4. 交付報告

寫 `web/docs/ai-audit/<YYYY-MM>.md`，包含：

1. 覆蓋：月份、抽查日、程式 commit、批次根來源、交易日缺口與不可判定批次。
2. 抽樣全集與規則：實際指令及腳本 JSON 原樣輸出，含樣本、不足與問題案例。
3. 主張帳：所有樣本的逐條判定與定位；問題案例另節建帳，不併入樣本計數。
4. 錯誤彙總：七類重大錯誤的件數、關聯主張、不可判定數、每條重現條件與回填決定。
5. 待修正清單：已證實錯誤、待補證據、候選處置與待使用者決定的更正；不直接改已發布內容。
6. 回填的案例：合成案例 id／路徑、對應失敗樣態、驗證結果與使用者是否同意 commit；未回填也記理由。

新聞原文不抄進 repo，只寫本機檔案與段落定位（授權見研究報告 #17）；自家 AI 輸出可引用。沒有批次或已被手動清掉的歸檔明記不可判定，不能以排程狀態補推。全部通過只代表「這批沒發現」，不代表全站零錯誤。

## 5. 合成回歸案例與後續邊界

對已確認錯誤，先讀 `web/docs/news-ai-eval.md` 的**現行狀態與案例格式**。若仍為草案／未凍結就照實註記，不宣稱正式閘門已生效。依該格式在 `web/evals/news-ai/dev/` 一檔一案寫回歸案例草稿：使用虛構公司與合成新聞，保留失敗樣態，例如盤後同日消息被寫成收盤原因。不得抄新聞原文或真實公司原句；報告用定位連回問題案例，案例本身使用合成輸入。

案例的 id、task、group（company／event／article）、tags、input、gold.requiredFacts 與 gold.forbidden 依該文件；translate 的 gold.focus 及各 task 輸入型別也跟隨現行規格，不在此另定格式。同步在 `web/evals/news-ai/dev/answers-good.json`／`web/evals/news-ai/dev/answers-bad.json` 補齊新 id 的合成正反例，更新 `web/tests/news-ai-eval.test.ts` 的案例數量斷言（含 prepare 任務數與有阻擋案例數）及 `expected` 阻擋種類對照；commit 前在 `web/` 跑 `node --test tests/news-ai-eval.test.ts`。

依文件的 dev 流程分別 score 合成正反例，保存報告中該案例的 `blockers`：正例應為空陣列，反例須命中 `gold.forbidden` 對應的 `kind`／`detail`；不能只以 exit 1 判定重現，缺人工逐句／必要事實標註也會 exit 1。這不是重新生成正式內容。只寫 dev，不讀寫 `web/evals/news-ai/holdout/` 或 `web/evals/news-ai/holdout.lock.json` 來調案例。交付具體案例 diff 與驗證結果後，取得使用者同意才 commit 回填檔；沒有同意就保留草稿並註明。

要求降低「原因不明」比例時，拒絕訂理想比例或把抽到「原因不明」扣分；有無出處才是判準。若要改提示詞或模型，轉到 `web/docs/news-ai-eval.md` 的離線評估流程，月抽查到報告與案例草稿為止，不順手修改。

正式 D1 維持唯讀。更正已發布內容由使用者決定，後續只走 `web/scripts/ai-batch.ts` 與 `/api/admin/ai`（入口：`web/routes/api/admin/ai.ts`），遵循 web/AGENTS.md 的新聞 AI 規則；**抽查期間不執行或 import ai-batch.ts，不跑其 pull 或 push**，避免開新批次或寫正式站。不新增 Orca 抽查排程。
