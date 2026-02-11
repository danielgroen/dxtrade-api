export interface WsPayload {
  accountId: string | null;
  body: unknown;
  type: string;
}