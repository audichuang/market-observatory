# L1 資料（data）：D1 參數上限、資料完整性閘門、授權清冊與逐源停用

> 範圍：報告 §6 的 #1（B-01）、#2（B-02、B-11、B-07）、#17（B-09、S-03）。程式基準是 HEAD `8eaac29`（2026-10-28）。路徑預設相對於 `web/`，`ios/`、`.claude/` 相對於 repo 根。
> 這一輪只做資料閘門與來源治理：**不新增投資訊號、不改 forecast 模型或門檻、不重報任何成績**。報告 #1、#2、#17 的「登記」欄都是「否」，所以各票都不需要事前登記。價格資料因閘門而沒寫入時，既有的 `forecasts`（G02）與第二輪凍結輸入一律不動。
> 第二版（同日）：依交叉審稿修訂 T3（中段衝突只拒收那一天）、T4（拿掉修剪）、T6（名單頁也標示，字串共用）與全部 acceptance 的寫法，處置記在 §6。

## 1. 目標

1. 全站追蹤到上限（100 家，含多股類約 103 個代號）時，抓價、核對、快照重算不會因為單一 D1 查詢超過 100 個綁定參數而整個失敗。個人名單 30 家時，走勢頁也不會。
2. 日線寫進 D1 前先過閘門。頻率不是日線、或是空歷史，整份回應拒收並列為失敗；同一天出現兩筆不同收盤，**拒收那一天**並在執行紀錄寫明。不再出現「成功但零筆」，也不再「最後一筆蓋掉前一筆」。
3. 分割修復要真的覆蓋已存的價格區間才解除待修，不再留下新舊基準混接。
4. SPY 持股檔同一個 as_of 的更正版整批原子替換，並留下更正紀錄。持股檔停更時，總覽歸因、名單頁、資料來源頁都標「權重未更新」，用同一句話。
5. 建立來源授權清冊，記下每個來源在自動取得、保存、公開顯示、衍生、AI 處理五項上的條款狀態，並能逐源停用自動取得。

## 2. 現況與證據（在 HEAD 逐一確認，都還存在）

| 問題 | 證據（HEAD 行號） | 研究出處 |
| --- | --- | --- |
| `upsertBars` 的 `IN` 綁 `symbols + minDate`，全站 100 家約 116 個 | `src/server/repo.ts:43-46`；代號來源 `src/lib/universe.ts:60-68`（SPX、RSP、USDTWD＋名單＋11 檔 ETF）；`MAX_TRACKED=100` 在 `src/lib/watchlist.ts:15` | B-01、V-B #1 |
| `applyCrossChecks` 同樣，約 113 個 | `src/server/repo.ts:143-146`；`src/lib/universe.ts:72-78` | 同上 |
| `loadPrices`（快照重算）約 105 個 | `src/server/repo.ts:169-174`；呼叫端 `src/server/jobs.ts:103` | 同上 |
| `loadWeightAnchors` 綁全部名單代號 | `src/server/repo.ts:202-206`；呼叫端 `src/server/jobs.ts:101` | R2 §3 B-01 列 |
| **報告沒列、同一個根因**：走勢頁「名單貢獻」查詢綁 `keys, tickers, keys, tickers`，也就是 2×(家數＋代號數)。個人上限 `MAX_WATCH=30`（`src/lib/watchlist.ts:9`），26 家單一股類就是 104 個，整頁失敗（網頁與 App 共用這段） | `src/server/views.ts:191-210`（`.bind` 在 :209） | 本 spec 新發現 |
| 假 D1 用 node:sqlite，沒有 100 個參數上限，所以現有壓測抓不到 | `tests/helpers/fake-cloudflare.ts:17-21` | B-01、V-B #1 |
| repo.ts 開頭註解宣稱「不會撞到單一查詢參數上限」，與實情不符 | `src/server/repo.ts:6` | — |
| Yahoo parser 不讀 `meta.dataGranularity`（型別裡也沒有這欄），合成的 `3mo` 照收 | `src/lib/sources/yahoo.ts:13-22`、`:28-55` | B-02、V-B #2 |
| Yahoo 同一天兩筆不同收盤時「保留最後一筆」；Nasdaq、Cboe parser 完全不檢查重複 | `src/lib/sources/yahoo.ts:40-54`；`src/lib/sources/nasdaq.ts:35-45`；`src/lib/sources/cboe.ts:15-34` | B-02、V-B #2 |
| 空歷史被當成功：chart 回零筆時 `fetchYahooBatch` 照樣放進 `ok`；Nasdaq rows 空時核對零筆仍 ok；Cboe 在 since 之後沒資料時回 `[]` | `src/lib/sources/yahoo.ts:57-63`、`src/server/jobs.ts:114-124`；`src/lib/sources/nasdaq.ts:47-50`、`src/server/jobs.ts:221-228`；`src/lib/sources/cboe.ts:36-39` | B-02 |
| **同一根因、使用者看得到的後果**：加入全站沒人追蹤的公司時，十年日線回空也照樣加入（「補了 0 筆日線」），但註解寫「抓不到就整個不加」 | `src/server/jobs.ts:830-839`；註解 `:801-802` | 本 spec 依 B-02 推得 |
| 十年日線與三十年 Cboe 歷史都走同一批 parser：分割重抓、回補、加入新公司用 Yahoo 10y（`src/server/jobs.ts:184`、`:284`、`:832`），指數歷史讀 Cboe 全檔（`:318`）。分割待修的代號在重抓成功前，每天的一個月日線也不寫（`:177`） | 同左 | 審稿 #3 |
| 2026-10-28 規劃時，在本機對 `query1.finance.yahoo.com` 唯讀抓 22 檔 10y chart，全部回 HTTP 429；改打 `query2` 單發一次也是 429。**未實測**：Yahoo 十年日線中段有沒有同日不同收盤，目前沒有資料 | 本 spec 實測（`/tmp` 下的一次性腳本，沒寫進 repo） | 審稿 #3 |
| 分割重抓只要 fetch 成功就解除待修，空表、短表都算；短表以 `allowRebase` 寫入，造成混基準 | `src/server/jobs.ts:182-187`；`src/lib/rebase.ts:32-40` | B-11、V-B #3 |
| 十年窗口以外的舊列不會跟著換基準（重抓是相對「現在」的 10y）。回補路徑 `jobBackfillPrices` 也是以 `allowRebase` 寫 10y、窗口外不動 | `src/server/jobs.ts:184`、`:284-285`、`:832` | B-11 |
| 持股檔同一 as_of 只 upsert，新版裡消失的代號會殘留；`batchRun` 每 200 句一個 batch，500 檔分三個 batch，不是原子 | `src/server/repo.ts:13-17`、`:188-193`；`src/server/jobs.ts:249-260` | B-07、V-B #9 |
| 同 as_of 更正不更新 `fetched_at`，也沒有更正紀錄 | `src/server/repo.ts:190` | B 時間欄位補充 |
| 合法但停更的持股檔沒有檔齡判斷：`weightsNear` 只取最近一份，快照只寫「依價格推算」；名單頁只寫「權重來自 {asOf} 的 SPY 持股」，`latestHoldings` 取最大 as_of、不看多舊 | `src/server/repo.ts:217-223`；`src/lib/snapshot.ts:140-142`、`:211-214`；`src/server/watchlist.ts:83-88`；`pages/watchlist.tsx:110`、`:141` | B-07、審稿 #1 |
| 名單頁 loader 直接回 `watchlistView`；`/api/v1/watchlist` 的 GET 也直接回它（改 `watchlistView` 就會改到 API） | `pages/watchlist.server.ts:8`；`routes/api/v1/watchlist.ts:7` | 審稿 #1 |
| SSGA 持股網址每次 301 轉址，多花一個子請求（`web/AGENTS.md`：直接打最終網址）。2026-10-28 規劃時以 `curl` 確認最終網址回 `200 0` | `src/lib/sources/ssga.ts:5-6`、`:80` | B-07、V-B #9、E |
| 沒有任何來源清冊或停用開關 | 全 repo 沒有 registry；外部請求唯一的關口是 `Budget.take`（`src/lib/sources/http.ts:28-33`、`:68`；`src/lib/sources/factset.ts:98`） | B-09、R2 #14 |

