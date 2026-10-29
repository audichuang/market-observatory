enum OutlookRecordCopy {
    // List section footers need one Text to keep both the explanation and the API note visible.
    static func upFooter(_ track: OutlookPage.LiveTrack?) -> String? {
        guard let track else { return nil }
        let explanation = "合併所有已發布的模型版本；每列以紀錄日收盤為起點。這是和樣本內、滾動驗證分開的第三種分數。"
        return [explanation, track.note].compactMap { $0 }.joined(separator: "\n")
    }
}
