import crypto from "crypto";
import {
  endpoints,
  ORDER_TYPE,
  SIDE,
  ACTION,
  DxtradeError,
  resolveBrokerUrl,
} from "@/constants";
import {
  Cookies,
  baseHeaders,
  authHeaders,
  cookieOnlyHeaders,
  retryRequest,
  waitForHandshake,
  createOrderListener,
  clearDebugLog,
} from "@/utils";

export class DxtradeClient {
  private config: DxtradeConfig;
  private callbacks: DxtradeCallbacks;
  private cookies: Record<string, string> = {};
  private csrf: string | null = null;
  private baseUrl: string;
  private retries: number;
  private debug: boolean | string;

  constructor(config: DxtradeConfig) {
    this.config = config;
    this.callbacks = config.callbacks ?? {};
    this.baseUrl = resolveBrokerUrl(config.broker, config.brokerUrls);
    this.retries = config.retries ?? 3;
    this.debug = config.debug ?? false;
  }

  // ── Session ─────────────────────────────────────────────────────────────────────────────────────────────────────────

  async login(): Promise<void> {
    try {
      const response = await retryRequest(
        {
          method: "POST",
          url: endpoints.login(this.baseUrl),
          data: {
            username: this.config.username,
            password: this.config.password,
            domain: this.config.broker,
          },
          headers: { "Content-Type": "application/json" },
        },
        this.retries,
      );

      if (response.status === 200) {
        const setCookies = response.headers["set-cookie"] ?? [];
        const incoming = Cookies.parse(setCookies);
        this.cookies = Cookies.merge(this.cookies, incoming);
        this.callbacks.onLogin?.();
      } else {
        this.throwError("LOGIN_FAILED", `Login failed: ${response.status}`);
      }
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this.throwError("LOGIN_ERROR", `Login error: ${message}`);
    }
  }

