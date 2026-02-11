import { endpoints, DxtradeError } from "@/constants";
import { Cookies, authHeaders, retryRequest } from "@/utils";
import type { ClientContext } from "@/client.types";
import type { Assessments } from ".";

export async function getAssessments(ctx: ClientContext, params: Assessments.Params): Promise<Assessments.Response> {
  ctx.ensureSession();

  try {
    const response = await retryRequest(
      {
        method: "POST",
        url: endpoints.assessments(ctx.baseUrl),
        data: {
          from: params.from,
          instrument: params.instrument,
          subtype: params.subtype ?? null,
          to: params.to,
        },
        headers: authHeaders(ctx.csrf!, Cookies.serialize(ctx.cookies)),
      },
      ctx.retries,
    );

    return response.data as Assessments.Response;
  } catch (error: unknown) {
    if (error instanceof DxtradeError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.throwError("ASSESSMENTS_ERROR", `Error fetching assessments: ${message}`);
  }
}
