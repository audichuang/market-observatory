# 市場觀測室（market-observatory）

個人用的美股觀測站：S&P 500 每日收盤、自選觀察名單（預設七巨頭，可加入任何成分股）對指數的點數歸因、VIX 與等權重對照、歷史走勢與均線、S&P 500 ETF 比較與台幣定投試算、新聞與財報／FOMC 日曆。跑在 Cloudflare Workers（[Void](https://github.com/voidzero-dev/void)），資料存 D1，排程用 Cron Triggers。任何人都能註冊（email／密碼，或 iOS App 裡的 Apple 登入），每個帳號有自己的觀察名單與定投規劃；`OWNER_EMAIL` 那個帳號是站長，只有站長能手動跑排程與回補。網站（Void 專案）在 [`web/`](web/)，下文的檔案路徑與指令都相對於 `web/`；iOS App（含推播）在 [`ios/`](ios/README.md)。

## 資料從哪裡來

| 資料 | 主來源 | 核對 | 頻率 |
| --- | --- | --- | --- |
| 指數、個股、ETF、USD/TWD 日線 | Yahoo Finance chart API | 個股與 ETF 對 Nasdaq 歷史行情；SPX 對 Cboe 官方歷史 | UTC 21:40（冬令美東 16:40、夏令 17:40）抓價、22:50 核對；隔日 01:10 補抓並再核對 |
| VIX | Cboe 官方 `VIX_History.csv` | — | 同上 |
| 成分股權重 | State Street SPY 每日持股 xlsx | 權重合計須在 95–105%、至少 400 檔 | 每天 UTC 11:30 |
| 財報日期 | Nasdaq 財報日曆（已排定），沒有時用 Zacks 推估 | 推估日期在畫面上標「推估」 | 每天 UTC 11:30 |
| FOMC | 聯準會公布的日程（`src/lib/calendar.ts` 人工維護） | 2027 年標「暫定」 | 靜態 |
| 新聞 | Nasdaq 個股新聞（觀察名單＋SPY） | — | 每 4 小時 |

Yahoo 與 Nasdaq 是非官方端點、沒有授權保證；兩源收盤差距超過 max(0.011, 0.05%) 會標成「來源不一致」，畫面上直接顯示，不會靜默挑一個。實際抓到過一次：Nasdaq 在 2026-04-20 對 8 檔 ETF 回傳前一個交易日的收盤。

## 計算方式

- **歸因**：個股貢獻點數 = 前一交易日 SPX × 前一交易日權重 × 當日報酬。SSGA 持股檔通常落後 1～2 個交易日，權重依 `w(t) = w(a) × (P_i(t)/P_i(a)) ÷ (SPX(t)/SPX(a))` 推到前一交易日（假設期間股數不變），畫面上標「推算」。其餘成分股 = 指數漲跌 − 觀察名單合計。
- **觀察名單**：每個帳號一份，存在 D1 `settings`（站長沿用 key `watchlist`，其他人 `watchlist:<user id>`，第一次打開時寫入預設七巨頭），在 `/watchlist` 頁或 App 增減，每人最多 30 家；只收最新 SPY 持股裡的成分股，同公司多股類（GOOGL＋GOOG）自動合併。排程抓的是**所有人名單的聯集**（全站最多 `MAX_TRACKED` = 100 家）；全站第一次有人加的公司先抓十年日線（抓不到就不加），別人已在追蹤的直接加入。聯集變了才重算最近 45 個交易日的快照（更早的快照保留當時的聯集）。
- **每個人看到的歸因**：快照算的是聯集，總覽、走勢頁與推播再用 `viewForMembers`（`src/lib/snapshot.ts`）只取自己名單上的公司，名單合計、占比與「其餘」照自己的名單重算。
- **快照**：每個交易日一份計算結果；內容（SHA-256）變了才新增 revision，舊版本不改。收盤抓價、Nasdaq 核對、權重更新都可能產生新版本。
- **均線**：SMA20／60／200 先用更早的資料暖機再截到顯示區間；不足 n 筆就不畫。
- **定投試算**：每月第一個交易日以收盤價買入，用當天 USD/TWD 換匯；不含配息、手續費與稅。

## 開發

需要 Node.js 24.21 以上。

```sh
cd web
npm install
npx void db migrate                  # 本機 D1
echo 'OWNER_EMAIL=you@example.com' > .env
npm run dev                          # http://localhost:5173，用 OWNER_EMAIL 註冊的帳號是站長
npm test                             # 單元測試（node --test）
npm run typecheck
```

本機觸發排程：dev server 啟動時會印出帶 token 的 `curl … /__void/scheduled` 指令；或登入後在「資料來源」頁按手動執行。

## 部署

```sh
npx void deploy --platform cloudflare          # 建置、建 D1、套 migration、註冊 cron
printf 'you@example.com' | npx void secret put OWNER_EMAIL
# iOS App：Apple 登入與推播
printf 'com.audichuang.observatory' | npx void secret put APPLE_BUNDLE_ID
printf '<Team ID>' | npx void secret put APNS_TEAM_ID
printf '<Key ID>' | npx void secret put APNS_KEY_ID
npx void secret put APNS_PRIVATE_KEY < AuthKey_<Key ID>.p8
# 刪除帳號時撤銷 Apple 登入授權：開了 Sign in with Apple 的 .p8（APNs 那把加開也行，Team ID 共用 APNS_TEAM_ID）
printf '<Key ID>' | npx void secret put SIWA_KEY_ID
npx void secret put SIWA_PRIVATE_KEY < AuthKey_<Key ID>.p8
```

- APNs 金鑰（Sandbox & Production、Team Scoped）只能下載一次，備份在 1Password `Agent` vault。

- 部署時不要同時開著 `npm run dev`：dev server 會動到 `.wrangler/`，部署會因找不到建置設定而中止。
- 改了 `db/schema.ts` 要先 `npx void db generate` 產生 migration 並提交。
- `BETTER_AUTH_SECRET` 由 Void 第一次部署時自動建立。

### 歷史回補

十年日線、近五年交叉核對與 500 個交易日快照，在 Worker 裡分段跑（本機 IP 容易被 Yahoo 限流）：

```sh
MO_URL=https://<worker>.workers.dev MO_EMAIL=… MO_PASSWORD=… node scripts/backfill.ts --sessions 500
```

只補不存在或收盤有變的列；每一段都會寫進 `runs` 表，可在「資料來源」頁看到。

### 新聞 AI（本機排程）

標題翻譯、文章重點、每家公司與大盤的「今天為什麼漲跌」都由本機的 Orca 排程用 Claude 訂閱產生，Worker 不呼叫模型、不需要 API key。手動跑一次：

```sh
node scripts/ai-batch.ts pull translate   # 或 daily；寫出 .ai-batch/<kind>/tasks.md
# 把每個任務的答案寫進 .ai-batch/<kind>/answers.json（以任務代號為鍵）
node scripts/ai-batch.ts push translate
```

帳密用 `MO_EMAIL`／`MO_PASSWORD`，沒設就讀 1Password 的 Agent vault。格式不對的答案會略過，下次排程再給一次。

## Cloudflare 方案與請求額度

帳號是 Workers Paid（$5／月）：每次 Worker 執行的外部子請求上限預設 10,000（免費方案只有 50），外部請求不計費；同時等待回應的連線兩種方案都是 6 個。Cron Trigger 免費方案最多 5 組，所以抓價、補抓、核對、權重＋日曆、新聞拆成五個 cron 檔；資料庫寫入一律「一次查詢＋分塊 batch」，查詢次數不隨標的數量增加。

請求額度：每次執行有一份額度（`SUBREQUEST_BUDGET` = 1000，`src/server/jobs.ts`；`Budget` 在 `src/lib/sources/http.ts`），每個外部請求打出去前先扣，轉址每一跳、重試每一次都算；同一支排程的幾個工作共用一份（`SCHEDULES`＋`runJobs`）。額度不夠時照剩下的額度決定抓幾檔，抓不到的記在 runs 的摘要（「請求額度不足、這次略過」），下一輪補上。同時最多 6 個請求、429／503 照 Retry-After 重試一次，避免被 Yahoo／Nasdaq 限流。每天的收盤用 Yahoo spark 一次 20 檔。

名單滿 30 家（33 個代號）時各排程的用量（2026-10-25 正式站實測）：收盤 5、核對 45、隔天補抓＋核對 50、權重＋財報日＋FactSet 28、新聞＋分析師 52；全部 ok。每次用量記在 runs 的 `detail.subrequests`；`POST /api/admin/cron?name=<排程>` 可手動跑一支排程驗證。

換回免費方案時：`SUBREQUEST_BUDGET` 改回 48、`MAX_WATCH`（`src/lib/watchlist.ts`）改回 12，否則名單大時新聞與核對排程會超過 50。

## iOS App 與推播

App 走 `/api/v1/*` 的 JSON API（`routes/api/v1/`，跟網頁共用 `src/server/views.ts`），登入用 Better Auth 的 session cookie。

- **Origin header**：Better Auth 拒絕沒有 `Origin` 的 POST（`MISSING_OR_NULL_ORIGIN`），App 每個 POST／PUT／DELETE 都帶 `Origin: <站台網址>`。
- **Apple 登入**：App 原生 Sign in with Apple 拿 identity token，`POST /api/auth/sign-in/social`（`provider: "apple"`、`idToken`），後端用 Apple 公鑰驗簽、audience 是 `APPLE_BUNDLE_ID`；不需要 Services ID 與 client secret。網頁版目前只有 email／密碼。
- **推播**：App 啟動後 `POST /api/v1/devices` 註冊 device token（debug 版 `sandbox`、TestFlight／App Store 版 `production`，打不同的 APNs 主機）。收盤推播（摘要、名單個股單日漲跌超過門檻）接在抓價排程後面，只在最新快照是「最近應已收盤」那天才發；`push_log` 去重，隔天清晨的補抓排程不會重發。事件提醒（名單公司財報、FOMC）在 UTC 11:30 的 daily-reference 排程後面。APNs 回 410 的裝置自動刪除；其他錯誤（含 APNs 的 reason）記在 `devices.last_error` 與 runs 的摘要。
- 偏好（`GET/PUT /api/v1/push`，存 `settings` 的 `push:<user id>`）；`POST /api/v1/push` 送一則測試推播到自己的裝置。
- 刪除帳號：`DELETE /api/v1/me`（App Store 規定 App 內能刪帳號），站長帳號不能從這裡刪。綁了 Apple 登入的帳號（`GET /api/v1/me` 的 `hasApple`），App 會先再跑一次 Apple 授權，把 authorization code 放在 body 的 `appleAuthorizationCode`；後端用 `SIWA_KEY_ID`／`SIWA_PRIVATE_KEY` 簽 client secret，向 `appleid.apple.com/auth/token` 換 refresh token 再 `/auth/revoke` 撤銷（審查指南 5.1.1(v)），成功才刪資料。沒帶 code 回 400、沒設定金鑰回 503、Apple 失敗回 400／502，帳號都保留。
