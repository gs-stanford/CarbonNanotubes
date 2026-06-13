import fs from "node:fs";
import path from "node:path";

export type PropertyKey =
  | "density"
  | "specific_volume"
  | "diameter"
  | "linear_density"
  | "specific_strength"
  | "tensile_strength"
  | "specific_modulus"
  | "initial_modulus"
  | "breaking_strain"
  | "work_of_rupture"
  | "electrical_conductivity"
  | "specific_electrical_conductivity"
  | "thermal_conductivity"
  | "specific_thermal_conductivity"
  | "ampacity"
  | "g_d_ratio";

export type ScaleMode = "linear" | "log";

export type PropertyMeta = {
  key: PropertyKey;
  label: string;
  canonicalUnit: string;
  displayUnit: string;
  displayFactor: number;
  defaultScale: ScaleMode;
  precision: number;
  recordsWithValue: number;
};

export type PublicRecord = {
  record_id: string;
  record_label: string;
  sample_name: string;
  public_sample_label: string;
  material_family: string;
  form_factor: string;
  cnt_type: string | null;
  synthesis_method: string | null;
  postprocessing: string | null;
  public_release_tier: string;
  default_plot_visibility: string;
  public_plot_badge: string;
  source_publication_type: string;
  value_extraction_type: string;
  source_disclosure: string;
  citation_requirement: string;
  peer_reviewed_measurement: boolean;
  contextual_benchmark: boolean;
  commercial_specsheet_benchmark: boolean;
  secondary_meta_analysis_record: boolean;
  missing_conditions: boolean;
  unit_inference_review_needed: boolean;
  cross_form_comparison: boolean;
  strict_comparison_ready: boolean;
  normalized_comparison_eligible: boolean;
  exploratory_comparison_eligible: boolean;
  source_citation_class: string;
  evidence_tier: string;
  doi_raw: string | null;
  doi_verified: string | null;
  url_raw: string | null;
  publication_validation_status: string;
  publication_title_verified: string | null;
  publication_authors_short_verified: string | null;
  publication_authors_full_verified: string | null;
  publication_journal_verified: string | null;
  publication_year_verified: number | null;
  publication_published_date_verified: string | null;
  publication_issue_pages_verified: string | null;
  condition_temperature_C: number | null;
  condition_atmosphere: string | null;
  measurement_method: string | null;
  gauge_length_mm: number | null;
  strain_rate_s_inv: number | null;
  provenance_table_figure_page: string | null;
  secondary_source_doi_raw: string | null;
  secondary_source_title: string | null;
  secondary_source_authors_short: string | null;
  secondary_source_journal: string | null;
  secondary_source_year: number | null;
  original_reference_raw: string | null;
  doi_resolution_status: string | null;
  doi_resolution_score: number | null;
  canonical_record_id: string | null;
  duplicate_group_id: string | null;
  duplicate_group_size: number | null;
  duplicate_group_role: string | null;
  duplicate_of_record_id: string | null;
  duplicate_match_score: number | null;
  duplicate_exclusion_reason: string | null;
  issue_types: string | null;
  required_action: string | null;
  citation_raw: string | null;
  source_file: string;
  source_sheet: string;
  source_row: number | null;
};

export type Measurement = {
  measurement_id: string;
  record_id: string;
  property: PropertyKey;
  value_canonical: number;
  unit_canonical: string;
  value_display: number;
  unit_display: string;
  public_release_tier: string;
  public_plot_badge: string;
  measurement_warning: string;
  strict_plot_eligible: boolean;
  normalized_plot_eligible: boolean;
  exploratory_plot_eligible: boolean;
};

export type PlotRecord = PublicRecord & {
  values: Partial<Record<PropertyKey, number>>;
  canonicalValues: Partial<Record<PropertyKey, number>>;
  measurementWarnings: Partial<Record<PropertyKey, string>>;
};

export type Publication = {
  publication_id: string;
  doi_verified: string | null;
  url_input: string | null;
  title_verified: string | null;
  authors_short_verified: string | null;
  authors_full_verified: string | null;
  journal_verified: string | null;
  year_verified: number | null;
  issue_pages_verified: string | null;
  validation_status_enriched: string;
  public_source_type: string;
  source_record_count_public_v0: number;
};