  async fetchCsrf(): Promise<void> {
    try {
      const cookieStr = Cookies.serialize(this.cookies);
      const response = await retryRequest(
        {
          method: "GET",
          url: this.baseUrl,
          headers: { ...cookieOnlyHeaders(cookieStr), Referer: this.baseUrl },
        },
        this.retries,
      );

      const csrfMatch = response.data?.match(/name="csrf" content="([^"]+)"/);
      if (csrfMatch) {
        this.csrf = csrfMatch[1];
      } else {
        this.throwError("CSRF_NOT_FOUND", "CSRF token not found");
      }
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this.throwError("CSRF_ERROR", `CSRF fetch error: ${message}`);
    }
  }

  async switchAccount(accountId: string): Promise<void> {
    this.ensureSession();

    try {
      await retryRequest(
        {
          method: "POST",
          url: endpoints.switchAccount(this.baseUrl, accountId),
          headers: authHeaders(this.csrf!, Cookies.serialize(this.cookies)),
        },
        this.retries,
      );
      this.callbacks.onAccountSwitch?.(accountId);
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this.throwError(
        "ACCOUNT_SWITCH_ERROR",
        `Error switching account: ${message}`,
      );
    }
  }

  // ── Market Data ─────────────────────────────────────────────────────────────────────────────────────────────────────

  async getSymbolSuggestions(text: string): Promise<Market.Suggestion[]> {
    this.ensureSession();

    try {
      const cookieStr = Cookies.serialize(this.cookies);
      const response = await retryRequest(
        {
          method: "GET",
          url: endpoints.suggest(this.baseUrl, text),
          headers: { ...baseHeaders(), Cookie: cookieStr },
        },
        this.retries,
      );

      const suggests = response.data?.suggests;
      if (!suggests?.length) {
        this.throwError("NO_SUGGESTIONS", "No symbol suggestions found");
      }
      return suggests as Market.Suggestion[];
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this.throwError(
        "SUGGEST_ERROR",
        `Error getting symbol suggestions: ${message}`,
      );
    }
  }

  async getSymbolInfo(symbol: string): Promise<Market.Info> {
    this.ensureSession();

    try {
      const offsetMinutes = Math.abs(new Date().getTimezoneOffset());
      const cookieStr = Cookies.serialize(this.cookies);
      const response = await retryRequest(
        {
          method: "GET",
          url: endpoints.instrumentInfo(this.baseUrl, symbol, offsetMinutes),
          headers: { ...baseHeaders(), Cookie: cookieStr },
        },
        this.retries,
      );

      if (!response.data) {
        this.throwError("NO_SYMBOL_INFO", "No symbol info returned");
      }
      return response.data as Market.Info;
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this.throwError(
        "SYMBOL_INFO_ERROR",
        `Error getting symbol info: ${message}`,
      );
    }
  }

  // ── Trading ─────────────────────────────────────────────────────────────────────────────────────────────────────────

  async submitOrder(params: Order.SubmitParams): Promise<Order.Update> {
    this.ensureSession();

    const {
      symbol,
      side,
      quantity,
      orderType,
      orderCode,
      price,
      instrumentId,
      stopLoss,
      takeProfit,
      positionEffect = ACTION.OPENING,
      positionCode,
      tif = "GTC",
      expireDate,
      metadata,
    } = params;
    const info = await this.getSymbolInfo(symbol);
    const units = Math.round(quantity * info.lotSize);
    const qty = side === SIDE.BUY ? units : -units;
    const priceParam =
      orderType === ORDER_TYPE.STOP ? "stopPrice" : "limitPrice";

    const orderData: Record<string, unknown> = {
      directExchange: false,
      legs: [
        {
          ...(instrumentId != null && { instrumentId }),
          ...(positionCode != null && { positionCode }),
          positionEffect,
          ratioQuantity: 1,
          symbol,
        },
      ],
      orderSide: side,
      orderType,
      quantity: qty,
      requestId: orderCode ?? `gwt-uid-931-${crypto.randomUUID()}`,
      timeInForce: tif,
      ...(expireDate != null && { expireDate }),
      ...(metadata != null && { metadata }),
    };

    if (price != null && orderType !== ORDER_TYPE.MARKET) {
      orderData[priceParam] = price;
    }

    if (stopLoss) {
      orderData.stopLoss = {
        ...(stopLoss.offset != null && { fixedOffset: stopLoss.offset }),
        ...(stopLoss.price != null && { fixedPrice: stopLoss.price }),
        priceFixed: stopLoss.price != null,
        orderChainId: 0,
        orderId: 0,
        orderType: ORDER_TYPE.STOP,
        quantityForProtection: qty,
        removed: false,
      };
    }

    if (takeProfit) {
      orderData.takeProfit = {
        ...(takeProfit.offset != null && { fixedOffset: takeProfit.offset }),
        ...(takeProfit.price != null && { fixedPrice: takeProfit.price }),
        priceFixed: takeProfit.price != null,
        orderChainId: 0,
        orderId: 0,
        orderType: ORDER_TYPE.LIMIT,
        quantityForProtection: qty,
        removed: false,
      };
    }

    try {
      // Open WS listener BEFORE submitting so we don't miss the response
      const wsUrl = endpoints.websocket(this.baseUrl);
      const cookieStr = Cookies.serialize(this.cookies);
      const listener = createOrderListener(wsUrl, cookieStr, 30_000, this.debug);
      await listener.ready;

      const response = await retryRequest(
        {
          method: "POST",
          url: endpoints.submitOrder(this.baseUrl),
          data: orderData,
          headers: authHeaders(this.csrf!, Cookies.serialize(this.cookies)),
        },
        this.retries,
      );

      this.callbacks.onOrderPlaced?.(response.data as Order.Response);

      const orderUpdate = await listener.promise;

      this.callbacks.onOrderUpdate?.(orderUpdate);
      return orderUpdate;
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message =
        error instanceof Error
          ? ((error as any).response?.data?.message ?? error.message)
          : "Unknown error";
      this.throwError("ORDER_ERROR", `Error submitting order: ${message}`);
    }
  }

  // ── Analytics ───────────────────────────────────────────────────────────────────────────────────────────────────────

  async getAssessments(
    params: Assessments.Params,
  ): Promise<Assessments.Response> {
    this.ensureSession();

    try {
      const response = await retryRequest(
        {
          method: "POST",
          url: endpoints.assessments(this.baseUrl),
          data: {
            from: params.from,
            instrument: params.instrument,
            subtype: params.subtype ?? null,
            to: params.to,
          },
          headers: authHeaders(this.csrf!, Cookies.serialize(this.cookies)),
        },
        this.retries,
      );

      return response.data as Assessments.Response;
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this.throwError(
        "ASSESSMENTS_ERROR",
        `Error fetching assessments: ${message}`,
      );
    }
  }

  // ── Convenience ─────────────────────────────────────────────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    await this.login();
    await this.fetchCsrf();
    if (this.debug) clearDebugLog();

    const wsUrl = endpoints.websocket(this.baseUrl);
    const cookieStr = Cookies.serialize(this.cookies);
    await waitForHandshake(wsUrl, cookieStr, 30_000, this.debug);

    if (this.config.accountId) {
      await this.switchAccount(this.config.accountId);
      await waitForHandshake(
        endpoints.websocket(this.baseUrl),
        Cookies.serialize(this.cookies),
        30_000,
        this.debug,
      );
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────────────────────────────────────────────

  private ensureSession(): void {
    if (!this.csrf) {
      throw new DxtradeError(
        "NO_SESSION",
        "No active session. Call login() and fetchCsrf() or connect() first.",
      );
    }
  }

  private throwError(code: string, message: string): never {
    const error = new DxtradeError(code, message);
    this.callbacks.onError?.(error);
    throw error;
  }
}
