import assert from "node:assert/strict";
import { test } from "node:test";
import { RESEARCH_FIELDS, RESEARCH_NOTE, IR_URLS, edgarFilingsUrl, researchTemplate } from "../src/lib/research.ts";

test("研究範本全文與雙端共用規格逐字相同，每題後空一行且結尾不換行", () => {
  const expected = `NVIDIA（NVDA）研究表 2026-10-28
SEC 申報：https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=NVDA&owner=include&count=40
公司 IR：https://investor.nvidia.com/

1. 企業驅動：營收靠哪些業務與客戶？競爭、供應鏈與監管風險是什麼？

2. 盈餘假設：營收的量、價、組合，利潤率與股數各怎麼假設？每個假設附來源與日期。

3. 與共識的差異：你的理解和市場共識差在哪個假設？不知道就寫不知道。

4. 估值敏感度：用哪種方法看估值？哪個假設改變時，結論會跟著改變？

5. 下一個核對事件：哪一次財報、產品或法規事件可以核對？到時要看哪個數字？不預填漲跌方向。

6. 反證：哪些看得到的結果會讓目前的理解不成立？有利與不利的證據都記下來。

7. 論點失效條件：如果論點錯了，最可能是哪個營運假設錯了？

這張表只整理研究問題，不是評等、目標價或買賣建議；本站不保存你填的內容。`;
  assert.equal(researchTemplate({ company: "NVIDIA", ticker: "NVDA", date: "2026-10-28" }), expected);
  assert.equal(RESEARCH_NOTE, "這張表只整理研究問題，不是評等、目標價或買賣建議；本站不保存你填的內容。");
});

test("EDGAR 保留內部連字號代號，不轉成 Nasdaq 的點號寫法", () => {
  const url = edgarFilingsUrl("BRK-B");
  assert.equal(url, "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=BRK-B&owner=include&count=40");
  assert.ok(!url.includes("BRK.B"));
});

test("IR 只收錄預設名單七家已核對的 HTTPS 首頁", () => {
  assert.deepEqual(Object.keys(IR_URLS), ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA"]);
  assert.equal(IR_URLS.AVGO, undefined);
  assert.deepEqual(IR_URLS, {
    NVDA: "https://investor.nvidia.com/",
    AAPL: "https://investor.apple.com/",
    MSFT: "https://www.microsoft.com/en-us/investor",
    AMZN: "https://ir.aboutamazon.com/",
    GOOGL: "https://abc.xyz/investor/",
    META: "https://investor.atmeta.com/",
    TSLA: "https://ir.tesla.com/",
  });
  for (const url of Object.values(IR_URLS)) assert.ok(url?.startsWith("https://"));
  const template = researchTemplate({ company: "Broadcom", ticker: "AVGO", date: "2026-10-28" });
  assert.ok(!template.includes("公司 IR"));
  assert.ok(template.startsWith(`Broadcom（AVGO）研究表 2026-10-28\nSEC 申報：${edgarFilingsUrl("AVGO")}\n\n1. 企業驅動：`));
});

test("研究問題只有七題且不含評等、交易指令或計分欄位", () => {
  assert.deepEqual(RESEARCH_FIELDS.map(({ label }) => label), [
    "企業驅動", "盈餘假設", "與共識的差異", "估值敏感度", "下一個核對事件", "反證", "論點失效條件",
  ]);
  const forbidden = /評等|目標價|多空|加碼|減碼|停損|停利|買進|賣出|conviction|分數|總分/i;
  for (const { label, prompt } of RESEARCH_FIELDS) {
    assert.doesNotMatch(label, forbidden);
    assert.doesNotMatch(prompt, forbidden);
  }
});
