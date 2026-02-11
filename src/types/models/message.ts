export namespace Message {
  export interface RejectReason {
    key: string;
    parameters: unknown[];
    errorCode: number;
  }

  export interface OrderParams {
    orderKey: string;
    symbol: string;
    orderType: string;
    orderSide: string;
    orderStatus: "PLACED" | "FILLED" | "REJECTED";
    quantity: number;
    remainingQuantity: number;
    filledQuantity: number | string;
    filledPrice: number | string;
    filledSize: number | string;
    price: number | string;
    secondPrice: number | string;
    orderTimeInForce: string;
    expiration: number;
    instrumentType: string;
    positionCode: string;
    positionEffect: string | null;
    protection: boolean;
    openChainKey: string;
    stopLossProtectionPrice: number | null;
    takeProfitProtectionPrice: number | null;
    rejectReason: RejectReason | null;
    refOrderType: string | null;
    legs: unknown | null;
  }

  export interface InstrumentParams {
    symbol: string;
    active: boolean;
  }

  export interface Entry {
    principalLogin: string | null;
    accountId: string | null;
    messageCategory: "TRADE_LOG" | "NOTIFICATION";
    messageType: "ORDER" | "INSTRUMENT_ACTIVATED";
    historyMessage: boolean;
    triggeredBeforeLogin: boolean;
    critical: boolean;
    timeStamp: number;
    account: string | null;
    key: string | null;
    parametersTO: OrderParams | InstrumentParams;
  }
}
