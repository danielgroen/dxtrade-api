import crypto from "crypto";
import WebSocket from "ws";
import { endpoints, ORDER_TYPE, SIDE, ACTION, DxtradeError, ERROR } from "@/constants";
import { WS_MESSAGE, MESSAGE_CATEGORY, MESSAGE_TYPE, ORDER_STATUS } from "@/constants/enums";
import { Cookies, authHeaders, retryRequest, parseWsData, shouldLog, debugLog } from "@/utils";
import type { ClientContext } from "@/client.types";
import { SymbolsDomain } from "../symbol/symbol";
import type { Order, Message } from ".";

function createOrderListener(
  wsUrl: string,
  cookieStr: string,
  timeout = 30_000,
  debug: boolean | string = false,
): { promise: Promise<Order.Update>; ready: Promise<void> } {
  const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });
  let settled = false;

  const ready = new Promise<void>((resolve) => {
    ws.on("open", resolve);
  });

  const promise = new Promise<Order.Update>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      reject(new Error("[dxtrade-api] Order update timed out"));
    }, timeout);

    function done(err: Error | null, result?: Order.Update) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      if (err) reject(err);
      else resolve(result!);
    }

    ws.on("message", (data) => {
      const msg = parseWsData(data);
      if (shouldLog(msg, debug)) debugLog(msg);
      if (typeof msg === "string") return;

      // Trade log messages (fills and rejections come through here)
      if (msg.type === WS_MESSAGE.MESSAGE) {
        const messages = msg.body as Message.Entry[];
        const orderMsg = messages?.findLast?.(
          (m) =>
            m.messageCategory === MESSAGE_CATEGORY.TRADE_LOG &&
            m.messageType === MESSAGE_TYPE.ORDER &&
            !m.historyMessage,
        );
        if (!orderMsg) return;

        const params = orderMsg.parametersTO as Message.OrderParams;
        if (params.orderStatus === ORDER_STATUS.REJECTED) {
          const reason = params.rejectReason?.key ?? "Unknown reason";
          done(new Error(`[dxtrade-api] Order rejected: ${reason}`));
        } else if (params.orderStatus === ORDER_STATUS.FILLED) {
          done(null, {
            orderId: params.orderKey,
            status: params.orderStatus,
            symbol: params.symbol,
            filledQuantity: params.filledQuantity,
            filledPrice: params.filledPrice,
            positionCode: params.positionCode,
          });
        }
        return;
      }

      // Order updates (also carry fills)
      if (msg.type === WS_MESSAGE.ORDERS) {
        const body = (msg.body as Order.Update[])?.[0];
        if (!body?.orderId) return;

        if (body.status === ORDER_STATUS.REJECTED) {
          done(new Error(`[dxtrade-api] Order rejected: ${body.statusDescription ?? "Unknown reason"}`));
        } else if (body.status === ORDER_STATUS.FILLED) {
          done(null, body);
        }
      }
    });

    ws.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      reject(new Error(`[dxtrade-api] WebSocket order listener error: ${error.message}`));
    });
  });

  return { promise, ready };
}

function createWsManagerOrderListener(ctx: ClientContext, timeout = 30_000): Promise<Order.Update> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("[dxtrade-api] Order update timed out"));
    }, timeout);

    function done(err: Error | null, result?: Order.Update) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      if (err) reject(err);
      else resolve(result!);
    }

    function onMessage(body: unknown) {
      const messages = body as Message.Entry[];
      const orderMsg = messages?.findLast?.(
        (m) =>
          m.messageCategory === MESSAGE_CATEGORY.TRADE_LOG && m.messageType === MESSAGE_TYPE.ORDER && !m.historyMessage,
      );
      if (!orderMsg) return;

      const params = orderMsg.parametersTO as Message.OrderParams;
      if (params.orderStatus === ORDER_STATUS.REJECTED) {
        const reason = params.rejectReason?.key ?? "Unknown reason";
        done(new Error(`[dxtrade-api] Order rejected: ${reason}`));
      } else if (params.orderStatus === ORDER_STATUS.FILLED) {
        done(null, {
          orderId: params.orderKey,
          status: params.orderStatus,
          symbol: params.symbol,
          filledQuantity: params.filledQuantity,
          filledPrice: params.filledPrice,
          positionCode: params.positionCode,
        });
      }
    }

    function onOrders(body: unknown) {
      const order = (body as Order.Update[])?.[0];
      if (!order?.orderId) return;

      if (order.status === ORDER_STATUS.REJECTED) {
        done(new Error(`[dxtrade-api] Order rejected: ${order.statusDescription ?? "Unknown reason"}`));
      } else if (order.status === ORDER_STATUS.FILLED) {
        done(null, order);
      }
    }

    function cleanup() {
      ctx.wsManager?.removeListener(WS_MESSAGE.MESSAGE, onMessage);
      ctx.wsManager?.removeListener(WS_MESSAGE.ORDERS, onOrders);
    }

    ctx.wsManager!.on(WS_MESSAGE.MESSAGE, onMessage);
    ctx.wsManager!.on(WS_MESSAGE.ORDERS, onOrders);
  });
}

export class OrdersDomain {
  constructor(private _ctx: ClientContext) {}

