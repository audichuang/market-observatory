import AuthenticationServices
import Charts
import SwiftUI

struct MoreView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink { EtfView() } label: { moreLabel("ETF 與定投試算", "S&P 500 ETF 報酬、費用與定投試算", "chart.pie") }
                    NavigationLink { OutlookView() } label: { moreLabel("下月展望", "歷史條件機率與滾動驗證", "binoculars") }
                }
                Section {
                    NavigationLink { PushSettingsView() } label: { Label("推播設定", systemImage: "bell.badge") }
                    NavigationLink { AccountView() } label: {
                        Label {
                            VStack(alignment: .leading) {
                                Text("帳號")
                                if let me = session.me { Text(me.email).font(.caption).foregroundStyle(.secondary) }
                            }
                        } icon: { Image(systemName: "person.crop.circle") }
                    }
                } footer: {
                    Text("個人研究用途，非投資建議。行情來自 Yahoo Finance（主）、Nasdaq 與 Cboe（核對），權重來自 State Street SPY 每日持股；非官方授權資料源，可能延遲或錯誤。")
                }
            }
            .navigationTitle("更多")
        }
    }

    /// 主標文字開頭不變（走查用 BEGINSWITH 找），副標寫出裡面有什麼。
    private func moreLabel(_ title: String, _ sub: String, _ icon: String) -> some View {
        Label {
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                Text(sub).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        } icon: { Image(systemName: icon) }
    }
}

// MARK: - ETF 與定投

struct EtfView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var state: LoadState<Etfs> = .idle
    @State private var period = "1Y"
    @State private var editing = false
    // 定投試算的條件：第一次載入後從 e.sim 帶入；之後改了只重新試算，不會動到存好的預設。
    @State private var simEtf: String?
    @State private var simYears: Int?
    @State private var simMonthly: Int?
    @State private var monthlyText = ""
    @State private var loadSeq = 0
    @State private var savingDefault = false
    @State private var defaultError: String?
    @FocusState private var monthlyFocused: Bool

    var body: some View {
        Loadable(state: state, retry: load) { e in content(e) }
            .navigationTitle("ETF 與定投")
            .toolbar {
                if state.value != nil {
                    Button("我的規劃") { editing = true }
                }
            }
            .sheet(isPresented: $editing) {
                if let e = state.value {
                    PlanEditor(plan: e.plan) { saved in
                        editing = false
                        if saved { Task { await load() } }
                    }
                }
            }
            .task { if state.value == nil { await load() } }
    }

    private func load() async {
        loadSeq += 1
        let seq = loadSeq
        state = .loading(state.value)
        do {
            let e: Etfs = try await API.get("/api/v1/etfs", query: [
                "etf": simEtf,
                "years": simYears.map(String.init),
                "monthly": simMonthly.map(String.init),
            ])
            // 連續切換時只採用最後一次的結果，避免舊的回應蓋掉新的。
            guard seq == loadSeq else { return }
            simEtf = e.sim.etf
            simYears = e.sim.years
            simMonthly = Int(e.sim.monthlyTwd)
            monthlyText = String(Int(e.sim.monthlyTwd))
            state = .loaded(e)
        } catch {
            guard seq == loadSeq else { return }
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    private func isDefault(_ e: Etfs) -> Bool {
        e.sim.etf == e.plan.etf && e.sim.years == e.plan.years && Int(e.sim.monthlyTwd) == e.plan.monthlyTwd
    }

    private func saveDefault(_ e: Etfs) async {
        savingDefault = true
        defer { savingDefault = false }
        var p = e.plan
        p.etf = e.sim.etf
        p.years = e.sim.years
        p.monthlyTwd = Int(e.sim.monthlyTwd)
        do {
            try await API.raw("PUT", "/api/v1/etfs", body: p)
            defaultError = nil
            await load()
        } catch {
            session.handle(error)
            defaultError = error.localizedDescription
        }
    }

    private func content(_ e: Etfs) -> some View {
        let typedMonthly = Int(monthlyText.trimmingCharacters(in: .whitespaces))
        let canSimulate = typedMonthly.map { $0 > 0 && $0 <= 10_000_000 && $0 != Int(e.sim.monthlyTwd) } ?? false
        return List {
            Section {
                Picker("期間", selection: $period) {
                    ForEach(["YTD"] + e.periods, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.segmented)
                ForEach(e.rows) { r in
                    VStack(alignment: .leading, spacing: 8) {
                        let headerLayout = typeSize.isAccessibilitySize
                            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
                            : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 12))
                        headerLayout {
                            HStack(spacing: 8) {
                                Text(r.ticker).font(.headline)
                                    .accessibilityIdentifier("etf-ticker-\(r.ticker)")
                                if r.multiple != 1 { Text("\(r.multiple > 0 ? "" : "反向 ")\(Int(abs(r.multiple)))×").font(.caption.weight(.semibold)).foregroundStyle(.orange) }
                            }
                            if !typeSize.isAccessibilitySize { Spacer(minLength: 12) }
                            let v = period == "YTD" ? r.ytd : (r.returns[period] ?? nil)
                            Text(Fmt.pct(v)).font(.headline.monospacedDigit()).foregroundStyle(Color.tone(v))
                                .fixedSize(horizontal: true, vertical: false)
                                .accessibilityIdentifier("etf-return-\(r.ticker)")
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(r.name).font(.subheadline)
                            Text(r.issuer).font(.caption).foregroundStyle(.secondary)
                            Text("費用 \(Fmt.fee(r.netFeePct)) · 規模 \(Fmt.compactUsd(r.aumUsd))").font(.caption).foregroundStyle(.secondary)
                            if let n = r.note, !n.isEmpty { Text(n).font(.caption2).foregroundStyle(.secondary) }
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text("收盤 \(Fmt.num(r.close))").font(.caption).foregroundStyle(.secondary).monospacedDigit()
                            if let drift = r.drift1y {
                                HStack(spacing: 4) {
                                    Text("近一年偏離").foregroundStyle(.secondary)
                                    Delta(value: drift.drift, digits: 1, percent: true)
                                }
                                .font(.caption)
                            }
                        }
                    }
                    .padding(.vertical, 6)
                }
            } header: {
                Text("報酬（資料到 \(Fmt.fullDate(e.asOf))）")
            } footer: {
                Text("價格報酬，不含配息。近一年偏離 ＝ 槓桿／反向 ETF 實際報酬減「倍數 × 指數報酬」。")
            }

            Section {
                Picker("標的", selection: Binding(get: { simEtf ?? e.sim.etf }, set: { v in
                    simEtf = v
                    Task { await load() }
                })) {
                    ForEach(e.rows.map(\.ticker), id: \.self) { Text($0).tag($0) }
                }
                Picker("期間", selection: Binding(get: { simYears ?? e.sim.years }, set: { v in
                    simYears = v
                    Task { await load() }
                })) {
                    ForEach([1, 2, 3, 5], id: \.self) { Text("\($0) 年").tag($0) }
                }
                LabeledContent("每月投入") {
                    HStack {
                        TextField("台幣", text: $monthlyText)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .focused($monthlyFocused)
                        Button("試算") {
                            monthlyFocused = false
                            simMonthly = typedMonthly
                            Task { await load() }
                        }
                        .buttonStyle(.borderless)
                        .disabled(!canSimulate)
                    }
                }
                if let d = e.dca {
                    LabeledContent("投入 \(d.months) 個月", value: Fmt.twd(d.invested))
                    LabeledContent("目前市值") { Text(Fmt.twd(d.value)).bold() }
                    LabeledContent("報酬率") { Delta(value: d.returnPct, percent: true) }
                    LabeledContent("同金額期初單筆") {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(Fmt.twd(d.lumpSumValue)).bold().monospacedDigit()
                            Delta(value: d.lumpSumReturnPct, percent: true).font(.caption)
                        }
                    }
                    LabeledContent("最大帳面虧損") { Delta(value: d.maxDrawdownPct, percent: true) }
                    Chart {
                        ForEach(d.path) { p in
                            if let day = Fmt.day(p.date) {
                                LineMark(x: .value("日期", day), y: .value("金額", p.invested), series: .value("線", "累計投入"))
                                    .foregroundStyle(by: .value("線", "累計投入"))
                                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                                LineMark(x: .value("日期", day), y: .value("金額", p.value), series: .value("線", "市值"))
                                    .foregroundStyle(by: .value("線", "市值"))
                                    .lineStyle(StrokeStyle(lineWidth: 2))
                            }
                        }
                    }
                    .chartForegroundStyleScale(["市值": Color.up, "累計投入": Color(red: 0x5C / 255, green: 0x6B / 255, blue: 0x7A / 255)])
                    .chartLegend(position: .top, alignment: .leading)
                    .chartYAxis { AxisMarks { AxisGridLine(); AxisTick(); AxisValueLabel(format: FloatingPointFormatStyle<Double>.number.notation(.compactName)) } }
                    .frame(height: 180)
                } else {
                    Text("資料不足，無法試算。").foregroundStyle(.secondary)
                }
                Button {
                    Task { await saveDefault(e) }
                } label: {
                    HStack {
                        Text(isDefault(e) ? "已是我的預設" : "設為我的預設")
                        if savingDefault { Spacer(); ProgressView() }
                    }
                }
                .disabled(isDefault(e) || savingDefault)
                if let defaultError { Notice(kind: .bad, text: "沒有存到：\(defaultError)").noticeRow() }
            } header: {
                Text("\(e.sim.etf) 定投 \(e.sim.years) 年（台幣計價）")
            } footer: {
                Text("每月第一個交易日以收盤價買入，用當天 USD/TWD 換匯；不含配息、手續費與稅。改標的、期間或金額只是試算，按「設為我的預設」才會存起來。\(e.fxLast.map { "最新匯率 \(Fmt.num($0.close, 3))（\(Fmt.fullDate($0.date))）。" } ?? "")")
            }

            Section("我的規劃") {
                LabeledContent("研究預算", value: Fmt.twd(Double(e.plan.researchBudgetTwd)))
                LabeledContent("每批投入", value: Fmt.twd(Double(e.plan.trancheTwd)))
                LabeledContent("考慮出場的漲幅", value: Fmt.plainPct(e.plan.exitConsiderationPct, 0))
                if !e.plan.notes.isEmpty { Text(e.plan.notes).font(.footnote).foregroundStyle(.secondary) }
            }
        }
        .listStyle(.insetGrouped)
        .lineSpacing(3)
        .refreshable { await load() }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("完成") { monthlyFocused = false }
            }
        }
    }
}

