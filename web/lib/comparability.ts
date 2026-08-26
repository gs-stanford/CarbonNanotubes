import type { FigureKind } from "@/lib/figure-api";
import type { Measurement, PlotRecord, PropertyKey } from "@/lib/data";

export const COMPARABILITY_MODEL_VERSION = "cpt-property-pair-v1";

export type ComparabilityGrade = "A" | "B" | "C" | "D";
export type FigureComparisonMode = "property_pair" | "single_property";

export type PointComparability = {
  record_id: string;
  grade: ComparabilityGrade;
  mode: FigureComparisonMode;
  source_status:
    | "primary_source_verified"
    | "author_curated_verified_compilation"
    | "doi_verified_research"
    | "peer_reviewed_context"
    | "commercial_context"
    | "unverified";
  specimen_linkage: string;
  condition_status: "complete" | "partial" | "missing" | "not_required";
  method_status: "reported" | "missing" | "not_required";
  method_metadata_groups: Partial<Record<PropertyKey, string>>;
  statistic_status: "reported" | "mixed" | "unspecified";
  uncertainty_status: "reported" | "partial" | "not_reported";
  normalization_status: "reported" | "partial" | "unknown" | "not_required";
  density_basis_status: "reported" | "unknown" | "not_required";
  bound_status: "reported" | "partial" | "unspecified";
  required_condition_fields: string[];
  missing_condition_fields: string[];
  issues: string[];
  rationale: string;
  strict_same_specimen_ready: boolean;
};

export type FigureComparability = {
  model_version: typeof COMPARABILITY_MODEL_VERSION;
  mode: FigureComparisonMode;
  active_properties: PropertyKey[];
  grade_counts: Record<ComparabilityGrade, number>;
  same_specimen_verified_count: number;
  linkage_unverified_count: number;
  method_groups_by_property: Partial<Record<PropertyKey, Record<string, number>>>;
  inter_record_method_compatibility: "not_assessed";
  points: Record<string, PointComparability>;
  rubric: Record<ComparabilityGrade, string>;
  disclosure: string;
};

const MECHANICAL = new Set<PropertyKey>([
  "specific_strength",
  "tensile_strength",
  "specific_modulus",
  "initial_modulus",
  "breaking_strain",
  "work_of_rupture"
]);

const ELECTRICAL = new Set<PropertyKey>([
  "electrical_conductivity",
  "specific_electrical_conductivity"
]);

const THERMAL = new Set<PropertyKey>([
  "thermal_conductivity",
  "specific_thermal_conductivity"
]);

const DESCRIPTORS = new Set<PropertyKey>([
  "density",
  "specific_volume",
  "diameter",
  "linear_density",
  "g_d_ratio"
]);

const GRADE_RUBRIC: Record<ComparabilityGrade, string> = {
  A: "Explicit same-specimen pairing (or one-property assessment), strong source provenance, complete required metadata, and a stated statistic basis.",
  B: "Same specimen/batch or one-property assessment with strong source provenance; minor metadata or statistic limitations remain.",
  C: "Peer-reviewed or author-curated value, but specimen linkage, conditions, or statistic basis are incomplete. Use for exploratory comparison.",
  D: "Context-only, unresolved, explicitly mixed/aggregated, or affected by a critical unit/provenance warning."
};

function measurementsFor(record: PlotRecord, properties: PropertyKey[]): Measurement[] {
  return properties
    .map((property) => record.measurementMetadata[property])
    .filter((measurement): measurement is Measurement => Boolean(measurement));
}

function requiredConditions(properties: PropertyKey[], record: PlotRecord): string[] {
  const fields = new Set<string>();
  if (properties.some((property) => MECHANICAL.has(property))) {
    fields.add("measurement_method_or_test_standard");
    fields.add("temperature");
    fields.add("atmosphere");
    fields.add("gauge_length");
    fields.add("strain_rate");
  }
  if (properties.some((property) => ELECTRICAL.has(property))) {
    fields.add("measurement_method_or_test_standard");
    fields.add("temperature");
    fields.add("measurement_direction");
    if (record.form_factor === "fiber_yarn") fields.add("gauge_length");
  }
  if (properties.some((property) => THERMAL.has(property))) {
    fields.add("measurement_method_or_test_standard");
    fields.add("temperature");
    fields.add("measurement_direction");
  }
  if (properties.includes("ampacity")) {
    fields.add("measurement_method_or_test_standard");
    fields.add("temperature");
    fields.add("atmosphere");
    fields.add("gauge_length");
  }
  if (properties.every((property) => DESCRIPTORS.has(property))) return [];
  return Array.from(fields);
}

