import Foundation

// 對應後端 src/server/views.ts 等回傳的 JSON。解碼用 convertFromSnakeCase（published_at → publishedAt）；
// 可能是 null 的欄位一律 Optional，後端多加欄位不會壞。

// MARK: - 帳號

struct Me: Decodable, Sendable {
    let id: String
    let email: String
    let name: String?
    let isOwner: Bool
}

// MARK: - 總覽

struct Overview: Decodable, Sendable {
    let snapshot: SnapshotRow?
    let revisions: [Revision]
    let dates: [SnapshotDate]
    let expectedClose: String
    let news: [NewsBrief]
    let events: [EventBrief]
    let lastPriceRun: PriceRun?
    let forecast: ForecastBrief?
    let restCount: Int?
    let viewingLatest: Bool
}

struct SnapshotRow: Decodable, Sendable {
    let tradeDate: String
    let revision: Int
    let reason: String
    let createdAt: String
    let data: Snapshot
}

struct Revision: Decodable, Sendable, Hashable {
    let revision: Int
    let reason: String
    let createdAt: String
}

struct SnapshotDate: Decodable, Sendable, Hashable {
    let tradeDate: String
    let revision: Int
}

struct Snapshot: Decodable, Sendable {
    struct Check: Decodable, Sendable {
        let status: String
        let source: String?
        let close: Double?
    }

    struct Index: Decodable, Sendable {
        let close: Double
        let prevClose: Double?
        let changePts: Double?
        let returnPct: Double?
        let weekPct: Double?
        let monthPct: Double?
        let ytdPct: Double?
        let yearPct: Double?
        let high52: Double?
        let low52: Double?
        let fromHighPct: Double?
        let sma20: Double?
        let sma60: Double?
        let sma200: Double?
        let check: Check
    }

    struct Vix: Decodable, Sendable {
        let close: Double?
        let prevClose: Double?
        let change: Double?
        let monthHigh: Double?
        let monthLow: Double?
    }

    struct Breadth: Decodable, Sendable {
        let rspReturnPct: Double?
        let spxReturnPct: Double?
        let spreadPct: Double?
        let rspMonthPct: Double?
        let spxMonthPct: Double?
    }

    struct Total: Decodable, Sendable {
        let weightPct: Double?
        let contributionPts: Double?
        let shareOfMovePct: Double?
    }

    struct Rest: Decodable, Sendable {
        let contributionPts: Double?
        let impliedReturnPct: Double?
    }

    struct Weights: Decodable, Sendable {
        let asOf: String?
        let method: String?
        let note: String
    }

    struct Quality: Decodable, Sendable {
        let missing: [String]
        let mismatches: [String]
        let pendingChecks: [String]
        let expectedSession: Bool?
        let notes: [String]
    }

    let tradeDate: String
    let prevDate: String?
    let index: Index
    let vix: Vix
    let breadth: Breadth
    let mag7: [Mag7Row]
    let mag7Total: Total
    let rest: Rest
    let weights: Weights
    let quality: Quality
    let notTracked: [String]?
}

struct Mag7Row: Decodable, Sendable, Identifiable {
    var id: String { key }
    let key: String
    let company: String
    let tickers: [String]
    let close: Double?
    let prevClose: Double?
    let returnPct: Double?
    let weightPct: Double?
    let weightMethod: String?
    let contributionPts: Double?
    let shareOfMovePct: Double?
    let check: String
}

struct NewsBrief: Decodable, Sendable, Identifiable {
    var id: String { url }
    let title: String
    let url: String
    let publisher: String?
    let publishedAt: String?
    let symbols: String
}

struct EventBrief: Decodable, Sendable, Identifiable {
    var id: String { "\(date)-\(kind)-\(symbol ?? "")-\(title)" }
    let date: String
    let kind: String
    let symbol: String?
    let title: String
    let status: String
}

struct PriceRun: Decodable, Sendable {
    let status: String
    let summary: String?
    let finishedAt: String?
}

struct ForecastBrief: Decodable, Sendable {
    let tradeDate: String
    let probability: Double
    let baseRate: Double
    let call: String
}

// MARK: - 走勢

struct History: Decodable, Sendable {
    struct PricePoint: Decodable, Sendable, Identifiable {
        var id: String { date }
        let date: String
        let close: Double
        let sma20: Double?
        let sma60: Double?
        let sma200: Double?
    }

    struct MainStats: Decodable, Sendable {
        let ret: Double?
        let mdd: Double?
        let points: Int
        let first: String?
        let last: String?
    }

    struct Rebased: Decodable, Sendable, Identifiable {
        var id: String { symbol }
        let symbol: String
        let points: [ValuePoint]
    }

    struct ValuePoint: Decodable, Sendable {
        let date: String
        let value: Double?
    }

    struct Stat: Decodable, Sendable, Identifiable {
        var id: String { symbol }
        let symbol: String
        let label: String?
        let close: Double?
        let ret: Double?
        let mdd: Double?
        let vol: Double?
    }

    struct Contribution: Decodable, Sendable, Identifiable {
        var id: String { date }
        let date: String
        let index: Double?
        let mag7: Double?
        let rest: Double?
    }

    let symbol: String
    let label: String?
    let watch: [String]
    let months: Int
    let ranges: [Int]
    let symbols: [[String]]
    let priceLine: [PricePoint]
    let mainStats: MainStats
    let rebased: [Rebased]
    let stats: [Stat]
    let contribution: [Contribution]
}

// MARK: - 名單

