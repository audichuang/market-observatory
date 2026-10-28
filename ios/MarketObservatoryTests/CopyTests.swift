import Testing
@testable import MarketObservatory

// Target definitions must stay identical to web/src/lib/communication.ts.
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

    @Test @MainActor func probabilityComparisonUsesModelDistinctness() {
        #expect(ProbabilityComparison(probability: 0.651, baseline: 0.65, distinct: true).comparisonSummary == "估計比平常高")
        #expect(ProbabilityComparison(probability: 0.649, baseline: 0.65, distinct: true).comparisonSummary == "估計比平常低")
    }

    @Test @MainActor func undetectedDifferenceDoesNotImplyEquivalence() {
        for distinct in [false, nil] as [Bool?] {
            for probability in [0.5, 0.6, 0.7] {
                #expect(ProbabilityComparison(probability: probability, baseline: 0.6, distinct: distinct).comparisonSummary == "尚未偵測到與平常的差別")
            }
        }
    }

    @Test @MainActor func comparisonSummaryCanBeHiddenWithoutChangingDefault() {
        for distinct in [true, false, nil] as [Bool?] {
            #expect(ProbabilityComparison(probability: 0.65, baseline: 0.6, distinct: distinct,
                                          showsSummary: false).comparisonSummary == nil)
            #expect(ProbabilityComparison(probability: 0.65, baseline: 0.6, distinct: distinct).comparisonSummary != nil)
        }
    }
}