export type ExplorerPayload = {
  properties: PropertyMeta[];
  records: PlotRecord[];
  measurements: Measurement[];
  publications: Publication[];
  summary: {
    recordCount: number;
    measurementCount: number;
    primaryRecords: number;
    benchmarkRecords: number;
    peerReviewedResearchRecords: number;
    peerReviewedComparatorRecords: number;
    commercialComparatorRecords: number;
    secondaryExtractedRecords: number;
    strictReadyRecords: number;
    minYear: number | null;
    maxYear: number | null;
  };
};

export type CommunityAcceptedSubmission = {
  schema_version: "cnt-property-atlas-community-v0.1";
  accepted_at: string;
  duplicate_check: {
    checked_against_records: number;
    matched_records: string[];
  };
  record: PublicRecord;
  measurements: Array<Omit<Measurement, "value_display" | "unit_display">>;
  publication: Publication;
};

export const PROPERTY_META_BASE: Omit<PropertyMeta, "recordsWithValue">[] = [
  {
    key: "density",
    label: "Density",
    canonicalUnit: "kg/m^3",
    displayUnit: "kg m⁻³",
    displayFactor: 1,
    defaultScale: "log",
    precision: 0
  },
  {
    key: "specific_volume",
    label: "Specific volume",
    canonicalUnit: "m^3/kg",
    displayUnit: "cm³ g⁻¹",
    displayFactor: 1000,
    defaultScale: "log",
    precision: 2
  },
  {
    key: "diameter",
    label: "Diameter",
    canonicalUnit: "m",
    displayUnit: "µm",
    displayFactor: 1e6,
    defaultScale: "log",
    precision: 2
  },
  {
    key: "linear_density",
    label: "Linear density",
    canonicalUnit: "kg/m",
    displayUnit: "tex",
    displayFactor: 1e6,
    defaultScale: "log",
    precision: 3
  },
  {
    key: "specific_strength",
    label: "Specific strength",
    canonicalUnit: "N m/kg",
    displayUnit: "N tex⁻¹",
    displayFactor: 1e-6,
    defaultScale: "log",
    precision: 2
  },
  {
    key: "tensile_strength",
    label: "Tensile strength",
    canonicalUnit: "Pa",
    displayUnit: "GPa",
    displayFactor: 1e-9,
    defaultScale: "log",
    precision: 2
  },
  {
    key: "specific_modulus",
    label: "Specific modulus",
    canonicalUnit: "N m/kg",
    displayUnit: "N tex⁻¹",
    displayFactor: 1e-6,
    defaultScale: "log",
    precision: 1
  },
  {
    key: "initial_modulus",
    label: "Initial modulus",
    canonicalUnit: "Pa",
    displayUnit: "GPa",
    displayFactor: 1e-9,
    defaultScale: "log",
    precision: 1
  },
  {
    key: "breaking_strain",
    label: "Breaking strain",
    canonicalUnit: "1",
    displayUnit: "%",
    displayFactor: 100,
    defaultScale: "linear",
    precision: 1
  },
  {
    key: "work_of_rupture",
    label: "Work of rupture",
    canonicalUnit: "J/kg",
    displayUnit: "J g⁻¹",
    displayFactor: 1e-3,
    defaultScale: "log",
    precision: 1
  },
  {
    key: "electrical_conductivity",
    label: "Electrical conductivity",
    canonicalUnit: "S/m",
    displayUnit: "MS m⁻¹",
    displayFactor: 1e-6,
    defaultScale: "log",
    precision: 2
  },
  {
    key: "specific_electrical_conductivity",
    label: "Specific electrical conductivity",
    canonicalUnit: "S m^2/kg",
    displayUnit: "kS m² kg⁻¹",
    displayFactor: 1e-3,
    defaultScale: "log",
    precision: 2
  },
  {
    key: "thermal_conductivity",
    label: "Thermal conductivity",
    canonicalUnit: "W/m/K",
    displayUnit: "W m⁻¹ K⁻¹",
    displayFactor: 1,
    defaultScale: "log",
    precision: 1
  },
  {
    key: "specific_thermal_conductivity",
    label: "Specific thermal conductivity",
    canonicalUnit: "W m^2/K/kg",
    displayUnit: "W m² K⁻¹ kg⁻¹",
    displayFactor: 1,
    defaultScale: "log",
    precision: 3
  },
  {
    key: "ampacity",
    label: "Ampacity",
    canonicalUnit: "A/m^2",
    displayUnit: "MA cm⁻²",
    displayFactor: 1e-10,
    defaultScale: "log",
    precision: 2
  },
  {
    key: "g_d_ratio",
    label: "G:D ratio",
    canonicalUnit: "ratio",
    displayUnit: "ratio",
    displayFactor: 1,
    defaultScale: "linear",
    precision: 2
  }
];

