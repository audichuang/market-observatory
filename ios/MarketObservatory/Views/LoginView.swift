import AuthenticationServices
import CryptoKit
import SwiftUI

struct LoginView: View {
    @Environment(SessionStore.self) private var session
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false
    @State private var nonce = ""

    enum Mode { case signIn, signUp }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 8) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.system(size: 44, weight: .semibold))
                        .foregroundStyle(.tint)
                    Text("市場觀測室").font(.largeTitle.bold())
                    Text("S&P 500、名單歸因、ETF 與收盤推播").font(.subheadline).foregroundStyle(.secondary)
                }
                .padding(.top, 48)

                SignInWithAppleButton(mode == .signUp ? .signUp : .signIn) { request in
                    nonce = Self.randomNonce()
                    request.requestedScopes = [.email, .fullName]
                    request.nonce = Self.sha256(nonce)
                } onCompletion: { result in
                    Task { await apple(result) }
                }
                .signInWithAppleButtonStyle(.black)
                .frame(height: 50)
                .disabled(busy)

                HStack {
                    VStack { Divider() }
                    Text("或使用 Email").font(.footnote).foregroundStyle(.secondary)
                    VStack { Divider() }
                }

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(12)
                        .background(.quaternary.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
                        .accessibilityIdentifier("email")
                    SecureField(mode == .signUp ? "密碼（至少 8 個字）" : "密碼", text: $password)
                        .textContentType(mode == .signUp ? .newPassword : .password)
                        .padding(12)
                        .background(.quaternary.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
                        .accessibilityIdentifier("password")
                }

                if let error {
                    Notice(kind: .bad, text: error)
                }

                Button {
                    Task { await emailSubmit() }
                } label: {
                    Group {
                        if busy { ProgressView() } else { Text(mode == .signIn ? "登入" : "建立帳號") }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 30)
                }
                .buttonStyle(.borderedProminent)
                .disabled(busy || email.isEmpty || password.count < (mode == .signUp ? 8 : 1))
                .accessibilityIdentifier("submit")

                Button(mode == .signIn ? "還沒有帳號？建立帳號" : "已有帳號，改為登入") {
                    mode = mode == .signIn ? .signUp : .signIn
                    error = nil
                }
                .font(.footnote)

                Text("個人研究用途，非投資建議。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 12)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func emailSubmit() async {
        busy = true
        error = nil
        defer { busy = false }
        struct SignIn: Encodable, Sendable { let email: String; let password: String }
        struct SignUp: Encodable, Sendable { let email: String; let password: String; let name: String }
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        do {
            if mode == .signIn {
                try await API.raw("POST", "/api/auth/sign-in/email", body: SignIn(email: trimmed, password: password))
            } else {
                try await API.raw("POST", "/api/auth/sign-up/email", body: SignUp(email: trimmed, password: password, name: String(trimmed.split(separator: "@").first ?? "")))
            }
            password = ""
            await session.signedIn()
        } catch APIError.unauthorized {
            error = "Email 或密碼不正確"
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func apple(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case let .failure(err):
            if (err as? ASAuthorizationError)?.code == .canceled { return }
            error = "Apple 登入失敗：\(err.localizedDescription)"
        case let .success(auth):
            guard let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = cred.identityToken,
                  let token = String(data: tokenData, encoding: .utf8)
            else {
                error = "Apple 沒有回傳身分權杖"
                return
            }
            busy = true
            defer { busy = false }
            // Apple 只在第一次授權時給姓名（identity token 裡沒有）：有的話一起送，Better Auth 會讀 idToken.user.name。
            struct Name: Encodable, Sendable { let firstName: String; let lastName: String }
            struct AppleUser: Encodable, Sendable { let name: Name; let email: String? }
            struct IdToken: Encodable, Sendable { let token: String; let nonce: String; let user: AppleUser? }
            struct Body: Encodable, Sendable { let provider: String; let idToken: IdToken }
            var user: AppleUser?
            if let n = cred.fullName, n.givenName != nil || n.familyName != nil {
                user = AppleUser(name: Name(firstName: n.givenName ?? "", lastName: n.familyName ?? ""), email: cred.email)
            }
            do {
                try await API.raw("POST", "/api/auth/sign-in/social", body: Body(provider: "apple", idToken: IdToken(token: token, nonce: nonce, user: user)))
                await session.signedIn()
            } catch {
                self.error = "Apple 登入失敗：\(error.localizedDescription)"
            }
        }
    }

    static func randomNonce(length: Int = 32) -> String {
        let chars = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var rng = SystemRandomNumberGenerator()
        return String((0 ..< length).map { _ in chars[Int(rng.next(upperBound: UInt(chars.count)))] })
    }

    static func sha256(_ s: String) -> String {
        SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
