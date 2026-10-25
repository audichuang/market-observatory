import SwiftUI

/// 一天裡有哪幾類事件：總經（FOMC 等）畫紅點、名單公司財報畫藍點。
struct DayMarks: Equatable, Sendable {
    var macro = false
    var earnings = false
}

/// 月曆：有事件的日子在日期下面畫點，點一天把 selected 設成那天（"YYYY-MM-DD"）。左右滑或按箭頭換月。
/// 事件日期是美東日期字串，這裡一律用 UTC 的公曆處理，不受手機時區影響（不會差一天）。
struct EventCalendarView: View {
    let marks: [String: DayMarks]
    /// 可以選的範圍（含），跟 API 回的事件範圍一致；範圍外的日子變淡、不能點
    let range: ClosedRange<String>
    let today: String
    @Binding var selected: String

    @State private var month: Month?

    struct Month: Equatable {
        var year: Int
        var month: Int

        init(year: Int, month: Int) {
            self.year = year
            self.month = month
        }

        init?(_ iso: String) {
            let p = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
            guard p.count == 3 else { return nil }
            self.init(year: p[0], month: p[1])
        }

        func adding(_ n: Int) -> Month {
            let total = year * 12 + (month - 1) + n
            return Month(year: total / 12, month: total % 12 + 1)
        }

        var title: String { "\(year) 年 \(month) 月" }
        var key: String { String(format: "%04d-%02d", year, month) }
    }

    private static let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    private static let weekdays = ["日", "一", "二", "三", "四", "五", "六"]

    /// 這個月要畫的格子：前面補空白讓 1 號對齊星期幾（週日開頭，台灣月曆的排法）。
    private func cells(_ m: Month) -> [String?] {
        let cal = Self.calendar
        guard let first = cal.date(from: DateComponents(year: m.year, month: m.month, day: 1)),
              let days = cal.range(of: .day, in: .month, for: first)?.count else { return [] }
        let lead = cal.component(.weekday, from: first) - 1
        let dates: [String?] = (1...days).map { String(format: "%04d-%02d-%02d", m.year, m.month, $0) }
        return Array(repeating: nil, count: lead) + dates
    }

    private var shown: Month { month ?? Month(selected) ?? Month(today) ?? Month(year: 2026, month: 1) }
    private var canGoBack: Bool { shown.adding(-1).key >= String(range.lowerBound.prefix(7)) }
    private var canGoForward: Bool { shown.adding(1).key <= String(range.upperBound.prefix(7)) }

    var body: some View {
        VStack(spacing: 10) {
            header
            HStack(spacing: 0) {
                ForEach(Array(Self.weekdays.enumerated()), id: \.offset) { i, w in
                    Text(w)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color(.secondaryLabel))
                        .frame(maxWidth: .infinity)
                }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 6) {
                ForEach(Array(cells(shown).enumerated()), id: \.offset) { _, d in
                    if let d { dayCell(d) } else { Color.clear.frame(height: 1) }
                }
            }
            .id(shown.key)
            .transition(.opacity)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 30).onEnded { v in
                guard abs(v.translation.width) > abs(v.translation.height) else { return }
                if v.translation.width < 0, canGoForward { go(1) } else if v.translation.width > 0, canGoBack { go(-1) }
            }
        )
        .onChange(of: selected) { _, new in
            // 外部改了選取的日子（例如點推播進來）：翻到那個月
            if let m = Month(new), m != shown { withAnimation { month = m } }
        }
    }

    private var header: some View {
        HStack {
            Text(shown.title).font(.headline)
            Spacer()
            if shown != Month(today) {
                Button("今天") {
                    withAnimation { month = Month(today) }
                    selected = today
                }
                .font(.subheadline)
            }
            Button { go(-1) } label: { Image(systemName: "chevron.left").frame(width: 36, height: 32) }
                .disabled(!canGoBack)
                .accessibilityLabel("上個月")
            Button { go(1) } label: { Image(systemName: "chevron.right").frame(width: 36, height: 32) }
                .disabled(!canGoForward)
                .accessibilityLabel("下個月")
        }
        .buttonStyle(.borderless)
        .padding(.horizontal, 4)
    }

    private func go(_ n: Int) {
        withAnimation(.easeInOut(duration: 0.2)) { month = shown.adding(n) }
    }

    private func dayCell(_ d: String) -> some View {
        let inRange = range.contains(d)
        let isSelected = d == selected
        let isToday = d == today
        let m = marks[d] ?? DayMarks()
        let day = Int(d.suffix(2)) ?? 0
        return Button {
            selected = d
        } label: {
            VStack(spacing: 3) {
                Text("\(day)")
                    .font(.body.monospacedDigit().weight(isToday || isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? Color.white : isToday ? Color.accentColor : d < today ? Color.secondary : Color.primary)
                    .frame(width: 36, height: 36)
                    .background {
                        if isSelected { Circle().fill(Color.accentColor) } else if isToday { Circle().stroke(Color.accentColor, lineWidth: 1.5) }
                    }
                HStack(spacing: 3) {
                    if m.macro { Circle().fill(Color.up).frame(width: 6, height: 6) }
                    if m.earnings { Circle().fill(Color.blue).frame(width: 6, height: 6) }
                }
                .frame(height: 6)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!inRange)
        .opacity(inRange ? 1 : 0.3)
        .accessibilityLabel(accessibility(d, m))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func accessibility(_ d: String, _ m: DayMarks) -> String {
        var parts = [Fmt.dateWithWeekday(d)]
        if d == today { parts.append("今天") }
        if m.macro { parts.append("有總經事件") }
        if m.earnings { parts.append("有財報") }
        return parts.joined(separator: "，")
    }
}
