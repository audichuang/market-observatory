import SwiftUI
import UIKit
import UserNotifications

@main
struct MarketObservatoryApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var session = SessionStore.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                // 沒有 Localizable 字串檔時系統會用英文格式化日期（圖表軸上的 Jan、Sep 6）：整個 App 固定用台灣繁中。
                .environment(\.locale, Locale(identifier: "zh_Hant_TW"))
                .task { await session.restore() }
        }
    }
}

enum AppTab: Hashable {
    case overview, history, news, more
}

/// 登入狀態、目前的分頁（推播點進來要切換）與推播註冊。
@MainActor @Observable
final class SessionStore {
    static let shared = SessionStore()

    enum Phase { case checking, signedOut, signedIn(Me) }
    var phase: Phase = .checking
    var tab: AppTab = .overview
    /// 推播帶來的日期（收盤摘要）：總覽切到那一天
    var overviewDate: String?
    /// 推播（事件提醒）點進來：新聞頁切到日曆並清掉
    var newsCalendarDate: String?
    /// 總覽的捷徑要新聞頁停在哪一段（0 新聞、1 日曆）；新聞頁讀到後清掉。
    var newsSectionRequest: Int?
    /// 名單每次增刪成功就加一：總覽與走勢據此重新載入。
    var watchlistRevision = 0
    /// 名單頁點公司要看走勢：走勢頁讀到後切到該標的並清掉。
    var historySymbol: String?
    /// APNs 權杖存在 UserDefaults：離線啟動（停在 checking、還沒拿到新權杖）時登出也能把這台裝置從伺服器拿掉。
    var deviceToken: String? = UserDefaults.standard.string(forKey: SessionStore.deviceTokenKey) {
        didSet { UserDefaults.standard.set(deviceToken, forKey: SessionStore.deviceTokenKey) }
    }
    private static let deviceTokenKey = "apnsDeviceToken"
    /// 只放推播註冊相關的錯誤（推播設定頁會顯示）。
    var pushError: String?
    /// 原始錯誤字串，只在 DEBUG 版填入，推播設定頁收在「技術細節」。
    var pushErrorDetail: String?
    /// 每次裝置向伺服器註冊成功就加一；推播設定頁看到變化就重新載入裝置清單。
    var deviceRegistrations = 0
    /// 啟動時檢查登入失敗（多半是離線）：checking 畫面顯示並提供重試。
    var restoreError: String?
    var isRestoring = false
    /// 登出時沒能通知伺服器（離線或伺服器錯誤）：保留登入狀態並顯示。
    var signOutError: String?

    var me: Me? {
        if case let .signedIn(me) = phase { return me }
        return nil
    }

    func restore() async {
        isRestoring = true
        restoreError = nil
        defer { isRestoring = false }
        do {
            let me: Me = try await API.get("/api/v1/me")
            phase = .signedIn(me)
            signOutError = nil
            pushError = nil
            pushErrorDetail = nil
            await enablePush()
        } catch APIError.unauthorized {
            phase = .signedOut
        } catch {
            // 離線時先當成已登出會很煩：有 session cookie 就停在 checking 讓使用者重試。
            phase = HTTPCookieStorage.shared.cookies(for: Backend.baseURL)?.isEmpty == false ? .checking : .signedOut
            if case .checking = phase { restoreError = error.localizedDescription }
        }
    }

    func signedIn() async {
        await restore()
    }

    /// 任何 API 回 401：回到登入畫面。
    func handle(_ error: Error) {
        if case APIError.unauthorized = error {
            overviewDate = nil
            historySymbol = nil
            phase = .signedOut
        }
    }

    /// 先請伺服器拿掉這台裝置、結束 session，再清 cookie。
    /// 沒連上伺服器（離線、5xx）就不清：不然伺服器上的裝置還掛在這個帳號，登出後還會收到它的推播。
    /// 401 代表 session 已經失效，沒辦法再刪裝置，照樣在本機登出。
    func signOut() async {
        signOutError = nil
        do {
            if let token = deviceToken {
                try await API.raw("DELETE", "/api/v1/devices", body: ["token": token])
            }
            try await API.raw("POST", "/api/auth/sign-out", body: Empty())
        } catch APIError.unauthorized {
            // session 已失效：繼續本機登出
        } catch {
            signOutError = "登出失敗，請連網後再試（\(error.localizedDescription)）"
            return
        }
        finishSignOut()
    }

    func accountDeleted() {
        finishSignOut()
    }