**檢查過、不需要改的動態參數查詢**（上界由現行上限推得）：`src/server/jobs.ts:523`（5 個日期）、`src/server/news-ai.ts:21`（個人名單 ≤30＋2）、`src/server/ai-batch.ts:151`（≤20）、`src/server/views.ts:92`（個人名單代號約 ≤35＋1）、`src/server/views.ts:366`（新聞 LIKE，≤31）、`routes/api/v1/devices.ts:26`（子查詢，3 個）。

**已修好的報告條目：** 沒有。上表每一條在 HEAD 都還存在。

## 3. 票（同一分支依序實作：T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8）

驗收指令一律寫成 `cd <worktree>/web && …`，`<worktree>` 是這個 lane 的 worktree 根目錄。新開的 worktree 要先跑 `npx void prepare`。`node --test tests/api-contract.test.ts` 不帶 `MO_UPDATE_API_FIXTURES` 時，會斷言 `ios/MarketObservatoryTests/Fixtures/generated/` 零 diff；L1 沒有任何票改 `/api/v1`，所以這個指令通過就代表 fixture 沒變。

### L1-T1　D1 `IN` 查詢分塊＋假 D1 參數上限（#1、B-01）

**行為**：四個查詢對任意長度的代號清單，都只發每句 ≤100 個參數的查詢，結果與分塊前完全相同。

- `src/server/repo.ts`
  - 新增 `export const D1_MAX_BOUND_PARAMS = 100` 與 `export function inChunks<T>(values: T[], reserved: number): T[][]`：先去重，每塊長度 ≤ `100 − reserved`，空陣列回 `[]`。
  - `upsertBars`（:43）、`applyCrossChecks`（:143）：依代號分塊查既有收盤（reserved=1，留給 `minDate`），結果併進同一個 Map。
  - `loadPrices`（:169）：代號去重後分塊（reserved=2）。**SQL 文字不變**，因為 `tests/stress-watchlist.test.ts:176` 用 regex 攔截這句。同一代號只會落在一塊，每檔的日期順序不變。
  - `loadWeightAnchors`（:202）：分塊（reserved=0）。清單為空時不發 `IN` 查詢，但仍載入全部 as_of（`tests/watchlist.test.ts:185-192` 的情境）。
  - 改正 `:6` 的註解。
- `tests/helpers/fake-cloudflare.ts`：`migratedDb()` 的 `bound(q, args)` 在 `args.length > 100` 時，於 `first/all/run` 執行時 reject，訊息含 `too many SQL variables` 與實際數量，模擬 D1。`saveSnapshots` 的 `?1..?5` 只綁 5 個值、`insertMissingBars` 每句 96 個，都要照常通過。

**修正前會失敗的測試**（新檔 `tests/d1-param-limit.test.ts`）：
1. 假 D1 本身：綁 101 個參數的 SELECT reject，96 個通過。
2. 全站聯集：`seededDb()`＋寫入四份名單（站長 30 家，三位使用者各補到合併後 100 家，含 GOOGL/GOOG、FOXA/FOX、NWSA/NWS、BRK-B），FakeUpstream＋`consistentSpx`，`invokeCron("prices")`、`invokeCron("crosscheck")`。斷言兩個 run 的 status 都不是 `failed`、summary 不含 `too many SQL variables`，最新快照 `mag7.length === 100`。**修正前**：`upsertBars` 綁 116 個參數，prices run 為 `failed`。
3. 直接呼叫 `loadPrices`、`loadWeightAnchors` 帶 110 個代號：每檔資料與逐檔單查的結果相同，日期遞增。

### L1-T2　走勢頁名單貢獻查詢的參數數量（B-01 同一根因，報告沒列）

**行為**：名單 30 家（含多股類）的使用者打開走勢頁（網頁 `/history`、App `/api/v1/history`）不再失敗，回應內容與修正前小名單時一致。

- `src/server/views.ts:191-210`：四處 `IN (${placeholders(...)})`（:199、:200、:203、:204）改成 `IN (SELECT value FROM json_each(?1))`（key）與 `IN (SELECT value FROM json_each(?2))`（代號），`:209` 改成 `.bind(JSON.stringify(keys), JSON.stringify(tickers))`，刪掉區域函式 `placeholders`（:193）。選 `json_each` 的理由：參數固定 2 個，不隨 `MAX_WATCH` 變；diff 也只限這段 SQL 與 `.bind`（A-12 的票也會改 `historyView`）。空名單時 `json_each('[]')` 沒有列，語意與現在的 `IN (NULL)` 相同。

**修正前會失敗的測試**（`tests/d1-param-limit.test.ts` 追加）：一般使用者名單 30 家單一股類（`FILLERS`），至少一天的快照含這些公司。斷言 `historyView(ctx, viewer)` 不 reject、`contribution` 有資料、每天的名單合計等於逐家相加。修正前在 T1 的守門下綁 120 個參數，會 reject。`tests/api-contract.test.ts` 照過（`generated-history.json` 零 diff）。

### L1-T3　日線解析閘門：頻率、空歷史、衝突重複日（#2、B-02）

**行為**：

