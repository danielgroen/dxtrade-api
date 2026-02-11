import { appendFileSync, writeFileSync } from "fs";
import type WebSocket from "ws";
import type { WsPayload } from "./websocket.types";

export type { WsPayload } from "./websocket.types";

const DEBUG_LOG = "debug.log";

export function shouldLog(msg: WsPayload | string, debug: boolean | string): boolean {
  if (!debug) return false;
  if (debug === true || debug === "true") return true;
  if (typeof msg === "string") return false;
  const filters = (debug as string).split(",").map((s) => s.trim().toUpperCase());
  return filters.includes(msg.type);
}

export function debugLog(msg: WsPayload | string): void {
  appendFileSync(DEBUG_LOG, JSON.stringify(msg) + "\n");
}

export function clearDebugLog(): void {
  writeFileSync(DEBUG_LOG, "");
}

export function parseWsData(data: WebSocket.Data): WsPayload | string {
  const raw = data.toString();
  const pipeIndex = raw.indexOf("|");
  if (pipeIndex === -1) return raw;

  try {
    return JSON.parse(raw.slice(pipeIndex + 1)) as WsPayload;
  } catch {
    return raw;
  }
}
