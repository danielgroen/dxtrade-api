import WebSocket from "ws";

export function waitForHandshake(wsUrl: string, cookieStr: string, timeout = 30_000, debug = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("[dxtrade-api] Handshake timed out"));
    }, timeout);

    ws.on("message", (data) => {
      const str = data.toString();
      if (debug) console.log("[dxtrade-api:ws]", str);

      if (str.includes(`"POSITIONS"`)) {
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      ws.close();
      reject(new Error(`[dxtrade-api] WebSocket handshake error: ${error.message}`));
    });
  });
}

export function waitForOrderUpdate(wsUrl: string, cookieStr: string, timeout = 30_000, debug = false): Promise<OrderUpdate> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { Cookie: cookieStr } });

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("[dxtrade-api] Order update timed out"));
    }, timeout);

    ws.on("message", (data) => {
      const str = data.toString();
      if (debug) console.log("[dxtrade-api:ws]", str);

      if (!str.includes(`"ORDERS"`)) return;
      if (!str.includes(`orderId`)) return;

      const json = str.replace(/^.*?\{/, "{");
      if (!json.includes("{")) return;

      try {
        const response = JSON.parse(json);
        const body = response.body?.[0] as OrderUpdate | undefined;
        if (!body) return;

        clearTimeout(timer);
        ws.close();

        if (body.status === "REJECTED") {
          reject(new Error(`[dxtrade-api] Order rejected: ${body.statusDescription ?? "Unknown reason"}`));
        } else {
          resolve(body);
        }
      } catch {
        // ignore parse errors, wait for next message
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timer);
      ws.close();
      reject(new Error(`[dxtrade-api] WebSocket order listener error: ${error.message}`));
    });
  });
}
