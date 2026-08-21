import type { Publication, PublicRecord } from "@/lib/data";

export type PublicationSearchMatchField = "doi" | "title" | "author" | "journal" | "year" | "keyword";

export type PublicationSearchResult = {
  doi: string | null;
  title: string;
  authors_short: string | null;
  journal: string | null;
  year: number | null;
  role: "original" | "compilation" | "original_and_compilation";
  match_fields: PublicationSearchMatchField[];
};

type PublicationRole = "original" | "compilation";

type PublicationDocument = {
  key: string;
  doi: string | null;
  title: string;
  authorsShort: string | null;
  authorsFull: string | null;
  journal: string | null;
  year: number | null;
  roles: Set<PublicationRole>;
  keywords: Set<string>;
};

type ScoredDocument = {
  document: PublicationDocument;
  score: number;
  matchFields: Set<PublicationSearchMatchField>;
};

const STOP_TOKENS = new Set([
  "a", "an", "and", "at", "by", "de", "di", "du", "et", "for", "from", "in", "la", "of", "on", "the", "to", "with"
]);

const FAMILY_KEYWORDS: Record<string, string> = {
  CNT_or_CNT_hybrid: "CNT carbon nanotube nanotubes nanotube fiber nanotube fibre CNTF hybrid",
  CNT_metal_composite: "CNT metal composite carbon nanotube metal matrix copper composite electroplated",
  graphene_or_GO_fiber: "graphene graphite graphene oxide GO fiber fibre",
  carbon_fiber_comparator: "carbon fiber carbon fibre PAN pitch graphitic graphitized comparator",
  other_carbon_comparator: "carbon graphite graphitic comparator",
  polymer_fiber_comparator: "polymer fiber fibre aramid kevlar PBO UHMWPE dyneema zylon",
  metal_comparator: "metal copper aluminium aluminum silver gold steel conductor benchmark",
  ceramic_or_glass_comparator: "ceramic glass fiber fibre comparator"
};

const FORM_KEYWORDS: Record<string, string> = {
  fiber_yarn: "fiber fibre yarn cable thread filament",
  sheet_mat_film: "sheet mat film membrane buckyfilm",
  buckypaper: "buckypaper paper sheet mat",
  foam_aerogel: "foam aerogel porous scaffold",
  forest_array: "forest array vertically aligned",
  individual_nanotube_or_bundle: "individual nanotube bundle tube",
  bulk: "bulk solid composite",
  unknown: ""
};

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
    .replace(/[‐‑‒–—−]/g, "-")
    .toLowerCase();
}

export function canonicalSearchDoi(value: string | null | undefined): string {
  return normalize(value)
    .split(";")[0]
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .replace(/[.,;]+$/, "")
    .trim();
}

function tokens(value: string): string[] {
  return Array.from(new Set(
    normalize(value)
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOP_TOKENS.has(token))
  ));
}

function words(value: string): Set<string> {
  return new Set(normalize(value).split(/[^a-z0-9]+/).filter(Boolean));
}

function tokenMatches(field: string, fieldWords: Set<string>, token: string): boolean {
  if (token.length <= 2) return fieldWords.has(token);
  return field.includes(token);
}

function tokenMatchCount(field: string, queryTokens: string[]): number {
  const fieldWords = words(field);
  return queryTokens.filter((token) => tokenMatches(field, fieldWords, token)).length;
}

function bestText(current: string | null, incoming: string | null | undefined): string | null {
  const candidate = stripMarkup(incoming);
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate.length > current.length ? candidate : current;
}

function publicationKey(doi: string | null, title: string, year: number | null): string {
  return doi ? `doi:${doi}` : `title:${normalize(title)}:${year ?? "n.d."}`;
}

