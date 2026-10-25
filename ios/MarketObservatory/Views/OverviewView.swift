import SwiftUI

struct OverviewView: View {
    @Environment(SessionStore.self) private var session
    @State private var state: LoadState<Overview> = .idle
    @State private var date: String?

    var body: some View {
        NavigationStack {
            Loadable(state: state, retry: load) { o in
                content(o)
            }
            .navigationTitle(title)
            .toolbar {
                if let o = state.value, !o.dates.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Picker("交易日", selection: Binding(get: { date ?? o.snapshot?.tradeDate ?? "" }, set: { new in
                                date = new == o.dates.first?.tradeDate ? nil : new
                                Task { await load() }
                            })) {
                                ForEach(o.dates.prefix(120), id: \.tradeDate) { d in
                                    Text("\(d.tradeDate)\(d.revision > 1 ? "（\(d.revision) 版）" : "")").tag(d.tradeDate)
                                }
                            }
                        } label: {
                            Label("其他交易日", systemImage: "calendar")
                        }
                    }
                }
            }
        }
        .task { if state.value == nil { await load() } }
        .onChange(of: session.overviewDate) { _, new in
            guard let new else { return }
            date = new
            session.overviewDate = nil
            Task { await load() }
        }
    }

    private var title: String {
        guard let t = state.value?.snapshot?.tradeDate else { return "市場總覽" }
        return "S&P 500 \(Fmt.dateWithWeekday(t))"
    }

    private func load() async {
        state = .loading(state.value)
        do {
            state = .loaded(try await API.get("/api/v1/overview", query: ["date": date]))
        } catch {
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    @ViewBuilder
    private func content(_ o: Overview) -> some View {
        if let row = o.snapshot {
            let s = row.data
            List {
                Section {
                    notices(o, s)
                    kpis(s)
                } footer: {
                    Text("第 \(row.revision) 版（\(row.reason)，\(Fmt.taipeiTime(row.createdAt))）")
                }
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))

                attribution(s, restCount: o.restCount)

                if let f = o.forecast {
                    Section("下月展望") {
                        LabeledContent("約 21 個交易日後上漲機率") {
                            Text(Fmt.plainPct(f.probability * 100)).monospacedDigit().bold()
                        }
                        LabeledContent("歷史基準率", value: Fmt.plainPct(f.baseRate * 100))
                        LabeledContent("判讀", value: callText(f.call))
                    }
                }

                Section("近三週事件") {
                    if o.events.isEmpty {
                        Text("三週內沒有登錄的事件。").foregroundStyle(.secondary)
                    }
                    ForEach(o.events) { e in
                        HStack(alignment: .firstTextBaseline) {
                            Text(Fmt.dateWithWeekday(e.date)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary).frame(width: 82, alignment: .leading)
                            Text(e.title).font(.subheadline)
                            Spacer()
                            if e.status == "estimated" { Text("推估").font(.caption2).foregroundStyle(.orange) }
                        }
                    }
                }

                Section("最新新聞") {
                    if o.news.isEmpty { Text("還沒有新聞。").foregroundStyle(.secondary) }
                    ForEach(o.news) { n in NewsRow(title: n.title, url: n.url, publisher: n.publisher, publishedAt: n.publishedAt, symbols: n.symbols) }
                }
            }
            .listStyle(.insetGrouped)
            .refreshable { await load() }
        } else {
            ContentUnavailableView("還沒有任何快照", systemImage: "chart.bar", description: Text("等收盤後的排程抓到資料就會出現。"))
                .refreshable { await load() }
        }
    }

    @ViewBuilder
    private func notices(_ o: Overview, _ s: Snapshot) -> some View {
        if o.viewingLatest && s.tradeDate < o.expectedClose {
            Notice(kind: .warn, text: "最新快照是 \(s.tradeDate)，但 \(o.expectedClose) 應該已收盤。最近一次抓價：\(o.lastPriceRun?.summary ?? "沒有紀錄")")
        }
        if !s.quality.mismatches.isEmpty {
            Notice(kind: .bad, text: "收盤價來源不一致：\(s.quality.mismatches.joined(separator: "、"))。歸因數字可能有誤。")
        }
        if let nt = s.notTracked, !nt.isEmpty {
            Notice(kind: .info, text: "\(nt.joined(separator: "、")) 在這天還沒開始追蹤，沒有歸因資料。")
        }
    }

    private func kpis(_ s: Snapshot) -> some View {
        Grid(horizontalSpacing: 10, verticalSpacing: 10) {
            GridRow {
                Kpi(label: "S&P 500", value: Fmt.num(s.index.close)) {
                    HStack(spacing: 4) {
                        Delta(value: s.index.changePts)
                        Text("(").foregroundStyle(.secondary) + Text(Fmt.pct(s.index.returnPct)).foregroundStyle(Color.tone(s.index.returnPct)) + Text(")").foregroundStyle(.secondary)
                    }
                } badge: { CheckBadge(status: s.index.check.status) }
                Kpi(label: "VIX", value: Fmt.num(s.vix.close)) {
                    HStack(spacing: 4) {
                        Delta(value: s.vix.change)
                        Text("月 \(Fmt.num(s.vix.monthLow, 1))–\(Fmt.num(s.vix.monthHigh, 1))").foregroundStyle(.secondary)
                    }
                }
            }
            GridRow {
                Kpi(label: "等權重 − 市值加權", value: Fmt.pct(s.breadth.spreadPct), tone: s.breadth.spreadPct) {
                    Text("RSP \(Fmt.pct(s.breadth.rspReturnPct)) vs SPX \(Fmt.pct(s.breadth.spxReturnPct))").foregroundStyle(.secondary)
                }
                Kpi(label: "名單合計貢獻", value: "\(Fmt.signed(s.mag7Total.contributionPts)) 點", tone: s.mag7Total.contributionPts) {
                    Text("占 \(s.mag7Total.shareOfMovePct.map { "\(Fmt.num($0, 0))%" } ?? "—") · 權重 \(Fmt.num(s.mag7Total.weightPct, 1))%").foregroundStyle(.secondary)
                }
            }
            GridRow {
                Kpi(label: "距 52 週高", value: Fmt.pct(s.index.fromHighPct), tone: s.index.fromHighPct) {
                    Text("年初至今 \(Fmt.pct(s.index.ytdPct)) · 一年 \(Fmt.pct(s.index.yearPct))").foregroundStyle(.secondary)
                }
                Kpi(label: "均線", value: maPosition(s)) {
                    Text("20 \(Fmt.num(s.index.sma20, 0)) · 200 \(Fmt.num(s.index.sma200, 0))").foregroundStyle(.secondary)
                }
            }
        }
    }

    private func maPosition(_ s: Snapshot) -> String {
        guard let sma = s.index.sma200 else { return "—" }
        return s.index.close >= sma ? "站上 200 日線" : "跌破 200 日線"
    }

    private func attribution(_ s: Snapshot, restCount: Int?) -> some View {
        let maxAbs = max(0.01, s.mag7.map { abs($0.contributionPts ?? 0) }.max() ?? 0, abs(s.rest.contributionPts ?? 0))
        return Section {
            ForEach(s.mag7) { r in
                AttributionRow(title: r.key, subtitle: r.company, ret: r.returnPct, weight: r.weightPct, pts: r.contributionPts, share: r.shareOfMovePct, maxAbs: maxAbs, check: r.check)
            }
            AttributionRow(
                title: "其餘",
                subtitle: restCount.map { "\($0) 檔（推算）" } ?? "其餘成分股（推算）",
                ret: s.rest.impliedReturnPct,
                weight: s.mag7Total.weightPct.map { 100 - $0 },
                pts: s.rest.contributionPts,
                share: s.mag7Total.shareOfMovePct.map { 100 - $0 },
                maxAbs: maxAbs,
                check: nil
            )
        } header: {
            Text("名單對指數的點數貢獻")
        } footer: {
            VStack(alignment: .leading, spacing: 4) {
                Text("貢獻點數 = 前一交易日指數 × 前一日權重 × 當日報酬。\(s.weights.note)")
                if s.weights.method == "rolled", let a = s.weights.asOf { Text("權重由 \(a) 的持股推算。") }
                ForEach(s.quality.notes, id: \.self) { Text($0) }
            }
        }
    }

    private func callText(_ call: String) -> String {
        switch call {
        case "up": "偏多"
        case "down": "偏空"
        default: "沒有明確方向（與基準率無顯著差異）"
        }
    }
}

