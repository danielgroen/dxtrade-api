import WebSocket from "ws";
import { endpoints, DxtradeError, WS_MESSAGE, ERROR } from "@/constants";
import { Cookies, authHeaders, retryRequest, parseWsData, shouldLog, debugLog } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { OHLC } from ".";

export class OhlcDomain {
  constructor(private _ctx: ClientContext) {}

  /** Stream real-time OHLC bar updates. Requires connect(). Returns unsubscribe function. */
  async stream(params: OHLC.Params, callback: (bars: OHLC.Bar[]) => void): Promise<() => void> {
    if (!this._ctx.wsManager) {
      this._ctx.throwError(
        ERROR.STREAM_REQUIRES_CONNECT,
        "Streaming requires a persistent WebSocket. Use connect() instead of auth().",
      );
    }

    const { symbol, resolution = 60, range = 432_000, maxBars = 3500, priceField = "bid" } = params;
    const subtopic = WS_MESSAGE.SUBTOPIC.OHLC_STREAM;
    const headers = authHeaders(this._ctx.csrf!, Cookies.serialize(this._ctx.cookies));
    const snapshotBars: OHLC.Bar[] = [];
    let snapshotDone = false;
    let resolveSnapshot: (() => void) | null = null;

    const onChartFeed = (body: Record<string, unknown>) => {
      if (body?.subtopic !== subtopic) return;
      const data = body.data as OHLC.Bar[] | undefined;
      if (!Array.isArray(data)) return;

      if (!snapshotDone) {
        snapshotBars.push(...data);
        if (body.snapshotEnd) {
          snapshotDone = true;
          callback([...snapshotBars]);
          resolveSnapshot?.();
        }
      } else {
        callback(data);
      }
    };

    this._ctx.wsManager.on(WS_MESSAGE.CHART_FEED_SUBTOPIC, onChartFeed);

    try {
      await retryRequest(
        {
          method: "PUT",
          url: endpoints.subscribeInstruments(this._ctx.broker),
          data: { instruments: [symbol] },
          headers,
        },
        this._ctx.retries,
      );
      await retryRequest(
        {
          method: "PUT",
          url: endpoints.charts(this._ctx.broker),
          data: {
            chartIds: [],
            requests: [
              {
                aggregationPeriodSeconds: resolution,
                extendedSession: true,
                forexPriceField: priceField,
                id: 0,
                maxBarsCount: maxBars,
                range,
                studySubscription: [],
                subtopic,
                symbol,
              },
            ],
          },
          headers,
        },
        this._ctx.retries,
      );
    } catch (error: unknown) {
      this._ctx.wsManager.removeListener(WS_MESSAGE.CHART_FEED_SUBTOPIC, onChartFeed);
      const message = error instanceof Error ? error.message : "Unknown error";
      this._ctx.throwError(ERROR.OHLC_ERROR, `OHLC stream subscription error: ${message}`);
    }

    await new Promise<void>((resolve, reject) => {
      if (snapshotDone) return resolve();

      const timer = setTimeout(() => {
        if (snapshotBars.length > 0) {
          snapshotDone = true;
          callback([...snapshotBars]);
          resolve();
        } else {
          this._ctx.wsManager?.removeListener(WS_MESSAGE.CHART_FEED_SUBTOPIC, onChartFeed);
          reject(new DxtradeError(ERROR.OHLC_TIMEOUT, "OHLC stream snapshot timed out"));
        }
      }, 30_000);

      resolveSnapshot = () => {
        clearTimeout(timer);
        resolve();
      };
    });

    return () => {
      this._ctx.wsManager?.removeListener(WS_MESSAGE.CHART_FEED_SUBTOPIC, onChartFeed);
    };
  }

  /**
   * Fetch OHLC price bars for a symbol.
   * @param params.symbol - Instrument symbol (e.g. "EURUSD")
   * @param params.resolution - Bar period in seconds (default: 60 = 1 min)
   * @param params.range - Lookback window in seconds (default: 432000 = 5 days)
   * @param params.maxBars - Maximum bars to return (default: 3500)
   * @param params.priceField - "bid" or "ask" (default: "bid")
   */
  async get(params: OHLC.Params, timeout = 30_000): Promise<OHLC.Bar[]> {
    this._ctx.ensureSession();

    const { symbol, resolution = 60, range = 432_000, maxBars = 3500, priceField = "bid" } = params;
    const wsUrl = endpoints.websocket(this._ctx.broker, this._ctx.atmosphereId);
    const cookieStr = Cookies.serialize(this._ctx.cookies);
    const headers = authHeaders(this._ctx.csrf!, cookieStr);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });
      const bars: OHLC.Bar[] = [];
      let putsSent = false;
      let initSettleTimer: ReturnType<typeof setTimeout> | null = null;
      let barSettleTimer: ReturnType<typeof setTimeout> | null = null;

      const timer = setTimeout(() => {
        ws.close();
        reject(new DxtradeError(ERROR.OHLC_TIMEOUT, "OHLC data timed out"));
      }, timeout);

      function cleanup() {
        clearTimeout(timer);
        if (initSettleTimer) clearTimeout(initSettleTimer);
        if (barSettleTimer) clearTimeout(barSettleTimer);
        ws.close();
      }

      const sendPuts = async () => {
        putsSent = true;
        try {
          await retryRequest(
            {
              method: "PUT",
              url: endpoints.subscribeInstruments(this._ctx.broker),
              data: { instruments: [symbol] },
              headers,
            },
            this._ctx.retries,
          );
          await retryRequest(
            {
              method: "PUT",
              url: endpoints.charts(this._ctx.broker),
              data: {
                chartIds: [],
                requests: [
                  {
                    aggregationPeriodSeconds: resolution,
                    extendedSession: true,
                    forexPriceField: priceField,
                    id: 0,
                    maxBarsCount: maxBars,
                    range,
                    studySubscription: [],
                    subtopic: WS_MESSAGE.SUBTOPIC.BIG_CHART_COMPONENT,
                    symbol,
                  },
                ],
              },
              headers,
            },
            this._ctx.retries,
          );
        } catch (error: unknown) {
          cleanup();
          const message = error instanceof Error ? error.message : "Unknown error";
          reject(new DxtradeError(ERROR.OHLC_ERROR, `Error fetching OHLC data: ${message}`));
        }
      };

      ws.on("message", (data) => {
        const msg = parseWsData(data);
        if (shouldLog(msg, this._ctx.debug)) debugLog(msg);
        if (typeof msg === "string") return;

        // Wait for init burst to settle before sending PUTs
        if (!putsSent) {
          if (initSettleTimer) clearTimeout(initSettleTimer);
          initSettleTimer = setTimeout(() => sendPuts(), 1000);
          return;
        }

        // Collect chart bars
        const body = msg.body as Record<string, unknown>;
        if (body?.subtopic !== WS_MESSAGE.SUBTOPIC.BIG_CHART_COMPONENT) return;

        if (Array.isArray(body.data)) {
          bars.push(...(body.data as OHLC.Bar[]));
        }

        if (barSettleTimer) clearTimeout(barSettleTimer);
        if (body.snapshotEnd) {
          cleanup();
          resolve(bars);
        } else {
          barSettleTimer = setTimeout(() => {
            cleanup();
            resolve(bars);
          }, 2000);
        }
      });

      ws.on("error", (error) => {
        cleanup();
        reject(new DxtradeError(ERROR.OHLC_ERROR, `OHLC WebSocket error: ${error.message}`));
      });
    });
  }
}
