import { type NextRequest, NextResponse } from "next/server";
import { getRuntimeExplorerPayload } from "@/lib/data";
import { searchRecords } from "@/lib/search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 25);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 100) : 25;
  const payload = await getRuntimeExplorerPayload();
  const allResults = searchRecords(payload.records, query, payload.properties, Math.max(payload.records.length, 1));
  const results = allResults.slice(0, limit);

  return NextResponse.json({
    query,
    count: results.length,
    totalCount: allResults.length,
    results: results.map(({ record, score, matchFields }) => ({
      record_id: record.record_id,
      score,
      matchFields,
      title: record.publication_title_verified ?? record.citation_raw ?? record.public_sample_label,
      sample: record.public_sample_label,
      doi: record.doi_verified ?? record.doi_raw,
      authors: record.publication_authors_short_verified,
      journal: record.publication_journal_verified,
      year: record.publication_year_verified,
      material_family: record.material_family,
      form_factor: record.form_factor
    }))
  });
}
