import { endpoints, DxtradeError, ERROR } from "@/constants";
import { Cookies, authHeaders, retryRequest } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Assessments } from ".";

export class AssessmentsDomain {
  constructor(private _ctx: ClientContext) {}

  /** Fetch PnL assessments for an instrument within a date range. */
  async get(params: Assessments.Params): Promise<Assessments.Response> {
    this._ctx.ensureSession();

    try {
      const response = await retryRequest(
        {
          method: "POST",
          url: endpoints.assessments(this._ctx.broker),
          data: {
            from: params.from,
            instrument: params.instrument,
            subtype: params.subtype ?? null,
            to: params.to,
          },
          headers: authHeaders(this._ctx.csrf!, Cookies.serialize(this._ctx.cookies)),
        },
        this._ctx.retries,
      );

      return response.data as Assessments.Response;
    } catch (error: unknown) {
      if (error instanceof DxtradeError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      this._ctx.throwError(ERROR.ASSESSMENTS_ERROR, `Error fetching assessments: ${message}`);
    }
  }
}