- **頻率**：Yahoo chart／spark 結果的 `meta.dataGranularity` 存在且不是 `"1d"` 時，丟 `SourceError`「回應頻率是 3mo，不是日線」，**整份拒收**。欄位不存在時照舊接受：spark 內嵌結果是否一定帶這欄還沒確認，缺欄就拒收的話，每天的收盤會全部失敗。
- **空歷史**：`fetchYahooDaily`、`fetchNasdaqHistorical`、`fetchCboeDaily` 解析後零筆時，丟 `SourceError`「回應沒有任何日線」（Cboe 是「{since} 之後沒有資料」），**整份拒收**。這個檢查放在 fetch 函式，不放 parser：spark 本來就會略過空結果、交給逐檔 chart 補抓（`yahoo.ts:89`），補抓遇空就列 failed；`parseEarningsCalendar` 不動，因為沒有財報的日子本來就是空的。
- **同一天多筆**：`src/lib/sources/http.ts` 新增 `dedupeDaily(rows: DailyBar[], lastDayKeepsLatest: boolean): { bars: DailyBar[]; conflicts: DayConflict[] }`（`DayConflict = { date: string; closes: number[] }`），三個 parser 都改用它，輸出依日期遞增：
  - 收盤都在 `sameClose` 容差內：合併成一筆，留來源順序裡最後出現的那筆。
  - 收盤不同：**這一天兩筆都不採用**，記一筆 `DayConflict`。同一份回應的其他日子照常採用。
  - 唯一例外：Yahoo（`lastDayKeepsLatest = true`）序列的**最後一天**維持現行的「保留最後一筆」，因為那是盤中即時列；`prices` 另外會以 `latestExpectedClose` 截斷。Nasdaq、Cboe 沒有例外。
  - 為什麼只拒收那一天、不讓整檔失敗：分割重抓、回補、加入新公司、指數歷史都會讀十年以上的資料（見 §2）。若中段某一天有一處舊瑕疵就整檔失敗，那檔會永遠補不起來；分割待修的代號連每天的一個月日線都停寫。報告 #2 要的是「拒收衝突重複日」，拒收那一天就符合字面。
- **紀錄要看得到**：
  - parser 加一個選填的輸出參數，回傳型別不變，既有呼叫端不用改：`parseYahooChart(json, expectSymbol, conflicts?: DayConflict[])`、`parseYahooSpark(json, conflicts?: Record<string, DayConflict[]>)`、`parseNasdaqHistorical(data, conflicts?)`、`parseCboeCsv(text, since?, conflicts?)`。
  - `Budget`（`http.ts:19`）新增 `readonly dataIssues: string[] = []`。`fetchYahooDaily`、`fetchYahooSpark`（只記結果有保留的代號）、`fetchNasdaqHistorical`、`fetchCboeDaily` 把每筆衝突寫成「{來源} {代號} {日期} 有兩筆不同收盤（a、b），這天的資料不採用」，推進 `budget?.dataIssues`。Yahoo 的 {代號} 是請求用的代號（`^GSPC`、`TWD=X`、`BRK-B`），因為 fetch 函式只知道它；Nasdaq 用 `fetchNasdaqHistorical` 的 `symbol`，Cboe 用 `VIX`／`SPX`。選 Budget 的理由：它是每次執行唯一一路傳到所有 fetch 函式的物件；另開參數的話，要改約 10 處簽名，而且都在 jobs.ts 這個衝突熱點。
  - `runJob`（`src/server/jobs.ts:747`）：執行前記下 `budget.dataIssues.length`，工作回來後把新增的放進 `detail.dataIssues`。有新增、而且工作原本是 `ok` 時改成 `partial`；summary 尾端加「；{N} 筆日線同日兩筆不同收盤、未採用：{前 3 筆}」，超過 3 筆時以「…」結尾。例外路徑的 `detail` 也帶 `dataIssues`。不新增 `runs.status` 值。
  - `addWatchSymbol`（`jobs.ts:805`）：抓完十年日線後若有新增的 dataIssues，照常加入，summary 加「；略過 {N} 天同日兩筆不同收盤的日線（{日期}）」。
- **連帶效果**：加入新公司時若十年日線回空，回「抓不到 X 的歷史股價（…）」，不加入；crosscheck 遇 Nasdaq rows 為空時，該檔列 failed（現在是 ok、核對 0 筆）；Nasdaq 衝突的那一天不核對，照既有規則留在「尚待第二來源核對」。
- `sameClose` 從 `src/server/repo.ts:120` 移到 `src/lib/sources/http.ts`（lib 不能 import server），`repo.ts` 改成 re-export，所以 `repo.ts:76` 與 `tests/budget.test.ts:5`、`:91-94` 不用改。
- `tests/helpers/fake-cloudflare.ts` 的 `chartResult` meta 加 `dataGranularity: "1d"`，讓正向路徑被測到；並 `export` 它（目前沒有匯出）。`Rule` 是同步函式、拿不到預設回應的 body，下面的測試與 T4 都用 `chartResult(symbol, weekdays(n, end), false)` 自組 chart JSON，再按需要多插一筆時間戳。

**修正前會失敗的測試**：
- `tests/sources.test.ts`：
  - 合成 `meta.dataGranularity: "3mo"` → `assert.throws(/日線/)`（V-B #2：現在回 DailyBar 陣列）。
  - 三天序列、中間那天兩筆 close 10、20 → 結果沒有那一天、前後兩天都在，`conflicts` 是 `[{ date, closes: [10, 20] }]`（現在那天回 20）。
  - 最後一天兩筆不同 → 回後者、`conflicts` 為空；同日相同收盤 → 一筆；`"1d"` 與缺欄位都接受。
  - `parseNasdaqHistorical`、`parseCboeCsv` 同日不同收盤 → 該日不在結果、`conflicts` 有一筆（現在同一日期回兩列）。
- 新檔 `tests/data-gates.test.ts`：
  1. FakeUpstream 規則讓 `QAA` 的 chart `range=10y` 回空 timestamp → `addWatchSymbol(db, "QAA")` 回 `ok:false`、error 含「抓不到」、名單沒變、prices 沒有 QAA 列（現在 `ok:true`）。
  2. 規則讓某檔 Nasdaq historical 回 `rows: []` → `runJob(db, "crosscheck")` 的 `detail.failed` 有該檔（現在 ok）。
  3. 做法固定為「spark 回 500、逐檔 chart 補抓」，不自組整批 spark JSON。對照組：seeded 環境只加「`/v7/finance/spark` 回 500」規則，`runJob(db, "prices")` 的 status 是 `ok`。實驗組：新 DB、同一條 spark 規則，再加一條規則攔 NVDA 的 `range=1mo` chart，回 `chartResult("NVDA", weekdays(22), false)` 並在中段某一天多插一筆時間戳（同一天、+60 秒）與不同收盤 → status `partial`、`detail.dataIssues` 有 `/NVDA .*兩筆不同收盤/`、summary 含「未採用」、prices 沒有 NVDA 那一天（現在 status `ok`、那天寫入第二筆）。
  4. 規則讓 `QAA` 的 10y chart 中段某一天有兩筆不同收盤 → `addWatchSymbol` 回 `ok:true`、summary 含「略過 1 天」、prices 沒有那一天、其他天都在。
