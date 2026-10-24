import { type DailyBar, SourceError, fetchWithTimeout, finiteOrNull } from "./http.ts";

export const YAHOO_SOURCE = "yahoo-chart";

export function yahooChartUrl(providerSymbol: string, range: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?range=${range}&interval=1d&includePrePost=false`;
}

export function yahooDisplayUrl(providerSymbol: string): string {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(providerSymbol)}/history/`;
}

interface ChartJson {
  chart?: {
    result?: {
      meta?: { symbol?: string; exchangeTimezoneName?: string };
      timestamp?: number[];
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
    }[];
    error?: { code?: string; description?: string } | null;
  };
}

/**
 * 解析 Yahoo chart JSON。close 是拆股調整後、不含股息的收盤價（不是 Adj Close）。
 * 同一天出現兩筆時保留最後一筆；close 為空的列直接丟掉。
 */
export function parseYahooChart(json: ChartJson, expectSymbol: string): DailyBar[] {
  const result = json.chart?.result?.[0];
  if (!result) {
    const err = json.chart?.error;
    throw new SourceError(YAHOO_SOURCE, `沒有結果 ${err?.code ?? ""} ${err?.description ?? ""}`.trim());
  }
  if (result.meta?.symbol && result.meta.symbol.toUpperCase() !== expectSymbol.toUpperCase()) {
    throw new SourceError(YAHOO_SOURCE, `回傳代號 ${result.meta.symbol} 與要求的 ${expectSymbol} 不同`);
  }
  const tz = result.meta?.exchangeTimezoneName || "America/New_York";
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const q = result.indicators?.quote?.[0] ?? {};
  const byDate = new Map<string, DailyBar>();
  (result.timestamp ?? []).forEach((ts, i) => {
    const close = finiteOrNull(q.close?.[i]);
    if (close === null || close <= 0) return;
    const date = fmt.format(new Date(ts * 1000));
    byDate.set(date, {
      date,
      open: finiteOrNull(q.open?.[i]),
      high: finiteOrNull(q.high?.[i]),
      low: finiteOrNull(q.low?.[i]),
      close,
      volume: finiteOrNull(q.volume?.[i]),
    });
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchYahooDaily(providerSymbol: string, range = "1mo"): Promise<DailyBar[]> {
  const res = await fetchWithTimeout(YAHOO_SOURCE, yahooChartUrl(providerSymbol, range), {
    headers: { Accept: "application/json" },
  });
  return parseYahooChart((await res.json()) as ChartJson, providerSymbol);
}

type ChartResult = NonNullable<NonNullable<ChartJson["chart"]>["result"]>;

interface SparkJson {
  spark?: { result?: { symbol?: string; response?: ChartResult }[] | null };
}

/**
 * 一次請求取多檔的近期日收盤（Yahoo spark，每次最多 20 檔），回傳 代號 → 最後一筆收盤。
 * 用來替分析師目標價算隱含漲幅，不必逐檔打 chart。
 */
export async function fetchYahooLastCloses(symbols: string[]): Promise<Map<string, { date: string; close: number }>> {
  const out = new Map<string, { date: string; close: number }>();
  for (let i = 0; i < symbols.length; i += 20) {
    const chunk = symbols.slice(i, i + 20);
    const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${chunk.map(encodeURIComponent).join(",")}&range=5d&interval=1d`;
    const res = await fetchWithTimeout(YAHOO_SOURCE, url, { headers: { Accept: "application/json" } });
    const json = (await res.json()) as SparkJson;
    for (const r of json.spark?.result ?? []) {
      const chart = r.response?.[0];
      if (!r.symbol || !chart) continue;
      try {
        const bars = parseYahooChart({ chart: { result: [chart] } }, r.symbol);
        const last = bars.at(-1);
        if (last) out.set(r.symbol, { date: last.date, close: last.close });
      } catch {
        // 單檔解析失敗就略過
      }
    }
  }
  return out;
}
