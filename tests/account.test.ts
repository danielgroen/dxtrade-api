import { describe, it, expect, vi, beforeEach } from "vitest";
import { DxtradeError } from "@/constants/errors";
import { getTradeHistory } from "@/domains/account";
import { createMockContext } from "./helpers";

// --- Mocks ---

const mockRetryRequest = vi.fn();
vi.mock("@/utils", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, retryRequest: (...args: unknown[]) => mockRetryRequest(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Tests ---

describe("getTradeHistory", () => {
  it("should return trade history data on success", async () => {
    const ctx = createMockContext();
    const mockHistory = [
      { orderId: 1, orderCode: "OC1", instrument: "EURUSD", side: "BUY", type: "MARKET", status: "FILLED", quantity: 1000, filledQuantity: 1000, price: 1.105, averagePrice: 1.105, time: "2024-01-01" },
      { orderId: 2, orderCode: "OC2", instrument: "BTCUSD", side: "SELL", type: "LIMIT", status: "FILLED", quantity: 100, filledQuantity: 100, price: 65000, averagePrice: 65000, time: "2024-01-02" },
    ];

    mockRetryRequest.mockResolvedValue({
      status: 200,
      data: mockHistory,
      headers: { "set-cookie": [] },
    });

    const result = await getTradeHistory(ctx, { from: 1704067200000, to: 1704153600000 });

    expect(result).toEqual(mockHistory);
    expect(mockRetryRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: expect.stringContaining("/api/history?from=1704067200000&to=1704153600000"),
      }),
      ctx.retries,
    );
  });

  it("should merge cookies from response", async () => {
    const ctx = createMockContext();

    mockRetryRequest.mockResolvedValue({
      status: 200,
      data: [],
      headers: { "set-cookie": ["newCookie=value123; Path=/"] },
    });

    await getTradeHistory(ctx, { from: 0, to: 1 });

    expect(ctx.cookies).toHaveProperty("newCookie", "value123");
  });

  it("should throw TRADE_HISTORY_ERROR on non-200 status", async () => {
    const ctx = createMockContext();

    mockRetryRequest.mockResolvedValue({
      status: 500,
      data: null,
      headers: { "set-cookie": [] },
    });

    await expect(getTradeHistory(ctx, { from: 0, to: 1 })).rejects.toThrow(DxtradeError);
    await expect(getTradeHistory(ctx, { from: 0, to: 1 })).rejects.toThrow("Trade history failed: 500");
  });

  it("should throw TRADE_HISTORY_ERROR on network error", async () => {
    const ctx = createMockContext();
    mockRetryRequest.mockRejectedValue(new Error("Network timeout"));

    await expect(getTradeHistory(ctx, { from: 0, to: 1 })).rejects.toThrow(DxtradeError);
    await expect(getTradeHistory(ctx, { from: 0, to: 1 })).rejects.toThrow("Trade history error: Network timeout");
  });

  it("should rethrow DxtradeError as-is", async () => {
    const ctx = createMockContext();
    const original = new DxtradeError("CUSTOM", "custom");
    mockRetryRequest.mockRejectedValue(original);

    await expect(getTradeHistory(ctx, { from: 0, to: 1 })).rejects.toBe(original);
  });

  it("should throw NO_SESSION when not authenticated", async () => {
    const ctx = createMockContext({ csrf: null });

    await expect(getTradeHistory(ctx, { from: 0, to: 1 })).rejects.toThrow("No active session");
  });
});
