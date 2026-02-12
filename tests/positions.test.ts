import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { DxtradeError } from "@/constants/errors";
import { WS_MESSAGE } from "@/constants/enums";
import { getPositionMetrics, closeAllPositions } from "@/domains/position";
import { createMockContext } from "./helpers";

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

const mockRetryRequest = vi.fn();
vi.mock("@/utils", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, retryRequest: (...args: unknown[]) => mockRetryRequest(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Tests ---

describe("getPositionMetrics", () => {
  it("should return metrics from WebSocket POSITION_METRICS message", async () => {
    const ctx = createMockContext();
    const mockMetrics = [
      { positionCode: "POS-1", openPl: 150.5, openPlPerLot: 15.05, currentPrice: 1.1234, convertedOpenPl: 150.5 },
      { positionCode: "POS-2", openPl: -42.0, openPlPerLot: -4.2, currentPrice: 65000.0, convertedOpenPl: -42.0 },
    ];

    const promise = getPositionMetrics(ctx);

    const payload = JSON.stringify({ accountId: "ACC-123", type: WS_MESSAGE.POSITION_METRICS, body: mockMetrics });
    wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));

    const result = await promise;
    expect(result).toEqual(mockMetrics);
    expect(wsInstance.close).toHaveBeenCalled();
  });

  it("should ignore non-matching WS message types", async () => {
    const ctx = createMockContext();
    const mockMetrics = [{ positionCode: "POS-1", openPl: 100, openPlPerLot: 10, currentPrice: 1.1, convertedOpenPl: 100 }];

    const promise = getPositionMetrics(ctx);

    // Send an unrelated message first
    const otherPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.ACCOUNT_METRICS, body: {} });
    wsInstance.emit("message", Buffer.from(`${otherPayload.length}|${otherPayload}`));

    // Then send the real one
    const payload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITION_METRICS, body: mockMetrics });
    wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));

    const result = await promise;
    expect(result).toEqual(mockMetrics);
  });

  it("should reject on WS error", async () => {
    const ctx = createMockContext();

    const promise = getPositionMetrics(ctx);
    wsInstance.emit("error", new Error("ws failed"));

    await expect(promise).rejects.toThrow(DxtradeError);
    await expect(promise).rejects.toThrow("Position metrics error: ws failed");
  });

  it("should reject on timeout", async () => {
    vi.useFakeTimers();
    const ctx = createMockContext();

    const promise = getPositionMetrics(ctx, 2000);
    vi.advanceTimersByTime(2001);

    await expect(promise).rejects.toThrow(DxtradeError);
    await expect(promise).rejects.toThrow("Position metrics timed out");

    vi.useRealTimers();
  });

  it("should throw NO_SESSION when not authenticated", async () => {
    const ctx = createMockContext({ csrf: null });

    await expect(getPositionMetrics(ctx)).rejects.toThrow("No active session");
  });
});

describe("closeAllPositions", () => {
  it("should close each position with a market order", async () => {
    const ctx = createMockContext();

    const mockPositions = [
      {
        uid: "u1",
        accountId: "ACC-123",
        positionKey: { instrumentId: 3438, positionCode: "POS-1" },
        quantity: 1000,
        cost: 1000,
        costBasis: 1000,
        openCost: 1000,
        marginRate: 0.01,
        time: 0,
        modifiedTime: 0,
        userLogin: "test",
        takeProfit: null,
        stopLoss: null,
      },
      {
        uid: "u2",
        accountId: "ACC-123",
        positionKey: { instrumentId: 4567, positionCode: "POS-2" },
        quantity: -500,
        cost: 500,
        costBasis: 500,
        openCost: 500,
        marginRate: 0.01,
        time: 0,
        modifiedTime: 0,
        userLogin: "test",
        takeProfit: null,
        stopLoss: null,
      },
    ];

    // getPositions uses WS, closePosition uses retryRequest
    setTimeout(() => {
      const payload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITIONS, body: mockPositions });
      wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));
    }, 0);

    mockRetryRequest.mockResolvedValue({ status: 200 });

    await closeAllPositions(ctx);

    expect(mockRetryRequest).toHaveBeenCalledTimes(2);

    // First call: close POS-1 with quantity -1000
    const firstCall = mockRetryRequest.mock.calls[0][0];
    expect(firstCall.method).toBe("POST");
    expect(firstCall.data.quantity).toBe(-1000);
    expect(firstCall.data.orderType).toBe("MARKET");
    expect(firstCall.data.legs[0].instrumentId).toBe(3438);
    expect(firstCall.data.legs[0].positionCode).toBe("POS-1");
    expect(firstCall.data.legs[0].positionEffect).toBe("CLOSING");

    // Second call: close POS-2 with quantity 500 (negated from -500)
    const secondCall = mockRetryRequest.mock.calls[1][0];
    expect(secondCall.data.quantity).toBe(500);
    expect(secondCall.data.legs[0].instrumentId).toBe(4567);
    expect(secondCall.data.legs[0].positionCode).toBe("POS-2");
  });

  it("should do nothing when there are no positions", async () => {
    const ctx = createMockContext();

    setTimeout(() => {
      const payload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITIONS, body: [] });
      wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));
    }, 0);

    await closeAllPositions(ctx);

    expect(mockRetryRequest).not.toHaveBeenCalled();
  });
});
