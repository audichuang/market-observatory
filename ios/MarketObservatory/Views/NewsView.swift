import SwiftUI

struct NewsView: View {
    @Environment(SessionStore.self) private var session
    @State private var state: LoadState<NewsPage> = .idle
    @State private var symbol: String?
    @State private var section = 0
    /// 月曆上選取的日子（"YYYY-MM-DD"）；nil 時用今天
    @State private var calendarDay: String?
    @State private var selected: NewsPage.Item?
    @State private var expandedDigest: String?
    @State private var collapsedSymbolDigest: String?
    @Environment(\.openURL) private var openURL
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .subheadline) private var dateWidth: CGFloat = 82

    var body: some View {
        NavigationStack {
            Loadable(state: state, retry: load) { p in content(p) }
                .navigationTitle("新聞與日曆")
        }
        .sheet(item: $selected) { n in NewsDetailSheet(item: n) }
        // 換代號時 SwiftUI 會取消上一個請求，較慢的舊回應不會蓋掉新的。
        .task(id: symbol) {
            // 推播冷啟動：日期在這個畫面建立前就放進 session 了，onChange 收不到。
            if let d = session.newsCalendarDate { openCalendar(d) }
            applySectionRequest()
            if state.value == nil || state.value?.symbol != symbol { await load() }
        }
        .onChange(of: session.newsCalendarDate) { _, new in
            if let d = new { openCalendar(d) }
        }
        .onChange(of: session.newsSectionRequest) { _, _ in applySectionRequest() }
        .onAppear { applySectionRequest() }
    }

    /// 總覽的「完整日曆 →」「全部新聞 →」：不管之前停在哪一段都切過去。
    private func applySectionRequest() {
        guard let s = session.newsSectionRequest else { return }
        section = s
        session.newsSectionRequest = nil
    }

    /// 點事件推播進來：切到日曆、選到推播的那一天（沒帶日期就停在原本選的日子）。
    private func openCalendar(_ date: String) {
        section = 1
        if !date.isEmpty { calendarDay = date }
        session.newsCalendarDate = nil
    }

    private var isLoading: Bool {
        if case .loading = state { true } else { false }
    }

    /// 換代號載入中才淡化列表、顯示中央轉圈；下拉重新整理只用系統的轉圈。
    private var isSwitchingSymbol: Bool { isLoading && state.value?.symbol != symbol }

    private func load() async {
        let requested = symbol
        state = .loading(state.value)
        do {
            let p: NewsPage = try await API.get("/api/v1/news", query: ["symbol": requested])
            guard !Task.isCancelled, requested == symbol else { return }
            state = .loaded(p)
        } catch {
            guard !Task.isCancelled, requested == symbol else { return }
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    private func content(_ p: NewsPage) -> some View {
        List {
            Section {
                Picker("內容", selection: $section) {
                    Text("新聞").tag(0)
                    Text("日曆").tag(1)
                }
                .pickerStyle(.segmented)
                .cardRow()
                if section == 0 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            Chip(text: "全部", selected: symbol == nil) { symbol = nil }
                            ForEach(p.keys, id: \.self) { k in
                                Chip(text: k, selected: symbol == k) { symbol = k }
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                }
            }
            if section == 0 {
                if let symbol { symbolDigestSection(p, symbol: symbol) } else { digestSection(p) }
                let important = p.news.filter { $0.important ?? true }
                let others = p.news.filter { !($0.important ?? true) }
                Section {
                    if p.news.isEmpty { Text("還沒有新聞。").foregroundStyle(.secondary) }
                    ForEach(important) { n in newsButton(n) }
                }
                .opacity(isSwitchingSymbol ? 0.4 : 1)
                if !others.isEmpty {
                    Section {
                        DisclosureGroup("其他 \(others.count) 則") {
                            ForEach(others) { n in newsButton(n) }
                        }
                    }
                    .opacity(isSwitchingSymbol ? 0.4 : 1)
                }
            } else {
                calendarSections(p)
            }
        }
        .listStyle(.insetGrouped)
        .overlay { if isSwitchingSymbol && section == 0 { ProgressView() } }
        .refreshable { await load() }
    }

    private func newsButton(_ n: NewsPage.Item) -> some View {
        Button { selected = n } label: {
            NewsRow(titleZh: n.titleZh, title: n.title, tone: n.tone, category: n.category, symbols: n.symbols, publisher: n.publisher, publishedAt: n.publishedAt, titleLines: 3)
        }
        .buttonStyle(.plain)
    }

    /// 名單公司的每日重點（排程寫好的）；沒有就不顯示這一段。
    @ViewBuilder
    private func digestSection(_ p: NewsPage) -> some View {
        let ds = (p.digests ?? []).sorted { (p.keys.firstIndex(of: $0.symbol) ?? .max) < (p.keys.firstIndex(of: $1.symbol) ?? .max) }
        if !ds.isEmpty {
            Section("今日重點") {
                ForEach(ds.prefix(3)) { d in digestRow(d) }
                if ds.count > 3 {
                    DisclosureGroup("其餘 \(ds.count - 3) 家") {
                        ForEach(ds.dropFirst(3)) { d in digestRow(d) }
                    }
                }
            }
        }
    }

    /// 篩到單一股票時：顯示該股最新一天的重點，預設展開全文。
    @ViewBuilder
    private func symbolDigestSection(_ p: NewsPage, symbol: String) -> some View {
        if let d = (p.digests ?? []).filter({ $0.symbol == symbol }).max(by: { $0.date < $1.date }) {
            Section("\(symbol) 重點") {
                DigestRow(digest: d, expanded: collapsedSymbolDigest != d.id) {
                    withAnimation { collapsedSymbolDigest = collapsedSymbolDigest == d.id ? nil : d.id }
                }
            }
        }
    }

    private func digestRow(_ d: NewsDigest) -> some View {
        DigestRow(digest: d, expanded: expandedDigest == d.symbol) {
            withAnimation { expandedDigest = expandedDigest == d.symbol ? nil : d.symbol }
        }
    }

    @ViewBuilder
    private func calendarSections(_ p: NewsPage) -> some View {
        let day = calendarDay ?? p.today
        let marks = p.events.reduce(into: [String: DayMarks]()) { acc, e in
            if e.kind == "earnings" { acc[e.date, default: DayMarks()].earnings = true } else { acc[e.date, default: DayMarks()].macro = true }
        }
        // 跟 API 的事件範圍一致：過去 30 天到未來 120 天
        let lower = Fmt.addDays(p.today, -30)
        let upper = Fmt.addDays(p.today, 120)
        Section {
            EventCalendarView(
                marks: marks,
                range: lower...upper,
                today: p.today,
                selected: Binding(get: { day }, set: { calendarDay = $0 })
            )
            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 4, trailing: 8))
            .listRowSeparator(.hidden)
            HStack(spacing: 14) {
                legend(Color.up, "總經（FOMC、CPI、非農）")
                legend(Color.accentColor, "名單公司財報")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .center)
            .listRowInsets(EdgeInsets(top: 0, leading: 8, bottom: 8, trailing: 8))
        }
        let todays = p.events.filter { $0.date == day }
        Section {
            if todays.isEmpty {
                Text("這天沒有登錄的事件。").foregroundStyle(.secondary)
            }
            ForEach(todays) { e in eventRow(e, showDate: false) }
        } header: {
            Text(dayHeader(day, today: p.today))
        }
        let upcoming = p.events.filter { $0.date >= p.today && $0.date != day }.prefix(5)
        if !upcoming.isEmpty {
            Section("接下來") {
                ForEach(Array(upcoming)) { e in
                    Button { calendarDay = e.date } label: { upcomingRow(e, today: p.today) }
                        .buttonStyle(.plain)
                }
            }
        }
    }

    private func dayHeader(_ day: String, today: String) -> String {
        let base = Fmt.dateWithWeekday(day)
        guard let d = Fmt.daysBetween(today, day) else { return base }
        switch d {
        case 0: return "\(base) · 今天"
        case let n where n > 0: return "\(base) · \(n) 天後"
        default: return "\(base) · \(-d) 天前"
        }
    }

    private func legend(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text)
        }
    }

    /// 「接下來」的精簡列：點了在月曆上選到那天。
    private func upcomingRow(_ e: NewsPage.Event, today: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Circle().fill(e.kind == "earnings" ? Color.accentColor : Color.up).frame(width: 7, height: 7)
            Text(Fmt.dateWithWeekday(e.date)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary).lineLimit(1).fixedSize()
            if let s = e.symbol { Text(s).font(.subheadline.monospaced().weight(.semibold)).foregroundStyle(Color.accentColor) }
            Text(e.title).font(.subheadline).lineLimit(1)
            Spacer(minLength: 4)
            if let d = Fmt.daysBetween(today, e.date) {
                Text(d == 0 ? "今天" : "\(d) 天後").font(.caption).foregroundStyle(d == 0 ? Color.orange : Color.secondary).lineLimit(1).fixedSize()
            }
        }
        .contentShape(Rectangle())
    }

    private func eventRow(_ e: NewsPage.Event, today: String? = nil, showDate: Bool = true) -> some View {
        let url = e.sourceUrl.flatMap(URL.init(string:))
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 10))
        return Button {
            if let url { openURL(url) }
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                layout {
                    if showDate {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(Fmt.dateWithWeekday(e.date)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                            .lineLimit(1).fixedSize()
                        if let t = today, let d = Fmt.daysBetween(t, e.date) {
                            Text(d == 0 ? "今天" : "\(d) 天後")
                                .font(.caption.weight(d == 0 ? .semibold : .regular))
                                .foregroundStyle(d == 0 ? Color.orange : Color.secondary)
                                .lineLimit(1).fixedSize()
                        }
                    }
                    .frame(minWidth: typeSize.isAccessibilitySize ? nil : dateWidth, alignment: .leading)
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            if let s = e.symbol {
                                Text(s).font(.subheadline.monospaced().weight(.semibold)).foregroundStyle(Color.accentColor)
                            }
                            Text(e.title).font(.subheadline).foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                                .layoutPriority(1)
                        }
                        EventStatusBadge(status: e.status)
                        if let d = e.detail, !d.isEmpty { Text(d).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.leading) }
                    }
                }
                Spacer(minLength: 0)
                if url != nil {
                    Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(Color(.secondaryLabel))
                }
            }
        }
        .disabled(url == nil)
        .accessibilityHint(url != nil ? "開啟來源網頁" : "")
        .contextMenu {
            if let s = e.symbol {
                // 改 symbol 會觸發 .task(id:) 重新載入，不必另外呼叫 load()。
                Button("看 \(s) 新聞", systemImage: "newspaper") { symbol = s; section = 0 }
            }
            if let url {
                Link(destination: url) { Label("開啟來源", systemImage: "safari") }
            }
        }
    }
}

/// 日曆事件的來源狀態，對照網頁 pages/news.tsx 的 STATUS。
private struct EventStatusBadge: View {
    let status: String
    var body: some View {
        let (text, color): (String, Color) = switch status {
        case "confirmed": ("公司已公布", .down)
        case "scheduled": ("官方日程", .down)
        case "estimated": ("Zacks 推估", .orange)
        case "tentative": ("官方暫定", .orange)
        default: (status, .secondary)
        }
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
            .lineLimit(1)
            .fixedSize()
    }
}

private struct Chip: View {
    let text: String
    let selected: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(selected ? Color.accentColor : Color.secondary.opacity(0.12), in: Capsule())
                .foregroundStyle(selected ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
    }
}