function sourceStatus(record: PlotRecord): PointComparability["source_status"] {
  if (record.commercial_specsheet_benchmark || record.public_release_tier === "commercial_contextual_comparator") {
    return "commercial_context";
  }
  if (record.author_curated_compilation_record && record.primary_source_verification_status === "verified_against_primary_source") {
    return "author_curated_verified_compilation";
  }
  if (record.primary_source_verification_status === "verified_against_primary_source") {
    return "primary_source_verified";
  }
  if (record.public_release_tier === "peer_reviewed_contextual_comparator") return "peer_reviewed_context";
  if (record.public_release_tier === "peer_reviewed_research" && Boolean(record.doi_verified ?? record.doi_raw)) {
    return "doi_verified_research";
  }
  return "unverified";
}

function linkageFor(record: PlotRecord, measurements: Measurement[], mode: FigureComparisonMode): string {
  if (mode === "single_property") return "not_applicable_single_property";
  const declared = measurements
    .map((measurement) => measurement.specimen_linkage)
    .find((value) => ["same_specimen_verified", "same_sample_batch", "mixed_specimens", "aggregated_across_specimens", "incompatible"].includes(value))
    ?? record.specimen_linkage
    ?? measurements.map((measurement) => measurement.specimen_linkage).find((value) => value && value !== "unknown");
  return declared || "unknown";
}

function fieldPresent(field: string, record: PlotRecord, measurements: Measurement[]): boolean {
  if (field === "measurement_method_or_test_standard") {
    return Boolean(record.measurement_method || record.test_standard || measurements.some((measurement) => measurement.test_standard));
  }
  if (field === "temperature") return record.condition_temperature_C !== null;
  if (field === "atmosphere") return Boolean(record.condition_atmosphere);
  if (field === "gauge_length") return record.gauge_length_mm !== null;
  if (field === "strain_rate") return record.strain_rate_s_inv !== null;
  if (field === "measurement_direction") {
    return Boolean(record.measurement_direction || (measurements.length > 0 && measurements.every((measurement) => measurement.measurement_direction)));
  }
  return false;
}

function statisticStatus(measurements: Measurement[]): PointComparability["statistic_status"] {
  const values = measurements.map((measurement) => measurement.statistic_type || "unspecified");
  if (!values.length || values.every((value) => value === "unspecified")) return "unspecified";
  return new Set(values).size === 1 && !values.includes("unspecified") ? "reported" : "mixed";
}

function uncertaintyStatus(measurements: Measurement[]): PointComparability["uncertainty_status"] {
  const reported = measurements.filter((measurement) => measurement.uncertainty_type !== "not_reported").length;
  if (reported === 0) return "not_reported";
  return reported === measurements.length ? "reported" : "partial";
}

function normalizationStatus(measurements: Measurement[]): PointComparability["normalization_status"] {
  const relevant = measurements.filter((measurement) => measurement.property.startsWith("specific_"));
  if (!relevant.length) return "not_required";
  const known = relevant.filter((measurement) => !["", "unknown"].includes(measurement.normalization_basis)).length;
  if (known === 0) return "unknown";
  return known === relevant.length ? "reported" : "partial";
}

function densityBasisStatus(measurements: Measurement[]): PointComparability["density_basis_status"] {
  const derived = measurements.filter((measurement) => measurement.normalization_basis === "derived_from_density");
  if (!derived.length) return "not_required";
  return derived.every((measurement) => Boolean(measurement.density_basis)
      && !["unknown", "not_applicable"].includes(measurement.density_basis)
      && measurement.density_value_kg_m3 !== null)
    ? "reported"
    : "unknown";
}

function boundStatus(measurements: Measurement[]): PointComparability["bound_status"] {
  const known = measurements.filter((measurement) => !["", "unspecified"].includes(measurement.value_bound_type)).length;
  if (known === 0) return "unspecified";
  return known === measurements.length ? "reported" : "partial";
}

