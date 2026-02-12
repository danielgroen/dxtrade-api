import axios, { type AxiosRequestConfig, type AxiosResponse, isAxiosError } from "axios";
import { DxtradeError, ERROR } from "@/constants";

export async function retryRequest(config: AxiosRequestConfig, retries = 3): Promise<AxiosResponse> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axios(config);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.warn(`[dxtrade-api] Attempt ${attempt} failed: ${message}`, config.url);
      if (isAxiosError(error) && error.response?.status === 429) {
        throw new DxtradeError(ERROR.RATE_LIMITED, "Rate limited (429). Too many requests — try again later.");
      }
      if (attempt === retries) throw error;
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
  throw new Error("[dxtrade-api] Failed after retries");
}
