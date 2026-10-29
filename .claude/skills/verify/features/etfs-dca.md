# ETF 與定投

11 檔 S&P 500 ETF（含槓桿與反向）的各期間報酬、費用、規模比較；台幣定投試算（首筆在試算起點當天或之後第一個有價格的交易日買入，之後每月第一個交易日以收盤價買入，首月可能不完整；換匯用買入日的 USD/TWD，當天沒有匯率時沿用之前最近一筆）；「我的規劃」存每個帳號的研究預算、每批投入、檢討門檻 ±% 與備註。

## Sub-features

- `etfs-table`（F1、F2）：11 檔 VOO、IVV、SPY、SPYM、SSO、UPRO、SPXL、SH、SDS、SPXU、SPXS；報酬＝API `rows[].returns`；2×／3×／反向標示正確；期間切換 YTD、1M、5Y。
- `dca-simulate`（F3）：選 ETF、年數、每月金額按「試算」，結果＝`/api/v1/etfs?etf=…&years=…&monthly=…` 的 `dca`；沒存前按鈕是「設為我的預設」。
- `dca-funding`：試算的「期間」後選「資金類型」；預設「每月新收入」只列投入月數、目前市值與最大帳面虧損，附不列一次投入對照的說明。「期初已有整筆資金」列期初資金、一次投入（首筆日期全部買入）、分 N 個月投入與分批的最大帳面虧損，附期初資金前提與未投入現金不計利息。切換只影響呈現，`dca` 數字不變。
- `etf-facts`（#11，C-02、R1-5）：ETF 表格代號欄與窄螢幕卡片加 `<details><summary>產品資料</summary>`，展開顯示註冊地、配息、ISIN（查不到顯示「未查核」）、費用率（淨／總與查核日）、倍數（1x 顯示「1x，不每日重設」，其他顯示「{n}x，每日重設」或「反向 {n}x，每日重設」）、出處連結與查閱日、以及證據邊界句。定投試算面板依所選標的倍數顯示 1x 證據邊界（`EVIDENCE_1X`，一般樣式）或槓桿／反向證據邊界（`EVIDENCE_LEVERAGED`，警示樣式）。
- `etf-facts-app`（#11，C-02、R1-5）：App 每列名稱、費用與備註之後有 DisclosureGroup「產品資料」，內容與網頁相同，出處用 Link；定投試算 Section 依「標的」Picker 的選擇顯示 `Copy.evidence1x`（一般文字）或 `Copy.evidenceLeveraged`（Notice 警示），即使歷史資料不足也會顯示。資料與證據文字可隨輔助字級換行。
- `dca-monthly-minimum`：正數月額取整後至少 1 元，儲存端拒絕 0；舊規劃的月額 0 讀成預設 10000，其餘欄位與資料庫原值保留。
- `dca-save-feedback`：儲存預設與規劃時停用送出按鈕；HTTP 或網路失敗顯示 `role="alert"` 紅字，儲存預設保留伺服器具體錯誤（如登入過期、欄位錯誤）；即時欄位驗證用 `role="status"`。
- `dca-save-default`（F3b）：「設為我的預設」後 API `plan` 是那組值，離開再進來仍是；之後改回 VOO／3 年／10000。
- `plan-validate`（F4）：檢討門檻填 `150`：App「儲存」停用、顯示中文範圍說明「金額要是 0 到 10 億的整數，檢討門檻 0–100%，備註最多 2000 字。」；網頁「儲存規劃」停用並顯示逐字相同的說明，不存入。
- `plan-save`（F5）：每批投入改 60000 儲存、讀回；之後改回 50000。
- `cost-scenario`（#12，K-02、C-03、R1-6；網頁）：定投與規劃下方「成本情境（你的假設）」填扣款幣別、換匯價差、比例／最低／固定費、優惠到期日、一般股利的假設年配息率、報酬口徑與稅務身分。按「試算成本」後列每次扣款拆解、一年 12 次交易成本；基金費用、基金層預扣、投資人層預扣各一列年化 %，不加總。NAV 口徑寫「已反映在基金淨值，不重扣」，index 列產品淨費率；其他身分不套用投資人預扣。過期優惠醒目提醒，附免責句、規則來源日期與查閱日。「清除」回到未試算；切標的、期間、金額或資金類型保留網址中的成本假設（含 issue 情境）。假設只在 URL，不存檔、不進共用快取、不改歷史試算。
- `cost-scenario-app`（#12，K-02、C-03）：App 定投試算後的「成本情境（你的假設）」按「設定假設」開可捲動 sheet，欄位名稱與預設同網頁，註明「只是試算，不會儲存。假設年配息率僅計一般股利。」按「試算」只將原始輸入保留在本頁 state，所有 cost* 查詢合併到 `load()`；有每次扣款拆解時，結果開頭顯示「以 {etf}、每月 {amount} 台幣等值金額估算。」；標的與金額分別對 `sim.etf`、`costScenario.perBuy.amountTwd`。結果、issue、分層說明、notes 與來源讀 API，不在 App 計算。可「修改假設」或「清除」；切定投條件保留成本參數，離開本頁後消失。

