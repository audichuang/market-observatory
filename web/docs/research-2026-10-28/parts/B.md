# 任務 B：資料管線韌性、時點正確性與授權風險審計（讀 repo，可少量 curl 公開端點）

ID 前綴：`B-`。輸出檔：`/Users/audichuang/Project/market-observatory/web/docs/research-2026-10-28/results/B-data-pipeline.md`

## 目標

1. **資料血緣表**：每個上游（Yahoo chart／spark、Nasdaq 行情／新聞／analyst／財報日曆、Zacks、Cboe、SSGA SPY 持股、FactSet PDF、聯準會日程）寫：端點（從程式找）、哪個排程（`web/crons/*`、`web/src/server/jobs.ts` 的 `SCHEDULES`）、子請求預算、失敗時的行為、交叉核對範圍、寫進哪些 D1 表、畫面上顯示的資料日期。
2. **會靜默出錯的情境**：股票分割與股利調整、代號變更與下市、指數成分變動、SPY 持股落後 1–2 天、夏令時間切換與美股假日、提早收盤日、上游回傳前一天資料（README 提到 2026-04-20 Nasdaq 案例）、重複或缺漏日期、Yahoo 降頻（`range=max` 降成 3mo）。每個情境：現有程式擋不擋得住（檔案:行號），擋不住的後果與最小修正。
3. **時點正確性（point-in-time）**：展望、consensus 與推播用到的資料，哪些可能在「當時」還不知道（look-ahead），哪些是事後修訂版；`forecasts` 表的寫入時點與收盤時間的關係。
4. **授權與條款**：每個上游對「開放註冊網站公開顯示」的條款風險（Yahoo Terms 2026-08-04 版禁止未經許可的自動收集已在 10-27 核實；Nasdaq、SSGA、Cboe、FactSet、Zacks 請找條款原文）。只盤點與分級，不建議改架構以外的法律判斷。
5. **單點故障與替代**：本機 Orca 排程（Mac 關機時新聞 AI 會怎樣）、Cloudflare 子請求上限、D1 大小。每個單點給一個替代來源或降級方式（來源細節留給任務 E，這裡只指出缺口）。

## 方法

讀 `web/src/lib/sources/*.ts`、`web/src/server/jobs.ts`、`web/crons/*.ts`、`web/db/`、`README.md`、`web/AGENTS.md`、`web/tests/`。可以對公開上游做少量唯讀 curl（例如確認端點是否轉址、回應有沒有時間戳）；不要碰正式站。

## 停止條件

五個部分都有表格、每條缺口有檔案:行號或 curl 證據就停。
