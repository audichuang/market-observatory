import SwiftUI

// 新聞中文化的共用元件：利多／利空標籤、詳情 sheet、每日重點卡片。
// 後端欄位（title_zh、tone…）舊版沒有，全部 optional；沒有時畫面退回英文原文。

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

    /// API 錯誤轉成給使用者看的一行中文：額度用完／沒設 key 用伺服器的說明，其他一律保守說法。
    static func aiNotice(_ error: any Error) -> String {
        if case let APIError.server(status, message) = error, status == 429 || status == 503, !message.isEmpty {
            return message
        }
        return "AI 暫時無法使用，先顯示英文原文"
    }

    static func aiNotice(_ ai: AIStatus?) -> String? {
        guard let ai else { return nil }
        if !ai.enabled { return "伺服器尚未設定 AI，先顯示英文原文" }
        if ai.used >= ai.limit { return "今天的 AI 額度已用完，明天再試" }
        return nil
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
        VStack(alignment: .leading, spacing: 3) {
            let meta = metaLine
            if zh != nil && NewsText.toneLabel(tone) != nil || meta != nil {
                HStack(spacing: 6) {
                    if zh != nil { ToneTag(tone: tone) }
                    if let meta { meta }
                }
            }
            Text(zh ?? title).font(.body).foregroundStyle(.primary).multilineTextAlignment(.leading).lineLimit(titleLines)
            if zh != nil {
                Text(title).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            Text(sourceLine).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
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

/// 點一則新聞開的 sheet：中文標題、英文原文、AI 重點、開啟原文。
struct NewsDetailSheet: View {
    let item: NewsPage.Item
    let titleZh: String?
    let tone: String?
    let category: String?
    /// 這則已經有的重點（頁面資料或之前點開過的）；有就不再呼叫。
    let cachedPoints: [String]?
    let onPoints: (String, [String]) -> Void

    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @Environment(SessionStore.self) private var session
    @State private var points: [String]?
    @State private var loading = false
    @State private var errorText: String?

    private var zh: String? { (titleZh?.isEmpty == false) ? titleZh : nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 6) {
                        if zh != nil { ToneTag(tone: tone) }
                        if let category, !category.isEmpty, zh != nil { Text(category).font(.caption2).foregroundStyle(.secondary) }
                        if !item.symbols.isEmpty {
                            Text(item.symbols.replacingOccurrences(of: ",", with: " · ")).font(.caption2.weight(.semibold)).foregroundStyle(.tint)
                        }
                    }
                    Text(zh ?? item.title).font(.title3.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
                    if zh != nil {
                        Text(item.title).font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                    Text([item.publisher ?? "Nasdaq", item.publishedAt.map { $0.count == 10 ? Fmt.dateWithWeekday($0) : Fmt.taipeiTime($0) } ?? ""].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    HStack(spacing: 6) {
                        Text("AI 重點").font(.headline)
                        Text("AI").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                            .padding(.horizontal, 4)
                            .overlay(Capsule().stroke(Color.secondary.opacity(0.6), lineWidth: 1))
                    }
                    .padding(.top, 4)
                    if let points, !points.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(Array(points.enumerated()), id: \.offset) { _, p in
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Text("•")
                                    Text(p).fixedSize(horizontal: false, vertical: true)
                                }
                                .font(.body)
                            }
                        }
                    } else if loading {
                        HStack(spacing: 8) {
                            ProgressView().controlSize(.small)
                            Text("整理中…").font(.footnote).foregroundStyle(.secondary)
                        }
                    } else if let errorText {
                        Notice(kind: .info, text: errorText)
                        Button("再試一次") { Task { await loadPoints() } }.buttonStyle(.bordered).controlSize(.small)
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
                .padding(16)
            }
            .navigationTitle("新聞")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("完成") { dismiss() } }
            }
            .task {
                if let cachedPoints, !cachedPoints.isEmpty { points = cachedPoints; return }
                await loadPoints()
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private struct NoBody: Encodable, Sendable {}

    private func loadPoints() async {
        loading = true
        errorText = nil
        defer { loading = false }
        do {
            let r: NewsPointsResponse = try await API.send("POST", "/api/v1/news/\(item.id)/points", body: Optional<NoBody>.none)
            guard !Task.isCancelled else { return }
            points = r.points
            onPoints(item.id, r.points)
        } catch {
            guard !Task.isCancelled else { return }
            if case APIError.unauthorized = error { session.handle(error) }
            errorText = NewsText.aiNotice(error)
        }
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
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(digest.symbol).font(.headline)
                        if let c = digest.company, !c.isEmpty { Text(c).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
                        Spacer(minLength: 4)
                    }
                    Text(digest.summary)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(expanded ? nil : 3)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// 就地的 AI 載入列。
struct AILoadingRow: View {
    var body: some View {
        HStack(spacing: 8) {
            ProgressView().controlSize(.small)
            Text("整理中…").font(.footnote).foregroundStyle(.secondary)
        }
    }
}