## How to get to it (user POV)

- 網頁：導覽列「ETF 與定投」→ `/etfs`（`/etfs?etf=IVV&years=2&monthly=5000`）；下方「定投試算（台幣）」「我的規劃」。
- App：「更多 → ETF 與定投試算」，右上「我的規劃」。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、測試帳號登入、規劃是預設值（VOO／3 年／10000、每批 50000）。

- **表格。** `goto("/etfs")`，等 `text=ETF 產品比較`；`fetch("/api/v1/etfs")` 比每列報酬。截圖 `etfs-table.png`。
- **試算。** 在「定投試算（台幣）」選 ETF 與年數（「標的」「期間」的 `select` 會直接換網址）、`input[type=number]` 填 5000、按「試算」；比 `fetch("/api/v1/etfs?etf=IVV&years=2&monthly=5000")` 的 `dca`。
- **資金類型（網頁）。** `/etfs` 的第三個 `select` 是「資金類型」，預設值 `monthly`、顯示「每月新收入」；確認只有三項 KPI，沒有一次投入 KPI，並有「每月新收入無法在期初一次投入…」整句。切成「期初已有整筆資金」（`lump`）後網址含 `funding=lump`、金額欄變「每月分批金額（台幣）」；比 API `funding`、`dca.invested`、`dca.lumpSumValue`、`dca.lumpSumReturnPct`、`dca.value`、`dca.returnPct`，確認四項 KPI、資金前提與「分批期間還沒投入的現金不計利息。」。再改標的、期間與金額，確認網址保留 `funding=lump`；截圖 `dca-monthly.png`、`dca-lump.png`、`dca-funding-retained.png`，附兩種模式的 API JSON。
- **資金類型（App）。** 試算區「期間」後的 Picker label「資金類型、每月新收入」，切換「期初已有整筆資金」；確認呈現與網頁同字、同數字，再改標的與期間仍保留選擇，截圖並與同條件 API 對帳。全程在工作流程全域模擬器鎖內沿用本輪已開的 MO 機；首次啟動或換機才依 [verify 的 Launch](../SKILL.md) 執行 `ios-up.sh <run-id> <機型>`。整輪驗證結束後才依 [verify 的 Cleanup](../SKILL.md) 執行 `down.sh <run-id>` 一次。本票不新增 UI 測試步驟。
- **產品資料卡與證據邊界。** 開 `/etfs`，在表格與 360px 卡片展開 VOO、SPY、UPRO、SPXS 的「產品資料」，看到註冊地、配息、ISIN（或「未查核」）、費用率與查核日、倍數與每日重設、出處連結與查閱日、證據邊界句；點出處連結開到發行商頁。在定投試算切換 UPRO，確認上方出現槓桿證據警示句；切換 VOO 出現 1x 證據句。對帳 `/api/v1/etfs` 的 `rows[].facts`。
- **產品資料卡與證據邊界（App）。** 「更多 → ETF 與定投試算」，依序展開 VOO、SPY、UPRO、SPXS 列內的「產品資料」（identifier `etf-facts-<ticker>`），與同帳號 `/api/v1/etfs` 的 `rows[].facts`、`catalogAsOf`、費用率、倍數及網頁對帳；確認「出處：發行商頁面」呈 tint 色，點它能開啟來源；展開後點代號、報酬、名稱、註冊地、配息、ISIN 不會開來源，點「產品資料」標題只收合、不會開來源。緊鄰出處行的「倍數」「查閱」可能落在 Link 的點擊範圍內而開出處，屬已知殘留。試算「標的」切 UPRO 看橘色 Notice，再切 VOO 看 1x 句。一般與最大輔助字級各截圖並保存畫面文字、API JSON（`etf-facts-normal`、`etf-facts-accessibility`、`dca-evidence-upro`、`dca-evidence-voo`），確認長句、ISIN、日期與 Link 完整換行；用 `test16_Readability` 的 etfs 截圖複查整列高度。全程在工作流程全域模擬器鎖內沿用本輪已開的 MO 機；首次啟動或換機才依 [verify 的 Launch](../SKILL.md) 執行 `ios-up.sh <run-id> <機型>`。整輪驗證結束後才依 [verify 的 Cleanup](../SKILL.md) 執行 `down.sh <run-id>` 一次。
- **預設失敗與小數。** 開 `/etfs?monthly=1500.5`，畫面每月金額取整成 1501，按「設為我的預設」後網址的 monthly 也是 1501，API `plan.monthlyTwd` 讀回 1501。改試算金額後，以 CDP `Network.emulateNetworkConditions` 設 offline，再按儲存：出現 `p.error[role="alert"]`；恢復網路後改回預設並讀回。
- **成本情境（網頁）。** 用 `#cost-scenario input[name=costFx]` 填 0.5、`costFee` 填 0.1、`costMinUsd` 填 1、`costYield` 填 1.2，點 `button:text-is("試算成本")`。對帳同月額／標的 `/api/v1/etfs?costFee=0.1&costMinUsd=1&costFx=0.5&costYield=1.2` 的 `costScenario.perBuy`、`annualTxCostTwd`、`layers.*.pct`／`note`、`notes`、`sources`；基金費用顯示 NAV 不重扣句。把 `select[name=costBasis]` 切 index 再試算，基金費用出現、投資人預扣不變；`select[name=costTax]` 切 other 再試算，投資人層顯示「不套用：請依你的稅務身分確認」。`input[name=costPromo]` 填 2026-01-01，看到「你填的優惠已過期」；費率填 9 再送出，僅顯示中文錯誤，不列拆解或年化數字。接著直接改標的，網址 cost* 與表單費率 9、價差 0.5 仍在；切期間、資金類型或改月額按「試算」也保留。另開 `/etfs?costFee=9&costFx=0.5`，表單顯示 9 與 0.5；開 `/etfs?monthly=1500&costFixed=1500`，月額改 5000 按「試算」後保留固定費 1500 並可算出結果。最低費註記的匯率最多三位小數；index 的發行商費率來源顯示「來源日期：未標明」，查閱日等於頁首費率查核日；點「清除」後網址移除 cost*、面板顯示「尚未試算」。離開後不帶 cost* 重進也須未試算。截圖與 API JSON：`cost-scenario-nav`、`cost-scenario-index`、`cost-scenario-other`、`cost-scenario-expired`、`cost-scenario-issue`、`cost-scenario-retained`、`cost-scenario-cleared`；320px、360px、深淺模式確認完整換行與無水平捲動。面板不得有排序、「最省」「建議」。
- **成本情境的上一頁同步（網頁）。** 開 `/etfs?costFee=9`，確認費率欄為 9 且顯示「手續費比例要在 0–5% 之間」；按「清除」，確認網址沒有 cost*、費率為 0 且尚未試算，再按瀏覽器上一頁（可用 `page.evaluate(() => history.back())`），費率必須回到 9 並顯示同一錯誤。另開 `/etfs`，費率填 9 按「試算成本」，改成 0.1 再試算成功後按上一頁；網址與費率都須為 9，只顯示錯誤、不列拆解。每次返回後用同網址查詢 `/api/v1/etfs`，確認 `costScenario.issue` 與畫面一致；保存各步驟的網址、費率、錯誤、拆解是否存在與截圖（`cost-navigation-clear-back`、`cost-navigation-submit-back`）。現有 `tests/helpers/etf-page.ts` 略過 `useEffect`，靜態渲染測試無法覆蓋這兩條路徑，須在已 hydrate 的網頁執行。
- **成本情境（App，整合驗收）。** 「更多 → ETF 與定投試算」，捲到試算後「成本情境（你的假設）」，點「設定假設」。確認數字預設 0、台幣、無優惠日期、基金淨值／總報酬、台灣稅務居民，且顯示「只是試算，不會儲存。假設年配息率僅計一般股利。」；取消後仍未試算。欄位以相同中文 label 或 identifier `costFx`、`costFee`、`costMinUsd`、`costFixed`、`costYield`、`costPromo` 定位；填價差 0.5、費率 0.1、最低 1、配息率 1.2，按鍵盤「完成」確認收起，再按 sheet 右上「試算」。先核對結果開頭的標的及台幣等值月額，再逐項對帳同標的／月額 `/api/v1/etfs?costFee=0.1&costMinUsd=1&costFx=0.5&costYield=1.2` 的拆解、一年交易成本、三層數字與說明、notes、來源日期與查閱日；點來源 Link 可開來源。再點「修改假設」，確認保留輸入，改「報酬口徑」為稅前指數，基金費用出現而投資人預扣不變；改「稅務身分」為其他，投資人層顯示 API 的不套用句。優惠到期日填 2026-01-01 看過期警示；費率填 9 只顯示 API issue、不列拆解，重新修改仍為 9。切定投標的、期間、資金類型及月額後仍保留成本假設；「清除」後只剩「設定假設」，重開 sheet 回預設，離開再進頁也未試算。一般與最大輔助字級都須能捲到所有欄位、收鍵盤、完整看到結果與來源；保存 `cost-app-nav`、`cost-app-index`、`cost-app-other`、`cost-app-expired`、`cost-app-issue`、`cost-app-cleared`、`cost-app-accessibility` 截圖、畫面文字及 API JSON。全程在工作流程全域模擬器鎖內沿用本輪已開的 MO 機；首次啟動或換機才依 [verify 的 Launch](../SKILL.md) 執行 `ios-up.sh <run-id> <機型>`。整輪驗證結束後才依 [verify 的 Cleanup](../SKILL.md) 執行 `down.sh <run-id>` 一次。本票不新增 UI 測試步驟，實際畫面留給整合驗收。
- **月額下限。** 開 `/etfs?monthly=0.4`，畫面與 API `sim.monthlyTwd` 都是 1；歷史資料足夠時仍可試算。儲存後 `plan.monthlyTwd` 讀回 1，直接送 API 月額 0 應回 400。測完改回原預設並讀回。
- **我的規劃（網頁）。** 欄位是「加碼研究預算」「單筆加碼」「檢討門檻 ±%」「待定事項與備註」，按鈕「儲存規劃」。欄位沒有 name，用整頁 `input[type=number]` 的順序：0＝每月投入（定投試算）、1＝研究預算、2＝單筆加碼、3＝檢討門檻（取第 n 個的寫法照 `ego-browser skill`）。單筆加碼改 60000、按 `button:text-is("儲存規劃")`，`fetch("/api/v1/etfs")` 的 `plan.trancheTwd` 讀回；改回 50000 再讀回一次（F5）。檢討門檻填 150 按儲存，看錯誤訊息與 `plan.exitConsiderationPct` 沒變（F4）。
- **App。** walkthrough 的 `07-etfs.png`、`07b-dca.png`；`ios-test.sh … VerifyInteractionTests/test06_EtfsPlan`：`F2-periods.txt`、`F3-dca.png`／`.txt`（IVV／2 年／5000 的結果對 API `dca`）、`F3b-reopen.txt`（離開再進來仍是「標的、IVV」「期間、2 年」「已是我的預設」）、`F4-exit150.txt`（「儲存 enabled=false」＋中文範圍說明）、`F5-reopen.txt`（60000），結束時改回 VOO／3 年／10000、每批 50000。
  App 把手：試算區的 Picker 按鈕 label「標的、VOO」「期間、3 年」，每月投入欄位 label「每月投入」，試算按鈕 label「每月投入、試算」；「設為我的預設／已是我的預設」在清單下方，要先捲出來。清單「我的規劃」顯示「檢討門檻 ±%　±20%」（對 API `plan.exitConsiderationPct`＝20；0 顯示「0%」；小數取整與網頁相同：12.5 →「±13%」、0.5 →「±1%」、2.5 →「±3%」、0.4 →「±0%」），footer 是「只是規劃，不是持倉或交易紀錄；漲跌達門檻時自己檢討，App 不會監看或提醒。」。右上「我的規劃」的欄位 label 是「研究預算」「每批投入」「檢討門檻 ±%」，按鈕「儲存」「取消」。
