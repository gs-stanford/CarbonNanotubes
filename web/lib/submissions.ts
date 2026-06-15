import {
  getRuntimeExplorerPayload,
  PROPERTY_BY_KEY,
  type CommunityAcceptedSubmission,
  type ExplorerPayload,
  type Measurement,
  type PlotRecord,
  type PropertyKey,
  type Publication,
  type PublicRecord
} from "@/lib/data";
import { maybeCleanupSubmissionWithOpenAI } from "@/lib/openai-cleanup";
import { hasStoredSubmission, saveAcceptedSubmission } from "@/lib/submission-store";

export type SubmissionPayload = {
  publication?: {
    doi?: unknown;
    title?: unknown;
    year?: unknown;
  };
  sample?: {
    sample_label?: unknown;
    material_family?: unknown;
    form_factor?: unknown;
    cnt_type?: unknown;
    synthesis_method?: unknown;
    postprocessing?: unknown;
  };
  measurements?: Record<string, unknown>;
  conditions?: {
    temperature_C?: unknown;
    atmosphere?: unknown;
    measurement_method?: unknown;
    gauge_length_mm?: unknown;
    strain_rate_s_inv?: unknown;
  };
  provenance?: {
    table_figure_page?: unknown;
    notes?: unknown;
  };
};

type CrossrefAuthor = {
  family?: string;
  given?: string;
  name?: string;
};

type CrossrefMessage = {
  DOI?: string;
  title?: string[];
  author?: CrossrefAuthor[];
  "container-title"?: string[];
  publisher?: string;
  type?: string;
  volume?: string;
  issue?: string;
  page?: string;
  issued?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
};

type DoiMetadata = {
  doi: string;
  title: string;
  authorsShort: string;
  authorsFull: string;
  journal: string;
  publisher: string;
  type: string;
  year: number;
  publishedDate: string;
  issuePages: string;
};

type AcceptedSubmissionResult = {
  payload: ExplorerPayload;
  record: PublicRecord;
  submissionId: string;
  checks: {
    doi: "verified";
    duplicate: "passed";
    acceptedMeasurements: number;
    stored: "postgres" | "file";
    aiCleanup: "completed" | "failed" | "skipped" | "not_configured";
  };
};

export class SubmissionError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDoi(value: unknown): string {
  return cleanString(value)
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/[.。]+$/g, "")
    .trim()
    .toLowerCase();
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const clean = cleanString(value).replace(/,/g, "");
  if (!clean) return null;
  const match = clean.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function datePartsToYear(parts: number[][] | undefined): number | null {
  const year = parts?.[0]?.[0];
  return typeof year === "number" && Number.isFinite(year) ? year : null;
}

