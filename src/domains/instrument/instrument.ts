import WebSocket from "ws";
import { endpoints, DxtradeError, WS_MESSAGE, ERROR } from "@/constants";
import { Cookies, parseWsData, shouldLog, debugLog, checkWsRateLimit } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Instrument } from ".";

export class InstrumentsDomain {
  constructor(private _ctx: ClientContext) {}

  /** Get all available instruments, optionally filtered by partial match (e.g. `{ type: "FOREX" }`). */
  async get(params: Partial<Instrument.Info> = {}, timeout = 30_000): Promise<Instrument.Info[]> {
    this._ctx.ensureSession();

    const wsUrl = endpoints.websocket(this._ctx.broker, this._ctx.atmosphereId);
    const cookieStr = Cookies.serialize(this._ctx.cookies);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

      const timer = setTimeout(() => {
        ws.close();
        reject(new DxtradeError(ERROR.INSTRUMENTS_TIMEOUT, "Instruments request timed out"));
      }, timeout);

      let instruments: Instrument.Info[] = [];
      let settleTimer: ReturnType<typeof setTimeout> | null = null;

      ws.on("message", (data) => {
        const msg = parseWsData(data);
        if (shouldLog(msg, this._ctx.debug)) debugLog(msg);

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
          }, 200);
        }
      });

      ws.on("error", (error) => {
        clearTimeout(timer);
        ws.close();
        checkWsRateLimit(error);
        reject(new DxtradeError(ERROR.INSTRUMENTS_ERROR, `Instruments error: ${error.message}`));
      });
    });
  }
}
