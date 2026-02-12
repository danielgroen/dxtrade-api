import { DxtradeError } from "@/constants";
import type { ClientContext } from "@/client.types";

export function createMockContext(overrides: Partial<ClientContext> = {}): ClientContext {
  return {
    config: {
      username: "test",
      password: "test",
      broker: "FTMO",
      accountId: "ACC-123",
    },
    callbacks: {},
    cookies: { session: "abc" },
    csrf: "csrf-token",
    accountId: "ACC-123",
    atmosphereId: "atm-id-123",
    wsManager: null,
    broker: "https://dxtrade.ftmo.com",
    retries: 1,
    debug: false,
    ensureSession() {
      if (!this.csrf) {
        throw new DxtradeError("NO_SESSION", "No active session");
      }
    },
    throwError(code: string, message: string): never {
      throw new DxtradeError(code, message);
    },
    ...overrides,
  };
}
