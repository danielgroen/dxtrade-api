import { DxtradeError, ERROR } from "@/constants";
import type { ClientContext, DxtradeConfig } from "./client.types";
import type { Account, Assessments, Instrument, OHLC, Order, Position, Symbol } from "./domains";
import {
  login,
  fetchCsrf,
  switchAccount,
  connect,
  getAccountMetrics,
  getTradeHistory,
  getPositions,
  getPositionMetrics,
  closePosition,
  closeAllPositions,
  getAssessments,
  getInstruments,
  getSymbolLimits,
  getSymbolSuggestions,
  getOHLC,
  getSymbolInfo,
  getOrders,
  cancelOrder,
  cancelAllOrders,
  submitOrder,
  getTradeJournal,
} from "@/domains";

/**
 * Client for interacting with the DXtrade trading API.
 *
 * @example
 * ```ts
 * import { DxtradeClient, ORDER_TYPE, SIDE, BROKER } from "dxtrade-api";
 *
 * const client = new DxtradeClient({
 *   username: "your_username",
 *   password: "your_password",
 *   broker: BROKER.FTMO,
 * });
 *
 * await client.connect();
 * ```
 */
export class DxtradeClient {
  private _ctx: ClientContext;

  constructor(config: DxtradeConfig) {
    const callbacks = config.callbacks ?? {};

    this._ctx = {
      config,
      callbacks,
      cookies: {},
      csrf: null,
      accountId: config.accountId ?? null,
      atmosphereId: null,
      broker: config.broker,
      retries: config.retries ?? 3,
      debug: config.debug ?? false,
      ensureSession() {
        if (!this.csrf) {
          throw new DxtradeError(
            ERROR.NO_SESSION,
            "No active session. Call login() and fetchCsrf() or connect() first.",
          );
        }
      },
      throwError(code: string, message: string): never {
        const error = new DxtradeError(code, message);
        callbacks.onError?.(error);
        throw error;
      },
    };
  }

  /** Authenticate with the broker using username and password. */
  public async login(): Promise<void> {
    return login(this._ctx);
  }

  /** Fetch the CSRF token required for authenticated requests. */
  public async fetchCsrf(): Promise<void> {
    return fetchCsrf(this._ctx);
  }

  /** Switch to a specific trading account by ID. */
  public async switchAccount(accountId: string): Promise<void> {
    return switchAccount(this._ctx, accountId);
  }

  /** Connect to the broker: login, fetch CSRF, WebSocket handshake, and optional account switch. */
  public async connect(): Promise<void> {
    return connect(this._ctx);
  }

  /** Search for symbols matching the given text (e.g. "EURUSD", "BTC"). */
  public async getSymbolSuggestions(text: string): Promise<Symbol.Suggestion[]> {
    return getSymbolSuggestions(this._ctx, text);
  }

  /** Get detailed instrument info for a symbol, including volume limits and lot size. */
  public async getSymbolInfo(symbol: string): Promise<Symbol.Info> {
    return getSymbolInfo(this._ctx, symbol);
  }

  /** Get order size limits and stop/limit distances for all symbols. */
  public async getSymbolLimits(): Promise<Symbol.Limits[]> {
    return getSymbolLimits(this._ctx);
  }

  /**
   * Submit a trading order and wait for WebSocket confirmation.
   * Supports market, limit, and stop orders with optional stop loss and take profit.
   */
  public async submitOrder(params: Order.SubmitParams): Promise<Order.Update> {
    return submitOrder(this._ctx, params);
  }

  /** Get all pending/open orders via WebSocket. */
  public async getOrders(): Promise<Order.Get[]> {
    return getOrders(this._ctx);
  }

  /** Cancel a single pending order by its order chain ID. */
  public async cancelOrder(orderChainId: number): Promise<void> {
    return cancelOrder(this._ctx, orderChainId);
  }

  /** Cancel all pending orders. */
  public async cancelAllOrders(): Promise<void> {
    return cancelAllOrders(this._ctx);
  }

  /** Get account metrics including equity, balance, margin, and open P&L. */
  public async getAccountMetrics(): Promise<Account.Metrics> {
    return getAccountMetrics(this._ctx);
  }

  /** Get all open positions via WebSocket. */
  public async getPositions(): Promise<Position.Get[]> {
    return getPositions(this._ctx);
  }

  /**
   * Close a position. Supports partial closes by specifying a quantity smaller than the full position size.
   */
  public async closePosition(position: Position.Close): Promise<void> {
    return closePosition(this._ctx, position);
  }

  /** Close all open positions with market orders. */
  public async closeAllPositions(): Promise<void> {
    return closeAllPositions(this._ctx);
  }

  /** Get position-level P&L metrics via WebSocket. */
  public async getPositionMetrics(): Promise<Position.Metrics[]> {
    return getPositionMetrics(this._ctx);
  }

  /**
   * Fetch trade journal entries for a date range.
   * @param params.from - Start timestamp (Unix ms)
   * @param params.to - End timestamp (Unix ms)
   */
  public async getTradeJournal(params: { from: number; to: number }): Promise<any> {
    return getTradeJournal(this._ctx, params);
  }

  /**
   * Fetch trade history for a date range.
   * @param params.from - Start timestamp (Unix ms)
   * @param params.to - End timestamp (Unix ms)
   */
  public async getTradeHistory(params: { from: number; to: number }): Promise<Account.TradeHistory[]> {
    return getTradeHistory(this._ctx, params);
  }

  /** Get all available instruments, optionally filtered by partial match (e.g. `{ type: "FOREX" }`). */
  public async getInstruments(params: Partial<Instrument.Info> = {}): Promise<Instrument.Info[]> {
    return getInstruments(this._ctx, params);
  }

  /** Fetch PnL assessments for an instrument within a date range. */
  public async getAssessments(params: Assessments.Params): Promise<Assessments.Response> {
    return getAssessments(this._ctx, params);
  }

  /**
   * Fetch OHLC price bars for a symbol.
   * @param params.symbol - Instrument symbol (e.g. "EURUSD")
   * @param params.resolution - Bar period in seconds (default: 60 = 1 min)
   * @param params.range - Lookback window in seconds (default: 432000 = 5 days)
   * @param params.maxBars - Maximum bars to return (default: 3500)
   * @param params.priceField - "bid" or "ask" (default: "bid")
   */
  public async getOHLC(params: OHLC.Params): Promise<OHLC.Bar[]> {
    return getOHLC(this._ctx, params);
  }
}
