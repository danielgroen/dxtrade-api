import type { DxtradeError } from "@/constants/errors";

export interface DxtradeConfig {
  username: string;
  password: string;
  broker: string;
  accountId?: string;
  brokerUrls?: Record<string, string>;
  retries?: number;
  debug?: boolean | string;
  callbacks?: DxtradeCallbacks;
}

export interface DxtradeCallbacks {
  onError?: (error: DxtradeError) => void;
  onLogin?: () => void;
  onAccountSwitch?: (accountId: string) => void;
  onOrderPlaced?: (order: Order.Response) => void;
  onOrderUpdate?: (order: Order.Update) => void;
}
