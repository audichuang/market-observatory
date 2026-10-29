import Foundation

// Source of truth: web/src/lib/research.ts. Keep both files and their mirrored tests in sync.
enum Research {
    static let fields: [(label: String, prompt: String)] = [
        ("企業驅動", "營收靠哪些業務與客戶？競爭、供應鏈與監管風險是什麼？"),
        ("盈餘假設", "營收的量、價、組合，利潤率與股數各怎麼假設？每個假設附來源與日期。"),
        ("與共識的差異", "你的理解和市場共識差在哪個假設？不知道就寫不知道。"),
        ("估值敏感度", "用哪種方法看估值？哪個假設改變時，結論會跟著改變？"),
        ("下一個核對事件", "哪一次財報、產品或法規事件可以核對？到時要看哪個數字？不預填漲跌方向。"),
        ("反證", "哪些看得到的結果會讓目前的理解不成立？有利與不利的證據都記下來。"),
        ("論點失效條件", "如果論點錯了，最可能是哪個營運假設錯了？"),
    ]

    static let note = "這張表只整理研究問題，不是評等、目標價或買賣建議；本站不保存你填的內容。"

    static func edgarFilingsURL(_ ticker: String) -> URL? {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")
        let encoded = ticker.addingPercentEncoding(withAllowedCharacters: allowed)!
        return URL(string: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=\(encoded)&owner=include&count=40")
    }

    static let irURLs = [
        "NVDA": "https://investor.nvidia.com/",
        "AAPL": "https://investor.apple.com/",
        "MSFT": "https://www.microsoft.com/en-us/investor",
        "AMZN": "https://ir.aboutamazon.com/",
        "GOOGL": "https://abc.xyz/investor/",
        "META": "https://investor.atmeta.com/",
        "TSLA": "https://ir.tesla.com/",
    ]

    static func template(company: String, ticker: String, date: String) -> String {
        var lines = [
            "\(company)（\(ticker)）研究表 \(date)",
            "SEC 申報：\(edgarFilingsURL(ticker)!.absoluteString)",
        ]
        if let ir = irURLs[ticker] { lines.append("公司 IR：\(ir)") }
        lines.append("")
        for (i, field) in fields.enumerated() {
            lines.append("\(i + 1). \(field.label)：\(field.prompt)")
            lines.append("")
        }
        lines.append(note)
        return lines.joined(separator: "\n")
    }
}
