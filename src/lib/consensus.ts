// 把個股分析師共識依 SPY 權重彙總成指數層級的數字。
// 只用 maxAgeDays 內更新過的個股；涵蓋權重一併回傳，涵蓋太少時呼叫端要標示「不完整」。

export interface ViewRow {
  symbol: string;
  asOf: string;
  price: number | null;
  targetMean: number | null;
  buy: number;
  hold: number;
  sell: number;
  epsUp: number | null;
  epsDown: number | null;
}

export interface Consensus {
  symbols: number;
  /** 有資料的成分股占指數權重（%） */
  coveredWeightPct: number;
  /** 權重加權的目標價隱含漲幅（%），只算有價格與目標價的個股 */
  impliedUpsidePct: number | null;
  /** 權重加權的「買進」評等占比（%） */
  buyPct: number | null;
  /** 權重加權的 EPS 修正廣度：(上修 − 下修) ÷ (上修 + 下修)，−1～1；近 4 週沒有修正的個股不計 */
  revisionBreadth: number | null;
  oldest: string | null;
  newest: string | null;
}

export function aggregateConsensus(rows: ViewRow[], weights: Map<string, number>, today: string, maxAgeDays = 7): Consensus {
  const cutoff = new Date(Date.parse(`${today}T12:00:00Z`) - maxAgeDays * 86400000).toISOString().slice(0, 10);
  // 每檔只取最新一列。
  const latest = new Map<string, ViewRow>();
  for (const r of rows) {
    if (r.asOf < cutoff || !weights.has(r.symbol)) continue;
    const prev = latest.get(r.symbol);
    if (!prev || r.asOf > prev.asOf) latest.set(r.symbol, r);
  }
  let covered = 0;
  let upW = 0;
  let upSum = 0;
  let buyW = 0;
  let buySum = 0;
  let revW = 0;
  let revSum = 0;
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const r of latest.values()) {
    const w = weights.get(r.symbol)!;
    covered += w;
    if (!oldest || r.asOf < oldest) oldest = r.asOf;
    if (!newest || r.asOf > newest) newest = r.asOf;
    if (r.price && r.targetMean && r.price > 0) {
      upW += w;
      upSum += w * (r.targetMean / r.price - 1);
    }
    const ratings = r.buy + r.hold + r.sell;
    if (ratings > 0) {
      buyW += w;
      buySum += (w * r.buy) / ratings;
    }
    const revisions = (r.epsUp ?? 0) + (r.epsDown ?? 0);
    if (revisions > 0) {
      revW += w;
      revSum += (w * ((r.epsUp ?? 0) - (r.epsDown ?? 0))) / revisions;
    }
  }
  return {
    symbols: latest.size,
    coveredWeightPct: covered,
    impliedUpsidePct: upW ? (upSum / upW) * 100 : null,
    buyPct: buyW ? (buySum / buyW) * 100 : null,
    revisionBreadth: revW ? revSum / revW : null,
    oldest,
    newest,
  };
}
