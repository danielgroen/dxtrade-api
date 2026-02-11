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
