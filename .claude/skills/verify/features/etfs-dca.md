# ETF 與定投

11 檔 S&P 500 ETF（含槓桿與反向）的各期間報酬、費用、規模比較；台幣定投試算（首筆在試算起點當天或之後第一個有價格的交易日買入，之後每月第一個交易日以收盤價買入，首月可能不完整；換匯用買入日的 USD/TWD，當天沒有匯率時沿用之前最近一筆）；「我的規劃」存每個帳號的研究預算、每批投入、出場／檢討門檻與備註（網頁與 App 用詞不同，見下方把手）。

## Sub-features

- `etfs-table`（F1、F2）：11 檔 VOO、IVV、SPY、SPYM、SSO、UPRO、SPXL、SH、SDS、SPXU、SPXS；報酬＝API `rows[].returns`；2×／3×／反向標示正確；期間切換 YTD、1M、5Y。
- `dca-simulate`（F3）：選 ETF、年數、每月金額按「試算」，結果＝`/api/v1/etfs?etf=…&years=…&monthly=…` 的 `dca`；沒存前按鈕是「設為我的預設」。
- `dca-funding`：試算的「期間」後選「資金類型」；預設「每月新收入」只列投入月數、目前市值與最大帳面虧損，附不列一次投入對照的說明。「期初已有整筆資金」列期初資金、一次投入（首筆日期全部買入）、分 N 個月投入與分批的最大帳面虧損，附期初資金前提與未投入現金不計利息。切換只影響呈現，`dca` 數字不變。
- `etf-facts`（#11，C-02、R1-5）：ETF 表格代號欄與窄螢幕卡片加 `<details><summary>產品資料</summary>`，展開顯示註冊地、配息、ISIN（查不到顯示「未查核」）、費用率（淨／總與查核日）、倍數（1x 顯示「1x，不每日重設」，其他顯示「{n}x，每日重設」或「反向 {n}x，每日重設」）、出處連結與查閱日、以及證據邊界句。定投試算面板依所選標的倍數顯示 1x 證據邊界（`EVIDENCE_1X`，一般樣式）或槓桿／反向證據邊界（`EVIDENCE_LEVERAGED`，警示樣式）。
- `etf-facts-app`（#11，C-02、R1-5）：App 每列名稱、費用與備註之後有 DisclosureGroup「產品資料」，內容與網頁相同，出處用 Link；定投試算 Section 依「標的」Picker 的選擇顯示 `Copy.evidence1x`（一般文字）或 `Copy.evidenceLeveraged`（Notice 警示），即使歷史資料不足也會顯示。資料與證據文字可隨輔助字級換行。
- `dca-monthly-minimum`：正數月額取整後至少 1 元，儲存端拒絕 0；舊規劃的月額 0 讀成預設 10000，其餘欄位與資料庫原值保留。
- `dca-save-feedback`：儲存預設與規劃時停用送出按鈕；HTTP 或網路失敗顯示 `role="alert"` 紅字，儲存預設保留伺服器具體錯誤（如登入過期、欄位錯誤）；即時欄位驗證用 `role="status"`。
- `dca-save-default`（F3b）：「設為我的預設」後 API `plan` 是那組值，離開再進來仍是；之後改回 VOO／3 年／10000。
- `plan-validate`（F4）：出場漲幅填 `150`：App「儲存」停用、顯示中文範圍說明「金額要是 0 到 10 億的整數，出場漲幅 0–100%…」；網頁「儲存規劃」停用並顯示同一句中文說明，不存入。
- `plan-save`（F5）：每批投入改 60000 儲存、讀回；之後改回 50000。
- `cost-scenario`（#12，K-02、C-03、R1-6；網頁）：定投與規劃下方「成本情境（你的假設）」填扣款幣別、換匯價差、比例／最低／固定費、優惠到期日、一般股利的假設年配息率、報酬口徑與稅務身分。按「試算成本」後列每次扣款拆解、一年 12 次交易成本；基金費用、基金層預扣、投資人層預扣各一列年化 %，不加總。NAV 口徑寫「已反映在基金淨值，不重扣」，index 列產品淨費率；其他身分不套用投資人預扣。過期優惠醒目提醒，附免責句、規則來源日期與查閱日。「清除」回到未試算；切標的、期間、金額或資金類型保留網址中的成本假設（含 issue 情境）。假設只在 URL，不存檔、不進共用快取、不改歷史試算。
- `cost-scenario-app`（#12，K-02、C-03）：App 定投試算後的「成本情境（你的假設）」按「設定假設」開可捲動 sheet，欄位名稱與預設同網頁，註明「只是試算，不會儲存」。按「試算」只將原始輸入保留在本頁 state，所有 cost* 查詢合併到 `load()`；結果、issue、分層說明、notes 與來源讀 API，不在 App 計算。可「修改假設」或「清除」；切定投條件保留成本參數，離開本頁後消失。