/// 資金規劃與備註。定投的標的、期間與每月金額在試算區按「設為我的預設」改，這裡原樣送回。
private struct PlanEditor: View {
    let plan: Plan
    let done: (Bool) -> Void
    @State private var notes: String
    @State private var budgetText: String
    @State private var trancheText: String
    @State private var exitText: String
    @State private var error: String?
    @State private var saving = false
    @FocusState private var focused: Bool

    init(plan: Plan, done: @escaping (Bool) -> Void) {
        self.plan = plan
        self.done = done
        _notes = State(initialValue: plan.notes)
        _budgetText = State(initialValue: String(plan.researchBudgetTwd))
        _trancheText = State(initialValue: String(plan.trancheTwd))
        _exitText = State(initialValue: plan.exitConsiderationPct.formatted(.number.precision(.fractionLength(0 ... 2)).grouping(.never)))
    }

    /// 解析並檢查範圍（同後端 PlanSchema）；任何一格不合法就回 nil。
    private var parsed: Plan? {
        guard let budget = Int(budgetText.trimmingCharacters(in: .whitespaces)), (0 ... 1_000_000_000).contains(budget),
              let tranche = Int(trancheText.trimmingCharacters(in: .whitespaces)), (0 ... 1_000_000_000).contains(tranche),
              let exit = Double(exitText.trimmingCharacters(in: .whitespaces)), exit.isFinite, (0 ... 100).contains(exit),
              notes.count <= 2000
        else { return nil }
        var p = plan
        p.researchBudgetTwd = budget
        p.trancheTwd = tranche
        p.exitConsiderationPct = exit
        p.notes = notes
        return p
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("研究預算") { TextField("金額", text: $budgetText).keyboardType(.numberPad).multilineTextAlignment(.trailing).focused($focused) }
                    LabeledContent("每批投入") { TextField("金額", text: $trancheText).keyboardType(.numberPad).multilineTextAlignment(.trailing).focused($focused) }
                    LabeledContent("考慮出場漲幅 %") { TextField("%", text: $exitText).keyboardType(.decimalPad).multilineTextAlignment(.trailing).focused($focused) }
                } header: {
                    Text("資金規劃")
                } footer: {
                    if parsed == nil { Text("金額要是 0 到 10 億的整數，出場漲幅 0–100%，備註最多 2000 字。").foregroundStyle(Color.up) }
                }
                Section("備註") { TextEditor(text: $notes).frame(minHeight: 100).focused($focused) }
                if let error { Section { Notice(kind: .bad, text: error).noticeRow() } }
            }
            .navigationTitle("我的規劃")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { done(false) } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView()
                    } else {
                        Button("儲存") { Task { await save() } }.disabled(parsed == nil)
                    }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("完成") { focused = false }
                }
            }
        }
    }

    private func save() async {
        focused = false
        guard let p = parsed else { return }
        saving = true
        defer { saving = false }
        do {
            try await API.raw("PUT", "/api/v1/etfs", body: p)
            done(true)
        } catch {
            SessionStore.shared.handle(error)
            self.error = error.localizedDescription
        }
    }
}

