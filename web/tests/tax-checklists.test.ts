import assert from "node:assert/strict";
import { test } from "node:test";
import * as taxFacts from "../src/lib/tax-facts.ts";
import { etfsView } from "../src/server/views.ts";
import { migratedDb } from "./helpers/fake-cloudflare.ts";

const footer = "這是資料檢查清單，不計算你的應納稅額或遺產稅額，也不提供買賣、持有或換產品的建議；實際以主管機關規定與你的申報資料為準。";

test("稅務清單逐字符合 L5-T7，只有說明與具日期的官方來源", () => {
  assert.ok("TAX_CHECKLISTS" in taxFacts, "須提供兩份靜態稅務與傳承檢查清單");
  const checklists = taxFacts.TAX_CHECKLISTS;
  assert.deepEqual(checklists.map((checklist) => checklist.id), ["tw-overseas-income", "us-estate"]);
  const [tw, us] = checklists;
  assert.equal(tw.title, "台灣家庭海外所得（最低稅負）資料檢查");
  assert.deepEqual(tw.items, [
    "以申報戶全年合計的海外所得來看，不是單一帳戶。",
    "申報戶全年海外所得未達新台幣 100 萬元，免計入基本所得額；達 100 萬元時要全數計入，不是只算超過的部分。",
    "基本所得額未達 750 萬元，沒有繳納基本稅額的問題；超過時先扣除 750 萬元，餘額按 20% 計算基本稅額。",
    "基本稅額要和一般所得稅額比較，基本稅額較高時才有差額問題；不是海外所得一律另課 20%。",
    "海外已納稅額可以扣抵，但有扣抵限額，並以所得來源地稅務機關發給的同一年度納稅證明為準。",
    "海外財產交易所得依成本費用、實現年度與損失扣除規則計算；匯回多少錢不等於所得。",
    "基金在基金層被扣的股利稅（例如愛爾蘭註冊 UCITS 的內層扣繳），不能未經確認就當成你個人可扣抵的外國稅；累積型基金賣出實現的所得仍依台灣規則判定，不是免稅工具。",
  ]);
  assert.equal(tw.note, "財政部頁面沒有標明這些金額適用的所得年度；申報前以財政部當年度公告為準。");
  assert.deepEqual(tw.sources, [{
    label: "財政部稅務入口網（第十至十三題）",
    url: "https://www.etax.nat.gov.tw/etwmain/tax-info/understanding/tax-saving-manual/national/individual-income-tax/6xKrvGR",
    updatedAt: "2026-04-15", checkedAt: "2026-10-28",
  }]);
  assert.equal(us.title, "美國遺產稅申報資料檢討");
  assert.deepEqual(us.items, [
    "先確認身分：本清單只適用非美國公民、非美國居民；美國遺產稅的居住地（domicile）另外判定。",
    "把所有帳戶（含複委託、海外券商）持有的美國所在地資產合計，不能只看單一券商；美國公司股票與美國註冊 ETF 一般屬美國所在地資產，不論憑證放在哪裡。",
    "加上相關的贈與調整（gift tax specific exemption 與 adjusted taxable gifts）。",
    "合計超過 US$60,000 時，身故後通常須申報 Form 706-NA（一般在死亡後九個月內）；這是申報門檻，不是稅額，也不是賣出訊號。",
    "愛爾蘭等非美國註冊基金的股份，依 IRS 706-NA 說明的股票規則推論一般不屬美國公司股票；信託、聯名、棄籍等情況要個案確認。",
  ]);
  assert.equal(us.note, null);
  assert.deepEqual(us.sources, [
    {
      label: "IRS「Estate tax for nonresidents not citizens of the United States」",
      url: "https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax-for-nonresidents-not-citizens-of-the-united-states",
      updatedAt: "2026-06-28", checkedAt: "2026-10-28",
    },
    {
      label: "IRS Instructions for Form 706-NA", url: "https://www.irs.gov/instructions/i706na",
      updatedAt: "2025-09", checkedAt: "2026-10-28",
    },
  ]);
  for (const checklist of checklists) {
    assert.deepEqual(Object.keys(checklist).sort(), ["footer", "id", "items", "note", "sources", "title"], "不帶金額輸入或計算欄位");
    assert.equal(checklist.footer, footer);
    for (const item of checklist.items) assert.doesNotMatch(item, /(建議|應該|應)(賣出|買進|加碼|停扣|持有|換成)/);
    assert.ok(checklist.sources.length > 0);
    for (const source of checklist.sources) {
      assert.deepEqual(Object.keys(source).sort(), ["checkedAt", "label", "updatedAt", "url"]);
      assert.ok(source.url.startsWith("https://"));
      for (const date of [source.updatedAt, source.checkedAt]) {
        assert.match(date, /^\d{4}-\d{2}(?:-\d{2})?$/);
        assert.ok(Number.isFinite(Date.parse(date)), date);
        assert.equal(new Date(date).toISOString().slice(0, date.length), date);
      }
    }
  }
  for (const text of ["100 萬元", "全數計入", "750 萬元", "20%", "同一年度納稅證明"]) assert.ok(tw.items.join("").includes(text));
  for (const text of ["US$60,000", "706-NA", "贈與", "不是賣出訊號"]) assert.ok(us.items.join("").includes(text));
});

test("etfsView 頂層提供完整靜態清單，不需要個人金額", async () => {
  const { db, sql } = await migratedDb();
  try {
    const data = await etfsView({
      env: { DB: db }, req: { query: () => undefined, url: "http://localhost/etfs" },
    }, { id: "tax-checklists", email: "etf@example.test", name: "", isOwner: false });
    assert.deepEqual(data.checklists, taxFacts.TAX_CHECKLISTS);
  } finally {
    sql.close();
  }
});