function recordKeywords(record: PublicRecord): string[] {
  return [
    FAMILY_KEYWORDS[record.material_family] ?? record.material_family,
    FORM_KEYWORDS[record.form_factor] ?? record.form_factor,
    record.material_family,
    record.form_factor,
    record.cnt_type,
    record.synthesis_method,
    record.postprocessing,
    record.measurement_method,
    record.condition_atmosphere,
    record.source_publication_type
  ].map((value) => stripMarkup(value)).filter(Boolean);
}

function addDocument(
  documents: Map<string, PublicationDocument>,
  metadata: {
    doi?: string | null;
    title?: string | null;
    authorsShort?: string | null;
    authorsFull?: string | null;
    journal?: string | null;
    year?: number | null;
  },
  role: PublicationRole,
  keywords: string[]
) {
  const doi = canonicalSearchDoi(metadata.doi) || null;
  const title = stripMarkup(metadata.title);
  if (!doi && !title) return;
  const key = publicationKey(doi, title, metadata.year ?? null);
  const existing = documents.get(key);
  if (existing) {
    existing.title = bestText(existing.title, title) ?? existing.title;
    existing.authorsShort = bestText(existing.authorsShort, metadata.authorsShort);
    existing.authorsFull = bestText(existing.authorsFull, metadata.authorsFull);
    existing.journal = bestText(existing.journal, metadata.journal);
    existing.year ??= metadata.year ?? null;
    existing.roles.add(role);
    keywords.forEach((keyword) => existing.keywords.add(keyword));
    return;
  }
  documents.set(key, {
    key,
    doi,
    title: title || doi || "Untitled publication",
    authorsShort: bestText(null, metadata.authorsShort),
    authorsFull: bestText(null, metadata.authorsFull),
    journal: bestText(null, metadata.journal),
    year: metadata.year ?? null,
    roles: new Set([role]),
    keywords: new Set(keywords)
  });
}

function buildPublicationDocuments(records: PublicRecord[]): PublicationDocument[] {
  const documents = new Map<string, PublicationDocument>();
  for (const record of records) {
    const keywords = recordKeywords(record);
    addDocument(
      documents,
      {
        doi: record.doi_verified ?? record.doi_raw,
        title: record.publication_title_verified,
        authorsShort: record.publication_authors_short_verified,
        authorsFull: record.publication_authors_full_verified,
        journal: record.publication_journal_verified,
        year: record.publication_year_verified
      },
      "original",
      keywords
    );
    addDocument(
      documents,
      {
        doi: record.compilation_source_doi_raw,
        title: record.compilation_source_title,
        authorsShort: record.compilation_source_authors_short,
        journal: record.compilation_source_journal,
        year: record.compilation_source_year
      },
      "compilation",
      keywords
    );
  }
  return Array.from(documents.values());
}

function enrichPublicationDocuments(documents: PublicationDocument[], publications: Publication[]): PublicationDocument[] {
  const byKey = new Map(documents.map((document) => [document.key, document]));
  for (const publication of publications) {
    const doi = canonicalSearchDoi(publication.doi_verified) || null;
    const title = stripMarkup(publication.title_verified);
    if (!doi && !title) continue;
    const key = publicationKey(doi, title, publication.year_verified);
    const existing = byKey.get(key);
    if (existing) {
      existing.title = bestText(existing.title, title) ?? existing.title;
      existing.authorsShort = bestText(existing.authorsShort, publication.authors_short_verified);
      existing.authorsFull = bestText(existing.authorsFull, publication.authors_full_verified);
      existing.journal = bestText(existing.journal, publication.journal_verified);
      existing.year ??= publication.year_verified;
      continue;
    }
    const standalone: PublicationDocument = {
      key,
      doi,
      title: title || doi || "Untitled publication",
      authorsShort: bestText(null, publication.authors_short_verified),
      authorsFull: bestText(null, publication.authors_full_verified),
      journal: bestText(null, publication.journal_verified),
      year: publication.year_verified,
      roles: new Set(["original"]),
      keywords: new Set()
    };
    byKey.set(key, standalone);
  }
  return Array.from(byKey.values());
}