- 既有的 `tests/budget.test.ts`、`tests/cron-budget.test.ts`、`tests/stress-watchlist.test.ts`、`tests/backfill-history.test.ts` 照過（假資料沒有重複日）。

**選做、不擋合併**：在 Yahoo 回 200 的時段（不走代理），於 `<worktree>/web` 跑下面這個唯讀指令（約 22 個請求），把每檔的衝突數貼進 PR 描述。指令用 `fetchWithTimeout`，所以 UA 與正式抓價相同，遇 429 只重試一次。若中段衝突很多，回報使用者，不改這張票的行為：

```
cd <worktree>/web && node --input-type=module -e 'import { fetchWithTimeout } from "./src/lib/sources/http.ts"; import { yahooChartUrl, parseYahooChart } from "./src/lib/sources/yahoo.ts"; import { yahooSymbols, DEFAULT_WATCHLIST } from "./src/lib/universe.ts"; for (const p of Object.values(yahooSymbols(DEFAULT_WATCHLIST))) { try { const r = await fetchWithTimeout("probe", yahooChartUrl(p, "10y"), { headers: { Accept: "application/json" } }); const c = []; const b = parseYahooChart(await r.json(), p, c); console.log(p, b.length, "conflicts", c.length, JSON.stringify(c.slice(0, 3))); } catch (e) { console.log(p, "ERR", e.message); } await new Promise((s) => setTimeout(s, 500)); }'
```

### L1-T4　分割修復要覆蓋已存區間才解除待修（#2、B-11）

**行為**：`jobPrices` 的分割重抓（`src/server/jobs.ts:179-191`）只對「重抓結果覆蓋已存區間」的代號以 `allowRebase` 寫入，並移出待修。沒覆蓋的**不寫**，留在待修，`failed` 寫明原因，下一輪重試。**不刪任何已存列**。

- `src/lib/rebase.ts` 新增純函式 `refetchCoverage(stored: { min: string; max: string } | null, fresh: DailyBar[], upTo: string)`，回 `{ ok: true } | { ok: false; reason: string }`：
  1. `fresh` 為空 → 不涵蓋（T3 之後實際走不到，純函式仍要定義）。
  2. `stored` 為 null → 涵蓋。
  3. `fresh` 最後一天早於 `stored.max` → 不涵蓋（「重抓只到 X，早於已存的 Y」）。
  4. `fresh[0].date <= stored.min` → 涵蓋。新上市、歷史本來就短的公司走這條。
  5. `fresh[0].date <= addDays(upTo, -REBASE_COVER_DAYS)` → 涵蓋。窗口外的舊列保留，仍是舊基準。
  6. 其他 → 不涵蓋（「重抓從 X 開始，未涵蓋已存的 Y 起」）。
- `REBASE_COVER_DAYS = 2200`。產品讀得最深的是走勢頁：60 個月加 320 天暖機（`src/server/views.ts:125`、`:152-156`），約 2146 天；ETF 定投 1900 天（`views.ts:282`）；快照 430 天（`src/lib/snapshot.ts:280`）。這是維運常數，不依市場結果調。不能只用「重抓起點 ≤ 已存最早日」一個條件：重抓是相對現在的 10y，起點比加入當時的 10y 晚，會讓每一次真實分割都永久待修。
- 第 5 條與常數旁要寫註解：「窗口外的舊列沒有換基準。日後若新增比 REBASE_COVER_DAYS 更深的讀取（例如 10 年定投），要先處理這些列」。回補路徑（`jobs.ts:284-285`）本來就是同樣行為。
- `src/server/repo.ts` 新增 `priceRanges(db, symbols)`：`SELECT symbol, MIN(date), MAX(date) … GROUP BY symbol`，用 T1 的 `inChunks` 分塊。
- `detail.rebased` 增加 `uncovered`（代號 → 原因），`failed[s]` 寫「分割後重抓的歷史未涵蓋已存區間，保留待修、下次重試：<原因>」。

**修正前會失敗的測試**：
- 新檔 `tests/split-repair.test.ts`：
  1. V-B #3 原樣：QAA 在站長名單，已存 4 天收盤 20（`yahoo-chart`），`pending_rebase = {QAA: 2}`，規則讓 QAA 的 10y chart 只回最後一天收盤 10 → `runJob(db, "prices")` 後待修仍含 QAA、四天仍全是 20、`detail.failed.QAA` 含「未涵蓋」。**修正前**：待修清空，前三天 20、末日 10。
  2. 10y 從已存最早日之前開始 → 寫入、待修清除。
  3. 已存列從 2400 天前開始，重抓從 2300 天前開始（早於 `upTo − 2200`；規則回 T3 匯出的 `chartResult` 自組 JSON）→ 窗口內寫入新值、待修清除；2300 天前以前的列筆數與收盤都不變（證明沒刪、沒改）。
- `tests/rebase.test.ts`：`refetchCoverage` 六條分支的表格測試。
- 既有的 `tests/cron-budget.test.ts:174-187`（全部待修 → 全部清空）必須照過：那裡的已存列與假 10y（260 個平日）同起點或根本沒有，走第 2、4 條。

### L1-T5　持股同日集合原子替換＋更正紀錄＋直接打最終網址（#2、B-07）

**行為**：

- `src/server/repo.ts` 的 `insertWeights`（:188）改為 `replaceWeights(db, asOf, holdings, fetchedAt?)`：
  1. `SELECT ticker, name, weight_pct, shares, fetched_at FROM weights WHERE as_of = ?`（1 個參數），在 JS 比對。**不要**寫 `DELETE … ticker NOT IN (500 個)`，那正是 B-01 本身。
  2. 內容完全相同 → 不寫，回 `{ unchanged: true }`，`fetched_at` 保留首次取得時間。
  3. 有差異 → **一次** `db.batch`：每個消失的代號一句 `DELETE … WHERE as_of = ? AND ticker = ?`，再加多列 `INSERT … ON CONFLICT(as_of, ticker) DO UPDATE SET name, weight_pct, shares, fetched_at`（每句 16 列 × 6 欄 = 96 個參數，約 32 句）。整個 as_of 的 `fetched_at` 改成這次取得時間，代表目前這一版。回 `{ previous, removed, added, changed, previousFetchedAt }`。
- `jobWeights`（`src/server/jobs.ts:249-260`）：summary 改成「持股日期 X（N 檔）；同日更正：移除 A、B；新增 C；權重變動 M 檔（上一版取得於 …）」或「…已存在、內容相同」，取代現在的「已存在、覆寫」。`detail.correction` 存同樣內容。
- **更正紀錄存在 `runs`**：全 repo 沒有清除 `runs` 的語句（沒有 `DELETE FROM runs`），`/sources` 的執行紀錄會顯示 summary（detail 不外送，見 `tests/leak-guards.test.ts`）。本輪沒有畫面要讀獨立的更正表，所以不加 migration。
- `src/lib/sources/ssga.ts:5-6` 的 `SSGA_SPY_URL` 改為最終網址 `https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx`。B、V-B #9、E 在 2026-10-28 實測是 301→200；規劃時也再以 acceptance 第一條確認是 `200 0`。

