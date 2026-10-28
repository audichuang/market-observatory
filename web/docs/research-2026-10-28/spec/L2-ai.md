# L2（ai）新聞 AI 流水線：成功判定、新聞時間、可追溯、摘要日期、內容評估

> 路徑相對於 repo 根。行號以 2026-10-28 的 HEAD `8eaac29` 為準。這份是給使用者看的實作規格，票的機器可讀版本在本輪 StructuredOutput。第二版依交叉審稿修訂，處置見 §9。

## 1. 目標

做完研究報告 `web/docs/research-2026-10-28/report.md` 指派給本領域的五項：

| 報告條目 | 這輪要達成的狀態 | 票 |
| --- | --- | --- |
| §6 #3（P0）AI 批次成功判定 | 「排程完成」不再等於「全部寫進去」：每一筆有 expected／accepted／missing／rejected／source unavailable，對照 D1 實際命中；partial 不算成功；daily precheck 會看到待翻譯；第二次 pull 不清掉上一批 | L2-T1、L2-T2 |
| §6 #7（P0）新聞時間 | 保存上游給的發布時間線索；只有「確定收盤前已發布」的新聞能當當天漲跌的背景，其餘另列，提示詞明令不得寫成收盤原因 | L2-T3、L2-T4 |
| §5 J（R3-5）摘要資料日 | iOS 公司摘要顯示資料日；不是最新交易日的摘要不放在「今日重點」下；總覽不把隔天的摘要配在當天 | L2-T5 |
| §6 #15（P1）可追溯 | 每批保存輸入、原始答案、提示詞與 schema hash、要求的模型、時間；資料來源頁看得到新聞 AI 的最後成功與積壓；網頁與 iOS 的摘要可展開「參考來源（整篇，非逐句）」 | L2-T7、L2-T8、L2-T9 |
| §6 #16（P1）內容評估 | 匯入時做確定性的格式、來源、日期檢查；離線評估工具與規格草案就位；規格凍結、holdout 封存與 tone 重新定義等使用者審閱與站長簽核後執行 | L2-T6、L2-T10、L2-T11、L2-T12 |

不碰：任何買賣、加碼、停扣、評等、目標價或綜合評分；`DEFAULT_MODEL` 與 forecast；Orca 排程設定本身；新增或刪除模擬器。

## 2. 現況與證據（HEAD 仍存在，沒有已修好的項目）

### 2.1 #3：批次回報成功但其實沒寫完

- `web/scripts/ai-batch.ts:199`：每次 `pull` 無條件把 `answers.json` 寫成 `{}`，`:200` 覆寫 `tasks.json`。上一批若還沒 push，答案就沒了（V-J #1 已重播）。`--check` 也走同一段（`:196-204`），只是沒任務時多設結束碼 1。
- `web/scripts/ai-batch.ts:221-233`：缺答案只放進 `missing`，印一行就結束，沒有非零結束碼；server 回的 `skipped` 也只印出來。
- `web/src/server/ai-batch.ts:177-178`：points 的 `UPDATE news ... WHERE id = ?` 推進 batch 後直接 `points++`；`:201` 的 `db.batch` 回傳值沒讀。新聞 id 不存在時回 `points:1`、實際 0 列（V-J #4 重播）。
- `web/src/server/ai-batch.ts:160`：翻譯答案缺某幾則時 `parseEnrich` 靜默略過，也沒有任何回報。
- `web/src/server/ai-batch.ts:186-198`：digest 的 `newsIds` 不檢查是否存在；V-H #11 用 `nonexistent-source` 得到 `digests=1`。
- Orca 設定（2026-10-28 兩次唯讀 `orca automations list --json`）：
  - 「市場觀測室：新聞標題翻譯」`08e79897-…`：rrule `20 0,4,8,12,16,20 * * *`（Asia/Taipei，一天 6 次）、`--model haiku`；precheck `node …/web/scripts/ai-batch.ts pull translate --check`（timeout 60 秒）；prompt 開頭是「precheck 已經從正式站拿好這次的待辦」，直接讀 `…/web/.ai-batch/translate/tasks.md`、寫 `answers.json`，再 `push translate`。**翻譯的正式批次就是 precheck 寫出來的那批。**
  - 「市場觀測室：每日 AI 重點」`b5c65aa3-…`：rrule `0 7 * * 2-6`、`--model sonnet`；precheck `pull daily --check`；prompt 第 1 步 `pull translate`＋`push translate`，第 2 步自己再 `pull daily`＋`push daily`，都用 `.ai-batch/<kind>/` 固定路徑。**每日 precheck 寫出的那批一定被第 2 步取代。**
  - 因此 precheck 只看 daily：daily 沒有待辦而翻譯有待辦時，agent 不會啟動（V-J #3 重播：`translationPending=1, digests=0, market=null`）。
- `web/scripts/ai-batch.ts:100-101`：Yahoo 搜尋失敗被 `.catch(() => [])` 吞成「沒有候選」，`:117-119` 抓文章失敗回 `null`；「來源不可得」與「沒對到同一篇」分不出來。

### 2.2 #7：新聞只有日期，盤後新聞會被拿來解釋當天收盤

- `web/src/lib/sources/nasdaq.ts:106-111`：`parseNasdaqCreated` 只取 `Oct 27, 2026` 的年月日。
- `web/src/server/ai-batch.ts:91`：`WHERE published_at = ?` 用交易日撈當天新聞，`:103` 個股、`:125` 大盤直接送進提示詞，沒有任何時間資訊。
- **本輪新查到（2026-10-28 唯讀抓取，未寫任何檔）**：Nasdaq 新聞 API 每列除了 `created` 還有相對時間 `ago`（`"7 hours ago"`、`"1 day ago"`，超過幾天直接給日期字串）。07:39 UTC 抓 NVDA 20 則，用標題對上 Yahoo 搜尋結果的 `providerPublishTime` 4 則：

  | Nasdaq `ago` | `created` | Yahoo 發布時間（UTC） | 實際經過時數 |
  | --- | --- | --- | --- |
  | 7 hours ago | Oct 27, 2026 | 10-27 23:46 | 7.89 |
  | 9 hours ago | Oct 27, 2026 | 10-27 22:21 | 9.30 |
  | 9 hours ago | Oct 27, 2026 | 10-27 21:40 | 9.99 |
  | 10 hours ago | Oct 27, 2026 | 10-27 21:39 | 10.01 |

  4／4 落在 `[N, N+1)` 小時，符合「無條件捨去」。**這 4 則都在 10/27 美東 16:00 收盤後發布（17:39～19:46 EDT），`created` 卻都是 10/27**，照現在的程式會被當成 10/27 的新聞送進「這天為什麼漲跌」。這是 A-04 的實例，不再只是可達路徑。樣本只有一檔、4 則，不代表全站比例。
- `web/src/server/jobs.ts:377-381`：`NEWS_UPSERT_SQL` 的 ON CONFLICT 不更新 `fetched_at`，所以 `fetched_at` 是這則第一次被抓到的時間；`:392` 的 `fetchedAt` 在所有請求完成後才取，晚於每個回應。

### 2.3 R3-5：iOS 摘要看不出日期

- `web/src/server/views.ts:373`：新聞頁取「今天往前 3 天內每家最新一天」的摘要。
- `ios/MarketObservatory/Views/NewsView.swift:137`：全部放在 `Section("今日重點")`；`ios/MarketObservatory/Views/NewsAI.swift:164-195` 的 `DigestRow` 只顯示代號、公司、tone 與摘要，沒有日期。網頁 `web/src/ui/NewsFeed.tsx:78` 有日期。
- `web/src/server/views.ts:96`：總覽用 `latestDigests(…, s.tradeDate, addDays(s.tradeDate, 1))`，`latestDigests` 依日期新到舊每家取一筆（`web/src/server/news-ai.ts:20-25`）。digest 只寫在快照交易日（`web/src/server/ai-batch.ts:86`），所以看週一到週四的舊日期時，會把**隔天**的摘要配在當天的歸因列旁（`ios/MarketObservatory/Views/OverviewView.swift:385` 的 `AIDigestLine`、網頁 `web/pages/index.tsx:195`）。`:112` 的註解「或之後一天，盤後新聞」是舊設計留下的。

### 2.4 #15：沒有逐批紀錄，讀者看不到出處

- `web/scripts/ai-batch.ts:216`：送出的 model 預設 `claude-orca`；Orca 以 `--model haiku`／`--model sonnet` 叫 agent，CLI 拿不到實際模型。
- `web/db/schema.ts:86-98`：`news_digests` 只有 model、`news_ids`（逗號字串，`web/src/server/ai-batch.ts:197` 寫入）、指紋、時間；翻譯與重點沒有逐筆紀錄。
- `web/src/server/news-ai.ts:21`：`latestDigests` 不選 `news_ids`；`web/src/server/views.ts:120` 的大盤摘要也不選。
- `web/tests/api-contract.test.ts:44-45` 的合成資料把 `news_ids` 寫成字串 `'[]'`，跟正式格式（逗號分隔）不同。
- `web/pages/sources.server.ts:16`：資料來源頁整頁在 `cachedPage` 裡；`web/routes/api/admin/ai.ts:28` 刻意不 bump `data_version`。新聞 AI 的狀態若放在快取裡會一直是舊的。`:34` 的 runs 查詢把 trigger 壓成 `cron`／`manual`，`web/tests/leak-guards.test.ts:14` 斷言這件事。
- `web/pages/news.tsx:21` 的說明仍寫「標題與重點在你打開時由 AI 翻成中文」，實際是排程寫好的。

