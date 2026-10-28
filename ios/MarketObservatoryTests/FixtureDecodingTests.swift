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
    @Test func generatedOverview() throws {
        let p = try decodeFixture("generated-overview", as: Overview.self)
        #expect(p.snapshot != nil && p.forecast?.drawdown != nil)
        let market = try #require(p.market)
        #expect(market.sourcesMissing == 1)
        #expect(market.sources?.count == 1)
        #expect(market.sources?.first?.url == "https://example.test/news")
        #expect(p.digests?.first?.sources?.first?.titleZh == "NVIDIA 財報更新")
    }
    @Test func generatedHistory() throws {
        let p = try decodeFixture("generated-history", as: History.self)
        #expect(p.stats.allSatisfy { $0.first != nil })
    }
    @Test func generatedNews() throws {
        let p = try decodeFixture("generated-news", as: NewsPage.self)
        #expect(p.latestTradeDate == "2026-10-28")
        let digest = try #require(p.digests?.first { $0.symbol == "NVDA" })
        let sources = try #require(digest.sources)
        #expect(sources.count == 1)
        let source = try #require(sources.first)
        #expect(source.id == "contract-news")
        #expect(source.title == "NVIDIA earnings")
        #expect(source.titleZh == "NVIDIA 財報更新")
        #expect(source.url == "https://example.test/news")
        #expect(source.publisher == "合成新聞")
        #expect(source.publishedAt == "2026-10-28T23:00:00.000Z")
        #expect(digest.sourcesMissing == 0)
    }
    @Test func generatedWatchlist() throws { _ = try decodeFixture("generated-watchlist", as: Watchlist.self) }
    @Test func generatedEtfs() throws {
        let p = try decodeFixture("generated-etfs", as: Etfs.self)
        #expect(p.costScenario?.perBuy?.costPct != nil)
        #expect(p.overlap?.exposure != nil)
        let overlap = try #require(p.overlap)
        #expect(overlap.proxy == "SPY" && overlap.applicable == true)
        #expect(overlap.members?.first { $0.key == "GOOGL" }?.weightPct == 7.5)
        #expect(overlap.totalWeight == 34 && overlap.top10CompanyWeight == 36)
        #expect(overlap.inputs?.ovEtf == 300000 && overlap.inputs?.ov?["NVDA"] == 50000)
        let nvda = try #require(overlap.exposure?.members?.first { $0.key == "NVDA" })
        #expect(nvda.viaEtfTwd == 18000 && nvda.directTwd == 50000 && nvda.combinedTwd == 68000)
        #expect(nvda.sharePct == 19.428571428571427)
        #expect(overlap.exposure?.totalTwd == 350000 && overlap.exposure?.otherViaEtfTwd == 198000)
        #expect(overlap.exposure?.watchlistSharePct == 43.42857142857143)
        #expect(p.funding == "monthly")
        #expect(p.dca != nil)
        #expect(p.dca?.firstBuyDate != nil)
        #expect(p.rows.first { $0.ticker == "SSO" }?.drift1y != nil)
        let voo = try #require(p.rows.first { $0.ticker == "VOO" })
        let facts = try #require(voo.facts)
        #expect(facts.domicile == "美國")
        #expect(facts.distribution == "配息（每季）")
        #expect(facts.isin == nil)
        #expect(facts.sourceUrl == "https://investor.vanguard.com/investment-products/etfs/profile/voo")
        #expect(facts.checkedAt == "2026-10-28")
        #expect(p.rows.first { $0.ticker == "SPY" }?.facts?.isin == "US78462F1030")
        #expect(p.checklists?.count == 2)
        let checklists = try #require(p.checklists)
        #expect(checklists.allSatisfy { !$0.items.isEmpty })
        #expect(checklists.map(\.id) == ["tw-overseas-income", "us-estate"])
        #expect(checklists.allSatisfy { !$0.title.isEmpty && !$0.footer.isEmpty && !$0.sources.isEmpty })
        #expect(checklists.flatMap(\.sources).allSatisfy {
            !$0.label.isEmpty && $0.url.hasPrefix("https://") && !$0.updatedAt.isEmpty && !$0.checkedAt.isEmpty
        })
        #expect(checklists.first?.note != nil)
        #expect(checklists.last?.note == nil)
        #expect(checklists.last?.sources.last?.updatedAt == "2025-09")
    }
    @Test func generatedOutlook() throws {
        let p = try decodeFixture("generated-outlook", as: OutlookPage.self)
        #expect(p.outlook?.drawdown != nil)
        #expect(p.outlookUnavailable == nil)
        #expect(p.liveTrackDd5 != nil)
        #expect(p.liveTrack?.note != nil)
        #expect(p.phaseSummary?.dd5?.mean != nil)
        #expect(p.strategists?.staleAfterDays == 45)
        #expect(p.strategists?.list.contains { $0.targetLow != nil && $0.verifiedOn != nil } == true)
    }
    @Test func consensusCoverageAndRange() throws {
        let p = try decodeFixture("generated-outlook", as: OutlookPage.self)
        let c = try #require(p.consensus)
        #expect(c.coverage?.target?.weightPct != nil)
        #expect(c.coverage?.target?.weightPct == c.coveredWeightPct)
        #expect(c.noData?.symbols == 1)
        #expect(c.weightsAsOf == "2026-10-28")
        #expect(c.top.first?.targetLow == 90)
        #expect(c.top.first?.fiscalEnd == "Dec 2026")
        #expect(c.top.first?.estimates == 20)
        #expect(c.top.first?.priceDate == "2026-10-27")

        let old = try decodeFixture("outlook", as: OutlookPage.self)
        let oldConsensus = try #require(old.consensus)
        #expect(oldConsensus.coverage == nil)
        #expect(oldConsensus.top.first?.targetLow == nil)
    }
    @Test func me() throws { _ = try decodeFixture("me", as: Me.self) }
    @Test func overview() throws {
        let p = try decodeFixture("overview", as: Overview.self)
        #expect(p.market?.sources == nil && p.market?.sourcesMissing == nil)
        #expect(p.digests?.first?.sources == nil)
    }
    @Test func history() throws {
        let p = try decodeFixture("history", as: History.self)
        #expect(p.stats.allSatisfy { $0.first == nil })
    }
    @Test func historyForSymbol() throws { _ = try decodeFixture("history_symbol_NVDA_months_3", as: History.self) }
    @Test func news() throws {
        let p = try decodeFixture("news", as: NewsPage.self)
        #expect(p.latestTradeDate == nil)
        #expect(p.digests?.first?.sources == nil && p.digests?.first?.sourcesMissing == nil)
    }
    @Test func legacyDigestsWithoutSources() throws {
        let company = #"{"symbol":"NVDA","date":"2026-10-28","summary":"舊格式公司重點","tone":"positive"}"#
        let news = try API.decoder.decode(NewsDigest.self, from: Data(company.utf8))
        #expect(news.sources == nil && news.sourcesMissing == nil)
        let market = #"{"date":"2026-10-28","summary":"舊格式市場重點","tone":"neutral"}"#
        let digest = try API.decoder.decode(MarketDigest.self, from: Data(market.utf8))
        #expect(digest.sources == nil && digest.sourcesMissing == nil)
    }
    @Test func digestSourceWithoutMetadata() throws {
        let json = #"{"id":"source-en","title":"English source","url":"https://example.test/source"}"#
        let source = try API.decoder.decode(DigestSource.self, from: Data(json.utf8))
        #expect(source.title == "English source")
        #expect(source.titleZh == nil && source.publisher == nil && source.publishedAt == nil)
    }
    @Test func outlook() throws { _ = try decodeFixture("outlook", as: OutlookPage.self) }
    // 策略師表 2026-10 加的欄位：舊回應沒有時為 nil，新回應解得開。
    @Test func strategistMetadata() throws {
        let old = try decodeFixture("outlook", as: OutlookPage.self)
        let first = try #require(old.strategists?.list.first)
        #expect(first.inMedian == nil && first.stale == nil && first.targetIsMidpoint == nil)
        #expect(old.strategists?.medianRule == nil)
        let json = """
        {"list":[{"firm":"Wells Fargo Investment Institute","institution":"Wells Fargo","department":"wealth_management","target":7900,"targetLow":7800,"targetHigh":8000,"targetIsMidpoint":true,"horizon":"2026 年底","horizonType":"year_end","asOf":"2026-06-15","sourceUrl":"https://example.com","verified":true,"verifiedOn":"2026-10-27","inMedian":false,"stale":true}],
         "median":7950,"medianCount":11,"medianRule":"一家一票","staleAfterDays":45,"checked":"2026-10-25"}
        """
        let s = try API.decoder.decode(OutlookPage.Strategists.self, from: Data(json.utf8))
        let t = try #require(s.list.first)
        #expect(t.target == 7900 && t.targetLow == 7800 && t.targetHigh == 8000 && t.targetIsMidpoint == true)
        #expect(t.inMedian == false && t.stale == true && t.verified == true)
        #expect(s.medianCount == 11 && s.staleAfterDays == 45)
    }
    // 舊版（沒有 L01 欄位）的 fixture 要照樣解得開，新欄位全是 optional。
    @Test func oldOutlookHasNoNewFields() throws {
        let p = try decodeFixture("outlook", as: OutlookPage.self)
        #expect(p.outlookUnavailable == nil)
        #expect(p.outlook?.drawdown == nil)
        #expect(p.outlook?.assessments == nil)
        #expect(p.liveTrack == nil)
        #expect(p.liveTrackDd5 == nil)
        #expect(p.liveTrack?.note == nil)
        #expect(p.phaseSummary == nil)
    }

    @Test func partialPhaseSummary() throws {
        let json = #"{"up":{},"dd5":{"cycles":{}}}"#
        let summary = try API.decoder.decode(OutlookPage.PhaseSummary.self, from: Data(json.utf8))
        #expect(summary.asOf == nil && summary.modelVersion == nil && summary.computedAt == nil)
        #expect(summary.phases == nil && summary.up?.mean == nil && summary.dd5?.cycles?.total == nil)
    }

    @Test func partialDd5LiveTrack() throws {
        let track = try API.decoder.decode(OutlookPage.Dd5LiveTrack.self, from: Data(#"{"groups":[{}]}"#.utf8))
        #expect(track.realtime == nil && track.delayed == nil && track.unknown == nil && track.note == nil)
        let group = try #require(track.groups?.first)
        #expect(group.modelVersion == nil && group.n == nil && group.tooFew == nil)
        #expect(group.brier == nil && group.brierBase == nil && group.bss == nil && group.eventShare == nil)
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

    @Test func outlookUnavailable() throws {
        let json = #"{"reason":"vix-stale","spxDate":"2026-10-27","vixDate":"2026-10-20","staleSessions":5,"maxStaleSessions":3}"#
        let u = try API.decoder.decode(OutlookPage.Unavailable.self, from: Data(json.utf8))
        #expect(u.reason == "vix-stale")
        #expect(u.spxDate == "2026-10-27" && u.vixDate == "2026-10-20")
        #expect(u.staleSessions == 5 && u.maxStaleSessions == 3)
    }

    @Test func watchlist() throws { _ = try decodeFixture("watchlist", as: Watchlist.self) }
    @Test func push() throws { _ = try decodeFixture("push", as: PushStatus.self) }

    @Test func etfs() throws {
        let e = try decodeFixture("etfs", as: Etfs.self)
        #expect(e.costScenario == nil)
        #expect(e.overlap == nil)
        #expect(e.funding == nil)
        #expect(e.dca?.firstBuyDate == nil)
        #expect(e.rows.allSatisfy { $0.facts == nil })
        #expect(e.checklists == nil)
        // 1× ETF 的 drift1y 是 null，槓桿／反向 ETF 是 { actual, naive, drift } 物件。
        let voo = try #require(e.rows.first { $0.ticker == "VOO" })
        #expect(voo.drift1y == nil)
        let sso = try #require(e.rows.first { $0.ticker == "SSO" })
        let drift = try #require(sso.drift1y)
        #expect(drift.drift != nil)
        #expect(e.rows.filter { $0.multiple != 1 }.allSatisfy { $0.drift1y != nil })
    }

    @Test func costScenarioAllowsIssueAndMissingFields() throws {
        let issue = try API.decoder.decode(CostScenario.self, from: Data(#"{"issue":"手續費比例要在 0–5% 之間"}"#.utf8))
        #expect(issue.issue == "手續費比例要在 0–5% 之間")
        #expect(issue.perBuy == nil)
        let partial = try API.decoder.decode(CostScenario.self, from: Data(#"{"perBuy":{},"layers":{"fundExpense":{},"fundWithholding":{},"investorWithholding":{}},"promo":{},"sources":[{}],"inputs":{}}"#.utf8))
        #expect(partial.perBuy?.costPct == nil)
        #expect(partial.layers?.fundExpense?.pct == nil)
        #expect(partial.layers?.fundWithholding?.note == nil)
        #expect(partial.layers?.investorWithholding?.pct == nil)
        #expect(partial.promo?.expired == nil)
        #expect(partial.sources?.first?.url == nil)
        #expect(partial.inputs?.costFee == nil)
    }

    @Test func costScenarioDecodesIndexOtherAndExpiredPromo() throws {
        let json = #"{"layers":{"fundExpense":{"pct":0.03,"note":"基金淨費用率（占持有市值的年化 %）"},"fundWithholding":{"pct":0},"investorWithholding":{"pct":null,"note":"不套用：請依你的稅務身分確認"}},"promo":{"until":"2026-01-01","expired":true},"inputs":{"costBasis":"index","costTax":"other","costPromo":"2026-01-01"}}"#
        let scenario = try API.decoder.decode(CostScenario.self, from: Data(json.utf8))
        #expect(scenario.layers?.fundExpense?.pct == 0.03)
        #expect(scenario.layers?.fundWithholding?.pct == 0)
        #expect(scenario.layers?.investorWithholding?.pct == nil)
        #expect(scenario.layers?.investorWithholding?.note == "不套用：請依你的稅務身分確認")
        #expect(scenario.promo?.until == "2026-01-01")
        #expect(scenario.promo?.expired == true)
        #expect(scenario.inputs?.costBasis == "index")
        #expect(scenario.inputs?.costTax == "other")
    }

    @Test func overlapAllowsIssueAndMissingFields() throws {
        let empty = try API.decoder.decode(Overlap.self, from: Data("{}".utf8))
        #expect(empty.members == nil && empty.exposure == nil && empty.notes == nil)
        let partial = try API.decoder.decode(Overlap.self, from: Data(#"{"members":[{}],"exposure":{"members":[{}]},"inputs":{}}"#.utf8))
        #expect(partial.members?.first?.key == nil && partial.members?.first?.weightPct == nil)
        #expect(partial.exposure?.members?.first?.combinedTwd == nil)
        #expect(partial.exposure?.totalTwd == nil && partial.exposure?.watchlistSharePct == nil)
        #expect(partial.inputs?.ovEtf == nil && partial.inputs?.ov == nil)
        let issue = try API.decoder.decode(Overlap.self, from: Data(#"{"issue":"金額要是 0 到 10 億台幣的整數"}"#.utf8))
        #expect(issue.issue == "金額要是 0 到 10 億台幣的整數" && issue.exposure == nil)
    }

    @Test func overlapDecodesInapplicableAndUndefinedShares() throws {
        let inapplicable = try API.decoder.decode(Overlap.self, from: Data(#"{"applicable":false,"exposure":null,"notes":["槓桿與反向 ETF 用衍生工具達成每日倍數，不適用持股重疊推估。"]}"#.utf8))
        #expect(inapplicable.applicable == false && inapplicable.exposure == nil)
        #expect(inapplicable.notes?.first == "槓桿與反向 ETF 用衍生工具達成每日倍數，不適用持股重疊推估。")
        let zero = try API.decoder.decode(Overlap.self, from: Data(#"{"exposure":{"members":[{"key":"NVDA","viaEtfTwd":0,"directTwd":0,"combinedTwd":0,"sharePct":null}],"totalTwd":0,"watchlistSharePct":null,"otherViaEtfTwd":0}}"#.utf8))
        #expect(zero.exposure?.totalTwd == 0 && zero.exposure?.watchlistSharePct == nil)
        #expect(zero.exposure?.members?.first?.combinedTwd == 0 && zero.exposure?.members?.first?.sharePct == nil)
    }
}