**修正前會失敗的測試**（新檔 `tests/weights-replace.test.ts`）：
1. V-B #9：同一 as_of 先寫 SYN1、SYN2，再只寫 SYN1 → SYN2 不存在、`removed = ["SYN2"]`。修正前 SYN2 仍在。
2. 原子性：第二版含一列違反 NOT NULL（name 為 null）→ reject，該 as_of 仍是第一版的完整集合。
3. 內容相同 → `unchanged`、`fetched_at` 不變、沒有呼叫 `db.batch`。
4. 505 檔替換只呼叫一次 `db.batch`，每句 ≤100 個參數（T1 守門）。
5. `jobWeights` 層：FakeUpstream 規則以 `fflate.zipSync` 組一份 500 檔的最小 xlsx（inline string），回給**最終網址**。斷言 `upstream.hosts["www.ssga.com"] === 1`、請求路徑是最終網址、summary 含「同日更正」與被移除的代號。

### L1-T6　「權重未更新」標示：總覽歸因、名單頁、資料來源頁同一句（#2、B-07）

**行為**：

- 新檔 `src/lib/weights-age.ts`（純函式，不碰 D1；之後 L5-T9 的 `src/lib/overlap.ts` 要直接 import，這樣才會是「同一個判斷、同一句話」）：
  - `export const WEIGHTS_STALE_SESSIONS = 2`。依據是 `README.md:22`「SSGA 持股檔通常落後 1～2 個交易日」，屬於維運常數，不用市場結果挑。
  - `export function weightsLagSessions(asOf: string, target: string): number | null`：`asOf >= target` 回 0；兩端都在 NYSE 日曆覆蓋內時，回 `expectedSessions(addDays(asOf, 1), target).length`；否則回 null，不判斷（`expectedSessions` 超出範圍會丟錯）。
  - `export function weightsStaleNote(asOf: string | null | undefined, target: string | null | undefined): string | null`：落後 > `WEIGHTS_STALE_SESSIONS` 時回「權重未更新：最新 SPY 持股停在 {asOf}，到 {target} 已落後 {n} 個交易日（通常落後 1～2 個），成分與股數變動沒有反映」，其他情況（含 null、日曆外）回 null。**這是全站唯一的字串來源**。
- `buildSnapshot`（`src/lib/snapshot.ts:109`）：`weightsStaleNote(input.weights.asOf, weightTarget)` 不為 null 時推進 `quality.notes`。**只依 (asOf, weightTarget)，不看系統時間**：快照以 digest 去重（`src/server/repo.ts:235-241`），用系統時間會讓每輪重算都多一版。沒過期的快照內容完全不變，不會新增 revision。`/api/v1` 形狀不變（`notes` 本來就是字串陣列）；網頁（`pages/index.tsx:183-185`）與 App（`ios/MarketObservatory/Views/OverviewView.swift:428`）已經會顯示 notes，App 不用改。
- `jobWeights`：`weightsStaleNote(file.asOf, latestExpectedClose())` 不為 null 時，status 改 `partial`，summary 前面加上這句。
- 頁面的「應有日期」一律用 `latestScheduledClose()`，與 `/sources` 現有的「落後」標記同一個基準（避開收盤到抓價排程跑完之間約一小時的誤報）：
  - `/sources`（`pages/sources.server.ts`）：loader 回傳加 `weightsStale: weightsStaleNote(weights.results[0]?.as_of, expected)`（`expected` 已是 `latestScheduledClose()`，快取鍵已含 `close=`）。`pages/sources.tsx`「SPY 持股檔」面板（:115）標題下方顯示 `<div className="notice warn">{weightsStale}</div>`。
  - **名單頁**（`pages/watchlist.server.ts:8`）：loader 改成 `const view = await watchlistView(c, requireViewer(c)); return { ...view, weightsStale: weightsStaleNote(view.asOf, latestScheduledClose()) };`。**不改 `watchlistView`**，因為 `/api/v1/watchlist` 也直接回它（`routes/api/v1/watchlist.ts:7`），改了就動到 API 與 `generated-watchlist.json`，也會和 L5-T9 對 `watchlistView:390-398` 的重構衝突。`pages/watchlist.tsx` 在「目前 N 家　合計權重 X%」標題（:108-112）下方顯示 `{weightsStale && <div className="notice warn">{weightsStale}</div>}`；`:141` 的 as-of 句不動。名單頁 loader 本來就是每人一份、不經 `cachedPage`，用當下時間沒問題。
- `src/server/views.ts:90` 的 7 天「其他成分股」容忍**不動**：用途不同（判斷那份持股能不能代表當天成分），改了會動到總覽，屬 A-07 那張票的檔案。

**修正前會失敗的測試**：
- 新檔 `tests/weights-age.test.ts`：
  - `weightsLagSessions` 單測：跨週末、跨 2026-11-26 休市、`asOf >= target` 回 0、2024 年日期回 null 且不丟錯。
  - `weightsStaleNote`：落後 2 個交易日回 null，落後 3 個回含「權重未更新」與兩個日期的字串。
  - sources loader（照 `tests/leak-guards.test.ts:22-24`，以 `{ env: { DB } }` 呼叫）：weights 只有一份 as_of＝`latestScheduledClose()` 前 5 個交易日 → `weightsStale` 含「權重未更新」；as_of＝`latestScheduledClose()` → null。
  - 名單頁 loader：直接呼叫 `pages/watchlist.server.ts` 的 `loader`，ctx 為 `{ env: { DB }, req: { query: () => undefined, url }, get: (k) => k === "user" ? 測試使用者 : undefined }`，同樣兩種情境斷言 `weightsStale`；回傳的其他欄位與 `watchlistView` 相同。
  - 這兩個 loader 測試依賴當下日期；`latestScheduledClose()` 超出日曆覆蓋（2027-12-31 之後）時以 `t.skip("NYSE 日曆覆蓋外")` 標明。
  - 新功能：修正前 `src/lib/weights-age.ts` 不存在，import 就失敗；loader 沒有 `weightsStale`。
- `tests/snapshot.test.ts`：持股落後 weightTarget 5 個交易日 → notes 有 `/權重未更新/`（修正前沒有）；落後 2 個 → 沒有；持股晚於 target（回補）→ 沒有；2024 年日期（日曆範圍外）→ 沒有、也不丟錯。
- `tests/weights-replace.test.ts` 追加 `jobWeights` 層：合成 xlsx 的 as_of 設成 `latestExpectedClose()` 前 5 個交易日 → status `partial`、summary 含「權重未更新」。
- `tests/api-contract.test.ts` 照過（fixture 的持股 as_of 晚於快照日，notes 不變；`api-contract` 直接呼叫 `watchlistView`，不經頁面 loader）。

