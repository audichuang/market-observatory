import SwiftUI

struct NewsView: View {
    @Environment(SessionStore.self) private var session
    @State private var state: LoadState<NewsPage> = .idle
    @State private var symbol: String?
    @State private var section = 0
    @Environment(\.openURL) private var openURL
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .subheadline) private var dateWidth: CGFloat = 82

    var body: some View {
        NavigationStack {
            Loadable(state: state, retry: load) { p in content(p) }
                .navigationTitle("新聞與日曆")
        }
        // 換代號時 SwiftUI 會取消上一個請求，較慢的舊回應不會蓋掉新的。
        .task(id: symbol) {
            // 推播冷啟動：日期在這個畫面建立前就放進 session 了，onChange 收不到。
            if session.newsCalendarDate != nil { section = 1; session.newsCalendarDate = nil }
            if state.value == nil || state.value?.symbol != symbol { await load() }
        }
        .onChange(of: session.newsCalendarDate) { _, new in
            if new != nil { section = 1; session.newsCalendarDate = nil }
        }
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
                .listRowSeparator(.hidden)
                if section == 0 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            Chip(text: "全部", selected: symbol == nil) { symbol = nil }
                            ForEach(p.keys, id: \.self) { k in
                                Chip(text: k, selected: symbol == k) { symbol = k }
                            }
                        }
                    }
                }
            }
            if section == 0 {
                Section {
                    if p.news.isEmpty { Text("還沒有新聞。").foregroundStyle(.secondary) }
                    ForEach(p.news) { n in NewsRow(title: n.title, url: n.url, publisher: n.publisher, publishedAt: n.publishedAt, symbols: n.symbols) }
                }
                .opacity(isSwitchingSymbol ? 0.4 : 1)
            } else {
                let upcoming = p.events.filter { $0.date >= p.today }
                let past = p.events.filter { $0.date < p.today }.reversed()
                Section("接下來") {
                    if upcoming.isEmpty { Text("沒有登錄的事件。").foregroundStyle(.secondary) }
                    ForEach(upcoming) { e in eventRow(e, today: p.today) }
                }
                if !past.isEmpty {
                    Section("過去 30 天") { ForEach(Array(past)) { e in eventRow(e) } }
                }
            }
        }
        .listStyle(.insetGrouped)
        .overlay { if isSwitchingSymbol && section == 0 { ProgressView() } }
        .refreshable { await load() }
    }

    private func eventRow(_ e: NewsPage.Event, today: String? = nil) -> some View {
        let url = e.sourceUrl.flatMap(URL.init(string:))
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 10))
        return Button {
            if let url { openURL(url) }
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                layout {
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
                    Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(.tertiary)
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