// MARK: - 下月展望

struct OutlookView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dynamicTypeSize) private var dts
    @State private var state: LoadState<OutlookPage> = .idle

    var body: some View {
        Loadable(state: state, retry: load) { p in content(p) }
            .navigationTitle("下月展望")
            .task { if state.value == nil { await load() } }
    }

    private func load() async {
        state = .loading(state.value)
        do {
            state = .loaded(try await API.get("/api/v1/outlook"))
        } catch {
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    private func content(_ p: OutlookPage) -> some View {
        let minN = p.minN ?? 30
        return List {
            Text("以美元計、不含股息的 S&P 500 價格指數；台幣結果另受匯率影響").font(.caption).foregroundStyle(.secondary).noticeRow()
            if let o = p.outlook {
                Text("資料日 \(Fmt.fullDate(o.asOf))").font(.footnote).foregroundStyle(.secondary).noticeRow()
                if let d = o.drawdown {
                    Section("下跌風險") {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("期間內收盤跌 5% 以上的機率")
                                .font(.headline)
                            ProbabilityComparison(probability: d.pick.p, baseline: d.pick.base.p)
                            if let frequency = p.frequency?.dd5 { Text("\(frequency)。").font(.body) }
                            if !d.scored {
                                Text("未通過驗證，只供參考").font(.subheadline.weight(.semibold)).foregroundStyle(.orange)
                            }
                            Text("定義：\(Copy.dd5Definition(horizon: p.horizon))").font(.footnote).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 6)
                    }
                }
                Section("上漲展望") {
                        VStack(alignment: .leading, spacing: 16) {
                        Text("約 \(p.horizon) 個交易日後的上漲機率").font(.headline)
                        ProbabilityComparison(probability: o.pick.p, baseline: o.pick.base.p)
                        CallBadge(call: o.call)
                        Text("目標：\(Copy.upTargetLabel(horizon: p.horizon))。" ).font(.footnote).foregroundStyle(.secondary)
                        Text(Self.callWhy[o.call] ?? Self.callWhy["inconclusive"]!).font(.body)
                        if let caveat = o.globalCaveat, !caveat.isEmpty {
                            Notice(kind: .info, text: caveat)
                                .accessibilityIdentifier("outlook-global-caveat")
                        }
                        if let frequency = p.frequency?.up { Text("\(frequency)。").font(.body) }
                        Text("對每月定期定額：這不是加碼或停扣的訊號，它描述下個月可能的波動。").font(.footnote.weight(.semibold))
                    }
                    .padding(.vertical, 6)
                    DisclosureGroup("機率與模型說明") {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(intervalText(o.pick))
                                .accessibilityIdentifier("outlook-interval")
                            if let q = o.returnQuantiles?.cell { quantileText(q, all: o.returnQuantiles?.all, horizon: p.horizon) }
                            if let a = o.assessments { assessmentRows(a) }
                            ForEach(o.reasons, id: \.self) { Text($0) }
                            if let h = o.historyStart { LabeledContent("樣本起點", value: h) }
                            if let v = o.modelVersion { LabeledContent("模型版本", value: v) }
                            LabeledContent("S&P 500 vs 200 日線") {
                                VStack(alignment: .trailing, spacing: 2) {
                                    Delta(value: o.sma200.map { (o.close / $0 - 1) * 100 }, digits: 2, percent: true)
                                    let side = o.regime.map { $0.aboveSma200 ? "站上" : "跌破" } ?? (o.sma200.map { o.close >= $0 ? "站上" : "跌破" } ?? "—")
                                    Text("\(side) · 均線 \(Fmt.num(o.sma200, 0))")
                                }
                            }
                            LabeledContent("VIX") {
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(Fmt.num(o.vix)).monospacedDigit()
                                    if let r = o.regime { Text(r.vixStress ? "≥ 30（恐慌區）" : "< 30（非恐慌區）") }
                                }
                            }
                        }
                        .font(.footnote)
                        .lineSpacing(4)
                        .padding(.top, 8)
                    }
                }

                Section {
                    ForEach(p.cells) { c in cellRow(c, isBase: c.id == p.cells.first?.id, minN: minN, minEpisodes: p.minEpisodes) }
                    DisclosureGroup("如何閱讀這張表") {
                    if let me = p.minEpisodes {
                        Text("樣本內：這張表用全部歷史算出，同一批資料也用來挑條件，只描述過去、不代表預測力（預測力看下面的滾動驗證與上線後紀錄）。重疊的 \(p.horizon) 日窗口不是獨立樣本，有效樣本以「天數 ÷ \(p.horizon)」計；有效樣本少於 \(minN)、或條件成立的日子分成不到 \(me) 段（段與段相隔至少 \(p.horizon) 個交易日）的條件不採用，標為「樣本不足」（灰字）；基準率不受此限。")
                    } else {
                        Text("重疊的 \(p.horizon) 日窗口不是獨立樣本，有效樣本以天數 ÷ \(p.horizon) 計；有效樣本少於 \(minN) 的條件不採用（灰字）。")
                    }
                    }
                    .font(.footnote).foregroundStyle(.secondary)
                } header: {
                    Text(p.minEpisodes == nil ? "各條件下的歷史上漲比例" : "樣本內：各條件下的歷史上漲比例")
                }
                // Two targets, two labelled blocks: o.evaluation is the up model, drawdown.evaluation is dd5.
                if let ev = o.drawdown?.evaluation {
                    evaluationSection(ev, horizon: p.horizon, title: "滾動驗證：跌幅機率（dd5）",
                                      target: "目標：\(Copy.dd5Definition(horizon: p.horizon))。", showHitRate: false)
                }
                if let ev = o.evaluation {
                    evaluationSection(ev, horizon: p.horizon, title: "滾動驗證：上漲機率",
                                      target: "目標：\(Copy.upTargetLabel(horizon: p.horizon))。", showHitRate: true)
                }
                forecastSection(p)
            } else {
                Text("資料不足，還無法產生展望。").foregroundStyle(.secondary)
            }

            Section("機構觀點（背景資訊，不放進上面的機率）") {
                DisclosureGroup("如何看待機構目標") {
                    Text("研究顯示分析師目標價系統性偏樂觀，策略師年底目標與實際報酬幾乎沒有相關；這裡列出來是讓你知道市場共識在哪，而不是當漲跌訊號。")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            if let f = p.factset.first { factsetSection(f) }
            if let c = p.consensus { consensusSection(c) }
            if let s = p.strategists { strategistSection(s) }
        }
        .listStyle(.insetGrouped)
        .lineSpacing(3)
        .refreshable { await load() }
    }

    private static let callWhy = [
        "up": "目前條件下的上漲機率明顯高於歷史基準（平常），且滾動驗證勝過基準",
        "down": "目前條件下的上漲機率明顯低於歷史基準（平常），且滾動驗證勝過基準",
        "inconclusive": "目前的訊號不足以把機率拉離歷史基準",
    ]

    // D-04: keep the two kinds of "95% interval" apart (same wording as web/src/lib/communication.ts).
    private static let proportionInterval = "這類時期的歷史比例 95% 區間"
    private static let skillInterval = "歷史平均預測力 95% 區間（不是今天這個數字的區間）"

    private static let basisLabels = [
        "base": "歷史基準率",
        "trend": "200 日線條件",
        "vix": "VIX 條件",
        "trend+vix": "200 日線 × VIX 條件",
        "vrp": "VIX 與已實現波動差條件",
        "season": "季節條件",
        "trend+vrp": "200 日線 × VIX 與已實現波動差條件",
    ]

    /// 0.594 → 「59%」（跟網頁的 pct() 一樣取整數）
    private func ratio(_ v: Double?) -> String { Fmt.plainPct(v.map { $0 * 100 }, 0) }

    private func intervalText(_ pick: OutlookPage.Outlook.Pick) -> String {
        let basis = Self.basisLabels[pick.basis] ?? pick.basis
        if let w = pick.shrinkWeight, w > 0, let cond = pick.conditional {
            return "收縮後 \(Fmt.plainPct(pick.p * 100, 1))（基準 \(Fmt.plainPct(pick.base.p * 100, 1))、條件 \(Fmt.plainPct(cond.p * 100, 1))、權重 \(String(format: "%.2f", w))）· 依據：\(basis)"
        }
        if let cond = pick.conditional, pick.distinct != true {
            return "尚未偵測到增額預測力，採歷史基準率（\(Self.proportionInterval) \(ratio(pick.base.low))～\(ratio(pick.base.high))）；「\(basis)」下的歷史比例為 \(Fmt.plainPct(cond.p * 100))，區間 \(ratio(cond.low))～\(ratio(cond.high)) 包含基準率"
        }
        let low = pick.conditional?.low ?? pick.base.low
        let high = pick.conditional?.high ?? pick.base.high
        return "\(Self.proportionInterval) \(ratio(low))～\(ratio(high)) · 依據：\(basis)"
    }

    private func f3(_ v: Double?) -> String { Fmt.num(v, 3) }

    private func quantileText(_ q: OutlookPage.Outlook.Quantiles, all: OutlookPage.Outlook.Quantiles?, horizon: Int) -> some View {
        func r(_ v: Double) -> String { String(format: "%+.1f%%", v * 100) }
        var meta = "描述統計，不計分"
        if let n = q.n { meta = "\(n) 個交易日；" + meta }
        if let a = all { meta += "；不分條件：\(r(a.p10))／\(r(a.p50))／\(r(a.p90))" }
        return VStack(alignment: .leading, spacing: 2) {
            Text("過去類似情況 \(horizon) 個交易日報酬：10% 機率低於 \(r(q.p10))、一半低於 \(r(q.p50))、90% 低於 \(r(q.p90))").font(.footnote)
            Text("（\(meta)）").font(.caption).foregroundStyle(.secondary)
        }
    }

    /// 四個固定評估項（與 call 同一份資料）。
    @ViewBuilder
    private func assessmentRows(_ a: OutlookPage.Outlook.Assessments) -> some View {
        if let d = a.difference {
            assessmentRow("差異", d.status,
                "條件 \(Fmt.plainPct(d.condP.map { $0 * 100 }, 1)) vs 平常 \(Fmt.plainPct(d.baseP.map { $0 * 100 }, 1))",
                d.low == nil ? "沒有可用的條件" : "\(Self.proportionInterval) \(ratio(d.low))～\(ratio(d.high))")
        }
        if let s = a.sampleAdequacy {
            assessmentRow("樣本", s.status,
                s.nEff == nil ? "沒有可用的條件" : "有效樣本 \(Int((s.nEff ?? 0).rounded()))、\(s.episodes ?? 0) 段",
                "驗證 \(s.rows ?? 0) 列、\(s.runs ?? 0) 段")
        }
        if let t = a.trackRecord {
            assessmentRow("紀錄", t.status,
                "此條件 BSS 下界 \(f3(t.cellBssLow))（最小可偵測 \(f3(t.cellMde))）",
                "上漲模型整體 BSS \(f3(t.globalBss))")
        }
        if let f = a.dataFreshness {
            assessmentRow("資料新鮮度", f.status,
                "SPX \(f.spxDate ?? "—")、VIX \(f.vixDate ?? "—")",
                f.staleSessions.map { "VIX 落後 \($0) 個交易日" } ?? "—")
        }
    }

    private func assessmentRow(_ name: String, _ status: String, _ line1: String, _ line2: String) -> some View {
        let (text, color): (String, Color) = switch status {
        case "pass": ("通過", .down)
        case "fail": ("未通過", .up)
        default: ("不適用", .secondary)
        }
        return VStack(alignment: .leading, spacing: 5) {
            HStack {
            Text(name).font(.subheadline.weight(.semibold))
            Text(text)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(color.opacity(0.12), in: Capsule())
                .foregroundStyle(color)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(line1).font(.footnote)
                Text(line2).font(.caption).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// One walk-forward block per target. Hit-rate rows only make sense for the up model ("always guess up").
    private func evaluationSection(_ ev: OutlookPage.Outlook.Evaluation, horizon: Int, title: String, target: String, showHitRate: Bool) -> some View {
        Section {
            DisclosureGroup(title) {
            Text("\(target)\(ev.firstDate.map(Fmt.fullDate) ?? "—")～\(ev.lastDate.map(Fmt.fullDate) ?? "—")，每 \(horizon) 個交易日預測一次（共 \(ev.points) 次）")
                .font(.footnote).foregroundStyle(.secondary)
            if showHitRate {
                LabeledContent("預測方向命中率", value: Fmt.plainPct(ev.hitRate.map { $0 * 100 }))
                LabeledContent("永遠猜上漲的命中率", value: Fmt.plainPct(ev.baseHitRate.map { $0 * 100 }))
            }
            LabeledContent("Brier（越低越好）", value: Fmt.num(ev.brier, 4))
            LabeledContent("只用基準率的 Brier", value: Fmt.num(ev.brierBase, 4))
            LabeledContent("BSS") {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(Fmt.num(ev.bss, 3)).monospacedDigit()
                Text("\(Self.skillInterval) \(Fmt.num(ev.bssLow, 3))～\(Fmt.num(ev.bssHigh, 3))").font(.footnote).foregroundStyle(.secondary)
                        .multilineTextAlignment(.trailing)
                }
            }
            if let mde = ev.mde { LabeledContent("最小可偵測 BSS", value: Fmt.num(mde, 2)) }
            Text("BSS = 1 − Brier ÷ 基準 Brier；區間下限 > 0 才代表穩定勝過基準率")
                .font(.footnote).foregroundStyle(.secondary)
                .accessibilityIdentifier(showHitRate ? "outlook-validation-up-details" : "outlook-validation-dd5-details")
            }
        }
    }

    private func forecastSection(_ p: OutlookPage) -> some View {
        Section {
            if let lt = p.liveTrack {
                if lt.n == 0 {
                    Text("每天收盤後記錄一次，\(p.horizon) 個交易日後才能對帳；目前還沒有到期的預測。")
                        .font(.footnote).foregroundStyle(.secondary)
                } else if lt.tooFew {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("樣本太少")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(Color.orange.opacity(0.12), in: Capsule())
                            .foregroundStyle(Color.orange)
                        Text("只有 \(lt.n) 個獨立月份（少於 12），不報分數。只取不重疊的列：從第一筆紀錄起每 \(p.horizon) 個交易日一列。")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                } else {
                    Text("BSS \(Fmt.num(lt.bss, 3))（對照紀錄當時存下的基準率）· n = \(lt.n) 個獨立月份 · 實際上漲 \(Fmt.plainPct(lt.upShare.map { $0 * 100 }))。只取不重疊的列，與上面兩種分數分開看。")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            } else if let t = p.track {
                LabeledContent("已對帳", value: "\(t.n) 次")
                LabeledContent("Brier（越低越好）", value: "\(Fmt.num(t.brier, 3))（基準 \(Fmt.num(t.brierBase, 3))）")
                LabeledContent("實際上漲比例", value: Fmt.plainPct(t.upShare * 100))
            } else {
                Text("每天收盤後記錄一次，\(p.horizon) 個交易日後才能對帳；目前還沒有到期的預測。")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            ForEach((p.recent ?? []).prefix(8)) { f in
                HStack(spacing: 8) {
                    Text(f.date).monospacedDigit()
                    Text(Fmt.plainPct(f.p * 100)).monospacedDigit()
                    Text(callText(f.call)).foregroundStyle(.secondary)
                    if p.liveTrack != nil {
                        Text(f.modelVersion ?? "舊版紀錄").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let up = f.up {
                        Text(up ? "後來上漲" : "後來下跌").foregroundStyle(up ? Color.up : Color.down)
                    } else {
                        Text("待到期").foregroundStyle(.secondary)
                    }
                }
                .font(.subheadline)
            }
        } header: {
            Text(p.liveTrack == nil ? "實際發出的預測" : "上線後實際紀錄：上漲機率")
        } footer: {
            if p.liveTrack != nil { Text("合併所有已發布的模型版本；每列以紀錄日收盤為起點。這是和樣本內、滾動驗證分開的第三種分數。") }
        }
    }

    /// 60 →「60」、35.2 →「35.2」
    private func short(_ v: Double?) -> String {
        guard let v, v.isFinite else { return "—" }
        return v.formatted(.number.precision(.fractionLength(0...1)))
    }

    private func factsetSection(_ f: OutlookPage.Factset) -> some View {
        Section {
            LabeledContent("由下而上目標") {
                HStack(spacing: 6) {
                    Text(Fmt.num(f.bottomUpTarget, 0)).monospacedDigit()
                    Delta(value: f.upsidePct, digits: 1, percent: true)
                }
            }
            LabeledContent("預估本益比", value: "\(short(f.forwardPE))（5 年 \(short(f.forwardPE5y)) · 10 年 \(short(f.forwardPE10y))）")
            LabeledContent("買進／持有／賣出", value: "\(short(f.buyPct))／\(short(f.holdPct))／\(short(f.sellPct))%")
        } header: {
            Text("FactSet（全部成分股，週報）")
        } footer: {
            Text("\(f.reportDate.map { "\(Fmt.fullDate($0)) 週報。" } ?? "")FactSet 統計：由下而上目標價長期平均高估實際指數。")
        }
    }

    private func consensusSection(_ c: OutlookPage.Consensus) -> some View {
        Section {
            LabeledContent("隱含漲幅") { Delta(value: c.impliedUpsidePct, digits: 1, percent: true) }
            LabeledContent("隱含指數目標", value: Fmt.num(c.impliedIndexTarget, 0))
            LabeledContent("買進評等占比", value: Fmt.plainPct(c.buyPct))
            LabeledContent {
                Delta(value: c.revisionBreadth.map { $0 * 100 }, digits: 0)
            } label: {
                Text("EPS 修正廣度")
                Text("範圍 −100～+100")
            }
            LabeledContent("涵蓋權重", value: "\(c.symbols) 檔 · \(Fmt.plainPct(c.coveredWeightPct))")
            if !c.top.isEmpty {
                DisclosureGroup("權重前 \(c.top.count) 檔") {
                    ForEach(c.top) { t in
                        HStack {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(t.symbol).fontWeight(.semibold)
                                Text("權重 \(Fmt.plainPct(t.weightPct))").font(.caption2).foregroundStyle(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 1) {
                                Text(t.targetMean.map { "目標 \(Fmt.num($0))" } ?? "—").monospacedDigit()
                                Delta(value: t.upsidePct, digits: 1, percent: true).font(.caption)
                            }
                        }
                    }
                }
            }
        } header: {
            Text("成分股分析師共識")
        } footer: {
            Text("依 SPY 權重加權，目標價為 12 個月共識\(c.oldest.flatMap { o in c.newest.map { "（\(o)～\($0) 更新）" } } ?? "")。")
        }
    }

    private func strategistSection(_ s: OutlookPage.Strategists) -> some View {
        // 每列的 horizon 都一樣時（例如全是「2026 年底」）只在標題寫一次，不在每列重複。
        let shared = Set(s.list.compactMap { $0.horizon }.filter { !$0.isEmpty })
        let common = shared.count == 1 ? shared.first : nil
        return Section {
            LabeledContent("中位數", value: "\(Fmt.num(s.median, 0))\(s.medianCount.map { "，\($0) 家" } ?? "")（\(Fmt.pct(s.medianUpsidePct, 1))）")
            if let poll = s.poll {
                LabeledContent("Reuters 民調中位數", value: "\(Fmt.num(poll.median, 0))（\(poll.respondents) 人\(poll.surveyed.map { "，\($0) 調查" } ?? "")）")
            }
            ForEach(s.list) { t in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline) {
                        if let u = t.sourceUrl.flatMap({ URL(string: $0) }) {
                            Link(t.firm, destination: u)
                        } else {
                            Text(t.firm)
                        }
                        Spacer(minLength: 12)
                        Text(Fmt.num(t.target, 0)).bold().monospacedDigit()
                    }
                        let range: String? = t.targetIsMidpoint == true
                            ? t.targetLow.flatMap { lo in t.targetHigh.map { "區間 \(Fmt.num(lo, 0))–\(Fmt.num($0, 0)) 的中點" } }
                            : nil
                        let meta = [range, t.horizon == common ? nil : t.horizon, t.asOf.map { "資料日期 \($0)" }, t.note].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                        if !meta.isEmpty { Text(meta).font(.caption).foregroundStyle(.secondary) }
                        let tags = [
                            t.verified.map { $0 ? "已核對原文" : "媒體轉述，待原文核對" },
                            t.inMedian == false ? "不計入中位數" : nil,
                            t.stale == true ? "待重新核對" : nil,
                        ].compactMap { $0 }
                        if !tags.isEmpty { Text(tags.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary) }
                }
                .padding(.vertical, 4)
            }
        } header: {
            Text(common.map { "策略師目標（\($0)）" } ?? "策略師年底目標")
        } footer: {
            if let rule = s.medianRule {
                Text("\(rule)資料日期超過 \(s.staleAfterDays ?? 45) 天的列標「待重新核對」（維護提醒，不代表數字有誤）。全表\(s.checked.map { " \($0) " } ?? "")核對；標「已核對原文」的列對過機構官方原文，其餘取自新聞轉述。")
            } else {
                Text("人工整理自新聞轉述\(s.checked.map { "（\($0) 核對）" } ?? "")，未必是券商原文。")
            }
        }
    }

    /// 兩行版面：第一行條件名稱（加「目前」標章）與機率，第二行區間與樣本數從左緣開始、滿寬。
    private func cellRow(_ c: OutlookPage.Cell, isBase: Bool, minN: Int, minEpisodes: Int?) -> some View {
        // 基準率列（第一列）不受段數限制；其餘條件有效樣本與段數都要夠。
        let thinEpisodes = minEpisodes.map { m in !isBase && (c.rate?.episodes ?? m) < m } ?? false
        let weak = (c.rate?.nEff ?? 0) < Double(minN) || thinEpisodes
        return VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                // 不讓「VIX ≥ 30」這類門檻在運算子旁斷行；要換行就在「，」之後。
                let label = c.label
                    .replacingOccurrences(of: " < ", with: "\u{00A0}<\u{00A0}")
                    .replacingOccurrences(of: " ≥ ", with: "\u{00A0}≥\u{00A0}")
                    .replacingOccurrences(of: "VIX ", with: "VIX\u{00A0}")
                Text(label).font(.subheadline).fontWeight(c.current ? .semibold : .regular)
                if c.current {
                    Text("目前")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.tint.opacity(0.15), in: Capsule())
                        .foregroundStyle(.tint)
                }
                Spacer(minLength: 8)
                if let r = c.rate {
                    Text(Fmt.plainPct(r.p * 100)).font(.headline.monospacedDigit())
                } else {
                    Text("—")
                }
            }
            if let r = c.rate {
                Text("\(Fmt.plainPct(r.low * 100, 0))–\(Fmt.plainPct(r.high * 100, 0)) · 樣本 \(Int(r.nEff.rounded())) 個月\(r.episodes.map { "／\($0) 段" } ?? "")\(weak ? " · 樣本不足" : "")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(weak || c.rate == nil ? Color.secondary : Color.primary)
        .accessibilityElement(children: .combine)
    }

    private func callText(_ call: String) -> String {
        switch call {
        case "up": "高於平常"
        case "down": "低於平常"
        default: "偵測不到預測力"
        }
    }
}

// MARK: - 推播設定

/// 裝置環境：sandbox 是 Xcode／開發版安裝，其餘是 TestFlight／App Store。
private func envText(_ environment: String) -> String {
    environment == "sandbox" ? "開發版" : "正式版"
}

/// 把伺服器回的推播結果（"ok"、"gone" 或 APNs 錯誤，例如 `apns: HTTP 400 {"reason":"BadDeviceToken"}`）翻成中文。
private func pushResultText(_ raw: String) -> String {
    switch raw {
    case "ok": return "已送出"
    case "gone": return "裝置已失效，已從伺服器移除"
    default: break
    }
    let known: [(reasons: [String], text: String)] = [
        (["BadDeviceToken"], "裝置權杖無效（開發版／正式版環境不符？）"),
        (["DeviceTokenNotForTopic", "TopicDisallowed"], "權杖不屬於這個 App（Bundle ID 不符）"),
        (["Unregistered", "ExpiredToken"], "App 已移除或權杖過期"),
        (["TooManyRequests"], "推播太頻繁，稍後再試"),
        (["ExpiredProviderToken", "InvalidProviderToken", "MissingProviderToken"], "伺服器 APNs 金鑰設定有誤"),
    ]
    let reason = raw.firstMatch(of: #/"reason"\s*:\s*"(\w+)"/#).map { String($0.output.1) }
    if let reason, let hit = known.first(where: { $0.reasons.contains(reason) }) { return hit.text }
    if reason == nil, let hit = known.first(where: { $0.reasons.contains(where: { raw.contains($0) }) }) { return hit.text }
    if raw.firstMatch(of: #/HTTP 5\d\d/#) != nil { return "Apple 推播服務暫時無法使用" }
    let lower = raw.lowercased()
    if lower.contains("timeout") || lower.contains("aborted") { return "連線逾時" }
    if raw.unicodeScalars.contains(where: { (0x4E00 ... 0x9FFF).contains($0.value) || (0x3400 ... 0x4DBF).contains($0.value) }) { return raw }
    return "送出失敗（\(raw)）"
}

private struct PushPrefsEnvelope: Decodable, Sendable {
    let prefs: PushPrefs
}

struct PushSettingsView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: LoadState<PushStatus> = .idle
    @State private var prefs = PushPrefs(daily: true, moves: true, moveThresholdPct: 5, events: true)
    /// 伺服器上目前存的設定；prefs 跟它不同才需要送出。
    @State private var saved: PushPrefs?
    @State private var saving = false
    @State private var debounce: Task<Void, Never>?
    @State private var saveError: String?
    @State private var testResult: String?
    @State private var testing = false
    @State private var authorization: UNAuthorizationStatusText = .unknown

    var body: some View {
        Loadable(state: state, retry: load) { s in content(s) }
            .navigationTitle("推播設定")
            .task {
                if state.value == nil { await load() }
                authorization = await UNAuthorizationStatusText.current()
            }
            // 從系統設定回來時重新檢查通知權限。
            .onChange(of: scenePhase) { _, p in
                if p == .active { Task { authorization = await UNAuthorizationStatusText.current() } }
            }
            // 裝置向伺服器註冊成功後，重新載入裝置清單（測試推播按鈕才會啟用）。
            .onChange(of: session.deviceRegistrations) { _, _ in Task { await load() } }
    }

    private func load() async {
        state = .loading(state.value)
        do {
            let s: PushStatus = try await API.get("/api/v1/push")
            saved = s.prefs
            prefs = s.prefs
            state = .loaded(s)
        } catch {
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    /// 一次只送一個 PUT；送出期間又有改動，就在這個迴圈裡依序再送，最後一定是最新的值落地。
    private func flush() async {
        guard !saving else { return }
        saving = true
        defer { saving = false }
        while prefs != saved {
            let want = prefs
            do {
                let r: PushPrefsEnvelope = try await API.send("PUT", "/api/v1/push", body: want)
                saved = r.prefs
                saveError = nil
                if prefs == want { prefs = r.prefs }
            } catch {
                session.handle(error)
                saveError = error.localizedDescription
                if let saved { prefs = saved }
                break
            }
        }
    }

    private func test() async {
        testing = true
        defer { testing = false }
        do {
            let r: PushTestResult = try await API.send("POST", "/api/v1/push", body: Empty())
            testResult = r.results.enumerated()
                .map { i, item in "\(envText(item.environment)) 裝置 \(i + 1)：\(pushResultText(item.result))" }
                .joined(separator: "\n")
            await load()
        } catch {
            session.handle(error)
            testResult = error.localizedDescription
        }
    }

    private func content(_ s: PushStatus) -> some View {
        Form {
            if authorization == .denied {
                Section {
                    Notice(kind: .warn, text: "系統設定裡關閉了這個 App 的通知，伺服器送出的推播不會顯示。").noticeRow()
                    Button("打開系統設定") {
                        if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
                    }
                }
            }
            if let e = session.pushError {
                Section {
                    Notice(kind: .bad, text: e).noticeRow()
                    #if DEBUG
                    if let d = session.pushErrorDetail {
                        DisclosureGroup("技術細節") {
                            Text(d).font(.caption.monospaced()).foregroundStyle(.secondary).textSelection(.enabled)
                        }
                    }
                    #endif
                }
            }
            Section {
                Toggle("每日收盤摘要", isOn: $prefs.daily)
                Toggle("名單個股大漲大跌", isOn: $prefs.moves)
                if prefs.moves {
                    Stepper(value: $prefs.moveThresholdPct, in: 1 ... 50, step: 0.5) {
                        LabeledContent("門檻", value: "±\(Fmt.num(prefs.moveThresholdPct, 1))%")
                    }
                }
                Toggle("財報與總經事件當天提醒", isOn: $prefs.events)
            } header: {
                HStack {
                    Text("通知內容")
                    if saving { Spacer(); ProgressView().controlSize(.mini) }
                }
            } footer: {
                Text("收盤摘要與大漲大跌在台灣時間清晨 5:40 左右發（美股收盤後）；事件提醒在美東早上（台灣晚上 7:30）發，總經事件指 FOMC、CPI、非農。設定套用到這個帳號的所有裝置。")
            }
            .onChange(of: prefs) { _, new in
                guard new != saved else { return }
                debounce?.cancel()
                debounce = Task {
                    try? await Task.sleep(for: .milliseconds(400))
                    guard !Task.isCancelled else { return }
                    await flush()
                }
            }
            if let saveError { Section { Notice(kind: .bad, text: "設定沒有存到：\(saveError)").noticeRow() } }

            Section {
                Button {
                    Task { await test() }
                } label: {
                    HStack {
                        Text("送測試推播")
                        if testing { Spacer(); ProgressView() }
                    }
                }
                .disabled(testing || s.devices.isEmpty || !s.configured)
                if let testResult { Text(testResult).font(.footnote).foregroundStyle(.secondary) }
            } footer: {
                // 不能按的原因放在 footer，不另外佔一列。
                if !s.configured {
                    Text("伺服器還沒設定推播金鑰。")
                } else if s.devices.isEmpty {
                    Text(authorization == .denied ? "需要先在系統設定允許通知"
                        : session.pushError != nil ? "這台裝置還沒註冊成功，無法送測試推播"
                        : "需要先註冊這台裝置（允許通知後會自動註冊）")
                }
            }

            Section("已註冊的裝置") {
                if s.devices.isEmpty {
                    Text(session.pushError != nil ? "這台裝置註冊失敗（見上方說明）"
                        : authorization == .allowed ? "註冊中…"
                        : "還沒有裝置。允許通知後會自動註冊。")
                        .foregroundStyle(.secondary)
                }
                ForEach(s.devices) { d in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(envText(d.environment)) \(d.appVersion ?? "")")
                        Text("更新於 \(Fmt.taipeiTime(d.updatedAt))").font(.caption).foregroundStyle(.secondary)
                        if let e = d.lastError { Text("上次失敗：\(pushResultText(e))").font(.caption).foregroundStyle(Color.up) }
                    }
                }
            }
        }
    }
}

enum UNAuthorizationStatusText: Sendable {
    case unknown, allowed, denied

    static func current() async -> Self {
        let s = await UNUserNotificationCenter.current().notificationSettings()
        switch s.authorizationStatus {
        case .denied: return .denied
        case .authorized, .provisional, .ephemeral: return .allowed
        default: return .unknown
        }
    }
}

// MARK: - 帳號

struct AccountView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.authorizationController) private var authorizationController
    @State private var confirmDelete = false
    @State private var error: String?
    @State private var busy = false
    #if DEBUG
    @AppStorage(Backend.baseURLKey) private var debugBaseURL = ""
    #endif

    var body: some View {
        Form {
            if let me = session.me {
                Section("登入身分") {
                    LabeledContent("Email", value: me.email)
                    if me.isOwner { LabeledContent("角色", value: "站長") }
                }
            }
            Section {
                Button("登出") { Task { await session.signOut() } }
                if let e = session.signOutError { Notice(kind: .bad, text: e).noticeRow() }
            }
            // 站長帳號伺服器一律拒絕刪除（403），不顯示這個按鈕。
            if session.me?.isOwner != true {
                Section {
                    Button("刪除帳號", role: .destructive) { confirmDelete = true }
                        .disabled(busy)
                    if let error { Notice(kind: .bad, text: error).noticeRow() }
                } footer: {
                    Text(session.me?.hasApple == true
                        ? "刪除後名單、定投規劃、推播設定與登入資料都會移除，無法復原。刪除前會請你用 Apple 確認身分，並撤銷這個 App 的 Apple 登入授權。"
                        : "刪除後名單、定投規劃、推播設定與登入資料都會移除，無法復原。")
                }
            }
            #if DEBUG
            Section {
                TextField(Backend.defaultBaseURL.absoluteString, text: $debugBaseURL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
            } header: {
                Text("伺服器（僅開發版）")
            } footer: {
                VStack(alignment: .leading, spacing: 2) {
                    Text("目前：\(Backend.baseURL.absoluteString)").lineLimit(1).truncationMode(.middle)
                    Text("改完請登出再登入。")
                }
            }
            #endif
            Section {
                LabeledContent("版本", value: "\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?") (\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"))")
            }
        }
        .navigationTitle("帳號")
        .alert("確定要刪除帳號？", isPresented: $confirmDelete) {
            Button("取消", role: .cancel) {}
            Button("刪除帳號", role: .destructive) { Task { await deleteAccount() } }
        } message: {
            Text("這個動作無法復原。")
        }
    }

    /// 只呼叫 DELETE /api/v1/me：伺服器在同一批次裡移除這個帳號的所有裝置，失敗時推播註冊維持原狀。
    private func deleteAccount() async {
        busy = true
        error = nil
        defer { busy = false }
        // 用 Apple 登入的帳號：再跑一次 Apple 授權拿 authorization code，後端用它撤銷 Apple 的 token 後才刪帳號。
        var appleCode: String?
        if session.me?.hasApple == true {
            do {
                appleCode = try await appleAuthorizationCode()
            } catch let err as ASAuthorizationError where err.code == .canceled {
                return
            } catch {
                self.error = "Apple 身分確認失敗：\(error.localizedDescription)"
                return
            }
        }
        struct DeleteBody: Encodable, Sendable { let appleAuthorizationCode: String }
        do {
            try await API.raw("DELETE", "/api/v1/me", body: appleCode.map(DeleteBody.init(appleAuthorizationCode:)))
            session.accountDeleted()
        } catch {
            session.handle(error)
            self.error = error.localizedDescription
        }
    }

    private func appleAuthorizationCode() async throws -> String {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = []
        let result = try await authorizationController.performRequest(request)
        guard case let .appleID(cred) = result,
              let data = cred.authorizationCode,
              let code = String(data: data, encoding: .utf8)
        else { throw APIError.server(status: 0, message: "Apple 沒有回傳授權碼") }
        return code
    }
}
