import type { NextRequest } from "next/server";
import { citationBundleForRecords } from "@/lib/citations";
import { apiMeta, ApiInputError, parseRecordQuery, serializePlotPoint } from "@/lib/api-v1";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { isPropertyKey, PROPERTY_BY_KEY } from "@/lib/data";
import { getReleaseDescriptor, queryCanonicalRecords } from "@/lib/query-store";
import { requireInternalDataAccess } from "@/lib/internal-api";

export async function GET(request: NextRequest) {
  const denied = requireInternalDataAccess(request);
  if (denied) return denied;
  try {
    const xRaw = request.nextUrl.searchParams.get("x");
    const yRaw = request.nextUrl.searchParams.get("y");
    if (!isPropertyKey(xRaw) || !isPropertyKey(yRaw)) {
      throw new ApiInputError("x and y must be valid property keys from /api/v1/properties.");
    }
    if (xRaw === yRaw) throw new ApiInputError("x and y must be different properties.");
    const query = parseRecordQuery(request.nextUrl.searchParams, {
      defaultLimit: 1000,
      maxLimit: 2000,
      requiredProperties: [xRaw, yRaw]
    });
    const [release, page] = await Promise.all([getReleaseDescriptor(), queryCanonicalRecords(query)]);
    const xMeta = PROPERTY_BY_KEY.get(xRaw);
    const yMeta = PROPERTY_BY_KEY.get(yRaw);
    return publicJson({
      ...apiMeta(release),
      axes: {
        x: {
          key: xRaw,
          label: xMeta?.label,
          canonical_unit: xMeta?.canonicalUnit,
          display_unit: xMeta?.displayUnit
        },
        y: {
          key: yRaw,
          label: yMeta?.label,
          canonical_unit: yMeta?.canonicalUnit,
          display_unit: yMeta?.displayUnit
        }
      },
      pagination: {
        returned: page.records.length,
        has_more: page.hasMore,
        next_cursor: page.nextCursor
      },
      points: page.records.map((record) => serializePlotPoint(record, xRaw, yRaw)),
      citations: citationBundleForRecords(page.records.map((record) => record.record))
    });
  } catch (error) {
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
