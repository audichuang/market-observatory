import assert from "node:assert/strict";
import { test } from "node:test";
import { overlapPreview, parseOverlapQuery } from "../src/lib/overlap.ts";
import { ETFS, type WatchMember } from "../src/lib/universe.ts";
import { MAX_WATCH, memberWeights, type Holding } from "../src/lib/watchlist.ts";

const holdings: Holding[] = [
  { ticker: "NVDA", name: "NVIDIA CORP", weightPct: 7 },
  { ticker: "GOOGL", name: "ALPHABET INC CL A", weightPct: 2 },
  { ticker: "GOOG", name: "ALPHABET INC CL C", weightPct: 1.8 },
  { ticker: "AAPL", name: "APPLE INC", weightPct: 6 },
];
const list: WatchMember[] = [
  { key: "NVDA", company: "Nvidia", tickers: ["NVDA"] },
  { key: "GOOGL", company: "Alphabet", tickers: ["GOOGL", "GOOG"] },
];
const query = (values: Record<string, string | undefined>) => parseOverlapQuery((key) => values[key], list);
const preview = (input: ReturnType<typeof query> = null, ticker = "SPY", rows = holdings, members = list) => overlapPreview({
  list: members, holdings: rows, asOf: "2026-10-28", etf: ETFS.find((e) => e.ticker === ticker)!, input,
});

test("重疊按公司合併股類，只有填入的 ETF 與直接持有金額計入假設曝險", () => {
  const result = preview(query({ ovEtf: "100000", ov: "NVDA:50000" }));
  assert.deepEqual(result.members, [
    { ...list[0], weightPct: 7, outOfIndex: [] },
    { ...list[1], weightPct: 3.8, outOfIndex: [] },
  ]);
  assert.equal(result.totalWeight, 10.8);
  assert.equal(result.top10CompanyWeight, 16.8);
  assert.equal(result.asOf, "2026-10-28");
  assert.equal(result.proxy, "SPY");
  assert.equal(result.applicable, true);
  assert.equal(result.issue, null);
  assert.ok(result.exposure);
  assert.deepEqual(result.exposure.members[0], { key: "NVDA", viaEtfTwd: 7000, directTwd: 50000, combinedTwd: 57000, sharePct: 38 });
  assert.equal(result.exposure.totalTwd, 150000);
  assert.equal(result.exposure.otherViaEtfTwd, 89200);
  assert.equal(result.exposure.watchlistSharePct, 60800 / 150000 * 100);
  assert.deepEqual(result.notes, [
    "以 2026-10-28 的 SPY 持股作指數代理推估",
    "觀察名單不是持倉；只有你填了金額才算假設曝險，這不是配置建議。",
  ]);
});

test("沒填金額只列重疊；非 SPY 帶代理差異句，槓桿及反向即使填金額也不估曝險", () => {
  assert.equal(query({}), null);
  assert.equal(preview().exposure, null);
  assert.equal(preview().inputs, null);
  assert.equal(preview(null, "VOO").notes[0], "以 2026-10-28 的 SPY 持股作指數代理推估；VOO 的實際持股可能略有不同");
  for (const ticker of ["UPRO", "SH"]) {
    const result = preview(query({ ovEtf: "100000", ov: "NVDA:50000" }), ticker);
    assert.equal(result.applicable, false);
    assert.equal(result.exposure, null);
    assert.ok(result.inputs);
    assert.ok(result.notes.includes("槓桿與反向 ETF 用衍生工具達成每日倍數，不適用持股重疊推估。"));
  }
});

test("金額可只填一邊或為零；零總額沒有可定義的占比", () => {
  assert.deepEqual(query({ ovEtf: "100000" }), { ovEtf: 100000, ov: {} });
  assert.deepEqual(query({ ov: "NVDA:50000" }), { ovEtf: 0, ov: { NVDA: 50000 } });
  assert.equal(preview(query({ ov: "NVDA:50000" })).exposure?.members[0].sharePct, 100);
  const zero = preview(query({ ovEtf: "0", ov: "NVDA:0" })).exposure;
  assert.ok(zero);
  assert.equal(zero.totalTwd, 0);
  assert.equal(zero.watchlistSharePct, null);
  assert.equal(zero.members[0].sharePct, null);
  assert.deepEqual(query({ ovEtf: "1000000000", ov: "NVDA:1000000000" }), { ovEtf: 1_000_000_000, ov: { NVDA: 1_000_000_000 } });
});

test("查詢拒絕名單外、格式錯誤、重複、超過筆數及非範圍內整數的金額，不計算曝險", () => {
  for (const values of [
    { ov: "ZZZZ:1" }, { ov: "GOOG:1" }, { ov: "NVDA:1,NVDA:2" },
    { ov: "NVDA" }, { ov: "NVDA:1:2" }, { ov: "NVDA:1," }, { ov: "" },
    ...["1000000001", "-1", "1.5", "NaN", "Infinity", "1e3", "", " "].flatMap((value) => [{ ovEtf: value }, { ov: `NVDA:${value}` }]),
    { ov: Array.from({ length: MAX_WATCH + 1 }, () => "NVDA:1").join(",") },
  ]) {
    const input = query(values);
    assert.ok(input && "issue" in input, JSON.stringify(values));
    const result = preview(input);
    assert.equal(result.issue, input.issue);
    assert.equal(result.inputs, null);
    assert.equal(result.exposure, null);
  }
  const many = Array.from({ length: MAX_WATCH }, (_, i) => ({ key: `K${i}`, company: `Company ${i}`, tickers: [`K${i}`] }));
  const input = parseOverlapQuery(() => undefined, many);
  assert.equal(input, null);
  const full = parseOverlapQuery((key) => key === "ov" ? many.map((m) => `${m.key}:1`).join(",") : undefined, many);
  assert.ok(full && !("issue" in full));
  assert.equal(Object.keys(full.ov).length, MAX_WATCH);
});

test("前十大按公司排序取十家且排除非股票列，名單外公司也計入", () => {
  const rows = [
    ...holdings,
    ...Array.from({ length: 10 }, (_, i) => ({ ticker: `X${String.fromCharCode(65 + i)}`, name: `COMPANY ${i}`, weightPct: 0.5 })),
    { ticker: "2602335D", name: "CASH", weightPct: 100 },
    { ticker: "ZERO", name: "ZERO CORP", weightPct: 0 },
  ];
  assert.equal(preview(null, "SPY", rows).top10CompanyWeight, 20.3);
});

test("共用名單權重保留部分股類調出與尚無持股檔的語意", () => {
  const partial = memberWeights(list, holdings.filter((h) => h.ticker !== "GOOG"));
  assert.deepEqual(partial.members[1], { ...list[1], weightPct: 2, outOfIndex: ["GOOG"] });
  assert.equal(partial.totalWeight, 9);
  assert.deepEqual(memberWeights(list, []), {
    members: list.map((m) => ({ ...m, weightPct: 0, outOfIndex: [] })), totalWeight: 0,
  });
});

test("首次啟動尚無持股檔時，填金額也不能把未知權重當零曝險", () => {
  const result = overlapPreview({ list, holdings: [], asOf: null, etf: ETFS[0], input: query({ ovEtf: "100000" }) });
  assert.equal(result.exposure, null);
  assert.equal(result.issue, "尚未取得 SPY 持股資料，無法計算假設曝險");
  assert.ok(result.notes.includes("尚未取得 SPY 持股資料，無法推估指數重疊。"));
});
