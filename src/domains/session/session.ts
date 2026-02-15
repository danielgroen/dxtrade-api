import WebSocket from "ws";
import { endpoints, DxtradeError, ERROR } from "@/constants";
import {
  Cookies,
  WsManager,
  baseHeaders,
  authHeaders,
  cookieOnlyHeaders,
  retryRequest,
  clearDebugLog,
  parseAtmosphereId,
  parseWsData,
  shouldLog,
  debugLog,
  checkWsRateLimit,
} from "@/utils";
import type { ClientContext } from "@/client.types";

interface HandshakeResult {
  atmosphereId: string | null;
  accountId: string | null;
}

function waitForHandshake(
  wsUrl: string,
  cookieStr: string,
  timeout = 30_000,
  debug: boolean | string = false,
): Promise<HandshakeResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });
    let atmosphereId: string | null = null;

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("[dxtrade-api] Handshake timed out"));
    }, timeout);

    ws.on("message", (data) => {
      if (!atmosphereId) {
        atmosphereId = parseAtmosphereId(data);
      }

      const msg = parseWsData(data);
      if (shouldLog(msg, debug)) debugLog(msg);

      if (typeof msg === "string") return;
      if (msg.accountId) {
        clearTimeout(timer);
        ws.close();
        resolve({ atmosphereId, accountId: msg.accountId });
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      ws.close();
      checkWsRateLimit(error);
      reject(new Error(`[dxtrade-api] WebSocket handshake error: ${error.message}`));
    });
  });
}

export class SessionDomain {
  constructor(private _ctx: ClientContext) {}

  /** Authenticate with the broker using username and password. */
  async login(): Promise<void> {
    try {
      const response = await retryRequest(
        {
          method: "POST",
          url: endpoints.login(this._ctx.broker),
          data: {
            username: this._ctx.config.username,
            password: this._ctx.config.password,

            // TODO:: take a look at this below, domain nor vendor seems required. it works if i comment out both.
            // however i still use it since i see brokers use it as well in the login endpoint.

            // domain: this._ctx.config.broker,
            vendor: this._ctx.config.broker,

            // END TODO::
          },
          headers: {
            ...baseHeaders(),
            Origin: this._ctx.broker,
            Referer: this._ctx.broker + "/",
            Cookie: Cookies.serialize(this._ctx.cookies),
          },
        },
        this._ctx.retries,
      );

      if (response.status === 200) {
        const setCookies = response.headers["set-cookie"] ?? [];
        const incoming = Cookies.parse(setCookies);
        this._ctx.cookies = Cookies.merge(this._ctx.cookies, incoming);
        this._ctx.callbacks.onLogin?.();
      } else {
        this._ctx.throwError(ERROR.LOGIN_FAILED, `Login failed: ${response.status}`);
      }
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this._ctx.throwError(ERROR.LOGIN_ERROR, `Login error: ${message}`);
    }
  }

  /** Fetch the CSRF token required for authenticated requests. */
  async fetchCsrf(): Promise<void> {
    try {
      const cookieStr = Cookies.serialize(this._ctx.cookies);
      const response = await retryRequest(
        {
          method: "GET",
          url: this._ctx.broker,
          headers: { ...cookieOnlyHeaders(cookieStr), Referer: this._ctx.broker },
        },
        this._ctx.retries,
      );

      const setCookies = response.headers["set-cookie"] ?? [];
      const incoming = Cookies.parse(setCookies);
      this._ctx.cookies = Cookies.merge(this._ctx.cookies, incoming);

      const csrfMatch = response.data?.match(/name="csrf" content="([^"]+)"/);
      if (csrfMatch) {
        this._ctx.csrf = csrfMatch[1];
      } else {
        this._ctx.throwError(ERROR.CSRF_NOT_FOUND, "CSRF token not found");
      }
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this._ctx.throwError(ERROR.CSRF_ERROR, `CSRF fetch error: ${message}`);
    }
  }

  /** Switch to a specific trading account by ID. */
  async switchAccount(accountId: string): Promise<void> {
    this._ctx.ensureSession();

    try {
      await retryRequest(
        {
          method: "POST",
          url: endpoints.switchAccount(this._ctx.broker, accountId),
          headers: authHeaders(this._ctx.csrf!, Cookies.serialize(this._ctx.cookies)),
        },
        this._ctx.retries,
      );
      this._ctx.callbacks.onAccountSwitch?.(accountId);
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this._ctx.throwError(ERROR.ACCOUNT_SWITCH_ERROR, `Error switching account: ${message}`);
    }
  }

  /** Hit the broker page to collect Cloudflare cookies before making API calls. */
  private async _preflight(): Promise<void> {
    try {
      const response = await retryRequest(
        {
          method: "GET",
          url: this._ctx.broker,
          headers: { ...baseHeaders(), Referer: this._ctx.broker },
        },
        this._ctx.retries,
      );
      const setCookies = response.headers["set-cookie"] ?? [];
      const incoming = Cookies.parse(setCookies);
      this._ctx.cookies = Cookies.merge(this._ctx.cookies, incoming);
    } catch {
      // Non-fatal: continue with login even if preflight fails
    }
  }

  /** Authenticate and establish a session: login, fetch CSRF, WebSocket handshake, and optional account switch. */
  async auth(): Promise<void> {
    await this._preflight();
    await this.login();
    await this.fetchCsrf();
    if (this._ctx.debug) clearDebugLog();

    const cookieStr = Cookies.serialize(this._ctx.cookies);
    const handshake = await waitForHandshake(endpoints.websocket(this._ctx.broker), cookieStr, 30_000, this._ctx.debug);
    this._ctx.atmosphereId = handshake.atmosphereId;
    this._ctx.accountId = handshake.accountId;

    if (this._ctx.config.accountId) {
      await this.switchAccount(this._ctx.config.accountId);
      const reconnect = await waitForHandshake(
        endpoints.websocket(this._ctx.broker, this._ctx.atmosphereId),
        Cookies.serialize(this._ctx.cookies),
        30_000,
        this._ctx.debug,
      );
      this._ctx.atmosphereId = reconnect.atmosphereId;
      this._ctx.accountId = reconnect.accountId;
    }
  }

  /** Connect to the broker with a persistent WebSocket: auth + persistent WS for data reuse and streaming. */
  async connect(): Promise<void> {
    await this.auth();

    const wsManager = new WsManager();
    const wsUrl = endpoints.websocket(this._ctx.broker, this._ctx.atmosphereId);
    const cookieStr = Cookies.serialize(this._ctx.cookies);
    await wsManager.connect(wsUrl, cookieStr, this._ctx.debug);
    this._ctx.wsManager = wsManager;
  }

  /** Close the persistent WebSocket connection. */
  disconnect(): void {
    if (this._ctx.wsManager) {
      this._ctx.wsManager.close();
      this._ctx.wsManager = null;
    }
  }
}
