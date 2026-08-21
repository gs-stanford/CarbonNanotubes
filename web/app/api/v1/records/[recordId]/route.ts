import { apiMeta, ApiInputError, serializeCanonicalRecord } from "@/lib/api-v1";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { getCanonicalRecord, getReleaseDescriptor } from "@/lib/query-store";
import { requireInternalDataAccess } from "@/lib/internal-api";

type RouteContext = { params: Promise<{ recordId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const denied = requireInternalDataAccess(request);
  if (denied) return denied;
  try {
    const { recordId } = await context.params;
    if (!recordId || recordId.length > 120) throw new ApiInputError("record_id is invalid.");
    const [release, record] = await Promise.all([getReleaseDescriptor(), getCanonicalRecord(recordId)]);
    if (!record) {
      return publicJson(
        { ...apiMeta(release), error: { code: "not_found", message: `Record ${recordId} was not found in the active release.` } },
        { status: 404 }
      );
    }
    return publicJson({ ...apiMeta(release), record: serializeCanonicalRecord(record) });
  } catch (error) {
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
