import WebSocket from "ws";
import { endpoints, DxtradeError } from "@/constants";
import { WS_MESSAGE } from "@/constants/enums";
import { Cookies, parseWsData, shouldLog, debugLog } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Instrument } from ".";

export async function getInstruments(
  ctx: ClientContext,
  params: Partial<Instrument.Info> = {},
  timeout = 30_000,
): Promise<Instrument.Info[]> {
  ctx.ensureSession();

  const wsUrl = endpoints.websocket(ctx.baseUrl);
  const cookieStr = Cookies.serialize(ctx.cookies);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

    const timer = setTimeout(() => {
      ws.close();
      reject(new DxtradeError("INSTRUMENTS_TIMEOUT", "Instruments request timed out"));
    }, timeout);

    let instruments: Instrument.Info[] = [];
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    ws.on("message", (data) => {
      const msg = parseWsData(data);
      if (shouldLog(msg, ctx.debug)) debugLog(msg);

      if (typeof msg === "string") return;
      if (msg.type === WS_MESSAGE.INSTRUMENTS) {
        instruments.push(...(msg.body as Instrument.Info[]));

        // Reset settle timer on each batch — resolve once no more arrive
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          clearTimeout(timer);
          ws.close();
          resolve(
            instruments.filter((instrument) => {
              for (const key in params) {
                if (params[key as keyof Instrument.Info] !== instrument[key as keyof Instrument.Info]) {
                  return false;
                }
              }
              return true;
            }),
          );
        }, 0);
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      ws.close();
      reject(new DxtradeError("INSTRUMENTS_ERROR", `Instruments error: ${error.message}`));
    });
  });
}
