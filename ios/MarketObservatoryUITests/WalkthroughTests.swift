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

    /// 回上一頁：iOS 27 的返回鍵 identifier 是 "BackButton"（label 可能是上一頁標題或空白），
    /// 而且 `navigationBars.buttons.element(boundBy: 0)` 不一定是返回鍵（工具列按鈕可能排前面），
    /// 所以先找返回鍵、再找上一頁標題，最後用左緣滑動。
    private func back(_ app: XCUIApplication, to title: String = "更多") {
        let bar = app.navigationBars
        let candidates = [bar.buttons["BackButton"], bar.buttons[title], app.buttons["BackButton"]]
        if let b = candidates.first(where: { $0.exists && $0.isHittable }) {
            b.tap()
        } else {
            let w = app.windows.firstMatch
            let start = w.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5))
            start.press(forDuration: 0.05, thenDragTo: w.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5)))
        }
        XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 5), "回不到「\(title)」")
    }

    private func open(_ app: XCUIApplication, _ label: String) {
        let b = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", label)).firstMatch
        XCTAssertTrue(b.waitForExistence(timeout: 5), "找不到「\(label)」")
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

        tab(app, "總覽")
        app.buttons["觀察名單"].tap()
        sleep(4)
        snap("04-watchlist")
        app.buttons["加入"].tap()
        sleep(2)
        snap("04b-watchlist-add")
        app.buttons["取消"].tap()
        sleep(1)
        app.buttons["完成"].tap()

        tab(app, "新聞")
        sleep(4)
        snap("05-news")
        app.buttons["日曆"].tap()
        sleep(1)
        snap("05b-calendar")
        // 點月曆上第一個有總經事件（FOMC）的日子，看當天的事件列表
        let macroDay = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "有總經事件")).firstMatch
        if macroDay.waitForExistence(timeout: 3) {
            macroDay.tap()
            sleep(1)
            snap("05c-calendar-day")
        }

        tab(app, "更多")
        sleep(1)
        snap("06-more")
        open(app, "ETF 與定投試算")
        sleep(5)
        snap("07-etfs")
        app.swipeUp()
        sleep(1)
        snap("07b-dca")
        back(app)
        open(app, "下月展望")
        sleep(5)
        snap("08-outlook")
        app.swipeUp()
        sleep(1)
        snap("08b-outlook-more")
        back(app)
        open(app, "推播設定")
        sleep(4)
        snap("09-push")
        app.swipeUp()
        sleep(1)
        snap("09b-push-more")
        back(app)
        open(app, "帳號")
        sleep(2)
        snap("10-account")
        back(app)
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
    // TEMP (not committed): News tab deep dive, round 2
    func test3_NewsDeepDive() throws {
        let app = XCUIApplication()
        app.launch()
        try signInIfNeeded(app)
        XCTAssertTrue(app.buttons["總覽"].waitForExistence(timeout: 20))
        sleep(4)
        snap("r00-overview")
        tab(app, "新聞")
        sleep(5)
        snap("r01-news-top")
        // expand first digest
        let digest = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "AAPL")).firstMatch
        if digest.exists { digest.tap(); sleep(1); snap("r02-digest-expanded") }
        // open a news detail sheet
        let headline = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "沃爾瑪")).firstMatch
        let anyNews = headline.exists ? headline : app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "The Motley Fool")).firstMatch
        if anyNews.exists { anyNews.tap(); sleep(2); snap("r03-news-sheet")
            app.swipeUp(); sleep(1); snap("r04-news-sheet-large")
            if app.buttons["完成"].exists { app.buttons["完成"].tap(); sleep(1) } }
        // calendar while at top
        app.buttons["日曆"].tap(); sleep(2); snap("r05-calendar")
        app.swipeUp(); sleep(1); snap("r06-calendar-scroll")
        app.swipeDown(); app.swipeDown(); sleep(1)
        app.buttons["新聞"].firstMatch.tap(); sleep(1)
        // scroll to bottom to see 其他 N 則
        for _ in 0..<12 { app.swipeUp() }
        sleep(1); snap("r07-news-bottom")
        let others = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "其他")).firstMatch
        print("OTHERS exists=\(others.exists)")
        if others.exists { others.tap(); sleep(1); app.swipeUp(); sleep(1); snap("r08-news-others") }
        XCTAssertTrue(app.state == .runningForeground, "app crashed")
    }
}
