import type { NextRequest } from "next/server";
import { citationBundleForRecords } from "@/lib/citations";
import { apiMeta, ApiInputError } from "@/lib/api-v1";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { getReleaseDescriptor, queryCanonicalRecords } from "@/lib/query-store";

function normalizedIds(values: unknown): string[] {
  if (!Array.isArray(values)) throw new ApiInputError("record_ids must be an array of record IDs.");
  const ids = values.map((value) => String(value).trim()).filter(Boolean);
  if (!ids.length) throw new ApiInputError("At least one record_id is required.");
  if (ids.length > 500) throw new ApiInputError("No more than 500 record IDs may be cited in one request.");
  if (ids.some((id) => id.length > 120)) throw new ApiInputError("One or more record IDs are invalid.");
  return Array.from(new Set(ids));
}

async function citationResponse(recordIds: string[]) {
  const [release, page] = await Promise.all([
    getReleaseDescriptor(),
    queryCanonicalRecords({ limit: recordIds.length, recordIds })
  ]);
  const found = new Set(page.records.map((record) => record.record.record_id));
  const missing = recordIds.filter((recordId) => !found.has(recordId));
  return publicJson({
    ...apiMeta(release),
    requested_record_ids: recordIds,
    missing_record_ids: missing,
    citations: citationBundleForRecords(page.records.map((record) => record.record))
  });
}

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.getAll("record_id").flatMap((value) => value.split(","));
    return await citationResponse(normalizedIds(raw));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { record_ids?: unknown };
    return await citationResponse(normalizedIds(body.record_ids));
  } catch (error) {
    if (error instanceof SyntaxError) return apiError(new ApiInputError("Request body must be valid JSON."));
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
