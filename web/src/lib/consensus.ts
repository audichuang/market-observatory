// 把個股分析師共識依 SPY 權重彙總成指數層級的數字。
// 只用 maxAgeDays 內更新過的個股；涵蓋權重一併回傳，涵蓋太少時呼叫端要標示「不完整」。

export interface ViewRow {
  symbol: string;
  asOf: string;
  price: number | null;
  priceDate?: string | null;
  targetMean: number | null;
  targetLow?: number | null;
  targetHigh?: number | null;
  buy: number;
  hold: number;
  sell: number;
  epsUp: number | null;
  epsDown: number | null;
  fiscalEnd?: string | null;
  estimates?: number | null;
}

interface Coverage {
  symbols: number;
  weightPct: number;
}

export interface Consensus {
  symbols: number;
  /** Index weight (%) of symbols with at least one usable metric. */
  coveredWeightPct: number;
  /** Rows that enter each metric's weighted average. */
  coverage: { target: Coverage; ratings: Coverage; revisions: Coverage };
  /** Fresh rows with no usable metric. */
  noData: Coverage;
  /** 權重加權的目標價隱含漲幅（%），只算有價格與目標價的個股 */
  impliedUpsidePct: number | null;
  /** 權重加權的「買進」評等占比（%） */
  buyPct: number | null;
  /** 權重加權的 EPS 修正廣度：(上修 − 下修) ÷ (上修 + 下修)，−1～1；近 4 週沒有修正的個股不計 */
  revisionBreadth: number | null;
  oldest: string | null;
  newest: string | null;
  priceOldest: string | null;
  priceNewest: string | null;
}

export const CONSENSUS_MAX_AGE_DAYS = 7;

export function consensusCutoff(today: string, maxAgeDays = CONSENSUS_MAX_AGE_DAYS): string {
  return new Date(Date.parse(`${today}T12:00:00Z`) - maxAgeDays * 86400000).toISOString().slice(0, 10);
}

export function freshLatestViews(rows: ViewRow[], weights: Map<string, number>, cutoff: string): ViewRow[] {
  const latest = new Map<string, ViewRow>();
  for (const r of rows) {
    if (r.asOf < cutoff || !weights.has(r.symbol)) continue;
    const prev = latest.get(r.symbol);
    if (!prev || r.asOf > prev.asOf) latest.set(r.symbol, r);
  }
  return [...latest.values()];
}

export function aggregateConsensus(rows: ViewRow[], weights: Map<string, number>, today: string, maxAgeDays = CONSENSUS_MAX_AGE_DAYS): Consensus {
  const latest = freshLatestViews(rows, weights, consensusCutoff(today, maxAgeDays));
  let covered = 0;
  let symbols = 0;
  const coverage = {
    target: { symbols: 0, weightPct: 0 },
    ratings: { symbols: 0, weightPct: 0 },
    revisions: { symbols: 0, weightPct: 0 },
  };
  const noData = { symbols: 0, weightPct: 0 };
  let upSum = 0;
  let buySum = 0;
  let revSum = 0;
  let oldest: string | null = null;
  let newest: string | null = null;
  let priceOldest: string | null = null;
  let priceNewest: string | null = null;
  for (const r of latest) {
    const w = weights.get(r.symbol)!;
    let usable = false;
    if (!oldest || r.asOf < oldest) oldest = r.asOf;
    if (!newest || r.asOf > newest) newest = r.asOf;
    if (r.price && r.targetMean && r.price > 0) {
      coverage.target.symbols++;
      coverage.target.weightPct += w;
      usable = true;
      upSum += w * (r.targetMean / r.price - 1);
      if (r.priceDate) {
        if (!priceOldest || r.priceDate < priceOldest) priceOldest = r.priceDate;
        if (!priceNewest || r.priceDate > priceNewest) priceNewest = r.priceDate;
      }
    }
    const ratings = r.buy + r.hold + r.sell;
    if (ratings > 0) {
      coverage.ratings.symbols++;
      coverage.ratings.weightPct += w;
      usable = true;
      buySum += (w * r.buy) / ratings;
    }
    const revisions = (r.epsUp ?? 0) + (r.epsDown ?? 0);
    if (revisions > 0) {
      coverage.revisions.symbols++;
      coverage.revisions.weightPct += w;
      usable = true;
      revSum += (w * ((r.epsUp ?? 0) - (r.epsDown ?? 0))) / revisions;
    }
    if (usable) {
      symbols++;
      covered += w;
    } else {
      noData.symbols++;
      noData.weightPct += w;
    }
  }
  return {
    symbols,
    coveredWeightPct: covered,
    coverage,
    noData,
    impliedUpsidePct: coverage.target.weightPct ? (upSum / coverage.target.weightPct) * 100 : null,
    buyPct: coverage.ratings.weightPct ? (buySum / coverage.ratings.weightPct) * 100 : null,
    revisionBreadth: coverage.revisions.weightPct ? revSum / coverage.revisions.weightPct : null,
    oldest,
    newest,
    priceOldest,
    priceNewest,
  };
}

/**
 * 分析師輪替：挑「最久沒嘗試過」的 n 檔。成功看 fetched_at，失敗看上次失敗時間，兩者取較新的；
 * 否則一直失敗的代號永遠排最前面，把每次的名額吃掉。
 */
export function rotationPicks(tickers: string[], lastFetched: Map<string, string>, lastFailed: Record<string, string>, n: number): string[] {
  const tried = (t: string) => {
    const a = lastFetched.get(t) ?? "";
    const b = lastFailed[t] ?? "";
    return a > b ? a : b;
  };
  return [...tickers].sort((a, b) => tried(a).localeCompare(tried(b))).slice(0, n);
}
