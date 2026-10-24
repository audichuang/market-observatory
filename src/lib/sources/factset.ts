import { SourceError, fetchWithTimeout } from "./http.ts";

// FactSet Earnings Insight 週報（每週五）：用全部 S&P 500 成分股的分析師目標價「由下而上」加總出指數目標價，
// 也就是「個股預測按權重反推指數」的現成版本。固定網址會轉到最新一期 PDF。
export const FACTSET_SOURCE = "factset-earnings-insight";
export const FACTSET_LATEST_URL = "https://www.factset.com/earningsinsight";

export interface FactsetInsight {
  /** 報告檔名裡的日期（MMDDYY → YYYY-MM-DD） */
  reportDate: string | null;
  pdfUrl: string;
  bottomUpTarget: number | null;
  upsidePct: number | null;
  referenceClose: number | null;
  buyPct: number | null;
  holdPct: number | null;
  sellPct: number | null;
  forwardPE: number | null;
  forwardPE5y: number | null;
  forwardPE10y: number | null;
}

const num = (s: string | undefined) => (s === undefined ? null : Number(s.replace(/,/g, "")));
const NUMBER = "(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)";

/**
 * 從週報全文抽出數字。PDF 的文字常在數字中間夾空白（「9, 3 14 . 37」），
 * 所以先把所有空白拿掉，再比對固定句型。句型改版就回 null，不硬猜。
 */
export function parseInsightText(text: string, pdfUrl: string): FactsetInsight {
  const c = text.replace(/\s+/g, "");
  const tp = new RegExp(`bottom-uptargetpricefortheS&P500is${NUMBER},whichis${NUMBER}%(above|below)theclosingpriceof${NUMBER}`).exec(c);
  const rt = new RegExp(`Ofthese[\\d,]+ratings,${NUMBER}%areBuyratings,${NUMBER}%areHoldratings,and${NUMBER}%areSellratings`).exec(c);
  const pe = new RegExp(`forward12-monthP/EratiofortheS&P500is${NUMBER}`, "i").exec(c);
  const pe5 = new RegExp(`5-yearaverage\\(${NUMBER}\\)`).exec(c);
  const pe10 = new RegExp(`10-yearaverage\\(${NUMBER}\\)`).exec(c);
  const d = /EarningsInsight_(\d{2})(\d{2})(\d{2})/.exec(pdfUrl);
  return {
    reportDate: d ? `20${d[3]}-${d[1]}-${d[2]}` : null,
    pdfUrl,
    bottomUpTarget: num(tp?.[1]),
    upsidePct: tp ? (tp[3] === "below" ? -1 : 1) * (num(tp[2]) as number) : null,
    referenceClose: num(tp?.[4]),
    buyPct: num(rt?.[1]),
    holdPct: num(rt?.[2]),
    sellPct: num(rt?.[3]),
    forwardPE: num(pe?.[1]),
    forwardPE5y: num(pe5?.[1]),
    forwardPE10y: num(pe10?.[1]),
  };
}

async function inflate(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream("deflate"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let out = "";
  for (let i = 0; i < buf.length; i += 8192) out += String.fromCharCode(...buf.subarray(i, i + 8192));
  return out;
}

const unescapePdf = (x: string) =>
  x.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, ch: string) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" })[ch] ?? String.fromCharCode(parseInt(ch, 8)));

/** 只處理這份週報用到的格式：FlateDecode 內容流、TJ/Tj 的一般字串（非 CID 字型）。 */
export async function extractPdfText(pdf: Uint8Array): Promise<string> {
  let s = "";
  for (let i = 0; i < pdf.length; i += 8192) s += String.fromCharCode(...pdf.subarray(i, i + 8192));
  const re = /\d+\s+\d+\s+obj\s*<<((?:(?!endobj)[\s\S])*?)>>\s*stream\r?\n/g;
  const pages: string[] = [];
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const dict = m[1];
    if (!/FlateDecode/.test(dict) || /\/Subtype\s*\/(Image|Form)|FontFile|\/Type\s*\/(ObjStm|XRef|XObject)/.test(dict)) continue;
    const start = m.index + m[0].length;
    const len = /\/Length\s+(\d+)(?![\d\s]*R)/.exec(dict);
    const end = len ? start + Number(len[1]) : s.indexOf("endstream", start);
    let content: string;
    try {
      content = await inflate(pdf.subarray(start, end));
    } catch {
      continue;
    }
    let out = "";
    for (const blk of content.match(/BT[\s\S]*?ET/g) ?? []) {
      for (const op of blk.matchAll(/\[((?:\\.|[^\]])*)\]\s*TJ|\(((?:\\.|[^)])*)\)\s*Tj|(T\*|Td|TD|Tm)/g)) {
        if (op[3]) out += " ";
        else if (op[2] !== undefined) out += unescapePdf(op[2]);
        else for (const part of op[1].matchAll(/\(((?:\\.|[^)])*)\)|(-?\d+(?:\.\d+)?)/g)) out += part[1] !== undefined ? unescapePdf(part[1]) : Number(part[2]) < -200 ? " " : "";
      }
      out += " ";
    }
    if (out.trim()) pages.push(out);
  }
  return pages.join("\n");
}

/** 只取轉址後的 PDF 網址（不下載本體），用來判斷有沒有新的一期。 */
export async function latestInsightUrl(): Promise<string> {
  const res = await fetch(FACTSET_LATEST_URL, { redirect: "manual", signal: AbortSignal.timeout(15000) });
  const loc = res.headers.get("location");
  if (!loc) throw new SourceError(FACTSET_SOURCE, `沒有轉址（HTTP ${res.status}）`);
  return new URL(loc, FACTSET_LATEST_URL).toString();
}

export async function fetchInsight(pdfUrl: string): Promise<FactsetInsight> {
  const res = await fetchWithTimeout(FACTSET_SOURCE, pdfUrl, { timeoutMs: 40000 });
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") throw new SourceError(FACTSET_SOURCE, "回應不是 PDF");
  const insight = parseInsightText(await extractPdfText(bytes), pdfUrl);
  if (insight.bottomUpTarget === null) throw new SourceError(FACTSET_SOURCE, "找不到由下而上目標價（週報版面可能改了）");
  return insight;
}
