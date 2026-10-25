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
