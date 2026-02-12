export namespace OHLC {
  export interface Params {
    /** Symbol to fetch bars for (e.g. "EURUSD"). */
    symbol: string;
    /** Bar aggregation period in seconds (default: 60 = 1 min). Common values: 60 (1m), 300 (5m), 900 (15m), 1800 (30m), 3600 (1h), 14400 (4h), 86400 (1d). */
    resolution?: number;
    /** Lookback window in seconds from now (default: 432000 = 5 days). Determines how far back in history to fetch bars. */
    range?: number;
    /** Maximum number of bars to return (default: 3500). */
    maxBars?: number;
    /** Price field to use (default: "bid"). */
    priceField?: "bid" | "ask";
  }

  export interface Bar {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap: number;
    time: number;
  }
}
