import SwiftUI

struct OverviewView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dynamicTypeSize) private var dts
    @Environment(\.openURL) private var openURL
    @ScaledMetric(relativeTo: .subheadline) private var dateWidth: CGFloat = 82
    @State private var state: LoadState<Overview> = .idle
    @State private var date: String?
    @State private var loadTask: Task<Void, Never>?
    @State private var loadID = 0
    @State private var showDates = false
    @State private var expandedDigests: Set<String> = []
    @State private var showWatchlist = false
    @AppStorage("overview.showIndicators") private var showIndicators = false

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
                        ToolbarItem(placement: .topBarTrailing) {
                            Button { showDates = true } label: {
                                Label("其他交易日", systemImage: "calendar")
                            }
                        }
                        ToolbarItem(placement: .topBarTrailing) {
                            Button { showWatchlist = true } label: {
                                Label("觀察名單", systemImage: "star")
                            }
                        }
                    }
                }
            }
            .sheet(isPresented: $showWatchlist) { WatchlistView() }
            .sheet(isPresented: $showDates) {
                if let o = state.value {
                    DateListSheet(
                        dates: o.dates,
                        current: o.snapshot?.tradeDate,
                        viewingLatest: date == nil,
                        pick: { picked in
                            date = picked == o.dates.first?.tradeDate ? nil : picked
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
        // 大字級時大標題放不下「S&P 500 10/23（五）」會被截成「S&P 500 10/2…」；日期是關鍵，只留日期（指數卡第一行就是 S&P 500）。
        return dts.isAccessibilitySize ? Fmt.dateWithWeekday(t) : "S&P 500 \(Fmt.dateWithWeekday(t))"
    }

    /// 換日期：取消還在跑的請求，免得舊的回應蓋掉新的。
    private func reload() {
        loadTask?.cancel()
        loadTask = Task { await load() }
    }

    private func load() async {
        loadID += 1
        let id = loadID
        let last = state.value
        state = .loading(last)
        do {
            let o: Overview = try await API.get("/api/v1/overview", query: ["date": date])
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
                notices(o, s)

                Section {
                    IndexHero(s: s, createdAt: row.createdAt)
                    if let m = o.market { MarketDigestCard(digest: m) }
                    indicatorsToggle(s)
                    if showIndicators {
                        kpis(s)
                        maCard(s)
                    }
                }
                .cardRow()

                attribution(s, restCount: o.restCount, digests: o.digests ?? [])

                Section("未來三週事件") {
                    if o.events.isEmpty {
                        Text("三週內沒有登錄的事件。").foregroundStyle(.secondary)
                    }
                    ForEach(o.events.prefix(5)) { e in eventRow(e) }
                    Button("完整日曆 →") { session.newsSectionRequest = 1; session.tab = .news }.font(.subheadline)
                }

                // 展望是「今天往後」的預測，看舊日期時不顯示，免得誤以為屬於那一天。
                if let f = o.forecast, o.viewingLatest {
                    Section("下月展望") {
                        NavigationLink { OutlookView() } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                // U-01: dd5 first; P(up) has no detected incremental skill most of the time.
                                if let d = f.drawdown {
                                    ViewThatFits(in: .horizontal) {
                                        HStack {
                                            Text(Copy.dd5ShortLabel(horizon: Copy.overviewHorizon))
                                            Spacer()
                                            drawdownValue(d)
                                        }
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(Copy.dd5ShortLabel(horizon: Copy.overviewHorizon))
                                            HStack { drawdownValue(d) }
                                        }
                                    }
                                }
                                ViewThatFits(in: .horizontal) {
                                    HStack {
                                        Text("下月上漲機率")
                                        Spacer()
                                        Text(Fmt.plainPct(f.probability * 100)).font(.headline.monospacedDigit())
                                        Text("平常 \(Fmt.plainPct(f.baseRate * 100))").font(.caption).foregroundStyle(.secondary)
                                        CallBadge(call: f.call)
                                    }
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("下月上漲機率")
                                        HStack {
                                            Text(Fmt.plainPct(f.probability * 100)).font(.headline.monospacedDigit())
                                            Text("平常 \(Fmt.plainPct(f.baseRate * 100))").font(.caption).foregroundStyle(.secondary)
                                            CallBadge(call: f.call)
                                        }
                                    }
                                }
                                if f.call == "inconclusive" {
                                    Text("尚未偵測到增額預測力").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .refreshable { await load() }
        } else {
            ContentUnavailableView("還沒有任何快照", systemImage: "chart.bar", description: Text("等收盤後的排程抓到資料就會出現。"))
                .refreshable { await load() }
        }
    }

    /// 跌幅機率：數字、平常值，沒通過驗證時加標籤。
    @ViewBuilder
    private func drawdownValue(_ d: ForecastBrief.Drawdown) -> some View {
        Text(Fmt.plainPct(d.p * 100)).font(.headline.monospacedDigit())
        Text("平常 \(Fmt.plainPct(d.base * 100))").font(.caption).foregroundStyle(.secondary)
        if !d.scored {
            Text("未通過驗證")
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Color.orange.opacity(0.12), in: Capsule())
                .foregroundStyle(Color.orange)
        }
    }

    @ViewBuilder
    private func eventRow(_ e: EventBrief) -> some View {
        let day = Text(Fmt.dateWithWeekday(e.date)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary).lineLimit(1)
        let titleLine = HStack(alignment: .firstTextBaseline, spacing: 6) {
            if let sym = e.symbol { Text(sym).font(.subheadline.monospaced().weight(.semibold)).foregroundStyle(.tint) }
            Text(e.title).font(.subheadline)
        }
        if dts.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) { day; EventStatusBadge(status: e.status) }
                titleLine
            }
        } else {
            HStack(alignment: .firstTextBaseline) {
                day.frame(width: dateWidth, alignment: .leading)
                titleLine
                Spacer()
                EventStatusBadge(status: e.status)
            }
        }
    }

    @ViewBuilder
    private func notices(_ o: Overview, _ s: Snapshot) -> some View {
        if o.viewingLatest && s.tradeDate < o.expectedClose {
            Notice(kind: .warn, text: "最新快照是 \(s.tradeDate)，但 \(o.expectedClose) 應該已收盤。最近一次抓價：\(lastRunText(o.lastPriceRun))。").noticeRow()
        }
        if !s.quality.mismatches.isEmpty {
            Notice(kind: .bad, text: "收盤價來源不一致：\(s.quality.mismatches.joined(separator: "、"))。歸因數字可能有誤。").noticeRow()
        }
        if !s.quality.missing.isEmpty {
            Notice(kind: .warn, text: "缺少當日收盤：\(s.quality.missing.joined(separator: "、"))。").noticeRow()
        }
        if let nt = s.notTracked, !nt.isEmpty {
            Notice(kind: .info, text: "\(nt.joined(separator: "、")) 在這天還沒開始追蹤，沒有歸因資料。").noticeRow()
        }
    }

    private func lastRunText(_ run: PriceRun?) -> String {
        guard let run else { return "沒有紀錄" }
        return "\(run.summary ?? "—")（\(Fmt.taipeiTime(run.finishedAt))）"
    }

    /// 市場指標預設收起，只露一行摘要；展開狀態會記住。
    private func indicatorsToggle(_ s: Snapshot) -> some View {
        let trend = s.index.sma200.map { s.index.close >= $0 ? "站上 200 日線" : "跌破 200 日線" }
        let summary = ["VIX \(Fmt.num(s.vix.close))", "距高 \(Fmt.pct(s.index.fromHighPct))", trend].compactMap { $0 }.joined(separator: " · ")
        return Button {
            withAnimation { showIndicators.toggle() }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("市場指標").font(.subheadline.weight(.semibold))
                    if !showIndicators { Text(summary).font(.caption).foregroundStyle(.secondary).monospacedDigit() }
                }
                Spacer()
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .rotationEffect(.degrees(showIndicators ? 180 : 0))
            }
            .contentShape(Rectangle())
            .cardBackground()
        }
        .buttonStyle(.plain)
        .accessibilityValue(showIndicators ? "已展開" : "已收合")
    }

    @ViewBuilder
    private func kpis(_ s: Snapshot) -> some View {
        ViewThatFits(in: .horizontal) {
            Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                GridRow { vixCard(s); watchlistCard(s) }
                GridRow { highCard(s); spreadCard(s) }
            }
            VStack(spacing: 10) {
                vixCard(s)
                watchlistCard(s)
                highCard(s)
                spreadCard(s)
            }
        }
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
        Kpi(label: "等權重 − 市值加權", value: Fmt.pct(s.breadth.spreadPct), tone: s.breadth.spreadPct) {
            VStack(alignment: .leading, spacing: 2) {
                Text("RSP \(Fmt.pct(s.breadth.rspReturnPct))")
                Text("vs SPX \(Fmt.pct(s.breadth.spxReturnPct))")
            }
            .foregroundStyle(.secondary)
        }
    }

    private func watchlistCard(_ s: Snapshot) -> some View {
        Kpi(label: "名單合計貢獻", value: "\(Fmt.signed(s.mag7Total.contributionPts)) 點", tone: s.mag7Total.contributionPts) {
            Text("占 \(s.mag7Total.shareOfMovePct.map { "\(Fmt.num($0, 0))%" } ?? "—") · 權重 \(Fmt.num(s.mag7Total.weightPct, 2))%").foregroundStyle(.secondary)
        }
    }

    private func highCard(_ s: Snapshot) -> some View {
        Kpi(label: "距 52 週高", value: Fmt.pct(s.index.fromHighPct), tone: s.index.fromHighPct) {
            Text("高 \(Fmt.num(s.index.high52, 0)) · 低 \(Fmt.num(s.index.low52, 0))").foregroundStyle(.secondary)
        }
    }

    private func maCard(_ s: Snapshot) -> some View {
        let items: [(String, Double?)] = [("20 日線", s.index.sma20), ("60 日線", s.index.sma60), ("200 日線", s.index.sma200)]
        return Kpi(label: "收盤 vs 均線", value: nil) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 0) {
                    ForEach(items, id: \.0) { name, ma in
                        MaColumn(name: name, close: s.index.close, ma: ma)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(items, id: \.0) { name, ma in MaRow(name: name, close: s.index.close, ma: ma) }
                }
                .font(.footnote)
            }
        }
    }
    private func attribution(_ s: Snapshot, restCount: Int?, digests: [NewsDigest]) -> some View {
        let maxAbs = max(0.01, s.mag7.map { abs($0.contributionPts ?? 0) }.max() ?? 0, abs(s.rest.contributionPts ?? 0))
        return Section {
            ForEach(s.mag7) { r in
                // 兩個互不相干的點擊目標：上面的 Button 跳到走勢，下面的摘要 Button 只就地展開／收合。
                // 摘要在 Button 外面（兄弟節點），所以點摘要不會觸發跳頁。
                VStack(alignment: .leading, spacing: 6) {
                    Button {
                        session.historySymbol = r.key
                        session.tab = .history
                    } label: {
                        HStack {
                            AttributionRow(
                                title: r.key,
                                subtitle: r.close.map { "\(r.company) · 收盤 \(Fmt.num($0, 2))" } ?? r.company,
                                ret: r.returnPct, weight: r.weightPct, pts: r.contributionPts, share: r.shareOfMovePct,
                                maxAbs: maxAbs, check: r.check
                            )
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("看 \(r.company) 的走勢")
                    if let digest = digests.first(where: { $0.symbol == r.key })?.summary {
                        AIDigestLine(text: digest, expanded: expandedDigests.contains(r.key)) {
                            withAnimation {
                                if !expandedDigests.insert(r.key).inserted { expandedDigests.remove(r.key) }
                            }
                        }
                    }
                }
            }
            // The hidden chevron reserves the same trailing width as the stock rows,
            // so every bar shares one zero line and right edge.
            HStack {
                AttributionRow(
                    title: RestLabel.short,
                    subtitle: restCount.map { "\($0) 檔（推算）" } ?? "推算",
                    ret: s.rest.impliedReturnPct,
                    weight: s.mag7Total.weightPct.map { 100 - $0 },
                    pts: s.rest.contributionPts,
                    share: s.mag7Total.shareOfMovePct.map { 100 - $0 },
                    maxAbs: maxAbs,
                    check: nil
                )
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).hidden()
            }
            HStack {
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
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).hidden()
            }
            DisclosureGroup("說明") {
                VStack(alignment: .leading, spacing: 6) {
                    Text(s.weights.note)
                    if s.weights.method == "rolled", let a = s.weights.asOf { Text("權重由 \(Fmt.fullDate(a)) 的持股推算。") }
                    Text("\(RestLabel.full)＝指數漲跌減掉名單合計，含權重與價格口徑的近似誤差。")
                    ForEach(s.quality.notes, id: \.self) { Text($0) }
                    Text("貢獻點數 = 前一交易日指數 × 前一日權重 × 當日報酬。")
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
        } header: {
            HStack {
                Text("名單對指數的點數貢獻")
                Spacer()
                Button("編輯名單") { showWatchlist = true }.font(.caption)
            }
        }
    }
}

/// 「今天為什麼漲跌」：排程寫好的一段話，列首色條標整體偏多（紅）或偏空（綠）。
private struct MarketDigestCard: View {
    let digest: MarketDigest

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Capsule().fill(Color.newsTone(digest.tone)).frame(width: 3).frame(maxHeight: .infinity)
            VStack(alignment: .leading, spacing: 4) {
                Text("今天為什麼漲跌").font(.subheadline.weight(.semibold))
                Text(digest.summary).font(.subheadline).fixedSize(horizontal: false, vertical: true)
            }
        }
        .cardBackground()
        .accessibilityElement(children: .combine)
    }
}

