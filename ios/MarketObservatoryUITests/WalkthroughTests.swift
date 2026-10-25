import XCTest

/// 在模擬器上走一遍：用 email 登入、逐頁截圖、（另一個測試）刪除帳號。
/// 帳號由執行的人提供：`TEST_RUNNER_MO_EMAIL`、`TEST_RUNNER_MO_PASSWORD`（xcodebuild 會去掉 TEST_RUNNER_ 前綴傳給測試），
/// 截圖寫到 `TEST_RUNNER_MO_SHOTS` 目錄（模擬器跟 Mac 共用檔案系統）。
@MainActor
final class WalkthroughTests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }
    private var shots: URL { URL(fileURLWithPath: env["MO_SHOTS"] ?? NSTemporaryDirectory()) }

    override func setUp() {
        continueAfterFailure = false
    }

    private func snap(_ name: String) {
        try? FileManager.default.createDirectory(at: shots, withIntermediateDirectories: true)
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: shots.appendingPathComponent("\(name).png"))
    }

    private func allowNotificationsIfAsked() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["允許", "Allow"] {
            let b = springboard.buttons[label]
            if b.waitForExistence(timeout: 3) { b.tap(); return }
        }
    }

    private func signInIfNeeded(_ app: XCUIApplication) throws {
        let email = app.textFields["email"]
        if email.waitForExistence(timeout: 8) {
            let address = try XCTUnwrap(env["MO_EMAIL"], "缺 TEST_RUNNER_MO_EMAIL")
            let password = try XCTUnwrap(env["MO_PASSWORD"], "缺 TEST_RUNNER_MO_PASSWORD")
            snap("01-login")
            email.tap()
            email.typeText(address)
            let pw = app.secureTextFields["password"]
            pw.tap()
            pw.typeText(password)
            app.buttons["submit"].tap()
        }
        allowNotificationsIfAsked()
    }

    private func tab(_ app: XCUIApplication, _ name: String) {
        let b = app.tabBars.buttons[name].exists ? app.tabBars.buttons[name] : app.buttons[name]
        b.tap()
    }

    func test1_SignInAndVisitEveryScreen() throws {
        let app = XCUIApplication()
        app.launch()
        try signInIfNeeded(app)
        XCTAssertTrue(app.buttons["總覽"].waitForExistence(timeout: 20), "登入後沒有看到分頁")
        sleep(5)
        snap("02-overview")
        app.swipeUp()
        sleep(1)
        snap("02b-overview-attribution")
        app.swipeUp()
        sleep(1)
        snap("02c-overview-events")

        tab(app, "走勢")
        sleep(6)
        snap("03-history")
        app.swipeUp()
        sleep(1)
        snap("03b-history-compare")
        app.swipeUp()
        sleep(1)
        snap("03c-history-contribution")

        tab(app, "名單")
        sleep(4)
        snap("04-watchlist")
        app.buttons["加入"].tap()
        sleep(2)
        snap("04b-watchlist-add")
        app.buttons["取消"].tap()

        tab(app, "新聞")
        sleep(4)
        snap("05-news")
        app.buttons["日曆"].tap()
        sleep(1)
        snap("05b-calendar")

        tab(app, "更多")
        sleep(1)
        snap("06-more")
        app.buttons["ETF 與定投試算"].tap()
        sleep(5)
        snap("07-etfs")
        app.swipeUp()
        sleep(1)
        snap("07b-dca")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["下月展望"].tap()
        sleep(5)
        snap("08-outlook")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["推播設定"].tap()
        sleep(4)
        snap("09-push")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH '帳號'")).firstMatch.tap()
        sleep(1)
        snap("10-account")
    }

    func test2_DeleteAccount() throws {
        let app = XCUIApplication()
        app.launch()
        try signInIfNeeded(app)
        XCTAssertTrue(app.buttons["更多"].waitForExistence(timeout: 20))
        tab(app, "更多")
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH '帳號'")).firstMatch.tap()
        app.buttons["刪除帳號"].firstMatch.tap()
        let confirm = app.buttons.matching(identifier: "刪除帳號").element(boundBy: 1)
        XCTAssertTrue(confirm.waitForExistence(timeout: 5))
        snap("11-delete-confirm")
        confirm.tap()
        XCTAssertTrue(app.textFields["email"].waitForExistence(timeout: 15), "刪除後應回到登入畫面")
        snap("12-after-delete")
    }
}
