import type { EtfProduct, WatchMember } from "./universe.ts";
import { companyKey, isConstituent, MAX_WATCH, memberWeights, type Holding } from "./watchlist.ts";

export interface OverlapInputs {
  ovEtf: number;
  ov: Record<string, number>;
}

export interface OverlapIssue { issue: string }

const amountIssue = "金額要是 0 到 10 億台幣的整數";
const validAmount = (value: string) => /^\d+$/.test(value) && Number(value) <= 1_000_000_000;

export function parseOverlapQuery(get: (key: string) => string | undefined, list: WatchMember[]): OverlapInputs | OverlapIssue | null {
  const etf = get("ovEtf");
  const direct = get("ov");
  if (etf === undefined && direct === undefined) return null;
  if (etf !== undefined && !validAmount(etf)) return { issue: amountIssue };
  const ov: Record<string, number> = {};
  if (direct !== undefined) {
    const entries = direct.split(",");
    if (entries.length > MAX_WATCH) return { issue: `另外持有最多 ${MAX_WATCH} 家` };
    const keys = new Set(list.map((m) => m.key));
    for (const entry of entries) {
      const parts = entry.split(":");
      if (parts.length !== 2 || !keys.has(parts[0])) return { issue: "另外持有請用觀察名單內的 KEY:金額，以逗號分隔" };
      const [key, value] = parts;
      if (Object.hasOwn(ov, key)) return { issue: `${key} 的另外持有金額只能填一次` };
      if (!validAmount(value)) return { issue: amountIssue };
      ov[key] = Number(value);
    }
  }
  return { ovEtf: Number(etf ?? 0), ov };
}

interface OverlapContext {
  list: WatchMember[];
  holdings: Holding[];
  asOf: string | null;
  etf: EtfProduct;
  input: OverlapInputs | OverlapIssue | null;
}

export function overlapPreview({ list, holdings, asOf, etf, input }: OverlapContext) {
  const { members, totalWeight } = memberWeights(list, holdings);
  const companies = new Map<string, number>();
  for (const holding of holdings.filter(isConstituent)) {
    const key = companyKey(holding.name);
    companies.set(key, (companies.get(key) ?? 0) + holding.weightPct);
  }
  const top10CompanyWeight = [...companies.values()].sort((a, b) => b - a).slice(0, 10).reduce((a, weight) => a + weight, 0);
  const applicable = etf.multiple === 1;
  const inputs = input && !("issue" in input) ? input : null;
  const issue = input && "issue" in input ? input.issue : applicable && inputs && asOf === null ? "尚未取得 SPY 持股資料，無法計算假設曝險" : null;
  const notes = [
    asOf === null ? "尚未取得 SPY 持股資料，無法推估指數重疊。" : `以 ${asOf} 的 SPY 持股作指數代理推估${etf.ticker === "SPY" ? "" : `；${etf.ticker} 的實際持股可能略有不同`}`,
    "觀察名單不是持倉；只有你填了金額才算假設曝險，這不是配置建議。",
  ];
  if (!applicable) notes.push("槓桿與反向 ETF 用衍生工具達成每日倍數，不適用持股重疊推估。");
  let exposure = null;
  if (applicable && inputs && issue === null) {
    const totalTwd = inputs.ovEtf + Object.values(inputs.ov).reduce((a, amount) => a + amount, 0);
    const exposedMembers = members.map((m) => {
      const viaEtfTwd = inputs.ovEtf * m.weightPct / 100;
      const directTwd = inputs.ov[m.key] ?? 0;
      const combinedTwd = viaEtfTwd + directTwd;
      return { key: m.key, viaEtfTwd, directTwd, combinedTwd, sharePct: totalTwd === 0 ? null : combinedTwd / totalTwd * 100 };
    });
    exposure = {
      members: exposedMembers, totalTwd,
      watchlistSharePct: totalTwd === 0 ? null : exposedMembers.reduce((a, m) => a + m.combinedTwd, 0) / totalTwd * 100,
      otherViaEtfTwd: inputs.ovEtf * (100 - totalWeight) / 100,
    };
  }
  return { asOf, proxy: "SPY" as const, applicable, members, totalWeight, top10CompanyWeight, exposure, inputs, issue, notes };
}
