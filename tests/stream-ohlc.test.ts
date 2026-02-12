import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { WS_MESSAGE } from "@/constants/enums";
import { DxtradeError } from "@/constants/errors";
import { streamOHLC } from "@/domains/ohlc";
import { createMockContext } from "./helpers";
import type { WsManager } from "@/utils/ws-manager";

// --- Mocks ---

vi.mock("axios", () => ({
  default: vi.fn().mockResolvedValue({ data: {} }),
  isAxiosError: () => false,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Helpers ---

const mockBars = [
  { timestamp: 1000, open: 1.1, high: 1.2, low: 1.0, close: 1.15, volume: 100, vwap: 1.12, time: 1000 },
  { timestamp: 2000, open: 1.15, high: 1.25, low: 1.1, close: 1.2, volume: 200, vwap: 1.17, time: 2000 },
];

const liveBars = [
  { timestamp: 3000, open: 1.2, high: 1.3, low: 1.15, close: 1.25, volume: 150, vwap: 1.22, time: 3000 },
];

function createMockWsManager(): WsManager {
  const emitter = new EventEmitter();

  return Object.assign(emitter, {
    connect: vi.fn(),
    close: vi.fn(),
    get isConnected() {
      return true;
    },
    waitFor: vi.fn(),
    getCached: vi.fn(),
    _cache: new Map(),
  }) as unknown as WsManager;
}

function emitChartFeed(wsManager: WsManager, body: Record<string, unknown>) {
  (wsManager as unknown as EventEmitter).emit(WS_MESSAGE.CHART_FEED_SUBTOPIC, body);
}

// --- Tests ---

describe("streamOHLC", () => {
  it("should emit snapshot bars after snapshotEnd", async () => {
    const wsManager = createMockWsManager();
    const ctx = createMockContext({ wsManager });
    const callback = vi.fn();

    const promise = streamOHLC(ctx, { symbol: "EURUSD" }, callback);

    // Simulate snapshot data arriving
    emitChartFeed(wsManager, {
      subtopic: WS_MESSAGE.SUBTOPIC.OHLC_STREAM,
      data: mockBars,
      snapshotEnd: false,
    });

    // Simulate snapshotEnd
    emitChartFeed(wsManager, {
      subtopic: WS_MESSAGE.SUBTOPIC.OHLC_STREAM,
      data: [],
      snapshotEnd: true,
    });

    const unsubscribe = await promise;

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(mockBars);
    expect(typeof unsubscribe).toBe("function");
  });

  it("should emit live bar updates after snapshot", async () => {
    const wsManager = createMockWsManager();
    const ctx = createMockContext({ wsManager });
    const callback = vi.fn();

    const promise = streamOHLC(ctx, { symbol: "EURUSD" }, callback);

    // Complete snapshot
    emitChartFeed(wsManager, {
      subtopic: WS_MESSAGE.SUBTOPIC.OHLC_STREAM,
      data: mockBars,
      snapshotEnd: true,
    });

    await promise;
    callback.mockClear();

    // Simulate live update
    emitChartFeed(wsManager, {
      subtopic: WS_MESSAGE.SUBTOPIC.OHLC_STREAM,
      data: liveBars,
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(liveBars);
  });

  it("should stop receiving updates after unsubscribe", async () => {
    const wsManager = createMockWsManager();
    const ctx = createMockContext({ wsManager });
    const callback = vi.fn();

    const promise = streamOHLC(ctx, { symbol: "EURUSD" }, callback);

    emitChartFeed(wsManager, {
      subtopic: WS_MESSAGE.SUBTOPIC.OHLC_STREAM,
      data: mockBars,
      snapshotEnd: true,
    });

    const unsubscribe = await promise;
    callback.mockClear();

    unsubscribe();

    emitChartFeed(wsManager, {
      subtopic: WS_MESSAGE.SUBTOPIC.OHLC_STREAM,
      data: liveBars,
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("should throw STREAM_REQUIRES_CONNECT when wsManager is null", async () => {
    const ctx = createMockContext({ wsManager: null });

    await expect(streamOHLC(ctx, { symbol: "EURUSD" }, vi.fn())).rejects.toThrow(DxtradeError);
    await expect(streamOHLC(ctx, { symbol: "EURUSD" }, vi.fn())).rejects.toThrow("connect()");
  });

  it("should ignore messages with different subtopic", async () => {
    const wsManager = createMockWsManager();
    const ctx = createMockContext({ wsManager });
    const callback = vi.fn();

    const promise = streamOHLC(ctx, { symbol: "EURUSD" }, callback);

    // Emit message with wrong subtopic — should be ignored
    emitChartFeed(wsManager, {
      subtopic: WS_MESSAGE.SUBTOPIC.BIG_CHART_COMPONENT,
      data: mockBars,
      snapshotEnd: true,
    });

    expect(callback).not.toHaveBeenCalled();

    // Now emit correct subtopic to complete the promise
    emitChartFeed(wsManager, {
      subtopic: WS_MESSAGE.SUBTOPIC.OHLC_STREAM,
      data: mockBars,
      snapshotEnd: true,
    });

    await promise;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should accumulate bars across multiple messages before snapshotEnd", async () => {
    const wsManager = createMockWsManager();
    const ctx = createMockContext({ wsManager });
    const callback = vi.fn();

    const promise = streamOHLC(ctx, { symbol: "EURUSD" }, callback);

    // First batch
    emitChartFeed(wsManager, {
      subtopic: WS_MESSAGE.SUBTOPIC.OHLC_STREAM,
      data: [mockBars[0]],
      snapshotEnd: false,
    });

    // Second batch
    emitChartFeed(wsManager, {
      subtopic: WS_MESSAGE.SUBTOPIC.OHLC_STREAM,
      data: [mockBars[1]],
      snapshotEnd: true,
    });

    await promise;

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(mockBars);
  });
});
