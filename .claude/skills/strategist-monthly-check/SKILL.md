---
name: strategist-monthly-check
description: 查核市場觀測室的策略師目標價表，產出逐列證據報告與候選 diff。用於每月查核、使用者指出某列過期或錯誤、機構公布新年度目標；月檢中附帶的命中率排行要求也由此辨識越界。改中位數規則或展望頁畫面／dd5 與 API 不一致的問題不觸發。
---

# 策略師表月檢

預設完成於「逐列查核報告＋候選 diff」；先交付可審閱的結果，使用者同意該 diff 後才套用資料。策略師數字只當背景，不放進機率或任何條件（X03，永不進機率）。

命中率計分或排行屬 10-27 的 U-05，須另做事前登記並合併；收到「順便算過去一年的命中率排名」時拒絕本次計算，說明另登記的前提，保留原本月檢範圍。此 skill 不新增排程、不自動發布或部署。

## 1. 列出現況

以 `web/src/lib/strategists.ts` 為資料與規則來源；先讀 `medianEligible`、`isStrategistStale`、`strategistTable` 的現行實作。在 repo 的 `web/` 執行以下唯讀指令，保存完整輸出到報告：

```sh
node --input-type=module -e '
import { STRATEGIST_TARGETS, STRATEGIST_TARGETS_CHECKED, STRATEGIST_STALE_DAYS, strategistTable } from "./src/lib/strategists.ts";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
const table = strategistTable(STRATEGIST_TARGETS, today);
console.log({ today, STRATEGIST_TARGETS_CHECKED, STRATEGIST_STALE_DAYS });
console.table(table.list.map(({ institution, firm, department, target, targetLow, targetHigh, targetIsMidpoint, horizon, horizonType, asOf, verified, verifiedOn, stale, inMedian }) => ({
  institution, firm, department, target, targetLow, targetHigh, targetIsMidpoint, horizon, horizonType, asOf, verified, verifiedOn, stale, inMedian
})));
'
```

保留機構、部門、點估計或區間及中點標記、目標期間、資料日、原文核實狀態與核實日，以及 stale、inMedian；可選欄位的 undefined 表示資料未填，不代表已核實。沿用 `STRATEGIST_STALE_DAYS` 與 `isStrategistStale`，不另訂過期天數。只查使用者指定列時也先列全表，報告註明本次查核範圍。

## 2. 逐列讀來源

每列先找機構官方研究頁、PDF 或新聞稿，實際打開並讀到目標段落。官方原文打不開時才用 Reuters factbox 或主要媒體，記下失敗網址與原因，替代證據標「二手」。搜尋摘要、其他代理的說法與新聞轉述都不能當作已讀一手原文。

每列證據記錄：

- 機構與部門：UBS Global Research／UBS GWM、Wells Fargo Securities／Wells Fargo Investment Institute（WFII）各自查核，保留共同 institution 與各自 department，不互相代用。
- 原文目標期間（含年份、年底或滾動 12 個月）與點估計或區間；區間保留 targetLow、targetHigh，以中點作 target 並標 targetIsMidpoint，不能寫成機構公布的點估計。
- 首次調整日與本篇發布／重申日分欄；不知道首次調整日就記未知，不能用重申日補成首次調整日。asOf 依現行欄位語意記數字公布或被報導的日期，說明選用哪個日期；verifiedOn 才是實際核對原文的日期。
- 來源網址、一手／二手、查閱日，以及實際看到的段落定位（標題、頁碼或段落）與支撐數字／期間的短摘錄；取不到的內容明記未讀，不補寫引文。授權清冊屬報告 #17，不在此擴充保存或轉載範圍。

**跨年停止：** 候選內容要放進與現表不同年份的年底目標（例如現表是 2026 年底、候選是 2027 年底）時，停止套用流程並回報候選來源、年份與受影響列。`medianEligible` 只看 horizonType、不分年份，混入會讓中位數混期限；須另開票修程式。本 skill 不改規則，也不把新年度偽裝成 rolling_12m 迴避。

## 3. 判定與候選變更

每列填一個查核結果，並另列證據等級與候選 verified；查核結果不是 verified 的同義詞。

| 結果 | 判定與處置 |
| --- | --- |
| changed | 已讀來源明確顯示目標、期間或其他資料有變；逐欄列舊值、新值、理由與來源。二手證據也可提出候選，但不能標 verified。 |
| unchanged | 已讀且可定位的來源明確重申同部門、同目標與同期間；只讀到二手時仍標二手、不可 verified。 |
| conflict | 相同部門與期間的來源互相矛盾；並列網址、段落與矛盾欄位，不擇一覆寫，不標 verified，待釐清。 |
| unverified | 未讀到足以判定的內容，包括搜尋沒看到更新；列搜尋與取文缺口，不當作 unchanged，也不刷新 verifiedOn。 |

