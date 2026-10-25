import SwiftUI

struct OverviewView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dynamicTypeSize) private var dts
    @ScaledMetric(relativeTo: .subheadline) private var dateWidth: CGFloat = 82
    @State private var state: LoadState<Overview> = .idle
    @State private var date: String?
    @State private var rev: Int?
    @State private var loadTask: Task<Void, Never>?
    @State private var loadID = 0
    @State private var showDates = false

    var body: some View {
        NavigationStack {
            Loadable(state: state, retry: load) { o in
                content(o)
            }
            .opacity(isSwitching ? 0.5 : 1)
            .navigationTitle(title)
            .toolbar {
                if let o = state.value, !o.dates.isEmpty {
                    if isSwitching {
                        ToolbarItem(placement: .topBarTrailing) { ProgressView() }
                    } else {
                        if o.revisions.count > 1 {
                            ToolbarItem(placement: .topBarTrailing) {
                                Menu {
                                    Picker("版本", selection: Binding(get: { rev ?? o.snapshot?.revision ?? 0 }, set: { new in
                                        rev = new == o.revisions.first?.revision ? nil : new
                                        reload()
                                    })) {
                                        ForEach(o.revisions, id: \.revision) { r in
                                            Text("第 \(r.revision) 版　\(r.reason)").tag(r.revision)
                                        }
                                    }
                                } label: {
                                    Label("版本", systemImage: "clock.arrow.circlepath")
                                }
                            }
                        }
                        ToolbarItem(placement: .topBarTrailing) {
                            Button { showDates = true } label: {
                                Label("其他交易日", systemImage: "calendar")
                            }
                        }
                    }
                }
            }
            .sheet(isPresented: $showDates) {
                if let o = state.value {
                    DateListSheet(
                        dates: o.dates,
                        current: o.snapshot?.tradeDate,
                        viewingLatest: date == nil && rev == nil,
                        pick: { picked in
                            date = picked == o.dates.first?.tradeDate ? nil : picked
                            rev = nil
                            showDates = false
                            reload()
                        }
                    )
                }
            }
        }
        .task {
            // 推播冷啟動：日期在這個畫面建立前就放進 session 了，onChange 收不到。
            if let d = session.overviewDate {
                date = d
                rev = nil
                session.overviewDate = nil
                await load()
            } else if state.value == nil {
                await load()
            }
        }
        .onChange(of: session.watchlistRevision) { Task { await load() } }
        .onChange(of: session.overviewDate) { _, new in
            guard let new else { return }
            date = new
            rev = nil
            session.overviewDate = nil
            reload()
        }
    }

    private var isSwitching: Bool {
        if case .loading(.some) = state { return true }
        return false
    }

    private var title: String {
        guard let t = state.value?.snapshot?.tradeDate else { return "市場總覽" }
        return "S&P 500 \(Fmt.dateWithWeekday(t))"
    }

    /// 換日期／版本：取消還在跑的請求，免得舊的回應蓋掉新的。
    private func reload() {
        loadTask?.cancel()
        loadTask = Task { await load() }
    }

    private func load() async {
        loadID += 1
        let id = loadID
        let last = state.value
        state = .loading(last)
        // 指定版本時一定要帶日期，否則伺服器會忽略 rev。
        let queryDate = rev != nil ? (date ?? last?.snapshot?.tradeDate) : date
        do {
            let o: Overview = try await API.get("/api/v1/overview", query: ["date": queryDate, "rev": rev.map(String.init)])
            guard id == loadID, !Task.isCancelled else { return }
            if date != nil, date == o.dates.first?.tradeDate { date = nil }
            state = .loaded(o)
        } catch {
            guard id == loadID else { return }
            if error is CancellationError || (error as? URLError)?.code == .cancelled || Task.isCancelled {
                // 被取消（例如下拉重新整理結束）不算失敗：回到原本的內容。
                state = last.map { .loaded($0) } ?? .idle
                return
            }
            session.handle(error)
            state = .failed(error.localizedDescription, last)
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
                    periodReturns(s)
                } footer: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("第 \(row.revision) 版（\(row.reason)，\(Fmt.taipeiTime(row.createdAt))）")
                        if o.revisions.first.map({ $0.revision != row.revision }) ?? false {
                            Button("看最新版") {
                                rev = nil
                                reload()
                            }
                            .font(.footnote)
                        }
                    }
                }
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))

                attribution(s, restCount: o.restCount)

                // 展望是「今天往後」的預測，看舊日期時不顯示，免得誤以為屬於那一天。
                if let f = o.forecast, o.viewingLatest {
                    Section("下月展望") {
                        LabeledContent("約 21 個交易日後上漲機率") {
                            Text(Fmt.plainPct(f.probability * 100)).monospacedDigit().bold()
                        }
                        LabeledContent("歷史基準率", value: Fmt.plainPct(f.baseRate * 100))
                        LabeledContent("判讀") { CallBadge(call: f.call) }
                        NavigationLink { OutlookView() } label: { Text("完整展望") }
                    }
                }

                Section("未來三週事件") {
                    if o.events.isEmpty {
                        Text("三週內沒有登錄的事件。").foregroundStyle(.secondary)
                    }
                    ForEach(o.events) { e in eventRow(e) }
                    Button("完整日曆 →") { session.tab = .news }.font(.subheadline)
                }

                Section("最新新聞") {
                    if o.news.isEmpty { Text("還沒有新聞。").foregroundStyle(.secondary) }
                    ForEach(o.news) { n in NewsRow(title: n.title, url: n.url, publisher: n.publisher, publishedAt: n.publishedAt, symbols: n.symbols) }
                    Button("全部新聞 →") { session.tab = .news }.font(.subheadline)
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
    private func eventRow(_ e: EventBrief) -> some View {
        let day = Text(Fmt.dateWithWeekday(e.date)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary).lineLimit(1)
        if dts.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) { day; EventStatusBadge(status: e.status) }
                Text(e.title).font(.subheadline)
            }
        } else {
            HStack(alignment: .firstTextBaseline) {
                day.frame(width: dateWidth, alignment: .leading)
                Text(e.title).font(.subheadline)
                Spacer()
                EventStatusBadge(status: e.status)
            }
        }
    }

    @ViewBuilder
    private func notices(_ o: Overview, _ s: Snapshot) -> some View {
        if o.viewingLatest && s.tradeDate < o.expectedClose {
            Notice(kind: .warn, text: "最新快照是 \(s.tradeDate)，但 \(o.expectedClose) 應該已收盤。最近一次抓價：\(lastRunText(o.lastPriceRun))。")
        }
        if !s.quality.mismatches.isEmpty {
            Notice(kind: .bad, text: "收盤價來源不一致：\(s.quality.mismatches.joined(separator: "、"))。歸因數字可能有誤。")
        }
        if !s.quality.missing.isEmpty {
            Notice(kind: .warn, text: "缺少當日收盤：\(s.quality.missing.joined(separator: "、"))。")
        }
        if let nt = s.notTracked, !nt.isEmpty {
            Notice(kind: .info, text: "\(nt.joined(separator: "、")) 在這天還沒開始追蹤，沒有歸因資料。")
        }
    }

    private func lastRunText(_ run: PriceRun?) -> String {
        guard let run else { return "沒有紀錄" }
        return "\(run.summary ?? "—")（\(Fmt.taipeiTime(run.finishedAt))）"
    }

    @ViewBuilder
    private func kpis(_ s: Snapshot) -> some View {
        if dts.isAccessibilitySize {
            VStack(spacing: 10) {
                spxCard(s)
                vixCard(s)
                spreadCard(s)
                watchlistCard(s)
                highCard(s)
                maCard(s)
            }
        } else {
            Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                GridRow { spxCard(s); vixCard(s) }
                GridRow { spreadCard(s); watchlistCard(s) }
                GridRow { highCard(s); maCard(s) }
            }
        }
    }

    private func spxCard(_ s: Snapshot) -> some View {
        Kpi(label: "S&P 500", value: Fmt.num(s.index.close)) {
            HStack(spacing: 4) {
                Delta(value: s.index.changePts)
                Text("(\(Text(Fmt.pct(s.index.returnPct)).foregroundStyle(Color.tone(s.index.returnPct))))").foregroundStyle(.secondary)
            }
        } badge: { CheckBadge(status: s.index.check.status) }
    }

    private func vixCard(_ s: Snapshot) -> some View {
        Kpi(label: "VIX 恐慌指數", value: Fmt.num(s.vix.close)) {
            HStack(spacing: 4) {
                Delta(value: s.vix.change)
                Text("近月 \(Fmt.num(s.vix.monthLow, 1))–\(Fmt.num(s.vix.monthHigh, 1))").foregroundStyle(.secondary)
            }
        }
    }

    private func spreadCard(_ s: Snapshot) -> some View {
        Kpi(label: "等權重 RSP − 市值加權", value: Fmt.pct(s.breadth.spreadPct), tone: s.breadth.spreadPct) {
            Text("RSP \(Fmt.pct(s.breadth.rspReturnPct)) vs SPX \(Fmt.pct(s.breadth.spxReturnPct))").foregroundStyle(.secondary)
        }
    }

    private func watchlistCard(_ s: Snapshot) -> some View {
        Kpi(label: "名單合計貢獻", value: "\(Fmt.signed(s.mag7Total.contributionPts)) 點", tone: s.mag7Total.contributionPts) {
            Text("占 \(s.mag7Total.shareOfMovePct.map { "\(Fmt.num($0, 0))%" } ?? "—") · 權重 \(Fmt.num(s.mag7Total.weightPct, 1))%").foregroundStyle(.secondary)
        }
    }

    private func highCard(_ s: Snapshot) -> some View {
        Kpi(label: "距 52 週高", value: Fmt.pct(s.index.fromHighPct), tone: s.index.fromHighPct) {
            Text("高 \(Fmt.num(s.index.high52, 0)) · 低 \(Fmt.num(s.index.low52, 0))").foregroundStyle(.secondary)
        }
    }

    private func maCard(_ s: Snapshot) -> some View {
        Kpi(label: "收盤 vs 均線", value: nil) {
            VStack(alignment: .leading, spacing: 3) {
                MaRow(name: "20 日", close: s.index.close, ma: s.index.sma20)
                MaRow(name: "60 日", close: s.index.close, ma: s.index.sma60)
                MaRow(name: "200 日", close: s.index.close, ma: s.index.sma200)
            }
            .font(.footnote)
        }
    }

    @ViewBuilder
    private func periodReturns(_ s: Snapshot) -> some View {
        let items: [PeriodReturn] = [
            PeriodReturn(label: "近一週", value: s.index.weekPct),
            PeriodReturn(label: "近一月", value: s.index.monthPct),
            PeriodReturn(label: "今年以來", value: s.index.ytdPct),
            PeriodReturn(label: "近一年", value: s.index.yearPct),
        ]
        if dts.isAccessibilitySize {
            VStack(spacing: 8) { ForEach(items) { PeriodReturnCell(item: $0) } }
        } else {
            HStack(spacing: 8) { ForEach(items) { PeriodReturnCell(item: $0) } }
        }
    }

    private func attribution(_ s: Snapshot, restCount: Int?) -> some View {
        let maxAbs = max(0.01, s.mag7.map { abs($0.contributionPts ?? 0) }.max() ?? 0, abs(s.rest.contributionPts ?? 0))
        return Section {
            ForEach(s.mag7) { r in
                Button {
                    session.historySymbol = r.key
                    session.tab = .history
                } label: {
                    HStack {
                        AttributionRow(title: r.key, subtitle: r.company, ret: r.returnPct, weight: r.weightPct, pts: r.contributionPts, share: r.shareOfMovePct, maxAbs: maxAbs, check: r.check)
                        Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("看 \(r.company) 的走勢")
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
            AttributionRow(
                title: "S&P 500",
                subtitle: "合計",
                ret: s.index.returnPct,
                weight: 100,
                pts: s.index.changePts,
                share: 100,
                maxAbs: maxAbs,
                check: nil,
                showsBar: false
            )
        } header: {
            HStack {
                Text("名單對指數的點數貢獻")
                Spacer()
                Button("編輯名單") { session.tab = .watchlist }.font(.caption)
            }
        } footer: {
            VStack(alignment: .leading, spacing: 4) {
                Text("貢獻點數 = 前一交易日指數 × 前一日權重 × 當日報酬。\(s.weights.note)")
                if s.weights.method == "rolled", let a = s.weights.asOf { Text("權重由 \(a) 的持股推算。") }
                ForEach(s.quality.notes, id: \.self) { Text($0) }
                if !s.quality.missing.isEmpty { Text("缺少當日收盤：\(s.quality.missing.joined(separator: "、"))") }
                if !s.quality.pendingChecks.isEmpty { Text("尚待第二來源核對：\(s.quality.pendingChecks.joined(separator: "、"))") }
            }
        }
    }
}

private struct PeriodReturn: Identifiable {
    var id: String { label }
    let label: String
    let value: Double?
}

private struct PeriodReturnCell: View {
    let item: PeriodReturn
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(item.label).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            Delta(value: item.value, percent: true).font(.subheadline.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
    }
}

/// 展望判讀：偏多紅、偏空綠（紅漲綠跌），不確定橘。
private struct CallBadge: View {
    let call: String
    var body: some View {
        let (text, color): (String, Color) = switch call {
        case "up": ("偏多", .up)
        case "down": ("偏空", .down)
        default: ("不確定", .orange)
        }
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
    }
}

private struct EventStatusBadge: View {
    let status: String
    var body: some View {
        switch status {
        case "estimated": Text("推估日期").font(.caption2).foregroundStyle(.orange)
        case "tentative": Text("暫定").font(.caption2).foregroundStyle(.orange)
        default: EmptyView()
        }
    }
}

/// 收盤與某條均線的距離（收盤 ÷ 均線 − 1）。
private struct MaRow: View {
    let name: String
    let close: Double
    let ma: Double?
    var body: some View {
        HStack(spacing: 4) {
            Text("\(name) \(Fmt.num(ma, 0))").foregroundStyle(.secondary)
            Delta(value: ma.map { (close / $0 - 1) * 100 }, percent: true)
        }
    }
}

/// 全部交易日，依月份分組；可搜尋，打開時捲到目前這一天。
private struct DateListSheet: View {
    let dates: [SnapshotDate]
    let current: String?
    let viewingLatest: Bool
    let pick: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private struct Month: Identifiable {
        let id: String
        var days: [SnapshotDate]
    }

    /// 保留 API 新到舊的順序。
    private var months: [Month] {
        let filtered = query.isEmpty ? dates : dates.filter { $0.tradeDate.contains(query) }
        var out: [Month] = []
        for d in filtered {
            let m = String(d.tradeDate.prefix(7))
            if out.last?.id == m { out[out.count - 1].days.append(d) } else { out.append(Month(id: m, days: [d])) }
        }
        return out
    }

    private func monthTitle(_ m: String) -> String {
        let parts = m.split(separator: "-")
        guard parts.count == 2, let mm = Int(parts[1]) else { return m }
        return "\(parts[0]) 年 \(mm) 月"
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    ForEach(months) { month in
                        Section(monthTitle(month.id)) {
                            ForEach(month.days, id: \.tradeDate) { d in
                                Button { pick(d.tradeDate) } label: {
                                    HStack {
                                        Text(d.tradeDate).monospacedDigit().foregroundStyle(.primary)
                                        if d.revision > 1 {
                                            Text("（\(d.revision) 版）").font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if d.tradeDate == current {
                                            Image(systemName: "checkmark").foregroundStyle(.tint)
                                        }
                                    }
                                    .contentShape(Rectangle())
                                }
                                .id(d.tradeDate)
                            }
                        }
                    }
                }
                .searchable(text: $query, prompt: "例如 2026-09")
                .task {
                    // 等 List 排好版再捲，不然 scrollTo 常常沒作用。
                    try? await Task.sleep(for: .milliseconds(50))
                    if let current { proxy.scrollTo(current, anchor: .center) }
                }
            }
            .navigationTitle("交易日")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("回到最新") {
                        if let first = dates.first?.tradeDate { pick(first) }
                    }
                    .disabled(viewingLatest)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

private struct Kpi<Detail: View, Badge: View>: View {
    let label: String
    let value: String?
    var tone: Double? = nil
    @ViewBuilder let detail: () -> Detail
    @ViewBuilder var badge: () -> Badge
    @Environment(\.dynamicTypeSize) private var dts

    init(label: String, value: String?, tone: Double? = nil, @ViewBuilder detail: @escaping () -> Detail, @ViewBuilder badge: @escaping () -> Badge = { EmptyView() }) {
        self.label = label
        self.value = value
        self.tone = tone
        self.detail = detail
        self.badge = badge
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(label).font(.caption).foregroundStyle(.secondary).lineLimit(2).minimumScaleFactor(0.8)
                badge()
            }
            if let value {
                Text(value)
                    .font(.title3.weight(.semibold).monospacedDigit())
                    .foregroundStyle(tone == nil ? Color.primary : Color.tone(tone))
                    .lineLimit(dts.isAccessibilitySize ? nil : 1)
                    .minimumScaleFactor(0.6)
            }
            detail().font(.caption2).fixedSize(horizontal: false, vertical: true)
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
    var showsBar = true

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
            if showsBar {
                CenteredBar(value: pts ?? 0, maxAbs: maxAbs)
            }
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
                    // published_at 只有日期（yyyy-MM-dd）；萬一帶了時間就換成台北時間。
                    Text([publisher ?? "Nasdaq", publishedAt.map { $0.count == 10 ? Fmt.dateWithWeekday($0) : Fmt.taipeiTime($0) } ?? "日期不明"].joined(separator: " · "))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}
