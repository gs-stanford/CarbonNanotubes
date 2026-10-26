import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { ApiInputError } from "@/lib/api-v1";
import { enforceFigureRateLimit } from "@/lib/rate-limit";
import { transportAnalysis } from "@/lib/transport-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = enforceFigureRateLimit(request, true);
  if (limited) return limited;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new ApiInputError("JSON body required.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new ApiInputError("Analysis request exceeds 8192 bytes."); }
      chunks.push(value);
    }
    return publicJson(transportAnalysis(JSON.parse(Buffer.concat(chunks).toString("utf8"))));
  } catch (error) {
    return apiError(error instanceof SyntaxError ? new ApiInputError("Request must be valid JSON.") : error);
  }
}

export const OPTIONS = publicOptions;
