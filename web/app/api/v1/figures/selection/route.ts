import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { ApiInputError } from "@/lib/api-v1";
import { figureSelections } from "@/lib/figure-selection";
import { enforceFigureRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const limited = enforceFigureRateLimit(request, false);
    if (limited) return limited;
    const raw = await request.text();
    if (raw.length > 4096) throw new ApiInputError("Selection request is too large.");
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || typeof body.context_token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.context_token)
      || typeof body.record_id !== "string" || !body.record_id || body.record_id.length > 120) {
      throw new ApiInputError("A figure context token and one record_id are required.");
    }
    const result = figureSelections.read(body.context_token, body.record_id);
    const response = result === "expired"
      ? publicJson({ error: { code: "selection_expired", message: "Point details expired. Refresh the figure to reopen them." } }, { status: 410 })
      : result === "not_plotted"
        ? publicJson({ error: { code: "not_plotted", message: "This record is not in the figure." } }, { status: 404 })
        : publicJson(result);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return apiError(error instanceof SyntaxError ? new ApiInputError("Invalid JSON request.") : error);
  }
}

export const OPTIONS = publicOptions;