function methodMetadataGroup(property: PropertyKey, record: PlotRecord, measurement: Measurement | undefined): string {
  const text = `${measurement?.test_standard ?? ""} ${record.test_standard ?? ""} ${record.measurement_method ?? ""}`.toLowerCase();
  if (!text.trim()) return "unreported";
  if (MECHANICAL.has(property)) {
    if (text.includes("astm c1557")) return "astm_c1557_tensile";
    if (text.includes("tensile") || text.includes("uniaxial")) return "reported_tensile_other";
    return "reported_mechanical_other";
  }
  if (ELECTRICAL.has(property) || property === "ampacity") {
    if (/four[- ]?(probe|point|terminal)|4[- ]?(probe|point|terminal)/.test(text)) return "four_terminal";
    if (/two[- ]?(probe|point|terminal)|2[- ]?(probe|point|terminal)/.test(text)) return "two_terminal";
    return "reported_electrical_other";
  }
  if (THERMAL.has(property)) {
    if (text.includes("laser flash")) return "laser_flash";
    if (text.includes("3-omega") || text.includes("3 omega")) return "three_omega";
    if (text.includes("steady")) return "steady_state";
    return "reported_thermal_other";
  }
  return "reported_descriptor_method";
}

function gradeFor(input: {
  mode: FigureComparisonMode;
  source: PointComparability["source_status"];
  linkage: string;
  conditionFraction: number;
  conditionsRequired: boolean;
  statistic: PointComparability["statistic_status"];
  normalization: PointComparability["normalization_status"];
  densityBasis: PointComparability["density_basis_status"];
  critical: boolean;
}): ComparabilityGrade {
  if (input.critical || input.source === "commercial_context" || input.source === "unverified") return "D";
  if (input.source === "peer_reviewed_context") return "C";
  const strongSource = input.source === "primary_source_verified" || input.source === "author_curated_verified_compilation";
  const conditionsComplete = !input.conditionsRequired || input.conditionFraction === 1;
  const normalizationComplete = !["unknown", "partial"].includes(input.normalization) && input.densityBasis !== "unknown";
  if (input.mode === "single_property") {
    if (strongSource && conditionsComplete && normalizationComplete && input.statistic === "reported") return "A";
    if (strongSource && normalizationComplete && input.conditionFraction >= 0.75 && input.statistic !== "mixed") return "B";
    return "C";
  }
  if (input.linkage === "same_specimen_verified" && strongSource && conditionsComplete && normalizationComplete && input.statistic === "reported") return "A";
  if (["same_specimen_verified", "same_sample_batch"].includes(input.linkage)
    && strongSource && normalizationComplete && input.conditionFraction >= 0.75 && input.statistic !== "mixed") return "B";
  if (["mixed_specimens", "aggregated_across_specimens", "incompatible"].includes(input.linkage)) return "D";
  return "C";
}