只有本次實際讀到一手原文且支持該候選值，才可提出 verified: true 與本次 verifiedOn。既有列的 verified／verifiedOn 保留在現況欄，不把歷次核實當成本次已核實；沒有新證據時不擅自改舊值。

中位數完全照 `medianEligible`：只算年底目標、同機構一家一票，有研究部門用研究部門，沒有才用財富管理部門。不按數字高低、核實狀態或查核結果挑列；以 `strategistTable` 的 inMedian 說明現況。

## 4. 交付報告

寫入 `web/docs/strategist-checks/<YYYY-MM-DD>.md`，包含：

1. 查核日、範圍、程式版本、全表現況輸出與沿用的 stale 政策。
2. 逐列表格：機構／部門、舊值與候選點位或區間、原文目標期間、首次調整日、發布／重申日、候選 asOf、結果、一手／二手、候選 verified／verifiedOn、stale／inMedian、證據定位。所有列都列出，未查列明記「未查」。
3. 各列來源網址、實際讀到的段落短摘錄、來源衝突與未核實缺口；跨年候選另列阻擋原因，不放入可套用 diff。
4. 針對 `web/src/lib/strategists.ts` 的候選 diff（沒有變更也明說），每個欄位能回連證據。`web/tests/strategists.test.ts` 中釘住現有資料的斷言是資料快照：verified 名單、中位數、WFII 區間、stale／inMedian 等預期值，須依候選資料重算，把受影響的斷言 diff 一起列出供使用者同意；日期判定沿用測試固定的參考日期，不換成月檢當天。保留規則類斷言。conflict／unverified 列維持原值，列為待處理；未經使用者同意只把 diff 寫進報告，不改這兩個檔案。

報告與候選 diff 交付後，取得使用者對具體變更的同意再進入下一步；沒有同意就停在報告完成。每一列都實際查過（含留下 conflict／unverified 證據的列）才可候選更新 `STRATEGIST_TARGETS_CHECKED` 為查核日；只查部分列或仍有「未查」就保留原日期。全表查核日不代表全表 verified。

## 5. 同意後套用與驗證

只套用使用者同意的候選變更到 `web/src/lib/strategists.ts` 與 `web/tests/strategists.test.ts` 的資料快照斷言，保留尚待釐清列與規則類斷言；再按順序驗證：

1. 在 `web/` 跑 `node --test tests/strategists.test.ts`（入口：`web/tests/strategists.test.ts`）。只有規則類測試（一家一票、只算年底、45 天、區間中點等）失敗才停下回報，不繼續更新 fixture。資料快照仍有差異時，依已同意的 diff 與測試固定參考日期校正斷言，重跑至通過；不倒改已同意的資料或放寬規則來消除差異。
2. 在 `web/` 跑 `node --test tests/api-contract.test.ts`（入口：`web/tests/api-contract.test.ts`）。若失敗，先看 assertion 與 fixture 差異；僅當差異只在本次策略師列及其衍生中位數／家數／全表查核日等策略師資料時，才跑 `MO_UPDATE_API_FIXTURES=1 node --test tests/api-contract.test.ts`。其他差異停下回報，不用更新掩蓋。
3. 審閱 `ios/MarketObservatoryTests/Fixtures/generated/generated-outlook.json` 的 diff，確認只有核准的策略師資料；檢查整份 git diff，其他 generated fixture 不應變。再重跑不帶更新旗標的 API contract 測試。
4. 跑 iOS `MarketObservatoryTests` 確認 Codable 解碼相容。模擬器依 `AGENTS.md` 與 `.claude/skills/verify/SKILL.md` 的 Launch：用 `ios-up.sh <run-id> 16-plus|18-pro-max` 重用既有 `MO iPhone 16 Plus` 或 `MO iPhone 18 Pro Max`，一次只開一台、不新增裝置。從本輪 `sim.udid` 取得 UDID，在 `ios/` 依 `ios/README.md` 執行：

   ```sh
   xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory \
     -destination 'id=<模擬器 UDID>' -derivedDataPath build CODE_SIGNING_ALLOWED=NO \
     -only-testing:MarketObservatoryTests test
   ```

5. 依 `.claude/skills/verify/features/outlook.md` 的 `outlook-strategists`，在網頁與 App 開展望頁，核對點位／區間中點、日期、原文／二手標章、stale、inMedian、中位數、家數與全表核對日，留畫面及同帳號 API 證據。App 沿用上一步的 MO 模擬器；iOS 單元測試不等於 UI 驗證。本輪結束（含失敗中斷）依 verify 的 Cleanup 跑 `down.sh <run-id>`，將本輪裝置關機並保留。

把實際指令、結果與證據路徑補回報告，通過才回報套用完成。做不到的項目明寫「未驗證：缺什麼」；此流程不自行 commit、push 或發布。
