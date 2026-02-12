export namespace Position {
  export interface Get {
    uid: string;
    accountId: string;
    positionKey: { instrumentId: number; positionCode: string };
    quantity: number;
    cost: number;
    costBasis: number;
    openCost: number;
    marginRate: number;
    time: number;
    modifiedTime: number;
    userLogin: string;
    takeProfit: number | null;
    stopLoss: number | null;
  }

  export interface Metrics {
    uid: string;
    accountId: string;
    margin: number;
    plOpen: number;
    plClosed: number;
    totalCommissions: number;
    totalFinancing: number;
    plRate: number;
    averagePrice: number;
    marketValue: number;
    [key: string]: unknown;
  }

  export interface Full extends Get {
    margin: number;
    plOpen: number;
    plClosed: number;
    totalCommissions: number;
    totalFinancing: number;
    plRate: number;
    averagePrice: number;
    marketValue: number;
  }

  export interface Close {
    legs: {
      instrumentId: number;
      positionCode: string;
      positionEffect: string;
      ratioQuantity: number;
      symbol: string;
    }[];
    limitPrice: number;
    orderType: string;
    quantity: number;
    timeInForce: string;
  }
}
