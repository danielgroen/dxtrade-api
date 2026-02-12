import crypto from "crypto";
import WebSocket from "ws";
import { endpoints, ORDER_TYPE, SIDE, ACTION, DxtradeError, ERROR } from "@/constants";
import { WS_MESSAGE } from "@/constants/enums";
import { Cookies, authHeaders, retryRequest, parseWsData, shouldLog, debugLog } from "@/utils";
import type { ClientContext } from "@/client.types";
import { getSymbolInfo } from "../symbol/symbol";
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
          (m) => m.messageCategory === "TRADE_LOG" && m.messageType === "ORDER" && !m.historyMessage,
        );
        if (!orderMsg) return;

        const params = orderMsg.parametersTO as Message.OrderParams;
        if (params.orderStatus === "REJECTED") {
          const reason = params.rejectReason?.key ?? "Unknown reason";
          done(new Error(`[dxtrade-api] Order rejected: ${reason}`));
        } else if (params.orderStatus === "FILLED") {
          done(null, {
            orderId: params.orderKey,
            status: params.orderStatus,
            symbol: params.symbol,
            filledQuantity: params.filledQuantity,
            filledPrice: params.filledPrice,
          });
        }
        return;
      }

      // Order updates (also carry fills)
      if (msg.type === WS_MESSAGE.ORDERS) {
        const body = (msg.body as Order.Update[])?.[0];
        if (!body?.orderId) return;

        if (body.status === "REJECTED") {
          done(new Error(`[dxtrade-api] Order rejected: ${body.statusDescription ?? "Unknown reason"}`));
        } else if (body.status === "FILLED") {
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

export async function submitOrder(ctx: ClientContext, params: Order.SubmitParams): Promise<Order.Update> {
  ctx.ensureSession();

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
  const info = await getSymbolInfo(ctx, symbol);
  const units = Math.round(quantity * info.lotSize);
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

  if (price != null && orderType !== ORDER_TYPE.MARKET) {
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
    // Open WS listener BEFORE submitting so we don't miss the response
    const wsUrl = endpoints.websocket(ctx.broker, ctx.atmosphereId);
    const cookieStr = Cookies.serialize(ctx.cookies);
    const listener = createOrderListener(wsUrl, cookieStr, 30_000, ctx.debug);
    await listener.ready;

    const response = await retryRequest(
      {
        method: "POST",
        url: endpoints.submitOrder(ctx.broker),
        data: orderData,
        headers: authHeaders(ctx.csrf!, Cookies.serialize(ctx.cookies)),
      },
      ctx.retries,
    );

    ctx.callbacks.onOrderPlaced?.(response.data as Order.Response);

    const orderUpdate = await listener.promise;

    ctx.callbacks.onOrderUpdate?.(orderUpdate);
    return orderUpdate;
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message =
      error instanceof Error ? ((error as any).response?.data?.message ?? error.message) : "Unknown error";
    ctx.throwError(ERROR.ORDER_ERROR, `Error submitting order: ${message}`);
  }
}
