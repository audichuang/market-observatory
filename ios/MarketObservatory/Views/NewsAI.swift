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
                .background(Color.newsTone(tone).opacity(0.14), in: Capsule())
                .foregroundStyle(Color.newsTone(tone))
                .lineLimit(1)
                .fixedSize()
        }
    }
}

/// 新聞頁的一則：中文標題為主，英文原文小字。
struct NewsItemRow: View {
    let item: NewsPage.Item
    let titleZh: String?
    let tone: String?
    let category: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let titleZh, !titleZh.isEmpty {
                Text(titleZh).font(.subheadline.weight(.semibold)).foregroundStyle(.primary).multilineTextAlignment(.leading)
                Text(item.title).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.leading).lineLimit(2)
            } else {
                Text(item.title).font(.subheadline).foregroundStyle(.primary).multilineTextAlignment(.leading)
            }
            HStack(spacing: 6) {
                ToneTag(tone: tone)
                if let category, !category.isEmpty {
                    Text(category).font(.caption2).foregroundStyle(.secondary)
                }
                if !item.symbols.isEmpty {
                    Text(item.symbols.replacingOccurrences(of: ",", with: " · ")).font(.caption2.weight(.semibold)).foregroundStyle(.tint)
                }
                Text([item.publisher ?? "Nasdaq", item.publishedAt.map { $0.count == 10 ? Fmt.dateWithWeekday($0) : Fmt.taipeiTime($0) } ?? "日期不明"].joined(separator: " · "))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
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

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        if let titleZh, !titleZh.isEmpty {
                            Text(titleZh).font(.headline)
                        }
                        Text(item.title)
                            .font(titleZh == nil ? .headline : .subheadline)
                            .foregroundStyle(titleZh == nil ? Color.primary : Color.secondary)
                        HStack(spacing: 6) {
                            ToneTag(tone: tone)
                            if let category, !category.isEmpty { Text(category).font(.caption).foregroundStyle(.secondary) }
                            if !item.symbols.isEmpty {
                                Text(item.symbols.replacingOccurrences(of: ",", with: " · ")).font(.caption.weight(.semibold)).foregroundStyle(.tint)
                            }
                        }
                    }
                }
                Section("AI 重點") {
                    if let points, !points.isEmpty {
                        ForEach(Array(points.enumerated()), id: \.offset) { _, p in
                            Label { Text(p).fixedSize(horizontal: false, vertical: true) } icon: {
                                Image(systemName: "circle.fill").font(.system(size: 5)).foregroundStyle(.secondary)
                            }
                            .font(.subheadline)
                        }
                    } else if loading {
                        HStack(spacing: 10) {
                            ProgressView()
                            Text("AI 整理中…").foregroundStyle(.secondary)
                        }
                    } else if let errorText {
                        Text(errorText).font(.subheadline).foregroundStyle(.secondary)
                        Button("再試一次") { Task { await loadPoints() } }
                    }
                }
                Section {
                    if let url = URL(string: item.url) {
                        Button { openURL(url) } label: {
                            Label("開啟原文", systemImage: "safari")
                        }
                    }
                } footer: {
                    Text([item.publisher ?? "Nasdaq", item.publishedAt.map { $0.count == 10 ? Fmt.dateWithWeekday($0) : Fmt.taipeiTime($0) } ?? ""].filter { !$0.isEmpty }.joined(separator: " · "))
                }
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

/// 每日公司重點：一家一列，依名單順序，tone 用漲跌顏色。
struct DigestRow: View {
    let digest: NewsDigest
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(digest.symbol).font(.subheadline.monospaced().weight(.semibold)).foregroundStyle(Color.newsTone(digest.tone))
                if let c = digest.company, !c.isEmpty { Text(c).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
                Spacer(minLength: 4)
                ToneTag(tone: digest.tone)
            }
            Text(digest.summary).font(.subheadline).fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 2)
    }
}
