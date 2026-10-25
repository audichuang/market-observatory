import Foundation
import os

/// 後端的 JSON API（/api/v1/*，跟網頁共用同一份資料）與 Better Auth 的登入端點（/api/auth/*）。
/// 登入狀態是 Better Auth 的 session cookie，放在 HTTPCookieStorage.shared（URLSession 預設就會帶、也會存檔）。
enum APIError: LocalizedError, Sendable {
    case unauthorized
    case server(status: Int, message: String)
    case transport(String)
    /// 細節（coding path）只寫進 os.Logger，不顯示給使用者。
    case decoding

    var errorDescription: String? {
        switch self {
        case .unauthorized: "登入已過期，請重新登入"
        case let .server(status, message): message.isEmpty ? "伺服器錯誤（HTTP \(status)）" : message
        case let .transport(m): "連線失敗：\(m)"
        case .decoding: "伺服器回傳的資料格式和 App 版本不相符，請更新 App 或稍後再試"
        }
    }
}

enum Backend {
    static let defaultBaseURL = URL(string: "https://market-observatory.kzfvvwnwhp.workers.dev")!
    static let baseURLKey = "debugBaseURL"

    /// Debug 版可以在「更多 → 帳號」改成本機或預覽站；正式版固定用正式站。
    static var baseURL: URL {
        #if DEBUG
        if let s = UserDefaults.standard.string(forKey: baseURLKey), let u = URL(string: s), u.scheme != nil { return u }
        #endif
        return defaultBaseURL
    }

    /// Better Auth 要求 POST／PUT／DELETE 帶 Origin（防 CSRF），App 送網站自己的 origin。
    static var origin: String {
        var c = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        c.path = ""
        c.query = nil
        return c.string ?? baseURL.absoluteString
    }
}

struct API: Sendable {
    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always
        // 加入全站沒人追蹤過的公司要抓十年日線，可能要十幾秒。
        config.timeoutIntervalForRequest = 60
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: config)
    }()

    static func get<T: Decodable & Sendable>(_ path: String, query: [String: String?] = [:], as: T.Type = T.self) async throws -> T {
        try await send("GET", path, query: query, body: Optional<Empty>.none)
    }

    static func send<T: Decodable & Sendable, B: Encodable & Sendable>(_ method: String, _ path: String, query: [String: String?] = [:], body: B?) async throws -> T {
        let data = try await raw(method, path, query: query, body: body)
        if T.self == Empty.self { return Empty() as! T }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            logger.error("decode \(String(describing: T.self), privacy: .public) \(path, privacy: .public): \(Self.describe(error), privacy: .public)")
            throw APIError.decoding
        }
    }

    private static let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "MarketObservatory", category: "API")

    /// 解碼失敗的種類與 coding path（例如 `typeMismatch rows.Index 4.drift1y`），只給 log 用。
    private static func describe(_ error: any Error) -> String {
        func path(_ ctx: DecodingError.Context) -> String { ctx.codingPath.map(\.stringValue).joined(separator: ".") }
        switch error {
        case let DecodingError.keyNotFound(key, ctx): return "keyNotFound \(key.stringValue) at \(path(ctx))"
        case let DecodingError.typeMismatch(type, ctx): return "typeMismatch \(type) at \(path(ctx)): \(ctx.debugDescription)"
        case let DecodingError.valueNotFound(type, ctx): return "valueNotFound \(type) at \(path(ctx))"
        case let DecodingError.dataCorrupted(ctx): return "dataCorrupted at \(path(ctx)): \(ctx.debugDescription)"
        default: return String(describing: error)
        }
    }

    @discardableResult
    static func raw<B: Encodable & Sendable>(_ method: String, _ path: String, query: [String: String?] = [:], body: B?) async throws -> Data {
        var comps = URLComponents(url: Backend.baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        let items = query.compactMap { k, v in v.map { URLQueryItem(name: k, value: $0) } }
        if !items.isEmpty { comps.queryItems = items.sorted { $0.name < $1.name } }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if method != "GET" { req.setValue(Backend.origin, forHTTPHeaderField: "Origin") }
        if let body {
            req.httpBody = try JSONEncoder().encode(body)
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        // /api/auth/* 的 401 是登入本身失敗（密碼錯、Apple 權杖驗證失敗…），要顯示 Better Auth 回的原因，不是「登入已過期」。
        if status == 401 && !path.hasPrefix("/api/auth/") { throw APIError.unauthorized }
        guard (200 ..< 300).contains(status) else { throw APIError.server(status: status, message: errorMessage(data)) }
        return data
    }

    /// 後端錯誤是 `{ "error": "..." }`；Better Auth 是 `{ "message": "...", "code": "..." }`；驗證失敗是 `{ "error": "Validation failed", "issues": [...] }`。
    static func errorMessage(_ data: Data) -> String {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return "" }
        if let issues = obj["issues"] as? [[String: Any]],
           let first = (issues.first?["issues"] as? [[String: Any]])?.first?["message"] as? String { return "輸入格式不對：\(first)" }
        if let e = obj["error"] as? String { return e }
        if let m = obj["message"] as? String { return translateAuth(m, code: obj["code"] as? String) }
        return ""
    }

    private static func translateAuth(_ message: String, code: String?) -> String {
        switch code {
        case "INVALID_EMAIL_OR_PASSWORD": "Email 或密碼不正確"
        case "USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": "這個 Email 已經註冊過，請直接登入"
        case "PASSWORD_TOO_SHORT": "密碼至少 8 個字"
        case "INVALID_EMAIL": "Email 格式不正確"
        case "INVALID_TOKEN": "Apple 身分權杖驗證失敗（nonce／audience 不符或已過期）"
        case "USER_EMAIL_NOT_FOUND": "Apple 帳號沒有提供 Email"
        case "FAILED_TO_GET_USER_INFO": "無法取得 Apple 帳號資料"
        case "OAUTH_LINK_ERROR": "無法連結既有帳號"
        default: message
        }
    }

    static func clearCookies() {
        let storage = HTTPCookieStorage.shared
        for c in storage.cookies(for: Backend.baseURL) ?? [] { storage.deleteCookie(c) }
    }
}

struct Empty: Codable, Sendable {}
