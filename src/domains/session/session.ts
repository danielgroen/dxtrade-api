import WebSocket from "ws";
import { endpoints, DxtradeError, ERROR } from "@/constants";
import {
  Cookies,
  authHeaders,
  cookieOnlyHeaders,
  retryRequest,
  clearDebugLog,
  parseAtmosphereId,
  parseWsData,
  shouldLog,
  debugLog,
} from "@/utils";
import type { ClientContext } from "@/client.types";

function waitForHandshake(
  wsUrl: string,
  cookieStr: string,
  timeout = 30_000,
  debug: boolean | string = false,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });
    let atmosphereId: string | null = null;

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("[dxtrade-api] Handshake timed out"));
    }, timeout);

    ws.on("message", (data) => {
      if (!atmosphereId) {
        atmosphereId = parseAtmosphereId(data);
      }

      const msg = parseWsData(data);
      if (shouldLog(msg, debug)) debugLog(msg);

      if (typeof msg === "string") return;
      if (msg.accountId) {
        clearTimeout(timer);
        ws.close();
        resolve(atmosphereId);
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      ws.close();
      reject(new Error(`[dxtrade-api] WebSocket handshake error: ${error.message}`));
    });
  });
}

export async function login(ctx: ClientContext): Promise<void> {
  try {
    const response = await retryRequest(
      {
        method: "POST",
        url: endpoints.login(ctx.broker),
        data: {
          username: ctx.config.username,
          password: ctx.config.password,
          domain: ctx.config.broker,
        },
        headers: { "Content-Type": "application/json" },
      },
      ctx.retries,
    );

    if (response.status === 200) {
      const setCookies = response.headers["set-cookie"] ?? [];
      const incoming = Cookies.parse(setCookies);
      ctx.cookies = Cookies.merge(ctx.cookies, incoming);
      ctx.callbacks.onLogin?.();
    } else {
      ctx.throwError(ERROR.LOGIN_FAILED, `Login failed: ${response.status}`);
    }
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError(ERROR.LOGIN_ERROR, `Login error: ${message}`);
  }
}

export async function fetchCsrf(ctx: ClientContext): Promise<void> {
  try {
    const cookieStr = Cookies.serialize(ctx.cookies);
    const response = await retryRequest(
      {
        method: "GET",
        url: ctx.broker,
        headers: { ...cookieOnlyHeaders(cookieStr), Referer: ctx.broker },
      },
      ctx.retries,
    );

    const csrfMatch = response.data?.match(/name="csrf" content="([^"]+)"/);
    if (csrfMatch) {
      ctx.csrf = csrfMatch[1];
    } else {
      ctx.throwError(ERROR.CSRF_NOT_FOUND, "CSRF token not found");
    }
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError(ERROR.CSRF_ERROR, `CSRF fetch error: ${message}`);
  }
}

export async function switchAccount(ctx: ClientContext, accountId: string): Promise<void> {
  ctx.ensureSession();

  try {
    await retryRequest(
      {
        method: "POST",
        url: endpoints.switchAccount(ctx.broker, accountId),
        headers: authHeaders(ctx.csrf!, Cookies.serialize(ctx.cookies)),
      },
      ctx.retries,
    );
    ctx.callbacks.onAccountSwitch?.(accountId);
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError(ERROR.ACCOUNT_SWITCH_ERROR, `Error switching account: ${message}`);
  }
}

export async function connect(ctx: ClientContext): Promise<void> {
  await login(ctx);
  await fetchCsrf(ctx);
  if (ctx.debug) clearDebugLog();

  const cookieStr = Cookies.serialize(ctx.cookies);
  ctx.atmosphereId = await waitForHandshake(endpoints.websocket(ctx.broker), cookieStr, 30_000, ctx.debug);

  if (ctx.config.accountId) {
    await switchAccount(ctx, ctx.config.accountId);
    ctx.atmosphereId = await waitForHandshake(
      endpoints.websocket(ctx.broker, ctx.atmosphereId),
      Cookies.serialize(ctx.cookies),
      30_000,
      ctx.debug,
    );
  }
}