/// 指數 hero：收盤、漲跌、四個期間報酬與資料產出時間，一張全寬卡。
private struct IndexHero: View {
    let s: Snapshot
    let createdAt: String?

    private var items: [(String, Double?)] {
        [("近一週", s.index.weekPct), ("近一月", s.index.monthPct), ("今年以來", s.index.ytdPct), ("近一年", s.index.yearPct)]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text("S&P 500").font(.caption).foregroundStyle(.secondary)
                CheckBadge(status: s.index.check.status)
            }
            Text(Fmt.num(s.index.close)).font(.largeTitle.weight(.bold).monospacedDigit()).lineLimit(1).minimumScaleFactor(0.8)
            HStack(spacing: 4) {
                Delta(value: s.index.changePts)
                Text("(\(Text(Fmt.pct(s.index.returnPct)).foregroundStyle(Color.tone(s.index.returnPct))))").foregroundStyle(.secondary)
            }
            .font(.headline)
            periods.padding(.top, 4)
            Text("資料 \(Fmt.taipeiTime(createdAt)) 產出").font(.caption2).foregroundStyle(.secondary)
        }
        .cardBackground()
    }

    private func cell(_ label: String, _ v: Double?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(.secondary).lineLimit(1).fixedSize(horizontal: true, vertical: false)
            Delta(value: v, percent: true).font(.subheadline.weight(.semibold)).lineLimit(1).fixedSize(horizontal: true, vertical: false)
        }
    }

    private var periods: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.offset) { i, it in
                    if i > 0 { Divider().padding(.trailing, 8) }
                    cell(it.0, it.1).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                GridRow { cell(items[0].0, items[0].1); cell(items[1].0, items[1].1) }
                GridRow { cell(items[2].0, items[2].1); cell(items[3].0, items[3].1) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(spacing: 6) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, it in
                    HStack {
                        Text(it.0).font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Delta(value: it.1, percent: true).font(.subheadline.weight(.semibold))
                    }
                }
            }
        }
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