- **Proof。** `etfs-table.png`、`dca-ivv.png`、`plan-saved.png`、`plan-exit150-after-save.png`、`plan-saved.api.json`、還原後的 API JSON、App 截圖與 `.txt`。

## 成本 sheet 最小重現與回歸（App，1a）

入口：「更多 → ETF 與定投試算 → 成本情境（你的假設）」。先按「設定假設」，填價差 0.5、費率 0.1、最低 1、配息率 1.2 後按「試算」，等拆解與三層結果出現，再按「修改假設」。修正前 sheet 會閃現後自行關閉，UIKit log 可見多筆 `Attempt to present`／`already presenting`；未試算時只有一列，不能拿它代替這個重現。

回歸通過條件：修改 sheet 的「設定假設」導覽列持續可見且保留原輸入；改「報酬口徑」為稅前指數、「稅務身分」為其他，按「試算」只送出一次並關閉，再按「修改假設」仍可開啟；按「取消」後觀察 6 秒不再彈出。保存重新開啟、送出與取消後截圖、畫面文字及 UIKit presentation log（`cost-app-sheet-reopen`、`cost-app-sheet-apply`、`cost-app-sheet-cancel`）。

這是 SwiftUI 在 List 多列 Section 上配置 presenter 的行為；查詢轉換與 fixture 解碼單元測試無法觀察。本輪依派工限制只經 `ios-build.sh`／`ios-gate.sh` 建置與跑單元測試，不另開模擬器或改 UI 測試，未重跑此 UI 重現。審查提供的獨立最小 App 已在 MO iPhone 16 Plus（iOS 27.1）確認修正前兩次流程共 26 筆 presentation 錯誤，按鈕掛載版 2 個 UI 測試通過且 0 筆錯誤；完整 App 路徑與本輪修正仍待整合 UI 驗收。

