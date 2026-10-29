import Testing
@testable import MarketObservatory

// Strings must stay identical to web/src/lib/communication.ts (see web/tests/communication.test.ts).
struct CopyTests {
    @Test func marketWithoutNewsExplainsItsSources() {
        let expected = "這段只根據行情數字，沒有引用新聞"
        #expect(NewsText.sourcesEmptyNote(isMarket: true, sources: [], sourcesMissing: 0) == expected)
    }

    @Test func marketWithAbsentSourceFieldsDoesNotClaimNoNews() {
        #expect(NewsText.sourcesEmptyNote(isMarket: true, sources: nil, sourcesMissing: nil) == nil)
        #expect(NewsText.sourcesEmptyNote(isMarket: true, sources: nil, sourcesMissing: 0) == nil)
        #expect(NewsText.sourcesEmptyNote(isMarket: true, sources: [], sourcesMissing: nil) == nil)
    }

    @Test func sourcesEmptyNoteDoesNotMislabelNewsOrMissingSources() {
        let source = DigestSource(id: "news", title: "Market news", titleZh: nil,
            url: "https://example.test/news", publisher: nil, publishedAt: nil)
        #expect(NewsText.sourcesEmptyNote(isMarket: true, sources: [source], sourcesMissing: 0) == nil)
        #expect(NewsText.sourcesEmptyNote(isMarket: true, sources: [], sourcesMissing: 1) == nil)
        #expect(NewsText.sourcesEmptyNote(isMarket: true, sources: nil, sourcesMissing: 1) == nil)
        #expect(NewsText.sourcesEmptyNote(isMarket: false, sources: [], sourcesMissing: 0) == nil)
    }

    @Test func dd5Definition() {
        #expect(Copy.dd5Definition(horizon: 21) == "以資料日收盤為起點，未來 21 個交易日內至少有一天收盤比它低 5% 以上")
    }

    @Test func dd5ShortLabel() {
        #expect(Copy.dd5ShortLabel(horizon: 21) == "21 個交易日內至少一天比資料日收盤低 5% 以上的機率")
    }

    @Test func upTargetLabel() {
        #expect(Copy.upTargetLabel(horizon: 21) == "約 21 個交易日後收盤高於資料日")
    }

    @Test func restNoteSaysApproximationErrorOnce() {
        // Must equal REST_NOTE in web/src/lib/snapshot.ts (see web/tests/snapshot.test.ts).
        #expect(RestLabel.note == "其他成分股（含近似誤差）＝指數漲跌減掉名單合計（權重與價格口徑不同造成的誤差也算在這裡）。")
        #expect(RestLabel.note.components(separatedBy: "近似誤差").count - 1 == 1)
    }

    @Test func percentagePointTextMatchesWeb() {
        // Must equal ppText in web/src/ui/format.ts (see web/tests/format.test.ts).
        #expect(Fmt.pp(0.35) == "+0.35 個百分點")
        #expect(Fmt.pp(-1.2) == "−1.20 個百分點")
        #expect(Fmt.pp(nil) == "—")
    }

    @Test func forecastPendingCopyMatchesWeb() {
        #expect(Copy.forecastPendingNote(forecastDate: "A", snapshotDate: "B") == "最新收盤 B 的預測還沒記錄（通常是在等當天的 VIX 或 S&P 500 收盤核對），這裡先顯示 A 收盤的紀錄；展望頁用最新資料即時試算，數字可能不同。")
        #expect(Copy.forecastPendingBadge == "待更新")
    }

    @Test func outlookVixStaleCopyMatchesWeb() {
        #expect(Copy.outlookUnavailable(reason: "vix-stale", spxDate: "2026-10-27", vixDate: "2026-10-20", staleSessions: 5, maxStaleSessions: 3) == "VIX 最新只到 2026-10-20，比 S&P 500（2026-10-27）落後 5 個交易日，超過 3 個交易日的上限，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。")
    }

    @Test func outlookMissingVixCopyMatchesWeb() {
        #expect(Copy.outlookUnavailable(reason: "vix-stale", spxDate: "2026-10-27", vixDate: nil, staleSessions: nil, maxStaleSessions: 3) == "還沒有 VIX 資料，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。")
    }

    @Test func outlookInsufficientCopyMatchesWeb() {
        #expect(Copy.outlookUnavailable(reason: "insufficient", spxDate: nil, vixDate: nil, staleSessions: nil, maxStaleSessions: 3) == "歷史資料還不夠計算條件與驗證，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。")
    }

