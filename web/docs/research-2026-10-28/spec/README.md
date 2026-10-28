# 2026-10-28 優化實作 spec：總覽

依據：`../report.md` §6 的 P0 全部與 P1（#14 除外）。P2 不做。使用者決定：維持 X03（展望不是加碼或停扣訊號）；收盤推播遇來源不一致照送並標「未核對」。

每個領域一份 spec，內含現況證據（file:line）、每張票的規格、刻意排除與理由、跨領域整合規則、審稿處置。

| 領域 | spec | 票數 | 報告條目 |
| --- | --- | --- | --- |
| L1 資料 | [L1-data.md](L1-data.md) | 8 | #1、#2、#17 |
| L2 AI 流水線 | [L2-ai.md](L2-ai.md) | 12 | #3、#7、#15、#16，與 §5 的 iOS 新聞摘要日期（原屬 #4） |
| L3 畫面口徑 | [L3-display.md](L3-display.md) | 8 | #4 的 A-07、A-09、A-12、A-13；#5；#6 |
| L4 預測 | [L4-forecast.md](L4-forecast.md) | 7 | #8、#9 |
| L5 定投與 ETF | [L5-dca.md](L5-dca.md) | 10 | #4 的 A-11 與 C-01 文字；#11；#12；#13 |
| L6 個股 | [L6-stock.md](L6-stock.md) | 6 | #4 的 A-05、A-06、B-04；#10；#14a |
| L7 Skills | [L7-skills.md](L7-skills.md) | 5 | #18 |

## 要等使用者的票

| 票 | 等什麼 |
| --- | --- |
| L4-T2 | 新登記條目（PUB-1 發布時限、R2-6 修訂一、L09 增補一、執行順序修訂一）。合併進 main 即生效，要使用者審閱 L4 spec §5 的條文後，以獨立 PR 先合併。本輪只起草、送審，不自動合併。 |
| L4-T7 | #9 的程式。L4-T2 合併進 main 之後才能寫。 |
| L2-T11、L2-T12 | AI 內容評估規格凍結、holdout 金標與逐句標註要站長確認與簽核；tone 改定義要等評估基準完成。 |

L4-T3～T5（R2-5、R2-6）照常實作，但整合分支合併進 main 與任何部署都要等 L4-T2 合併；沒簽就在整合分支 revert 這三張（見 L4 spec §4）。

## 執行方式

- 每個領域一個 worktree 與分支（`r1028-l1-data` … `r1028-l7-skills`），L4-T2 另開 `r1028-registration`，都從 `main` 的 `8eaac29` 切出。
- 同一領域的票依序做：Sonnet 監工派 Codex 寫（Codex 額度不足時改由 AGY），監工自己跑 gate（typecheck、完整 `npm test`、動到 iOS 時跑 MarketObservatoryTests）；過 gate 後 Opus code review，發現先由獨立代理試著推翻，成立的才交回 Codex 修，每張票最多 3 輪；第 3 輪仍有要修的，請 Fable 評估是否過度修改，交給使用者決定。
- 完整 `npm test` 與所有 iOS 建置、測試共用一把機器層級的鎖，同一時間只跑一個；iOS 測試只用 `MO iPhone 16 Plus`，跑完關機。
- L7-T4、T5 要等 L2 整個領域完成，把 L2 分支併進 L7 分支後才開工。

## 整合順序（交叉審稿建議）

L1 → L3 → L4 → L6 → L2 → L5 → L7。每合併一個領域就重產 `ios/MarketObservatoryTests/Fixtures/generated/` 並審 diff、跑完整 gate。全部合併後用網頁與兩台 MO 模擬器（輪流）實際操作驗收，再請使用者決定 push、開 PR、部署與 TestFlight。

## 部署時要一起做的事（實作完成後再確認）

- L2 改了 `scripts/ai-batch.ts` 的 CLI 行為（向後相容），合併進 main 後 Orca 排程會立刻用新版；Worker 要接著部署（L2 spec §3-6）。
- L3-T7 在 `/api/v1` 的事件狀態多一個 `expected` 值，舊版 App 會顯示英文原文：Worker 要和含 L3-T7 的 TestFlight 同時或稍晚上線。
- L3-T8 只對「來源不一致」加「未核對」；pending 要不要也標，留給使用者決定（L3 spec §4、§7）。
