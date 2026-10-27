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
}
