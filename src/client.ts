import { DxtradeError, ERROR } from "@/constants";
import type { ClientContext, DxtradeConfig } from "./client.types";
import type { Account, Assessments, Instrument, OHLC, Order, Position, Symbol } from "./domains";
import {
  login,
  fetchCsrf,
  switchAccount,
  auth,
  connect,
  disconnect,
  getAccountMetrics,
  getTradeHistory,
  getPositions,
  closePosition,
  closeAllPositions,
  streamPositions,
  getAssessments,
  getInstruments,
  getSymbolLimits,
  getSymbolSuggestions,
  getOHLC,
  streamOHLC,
  getSymbolInfo,
  getOrders,
  cancelOrder,
  cancelAllOrders,
  submitOrder,
  getTradeJournal,
} from "@/domains";

class PositionsDomain {
  constructor(private _ctx: ClientContext) {}

  /** Get all open positions with P&L metrics merged. */
  get(): Promise<Position.Full[]> {
    return getPositions(this._ctx);
  }

  /** Close a position. Supports partial closes by specifying a quantity smaller than the full position size. */
  close(params: Position.Close): Promise<void> {
    return closePosition(this._ctx, params);
  }

  /** Close all open positions with market orders. */
  closeAll(): Promise<void> {
    return closeAllPositions(this._ctx);
  }

  /** Stream real-time position updates with P&L metrics. Requires connect(). Returns unsubscribe function. */
  stream(callback: (positions: Position.Full[]) => void): () => void {
    return streamPositions(this._ctx, callback);
  }
}

class OrdersDomain {
  constructor(private _ctx: ClientContext) {}

  /** Get all pending/open orders via WebSocket. */
  get(): Promise<Order.Get[]> {
    return getOrders(this._ctx);
  }

  /**
   * Submit a trading order and wait for WebSocket confirmation.
   * Supports market, limit, and stop orders with optional stop loss and take profit.
   */
  submit(params: Order.SubmitParams): Promise<Order.Update> {
    return submitOrder(this._ctx, params);
  }

  /** Cancel a single pending order by its order chain ID. */
  cancel(orderChainId: number): Promise<void> {
    return cancelOrder(this._ctx, orderChainId);
  }

  /** Cancel all pending orders. */
  cancelAll(): Promise<void> {
    return cancelAllOrders(this._ctx);
  }
}

class AccountDomain {
  constructor(private _ctx: ClientContext) {}

  /** Get account metrics including equity, balance, margin, and open P&L. */
  metrics(): Promise<Account.Metrics> {
    return getAccountMetrics(this._ctx);
  }

  /**
   * Fetch trade journal entries for a date range.
   * @param params.from - Start timestamp (Unix ms)
   * @param params.to - End timestamp (Unix ms)
   */
  tradeJournal(params: { from: number; to: number }): Promise<any> {
    return getTradeJournal(this._ctx, params);
  }

  /**
   * Fetch trade history for a date range.
   * @param params.from - Start timestamp (Unix ms)
   * @param params.to - End timestamp (Unix ms)
   */
  tradeHistory(params: { from: number; to: number }): Promise<Account.TradeHistory[]> {
    return getTradeHistory(this._ctx, params);
  }
}

class SymbolsDomain {
  constructor(private _ctx: ClientContext) {}

  /** Search for symbols matching the given text (e.g. "EURUSD", "BTC"). */
  search(text: string): Promise<Symbol.Suggestion[]> {
    return getSymbolSuggestions(this._ctx, text);
  }

  /** Get detailed instrument info for a symbol, including volume limits and lot size. */
  info(symbol: string): Promise<Symbol.Info> {
    return getSymbolInfo(this._ctx, symbol);
  }

  /** Get order size limits and stop/limit distances for all symbols. */
  limits(): Promise<Symbol.Limits[]> {
    return getSymbolLimits(this._ctx);
  }
}

class InstrumentsDomain {
  constructor(private _ctx: ClientContext) {}

  /** Get all available instruments, optionally filtered by partial match (e.g. `{ type: "FOREX" }`). */
  get(params: Partial<Instrument.Info> = {}): Promise<Instrument.Info[]> {
    return getInstruments(this._ctx, params);
  }
}

class OhlcDomain {
  constructor(private _ctx: ClientContext) {}

  /**
   * Fetch OHLC price bars for a symbol.
   * @param params.symbol - Instrument symbol (e.g. "EURUSD")
   * @param params.resolution - Bar period in seconds (default: 60 = 1 min)
   * @param params.range - Lookback window in seconds (default: 432000 = 5 days)
   * @param params.maxBars - Maximum bars to return (default: 3500)
   * @param params.priceField - "bid" or "ask" (default: "bid")
   */
  get(params: OHLC.Params): Promise<OHLC.Bar[]> {
    return getOHLC(this._ctx, params);
  }

  /** Stream real-time OHLC bar updates. Requires connect(). Returns unsubscribe function. */
  stream(params: OHLC.Params, callback: (bars: OHLC.Bar[]) => void): Promise<() => void> {
    return streamOHLC(this._ctx, params, callback);
  }
}

class AssessmentsDomain {
  constructor(private _ctx: ClientContext) {}

  /** Fetch PnL assessments for an instrument within a date range. */
  get(params: Assessments.Params): Promise<Assessments.Response> {
    return getAssessments(this._ctx, params);
  }
}

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

  /** Position operations: get, close, metrics, streaming. */
  public readonly positions: PositionsDomain;
  /** Order operations: get, submit, cancel. */
  public readonly orders: OrdersDomain;
  /** Account operations: metrics, trade journal, trade history. */
  public readonly account: AccountDomain;
  /** Symbol operations: search, info, limits. */
  public readonly symbols: SymbolsDomain;
  /** Instrument operations: get (with optional filtering). */
  public readonly instruments: InstrumentsDomain;
  /** OHLC price bar operations: get, stream. */
  public readonly ohlc: OhlcDomain;
  /** PnL assessment operations: get. */
  public readonly assessments: AssessmentsDomain;

  constructor(config: DxtradeConfig) {
    const callbacks = config.callbacks ?? {};

    this._ctx = {
      config,
      callbacks,
      cookies: {},
      csrf: null,
      accountId: config.accountId ?? null,
      atmosphereId: null,
      wsManager: null,
      broker: config.broker,
      retries: config.retries ?? 3,
      debug: config.debug ?? false,
      ensureSession() {
        if (!this.csrf) {
          throw new DxtradeError(ERROR.NO_SESSION, "No active session. Call auth() or connect() first.");
        }
      },
      throwError(code: string, message: string): never {
        const error = new DxtradeError(code, message);
        callbacks.onError?.(error);
        throw error;
      },
    };

    this.positions = new PositionsDomain(this._ctx);
    this.orders = new OrdersDomain(this._ctx);
    this.account = new AccountDomain(this._ctx);
    this.symbols = new SymbolsDomain(this._ctx);
    this.instruments = new InstrumentsDomain(this._ctx);
    this.ohlc = new OhlcDomain(this._ctx);
    this.assessments = new AssessmentsDomain(this._ctx);
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

  /** Authenticate and establish a session: login, fetch CSRF, WebSocket handshake, and optional account switch. */
  public async auth(): Promise<void> {
    return auth(this._ctx);
  }

  /** Connect to the broker with a persistent WebSocket: auth + persistent WS for data reuse and streaming. */
  public async connect(): Promise<void> {
    return connect(this._ctx);
  }

  /** Close the persistent WebSocket connection. */
  public disconnect(): void {
    return disconnect(this._ctx);
  }
}
