<!--injected-by-void-v1.2.1-->
## Void

- This project uses [Void](https://void.cloud), a full-stack Vite framework for Cloudflare Workers with file-based API routing, server-rendered pages, and typed backend services.
- Use Void's CLI and typed APIs. Before working with Void, read the relevant Markdown docs in `node_modules/void/docs/`; start with `guide/quickstart.md` for setup and `reference/cli.md` for commands.

<!--/injected-by-void-->

## 分層

- `pages/`、`routes/`、`middleware/`、`crons/`、`db/` 的位置是 Void 規定的（檔名就是網址、排程與 migration），不要搬或改名。
- `pages/*.server.ts` 與 `routes/api/v1/*` 都是薄殼：同一個畫面的網頁 loader 與 App API 呼叫 `src/server/` 的同一個函式（多半在 `views.ts`），網頁和 App 拿同一份資料；要改資料就改那個函式，不要在殼裡各寫一套。
- `src/lib/` 不碰 D1、不看登入者：計算、上游來源的抓取與解析（`sources/`）、AI 提示詞，測試不用資料庫。新邏輯能放這裡就放這裡。
- `src/server/` 是 D1 讀寫、帳號、推播與排程工作（`jobs.ts`）；`src/ui/` 是網頁元件，不 import `src/server/`。
- `scripts/` 在本機跑、不部署：歷史回補與新聞 AI 排程。
- `ios/` 是獨立的 Xcode 專案（XcodeGen），只透過 `/api/v1` 跟後端溝通，建置與 UI 測試見 `ios/README.md`。改了 `/api/v1` 的回應欄位，App 的 Codable 模型要一起改；要拿掉欄位，先確認 App 那邊是 optional，否則已安裝的舊版 App 會整頁解碼失敗。
- `tests/` 用 Node 內建的 test runner，D1 用 `tests/helpers/fake-cloudflare.ts` 的假件。

## 本專案

- 外部請求一律走 `fetchWithTimeout` 並傳入這次執行的 `budget`（`src/lib/sources/http.ts`）；漏傳的請求不進額度，cron 測試會因「記到的請求數 ≠ 實際打出去的」失敗。並行用 `mapLimit`，一次執行同時不超過 6 個（Cloudflare 上限，多的會排隊）。
- Nasdaq 的股類代號要用點（`BRK.B`），Yahoo 與本專案內部用連字號（`BRK-B`）：打 Nasdaq 前一律轉換。連字號版本回 200 加「Symbol not exists」，不會報錯，只會靜默缺資料。
- 新增上游網址前先用 curl 看它會不會轉址：每一跳都算一個子請求，直接打最終網址。
- 改到排程或抓取：`npm test` 通過、部署後，用 `POST /api/admin/cron?name=<SCHEDULES 的鍵>`（站長登入，`OWNER_EMAIL`）在正式站跑一次，看每個工作的 `status` 與 `detail.subrequests`。Void 的正式環境沒有其他手動觸發 cron 的方式。
- 正式站的觀察名單是使用者實際在用的資料：為了測試加減名單，測完要改回原狀。
- 開放註冊：每個人不同的資料（名單、定投規劃）不能放進共用的 `cachedPage` 結果，要嘛在快取外套上，要嘛把名單放進快取鍵；排程一律用 `loadTrackedMembers`（聯集），單一使用者用 `loadWatchlist(db, key)`。
- 新的後台功能放在 `/api/admin/` 底下：middleware 只放行站長，route 裡也要再用 `viewerOf(c)?.isOwner` 檢查。
- 新聞 AI（翻譯、重點、「今天為什麼漲跌」）不在 Worker 裡呼叫模型、不用 API key：由本機 Orca 排程（名稱開頭「市場觀測室：」）叫 Claude 跑 `scripts/ai-batch.ts`，答案經 `/api/admin/ai` 驗證後寫進 D1；網頁與 App 只讀 D1，沒寫到就不顯示。新的 AI 內容照這條路加，不要在 route 或 cron 裡接模型。排程跑的是這個 checkout 當下的分支，切到沒有 `scripts/ai-batch.ts` 的分支，排程就會失敗。
