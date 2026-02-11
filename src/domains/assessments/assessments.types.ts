export namespace Assessments {
  export interface Params {
    from: number;
    to: number;
    instrument: string;
    subtype?: string | null;
  }

  export interface Response {
    totalPL?: number;
    [key: string]: unknown;
  }
}