### 2.5 #16：只有格式驗證，沒有內容評估

- `web/src/lib/news-ai.ts:42-54` 的 schema 只有文字與 tone；`parseDigest`（`:260`）、`parsePoints`（`:220`）只驗型別與長度。
- `web/tests/news-ai.test.ts`、`web/tests/ai-batch.test.ts` 只驗 parser、SQL 與提示詞字串，沒有模型輸出對人工標註的比較。
- tone 的定義混著「對股價」：`web/src/lib/news-ai.ts:85`（翻譯）、`:143`（公司重點）、`:212`（單篇重點）、`:194`（大盤）。

## 3. 跨票的設計決定

1. **回執鍵。** 每筆用固定字串當鍵：`translate:<newsId>`、`points:<newsId>`、`digest:<symbol>:<date>`（大盤 symbol 是 `SPX`）。CLI 算 expected 與 missing，server 依 `db.batch` 每個敘述的 `meta.changes` 算 accepted 與 rejected。
2. **整批狀態。** missing 與 rejected 都是空的才是 `ok`；有 accepted 但也有 missing 或 rejected 是 `partial`；expected 不是空的卻一筆都沒寫進去是 `failed`。「正文取不到」不是任務（沒建任務），不影響狀態，但數量一定印出、寫進紀錄。
3. **紀錄放 `runs` 表。** job 用 `ai-translate`、`ai-daily`，trigger 用 `ai-batch`。**不加進 `JOB_NAMES`**（那是 `/api/admin/run` 的白名單，Worker 跑不了 AI）。資料來源頁的 trigger 對應多一種「本機」。
4. **固定路徑不變，靠歸檔保住上一批；每日 precheck 只查不寫。** Orca 的兩條 prompt 與 precheck 寫死 `.ai-batch/<kind>/tasks.md`、`answers.json`、`pull <kind> --check`，所以不改路徑：`pull` 先把上一批的工作檔搬到 `.ai-batch/<kind>/runs/<runId>/`，再寫新的。任務代號加本批後綴（`t1-k3f9`），舊答案對不到新任務只會變成 missing，不會寫錯新聞。`pull daily --check` 改成不寫任何檔（每日 prompt 第 2 步一定自己再 pull，precheck 那批寫了也只會變成沒答案的歸檔）；`pull translate --check` 照舊寫檔（翻譯 prompt 直接用它）。**Orca 設定不用改。**
5. **時間判定不對稱。** 只用 `ago` 加 `fetched_at` 算出的**上界**判定「確定收盤前已發布」：不論 Nasdaq 是捨去、四捨五入或進位，不論回應被 CDN 快取多久，真實時間只會更早，這個結論不會翻。「收盤後」靠下界，下界會被快取拉偏，所以資料模型保留三態，提示詞只分兩桶：「收盤前已發布」與「無法確認在收盤前發布」（逐則小標「收盤後」或「時間不明」），兩桶對因果句的限制相同。
6. **相容與部署順序。** Orca 跑 main checkout，合併當下新 CLI 就生效；Worker 要另外部署。所以 admin API 與 `/api/v1` 一律只加 optional 欄位，兩邊都能吃舊格式。正確順序是**先合併、再部署 Worker**；之間的空窗新 CLI 會把舊 Worker 給的新聞全部當成「無法確認」，那段時間不會有因果句，可接受。不要從分支先部署 Worker。
7. **「今日」的判準用伺服器的最新快照交易日**（`latestTradeDate`），列表裡最大的日期只在舊後端沒有這個欄位時當備援；AI 停兩天時列表最大日期會把舊摘要當成今日，正是 R3-5 要防的。
8. **用 id 清單查新聞一律 `IN (SELECT value FROM json_each(?))`，綁一個 JSON 字串參數。** 每句參數固定 1 個，跟清單長短無關，不需要分塊，也不必等 L1-T1 的 `inChunks` 先合併；`json_each` 正式站已在用（`web/src/server/views.ts:198`），L1-T2 改走勢頁也選同一做法。
9. **新聞 AI 狀態在快取外讀。** 不在匯入時 bump `data_version`，因為那會讓全站頁面快取每次匯入都失效。
10. **內容評估的閘門自規格凍結、第一次登記 holdout 起生效（L2-T11）。** L2-T10 只交規格草案，草案在使用者審閱前沒有拘束力。#7 的時間規則是修已實測到的失敗、只收緊模型能說的話，照出貨；tone 重新定義是第一個要過閘門的候選。

## 4. 票

實作順序就是下面的順序，全部在同一個 L2 分支。每張票的驗收都在該 worktree 的 `web/`（或 `ios/`）跑；**任何手動跑 `scripts/ai-batch.ts` 都要設 `MO_URL` 指向本機站、`MO_AI_BATCH_DIR` 指向暫存目錄**：CLI 預設會打正式站，預設目錄是 Orca 正在用的那個。

---

### L2-T1 匯入回執：以 D1 實際命中計數，逐筆回報，寫進 runs（#3）

**做什麼**

- `importResults`（`web/src/server/ai-batch.ts:140`）改成讀 `db.batch` 的結果：每個 UPDATE／INSERT 記下對應的回執鍵，`meta.changes === 0` 的改列 rejected（理由「新聞已不在資料庫，沒有寫入」）。`translated`／`points`／`digests` 三個數字改成實際命中數。
- 翻譯：輸入那組 id 裡答案沒給或格式不對的，逐則列 rejected（理由「答案缺這則或格式不對」），不再靜默略過。
- 回應保留 `translated, points, digests, skipped`：`skipped` 的語意與內容凍結（維持現在的字串與數量），舊 CLI 靠修正後的三個計數就看得到實際寫入數。新增 `accepted: string[]`、`rejected: {key, reason}[]`（`rejected` 可以與 `skipped` 重疊），有收到 `run` 時再加 `run: {id, status}`。
- POST body（`web/routes/api/admin/ai.ts:19-25`）新增 optional `run`：`{ id: string ≤64, kind: "translate"|"daily", expected: string[] ≤500, missing: string[] ≤500, unavailable: {key, reason}[] ≤100, manifest?: unknown }`。有 `run` 時用 `startRun`／`finishRun`（`web/src/server/repo.ts:291`、`:299`，只 import 不改）寫一列：job `ai-<kind>`、trigger `ai-batch`、status 依 §3-2、summary 例如「預期 23、寫入 21、缺答案 1、拒收 1、正文取不到 3」、detail 放 `{runId, expected, accepted, missing, rejected, unavailable, manifest}`；`manifest` 序列化超過 16 KB 時改存 `{ truncated: true }`。

**改到的符號與呼叫端**

- `importResults`（`web/src/server/ai-batch.ts:140`）：`web/routes/api/admin/ai.ts:29`、`web/tests/ai-batch.test.ts:41`、`:66`；回應的讀取端 `web/scripts/ai-batch.ts:232-233`。
- `ImportBody`（`web/src/server/ai-batch.ts:132`）：同上。
- `POST` validator（`web/routes/api/admin/ai.ts:19-25`）：呼叫端是 `web/scripts/ai-batch.ts:232`。

**測試（`web/tests/ai-batch.test.ts`）**

- 修正前會失敗：`importResults(db, { points: [{ id: "absent", answer: {points:["x"], tone:"neutral"} }] })` 應回 `points === 0`，且 `rejected` 含 `points:absent`（現在回 `points: 1`）。
- 修正前會失敗：翻譯一組 3 個 id、答案只給 2 則 → `translated === 2`，`rejected` 含缺的那則的 `translate:<id>`。
- 新增：帶 `run`（missing 一筆）→ `runs` 多一列 `job='ai-daily'`、`trigger='ai-batch'`、`status='partial'`，summary 含「缺答案 1」；全部寫進去 → `status='ok'`；expected 非空但全被拒 → `failed`。
- 既有兩個測試的斷言保持成立。

---

### L2-T2 CLI：回執與結束碼、不覆寫上一批、每日 precheck 只查不寫並看翻譯、正文失敗分類（#3）

**做什麼**（`web/scripts/ai-batch.ts`，可測的純邏輯搬到新檔 `web/scripts/ai-batch-lib.ts`，該檔 import 時不得登入、不得打網路、不得讀 1Password）

