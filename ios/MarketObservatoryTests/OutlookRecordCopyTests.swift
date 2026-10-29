import Foundation
import Testing
@testable import MarketObservatory

struct OutlookRecordCopyTests {
    @Test func upFooterPreservesEligibilityNoteVerbatim() throws {
        let track = try JSONDecoder().decode(OutlookPage.LiveTrack.self, from: Data("""
        {"n":2,"tooFew":true,"note":"只計即時發布的列（寫入時是最新交易日，且在下一個交易日美東 16:30 前寫入）；延遲補記 6 列、資格不明 2 列另列、不計分。合併所有已發布的模型版本。"}
        """.utf8))

        #expect(OutlookRecordCopy.upFooter(track) == """
        合併所有已發布的模型版本；每列以紀錄日收盤為起點。這是和樣本內、滾動驗證分開的第三種分數。
        只計即時發布的列（寫入時是最新交易日，且在下一個交易日美東 16:30 前寫入）；延遲補記 6 列、資格不明 2 列另列、不計分。合併所有已發布的模型版本。
        """)
    }

    @Test func oldBackendWithoutNoteKeepsOriginalExplanation() throws {
        let track = try JSONDecoder().decode(OutlookPage.LiveTrack.self, from: Data("""
        {"n":0,"tooFew":true}
        """.utf8))

        #expect(track.note == nil)
        #expect(OutlookRecordCopy.upFooter(track) == "合併所有已發布的模型版本；每列以紀錄日收盤為起點。這是和樣本內、滾動驗證分開的第三種分數。")
    }

    @Test func oldBackendWithoutLiveTrackOmitsFooter() {
        #expect(OutlookRecordCopy.upFooter(nil) == nil)
    }
}
