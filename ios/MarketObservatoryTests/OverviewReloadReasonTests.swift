import Testing
@testable import MarketObservatory

struct OverviewReloadReasonTests {
    @Test func dateSelectionDimsExistingContent() {
        #expect(OverviewReloadReason.dateSelection.dimsExistingContent)
    }

    @Test func foregroundKeepsContentAndToolbarAvailable() {
        #expect(!OverviewReloadReason.foreground.dimsExistingContent)
    }

    @Test func deepLinkKeepsContentAndToolbarAvailable() {
        #expect(!OverviewReloadReason.deepLink.dimsExistingContent)
    }
}