- 目錄：`MO_AI_BATCH_DIR` 有設就用 `<它>/<kind>`，沒設維持 `web/.ai-batch/<kind>`。
- 每次 `pull`（不含 `pull daily --check`）產生 `runId`（`<kind>-<UTC 時間>-<4 碼>`）。工作目錄已有 `tasks.json` 且任務不是空的，先把 `tasks.json`、`tasks.md`、`answers.json`、`manifest.json`、`receipt.json`（有幾個搬幾個）用 rename 搬到 `runs/<上一批的 runId>/`（舊版沒有 manifest 的用 `legacy-<tasks.json mtime>`），再寫新檔。不刪任何歸檔。
- 任務代號改成 `<原代號>-<runId 末 4 碼>`（例如 `t1-k3f9`），`tasks.md` 的標題與範例同步。
- `pull daily --check` **只查不寫**：不建 runId、不歸檔、不寫工作目錄的任何檔。daily 有 market 或 digests 就判定有待辦（不必抓正文）；只剩 points 時照常抓正文，至少一則抓得到才算有待辦。有待辦印「每日有待辦（precheck 不寫檔，排程會再 pull 一次）」以 0 結束；沒有時再 GET `/api/admin/ai?kind=translate`，有待翻譯就印「每日沒有待辦，但有 N 則新聞待翻譯」並以 0 結束，讓 agent 照 prompt 先翻譯；兩者都沒有才以 1 結束。`pull translate --check` 行為不變（照舊寫檔、照上面規則歸檔上一批），翻譯 prompt 直接讀它寫的 `tasks.md`。
- 歸檔的語意（L7-T4 依此判定覆蓋）：`runs/` 下每個目錄都是一次真的 pull；有 `receipt.json` 就是推送過；沒有的是拉了但沒推（agent 沒跑完或沒啟動）。每日 precheck 不產生批次，翻譯 precheck 的批次就是正式批次。伺服器端另有 D1 `runs` 表的 `ai-translate`／`ai-daily` 列（L2-T1）。
- `article()`（`:111`）回傳 `{ body, url, truncated }` 或 `{ unavailable: "search-failed" | "no-match" | "fetch-failed" | "not-html" | "too-short" }`；`searchYahoo`（`:96`）把請求失敗與「沒有新聞」分開。正文取不到的 points 列進 `tasks.json` 旁的 `unavailable`（鍵 `points:<id>`）。`truncated` 以正文長度等於 `extractArticleText` 的上限（6000）判定。
- `push`：沒有任務就印「沒有任務」並以 0 結束，不打 API。否則算 expected 與 missing，POST 時帶 `run`，把 server 回應存成 `receipt.json`，印一行：「寫入：翻譯 a 則、文章重點 b 則、每日重點 c 則；缺答案：…；拒收：…；正文取不到 n 則」。missing 或 rejected 不是空的（舊 server 沒有 `rejected` 時用 `skipped.length`）就以 **3** 結束；HTTP 失敗維持丟錯（1）。

**改到的符號與呼叫端**

- `dir`（`:22`）、`Task`（`:26`）、`searchYahoo`（`:96`，呼叫端 `:113`）、`article`（`:111`，呼叫端 `:163`）、`buildTasks`（`:131`，呼叫端 `:197`）、`render`（`:177`，呼叫端 `:206`）、pull 區塊 `:196-208`、push 區塊 `:209-234`。
- 外部呼叫端：Orca 兩條排程的 precheck 與 prompt（§2.1，指令與路徑都不變）、`web/package.json` 的 `"ai"` script。

**測試（新檔 `web/tests/ai-batch-cli.test.ts`，照 `web/tests/backfill-script.test.ts` 用 spawn＋本機假 HTTP 伺服器，`MO_URL`、`MO_EMAIL`、`MO_PASSWORD`、`MO_AI_BATCH_DIR` 都指向測試用的值；假伺服器的 daily 回應一律 `points: []`，spawn 的 CLI 才不會去打 Yahoo）**

- 修正前會失敗：pull 一次（1 個翻譯任務）→ 寫入 answers.json → 再 pull → `runs/<第一批 runId>/answers.json` 內容仍在（現在 answers 被清成 `{}`、沒有歸檔）。
- 修正前會失敗：tasks 有 2 個、answers 只有 1 個 → push 結束碼 3，輸出含「缺答案」（現在 0）。
- 修正前會失敗：假伺服器 daily 回空、translate 回 1 則 → `pull daily --check` 結束碼 0（現在 1）。
- 修正前會失敗：daily 工作目錄已有上一批（非空 tasks.json、有答案的 answers.json），假伺服器 daily 有 1 個 digest → `pull daily --check` 結束碼 0，兩個檔內容逐字不變、沒有 `runs/` 目錄、沒有 manifest（現在 answers.json 被清成 `{}`、tasks.json 被覆寫）。
- 修正前會失敗：用上一批代號寫的 answers.json 對新一批 push → 假伺服器收到的 body 沒有任何答案、結束碼 3（現在代號 `t1` 對得上，會把舊答案套到新任務）。
- 新增：server 回 `rejected` 非空 → 結束碼 3；全部 accepted → 0；POST body 帶 `run.expected` 與 `run.missing`。
- `web/scripts/ai-batch-lib.ts` 的單元測試：`article` 失敗原因分類（用假的取得函式）；daily 有 market 或 digests 時判定有待辦且不呼叫抓正文的函式；回執鍵與狀態計算。

---

### L2-T3 新聞時間資料層：保存 Nasdaq `ago`，純函式判定是否確定收盤前（#7）

**做什麼**

- `web/db/schema.ts` 的 `news` 加 nullable `publishedAgo: text("published_ago")`（註解寫明：第一次抓到時上游的相對時間原文，與 `fetched_at` 出自同一次回應）。在 `web/` 跑 `npx void db generate` 產生 add-only migration（照 `5ff19e5` 的做法），審 SQL 只有一個 `ALTER TABLE news ADD published_ago`。
- `web/src/lib/sources/nasdaq.ts`：`NewsRow` 加 `ago?: string`；`NewsItem` 加 `publishedAgo: string | null`（trim、最長 40 字）；`parseNasdaqNews` 帶出它。`publishedAt` 的語意與格式不動。
- `web/src/server/jobs.ts:377` `NEWS_UPSERT_SQL`：INSERT 多一欄 `published_ago`（共 11 個參數）；**ON CONFLICT 的 SET 不碰 `published_ago`**（舊列沒有 ago 也不補：`fetched_at` 是第一次抓的時間，兩者必須來自同一次回應）。`jobNews`（`:395`）綁定 `n.publishedAgo`。
- 新檔 `web/src/lib/news-time.ts`（純函式，不碰 D1）：
  - `parseAgo(ago)`：只接受 `N minute(s) ago`、`N hour(s) ago`、`a minute ago`、`an hour ago`，其他（`N day(s) ago`、日期字串、null）回 null。
  - `publishedBounds({ fetchedAt, publishedAgo })`：上界 `fetchedAt − max(N−1, 0)·單位`；下界 `fetchedAt − (N+1)·單位 − 15 分鐘`。
  - `newsTiming(row, tradeDate)` 回 `"before-close" | "after-close" | "unknown"`：上界換成美東日期與分鐘（用 `easternDate`／`easternMinutes`，避開夏令時間計算）早於 `tradeDate` 收盤 → before-close；下界不早於收盤 → after-close；其餘 unknown。收盤 16:00，`NYSE_EARLY_CLOSE` 的日子 13:00。
- 上線前已在 D1 的新聞全部是 `published_ago = null`，一律 unknown；上線後新抓到的才有。

**改到的符號與呼叫端**

- `NEWS_UPSERT_SQL`（`web/src/server/jobs.ts:377`）：`web/src/server/jobs.ts:389`、`web/tests/cron-budget.test.ts:297-298`（位置綁定，要補第 11 個參數）。
- `NewsItem`／`parseNasdaqNews`（`web/src/lib/sources/nasdaq.ts:84`、`:113`）：`web/src/lib/sources/nasdaq.ts:138`、`web/src/server/jobs.ts:395`。
- `news` 表：所有 `SELECT … FROM news` 不受影響（新增欄位不在既有欄位清單裡）。

**測試**

- 新檔 `web/tests/news-time.test.ts`（全部合成時間）：
  - 2026-10-23（EDT，收盤 20:00 UTC）：`fetched_at 2026-10-23T18:00:00Z`、`"2 hours ago"` → before-close；`22:30Z`、`"1 hours ago"` → after-close；`2026-10-24T00:00:00Z`、`"5 hours ago"` → unknown（上界剛好 16:00 不算早於收盤）。
  - 冬令 2026-12-03（收盤 21:00 UTC）同樣三種各一例；提早收盤 2026-11-27 以 13:00 判定。
  - `"1 day ago"`、`"Oct 20, 2026"`、null → unknown；`"an hour ago"` 當 1 小時。
- `parseNasdaqNews` 帶出 `publishedAgo`（新增到 `web/tests/news-time.test.ts` 或 `web/tests/sources.test.ts`）。
- upsert：用 `migratedDb()` 先 INSERT 一列（ago=`"2 hours ago"`），再用同 id 不同 ago upsert → 值不變；先以 null 寫入的列再 upsert 帶 ago → 仍是 null。
- `web/tests/cron-budget.test.ts:298` 改成 11 個參數後原測試照樣通過。

---

### L2-T4 AI 輸入分兩桶，提示詞加時間規則（#7）

**做什麼**

- `web/src/server/ai-batch.ts`：`COLS`（`:33`）與 `NewsRow` 加 `fetched_at`、`published_ago`；`dailyWork` 對當天新聞用 `newsTiming(row, date)` 分類。
  - `DigestWork.news[]` 只放 before-close，每筆多 `timing: "before-close"`；新增 optional `unconfirmed: { id, titleZh, title, summary, tone, category, timing: "after-close"|"unknown" }[]`（新 Worker 一律給陣列，空的也給）。`.filter((d) => d.news.length > 0)`（`:106`）改成兩桶合計大於 0。
  - `MarketWork.news`／`newsIds` 只放 before-close；新增 optional `unconfirmed: { id, title, timing }[]`（同樣一律給）。型別仍是 `string[]`，**不改成物件陣列**：舊 CLI 看到的是較保守的子集。
