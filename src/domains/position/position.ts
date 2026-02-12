import WebSocket from "ws";
import { WS_MESSAGE, ERROR, endpoints, DxtradeError } from "@/constants";
import { Cookies, parseWsData, shouldLog, debugLog, retryRequest, authHeaders } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Position } from ".";

function mergePositionsWithMetrics(positions: Position.Get[], metrics: Position.Metrics[]): Position.Full[] {
  const metricsMap = new Map(metrics.map((m) => [m.uid, m]));
  return positions.map((pos) => {
    const m = metricsMap.get(pos.uid);
    return {
      ...pos,
      margin: m?.margin ?? 0,
      plOpen: m?.plOpen ?? 0,
      plClosed: m?.plClosed ?? 0,
      totalCommissions: m?.totalCommissions ?? 0,
      totalFinancing: m?.totalFinancing ?? 0,
      plRate: m?.plRate ?? 0,
      averagePrice: m?.averagePrice ?? 0,
      marketValue: m?.marketValue ?? 0,
    };
  });
}

export function streamPositions(ctx: ClientContext, callback: (positions: Position.Full[]) => void): () => void {
  if (!ctx.wsManager) {
    ctx.throwError(
      ERROR.STREAM_REQUIRES_CONNECT,
      "Streaming requires a persistent WebSocket. Use connect() instead of auth().",
    );
  }

  const emit = () => {
    const positions = ctx.wsManager!.getCached<Position.Get[]>(WS_MESSAGE.POSITIONS);
    const metrics = ctx.wsManager!.getCached<Position.Metrics[]>(WS_MESSAGE.POSITION_METRICS);
    if (positions && metrics) {
      callback(mergePositionsWithMetrics(positions, metrics));
    }
  };

  const onPositions = () => emit();
  const onMetrics = () => emit();

  ctx.wsManager.on(WS_MESSAGE.POSITIONS, onPositions);
  ctx.wsManager.on(WS_MESSAGE.POSITION_METRICS, onMetrics);

  emit();

  return () => {
    ctx.wsManager?.removeListener(WS_MESSAGE.POSITIONS, onPositions);
    ctx.wsManager?.removeListener(WS_MESSAGE.POSITION_METRICS, onMetrics);
  };
}

export async function getPositions(ctx: ClientContext): Promise<Position.Full[]> {
  ctx.ensureSession();

  if (ctx.wsManager) {
    const [positions, metrics] = await Promise.all([
      ctx.wsManager.waitFor<Position.Get[]>(WS_MESSAGE.POSITIONS),
      ctx.wsManager.waitFor<Position.Metrics[]>(WS_MESSAGE.POSITION_METRICS),
    ]);
    return mergePositionsWithMetrics(positions, metrics);
  }

  const wsUrl = endpoints.websocket(ctx.broker, ctx.atmosphereId);
  const cookieStr = Cookies.serialize(ctx.cookies);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });
    let positions: Position.Get[] | null = null;
    let metrics: Position.Metrics[] | null = null;

    const timer = setTimeout(() => {
      ws.close();
      reject(new DxtradeError(ERROR.ACCOUNT_POSITIONS_TIMEOUT, "Account positions timed out"));
    }, 30_000);

    ws.on("message", (data) => {
      const msg = parseWsData(data);
      if (shouldLog(msg, ctx.debug)) debugLog(msg);

      if (typeof msg === "string") return;
      if (msg.type === WS_MESSAGE.POSITIONS) {
        positions = msg.body as Position.Get[];
      }
      if (msg.type === WS_MESSAGE.POSITION_METRICS) {
        metrics = msg.body as Position.Metrics[];
      }
      if (positions && metrics) {
        clearTimeout(timer);
        ws.close();
        resolve(mergePositionsWithMetrics(positions, metrics));
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      ws.close();
      reject(new DxtradeError(ERROR.ACCOUNT_POSITIONS_ERROR, `Account positions error: ${error.message}`));
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
