import SwiftUI

/// Label for the residual (index move minus the watchlist's contributions): the other constituents
/// plus weight/price approximation error. Same wording as the web (REST_LABEL in web/src/lib/snapshot.ts).
enum RestLabel {
    static let full = "其他成分股（含近似誤差）"
    /// For tight spots (chart legends, row titles); pair it with `full` in nearby copy.
    static let short = "其他成分股"
    /// Explanatory sentence; must match REST_NOTE in web/src/lib/snapshot.ts.
    static let note = "\(full)＝指數漲跌減掉名單合計（權重與價格口徑不同造成的誤差也算在這裡）。"
}

// 數字格式與漲跌顏色，跟網頁一致（src/ui/format.ts、styles.css）：台股習慣紅漲綠跌。
enum Fmt {
    static func num(_ v: Double?, _ digits: Int = 2) -> String {
        guard let v, v.isFinite else { return "—" }
        return v.formatted(.number.precision(.fractionLength(digits)).grouping(.automatic)).replacingOccurrences(of: "-", with: "−")
    }

    static func signed(_ v: Double?, _ digits: Int = 2) -> String {
        guard let v, v.isFinite else { return "—" }
        let s = abs(v).formatted(.number.precision(.fractionLength(digits)))
        return v > 0 ? "+\(s)" : v < 0 ? "−\(s)" : s
    }

    static func pct(_ v: Double?, _ digits: Int = 2) -> String {
        guard v != nil else { return "—" }
        return "\(signed(v, digits))%"
    }

    static func plainPct(_ v: Double?, _ digits: Int = 1) -> String {
        guard let v, v.isFinite else { return "—" }
        return "\(v.formatted(.number.precision(.fractionLength(digits))).replacingOccurrences(of: "-", with: "−"))%"
    }

    /// 費用率：同網頁 feeText，最多 4 位小數、去掉尾端 0（0.0945 → 0.0945%、0.03 → 0.03%）。
    static func fee(_ v: Double?) -> String {
        guard let v, v.isFinite else { return "—" }
        return "\(v.formatted(.number.precision(.fractionLength(0...4))))%"
    }

    /// 美元規模縮寫：$1.03T、$873.6B、$8.5B、$379M。
    static func compactUsd(_ v: Double?) -> String {
        guard let v, v.isFinite else { return "—" }
        let a = abs(v)
        func f(_ x: Double, _ d: Int) -> String { x.formatted(.number.precision(.fractionLength(d)).grouping(.never)) }
        if a >= 1e12 { return "$\(f(v / 1e12, 2))T" }
        if a >= 1e9 { return "$\(f(v / 1e9, 1))B" }
        if a >= 1e6 { return "$\(f(v / 1e6, 0))M" }
        return "$\(f(v, 0))"
    }

    static func twd(_ v: Double?) -> String {
        guard let v, v.isFinite else { return "—" }
        return "NT$\(v.formatted(.number.precision(.fractionLength(0))))"
    }

    /// 「2026-10-23」→「10/23（五）」
    static func dateWithWeekday(_ iso: String) -> String {
        guard let d = day(iso) else { return iso }
        let wd = ["日", "一", "二", "三", "四", "五", "六"][Calendar(identifier: .gregorian).component(.weekday, from: d) - 1]
        return "\(Int(iso.dropFirst(5).prefix(2)) ?? 0)/\(Int(iso.suffix(2)) ?? 0)（\(wd)）"
    }

    /// 「2026-10-23」→「2026/10/23」，純呈現用（資料截止日、區間起訖等一定要寫年份的地方）。
    static func fullDate(_ iso: String) -> String {
        guard iso.count >= 10 else { return iso }
        return "\(iso.prefix(4))/\(iso.dropFirst(5).prefix(2))/\(iso.dropFirst(8).prefix(2))"
    }

    static func shortDate(_ iso: String) -> String {
        guard iso.count >= 10 else { return iso }
        return "\(Int(iso.dropFirst(5).prefix(2)) ?? 0)/\(Int(iso.dropFirst(8).prefix(2)) ?? 0)"
    }