  /** Get all pending/open orders via WebSocket. */
  async get(timeout = 30_000): Promise<Order.Get[]> {
    this._ctx.ensureSession();

    if (this._ctx.wsManager) {
      return this._ctx.wsManager.waitFor<Order.Get[]>(WS_MESSAGE.ORDERS, timeout);
    }

    const wsUrl = endpoints.websocket(this._ctx.broker, this._ctx.atmosphereId);
    const cookieStr = Cookies.serialize(this._ctx.cookies);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

      const timer = setTimeout(() => {
        ws.close();
        reject(new DxtradeError(ERROR.ORDERS_TIMEOUT, "Orders request timed out"));
      }, timeout);

      ws.on("message", (data) => {
        const msg = parseWsData(data);
        if (shouldLog(msg, this._ctx.debug)) debugLog(msg);

        if (typeof msg === "string") return;
        if (msg.type === WS_MESSAGE.ORDERS) {
          clearTimeout(timer);
          ws.close();
          resolve(msg.body as Order.Get[]);
        }
      });

      ws.on("error", (error) => {
        clearTimeout(timer);
        ws.close();
        reject(new DxtradeError(ERROR.ORDERS_ERROR, `Orders error: ${error.message}`));
      });
    });
  }

  /** Cancel a single pending order by its order chain ID. */
  async cancel(orderChainId: number): Promise<void> {
    this._ctx.ensureSession();

    const accountId = this._ctx.accountId ?? this._ctx.config.accountId;
    if (!accountId) {
      this._ctx.throwError(ERROR.CANCEL_ORDER_ERROR, "accountId is required to cancel an order");
    }

    try {
      await retryRequest(
        {
          method: "DELETE",
          url: endpoints.cancelOrder(this._ctx.broker, accountId, orderChainId),
          headers: authHeaders(this._ctx.csrf!, Cookies.serialize(this._ctx.cookies)),
        },
        this._ctx.retries,
      );
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message =
        error instanceof Error ? ((error as any).response?.data?.message ?? error.message) : "Unknown error";
      this._ctx.throwError(ERROR.CANCEL_ORDER_ERROR, `Cancel order error: ${message}`);
    }
  }

  /** Cancel all pending orders. */
  async cancelAll(): Promise<void> {
    const orders = await this.get();
    const pending = orders.filter((o) => !o.finalStatus);

    for (const order of pending) {
      await this.cancel(order.orderId);
    }
  }

  /**
   * Submit a trading order and wait for WebSocket confirmation.
   * Supports market, limit, and stop orders with optional stop loss and take profit.
   */
  async submit(params: Order.SubmitParams): Promise<Order.Update> {
    this._ctx.ensureSession();

    const {
      symbol,
      side,
      quantity,
      orderType,
      orderCode,
      price,
      instrumentId,
      stopLoss,
      takeProfit,
      positionEffect = ACTION.OPENING,
      positionCode,
      tif = "GTC",
      expireDate,
      metadata,
    } = params;
    const info = await new SymbolsDomain(this._ctx).info(symbol);
    const units = quantity * info.lotSize;
    const qty = side === SIDE.BUY ? units : -units;
    const priceParam = orderType === ORDER_TYPE.STOP ? "stopPrice" : "limitPrice";

    const orderData: Record<string, unknown> = {
      directExchange: false,
      legs: [
        {
          ...(instrumentId != null && { instrumentId }),
          ...(positionCode != null && { positionCode }),
          positionEffect,
          ratioQuantity: 1,
          symbol,
        },
      ],
      orderSide: side,
      orderType,
      quantity: qty,
      requestId: orderCode ?? `gwt-uid-931-${crypto.randomUUID()}`,
      timeInForce: tif,
      ...(expireDate != null && { expireDate }),
      ...(metadata != null && { metadata }),
    };

    if (price != null) {
      orderData[priceParam] = price;
    }

    if (stopLoss) {
      orderData.stopLoss = {
        ...(stopLoss.offset != null && { fixedOffset: stopLoss.offset }),
        ...(stopLoss.price != null && { fixedPrice: stopLoss.price }),
        priceFixed: stopLoss.price != null,
        orderChainId: 0,
        orderId: 0,
        orderType: ORDER_TYPE.STOP,
        quantityForProtection: qty,
        removed: false,
      };
    }

    if (takeProfit) {
      orderData.takeProfit = {
        ...(takeProfit.offset != null && { fixedOffset: takeProfit.offset }),
        ...(takeProfit.price != null && { fixedPrice: takeProfit.price }),
        priceFixed: takeProfit.price != null,
        orderChainId: 0,
        orderId: 0,
        orderType: ORDER_TYPE.LIMIT,
        quantityForProtection: qty,
        removed: false,
      };
    }

    try {
      // Set up listener BEFORE submitting so we don't miss the response
      let listenerPromise: Promise<Order.Update>;

      if (this._ctx.wsManager) {
        listenerPromise = createWsManagerOrderListener(this._ctx, 30_000);
      } else {
        const wsUrl = endpoints.websocket(this._ctx.broker, this._ctx.atmosphereId);
        const cookieStr = Cookies.serialize(this._ctx.cookies);
        const listener = createOrderListener(wsUrl, cookieStr, 30_000, this._ctx.debug);
        await listener.ready;
        listenerPromise = listener.promise;
      }

      const response = await retryRequest(
        {
          method: "POST",
          url: endpoints.submitOrder(this._ctx.broker),
          data: orderData,
          headers: authHeaders(this._ctx.csrf!, Cookies.serialize(this._ctx.cookies)),
        },
        this._ctx.retries,
      );

      this._ctx.callbacks.onOrderPlaced?.(response.data as Order.Response);

      const orderUpdate = await listenerPromise;

      this._ctx.callbacks.onOrderUpdate?.(orderUpdate);
      return orderUpdate;
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message =
        error instanceof Error ? ((error as any).response?.data?.message ?? error.message) : "Unknown error";
      this._ctx.throwError(ERROR.ORDER_ERROR, `Error submitting order: ${message}`);
    }
  }
}