struct Watchlist: Decodable, Sendable {
    struct Member: Decodable, Sendable, Identifiable {
        var id: String { key }
        let key: String
        let company: String
        let tickers: [String]
        let weightPct: Double
        let outOfIndex: [String]
    }

    struct Candidate: Decodable, Sendable, Identifiable {
        var id: String { ticker }
        let ticker: String
        let name: String
        let weightPct: Double
        let tracked: Bool?
    }

    let members: [Member]
    let candidates: [Candidate]
    let asOf: String?
    let totalWeight: Double
    let max: Int
    let summary: String?
}

// MARK: - 新聞與日曆

struct NewsPage: Decodable, Sendable {
    struct Item: Decodable, Sendable, Identifiable {
        let id: String
        let symbols: String
        let title: String
        let url: String
        let publisher: String?
        let publishedAt: String?
    }

    struct Event: Decodable, Sendable, Identifiable {
        let id: String
        let date: String
        let kind: String
        let symbol: String?
        let title: String
        let detail: String?
        let status: String
        let sourceUrl: String?
    }

    let symbol: String?
    let keys: [String]
    let today: String
    let news: [Item]
    let events: [Event]
}

// MARK: - ETF 與定投

struct Plan: Codable, Sendable, Equatable {
    var monthlyTwd: Int
    var etf: String
    var years: Int
    var researchBudgetTwd: Int
    var trancheTwd: Int
    var exitConsiderationPct: Double
    var notes: String
}

struct Etfs: Decodable, Sendable {
    /// 槓桿／反向 ETF 近一年：實際報酬、「倍數 × 指數報酬」與兩者之差。
    struct Drift: Decodable, Sendable {
        let actual: Double?
        let naive: Double?
        let drift: Double?
    }

    struct Row: Decodable, Sendable, Identifiable {
        var id: String { ticker }
        let ticker: String
        let name: String
        let issuer: String
        let multiple: Double
        let grossFeePct: Double?
        let netFeePct: Double?
        let aumUsd: Double?
        let aumAsOf: String?
        let close: Double?
        let lastDate: String?
        let ytd: Double?
        let returns: [String: Double?]
        let drift1y: Drift?
        let note: String?
    }

    struct Sim: Decodable, Sendable {
        let etf: String
        let years: Int
        let monthlyTwd: Double
        let startDate: String
    }

    struct Dca: Decodable, Sendable {
        struct Step: Decodable, Sendable, Identifiable {
            var id: String { date }
            let date: String
            let invested: Double
            let value: Double
        }

        let months: Int
        let invested: Double
        let value: Double
        let returnPct: Double?
        let lumpSumValue: Double?
        let lumpSumReturnPct: Double?
        let maxDrawdownPct: Double?
        let path: [Step]
    }

    struct Fx: Decodable, Sendable {
        let date: String
        let close: Double
    }

    let asOf: String
    let catalogAsOf: String?
    let rows: [Row]
    let periods: [String]
    let plan: Plan
    let sim: Sim
    let dca: Dca?
    let fxLast: Fx?
}

// MARK: - 下月展望

struct OutlookPage: Decodable, Sendable {
    struct Outlook: Decodable, Sendable {
        struct Pick: Decodable, Sendable {
            struct Base: Decodable, Sendable { let p: Double }
            let p: Double
            let basis: String
            let base: Base
            let distinct: Bool?
        }

        struct Regime: Decodable, Sendable {
            let aboveSma200: Bool
            let vixStress: Bool
        }

        let asOf: String
        let close: Double
        let sma200: Double?
        let vix: Double?
        let regime: Regime?
        let pick: Pick
        let call: String
        let reasons: [String]
    }

    struct Rate: Decodable, Sendable {
        let p: Double
        let low: Double
        let high: Double
        let nEff: Double
        let days: Int
    }

    struct Cell: Decodable, Sendable, Identifiable {
        var id: String { label }
        let label: String
        let current: Bool
        let rate: Rate?
    }

    struct Track: Decodable, Sendable {
        let n: Int
        let brier: Double
        let brierBase: Double
        let upShare: Double
    }

    struct Consensus: Decodable, Sendable {
        let symbols: Int
        let coveredWeightPct: Double?
        let impliedUpsidePct: Double?
        let buyPct: Double?
        let revisionBreadth: Double?
        let impliedIndexTarget: Double?
    }

    struct Strategists: Decodable, Sendable {
        struct Target: Decodable, Sendable, Identifiable {
            var id: String { firm }
            let firm: String
            let target: Double
            let horizon: String?
            let asOf: String?
            let note: String?
            let sourceUrl: String?
        }

        let list: [Target]
        let median: Double?
        let medianUpsidePct: Double?
    }

    let outlook: Outlook?
    let cells: [Cell]
    let track: Track?
    let consensus: Consensus?
    let strategists: Strategists?
    let horizon: Int
    /// 有效樣本少於這個數的條件不採用（網頁顯示灰字）。
    let minN: Int?
}

// MARK: - 推播

struct PushPrefs: Codable, Sendable, Equatable {
    var daily: Bool
    var moves: Bool
    var moveThresholdPct: Double
    var events: Bool
}

struct PushStatus: Decodable, Sendable {
    struct Device: Decodable, Sendable, Identifiable {
        var id: String { "\(environment)-\(updatedAt)" }
        let environment: String
        let appVersion: String?
        let updatedAt: String
        let lastError: String?
    }

    let prefs: PushPrefs
    let devices: [Device]
    let configured: Bool
}

struct PushTestResult: Decodable, Sendable {
    struct Item: Decodable, Sendable, Identifiable {
        var id: String { device }
        let device: String
        let environment: String
        let result: String
    }

    let results: [Item]
}