- `web/src/lib/news-ai.ts`：`DigestInput.news[]` 加 optional `timing`、加 optional `unconfirmed`；`MarketInput` 加 optional `unconfirmed`。
  - `digestPrompt`：`timing === "before-close"` 的列在「收盤前已發布的新聞」；沒有 `timing` 的列（舊 Worker）與 `unconfirmed` 一起列在「無法確認在收盤前發布的新聞」，逐則小標「收盤後」或「時間不明」。
  - `marketPrompt`：有 `unconfirmed` 欄位時 `news` 是收盤前那組；**沒有這個欄位（舊 Worker）就把 `news` 全部當成時間不明**。
  - 兩個提示詞都加入下面這段（可微調語句，但三個錨點要在：「無法確認在收盤前發布」「不能當成這天收盤漲跌的原因」「公布後立即」）：
    > 逐句分清楚「發生了什麼」與「誰怎麼解讀」。要寫某則消息帶動股價，只能用「收盤前已發布」那組，而且新聞本身要有這樣的說法，寫成「〔具名來源〕認為／指出……」。「無法確認在收盤前發布」那組可以提到發生了什麼，但不能當成這天收盤漲跌的原因。沒有盤中資料，不寫「公布後立即」「盤中逆轉」這類時間先後。
- `web/scripts/ai-batch.ts` 的 `buildTasks`：digest 的 `meta.newsIds` 用兩桶全部的 id；大盤用 `newsIds` 加 `unconfirmed` 的 id。

**改到的符號與呼叫端**

- `dailyWork`（`web/src/server/ai-batch.ts:69`）：`web/routes/api/admin/ai.ts:14`、`web/tests/ai-batch.test.ts:52`、`:58`、`:78`、`:95`。
- `DigestWork`／`MarketWork`（`:37`、`:46`）：`web/scripts/ai-batch.ts:14`、`:145-146`、`:150-151`、`:153-160`。
- `COLS`（`:33`）：`:62`、`:75`、`:91`、`:151`。
- `digestPrompt`（`web/src/lib/news-ai.ts:132`）：`web/scripts/ai-batch.ts:157`、`web/tests/news-ai.test.ts:39`、`:151`。
- `marketPrompt`（`:172`）：`web/scripts/ai-batch.ts:151`、`web/tests/ai-batch.test.ts:97`、`web/tests/news-ai.test.ts:133`。

**測試**

- 修正前會失敗（`web/tests/ai-batch.test.ts`）：快照日 D2 有三則大盤新聞——A（`fetched_at` 為 D2 美東 14:00、`"2 hours ago"`）、B（D2 美東 19:00、`"1 hours ago"`）、C（`published_ago` null）。`dailyWork` 的 `market.news` 只有 A 的標題，`market.unconfirmed` 是 B（after-close）與 C（unknown）。現在三則都在 `market.news`。
- 同一組資料對公司 digest：`news` 只有 A，`unconfirmed` 有 B、C；只有 B、C 的公司仍會產生 digest 任務。
- `web/tests/news-ai.test.ts`：`digestPrompt`／`marketPrompt` 的 user 含三個錨點；unconfirmed 的標題出現在「無法確認」段之後、不在「收盤前已發布」段；`marketPrompt` 不給 `unconfirmed` 欄位時，`news` 的標題出現在「無法確認」段。
- 既有的 daily 測試要跟上資料：`seeded()`（`web/tests/ai-batch.test.ts:18`）把 `fetched_at` 寫成 `'x'`、沒有 `published_ago`，分類後 n1、n3 都是 unknown，`:61` 與 `:63` 的斷言會落空。修法是把 `seeded()` 的 `fetched_at` 改成真實 ISO 時間、n1／n3 加上能判成 before-close 的 `published_ago`（或把斷言改到對應的桶），**不得放寬 `newsTiming` 讓舊測試過**。
- 既有的「各項貢獻合計等於指數漲跌」測試（`web/tests/ai-batch.test.ts:82`）照樣通過。

---

### L2-T5 摘要資料日：iOS 顯示日期、「今日重點」只放最新交易日、總覽只配同日摘要（R3-5）

**做什麼**

- `newsView`（`web/src/server/views.ts:350`）回應新增 optional `latestTradeDate: string | null`（`SELECT MAX(trade_date) FROM snapshots`，在快取外讀）。
- `overviewView`（`:96`）改成 `latestDigests(c.env.DB, members, s.tradeDate, s.tradeDate)`；`:112` 的註解改成「只取這個交易日的摘要」。
- iOS：
  - `NewsPage`（`ios/MarketObservatory/Models.swift:298`）加 `let latestTradeDate: String?`。
  - `DigestRow`（`ios/MarketObservatory/Views/NewsAI.swift:164`）在按鈕內顯示 `Fmt.dateWithWeekday(digest.date)`（caption、次要色）。**不動** `accessibilityIdentifier("news-digest-<symbol>")`，label 仍要含利多／利空（`ios/MarketObservatoryUITests/VerifyInteractionTests.swift:510` 靠它）。
  - 抽一個純函式（例如 `DigestSections.split(_:latest:)`）決定分段：`latest = p.latestTradeDate ?? 列表最大日期`。日期等於 `latest` 的放「今日重點 · M/D（週）」，維持前 3 家＋「其餘 N 家」；其他日期放「較早的重點」（預設收合的 `DisclosureGroup`，每列有日期）。沒有 `latestTradeDate`（舊後端）時改用中性標題「公司重點」並逐列顯示日期。
  - `NewsView.digestSection`（`ios/MarketObservatory/Views/NewsView.swift:134`）改用上面的分段。單一代號的段落（`:150`）不改結構，`DigestRow` 本身已有日期。
- 網頁 `web/src/ui/NewsFeed.tsx` 已顯示日期，不動。

**改到的符號與呼叫端**

- `newsView`：`web/routes/api/v1/news.ts:6`、`web/pages/news.server.ts:7`、`web/tests/api-contract.test.ts:53`、`web/tests/news-ai.test.ts:103`。
- `overviewView`：`web/routes/api/v1/overview.ts:6`、`web/pages/index.server.ts:7`、`web/tests/api-contract.test.ts:50`。
- `DigestRow`：`ios/MarketObservatory/Views/NewsView.swift:153`、`:161`。`NewsView.digestSection`：`:98`。

**測試**

- 修正前會失敗（新檔 `web/tests/digest-dates.test.ts`）：快照 D1、D2 兩天，NVDA 在 D1、D2 各有一筆 digest；`overviewView` 帶 `?date=D1` → `digests` 只有 D1 那筆（現在回 D2）。
- 新增：`newsView` 回 `latestTradeDate === D2`；沒有快照時為 null。
- iOS（新檔 `ios/MarketObservatoryTests/DigestSectionsTests.swift`）：latest=D2、資料 [NVDA D2, AAPL D1] → 今日段只有 NVDA、較早段只有 AAPL；latest 為 nil → 單一中性段；全部都是 D1 而 latest=D2 → 今日段為空、全部在較早段。
- `FixtureDecodingTests`：generated-news 解得出 `latestTradeDate`；舊的 `news.json` 解出來是 nil。
- 更新 generated fixture（`MO_UPDATE_API_FIXTURES=1`），審 diff 只多 `latestTradeDate`。

---

### L2-T6 匯入時的確定性檢查：digest 的來源與日期（#16）

**做什麼**（`importResults` 的 digest 分支，`web/src/server/ai-batch.ts:186-199`）

- `d.date` 必須是 `snapshots` 裡存在的 `trade_date`，否則 rejected「日期不是交易日快照」。
- `d.newsIds` 每一個都要存在於 `news` 且 `published_at = d.date`，否則 rejected「來源新聞不存在或日期不符：<id…>」。查詢用 `SELECT id, published_at FROM news WHERE id IN (SELECT value FROM json_each(?))`（§3-8，綁一個 JSON 字串，不分塊）。大盤 `newsIds` 可以是空的。
- 格式由既有 parser 負責，不改。這就是 #16 說的「daily 每批只做 schema、來源、時間檢查」；不做語意判斷。

**改到的符號與呼叫端**：`importResults`（同 L2-T1）。

**測試（`web/tests/ai-batch.test.ts`）**

- 修正前會失敗：digest `newsIds: ["nonexistent-source"]` → `digests === 0`，`rejected` 含 `digest:<key>:<date>`（現在寫入 1 筆，V-H #11）。
- 修正前會失敗：`date` 是合法格式但沒有該日快照 → rejected。
- 新增：newsIds 有一則 `published_at` 是別天 → rejected；全部正確 → accepted；大盤空 newsIds → accepted。
- 既有測試裡 `digests` 的資料要合乎新規則（例如 `:69-71` 用的 n1、n3 已是 D2），不得為了過測試放寬檢查。

---

### L2-T7 批次 manifest＋資料來源頁的新聞 AI 狀態（#15）

**做什麼**