### L1-T7　來源授權清冊（#17 前半、B-09、S-03）

**行為**：新增 `src/lib/sources/registry.ts`（純資料，不碰 D1），附 `sourceForUrl(url)`。每筆有：`id`、名稱、`runtime`（`worker`／`local`／`manual`／`static`）、`patterns`（比對實際請求網址的 RegExp）、用在哪些工作與畫面、取得的欄位、停用影響；五項權利（自動取得、保存、公開顯示、衍生計算、AI 處理）各自的狀態（「未取得（條款限制）」「官方公開，需標示來源」「未查」「不適用」）加一句依據；條款網址、條款版本日（未核實就填 null 並寫原因）、本站查閱日、依據文件。

| id | runtime | 端點／內容 | 條款與版本（查閱 2026-10-28） |
| --- | --- | --- | --- |
| `yahoo-chart` | worker | `query1.finance.yahoo.com` chart／spark：個股、ETF、^GSPC、TWD=X 日線，分析師共識用的現價 | legal.yahoo.com Terms；**沿用前輪 2026-08-04 版，本輪讀取回 999、未重核**；前輪記載禁止未經許可的自動擷取 |
| `cboe-index` | worker | `cdn-api.cboe.com` VIX、SPX CSV：VIX 主價、SPX 核對、窗口前歷史 | cboe.com/terms，2022-11-16；§2 限個人非商業一份下載，保存、顯示、衍生、**用來核對或更正他源資料**原則上都要書面同意（含 fair use 例外） |
| `nasdaq-quote` | worker | `api.nasdaq.com/api/quote/…/historical`：收盤交叉核對 | nasdaq.com/legal；§2 資料擷取限制、§6 個人非商業、§7 分享／衍生／AI 限制；**B 記 Last Updated 2026-05-11，但 V-B #15 沒親見版本日，填 null** |
| `nasdaq-news` | worker | `www.nasdaq.com/api/news/…`：新聞標題、摘要，也是本機 AI 翻譯與重點的輸入 | 同上 |
| `nasdaq-analyst` | worker | `api.nasdaq.com/api/analyst/{s}/targetprice`、`/earnings-forecast` | 同上 |
| `nasdaq-earnings` | worker | `api.nasdaq.com/api/calendar/earnings`、`/api/analyst/{s}/earnings-date`（後者含 Zacks 推估） | 同上；另列 zacks.com Terms 2025-02-19（限制擷取與再散布；沒看到 Nasdaq 轉授權） |
| `ssga-holdings` | worker | `www.ssga.com` SPY 持股 xlsx | SSGA 美國站 Terms and Conditions，沒看到修訂日；限制對外發布、再傳，不得替代 supplier 授權 |
| `factset-insight` | worker | `www.factset.com/earningsinsight` → `advantage.factset.com` PDF | factset.com/legal Terms of Use，沒看到修訂日；限制自動擷取、scraping、修改、翻譯、衍生 |
| `yahoo-news-local` | local | `scripts/ai-batch.ts` 的 `query2.finance.yahoo.com` 搜尋與配對文章頁 | 同 Yahoo；Worker 開關管不到，要停就改本機排程 |
| `nyse-calendar`、`fed-fomc`、`bls-schedule` | static | `src/lib/calendar.ts` 內建日程 | Fed disclaimer：public domain、需註明來源；NYSE、BLS 條款未查 |
| `etf-catalog`、`strategists` | manual | `src/lib/universe.ts` 人工查核的發行商資料、`src/lib/strategists.ts` 人工表 | 各發行商／媒體的條款沒有逐一查 |

**`nasdaq-analyst` 必須列出 L6 #10 會新顯示的欄位**，並寫明它們**已經在抓、也已經存**（`src/lib/sources/nasdaq.ts:203-219`、`analyst_views` 欄位）。L6 #10 只改顯示，取得與保存的條款狀態與現用欄位相同：`targetprice` → `priceTarget`（顯示中）、`lowPriceTarget`／`highPriceTarget`（已存未顯示，L6 #10 預定顯示）、`buy/hold/sell`（顯示中）；`earnings-forecast` → `fiscalEnd`、`consensusEPSForecast`、`noOfEstimates`（已存未顯示，L6 #10 預定顯示）、`up/down`（彙總顯示中，L6 #10 預定逐股顯示）；歷月共識：未抓取。

**畫面**：`pages/sources.server.ts` 的 loader props 加 `registry`（只送靜態、可序列化的欄位，不送 RegExp）。**loader 不呼叫 `viewerOf`**，因為 `tests/leak-guards.test.ts:22-24` 以 `{ env: { DB } }` 呼叫它，沒有 `get`。`pages/sources.tsx` 以 `isOwner &&` 顯示「來源授權清冊（站長）」面板，欄位為「來源｜用在哪｜自動取得｜保存｜公開顯示｜衍生計算｜AI 處理｜條款（版本日／查閱日）」，表頭下一句：「這份清冊整理的是條款文字與本站用途的落差，不是法律意見；列在這裡不代表已取得授權。」

**新功能測試**（新檔 `tests/source-registry.test.ts`）：
1. 以 `upstream.rules` 記錄每個請求網址，跑 `FIVE` 五支排程與一次 `addWatchSymbol` 新公司 → 每個網址 `sourceForUrl` 都命中，且 `runtime === "worker"`（APNs、Sign in with Apple 不是資料來源，測試列為例外）。之後任何人新增上游網址卻沒補清冊，這個測試會失敗。
2. 每筆 worker／local 條目都有條款網址、查閱日、五項權利；版本日為 null 的必須寫原因。
3. `nasdaq-analyst` 列出上述七個欄位名。
4. sources loader（與 leak-guards 同樣的 ctx）回傳 `registry`，JSON 不含 `@`。

### L1-T8　逐源停用開關（#17 後半）

**「停用」的定義**：Worker 不再向該來源發任何請求（0 個子請求）。已存資料一律不刪不改（含 G02 預測紀錄與凍結輸入）。畫面照常顯示既有資料，直到它依既有規則過期（共識 7 天、新聞 120 天、價格的過期警示等）。恢復後，下一輪排程照常抓。只有 `runtime === "worker"` 的 8 個來源可以切換。

