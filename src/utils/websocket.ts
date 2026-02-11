import { appendFileSync, writeFileSync } from "fs";
import WebSocket from "ws";
import { WS_MESSAGE } from "@/constants/enums";

const DEBUG_LOG = "debug.log";

function shouldLog(msg: WsPayload | string, debug: boolean | string): boolean {
  if (!debug) return false;
  if (debug === true || debug === "true") return true;
  if (typeof msg === "string") return false;
  const filters = debug.split(",").map((s) => s.trim().toUpperCase());
  return filters.includes(msg.type);
}

function debugLog(msg: WsPayload | string): void {
  appendFileSync(DEBUG_LOG, JSON.stringify(msg) + "\n");
}

export function clearDebugLog(): void {
  writeFileSync(DEBUG_LOG, "");
}

export function parseWsData(data: WebSocket.Data): WsPayload | string {
  const raw = data.toString();
  const pipeIndex = raw.indexOf("|");
  if (pipeIndex === -1) return raw;

  try {
    return JSON.parse(raw.slice(pipeIndex + 1)) as WsPayload;
  } catch {
    return raw;
  }
}

export function waitForHandshake(wsUrl: string, cookieStr: string, timeout = 30_000, debug: boolean | string = false): Promise<void> {
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

export function createOrderListener(wsUrl: string, cookieStr: string, timeout = 30_000, debug: boolean | string = false): { promise: Promise<Order.Update>; ready: Promise<void> } {
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
