export namespace Instrument {
  export interface Info {
    id: number;
    symbol: string;
    description: string;
    type: string;
    subtype: string;
    currency: string;
    currencyPrecision: number;
    precision: number;
    pipsSize: number;
    quantityIncrement: number;
    quantityPrecision: number;
    priceIncrement: number;
    version: number;
    priceIncrementsTO: {
      priceIncrements: number[];
      pricePrecisions: number[];
      bondFraction: boolean;
    };
    lotSize: number;
    baseCurrency: string | null;
    lotName: string | null;
    multiplier: number;
    open: boolean;
    expiration: string | null;
    firstNoticeDate: string | null;
    lastTradeDate: string | null;
    underlying: string | null;
    mmy: string | null;
    optionParametersTO: unknown;
    unitName: string | null;
    additionalFields: unknown;
    additionalObject: unknown;
    currencyParametersTO: unknown;
    tradingHours: string;
  }
}
