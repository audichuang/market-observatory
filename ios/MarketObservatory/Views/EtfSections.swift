import SwiftUI

struct EtfFactsDisclosure: View {
    let row: Etfs.Row
    let catalogAsOf: String?

    var body: some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 6) {
                Text("註冊地：\(row.facts?.domicile ?? "未查核")")
                Text("配息：\(row.facts?.distribution ?? "未查核")")
                Text("ISIN：\(row.facts?.isin ?? "未查核")")
                Text("費用率：\(feeSummary)")
                Text("倍數：\(multipleText)")
                if let facts = row.facts {
                    if let url = URL(string: facts.sourceUrl) {
                        Link(destination: url) {
                            Text("出處：發行商頁面")
                                .foregroundStyle(.tint)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .buttonStyle(.borderless)
                    }
                    Text("\(facts.checkedAt) 查閱")
                } else {
                    Text("出處：未查核")
                }
                Text(row.multiple == 1 ? Copy.evidence1x : Copy.evidenceLeveraged)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(nil)
            .fixedSize(horizontal: false, vertical: true)
        } label: {
            Text("產品資料")
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityIdentifier("etf-facts-\(row.ticker)")
    }

    private var feeSummary: String {
        let checked = "（\(catalogAsOf ?? "未查核") 查核）"
        guard let net = row.netFeePct else { return "—\(checked)" }
        if let gross = row.grossFeePct, gross != net {
            return "淨 \(Fmt.fee(net)) / 總 \(Fmt.fee(gross))\(checked)"
        }
        return "淨／總 \(Fmt.fee(net))\(checked)"
    }

    private var multipleText: String {
        if row.multiple == 1 { return "1x，不每日重設" }
        let multiple = abs(row.multiple).formatted(.number.grouping(.never))
        return "\(row.multiple < 0 ? "反向 " : "")\(multiple)x，每日重設"
    }
}

struct EtfEvidence: View {
    let multiple: Double

    var body: some View {
        if multiple == 1 {
            Text(Copy.evidence1x)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            Notice(kind: .warn, text: Copy.evidenceLeveraged)
                .noticeRow()
        }
    }
}

struct CostQuery: Equatable, Sendable {
    var costCcy = "twd"
    var costFx = "0"
    var costFee = "0"
    var costMinUsd = "0"
    var costFixed = "0"
    var costPromo = ""
    var costYield = "0"
    var costBasis = "nav"
    var costTax = "tw"

    var dictionary: [String: String] {
        var query = [
            "costCcy": costCcy, "costFx": costFx, "costFee": costFee,
            "costMinUsd": costMinUsd, "costFixed": costFixed, "costYield": costYield,
            "costBasis": costBasis, "costTax": costTax,
        ]
        if !costPromo.isEmpty { query["costPromo"] = costPromo }
        return query
    }
}

struct CostScenarioSection: View {
    let etf: String
    let scenario: CostScenario?
    let query: CostQuery?
    let apply: (CostQuery) -> Void
    let clear: () -> Void
    @State private var editing = false

    var body: some View {
        Section {
            Button(query == nil ? "設定假設" : "修改假設") { editing = true }
                .sheet(isPresented: $editing) {
                    CostEditor(query: query ?? CostQuery()) { input in
                        editing = false
                        apply(input)
                    }
                }
            if query != nil {
                Button("清除", role: .destructive, action: clear)
                if let scenario {
                    if let issue = scenario.issue {
                        Notice(kind: .bad, text: issue).noticeRow()
                    } else {
                        result(scenario)
                    }
                }
            }
        } header: {
            Text("成本情境（你的假設）")
        }
    }

