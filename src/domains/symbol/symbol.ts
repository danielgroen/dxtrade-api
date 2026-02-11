import { endpoints, DxtradeError } from "@/constants";
import { Cookies, baseHeaders, retryRequest } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Symbol } from ".";

export async function getSymbolSuggestions(ctx: ClientContext, text: string): Promise<Symbol.Suggestion[]> {
  ctx.ensureSession();

  try {
    const cookieStr = Cookies.serialize(ctx.cookies);
    const response = await retryRequest(
      {
        method: "GET",
        url: endpoints.suggest(ctx.baseUrl, text),
        headers: { ...baseHeaders(), Cookie: cookieStr },
      },
      ctx.retries,
    );

    const suggests = response.data?.suggests;
    if (!suggests?.length) {
      ctx.throwError("NO_SUGGESTIONS", "No symbol suggestions found");
    }
    return suggests as Symbol.Suggestion[];
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError("SUGGEST_ERROR", `Error getting symbol suggestions: ${message}`);
  }
}

export async function getSymbolInfo(ctx: ClientContext, symbol: string): Promise<Symbol.Info> {
  ctx.ensureSession();

  try {
    const offsetMinutes = Math.abs(new Date().getTimezoneOffset());
    const cookieStr = Cookies.serialize(ctx.cookies);
    const response = await retryRequest(
      {
        method: "GET",
        url: endpoints.instrumentInfo(ctx.baseUrl, symbol, offsetMinutes),
        headers: { ...baseHeaders(), Cookie: cookieStr },
      },
      ctx.retries,
    );

    if (!response.data) {
      ctx.throwError("NO_SYMBOL_INFO", "No symbol info returned");
    }
    return response.data as Symbol.Info;
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError("SYMBOL_INFO_ERROR", `Error getting symbol info: ${message}`);
  }
}
