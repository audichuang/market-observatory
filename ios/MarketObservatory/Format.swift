import SwiftUI

// 數字格式與漲跌顏色，跟網頁一致（src/ui/format.ts、styles.css）：台股習慣紅漲綠跌。
enum Fmt {
    static func num(_ v: Double?, _ digits: Int = 2) -> String {
        guard let v, v.isFinite else { return "—" }
        return v.formatted(.number.precision(.fractionLength(digits)).grouping(.automatic))
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
        return "\(v.formatted(.number.precision(.fractionLength(digits))))%"
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

extension Color {
    static let up = Color(red: 0xD1 / 255, green: 0x34 / 255, blue: 0x3B / 255)
    static let down = Color(red: 0x12 / 255, green: 0x88 / 255, blue: 0x4E / 255)

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

struct CheckBadge: View {
    let status: String
    var body: some View {
        let (text, color): (String, Color) = switch status {
        case "match": ("兩源一致", .down)
        case "mismatch": ("來源不一致", .up)
        case "pending": ("待核對", .orange)
        default: ("無第二來源", .secondary)
        }
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
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
        Label {
            Text(text).font(.footnote)
        } icon: {
            Image(systemName: kind == .ok ? "checkmark.circle.fill" : kind == .info ? "info.circle.fill" : "exclamationmark.triangle.fill")
        }
        .foregroundStyle(color)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
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
