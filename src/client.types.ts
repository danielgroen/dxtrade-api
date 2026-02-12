import type { DxtradeError, BROKER } from "@/constants";
import type { Order } from "@/domains/order";

export interface DxtradeConfig {
  username: string;
  password: string;
  broker: keyof typeof BROKER;
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
  accountId: string | null;
  atmosphereId: string | null;
  broker: keyof typeof BROKER;
  retries: number;
  debug: boolean | string;
  ensureSession(): void;
  throwError(code: string, message: string): never;
}
