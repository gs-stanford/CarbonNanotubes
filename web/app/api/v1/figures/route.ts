import type { NextRequest } from "next/server";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { ApiInputError } from "@/lib/api-v1";
import { buildFigureResponse } from "@/lib/figure-service";
import { enforceFigureRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 64_000) throw new ApiInputError("Figure request body is too large.");
    const body = await request.json();
    const limited = enforceFigureRateLimit(request, Number(body?.top ?? 0) > 0);
    if (limited) return limited;
    return publicJson(await buildFigureResponse(body));
  } catch (error) {
    if (error instanceof SyntaxError) return apiError(new ApiInputError("Request body must be valid JSON."));
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
