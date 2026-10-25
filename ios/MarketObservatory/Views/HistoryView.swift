import Charts
import SwiftUI

struct HistoryView: View {
    @Environment(SessionStore.self) private var session
    @State private var state: LoadState<History> = .idle
    @State private var symbol = "SPX"
    @State private var months = 12

    var body: some View {
        NavigationStack {
            Loadable(state: state, retry: load) { h in content(h) }
                .navigationTitle(state.value.map { "\($0.label ?? $0.symbol) 走勢" } ?? "走勢")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    if let h = state.value {
                        ToolbarItem(placement: .topBarTrailing) {
                            Menu {
                                Picker("標的", selection: Binding(get: { symbol }, set: { symbol = $0; Task { await load() } })) {
                                    ForEach(h.symbols, id: \.self) { pair in
                                        Text(pair.count > 1 ? "\(pair[1])（\(pair[0])）" : pair.first ?? "").tag(pair.first ?? "")
                                    }
                                }
                            } label: {
                                Label("標的", systemImage: "list.bullet")
                            }
                        }
                    }
                }
        }
        .task { if state.value == nil { await load() } }
    }

    private func load() async {
        state = .loading(state.value)
        do {
            let h: History = try await API.get("/api/v1/history", query: ["symbol": symbol, "months": String(months)])
            symbol = h.symbol
            months = h.months
            state = .loaded(h)
        } catch {
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    private func rangeLabel(_ m: Int) -> String { m < 12 ? "\(m) 月" : "\(m / 12) 年" }

    private func content(_ h: History) -> some View {
        List {
            Section {
                Picker("區間", selection: Binding(get: { months }, set: { months = $0; Task { await load() } })) {
                    ForEach(h.ranges, id: \.self) { Text(rangeLabel($0)).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowSeparator(.hidden)

                PriceChart(points: h.priceLine)
                    .frame(height: 240)
                HStack {
                    LegendDot(color: .accentColor, text: "收盤")
                    LegendDot(color: .orange, text: "SMA20")
                    LegendDot(color: .purple, text: "SMA60")
                    LegendDot(color: .gray, text: "SMA200")
                }
                .font(.caption2)
                HStack {
                    StatCell(title: "區間報酬", value: Fmt.pct(h.mainStats.ret), tone: h.mainStats.ret)
                    StatCell(title: "最大回檔", value: Fmt.pct(h.mainStats.mdd), tone: h.mainStats.mdd)
                    StatCell(title: "交易日", value: "\(h.mainStats.points)", tone: nil)
                }
            }

            Section {
                RebasedChart(series: h.rebased, labels: Dictionary(uniqueKeysWithValues: h.stats.map { ($0.symbol, $0.label ?? $0.symbol) }))
                    .frame(height: 240)
            } header: {
                Text("相對報酬（區間起點 = 0%）")
            }

            Section("區間統計") {
                ForEach(h.stats) { s in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(s.label ?? s.symbol).font(.subheadline)
                            Text("收盤 \(Fmt.num(s.close))").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text(Fmt.pct(s.ret)).foregroundStyle(Color.tone(s.ret)).monospacedDigit()
                            Text("回檔 \(Fmt.pct(s.mdd, 1)) · 波動 \(Fmt.num(s.vol, 1))%").font(.caption).foregroundStyle(.secondary).monospacedDigit()
                        }
                    }
                }
            }

            Section {
                ContributionChart(rows: h.contribution).frame(height: 200)
                HStack {
                    LegendDot(color: .accentColor, text: "名單")
                    LegendDot(color: .gray, text: "其餘")
                }
                .font(.caption2)
            } header: {
                Text("近 40 個交易日貢獻點數")
            } footer: {
                Text("只加總你名單上的公司；名單上任何一家那天沒有資料就留空。")
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
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
            Text(value).font(.subheadline.weight(.semibold).monospacedDigit()).foregroundStyle(tone == nil ? Color.primary : Color.tone(tone))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct PriceChart: View {
    let points: [History.PricePoint]

    var body: some View {
        let closes = points.map(\.close)
        let lo = closes.min() ?? 0
        let hi = closes.max() ?? 1
        let pad = (hi - lo) * 0.05
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
        .chartLegend(.hidden)
    }
}

private struct RebasedChart: View {
    let series: [History.Rebased]
    let labels: [String: String]

    var body: some View {
        Chart {
            ForEach(series) { s in
                ForEach(Array(s.points.enumerated()), id: \.offset) { _, p in
                    if let v = p.value, let d = Fmt.day(p.date) {
                        LineMark(x: .value("日期", d), y: .value("報酬", v), series: .value("標的", labels[s.symbol] ?? s.symbol))
                            .foregroundStyle(by: .value("標的", labels[s.symbol] ?? s.symbol))
                            .lineStyle(StrokeStyle(lineWidth: s.symbol == "SPX" ? 2.5 : 1.2))
                    }
                }
            }
            RuleMark(y: .value("0", 0)).foregroundStyle(.secondary.opacity(0.4))
        }
        .chartYAxis { AxisMarks { v in AxisGridLine(); AxisValueLabel { if let d = v.as(Double.self) { Text("\(Int(d))%") } } } }
        .chartLegend(position: .bottom, alignment: .leading)
    }
}

private struct ContributionChart: View {
    let rows: [History.Contribution]

    var body: some View {
        Chart {
            ForEach(rows) { r in
                if let d = Fmt.day(r.date) {
                    if let m = r.mag7 {
                        BarMark(x: .value("日期", d, unit: .day), y: .value("點數", m)).foregroundStyle(Color.accentColor)
                    }
                    if let rest = r.rest {
                        BarMark(x: .value("日期", d, unit: .day), y: .value("點數", rest)).foregroundStyle(.gray.opacity(0.5))
                    }
                }
            }
            RuleMark(y: .value("0", 0)).foregroundStyle(.secondary.opacity(0.4))
        }
    }
}
