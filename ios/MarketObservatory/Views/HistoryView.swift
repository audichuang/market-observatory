import Charts
import SwiftUI
import UIKit

struct HistoryView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dynamicTypeSize) private var dts
    @State private var state: LoadState<History> = .idle
    @State private var symbol = "SPX"
    @State private var months = 12
    @State private var loadTask: Task<Void, Never>?
    @State private var researchExpanded = false
    @State private var researchCopied = false
    // 選取的 checkmark 比 chevron 寬，固定寬度讓數字欄右緣對齊
    @ScaledMetric(relativeTo: .caption) private var rowIconWidth: CGFloat = 14
    @ScaledMetric(relativeTo: .body) private var chartHeight: CGFloat = 240
    @ScaledMetric(relativeTo: .body) private var contributionHeight: CGFloat = 200

    /// 換標的或區間後、新資料回來前：畫面上還是舊圖，要讓人看得出正在載入。
    private var busy: Bool {
        if case .loading(.some) = state { return true }
        return false
    }

    var body: some View {
        NavigationStack {
            Loadable(state: state, retry: load) { h in content(h) }
                .navigationTitle("走勢")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    if busy {
                        ToolbarItem(placement: .topBarLeading) { ProgressView() }
                    }
                    if let h = state.value {
                        ToolbarItem(placement: .topBarTrailing) {
                            Menu {
                                Picker("標的", selection: Binding(get: { symbol }, set: { symbol = $0; reload() })) {
                                    ForEach(h.symbols, id: \.self) { pair in
                                        Text(pair.count > 1 && pair[1] != pair[0] ? "\(pair[1])（\(pair[0])）" : pair.first ?? "").tag(pair.first ?? "")
                                    }
                                }
                            } label: {
                                HStack(spacing: 2) {
                                    Text(h.label ?? h.symbol)
                                    Image(systemName: "chevron.down").font(.caption)
                                }
                            }
                            .accessibilityLabel("標的：\(h.label ?? h.symbol)")
                        }
                    }
                }
        }
        .task { if takePending() || state.value == nil { await load() } }
        .onChange(of: session.historySymbol) { _, new in
            if new != nil, takePending() { reload() }
        }
        .onChange(of: session.watchlistRevision) { reload() }
    }

    /// 名單頁指定的標的：讀進來就清掉，下次點同一家也會觸發。
    private func takePending() -> Bool {
        guard let s = session.historySymbol else { return false }
        symbol = s
        session.historySymbol = nil
        return true
    }

    private func reload() {
        loadTask?.cancel()
        loadTask = Task { await load() }
    }

    private func load() async {
        let reqSymbol = symbol, reqMonths = months
        state = .loading(state.value)
        do {
            let h: History = try await API.get("/api/v1/history", query: ["symbol": reqSymbol, "months": String(reqMonths)])
            // 連點時較早的請求可能較晚回來：只採用跟目前選擇一致的回應。
            guard !Task.isCancelled, reqSymbol == symbol, reqMonths == months else { return }
            symbol = h.symbol
            months = h.months
            state = .loaded(h)
        } catch {
            if error is CancellationError || (error as? URLError)?.code == .cancelled || Task.isCancelled { return }
            guard reqSymbol == symbol, reqMonths == months else { return }
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    private func rangeLabel(_ m: Int) -> String { m < 12 ? "\(m) 個月" : "\(m / 12) 年" }

    private func content(_ h: History) -> some View {
        let labels = Dictionary(h.stats.map { ($0.symbol, $0.label ?? $0.symbol) }, uniquingKeysWith: { a, _ in a })
        let indexFirst = h.stats.first { $0.symbol == "SPX" }?.first
        let statLayout = dts.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout())
        return ScrollViewReader { proxy in
            List {
                Section {
                    Picker("區間", selection: Binding(get: { months }, set: { months = $0; reload() })) {
                        ForEach(h.ranges, id: \.self) { Text(rangeLabel($0)).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowSeparator(.hidden)
                    .id("top")

                    if let first = h.mainStats.first, let last = h.mainStats.last {
                        Text("\(Fmt.fullDate(first)) – \(Fmt.fullDate(last))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                            .listRowSeparator(.hidden)
                    }

                    PriceChart(points: h.priceLine)
                        .frame(height: min(chartHeight, 240 * 1.5))
                        .opacity(busy ? 0.5 : 1)
                    ViewThatFits(in: .horizontal) {
                        HStack { priceLegend }
                        Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 4) {
                            GridRow {
                                LegendDot(color: .accentColor, text: "收盤")
                                LegendDot(color: .orange, text: "SMA20")
                            }
                            GridRow {
                                LegendDot(color: .purple, text: "SMA60")
                                LegendDot(color: .gray, text: "SMA200")
                            }
                        }
                        VStack(alignment: .leading, spacing: 4) { priceLegend }
                    }
                    .font(.caption2)
                    statLayout {
                        StatCell(title: "區間報酬", value: Fmt.pct(h.mainStats.ret), tone: h.mainStats.ret)
                        StatCell(title: "最大回檔", value: Fmt.pct(h.mainStats.mdd, 1), tone: h.mainStats.mdd)
                        StatCell(title: "交易日", value: "\(h.mainStats.points)", tone: nil)
                    }
                } footer: {
                    Text("日收盤，已調整拆股、不含股息。")
                }
                .listRowSeparator(.hidden)

                if h.watch.contains(h.symbol) {
                    Section {
                        if let url = Research.edgarFilingsURL(h.symbol) {
                            Link("SEC EDGAR 申報清單", destination: url)
                        }
                        if let ir = Research.irURLs[h.symbol], let url = URL(string: ir) {
                            Link("公司投資人關係（IR）", destination: url)
                        } else {
                            Text("這家公司未收錄 IR 網址；可從 EDGAR 的年報（10-K）找到公司網站。")
                                .foregroundStyle(.secondary)
                        }
                        DisclosureGroup("研究表範本（7 題）", isExpanded: $researchExpanded) {
                            ForEach(Array(Research.fields.enumerated()), id: \.offset) { i, field in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("\(i + 1). \(field.label)").font(.headline)
                                    Text(field.prompt)
                                }
                                .fixedSize(horizontal: false, vertical: true)
                            }
                            Button("複製範本") {
                                let formatter = DateFormatter()
                                formatter.locale = Locale(identifier: "en_US_POSIX")
                                formatter.calendar = Calendar(identifier: .gregorian)
                                formatter.timeZone = .current
                                formatter.dateFormat = "yyyy-MM-dd"
                                UIPasteboard.general.string = Research.template(
                                    company: h.label ?? h.symbol, ticker: h.symbol, date: formatter.string(from: Date())
                                )
                                researchCopied = true
                            }
                            if researchCopied {
                                Text("已複製，可貼到你自己的筆記保存")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    } header: {
                        Text("研究表與原始資料")
                    } footer: {
                        Text(Research.note)
                    }
                }

                Section {
                    if h.watch.count > RebasedChart.members {
                        Text("圖上畫 S&P 500、RSP 與名單前 \(RebasedChart.members) 家；下方統計列出全部 \(h.watch.count) 家。")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    RebasedChart(series: h.rebased, watch: h.watch, labels: labels, selected: symbol)
                        .frame(height: min(chartHeight, 240 * 1.5))
                        .opacity(busy ? 0.5 : 1)
                    Text("每條線以區間第一個交易日收盤為 0%，與下表「區間報酬」同一起點")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } header: {
                    Text("名單 vs 指數（起點 0%）")
                        .textCase(nil)
                }
                .listRowSeparator(.hidden)

                Section("區間統計") {
                    ForEach(h.stats) { s in
                        Button {
                            guard s.symbol != symbol else { return }
                            symbol = s.symbol
                            withAnimation { proxy.scrollTo("top", anchor: .top) }
                            reload()
                        } label: {
                            HStack {
                                statRow(s, indexFirst: indexFirst)
                                Image(systemName: s.symbol == symbol ? "checkmark" : "chevron.right")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.tertiary)
                                    .frame(width: rowIconWidth, alignment: .trailing)
                            }
                            .contentShape(Rectangle())
                        }
                        .foregroundStyle(.primary)
                    }
                }

                Section {
                    if h.contribution.contains(where: { $0.mag7 != nil }) {
                        ContributionChart(rows: h.contribution)
                            .frame(height: min(contributionHeight, 200 * 1.5))
                            .opacity(busy ? 0.5 : 1)
                        ViewThatFits(in: .horizontal) {
                            HStack { contributionLegend }
                            VStack(alignment: .leading, spacing: 4) { contributionLegend }
                        }
                        .font(.caption2)
                        Text("\(RestLabel.full)＝指數漲跌減掉名單合計。")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    } else {
                        ContentUnavailableView("尚無貢獻資料", systemImage: "chart.bar", description: Text("名單上有公司那幾天還沒有資料，或目前還沒有快照。"))
                    }
                } header: {
                    Text("近 \(h.contribution.count) 個交易日：指數漲跌點數拆解")
                }
                .listRowSeparator(.hidden)
            }
            .listStyle(.insetGrouped)
            .refreshable { await load() }
            .onChange(of: h.symbol) {
                researchExpanded = false
                researchCopied = false
            }
        }
    }

    @ViewBuilder private var priceLegend: some View {
        LegendDot(color: .accentColor, text: "收盤")
        LegendDot(color: .orange, text: "SMA20")
        LegendDot(color: .purple, text: "SMA60")
        LegendDot(color: .gray, text: "SMA200")
    }

    @ViewBuilder private var contributionLegend: some View {
        LegendDot(color: ContributionChart.watchColor, text: "觀察名單貢獻")
        LegendDot(color: ContributionChart.restColor, text: RestLabel.short)
        LegendDot(color: ContributionChart.indexColor, text: "指數漲跌")
    }

    @ViewBuilder private func statRow(_ s: History.Stat, indexFirst: String?) -> some View {
        let risk = "回檔 \(Fmt.pct(s.mdd, 1)) · 波動 \(Fmt.num(s.vol, 1))%"
        let isIndex = s.symbol == "SPX" || s.symbol == "RSP"
        let title = isIndex ? (s.label ?? s.symbol) : s.symbol
        let kind = s.symbol == "SPX" ? "指數" : s.symbol == "RSP" ? "等權重 ETF" : (s.label ?? "")
        let since = s.first != indexFirst ? s.first.map { "自 \(Fmt.shortDate($0))" } : nil
        let sub = (kind.isEmpty ? [] : [kind]) + ["收盤 \(Fmt.num(s.close))"] + [since].compactMap { $0 }
        if dts.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(.headline)
                Text(sub.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
                Text(Fmt.pct(s.ret)).font(.headline.monospacedDigit()).foregroundStyle(Color.tone(s.ret))
                Text(risk).font(.caption).foregroundStyle(.secondary).monospacedDigit()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(sub.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 1) {
                Text(Fmt.pct(s.ret)).font(.headline.monospacedDigit()).foregroundStyle(Color.tone(s.ret))
                Text(risk).font(.caption).foregroundStyle(.secondary).monospacedDigit()

            }
        }
    }
}

private extension Color {
    init(rgb: UInt32) {
        self.init(red: Double((rgb >> 16) & 0xFF) / 255, green: Double((rgb >> 8) & 0xFF) / 255, blue: Double(rgb & 0xFF) / 255)
    }
}

private struct LegendDot: View {
    let color: Color
    let text: String
    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text).foregroundStyle(.secondary)
        }
    }
}

