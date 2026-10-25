<!--injected-by-void-v1.2.1-->
## Void

- This project uses [Void](https://void.cloud), a full-stack Vite framework for Cloudflare Workers with file-based API routing, server-rendered pages, and typed backend services.
- Use Void's CLI and typed APIs. Before working with Void, read the relevant Markdown docs in `node_modules/void/docs/`; start with `guide/quickstart.md` for setup and `reference/cli.md` for commands.

<!--/injected-by-void-->

## 本專案

- 外部請求一律走 `fetchWithTimeout` 並傳入這次執行的 `budget`（`src/lib/sources/http.ts`）；漏傳的請求不進額度，cron 測試會因「記到的請求數 ≠ 實際打出去的」失敗。並行用 `mapLimit`，一次執行同時不超過 6 個（Cloudflare 上限，多的會排隊）。
- Nasdaq 的股類代號要用點（`BRK.B`），Yahoo 與本專案內部用連字號（`BRK-B`）：打 Nasdaq 前一律轉換。連字號版本回 200 加「Symbol not exists」，不會報錯，只會靜默缺資料。
- 新增上游網址前先用 curl 看它會不會轉址：每一跳都算一個子請求，直接打最終網址。
- 改到排程或抓取：`npm test` 通過、部署後，用 `POST /api/admin/cron?name=<SCHEDULES 的鍵>`（擁有者登入）在正式站跑一次，看每個工作的 `status` 與 `detail.subrequests`。Void 的正式環境沒有其他手動觸發 cron 的方式。
- 正式站的觀察名單是使用者實際在用的資料：為了測試加減名單，測完要改回原狀。
