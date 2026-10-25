import { type Budget, type DailyBar, SourceError, fetchWithTimeout, finiteOrNull } from "./http.ts";

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

export async function fetchYahooDaily(providerSymbol: string, range = "1mo", budget?: Budget): Promise<DailyBar[]> {
  const res = await fetchWithTimeout(YAHOO_SOURCE, yahooChartUrl(providerSymbol, range), {
    headers: { Accept: "application/json" },
    budget,
  });
  return parseYahooChart((await res.json()) as ChartJson, providerSymbol);
}

type ChartResult = NonNullable<NonNullable<ChartJson["chart"]>["result"]>;

interface SparkJson {
  spark?: { result?: { symbol?: string; response?: ChartResult }[] | null };
}

/** Yahoo spark 一次最多 20 檔（實測 25 檔回 HTTP 400）。 */
export const SPARK_MAX = 20;

export function yahooSparkUrl(providerSymbols: string[], range: string): string {
  return `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${providerSymbols.map(encodeURIComponent).join(",")}&range=${range}&interval=1d`;
}

/**
 * 解析 spark：每檔是一份精簡的 chart 結果（只有收盤，沒有開高低量）。回傳 代號 → 日線；
 * 沒回來、或解析失敗的代號不放進結果，由呼叫端決定要不要改用單檔 chart 補抓。
 */
export function parseYahooSpark(json: SparkJson): Map<string, DailyBar[]> {
  const out = new Map<string, DailyBar[]>();
  for (const r of json.spark?.result ?? []) {
    const chart = r.response?.[0];
    if (!r.symbol || !chart) continue;
    try {
      const bars = parseYahooChart({ chart: { result: [chart] } }, r.symbol);
      if (bars.length) out.set(r.symbol, bars);
    } catch {
      // 單檔解析失敗就略過
    }
  }
  return out;
}

/**
 * 一次請求抓多檔的日收盤（Yahoo spark，每 20 檔一個請求），收盤值與單檔 chart 相同（浮點精度到小數第 4 位左右）。
 * 每天的收盤更新用這個：名單 12 家、連 ETF 約 30 檔只要 2 個請求，逐檔打 chart 要 30 個。
 * 某一批整個失敗不丟錯，該批代號就不在結果裡。
 */
export async function fetchYahooSpark(providerSymbols: string[], range: string, budget?: Budget): Promise<{ bars: Map<string, DailyBar[]>; errors: string[] }> {
  const bars = new Map<string, DailyBar[]>();
  const errors: string[] = [];
  for (let i = 0; i < providerSymbols.length; i += SPARK_MAX) {
    const chunk = providerSymbols.slice(i, i + SPARK_MAX);
    try {
      const res = await fetchWithTimeout(YAHOO_SOURCE, yahooSparkUrl(chunk, range), { headers: { Accept: "application/json" }, budget });
      for (const [s, b] of parseYahooSpark((await res.json()) as SparkJson)) if (chunk.includes(s)) bars.set(s, b);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { bars, errors };
}

/** 多檔的最後一筆收盤（替分析師目標價算隱含漲幅用）。 */
export async function fetchYahooLastCloses(symbols: string[], budget?: Budget): Promise<Map<string, { date: string; close: number }>> {
  const { bars, errors } = await fetchYahooSpark(symbols, "5d", budget);
  if (!bars.size && errors.length) throw new SourceError(YAHOO_SOURCE, errors[0]);
  const out = new Map<string, { date: string; close: number }>();
  for (const [s, b] of bars) {
    const last = b.at(-1);
    if (last) out.set(s, { date: last.date, close: last.close });
  }
  return out;
}