## Gotchas

- App ETF 列將名稱、費用率、規模及備註分行，大字時代號與報酬上下排列，報酬正負號與數值維持同一行；用 `test16_Readability` 的 `etfs`、`etfs-reading` 與規劃截圖檢查一般／最大字級，`test20_LargeTypeEtfAndLogin` 比較同樣 headline 的 VOO 代號／報酬高度，檢查報酬單行且不超出畫面；再用 `test06_EtfsPlan` 操作與 API 讀回確認試算及儲存。

- 「試算」按鈕在金額沒變時停用。
- 規劃存在 D1 `settings`，每個帳號各一份；改完一定要改回並讀回，下一個功能才從基準開始。
- 定投不含配息、手續費與稅；數字跟券商對帳單不同是設計如此。
- `funding` 僅供本次試算，`lump` 以外（含未帶、未知值）均為 `monthly`；不進快取鍵、不進 `Plan`，「設為我的預設」不儲存資金類型，離開後不帶參數重進仍為每月新收入。兩種模式沿用同一組 `dca`，不另輸入期初資金、不計等待現金利息；舊 API 沒有 `funding` 時 App 仍可解碼並用每月新收入呈現。
- 檢討門檻超出 0–100 時，網頁在送出前就停用「儲存規劃」並顯示「金額要是 0 到 10 億的整數，檢討門檻 0–100%，備註最多 2000 字。」；直接打 API 送 150 回 400「檢討門檻要在 0–100% 之間」。
- ISIN 與配息以發行商官方公開資料查核為準；查不到的欄位為 null，畫面顯示「未查核」。
- App 的 `rows[].facts` 是 optional，舊 API 沒有時仍可解碼；產品資料中的註冊地、配息、ISIN 與出處顯示「未查核」，費用率與倍數照既有欄位呈現。展開後 List 列會變高，最大輔助字級要另外檢查完整內容，build 與解碼測試不能代替畫面驗證。
- 1x 股票產品的長期定投與一次投入研究不自動涵蓋每日重設的槓桿／反向 ETF；定投試算選到槓桿／反向標的時以警示樣式呈現每日重設偏離風險。
- 成本情境的美元扣款仍用台幣等值月額拆解，換匯價差固定為 0；最低美元費以 API 最新 USD/TWD 換算並列日期。沒有匯率且最低費大於 0、扣完費用不夠買進時只回 issue。優惠到期只提醒，不自動替換費率。稅務規則是 2026-10-28 查閱的靜態事實，不自動更新；IRS 協定清單來源日期未標明時如實顯示。一般股利以外的分配不估算，三層不相加、不產生稅後報酬。本次審查修正已實測網頁清除與成功試算後按上一頁的兩條路徑；其餘網頁／App 成本情境仍須在整合驗收操作上述把手。
- App 的 `costScenario` 及其內部欄位均為 optional，舊 `etfs.json` 沒有此欄位仍可解碼；generated fixture 的非空成本率斷言依賴 `api-contract.test.ts` 的 cost* 參數，整合時需保留。App 不把輸入寫入 Plan、UserDefaults 或後端；費率超界等輸入交給 API 回 issue，原始輸入留在本頁可修正，清除才移除。數字鍵盤用工具列「完成」收起，日期可留空或填 YYYY-MM-DD；sheet 與結果列已安排換行／捲動，最大字級與來源點擊範圍仍須實際畫面驗證，單元測試與 build 不能代替。
- 成本編輯 sheet 掛在「設定假設／修改假設」Button 上，讓多列結果共用單一 presenter；掛在 Section 會在試算後觸發多重呈現並自行關閉。回歸操作與證據見上方「成本 sheet 最小重現與回歸」。