- `pull`（`pull daily --check` 除外，它不寫檔）寫 `manifest.json`：`runId`、`kind`、`pulledAt`、`gitCommit`、`gitDirty`（`git rev-parse HEAD`、`git status --porcelain`；取不到寫 `"unknown"`）、`promptSourceSha256`（`web/src/lib/news-ai.ts` 檔案內容）、各 schema 的 sha256、`tasksSha256`、`requestedModel`（`AI_BATCH_MODEL`，沒設就 `"unknown"`，**不填 `claude-orca`**）、daily 的 `snapshot: { date, revision }`、每個 points 任務的 `{ key, url, bodyChars, truncated }`、`unavailable`。`push` 補 `answersWrittenAt`（answers.json 的 mtime）、`pushedAt`，並把不含正文的摘要版放進 `run.manifest` 送給 server。送出的 `model` 欄位維持現狀（`AI_BATCH_MODEL ?? "claude-orca"`），不改舊資料的意義。
- `dailyWork` 回應加 optional `revision`（快照的 revision），給 manifest 用。
- `web/src/server/ai-batch.ts` 新增 `aiPipelineStatus(db, now)`，回傳：
  - `daily`：最近一次 `ai-daily` 的 `{status, finishedAt, summary}`、最後一次 `ok` 的時間、最新快照交易日、該日的大盤摘要（`news_digests` 的 `SPX`）是否已寫入。
  - `translate`：最近一次與最後一次 `ok`；待翻譯積壓（與 `translateWork` 同條件的筆數與最早 `fetched_at`）。
  - `news`：`runs` 裡 `news` 工作最後一次 `ok` 的時間。

  判定都看 D1 裡的結果（摘要有沒有寫、積壓有多久），不靠 Mac 自己回報「還活著」。
- `web/pages/sources.server.ts`：在 `cachedPage` **外面**呼叫 `aiPipelineStatus`（只用 `c.env.DB`，不呼叫 `viewerOf`：`web/tests/leak-guards.test.ts:22-24` 以 `{ env: { DB } }` 呼叫 loader），併進 props；runs 查詢（`:34`）的 CASE 加 `WHEN trigger = 'ai-batch' THEN 'local'`。
- `web/pages/sources.tsx`：新增「新聞 AI（本機排程）」區塊，三行——每日重點（最近一次狀態徽章＋時間＋summary；最後完整成功；「YYYY-MM-DD 的大盤重點：已寫入／還沒寫入」）、標題翻譯（最近一次；最後完整成功；「待翻譯 N 則，最早 X 抓到」）、新聞來源（最後成功抓取）。`JOB_LABEL` 加 `ai-translate`「新聞 AI 標題翻譯」、`ai-daily`「新聞 AI 每日重點」；執行紀錄的 trigger 顯示「排程／手動／本機」。不顯示 detail。

**改到的符號與呼叫端**

- `web/scripts/ai-batch.ts` pull／push 區塊（L2-T2 之後的版本）；`dailyWork` 回應（呼叫端同 L2-T4）。
- `loader`（`web/pages/sources.server.ts:14`）：Void 的頁面路由、`web/tests/leak-guards.test.ts:22`；`Props` 的使用端 `web/pages/sources.tsx:47`。

**測試**

- 新增（新檔 `web/tests/ai-status.test.ts`）：runs 有一筆較早的 `ok`、一筆較晚的 `partial` → `lastOkAt` 是較早那筆、`lastRun.status` 是 partial；有 2 則未翻譯 → `backlog.count === 2`；最新快照沒有 SPX 摘要 → `marketDigestWritten === false`。
- `web/tests/leak-guards.test.ts:14`：多插一列 `job='ai-daily', trigger='ai-batch'`，斷言轉成 `local`、`out.ai` 不含 detail、整份 props 仍搜不到 `@`、`stack`（測試名稱的「只剩 cron／manual」改成「cron／manual／local」）。
- `web/tests/ai-batch-cli.test.ts` 加：pull 後 `manifest.json` 有上列鍵，未設 `AI_BATCH_MODEL` 時 `requestedModel === "unknown"`；歸檔目錄裡也有 manifest；POST 的 `run.manifest` 不含正文。

---

### L2-T8 摘要參考來源：API＋網頁（#15）

**做什麼**

- `web/src/server/news-ai.ts`：`latestDigests` 選 `news_ids`；新 helper 解析逗號字串（trim、去空字串；把舊合成資料的 `"[]"` 當空），把這次要顯示的所有 digest 的 id 合成一份清單，用一句 `SELECT id, title, title_zh, url, publisher, published_at FROM news WHERE id IN (SELECT value FROM json_each(?))` 查回（§3-8），再依每筆的原順序對回去。`DigestRow` 加 `sources: DigestSource[]` 與 `sourcesMissing: number`（查不到的 id 數；新聞表保留 120 天，舊摘要缺來源是正常情況）。
- `marketDigest`（`web/src/server/views.ts:119`）同樣加 `sources`、`sourcesMissing`。
- 網頁：`web/src/ui/NewsFeed.tsx` 匯出 `DigestSources` 元件——`<details>`，summary 文字「參考來源（整篇，非逐句）· N 則」，每列是中文標題（沒有就英文）連到原文、出處與日期；`sourcesMissing > 0` 加一行「另有 N 則來源已不在資料庫，無法列出」；大盤沒有引用新聞時顯示「這段只根據行情數字，沒有引用新聞」。用在每張 digest 卡（`:74-80`）與總覽的「今天為什麼漲跌」（`web/pages/index.tsx:55-60`）。**任何地方都不出現「已驗證」。**
- `web/pages/news.tsx:21` 改成「標題與重點由本機排程的 AI 整理成中文（約每 4 小時），全站共用；AI 可能出錯，請以原文為準」。
- `web/tests/api-contract.test.ts:44-45`：NVDA 的 `news_ids` 改成 `'contract-news'`、SPX 改成 `'contract-news,contract-gone'`，讓 generated fixture 同時有「有來源」與「缺來源」。

**API**：`/api/v1/news` 的 `digests[]` 與 `/api/v1/overview` 的 `digests[]`、`market` 各加 optional `sources: {id, title, title_zh, url, publisher, published_at}[]` 與 `sourcesMissing: number`。既有欄位不變。

**改到的符號與呼叫端**

- `latestDigests`（`web/src/server/news-ai.ts:17`）：`web/src/server/views.ts:96`、`:373`。`DigestRow`（`:6`）：同上。
- `marketDigest`（`web/src/server/views.ts:119`）：`:97`。
- `DigestItem`／`NewsFeed`（`web/src/ui/NewsFeed.tsx:18`、`:40`）：`web/pages/news.tsx:65`、`web/pages/index.tsx:195`。
- api-contract 種子：`web/tests/api-contract.test.ts:44-45`。

**測試**

- 新增（`web/tests/news-ai.test.ts` 的 newsView 測試旁）：`news_ids = "n1,gone"` → `sources` 只有 n1（含 title_zh、url），`sourcesMissing === 1`；`"[]"` → `sources: []`、`sourcesMissing: 0`。
- 長清單：3 筆 digest 合計 150 個存在的 id → 每筆的 `sources` 都完整、順序同 `news_ids`。不包 `db.prepare`、不自己數參數；L1-T1 的假 D1 守門（參數超過 100 就 reject）合併後，這個測試同時證明每句參數 ≤ 100。
- `overviewView` 的 `market` 帶 `sources`。
- `node --test tests/api-contract.test.ts` 更新 fixture，審 diff 只多 `sources`、`sourcesMissing`。

---

### L2-T9 摘要參考來源：iOS（#15）

**做什麼**

- `ios/MarketObservatory/Models.swift`：新增 `DigestSource: Decodable, Sendable, Hashable, Identifiable`（`id, title, titleZh?, url, publisher?, publishedAt?`）；`NewsDigest`（`:161`）與 `MarketDigest`（`:170`）加 `sources: [DigestSource]?`、`sourcesMissing: Int?`。
- `ios/MarketObservatory/Views/NewsAI.swift`：新增 `DigestSourcesList`，標題「參考來源（整篇，非逐句）」，每列中文標題（沒有就英文）、出處 · 日期，點了用 `openURL` 開原文；`sourcesMissing > 0` 顯示「另有 N 則來源已不在資料庫，無法列出」。
- `NewsView`：摘要展開（`expandedDigest == symbol`，單一代號段落則是預設展開狀態）時，在 `DigestRow` **下面另起一列**放來源清單（不能包在 `DigestRow` 的 Button 裡），identifier `news-digest-sources-<symbol>`。
- `OverviewView`：`MarketDigestCard`（`:160`）後面另起一個 `DisclosureGroup("參考來源（整篇，非逐句）")`，identifier `market-digest-sources`；**不放進 `market-digest` 那個 `.accessibilityElement(children: .combine)` 裡**（`VerifyInteractionTests.swift:503-506` 讀它的 label）。
- 總覽歸因列的 `AIDigestLine`（`:385`）不加來源，新聞頁有。

**改到的符號與呼叫端**：`NewsDigest`（`Models.swift:31`、`:331`、`NewsView.swift:135`、`:151`、`:160`、`OverviewView.swift:169`、`:361`、`NewsAI.swift:165`）；`MarketDigest`（`Models.swift:33`、`OverviewView.swift:160`、`:447`）。

