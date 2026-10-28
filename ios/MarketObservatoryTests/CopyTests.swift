import Testing
@testable import MarketObservatory

// Strings must stay identical to web/src/lib/communication.ts (see web/tests/communication.test.ts).
struct CopyTests {
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
