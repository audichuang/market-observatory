import SwiftUI

struct WatchlistView: View {
    @Environment(SessionStore.self) private var session
    @State private var state: LoadState<Watchlist> = .idle
    @State private var busy: String?
    @State private var message: (ok: Bool, text: String)?
    @State private var adding = false
    @State private var pendingRemoval: Watchlist.Member?
    @Environment(\.dynamicTypeSize) private var dts
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Loadable(state: state, retry: load) { w in content(w) }
                .navigationTitle("觀察名單")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("完成") { dismiss() }
                    }
                    ToolbarItem(placement: .topBarLeading) {
                        Button { adding = true } label: { Label("加入", systemImage: "plus") }
                            .disabled(busy != nil || (state.value.map { $0.members.count >= $0.max } ?? true))
                    }
                }
                .sheet(isPresented: $adding) {
                    if let w = state.value {
                        AddSheet(candidates: w.candidates) { c in
                            adding = false
                            Task { await add(c) }
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

    private func add(_ c: Watchlist.Candidate) async {
        busy = c.tracked == true ? "正在加入 \(c.name)…" : "正在加入 \(c.name)…（第一次追蹤，約需十幾秒）"
        message = nil
        defer { busy = nil }
        struct Body: Encodable, Sendable { let symbol: String }
        do {
            let w: Watchlist = try await API.send("POST", "/api/v1/watchlist", body: Body(symbol: c.ticker))
            state = .loaded(w)
            session.watchlistRevision += 1
            message = (true, w.summary ?? "已加入 \(c.name)")
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
            session.watchlistRevision += 1
            message = (true, w.summary ?? "已移除 \(m.company)")
        } catch {
            session.handle(error)
            message = (false, error.localizedDescription)
        }
    }

    private func openHistory(_ m: Watchlist.Member) {
        session.historySymbol = m.key
        session.tab = .history
        // 名單是 sheet（總覽右上星號），不關掉的話走勢頁在 sheet 後面，使用者看起來像沒反應。
        dismiss()
    }

    private func content(_ w: Watchlist) -> some View {
        List {
            if let busy {
                HStack(spacing: 10) {
                    ProgressView()
                    Text(busy).font(.footnote).foregroundStyle(.secondary)
                }
                .noticeRow()
            }
            if let message {
                Notice(kind: message.ok ? .ok : .bad, text: message.text).noticeRow()
            }
            if w.members.count >= w.max {
                Notice(kind: .info, text: "名單已滿 \(w.max) 家，先移除一家才能再加。").noticeRow()
            }
            Section {
                ForEach(w.members) { m in
                    Button {
                        openHistory(m)
                    } label: {
                        HStack {
                            memberRow(m)
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button("看走勢", systemImage: "chart.xyaxis.line") { openHistory(m) }
                        Button("移除", systemImage: "trash", role: .destructive) { pendingRemoval = m }
                    }
                    .swipeActions(allowsFullSwipe: false) {
                        Button("移除", role: .destructive) { pendingRemoval = m }
                    }
                    .disabled(busy != nil)
                }
                if w.members.isEmpty {
                    Text("名單是空的。點右上角＋加入。").foregroundStyle(.secondary)
                }
            } header: {
                Text("\(w.members.count)/\(w.max) 家 · 合計權重 \(Fmt.num(w.totalWeight, 2))%")
            } footer: {
                Text("權重取自 \(w.asOf.map(Fmt.fullDate) ?? "—") 的 SPY 持股。")
            }
        }
        .listStyle(.insetGrouped)
        .alert(
            pendingRemoval.map { "從名單移除 \($0.company)？" } ?? "",
            isPresented: Binding(get: { pendingRemoval != nil }, set: { if !$0 { pendingRemoval = nil } }),
            presenting: pendingRemoval
        ) { m in
            Button("取消", role: .cancel) {}
            Button("移除", role: .destructive) { Task { await remove(m) } }
        } message: { _ in
            Text("股價資料會保留，之後可以再加回來。")
        }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func memberRow(_ m: Watchlist.Member) -> some View {
        let weight = Text("\(Fmt.num(m.weightPct, 2))%").font(.body.monospacedDigit()).foregroundStyle(.secondary)
        let names = VStack(alignment: .leading, spacing: 2) {
            Text(m.tickers.joined(separator: " + ")).font(.headline)
            Text(m.company).font(.caption).foregroundStyle(.secondary)
            if dts.isAccessibilitySize { weight }
            if !m.outOfIndex.isEmpty {
                Text("\(m.outOfIndex.joined(separator: "、")) 已不在最新 SPY 持股（可能調出 S&P 500）").font(.caption2).foregroundStyle(.orange)
            }
        }
        if dts.isAccessibilitySize {
            names.frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack {
                names.layoutPriority(1)
                Spacer()
                weight
            }
        }
    }
}

private struct AddSheet: View {
    let candidates: [Watchlist.Candidate]
    let pick: (Watchlist.Candidate) -> Void
    @State private var query = ""
    @Environment(\.dynamicTypeSize) private var dts
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
                    pick(c)
                } label: {
                    row(c)
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

    @ViewBuilder
    private func row(_ c: Watchlist.Candidate) -> some View {
        let trailing = HStack(spacing: 6) {
            if c.tracked == true {
                Text("資料已備妥")
                    .font(.caption2.weight(.semibold))
                    .fixedSize()
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
                    .foregroundStyle(.secondary)
            }
            Text("\(Fmt.num(c.weightPct, 2))%").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
        }
        if dts.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 4) {
                Text(c.ticker).font(.headline).foregroundStyle(.primary)
                Text(c.name).font(.caption).foregroundStyle(.secondary)
                trailing
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(c.ticker).font(.headline).foregroundStyle(.primary)
                    Text(c.name).font(.caption).foregroundStyle(.secondary)
                }
                .layoutPriority(1)
                Spacer()
                trailing
            }
        }
    }
}
