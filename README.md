# 市場觀測室（market-observatory）

個人用的美股觀測站：S&P 500 每日收盤、七巨頭對指數的點數歸因、VIX 與等權重對照、歷史走勢與均線、S&P 500 ETF 比較與台幣定投試算、新聞與財報／FOMC 日曆。跑在 Cloudflare Workers（[Void](https://github.com/voidzero-dev/void)），資料存 D1，排程用 Cron Triggers，只開放一個擁有者帳號登入。

## 資料從哪裡來

| 資料 | 主來源 | 核對 | 頻率 |
| --- | --- | --- | --- |
| 指數、個股、ETF、USD/TWD 日線 | Yahoo Finance chart API | 個股與 ETF 對 Nasdaq 歷史行情；SPX 對 Cboe 官方歷史 | 收盤後兩次（UTC 21:20、隔日 01:10），UTC 22:40 核對 |
| VIX | Cboe 官方 `VIX_History.csv` | — | 同上 |
| 七巨頭權重 | State Street SPY 每日持股 xlsx | 權重合計須在 95–105%、至少 400 檔 | 每天 UTC 11:30 |
| 財報日期 | Nasdaq 財報日曆（已排定），沒有時用 Zacks 推估 | 推估日期在畫面上標「推估」 | 每天 UTC 11:30 |
| FOMC | 聯準會公布的日程（`src/lib/calendar.ts` 人工維護） | 2027 年標「暫定」 | 靜態 |
| 新聞 | Nasdaq 個股新聞（七巨頭＋SPY） | — | 每 4 小時 |

Yahoo 與 Nasdaq 是非官方端點、沒有授權保證；兩源收盤差距超過 max(0.011, 0.05%) 會標成「來源不一致」，畫面上直接顯示，不會靜默挑一個。實際抓到過一次：Nasdaq 在 2026-04-20 對 8 檔 ETF 回傳前一個交易日的收盤。

## 計算方式

- **歸因**：個股貢獻點數 = 前一交易日 SPX × 前一交易日權重 × 當日報酬。SSGA 持股檔通常落後 1～2 個交易日，權重依 `w(t) = w(a) × (P_i(t)/P_i(a)) ÷ (SPX(t)/SPX(a))` 推到前一交易日（假設期間股數不變），畫面上標「推算」。其餘成分股 = 指數漲跌 − 七巨頭合計。
- **快照**：每個交易日一份計算結果；內容（SHA-256）變了才新增 revision，舊版本不改。收盤抓價、Nasdaq 核對、權重更新都可能產生新版本。
- **均線**：SMA20／60／200 先用更早的資料暖機再截到顯示區間；不足 n 筆就不畫。
- **定投試算**：每月第一個交易日以收盤價買入，用當天 USD/TWD 換匯；不含配息、手續費與稅。

## 開發

需要 Node.js 24.21 以上。

```sh
npm install
npx void db migrate                  # 本機 D1
echo 'OWNER_EMAIL=you@example.com' > .env
npm run dev                          # http://localhost:5173，第一次用 OWNER_EMAIL 建帳號
npm test                             # 單元測試（node --test）
npm run typecheck
```

本機觸發排程：dev server 啟動時會印出帶 token 的 `curl … /__void/scheduled` 指令；或登入後在「資料來源」頁按手動執行。

## 部署

```sh
npx void deploy --platform cloudflare          # 建置、建 D1、套 migration、註冊 cron
printf 'you@example.com' | npx void secret put OWNER_EMAIL
```

- 部署時不要同時開著 `npm run dev`：dev server 會動到 `.wrangler/`，部署會因找不到建置設定而中止。
- 改了 `db/schema.ts` 要先 `npx void db generate` 產生 migration 並提交。
- `BETTER_AUTH_SECRET` 由 Void 第一次部署時自動建立。

### 歷史回補

十年日線、近五年交叉核對與 500 個交易日快照，在 Worker 裡分段跑（本機 IP 容易被 Yahoo 限流）：

```sh
MO_URL=https://<worker>.workers.dev MO_EMAIL=… MO_PASSWORD=… node scripts/backfill.ts --sessions 500
```

只補不存在或收盤有變的列；每一段都會寫進 `runs` 表，可在「資料來源」頁看到。

## 免費方案的限制

每次 Worker 呼叫的子請求約 50 個、Cron Trigger 最多 5 組，所以抓價、核對、權重＋日曆、新聞拆成四個 cron 檔；資料庫寫入一律「一次查詢＋分塊 batch」，查詢次數不隨標的數量增加。
