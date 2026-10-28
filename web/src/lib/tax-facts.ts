export interface TaxSource {
  name: string;
  url: string;
  sourceDate: string | null;
  checkedAt: string;
}

export const US_DIVIDEND_WITHHOLDING = {
  pct: 30,
  appliesTo: "台灣稅務居民、非美國公民且非美國稅務居民、無適用協定的一般股利",
  sources: [
    { name: "IRS Publication 515 (2026)", url: "https://www.irs.gov/publications/p515", sourceDate: "2026", checkedAt: "2026-10-28" },
    { name: "IRS 所得稅協定 A–Z（未列台灣）", url: "https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z", sourceDate: null, checkedAt: "2026-10-28" },
  ] satisfies TaxSource[],
};

export const US_FUND_LEVEL_WITHHOLDING = {
  pct: 0,
  appliesTo: "美國註冊基金持有美股的基金層美國股利預扣",
  sources: [
    { name: "State Street：美國註冊 ETF 的基金層預扣", url: "https://www.ssga.com/hk/en/institutional/insights/considerations-for-non-us-investors-us-etfs-vs-irish-ucits", sourceDate: "2026-06-02", checkedAt: "2026-10-28" },
  ] satisfies TaxSource[],
};

export interface TaxChecklist {
  id: string;
  title: string;
  items: string[];
  note: string | null;
  footer: string;
  sources: { label: string; url: string; updatedAt: string; checkedAt: string }[];
}

const checklistFooter = "這是資料檢查清單，不計算你的應納稅額或遺產稅額，也不提供買賣、持有或換產品的建議；實際以主管機關規定與你的申報資料為準。";

export const TAX_CHECKLISTS: TaxChecklist[] = [
  {
    id: "tw-overseas-income",
    title: "台灣家庭海外所得（最低稅負）資料檢查",
    items: [
      "以申報戶全年合計的海外所得來看，不是單一帳戶。",
      "申報戶全年海外所得未達新台幣 100 萬元，免計入基本所得額；達 100 萬元時要全數計入，不是只算超過的部分。",
      "基本所得額未達 750 萬元，沒有繳納基本稅額的問題；超過時先扣除 750 萬元，餘額按 20% 計算基本稅額。",
      "基本稅額要和一般所得稅額比較，基本稅額較高時才有差額問題；不是海外所得一律另課 20%。",
      "海外已納稅額可以扣抵，但有扣抵限額，並以所得來源地稅務機關發給的同一年度納稅證明為準。",
      "海外財產交易所得依成本費用、實現年度與損失扣除規則計算；匯回多少錢不等於所得。",
      "基金在基金層被扣的股利稅（例如愛爾蘭註冊 UCITS 的內層扣繳），不能未經確認就當成你個人可扣抵的外國稅；累積型基金賣出實現的所得仍依台灣規則判定，不是免稅工具。",
    ],
    note: "財政部頁面沒有標明這些金額適用的所得年度；申報前以財政部當年度公告為準。",
    footer: checklistFooter,
    sources: [{
      label: "財政部稅務入口網（第十至十三題）",
      url: "https://www.etax.nat.gov.tw/etwmain/tax-info/understanding/tax-saving-manual/national/individual-income-tax/6xKrvGR",
      updatedAt: "2026-04-15", checkedAt: "2026-10-28",
    }],
  },
  {
    id: "us-estate",
    title: "美國遺產稅申報資料檢討",
    items: [
      "先確認身分：本清單只適用非美國公民、非美國居民；美國遺產稅的居住地（domicile）另外判定。",
      "把所有帳戶（含複委託、海外券商）持有的美國所在地資產合計，不能只看單一券商；美國公司股票與美國註冊 ETF 一般屬美國所在地資產，不論憑證放在哪裡。",
      "加上相關的贈與調整（gift tax specific exemption 與 adjusted taxable gifts）。",
      "合計超過 US$60,000 時，身故後通常須申報 Form 706-NA（一般在死亡後九個月內）；這是申報門檻，不是稅額，也不是賣出訊號。",
      "愛爾蘭等非美國註冊基金的股份，依 IRS 706-NA 說明的股票規則推論一般不屬美國公司股票；信託、聯名、棄籍等情況要個案確認。",
    ],
    note: null,
    footer: checklistFooter,
    sources: [
      {
        label: "IRS「Estate tax for nonresidents not citizens of the United States」",
        url: "https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax-for-nonresidents-not-citizens-of-the-united-states",
        updatedAt: "2026-06-28", checkedAt: "2026-10-28",
      },
      {
        label: "IRS Instructions for Form 706-NA", url: "https://www.irs.gov/instructions/i706na",
        updatedAt: "2025-09", checkedAt: "2026-10-28",
      },
    ],
  },
];