private struct StatCell: View {
    let title: String
    let value: String
    let tone: Double?
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold).monospacedDigit())
                .foregroundStyle(tone == nil ? Color.primary : Color.tone(tone))

        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct PriceChart: View {
    let points: [History.PricePoint]

    var body: some View {
        // Y 軸範圍要涵蓋所有畫出來的線（均線可能低於區間最低收盤），否則會畫到圖外。
        let all = points.flatMap { [$0.close, $0.sma20, $0.sma60, $0.sma200].compactMap { $0 } }
        let lo = all.min() ?? 0
        let hi = all.max() ?? 1
        let pad = max((hi - lo) * 0.05, 1)
        Chart {
            ForEach(points) { p in
                if let d = Fmt.day(p.date) {
                    LineMark(x: .value("日期", d), y: .value("收盤", p.close), series: .value("線", "收盤"))
                        .foregroundStyle(Color.accentColor)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                    if let v = p.sma20 { LineMark(x: .value("日期", d), y: .value("SMA20", v), series: .value("線", "SMA20")).foregroundStyle(.orange).lineStyle(StrokeStyle(lineWidth: 1)) }
                    if let v = p.sma60 { LineMark(x: .value("日期", d), y: .value("SMA60", v), series: .value("線", "SMA60")).foregroundStyle(.purple).lineStyle(StrokeStyle(lineWidth: 1)) }
                    if let v = p.sma200 { LineMark(x: .value("日期", d), y: .value("SMA200", v), series: .value("線", "SMA200")).foregroundStyle(.gray).lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3])) }
                }
            }
        }
        .chartYScale(domain: (lo - pad) ... (hi + pad))
        .chartPlotStyle { $0.clipped() }
        .chartLegend(.hidden)
        .readableAxes()
    }
}

