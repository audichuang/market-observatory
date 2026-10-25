import { unzipSync, strFromU8 } from "fflate";
import { type Budget, SourceError, fetchWithTimeout, parseLooseNumber } from "./http.ts";

export const SSGA_SOURCE = "ssga-spy-holdings";
export const SSGA_SPY_URL =
  "https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx";
export const SSGA_DISPLAY_URL = "https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy";

export interface Holding {
  ticker: string;
  name: string;
  weightPct: number;
  shares: number | null;
}

export interface HoldingsFile {
  asOf: string;
  holdings: Holding[];
}

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

const decodeXml = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** 把 xlsx 第一張工作表讀成字串二維陣列（只處理 SSGA 這份檔案用到的 shared string 與數值）。 */
export function readFirstSheet(xlsx: Uint8Array): string[][] {
  const files = unzipSync(xlsx, { filter: (f) => f.name === "xl/sharedStrings.xml" || f.name === "xl/worksheets/sheet1.xml" });
  const sheet = files["xl/worksheets/sheet1.xml"];
  if (!sheet) throw new SourceError(SSGA_SOURCE, "xlsx 裡沒有 sheet1");
  const shared = files["xl/sharedStrings.xml"]
    ? [...strFromU8(files["xl/sharedStrings.xml"]).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decodeXml(m[1]))
    : [];
  const rows: string[][] = [];
  for (const rowMatch of strFromU8(sheet).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const c of rowMatch[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const colIdx = [...c[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const raw = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? "")?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3] ?? "")?.[1] ?? "";
      row[colIdx] = /t="s"/.test(c[2]) && raw !== "" ? (shared[Number(raw)] ?? "") : decodeXml(raw);
    }
    rows.push(Array.from(row, (v) => v ?? ""));
  }
  return rows;
}

/** 解析 SSGA 持股表：表頭上方有「Holdings: As of 22-Oct-2026」，權重欄單位是 %。 */
export function parseSpyHoldings(rows: string[][]): HoldingsFile {
  let asOf: string | null = null;
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const joined = rows[i].join(" ");
    const m = /As of (\d{1,2})-([A-Z][a-z]{2})-(\d{4})/.exec(joined);
    if (m && MONTHS[m[2]]) asOf = `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`;
    if (rows[i][0]?.trim() === "Name" && rows[i].includes("Weight")) {
      headerIdx = i;
      break;
    }
  }
  if (!asOf) throw new SourceError(SSGA_SOURCE, "找不到持股日期（As of）");
  if (headerIdx < 0) throw new SourceError(SSGA_SOURCE, "找不到表頭");
  const header = rows[headerIdx];
  const col = (name: string) => header.indexOf(name);
  const [iName, iTicker, iWeight, iShares] = [col("Name"), col("Ticker"), col("Weight"), col("Shares Held")];
  const holdings: Holding[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const ticker = r[iTicker]?.trim();
    const weight = parseLooseNumber(r[iWeight]);
    if (!ticker || ticker === "-" || weight === null) continue;
    holdings.push({ ticker: ticker.replace(/\./g, "-"), name: r[iName]?.trim() ?? ticker, weightPct: weight, shares: iShares >= 0 ? parseLooseNumber(r[iShares]) : null });
  }
  const total = holdings.reduce((s, h) => s + h.weightPct, 0);
  if (holdings.length < 400 || total < 95 || total > 105) {
    throw new SourceError(SSGA_SOURCE, `持股表不完整：${holdings.length} 檔、權重合計 ${total.toFixed(2)}%`);
  }
  return { asOf, holdings };
}

export async function fetchSpyHoldings(budget?: Budget): Promise<HoldingsFile> {
  const res = await fetchWithTimeout(SSGA_SOURCE, SSGA_SPY_URL, { timeoutMs: 30000, budget });
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new SourceError(SSGA_SOURCE, "回應不是 xlsx（可能被導到網頁）");
  return parseSpyHoldings(readFirstSheet(buf));
}
