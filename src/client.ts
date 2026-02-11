import { resolveBrokerUrl, DxtradeError } from "@/constants";
import type { ClientContext, DxtradeConfig } from "./client.types";
import type { Account, Assessments, Instrument, Order, Symbol } from "./domains";
import {
  login,
  fetchCsrf,
  switchAccount,
  connect,
  getAccountMetrics,
  getAssessments,
  getInstruments,
  getSymbolLimits,
  getSymbolSuggestions,
  getSymbolInfo,
  submitOrder,
} from "@/domains";

export class DxtradeClient {
  private _ctx: ClientContext;

  constructor(config: DxtradeConfig) {
    const callbacks = config.callbacks ?? {};

    this._ctx = {
      config,
      callbacks,
      cookies: {},
      csrf: null,
      baseUrl: resolveBrokerUrl(config.broker, config.brokerUrls),
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

  public async login(): Promise<void> {
    return login(this._ctx);
  }

  public async fetchCsrf(): Promise<void> {
    return fetchCsrf(this._ctx);
  }

  public async switchAccount(accountId: string): Promise<void> {
    return switchAccount(this._ctx, accountId);
  }

  public async connect(): Promise<void> {
    return connect(this._ctx);
  }

  public async getSymbolSuggestions(text: string): Promise<Symbol.Suggestion[]> {
    return getSymbolSuggestions(this._ctx, text);
  }

  public async getSymbolInfo(symbol: string): Promise<Symbol.Info> {
    return getSymbolInfo(this._ctx, symbol);
  }

  public async getSymbolLimits(): Promise<Symbol.Limits[]> {
    return getSymbolLimits(this._ctx);
  }

  public async submitOrder(params: Order.SubmitParams): Promise<Order.Update> {
    return submitOrder(this._ctx, params);
  }

  public async getAccountMetrics(): Promise<Account.Metrics> {
    return getAccountMetrics(this._ctx);
  }

  public async getInstruments(params: Partial<Instrument.Info> = {}): Promise<Instrument.Info[]> {
    return getInstruments(this._ctx, params);
  }

  public async getAssessments(params: Assessments.Params): Promise<Assessments.Response> {
    return getAssessments(this._ctx, params);
  }
}