## 稅務與傳承檢查清單（L5-T7，網頁）

- `tax-checklists`（#12，C-07、R3-3、R1-6）：導覽列「ETF 與定投」→ `/etfs`，成本情境後的「稅務與傳承檢查清單」。兩份 `<details>`：「台灣家庭海外所得（最低稅負）資料檢查」（7 項）與「美國遺產稅申報資料檢討」（5 項）；項目、note、footer 與來源皆由 `/api/v1/etfs` 的頂層 `checklists` 提供，沒有金額輸入或稅額試算。
- 操作與對帳：依序點 `#tw-overseas-income > summary`、`#us-estate > summary`，確認兩份同時展開；逐項比對 API 的 `items`、台灣 `note` 與兩份 `footer`。點開全部來源，核對連結與每筆「頁面更新日」「查閱日」。在 320px、360px 及深淺模式檢查完整內容可換行、沒有水平捲動；保存 `tax-checklists-expanded.png`、`tax-checklists-320.png`、來源開啟畫面與 `tax-checklists.api.json`。
- 日期與維護：台灣來源為 2026-04-15，未標適用所得年度的 note 必須可見；IRS 遺產頁為 2026-06-28，706-NA 說明只標到 2025-09，保留月份精度；查閱日均為 2026-10-28。這是人工維護的靜態資料，更新前重新查核官方內容與日期。美國清單沒有 note，API 為 null。
- 本票驗證狀態：已以資料、view 與頁面渲染測試核對逐字文案和來源欄位；依派工要求未跑 UI，展開互動、來源實際開啟與窄螢幕版面留待整合驗收。

