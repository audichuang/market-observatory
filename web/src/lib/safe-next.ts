/** 登入後要導回的站內路徑；不是同站路徑（含 //host、/\host、控制字元）一律回首頁。 */
export function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return "/";
  try {
    const base = "https://same.origin.invalid";
    if (new URL(next, base).origin !== base) return "/";
  } catch {
    return "/";
  }
  // 回傳原字串而不是正規化後的 pathname：/.//host 正規化會變成 //host（協定相對網址），
  // 原字串交給瀏覽器解析則仍是同站路徑。
  return next;
}