    private func finishSignOut() {
        API.clearCookies()
        tab = .overview
        overviewDate = nil
        historySymbol = nil
        pushError = nil
        pushErrorDetail = nil
        restoreError = nil
        signOutError = nil
        phase = .signedOut
    }

    // MARK: 推播

    func enablePush() async {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        guard granted else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    func register(token: Data) async {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        deviceToken = hex
        guard me != nil else { return }
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        struct Body: Encodable, Sendable { let token: String; let environment: String; let appVersion: String }
        do {
            try await API.raw("POST", "/api/v1/devices", body: Body(token: hex, environment: environment, appVersion: "\(version) (\(build))"))
            pushError = nil
            pushErrorDetail = nil
            deviceRegistrations += 1
        } catch {
            pushError = "推播註冊失敗，請稍後再試"
            #if DEBUG
            pushErrorDetail = error.localizedDescription
            #endif
            handle(error)
        }
    }

    func open(payload: [AnyHashable: Any]) {
        // 登出時沒有分頁可切，日期留著會在下次登入時被套用；checking（冷啟動）照收，登入後才開那一天。
        if case .signedOut = phase { return }
        switch payload["screen"] as? String {
        case "news":
            newsCalendarDate = (payload["date"] as? String) ?? ""
            tab = .news
        case "settings": tab = .more
        case "overview":
            overviewDate = payload["date"] as? String
            tab = .overview
        default: break
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in await SessionStore.shared.register(token: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        let ns = error as NSError
        // 3000：沒有有效的 aps-environment 授權（未簽章版本）；3010：模擬器不支援遠端推播。
        let message = ns.domain == NSCocoaErrorDomain && (ns.code == 3000 || ns.code == 3010)
            ? "這個版本無法註冊推播（模擬器或未簽章版本）"
            : "無法向 Apple 取得推播權杖，請稍後再開一次 App"
        var detail: String?
        #if DEBUG
        detail = "\(ns.domain) \(ns.code): \(ns.localizedDescription)"
        #endif
        let text = message
        let raw = detail
        Task { @MainActor in
            SessionStore.shared.pushError = text
            SessionStore.shared.pushErrorDetail = raw
        }
    }

    // 用 completion handler 版本，不用 async 版本：async 版本由 Swift 在背景執行緒呼叫系統的
    // completion handler，點推播（didReceive）時 UIKit 斷言要在主執行緒而閃退（SIGABRT）。
    // 這裡一律回到主執行緒處理並呼叫 completion handler。

    // App 在前景時也顯示橫幅。
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping @Sendable (UNNotificationPresentationOptions) -> Void
    ) {
        DispatchQueue.main.async { completionHandler([.banner, .list, .sound]) }
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping @Sendable () -> Void
    ) {
        let info = response.notification.request.content.userInfo
        let screen = info["screen"] as? String
        let date = info["date"] as? String
        Task { @MainActor in
            var payload: [AnyHashable: Any] = [:]
            payload["screen"] = screen
            payload["date"] = date
            SessionStore.shared.open(payload: payload)
            completionHandler()
        }
    }
}

struct RootView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        content
            // 從系統設定打開通知後回到 App：重新註冊推播（權限被拒時 enablePush 不會跳詢問）。
            .onChange(of: scenePhase) { _, p in
                if p == .active, session.me != nil { Task { await session.enablePush() } }
            }
    }

    @ViewBuilder private var content: some View {
        @Bindable var session = session
        switch session.phase {
        case .checking:
            VStack(spacing: 16) {
                if session.isRestoring || session.restoreError == nil { ProgressView() }
                if let e = session.restoreError, !session.isRestoring {
                    Text(e).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    Button("重試") { Task { await session.restore() } }
                    Button("改用其他帳號登入") { Task { await session.signOut() } }.font(.footnote)
                    if let s = session.signOutError {
                        Text(s).font(.footnote).foregroundStyle(Color.up).multilineTextAlignment(.center)
                    }
                }
            }
            .padding()
        case .signedOut:
            LoginView()
        case .signedIn:
            TabView(selection: $session.tab) {
                Tab("總覽", systemImage: "chart.bar.xaxis", value: AppTab.overview) { OverviewView() }
                Tab("走勢", systemImage: "chart.xyaxis.line", value: AppTab.history) { HistoryView() }
                Tab("新聞", systemImage: "newspaper", value: AppTab.news) { NewsView() }
                Tab("更多", systemImage: "ellipsis.circle", value: AppTab.more) { MoreView() }
            }
        }
    }
}
