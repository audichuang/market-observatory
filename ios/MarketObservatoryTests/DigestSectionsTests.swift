import Testing
@testable import MarketObservatory

struct DigestSectionsTests {
    private let d1 = "2026-10-27"
    private let d2 = "2026-10-28"

    private func digest(_ symbol: String, _ date: String) -> NewsDigest {
        NewsDigest(symbol: symbol, company: symbol, date: date, summary: "公司重點", tone: "positive")
    }

    @Test func latestTradingDaySeparatesOlderDigests() {
        let sections = DigestSections.split([digest("NVDA", d2), digest("AAPL", d1)], latest: d2)
        #expect(sections.current.map(\.symbol) == ["NVDA"])
        #expect(sections.earlier.map(\.symbol) == ["AAPL"])
        #expect(sections.title == "今日重點 · 10/28（三）")
    }

    @Test func oldBackendUsesOneNeutralSection() {
        let sections = DigestSections.split([digest("AAPL", d1), digest("NVDA", d2)], latest: nil)
        #expect(sections.current.map(\.symbol) == ["AAPL", "NVDA"])
        #expect(sections.earlier.isEmpty)
        #expect(sections.latestDate == d2)
        #expect(sections.title == "公司重點")
    }

    @Test func stalledDigestsNeverBecomeToday() {
        let sections = DigestSections.split([digest("NVDA", d1), digest("AAPL", d1)], latest: d2)
        #expect(sections.current.isEmpty)
        #expect(sections.earlier.map(\.symbol) == ["NVDA", "AAPL"])
        #expect(sections.latestDate == d2)
    }

    @Test func noDigestsProducesNoRows() {
        let sections = DigestSections.split([], latest: nil)
        #expect(sections.current.isEmpty && sections.earlier.isEmpty)
        #expect(sections.latestDate == nil)
        #expect(sections.title == "公司重點")
    }
}
