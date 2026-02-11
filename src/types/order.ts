import { ORDER_TYPE, SIDE, ACTION } from "@/constants/enums";

export interface SubmitOrderParams {
  symbol: string;
  side: SIDE;
  quantity: number;
  orderType: ORDER_TYPE;
  price?: number;
  instrumentId?: number;
  stopLoss?: StopLossParams;
  takeProfit?: TakeProfitParams;
  positionEffect?: ACTION;
}

export interface StopLossParams {
  price?: number;
  offset?: number;
}

export interface TakeProfitParams {
  price?: number;
  offset?: number;
}

export interface OrderResponse {
  status: number;
  data: unknown;
}

export interface OrderUpdate {
  orderId: string;
  status: string;
  statusDescription?: string;
  [key: string]: unknown;
}