## How to get to it (user POV)

- 網頁：導覽列「ETF 與定投」→ `/etfs`（`/etfs?etf=IVV&years=2&monthly=5000`）；下方「定投試算（台幣）」「我的規劃」。
- App：「更多 → ETF 與定投試算」，右上「我的規劃」。

## Driving it with ego-browser / XCUITest

Preconditions:

- 基準狀態、測試帳號登入、規劃是預設值（VOO／3 年／10000、每批 50000）。

- **表格。** `goto("/etfs")`，等 `text=ETF 產品比較`；`fetch("/api/v1/etfs")` 比每列報酬。截圖 `etfs-table.png`。
- **試算。** 在「定投試算（台幣）」選 ETF 與年數（「標的」「期間」的 `select` 會直接換網址）、`input[type=number]` 填 5000、按「試算」；比 `fetch("/api/v1/etfs?etf=IVV&years=2&monthly=5000")` 的 `dca`。
- **資金類型（網頁）。** `/etfs` 的第三個 `select` 是「資金類型」，預設值 `monthly`、顯示「每月新收入」；確認只有三項 KPI，沒有一次投入 KPI，並有「每月新收入無法在期初一次投入…」整句。切成「期初已有整筆資金」（`lump`）後網址含 `funding=lump`、金額欄變「每月分批金額（台幣）」；比 API `funding`、`dca.invested`、`dca.lumpSumValue`、`dca.lumpSumReturnPct`、`dca.value`、`dca.returnPct`，確認四項 KPI、資金前提與「分批期間還沒投入的現金不計利息。」。再改標的、期間與金額，確認網址保留 `funding=lump`；截圖 `dca-monthly.png`、`dca-lump.png`、`dca-funding-retained.png`，附兩種模式的 API JSON。
- **資金類型（App）。** 試算區「期間」後的 Picker label「資金類型、每月新收入」，切換「期初已有整筆資金」；確認呈現與網頁同字、同數字，再改標的與期間仍保留選擇，截圖並與同條件 API 對帳。整合驗收時在全域模擬器鎖內只用既有 MO 機，驗完 shutdown；本票不新增 UI 測試步驟。
- **產品資料卡與證據邊界。** 開 `/etfs`，在表格與 360px 卡片展開 VOO、SPY、UPRO、SPXS 的「產品資料」，看到註冊地、配息、ISIN（或「未查核」）、費用率與查核日、倍數與每日重設、出處連結與查閱日、證據邊界句；點出處連結開到發行商頁。在定投試算切換 UPRO，確認上方出現槓桿證據警示句；切換 VOO 出現 1x 證據句。對帳 `/api/v1/etfs` 的 `rows[].facts`。
- **產品資料卡與證據邊界（App）。** 「更多 → ETF 與定投試算」，依序展開 VOO、SPY、UPRO、SPXS 列內的「產品資料」（identifier `etf-facts-<ticker>`），與同帳號 `/api/v1/etfs` 的 `rows[].facts`、`catalogAsOf`、費用率、倍數及網頁對帳；確認「出處：發行商頁面」呈 tint 色，點它能開啟來源；展開後點代號、報酬、名稱、註冊地、配息、ISIN 不會開來源，點「產品資料」標題只收合、不會開來源。緊鄰出處行的「倍數」「查閱」可能落在 Link 的點擊範圍內而開出處，屬已知殘留。試算「標的」切 UPRO 看橘色 Notice，再切 VOO 看 1x 句。一般與最大輔助字級各截圖並保存畫面文字、API JSON（`etf-facts-normal`、`etf-facts-accessibility`、`dca-evidence-upro`、`dca-evidence-voo`），確認長句、ISIN、日期與 Link 完整換行；用 `test16_Readability` 的 etfs 截圖複查整列高度。全程透過工作流程全域模擬器鎖重用既有 MO 機，L7-T1 合併前不跑 `ios-up.sh`／`down.sh`。
- **預設失敗與小數。** 開 `/etfs?monthly=1500.5`，畫面每月金額取整成 1501，按「設為我的預設」後網址的 monthly 也是 1501，API `plan.monthlyTwd` 讀回 1501。改試算金額後，以 CDP `Network.emulateNetworkConditions` 設 offline，再按儲存：出現 `p.error[role="alert"]`；恢復網路後改回預設並讀回。
- **成本情境（網頁）。** 用 `#cost-scenario input[name=costFx]` 填 0.5、`costFee` 填 0.1、`costMinUsd` 填 1、`costYield` 填 1.2，點 `button:text-is("試算成本")`。對帳同月額／標的 `/api/v1/etfs?costFee=0.1&costMinUsd=1&costFx=0.5&costYield=1.2` 的 `costScenario.perBuy`、`annualTxCostTwd`、`layers.*.pct`／`note`、`notes`、`sources`；基金費用顯示 NAV 不重扣句。把 `select[name=costBasis]` 切 index 再試算，基金費用出現、投資人預扣不變；`select[name=costTax]` 切 other 再試算，投資人層顯示「不套用：請依你的稅務身分確認」。`input[name=costPromo]` 填 2026-01-01，看到「你填的優惠已過期」；費率填 9 再送出，僅顯示中文錯誤，不列拆解或年化數字。接著直接改標的，網址 cost* 與表單費率 9、價差 0.5 仍在；切期間、資金類型或改月額按「試算」也保留。另開 `/etfs?costFee=9&costFx=0.5`，表單顯示 9 與 0.5；開 `/etfs?monthly=1500&costFixed=1500`，月額改 5000 按「試算」後保留固定費 1500 並可算出結果。最低費註記的匯率最多三位小數；index 的發行商費率來源顯示「來源日期：未標明」，查閱日等於頁首費率查核日；點「清除」後網址移除 cost*、面板顯示「尚未試算」。離開後不帶 cost* 重進也須未試算。截圖與 API JSON：`cost-scenario-nav`、`cost-scenario-index`、`cost-scenario-other`、`cost-scenario-expired`、`cost-scenario-issue`、`cost-scenario-retained`、`cost-scenario-cleared`；320px、360px、深淺模式確認完整換行與無水平捲動。面板不得有排序、「最省」「建議」。
- **成本情境的上一頁同步（網頁）。** 開 `/etfs?costFee=9`，確認費率欄為 9 且顯示「手續費比例要在 0–5% 之間」；按「清除」，確認網址沒有 cost*、費率為 0 且尚未試算，再按瀏覽器上一頁（可用 `page.evaluate(() => history.back())`），費率必須回到 9 並顯示同一錯誤。另開 `/etfs`，費率填 9 按「試算成本」，改成 0.1 再試算成功後按上一頁；網址與費率都須為 9，只顯示錯誤、不列拆解。每次返回後用同網址查詢 `/api/v1/etfs`，確認 `costScenario.issue` 與畫面一致；保存各步驟的網址、費率、錯誤、拆解是否存在與截圖（`cost-navigation-clear-back`、`cost-navigation-submit-back`）。現有 `tests/helpers/etf-page.ts` 略過 `useEffect`，靜態渲染測試無法覆蓋這兩條路徑，須在已 hydrate 的網頁執行。
- **成本情境（App，整合驗收）。** 「更多 → ETF 與定投試算」，捲到試算後「成本情境（你的假設）」，點「設定假設」。確認數字預設 0、台幣、無優惠日期、基金淨值／總報酬、台灣稅務居民，且顯示「只是試算，不會儲存」；取消後仍未試算。欄位以相同中文 label 或 identifier `costFx`、`costFee`、`costMinUsd`、`costFixed`、`costYield`、`costPromo` 定位；填價差 0.5、費率 0.1、最低 1、配息率 1.2，按鍵盤「完成」確認收起，再按 sheet 右上「試算」。逐項對帳同標的／月額 `/api/v1/etfs?costFee=0.1&costMinUsd=1&costFx=0.5&costYield=1.2` 的拆解、一年交易成本、三層數字與說明、notes、來源日期與查閱日；點來源 Link 可開來源。再點「修改假設」，確認保留輸入，改「報酬口徑」為稅前指數，基金費用出現而投資人預扣不變；改「稅務身分」為其他，投資人層顯示 API 的不套用句。優惠到期日填 2026-01-01 看過期警示；費率填 9 只顯示 API issue、不列拆解，重新修改仍為 9。切定投標的、期間、資金類型及月額後仍保留成本假設；「清除」後只剩「設定假設」，重開 sheet 回預設，離開再進頁也未試算。一般與最大輔助字級都須能捲到所有欄位、收鍵盤、完整看到結果與來源；保存 `cost-app-nav`、`cost-app-index`、`cost-app-other`、`cost-app-expired`、`cost-app-issue`、`cost-app-cleared`、`cost-app-accessibility` 截圖、畫面文字及 API JSON。全程使用工作流程全域模擬器鎖與既有 MO 機，L7-T1 合併前不跑 `ios-up.sh`／`down.sh`；本票不新增 UI 測試步驟，實際畫面留給整合驗收。
- **月額下限。** 開 `/etfs?monthly=0.4`，畫面與 API `sim.monthlyTwd` 都是 1；歷史資料足夠時仍可試算。儲存後 `plan.monthlyTwd` 讀回 1，直接送 API 月額 0 應回 400。測完改回原預設並讀回。
- **我的規劃（網頁）。** 欄位是「加碼研究預算」「單筆加碼」「檢討門檻 ±%」「待定事項與備註」，按鈕「儲存規劃」。欄位沒有 name，用整頁 `input[type=number]` 的順序：0＝每月投入（定投試算）、1＝研究預算、2＝單筆加碼、3＝檢討門檻（取第 n 個的寫法照 `ego-browser skill`）。單筆加碼改 60000、按 `button:text-is("儲存規劃")`，`fetch("/api/v1/etfs")` 的 `plan.trancheTwd` 讀回；改回 50000 再讀回一次（F5）。檢討門檻填 150 按儲存，看錯誤訊息與 `plan.exitConsiderationPct` 沒變（F4）。
- **App。** walkthrough 的 `07-etfs.png`、`07b-dca.png`；`ios-test.sh … VerifyInteractionTests/test06_EtfsPlan`：`F2-periods.txt`、`F3-dca.png`／`.txt`（IVV／2 年／5000 的結果對 API `dca`）、`F3b-reopen.txt`（離開再進來仍是「標的、IVV」「期間、2 年」「已是我的預設」）、`F4-exit150.txt`（「儲存 enabled=false」＋中文範圍說明）、`F5-reopen.txt`（60000），結束時改回 VOO／3 年／10000、每批 50000。
  App 把手：試算區的 Picker 按鈕 label「標的、VOO」「期間、3 年」，每月投入欄位 label「每月投入」，試算按鈕 label「每月投入、試算」；「設為我的預設／已是我的預設」在清單下方，要先捲出來。右上「我的規劃」的欄位 label 是「研究預算」「每批投入」「考慮出場漲幅 %」，按鈕「儲存」「取消」。
- **Proof。** `etfs-table.png`、`dca-ivv.png`、`plan-saved.png`、`plan-exit150-after-save.png`、`plan-saved.api.json`、還原後的 API JSON、App 截圖與 `.txt`。

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
