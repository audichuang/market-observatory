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
}
