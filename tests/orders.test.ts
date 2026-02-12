import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { DxtradeError } from "@/constants/errors";
import { WS_MESSAGE } from "@/constants/enums";
import { getOrders, cancelOrder, cancelAllOrders } from "@/domains/order";
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

describe("getOrders", () => {
  it("should return orders from WebSocket ORDERS message", async () => {
    const ctx = createMockContext();
    const mockOrders = [
      { account: "ACC-123", orderId: 1, orderCode: "OC1", type: "LIMIT", instrument: "EURUSD", status: "WORKING", finalStatus: false, side: "BUY", tif: "GTC", legs: [], issueTime: "2024-01-01", transactionTime: "2024-01-01" },
      { account: "ACC-123", orderId: 2, orderCode: "OC2", type: "STOP", instrument: "BTCUSD", status: "WORKING", finalStatus: false, side: "SELL", tif: "GTC", legs: [], issueTime: "2024-01-01", transactionTime: "2024-01-01" },
    ];

    const promise = getOrders(ctx);

    const payload = JSON.stringify({ accountId: "ACC-123", type: WS_MESSAGE.ORDERS, body: mockOrders });
    wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));

    const result = await promise;
    expect(result).toEqual(mockOrders);
    expect(wsInstance.close).toHaveBeenCalled();
  });

  it("should ignore string WS messages", async () => {
    const ctx = createMockContext();

    const promise = getOrders(ctx, 500);

    // First emit a string (atmosphere tracking id), then orders
    wsInstance.emit("message", Buffer.from("36|some-tracking-id|0||"));

    const mockOrders = [{ orderId: 1, status: "WORKING", finalStatus: false }];
    const payload = JSON.stringify({ accountId: null, type: WS_MESSAGE.ORDERS, body: mockOrders });
    wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));

    const result = await promise;
    expect(result).toEqual(mockOrders);
  });

  it("should reject on WS error", async () => {
    const ctx = createMockContext();

    const promise = getOrders(ctx);
    wsInstance.emit("error", new Error("connection failed"));

    await expect(promise).rejects.toThrow(DxtradeError);
    await expect(promise).rejects.toThrow("Orders error: connection failed");
  });

  it("should reject on timeout", async () => {
    vi.useFakeTimers();
    const ctx = createMockContext();

    const promise = getOrders(ctx, 1000);

    vi.advanceTimersByTime(1001);

    await expect(promise).rejects.toThrow(DxtradeError);
    await expect(promise).rejects.toThrow("Orders request timed out");

    vi.useRealTimers();
  });

  it("should throw NO_SESSION when not authenticated", async () => {
    const ctx = createMockContext({ csrf: null });

    await expect(getOrders(ctx)).rejects.toThrow(DxtradeError);
    await expect(getOrders(ctx)).rejects.toThrow("No active session");
  });
});

describe("cancelOrder", () => {
  it("should send DELETE request with correct URL", async () => {
    const ctx = createMockContext();
    mockRetryRequest.mockResolvedValue({ status: 200 });

    await cancelOrder(ctx, 12345);

    expect(mockRetryRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        url: expect.stringContaining("orderChainId=12345"),
      }),
      ctx.retries,
    );
    expect(mockRetryRequest.mock.calls[0][0].url).toContain("accountId=ACC-123");
  });

  it("should throw when accountId is missing", async () => {
    const ctx = createMockContext({
      accountId: null,
      config: { username: "test", password: "test", broker: "FTMO" },
    });

    await expect(cancelOrder(ctx, 12345)).rejects.toThrow("accountId is required to cancel an order");
  });

  it("should throw CANCEL_ORDER_ERROR on request failure", async () => {
    const ctx = createMockContext();
    mockRetryRequest.mockRejectedValue(new Error("Network error"));

    await expect(cancelOrder(ctx, 12345)).rejects.toThrow(DxtradeError);
    await expect(cancelOrder(ctx, 12345)).rejects.toThrow("Cancel order error");
  });

  it("should rethrow DxtradeError as-is", async () => {
    const ctx = createMockContext();
    const original = new DxtradeError("CUSTOM", "custom error");
    mockRetryRequest.mockRejectedValue(original);

    await expect(cancelOrder(ctx, 12345)).rejects.toBe(original);
  });
});

describe("cancelAllOrders", () => {
  it("should cancel only non-final orders", async () => {
    const ctx = createMockContext();

    const mockOrders = [
      { orderId: 1, finalStatus: false },
      { orderId: 2, finalStatus: true },
      { orderId: 3, finalStatus: false },
    ];

    // getOrders will use the WS mock
    setTimeout(() => {
      const payload = JSON.stringify({ accountId: null, type: WS_MESSAGE.ORDERS, body: mockOrders });
      wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));
    }, 0);

    mockRetryRequest.mockResolvedValue({ status: 200 });

    await cancelAllOrders(ctx);

    // Should have called cancelOrder for orders 1 and 3, not 2
    expect(mockRetryRequest).toHaveBeenCalledTimes(2);
    expect(mockRetryRequest.mock.calls[0][0].url).toContain("orderChainId=1");
    expect(mockRetryRequest.mock.calls[1][0].url).toContain("orderChainId=3");
  });

  it("should do nothing when all orders are final", async () => {
    const ctx = createMockContext();

    const mockOrders = [{ orderId: 1, finalStatus: true }];

    setTimeout(() => {
      const payload = JSON.stringify({ accountId: null, type: WS_MESSAGE.ORDERS, body: mockOrders });
      wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));
    }, 0);

    await cancelAllOrders(ctx);

    expect(mockRetryRequest).not.toHaveBeenCalled();
  });

  it("should do nothing when there are no orders", async () => {
    const ctx = createMockContext();

    setTimeout(() => {
      const payload = JSON.stringify({ accountId: null, type: WS_MESSAGE.ORDERS, body: [] });
      wsInstance.emit("message", Buffer.from(`${payload.length}|${payload}`));
    }, 0);

    await cancelAllOrders(ctx);

    expect(mockRetryRequest).not.toHaveBeenCalled();
  });
});
