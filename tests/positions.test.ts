import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { DxtradeError } from "@/constants/errors";
import { WS_MESSAGE } from "@/constants/enums";
import { getPositions, closeAllPositions } from "@/domains/position";
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

// --- Helpers ---

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

function emitBothMessages() {
  const posPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITIONS, body: mockPositions });
  wsInstance.emit("message", Buffer.from(`${posPayload.length}|${posPayload}`));

  const metPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITION_METRICS, body: mockMetrics });
  wsInstance.emit("message", Buffer.from(`${metPayload.length}|${metPayload}`));
}

// --- Tests ---

describe("getPositions", () => {
  it("should return merged positions with metrics", async () => {
    const ctx = createMockContext();

    const promise = getPositions(ctx);
    emitBothMessages();

    const result = await promise;
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe("u1");
    expect(result[0].quantity).toBe(1000);
    expect(result[0].plOpen).toBe(5.5);
    expect(result[0].margin).toBe(10);
    expect(result[0].positionKey.instrumentId).toBe(3438);
    expect(wsInstance.close).toHaveBeenCalled();
  });

  it("should wait for both POSITIONS and POSITION_METRICS before resolving", async () => {
    const ctx = createMockContext();

    const promise = getPositions(ctx);

    // Send only POSITIONS first — should NOT resolve yet
    const posPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITIONS, body: mockPositions });
    wsInstance.emit("message", Buffer.from(`${posPayload.length}|${posPayload}`));

    // Verify not resolved by checking close wasn't called
    expect(wsInstance.close).not.toHaveBeenCalled();

    // Now send POSITION_METRICS
    const metPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITION_METRICS, body: mockMetrics });
    wsInstance.emit("message", Buffer.from(`${metPayload.length}|${metPayload}`));

    const result = await promise;
    expect(result).toHaveLength(1);
    expect(wsInstance.close).toHaveBeenCalled();
  });

  it("should reject on WS error", async () => {
    const ctx = createMockContext();

    const promise = getPositions(ctx);
    wsInstance.emit("error", new Error("ws failed"));

    await expect(promise).rejects.toThrow(DxtradeError);
    await expect(promise).rejects.toThrow("Account positions error: ws failed");
  });

  it("should reject on timeout", async () => {
    vi.useFakeTimers();
    const ctx = createMockContext();

    const promise = getPositions(ctx);
    vi.advanceTimersByTime(30_001);

    await expect(promise).rejects.toThrow(DxtradeError);
    await expect(promise).rejects.toThrow("Account positions timed out");

    vi.useRealTimers();
  });

  it("should throw NO_SESSION when not authenticated", async () => {
    const ctx = createMockContext({ csrf: null });

    await expect(getPositions(ctx)).rejects.toThrow("No active session");
  });
});

describe("closeAllPositions", () => {
  it("should close each position with a market order", async () => {
    const ctx = createMockContext();

    const twoPositions = [
      ...mockPositions,
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

    const twoMetrics = [
      ...mockMetrics,
      { uid: "u2", accountId: "ACC-123", margin: 5, plOpen: -2, plClosed: 0, totalCommissions: 0, totalFinancing: 0, plRate: 0, averagePrice: 0, marketValue: 0 },
    ];

    // getPositions uses WS, closePosition uses retryRequest
    setTimeout(() => {
      const posPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITIONS, body: twoPositions });
      wsInstance.emit("message", Buffer.from(`${posPayload.length}|${posPayload}`));

      const metPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITION_METRICS, body: twoMetrics });
      wsInstance.emit("message", Buffer.from(`${metPayload.length}|${metPayload}`));
    }, 200);

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
      const posPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITIONS, body: [] });
      wsInstance.emit("message", Buffer.from(`${posPayload.length}|${posPayload}`));

      const metPayload = JSON.stringify({ accountId: null, type: WS_MESSAGE.POSITION_METRICS, body: [] });
      wsInstance.emit("message", Buffer.from(`${metPayload.length}|${metPayload}`));
    }, 200);

    await closeAllPositions(ctx);

    expect(mockRetryRequest).not.toHaveBeenCalled();
  });
});
