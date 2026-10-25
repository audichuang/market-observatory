import AuthenticationServices
import Charts
import SwiftUI

struct MoreView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink { EtfView() } label: { Label("ETF 與定投試算", systemImage: "chart.pie") }
                    NavigationLink { OutlookView() } label: { Label("下月展望", systemImage: "binoculars") }
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
                }
                Section {
                    Text("個人研究用途，非投資建議。行情來自 Yahoo Finance（主）、Nasdaq 與 Cboe（核對），權重來自 State Street SPY 每日持股；非官方授權資料源，可能延遲或錯誤。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("更多")
        }
    }
}

// MARK: - ETF 與定投

struct EtfView: View {
    @Environment(SessionStore.self) private var session
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
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(r.ticker).font(.headline)
                                if r.multiple != 1 { Text("\(r.multiple > 0 ? "" : "反向 ")\(Int(abs(r.multiple)))×").font(.caption2.weight(.semibold)).foregroundStyle(.orange) }
                            }
                            Text(r.name).font(.caption)
                            Text("\(r.issuer) · 費用\u{00A0}\(Fmt.fee(r.netFeePct)) · AUM\u{00A0}\(Fmt.compactUsd(r.aumUsd))").font(.caption).foregroundStyle(.secondary)
                            if let n = r.note, !n.isEmpty { Text(n).font(.caption2).foregroundStyle(.secondary) }
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            let v = period == "YTD" ? r.ytd : (r.returns[period] ?? nil)
                            Text(Fmt.pct(v)).foregroundStyle(Color.tone(v)).monospacedDigit()
                            Text("收 \(Fmt.num(r.close))").font(.caption).foregroundStyle(.secondary).monospacedDigit()
                            if let drift = r.drift1y {
                                HStack(spacing: 4) {
                                    Text("1Y 偏離").foregroundStyle(.secondary)
                                    Delta(value: drift.drift, digits: 1, percent: true)
                                }
                                .font(.caption)
                            }
                        }
                    }
                }
            } header: {
                Text("報酬（資料到 \(e.asOf)）")
            } footer: {
                Text("報酬為價格報酬，不含配息。「1Y 偏離」是槓桿／反向 ETF 近一年實際報酬減去「倍數 × 指數報酬」；每日重設加上費用，通常為負，持有越久偏離越大。")
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
                if let defaultError { Notice(kind: .bad, text: "沒有存到：\(defaultError)") }
            } header: {
                Text("\(e.sim.etf) 定投 \(e.sim.years) 年（台幣計價）")
            } footer: {
                Text("每月第一個交易日以收盤價買入，用當天 USD/TWD 換匯；不含配息、手續費與稅。改標的、期間或金額只是試算，按「設為我的預設」才會存起來。\(e.fxLast.map { "最新匯率 \(Fmt.num($0.close, 3))（\($0.date)）。" } ?? "")")
            }

            Section("我的規劃") {
                LabeledContent("研究預算", value: Fmt.twd(Double(e.plan.researchBudgetTwd)))
                LabeledContent("每批投入", value: Fmt.twd(Double(e.plan.trancheTwd)))
                LabeledContent("考慮出場的漲幅", value: Fmt.plainPct(e.plan.exitConsiderationPct, 0))
                if !e.plan.notes.isEmpty { Text(e.plan.notes).font(.footnote).foregroundStyle(.secondary) }
            }
        }
        .listStyle(.insetGrouped)
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
                if let error { Section { Notice(kind: .bad, text: error) } }
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
            if let o = p.outlook {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("約 \(p.horizon) 個交易日後 S&P 500 較高的機率").font(.subheadline).foregroundStyle(.secondary)
                        Text(Fmt.plainPct(o.pick.p * 100)).font(.system(size: 44, weight: .bold).monospacedDigit())
                        Text(intervalText(o.pick)).font(.footnote).foregroundStyle(.secondary)
                        Text("歷史基準率 \(Fmt.plainPct(o.pick.base.p * 100)) · 判讀：\(callText(o.call))").font(.footnote)
                    }
                    .padding(.vertical, 6)
                    LabeledContent("資料日", value: o.asOf)
                    LabeledContent("S&P 500 vs 200 日線") {
                        VStack(alignment: .trailing, spacing: 1) {
                            Delta(value: o.sma200.map { (o.close / $0 - 1) * 100 }, digits: 2, percent: true)
                            let side = o.regime.map { $0.aboveSma200 ? "站上" : "跌破" } ?? (o.sma200.map { o.close >= $0 ? "站上" : "跌破" } ?? "—")
                            Text("\(side) · 均線 \(Fmt.num(o.sma200, 0))").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    LabeledContent("VIX") {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(Fmt.num(o.vix)).monospacedDigit()
                            if let r = o.regime {
                                Text(r.vixStress ? "≥ 30（恐慌區）" : "< 30（非恐慌區）").font(.caption2).foregroundStyle(r.vixStress ? Color.orange : .secondary)
                            }
                        }
                    }
                } footer: {
                    // 標題說明已經寫了「看不出差別」時，不再重複同一句理由；項目符號用懸掛縮排。
                    let reasons = o.reasons.filter { !(o.pick.distinct != true && o.pick.conditional != nil && $0.contains("看不出差別")) }
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(reasons, id: \.self) { r in
                            HStack(alignment: .firstTextBaseline, spacing: 2) { Text("・"); Text(r) }
                        }
                    }
                }

                Section {
                    ForEach(p.cells) { c in cellRow(c, minN: minN) }
                } header: {
                    Text("各條件下的歷史上漲比例")
                } footer: {
                    Text("重疊的 \(p.horizon) 日窗口不是獨立樣本，有效樣本以天數 ÷ \(p.horizon) 計；有效樣本少於 \(minN) 的條件不採用（灰字）。")
                }
                if let ev = o.evaluation { evaluationSection(ev, horizon: p.horizon) }
                forecastSection(p)
            } else {
                Text("資料不足，還無法產生展望。").foregroundStyle(.secondary)
            }

            Section {
            } header: {
                Text("機構觀點（背景資訊，不放進上面的機率）")
            } footer: {
                Text("研究顯示分析師目標價系統性偏樂觀，策略師年底目標與實際報酬幾乎沒有相關；這裡列出來是讓你知道市場共識在哪，而不是當漲跌訊號。")
            }
            if let f = p.factset.first { factsetSection(f) }
            if let c = p.consensus { consensusSection(c) }
            if let s = p.strategists { strategistSection(s) }
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
    }

    private static let basisLabels = [
        "base": "歷史基準率",
        "trend": "200 日線條件",
        "vix": "VIX 條件",
        "trend+vix": "200 日線 × VIX 條件",
    ]

    /// 0.594 → 「59%」（跟網頁的 pct() 一樣取整數）
    private func ratio(_ v: Double?) -> String { Fmt.plainPct(v.map { $0 * 100 }, 0) }

    private func intervalText(_ pick: OutlookPage.Outlook.Pick) -> String {
        let basis = Self.basisLabels[pick.basis] ?? pick.basis
        if let cond = pick.conditional, pick.distinct != true {
            return "採歷史基準率（95% 區間 \(ratio(pick.base.low))～\(ratio(pick.base.high))）；「\(basis)」下為 \(Fmt.plainPct(cond.p * 100))，區間 \(ratio(cond.low))～\(ratio(cond.high)) 包含基準率，看不出差別"
        }
        let low = pick.conditional?.low ?? pick.base.low
        let high = pick.conditional?.high ?? pick.base.high
        return "95% 區間 \(ratio(low))～\(ratio(high)) · 依據：\(basis)"
    }

    private func evaluationSection(_ ev: OutlookPage.Outlook.Evaluation, horizon: Int) -> some View {
        Section {
            Text("\(ev.firstDate ?? "—")～\(ev.lastDate ?? "—")，每 \(horizon) 個交易日預測一次（共 \(ev.points) 次）")
                .font(.footnote).foregroundStyle(.secondary)
            LabeledContent("預測方向命中率", value: Fmt.plainPct(ev.hitRate.map { $0 * 100 }))
            LabeledContent("永遠猜上漲的命中率", value: Fmt.plainPct(ev.baseHitRate.map { $0 * 100 }))
            LabeledContent("Brier（越低越好）", value: Fmt.num(ev.brier, 4))
            LabeledContent("只用基準率的 Brier", value: Fmt.num(ev.brierBase, 4))
            LabeledContent("BSS") {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(Fmt.num(ev.bss, 3)).monospacedDigit()
                    Text("95% 區間 \(Fmt.num(ev.bssLow, 3))～\(Fmt.num(ev.bssHigh, 3))").font(.caption2).foregroundStyle(.secondary)
                }
            }
        } header: {
            Text("滾動驗證")
        } footer: {
            Text("BSS = 1 − Brier ÷ 基準 Brier；區間下限 > 0 才代表穩定勝過基準率")
        }
    }

    private func forecastSection(_ p: OutlookPage) -> some View {
        Section("實際發出的預測") {
            if let t = p.track {
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
                    Spacer()
                    if let up = f.up {
                        Text(up ? "後來上漲" : "後來下跌").foregroundStyle(up ? Color.up : Color.down)
                    } else {
                        Text("待到期").foregroundStyle(.secondary)
                    }
                }
                .font(.subheadline)
            }
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
            Text("\(f.reportDate.map { "\($0) 週報。" } ?? "")FactSet 統計：由下而上目標價長期平均高估實際指數。")
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
            LabeledContent("中位數", value: "\(Fmt.num(s.median, 0))（\(Fmt.pct(s.medianUpsidePct, 1))）")
            if let poll = s.poll {
                LabeledContent("Reuters 民調中位數", value: "\(Fmt.num(poll.median, 0))（\(poll.respondents) 人\(poll.surveyed.map { "，\($0)" } ?? "")）")
            }
            ForEach(s.list) { t in
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        if let u = t.sourceUrl.flatMap({ URL(string: $0) }) {
                            Link(t.firm, destination: u)
                        } else {
                            Text(t.firm)
                        }
                        let meta = [t.horizon == common ? nil : t.horizon, t.asOf, t.note].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                        if !meta.isEmpty { Text(meta).font(.caption).foregroundStyle(.secondary) }
                    }
                    Spacer()
                    Text(Fmt.num(t.target, 0)).bold().monospacedDigit()
                }
            }
        } header: {
            Text(common.map { "策略師目標（\($0)）" } ?? "策略師年底目標")
        } footer: {
            Text("人工整理自新聞轉述\(s.checked.map { "（\($0) 核對）" } ?? "")，未必是券商原文。")
        }
    }

    /// 一般字級左右排；無障礙大字級改成上下排，避免條件名稱與信賴區間互相擠壓。
    private func cellRow(_ c: OutlookPage.Cell, minN: Int) -> some View {
        let weak = (c.rate?.nEff ?? 0) < Double(minN)
        let stacked = dts.isAccessibilitySize
        let layout = stacked ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4)) : AnyLayout(HStackLayout())
        return layout {
            HStack(spacing: 6) {
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
            }
            .layoutPriority(1)
            if !stacked { Spacer() }
            if let r = c.rate {
                VStack(alignment: stacked ? .leading : .trailing, spacing: 1) {
                    Text(Fmt.plainPct(r.p * 100)).monospacedDigit()
                    Text("\(Fmt.plainPct(r.low * 100, 0))–\(Fmt.plainPct(r.high * 100, 0)) · 有效樣本 \(Int(r.nEff.rounded())) 個月").font(.caption2).foregroundStyle(.secondary)
                    if weak { Text("樣本不足").font(.caption2).foregroundStyle(.secondary) }
                }
            } else {
                Text("—").foregroundStyle(.secondary)
            }
        }
        .opacity(weak ? 0.45 : 1)
        .accessibilityElement(children: .combine)
    }

    private func callText(_ call: String) -> String {
        switch call {
        case "up": "偏多"
        case "down": "偏空"
        default: "沒有明確方向"
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
                    Notice(kind: .warn, text: "系統設定裡關閉了這個 App 的通知，伺服器送出的推播不會顯示。")
                    Button("打開系統設定") {
                        if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
                    }
                }
            }
            if let e = session.pushError {
                Section { Notice(kind: .bad, text: e) }
            }
            Section {
                Toggle("每日收盤摘要", isOn: $prefs.daily)
                Toggle("名單個股大漲大跌", isOn: $prefs.moves)
                if prefs.moves {
                    Stepper(value: $prefs.moveThresholdPct, in: 1 ... 50, step: 0.5) {
                        LabeledContent("門檻", value: "±\(Fmt.num(prefs.moveThresholdPct, 1))%")
                    }
                }
                Toggle("財報與 FOMC 當天提醒", isOn: $prefs.events)
            } header: {
                HStack {
                    Text("通知內容")
                    if saving { Spacer(); ProgressView().controlSize(.mini) }
                }
            } footer: {
                Text("收盤摘要與大漲大跌在台灣時間清晨 5:40 左右發（美股收盤後）；事件提醒在美東早上（台灣晚上 7:30）發。設定套用到這個帳號的所有裝置。")
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
            if let saveError { Section { Notice(kind: .bad, text: "設定沒有存到：\(saveError)") } }

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
                if s.configured && s.devices.isEmpty {
                    Text(authorization == .denied ? "需要先在系統設定允許通知"
                        : session.pushError != nil ? "這台裝置還沒註冊成功，無法送測試推播"
                        : "需要先註冊這台裝置（允許通知後會自動註冊）")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                if let testResult { Text(testResult).font(.footnote).foregroundStyle(.secondary) }
                if !s.configured { Text("伺服器還沒設定推播金鑰。").font(.footnote).foregroundStyle(.secondary) }
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
                if let e = session.signOutError { Notice(kind: .bad, text: e) }
            }
            // 站長帳號伺服器一律拒絕刪除（403），不顯示這個按鈕。
            if session.me?.isOwner != true {
                Section {
                    Button("刪除帳號", role: .destructive) { confirmDelete = true }
                        .disabled(busy)
                    if let error { Notice(kind: .bad, text: error) }
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
                Text("目前：\(Backend.baseURL.absoluteString)。改完請登出再登入。")
            }
            #endif
            Section {
                LabeledContent("版本", value: "\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?") (\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"))")
            }
        }
        .navigationTitle("帳號")
        .confirmationDialog("確定要刪除帳號？", isPresented: $confirmDelete, titleVisibility: .visible) {
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
