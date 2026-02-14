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

export class PositionsDomain {
  constructor(private _ctx: ClientContext) {}

  /** Stream real-time position updates with P&L metrics. Requires connect(). Returns unsubscribe function. */
  stream(callback: (positions: Position.Full[]) => void): () => void {
    if (!this._ctx.wsManager) {
      this._ctx.throwError(
        ERROR.STREAM_REQUIRES_CONNECT,
        "Streaming requires a persistent WebSocket. Use connect() instead of auth().",
      );
    }

    const emit = () => {
      const positions = this._ctx.wsManager!.getCached<Position.Get[]>(WS_MESSAGE.POSITIONS);
      const metrics = this._ctx.wsManager!.getCached<Position.Metrics[]>(WS_MESSAGE.POSITION_METRICS);
      if (positions && metrics) {
        callback(mergePositionsWithMetrics(positions, metrics));
      }
    };

    const onPositions = () => emit();
    const onMetrics = () => emit();

    this._ctx.wsManager.on(WS_MESSAGE.POSITIONS, onPositions);
    this._ctx.wsManager.on(WS_MESSAGE.POSITION_METRICS, onMetrics);

    emit();

    return () => {
      this._ctx.wsManager?.removeListener(WS_MESSAGE.POSITIONS, onPositions);
      this._ctx.wsManager?.removeListener(WS_MESSAGE.POSITION_METRICS, onMetrics);
    };
  }

  /** Get all open positions with P&L metrics merged. */
  async get(): Promise<Position.Full[]> {
    this._ctx.ensureSession();

    if (this._ctx.wsManager) {
      const [positions, metrics] = await Promise.all([
        this._ctx.wsManager.waitFor<Position.Get[]>(WS_MESSAGE.POSITIONS),
        this._ctx.wsManager.waitFor<Position.Metrics[]>(WS_MESSAGE.POSITION_METRICS),
      ]);
      return mergePositionsWithMetrics(positions, metrics);
    }

    const wsUrl = endpoints.websocket(this._ctx.broker, this._ctx.atmosphereId);
    const cookieStr = Cookies.serialize(this._ctx.cookies);

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
        if (shouldLog(msg, this._ctx.debug)) debugLog(msg);

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

  /** Close all open positions with market orders. */
  async closeAll(): Promise<void> {
    const positions = await this.get();

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
      await this._sendCloseRequest(closeData);
    }
  }

  /** Close a position by its position code. Returns the position with P&L metrics. Optionally wait for close confirmation via `waitForClose: "stream" | "poll"`. */
  async close(positionCode: string, options?: Position.CloseOptions): Promise<Position.Full> {
    const positions = await this.get();
    const position = positions.find((p) => p.positionKey.positionCode === positionCode);

    if (!position) {
      this._ctx.throwError(ERROR.POSITION_NOT_FOUND, `Position with code "${positionCode}" not found`);
    }

    const closeData: Position.Close = {
      legs: [
        {
          instrumentId: position.positionKey.instrumentId,
          positionCode: position.positionKey.positionCode,
          positionEffect: "CLOSING",
          ratioQuantity: 1,
          symbol: position.positionKey.positionCode,
        },
      ],
      limitPrice: 0,
      orderType: "MARKET",
      quantity: -position.quantity,
      timeInForce: "GTC",
    };

    await this._sendCloseRequest(closeData);

    if (options?.waitForClose === "stream") {
      return this._waitForCloseStream(positionCode, position, options.timeout ?? 30_000);
    }

    if (options?.waitForClose === "poll") {
      return this._waitForClosePoll(positionCode, position, options.timeout ?? 30_000, options.pollInterval ?? 1_000);
    }

    return position;
  }

  private _waitForCloseStream(
    positionCode: string,
    lastSnapshot: Position.Full,
    timeout: number,
  ): Promise<Position.Full> {
    if (!this._ctx.wsManager) {
      this._ctx.throwError(
        ERROR.STREAM_REQUIRES_CONNECT,
        'waitForClose: "stream" requires a persistent WebSocket. Use connect() instead of auth(), or use "poll" mode.',
      );
    }

    return new Promise((resolve, reject) => {
      let result = lastSnapshot;

      const timer = setTimeout(() => {
        unsubscribe();
        reject(
          new DxtradeError(ERROR.POSITION_CLOSE_TIMEOUT, `Position close confirmation timed out after ${timeout}ms`),
        );
      }, timeout);

      const unsubscribe = this.stream((positions) => {
        const match = positions.find((p) => p.positionKey.positionCode === positionCode);
        if (match) {
          result = match;
        } else {
          clearTimeout(timer);
          unsubscribe();
          resolve(result);
        }
      });
    });
  }

  private async _waitForClosePoll(
    positionCode: string,
    lastSnapshot: Position.Full,
    timeout: number,
    interval: number,
  ): Promise<Position.Full> {
    const deadline = Date.now() + timeout;
    let result = lastSnapshot;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval));
      const positions = await this.get();
      const match = positions.find((p) => p.positionKey.positionCode === positionCode);
      if (match) {
        result = match;
      } else {
        return result;
      }
    }

    this._ctx.throwError(ERROR.POSITION_CLOSE_TIMEOUT, `Position close confirmation timed out after ${timeout}ms`);
  }

  private async _sendCloseRequest(data: Position.Close): Promise<void> {
    try {
      await retryRequest(
        {
          method: "POST",
          url: endpoints.closePosition(this._ctx.broker),
          data,
          headers: authHeaders(this._ctx.csrf!, Cookies.serialize(this._ctx.cookies)),
        },
        this._ctx.retries,
      );
      // TODO:: Check response just like in order submit
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message =
        error instanceof Error ? ((error as any).response?.data?.message ?? error.message) : "Unknown error";
      this._ctx.throwError(ERROR.POSITION_CLOSE_ERROR, `Position close error: ${message}`);
    }
  }
}