    @ViewBuilder
    private func result(_ scenario: CostScenario) -> some View {
        if let buy = scenario.perBuy {
            Text(Copy.costScenarioBasis(etf: etf, amountTwd: buy.amountTwd))
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Text("每次扣款拆解（台幣）").font(.headline)
            CostValueRow(label: "扣款金額", value: Fmt.num(buy.amountTwd))
            CostValueRow(label: "換匯價差", value: Fmt.num(buy.fxSpreadTwd))
            CostValueRow(label: "固定費用", value: Fmt.num(buy.fixedTwd))
            CostValueRow(label: "手續費", value: Fmt.num(buy.commissionTwd))
            CostValueRow(label: "買進金額", value: Fmt.num(buy.investedTwd))
            CostValueRow(label: "交易成本", value: Fmt.num(buy.costTwd))
            CostValueRow(label: "交易成本占扣款金額", value: Fmt.plainPct(buy.costPct, 4))
        }
        if let annual = scenario.annualTxCostTwd {
            CostValueRow(label: "一年交易成本（台幣，每月一次，共 12 次）", value: Fmt.num(annual))
        }
        if let layers = scenario.layers {
            Text("三層年化項目（占持有市值的 %）")
                .font(.headline)
                .fixedSize(horizontal: false, vertical: true)
            Text("各層各自列出，不加總，也不與交易成本相加。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            layer("基金費用", layers.fundExpense)
            layer("基金層預扣", layers.fundWithholding)
            layer("投資人層預扣", layers.investorWithholding)
        }
        if let promo = scenario.promo, let until = promo.until {
            let text = "\(promo.expired == true ? "你填的優惠已過期" : "你填的優惠到期日")：\(until)；費用仍依你填的假設計算。"
            if promo.expired == true {
                Notice(kind: .warn, text: text).noticeRow()
            } else {
                Text(text).font(.caption).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        ForEach(scenario.notes ?? [], id: \.self) { note in
            Text(note).font(.caption).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        ForEach(Array((scenario.sources ?? []).enumerated()), id: \.offset) { _, source in
            VStack(alignment: .leading, spacing: 4) {
                if let address = source.url, let url = URL(string: address) {
                    Link(source.name ?? address, destination: url)
                        .foregroundStyle(.tint)
                        .buttonStyle(.borderless)
                } else if let name = source.name {
                    Text(name)
                }
                Text("來源日期：\(source.sourceDate ?? "未標明")；查閱日：\(source.checkedAt ?? "未查核")")
                    .foregroundStyle(.secondary)
            }
            .font(.caption)
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private func layer(_ label: String, _ layer: CostScenario.Layer?) -> some View {
        if let layer {
            VStack(alignment: .leading, spacing: 4) {
                CostValueRow(label: label, value: layer.pct.map { Fmt.fee($0) } ?? "")
                if let note = layer.note {
                    Text(note).font(.caption).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

private struct CostValueRow: View {
    let label: String
    let value: String
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 12))
        layout {
            Text(label).fixedSize(horizontal: false, vertical: true)
            if !typeSize.isAccessibilitySize { Spacer(minLength: 0) }
            Text(value).monospacedDigit().fixedSize(horizontal: false, vertical: true)
        }
    }
}

// Keep the action in the editor's hierarchy instead of the keyboard toolbar's sheet host.
struct EtfKeyboardBar: View {
    let done: () -> Void

    var body: some View {
        HStack {
            Spacer()
            Button("完成", action: done)
                .buttonStyle(.bordered)
                .frame(minHeight: 44)
                .accessibilityIdentifier("etfKeyboardDone")
        }
        .font(.body)
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
        .background(.bar)
    }
}

struct CostEditor: View {
    let submit: (CostQuery) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query: CostQuery
    @FocusState private var focused: String?

    init(query: CostQuery, submit: @escaping (CostQuery) -> Void) {
        self.submit = submit
        _query = State(initialValue: query)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(Copy.costScenarioNote)
                        .fixedSize(horizontal: false, vertical: true)
                    Picker("扣款幣別", selection: $query.costCcy) {
                        Text("台幣").tag("twd")
                        Text("美元").tag("usd")
                    }
                    numberField("換匯價差 %", text: $query.costFx, key: "costFx")
                    numberField("手續費比例 %", text: $query.costFee, key: "costFee")
                    numberField("最低手續費（美元）", text: $query.costMinUsd, key: "costMinUsd")
                    numberField("每次固定費用（台幣）", text: $query.costFixed, key: "costFixed", integer: true)
                    numberField("假設年配息率 %", text: $query.costYield, key: "costYield")
                    VStack(alignment: .leading, spacing: 6) {
                        Text("優惠到期日").fixedSize(horizontal: false, vertical: true)
                        TextField("YYYY-MM-DD（可不填）", text: $query.costPromo)
                            .keyboardType(.asciiCapable)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focused, equals: "costPromo")
                            .accessibilityLabel("優惠到期日")
                            .accessibilityIdentifier("costPromo")
                    }
                }
                Section {
                    Picker("報酬口徑", selection: $query.costBasis) {
                        Text("基金淨值／總報酬").tag("nav")
                        Text("稅前指數").tag("index")
                    }
                    .pickerStyle(.inline)
                }
                Section {
                    Picker("稅務身分", selection: $query.costTax) {
                        Text("台灣稅務居民、非美國公民且非美國稅務居民")
                            .fixedSize(horizontal: false, vertical: true).tag("tw")
                        Text("其他").tag("other")
                    }
                    .pickerStyle(.inline)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if focused != nil {
                    EtfKeyboardBar { focused = nil }
                }
            }
            .navigationTitle("設定假設")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("試算") {
                        focused = nil
                        submit(query)
                    }
                }
            }
        }
    }

    private func numberField(_ label: String, text: Binding<String>, key: String, integer: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).fixedSize(horizontal: false, vertical: true)
            TextField("0", text: text)
                .keyboardType(integer ? .numberPad : .decimalPad)
                .focused($focused, equals: key)
                .accessibilityLabel(label)
                .accessibilityIdentifier(key)
        }
    }
}

struct TaxChecklistSection: View {
    let checklists: [Checklist]

