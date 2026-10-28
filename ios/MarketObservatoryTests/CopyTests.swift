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

    @Test func outlookVixStaleCopyMatchesWeb() {
        #expect(Copy.outlookUnavailable(reason: "vix-stale", spxDate: "2026-10-27", vixDate: "2026-10-20", staleSessions: 5, maxStaleSessions: 3) == "VIX 最新只到 2026-10-20，比 S&P 500（2026-10-27）落後 5 個交易日，超過 3 個交易日的上限，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。")
    }

    @Test func outlookMissingVixCopyMatchesWeb() {
        #expect(Copy.outlookUnavailable(reason: "vix-stale", spxDate: "2026-10-27", vixDate: nil, staleSessions: nil, maxStaleSessions: 3) == "還沒有 VIX 資料，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。")
    }

    @Test func outlookInsufficientCopyMatchesWeb() {
        #expect(Copy.outlookUnavailable(reason: "insufficient", spxDate: nil, vixDate: nil, staleSessions: nil, maxStaleSessions: 3) == "歷史資料還不夠計算條件與驗證，今天不產生預測。下方的過去預測紀錄與機構觀點照常顯示。")
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
        #expect(PlanCopy.note == "只是規劃，不是持倉或交易紀錄；漲跌達門檻時自己檢討，App 不會監看或提醒。")
    }
}
