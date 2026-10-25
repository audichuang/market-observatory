import SwiftUI

struct NewsView: View {
    @Environment(SessionStore.self) private var session
    @State private var state: LoadState<NewsPage> = .idle
    @State private var symbol: String?
    @State private var section = 0
    /// 月曆上選取的日子（"YYYY-MM-DD"）；nil 時用今天
    @State private var calendarDay: String?
    // 新聞中文化：翻譯結果就地蓋在原本的列上，不重抓整頁。
    @State private var translations: [String: NewsTranslation] = [:]
    @State private var requested: Set<String> = []
    @State private var pending: [String] = []
    @State private var flushTask: Task<Void, Never>?
    @State private var aiNotice: String?
    @State private var aiDisabled = false
    @State private var pointsCache: [String: [String]] = [:]
    @State private var selected: NewsPage.Item?
    @State private var generatedDigests: [NewsDigest] = []
    @State private var digestBusy = false
    @State private var digestError: String?
    @Environment(\.openURL) private var openURL
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .subheadline) private var dateWidth: CGFloat = 82

    var body: some View {
        NavigationStack {
            Loadable(state: state, retry: load) { p in content(p) }
                .navigationTitle("新聞與日曆")
        }
        .sheet(item: $selected) { n in
            let tr = translations[n.id]
            NewsDetailSheet(
                item: n,
                titleZh: tr?.titleZh ?? n.titleZh,
                tone: tr?.tone ?? n.tone,
                category: tr?.category ?? n.category,
                cachedPoints: pointsCache[n.id] ?? n.pointsZh,
                onPoints: { id, pts in pointsCache[id] = pts }
            )
        }
        // 換代號時 SwiftUI 會取消上一個請求，較慢的舊回應不會蓋掉新的。
        .task(id: symbol) {
            // 推播冷啟動：日期在這個畫面建立前就放進 session 了，onChange 收不到。
            if let d = session.newsCalendarDate { openCalendar(d) }
            applySectionRequest()
            if state.value == nil || state.value?.symbol != symbol { await load() }
        }
        .onChange(of: session.newsCalendarDate) { _, new in
            if let d = new { openCalendar(d) }
        }
        .onChange(of: session.newsSectionRequest) { _, _ in applySectionRequest() }
        .onAppear { applySectionRequest() }
    }

    /// 總覽的「完整日曆 →」「全部新聞 →」：不管之前停在哪一段都切過去。
    private func applySectionRequest() {
        guard let s = session.newsSectionRequest else { return }
        section = s
        session.newsSectionRequest = nil
    }

    /// 點事件推播進來：切到日曆、選到推播的那一天（沒帶日期就停在原本選的日子）。
    private func openCalendar(_ date: String) {
        section = 1
        if !date.isEmpty { calendarDay = date }
        session.newsCalendarDate = nil
    }

    private var isLoading: Bool {
        if case .loading = state { true } else { false }
    }

    /// 換代號載入中才淡化列表、顯示中央轉圈；下拉重新整理只用系統的轉圈。
    private var isSwitchingSymbol: Bool { isLoading && state.value?.symbol != symbol }

    private func load() async {
        let requested = symbol
        state = .loading(state.value)
        do {
            let p: NewsPage = try await API.get("/api/v1/news", query: ["symbol": requested])
            guard !Task.isCancelled, requested == symbol else { return }
            state = .loaded(p)
            prepareTranslation(p)
        } catch {
            guard !Task.isCancelled, requested == symbol else { return }
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    private func content(_ p: NewsPage) -> some View {
        List {
            Section {
                Picker("內容", selection: $section) {
                    Text("新聞").tag(0)
                    Text("日曆").tag(1)
                }
                .pickerStyle(.segmented)
                .listRowSeparator(.hidden)
                if section == 0 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            Chip(text: "全部", selected: symbol == nil) { symbol = nil }
                            ForEach(p.keys, id: \.self) { k in
                                Chip(text: k, selected: symbol == k) { symbol = k }
                            }
                        }
                    }
                }
            }
            if section == 0 {
                if symbol == nil { digestSection(p) }
                let important = p.news.filter { isImportant($0) }
                let others = p.news.filter { !isImportant($0) }
                Section {
                    if let aiNotice {
                        Label(aiNotice, systemImage: "info.circle").font(.caption).foregroundStyle(.secondary)
                    }
                    if p.news.isEmpty { Text("還沒有新聞。").foregroundStyle(.secondary) }
                    ForEach(important) { n in newsButton(n) }
                }
                .opacity(isSwitchingSymbol ? 0.4 : 1)
                if !others.isEmpty {
                    Section {
                        DisclosureGroup("其他 \(others.count) 則") {
                            ForEach(others) { n in newsButton(n) }
                        }
                    }
                    .opacity(isSwitchingSymbol ? 0.4 : 1)
                }
            } else {
                calendarSections(p)
            }
        }
        .listStyle(.insetGrouped)
        .overlay { if isSwitchingSymbol && section == 0 { ProgressView() } }
        .refreshable { await load() }
    }

    // MARK: 新聞中文化

    private func isImportant(_ n: NewsPage.Item) -> Bool {
        translations[n.id]?.important ?? n.important ?? true
    }

    private func newsButton(_ n: NewsPage.Item) -> some View {
        let tr = translations[n.id]
        return Button { selected = n } label: {
            NewsItemRow(item: n, titleZh: tr?.titleZh ?? n.titleZh, tone: tr?.tone ?? n.tone, category: tr?.category ?? n.category)
        }
        .buttonStyle(.plain)
        .onAppear { enqueue(n) }
    }

    /// 載入完成：伺服器沒設 AI 或額度用完就不送；否則先替畫面上的前幾則排翻譯。
    private func prepareTranslation(_ p: NewsPage) {
        requested.removeAll()
        aiNotice = NewsText.aiNotice(p.ai)
        aiDisabled = aiNotice != nil
        for n in p.news.filter({ isImportant($0) }).prefix(20) { enqueue(n) }
    }

    /// 列出現在畫面上才排進佇列；300ms 內的合併成一次請求（一次最多 20 則）。
    private func enqueue(_ n: NewsPage.Item) {
        guard !aiDisabled, n.titleZh == nil, translations[n.id] == nil, !requested.contains(n.id) else { return }
        requested.insert(n.id)
        pending.append(n.id)
        flushTask?.cancel()
        flushTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            let batch = Array(pending)
            pending.removeAll()
            // 請求另開 Task，之後的 enqueue 取消計時器時不會連帶取消這次請求。
            for chunk in stride(from: 0, to: batch.count, by: 20).map({ Array(batch[$0 ..< min($0 + 20, batch.count)]) }) {
                Task { await translate(chunk) }
            }
        }
    }

    private struct TranslateBody: Encodable, Sendable { let ids: [String] }

    private func translate(_ ids: [String]) async {
        do {
            let r: NewsTranslateResponse = try await API.send("POST", "/api/v1/news/translate", body: TranslateBody(ids: ids))
            for t in r.items where t.titleZh != nil { translations[t.id] = t }
            if let note = NewsText.aiNotice(r.ai) { aiNotice = note; aiDisabled = true }
        } catch {
            if case APIError.unauthorized = error { session.handle(error) }
            aiNotice = NewsText.aiNotice(error)
            // 額度用完／沒設 key 就別再送了；其他錯誤等下拉重新整理再試。
            if case let APIError.server(status, _) = error, status == 429 || status == 503 { aiDisabled = true }
        }
    }

    @ViewBuilder
    private func digestSection(_ p: NewsPage) -> some View {
        let source = (p.digests?.isEmpty == false) ? (p.digests ?? []) : generatedDigests
        let ds = source.sorted { (p.keys.firstIndex(of: $0.symbol) ?? .max) < (p.keys.firstIndex(of: $1.symbol) ?? .max) }
        Section {
            if ds.isEmpty {
                Button {
                    Task { await generateDigests() }
                } label: {
                    HStack(spacing: 8) {
                        if digestBusy { ProgressView() } else { Image(systemName: "sparkles") }
                        Text(digestBusy ? "AI 整理中…" : "產生今日重點")
                    }
                }
                .disabled(digestBusy)
                if let digestError { Text(digestError).font(.caption).foregroundStyle(.secondary) }
            } else {
                ForEach(ds) { d in DigestRow(digest: d) }
            }
        } header: {
            Text(ds.first.map { "今日重點 · \(Fmt.dateWithWeekday($0.date))" } ?? "今日重點")
        }
    }

    private struct DigestBody: Encodable, Sendable { var date: String? }

    private func generateDigests() async {
        digestBusy = true
        digestError = nil
        defer { digestBusy = false }
        do {
            let r: DigestsResponse = try await API.send("POST", "/api/v1/digests", body: DigestBody())
            generatedDigests = r.digests
            if r.digests.isEmpty { digestError = "今天還沒有名單公司的相關新聞可以整理" }
        } catch {
            if case APIError.unauthorized = error { session.handle(error) }
            digestError = NewsText.aiNotice(error)
        }
    }

    @ViewBuilder
    private func calendarSections(_ p: NewsPage) -> some View {
        let day = calendarDay ?? p.today
        let marks = p.events.reduce(into: [String: DayMarks]()) { acc, e in
            if e.kind == "earnings" { acc[e.date, default: DayMarks()].earnings = true } else { acc[e.date, default: DayMarks()].macro = true }
        }
        // 跟 API 的事件範圍一致：過去 30 天到未來 120 天
        let lower = Fmt.addDays(p.today, -30)
        let upper = Fmt.addDays(p.today, 120)
        Section {
            EventCalendarView(
                marks: marks,
                range: lower...upper,
                today: p.today,
                selected: Binding(get: { day }, set: { calendarDay = $0 })
            )
            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
        } footer: {
            HStack(spacing: 14) {
                legend(Color.up, "總經（FOMC）")
                legend(.blue, "名單公司財報")
            }
        }
        let todays = p.events.filter { $0.date == day }
        Section {
            if todays.isEmpty {
                Text("這天沒有登錄的事件。").foregroundStyle(.secondary)
            }
            ForEach(todays) { e in eventRow(e, showDate: false) }
        } header: {
            Text(dayHeader(day, today: p.today))
        }
        let upcoming = p.events.filter { $0.date >= p.today && $0.date != day }.prefix(5)
        if !upcoming.isEmpty {
            Section("接下來") {
                ForEach(Array(upcoming)) { e in
                    Button { calendarDay = e.date } label: { upcomingRow(e, today: p.today) }
                        .buttonStyle(.plain)
                }
            }
        }
    }

    private func dayHeader(_ day: String, today: String) -> String {
        let base = Fmt.dateWithWeekday(day)
        guard let d = Fmt.daysBetween(today, day) else { return base }
        switch d {
        case 0: return "\(base) · 今天"
        case let n where n > 0: return "\(base) · \(n) 天後"
        default: return "\(base) · \(-d) 天前"
        }
    }

    private func legend(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text)
        }
    }

    /// 「接下來」的精簡列：點了在月曆上選到那天。
    private func upcomingRow(_ e: NewsPage.Event, today: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Circle().fill(e.kind == "earnings" ? Color.blue : Color.up).frame(width: 7, height: 7)
            Text(Fmt.dateWithWeekday(e.date)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary).lineLimit(1).fixedSize()
            if let s = e.symbol { Text(s).font(.subheadline.monospaced().weight(.semibold)).foregroundStyle(Color.accentColor) }
            Text(e.title).font(.subheadline).lineLimit(1)
            Spacer(minLength: 4)
            if let d = Fmt.daysBetween(today, e.date) {
                Text(d == 0 ? "今天" : "\(d) 天後").font(.caption).foregroundStyle(d == 0 ? Color.orange : Color.secondary).lineLimit(1).fixedSize()
            }
        }
        .contentShape(Rectangle())
    }

    private func eventRow(_ e: NewsPage.Event, today: String? = nil, showDate: Bool = true) -> some View {
        let url = e.sourceUrl.flatMap(URL.init(string:))
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 10))
        return Button {
            if let url { openURL(url) }
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                layout {
                    if showDate {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(Fmt.dateWithWeekday(e.date)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                            .lineLimit(1).fixedSize()
                        if let t = today, let d = Fmt.daysBetween(t, e.date) {
                            Text(d == 0 ? "今天" : "\(d) 天後")
                                .font(.caption.weight(d == 0 ? .semibold : .regular))
                                .foregroundStyle(d == 0 ? Color.orange : Color.secondary)
                                .lineLimit(1).fixedSize()
                        }
                    }
                    .frame(minWidth: typeSize.isAccessibilitySize ? nil : dateWidth, alignment: .leading)
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            if let s = e.symbol {
                                Text(s).font(.subheadline.monospaced().weight(.semibold)).foregroundStyle(Color.accentColor)
                            }
                            Text(e.title).font(.subheadline).foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                                .layoutPriority(1)
                        }
                        EventStatusBadge(status: e.status)
                        if let d = e.detail, !d.isEmpty { Text(d).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.leading) }
                    }
                }
                Spacer(minLength: 0)
                if url != nil {
                    Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(Color(.secondaryLabel))
                }
            }
        }
        .disabled(url == nil)
        .accessibilityHint(url != nil ? "開啟來源網頁" : "")
        .contextMenu {
            if let s = e.symbol {
                // 改 symbol 會觸發 .task(id:) 重新載入，不必另外呼叫 load()。
                Button("看 \(s) 新聞", systemImage: "newspaper") { symbol = s; section = 0 }
            }
            if let url {
                Link(destination: url) { Label("開啟來源", systemImage: "safari") }
            }
        }
    }
}

/// 日曆事件的來源狀態，對照網頁 pages/news.tsx 的 STATUS。
private struct EventStatusBadge: View {
    let status: String
    var body: some View {
        let (text, color): (String, Color) = switch status {
        case "confirmed": ("公司已公布", .down)
        case "scheduled": ("官方日程", .down)
        case "estimated": ("Zacks 推估", .orange)
        case "tentative": ("官方暫定", .orange)
        default: (status, .secondary)
        }
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
            .lineLimit(1)
            .fixedSize()
    }
}

private struct Chip: View {
    let text: String
    let selected: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(selected ? Color.accentColor : Color.secondary.opacity(0.12), in: Capsule())
                .foregroundStyle(selected ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
    }
}
