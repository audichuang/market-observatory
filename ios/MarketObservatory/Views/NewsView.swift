import SwiftUI

struct NewsView: View {
    @Environment(SessionStore.self) private var session
    @State private var state: LoadState<NewsPage> = .idle
    @State private var symbol: String?
    @State private var section = 0
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            Loadable(state: state, retry: load) { p in content(p) }
                .navigationTitle("新聞與日曆")
        }
        .task { if state.value == nil { await load() } }
    }

    private func load() async {
        state = .loading(state.value)
        do {
            state = .loaded(try await API.get("/api/v1/news", query: ["symbol": symbol]))
        } catch {
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
                            Chip(text: "全部", selected: symbol == nil) { symbol = nil; Task { await load() } }
                            ForEach(p.keys, id: \.self) { k in
                                Chip(text: k, selected: symbol == k) { symbol = k; Task { await load() } }
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
            } else {
                let upcoming = p.events.filter { $0.date >= p.today }
                let past = p.events.filter { $0.date < p.today }.reversed()
                Section("接下來") {
                    if upcoming.isEmpty { Text("沒有登錄的事件。").foregroundStyle(.secondary) }
                    ForEach(upcoming) { e in eventRow(e) }
                }
                if !past.isEmpty {
                    Section("過去 30 天") { ForEach(Array(past)) { e in eventRow(e) } }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
    }

    private func eventRow(_ e: NewsPage.Event) -> some View {
        Button {
            if let s = e.sourceUrl, let u = URL(string: s) { openURL(u) }
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(Fmt.dateWithWeekday(e.date)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary).frame(width: 82, alignment: .leading)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(e.title).font(.subheadline).foregroundStyle(.primary)
                        if e.status == "estimated" { Text("推估").font(.caption2).foregroundStyle(.orange) }
                        if e.status == "tentative" { Text("暫定").font(.caption2).foregroundStyle(.orange) }
                    }
                    if let d = e.detail, !d.isEmpty { Text(d).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.leading) }
                }
            }
        }
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
