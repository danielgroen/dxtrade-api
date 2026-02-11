export interface AssessmentsParams {
  from: number;
  to: number;
  instrument: string;
  subtype?: string | null;
}

export interface AssessmentsResponse {
  totalPL?: number;
  [key: string]: unknown;
}
