import { type Budget, type DailyBar, SourceError, fetchWithTimeout, mdyToIso, parseLooseNumber } from "./http.ts";

export const CBOE_SOURCE = "cboe";

export const CBOE_URLS = {
  VIX: "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv",
  SPX: "https://cdn.cboe.com/api/global/us_indices/daily_prices/SPX_History.csv",
} as const;

/**
 * Cboe 歷史 CSV：VIX 有 DATE,OPEN,HIGH,LOW,CLOSE；SPX 只有 DATE,SPX 兩欄。
 * 只回傳 since（含）之後的列，避免把三十年資料都塞進記憶體以外的地方。
 */
export function parseCboeCsv(text: string, since = "0000-00-00"): DailyBar[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift()?.split(",").map((h) => h.trim().toUpperCase()) ?? [];
  if (header[0] !== "DATE") throw new SourceError(CBOE_SOURCE, `CSV 表頭不符：${header.join(",")}`);
  const closeIdx = header.includes("CLOSE") ? header.indexOf("CLOSE") : 1;
  const col = (name: string) => header.indexOf(name);
  const out: DailyBar[] = [];
  // 檔案依日期遞增；從尾端往回讀，遇到早於 since 就停，省下 Worker 的 CPU 時間。
  for (let i = lines.length - 1; i >= 0; i--) {
    const cells = lines[i].split(",");
    const date = mdyToIso(cells[0] ?? "");
    if (!date) continue;
    if (date < since) break;
    const close = parseLooseNumber(cells[closeIdx]);
    if (close === null || close <= 0) continue;
    const pick = (name: string) => (col(name) >= 0 ? parseLooseNumber(cells[col(name)]) : null);
    out.push({ date, open: pick("OPEN"), high: pick("HIGH"), low: pick("LOW"), close, volume: null });
  }
  return out.reverse();
}

export async function fetchCboeDaily(which: keyof typeof CBOE_URLS, since: string, budget?: Budget): Promise<DailyBar[]> {
  const res = await fetchWithTimeout(CBOE_SOURCE, CBOE_URLS[which], { timeoutMs: 30000, budget });
  return parseCboeCsv(await res.text(), since);
}
