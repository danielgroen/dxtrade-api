import WebSocket from "ws";
import { endpoints, DxtradeError } from "@/constants";
import { WS_MESSAGE } from "@/constants/enums";
import {
  Cookies,
  authHeaders,
  cookieOnlyHeaders,
  retryRequest,
  clearDebugLog,
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
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("[dxtrade-api] Handshake timed out"));
    }, timeout);

    ws.on("message", (data) => {
      const msg = parseWsData(data);
      if (shouldLog(msg, debug)) debugLog(msg);

      if (typeof msg === "string") return;
      if (msg.type === WS_MESSAGE.POSITIONS) {
        clearTimeout(timer);
        ws.close();
        resolve();
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
      ctx.throwError("LOGIN_FAILED", `Login failed: ${response.status}`);
    }
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError("LOGIN_ERROR", `Login error: ${message}`);
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
      ctx.throwError("CSRF_NOT_FOUND", "CSRF token not found");
    }
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError("CSRF_ERROR", `CSRF fetch error: ${message}`);
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
    ctx.throwError("ACCOUNT_SWITCH_ERROR", `Error switching account: ${message}`);
  }
}

export async function connect(ctx: ClientContext): Promise<void> {
  await login(ctx);
  await fetchCsrf(ctx);
  if (ctx.debug) clearDebugLog();

  const wsUrl = endpoints.websocket(ctx.broker);
  const cookieStr = Cookies.serialize(ctx.cookies);
  await waitForHandshake(wsUrl, cookieStr, 30_000, ctx.debug);

  if (ctx.config.accountId) {
    await switchAccount(ctx, ctx.config.accountId);
    await waitForHandshake(endpoints.websocket(ctx.broker), Cookies.serialize(ctx.cookies), 30_000, ctx.debug);
  }
}
