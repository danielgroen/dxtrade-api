import WebSocket from "ws";
import { WS_MESSAGE, ERROR, endpoints, DxtradeError } from "@/constants";
import { Cookies, parseWsData, shouldLog, debugLog, retryRequest, authHeaders } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Position } from ".";

export async function getPositions(ctx: ClientContext): Promise<Position.Get[]> {
  ctx.ensureSession();

  const wsUrl = endpoints.websocket(ctx.broker, ctx.atmosphereId);
  const cookieStr = Cookies.serialize(ctx.cookies);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

    const timer = setTimeout(() => {
      ws.close();
      reject(new DxtradeError(ERROR.ACCOUNT_POSITIONS_TIMEOUT, "Account positions timed out"));
    }, 30_000);

    ws.on("message", (data) => {
      const msg = parseWsData(data);
      if (shouldLog(msg, ctx.debug)) debugLog(msg);

      if (typeof msg === "string") return;
      if (msg.type === WS_MESSAGE.POSITIONS) {
        clearTimeout(timer);
        ws.close();
        resolve(msg.body as Position.Get[]);
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      ws.close();
      reject(new DxtradeError(ERROR.ACCOUNT_POSITIONS_ERROR, `Account positions error: ${error.message}`));
    });
  });
}

export async function getPositionMetrics(ctx: ClientContext, timeout = 30_000): Promise<Position.Metrics[]> {
  ctx.ensureSession();

  const wsUrl = endpoints.websocket(ctx.broker, ctx.atmosphereId);
  const cookieStr = Cookies.serialize(ctx.cookies);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

    const timer = setTimeout(() => {
      ws.close();
      reject(new DxtradeError(ERROR.POSITION_METRICS_TIMEOUT, "Position metrics timed out"));
    }, timeout);

    ws.on("message", (data) => {
      const msg = parseWsData(data);
      if (shouldLog(msg, ctx.debug)) debugLog(msg);

      if (typeof msg === "string") return;
      if (msg.type === WS_MESSAGE.POSITION_METRICS) {
        clearTimeout(timer);
        ws.close();
        resolve(msg.body as Position.Metrics[]);
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      ws.close();
      reject(new DxtradeError(ERROR.POSITION_METRICS_ERROR, `Position metrics error: ${error.message}`));
    });
  });
}

export async function closeAllPositions(ctx: ClientContext): Promise<void> {
  const positions = await getPositions(ctx);

  for (const pos of positions) {
    const closeData: Position.Close = {
      legs: [
        {
          instrumentId: pos.positionKey.instrumentId,
          positionCode: pos.positionKey.positionCode,
          positionEffect: "CLOSING",
          ratioQuantity: 1,
          symbol: pos.positionKey.positionCode,
        },
      ],
      limitPrice: 0,
      orderType: "MARKET",
      quantity: -pos.quantity,
      timeInForce: "GTC",
    };
    await closePosition(ctx, closeData);
  }
}

export async function closePosition(ctx: ClientContext, data: Position.Close): Promise<void> {
  try {
    await retryRequest(
      {
        method: "POST",
        url: endpoints.closePosition(ctx.broker),
        data,
        headers: authHeaders(ctx.csrf!, Cookies.serialize(ctx.cookies)),
      },
      ctx.retries,
    );
    // TODO:: Check response just like in order submit
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message =
      error instanceof Error ? ((error as any).response?.data?.message ?? error.message) : "Unknown error";
    ctx.throwError(ERROR.POSITION_CLOSE_ERROR, `Position close error: ${message}`);
  }
}