## 稅務與傳承檢查清單（L5-T8，App）

- `tax-checklists-app`（#12，C-07、遺產申報資料檢討）：入口「更多 → ETF 與定投試算」，成本情境後的 Section「稅務與傳承檢查清單」。每份清單是一個預設收合的 DisclosureGroup；標題、依序列出的 items、可空的 note、footer、來源 Link 標籤／網址與日期均由 `/api/v1/etfs` 的 `checklists` 帶入，App 不保存稅務文案或收集個人金額。
- 操作與對帳：先確認兩份都收合，依序點「台灣家庭海外所得（最低稅負）資料檢查」（identifier `tax-checklist-tw-overseas-income`）與「美國遺產稅申報資料檢討」（`tax-checklist-us-estate`），確認可以同時展開。逐項比對同帳號 API 與網頁的 7／5 項、台灣 note、兩份 footer 與三筆來源；點每個來源 Link 確認開啟的網址一致，日期原樣呈現「頁面更新日／查閱日」，706-NA 的 2025-09 不補成某一天。再次點標題可收合。
- 版面與證據：一般字級、深色模式與最大輔助字級各走過展開並捲到最後一筆來源，逐張檢查標題、長段落、note、footer、來源名稱及日期完整換行。保存 `tax-checklists-app-collapsed.png`、`tax-checklists-app-expanded.png`、`tax-checklists-app-dark.png`、`tax-checklists-app-accessibility.png`、來源開啟畫面、畫面文字與 `tax-checklists-app.api.json`。全程在工作流程全域模擬器鎖內沿用本輪已開的 MO 機；首次啟動或換機才依 [verify 的 Launch](../SKILL.md) 執行 `ios-up.sh <run-id> <機型>`。整輪驗證結束後才依 [verify 的 Cleanup](../SKILL.md) 執行 `down.sh <run-id>` 一次。
- Gotchas：`Etfs.checklists` 為 optional，舊 API 缺欄位時不顯示此 Section，舊 `etfs.json` 仍須解碼；generated fixture 須解出兩份且各有非空 items。清單展開後頁面會很長，保留預設收合；build 與解碼測試不能證明大字未截斷或來源實際可開。本票依派工要求不跑 UI，以上互動、深色及最大字級畫面未驗證，留待整合驗收。

