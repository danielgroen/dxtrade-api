import WebSocket from "ws";
import { endpoints, DxtradeError, WS_MESSAGE, ERROR } from "@/constants";
import { Cookies, baseHeaders, retryRequest, parseWsData, shouldLog, debugLog } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Symbol } from ".";

export async function getSymbolSuggestions(ctx: ClientContext, text: string): Promise<Symbol.Suggestion[]> {
  ctx.ensureSession();

  try {
    const cookieStr = Cookies.serialize(ctx.cookies);
    const response = await retryRequest(
      {
        method: "GET",
        url: endpoints.suggest(ctx.broker, text),
        headers: { ...baseHeaders(), Cookie: cookieStr },
      },
      ctx.retries,
    );

    const suggests = response.data?.suggests;
    if (!suggests?.length) {
      ctx.throwError(ERROR.NO_SUGGESTIONS, "No symbol suggestions found");
    }
    return suggests as Symbol.Suggestion[];
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError(ERROR.SUGGEST_ERROR, `Error getting symbol suggestions: ${message}`);
  }
}

export async function getSymbolInfo(ctx: ClientContext, symbol: string): Promise<Symbol.Info> {
  ctx.ensureSession();

  try {
    const offsetMinutes = Math.abs(new Date().getTimezoneOffset());
    const cookieStr = Cookies.serialize(ctx.cookies);
    const response = await retryRequest(
      {
        method: "GET",
        url: endpoints.instrumentInfo(ctx.broker, symbol, offsetMinutes),
        headers: { ...baseHeaders(), Cookie: cookieStr },
      },
      ctx.retries,
    );

    if (!response.data) {
      ctx.throwError(ERROR.NO_SYMBOL_INFO, "No symbol info returned");
    }
    return response.data as Symbol.Info;
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError(ERROR.SYMBOL_INFO_ERROR, `Error getting symbol info: ${message}`);
  }
}

export async function getSymbolLimits(ctx: ClientContext, timeout = 30_000): Promise<Symbol.Limits[]> {
  ctx.ensureSession();

  const wsUrl = endpoints.websocket(ctx.broker, ctx.atmosphereId);
  const cookieStr = Cookies.serialize(ctx.cookies);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

    const timer = setTimeout(() => {
      ws.close();
      reject(new DxtradeError(ERROR.LIMITS_TIMEOUT, "Symbol limits request timed out"));
    }, timeout);

    let limits: Symbol.Limits[] = [];
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    ws.on("message", (data) => {
      const msg = parseWsData(data);
      if (shouldLog(msg, ctx.debug)) debugLog(msg);

      if (typeof msg === "string") return;
      if (msg.type === WS_MESSAGE.LIMITS) {
        const batch = msg.body as Symbol.Limits[];
        if (batch.length === 0) return;

        limits.push(...batch);

        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          clearTimeout(timer);
          ws.close();
          resolve(limits);
        }, 200);
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      ws.close();
      reject(new DxtradeError(ERROR.LIMITS_ERROR, `Symbol limits error: ${error.message}`));
    });
  });
}
