import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { WS_MESSAGE } from "@/constants/enums";
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

const mockPositions = [
  {
    uid: "u1",
    accountId: "ACC-123",
    positionKey: { instrumentId: 3438, positionCode: "POS-1" },
    quantity: 1000,
    cost: 1000,
    costBasis: 1,
    openCost: 1000,
    marginRate: 0.01,
    time: 0,
    modifiedTime: 0,
    userLogin: "test",
    takeProfit: null,
    stopLoss: null,
  },
];

const mockMetrics = [
  {
    uid: "u1",
    accountId: "ACC-123",
    margin: 10,
    plOpen: 5.5,
    plClosed: 0,
    totalCommissions: -0.03,
    totalFinancing: -0.1,
    plRate: 1.105,
    averagePrice: 1.1,
    marketValue: 1100,
  },
];

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
  it("should emit merged positions on POSITION_METRICS update", () => {
    const wsManager = createMockWsManager({
      [WS_MESSAGE.POSITIONS]: mockPositions,
    });
    const ctx = createMockContext({ wsManager });

    const callback = vi.fn();
    streamPositions(ctx, callback);

    // Clear the initial cached emission
    callback.mockClear();

    // Simulate a POSITION_METRICS update — cache it so getCached returns it
    (wsManager as any)._cache.set(WS_MESSAGE.POSITION_METRICS, mockMetrics);
    (wsManager as unknown as EventEmitter).emit(WS_MESSAGE.POSITION_METRICS, mockMetrics);

    expect(callback).toHaveBeenCalledTimes(1);
    const result = callback.mock.calls[0][0];
    expect(result[0].uid).toBe("u1");
    expect(result[0].quantity).toBe(1000);
    expect(result[0].plOpen).toBe(5.5);
  });

  it("should immediately emit cached merged data on subscribe", () => {
    const wsManager = createMockWsManager({
      [WS_MESSAGE.POSITIONS]: mockPositions,
      [WS_MESSAGE.POSITION_METRICS]: mockMetrics,
    });
    const ctx = createMockContext({ wsManager });

    const callback = vi.fn();
    streamPositions(ctx, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const result = callback.mock.calls[0][0];
    expect(result[0].plOpen).toBe(5.5);
    expect(result[0].quantity).toBe(1000);
  });

  it("should stop receiving updates after unsubscribe", () => {
    const wsManager = createMockWsManager({
      [WS_MESSAGE.POSITIONS]: mockPositions,
      [WS_MESSAGE.POSITION_METRICS]: mockMetrics,
    });
    const ctx = createMockContext({ wsManager });

    const callback = vi.fn();
    const unsubscribe = streamPositions(ctx, callback);
    callback.mockClear();

    (wsManager as unknown as EventEmitter).emit(WS_MESSAGE.POSITION_METRICS, mockMetrics);
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();

    (wsManager as unknown as EventEmitter).emit(WS_MESSAGE.POSITION_METRICS, mockMetrics);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should throw STREAM_REQUIRES_CONNECT when wsManager is null", () => {
    const ctx = createMockContext({ wsManager: null });

    expect(() => streamPositions(ctx, vi.fn())).toThrow(DxtradeError);
    expect(() => streamPositions(ctx, vi.fn())).toThrow("connect()");
  });
});

describe("getPositions with wsManager", () => {
  it("should use wsManager.waitFor and merge results", async () => {
    const wsManager = createMockWsManager({
      [WS_MESSAGE.POSITIONS]: mockPositions,
      [WS_MESSAGE.POSITION_METRICS]: mockMetrics,
    });

    const ctx = createMockContext({ wsManager });
    const result = await getPositions(ctx);

    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe("u1");
    expect(result[0].quantity).toBe(1000);
    expect(result[0].plOpen).toBe(5.5);
    expect(result[0].margin).toBe(10);
  });

  it("should fall back to WebSocket when wsManager is null", async () => {
    const ctx = createMockContext({ wsManager: null });

    const promise = getPositions(ctx);

    const posPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITIONS, body: mockPositions });
    wsInstance.emit("message", Buffer.from(`${posPayload.length}|${posPayload}`));

    const metPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITION_METRICS, body: mockMetrics });
    wsInstance.emit("message", Buffer.from(`${metPayload.length}|${metPayload}`));

    const result = await promise;
    expect(result).toHaveLength(1);
    expect(result[0].plOpen).toBe(5.5);
    expect(wsInstance.close).toHaveBeenCalled();
  });
});
