import WebSocket from "ws";
import { WS_MESSAGE, endpoints, DxtradeError } from "@/constants";
import { Cookies, parseWsData, shouldLog, debugLog, retryRequest, baseHeaders } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Account } from ".";

export async function getAccountMetrics(ctx: ClientContext, timeout = 30_000): Promise<Account.Metrics> {
  ctx.ensureSession();

  const wsUrl = endpoints.websocket(ctx.broker);
  const cookieStr = Cookies.serialize(ctx.cookies);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

    const timer = setTimeout(() => {
      ws.close();
      reject(new DxtradeError("ACCOUNT_METRICS_TIMEOUT", "Account metrics timed out"));
    }, timeout);

    ws.on("message", (data) => {
      const msg = parseWsData(data);
      if (shouldLog(msg, ctx.debug)) debugLog(msg);

      if (typeof msg === "string") return;
      if (msg.type === WS_MESSAGE.ACCOUNT_METRICS) {
        clearTimeout(timer);
        ws.close();
        const body = msg.body as { allMetrics: Account.Metrics };
        resolve(body.allMetrics);
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      ws.close();
      reject(new DxtradeError("ACCOUNT_METRICS_ERROR", `Account metrics error: ${error.message}`));
    });
  });
}

export async function getTradeJournal(ctx: ClientContext, params: { from: number; to: number }): Promise<any> {
  ctx.ensureSession();

  try {
    const cookieStr = Cookies.serialize(ctx.cookies);

    const response = await retryRequest(
      {
        method: "GET",
        url: endpoints.tradeJournal(ctx.broker, params),
        headers: { ...baseHeaders(), Cookie: cookieStr },
      },
      ctx.retries,
    );

    if (response.status === 200) {
      const setCookies = response.headers["set-cookie"] ?? [];
      const incoming = Cookies.parse(setCookies);
      ctx.cookies = Cookies.merge(ctx.cookies, incoming);
      return response.data;
    } else {
      ctx.throwError("TRADE_JOURNAL_ERROR", `Login failed: ${response.status}`);
    }
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError("TRADE_JOURNAL_ERROR", `Trade journal error: ${message}`);
  }
}
