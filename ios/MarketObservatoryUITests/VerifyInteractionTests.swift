import XCTest
import Vision

/// /verify 技能用的互動測試：walkthrough 只逐頁截圖，這裡實際操作（切換、輸入、左滑、對話框、存設定再讀回）。
/// 環境變數同 WalkthroughTests（TEST_RUNNER_MO_BASE_URL／EMAIL／PASSWORD／SHOTS）。每個 test 把看到的值寫成
/// `<name>.txt` 放在截圖目錄，給 `/verify` 拿去跟 `/api/v1/*` 對帳；會改資料的 test 結束前一定改回原狀。
@MainActor
final class VerifyInteractionTests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }
    private var shots: URL { URL(fileURLWithPath: env["MO_SHOTS"] ?? NSTemporaryDirectory()) }

    override func setUp() { continueAfterFailure = false }

    private func snap(_ name: String) {
        try? FileManager.default.createDirectory(at: shots, withIntermediateDirectories: true)
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: shots.appendingPathComponent("\(name).png"))
    }

    private func note(_ name: String, _ text: String) {
        try? FileManager.default.createDirectory(at: shots, withIntermediateDirectories: true)
        try? text.write(to: shots.appendingPathComponent("\(name).txt"), atomically: true, encoding: .utf8)
    }

    private func assertVisibleMarketTitle(_ size: String) throws {
        // Accessibility labels retain truncated text; recognize the pixels the user actually sees.
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["zh-Hant", "en-US"]
        try VNImageRequestHandler(data: XCUIScreen.main.screenshot().pngRepresentation).perform([request])
        let visible = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
            .joined().filter { !$0.isWhitespace }
        note("B12-title-ocr-\(size)", visible)
        XCTAssertTrue(visible.contains("今天為什麼漲跌"), "市場摘要標題在實際畫面中不完整：\(visible)")
    }

    /// 畫面上所有文字（staticTexts 的 label），給對帳用。
    private func texts(_ app: XCUIApplication) -> String {
        app.staticTexts.allElementsBoundByIndex.map(\.label).filter { !$0.isEmpty }.joined(separator: "\n")
    }

    private func launch(arguments: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += arguments
        if let base = env["MO_BASE_URL"], !base.isEmpty { app.launchArguments += ["-debugBaseURL", base] }
        app.launch()
        return app
    }

    private func signedIn(arguments: [String] = []) throws -> XCUIApplication {
        let app = launch(arguments: arguments)
        let email = app.textFields["email"]
        if email.waitForExistence(timeout: 5) {
            email.tap(); email.typeText(try XCTUnwrap(env["MO_EMAIL"]))
            let pw = app.secureTextFields["password"]; pw.tap(); pw.typeText(try XCTUnwrap(env["MO_PASSWORD"]))
            app.buttons["submit"].tap()
            if !app.buttons["總覽"].waitForExistence(timeout: 8), email.exists { app.buttons["submit"].tap() }
        }
        XCTAssertTrue(app.buttons["總覽"].waitForExistence(timeout: 20), "沒有進到主畫面")
        // A fresh verification simulator asks for notification permission on its first sign-in.
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["允許", "Allow"] {
            let allow = springboard.buttons[label]
            if allow.waitForExistence(timeout: 2) { allow.tap(); break }
        }
        return app
    }

    private func tab(_ app: XCUIApplication, _ name: String) {
        (app.tabBars.buttons[name].exists ? app.tabBars.buttons[name] : app.buttons[name]).tap()
    }

    private func open(_ app: XCUIApplication, _ prefix: String) {
        let b = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
        reveal(app, b)
        XCTAssertTrue(b.waitForExistence(timeout: 8), "找不到「\(prefix)」")
        keepAboveTabBar(app, b)
        b.tap()
    }

    /// Create only the disposable account supplied by this local verification run.
    func test01_RegisterVerificationAccount() throws {
        let base = try XCTUnwrap(env["MO_BASE_URL"].flatMap(URL.init(string:)))
        XCTAssertTrue(["localhost", "127.0.0.1"].contains(base.host ?? ""), "只能在本機驗證站建立測試帳號")
        let app = launch()
        let email = app.textFields["email"]
        XCTAssertTrue(email.waitForExistence(timeout: 20))
        app.buttons["還沒有帳號？建立帳號"].tap()
        email.tap(); email.typeText(try XCTUnwrap(env["MO_EMAIL"]))
        let password = app.secureTextFields["password"]
        password.tap(); password.typeText(try XCTUnwrap(env["MO_PASSWORD"]))
        app.buttons["submit"].tap()
        if !app.buttons["總覽"].waitForExistence(timeout: 8), email.exists { app.buttons["submit"].tap() }
        XCTAssertTrue(app.buttons["總覽"].waitForExistence(timeout: 20))
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["允許", "Allow"] {
            let allow = springboard.buttons[label]
            if allow.waitForExistence(timeout: 2) { allow.tap(); break }
        }
        snap("A1-account-created")
    }

    private func keepAboveTabBar(_ app: XCUIApplication, _ element: XCUIElement) {
        let window = app.windows.firstMatch
        for _ in 0 ..< 4 where element.frame.midY > window.frame.height * 0.65 {
            window.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7))
                .press(forDuration: 0.05, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45)))
        }
    }

    /// 只有 /verify 摸索新畫面時用：把無障礙樹寫成 dump-<name>.txt。
    func test00_DumpTree() throws {
        let app = try signedIn()
        sleep(3); note("dump-overview", app.debugDescription)
        tab(app, "走勢"); sleep(3); note("dump-history", app.debugDescription)
        tab(app, "更多"); open(app, "ETF 與定投試算"); sleep(3); note("dump-etfs", app.debugDescription)
        app.buttons["我的規劃"].tap(); sleep(2); note("dump-plan", app.debugDescription)
    }

    private func waitLabel(_ app: XCUIApplication, contains text: String, timeout: TimeInterval = 15) -> Bool {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch.waitForExistence(timeout: timeout)
    }

    /// List 是 lazy 的：畫面外的列不在無障礙樹裡，要先捲到它出現。
    @discardableResult
    private func reveal(_ app: XCUIApplication, _ el: XCUIElement, up: Bool = true, scrolls: Int = 6) -> XCUIElement {
        for _ in 0 ..< scrolls where !(el.exists && el.isHittable) { up ? app.swipeUp() : app.swipeDown() }
        for _ in 0 ..< scrolls + 2 where !(el.exists && el.isHittable) { up ? app.swipeDown() : app.swipeUp() }
        return el
    }

    /// 按「設為我的預設」；上一輪失敗留下同一組值時按鈕已經是「已是我的預設」，也算到位。
    private func setDefault(_ app: XCUIApplication) {
        // 金額沒變時「試算」是停用的，數字鍵盤不會收起來，清單也捲不動：先按鍵盤上方的「完成」收掉。
        if app.keyboards.firstMatch.exists {
            app.buttons.matching(NSPredicate(format: "label == '完成'")).allElementsBoundByIndex.last?.tap(); sleep(1)
        }
        let set = app.buttons["設為我的預設"], done = app.buttons["已是我的預設"]
        for _ in 0 ..< 8 where !(set.exists && set.isHittable) && !(done.exists && done.isHittable) { app.swipeUp() }
        if set.exists { set.tap() }
        if !done.waitForExistence(timeout: 10) { snap("fail-setDefault"); note("fail-setDefault", app.debugDescription) }
        XCTAssertTrue(done.exists, "沒有變成「已是我的預設」")
    }

    /// 清空欄位再輸入：長按「全選」不一定會跳出來，直接按刪除鍵最穩。
    private func replaceText(_ f: XCUIElement, _ v: String) {
        // 點欄位右端，游標才會在字尾（點中間可能落在字首，刪除鍵就刪不到東西）。
        if !f.exists { snap("fail-replaceText"); note("fail-replaceText", XCUIApplication().debugDescription) }
        // 欄位貼在畫面下緣時會被浮動的分頁列蓋住，點下去其實點到分頁列：先小幅捲到畫面中間。
        let win = XCUIApplication().windows.firstMatch
        for _ in 0 ..< 4 where f.exists && f.frame.midY > win.frame.height * 0.6 {
            win.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7)).press(forDuration: 0.05, thenDragTo: win.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45)))
            sleep(1)
        }
        f.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.5)).tap()
        let n = (f.value as? String)?.count ?? 0
        f.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: n + 2) + v)
    }

    /// "2026-09-04" -> "9/4（", the start of the app's `Fmt.dateWithWeekday`; the trailing "（" keeps 9/1 from matching 9/14.
    private func dayPrefix(_ iso: String) -> String {
        "\(Int(iso.dropFirst(5).prefix(2)) ?? 0)/\(Int(iso.dropFirst(8).prefix(2)) ?? 0)（"
    }

    /// A date injected by ios-test.sh (read from this run's API), e.g. MO_PUSH_DATE.
    private func injectedDate(_ key: String) throws -> String {
        try XCTUnwrap(env[key], "ios-test.sh 沒有傳 \(key)")
    }

    private func back(_ app: XCUIApplication) {
        let b = app.navigationBars.buttons["BackButton"]
        if b.exists { b.tap() } else { app.buttons["BackButton"].firstMatch.tap() }
    }

    // B2、B4、B5、B8
    func test02_Overview() throws {
        let app = try signedIn()
        let kpi = app.buttons.matching(NSPredicate(format: "label BEGINSWITH '市場指標'")).firstMatch
        XCTAssertTrue(kpi.waitForExistence(timeout: 15))
        note("B2-before", "value=\(kpi.value ?? "nil") hittable=\(kpi.isHittable)")
        // 展開狀態存在 @AppStorage，上一輪留下「已展開」時先收起來，才驗得到「點了會展開」。
        if (kpi.value as? String) == "已展開" { kpi.tap(); sleep(2) }
        kpi.tap(); sleep(2)
        snap("B2-kpi-expanded"); note("B2-kpi-expanded", "value=\(app.buttons.matching(NSPredicate(format: "label BEGINSWITH '市場指標'")).firstMatch.value ?? "nil")\n" + texts(app))
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label BEGINSWITH '市場指標'")).firstMatch.value as? String, "已展開", "點了市場指標沒有展開")

        app.buttons["其他交易日"].tap()
        XCTAssertTrue(app.navigationBars["交易日"].waitForExistence(timeout: 5))
        // Rows are newest first and labelled with the trade date: row 0 is the latest, row 1 the older day we open.
        let rows = app.buttons.matching(NSPredicate(format: "label MATCHES '^[0-9]{4}-[0-9]{2}-[0-9]{2}.*'"))
        XCTAssertTrue(rows.element(boundBy: 1).waitForExistence(timeout: 5), "交易日清單不到兩天")
        let latest = String(rows.element(boundBy: 0).label.prefix(10)), older = String(rows.element(boundBy: 1).label.prefix(10))
        note("B5-dates", "latest=\(latest) older=\(older)")
        rows.element(boundBy: 1).tap()
        XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS %@", dayPrefix(older))).firstMatch.waitForExistence(timeout: 15), "標題沒換成 \(older)")
        sleep(1); snap("B5-older"); note("B5-older", "date=\(older)\n" + texts(app) + "\n" + app.buttons.allElementsBoundByIndex.map(\.label).joined(separator: "\n"))
        app.buttons["其他交易日"].tap()
        XCTAssertTrue(app.buttons["回到最新"].waitForExistence(timeout: 5))
        app.buttons["回到最新"].tap()
        if app.buttons["完成"].waitForExistence(timeout: 2) { app.buttons["完成"].tap() }
        XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS %@", dayPrefix(latest))).firstMatch.waitForExistence(timeout: 15), "回不到最新一天 \(latest)")
        snap("B5-latest")

        let nvda = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'NVDA、'")).firstMatch
        reveal(app, nvda).tap()
        XCTAssertTrue(app.buttons["標的：NVIDIA"].waitForExistence(timeout: 10), "點 NVDA 沒切到走勢 NVIDIA")
        snap("B4-nvda-history")

        tab(app, "總覽")
        let cal = app.buttons["完整日曆 →"]
        for _ in 0 ..< 6 where !cal.isHittable { app.swipeUp() }
        cal.tap()
        XCTAssertTrue(app.buttons["日曆"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["日曆"].isSelected, "完整日曆沒有切到日曆段落")
        snap("B8-calendar")
    }

    // C2、C3、C4、C6
    func test03_History() throws {
        let app = try signedIn()
        tab(app, "走勢")
        XCTAssertTrue(app.buttons["1 年"].waitForExistence(timeout: 15))
        var out = ""
        for r in ["1 個月", "3 個月", "6 個月", "3 年", "5 年", "1 年"] {
            app.buttons[r].tap(); sleep(3)
            out += "== \(r)\n" + texts(app).components(separatedBy: "\n").prefix(12).joined(separator: " | ") + "\n"
        }
        snap("C2-ranges"); note("C2-ranges", out)
        app.buttons["6 個月"].tap(); app.buttons["1 年"].tap(); app.buttons["3 個月"].tap()
        sleep(5)
        XCTAssertTrue(app.buttons["3 個月"].isSelected)
        snap("C3-rapid"); note("C3-rapid", texts(app).components(separatedBy: "\n").prefix(12).joined(separator: " | "))
        app.buttons["標的：S&P 500"].tap(); sleep(1)
        note("C4-menu", app.debugDescription)
        let n = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'NVIDIA'")).firstMatch
        XCTAssertTrue(n.waitForExistence(timeout: 5), "標的選單裡沒有 NVIDIA"); n.tap()
        XCTAssertTrue(app.buttons["標的：NVIDIA"].waitForExistence(timeout: 10)); sleep(3)
        snap("C4-nvda"); note("C4-nvda", texts(app).components(separatedBy: "\n").prefix(12).joined(separator: " | "))
        app.buttons["標的：NVIDIA"].tap(); let spx = app.buttons["S&P 500（SPX）"]; XCTAssertTrue(spx.waitForExistence(timeout: 5)); spx.tap(); sleep(3)
        let aapl = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'AAPL'")).firstMatch
        for _ in 0 ..< 6 where !aapl.isHittable { app.swipeUp() }
        aapl.tap()
        XCTAssertTrue(app.buttons["標的：Apple"].waitForExistence(timeout: 10), "點 AAPL 列沒切標的")
        snap("C6-aapl")
    }

    // D2–D8（改測試帳號名單，結束時回到七巨頭）
    func test04_Watchlist() throws {
        let app = try signedIn()
        app.buttons["觀察名單"].tap()
        // The total weight moves with every holdings update: assert only the count, keep the full label for reconciling with /api/v1/watchlist.
        let seven = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH '7/30 家'")).firstMatch
        XCTAssertTrue(seven.waitForExistence(timeout: 10), texts(app))
        note("D1-before", seven.label)
        app.buttons["加入"].tap()
        let search = app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        search.tap(); search.typeText("NVDA"); sleep(1)
        note("D5-search-nvda", texts(app)); snap("D5-search-nvda")
        search.buttons.firstMatch.tap()
        search.typeText("ZZZZ"); sleep(1)
        note("D4-search-zzzz", texts(app)); snap("D4-search-zzzz")
        search.buttons.firstMatch.tap()
        search.typeText("AVGO"); sleep(1)
        let avgo = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'AVGO'")).firstMatch
        XCTAssertTrue(avgo.waitForExistence(timeout: 5)); avgo.tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH '8/30 家'")).firstMatch.waitForExistence(timeout: 60), "加入後沒有變 8 家")
        sleep(1); snap("D2-added"); note("D2-added", texts(app))

        // 總覽在 sheet 後面也有一列 AVGO（label 含「收盤」），要指名名單 sheet 裡那一列。
        let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'AVGO' AND NOT (label CONTAINS '收盤')")).firstMatch
        note("D6-row", "label=\(row.label) frame=\(row.frame)")
        XCTAssertTrue(row.isHittable, "名單 sheet 裡的 AVGO 列點不到")
        row.swipeLeft(velocity: .fast); sleep(1)
        snap("D6-full-swipe")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH '8/30 家'")).firstMatch.exists, "full swipe 直接刪掉了")
        let remove = app.buttons["移除"].firstMatch
        XCTAssertTrue(remove.waitForExistence(timeout: 3), "左滑後沒有「移除」")
        remove.tap()
        XCTAssertTrue(app.buttons["取消"].waitForExistence(timeout: 5)); snap("D7-confirm")
        app.buttons["取消"].tap(); sleep(1)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH '8/30 家'")).firstMatch.exists, "取消後 AVGO 不見了")
        row.swipeLeft(); sleep(1)
        app.buttons["移除"].firstMatch.tap()
        let confirm = app.buttons.matching(NSPredicate(format: "label == '移除'"))
        XCTAssertTrue(confirm.element(boundBy: 0).waitForExistence(timeout: 5))
        confirm.allElementsBoundByIndex.last!.tap()
        XCTAssertTrue(seven.waitForExistence(timeout: 30), "移除後沒回到 7 家")
        note("D8-removed", seven.label)
        snap("D8-removed")
        let tsla = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'TSLA'")).firstMatch
        tsla.tap(); sleep(3)
        snap("D9-tsla")
        // 只看「標的：Tesla」存在不夠：名單 sheet 沒關的話，走勢頁在 sheet 後面也找得到。
        XCTAssertFalse(app.navigationBars["觀察名單"].exists, "點 TSLA 後名單 sheet 沒關，使用者看不到走勢")
        XCTAssertTrue(app.buttons["標的：Tesla"].isHittable, "點 TSLA 沒到走勢 Tesla")
    }

    // E3、E4、E5
    func test05_NewsCalendar() throws {
        let app = try signedIn()
        tab(app, "新聞")
        XCTAssertTrue(app.buttons["NVDA"].waitForExistence(timeout: 15))
        app.buttons["NVDA"].tap(); sleep(3)
        snap("E3-nvda"); note("E3-nvda", texts(app))
        app.buttons["AAPL"].tap(); app.buttons["MSFT"].tap(); app.buttons["TSLA"].tap(); sleep(4)
        snap("E4-rapid"); note("E4-rapid", texts(app))
        app.buttons["全部"].tap(); sleep(2)
        app.buttons["日曆"].tap(); sleep(1)
        let eventDate = try injectedDate("MO_EVENT_DATE"), today = try injectedDate("MO_TODAY")
        // The calendar opens on today's month; near month end the next event can be in a later month.
        let months = (Int(eventDate.prefix(4))! * 12 + Int(eventDate.dropFirst(5).prefix(2))!) - (Int(today.prefix(4))! * 12 + Int(today.dropFirst(5).prefix(2))!)
        for _ in 0 ..< months { app.buttons["下個月"].tap(); sleep(1) }
        // Day cells read "10/28（三），有總經事件"; the 接下來 rows start the same but use "、", so exclude those.
        let day = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ AND NOT (label CONTAINS '、')", dayPrefix(eventDate))).firstMatch
        XCTAssertTrue(day.waitForExistence(timeout: 5), "日曆找不到事件日 \(eventDate)"); note("E5-day-label", "date=\(eventDate)\n" + day.label)
        day.tap(); sleep(1)
        snap("E5-day"); note("E5-day", "date=\(eventDate)\n" + texts(app))
        app.buttons["下個月"].tap(); sleep(1); snap("E5-next-month")
        XCTAssertTrue(app.buttons["今天"].waitForExistence(timeout: 3), "換月後沒有「今天」")
        app.buttons["今天"].tap(); sleep(1); snap("E5-today")
    }

    // F2、F3、F3b、F4、F5（改規劃，結束時改回 VOO／3 年／10000、每批 50000）
    func test06_EtfsPlan() throws {
        let app = try signedIn()
        tab(app, "更多"); open(app, "ETF 與定投試算")
        XCTAssertTrue(app.buttons["1Y"].waitForExistence(timeout: 15))
        var out = ""
        for p in ["YTD", "1M", "5Y", "1Y"] { app.buttons[p].tap(); sleep(1); out += "== \(p)\n" + texts(app).components(separatedBy: "\n").prefix(20).joined(separator: " | ") + "\n" }
        note("F2-periods", out)

        func pick(_ picker: String, _ option: String) {
            let b = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", picker + "、")).firstMatch
            // 頁面上的 ETF 列表也有同名按鈕（例如 VOO），選單是樹裡最後出現的那個；選單開了才會多出一個。
            let options = app.buttons.matching(NSPredicate(format: "label == %@", option))
            let before = options.count
            for _ in 0 ..< 3 {
                reveal(app, b).tap(); sleep(1)
                if options.count > before || (before == 0 && options.count > 0) { break }
            }
            let all = options.allElementsBoundByIndex
            if all.count <= before && before > 0 || all.isEmpty { note("pick-\(picker)-\(option)", app.debugDescription) }
            XCTAssertFalse(all.isEmpty, "選單沒有 \(option)"); all.last!.tap(); sleep(2)
            XCTAssertTrue(app.buttons["\(picker)、\(option)"].waitForExistence(timeout: 5), "\(picker) 沒有變成 \(option)")
        }
        func monthly(_ v: String) {
            replaceText(reveal(app, app.textFields["每月投入"]), v); note("F3-monthly-dump", app.debugDescription)
            let calc = app.buttons["每月投入、試算"]; XCTAssertTrue(calc.waitForExistence(timeout: 3), "找不到試算"); calc.tap(); sleep(3)
        }
        pick("標的", "IVV"); pick("期間", "2 年"); monthly("5000")
        snap("F3-dca"); note("F3-dca", texts(app) + "\n" + app.buttons.allElementsBoundByIndex.map(\.label).joined(separator: "\n"))
        setDefault(app)
        back(app); open(app, "ETF 與定投試算"); sleep(3)
        reveal(app, app.buttons.matching(NSPredicate(format: "label BEGINSWITH '每月投入'")).firstMatch)
        note("F3b-reopen", app.buttons.allElementsBoundByIndex.map(\.label).joined(separator: "\n") + "\n" + app.textFields["每月投入"].value.debugDescription)
        snap("F3b-reopen")
        pick("標的", "VOO"); pick("期間", "3 年"); monthly("10000")
        setDefault(app)

        reveal(app, app.buttons["我的規劃"], up: false).tap()
        let exit = app.textFields["考慮出場漲幅 %"]
        XCTAssertTrue(exit.waitForExistence(timeout: 5))
        replaceText(exit, "150"); sleep(1)
        snap("F4-exit150"); note("F4-exit150", "儲存 enabled=\(app.buttons["儲存"].isEnabled)\n" + texts(app))
        app.buttons["取消"].tap(); sleep(1)
        app.buttons["我的規劃"].tap()
        let tranche = app.textFields["每批投入"]
        XCTAssertTrue(tranche.waitForExistence(timeout: 5))
        replaceText(tranche, "60000"); app.buttons["儲存"].tap(); sleep(2)
        back(app); open(app, "ETF 與定投試算"); app.buttons["我的規劃"].tap()
        XCTAssertTrue(app.textFields["每批投入"].waitForExistence(timeout: 5))
        note("F5-reopen", "\(app.textFields["每批投入"].value ?? "nil")"); snap("F5-reopen")
        let t2 = app.textFields["每批投入"]; replaceText(t2, "50000"); app.buttons["儲存"].tap(); sleep(2)
    }

    // F8（改推播偏好，結束時改回開、±5.0%）
    func test07_PushPrefs() throws {
        let app = try signedIn()
        tab(app, "更多"); open(app, "推播設定")
        let daily = app.switches["每日收盤摘要"]
        XCTAssertTrue(daily.waitForExistence(timeout: 15))
        daily.switches.firstMatch.exists ? daily.switches.firstMatch.tap() : daily.tap()
        let stepper = app.steppers.firstMatch
        stepper.buttons.element(boundBy: 1).tap(); stepper.buttons.element(boundBy: 1).tap(); sleep(2)
        snap("F8-changed")
        back(app); open(app, "推播設定"); sleep(3)
        note("F8-reopen", "daily=\(app.switches["每日收盤摘要"].value ?? "nil")\n" + texts(app)); snap("F8-reopen")
        let d2 = app.switches["每日收盤摘要"]; d2.switches.firstMatch.exists ? d2.switches.firstMatch.tap() : d2.tap()
        app.steppers.firstMatch.buttons.element(boundBy: 0).tap(); app.steppers.firstMatch.buttons.element(boundBy: 0).tap(); sleep(2)
        back(app); open(app, "推播設定"); sleep(3)
        note("F8-restored", "daily=\(app.switches["每日收盤摘要"].value ?? "nil")\n" + texts(app))
    }

    // G1、G2：ios-test.sh 在背景每 8 秒送一次 daily.json（date＝MO_PUSH_DATE），這裡等橫幅、點開。
    func test08_PushOpenDaily() throws {
        let pushDate = try injectedDate("MO_PUSH_DATE")
        let app = try signedIn()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let banner = springboard.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS '收盤'")).firstMatch
        XCTAssertTrue(banner.waitForExistence(timeout: 60), "前景沒有看到推播橫幅")
        snap("G1-foreground-banner")
        sleep(6)
        XCUIDevice.shared.press(.home)
        let banner2 = springboard.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS '收盤'")).firstMatch
        XCTAssertTrue(banner2.waitForExistence(timeout: 60), "背景沒有看到推播橫幅")
        banner2.tap()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS %@", dayPrefix(pushDate))).firstMatch.waitForExistence(timeout: 15), "點推播沒有打開 \(pushDate) 的總覽")
        snap("G2-opened-daily")
    }

    // G3：ios-test.sh 在背景送 events.json。
    func test09_PushOpenEvents() throws {
        let app = try signedIn()
        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let banner = springboard.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS '事件'")).firstMatch
        XCTAssertTrue(banner.waitForExistence(timeout: 60), "背景沒有看到事件推播")
        banner.tap()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        XCTAssertTrue(app.buttons["日曆"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["日曆"].isSelected, "點事件推播沒切到日曆")
        snap("G3-opened-events")
    }

    // G4: Run alone; ios-test.sh sends daily.json while the watchlist sheet is open.
    func test13_PushDismissesWatchlist() throws {
        let pushDate = try injectedDate("MO_PUSH_DATE")
        let app = try signedIn()
        tab(app, "總覽")
        XCTAssertTrue(app.buttons["其他交易日"].waitForExistence(timeout: 15))
        app.buttons["其他交易日"].tap()
        let latestRow = app.buttons.matching(NSPredicate(format: "label MATCHES '^[0-9]{4}-[0-9]{2}-[0-9]{2}.*'")).firstMatch
        XCTAssertTrue(latestRow.waitForExistence(timeout: 5))
        let latestDate = String(latestRow.label.prefix(10))
        XCTAssertNotEqual(latestDate, pushDate, "推播必須指向不同日期")
        let latest = app.buttons["回到最新"]
        XCTAssertTrue(latest.waitForExistence(timeout: 5))
        if latest.isEnabled { latest.tap() } else { app.buttons["完成"].tap() }
        XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS %@", dayPrefix(latestDate))).firstMatch.waitForExistence(timeout: 15))
        let oldTitle = app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS %@", dayPrefix(pushDate))).firstMatch
        XCTAssertFalse(oldTitle.exists, "推播日期必須不同於目前最新日期，否則驗不到切換")
        XCTAssertTrue(app.buttons["觀察名單"].waitForExistence(timeout: 15))
        app.buttons["觀察名單"].tap()
        let sheet = app.navigationBars["觀察名單"]
        XCTAssertTrue(sheet.waitForExistence(timeout: 10), "觀察名單 sheet 沒有打開")
        snap("G4-sheet-before-push")
        try "sheet-open\n".write(to: shots.appendingPathComponent("G4-push-ready.txt"), atomically: true, encoding: .utf8)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let banner = springboard.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS '收盤'")).firstMatch
        XCTAssertTrue(banner.waitForExistence(timeout: 60), "沒有收到 daily 推播；請單獨跑 test13")
        XCTAssertTrue(sheet.exists, "點推播前 sheet 已關閉，沒有測到遮擋情境")
        banner.tap()
        XCTAssertTrue(oldTitle.waitForExistence(timeout: 15), "點推播沒有打開 \(pushDate) 的總覽")
        XCTAssertTrue(sheet.waitForNonExistence(timeout: 10), "點推播後觀察名單 sheet 仍擋住總覽")
        snap("G4-sheet-dismissed"); note("G4-sheet-dismissed", "date=\(pushDate)\n" + texts(app))
    }

    // B11: While the app is on Home, the verifier backfills a newer day on this local site.
    // The test fails if no genuinely newer API snapshot arrives within 120 seconds.
    func test14_ForegroundLoadsNewTradingDay() async throws {
        let app = try signedIn(arguments: ["-verifyOverviewRefreshInterval", "0"])
        tab(app, "總覽")
        let base = try XCTUnwrap(env["MO_BASE_URL"].flatMap(URL.init(string:)))
        XCTAssertTrue(["localhost", "127.0.0.1"].contains(base.host ?? ""), "只能對本機驗證站回補，禁止正式站")
        let probe = URLSession(configuration: .ephemeral)
        defer { probe.invalidateAndCancel() }
        var signIn = URLRequest(url: base.appendingPathComponent("api/auth/sign-in/email"))
        signIn.httpMethod = "POST"
        signIn.setValue("application/json", forHTTPHeaderField: "Content-Type")
        signIn.setValue(base.absoluteString, forHTTPHeaderField: "Origin")
        signIn.httpBody = try JSONSerialization.data(withJSONObject: [
            "email": try XCTUnwrap(env["MO_EMAIL"]), "password": try XCTUnwrap(env["MO_PASSWORD"])
        ])
        let (_, response) = try await probe.data(for: signIn)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200, "測試 probe 登入失敗")
        let before = try await overviewDate(probe, base: base)
        XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS %@", dayPrefix(before))).firstMatch.waitForExistence(timeout: 15))
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(app.wait(for: .runningBackground, timeout: 10))
        note("B11-ready", "before=\(before)\n請現在回補本機站的新交易日；test 最多等 120 秒。")
        snap("B11-background")
        let deadline = Date().addingTimeInterval(120)
        var after = before
        while after <= before && Date() < deadline {
            try await Task.sleep(for: .seconds(1))
            after = try await overviewDate(probe, base: base)
        }
        XCTAssertGreaterThan(after, before, "本機站未在 120 秒內回補新交易日；不算通過")
        app.activate()
        XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS %@", dayPrefix(after))).firstMatch.waitForExistence(timeout: 15), "回前景後沒有自動更新到 \(after)")
        snap("B11-foreground-updated"); note("B11-foreground-updated", "before=\(before) after=\(after)\n" + texts(app))
    }

    // T8: The local fixture must contain market and company digests with positive/negative tones.
    func test15_DigestToneLabels() throws {
        for (size, arguments) in [
            ("normal", [String]()),
            ("largest", ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        ] {
            let app = try signedIn(arguments: arguments)
            tab(app, "總覽")
            let market = app.descendants(matching: .any)["market-digest"].firstMatch
            reveal(app, market)
            XCTAssertTrue(market.waitForExistence(timeout: 10), "缺少市場摘要 fixture")
            XCTAssertTrue(market.label.contains("利多") || market.label.contains("利空"), "市場摘要沒有可朗讀的利多／利空標示")
            snap("B12-tone-\(size)"); note("B12-tone-\(size)", market.label)
            try assertVisibleMarketTitle(size)
            tab(app, "新聞")
            let digest = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'news-digest-' AND (label CONTAINS '利多' OR label CONTAINS '利空')")).firstMatch
            reveal(app, digest)
            XCTAssertTrue(digest.waitForExistence(timeout: 10), "缺少帶利多／利空的公司摘要 fixture，或摘要沒有標示")
            XCTAssertTrue(app.staticTexts["利多"].firstMatch.exists || app.staticTexts["利空"].firstMatch.exists, "畫面上找不到利多／利空文字標籤")
            snap("E9-tone-\(size)"); note("E9-tone-\(size)", digest.label)
            XCTAssertTrue(app.buttons["全部"].isSelected, "全部 chip 沒有 selected trait")
            let symbol = String(digest.identifier.dropFirst("news-digest-".count))
            let chip = app.buttons[symbol]
            reveal(app, chip, up: false).tap()
            XCTAssertTrue(chip.isSelected, "股票 chip 選取後沒有 selected trait")
            app.terminate()
        }
    }

    private func overviewDate(_ session: URLSession, base: URL) async throws -> String {
        struct ProbeOverview: Decodable {
            struct Snapshot: Decodable { let tradeDate: String }
            let snapshot: Snapshot
        }
        let (data, response) = try await session.data(from: base.appendingPathComponent("api/v1/overview"))
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200, "讀本機總覽失敗")
        return try JSONDecoder().decode(ProbeOverview.self, from: data).snapshot.tradeDate
    }

    /// Capture every reading surface at the system's largest text size, or at the normal size for dark-mode review.
    func test16_Readability() throws {
        let variant = env["MO_READING_VARIANT"] ?? "light-largest"
        let arguments = variant.contains("largest")
            ? ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"] : []
        let app = try signedIn(arguments: arguments)
        tab(app, "總覽")
        XCTAssertTrue(app.buttons["觀察名單"].waitForExistence(timeout: 15))
        snap("UI-\(variant)-overview")
        app.buttons["觀察名單"].tap()
        XCTAssertTrue(app.navigationBars["觀察名單"].waitForExistence(timeout: 5))
        snap("UI-\(variant)-watchlist")
        app.buttons["完成"].tap()

        tab(app, "走勢")
        XCTAssertTrue(app.buttons["1 年"].waitForExistence(timeout: 15))
        snap("UI-\(variant)-history")
        app.swipeUp()
        snap("UI-\(variant)-history-statistics")

        tab(app, "新聞")
        XCTAssertTrue(app.buttons["日曆"].waitForExistence(timeout: 15))
        snap("UI-\(variant)-news")
        let article = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'news-article-'")).firstMatch
        reveal(app, article)
        XCTAssertTrue(article.isHittable, "新聞資料不足或新聞列點不到")
        article.tap()
        XCTAssertTrue(app.navigationBars["新聞"].waitForExistence(timeout: 5))
        snap("UI-\(variant)-news-detail")
        reveal(app, app.buttons["開啟原文"])
        XCTAssertTrue(app.buttons["開啟原文"].isHittable, "詳情無法捲到原文入口")
        snap("UI-\(variant)-news-detail-bottom")
        app.buttons["完成"].tap()
        reveal(app, app.buttons["日曆"], up: false)
        app.buttons["日曆"].tap()
        XCTAssertTrue(app.buttons["下個月"].waitForExistence(timeout: 5))
        snap("UI-\(variant)-calendar")
        app.buttons["下個月"].tap()
        XCTAssertTrue(app.buttons["今天"].waitForExistence(timeout: 5))
        app.buttons["今天"].tap()
        let datePicker = app.buttons["calendar-date-picker"]
        if variant.contains("largest") {
            XCTAssertTrue(datePicker.waitForExistence(timeout: 5), "大字月曆缺少日期選擇器")
            XCTAssertEqual(datePicker.value as? String, "已收合")
            datePicker.tap()
        }
        let eventDate = try injectedDate("MO_EVENT_DATE")
        let event = app.buttons["calendar-day-\(eventDate)"]
        if variant.contains("largest") {
            let dates = app.scrollViews["calendar-date-list"]
            XCTAssertTrue(dates.waitForExistence(timeout: 5))
            for _ in 0 ..< 12 where !(event.exists && event.isHittable) { dates.swipeUp() }
        } else {
            reveal(app, event)
        }
        if !event.isHittable {
            snap("UI-\(variant)-calendar-failed")
            note("UI-\(variant)-calendar-failed", app.debugDescription)
        }
        XCTAssertTrue(event.isHittable, "大字日期清單無法選取事件日")
        event.tap()
        if variant.contains("largest") {
            XCTAssertEqual(datePicker.value as? String, "已收合", "選完日期沒有收起清單")
            XCTAssertTrue(datePicker.label.contains(dayPrefix(eventDate)), "事件日期選取沒有生效")
        } else {
            XCTAssertTrue(event.isSelected, "事件日期選取沒有生效")
        }
        snap("UI-\(variant)-calendar-selected")
        let selectedHeading = app.staticTexts["calendar-selected-heading"]
        reveal(app, selectedHeading)
        XCTAssertTrue(selectedHeading.isHittable, "選取後無法讀取當日事件")
        snap("UI-\(variant)-calendar-events")

        tab(app, "更多")
        snap("UI-\(variant)-more")
        open(app, "ETF 與定投試算")
        XCTAssertTrue(app.buttons["1Y"].waitForExistence(timeout: 15))
        snap("UI-\(variant)-etfs")
        app.swipeUp()
        snap("UI-\(variant)-etfs-reading")
        app.buttons["我的規劃"].tap()
        XCTAssertTrue(app.navigationBars["我的規劃"].waitForExistence(timeout: 5))
        snap("UI-\(variant)-plan")
        app.buttons["取消"].tap()
        back(app)
        open(app, "下月展望")
        XCTAssertTrue(waitLabel(app, contains: "定義：以資料日收盤為起點"))
        snap("UI-\(variant)-outlook-risk")
        let model = app.buttons["機率與模型說明"]
        // At AX5 the always-visible definitions and model limitations span more than six screens.
        reveal(app, model, scrolls: variant.contains("largest") ? 24 : 6)
        XCTAssertTrue(model.isHittable, "無法捲到模型說明")
        // On SE, a multiline label can be hittable while its tap point sits under the floating tab bar.
        keepAboveTabBar(app, model)
        snap("UI-\(variant)-outlook-conclusion")
        model.tap()
        let interval = app.staticTexts["outlook-interval"]
        reveal(app, interval, scrolls: variant.contains("largest") ? 24 : 6)
        XCTAssertTrue(interval.waitForExistence(timeout: 5))
        snap("UI-\(variant)-outlook-details")
        back(app)
        open(app, "推播設定")
        XCTAssertTrue(app.navigationBars["推播設定"].waitForExistence(timeout: 5))
        let daily = app.switches["每日收盤摘要"]
        reveal(app, daily)
        XCTAssertTrue(daily.waitForExistence(timeout: 15))
        snap("UI-\(variant)-push")
        back(app)
        open(app, "帳號")
        XCTAssertTrue(app.navigationBars["帳號"].waitForExistence(timeout: 5))
        reveal(app, app.buttons["登出"])
        XCTAssertTrue(app.buttons["登出"].waitForExistence(timeout: 5))
        snap("UI-\(variant)-account")
        note("UI-\(variant)-tree", app.debugDescription)
        let signOut = app.buttons["登出"]
        keepAboveTabBar(app, reveal(app, signOut))
        signOut.tap()
        XCTAssertTrue(app.textFields["email"].waitForExistence(timeout: 10))
        snap("UI-\(variant)-login")
    }

    /// Requires the local outlook fixture's globalCaveat; it must remain visible while method details are collapsed.
    func test17_OutlookCaveatVisibleByDefault() throws {
        let app = try signedIn()
        tab(app, "更多"); open(app, "下月展望")
        let caveat = app.staticTexts.matching(NSPredicate(format: "label CONTAINS '整體滾動驗證中'")).firstMatch
        reveal(app, caveat)
        XCTAssertTrue(caveat.isHittable, "整體模型驗證限制預設看不到")
        XCTAssertFalse(app.staticTexts["outlook-interval"].exists, "驗證前方法區塊應維持收合")
        snap("H2-global-caveat-visible"); note("H2-global-caveat-visible", caveat.label)
    }

    func test18_CalendarLargest() throws {
        let app = try signedIn(arguments: ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"])
        tab(app, "新聞")
        XCTAssertTrue(app.buttons["日曆"].waitForExistence(timeout: 15))
        app.buttons["日曆"].tap()
        let eventDate = try injectedDate("MO_EVENT_DATE"), today = try injectedDate("MO_TODAY")
        let months = (Int(eventDate.prefix(4))! * 12 + Int(eventDate.dropFirst(5).prefix(2))!) - (Int(today.prefix(4))! * 12 + Int(today.dropFirst(5).prefix(2))!)
        for _ in 0 ..< months { app.buttons["下個月"].tap() }
        let picker = app.buttons["calendar-date-picker"]
        reveal(app, picker).tap()
        let dates = app.scrollViews["calendar-date-list"]
        XCTAssertTrue(dates.waitForExistence(timeout: 5))
        snap("E10-date-sheet")
        note("E10-date-sheet-tree", app.debugDescription)
        if months == 0 {
            let current = dates.buttons["calendar-day-\(today)"]
            XCTAssertTrue(current.isHittable, "日期選擇器未定位到目前日期")
        }
        let event = dates.buttons["calendar-day-\(eventDate)"]
        for _ in 0 ..< 12 where !(event.exists && event.isHittable) { dates.swipeUp() }
        XCTAssertTrue(event.isHittable, "最大字級無法選到事件日期")
        event.tap()
        XCTAssertTrue(dates.waitForNonExistence(timeout: 5), "日期選完沒有關閉")
        XCTAssertTrue(picker.label.contains(dayPrefix(eventDate)))
        let heading = app.staticTexts["calendar-selected-heading"]
        reveal(app, heading)
        XCTAssertTrue(heading.isHittable, "最大字級選取後看不到事件區塊")
        snap("E10-selected-events")
    }

    func test20_LargeTypeEtfAndLogin() throws {
        let variant = env["MO_READING_VARIANT"] ?? "compact-largest"
        let arguments = variant.contains("largest")
            ? ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"] : []
        let app = try signedIn(arguments: arguments)
        tab(app, "更多"); open(app, "ETF 與定投試算")
        XCTAssertTrue(app.buttons["1Y"].waitForExistence(timeout: 15))
        let ticker = app.staticTexts["etf-ticker-VOO"], value = app.staticTexts["etf-return-VOO"]
        reveal(app, value)
        XCTAssertTrue(value.isHittable)
        XCTAssertTrue(value.label.contains("%"), "缺少報酬資料")
        let tickerFrame = ticker.frame, valueFrame = value.frame
        XCTAssertLessThanOrEqual(valueFrame.height, tickerFrame.height + 1, "報酬正負號與數字被拆行")
        XCTAssertLessThanOrEqual(valueFrame.maxX, app.windows.firstMatch.frame.maxX - 16, "報酬數字超出畫面")
        snap("UI-\(variant)-etfs")
        app.swipeUp(); snap("UI-\(variant)-etfs-reading")
        back(app); open(app, "帳號")
        let signOut = app.buttons["登出"]
        keepAboveTabBar(app, reveal(app, signOut))
        signOut.tap()
        let email = app.textFields["email"], divider = app.staticTexts["login-email-divider"]
        snap("UI-\(variant)-after-signout")
        reveal(app, email)
        if !email.exists { note("UI-\(variant)-signout-failed", app.debugDescription) }
        XCTAssertTrue(email.waitForExistence(timeout: 10))
        reveal(app, divider)
        XCTAssertTrue(divider.isHittable)
        XCTAssertLessThanOrEqual(divider.frame.height, email.frame.height, "登入分隔文字被擠成多行")
        XCTAssertLessThanOrEqual(divider.frame.maxX, app.windows.firstMatch.frame.maxX - 16, "登入分隔文字超出畫面")
        snap("UI-\(variant)-login")
        note("UI-\(variant)-type-geometry", "ticker=\(tickerFrame) return=\(valueFrame) divider=\(divider.frame) email=\(email.frame)")
    }

    // Z1、A5、A2：登出、錯誤密碼、短密碼，最後用正確密碼登入回來。
    func test10_SignOutAndErrors() throws {
        let app = try signedIn()
        tab(app, "更多"); open(app, "帳號")
        app.buttons["登出"].tap()
        let email = app.textFields["email"]
        XCTAssertTrue(email.waitForExistence(timeout: 10), "登出後沒回登入畫面"); snap("Z1-signed-out")
        email.tap(); email.typeText(try XCTUnwrap(env["MO_EMAIL"]))
        let pw = app.secureTextFields["password"]; pw.tap(); pw.typeText("wrong-password-1")
        app.buttons["submit"].tap(); sleep(4)
        snap("A5-wrong"); note("A5-wrong", texts(app))
        XCTAssertTrue(app.staticTexts["Email 或密碼不正確"].exists, "錯誤密碼沒有顯示中文錯誤")
        XCTAssertTrue(email.exists, "錯誤密碼卻離開了登入畫面")
        app.buttons["還沒有帳號？建立帳號"].tap(); sleep(1)
        let pw2 = app.secureTextFields["password"]; pw2.tap()
        replaceText(pw2, "short"); sleep(1)
        snap("A2-short"); note("A2-short", "submit enabled=\(app.buttons["submit"].isEnabled)\n" + texts(app))
        XCTAssertFalse(app.buttons["submit"].isEnabled, "短密碼時建立帳號按鈕沒有停用")
        XCTAssertTrue(app.staticTexts["密碼至少 8 個字（目前 5 個）"].exists, "短密碼沒有顯示字數提示")
        app.buttons["已有帳號，改為登入"].tap(); sleep(1)
        let pw3 = app.secureTextFields["password"]; pw3.tap()
        replaceText(pw3, try XCTUnwrap(env["MO_PASSWORD"]))
        note("A5-before-relogin", "email=\(app.textFields["email"].value ?? "nil") pw=\(app.secureTextFields["password"].value ?? "nil")")
        app.buttons["submit"].tap()
        // 跟 signedIn 一樣：密碼建議列出現時這一下點擊偶爾被吃掉（伺服器紀錄沒有請求），還在登入畫面就再點一次。
        if !app.buttons["總覽"].waitForExistence(timeout: 8), app.textFields["email"].exists { app.buttons["submit"].tap() }
        if !app.buttons["總覽"].waitForExistence(timeout: 20) { snap("fail-relogin"); note("fail-relogin", texts(app)) }
        XCTAssertTrue(app.buttons["總覽"].exists, "正確密碼登不進去")
    }

    // Z2、Z3：刪除帳號，先取消再確認。只對一次性帳號跑。
    /// H1–H3：展望頁從上捲到底，逐段截圖；確認 dd5 與上漲兩個驗證區塊分開標目標。
    func test12_Outlook() throws {
        let app = try signedIn()
        tab(app, "更多"); open(app, "下月展望")
        XCTAssertTrue(waitLabel(app, contains: "定義：以資料日收盤為起點"), "找不到 dd5 定義")
        snap("H1-outlook-summary")
        let interval = app.staticTexts["outlook-interval"]
        let model = app.buttons["機率與模型說明"]
        reveal(app, model)
        XCTAssertTrue(model.isHittable, "模型說明無法展開")
        XCTAssertFalse(interval.exists, "模型細節預設應收合")
        snap("H1-model-collapsed")
        model.tap()
        XCTAssertTrue(interval.waitForExistence(timeout: 5), "模型說明展開後缺少機率依據")
        snap("H1-model-expanded"); note("H1-model-expanded", texts(app))
        reveal(app, model, up: false).tap()
        XCTAssertTrue(interval.waitForNonExistence(timeout: 5), "模型說明無法收合")

        for (target, title) in [("dd5", "滾動驗證：跌幅機率（dd5）"), ("up", "滾動驗證：上漲機率")] {
            let disclosure = app.buttons[title]
            reveal(app, disclosure)
            XCTAssertTrue(disclosure.isHittable, "找不到 \(title)")
            let detail = app.staticTexts["outlook-validation-\(target)-details"]
            XCTAssertFalse(detail.exists, "驗證細節預設應收合")
            snap("H1-validation-\(target)-collapsed")
            disclosure.tap()
            reveal(app, detail)
            XCTAssertTrue(detail.waitForExistence(timeout: 5), "\(title) 展開後沒有 BSS 解釋")
            snap("H1-validation-\(target)-expanded"); note("H1-validation-\(target)", texts(app))
            reveal(app, disclosure, up: false).tap()
            XCTAssertTrue(detail.waitForNonExistence(timeout: 5), "\(title) 無法收合")
        }
    }

    func test11_DeleteAccount() throws {
        let app = try signedIn()
        tab(app, "更多"); open(app, "帳號")
        let del = app.buttons["刪除帳號"].firstMatch
        XCTAssertTrue(del.waitForExistence(timeout: 10)); del.tap()
        XCTAssertTrue(app.alerts["確定要刪除帳號？"].waitForExistence(timeout: 5), "沒有確認對話框")
        snap("Z2-confirm"); note("Z2-confirm", app.alerts.firstMatch.debugDescription)
        app.alerts.buttons["取消"].tap(); sleep(2)
        XCTAssertTrue(app.navigationBars["帳號"].exists, "取消後不在帳號頁")
        XCTAssertFalse(app.textFields["email"].exists, "取消後被登出了")
        del.tap()
        XCTAssertTrue(app.alerts["確定要刪除帳號？"].waitForExistence(timeout: 5))
        app.alerts.buttons["刪除帳號"].tap()
        XCTAssertTrue(app.textFields["email"].waitForExistence(timeout: 20), "刪除後沒有回到登入畫面")
        snap("Z3-deleted")
    }

    // C8: Research is available only for watchlist companies, immediately after the main chart.
    func test19_HistoryResearch() throws {
        let app = try signedIn()
        tab(app, "走勢")
        XCTAssertTrue(app.buttons["標的：S&P 500"].waitForExistence(timeout: 15))
        app.buttons["標的：S&P 500"].tap()
        let nvda = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'NVIDIA'")).firstMatch
        XCTAssertTrue(nvda.waitForExistence(timeout: 5), "標的選單裡沒有 NVIDIA")
        nvda.tap()
        XCTAssertTrue(app.buttons["標的：NVIDIA"].waitForExistence(timeout: 15))

        let section = app.staticTexts["研究表與原始資料"]
        reveal(app, section)
        XCTAssertTrue(section.isHittable, "NVIDIA 主圖後沒有研究表")
        let edgar = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'SEC EDGAR 申報清單'")).firstMatch
        reveal(app, edgar)
        XCTAssertTrue(edgar.isHittable, "研究表沒有 EDGAR 連結")
        let ir = app.descendants(matching: .any).matching(NSPredicate(format: "label == '公司投資人關係（IR）'")).firstMatch
        XCTAssertTrue(ir.exists, "NVIDIA 沒有 IR 連結")
        snap("C8-research-links")
        var evidence = "\(edgar.label)\n\(ir.label)\n"

        let disclosure = app.buttons["研究表範本（7 題）"]
        reveal(app, disclosure).tap()
        for (i, label) in ["企業驅動", "盈餘假設", "與共識的差異", "估值敏感度", "下一個核對事件", "反證", "論點失效條件"].enumerated() {
            let question = app.staticTexts["\(i + 1). \(label)"]
            reveal(app, question)
            XCTAssertTrue(question.isHittable, "範本缺少第 \(i + 1) 題")
            evidence += texts(app) + "\n"
        }
        let copy = app.buttons["複製範本"]
        reveal(app, copy).tap()
        let copied = app.staticTexts["已複製，可貼到你自己的筆記保存"]
        reveal(app, copied)
        XCTAssertTrue(copied.waitForExistence(timeout: 5), "複製後沒有顯示「已複製」")
        snap("C8-research"); note("C8-research", evidence + texts(app))

        app.buttons["標的：NVIDIA"].tap()
        let spx = app.buttons["S&P 500（SPX）"]
        XCTAssertTrue(spx.waitForExistence(timeout: 5)); spx.tap()
        XCTAssertTrue(app.buttons["標的：S&P 500"].waitForExistence(timeout: 15))
        reveal(app, app.buttons["1 年"], up: false)
        // Scan from the main chart through the following sections; offscreen lazy rows alone cannot prove absence.
        for _ in 0 ..< 6 {
            XCTAssertFalse(section.exists, "S&P 500 不應顯示研究表")
            XCTAssertFalse(edgar.exists, "S&P 500 不應顯示 EDGAR 連結")
            app.swipeUp()
        }
        snap("C8-research-spx"); note("C8-research-spx", texts(app))
    }
}
