import { type NextRequest, NextResponse } from "next/server";
import { getRuntimeExplorerPayload } from "@/lib/data";
import { searchRecords } from "@/lib/search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 25);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 100) : 25;
  const payload = await getRuntimeExplorerPayload();
  const allResults = searchRecords(payload.records, query, payload.properties, Math.max(payload.records.length, 1));
  const groups = new Map<string, typeof allResults>();
  for (const result of allResults) {
    const doi = (result.record.doi_verified ?? result.record.doi_raw ?? "")
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "")
      .trim()
      .toLowerCase();
    const title = (result.record.publication_title_verified ?? result.record.citation_raw ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .toLowerCase();
    const key = doi ? `doi:${doi}` : `publication:${title}:${result.record.publication_year_verified ?? "n.d."}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  const grouped = Array.from(groups.entries())
    .map(([key, rows]) => {
      const primary = rows.slice().sort((a, b) => b.score - a.score)[0];
      return {
        key,
        rows,
        primary,
        score: Math.max(...rows.map((row) => row.score)),
        matchFields: Array.from(new Set(rows.flatMap((row) => row.matchFields)))
      };
    })
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const results = grouped.slice(0, limit);

  return NextResponse.json({
    query,
    count: results.length,
    totalCount: grouped.length,
    totalMatchedRows: allResults.length,
    results: results.map(({ key, rows, primary, score, matchFields }) => ({
      key,
      record_ids: rows.map((row) => row.record.record_id),
      score,
      matchFields,
      title: primary.record.publication_title_verified ?? primary.record.citation_raw ?? primary.record.public_sample_label,
      sample: primary.record.public_sample_label,
      doi: primary.record.doi_verified ?? primary.record.doi_raw,
      authors: primary.record.publication_authors_short_verified,
      journal: primary.record.publication_journal_verified,
      year: primary.record.publication_year_verified,
      material_families: Array.from(new Set(rows.map((row) => row.record.material_family))),
      form_factors: Array.from(new Set(rows.map((row) => row.record.form_factor))),
      matched_rows: rows.length
    }))
  });
}
