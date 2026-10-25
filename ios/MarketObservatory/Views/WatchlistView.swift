import SwiftUI

struct WatchlistView: View {
    @Environment(SessionStore.self) private var session
    @State private var state: LoadState<Watchlist> = .idle
    @State private var busy: String?
    @State private var message: (ok: Bool, text: String)?
    @State private var adding = false

    var body: some View {
        NavigationStack {
            Loadable(state: state, retry: load) { w in content(w) }
                .navigationTitle("觀察名單")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { adding = true } label: { Label("加入", systemImage: "plus") }
                            .disabled(busy != nil || (state.value.map { $0.members.count >= $0.max } ?? true))
                    }
                }
                .sheet(isPresented: $adding) {
                    if let w = state.value {
                        AddSheet(candidates: w.candidates) { ticker in
                            adding = false
                            Task { await add(ticker) }
                        }
                    }
                }
        }
        .task { if state.value == nil { await load() } }
    }

    private func load() async {
        state = .loading(state.value)
        do {
            state = .loaded(try await API.get("/api/v1/watchlist"))
        } catch {
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    private func add(_ ticker: String) async {
        busy = "正在加入 \(ticker)…（全站第一次追蹤的公司要抓十年股價，約十幾秒）"
        message = nil
        defer { busy = nil }
        struct Body: Encodable, Sendable { let symbol: String }
        do {
            let w: Watchlist = try await API.send("POST", "/api/v1/watchlist", body: Body(symbol: ticker))
            state = .loaded(w)
            message = (true, w.summary ?? "已加入 \(ticker)")
        } catch {
            session.handle(error)
            message = (false, error.localizedDescription)
        }
    }

    private func remove(_ m: Watchlist.Member) async {
        busy = "正在移除 \(m.company)…"
        message = nil
        defer { busy = nil }
        do {
            let w: Watchlist = try await API.send("DELETE", "/api/v1/watchlist", query: ["key": m.key], body: Optional<Empty>.none)
            state = .loaded(w)
            message = (true, w.summary ?? "已移除 \(m.company)")
        } catch {
            session.handle(error)
            message = (false, error.localizedDescription)
        }
    }

    private func content(_ w: Watchlist) -> some View {
        List {
            if let busy {
                HStack(spacing: 10) {
                    ProgressView()
                    Text(busy).font(.footnote).foregroundStyle(.secondary)
                }
            }
            if let message {
                Notice(kind: message.ok ? .ok : .bad, text: message.text)
                    .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
            }
            Section {
                ForEach(w.members) { m in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(m.company).font(.body)
                            Text(m.tickers.joined(separator: "＋")).font(.caption).foregroundStyle(.secondary)
                            if !m.outOfIndex.isEmpty {
                                Text("\(m.outOfIndex.joined(separator: "、")) 不在最新持股裡").font(.caption2).foregroundStyle(.orange)
                            }
                        }
                        Spacer()
                        Text("\(Fmt.num(m.weightPct, 2))%").monospacedDigit().foregroundStyle(.secondary)
                    }
                    .swipeActions {
                        Button("移除", role: .destructive) { Task { await remove(m) } }
                    }
                    .disabled(busy != nil)
                }
                if w.members.isEmpty {
                    Text("名單是空的。按右上角＋加入 S&P 500 成分股。").foregroundStyle(.secondary)
                }
            } header: {
                Text("\(w.members.count)/\(w.max) 家 · 合計權重 \(Fmt.num(w.totalWeight, 1))%")
            } footer: {
                Text("名單只影響你自己的總覽、走勢與推播。左滑可移除。權重取自 \(w.asOf ?? "—") 的 SPY 持股。")
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
    }
}

private struct AddSheet: View {
    let candidates: [Watchlist.Candidate]
    let pick: (String) -> Void
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss

    private var filtered: [Watchlist.Candidate] {
        let q = query.trimmingCharacters(in: .whitespaces).uppercased()
        guard !q.isEmpty else { return Array(candidates.prefix(80)) }
        return candidates.filter { $0.ticker.hasPrefix(q.replacingOccurrences(of: ".", with: "-")) || $0.name.uppercased().contains(q) }.prefix(80).map { $0 }
    }

    var body: some View {
        NavigationStack {
            List(filtered) { c in
                Button {
                    pick(c.ticker)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(c.ticker).font(.headline).foregroundStyle(.primary)
                            Text(c.name).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if c.tracked == true {
                            Text("已追蹤").font(.caption2.weight(.semibold)).padding(.horizontal, 6).padding(.vertical, 2).background(Color.down.opacity(0.12), in: Capsule()).foregroundStyle(Color.down)
                        }
                        Text("\(Fmt.num(c.weightPct, 2))%").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                    }
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "代號或公司名稱")
            .navigationTitle("加入成分股")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } }
            .overlay {
                if filtered.isEmpty { ContentUnavailableView.search(text: query) }
            }
        }
    }
}