export const PROPERTY_BY_KEY = new Map(PROPERTY_META_BASE.map((meta) => [meta.key, meta]));

export function dataDir(): string {
  const candidates = [
    path.join(process.cwd(), "data", "public"),
    path.join(process.cwd(), "..", "data", "public")
  ];
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, "public_records_v0.csv")));
  if (!found) {
    throw new Error(`Public data directory not found. Checked: ${candidates.join(", ")}`);
  }
  return found;
}

export function communitySubmissionsFile(): string {
  return path.join(dataDir(), "community_submissions_v0.json");
}

export function readCommunitySubmissions(): CommunityAcceptedSubmission[] {
  const file = communitySubmissionsFile();
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CommunityAcceptedSubmission => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<CommunityAcceptedSubmission>;
      return Boolean(candidate.record?.record_id && Array.isArray(candidate.measurements) && candidate.publication?.publication_id);
    });
  } catch {
    return [];
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((items) => items.some((item) => item.length > 0));
}

function readCsv(fileName: string): Record<string, string>[] {
  const file = path.join(dataDir(), fileName);
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const headers = rows[0] ?? [];
  return rows.slice(1).map((row) => {
    const out: Record<string, string> = {};
    headers.forEach((header, index) => {
      out[header] = row[index] ?? "";
    });
    return out;
  });
}

function nullable(value: string | undefined): string | null {
  const clean = (value ?? "").trim();
  return clean.length > 0 && clean.toLowerCase() !== "nan" ? clean : null;
}

function num(value: string | undefined): number | null {
  const clean = nullable(value);
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "true";
}