- `src/lib/sources/http.ts`：`Budget` 新增 `block(rules: { id: string; label: string; patterns: RegExp[] }[])`（整組取代，可重複呼叫）。`take(url)` 命中被停用的規則時，丟新的 `SourceDisabledError`（「來源已停用：{名稱}，未請求 {host}」），不扣 `used`、不發請求。所有外部請求本來就先過 `take`（`web/AGENTS.md`），這是唯一的關口，不必逐一改工作。
- 新檔 `src/server/source-switches.ts`：`SOURCE_SWITCHES_KEY = "source_switches"`、`loadSourceSwitches(db)` → `Record<id, { disabled: true; at: string; reason?: string }>`（用 `getSetting`）、`setSourceSwitch(db, id, disabled, reason?)`、`applySourceSwitches(db, budget)`。不存 email。
- `src/server/jobs.ts`：`runJob`（:747）在 try 內、執行工作前呼叫 `applySourceSwitches`（`runJobs` 經由它，每個工作重讀一次）；`addWatchSymbol`（:805）開頭也呼叫。`push.ts`、`me.ts` 自建的 APNs／Apple Budget 不受影響。T3 已在 `runJob` 加 dataIssues 的處理，本票接在它之後，不改那段。
- **`runs.status` 不新增值**：由各工作既有邏輯得出（通常是 `failed` 或 `partial`），summary 或錯誤訊息含「來源已停用：…」。Yahoo 停用時抓價本來就沒做成，總覽顯示上次抓價失敗是事實；新增狀態值要改 `runStatusText` 與兩端顯示，不值得。
- 新檔 `routes/api/admin/sources.ts`：`GET` 回 `{ switches }`；`POST` body `{ id, disabled, reason? }`（reason ≤200 字），route 內再檢查一次 `viewerOf(c)?.isOwner`（403「只有站長能執行」）；id 不是 worker 來源時回 400；寫入後 `bumpDataVersion`，回 `{ switches }`。
- `/sources`：loader 在 `cachedPage` 內讀 switches（切換時已 bump 資料版本，快取會更新）。清冊面板每列加「啟用中／已停用（時間）」；站長每列有「停用」或「恢復」按鈕，停用前 `confirm`「停用後排程不再向這個來源發請求；已存的資料保留，畫面照常顯示到資料過期。確定停用？」，完成後 `router.refresh()`。
- 清冊每列的「停用影響」要寫清楚，例如：停用 `yahoo-chart` → 抓價、加入新公司、分析師現價都失敗；停用 `cboe-index` → VIX 不更新，展望紀錄停在「等 VIX」；停用 `ssga-holdings` → 權重停更，觸發 T6 的「權重未更新」。

**新功能測試**（新檔 `tests/source-switches.test.ts`）：
1. `Budget.block` 之後，命中的網址丟 `SourceDisabledError`、`used` 不變；沒命中的照常扣。
2. 設 `nasdaq-quote`、`nasdaq-news` 停用 → `invokeCron("crosscheck")`、`invokeCron("news")`：沒有任何 `/api/quote/` 與 `/api/news/` 請求；`assertInvocation(…, { strictJobs: false })`（記到的子請求＝實打數）；兩個工作的 summary 含「來源已停用」；prices 的 `check_*` 與 news 列數不變；`analysts` 仍有 `/api/analyst/` 請求（只停指定的那個）。恢復後再跑 crosscheck，有 Nasdaq 請求。
3. `yahoo-chart` 停用 → `addWatchSymbol` 新公司回 `ok:false`、error 含「來源已停用」、0 個 Yahoo 請求。
4. admin route：非站長 POST 回 403；站長 POST 未知 id 或 local 來源回 400；站長停用後 GET 讀得回來、資料版本增加；恢復後也讀得回來。

## 4. 刻意排除與理由

| 排除 | 理由 |
| --- | --- |
| 分割修復時刪掉窗口外的舊基準列（前一版 T4 的修剪） | 報告 #2 只要求「覆蓋受影響區間才解除 pending、不插假價」。刪列不可逆，而這些列產品目前不讀（最深約 2146 天 < 2200）。要清就另開票、先備份。 |
| 中段衝突時整檔拒收 | 十年以上的歷史只要有一處舊瑕疵，該檔回補、加入、分割修復就會永久失敗；改成只拒收那一天，並寫進執行紀錄。 |
| App 名單頁的「權重未更新」 | 要在 `/api/v1/watchlist` 加 optional 欄位並改 Codable，而且會碰 L5-T9 要重構的 `watchlistView`。App 總覽歸因的「說明」已經會顯示同一句（snapshot notes）。 |
| 停用時在畫面上隱藏該來源的既有數字 | 本輪「停用」只停自動取得。真要下架時，清冊已列出每個來源餵哪些畫面，再逐一處理；§7 不做全站隱藏數字。 |
| 本機 AI 腳本（`yahoo-news-local`）的開關 | Worker 開關管不到本機，要停就改 Orca 排程。清冊標「不可切換」。本輪不改 Orca 排程或 CLI。 |
| B-02 的「預期 daily 覆蓋」（缺交易日偵測） | #2 的文字只列頻率、空歷史、衝突重複日；缺日偵測會牽動快照與 SMA 的列數假設，屬 B-12，另議。 |
| B-07 的代號變更、下市待確認 | 不在 #2 的文字裡。 |
| B-11 的「舊快照標原始價格版本」 | 不在 #2 的文字裡；快照 revision 不可變，本輪不重算舊快照。 |
| 獨立的持股更正表（migration） | 本輪沒有畫面要讀；`runs` 永久保留，summary 在 `/sources` 看得到，足夠當更正紀錄。 |
| 合併 `views.ts:90` 的 7 天容忍與新門檻 | 用途不同，而且會動到總覽（A-07 的檔案）。 |
| 把其他動態 `IN`／`LIKE` 查詢一起改 | 上界都遠低於 100（§2 列出計算），沒有會觸發的輸入。 |
| 換來源、改 UA、走代理、任何繞封鎖或免費替代源（Stooq 等） | §7；換源屬 P2 #19。T3 的選做實測也照這條，429 就不測。 |
| 依修正後的資料重算或重報任何模型成績 | 要先事前登記；本輪不跑。 |
| 正式站是否已經觸發參數上限 | 沒查正式 D1；本輪只以合成輸入證明。 |

## 5. 風險與整合規則

