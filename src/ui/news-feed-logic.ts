// NewsFeed 的純邏輯（不含 React，方便測試）：哪些標題要送去翻、翻完怎麼併回目前的列表。

export interface TranslatableNews {
  id: string;
  important: boolean;
  /** 標題還沒翻，或 AI 要重新判斷這則在講誰 */
  needs_ai: boolean;
}

/**
 * 只翻「畫面上看得到」的：重要的一定算；「其他」收合組只有展開時才算（showOthers=false 的頁面沒有收合組，列表全部都看得到）。
 * 排除這次頁面已經送過的 id；重要的優先，最多 max 則。
 */
export function pendingTranslateIds(news: TranslatableNews[], opts: { showOthers: boolean; othersOpen: boolean; tried: ReadonlySet<string>; max: number }): string[] {
  const visible = opts.showOthers ? [...news.filter((n) => n.important), ...(opts.othersOpen ? news.filter((n) => !n.important) : [])] : news;
  return visible.filter((n) => n.needs_ai && !opts.tried.has(n.id)).slice(0, opts.max).map((n) => n.id);
}

/** 把翻譯結果依 id 併回「目前」的列表（請求期間列表可能已經變過，例如 AI 重點回來了）。 */
export function mergeTranslated<N extends { id: string }, T extends { id: string }>(current: N[], items: T[]): N[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return current.map((n) => {
    const t = byId.get(n.id);
    return t ? { ...n, ...t, needs_ai: false } : n;
  });
}
