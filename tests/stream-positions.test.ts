import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { WS_MESSAGE, ERROR } from "@/constants/enums";
import { DxtradeError } from "@/constants/errors";
import { streamPositions, getPositions } from "@/domains/position";
import { createMockContext } from "./helpers";
import type { WsManager } from "@/utils/ws-manager";

// --- Mocks ---

let wsInstance: EventEmitter & { close: ReturnType<typeof vi.fn> };

vi.mock("ws", () => {
  return {
    default: class MockWebSocket extends EventEmitter {
      close = vi.fn();
      constructor() {
        super();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        wsInstance = this as any;
      }
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Helpers ---

function createMockWsManager(initialCache?: Record<string, unknown>): WsManager {
  const emitter = new EventEmitter();
  const cache = new Map<string, unknown>(initialCache ? Object.entries(initialCache) : []);

  return Object.assign(emitter, {
    connect: vi.fn(),
    close: vi.fn(),
    get isConnected() {
      return true;
    },
    waitFor: vi.fn((type: string) => {
      const cached = cache.get(type);
      if (cached !== undefined) return Promise.resolve(cached);
      return new Promise((resolve) => {
        emitter.once(type, resolve);
      });
    }),
    getCached: vi.fn((type: string) => cache.get(type)),
    _cache: cache,
  }) as unknown as WsManager;
}

// --- Tests ---

describe("streamPositions", () => {
  it("should invoke callback on position updates", () => {
    const wsManager = createMockWsManager();
    const ctx = createMockContext({ wsManager });

    const callback = vi.fn();
    streamPositions(ctx, callback);

    const positions = [{ positionCode: "POS-1", quantity: 100 }];
    (wsManager as unknown as EventEmitter).emit(WS_MESSAGE.POSITIONS, positions);

    expect(callback).toHaveBeenCalledWith(positions);
  });

  it("should stop receiving updates after unsubscribe", () => {
    const wsManager = createMockWsManager();
    const ctx = createMockContext({ wsManager });

    const callback = vi.fn();
    const unsubscribe = streamPositions(ctx, callback);

    (wsManager as unknown as EventEmitter).emit(WS_MESSAGE.POSITIONS, []);
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();

    (wsManager as unknown as EventEmitter).emit(WS_MESSAGE.POSITIONS, []);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should immediately emit cached positions on subscribe", () => {
    const cachedPositions = [{ positionCode: "POS-1", quantity: 100 }];
    const wsManager = createMockWsManager({ [WS_MESSAGE.POSITIONS]: cachedPositions });
    const ctx = createMockContext({ wsManager });

    const callback = vi.fn();
    streamPositions(ctx, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(cachedPositions);
  });

  it("should throw STREAM_REQUIRES_CONNECT when wsManager is null", () => {
    const ctx = createMockContext({ wsManager: null });

    expect(() => streamPositions(ctx, vi.fn())).toThrow(DxtradeError);
    expect(() => streamPositions(ctx, vi.fn())).toThrow("connect()");
  });
});

describe("getPositions with wsManager", () => {
  it("should use wsManager.waitFor when available", async () => {
    const wsManager = createMockWsManager();
    const mockPositions = [{ positionCode: "POS-1", quantity: 100 }];
    (wsManager.waitFor as ReturnType<typeof vi.fn>).mockResolvedValue(mockPositions);

    const ctx = createMockContext({ wsManager });
    const result = await getPositions(ctx);

    expect(wsManager.waitFor).toHaveBeenCalledWith(WS_MESSAGE.POSITIONS);
    expect(result).toEqual(mockPositions);
  });

  it("should fall back to WebSocket when wsManager is null", async () => {
    const ctx = createMockContext({ wsManager: null });
    const mockPositions = [{ positionCode: "POS-1", quantity: 100 }];

    const promise = getPositions(ctx);

    const payload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITIONS, body: mockPositions });
    wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));

    const result = await promise;
    expect(result).toEqual(mockPositions);
    expect(wsInstance.close).toHaveBeenCalled();
  });
});
