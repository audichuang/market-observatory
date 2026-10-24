/** 登入後要導回的站內路徑；不是同站路徑（含 //host、/\host、控制字元）一律回首頁。 */
export function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(next)) return "/";
  try {
    const base = "https://same.origin.invalid";
    const url = new URL(next, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