**測試**

- `ios/MarketObservatoryTests/FixtureDecodingTests.swift`：generated-news 的 NVDA digest 有 1 筆 source；generated-overview 的 `market.sourcesMissing == 1`；舊的 `news.json`、`overview.json` 解出來 `sources == nil`。這兩個斷言綁在 L2-T8 的 api-contract 種子（`:44-45`）上，整合時種子被合錯就會失敗。

---

### L2-T10 離線內容評估工具與規格草案（#16）

**範圍釘死**：交付的是工具、案例格式、評估規格**草案**，以及每類幾個合成正反例證明閘門會擋。規格的凍結、40 案金標、holdout 封存與盲評是使用者與站長的工作，放在 L2-T11。

**做什麼**

- `web/docs/news-ai-eval.md`（規格草案）：檔頭第一行是狀態列「**狀態：草案，未凍結。** 使用者審閱後由 L2-T11 改為『已凍結』；草案期間沒有拘束力。」凍結點是 L2-T11 把狀態列改成已凍結、與 holdout 登記一起合併的那個 commit。內容：
  - 只評內容忠實度、時間與涵蓋，不評報酬、不讀歷史行情。
  - 任務類型：translate、points、digest、market（財報證據卡屬 P2 #24，不在內）。
  - 案例格式、dev 與 holdout 的分法（以公司／事件分組切，同篇轉載不跨組）；dev 可用來改提示詞，holdout 只用來驗收、不得拿來調提示詞，檔案 hash 登記在 `web/evals/news-ai/holdout.lock.json`，改動要重新登記並由站長簽核。
  - 阻擋項：格式解析失敗、數字無出處、公司認錯（翻譯的 focus 錯）、把「無法確認在收盤前發布」的消息寫成收盤原因、買賣建議、個案標註的禁止推論。
  - 門檻：holdout 阻擋項（確定性＋人工標的重大錯誤）= 0；逐句支持率 ≥ 95%；必要事實涵蓋率 ≥ 90%；有 baseline 後不得低於 baseline。這些是維護政策，不是統計保證。
  - 產生方式：模型 alias 與正式排程相同（translate 用 haiku，其餘 sonnet）；每案只生成一次，不重抽；每輪候選最多改 2 版，每版都記錄。
  - 盲評：每案 A／B 隨機（記 seed），隱去版本；評審是站長，第二位評審可選，只有一人時明寫單人評估；模型可以先標疑點，不能當裁判。
  - 月抽查（10-27 的 N-09，每月 10 篇 digest，固定抽樣規則）的錯誤回填到 dev 當回歸案例，不改 holdout。抽查的 skill 屬 §6 #18，不在本領域。
  - 閘門自凍結並第一次登記 holdout 起生效；第一輪只建立 baseline，沒有現行版可比。
- `web/src/lib/news-ai-eval.ts`（純函式）：案例型別與驗證；用 `web/src/lib/news-ai.ts` 的提示詞函式產生任務；確定性檢查：
  - 用既有 parser 解析，失敗 → 阻擋「格式」。
  - 答案裡帶 %、$、小數點或億／萬／B／M 單位的數字，必須在案例輸入找得到相同值（允許去千分位、允許四捨五入到較少位數）→ 否則阻擋「數字無出處」。
  - 翻譯的 focus 集合與金標不同 → 阻擋「公司認錯」；category、tone 不同只標記。
  - 案例 `gold.forbidden` 的個案 pattern 命中 → 依其 kind 阻擋。**不做全域因果詞黑名單**；全域的買賣字眼（買進、賣出、加碼、減碼、停利、停損）只標「待人工看」，不自動阻擋。
  - `gold.requiredFacts` 有 pattern 的算自動涵蓋率，只當參考，正式涵蓋率以人工標註為準。

  另有：計分（合併人工標註）、閘門判定、盲評表與對照鍵。
- `web/scripts/eval-news-ai.ts`：`prepare --set dev|holdout --out <dir> [--prompts <news-ai.ts 路徑>]`（產出跟正式一樣格式的 tasks.md／tasks.json，不含金標；`--prompts` 讓 baseline 能用舊 commit 的提示詞）、`score --set … --answers <file> [--labels <file> --key <file>] [--baseline <report.json>] [--out <report.json>]`、`blind --set … --a <file> --b <file> --seed <n> --out <dir>`。只 import `web/src/lib/news-ai.ts`、`web/src/lib/news-ai-eval.ts` 與 node 內建模組；**不 import `web/scripts/ai-batch.ts`**、不打網路、不登入。`--set holdout` 在 lock 沒登記或 hash 不符時拒絕執行並以 2 結束；閘門不過以 1 結束。
- `web/evals/news-ai/dev/`：每類至少 2 案（共 ≥ 8），用虛構公司與合成新聞，涵蓋：收盤後同日消息、只有日期、正文截斷、來源互相矛盾、actual 與 estimate、GAAP 與 adjusted、否定句、別家公司的目標價、單位、文章內嵌指令。每案附一份正確答案與一份違規答案（放 `web/evals/news-ai/dev/answers-good.json`、`answers-bad.json`）給測試用。
- `web/evals/news-ai/holdout/`（只放 README，說明由站長建立）與 `web/evals/news-ai/holdout.lock.json`（`{"files": {}}`，未登記）。

**測試（新檔 `web/tests/news-ai-eval.test.ts`）**

- 所有 dev 案例通過格式驗證。
- `answers-bad.json` 的每案至少一個阻擋項，且類型符合該案設計（數字無出處、未確認時間被寫成原因、公司認錯、買賣建議各至少一例）；`answers-good.json` 沒有阻擋項。
- spawn `score --set holdout` 在未登記時結束碼 2；把 lock 改成錯的 hash 也是 2。
- `blind` 輸出不含版本名稱，用 key 能還原 A／B。
- 讀 `web/scripts/eval-news-ai.ts` 原始碼，斷言沒有 import `ai-batch`。
- 讀 `web/docs/news-ai-eval.md` 第一行，斷言含「草案，未凍結」（防止草案在沒審閱前被改成已凍結合併進來）。

**交付提醒**：這份文件凍結後會約束之後所有提示詞改動，性質和 `web/docs/forecast.md` 的事前登記一樣。整合 PR 的描述要單獨列出它，寫明「目前是草案、沒有拘束力，凍結前請先讀」。

---

### L2-T11 規格凍結、holdout 封存與首輪 baseline（#16）— 待使用者與站長

**做什麼**

1. 使用者審閱 `web/docs/news-ai-eval.md` 草案，照意見修改，狀態列改成「**狀態：已凍結（YYYY-MM-DD，使用者審閱）。**」，並把 `web/tests/news-ai-eval.test.ts` 裡「草案，未凍結」那條斷言改成「已凍結」。
2. 站長建立或審定 holdout（建議 4 類 × 4 案，合成新聞），確認每案金標後把 hash 寫進 `web/evals/news-ai/holdout.lock.json`。第 1、2 步同一個 commit 合併，這個 commit 就是凍結點與登記點。
3. 之後用 HEAD（含 L2-T4 的時間規則）跑一次：`prepare --set holdout --out /tmp/mo-eval-baseline` → 用這台 Mac 已登入的 `claude` CLI（translate 用 `--model haiku`、其餘 `--model sonnet`）照 tasks.md 把答案寫成 `/tmp/mo-eval-baseline/answers.json` → `score` → 站長逐句標註成 `/tmp/mo-eval-baseline/labels.json` → `score --labels … --out evals/news-ai/runs/baseline.json`；結果另寫成 `web/docs/news-ai-eval-runs/<日期>-baseline.md`（分子／分母、阻擋清單、單人或雙人評估）。

**卡在**：使用者審閱並同意凍結規格；站長確認 holdout 金標並簽核 hash；逐句標註由站長做。

---

### L2-T12 tone 改定義為「來源對事件的表述」（#16、H-03）— 等 baseline

**做什麼**：`enrichPrompt`（`web/src/lib/news-ai.ts:85`）、`digestPrompt`（`:143`）、`pointsPrompt`（`:212`）的 tone 改成「這則（這些）新聞本身怎麼描述這件事對公司的影響；不是你對股價的預測；新聞沒有明確表態就 neutral，neutral 不代表沒有資料」。`marketPrompt`（`:194`）改成「tone 描述這天已經發生的行情偏多或偏空，不是預測」。`web/db/schema.ts:73` 的註解同步。網頁與 iOS 的「利多／利空／中性」標籤與 enum 不改。

**驗收**：`web/tests/news-ai.test.ts` 斷言四個提示詞含新定義、不再出現「對股價而言」「對股價偏」；照凍結規格跑候選：`prepare --set holdout --out /tmp/mo-eval-tone` → 答案寫成 `/tmp/mo-eval-tone/answers.json` → `blind --set holdout --a /tmp/mo-eval-baseline/answers.json --b /tmp/mo-eval-tone/answers.json --seed <當下隨機產生> --out /tmp/mo-eval-tone/blind`（seed 記進結果報告）→ 站長盲評寫 `/tmp/mo-eval-tone/blind/labels.json` → `score --set holdout --answers /tmp/mo-eval-tone/answers.json --labels /tmp/mo-eval-tone/blind/labels.json --key /tmp/mo-eval-tone/blind/key.json --baseline evals/news-ai/runs/baseline.json`。holdout 阻擋項 0、不低於 baseline、站長盲評通過才合併（合併即上線，Orca 跑的是 main）。