    static func day(_ iso: String) -> Date? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let parts = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return cal.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }

    /// 「YYYY-MM-DD」加減 n 天
    static func addDays(_ iso: String, _ n: Int) -> String {
        guard let d = day(iso) else { return iso }
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d.addingTimeInterval(Double(n) * 86400))
    }

    /// 兩個「YYYY-MM-DD」相差幾天（b − a），跟網頁的 daysBetween 一致。
    static func daysBetween(_ a: String, _ b: String) -> Int? {
        guard let da = day(a), let db = day(b) else { return nil }
        return Int((db.timeIntervalSince(da) / 86400).rounded())
    }

    /// ISO 時間戳 → 台北時間「10/24 05:41」
    static func taipeiTime(_ iso: String?) -> String {
        guard let iso else { return "—" }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? sqliteDate(iso)
        guard let d else { return iso }
        let out = DateFormatter()
        out.timeZone = TimeZone(identifier: "Asia/Taipei")
        out.dateFormat = "M/d HH:mm"
        return out.string(from: d)
    }

    private static func sqliteDate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return f.date(from: s)
    }
}

/// Shared forecast copy; wording must match web/src/lib/communication.ts (dd5Definition, dd5ShortLabel, upTargetLabel).
enum Copy {
    /// The overview payload carries no horizon; this mirrors the server's HORIZON (web/src/lib/forecast.ts).
    static let overviewHorizon = 21

    static func dd5Definition(horizon: Int) -> String {
        "以資料日收盤為起點，未來 \(horizon) 個交易日內至少有一天收盤比它低 5% 以上"
    }

    static func dd5ShortLabel(horizon: Int) -> String {
        "\(horizon) 個交易日內至少一天比資料日收盤低 5% 以上的機率"
    }

    static func upTargetLabel(horizon: Int) -> String {
        "約 \(horizon) 個交易日後收盤高於資料日"
    }
}

extension Color {
    // 紅漲綠跌；深色模式用較亮的同色系，深底上才有足夠對比。
    static let up = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark
            ? UIColor(red: 0xFF / 255, green: 0x6B / 255, blue: 0x6B / 255, alpha: 1)
            : UIColor(red: 0xD1 / 255, green: 0x34 / 255, blue: 0x3B / 255, alpha: 1)
    })
    static let down = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark
            ? UIColor(red: 0x3D / 255, green: 0xD6 / 255, blue: 0x8C / 255, alpha: 1)
            : UIColor(red: 0x12 / 255, green: 0x88 / 255, blue: 0x4E / 255, alpha: 1)
    })

    static func tone(_ v: Double?) -> Color {
        guard let v, v.isFinite, v != 0 else { return .secondary }
        return v > 0 ? .up : .down
    }
}

struct Delta: View {
    let value: Double?
    var digits = 2
    var percent = false
    var body: some View {
        Text(percent ? Fmt.pct(value, digits) : Fmt.signed(value, digits))
            .foregroundStyle(Color.tone(value))
            .monospacedDigit()
    }
}

/// Compare a model estimate with its historical baseline without implying an investment signal.
struct ProbabilityComparison: View {
    let probability: Double
    let baseline: Double
    let distinct: Bool?
    var digits = 1

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 24) {
                    estimate
                    Spacer(minLength: 8)
                    historical
                }
                VStack(alignment: .leading, spacing: 16) {
                    estimate
                    historical
                }
            }
            Text(comparisonSummary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    var comparisonSummary: String {
        // U-01: not detecting a difference does not establish equivalence.
        if distinct == true { return probability > baseline ? "估計比平常高" : "估計比平常低" }
        return "尚未偵測到與平常的差別"
    }

    private var estimate: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("本次估計").font(.subheadline).foregroundStyle(.secondary)
            Text(Fmt.plainPct(probability * 100, digits))
                .font(.largeTitle.weight(.bold).monospacedDigit())
                .fixedSize()
        }
        .accessibilityElement(children: .combine)
    }

    private var historical: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("歷史基準率").font(.subheadline).foregroundStyle(.secondary)
            Text(Fmt.plainPct(baseline * 100, digits))
                .font(.title2.weight(.medium).monospacedDigit())
                .foregroundStyle(.secondary)
                .fixedSize()
        }
        .accessibilityElement(children: .combine)
    }
}

