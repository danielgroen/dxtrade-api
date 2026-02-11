import WebSocket from "ws";
import { WS_MESSAGE, endpoints, DxtradeError } from "@/constants";
import { Cookies, parseWsData, shouldLog, debugLog, retryRequest, authHeaders } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Position } from ".";

export async function getPositions(ctx: ClientContext): Promise<Position.Get[]> {
  ctx.ensureSession();

  const wsUrl = endpoints.websocket(ctx.broker);
  const cookieStr = Cookies.serialize(ctx.cookies);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

    const timer = setTimeout(() => {
      ws.close();
      reject(new DxtradeError("ACCOUNT_POSITIONS_TIMEOUT", "Account positions timed out"));
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
      reject(new DxtradeError("ACCOUNT_POSITIONS_ERROR", `Account positions error: ${error.message}`));
    });
  });
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
    ctx.throwError("POSITION_CLOSE_ERROR", `Position close error: ${message}`);
  }
}
