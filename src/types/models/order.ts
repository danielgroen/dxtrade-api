import { ORDER_TYPE, SIDE, ACTION, TIF } from "@/constants/enums";

export namespace Order {
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
