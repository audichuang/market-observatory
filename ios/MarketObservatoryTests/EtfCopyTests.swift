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
}