private struct RebasedChart: View {
    @Environment(\.colorScheme) private var colorScheme
    /// 圖上最多畫名單前幾家（跟網頁一樣）：再多顏色會重複、線糊成一團；下方統計照樣列出全部。
    static let members = 10
    /// 網頁 pages/history.tsx 的 COLORS；#333 換成會跟著深色模式變的 primary。
    private static let colors: [Color] = [
        Color(rgb: 0x2456D6), Color(rgb: 0xD1343B), Color(rgb: 0x12884E), Color(rgb: 0xB26B00),
        Color(rgb: 0x7B3FD1), Color(rgb: 0x0F8A9D), Color(rgb: 0xC2417F), Color(rgb: 0x5C6B7A),
        Color(rgb: 0x8A6D00), Color.primary, Color(rgb: 0xE0662B), Color(rgb: 0x2A9D8F),
        Color(rgb: 0x9B5DE5), Color(rgb: 0x6A994E),
    ]

    /// Keep every comparison series legible against the dark grouped background.
    private static let darkColors: [Color] = [
        Color(rgb: 0x7A9AFF), Color(rgb: 0xFF7178), Color(rgb: 0x53D69C), Color(rgb: 0xFFB65C),
        Color(rgb: 0xBC9BFF), Color(rgb: 0x59D2E3), Color(rgb: 0xF58FB8), Color(rgb: 0xBDC9D5),
        Color(rgb: 0xE6D36D), Color.primary, Color(rgb: 0xFF9D70), Color(rgb: 0x6CDECD),
        Color(rgb: 0xCCA6FF), Color(rgb: 0xAED58C),
    ]

