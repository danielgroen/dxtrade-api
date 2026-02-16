import { appendFileSync, writeFileSync } from "fs";
import type WebSocket from "ws";
import { DxtradeError, ERROR } from "@/constants";
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

export function parseAtmosphereId(data: WebSocket.Data): string | null {
  const raw = data.toString();
  const parts = raw.split("|");
  if (parts.length >= 2 && /^[0-9a-f-]{36}$/.test(parts[1])) {
    return parts[1];
  }
  return null;
}

/** Check if a WebSocket error is a 429 rate limit. If so, throw a RATE_LIMITED DxtradeError. */
export function checkWsRateLimit(error: Error): void {
  if (error.message.includes("429")) {
    throw new DxtradeError(ERROR.RATE_LIMITED, "Rate limited (429). Too many requests — try again later.");
  }
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
