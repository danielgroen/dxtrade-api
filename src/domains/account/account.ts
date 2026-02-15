import WebSocket from "ws";
import { WS_MESSAGE, ERROR, endpoints, DxtradeError } from "@/constants";
import { Cookies, parseWsData, shouldLog, debugLog, retryRequest, baseHeaders, authHeaders, checkWsRateLimit } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Account } from ".";

export class AccountDomain {
  constructor(private _ctx: ClientContext) {}

  /** Get account metrics including equity, balance, margin, and open P&L. */
  async metrics(timeout = 30_000): Promise<Account.Metrics> {
    this._ctx.ensureSession();

    if (this._ctx.wsManager) {
      const body = await this._ctx.wsManager.waitFor<{ allMetrics: Account.Metrics }>(
        WS_MESSAGE.ACCOUNT_METRICS,
        timeout,
      );
      return body.allMetrics;
    }

    const wsUrl = endpoints.websocket(this._ctx.broker, this._ctx.atmosphereId);
    const cookieStr = Cookies.serialize(this._ctx.cookies);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

      const timer = setTimeout(() => {
        ws.close();
        reject(new DxtradeError(ERROR.ACCOUNT_METRICS_TIMEOUT, "Account metrics timed out"));
      }, timeout);

      ws.on("message", (data) => {
        const msg = parseWsData(data);
        if (shouldLog(msg, this._ctx.debug)) debugLog(msg);

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
        checkWsRateLimit(error);
        reject(new DxtradeError(ERROR.ACCOUNT_METRICS_ERROR, `Account metrics error: ${error.message}`));
      });
    });
  }

  /**
   * Fetch trade history for a date range.
   * @param params.from - Start timestamp (Unix ms)
   * @param params.to - End timestamp (Unix ms)
   */
  async tradeHistory(params: { from: number; to: number }): Promise<Account.TradeHistory[]> {
    this._ctx.ensureSession();

    try {
      const response = await retryRequest(
        {
          method: "POST",
          url: endpoints.tradeHistory(this._ctx.broker, params),
          headers: authHeaders(this._ctx.csrf!, Cookies.serialize(this._ctx.cookies)),
        },
        this._ctx.retries,
      );

      if (response.status === 200) {
        const setCookies = response.headers["set-cookie"] ?? [];
        const incoming = Cookies.parse(setCookies);
        this._ctx.cookies = Cookies.merge(this._ctx.cookies, incoming);
        return response.data as Account.TradeHistory[];
      } else {
        this._ctx.throwError(ERROR.TRADE_HISTORY_ERROR, `Trade history failed: ${response.status}`);
      }
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this._ctx.throwError(ERROR.TRADE_HISTORY_ERROR, `Trade history error: ${message}`);
    }
  }

  /**
   * Fetch trade journal entries for a date range.
   * @param params.from - Start timestamp (Unix ms)
   * @param params.to - End timestamp (Unix ms)
   */
  async tradeJournal(params: { from: number; to: number }): Promise<any> {
    this._ctx.ensureSession();

    try {
      const cookieStr = Cookies.serialize(this._ctx.cookies);

      const response = await retryRequest(
        {
          method: "GET",
          url: endpoints.tradeJournal(this._ctx.broker, params),
          headers: { ...baseHeaders(), Cookie: cookieStr },
        },
        this._ctx.retries,
      );

      if (response.status === 200) {
        const setCookies = response.headers["set-cookie"] ?? [];
        const incoming = Cookies.parse(setCookies);
        this._ctx.cookies = Cookies.merge(this._ctx.cookies, incoming);
        return response.data;
      } else {
        this._ctx.throwError(ERROR.TRADE_JOURNAL_ERROR, `Login failed: ${response.status}`);
      }
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this._ctx.throwError(ERROR.TRADE_JOURNAL_ERROR, `Trade journal error: ${message}`);
    }
  }
}
