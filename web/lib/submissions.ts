import {
  getRuntimeValidationPayload,
  PROPERTY_BY_KEY,
  type CommunityAcceptedSubmission,
  type Measurement,
  type PlotRecord,
  type PropertyKey,
  type Publication,
  type PublicRecord
} from "@/lib/data";
import { hasDatabaseUrl } from "@/lib/db";
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
    specimen_id?: unknown;
    sample_batch_id?: unknown;
    specimen_linkage?: unknown;
    density_basis?: unknown;
    cross_section_method?: unknown;
  };
  measurements?: Record<string, unknown>;
  conditions?: {
    temperature_C?: unknown;
    atmosphere?: unknown;
    measurement_method?: unknown;
    test_standard?: unknown;
    measurement_direction?: unknown;
    gauge_length_mm?: unknown;
    strain_rate_s_inv?: unknown;
  };
  provenance?: {
    table_figure_page?: unknown;
    extraction_method?: unknown;
    notes?: unknown;
  };
};

type SubmissionMeasurement = {
  property: PropertyKey;
  displayValue: number;
  canonicalValue: number;
  statisticType: string;
  uncertaintyType: string;
  uncertaintyDisplayValue: number | null;
  uncertaintyCanonicalValue: number | null;
  sampleSizeN: number | null;
  valueBoundType: string;
  normalizationBasis: string;
};

