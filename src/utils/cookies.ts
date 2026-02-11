export function parseCookies(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const cookie of setCookieHeaders) {
    const [nameValue] = cookie.split(";");
    const eqIndex = nameValue.indexOf("=");
    if (eqIndex === -1) continue;
    const name = nameValue.slice(0, eqIndex).trim();
    const value = nameValue.slice(eqIndex + 1).trim();
    cookies[name] = value;
  }

  return cookies;
}

export function serializeCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

export function mergeCookies(existing: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  return { ...existing, ...incoming };
}
