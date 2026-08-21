import type { NextRequest } from "next/server";
import { apiMeta, parseRecordQuery, serializeCanonicalRecord } from "@/lib/api-v1";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { getReleaseDescriptor, queryCanonicalRecords } from "@/lib/query-store";
import { requireInternalDataAccess } from "@/lib/internal-api";

export async function GET(request: NextRequest) {
  const denied = requireInternalDataAccess(request);
  if (denied) return denied;
  try {
    const query = parseRecordQuery(request.nextUrl.searchParams);
    const [release, page] = await Promise.all([getReleaseDescriptor(), queryCanonicalRecords(query)]);
    return publicJson({
      ...apiMeta(release),
      query: {
        property: query.property ?? null,
        canonical_value_range: query.property
          ? { min: query.minValue ?? null, max: query.maxValue ?? null }
          : null,
        measurement_filters: query.measurementRanges ?? []
      },
      pagination: {
        returned: page.records.length,
        has_more: page.hasMore,
        next_cursor: page.nextCursor
      },
      records: page.records.map(serializeCanonicalRecord)
    });
  } catch (error) {
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
