export const RESEARCH_FIELDS = [
  { label: "企業驅動", prompt: "營收靠哪些業務與客戶？競爭、供應鏈與監管風險是什麼？" },
  { label: "盈餘假設", prompt: "營收的量、價、組合，利潤率與股數各怎麼假設？每個假設附來源與日期。" },
  { label: "與共識的差異", prompt: "你的理解和市場共識差在哪個假設？不知道就寫不知道。" },
  { label: "估值敏感度", prompt: "用哪種方法看估值？哪個假設改變時，結論會跟著改變？" },
  { label: "下一個核對事件", prompt: "哪一次財報、產品或法規事件可以核對？到時要看哪個數字？不預填漲跌方向。" },
  { label: "反證", prompt: "哪些看得到的結果會讓目前的理解不成立？有利與不利的證據都記下來。" },
  { label: "論點失效條件", prompt: "如果論點錯了，最可能是哪個營運假設錯了？" },
] as const;

export const RESEARCH_NOTE = "這張表只整理研究問題，不是評等、目標價或買賣建議；本站不保存你填的內容。";

export function edgarFilingsUrl(ticker: string): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(ticker)}&owner=include&count=40`;
}

export const IR_URLS: Readonly<Partial<Record<string, string>>> = {
  NVDA: "https://investor.nvidia.com/",
  AAPL: "https://investor.apple.com/",
  MSFT: "https://www.microsoft.com/en-us/investor",
  AMZN: "https://ir.aboutamazon.com/",
  GOOGL: "https://abc.xyz/investor/",
  META: "https://investor.atmeta.com/",
  TSLA: "https://ir.tesla.com/",
};

export function researchTemplate({ company, ticker, date }: { company: string; ticker: string; date: string }): string {
  const irUrl = IR_URLS[ticker];
  return [
    `${company}（${ticker}）研究表 ${date}`,
    `SEC 申報：${edgarFilingsUrl(ticker)}`,
    ...(irUrl ? [`公司 IR：${irUrl}`] : []),
    "",
    ...RESEARCH_FIELDS.flatMap(({ label, prompt }, i) => [`${i + 1}. ${label}：${prompt}`, ""]),
    RESEARCH_NOTE,
  ].join("\n");
}
