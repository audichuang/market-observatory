import XCTest

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

    /// 畫面上所有文字（staticTexts 的 label），給對帳用。
    private func texts(_ app: XCUIApplication) -> String {
        app.staticTexts.allElementsBoundByIndex.map(\.label).filter { !$0.isEmpty }.joined(separator: "\n")
    }

    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        if let base = env["MO_BASE_URL"], !base.isEmpty { app.launchArguments += ["-debugBaseURL", base] }
        app.launch()
        return app
    }

    private func signedIn() throws -> XCUIApplication {
        let app = launch()
        let email = app.textFields["email"]
        if email.waitForExistence(timeout: 5) {
            email.tap(); email.typeText(try XCTUnwrap(env["MO_EMAIL"]))
            let pw = app.secureTextFields["password"]; pw.tap(); pw.typeText(try XCTUnwrap(env["MO_PASSWORD"]))
            app.buttons["submit"].tap()
            if !app.buttons["總覽"].waitForExistence(timeout: 8), email.exists { app.buttons["submit"].tap() }
        }
        XCTAssertTrue(app.buttons["總覽"].waitForExistence(timeout: 20), "沒有進到主畫面")
        return app
    }

    private func tab(_ app: XCUIApplication, _ name: String) {
        (app.tabBars.buttons[name].exists ? app.tabBars.buttons[name] : app.buttons[name]).tap()
    }

    private func open(_ app: XCUIApplication, _ prefix: String) {
        let b = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
        XCTAssertTrue(b.waitForExistence(timeout: 8), "找不到「\(prefix)」")
        b.tap()
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
    private func reveal(_ app: XCUIApplication, _ el: XCUIElement, up: Bool = true) -> XCUIElement {
        for _ in 0 ..< 6 where !(el.exists && el.isHittable) { up ? app.swipeUp() : app.swipeDown() }
        for _ in 0 ..< 8 where !(el.exists && el.isHittable) { up ? app.swipeDown() : app.swipeUp() }
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
        let older = app.buttons.matching(NSPredicate(format: "label BEGINSWITH '2026-10-22'")).firstMatch
        XCTAssertTrue(older.waitForExistence(timeout: 5), "交易日清單裡找不到 10/22")
        older.tap()
        XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS '10/22'")).firstMatch.waitForExistence(timeout: 15), "標題沒換成 10/22")
        sleep(1); snap("B5-older"); note("B5-older", texts(app) + "\n" + app.buttons.allElementsBoundByIndex.map(\.label).joined(separator: "\n"))
        app.buttons["其他交易日"].tap()
        XCTAssertTrue(app.buttons["回到最新"].waitForExistence(timeout: 5))
        app.buttons["回到最新"].tap()
        if app.buttons["完成"].waitForExistence(timeout: 2) { app.buttons["完成"].tap() }
        XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS '10/23'")).firstMatch.waitForExistence(timeout: 15), "回不到最新一天")
        snap("B5-latest")

        let nvda = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'NVDA、'")).firstMatch
        nvda.tap()
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
        XCTAssertTrue(app.staticTexts["7/30 家 · 合計權重 34.01%"].waitForExistence(timeout: 10), texts(app))
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
        XCTAssertTrue(app.staticTexts["7/30 家 · 合計權重 34.01%"].waitForExistence(timeout: 30), "移除後沒回到 7 家")
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
        let day = app.buttons.matching(NSPredicate(format: "label CONTAINS '10/28' OR label CONTAINS '10月28日'")).firstMatch
        XCTAssertTrue(day.waitForExistence(timeout: 5)); note("E5-day-label", day.label)
        day.tap(); sleep(1)
        snap("E5-day28"); note("E5-day28", texts(app))
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

    // G1、G2：/verify 在背景每幾秒送一次 daily.json（date 2026-10-22），這裡等橫幅、點開。
    func test08_PushOpenDaily() throws {
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
        XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier CONTAINS '10/22'")).firstMatch.waitForExistence(timeout: 15), "點推播沒有打開 10/22 的總覽")
        snap("G2-opened-daily")
    }

    // G3：/verify 在背景送 events.json。
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
        var all = ""
        for i in 0 ..< 12 {
            snap(String(format: "H1-outlook-%02d", i)); all += texts(app) + "\n"
            app.swipeUp(velocity: .slow); sleep(1)
        }
        note("H1-outlook", all)
        XCTAssertTrue(all.contains("滾動驗證：跌幅機率（dd5）"), "沒有 dd5 驗證區塊")
        XCTAssertTrue(all.contains("滾動驗證：上漲機率"), "沒有上漲驗證區塊")
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
}