    let series: [History.Rebased]
    let watch: [String]
    let labels: [String: String]
    /// 目前選取的標的：跟 S&P 500 一起加粗，其他系列淡一點，9 條線才不會糊在一起。
    let selected: String

    var body: some View {
        let plotted = series.filter { s in
            guard let i = watch.firstIndex(of: s.symbol) else { return true }
            return i < Self.members
        }
        let names = plotted.map { name($0.symbol) }
        let colors = colorScheme == .dark ? Self.darkColors : Self.colors
        let palette = plotted.indices.map { colors[$0 % colors.count] }
        Chart {
            ForEach(plotted) { s in
                ForEach(Array(s.points.enumerated()), id: \.offset) { _, p in
                    if let v = p.value, let d = Fmt.day(p.date) {
                        LineMark(x: .value("日期", d), y: .value("報酬", v), series: .value("標的", name(s.symbol)))
                            .foregroundStyle(by: .value("標的", name(s.symbol)))
                            .lineStyle(StrokeStyle(lineWidth: emphasized(s.symbol) ? 2.5 : (colorScheme == .dark ? 1.6 : 1), dash: s.symbol == "RSP" ? [5, 3] : []))
                            .opacity(emphasized(s.symbol) ? 1 : (colorScheme == .dark ? 0.9 : 0.35))
                    }
                }
            }
            RuleMark(y: .value("0", 0)).foregroundStyle(.secondary.opacity(0.4))
        }
        .chartForegroundStyleScale(domain: names, range: palette)
        .readableAxes { Fmt.plainPct($0, 0) }
        .chartLegend(position: .bottom, alignment: .leading)
    }

    private func name(_ symbol: String) -> String { labels[symbol] ?? symbol }
    private func emphasized(_ symbol: String) -> Bool { symbol == "SPX" || symbol == selected }
}

private struct ContributionChart: View {
    static let watchColor = Color.accentColor
    static let restColor = Color.gray.opacity(0.5)
    static let indexColor = Color.primary

    let rows: [History.Contribution]

    var body: some View {
        Chart {
            ForEach(rows) { r in
                if let d = Fmt.day(r.date) {
                    if let m = r.mag7 {
                        BarMark(x: .value("日期", d, unit: .day), y: .value("點數", m))
                            .foregroundStyle(by: .value("系列", "觀察名單貢獻"))
                    }
                    if let rest = r.rest {
                        BarMark(x: .value("日期", d, unit: .day), y: .value("點數", rest))
                            .foregroundStyle(by: .value("系列", RestLabel.short))
                    }
                }
            }
            // 指數當天的淨漲跌：兩段長條方向相反時，光看長條看不出淨值。
            ForEach(rows) { r in
                if let d = Fmt.day(r.date), let i = r.index {
                    LineMark(x: .value("日期", d, unit: .day), y: .value("點數", i), series: .value("系列", "指數漲跌"))
                        .foregroundStyle(Self.indexColor)
                        .lineStyle(StrokeStyle(lineWidth: 1.5))
                    PointMark(x: .value("日期", d, unit: .day), y: .value("點數", i))
                        .foregroundStyle(Self.indexColor)
                        .symbolSize(16)
                }
            }
            RuleMark(y: .value("0", 0)).foregroundStyle(.secondary.opacity(0.4))
        }
        .chartForegroundStyleScale(["觀察名單貢獻": Self.watchColor, RestLabel.short: Self.restColor])
        .chartLegend(.hidden)
        .readableAxes()
    }
}
