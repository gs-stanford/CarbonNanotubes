import { citationBundleForRecords } from "@/lib/citations";
import { isPropertyKey, PROPERTY_BY_KEY, type Measurement, type PlotRecord, type PropertyKey } from "@/lib/data";
import type { CanonicalRecord, RecordQuery, ReleaseDescriptor } from "@/lib/query-store";
import { assessComparability } from "@/lib/comparability";

export const API_VERSION = "v1";

export class ApiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiInputError";
  }
}

function listParameter(params: URLSearchParams, name: string): string[] | undefined {
  const values = params
    .getAll(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length ? Array.from(new Set(values)).slice(0, 50) : undefined;
}

function stringParameter(params: URLSearchParams, name: string, maxLength = 300): string | undefined {
  const value = params.get(name)?.trim();
  if (!value) return undefined;
  if (value.length > maxLength) throw new ApiInputError(`${name} must be ${maxLength} characters or fewer.`);
  return value;
}

function numberParameter(params: URLSearchParams, name: string, integer = false): number | undefined {
  const raw = params.get(name);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw new ApiInputError(`${name} must be a finite${integer ? " integer" : " number"}.`);
  }
  return value;
}

function booleanParameter(params: URLSearchParams, name: string): boolean | undefined {
  const raw = params.get(name)?.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new ApiInputError(`${name} must be true or false.`);
}

function measurementRangeParameters(params: URLSearchParams) {
  const ranges: Array<{ property: PropertyKey; minValue?: number; maxValue?: number }> = [];
  const seen = new Set<PropertyKey>();
  for (const raw of params.getAll("measurement_filter")) {
    const [propertyRaw, minRaw = "", maxRaw = "", ...extra] = raw.split(":");
    if (extra.length || !isPropertyKey(propertyRaw)) {
      throw new ApiInputError(
        `Invalid measurement_filter '${raw}'. Use property:min:max with a key from /api/v1/properties.`
      );
    }
    if (seen.has(propertyRaw)) throw new ApiInputError(`measurement_filter repeats property ${propertyRaw}.`);
    const minValue = minRaw.trim() === "" ? undefined : Number(minRaw);
    const maxValue = maxRaw.trim() === "" ? undefined : Number(maxRaw);
    if ((minValue !== undefined && !Number.isFinite(minValue)) || (maxValue !== undefined && !Number.isFinite(maxValue))) {
      throw new ApiInputError(`measurement_filter '${raw}' contains a non-finite bound.`);
    }
    if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) {
      throw new ApiInputError(`measurement_filter '${raw}' has a minimum greater than its maximum.`);
    }
    seen.add(propertyRaw);
    ranges.push({ property: propertyRaw, minValue, maxValue });
  }
  return ranges.length ? ranges : undefined;
}

