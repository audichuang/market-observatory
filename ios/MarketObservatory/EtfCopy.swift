extension Copy {
    static let dcaLumpPremise = "假設整筆資金在期初已備妥；逐月新收入無法照此提前投入。"
    static let dcaBuyRule = "首筆在試算起點當天或之後的第一個交易日、之後每月第一個交易日，以收盤價買入；首月可能不是完整月份"
    static let dcaFxRule = "換匯用買入日的 USD/TWD，當天沒有匯率時沿用之前最近一筆"
    static let fundingMonthlyLabel = "每月新收入"
    static let fundingLumpLabel = "期初已有整筆資金"
    static let dcaMonthlyNoLump = "每月新收入無法在期初一次投入，所以這裡不列一次投入對照；期初已有整筆資金時，資金類型改選「期初已有整筆資金」。"
    static let dcaIdleCash = "分批期間還沒投入的現金不計利息。"
    static let evidence1x = "一次投入與定期定額的歷史研究只涵蓋非槓桿、正向 1x 的股票產品；這裡的試算是過去一段期間的算術結果，不代表未來。"
    static let evidenceLeveraged = "這是每日重設的槓桿或反向產品：持有超過一天，報酬會偏離「倍數 × 指數報酬」，盤整或大波動時偏離通常更大。一般定投與一次投入的研究結論不適用這類產品，這裡的試算只是這段歷史的算術結果。"
}
