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
    let scenario: CostScenario?
    let query: CostQuery?
    let apply: (CostQuery) -> Void
    let clear: () -> Void
    @State private var editing = false

    var body: some View {
        Section {
            Button(query == nil ? "設定假設" : "修改假設") { editing = true }
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
        .sheet(isPresented: $editing) {
            CostEditor(query: query ?? CostQuery()) { input in
                editing = false
                apply(input)
            }
        }
    }

    @ViewBuilder
    private func result(_ scenario: CostScenario) -> some View {
        if let buy = scenario.perBuy {
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

struct CostEditor: View {
    let submit: (CostQuery) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query: CostQuery
    @FocusState private var focused: Bool

    init(query: CostQuery, submit: @escaping (CostQuery) -> Void) {
        self.submit = submit
        _query = State(initialValue: query)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("只是試算，不會儲存")
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
                            .focused($focused)
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
            .navigationTitle("設定假設")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("試算") {
                        focused = false
                        submit(query)
                    }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("完成") { focused = false }
                }
            }
        }
    }

    private func numberField(_ label: String, text: Binding<String>, key: String, integer: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).fixedSize(horizontal: false, vertical: true)
            TextField("0", text: text)
                .keyboardType(integer ? .numberPad : .decimalPad)
                .focused($focused)
                .accessibilityLabel(label)
                .accessibilityIdentifier(key)
        }
    }
}
