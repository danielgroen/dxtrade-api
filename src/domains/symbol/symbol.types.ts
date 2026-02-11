export namespace Symbol {
  export interface Suggestion {
    id: number;
    name: string;
    [key: string]: unknown;
  }

  export interface Info {
    maxVolume: number;
    minVolume: number;
    volumeStep: number;
    lotSize: number;
    [key: string]: unknown;
  }

  export interface Limits {
    symbol: string;
    instrumentId: number;
    limitStopDistanceType: string;
    limitStopDistance: number;
    limitStopDistanceInPercentOfSpread: number;
    minOrderSize: number;
    minOrderSizeBypass: boolean;
    maxOrderSize: number;
    minOrderIncrement: number;
    limitType: string;
  }
}
