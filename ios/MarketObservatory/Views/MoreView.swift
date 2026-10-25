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

    var body: some View {
        Loadable(state: state, retry: load) { e in content(e) }
            .navigationTitle("ETF 與定投")
            .toolbar {
                if state.value != nil {
                    Button("規劃") { editing = true }
                }
            }
            .sheet(isPresented: $editing) {
                if let e = state.value {
                    PlanEditor(plan: e.plan, etfs: e.rows.map(\.ticker)) { saved in
                        editing = false
                        if saved { Task { await load() } }
                    }
                }
            }
            .task { if state.value == nil { await load() } }
    }

    private func load() async {
        state = .loading(state.value)
        do {
            state = .loaded(try await API.get("/api/v1/etfs"))
        } catch {
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    private func content(_ e: Etfs) -> some View {
        List {
            Section {
                Picker("期間", selection: $period) {
                    ForEach(e.periods, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.segmented)
                ForEach(e.rows) { r in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(r.ticker).font(.headline)
                                if r.multiple != 1 { Text("\(r.multiple > 0 ? "" : "反向 ")\(Int(abs(r.multiple)))×").font(.caption2.weight(.semibold)).foregroundStyle(.orange) }
                            }
                            Text("\(r.issuer) · 費用 \(Fmt.num(r.netFeePct, 2))%").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            let v = r.returns[period] ?? nil
                            Text(Fmt.pct(v)).foregroundStyle(Color.tone(v)).monospacedDigit()
                            Text("收 \(Fmt.num(r.close))").font(.caption).foregroundStyle(.secondary).monospacedDigit()
                        }
                    }
                }
            } header: {
                Text("報酬（資料到 \(e.asOf)）")
            } footer: {
                Text("槓桿與反向 ETF 每日重設倍數，長期報酬會偏離「指數 × 倍數」。")
            }

            Section {
                if let d = e.dca {
                    LabeledContent("每月投入", value: Fmt.twd(e.sim.monthlyTwd))
                    LabeledContent("投入 \(d.months) 個月", value: Fmt.twd(d.invested))
                    LabeledContent("目前市值") { Text(Fmt.twd(d.value)).bold() }
                    LabeledContent("報酬率") { Delta(value: d.returnPct, percent: true) }
                    LabeledContent("單筆投入對照") { Delta(value: d.lumpSumReturnPct, percent: true) }
                    LabeledContent("最大帳面虧損") { Delta(value: d.maxDrawdownPct, percent: true) }
                    Chart {
                        ForEach(d.path) { p in
                            if let day = Fmt.day(p.date) {
                                LineMark(x: .value("日期", day), y: .value("市值", p.value), series: .value("線", "市值")).foregroundStyle(Color.accentColor)
                                LineMark(x: .value("日期", day), y: .value("投入", p.invested), series: .value("線", "投入")).foregroundStyle(.gray)
                            }
                        }
                    }
                    .frame(height: 180)
                } else {
                    Text("資料不足，無法試算。").foregroundStyle(.secondary)
                }
            } header: {
                Text("\(e.sim.etf) 定投 \(e.sim.years) 年（台幣計價）")
            } footer: {
                Text("每月第一個交易日以收盤價買入，用當天 USD/TWD 換匯；不含配息、手續費與稅。\(e.fxLast.map { "最新匯率 \(Fmt.num($0.close, 3))（\($0.date)）。" } ?? "")")
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
    }
}

private struct PlanEditor: View {
    @State var plan: Plan
    let etfs: [String]
    let done: (Bool) -> Void
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("定投試算") {
                    Picker("ETF", selection: $plan.etf) { ForEach(etfs, id: \.self) { Text($0).tag($0) } }
                    Picker("年數", selection: $plan.years) { ForEach([1, 2, 3, 5], id: \.self) { Text("\($0) 年").tag($0) } }
                    LabeledContent("每月台幣") { TextField("金額", value: $plan.monthlyTwd, format: .number).keyboardType(.numberPad).multilineTextAlignment(.trailing) }
                }
                Section("資金規劃") {
                    LabeledContent("研究預算") { TextField("金額", value: $plan.researchBudgetTwd, format: .number).keyboardType(.numberPad).multilineTextAlignment(.trailing) }
                    LabeledContent("每批投入") { TextField("金額", value: $plan.trancheTwd, format: .number).keyboardType(.numberPad).multilineTextAlignment(.trailing) }
                    LabeledContent("考慮出場漲幅 %") { TextField("%", value: $plan.exitConsiderationPct, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                }
                Section("備註") { TextEditor(text: $plan.notes).frame(minHeight: 100) }
                if let error { Section { Notice(kind: .bad, text: error) } }
            }
            .navigationTitle("我的規劃")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { done(false) } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("儲存") { Task { await save() } }.disabled(saving)
                }
            }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            try await API.raw("PUT", "/api/v1/etfs", body: plan)
            done(true)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - 下月展望

struct OutlookView: View {
    @Environment(SessionStore.self) private var session
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
        List {
            if let o = p.outlook {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("約 \(p.horizon) 個交易日後 S&P 500 較高的機率").font(.subheadline).foregroundStyle(.secondary)
                        Text(Fmt.plainPct(o.pick.p * 100)).font(.system(size: 44, weight: .bold).monospacedDigit())
                        Text("歷史基準率 \(Fmt.plainPct(o.pick.base.p * 100)) · 判讀：\(callText(o.call))").font(.footnote)
                    }
                    .padding(.vertical, 6)
                    LabeledContent("資料日", value: o.asOf)
                    LabeledContent("收盤 / 200 日線", value: "\(Fmt.num(o.close)) / \(Fmt.num(o.sma200))")
                    LabeledContent("VIX", value: Fmt.num(o.vix))
                } footer: {
                    VStack(alignment: .leading, spacing: 4) { ForEach(o.reasons, id: \.self) { Text("・\($0)") } }
                }

                Section("各條件下的歷史上漲比例") {
                    ForEach(p.cells) { c in
                        HStack {
                            Text(c.label).font(.subheadline).fontWeight(c.current ? .semibold : .regular)
                            if c.current { Image(systemName: "checkmark.circle.fill").font(.caption).foregroundStyle(.tint) }
                            Spacer()
                            if let r = c.rate {
                                VStack(alignment: .trailing, spacing: 1) {
                                    Text(Fmt.plainPct(r.p * 100)).monospacedDigit()
                                    Text("\(Fmt.plainPct(r.low * 100, 0))–\(Fmt.plainPct(r.high * 100, 0)) · 樣本 \(Int(r.nEff))").font(.caption2).foregroundStyle(.secondary)
                                }
                            } else {
                                Text("—").foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                if let t = p.track {
                    Section("實際發出的預測對帳") {
                        LabeledContent("已對帳", value: "\(t.n) 次")
                        LabeledContent("Brier（越低越好）", value: "\(Fmt.num(t.brier, 3))（基準 \(Fmt.num(t.brierBase, 3))）")
                        LabeledContent("實際上漲比例", value: Fmt.plainPct(t.upShare * 100))
                    }
                }
            } else {
                Text("資料不足，還無法產生展望。").foregroundStyle(.secondary)
            }
            if let c = p.consensus {
                Section {
                    LabeledContent("隱含漲幅") { Delta(value: c.impliedUpsidePct, digits: 1, percent: true) }
                    LabeledContent("隱含指數目標", value: Fmt.num(c.impliedIndexTarget, 0))
                    LabeledContent("買進評等占比", value: Fmt.plainPct(c.buyPct))
                    LabeledContent("涵蓋權重", value: "\(c.symbols) 檔 · \(Fmt.plainPct(c.coveredWeightPct))")
                } header: {
                    Text("成分股分析師共識")
                }
            }
            if let s = p.strategists {
                Section {
                    LabeledContent("中位數", value: "\(Fmt.num(s.median, 0))（\(Fmt.pct(s.medianUpsidePct, 1))）")
                    ForEach(s.list) { t in
                        LabeledContent(t.firm, value: "\(Fmt.num(t.target, 0))\(t.horizon.map { " · \($0)" } ?? "")")
                    }
                } header: {
                    Text("策略師年底目標")
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
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

struct PushSettingsView: View {
    @Environment(SessionStore.self) private var session
    @State private var state: LoadState<PushStatus> = .idle
    @State private var prefs = PushPrefs(daily: true, moves: true, moveThresholdPct: 5, events: true)
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
    }

    private func load() async {
        state = .loading(state.value)
        do {
            let s: PushStatus = try await API.get("/api/v1/push")
            prefs = s.prefs
            state = .loaded(s)
        } catch {
            session.handle(error)
            state = .failed(error.localizedDescription, state.value)
        }
    }

    private func save() async {
        do {
            try await API.raw("PUT", "/api/v1/push", body: prefs)
            saveError = nil
        } catch {
            saveError = error.localizedDescription
        }
    }

    private func test() async {
        testing = true
        defer { testing = false }
        do {
            let r: PushTestResult = try await API.send("POST", "/api/v1/push", body: Empty())
            testResult = r.results.map { "\($0.environment) \($0.device)…：\($0.result == "ok" ? "已送出" : $0.result)" }.joined(separator: "\n")
            await load()
        } catch {
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
                Text("通知內容")
            } footer: {
                Text("收盤摘要與大漲大跌在美股收盤後約 40 分鐘（台灣清晨）發；事件提醒在美東早上（台灣晚上 7:30）發。設定套用到這個帳號的所有裝置。")
            }
            .onChange(of: prefs) { _, _ in Task { await save() } }
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
                if let testResult { Text(testResult).font(.footnote).foregroundStyle(.secondary) }
                if !s.configured { Text("伺服器還沒設定推播金鑰。").font(.footnote).foregroundStyle(.secondary) }
            }

            Section("已註冊的裝置") {
                if s.devices.isEmpty { Text("還沒有裝置。允許通知後會自動註冊。").foregroundStyle(.secondary) }
                ForEach(s.devices) { d in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(d.environment == "sandbox" ? "開發版" : "正式版") \(d.appVersion ?? "")")
                        Text("更新於 \(Fmt.taipeiTime(d.updatedAt))").font(.caption).foregroundStyle(.secondary)
                        if let e = d.lastError { Text("上次失敗：\(e)").font(.caption).foregroundStyle(Color.up) }
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
            }
            Section {
                Button("刪除帳號", role: .destructive) { confirmDelete = true }
                    .disabled(busy)
                if let error { Notice(kind: .bad, text: error) }
            } footer: {
                Text(session.me?.hasApple == true
                    ? "刪除後名單、定投規劃、推播設定與登入資料都會移除，無法復原。刪除前會請你用 Apple 確認身分，並撤銷這個 App 的 Apple 登入授權。"
                    : "刪除後名單、定投規劃、推播設定與登入資料都會移除，無法復原。")
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
        if let token = session.deviceToken {
            _ = try? await API.raw("DELETE", "/api/v1/devices", body: ["token": token])
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