function datePartsToIso(parts: number[][] | undefined): string {
  const first = parts?.[0] ?? [];
  const year = first[0];
  if (!year) return "";
  const month = String(first[1] ?? 1).padStart(2, "0");
  const day = String(first[2] ?? 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAuthor(author: CrossrefAuthor): string {
  if (author.name) return author.name;
  return [author.given, author.family].filter(Boolean).join(" ").trim();
}

function formatAuthorsShort(authors: CrossrefAuthor[] | undefined): string {
  const first = authors?.[0];
  const family = first?.family ?? first?.name;
  if (!family) return "";
  return authors && authors.length > 1 ? `${family} et al.` : family;
}

function formatIssuePages(message: CrossrefMessage): string {
  return [message.volume, message.issue, message.page].filter(Boolean).join(", ");
}

async function validateDoi(doi: string): Promise<DoiMetadata> {
  if (!/^10\.\d{4,9}\/\S+$/i.test(doi)) {
    throw new SubmissionError(422, "invalid_doi_format", "DOI must start with a valid 10.xxxx prefix.");
  }

  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CNT-Property-Atlas/0.1 (Stanford University; DOI validation)"
    }
  });

  if (!response.ok) {
    throw new SubmissionError(422, "doi_not_verified", "DOI could not be verified through Crossref.", {
      doi,
      status: response.status
    });
  }

  const json = (await response.json()) as { message?: CrossrefMessage };
  const message = json.message;
  const verifiedDoi = normalizeDoi(message?.DOI ?? doi);
  const title = message?.title?.[0]?.trim() ?? "";
  const year =
    datePartsToYear(message?.published?.["date-parts"]) ??
    datePartsToYear(message?.["published-print"]?.["date-parts"]) ??
    datePartsToYear(message?.["published-online"]?.["date-parts"]) ??
    datePartsToYear(message?.issued?.["date-parts"]);

  if (!verifiedDoi || !title || !year) {
    throw new SubmissionError(422, "doi_metadata_incomplete", "DOI resolved, but required publication metadata was incomplete.", {
      doi,
      verifiedDoi,
      hasTitle: Boolean(title),
      year
    });
  }

  return {
    doi: verifiedDoi,
    title,
    authorsShort: formatAuthorsShort(message?.author),
    authorsFull: (message?.author ?? []).map(formatAuthor).filter(Boolean).join("; "),
    journal: message?.["container-title"]?.[0]?.trim() ?? "",
    publisher: message?.publisher ?? "",
    type: message?.type ?? "journal-article",
    year,
    publishedDate:
      datePartsToIso(message?.published?.["date-parts"]) ||
      datePartsToIso(message?.["published-print"]?.["date-parts"]) ||
      datePartsToIso(message?.["published-online"]?.["date-parts"]) ||
      datePartsToIso(message?.issued?.["date-parts"]),
    issuePages: formatIssuePages(message ?? {})
  };
}

function measurementEntries(payload: SubmissionPayload): Array<{ property: PropertyKey; displayValue: number; canonicalValue: number }> {
  const measurements = payload.measurements ?? {};
  const out: Array<{ property: PropertyKey; displayValue: number; canonicalValue: number }> = [];

  for (const [key, raw] of Object.entries(measurements)) {
    if (!PROPERTY_BY_KEY.has(key as PropertyKey)) continue;
    const displayValue = parseOptionalNumber(raw);
    if (displayValue === null) continue;
    const meta = PROPERTY_BY_KEY.get(key as PropertyKey);
    if (!meta || meta.displayFactor === 0) continue;
    out.push({
      property: key as PropertyKey,
      displayValue,
      canonicalValue: displayValue / meta.displayFactor
    });
  }

  return out;
}

function sameValue(a: number | undefined, b: number): boolean {
  if (typeof a !== "number" || !Number.isFinite(a) || !Number.isFinite(b)) return false;
  const tolerance = Math.max(Math.abs(a), Math.abs(b), 1) * 0.01;
  return Math.abs(a - b) <= tolerance;
}

function duplicateCandidates(records: PlotRecord[], doi: string, payload: SubmissionPayload, measurements: Array<{ property: PropertyKey; displayValue: number }>): PlotRecord[] {
  const family = cleanString(payload.sample?.material_family);
  const form = cleanString(payload.sample?.form_factor);
  const cntType = normalizeText(cleanString(payload.sample?.cnt_type));
  const sampleLabel = normalizeText(cleanString(payload.sample?.sample_label));

  return records.filter((record) => {
    const recordDoi = normalizeDoi(record.doi_verified ?? record.doi_raw ?? "");
    if (recordDoi !== doi) return false;
    if (record.material_family !== family || record.form_factor !== form) return false;
    if (cntType && normalizeText(record.cnt_type) !== cntType) return false;
    if (sampleLabel && normalizeText(record.public_sample_label) === sampleLabel) return true;
    const overlappingValues = measurements.filter((measurement) => sameValue(record.values[measurement.property], measurement.displayValue));
    return overlappingValues.length >= Math.min(2, measurements.length);
  });
}

