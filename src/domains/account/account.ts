import WebSocket from "ws";
import { endpoints, DxtradeError } from "@/constants";
import { WS_MESSAGE } from "@/constants/enums";
import { Cookies, parseWsData, shouldLog, debugLog } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Account } from ".";

export async function getAccountMetrics(ctx: ClientContext, timeout = 30_000): Promise<Account.Metrics> {
  ctx.ensureSession();

  const wsUrl = endpoints.websocket(ctx.baseUrl);
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