export function assessComparability(
  record: PlotRecord,
  x: PropertyKey,
  y: PropertyKey,
  kind: FigureKind
): PointComparability {
  const mode: FigureComparisonMode = kind === "scatter" || kind === "ashby" ? "property_pair" : "single_property";
  const properties = mode === "property_pair" ? [x, y] : [y];
  const measurements = measurementsFor(record, properties);
  const required = requiredConditions(properties, record);
  const missing = required.filter((field) => !fieldPresent(field, record, measurements));
  const conditionFraction = required.length ? (required.length - missing.length) / required.length : 1;
  const conditionStatus: PointComparability["condition_status"] = !required.length
    ? "not_required"
    : missing.length === 0
      ? "complete"
      : missing.length === required.length
        ? "missing"
        : "partial";
  const methodRequired = required.includes("measurement_method_or_test_standard");
  const methodReported = !methodRequired || fieldPresent("measurement_method_or_test_standard", record, measurements);
  const statistic = statisticStatus(measurements);
  const uncertainty = uncertaintyStatus(measurements);
  const normalization = normalizationStatus(measurements);
  const densityBasis = densityBasisStatus(measurements);
  const bound = boundStatus(measurements);
  const source = sourceStatus(record);
  const linkage = linkageFor(record, measurements, mode);
  const warnings = measurements.map((measurement) => measurement.measurement_warning).filter((warning) => warning !== "none");
  const critical = record.unit_inference_review_needed
    || warnings.some((warning) => warning.includes("unit_inferred"))
    || ["mixed_specimens", "aggregated_across_specimens", "incompatible"].includes(linkage);
  const grade = gradeFor({
    mode,
    source,
    linkage,
    conditionFraction,
    conditionsRequired: required.length > 0,
    statistic,
    normalization,
    densityBasis,
    critical
  });
  const issues = [
    ...(mode === "property_pair" && !["same_specimen_verified", "same_sample_batch"].includes(linkage)
      ? ["same-specimen pairing not established"] : []),
    ...(missing.length ? [`missing conditions: ${missing.join(", ")}`] : []),
    ...(statistic === "unspecified" ? ["reported statistic type unspecified"] : []),
    ...(uncertainty === "not_reported" ? ["uncertainty not reported"] : []),
    ...(normalization === "unknown" || normalization === "partial" ? ["specific-property normalization basis incomplete"] : []),
    ...(densityBasis === "unknown" ? ["density convention not established for density-derived value"] : []),
    ...(bound === "unspecified" ? ["value bound type unspecified"] : []),
    ...warnings
  ];
  return {
    record_id: record.record_id,
    grade,
    mode,
    source_status: source,
    specimen_linkage: linkage,
    condition_status: conditionStatus,
    method_status: !methodRequired ? "not_required" : methodReported ? "reported" : "missing",
    method_metadata_groups: Object.fromEntries(
      properties.map((property) => [property, methodMetadataGroup(property, record, record.measurementMetadata[property])])
    ),
    statistic_status: statistic,
    uncertainty_status: uncertainty,
    normalization_status: normalization,
    density_basis_status: densityBasis,
    bound_status: bound,
    required_condition_fields: required,
    missing_condition_fields: missing,
    issues: Array.from(new Set(issues)),
    rationale: GRADE_RUBRIC[grade],
    strict_same_specimen_ready: mode === "property_pair"
      && grade === "A"
      && linkage === "same_specimen_verified"
      && conditionStatus === "complete"
      && !critical
  };
}

export function figureComparability(
  records: PlotRecord[],
  x: PropertyKey,
  y: PropertyKey,
  kind: FigureKind
): FigureComparability {
  const assessments = records.map((record) => assessComparability(record, x, y, kind));
  const points = Object.fromEntries(assessments.map((assessment) => [assessment.record_id, assessment]));
  const mode: FigureComparisonMode = kind === "scatter" || kind === "ashby" ? "property_pair" : "single_property";
  const methodGroupsByProperty: Partial<Record<PropertyKey, Record<string, number>>> = {};
  assessments.forEach((assessment) => {
    Object.entries(assessment.method_metadata_groups).forEach(([property, group]) => {
      if (!group) return;
      const key = property as PropertyKey;
      const counts = methodGroupsByProperty[key] ?? {};
      counts[group] = (counts[group] ?? 0) + 1;
      methodGroupsByProperty[key] = counts;
    });
  });
  return {
    model_version: COMPARABILITY_MODEL_VERSION,
    mode,
    active_properties: mode === "property_pair" ? [x, y] : [y],
    grade_counts: {
      A: assessments.filter((assessment) => assessment.grade === "A").length,
      B: assessments.filter((assessment) => assessment.grade === "B").length,
      C: assessments.filter((assessment) => assessment.grade === "C").length,
      D: assessments.filter((assessment) => assessment.grade === "D").length
    },
    same_specimen_verified_count: assessments.filter((assessment) => assessment.specimen_linkage === "same_specimen_verified").length,
    linkage_unverified_count: assessments.filter((assessment) => assessment.issues.includes("same-specimen pairing not established")).length,
    method_groups_by_property: methodGroupsByProperty,
    inter_record_method_compatibility: "not_assessed",
    points,
    rubric: GRADE_RUBRIC,
    disclosure: mode === "property_pair"
      ? "A shared database row is not proof that both properties were measured on the same physical specimen. Point evidence grades expose source, linkage, conditions, statistic basis, normalization basis, density convention, and warnings. Inter-record method compatibility is not inferred from free-text methods."
      : "Highest-reported-value and trend figures assess one property at a time. Point evidence grades expose source provenance, conditions, statistic basis, normalization basis, uncertainty, and warnings; they do not assert inter-record method equivalence."
  };
}