**卡在**：L2-T11 的凍結、baseline 與站長盲評。

### 4.1 共同驗收指令與不准碰的檔

網頁（worktree 的 `web/`，可與其他領域平行跑）：

```sh
cd <worktree>/web && npx void prepare
cd <worktree>/web && npm run typecheck
cd <worktree>/web && node --test tests/<該票的測試檔>.test.ts
cd <worktree>/web && npm test
# 動到 /api/v1（L2-T5、L2-T8）：
cd <worktree>/web && node --test tests/api-contract.test.ts
cd <worktree>/web && MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts && git diff --stat ../ios/MarketObservatoryTests/Fixtures/generated/
```

iOS（worktree 的 `ios/`）。`build-for-testing` 用 generic destination，不開模擬器，可平行；**開模擬器的那一步受全工作流程共用的模擬器鎖 `/tmp/mo-ios-sim.lock` 管制**：同一時間只有一個領域能開 MO 模擬器，開機前若已有任何 MO 模擬器開著就停下，用完 shutdown 才釋放鎖。L7-T1 合併前不得執行 `ios-up.sh`、`down.sh`（現行版本會新增、刪除模擬器）。

```sh
cd <worktree>/ios && xcodegen generate
cd <worktree>/ios && xcodebuild build-for-testing -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination 'generic/platform=iOS Simulator' -derivedDataPath build/l2
cd <worktree>/ios && /usr/bin/lockf -k /tmp/mo-ios-sim.lock /bin/sh -c 'if xcrun simctl list devices booted | grep -q "MO "; then echo "已有 MO 模擬器開著，停止" >&2; exit 75; fi; xcrun simctl boot "MO iPhone 16 Plus" || exit 1; xcodebuild test-without-building -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination "platform=iOS Simulator,name=MO iPhone 16 Plus" -derivedDataPath build/l2 -only-testing:MarketObservatoryTests; rc=$?; xcrun simctl shutdown "MO iPhone 16 Plus"; exit $rc'
```

所有票都不准碰：`web/src/lib/forecast.ts`、`web/docs/forecast.md`、`web/tests/helpers/fake-cloudflare.ts`（L1 在這裡加參數上限）、`web/src/server/repo.ts`（只 import）、`web/src/server/push.ts`、`web/src/lib/push.ts`、`web/src/server/outlook.ts`、`web/src/lib/consensus.ts`、`web/crons/`、`.claude/skills/verify/SKILL.md`、`.claude/skills/verify/scripts/`、`ios/MarketObservatory/Views/MoreView.swift`、`web/.ai-batch/`（Orca 的工作目錄）、Orca 排程設定。`web/src/lib/sources/nasdaq.ts` 只有 L2-T3 能改、只改新聞解析；`web/src/server/jobs.ts` 只有 L2-T3 能改、只改 `NEWS_UPSERT_SQL` 與 `jobNews`。

### 4.2 整合驗收時要看的畫面與功能地圖

| 票 | 網頁 | iOS | 對帳 | 功能地圖 |
| --- | --- | --- | --- | --- |
| L2-T1、T2、T7 | 本機站用站長跑 `MO_URL=http://localhost:5181 MO_AI_BATCH_DIR=$(mktemp -d) node scripts/ai-batch.ts pull daily`，寫一份缺一題的 answers 再 push：結束碼 3、印出「缺答案」；「資料來源」頁的「新聞 AI（本機排程）」顯示這一批 partial、執行紀錄多一列「新聞 AI 每日重點 · 本機」；再 pull 一次，`runs/<runId>/answers.json` 還在；`pull daily --check` 後工作目錄沒有新檔 | — | 頁面 summary 數字＝`receipt.json` | `sources-admin.md`（新區塊、trigger 多「本機」、`sources-no-leak` 的 trigger 清單） |
| L2-T3、T4 | 本機站跑過 `news` 工作後，本機 D1 `SELECT id, published_at, published_ago, fetched_at FROM news ORDER BY fetched_at DESC LIMIT 5` 有 `published_ago`；`pull daily` 的 tasks.md 有「收盤前已發布」「無法確認在收盤前發布」兩段與時間規則 | — | — | — |
| L2-T5 | 總覽切到前一個交易日：名單公司下面的摘要日期＝該日 | 新聞頁：「今日重點 · M/D（週）」只有最新交易日的摘要，每列有日期；另準備一家只有前一交易日摘要 → 出現在「較早的重點」 | `/api/v1/news` 的 `latestTradeDate` 與 `digests[].date`；`/api/v1/overview?date=` 的 `digests[].date` | `news-calendar.md`（`news-digest-tone` 旁加日期與分段）、`overview.md`（摘要只取同日） |
| L2-T6 | 用站長 `POST /api/admin/ai` 送不存在的 newsIds：回應 `rejected` 有該筆，畫面沒有出現 | — | — | `news-calendar.md:41` 的準備資料說明（newsIds 要是本機實際存在、同日的新聞） |
| L2-T8 | `/news` 每張摘要卡可展開「參考來源（整篇，非逐句）· N 則」，連得到原文；總覽「今天為什麼漲跌」同樣可展開；缺來源的顯示「另有 N 則…」；全頁搜不到「已驗證」；`/news` 說明文字已更新 | — | 來源清單＝API `digests[].sources` 的標題與網址 | `news-calendar.md`、`overview.md` |
| L2-T9 | — | 新聞頁點開摘要，下面出現來源清單，點一則開 Safari；總覽市場重點卡下方「參考來源（整篇，非逐句）」可展開；`test15_DigestToneLabels` 仍通過；最大字級不裁切 | 同上 | `news-calendar.md`、`overview.md` |
| L2-T10 | `node scripts/eval-news-ai.ts score --set dev --answers evals/news-ai/dev/answers-bad.json` 列出阻擋項；`--set holdout` 在未登記時拒絕 | — | — | — |

本機沒有 AI 內容（翻譯與摘要只在正式站由 Orca 寫入），驗 L2-T5、T8、T9 要先用站長 `POST /api/admin/ai` 在本機寫摘要：`newsIds` 用本機 D1 裡同一天的真實新聞 id，另寫一筆前一交易日的摘要與一筆含不存在 id 的舊格式資料（直接在本機 D1 插入，因為 L2-T6 之後 API 會拒收）。

iOS 的整合驗收同樣要先拿到 `/tmp/mo-ios-sim.lock`。L7-T1 合併前照 `AGENTS.md:8` 的手動流程：用 `xcrun simctl list devices` 查 `MO iPhone 16 Plus` 的 UDID 寫進本輪的 `sim.udid`，再用 `ios-test.sh`／`ios-walkthrough.sh`；不跑 `ios-up.sh`、`down.sh`，結束時手動 `xcrun simctl shutdown` 並關掉本輪的本機服務。

## 5. 刻意排除

| 不做 | 理由 |
| --- | --- |
| 公開 `cause_status`、逐句出處對應、claim sidecar | N-08 已暫緩；H-02 限本機中間資料，且要先有 J-02 的 source packet |
| 實際擷取網址、標題／摘要／正文節錄的區分進 API 或畫面 | 報告 #15 原文說等 J-02 落地；本輪只把 URL 與截斷記在本機 manifest |
| 網頁或 App 新聞列表顯示推估的發布時刻 | 推估是一段區間，顯示成時刻會誤導；只用來分桶 |
| 把前一交易日的盤後新聞納入下一交易日的素材 | 會擴大選取範圍並改變摘要內容；本輪只分桶、不擴大 |
| 舊新聞補 `published_ago` | `fetched_at` 是第一次抓的時間，跟之後的 `ago` 不是同一次回應，補了會算錯 |
| `利多／利空` 標籤改名、tone enum 改值 | H-03 要求先做產品評估；UI 文字改動要雙端驗證，不在本輪 |
| 40 案金標全集與盲評 | 人工工作，放在 L2-T11 由站長做 |
| AI 月抽查 skill、verify 模擬器修正 | 屬 §6 #18 |
| AI 逾時的推播或 email 通知、新聞頁的「AI 尚未更新」降級提示 | J-01 明說本輪不發訊息；B-08 的降級提示不在 #15 範圍。狀態先放資料來源頁 |
| 自動清理 `.ai-batch/<kind>/runs/` | 自動刪除會毀掉追溯；容量估算見風險 |
| 記錄精確模型版本 | CLI 拿不到 Orca 傳給 agent 的模型；記 `unknown`，不編造 |
| 分散式鎖、自動重試、自動換模型 | 沒有並發事故或額度耗盡的實際紀錄；任務代號加後綴已足以防止舊答案寫錯新聞 |
| 改 `pull translate --check` 的寫檔行為 | 翻譯 prompt 直接讀 precheck 寫的 tasks.md（§2.1），一改就要動 Orca 設定 |

## 6. 風險