export function parseRecordQuery(
  params: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number; requiredProperties?: PropertyKey[] } = {}
): RecordQuery {
  const defaultLimit = options.defaultLimit ?? 50;
  const maxLimit = options.maxLimit ?? 200;
  const requestedLimit = numberParameter(params, "limit", true) ?? defaultLimit;
  if (requestedLimit < 1 || requestedLimit > maxLimit) {
    throw new ApiInputError(`limit must be between 1 and ${maxLimit}.`);
  }

  const propertyRaw = stringParameter(params, "property", 80);
  if (propertyRaw && !isPropertyKey(propertyRaw)) {
    throw new ApiInputError(`Unknown property: ${propertyRaw}. Use /api/v1/properties for valid keys.`);
  }
  const property = propertyRaw && isPropertyKey(propertyRaw) ? propertyRaw : undefined;
  const minValue = numberParameter(params, "min_value");
  const maxValue = numberParameter(params, "max_value");
  if ((minValue !== undefined || maxValue !== undefined) && !property) {
    throw new ApiInputError("min_value and max_value require property. Values must use that property's canonical SI unit.");
  }
  if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) {
    throw new ApiInputError("min_value cannot exceed max_value.");
  }

  const yearMin = numberParameter(params, "year_min", true);
  const yearMax = numberParameter(params, "year_max", true);
  if (yearMin !== undefined && yearMax !== undefined && yearMin > yearMax) {
    throw new ApiInputError("year_min cannot exceed year_max.");
  }
  const measurementRanges = measurementRangeParameters(params);
  if (property && measurementRanges?.some((range) => range.property === property)) {
    throw new ApiInputError(`Use either property/min_value/max_value or measurement_filter for ${property}, not both.`);
  }
  const gaugeLengthMinMm = numberParameter(params, "gauge_length_min_mm");
  const gaugeLengthMaxMm = numberParameter(params, "gauge_length_max_mm");
  if (gaugeLengthMinMm !== undefined && gaugeLengthMaxMm !== undefined && gaugeLengthMinMm > gaugeLengthMaxMm) {
    throw new ApiInputError("gauge_length_min_mm cannot exceed gauge_length_max_mm.");
  }
  const temperatureMinC = numberParameter(params, "temperature_min_c");
  const temperatureMaxC = numberParameter(params, "temperature_max_c");
  if (temperatureMinC !== undefined && temperatureMaxC !== undefined && temperatureMinC > temperatureMaxC) {
    throw new ApiInputError("temperature_min_c cannot exceed temperature_max_c.");
  }

  return {
    limit: requestedLimit,
    after: stringParameter(params, "after", 120),
    recordIds: listParameter(params, "record_id"),
    property,
    minValue,
    maxValue,
    measurementRanges,
    requiredProperties: options.requiredProperties,
    materialFamilies: listParameter(params, "material_family"),
    formFactors: listParameter(params, "form_factor"),
    releaseTiers: listParameter(params, "release_tier"),
    doi: stringParameter(params, "doi", 300),
    author: stringParameter(params, "author"),
    journal: stringParameter(params, "journal"),
    yearMin,
    yearMax,
    gaugeLengthMinMm,
    gaugeLengthMaxMm,
    temperatureMinC,
    temperatureMaxC,
    provenance: listParameter(params, "provenance"),
    verification: listParameter(params, "verification"),
    q: stringParameter(params, "q"),
    strictReady: booleanParameter(params, "strict_ready"),
    peerReviewed: booleanParameter(params, "peer_reviewed"),
    normalizedEligible: booleanParameter(params, "normalized_eligible")
  };
}

function serializeMeasurement(measurement: Measurement) {
  const meta = PROPERTY_BY_KEY.get(measurement.property);
  return {
    measurement_id: measurement.measurement_id,
    property: measurement.property,
    property_label: meta?.label ?? measurement.property,
    value: measurement.value_canonical,
    unit: measurement.unit_canonical,
    display_value: measurement.value_display,
    display_unit: measurement.unit_display,
    reported_value: measurement.reported_value,
    reported_unit: measurement.reported_unit,
    statistic_type: measurement.statistic_type,
    uncertainty: {
      type: measurement.uncertainty_type,
      value_reported: measurement.uncertainty_value_reported,
      value_canonical: measurement.uncertainty_value_canonical
    },
    sample_size_n: measurement.sample_size_n,
    test_standard: measurement.test_standard,
    specimen_id: measurement.specimen_id,
    sample_batch_id: measurement.sample_batch_id,
    specimen_linkage: measurement.specimen_linkage,
    measurement_direction: measurement.measurement_direction,
    normalization: {
      basis: measurement.normalization_basis,
      density_basis: measurement.density_basis,
      density_value_kg_m3: measurement.density_value_kg_m3,
      density_source_locator: measurement.density_source_locator
    },
    cross_section_method: measurement.cross_section_method,
    value_bound_type: measurement.value_bound_type,
    derivation: {
      formula: measurement.derivation_formula,
      inputs_json: measurement.derivation_inputs_json
    },
    reported_or_derived: measurement.reported_or_derived,
    source_locator: measurement.source_locator,
    extraction_method: measurement.extraction_method,
    warning: measurement.measurement_warning,
    eligibility: {
      strict: measurement.strict_plot_eligible,
      normalized: measurement.normalized_plot_eligible,
      exploratory: measurement.exploratory_plot_eligible
    }
  };
}

function publicationFor(record: PlotRecord, canonical: CanonicalRecord) {
  const publication = canonical.publication;
  return {
    doi: record.doi_verified ?? record.doi_raw,
    title: publication?.title_verified ?? record.publication_title_verified,
    authors_short: publication?.authors_short_verified ?? record.publication_authors_short_verified,
    authors_full: publication?.authors_full_verified ?? record.publication_authors_full_verified,
    journal: publication?.journal_verified ?? record.publication_journal_verified,
    year: publication?.year_verified ?? record.publication_year_verified,
    issue_pages: publication?.issue_pages_verified ?? record.publication_issue_pages_verified,
    validation_status: publication?.validation_status_enriched ?? record.publication_validation_status
  };
}