/// 均線一欄：名稱、收盤離均線的距離、均線位置。
private struct MaColumn: View {
    let name: String
    let close: Double
    let ma: Double?
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(name).font(.caption2).foregroundStyle(.secondary).lineLimit(1).fixedSize(horizontal: true, vertical: false)
            Delta(value: ma.map { (close / $0 - 1) * 100 }, percent: true).font(.subheadline.weight(.semibold)).lineLimit(1).fixedSize(horizontal: true, vertical: false)
            Text(Fmt.num(ma, 0)).font(.caption2.monospacedDigit()).foregroundStyle(.secondary).lineLimit(1).fixedSize(horizontal: true, vertical: false)
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
                Text(label).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                badge()
            }
            if let value {
                Text(value)
                    .font(.title3.weight(.semibold).monospacedDigit())
                    .foregroundStyle(tone == nil ? Color.primary : Color.tone(tone))
                    .lineLimit(dts.isAccessibilitySize ? nil : 1)
                    .minimumScaleFactor(0.8)
            }
            detail().font(.caption2).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .cardBackground()
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
    @Environment(\.dynamicTypeSize) private var dts

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // 大字級時左右並排放不下：副標（收盤價）會被截、% 會被擠到下一行，改成上下排列、全部靠左。
            if dts.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.headline)
                    Text(subtitle).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    points
                    figures(alignment: .leading)
                }
            } else {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(title).font(.headline)
                        Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 1) {
                        points
                        figures(alignment: .trailing)
                    }
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

    private var points: some View {
        Text("\(Fmt.signed(pts)) 點").font(.headline.monospacedDigit()).foregroundStyle(Color.tone(pts))
    }

    /// 漲跌與權重：每個數字不斷行；一行放不下時上下排，不截字。
    private func figures(alignment: HorizontalAlignment) -> some View {
        let ret = Text(Fmt.pct(self.ret)).foregroundStyle(Color.tone(self.ret)).fixedSize()
        let weight = Text("權重 \(Fmt.num(self.weight, 2))%").foregroundStyle(.secondary).fixedSize()
        return ViewThatFits(in: .horizontal) {
            HStack(spacing: 6) { ret; weight }
            VStack(alignment: alignment, spacing: 1) { ret; weight }
        }
        .font(.caption.monospacedDigit())
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

/// 個股下面的 AI 摘要：預設 2 行，點一下就地展開成全文（獨立於整列的跳頁 Button）。
struct AIDigestLine: View {
    let text: String
    let expanded: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("AI").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                    .padding(.horizontal, 4)
                    .overlay(Capsule().stroke(Color.secondary.opacity(0.6), lineWidth: 1))
                VStack(alignment: .leading, spacing: 2) {
                    Text(text)
                        .font(.footnote).foregroundStyle(.secondary)
                        .lineLimit(expanded ? nil : 2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 2) {
                        Text(expanded ? "收合" : "展開")
                        Image(systemName: expanded ? "chevron.up" : "chevron.down")
                    }
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
                }
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("AI 摘要：\(text)")
        .accessibilityValue(expanded ? "已展開" : "已收合")
        .accessibilityHint(expanded ? "點兩下收合" : "點兩下展開")
    }
}
