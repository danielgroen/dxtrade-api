export function baseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=UTF-8",
    "Accept-Language": "en-US,en;q=0.9",
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