/// 收盤價核對：只有兩個來源對不上時才顯示，其餘狀態（一致、待核對、無第二來源）不必看。
struct CheckBadge: View {
    let status: String
    var body: some View {
        if status == "mismatch" {
            Text("來源不一致")
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.up.opacity(0.12), in: Capsule())
                .foregroundStyle(Color.up)
        }
    }
}

/// 展望判讀：偏多紅、偏空綠（紅漲綠跌），不確定橘。
struct CallBadge: View {
    let call: String
    var body: some View {
        let (text, color): (String, Color) = switch call {
        case "up": ("高於平常", .up)
        case "down": ("低於平常", .down)
        default: ("偵測不到預測力", .secondary)
        }
        Text(text)
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            // 大字級時徽章會換成多行，Capsule 的半圓兩端會裁掉文字；用圓角矩形，單行時看起來一樣。
            .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
    }
}

extension View {
    /// 狀態提示：獨立一列、背景透明，不再包在白卡裡。
    func noticeRow() -> some View {
        self
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 8, trailing: 20))
            .listRowSeparator(.hidden)
    }

    /// 坐在灰色 grouped 背景上的卡片列（子卡片自己畫底色）。
    func cardRow() -> some View {
        self
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 8, trailing: 20))
            .listRowSeparator(.hidden)
    }

    /// 卡片底色用語意色：淺色是白卡、深色是深灰卡。
    func cardBackground() -> some View {
        self
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

struct Notice: View {
    enum Kind { case warn, bad, ok, info }
    let kind: Kind
    let text: String
    var body: some View {
        let color: Color = switch kind {
        case .warn: .orange
        case .bad: .up
        case .ok: .down
        case .info: .accentColor
        }
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: kind == .ok ? "checkmark.circle.fill" : kind == .info ? "info.circle.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(color)
            Text(text)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .font(.subheadline)
        .lineSpacing(4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

/// 載入中、錯誤、內容三態，加上下拉重新整理。
struct Loadable<T: Sendable, Content: View>: View {
    let state: LoadState<T>
    let retry: () async -> Void
    @ViewBuilder let content: (T) -> Content

    var body: some View {
        switch state {
        case .idle, .loading(nil):
            ProgressView("載入中…").frame(maxWidth: .infinity, maxHeight: .infinity)
        case let .loading(.some(v)), let .loaded(v):
            content(v)
        case let .failed(message, last):
            if let last {
                VStack(spacing: 0) {
                    Notice(kind: .bad, text: message).padding(.horizontal).padding(.top, 8)
                    content(last)
                }
            } else {
                ContentUnavailableView {
                    Label("載入失敗", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(message)
                } actions: {
                    Button("重試") { Task { await retry() } }.buttonStyle(.borderedProminent)
                }
            }
        }
    }
}

enum LoadState<T: Sendable>: Sendable {
    case idle
    case loading(T?)
    case loaded(T)
    case failed(String, T?)

    var value: T? {
        switch self {
        case .idle: nil
        case let .loading(v): v
        case let .loaded(v): v
        case let .failed(_, v): v
        }
    }
}

import Charts

extension View {
    /// 圖表座標軸用語意色，深色模式下刻度與格線都看得清楚。
    func readableAxes(yLabel: ((Double) -> String)? = nil) -> some View {
        self
            .chartXAxis {
                AxisMarks { _ in
                    AxisGridLine().foregroundStyle(Color(.separator))
                    AxisTick().foregroundStyle(Color(.secondaryLabel))
                    AxisValueLabel().foregroundStyle(Color(.secondaryLabel))
                }
            }
            .chartYAxis {
                AxisMarks { v in
                    AxisGridLine().foregroundStyle(Color(.separator))
                    AxisTick().foregroundStyle(Color(.secondaryLabel))
                    AxisValueLabel {
                        if let yLabel, let d = v.as(Double.self) { Text(yLabel(d)) } else { Text(v.as(Double.self).map { Fmt.num($0, 0) } ?? "") }
                    }
                    .foregroundStyle(Color(.secondaryLabel))
                }
            }
            // 大字級時軸標籤不要把繪圖區吃掉。
            .dynamicTypeSize(...DynamicTypeSize.xLarge)
    }
}
