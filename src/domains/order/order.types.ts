import type { ORDER_TYPE, SIDE, ACTION, TIF, MESSAGE_CATEGORY, MESSAGE_TYPE, ORDER_STATUS } from "@/constants/enums";

export namespace Order {
  export interface Get {
    account: string;
    orderId: number;
    orderCode: string;
    version: number;
    type: ORDER_TYPE;
    instrument: string;
    status: string;
    finalStatus: boolean;
    side: SIDE;
    tif: TIF;
    legs: Leg[];
    issueTime: string;
    transactionTime: string;
    [key: string]: unknown;
  }

  export interface SubmitParams {
    symbol: string;
    side: SIDE;
    quantity: number;
    orderType: ORDER_TYPE;
    orderCode?: string;
    price?: number;
    instrumentId?: number;
    positionEffect?: ACTION;
    positionCode?: string;
    tif?: TIF;
    expireDate?: string;
    stopLoss?: StopLoss;
    takeProfit?: TakeProfit;
    metadata?: Record<string, string>;
  }

  export interface StopLoss {
    price?: number;
    offset?: number;
  }

  export interface TakeProfit {
    price?: number;
    offset?: number;
  }

  export interface Response {
    orderId: number;
    updateOrderId: number;
  }

  export interface Update {
    orderId: string;
    status: string;
    statusDescription?: string;
    positionCode?: string;
    [key: string]: unknown;
  }

  export interface Model {
    account: string;
    orderId: number;
    orderCode: string;
    version: number;
    clientOrderId: string;
    actionCode: string;
    legCount: number;
    type: ORDER_TYPE;
    instrument: string;
    status: string;
    finalStatus: boolean;
    legs: Leg[];
    side: SIDE;
    tif: TIF;
    priceOffset?: number;
    priceLink?: "TRIGGERED_STOP" | "TRIGGERED_LIMIT";
    expireDate?: string;
    marginRate?: number;
    issueTime: string;
    transactionTime: string;
    links?: Link[];
    executions?: Execution[];
    cashTransactions?: CashTransaction[];
    audit?: Audit;
  }

  export interface Leg {
    instrument: string;
    positionEffect?: ACTION;
    positionCode?: string;
    price?: number;
    legRatio: number;
    quantity: number;
    filledQuantity: number;
    remainingQuantity: number;
    averagePrice: number;
  }

  export interface Link {
    linkType: "PARENT" | "CHILD" | "OCO";
    linkedOrder: string;
    linkedClientOrderId: string;
  }

  export interface Execution {
    [key: string]: unknown;
  }

  export interface CashTransaction {
    [key: string]: unknown;
  }

  export interface Audit {
    IP?: string;
    userAgent?: string;
  }
}

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
    orderStatus: ORDER_STATUS;
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
    messageCategory: MESSAGE_CATEGORY;
    messageType: MESSAGE_TYPE;
    historyMessage: boolean;
    triggeredBeforeLogin: boolean;
    critical: boolean;
    timeStamp: number;
    account: string | null;
    key: string | null;
    parametersTO: OrderParams | InstrumentParams;
  }
}