- **合併順序與衝突處理**：L1 先合（L5-T9 依賴 T5、T6；L6 #10 應排在 T7 之後）。後合併的領域在整合分支上 rebase 解衝突，不得改寫 L1 已合併的語意，例如 `runJob` 的 dataIssues 與停用開關、`replaceWeights` 的原子替換、`weightsStaleNote` 的字串。L1 自己的改動限於各票列出的函式：`jobs.ts` 只動 `runJob`、`addWatchSymbol`、`jobPrices` 的分割區（:179-191）、`jobWeights`；`views.ts` 只動 `historyView` 的 contrib 查詢（:191-210）；`nasdaq.ts` 只動 `parseNasdaqHistorical`／`fetchNasdaqHistorical`；`snapshot.ts` 只加 import 與一行 notes；`pages/sources.*` 只加 props 與面板，不改 `JOB_LABEL`。`runJob` 與 L4-T6 會改的 `JOBS`／`SCHEDULES` 相鄰，rebase 時兩邊都保留。
- **功能地圖**：每張票只改自己功能的小節（T2 `history.md`、T3 `watchlist.md`、T6 `overview.md`／`sources-admin.md`／`watchlist.md`、T7、T8 `sources-admin.md`），全部合併後由整合者統一對帳一次。
- **api-contract 與 fixture**：L1 不改 `tests/api-contract.test.ts` 的種子，也不重產 `generated-*.json`；T1、T2、T6 的 acceptance 不帶更新旗標跑它，等於斷言零 diff。整合時各領域的種子衝突取聯集，每合併一個領域就在整合分支重產 fixture、審 diff。另外查過：api-contract 的種子（`tests/api-contract.test.ts:24-47`）都是用原生 `sql.prepare` 逐列寫入，最多 10 幾個參數，不經 T1 的守門，不受影響。
- **T1 的參數守門是全域的**：其他 lane 或既有測試若有經由假 D1（`db.prepare/bind`）超過 100 個參數的語句，會開始失敗。處理方式是把那句改成分批，不放寬守門。
- **T3 拒收的那一天會變成缺口**：若是最新交易日，總覽會照既有規則顯示「缺少當日收盤」；若是中段日期，會少一天日線，影響 SMA、報酬的程度與 B-12（缺日偵測，本輪不做）相同，而且在執行紀錄 summary 與 `detail.dataIssues` 看得到。Yahoo 最後一天的例外沒有頻率證據，保留它是為了不讓盤中即時列導致每天的收盤失敗。`scripts/backtest.ts:78-79` 也用 `parseCboeCsv`：只有 Cboe CSV 真有同日不同收盤時結果才會不同，本輪不跑回測。
- **T3 的 Budget.dataIssues**：Budget 從「請求額度」擴成「每次執行的上游紀錄」。`runJobs` 讓多個工作共用一個 Budget，所以 `runJob` 一定要用執行前的長度切片，不能整包拿。
- **T4 不修剪**：窗口外（重抓起點以前）的列在分割後仍是舊基準，產品目前不讀（最深約 2146 天 < 2200）。日後新增更深的讀取（例如 10 年定投）時，要一起調大 `REBASE_COVER_DAYS` 並處理這些列。SPX、VIX、FX 仍經過 `detectRebase`，本輪不改那條路徑。
- **兩個維運常數**（`REBASE_COVER_DAYS = 2200`、`WEIGHTS_STALE_SESSIONS = 2`）寫成具名常數並附依據，不依市場結果調整。
- **T6 的頁面判斷用當下時間**：名單頁 loader 不經快取；`/sources` 的快取鍵已含 `close=latestScheduledClose()`。快照的判斷不看時間，避免多出 revision。
- **清冊 props 嵌在每個登入者的 HTML 裡**：面板只對站長顯示，但資料本身是 repo 的公開程式碼；用語保持事實（查閱日、用途、未核實），不寫結論式的法律判斷。
- **T8 誤停的代價**：停用 Yahoo 或 Cboe 會讓抓價或展望停擺。正式站不要為了驗收停用來源；驗收在本機站做，做完全部恢復。
- **iOS**：L1 沒有票改 `ios/`，不跑 xcodebuild。T6 整合驗收要看 App 總覽時，受整合階段的全域模擬器鎖管制（同一時間只有一個領域開一台）。L7-T1 合併前，不執行 `ios-up.sh`、`down.sh`，照 `AGENTS.md:8` 的手動流程：把既有 `MO iPhone 16 Plus` 的 UDID 寫進本輪 `sim.udid`，再用 `ios-test.sh`，驗完 `shutdown`。
- **部署後驗收**（`web/AGENTS.md`）：用站長 `POST /api/admin/cron?name=crosscheck` 看各工作的 `status` 與 `detail.subrequests`。`name=daily-reference` 含 `notify-events`，要等當天 UTC 11:30 的排程跑完才能手動跑（weights 的子請求應比改前少 1）。`name=prices` 含 `notify-close`，要等當天收盤推播送出後才跑，否則會提前推給真實使用者。
- **不需要改 Orca 排程**：本 lane 不動 `scripts/ai-batch.ts` 或任何 CLI。

## 6. 審稿處置（交叉審稿第一輪）

1. **L1-T6 名單頁與重疊預覽沒標「權重未更新」**：成立。T6 新增 `src/lib/weights-age.ts` 的 `weightsStaleNote`，作為全站唯一的字串來源；名單頁 loader 包一層 `weightsStale`，不改 `watchlistView`、`/api/v1/watchlist` 與 `generated-watchlist.json`。基準用 `latestScheduledClose()`，與 `/sources` 的落後標記一致，所以沒有照審稿寫的 `latestExpectedClose()`。L5-T9／T10 改成沿用這個匯出、以及 `etfs-dca.md` 的更新，屬於 L5 spec 或整合者的範圍；本 lane 不改其他領域的 spec。
2. **全域 iOS 模擬器鎖**：成立，但 L1 沒有 iOS 建置。只在 T6 的 uiVerify 與 §5 註明：App 檢查受全域鎖管制，L7-T1 合併前照 `AGENTS.md:8` 的手動流程。
3. **T3 中段衝突導致永久失敗**：問題成立，但沒有照審稿的 fix 把實測放進 acceptance。2026-10-28 規劃時在本機實測，Yahoo query1、query2 都回 429，這一步在這台機器上不可執行，會讓 T3 卡死。改成修正設計：整檔拒收只留給頻率錯與零筆；中段同日不同收盤只拒收那一天，並寫進 `detail.dataIssues` 與 summary（status 變 `partial`），沒有永久失敗的路徑。實測改為不擋合併的選做 PR 備註。
4. **T4 修剪是不可逆刪除、超出 #2 範圍**：成立。拿掉 `deleteBarsBefore`、`detail.rebased.trimmed` 與對應測試；第 5 條分支改成「涵蓋、不修剪」，註解與風險寫明窗口外仍是舊基準。
5. **api-contract 種子與 fixture 衝突**：L1 不改種子、不重產 fixture，票不用改。整合規則寫進 §5；另查證 api-contract 的種子用原生 `sql` 寫入，不經 T1 守門。L2 spec 的行號屬 L2。
6. **多領域改同一檔**：成立，屬整合規則。§5 寫明 L1 先合、各票只動列出的函式、後合併者不得改寫 L1 語意、功能地圖只改自己小節，並註明 `runJob` 與 L4-T6 的 `JOBS`／`SCHEDULES` 相鄰。
7. **acceptance 不能原樣執行**：成立。全部改成 `cd <worktree>/web && …`；T5 的 curl 改成 `test "$(curl …)" = "200 0"`，可以機器判斷；「零 diff」的預期由 `api-contract.test.ts` 本身的斷言負責，不寫在指令尾端。