export function stableId(prefix: string, parts: string[]): string {
  const text = parts.join("|");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function buildRecord(payload: SubmissionPayload, metadata: DoiMetadata, measurements: Array<{ property: PropertyKey }>, recordId: string): PublicRecord {
  const sampleLabel = cleanString(payload.sample?.sample_label) || metadata.title;
  const temperature = parseOptionalNumber(payload.conditions?.temperature_C);
  const gaugeLength = parseOptionalNumber(payload.conditions?.gauge_length_mm);
  const strainRate = parseOptionalNumber(payload.conditions?.strain_rate_s_inv);
  const missingConditions = !cleanString(payload.conditions?.measurement_method) || !cleanString(payload.provenance?.table_figure_page);

  return {
    record_id: recordId,
    record_label: sampleLabel,
    sample_name: sampleLabel,
    public_sample_label: sampleLabel,
    material_family: cleanString(payload.sample?.material_family) || "CNT_or_CNT_hybrid",
    form_factor: cleanString(payload.sample?.form_factor) || "unknown",
    cnt_type: cleanString(payload.sample?.cnt_type) || null,
    synthesis_method: cleanString(payload.sample?.synthesis_method) || null,
    postprocessing: cleanString(payload.sample?.postprocessing) || null,
    public_release_tier: "peer_reviewed_research",
    default_plot_visibility: "default_on",
    public_plot_badge: "DOI-verified research",
    source_publication_type: metadata.type || "journal-article",
    value_extraction_type: "direct_or_source_table",
    source_disclosure: "Community-submitted DOI-verified record accepted by automated duplicate checks.",
    citation_requirement: "Cite original publication and CNT Property Atlas.",
    peer_reviewed_measurement: true,
    contextual_benchmark: false,
    commercial_specsheet_benchmark: false,
    secondary_meta_analysis_record: false,
    missing_conditions: missingConditions,
    unit_inference_review_needed: false,
    cross_form_comparison: false,
    strict_comparison_ready: !missingConditions,
    normalized_comparison_eligible: true,
    exploratory_comparison_eligible: true,
    source_citation_class: "community_doi_verified",
    evidence_tier: "doi_verified_community_submission",
    doi_raw: metadata.doi,
    doi_verified: metadata.doi,
    url_raw: `https://doi.org/${metadata.doi}`,
    publication_validation_status: "verified_crossref_automated_submission",
    publication_title_verified: metadata.title,
    publication_authors_short_verified: metadata.authorsShort,
    publication_authors_full_verified: metadata.authorsFull,
    publication_journal_verified: metadata.journal,
    publication_year_verified: metadata.year,
    publication_published_date_verified: metadata.publishedDate,
    publication_issue_pages_verified: metadata.issuePages,
    condition_temperature_C: temperature,
    condition_atmosphere: cleanString(payload.conditions?.atmosphere) || null,
    measurement_method: cleanString(payload.conditions?.measurement_method) || null,
    gauge_length_mm: gaugeLength,
    strain_rate_s_inv: strainRate,
    provenance_table_figure_page: cleanString(payload.provenance?.table_figure_page) || null,
    secondary_source_doi_raw: null,
    secondary_source_title: null,
    secondary_source_authors_short: null,
    secondary_source_journal: null,
    secondary_source_year: null,
    original_reference_raw: null,
    doi_resolution_status: "verified_crossref",
    doi_resolution_score: 1,
    canonical_record_id: recordId,
    duplicate_group_id: null,
    duplicate_group_size: null,
    duplicate_group_role: null,
    duplicate_of_record_id: null,
    duplicate_match_score: null,
    duplicate_exclusion_reason: null,
    issue_types: missingConditions ? "missing_conditions" : null,
    required_action: null,
    citation_raw: metadata.doi,
    source_file: "community_submissions_v0.json",
    source_sheet: "accepted",
    source_row: measurements.length
  };
}

function buildPublication(metadata: DoiMetadata, publicationId: string): Publication {
  return {
    publication_id: publicationId,
    doi_verified: metadata.doi,
    url_input: `https://doi.org/${metadata.doi}`,
    title_verified: metadata.title,
    authors_short_verified: metadata.authorsShort,
    authors_full_verified: metadata.authorsFull,
    journal_verified: metadata.journal,
    year_verified: metadata.year,
    issue_pages_verified: metadata.issuePages,
    validation_status_enriched: "verified_crossref_automated_submission",
    public_source_type: "peer_reviewed_publication",
    source_record_count_public_v0: 1
  };
}

function buildMeasurements(record: PublicRecord, entries: Array<{ property: PropertyKey; canonicalValue: number }>): Array<Omit<Measurement, "value_display" | "unit_display">> {
  return entries.map((entry) => {
    const meta = PROPERTY_BY_KEY.get(entry.property);
    return {
      measurement_id: stableId("meas", [record.record_id, entry.property, String(entry.canonicalValue)]),
      record_id: record.record_id,
      property: entry.property,
      value_canonical: entry.canonicalValue,
      unit_canonical: meta?.canonicalUnit ?? "",
      public_release_tier: record.public_release_tier,
      public_plot_badge: record.public_plot_badge,
      measurement_warning: record.missing_conditions ? "community_submission_missing_conditions" : "none",
      strict_plot_eligible: record.strict_comparison_ready,
      normalized_plot_eligible: true,
      exploratory_plot_eligible: true
    };
  });
}

export async function acceptSubmission(payload: SubmissionPayload): Promise<AcceptedSubmissionResult> {
  const doi = normalizeDoi(payload.publication?.doi);
  const metadata = await validateDoi(doi);
  const measurements = measurementEntries(payload);
  if (!measurements.length) {
    throw new SubmissionError(422, "missing_measurements", "At least one numeric measurement is required.");
  }

  const currentPayload = await getRuntimeExplorerPayload();
  const duplicates = duplicateCandidates(currentPayload.records, metadata.doi, payload, measurements);
  if (duplicates.length) {
    throw new SubmissionError(409, "duplicate_submission", "A matching DOI/sample/measurement record already exists.", {
      matches: duplicates.slice(0, 5).map((record) => ({
        record_id: record.record_id,
        public_sample_label: record.public_sample_label,
        publication_title_verified: record.publication_title_verified,
        doi_verified: record.doi_verified
      }))
    });
  }

  const recordId = stableId("userrec", [
    metadata.doi,
    cleanString(payload.sample?.sample_label),
    cleanString(payload.sample?.material_family),
    cleanString(payload.sample?.form_factor),
    cleanString(payload.sample?.cnt_type),
    JSON.stringify(measurements.map((measurement) => [measurement.property, measurement.canonicalValue]))
  ]);
  const publicationId = stableId("userpub", [metadata.doi]);
  const submissionId = stableId("sub", [recordId]);
  const record = buildRecord(payload, metadata, measurements, recordId);
  const publication = buildPublication(metadata, publicationId);
  const acceptedSubmission: CommunityAcceptedSubmission = {
    schema_version: "cnt-property-atlas-community-v0.1",
    submission_id: submissionId,
    accepted_at: new Date().toISOString(),
    duplicate_check: {
      checked_against_records: currentPayload.records.length,
      matched_records: []
    },
    record,
    measurements: buildMeasurements(record, measurements),
    publication
  };

  if (await hasStoredSubmission(recordId)) {
    throw new SubmissionError(409, "duplicate_submission", "This accepted submission already exists.", {
      record_id: recordId
    });
  }

  const storage = await saveAcceptedSubmission(acceptedSubmission, payload);
  const cleanup = await maybeCleanupSubmissionWithOpenAI(acceptedSubmission);

  return {
    payload: await getRuntimeExplorerPayload(),
    record,
    submissionId,
    checks: {
      doi: "verified",
      duplicate: "passed",
      acceptedMeasurements: measurements.length,
      stored: storage,
      aiCleanup: cleanup.status
    }
  };
}