## ETF 與觀察名單的重疊（L5-T9，網頁）

- `watchlist-overlap`（#13，K-04、G-01、R3-4）：導覽列「ETF 與定投」→ `/etfs` 下方「與觀察名單的重疊」。顯示 API `overlap.notes` 的 SPY 代理推估日期與限制、公司與股類代號、指數權重、名單合計覆蓋、指數前十大公司合計；同公司股類合併，名單不當成持倉。沒填金額只列重疊；填金額才列假設曝險，不設門檻或給配置判斷。
- 操作與對帳：先比同帳號 `/api/v1/watchlist` 的 `asOf`、`members[].weightPct`、`totalWeight` 與 `/api/v1/etfs` 的 `overlap` 及畫面。`#watchlist-overlap input[name=ovEtf]` 填 300000、`input[name=ov-NVDA]` 填 50000，點 `button:text-is("計算假設曝險")`；網址帶 `ovEtf=300000&ov=NVDA%3A50000`（多家公司時逗號為 `%2C`；比對時用 `new URL(page.url()).searchParams.get("ov")` 讀解碼後的 `NVDA:50000` 較穩），逐公司對帳 API `overlap.exposure.members` 的經 ETF、另外持有、合計與占你填的總額，並核對 `totalTwd`、`watchlistSharePct`、`otherViaEtfTwd`。切標的、期間、月額、資金類型、儲存預設或清除成本時保留 ovEtf／ov。
- 不適用與輸入：試算標的選 UPRO、SH，面板顯示「不適用持股重疊推估」，API `applicable` 為 false、`exposure` 為 null；仍可見名單權重與代理日期。兩種金額均只收 0–10 億台幣整數，`ov` 只收名單 key、最多 30 家；直接開 `?ov=ZZZZ:1` 或 ETF 金額 1000000001，顯示中文 issue、不列曝險結果。總額為 0 時金額仍列 0，占比無定義，API 為 null、畫面為「—」。
- 即時性與版面：到名單頁增刪一家後回 ETF 頁，立即反映；換兩個名單不同的帳號確認各見自己的公司、金額不串用。權重與名單在共用行情快取外讀主庫，讀 ETF 頁不初始化或重算名單。320px、360px、深淺模式檢查公司與長句換行、沒有水平捲動；窄螢幕曝險以每家公司一組欄位呈現。保存 `overlap-before`、`overlap-exposure`、`overlap-upro`、`overlap-changed-list`、`overlap-other-viewer`、`overlap-320` 截圖及相同查詢／帳號的 API JSON。
- Gotchas：需 L1-T5 的完整持股集合原子替換先整合才能上線，本分支目前尚未包含；latestHoldings／watchlistView 目前沒有「權重未更新」狀態，因此只顯示持股 as-of，不自訂檔齡門檻。尚無持股檔時畫面權重顯示「—」，不把未知當作已調出；填金額時回中文 issue、不計曝險。重疊金額只在 URL、不寫 Plan 或 D1；`generated-etfs.json` 的非空 exposure 依賴契約測試的 NVDA 種子與 ovEtf／ov 參數。App 重疊介面與 optional Codable 由 L5-T10 接續；本票依派工要求不跑 UI，實際名單跨頁／帳號、上一頁同步、窄螢幕及深淺模式畫面未驗證，留待整合驗收。

