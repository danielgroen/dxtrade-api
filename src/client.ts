import { DxtradeError } from "@/constants";
import type { ClientContext, DxtradeConfig } from "./client.types";
import type { Account, Assessments, Instrument, Order, Position, Symbol } from "./domains";
import {
  login,
  fetchCsrf,
  switchAccount,
  connect,
  getAccountMetrics,
  getPositions,
  closePosition,
  getAssessments,
  getInstruments,
  getSymbolLimits,
  getSymbolSuggestions,
  getSymbolInfo,
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
      broker: config.broker,
      retries: config.retries ?? 3,
      debug: config.debug ?? false,
      ensureSession() {
        if (!this.csrf) {
          throw new DxtradeError("NO_SESSION", "No active session. Call login() and fetchCsrf() or connect() first.");
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

  /** Get account metrics including equity, balance, margin, and open P&L. */
  public async getAccountMetrics(): Promise<Account.Metrics> {
    return getAccountMetrics(this._ctx);
  }

  /** Get all open positions via WebSocket. */
  public async getPositions(): Promise<Position.Get[]> {
    return getPositions(this._ctx);
  }

  /** Close a position. */
  public async closePosition(position: Position.Close): Promise<void> {
    return closePosition(this._ctx, position);
  }

  /**
   * Fetch trade journal entries for a date range.
   * @param params.from - Start timestamp (Unix ms)
   * @param params.to - End timestamp (Unix ms)
   */
  public async getTradeJournal(params: { from: number; to: number }): Promise<any> {
    return getTradeJournal(this._ctx, params);
  }

  /** Get all available instruments, optionally filtered by partial match (e.g. `{ type: "FOREX" }`). */
  public async getInstruments(params: Partial<Instrument.Info> = {}): Promise<Instrument.Info[]> {
    return getInstruments(this._ctx, params);
  }

  /** Fetch PnL assessments for an instrument within a date range. */
  public async getAssessments(params: Assessments.Params): Promise<Assessments.Response> {
    return getAssessments(this._ctx, params);
  }
}
