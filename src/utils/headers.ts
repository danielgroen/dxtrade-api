export function baseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=UTF-8",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0",
  };
}

export function authHeaders(csrf: string, cookieStr: string): Record<string, string> {
  return {
    ...baseHeaders(),
    "X-CSRF-Token": csrf,
    "X-Requested-With": "XMLHttpRequest",
    Accept: "*/*",
    Cookie: cookieStr,
  };
}

export function cookieOnlyHeaders(cookieStr: string): Record<string, string> {
  return { Cookie: cookieStr };
}