private struct Kpi<Detail: View, Badge: View>: View {
    let label: String
    let value: String
    var tone: Double? = nil
    @ViewBuilder let detail: () -> Detail
    @ViewBuilder var badge: () -> Badge

    init(label: String, value: String, tone: Double? = nil, @ViewBuilder detail: @escaping () -> Detail, @ViewBuilder badge: @escaping () -> Badge = { EmptyView() }) {
        self.label = label
        self.value = value
        self.tone = tone
        self.detail = detail
        self.badge = badge
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(label).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                badge()
            }
            Text(value)
                .font(.title3.weight(.semibold).monospacedDigit())
                .foregroundStyle(tone == nil ? Color.primary : Color.tone(tone))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            detail().font(.caption2).lineLimit(2).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct AttributionRow: View {
    let title: String
    let subtitle: String
    let ret: Double?
    let weight: Double?
    let pts: Double?
    let share: Double?
    let maxAbs: Double
    let check: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(title).font(.headline)
                    Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(Fmt.signed(pts)) 點").font(.headline.monospacedDigit()).foregroundStyle(Color.tone(pts))
                    HStack(spacing: 6) {
                        Text(Fmt.pct(ret)).foregroundStyle(Color.tone(ret))
                        Text("權重 \(Fmt.num(weight, 2))%").foregroundStyle(.secondary)
                    }
                    .font(.caption.monospacedDigit())
                }
            }
            CenteredBar(value: pts ?? 0, maxAbs: maxAbs)
            if let check, check == "mismatch" || check == "pending" {
                CheckBadge(status: check)
            }
        }
        .padding(.vertical, 2)
    }
}

/// 以中線為 0、往左（負）或往右（正）長的長條。
struct CenteredBar: View {
    let value: Double
    let maxAbs: Double
    var body: some View {
        GeometryReader { geo in
            let half = geo.size.width / 2
            let w = maxAbs > 0 ? CGFloat(min(1, abs(value) / maxAbs)) * half : 0
            ZStack(alignment: .leading) {
                Capsule().fill(.quaternary).frame(height: 6)
                Rectangle().fill(.secondary.opacity(0.4)).frame(width: 1, height: 10).offset(x: half)
                Capsule()
                    .fill(Color.tone(value))
                    .frame(width: max(w, value == 0 ? 0 : 2), height: 6)
                    .offset(x: value >= 0 ? half : half - w)
            }
            .frame(height: 10)
        }
        .frame(height: 10)
    }
}

struct NewsRow: View {
    let title: String
    let url: String
    let publisher: String?
    let publishedAt: String?
    let symbols: String?
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button {
            if let u = URL(string: url) { openURL(u) }
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.subheadline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    if let symbols, !symbols.isEmpty {
                        Text(symbols.replacingOccurrences(of: ",", with: " · ")).font(.caption2.weight(.semibold)).foregroundStyle(.tint)
                    }
                    Text([publisher, publishedAt.map { Fmt.taipeiTime($0) }].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
