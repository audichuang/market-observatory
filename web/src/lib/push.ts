// 推播的內容與偏好（純函式，不碰資料庫與網路）：收盤摘要、名單個股大漲大跌、當天的財報／總經事件。
import type { CheckStatus, Snapshot } from "./snapshot.ts";

export interface PushPrefs {
  /** 每日收盤摘要 */
  daily: boolean;
  /** 名單個股單日漲跌超過門檻 */
  moves: boolean;
  /** 門檻（%，絕對值） */
  moveThresholdPct: number;
  /** 名單個股財報、FOMC 等事件當天提醒 */
  events: boolean;
}

export const DEFAULT_PUSH_PREFS: PushPrefs = { daily: true, moves: true, moveThresholdPct: 5, events: true };
export const PUSH_PREFS_PREFIX = "push:";

export function sanitizePrefs(raw: unknown): PushPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof PushPrefs, unknown>>;
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const t = typeof r.moveThresholdPct === "number" && Number.isFinite(r.moveThresholdPct) ? r.moveThresholdPct : DEFAULT_PUSH_PREFS.moveThresholdPct;
  return {
    daily: bool(r.daily, DEFAULT_PUSH_PREFS.daily),
    moves: bool(r.moves, DEFAULT_PUSH_PREFS.moves),
    moveThresholdPct: Math.min(50, Math.max(1, Math.round(t * 10) / 10)),
    events: bool(r.events, DEFAULT_PUSH_PREFS.events),
  };
}

export interface PushMessage {
  kind: "daily" | "moves" | "events";
  title: string;
  body: string;
  /** App 收到後要打開的畫面與參數 */
  data: Record<string, string>;
}

const signed = (v: number, digits = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 收盤摘要：指數點數與漲跌、VIX、名單合計貢獻（占比）、貢獻最大的一家。橫幅只顯示兩行，重要的放前面，被截掉的只會是最後的個股。快照算不出當日漲跌（缺前一日）就不發。 */
export function dailySummary(s: Snapshot): PushMessage | null {
  const { index } = s;
  if (index.changePts === null || index.returnPct === null) return null;
  const indexLabel = unverified(index.check.status);
  const parts = [`${index.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}（${signed(index.changePts)} 點）`];
  if (s.vix.close !== null) parts.push(`VIX ${s.vix.close.toFixed(1)}`);
  if (s.mag7.length && s.mag7Total.contributionPts !== null) {
    const share = s.mag7Total.shareOfMovePct === null ? "" : `${Math.round(s.mag7Total.shareOfMovePct)}%`;
    const label = s.mag7.map((r) => unverified(r.check)).find(Boolean);
    const detail = [share, label].filter(Boolean).join("，");
    parts.push(`名單 ${signed(s.mag7Total.contributionPts, 1)} 點${detail ? `（${detail}）` : ""}`);
    const top = [...s.mag7].filter((r) => r.contributionPts !== null).sort((a, b) => Math.abs(b.contributionPts!) - Math.abs(a.contributionPts!))[0];
    if (top) parts.push(`${top.key} ${signed(top.contributionPts!, 1)}`);
  }
  return {
    kind: "daily",
    title: `S&P 500 ${md(s.tradeDate)} 收盤 ${signed(index.returnPct)}%${indexLabel ? `（${indexLabel}）` : ""}`,
    body: parts.join(" · "),
    data: { screen: "overview", date: s.tradeDate },
  };
}

/** 名單上單日漲跌超過門檻的公司，依漲跌幅絕對值排序；沒有就不發。 */
export function bigMoves(s: Snapshot, thresholdPct: number): PushMessage | null {
  const hits = s.mag7
    .filter((r) => r.returnPct !== null && Math.abs(r.returnPct) >= thresholdPct)
    .sort((a, b) => Math.abs(b.returnPct!) - Math.abs(a.returnPct!));
  if (!hits.length) return null;
  const list = hits.map((r) => {
    const label = unverified(r.check);
    return `${r.company}（${r.key}）${signed(r.returnPct!, 1)}%${label ? `（${label}）` : ""}`;
  });
  const firstLabel = unverified(hits[0].check);
  const up = hits.filter((r) => r.returnPct! > 0).length;
  const down = hits.length - up;
  const verb = up && down ? "大漲大跌" : up ? "大漲" : "大跌";
  return {
    kind: "moves",
    title: hits.length === 1 ? `${hits[0].key} ${md(s.tradeDate)} ${verb} ${signed(hits[0].returnPct!, 1)}%${firstLabel ? `（${firstLabel}）` : ""}` : `名單 ${hits.length} 家${verb}超過 ${thresholdPct}%`,
    body: list.join("、"),
    data: { screen: "overview", date: s.tradeDate },
  };
}

export interface EventRow {
  date: string;
  kind: string;
  symbol: string | null;
  title: string;
  detail: string | null;
  status: string;
}

/** Events for the NY date: tracked earnings and macro events, labeled 推估, 預期 or 暫定 by status. */
export function eventReminder(date: string, events: EventRow[], keys: string[]): PushMessage | null {
  const mine = events.filter((e) => e.date === date && (e.kind !== "earnings" || (e.symbol !== null && keys.includes(e.symbol))));
  if (!mine.length) return null;
  const text = mine.map((e) => {
    const timing = e.detail && /盤前|盤後/.test(e.detail) ? `（${e.detail.match(/盤前|盤後/)![0]}）` : "";
    return `${e.title}${timing}${e.status === "estimated" ? "（推估）" : e.status === "expected" ? "（預期）" : e.status === "tentative" ? "（暫定）" : ""}`;
  });
  return {
    kind: "events",
    title: `今天（美東 ${md(date)}）的事件`,
    body: text.join("、"),
    data: { screen: "news", date },
  };
}

function unverified(status: CheckStatus): string {
  return status === "mismatch" ? "未核對" : "";
}
