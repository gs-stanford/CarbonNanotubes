import type { NextRequest } from "next/server";
import { apiMeta, ApiInputError } from "@/lib/api-v1";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { doiValue } from "@/lib/citations";
import { enforceDoiStatusRateLimit } from "@/lib/rate-limit";
import { getReleaseDescriptor, lookupDoiMetadata } from "@/lib/query-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestedDoi(request: NextRequest): string {
  const raw = request.nextUrl.searchParams.get("doi")?.trim() ?? "";
  if (!raw || raw.length > 300) throw new ApiInputError("doi must be a non-empty string of 300 characters or fewer.");
  const doi = doiValue(raw);
  if (!doi || !/^10\.\d{4,9}\/\S+$/i.test(doi)) throw new ApiInputError("doi must be a valid DOI beginning with 10.xxxx/.");
  return doi;
}

export async function GET(request: NextRequest) {
  try {
    const limited = enforceDoiStatusRateLimit(request);
    if (limited) return limited;
    const doi = requestedDoi(request);
    const [release, publication] = await Promise.all([
      getReleaseDescriptor(),
      lookupDoiMetadata(doi)
    ]);
    return publicJson({
      ...apiMeta(release),
      query_doi: doi,
      in_database: Boolean(publication),
      publication: publication
        ? {
            doi: publication.doi,
            title: publication.title,
            authors_short: publication.authors_short,
            journal: publication.journal,
            year: publication.year,
            role: publication.role
          }
        : null
    });
  } catch (error) {
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