    @Test func outlookLiveTooFewStartsFromFirstRealtimePublication() {
        #expect(Copy.outlookLiveTooFew(n: 3, horizon: 21) == "只有 3 個獨立月份（少於 12），不報分數。只取不重疊的列：從第一筆即時發布的紀錄起每 21 個交易日一列。")
        #expect(Copy.outlookLiveTooFew(n: 11, horizon: 10) == "只有 11 個獨立月份（少於 12），不報分數。只取不重疊的列：從第一筆即時發布的紀錄起每 10 個交易日一列。")
    }

    @Test func outlookUnavailableFallbackMatchesWeb() {
        let fallback = "資料不足，或 VIX 超過 3 個交易日未更新，今天沒有產生預測；下方的機構觀點與過去的預測紀錄照常顯示。"
        #expect(Copy.outlookUnavailableFallback == fallback)
        #expect(Copy.outlookUnavailable(reason: nil, spxDate: nil, vixDate: nil, staleSessions: nil, maxStaleSessions: nil) == fallback)
        #expect(Copy.outlookUnavailable(reason: "future-reason", spxDate: "2026-10-27", vixDate: "2026-10-20", staleSessions: 5, maxStaleSessions: 3) == fallback)
    }

    @Test func planCopyMatchesWeb() {
        // Must equal PLAN_RULES_TEXT in web/src/lib/plan.ts (see web/tests/plan.test.ts).
        #expect(PlanCopy.rulesText == "金額要是 0 到 10 億的整數，檢討門檻 0–100%，備註最多 2000 字。")
        #expect(PlanCopy.reviewLabel == "檢討門檻 ±%")
        #expect(PlanCopy.reviewValue(20) == "±20%")
        #expect(PlanCopy.reviewValue(0) == "0%")
        #expect(PlanCopy.reviewValue(12.5) == "±13%")
        #expect(PlanCopy.reviewValue(0.5) == "±1%")
        #expect(PlanCopy.reviewValue(2.5) == "±3%")
        #expect(PlanCopy.reviewValue(0.4) == "±0%")
        #expect(PlanCopy.note == "只是規劃，不是持倉或交易紀錄；漲跌達門檻時自己檢討，App 不會監看或提醒。")
    }

    @Test func researchTemplateMatchesWeb() {
        // Must equal the literal in web/tests/research.test.ts; web/src/lib/research.ts is the source of truth.
        let expected = """
        NVIDIA（NVDA）研究表 2026-10-28
        SEC 申報：https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=NVDA&owner=include&count=40
        公司 IR：https://investor.nvidia.com/

        1. 企業驅動：營收靠哪些業務與客戶？競爭、供應鏈與監管風險是什麼？

        2. 盈餘假設：營收的量、價、組合，利潤率與股數各怎麼假設？每個假設附來源與日期。

        3. 與共識的差異：你的理解和市場共識差在哪個假設？不知道就寫不知道。

        4. 估值敏感度：用哪種方法看估值？哪個假設改變時，結論會跟著改變？

        5. 下一個核對事件：哪一次財報、產品或法規事件可以核對？到時要看哪個數字？不預填漲跌方向。

        6. 反證：哪些看得到的結果會讓目前的理解不成立？有利與不利的證據都記下來。

        7. 論點失效條件：如果論點錯了，最可能是哪個營運假設錯了？

        這張表只整理研究問題，不是評等、目標價或買賣建議；本站不保存你填的內容。
        """
        #expect(Research.template(company: "NVIDIA", ticker: "NVDA", date: "2026-10-28") == expected)
    }

    @Test func researchEdgarPreservesHyphenatedTicker() {
        #expect(Research.edgarFilingsURL("BRK-B")?.absoluteString == "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=BRK-B&owner=include&count=40")
    }

    @Test func researchIRIncludesOnlySevenDefaults() {
        #expect(Research.irURLs.count == 7)
        #expect(Research.irURLs["AVGO"] == nil)
        #expect(Research.irURLs == [
            "NVDA": "https://investor.nvidia.com/",
            "AAPL": "https://investor.apple.com/",
            "MSFT": "https://www.microsoft.com/en-us/investor",
            "AMZN": "https://ir.aboutamazon.com/",
            "GOOGL": "https://abc.xyz/investor/",
            "META": "https://investor.atmeta.com/",
            "TSLA": "https://ir.tesla.com/",
        ])
        let template = Research.template(company: "Broadcom", ticker: "AVGO", date: "2026-10-28")
        #expect(!template.contains("公司 IR"))
        #expect(template.hasPrefix("Broadcom（AVGO）研究表 2026-10-28\nSEC 申報：https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=AVGO&owner=include&count=40\n\n1. 企業驅動："))
    }
}