function roleFor(document: PublicationDocument): PublicationSearchResult["role"] {
  if (document.roles.size > 1) return "original_and_compilation";
  return document.roles.has("compilation") ? "compilation" : "original";
}

function addScore(
  result: ScoredDocument,
  field: PublicationSearchMatchField,
  amount: number
) {
  result.matchFields.add(field);
  result.score += amount;
}

function scoreField(
  result: ScoredDocument,
  fieldName: PublicationSearchMatchField,
  fieldValue: string,
  queryNorm: string,
  queryTokens: string[],
  weights: { phrase: number; all: number; partial: number }
) {
  if (!fieldValue) return;
  const normalizedField = normalize(fieldValue);
  if (normalizedField.includes(queryNorm)) {
    addScore(result, fieldName, weights.phrase);
    return;
  }
  const matched = tokenMatchCount(normalizedField, queryTokens);
  if (matched === queryTokens.length) addScore(result, fieldName, weights.all);
  else if (matched >= Math.max(1, Math.ceil(queryTokens.length * 0.4))) addScore(result, fieldName, weights.partial);
}

export function searchPublications(records: PublicRecord[], publications: Publication[], query: string, limit: number): {
  results: PublicationSearchResult[];
  hasMore: boolean;
} {
  const queryNorm = normalize(query);
  const queryDoi = canonicalSearchDoi(query);
  const isDoiQuery = /^10\.\d{4,9}\/.+/i.test(queryDoi);
  const queryTokens = tokens(query);
  if (!queryNorm || (!isDoiQuery && !queryTokens.length)) return { results: [], hasMore: false };

  const scored: ScoredDocument[] = [];
  for (const document of enrichPublicationDocuments(buildPublicationDocuments(records), publications)) {
    const result: ScoredDocument = { document, score: 0, matchFields: new Set() };
    if (isDoiQuery) {
      if (document.doi !== queryDoi) continue;
      addScore(result, "doi", 1000);
    } else {
      scoreField(result, "title", document.title, queryNorm, queryTokens, { phrase: 180, all: 120, partial: 36 });
      scoreField(
        result,
        "author",
        [document.authorsShort, document.authorsFull].filter(Boolean).join(" "),
        queryNorm,
        queryTokens,
        { phrase: 150, all: 105, partial: 32 }
      );
      scoreField(result, "journal", document.journal ?? "", queryNorm, queryTokens, { phrase: 80, all: 56, partial: 18 });
      scoreField(result, "year", document.year?.toString() ?? "", queryNorm, queryTokens, { phrase: 52, all: 40, partial: 0 });
      scoreField(
        result,
        "keyword",
        Array.from(document.keywords).join(" "),
        queryNorm,
        queryTokens,
        { phrase: 65, all: 46, partial: 14 }
      );
      const combined = [
        document.title,
        document.authorsShort,
        document.authorsFull,
        document.journal,
        document.year,
        ...document.keywords
      ].filter(Boolean).join(" ");
      if (tokenMatchCount(combined, queryTokens) === queryTokens.length) result.score += 24;
      if (!result.score) continue;
    }
    if (document.doi) result.score += 3;
    if (document.title) result.score += 2;
    if (document.authorsShort || document.authorsFull) result.score += 1;
    scored.push(result);
  }

  scored.sort((a, b) =>
    b.score - a.score
      || (b.document.year ?? 0) - (a.document.year ?? 0)
      || a.document.key.localeCompare(b.document.key)
  );
  const selected = scored.slice(0, limit);
  return {
    hasMore: scored.length > limit,
    results: selected.map(({ document, matchFields }) => ({
      doi: document.doi,
      title: document.title,
      authors_short: document.authorsShort ?? document.authorsFull,
      journal: document.journal,
      year: document.year,
      role: roleFor(document),
      match_fields: Array.from(matchFields)
    }))
  };
}