const STATISTIC_TYPES = new Set(["individual", "mean", "median", "best_specimen", "maximum", "minimum", "range_endpoint", "unspecified"]);
const UNCERTAINTY_TYPES = new Set(["standard_deviation", "standard_error", "confidence_interval", "range", "reported_unspecified", "not_reported"]);
const VALUE_BOUND_TYPES = new Set(["point_estimate", "upper_bound", "lower_bound", "range_midpoint", "range_endpoint", "unspecified"]);
const NORMALIZATION_BASES = new Set(["direct_mass_specific_linear_density", "directly_reported_mass_specific", "derived_from_density", "derived_from_linear_density", "not_applicable", "unknown"]);
const SUBMITTER_LINKAGES = new Set(["same_specimen_submitter_claimed", "same_sample_batch_submitter_claimed", "mixed_specimens", "unknown"]);
const DENSITY_DERIVED_NUMERATOR: Partial<Record<PropertyKey, PropertyKey>> = {
  specific_strength: "tensile_strength",
  specific_modulus: "initial_modulus",
  specific_electrical_conductivity: "electrical_conductivity",
  specific_thermal_conductivity: "thermal_conductivity"
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
  record: PublicRecord;
  submissionId: string;
  review: {
    status: "accepted";
    publicVisible: false;
    nextAction: "curator_review";
  };
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

function choice(value: unknown, allowed: Set<string>, fallback: string): string {
  const clean = cleanString(value);
  return allowed.has(clean) ? clean : fallback;
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

function measurementEntries(payload: SubmissionPayload): SubmissionMeasurement[] {
  const measurements = payload.measurements ?? {};
  const out: SubmissionMeasurement[] = [];

  for (const [key, raw] of Object.entries(measurements)) {
    if (!PROPERTY_BY_KEY.has(key as PropertyKey)) continue;
    const structured = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : { value: raw };
    const displayValue = parseOptionalNumber(structured.value);
    if (displayValue === null) continue;
    if (displayValue <= 0) {
      throw new SubmissionError(422, "invalid_measurement", `${key} must be greater than zero.`);
    }
    const meta = PROPERTY_BY_KEY.get(key as PropertyKey);
    if (!meta || meta.displayFactor === 0) continue;
    const uncertaintyDisplayValue = parseOptionalNumber(structured.uncertainty_value);
    if (uncertaintyDisplayValue !== null && uncertaintyDisplayValue < 0) {
      throw new SubmissionError(422, "invalid_uncertainty", `${key} uncertainty must be zero or greater.`);
    }
    const sampleSize = parseOptionalNumber(structured.sample_size_n);
    if (sampleSize !== null && (!Number.isInteger(sampleSize) || sampleSize < 1)) {
      throw new SubmissionError(422, "invalid_sample_size", `${key} sample_size_n must be a positive integer.`);
    }
    const requestedUncertaintyType = choice(
      structured.uncertainty_type,
      UNCERTAINTY_TYPES,
      uncertaintyDisplayValue === null ? "not_reported" : "reported_unspecified"
    );
    if (uncertaintyDisplayValue === null && requestedUncertaintyType !== "not_reported") {
      throw new SubmissionError(422, "missing_uncertainty_value", `${key} declares an uncertainty type but no uncertainty value.`);
    }
    const uncertaintyType = uncertaintyDisplayValue !== null && requestedUncertaintyType === "not_reported"
      ? "reported_unspecified"
      : requestedUncertaintyType;
    out.push({
      property: key as PropertyKey,
      displayValue,
      canonicalValue: displayValue / meta.displayFactor,
      statisticType: choice(structured.statistic_type, STATISTIC_TYPES, "unspecified"),
      uncertaintyType,
      uncertaintyDisplayValue,
      uncertaintyCanonicalValue: uncertaintyDisplayValue === null ? null : uncertaintyDisplayValue / meta.displayFactor,
      sampleSizeN: sampleSize,
      valueBoundType: choice(structured.value_bound_type, VALUE_BOUND_TYPES, "unspecified"),
      normalizationBasis: choice(
        structured.normalization_basis,
        NORMALIZATION_BASES,
        key.startsWith("specific_") ? "unknown" : "not_applicable"
      )
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

function buildRecord(payload: SubmissionPayload, metadata: DoiMetadata, measurements: SubmissionMeasurement[], recordId: string): PublicRecord {
  const sampleLabel = cleanString(payload.sample?.sample_label) || metadata.title;
  const temperature = parseOptionalNumber(payload.conditions?.temperature_C);
  const gaugeLength = parseOptionalNumber(payload.conditions?.gauge_length_mm);
  const strainRate = parseOptionalNumber(payload.conditions?.strain_rate_s_inv);
  const method = cleanString(payload.conditions?.measurement_method);
  const testStandard = cleanString(payload.conditions?.test_standard);
  const missingConditions = (!method && !testStandard) || !cleanString(payload.provenance?.table_figure_page);
  const submittedLinkage = choice(payload.sample?.specimen_linkage, SUBMITTER_LINKAGES, "unknown");
  const specimenLinkage = measurements.length === 1 ? "not_applicable_single_property" : submittedLinkage;
  const statisticTypes = new Set(measurements.map((measurement) => measurement.statisticType));
  const sampleSizes = new Set(measurements.map((measurement) => measurement.sampleSizeN).filter((value) => value !== null));
  const normalizationBases = new Set(measurements.map((measurement) => measurement.normalizationBasis));
  const boundTypes = new Set(measurements.map((measurement) => measurement.valueBoundType));
  const linkagePending = measurements.length > 1 && !["mixed_specimens"].includes(specimenLinkage);

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
    dataset_provenance: "community_submission",
    dataset_provenance_detail: "community_submission",
    primary_source_verification_status: "submitter_claimed_pending_curator_check",
    value_extraction_type: "direct_or_source_table",
    source_disclosure: "Community-submitted DOI-verified record accepted by automated duplicate checks.",
    citation_requirement: "Cite the original publication and Carbon Property Tables.",
    peer_reviewed_measurement: true,
    contextual_benchmark: false,
    commercial_specsheet_benchmark: false,
    author_curated_compilation_record: false,
    missing_conditions: missingConditions,
    unit_inference_review_needed: false,
    cross_form_comparison: false,
    strict_comparison_ready: false,
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
    measurement_method: method || null,
    test_standard: testStandard || null,
    gauge_length_mm: gaugeLength,
    strain_rate_s_inv: strainRate,
    specimen_id: cleanString(payload.sample?.specimen_id) || null,
    sample_batch_id: cleanString(payload.sample?.sample_batch_id) || null,
    specimen_linkage: specimenLinkage,
    measurement_direction: cleanString(payload.conditions?.measurement_direction) || null,
    density_basis: cleanString(payload.sample?.density_basis) || "unknown",
    cross_section_method: cleanString(payload.sample?.cross_section_method) || null,
    normalization_basis: normalizationBases.size === 1 ? [...normalizationBases][0] : "mixed",
    value_bound_type: boundTypes.size === 1 ? [...boundTypes][0] : "mixed",
    statistic_type: statisticTypes.size === 1 ? [...statisticTypes][0] : "mixed",
    sample_size_n: sampleSizes.size === 1 ? [...sampleSizes][0] : null,
    comparability_model_version: "cpt-property-pair-v1",
    provenance_table_figure_page: cleanString(payload.provenance?.table_figure_page) || null,
    compilation_source_doi_raw: null,
    compilation_source_title: null,
    compilation_source_authors_short: null,
    compilation_source_journal: null,
    compilation_source_year: null,
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
    issue_types: [missingConditions ? "missing_conditions" : "", linkagePending ? "curator_verify_specimen_linkage" : ""].filter(Boolean).join(";") || null,
    required_action: "curator_verify_values_provenance_and_specimen_linkage",
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

function buildMeasurements(record: PublicRecord, entries: SubmissionMeasurement[]): Array<Omit<Measurement, "value_display" | "unit_display">> {
  const densityValue = entries.find((entry) => entry.property === "density")?.canonicalValue ?? null;
  return entries.map((entry) => {
    const meta = PROPERTY_BY_KEY.get(entry.property);
    const densityDerived = entry.normalizationBasis === "derived_from_density";
    const numeratorProperty = DENSITY_DERIVED_NUMERATOR[entry.property];
    const numeratorValue = numeratorProperty
      ? entries.find((candidate) => candidate.property === numeratorProperty)?.canonicalValue ?? null
      : null;
    const formula = densityDerived
      ? entry.property === "specific_volume"
        ? "specific_volume = 1 / density"
        : numeratorProperty
          ? `${entry.property} = ${numeratorProperty} / density`
          : null
      : null;
    const derivationInputs = densityDerived && densityValue !== null
      ? entry.property === "specific_volume"
        ? { density_kg_m3: densityValue }
        : numeratorProperty && numeratorValue !== null
          ? { [numeratorProperty]: numeratorValue, density_kg_m3: densityValue }
          : null
      : null;
    return {
      measurement_id: stableId("meas", [record.record_id, entry.property, String(entry.canonicalValue)]),
      record_id: record.record_id,
      property: entry.property,
      value_canonical: entry.canonicalValue,
      unit_canonical: meta?.canonicalUnit ?? "",
      reported_value: entry.displayValue,
      reported_unit: meta?.displayUnit ?? null,
      statistic_type: entry.statisticType,
      uncertainty_type: entry.uncertaintyType,
      uncertainty_value_reported: entry.uncertaintyDisplayValue,
      uncertainty_value_canonical: entry.uncertaintyCanonicalValue,
      sample_size_n: entry.sampleSizeN,
      test_standard: record.test_standard,
      specimen_id: record.specimen_id,
      sample_batch_id: record.sample_batch_id,
      specimen_linkage: record.specimen_linkage,
      measurement_set_id: stableId("mset", [record.record_id]),
      measurement_direction: record.measurement_direction,
      density_basis: densityDerived ? record.density_basis : "not_applicable",
      density_value_kg_m3: densityDerived ? densityValue : null,
      density_source_locator: densityDerived ? record.provenance_table_figure_page : null,
      cross_section_method: record.cross_section_method,
      normalization_basis: entry.normalizationBasis,
      value_bound_type: entry.valueBoundType,
      derivation_formula: formula,
      derivation_inputs_json: derivationInputs ? JSON.stringify(derivationInputs) : null,
      reported_or_derived: densityDerived ? "derived" : "reported",
      source_locator: record.provenance_table_figure_page,
      extraction_method: "submitter_entered_from_source",
      public_release_tier: record.public_release_tier,
      public_plot_badge: record.public_plot_badge,
      measurement_warning: record.missing_conditions ? "community_submission_missing_conditions" : "none",
      strict_plot_eligible: false,
      normalized_plot_eligible: true,
      exploratory_plot_eligible: true
    };
  });
}

export async function acceptSubmission(payload: SubmissionPayload): Promise<AcceptedSubmissionResult> {
  if (process.env.NODE_ENV === "production" && !hasDatabaseUrl()) {
    throw new SubmissionError(
      503,
      "submission_storage_unavailable",
      "Submissions are temporarily unavailable while persistent database storage is being configured."
    );
  }
  const doi = normalizeDoi(payload.publication?.doi);
  const metadata = await validateDoi(doi);
  const measurements = measurementEntries(payload);
  if (!measurements.length) {
    throw new SubmissionError(422, "missing_measurements", "At least one numeric measurement is required.");
  }
  const specimenLinkage = choice(payload.sample?.specimen_linkage, SUBMITTER_LINKAGES, "unknown");
  if (measurements.length > 1 && specimenLinkage === "same_specimen_submitter_claimed" && !cleanString(payload.sample?.specimen_id)) {
    throw new SubmissionError(422, "missing_specimen_id", "A same-specimen claim requires a specimen identifier from the publication.");
  }
  if (measurements.length > 1 && specimenLinkage === "same_sample_batch_submitter_claimed" && !cleanString(payload.sample?.sample_batch_id)) {
    throw new SubmissionError(422, "missing_sample_batch_id", "A same-batch claim requires a sample batch identifier from the publication.");
  }
  if (measurements.some((measurement) => measurement.normalizationBasis === "derived_from_density")) {
    const density = measurements.find((measurement) => measurement.property === "density");
    if (!density || !cleanString(payload.sample?.density_basis) || cleanString(payload.sample?.density_basis) === "unknown") {
      throw new SubmissionError(
        422,
        "incomplete_density_derivation",
        "Density-derived specific properties require the density value and its density basis."
      );
    }
    for (const measurement of measurements.filter((entry) => entry.normalizationBasis === "derived_from_density")) {
      if (measurement.property === "specific_volume") {
        const recomputed = 1 / density.canonicalValue;
        const relativeDifference = Math.abs(recomputed - measurement.canonicalValue) / Math.max(Math.abs(recomputed), 1e-30);
        if (relativeDifference > 0.05) {
          throw new SubmissionError(422, "density_derivation_mismatch", "specific_volume does not match the submitted density within 5%.", {
            submitted: measurement.canonicalValue,
            recomputed,
            relativeDifference
          });
        }
        continue;
      }
      const numeratorProperty = DENSITY_DERIVED_NUMERATOR[measurement.property];
      const numerator = numeratorProperty
        ? measurements.find((entry) => entry.property === numeratorProperty)
        : null;
      if (!numeratorProperty || !numerator) {
        throw new SubmissionError(
          422,
          "incomplete_density_derivation",
          `${measurement.property} marked density-derived requires ${numeratorProperty ?? "its numerator property"} in the same submission.`
        );
      }
      const recomputed = numerator.canonicalValue / density.canonicalValue;
      const relativeDifference = Math.abs(recomputed - measurement.canonicalValue) / Math.max(Math.abs(recomputed), 1e-30);
      if (relativeDifference > 0.05) {
        throw new SubmissionError(422, "density_derivation_mismatch", `${measurement.property} does not match the submitted numerator and density within 5%.`, {
          submitted: measurement.canonicalValue,
          recomputed,
          relativeDifference
        });
      }
    }
  }
  if (measurements.some((measurement) => measurement.normalizationBasis === "derived_from_linear_density")) {
    throw new SubmissionError(
      422,
      "unsupported_linear_density_derivation",
      "Linear-density-derived submissions are not accepted until the corresponding force or stiffness numerator is captured as a canonical primitive. Use direct_mass_specific_linear_density only when the source directly reports the mass-specific value."
    );
  }

  const currentPayload = await getRuntimeValidationPayload();
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
    schema_version: "carbon-property-tables-community-v0.2",
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
    record,
    submissionId,
    review: {
      status: "accepted",
      publicVisible: false,
      nextAction: "curator_review"
    },
    checks: {
      doi: "verified",
      duplicate: "passed",
      acceptedMeasurements: measurements.length,
      stored: storage,
      aiCleanup: cleanup.status
    }
  };
}
