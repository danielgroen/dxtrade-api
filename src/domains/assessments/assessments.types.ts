export namespace Assessments {
  export interface Params {
    from: number;
    to: number;
    instrument: string;
    subtype?:
      | "Agriculture"
      | "Cash CFD"
      | "Cash II CFD"
      | "Cash III CFD"
      | "Commodities"
      | "Crypto I CFD"
      | "Crypto II CFD"
      | "Equities I CFD"
      | "Equities II CFD"
      | "Exotics"
      | "Forex"
      | "Metals CFD"
      | null;
  }

  export interface Response {
    totalPL?: number;
    [key: string]: unknown;
  }
}