export function serializeCanonicalRecord(canonical: CanonicalRecord) {
  const { record } = canonical;
  return {
    record_id: record.record_id,
    label: record.public_sample_label || record.record_label,
    sample: {
      name: record.sample_name,
      material_family: record.material_family,
      form_factor: record.form_factor,
      cnt_type: record.cnt_type,
      synthesis_method: record.synthesis_method,
      postprocessing: record.postprocessing,
      specimen_id: record.specimen_id,
      sample_batch_id: record.sample_batch_id,
      specimen_linkage: record.specimen_linkage,
      density_basis: record.density_basis,
      cross_section_method: record.cross_section_method,
      normalization_basis: record.normalization_basis,
      value_bound_type: record.value_bound_type
    },
    publication: publicationFor(record, canonical),
    measurements: canonical.measurements.map(serializeMeasurement),
    conditions: {
      temperature_c: record.condition_temperature_C,
      atmosphere: record.condition_atmosphere,
      measurement_method: record.measurement_method,
      test_standard: record.test_standard,
      gauge_length_mm: record.gauge_length_mm,
      strain_rate_s_inv: record.strain_rate_s_inv,
      measurement_direction: record.measurement_direction
    },
    provenance: {
      dataset: record.dataset_provenance,
      detail: record.dataset_provenance_detail,
      primary_source_verification_status: record.primary_source_verification_status,
      extraction_type: record.value_extraction_type,
      source_location: record.provenance_table_figure_page,
      source_citation_class: record.source_citation_class,
      compilation_source: record.compilation_source_doi_raw
        ? {
            doi: record.compilation_source_doi_raw,
            title: record.compilation_source_title,
            authors_short: record.compilation_source_authors_short,
            journal: record.compilation_source_journal,
            year: record.compilation_source_year
          }
        : null
    },
    comparison: {
      model_version: record.comparability_model_version,
      legacy_strict_ready_deprecated: record.strict_comparison_ready,
      normalized_eligible: record.normalized_comparison_eligible,
      exploratory_eligible: record.exploratory_comparison_eligible,
      cross_form: record.cross_form_comparison
    },
    source_class: {
      release_tier: record.public_release_tier,
      peer_reviewed_measurement: record.peer_reviewed_measurement,
      contextual_benchmark: record.contextual_benchmark,
      commercial_specsheet_benchmark: record.commercial_specsheet_benchmark,
      author_curated_compilation_record: record.author_curated_compilation_record
    },
    quality_flags: {
      missing_conditions: record.missing_conditions,
      unit_inference_review_needed: record.unit_inference_review_needed,
      measurement_warnings: record.measurementWarnings
    },
    citations: citationBundleForRecords([record])
  };
}

function measurementFor(record: CanonicalRecord, property: PropertyKey) {
  const measurement = record.measurements.find((candidate) => candidate.property === property);
  if (!measurement) throw new Error(`Record ${record.record.record_id} is missing required property ${property}.`);
  return serializeMeasurement(measurement);
}

export function serializePlotPoint(record: CanonicalRecord, x: PropertyKey, y: PropertyKey) {
  return {
    record_id: record.record.record_id,
    label: record.record.public_sample_label || record.record.record_label,
    material_family: record.record.material_family,
    form_factor: record.record.form_factor,
    cnt_type: record.record.cnt_type,
    publication: publicationFor(record.record, record),
    provenance: {
      dataset: record.record.dataset_provenance,
      primary_source_verification_status: record.record.primary_source_verification_status,
      source_location: record.record.provenance_table_figure_page
    },
    x: measurementFor(record, x),
    y: measurementFor(record, y),
    comparability: assessComparability(record.record, x, y, "scatter")
  };
}

export function apiMeta(release: ReleaseDescriptor) {
  return {
    api_version: API_VERSION,
    generated_at: new Date().toISOString(),
    release
  };
}

export const PUBLIC_API_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-CPT-Citation-Policy",
  "X-CPT-Citation-Policy": "original-sources-plus-atlas"
};