function recordFromRow(row: Record<string, string>): PublicRecord {
  return {
    record_id: row.record_id,
    record_label: nullable(row.record_label) ?? nullable(row.sample_name) ?? row.record_id,
    sample_name: nullable(row.sample_name) ?? nullable(row.record_label) ?? row.record_id,
    public_sample_label: nullable(row.public_sample_label) ?? nullable(row.sample_name) ?? nullable(row.record_label) ?? row.record_id,
    material_family: nullable(row.material_family) ?? "unknown",
    form_factor: nullable(row.form_factor) ?? "unknown",
    cnt_type: nullable(row.cnt_type),
    synthesis_method: nullable(row.synthesis_method),
    postprocessing: nullable(row.postprocessing),
    public_release_tier: nullable(row.public_release_tier) ?? "unknown",
    default_plot_visibility: nullable(row.default_plot_visibility) ?? "default_on",
    public_plot_badge: nullable(row.public_plot_badge) ?? "Record",
    source_publication_type: nullable(row.source_publication_type) ?? "unknown",
    value_extraction_type: nullable(row.value_extraction_type) ?? "direct_or_source_table",
    source_disclosure: nullable(row.source_disclosure) ?? "",
    citation_requirement: nullable(row.citation_requirement) ?? "",
    peer_reviewed_measurement: bool(row.peer_reviewed_measurement),
    contextual_benchmark: bool(row.contextual_benchmark),
    commercial_specsheet_benchmark: bool(row.commercial_specsheet_benchmark),
    secondary_meta_analysis_record: bool(row.secondary_meta_analysis_record),
    missing_conditions: bool(row.missing_conditions),
    unit_inference_review_needed: bool(row.unit_inference_review_needed),
    cross_form_comparison: bool(row.cross_form_comparison),
    strict_comparison_ready: bool(row.strict_comparison_ready),
    normalized_comparison_eligible: bool(row.normalized_comparison_eligible),
    exploratory_comparison_eligible: bool(row.exploratory_comparison_eligible),
    source_citation_class: nullable(row.source_citation_class) ?? "unknown",
    evidence_tier: nullable(row.evidence_tier) ?? "unknown",
    doi_raw: nullable(row.doi_raw),
    doi_verified: nullable(row.doi_verified),
    url_raw: nullable(row.url_raw),
    publication_validation_status: nullable(row.publication_validation_status) ?? "unknown",
    publication_title_verified: nullable(row.publication_title_verified),
    publication_authors_short_verified: nullable(row.publication_authors_short_verified),
    publication_authors_full_verified: nullable(row.publication_authors_full_verified),
    publication_journal_verified: nullable(row.publication_journal_verified),
    publication_year_verified: num(row.publication_year_verified),
    publication_published_date_verified: nullable(row.publication_published_date_verified),
    publication_issue_pages_verified: nullable(row.publication_issue_pages_verified),
    condition_temperature_C: num(row.condition_temperature_C),
    condition_atmosphere: nullable(row.condition_atmosphere),
    measurement_method: nullable(row.measurement_method),
    gauge_length_mm: num(row.gauge_length_mm),
    strain_rate_s_inv: num(row.strain_rate_s_inv),
    provenance_table_figure_page: nullable(row.provenance_table_figure_page),
    secondary_source_doi_raw: nullable(row.secondary_source_doi_raw),
    secondary_source_title: nullable(row.secondary_source_title),
    secondary_source_authors_short: nullable(row.secondary_source_authors_short),
    secondary_source_journal: nullable(row.secondary_source_journal),
    secondary_source_year: num(row.secondary_source_year),
    original_reference_raw: nullable(row.original_reference_raw),
    doi_resolution_status: nullable(row.doi_resolution_status),
    doi_resolution_score: num(row.doi_resolution_score),
    canonical_record_id: nullable(row.canonical_record_id),
    duplicate_group_id: nullable(row.duplicate_group_id),
    duplicate_group_size: num(row.duplicate_group_size),
    duplicate_group_role: nullable(row.duplicate_group_role),
    duplicate_of_record_id: nullable(row.duplicate_of_record_id),
    duplicate_match_score: num(row.duplicate_match_score),
    duplicate_exclusion_reason: nullable(row.duplicate_exclusion_reason),
    issue_types: nullable(row.issue_types),
    required_action: nullable(row.required_action),
    citation_raw: nullable(row.citation_raw),
    source_file: nullable(row.source_file) ?? "",
    source_sheet: nullable(row.source_sheet) ?? "",
    source_row: num(row.source_row)
  };
}

function measurementFromRow(row: Record<string, string>): Measurement | null {
  const property = row.property as PropertyKey;
  const meta = PROPERTY_BY_KEY.get(property);
  const value = num(row.value_canonical);
  if (!meta || value === null) return null;
  return {
    measurement_id: row.measurement_id,
    record_id: row.record_id,
    property,
    value_canonical: value,
    unit_canonical: row.unit_canonical,
    value_display: value * meta.displayFactor,
    unit_display: meta.displayUnit,
    public_release_tier: nullable(row.public_release_tier) ?? "",
    public_plot_badge: nullable(row.public_plot_badge) ?? "",
    measurement_warning: nullable(row.measurement_warning) ?? "none",
    strict_plot_eligible: bool(row.strict_plot_eligible),
    normalized_plot_eligible: bool(row.normalized_plot_eligible),
    exploratory_plot_eligible: bool(row.exploratory_plot_eligible)
  };
}

