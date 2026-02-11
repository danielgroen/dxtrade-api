export namespace Account {
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
