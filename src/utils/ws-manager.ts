import { EventEmitter } from "events";
import WebSocket from "ws";
import { parseWsData, shouldLog, debugLog } from "./websocket";
import type { WsPayload } from "./websocket.types";

export class WsManager extends EventEmitter {
  private _ws: WebSocket | null = null;
  private _cache: Map<string, unknown> = new Map();

  connect(wsUrl: string, cookieStr: string, debug: boolean | string = false): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

      ws.on("open", () => {
        this._ws = ws;
        resolve();
      });

      ws.on("message", (data) => {
        const msg = parseWsData(data);
        if (shouldLog(msg, debug)) debugLog(msg);
        if (typeof msg === "string") return;

        const payload = msg as WsPayload;
        this._cache.set(payload.type, payload.body);
        this.emit(payload.type, payload.body);
      });

      ws.on("error", (error) => {
        if (!this._ws) {
          return reject(error);
        }
        this.emit("error", error);
      });

      ws.on("close", () => {
        this._ws = null;
        this.emit("close");
      });
    });
  }

  waitFor<T>(type: string, timeout = 30_000): Promise<T> {
    const cached = this._cache.get(type);
    if (cached !== undefined) {
      return Promise.resolve(cached as T);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener(type, onMessage);
        reject(new Error(`WsManager: timed out waiting for ${type}`));
      }, timeout);

      const onMessage = (body: T) => {
        clearTimeout(timer);
        resolve(body);
      };

      this.once(type, onMessage);
    });
  }

  getCached<T>(type: string): T | undefined {
    return this._cache.get(type) as T | undefined;
  }

  close(): void {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._cache.clear();
    this.removeAllListeners();
  }

  get isConnected(): boolean {
    return this._ws !== null && this._ws.readyState === WebSocket.OPEN;
  }
}
