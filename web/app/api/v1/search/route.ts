import type { NextRequest } from "next/server";
import { apiMeta, ApiInputError } from "@/lib/api-v1";
import { apiError, publicJson, publicOptions } from "@/lib/api-response";
import { canonicalSearchDoi, searchPublications } from "@/lib/publication-search";
import { enforceSearchRateLimit } from "@/lib/rate-limit";
import { getPublicationSearchCorpus, getReleaseDescriptor } from "@/lib/query-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function searchParameters(request: NextRequest): { query: string; limit: number } {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 300) {
    throw new ApiInputError("q must be a non-empty string of 300 characters or fewer.");
  }
  const doi = canonicalSearchDoi(query);
  const isDoi = /^10\.\d{4,9}\/.+/i.test(doi);
  if (!isDoi && query.length < 2) throw new ApiInputError("q must contain at least two characters.");
  const rawLimit = request.nextUrl.searchParams.get("limit") ?? "10";
  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new ApiInputError("limit must be an integer between 1 and 25.");
  }
  return { query, limit };
}

export async function GET(request: NextRequest) {
  try {
    const limited = enforceSearchRateLimit(request);
    if (limited) return limited;
    const { query, limit } = searchParameters(request);
    const [release, corpus] = await Promise.all([
      getReleaseDescriptor(),
      getPublicationSearchCorpus()
    ]);
    const search = searchPublications(corpus.records, corpus.publications, query, limit);
    return publicJson({
      ...apiMeta(release),
      query,
      returned: search.results.length,
      has_more: search.hasMore,
      results: search.results
    });
  } catch (error) {
    return apiError(error);
  }
}

export const OPTIONS = publicOptions;
