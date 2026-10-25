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
                .task { await session.restore() }
        }
    }
}

enum AppTab: Hashable {
    case overview, history, watchlist, news, more
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
    var deviceToken: String?
    var pushError: String?
    /// 每次裝置向伺服器註冊成功就加一；推播設定頁看到變化就重新載入裝置清單。
    var deviceRegistrations = 0

    var me: Me? {
        if case let .signedIn(me) = phase { return me }
        return nil
    }

    func restore() async {
        do {
            let me: Me = try await API.get("/api/v1/me")
            phase = .signedIn(me)
            await enablePush()
        } catch APIError.unauthorized {
            phase = .signedOut
        } catch {
            // 離線時先當成已登出會很煩：有 session cookie 就停在 checking 讓使用者重試。
            phase = HTTPCookieStorage.shared.cookies(for: Backend.baseURL)?.isEmpty == false ? .checking : .signedOut
            if case .checking = phase { pushError = error.localizedDescription }
        }
    }

    func signedIn() async {
        await restore()
    }

    /// 任何 API 回 401：回到登入畫面。
    func handle(_ error: Error) {
        if case APIError.unauthorized = error { phase = .signedOut }
    }

    func signOut() async {
        if let token = deviceToken {
            _ = try? await API.raw("DELETE", "/api/v1/devices", body: ["token": token])
        }
        _ = try? await API.raw("POST", "/api/auth/sign-out", body: Empty())
        API.clearCookies()
        tab = .overview
        phase = .signedOut
    }

    func accountDeleted() {
        API.clearCookies()
        tab = .overview
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
            deviceRegistrations += 1
        } catch {
            #if DEBUG
            pushError = "推播註冊失敗，請稍後再試\n(\(error.localizedDescription))"
            #else
            pushError = "推播註冊失敗，請稍後再試"
            #endif
            handle(error)
        }
    }

    func open(payload: [AnyHashable: Any]) {
        switch payload["screen"] as? String {
        case "news": tab = .news
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
        var message = ns.domain == NSCocoaErrorDomain && (ns.code == 3000 || ns.code == 3010)
            ? "這個版本無法註冊推播（模擬器或未簽章版本）"
            : "無法向 Apple 取得推播權杖，請稍後再開一次 App"
        #if DEBUG
        message += "\n(\(ns.domain) \(ns.code): \(ns.localizedDescription))"
        #endif
        let text = message
        Task { @MainActor in SessionStore.shared.pushError = text }
    }

    // App 在前景時也顯示橫幅。
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        let screen = info["screen"] as? String
        let date = info["date"] as? String
        await MainActor.run {
            var payload: [AnyHashable: Any] = [:]
            payload["screen"] = screen
            payload["date"] = date
            SessionStore.shared.open(payload: payload)
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
                ProgressView()
                if let e = session.pushError {
                    Text(e).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    Button("重試") { Task { await session.restore() } }
                    Button("改用其他帳號登入") { Task { await session.signOut() } }.font(.footnote)
                }
            }
            .padding()
        case .signedOut:
            LoginView()
        case .signedIn:
            TabView(selection: $session.tab) {
                Tab("總覽", systemImage: "chart.bar.xaxis", value: AppTab.overview) { OverviewView() }
                Tab("走勢", systemImage: "chart.xyaxis.line", value: AppTab.history) { HistoryView() }
                Tab("名單", systemImage: "star", value: AppTab.watchlist) { WatchlistView() }
                Tab("新聞", systemImage: "newspaper", value: AppTab.news) { NewsView() }
                Tab("更多", systemImage: "ellipsis.circle", value: AppTab.more) { MoreView() }
            }
        }
    }
}
