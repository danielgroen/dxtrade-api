import { DxtradeError, ERROR } from "@/constants";
import type { ClientContext, DxtradeConfig } from "./client.types";
import {
  SessionDomain,
  PositionsDomain,
  OrdersDomain,
  AccountDomain,
  SymbolsDomain,
  InstrumentsDomain,
  OhlcDomain,
  AssessmentsDomain,
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
  private _session: SessionDomain;

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

    this._session = new SessionDomain(this._ctx);
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
    return this._session.login();
  }

  /** Fetch the CSRF token required for authenticated requests. */
  public async fetchCsrf(): Promise<void> {
    return this._session.fetchCsrf();
  }

  /** Switch to a specific trading account by ID. */
  public async switchAccount(accountId: string): Promise<void> {
    return this._session.switchAccount(accountId);
  }

  /** Authenticate and establish a session: login, fetch CSRF, WebSocket handshake, and optional account switch. */
  public async auth(): Promise<void> {
    return this._session.auth();
  }

  /** Connect to the broker with a persistent WebSocket: auth + persistent WS for data reuse and streaming. */
  public async connect(): Promise<void> {
    return this._session.connect();
  }

  /** Close the persistent WebSocket connection. */
  public disconnect(): void {
    return this._session.disconnect();
  }
}
