import { Series, pct, periodReturn, range52w, rollWeight, round, smaAt } from "./analytics.ts";
import { addDays, isNyseSession, previousExpectedSession } from "./calendar.ts";
import { EQUAL_WEIGHT_SYMBOL, INDEX_SYMBOL, MAG7, VIX_SYMBOL } from "./universe.ts";

export const SNAPSHOT_VERSION = 1;

export type CheckStatus = "match" | "mismatch" | "pending" | "unavailable";

export interface PriceCheck {
  status: CheckStatus;
  source: string | null;
  close: number | null;
}

export interface Mag7Row {
  key: string;
  company: string;
  tickers: string[];
  close: number | null;
  prevClose: number | null;
  returnPct: number | null;
  /** 前一交易日收盤時的指數權重（%） */
  weightPct: number | null;
  weightMethod: "file" | "rolled" | null;
  contributionPts: number | null;
  /** 這檔貢獻占指數當日漲跌點數的比例（%）；指數幾乎平盤時為 null */
  shareOfMovePct: number | null;
  check: CheckStatus;
}

export interface Snapshot {
  version: number;
  tradeDate: string;
  prevDate: string | null;
  index: {
    close: number;
    prevClose: number | null;
    changePts: number | null;
    returnPct: number | null;
    weekPct: number | null;
    monthPct: number | null;
    ytdPct: number | null;
    yearPct: number | null;
    high52: number | null;
    low52: number | null;
    fromHighPct: number | null;
    sma20: number | null;
    sma60: number | null;
    sma200: number | null;
    check: PriceCheck;
  };
  vix: { close: number | null; prevClose: number | null; change: number | null; monthHigh: number | null; monthLow: number | null };
  breadth: {
    rspReturnPct: number | null;
    spxReturnPct: number | null;
    /** 等權減市值加權（百分點）；負值代表大型權值股撐盤、多數股票較弱 */
    spreadPct: number | null;
    rspMonthPct: number | null;
    spxMonthPct: number | null;
  };
  mag7: Mag7Row[];
  mag7Total: { weightPct: number | null; contributionPts: number | null; shareOfMovePct: number | null };
  rest: { contributionPts: number | null; impliedReturnPct: number | null };
  weights: { asOf: string | null; method: "file" | "rolled" | null; note: string };
  quality: {
    missing: string[];
    mismatches: string[];
    pendingChecks: string[];
    expectedSession: boolean | null;
    notes: string[];
  };
}

export interface SnapshotInput {
  tradeDate: string;
  series: Record<string, Series>;
  checks: Record<string, Map<string, PriceCheck>>;
  /** 最接近 tradeDate 前一日的 SSGA 持股（ticker → 權重 %） */
  weights: { asOf: string; byTicker: Map<string, number> } | null;
}

const r2 = (v: number | null) => round(v, 2);
const r4 = (v: number | null) => round(v, 4);

function checkOf(input: SnapshotInput, symbol: string, date: string): PriceCheck {
  return input.checks[symbol]?.get(date) ?? { status: "pending", source: null, close: null };
}

/** 當日貢獻點數 = 前一日指數 × 前一日權重 × 當日報酬。 */
export function contributionPoints(prevIndex: number, weightPct: number, returnPct: number): number {
  return prevIndex * (weightPct / 100) * (returnPct / 100);
}