## ETF 與觀察名單的重疊（L5-T10，App）

- `watchlist-overlap-app`（#13，K-04、G-01）：入口「更多 → ETF 與定投試算」，產品比較後的 Section「與觀察名單的重疊」。逐句顯示 API `overlap.notes`（含 SPY 代理推估 as-of 與不適用句），依 `overlap.members` 列公司、股類代號、指數權重與不在持股檔的代號，再列名單合計覆蓋與指數前十大公司合計。未輸入金額不顯示假設曝險；資料日期為空時權重顯示「—」。與同帳號 `/api/v1/watchlist` 的 `asOf`、`members[].weightPct`、`totalWeight` 及網頁對帳，不把名單當持倉。
- 金額 sheet：按「填金額」，ETF 欄 identifier `ovEtf` 填 300000、NVIDIA 另外持有欄 `ov-NVDA` 填 50000，其他公司留空或填 0；表單可捲動，數字鍵盤工具列「完成」可收鍵盤，「取消」不套用。按「計算」後以 `ovEtf=300000&ov=NVDA:50000` 重新載入。每家公司結果以直向欄位組呈現「經 ETF」「另外持有」「合計」「占你填的總額」，另列你填的總額、名單占比與 ETF 中名單以外金額，全部讀 `overlap.exposure`，App 不計算曝險。
- 保留與刷新：再開「填金額」保留本頁上次送出的輸入；切標的、期間、資金類型、定投金額、成本假設與下拉刷新都保留 ovEtf／ov。到名單頁移除一家後回 ETF 頁下拉重新整理，確認公司與權重更新；若移除的公司原本填過金額，API 會回名單 key 不合法的 issue，再開 sheet 只列目前公司、按「計算」便移除該筆輸入。離開 ETF 頁後重進，金額消失；不寫 Plan、UserDefaults 或後端。
- 不適用與 issue：試算「標的」選 UPRO、SH，API `applicable == false` 時可見 API 的不適用句、沒有曝險結果。填超過 10 億或非整數的金額，App 原樣送 API 並顯示中文 issue，不夾限或自行算；每家另外持有為 0 時不送該筆，ETF 明填 0 仍送出，總額 0 的占比為 null、畫面為「—」。舊 API 沒有 `overlap` 時不顯示整個 Section；Overlap 及所有巢狀欄位均為 optional。
- 整合驗收證據：保存 `overlap-app-before.png`、`overlap-app-editor.png`、`overlap-app-exposure.png`、`overlap-app-upro.png`、`overlap-app-changed-list.png`、`overlap-app-accessibility.png`、對應畫面文字與同條件 API JSON；比對 generated fixture 範例 NVDA 經 ETF 18000、另外持有 50000、合計 68000、總額 350000（實際畫面以本機當次持股為準）。用最多 30 家檢查 sheet 捲到最後一欄、鍵盤「完成」可點，最大輔助字級檢查 notes、公司、權重與全部結果完整換行。全程在工作流程全域模擬器鎖內沿用本輪已開的 MO 機；首次啟動或換機才依 [verify 的 Launch](../SKILL.md) 執行 `ios-up.sh <run-id> <機型>`。整輪驗證結束後才依 [verify 的 Cleanup](../SKILL.md) 執行 `down.sh <run-id>` 一次。
- Gotchas：generatedEtfs 的非空 `overlap.exposure` 斷言依賴 `api-contract.test.ts` 的 ovEtf／ov 與持股、名單種子，整合時不得丟掉；L1-T5 合入前不可單獨上線。本票依派工要求不跑 UI，以上 sheet 互動、跨頁刷新、UPRO 畫面、30 家及最大字級未驗證，build 與解碼測試不能代替。
