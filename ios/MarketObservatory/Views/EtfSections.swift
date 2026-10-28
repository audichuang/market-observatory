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