    var body: some View {
        Section {
            ForEach(checklists) { checklist in
                DisclosureGroup {
                    ForEach(Array(checklist.items.enumerated()), id: \.offset) { index, item in
                        Text("\(index + 1). \(item)")
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let note = checklist.note {
                        Text(note)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Text(checklist.footer)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    ForEach(Array(checklist.sources.enumerated()), id: \.offset) { _, source in
                        VStack(alignment: .leading, spacing: 4) {
                            if let url = URL(string: source.url) {
                                Link(destination: url) {
                                    Text(source.label)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .foregroundStyle(.tint)
                                .buttonStyle(.borderless)
                            }
                            Text("頁面更新日：\(source.updatedAt)；查閱日：\(source.checkedAt)")
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .font(.caption)
                    }
                } label: {
                    Text(checklist.title)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .lineLimit(nil)
                .accessibilityIdentifier("tax-checklist-\(checklist.id)")
            }
        } header: {
            Text("稅務與傳承檢查清單")
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

struct OverlapQuery: Equatable, Sendable {
    var ovEtf = ""
    var ov: [String: String] = [:]

    var dictionary: [String: String] {
        var query: [String: String] = [:]
        let etf = ovEtf.trimmingCharacters(in: .whitespacesAndNewlines)
        if !etf.isEmpty { query["ovEtf"] = etf }
        let direct = ov.keys.sorted().compactMap { key -> String? in
            let amount = ov[key, default: ""].trimmingCharacters(in: .whitespacesAndNewlines)
            guard !amount.isEmpty, Int(amount) != 0 else { return nil }
            return "\(key):\(amount)"
        }.joined(separator: ",")
        if !direct.isEmpty { query["ov"] = direct }
        return query
    }
}

struct OverlapSection: View {
    let overlap: Overlap
    let etf: String
    let query: OverlapQuery?
    let apply: (OverlapQuery) -> Void
    @State private var editing = false

    var body: some View {
        Section {
            ForEach(overlap.notes ?? [], id: \.self) { note in
                Text(note).font(.caption).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let weightsStale = overlap.weightsStale {
                Notice(kind: .warn, text: weightsStale).noticeRow()
            }
            ForEach(Array((overlap.members ?? []).enumerated()), id: \.offset) { _, member in
                VStack(alignment: .leading, spacing: 6) {
                    Text(member.company ?? member.key ?? "—").font(.headline)
                    Text((member.tickers ?? []).joined(separator: "、"))
                        .font(.caption).foregroundStyle(.secondary)
                    CostValueRow(label: "指數權重", value: Fmt.plainPct(overlap.asOf == nil ? nil : member.weightPct, 3))
                    if let outOfIndex = member.outOfIndex, !outOfIndex.isEmpty {
                        Text("不在持股檔的代號：\(outOfIndex.joined(separator: "、"))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
            }
            CostValueRow(label: "名單合計覆蓋", value: Fmt.plainPct(overlap.asOf == nil ? nil : overlap.totalWeight, 3))
            CostValueRow(label: "指數前十大公司合計", value: Fmt.plainPct(overlap.asOf == nil ? nil : overlap.top10CompanyWeight, 3))
            Button("填金額") { editing = true }
                .sheet(isPresented: $editing) {
                    OverlapEditor(etf: etf, members: overlap.members ?? [], query: query ?? OverlapQuery()) { input in
                        editing = false
                        apply(input)
                    }
                }
            if let issue = overlap.issue {
                Notice(kind: .bad, text: issue).noticeRow()
            }
            if overlap.applicable == true, let exposure = overlap.exposure {
                result(exposure)
            }
        } header: {
            Text("與觀察名單的重疊")
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private func result(_ exposure: Overlap.Exposure) -> some View {
        Text("假設曝險（台幣）").font(.headline)
        ForEach(Array((exposure.members ?? []).enumerated()), id: \.offset) { _, member in
            VStack(alignment: .leading, spacing: 6) {
                Text(overlap.members?.first { $0.key == member.key }?.company ?? member.key ?? "—")
                    .font(.headline)
                CostValueRow(label: "經 ETF", value: Fmt.num(member.viaEtfTwd))
                CostValueRow(label: "另外持有", value: Fmt.num(member.directTwd))
                CostValueRow(label: "合計", value: Fmt.num(member.combinedTwd))
                CostValueRow(label: "占你填的總額", value: Fmt.plainPct(member.sharePct, 2))
            }
            .fixedSize(horizontal: false, vertical: true)
        }
        CostValueRow(label: "你填的總額（台幣）", value: Fmt.num(exposure.totalTwd))
        CostValueRow(label: "名單占比", value: Fmt.plainPct(exposure.watchlistSharePct, 2))
        CostValueRow(label: "ETF 中名單以外的金額（台幣）", value: Fmt.num(exposure.otherViaEtfTwd))
    }
}

struct OverlapEditor: View {
    let etf: String
    let members: [Overlap.Member]
    let submit: (OverlapQuery) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query: OverlapQuery
    @FocusState private var focused: String?

    init(etf: String, members: [Overlap.Member], query: OverlapQuery, submit: @escaping (OverlapQuery) -> Void) {
        self.etf = etf
        self.members = members
        self.submit = submit
        let keys = Set(members.compactMap(\.key))
        _query = State(initialValue: OverlapQuery(ovEtf: query.ovEtf, ov: query.ov.filter { keys.contains($0.key) }))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    amountField("\(etf) 金額（台幣）", text: $query.ovEtf, key: "ovEtf")
                }
                ForEach(Array(members.enumerated()), id: \.offset) { _, member in
                    if let key = member.key {
                        Section {
                            amountField("另外持有（台幣）", text: Binding(
                                get: { query.ov[key, default: ""] },
                                set: { query.ov[key] = $0 }
                            ), key: "ov-\(key)", accessibilityLabel: "\(member.company ?? key)（\(key)）另外持有（台幣）")
                        } header: {
                            Text("\(member.company ?? key)（\(key)）")
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if focused != nil {
                    EtfKeyboardBar { focused = nil }
                }
            }
            .navigationTitle("填金額")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("計算") {
                        focused = nil
                        submit(query)
                    }
                }
            }
        }
    }

    private func amountField(_ label: String, text: Binding<String>, key: String, accessibilityLabel: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).fixedSize(horizontal: false, vertical: true)
            TextField("0", text: text)
                .keyboardType(.numberPad)
                .focused($focused, equals: key)
                .accessibilityLabel(accessibilityLabel ?? label)
                .accessibilityIdentifier(key)
        }
    }
}
