import Foundation
import Testing
@testable import MarketObservatory

// 用正式環境抓下來的 /api/v1/* 回應（Fixtures/*.json，測試帳號、預設 7 家觀察清單）驗證模型解得開。
// 解碼器直接用 API.decoder，跟 App 實際打 API 時的設定一致。
private final class BundleToken {}

private func decodeFixture<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
    let bundle = Bundle(for: BundleToken.self)
    let url = try #require(bundle.url(forResource: name, withExtension: "json"), "找不到 fixture \(name).json")
    return try API.decoder.decode(T.self, from: Data(contentsOf: url))
}

struct FixtureDecodingTests {
    @Test func me() throws { _ = try decodeFixture("me", as: Me.self) }
    @Test func overview() throws { _ = try decodeFixture("overview", as: Overview.self) }
    @Test func history() throws { _ = try decodeFixture("history", as: History.self) }
    @Test func historyForSymbol() throws { _ = try decodeFixture("history_symbol_NVDA_months_3", as: History.self) }
    @Test func news() throws { _ = try decodeFixture("news", as: NewsPage.self) }
    @Test func outlook() throws { _ = try decodeFixture("outlook", as: OutlookPage.self) }
    // 舊版（沒有 L01 欄位）的 fixture 要照樣解得開，新欄位全是 optional。
    @Test func oldOutlookHasNoNewFields() throws {
        let p = try decodeFixture("outlook", as: OutlookPage.self)
        #expect(p.outlook?.drawdown == nil)
        #expect(p.outlook?.assessments == nil)
        #expect(p.liveTrack == nil)
    }

    @Test func outlookL01() throws {
        let p = try decodeFixture("outlook_2026-10-l01", as: OutlookPage.self)
        let o = try #require(p.outlook)
        #expect(o.modelVersion == "2026-10-l01")
        #expect(o.historyStart == "1990-01-02")
        #expect(o.pick.shrinkWeight != nil)
        #expect(o.pick.cell != nil)
        #expect(o.pick.conditional?.episodes == 24)
        #expect(o.evaluation?.mde != nil)
        #expect(o.cellGate?.passed == false)
        let d = try #require(o.drawdown)
        #expect(d.scored == true)
        #expect(d.cellGate?.passed == true)
        // The dd5 walk-forward block reads drawdown.evaluation; it is separate from the up model's evaluation.
        let ddEval = try #require(d.evaluation)
        #expect(ddEval.points == 416)
        #expect(ddEval.bssLow != nil && ddEval.bssHigh != nil)
        #expect(ddEval.bss != o.evaluation?.bss)
        #expect(o.returnQuantiles?.cell?.n == 6892)
        let a = try #require(o.assessments)
        #expect(a.difference?.status == "fail")
        #expect(a.sampleAdequacy?.status == "pass")
        #expect(a.trackRecord?.status == "fail")
        #expect(a.dataFreshness?.status == "pass")
        #expect(o.globalCaveat != nil)
        #expect(p.liveTrack?.tooFew == true)
        #expect(p.frequency?.dd5 != nil)
        #expect(p.minEpisodes == 8)
        #expect(p.cells.first?.rate?.episodes == 1)
    }

    @Test func overviewL01() throws {
        let o = try decodeFixture("overview_2026-10-l01", as: Overview.self)
        #expect(o.forecast?.drawdown == nil) // 正式站當天沒有 drawdown
    }

    @Test func forecastBriefWithDrawdown() throws {
        let json = #"{"trade_date":"2026-10-23","probability":0.65,"base_rate":0.64,"call":"inconclusive","drawdown":{"p":0.12,"base":0.17,"scored":false}}"#
        let f = try API.decoder.decode(ForecastBrief.self, from: Data(json.utf8))
        #expect(f.drawdown?.scored == false)
        #expect(f.drawdown?.base == 0.17)
    }

    @Test func watchlist() throws { _ = try decodeFixture("watchlist", as: Watchlist.self) }
    @Test func push() throws { _ = try decodeFixture("push", as: PushStatus.self) }

    @Test func etfs() throws {
        let e = try decodeFixture("etfs", as: Etfs.self)
        // 1× ETF 的 drift1y 是 null，槓桿／反向 ETF 是 { actual, naive, drift } 物件。
        let voo = try #require(e.rows.first { $0.ticker == "VOO" })
        #expect(voo.drift1y == nil)
        let sso = try #require(e.rows.first { $0.ticker == "SSO" })
        let drift = try #require(sso.drift1y)
        #expect(drift.drift != nil)
        #expect(e.rows.filter { $0.multiple != 1 }.allSatisfy { $0.drift1y != nil })
    }
}