function publicationFromRow(row: Record<string, string>): Publication {
  return {
    publication_id: row.publication_id,
    doi_verified: nullable(row.doi_verified),
    url_input: nullable(row.url_input),
    title_verified: nullable(row.title_verified),
    authors_short_verified: nullable(row.authors_short_verified),
    authors_full_verified: nullable(row.authors_full_verified),
    journal_verified: nullable(row.journal_verified),
    year_verified: num(row.year_verified),
    issue_pages_verified: nullable(row.issue_pages_verified),
    validation_status_enriched: nullable(row.validation_status_enriched) ?? "",
    public_source_type: nullable(row.public_source_type) ?? "",
    source_record_count_public_v0: num(row.source_record_count_public_v0) ?? 0
  };
}

export function getExplorerPayload(): ExplorerPayload {
  const communitySubmissions = readCommunitySubmissions();
  const records = [
    ...readCsv("public_records_v0.csv").map(recordFromRow),
    ...communitySubmissions.map((submission) => submission.record)
  ];
  const measurements = [
    ...readCsv("public_measurements_v0.csv")
    .map(measurementFromRow)
      .filter((row): row is Measurement => row !== null),
    ...communitySubmissions.flatMap((submission) =>
      submission.measurements
        .map((measurement) => {
          const meta = PROPERTY_BY_KEY.get(measurement.property);
          if (!meta) return null;
          return {
            ...measurement,
            value_display: measurement.value_canonical * meta.displayFactor,
            unit_display: meta.displayUnit
          };
        })
        .filter((measurement): measurement is Measurement => measurement !== null)
    )
  ];
  const publications = [
    ...readCsv("public_publications_v0.csv").map(publicationFromRow),
    ...communitySubmissions.map((submission) => submission.publication)
  ];

  const byRecord = new Map<string, PlotRecord>();
  records.forEach((record) => {
    byRecord.set(record.record_id, {
      ...record,
      values: {},
      canonicalValues: {},
      measurementWarnings: {}
    });
  });

  measurements.forEach((measurement) => {
    const record = byRecord.get(measurement.record_id);
    if (!record) return;
    record.values[measurement.property] = measurement.value_display;
    record.canonicalValues[measurement.property] = measurement.value_canonical;
    record.measurementWarnings[measurement.property] = measurement.measurement_warning;
  });

  const plotRecords = Array.from(byRecord.values());
  const properties = PROPERTY_META_BASE.map((meta) => ({
    ...meta,
    recordsWithValue: plotRecords.filter((record) => typeof record.values[meta.key] === "number").length
  })).filter((meta) => meta.recordsWithValue > 0);

  const years = plotRecords
    .map((record) => record.publication_year_verified)
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year));

  return {
    properties,
    records: plotRecords,
    measurements,
    publications,
    summary: {
      recordCount: plotRecords.length,
      measurementCount: measurements.length,
      primaryRecords: plotRecords.filter((record) => record.peer_reviewed_measurement).length,
      benchmarkRecords: plotRecords.filter((record) => record.contextual_benchmark).length,
      peerReviewedResearchRecords: plotRecords.filter((record) => record.public_release_tier === "peer_reviewed_research").length,
      peerReviewedComparatorRecords: plotRecords.filter((record) => record.public_release_tier === "peer_reviewed_contextual_comparator").length,
      commercialComparatorRecords: plotRecords.filter((record) => record.public_release_tier === "commercial_contextual_comparator").length,
      secondaryExtractedRecords: plotRecords.filter((record) => record.value_extraction_type === "secondary_meta_analysis").length,
      strictReadyRecords: plotRecords.filter((record) => record.strict_comparison_ready).length,
      minYear: years.length ? Math.min(...years) : null,
      maxYear: years.length ? Math.max(...years) : null
    }
  };
}

export function getPlotPoints(x: PropertyKey, y: PropertyKey): PlotRecord[] {
  return getExplorerPayload().records.filter((record) => {
    const xValue = record.values[x];
    const yValue = record.values[y];
    return typeof xValue === "number" && Number.isFinite(xValue) && typeof yValue === "number" && Number.isFinite(yValue);
  });
}

export function isPropertyKey(value: string | null): value is PropertyKey {
  return PROPERTY_BY_KEY.has(value as PropertyKey);
}
