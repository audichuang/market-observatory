// 純計算，不碰 I/O；所有函式在缺資料時回 null，不補值、不外插。

export interface Point {
  date: string;
  close: number;
}

/** 依日期遞增排序的序列與快速查詢。 */
export class Series {
  readonly points: Point[];
  private index = new Map<string, number>();
  constructor(points: Point[]) {
    this.points = [...points].sort((a, b) => a.date.localeCompare(b.date));
    this.points.forEach((p, i) => this.index.set(p.date, i));
  }
  get length() {
    return this.points.length;
  }
  has(date: string) {
    return this.index.has(date);
  }
  at(date: string): number | null {
    const i = this.index.get(date);
    return i === undefined ? null : this.points[i].close;
  }
  /** 小於等於 date 的最後一個點的位置；沒有回 -1。 */
  floorIndex(date: string): number {
    let lo = 0;
    let hi = this.points.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.points[mid].date <= date) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }
  onOrBefore(date: string): Point | null {
    const i = this.floorIndex(date);
    return i < 0 ? null : this.points[i];
  }
  previous(date: string): Point | null {
    const i = this.floorIndex(date);
    if (i < 0) return null;
    const j = this.points[i].date === date ? i - 1 : i;
    return j < 0 ? null : this.points[j];
  }
  last(): Point | null {
    return this.points.at(-1) ?? null;
  }
}

export const pct = (to: number, from: number) => ((to / from) - 1) * 100;

export function round(v: number | null, digits = 4): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** 從 fromDate（取當天或之前最後一筆）到 toDate 的報酬（%）。 */
export function periodReturn(s: Series, fromDate: string, toDate: string): number | null {
  const end = s.at(toDate);
  const start = s.onOrBefore(fromDate);
  if (end === null || !start || start.date === toDate) return null;
  return pct(end, start.close);
}

/** 截至 date（含）的 n 日簡單均線；不足 n 筆回 null。 */
export function smaAt(s: Series, date: string, n: number): number | null {
  const i = s.floorIndex(date);
  if (i < 0 || s.points[i].date !== date || i + 1 < n) return null;
  let sum = 0;
  for (let k = i - n + 1; k <= i; k++) sum += s.points[k].close;
  return sum / n;
}

/** 整段序列的 n 日均線（前 n-1 筆為 null）。 */
export function smaSeries(points: Point[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  points.forEach((p, i) => {
    sum += p.close;
    if (i >= n) sum -= points[i - n].close;
    out.push(i >= n - 1 ? sum / n : null);
  });
  return out;
}

/** date 往回 365 天（含）內的最高、最低收盤。 */
export function range52w(s: Series, date: string): { high: number; low: number } | null {
  const i = s.floorIndex(date);
  if (i < 0) return null;
  const from = new Date(`${date}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 365);
  const fromIso = from.toISOString().slice(0, 10);
  let high = -Infinity;
  let low = Infinity;
  for (let k = i; k >= 0 && s.points[k].date >= fromIso; k--) {
    high = Math.max(high, s.points[k].close);
    low = Math.min(low, s.points[k].close);
  }
  return Number.isFinite(high) ? { high, low } : null;
}

export function maxDrawdown(points: Point[]): number | null {
  if (points.length < 2) return null;
  let peak = points[0].close;
  let worst = 0;
  for (const p of points) {
    peak = Math.max(peak, p.close);
    worst = Math.min(worst, pct(p.close, peak));
  }
  return worst;
}

/**
 * 把持股權重從 anchorDate 推到 targetDate：
 * w(t) = w(a) × (P_i(t)/P_i(a)) ÷ (SPX(t)/SPX(a))。
 * 假設期間成分股與流通股數不變；anchor 等於 target 時就是原值。
 */
export function rollWeight(
  weightAtAnchor: number,
  stock: Series,
  index: Series,
  anchorDate: string,
  targetDate: string,
): number | null {
  if (anchorDate === targetDate) return weightAtAnchor;
  const pa = stock.at(anchorDate);
  const pt = stock.at(targetDate);
  const ia = index.at(anchorDate);
  const it = index.at(targetDate);
  if (pa === null || pt === null || ia === null || it === null) return null;
  return weightAtAnchor * (pt / pa) / (it / ia);
}

export interface DcaResult {
  months: number;
  invested: number;
  units: number;
  value: number;
  returnPct: number | null;
  lumpSumValue: number | null;
  lumpSumReturnPct: number | null;
  /** 期間內最大帳面虧損（%，≤ 0） */
  maxDrawdownPct: number | null;
  path: { date: string; invested: number; value: number }[];
}

/**
 * 每月第一個交易日投入固定金額（同幣別），算到序列最後一天。
 * 不含股息再投入、手續費與稅；lump sum 是同一筆總金額在第一天一次投入的對照。
 */
export function simulateDca(s: Series, startDate: string, monthlyAmount: number): DcaResult | null {
  const pts = s.points.filter((p) => p.date >= startDate);
  if (pts.length < 2 || monthlyAmount <= 0) return null;
  let units = 0;
  let invested = 0;
  let lastMonth = "";
  const buys: Point[] = [];
  const path: DcaResult["path"] = [];
  for (const p of pts) {
    const month = p.date.slice(0, 7);
    if (month !== lastMonth) {
      units += monthlyAmount / p.close;
      invested += monthlyAmount;
      lastMonth = month;
      buys.push(p);
    }
    path.push({ date: p.date, invested, value: units * p.close });
  }
  const last = pts.at(-1)!;
  const value = units * last.close;
  const lumpUnits = invested / pts[0].close;
  const lumpSumValue = lumpUnits * last.close;
  // 最大帳面虧損：期間內 (市值 − 已投入) ÷ 已投入 的最低點；從未虧損則為 0。
  const worstUnrealized = Math.min(0, ...path.map((step) => pct(step.value, step.invested)));
  return {
    months: buys.length,
    invested,
    units,
    value,
    returnPct: pct(value, invested),
    lumpSumValue,
    lumpSumReturnPct: pct(lumpSumValue, invested),
    maxDrawdownPct: worstUnrealized,
    path,
  };
}

/** 槓桿／反向 ETF 實際報酬與「倍數 × 指數報酬」的差（每日重設造成的路徑耗損）。 */
export function leverageDrift(etf: Series, index: Series, multiple: number, fromDate: string, toDate: string) {
  const actual = periodReturn(etf, fromDate, toDate);
  const idx = periodReturn(index, fromDate, toDate);
  if (actual === null || idx === null) return null;
  return { actual, naive: idx * multiple, drift: actual - idx * multiple };
}

/** Return (%) from the first close in the sorted range; require a distinct close on toDate. */
export function rangeReturn(inRange: Point[], toDate: string): number | null {
  const first = inRange[0];
  const last = inRange.at(-1);
  if (!first || last?.date !== toDate || first.date === toDate) return null;
  return pct(last.close, first.close);
}
