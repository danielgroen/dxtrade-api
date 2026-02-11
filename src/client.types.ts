import type { DxtradeError } from "@/constants/errors";
import type { Order } from "@/domains/order/order.types";

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

export interface ClientContext {
  config: DxtradeConfig;
  callbacks: DxtradeCallbacks;
  cookies: Record<string, string>;
  csrf: string | null;
  baseUrl: string;
  retries: number;
  debug: boolean | string;
  ensureSession(): void;
  throwError(code: string, message: string): never;
}