- **部署順序。** 先合併（Orca 立刻用新 CLI），再部署 Worker。空窗期新 CLI 遇到舊 Worker：所有新聞當成「無法確認」，摘要不會有因果句；回執的 `rejected` 退回用 `skipped.length`，不會寫 runs。**不要從分支先部署 Worker**：舊 CLI 只讀 `news`，只有未確認新聞的公司會拿到 `news: []` 的 digest 任務，舊 `digestPrompt` 會送出一份沒有任何新聞的提示詞。
- **Orca。** 本輪不改排程：precheck 指令、prompt 的固定路徑都不變。要同步的只有行為：(1) push 部分失敗會以 3 結束，agent 會回報失敗，這是預期；(2) `pull daily --check` 不再寫檔，每日 prompt 第 2 步本來就會自己 pull，不受影響；(3) 若要在 manifest 記模型 alias，日後可在 Orca prompt 的 push 指令前加 `AI_BATCH_MODEL=haiku`／`sonnet`（用 `orca automations edit`），本輪不做；(4) 主 checkout 要停在合併後的 main，`scripts/ai-batch-lib.ts` 必須跟 `scripts/ai-batch.ts` 一起存在。
- **歸檔容量。** 每個交易日最多 8 個非空批次（翻譯排程 6 次 precheck、每日排程的翻譯 1 次與每日 1 次；每日 precheck 不寫檔）。每日批次的 tasks.json 加 tasks.md 約數百 KB（15 篇正文 × 6000 字，tasks.md 再重複一次提示詞），翻譯批次約數十到一百多 KB，粗估一天 2 MB 內、一年 1 GB 以內，留在本機不進 git（`.ai-batch` 已在 `.gitignore`）。
- **`ago` 的語意不是官方文件。** 本輪只有 4 筆交叉核對支持「捨去」；判定「收盤前」用的上界在任何捨入方式下都成立，「收盤後」的小標可能因 CDN 快取把盤前誤標成盤後，影響只是一個小標。Nasdaq 拿掉 `ago` 時全部退回 unknown，不會出錯，只是不再有因果句。
- **migration 衝突。** 其他領域（例如 #2 的持股更正紀錄）也可能新增 migration；drizzle 的 snapshot 有前後鏈，兩條分支各自 `void db generate` 會撞。後合併的分支要在合併後的 main 上刪掉自己的 migration 與 meta、重跑 `npx void db generate`。
- **跨領域檔案重疊與合併規則。** 依整合者訂的合併順序逐一合併；L2 若在後，在整合分支 rebase 解衝突時保留先合併領域的語意，只加自己的部分：
  - `web/src/server/jobs.ts`：L2-T3 只動 `NEWS_UPSERT_SQL` 與 `jobNews`（L1、L3、L4、L6 改其他函式與 `JOBS`／`SCHEDULES`）。
  - `web/src/lib/sources/nasdaq.ts`：L2-T3 只動新聞解析（L1-T3、B-06、B-04 改其他函式）。
  - `web/pages/sources.server.ts`、`web/pages/sources.tsx`：保留 L1（`registry` props、清冊面板）與 L4-T6（`JOB_LABEL` 的展望相位平均）的新增，L2-T7 只加 `ai` props、`ai-*` 標籤、`'local'` trigger 與新區塊。
  - `web/src/server/views.ts`：`overviewView` 只動 `:96`、`:112`（A-07 改預測、L1-T2 改 `historyView`）。
  - `ios/MarketObservatory/Models.swift`（只動 `NewsPage`、`NewsDigest`、`MarketDigest`、新 `DigestSource`）、`OverviewView.swift`（只動市場重點卡附近；`:323` 屬 L1）。
  - 功能地圖 `news-calendar.md`、`overview.md`、`sources-admin.md`：L2 只改自己功能的小節，全部領域合併後由整合者統一對帳一次。
- **API 契約種子與 generated fixtures。** `web/tests/api-contract.test.ts:44-47` 這幾行會被 L2-T8（`:44-45` news_digests）、L6（`:46` analyst_views）、L4（`:47` forecasts、新增 settings）、L5（`:52` etfs 參數）同時改。衝突一律取聯集，各領域的列都保留；`ios/MarketObservatoryTests/Fixtures/generated/*.json` 不手動合併，每合併一個領域就在整合分支跑 `MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts`，審 diff 只多出該領域宣告的欄位，再跑 iOS `MarketObservatoryTests`（受模擬器鎖管制）。L2-T9 的 `sourcesMissing == 1` 斷言依賴 SPX 那列的 `'contract-news,contract-gone'`。
- **iOS 模擬器。** 全工作流程共用 `/tmp/mo-ios-sim.lock`，同一時間只開一台 MO 模擬器；一個領域的 `shutdown` 不會中斷另一個領域，因為拿不到鎖的一方根本還沒開機。L7-T1 合併前不跑 `ios-up.sh`、`down.sh`。
- **資料來源頁對所有登入者可見。** 新區塊只放狀態、時間與計數 summary，不放 detail、email 或錯誤堆疊。
- **iOS 部分要隨 App 發版才上線**；舊版 App 收到新欄位會忽略。

## 7. 需要你決定的事

1. **#7 的提示詞時間規則要不要等內容評估的閘門？** 建議不等：它修的是本輪實測到的失敗（4／4 收盤後新聞會被當成當天新聞），而且只限制模型能說的話。
2. **評估規格（`web/docs/news-ai-eval.md`）的內容是否同意凍結？** L2-T10 只合併草案；凍結要你讀過後在 L2-T11 決定。凍結後所有提示詞改動都要過它的門檻。
3. **holdout 由誰寫、何時簽核？** L2-T11 與 L2-T12 都卡在這裡；建議 4 類 × 4 案的合成新聞，由你審定金標後登記 hash。
4. **tone 重新定義（L2-T12）是否值得做？** 報告列為 #16 的一部分，但 V-H #12 說「是否更易懂仍需產品評估」；照規格要等 baseline 與盲評。

## 8. 已修好的項目

assigned 的條目在 HEAD 都還存在（§2 已逐一附行號）。相關但不在本輪處理：daily 已經不替抓不到正文的新聞寫重點（`web/scripts/ai-batch.ts:162-173` 只在 `bodies[i]` 有值時建任務），V-H #14 已確認，不要再當成 bug。

## 9. 審稿處置

| 審稿意見 | 處置 |
| --- | --- |
| ALL：iOS 驗收搶同一台模擬器、L7-T1 前 `ios-up.sh`／`down.sh` 會新增刪除 | 成立。§4.1 與 L2-T5、L2-T9 的開機那一步包進 `/usr/bin/lockf -k /tmp/mo-ios-sim.lock`，開機前檢查沒有其他 MO 模擬器開著、結束一定 shutdown；整合驗收照 `AGENTS.md:8` 手動寫 `sim.udid`，不跑 `ios-up.sh`、`down.sh`。鎖檔路徑要全工作流程共用，由整合者讓其他領域採用同一個。 |
| L2-T2：`pull daily --check` 是完整 pull，歸檔後每天多一個空批次 | 成立，但改用另一個做法：`pull daily --check` 改成只查不寫（2026-10-28 確認每日 prompt 第 2 步一定自己再 pull），所以根本不產生 check 批次，不需要 `pulledBy` 或 superseded 標記。`pull translate --check` 照舊寫檔。L2-T2 寫明歸檔語意（有 `receipt.json`＝推送過）給 L7-T4 使用；容量估計改成含翻譯 precheck 的每日最多 8 批。Yahoo 重複抓正文在 HEAD 就存在，這次只在 daily 有 market 或 digests 時跳過抓正文。 |
| L2-T10：凍結規格會跟著整包 PR 合併 | 成立。L2-T10 只交草案（檔頭「草案，未凍結」，並有測試擋住草案被改成已凍結），凍結移到 L2-T11，由使用者審閱後與 holdout 登記同一個 commit 合併；L2-T11 的 registration 改為 needs-new-entry；PR 描述要單獨列出這份文件。 |
| ALL：api-contract 種子相鄰行衝突、L2 行號錯 | 成立。行號改成 `:44-45`；§6 加「種子取聯集、fixtures 不手動合併、每合併一個領域重產並審 diff、再跑 iOS 測試」的規則。 |
| ALL：多領域改同一檔 | 成立。§6 列出 L2 涉及的共用檔與各自只動的範圍，以及 rebase 時要保留的先合併領域內容；功能地圖只改自己的小節，最後由整合者統一對帳。順帶補上 L2-T7 漏列的 `web/tests/leak-guards.test.ts`（它斷言 trigger 只剩 cron／manual）。 |
| ALL：acceptance 不能原樣執行 | L2 本來就用 `cd <worktree>/web && …`；改掉 L2-T11、L2-T12 驗收裡的 `<站長標註檔>` 等佔位符，換成固定路徑（`/tmp/mo-eval-baseline/…`、`evals/news-ai/runs/baseline.json`），`score` 加 `--out`。 |
| L2-T8：自寫分塊與 L1-T1 的 `inChunks` 重複 | 問題成立，修法不同：L2-T6、L2-T8 改用 `IN (SELECT value FROM json_each(?))`，每句只綁 1 個參數，完全不分塊，也不必等 L1 先合併（正式站已用 `json_each`，L1-T2 也選同一做法）。刪掉 L2-T8 測試的 `db.prepare` 包裝，只保留「長清單全部解析回來」，L1-T1 的假 D1 守門合併後順帶證明參數上限。 |
