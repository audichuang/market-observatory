import Testing
@testable import MarketObservatory

// Strings must stay identical to web/src/lib/etf-copy.ts (see web/tests/etf-copy.test.ts).
struct EtfCopyTests {
    @Test func dcaLumpPremise() {
        #expect(Copy.dcaLumpPremise == "假設整筆資金在期初已備妥；逐月新收入無法照此提前投入。")
    }

    @Test func dcaBuyRule() {
        #expect(Copy.dcaBuyRule == "首筆在試算起點當天或之後的第一個交易日、之後每月第一個交易日，以收盤價買入；首月可能不是完整月份")
    }

    @Test func dcaFxRule() {
        #expect(Copy.dcaFxRule == "換匯用買入日的 USD/TWD，當天沒有匯率時沿用之前最近一筆")
    }

    @Test func fundingLabelsAndPremises() {
        #expect(Copy.fundingMonthlyLabel == "每月新收入")
        #expect(Copy.fundingLumpLabel == "期初已有整筆資金")
        #expect(Copy.dcaMonthlyNoLump == "每月新收入無法在期初一次投入，所以這裡不列一次投入對照；期初已有整筆資金時，資金類型改選「期初已有整筆資金」。")
        #expect(Copy.dcaIdleCash == "分批期間還沒投入的現金不計利息。")
    }
}
