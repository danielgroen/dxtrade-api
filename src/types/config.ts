import type { DxtradeError } from "@/constants/errors";
import type { OrderResponse, OrderUpdate } from "./order";

export interface DxtradeConfig {
  username: string;
  password: string;
  broker: string;
  accountId?: string;
  brokerUrls?: Record<string, string>;
  retries?: number;
  debug?: boolean;
  callbacks?: DxtradeCallbacks;
}

export interface DxtradeCallbacks {
  onError?: (error: DxtradeError) => void;
  onLogin?: () => void;
  onAccountSwitch?: (accountId: string) => void;
  onOrderPlaced?: (order: OrderResponse) => void;
  onOrderUpdate?: (order: OrderUpdate) => void;
}