export function buildSnapshot(input: SnapshotInput): Snapshot | null {
  const { tradeDate, series } = input;
  const spx = series[INDEX_SYMBOL];
  const close = spx?.at(tradeDate) ?? null;
  if (!spx || close === null) return null;
  // 依 NYSE 日曆，前一個應開市的交易日若缺資料，就不拿更早一天硬算「當日」漲跌與歸因。
  const expectedPrev = previousExpectedSession(tradeDate);
  const available = spx.previous(tradeDate);
  const gap = expectedPrev !== null && available !== null && available.date !== expectedPrev;
  const prev = gap ? null : available;
  const prevClose = prev?.close ?? null;
  const changePts = prevClose === null ? null : close - prevClose;
  const returnPct = prevClose === null ? null : pct(close, prevClose);
  const range = range52w(spx, tradeDate);
  const yearStart = `${Number(tradeDate.slice(0, 4)) - 1}-12-31`;

  const quality: Snapshot["quality"] = { missing: [], mismatches: [], pendingChecks: [], expectedSession: isNyseSession(tradeDate), notes: [] };
  const spxCheck = checkOf(input, INDEX_SYMBOL, tradeDate);
  if (spxCheck.status === "mismatch") quality.mismatches.push(INDEX_SYMBOL);
  if (spxCheck.status === "pending") quality.pendingChecks.push(INDEX_SYMBOL);

  const vix = series[VIX_SYMBOL];
  const vixClose = vix?.at(tradeDate) ?? null;
  const vixPrev = vix?.previous(tradeDate)?.close ?? null;
  if (vixClose === null) quality.missing.push(VIX_SYMBOL);
  const vixMonth = vix ? vix.points.filter((p) => p.date > addDays(tradeDate, -31) && p.date <= tradeDate).map((p) => p.close) : [];

  const rsp = series[EQUAL_WEIGHT_SYMBOL];
  const rspReturn = rsp && prev ? periodReturn(rsp, prev.date, tradeDate) : null;
  if (!rsp?.has(tradeDate)) quality.missing.push(EQUAL_WEIGHT_SYMBOL);

  // 權重：用持股檔推算到「前一交易日收盤」。
  const weightTarget = prev?.date ?? null;
  const weightMethod: "file" | "rolled" | null = !input.weights || !weightTarget ? null : input.weights.asOf === weightTarget ? "file" : "rolled";

  const mag7: Mag7Row[] = MAG7.map((m) => {
    let weightPct: number | null = 0;
    let contribution: number | null = 0;
    let closeSum: number | null = null;
    let prevSum: number | null = null;
    let returnWeighted: number | null = null;
    let check: CheckStatus = "match";
    const perTicker: { w: number | null; r: number | null }[] = [];
    for (const t of m.tickers) {
      const s = series[t];
      const c = s?.at(tradeDate) ?? null;
      const p = s && prev ? s.at(prev.date) : null;
      if (c === null) quality.missing.push(t);
      const r = c !== null && p !== null ? pct(c, p) : null;
      const ck = checkOf(input, t, tradeDate);
      if (ck.status === "mismatch") {
        check = "mismatch";
        quality.mismatches.push(t);
      } else if (ck.status !== "match" && check === "match") check = ck.status;
      if (ck.status === "pending") quality.pendingChecks.push(t);
      let w: number | null = null;
      const anchorW = input.weights?.byTicker.get(t);
      if (anchorW !== undefined && s && weightTarget) w = rollWeight(anchorW, s, spx, input.weights!.asOf, weightTarget);
      perTicker.push({ w, r });
      if (m.tickers.length === 1 || t === m.tickers[0]) {
        closeSum = c;
        prevSum = p;
      }
    }
    if (perTicker.some((x) => x.w === null)) weightPct = null;
    else weightPct = perTicker.reduce((a, x) => a + (x.w as number), 0);
    if (weightPct === null || prevClose === null || perTicker.some((x) => x.r === null)) contribution = null;
    else contribution = perTicker.reduce((a, x) => a + contributionPoints(prevClose, x.w as number, x.r as number), 0);
    if (weightPct && perTicker.every((x) => x.r !== null && x.w !== null)) {
      returnWeighted = perTicker.reduce((a, x) => a + (x.w as number) * (x.r as number), 0) / weightPct;
    } else if (perTicker.length === 1) returnWeighted = perTicker[0].r;
    return {
      key: m.key,
      company: m.company,
      tickers: m.tickers,
      close: r4(closeSum),
      prevClose: r4(prevSum),
      returnPct: r4(returnWeighted),
      weightPct: r4(weightPct),
      weightMethod: weightPct === null ? null : weightMethod,
      contributionPts: r4(contribution),
      shareOfMovePct: null,
      check,
    };
  });

  const significantMove = changePts !== null && Math.abs(changePts) >= 0.5;
  for (const row of mag7) {
    row.shareOfMovePct = significantMove && row.contributionPts !== null ? r2((row.contributionPts / (changePts as number)) * 100) : null;
  }
  const allContrib = mag7.every((r) => r.contributionPts !== null);
  const mag7Pts = allContrib ? mag7.reduce((a, r) => a + (r.contributionPts as number), 0) : null;
  const mag7Weight = mag7.every((r) => r.weightPct !== null) ? mag7.reduce((a, r) => a + (r.weightPct as number), 0) : null;
  const restPts = mag7Pts !== null && changePts !== null ? changePts - mag7Pts : null;
  const restWeight = mag7Weight === null ? null : 100 - mag7Weight;
  const restReturn = restPts !== null && restWeight && prevClose ? (restPts / (prevClose * (restWeight / 100))) * 100 : null;

  if (!input.weights) quality.notes.push("尚未取得 SPY 持股權重，無法計算歸因");
  else if (weightMethod === "rolled") {
    quality.notes.push(`權重由 ${input.weights.asOf} 的 SPY 持股依價格變動推算到 ${weightTarget}（假設期間股數不變）`);
  }
  if (quality.expectedSession === false) quality.notes.push("依 NYSE 日曆這天不是交易日，但來源有資料，請留意");
  if (gap) {
    quality.missing.push(`${INDEX_SYMBOL} ${expectedPrev}`);
    quality.notes.push(`缺 ${expectedPrev} 的指數收盤，當日漲跌與歸因不計算（避免把 ${available!.date} 起的多日漲跌當成一天）`);
  }

  return {
    version: SNAPSHOT_VERSION,
    tradeDate,
    prevDate: prev?.date ?? null,
    index: {
      close: r4(close) as number,
      prevClose: r4(prevClose),
      changePts: r4(changePts),
      returnPct: r4(returnPct),
      weekPct: r4(periodReturn(spx, addDays(tradeDate, -7), tradeDate)),
      monthPct: r4(periodReturn(spx, addDays(tradeDate, -30), tradeDate)),
      ytdPct: r4(periodReturn(spx, yearStart, tradeDate)),
      yearPct: r4(periodReturn(spx, addDays(tradeDate, -365), tradeDate)),
      high52: r4(range?.high ?? null),
      low52: r4(range?.low ?? null),
      fromHighPct: range ? r4(pct(close, range.high)) : null,
      sma20: r4(smaAt(spx, tradeDate, 20)),
      sma60: r4(smaAt(spx, tradeDate, 60)),
      sma200: r4(smaAt(spx, tradeDate, 200)),
      check: spxCheck,
    },
    vix: {
      close: r4(vixClose),
      prevClose: r4(vixPrev),
      change: vixClose !== null && vixPrev !== null ? r4(vixClose - vixPrev) : null,
      monthHigh: vixMonth.length ? Math.max(...vixMonth) : null,
      monthLow: vixMonth.length ? Math.min(...vixMonth) : null,
    },
    breadth: {
      rspReturnPct: r4(rspReturn),
      spxReturnPct: r4(returnPct),
      spreadPct: rspReturn !== null && returnPct !== null ? r4(rspReturn - returnPct) : null,
      rspMonthPct: rsp ? r4(periodReturn(rsp, addDays(tradeDate, -30), tradeDate)) : null,
      spxMonthPct: r4(periodReturn(spx, addDays(tradeDate, -30), tradeDate)),
    },
    mag7,
    mag7Total: {
      weightPct: r4(mag7Weight),
      contributionPts: r4(mag7Pts),
      shareOfMovePct: significantMove && mag7Pts !== null ? r2((mag7Pts / (changePts as number)) * 100) : null,
    },
    rest: { contributionPts: r4(restPts), impliedReturnPct: r4(restReturn) },
    weights: {
      asOf: input.weights?.asOf ?? null,
      method: weightMethod,
      note: "權重取自 SPY ETF 每日持股（State Street），含少量現金，與 S&P 官方指數權重略有差異",
    },
    quality: { ...quality, missing: [...new Set(quality.missing)], mismatches: [...new Set(quality.mismatches)], pendingChecks: [...new Set(quality.pendingChecks)] },
  };
}

/**
 * 重算一批快照要載入的價格區間。
 * 開頭往前 430 天（52 週高低與 200 日均線）；結尾至少要涵蓋最早一份持股檔的日期：
 * 目標日早於所有持股檔時，權重要從那份檔「往回推」，需要持股日當天的價格。
 */
export function snapshotLoadWindow(targets: string[], weightAnchorDates: string[]): { from: string; to: string } {
  const last = targets.at(-1)!;
  const earliestAnchor = weightAnchorDates[0];
  return { from: addDays(targets[0], -430), to: earliestAnchor && earliestAnchor > last ? earliestAnchor : last };
}
