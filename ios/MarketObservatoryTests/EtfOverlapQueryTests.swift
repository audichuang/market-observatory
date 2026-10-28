import Testing
@testable import MarketObservatory

struct EtfOverlapQueryTests {
    @Test func sendsAmountsUsingAPIKeysAndOmitsZeroDirectHoldings() {
        let input = OverlapQuery(ovEtf: "300000", ov: ["NVDA": "50000", "AAPL": "0"])
        #expect(input.dictionary == ["ovEtf": "300000", "ov": "NVDA:50000"])
    }

    @Test func emptyAmountsDoNotRequestExposure() {
        #expect(OverlapQuery().dictionary.isEmpty)
        #expect(OverlapQuery(ovEtf: " ", ov: ["NVDA": "", "AAPL": "0"]).dictionary.isEmpty)
    }

    @Test func explicitZeroETFStillRequestsZeroTotalExposure() {
        #expect(OverlapQuery(ovEtf: "0", ov: ["NVDA": "0"]).dictionary == ["ovEtf": "0"])
    }

    @Test func multipleCompaniesUseCommaSeparatedKeys() {
        let input = OverlapQuery(ov: ["NVDA": "50000", "GOOGL": "10000", "AAPL": "0"])
        #expect(input.dictionary == ["ov": "GOOGL:10000,NVDA:50000"])
    }

    @Test func invalidAmountsReachAPIValidationWithoutClamping() {
        let input = OverlapQuery(ovEtf: "1000000001", ov: ["NVDA": "1.5"])
        #expect(input.dictionary == ["ovEtf": "1000000001", "ov": "NVDA:1.5"])
    }
}
