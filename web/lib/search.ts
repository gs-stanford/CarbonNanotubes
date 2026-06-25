import type { PlotRecord, PropertyMeta } from "@/lib/data";

export type SearchMatchField =
  | "doi"
  | "author"
  | "title"
  | "keyword"
  | "sample"
  | "journal"
  | "year";

export type SearchResult = {
  record: PlotRecord;
  score: number;
  matchFields: SearchMatchField[];
};

const FAMILY_KEYWORDS: Record<string, string> = {
  CNT_or_CNT_hybrid: "CNT carbon nanotube nanotubes CNTF nanotube fiber nanotube yarn",
  CNT_metal_composite: "CNT metal composite carbon nanotube copper composite electroplated matrix",
  graphene_or_GO_fiber: "graphene graphite graphene oxide GO fiber",
  carbon_fiber_comparator: "carbon fiber comparator PAN pitch graphite graphitized",
  other_carbon_comparator: "other carbon graphite carbon comparator",
  polymer_fiber_comparator: "polymer fiber aramid kevlar PBO UHMWPE dyneema zylon",
  metal_comparator: "metal copper aluminum aluminium silver gold steel conductor benchmark",
  ceramic_or_glass_comparator: "ceramic glass fiber comparator"
};

const FORM_KEYWORDS: Record<string, string> = {
  fiber_yarn: "fiber fibre yarn cable thread filament",
  sheet_mat_film: "sheet mat film membrane buckyfilm",
  buckypaper: "buckypaper paper sheet mat",
  foam_aerogel: "foam aerogel porous scaffold",
  forest_array: "forest array vertically aligned VA CNT",
  individual_nanotube_or_bundle: "individual nanotube bundle tube",
  bulk: "bulk solid composite",
  unknown: ""
};

const STOP_TOKENS = new Set(["a", "an", "and", "by", "de", "di", "du", "et", "for", "in", "la", "of", "on", "the", "to", "with"]);

function stripMarkup(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string | null | undefined): string {
  return stripMarkup(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function doiCandidates(value: string | null | undefined): string[] {
  return stripMarkup(value)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function canonicalDoi(value: string | null | undefined): string {
  return normalize(value)
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .trim();
}

function tokensFromQuery(query: string): string[] {
  const normalized = normalize(query);
  const doi = canonicalDoi(query);
  if (doi.startsWith("10.")) return [doi];
  return normalized
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_TOKENS.has(token));
}

function fieldContainsAll(field: string, tokens: string[]): boolean {
  return tokens.length > 0 && tokens.every((token) => field.includes(token));
}

function fieldHasUsefulPartial(field: string, tokens: string[]): boolean {
  if (!tokens.length) return false;
  const matches = tokens.filter((token) => field.includes(token)).length;
  return tokens.length === 1 ? matches === 1 : matches >= Math.min(2, tokens.length);
}

function joined(values: Array<string | number | null | undefined>): string {
  return normalize(values.filter((value) => value !== null && value !== undefined && value !== "").join(" "));
}

function propertyKeywords(record: PlotRecord, properties: PropertyMeta[]): string {
  return properties
    .filter((property) => typeof record.values[property.key] === "number")
    .map((property) => `${property.label} ${property.key.replaceAll("_", " ")}`)
    .join(" ");
}

function addField(fields: Set<SearchMatchField>, field: SearchMatchField, score: number, amount: number): number {
  fields.add(field);
  return score + amount;
}

export function searchRecords(records: PlotRecord[], query: string, properties: PropertyMeta[] = [], limit = 50): SearchResult[] {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return records.slice(0, limit).map((record) => ({ record, score: 0, matchFields: [] }));
  }

  const queryNorm = normalize(cleanQuery);
  const queryDoi = canonicalDoi(cleanQuery);
  const tokens = tokensFromQuery(cleanQuery);
  if (!tokens.length) return [];

  const results: SearchResult[] = [];
  for (const record of records) {
    const fields = new Set<SearchMatchField>();
    let score = 0;

    const doiText = joined([...doiCandidates(record.doi_verified), ...doiCandidates(record.doi_raw), ...doiCandidates(record.secondary_source_doi_raw), record.url_raw]);
    const titleText = joined([record.publication_title_verified, record.secondary_source_title, record.citation_raw]);
    const authorText = joined([record.publication_authors_short_verified, record.publication_authors_full_verified, record.secondary_source_authors_short, record.original_reference_raw]);
    const sampleText = joined([record.public_sample_label, record.sample_name, record.record_label]);
    const journalText = joined([record.publication_journal_verified, record.secondary_source_journal]);
    const yearText = joined([record.publication_year_verified, record.publication_published_date_verified, record.secondary_source_year]);
    const keywordText = joined([
      FAMILY_KEYWORDS[record.material_family],
      FORM_KEYWORDS[record.form_factor],
      record.material_family,
      record.form_factor,
      record.cnt_type,
      record.synthesis_method,
      record.postprocessing,
      record.measurement_method,
      record.condition_atmosphere,
      record.public_plot_badge,
      record.source_publication_type,
      propertyKeywords(record, properties)
    ]);

    if (queryDoi.startsWith("10.") && doiText.includes(queryDoi)) score = addField(fields, "doi", score, 120);
    else if (fieldContainsAll(doiText, tokens)) score = addField(fields, "doi", score, 80);
    else if (fieldHasUsefulPartial(doiText, tokens)) score = addField(fields, "doi", score, 36);

    if (titleText.includes(queryNorm) || fieldContainsAll(titleText, tokens)) score = addField(fields, "title", score, 46);
    else if (fieldHasUsefulPartial(titleText, tokens)) score = addField(fields, "title", score, 14);

    if (authorText.includes(queryNorm) || fieldContainsAll(authorText, tokens)) score = addField(fields, "author", score, 40);
    else if (fieldHasUsefulPartial(authorText, tokens)) score = addField(fields, "author", score, 12);

    if (sampleText.includes(queryNorm) || fieldContainsAll(sampleText, tokens)) score = addField(fields, "sample", score, 28);
    else if (fieldHasUsefulPartial(sampleText, tokens)) score = addField(fields, "sample", score, 8);

    if (keywordText.includes(queryNorm) || fieldContainsAll(keywordText, tokens)) score = addField(fields, "keyword", score, 22);
    else if (fieldHasUsefulPartial(keywordText, tokens)) score = addField(fields, "keyword", score, 6);

    if (journalText.includes(queryNorm) || fieldContainsAll(journalText, tokens)) score = addField(fields, "journal", score, 16);
    if (yearText.includes(queryNorm) || fieldContainsAll(yearText, tokens)) score = addField(fields, "year", score, 10);

    const allText = [doiText, titleText, authorText, sampleText, journalText, yearText, keywordText].join(" ");
    if (!fields.size && fieldContainsAll(allText, tokens)) score = addField(fields, "keyword", score, 5);
    if (!score) continue;

    if (record.public_release_tier === "peer_reviewed_research") score += 3;
    if (record.value_extraction_type === "direct_or_source_table") score += 2;
    if (record.publication_year_verified) score += Math.min(Math.max(record.publication_year_verified - 1990, 0), 40) / 100;

    results.push({ record, score, matchFields: Array.from(fields) });
  }

  return results.sort((a, b) => b.score - a.score || (b.record.publication_year_verified ?? 0) - (a.record.publication_year_verified ?? 0)).slice(0, limit);
}
