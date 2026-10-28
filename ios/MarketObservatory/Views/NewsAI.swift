import SwiftUI

// 新聞中文化的共用元件：利多／利空標籤、詳情 sheet、每日重點卡片。
// 翻譯、重點與每日重點都由排程寫好；欄位全部 optional，還沒翻的退回英文原文。

extension Color {
    /// 紅漲綠跌：利多紅、利空綠、其餘灰。
    static func newsTone(_ tone: String?) -> Color {
        switch tone {
        case "positive": .up
        case "negative": .down
        default: .secondary
        }
    }
}

enum NewsText {
    static func toneLabel(_ tone: String?) -> String? {
        switch tone {
        case "positive": "利多"
        case "negative": "利空"
        case "neutral": "中性"
        default: nil
        }
    }
}

struct ToneTag: View {
    let tone: String?
    var body: some View {
        if let label = NewsText.toneLabel(tone) {
            Text(label)
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.newsTone(tone).opacity(0.12), in: Capsule())
                .foregroundStyle(Color.newsTone(tone))
                .lineLimit(1)
                .fixedSize()
        }
    }
}

/// 新聞列（總覽與新聞頁共用）：tone 膠囊＋類別＋代號／中文標題／英文原標題／出處與日期。
/// 還沒翻譯時第二行放英文標題、第三行不顯示；翻譯回來就地替換，列的結構不變。
struct NewsRow: View {
    let titleZh: String?
    let title: String
    let tone: String?
    let category: String?
    let symbols: String
    let publisher: String?
    let publishedAt: String?
    var titleLines = 3

    private var zh: String? { (titleZh?.isEmpty == false) ? titleZh : nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            let meta = metaLine
            if zh != nil && NewsText.toneLabel(tone) != nil || meta != nil {
                HStack(spacing: 6) {
                    if zh != nil { ToneTag(tone: tone) }
                    if let meta { meta }
                }
            }
            Text(zh ?? title).font(.body).foregroundStyle(.primary).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
            if zh != nil {
                Text(title).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Text(sourceLine).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .animation(.default, value: titleZh)
    }

    private var sourceLine: String {
        // published_at 只有日期（yyyy-MM-dd）；萬一帶了時間就換成台北時間。
        [publisher ?? "Nasdaq", publishedAt.map { $0.count == 10 ? Fmt.dateWithWeekday($0) : Fmt.taipeiTime($0) } ?? "日期不明"].joined(separator: " · ")
    }

    private var metaLine: Text? {
        let cat = (zh != nil ? category : nil).flatMap { $0.isEmpty ? nil : $0 }
        let syms = symbols.isEmpty ? nil : symbols.replacingOccurrences(of: ",", with: " · ")
        switch (cat, syms) {
        case let (c?, s?): return Text(c).font(.caption2).foregroundStyle(.secondary) + Text("  ·  ").font(.caption2).foregroundStyle(.secondary) + Text(s).font(.caption2.weight(.semibold)).foregroundStyle(.tint)
        case let (c?, nil): return Text(c).font(.caption2).foregroundStyle(.secondary)
        case let (nil, s?): return Text(s).font(.caption2.weight(.semibold)).foregroundStyle(.tint)
        default: return nil
        }
    }
}

/// 點一則新聞開的 sheet：中文標題、英文原文、重點（排程有寫才有）、開啟原文。
struct NewsDetailSheet: View {
    let item: NewsPage.Item

    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss

    private var zh: String? { (item.titleZh?.isEmpty == false) ? item.titleZh : nil }
    private var tone: String? { item.tone }
    private var category: String? { item.category }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 6) {
                        if zh != nil { ToneTag(tone: tone) }
                        let showCategory = zh != nil && category?.isEmpty == false
                        if showCategory, let category { Text(category).font(.caption2).foregroundStyle(.secondary) }
                        if showCategory && !item.symbols.isEmpty { Text("·").font(.caption2).foregroundStyle(.secondary) }
                        if !item.symbols.isEmpty {
                            Text(item.symbols.replacingOccurrences(of: ",", with: " · ")).font(.caption2.weight(.semibold)).foregroundStyle(.tint)
                        }
                    }
                    Text(zh ?? item.title).font(.title3.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
                    if zh != nil {
                        Text(item.title).font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                    Text([item.publisher ?? "Nasdaq", item.publishedAt.map { $0.count == 10 ? Fmt.dateWithWeekday($0) : Fmt.taipeiTime($0) } ?? ""].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    if let points = item.pointsZh, !points.isEmpty {
                        Text("重點").font(.headline).padding(.top, 4)
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(Array(points.enumerated()), id: \.offset) { _, p in
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Text("•")
                                    Text(p).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                                }
                                .font(.body)
                            }
                        }
                    }

                    if let url = URL(string: item.url) {
                        Button { openURL(url) } label: {
                            Text("開啟原文").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                        .padding(.top, 8)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
            }
            .navigationTitle("新聞")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("完成") { dismiss() } }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}

struct DigestSections {
    let latestDate: String?
    let current: [NewsDigest]
    let earlier: [NewsDigest]
    let title: String

    static func split(_ digests: [NewsDigest], latest: String?) -> DigestSections {
        let date = latest ?? digests.map(\.date).max()
        // An old backend cannot establish which trading day is current.
        guard let latest else {
            return DigestSections(latestDate: date, current: digests, earlier: [], title: "公司重點")
        }
        return DigestSections(
            latestDate: date,
            current: digests.filter { $0.date == latest },
            earlier: digests.filter { $0.date != latest },
            title: "今日重點 · \(Fmt.dateWithWeekday(latest))"
        )
    }
}

/// 每日公司重點：一家一列，列首 3pt tone 色條；點一下在 3 行與全文之間切換。
struct DigestRow: View {
    let digest: NewsDigest
    let expanded: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(alignment: .top, spacing: 10) {
                Capsule().fill(Color.newsTone(digest.tone)).frame(width: 3).frame(maxHeight: .infinity)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(digest.symbol).font(.headline).lineLimit(1).fixedSize(horizontal: true, vertical: false)
                        if let c = digest.company, !c.isEmpty { Text(c).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
                        ToneTag(tone: digest.tone)
                        Spacer(minLength: 4)
                    }
                    Text(Fmt.dateWithWeekday(digest.date))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(digest.summary)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .lineSpacing(4)
                        .lineLimit(expanded ? nil : 3)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("news-digest-\(digest.symbol)")
    }
}
