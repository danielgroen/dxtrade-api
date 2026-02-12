import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { WsManager } from "@/utils/ws-manager";

// --- Mocks ---

let wsInstance: EventEmitter & { close: ReturnType<typeof vi.fn>; readyState: number };
let autoOpen = true;

vi.mock("ws", () => {
  return {
    default: class MockWebSocket extends EventEmitter {
      static OPEN = 1;
      close = vi.fn();
      readyState = 1;
      constructor() {
        super();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        wsInstance = this as any;
        if (autoOpen) {
          setTimeout(() => this.emit("open"), 0);
        }
      }
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  autoOpen = true;
});

// --- Tests ---

describe("WsManager", () => {
  describe("connect", () => {
    it("should resolve when WebSocket opens", async () => {
      const manager = new WsManager();
      await manager.connect("wss://example.com", "cookie=abc");
      expect(manager.isConnected).toBe(true);
    });

    it("should reject when WebSocket errors before opening", async () => {
      autoOpen = false;
      const manager = new WsManager();
      const promise = manager.connect("wss://example.com", "cookie=abc");

      wsInstance.readyState = 3;
      wsInstance.emit("error", new Error("connection refused"));

      await expect(promise).rejects.toThrow("connection refused");
    });
  });

  describe("message handling and cache", () => {
    it("should parse messages, cache them, and emit events", async () => {
      const manager = new WsManager();
      await manager.connect("wss://example.com", "cookie=abc");

      const listener = vi.fn();
      manager.on("POSITIONS", listener);

      const body = [{ positionCode: "POS-1", quantity: 100 }];
      const payload = JSON.stringify({ accountId: "ACC-1", type: "POSITIONS", body });
      wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));

      expect(listener).toHaveBeenCalledWith(body);
    });

    it("should ignore string-only messages", async () => {
      const manager = new WsManager();
      await manager.connect("wss://example.com", "cookie=abc");

      const listener = vi.fn();
      manager.on("POSITIONS", listener);

      wsInstance.emit("message", Buffer.from("heartbeat"));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("waitFor", () => {
    it("should resolve from cache if data already exists", async () => {
      const manager = new WsManager();
      await manager.connect("wss://example.com", "cookie=abc");

      const body = [{ positionCode: "POS-1" }];
      const payload = JSON.stringify({ accountId: null, type: "POSITIONS", body });
      wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));

      const result = await manager.waitFor("POSITIONS");
      expect(result).toEqual(body);
    });

    it("should wait for next message if not cached", async () => {
      const manager = new WsManager();
      await manager.connect("wss://example.com", "cookie=abc");

      const promise = manager.waitFor("ORDERS");

      const body = [{ orderId: 1 }];
      const payload = JSON.stringify({ accountId: null, type: "ORDERS", body });
      wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));

      const result = await promise;
      expect(result).toEqual(body);
    });

    it("should reject on timeout", async () => {
      vi.useFakeTimers();
      const manager = new WsManager();

      // Manually trigger open since fake timers block setTimeout
      const connectPromise = manager.connect("wss://example.com", "cookie=abc");
      vi.advanceTimersByTime(1);
      await connectPromise;

      const promise = manager.waitFor("ORDERS", 2000);
      vi.advanceTimersByTime(2001);

      await expect(promise).rejects.toThrow("timed out waiting for ORDERS");
      vi.useRealTimers();
    });
  });

  describe("close", () => {
    it("should close the WebSocket and clear cache/listeners", async () => {
      const manager = new WsManager();
      await manager.connect("wss://example.com", "cookie=abc");

      const body = [{ positionCode: "POS-1" }];
      const payload = JSON.stringify({ accountId: null, type: "POSITIONS", body });
      wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));

      manager.close();

      expect(wsInstance.close).toHaveBeenCalled();
      expect(manager.isConnected).toBe(false);
      expect(manager.listenerCount("POSITIONS")).toBe(0);
    });
  });
});
