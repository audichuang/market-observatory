import Testing
@testable import MarketObservatory

struct EtfCostQueryTests {
    @Test func costAssumptionsUseAPIQueryKeysWithoutEmptyPromo() {
        let input = CostQuery(
            costCcy: "twd", costFx: "0.5", costFee: "0.1", costMinUsd: "1",
            costFixed: "0", costPromo: "", costYield: "1.2", costBasis: "nav", costTax: "tw"
        )
        #expect(input.dictionary == [
            "costCcy": "twd", "costFx": "0.5", "costFee": "0.1", "costMinUsd": "1",
            "costFixed": "0", "costYield": "1.2", "costBasis": "nav", "costTax": "tw",
        ])
    }

    @Test func defaultsMatchWebCostForm() {
        #expect(CostQuery().dictionary == [
            "costCcy": "twd", "costFx": "0", "costFee": "0", "costMinUsd": "0",
            "costFixed": "0", "costYield": "0", "costBasis": "nav", "costTax": "tw",
        ])
    }

    @Test func promoAndInvalidAssumptionsRemainAvailableForAPIValidation() {
        let input = CostQuery(costCcy: "usd", costFx: "0.5", costFee: "9", costPromo: "2026-01-01", costBasis: "index", costTax: "other")
        #expect(input.dictionary["costPromo"] == "2026-01-01")
        #expect(input.dictionary["costFee"] == "9")
        #expect(input.dictionary["costFx"] == "0.5")
        #expect(input.dictionary["costCcy"] == "usd")
        #expect(input.dictionary["costBasis"] == "index")
        #expect(input.dictionary["costTax"] == "other")
    }
}
