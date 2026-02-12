export namespace Account {
  export interface TradeHistory {
    orderId: number;
    orderCode: string;
    instrument: string;
    side: string;
    type: string;
    status: string;
    quantity: number;
    filledQuantity: number;
    price: number;
    averagePrice: number;
    time: string;
    [key: string]: unknown;
  }

  export interface Metrics {
    availableFunds: number;
    marginCallLevel: number | string;
    riskLevel: number;
    openPl: number;
    cashBalance: number;
    equity: number;
    conversionRate: number;
    initialMargin: number;
    availableBalance: number;
    reverseRiskLevel: number | string;
    [key: string]: unknown;
  }
}
