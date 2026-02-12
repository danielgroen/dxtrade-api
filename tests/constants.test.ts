import { describe, it, expect } from "vitest";
import { ORDER_TYPE, SIDE, ACTION, TIF, BROKER } from "../src";

describe("enums", () => {
  it("should have correct ORDER_TYPE values", () => {
    expect(ORDER_TYPE.MARKET).toBe("MARKET");
    expect(ORDER_TYPE.LIMIT).toBe("LIMIT");
    expect(ORDER_TYPE.STOP).toBe("STOP");
  });

  it("should have correct SIDE values", () => {
    expect(SIDE.BUY).toBe("BUY");
    expect(SIDE.SELL).toBe("SELL");
  });

  it("should have correct ACTION values", () => {
    expect(ACTION.OPENING).toBe("OPENING");
    expect(ACTION.CLOSING).toBe("CLOSING");
  });

  it("should have correct TIF values", () => {
    expect(TIF.GTC).toBe("GTC");
    expect(TIF.DAY).toBe("DAY");
    expect(TIF.GTD).toBe("GTD");
  });
});

describe("BROKER", () => {
  it("should have valid URLs for all brokers", () => {
    expect(BROKER.LARKFUNDING).toBe("https://trade.gooeytrade.com");
    expect(BROKER.EIGHTCAP).toBe("https://trader.dx-eightcap.com");
    expect(BROKER.FTMO).toBe("https://dxtrade.ftmo.com");
  });
});
