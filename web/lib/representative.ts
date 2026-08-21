import { doiValue, stripMarkup } from "@/lib/citations";
import type { FigureKind, FigureTemporaryPoint, FigureTemporaryRank, FigureTopAxis } from "@/lib/figure-api";
import type { PlotRecord, PropertyKey } from "@/lib/data";
import { ApiInputError } from "@/lib/api-v1";

export const MAX_TOP_POINTS = 10;

export const PERFORMANCE_PROPERTIES = new Set<PropertyKey>([
  "ampacity",
  "breaking_strain",
  "electrical_conductivity",
  "initial_modulus",
  "specific_electrical_conductivity",
  "specific_modulus",
  "specific_strength",
  "specific_thermal_conductivity",
  "tensile_strength",
  "thermal_conductivity",
  "work_of_rupture"
]);

export const RANKED_MATERIAL_FAMILIES = new Set([
  "carbon_fiber_comparator",
  "CNT_or_CNT_hybrid",
  "CNT_metal_composite",
  "graphene_or_GO_fiber"
]);

function cleanGroupPart(value: string | null | undefined, fallback = "unspecified"): string {
  const clean = stripMarkup(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return clean || fallback;
}

function publicationKey(record: PlotRecord): string {
  const doi = doiValue(record.doi_verified ?? record.doi_raw);
  if (doi) return `doi:${doi}`;
  return [
    "publication",
    cleanGroupPart(record.publication_title_verified ?? record.citation_raw ?? record.source_file),
    cleanGroupPart(record.publication_authors_short_verified),
    record.publication_year_verified ?? "n.d."
  ].join("|");
}

function metalIdentity(record: PlotRecord): string | null {
  if (record.material_family !== "metal_comparator") return null;
  const label = stripMarkup(record.public_sample_label || record.sample_name || record.record_label);
  if (/\b(aluminum|aluminium|al)\b/i.test(label)) return "aluminum";
  if (/\b(copper|cu)\b/i.test(label)) return "copper";
  if (/\b(silver|ag)\b/i.test(label)) return "silver";
  if (/\b(gold|au)\b/i.test(label)) return "gold";
  if (/\b(nickel|ni)\b/i.test(label)) return "nickel";
  if (/\bsteel\b/i.test(label)) return "steel";
  return null;
}

function benchmarkIdentity(record: PlotRecord): string {
  return metalIdentity(record)
    ?? cleanGroupPart(record.public_sample_label || record.sample_name || record.record_label);
}

function groupKey(record: PlotRecord): string {
  if (record.contextual_benchmark || record.public_release_tier.includes("contextual_comparator")) {
    return ["benchmark", record.material_family, record.form_factor, benchmarkIdentity(record)].join("|");
  }
  return [publicationKey(record), record.material_family, record.form_factor, cleanGroupPart(record.cnt_type)].join("|");
}

export function sourceRank(record: PlotRecord): number {
  if (record.public_release_tier === "peer_reviewed_research" && !record.author_curated_compilation_record) return 0;
  if (record.public_release_tier === "peer_reviewed_research") return 1;
  if (record.public_release_tier === "peer_reviewed_contextual_comparator") return 2;
  return 3;
}

function metric(record: PlotRecord, key: PropertyKey): number {
  const value = record.values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function priorityKeys(x: PropertyKey, y: PropertyKey): PropertyKey[] {
  const active = [y, x].filter((key) => PERFORMANCE_PROPERTIES.has(key));
  return active.length ? Array.from(new Set(active)) : [y, x];
}

function compare(a: PlotRecord, b: PlotRecord, x: PropertyKey, y: PropertyKey): number {
  for (const key of priorityKeys(x, y)) {
    const difference = metric(b, key) - metric(a, key);
    if (difference !== 0) return difference;
  }
  const sourceDifference = sourceRank(a) - sourceRank(b);
  if (sourceDifference !== 0) return sourceDifference;
  if (a.strict_comparison_ready !== b.strict_comparison_ready) return a.strict_comparison_ready ? -1 : 1;
  const yearDifference = (b.publication_year_verified ?? 0) - (a.publication_year_verified ?? 0);
  return yearDifference || a.record_id.localeCompare(b.record_id);
}

function nearlyEqualMetric(a: PlotRecord, b: PlotRecord, key: PropertyKey): boolean {
  const aValue = metric(a, key);
  const bValue = metric(b, key);
  if (!Number.isFinite(aValue) || !Number.isFinite(bValue)) return false;
  const tolerance = Math.max(Math.abs(aValue), Math.abs(bValue), 1e-12) * 0.002;
  return Math.abs(aValue - bValue) <= tolerance;
}

function repeatedCoordinate(a: PlotRecord, b: PlotRecord, x: PropertyKey, y: PropertyKey): boolean {
  return publicationKey(a) === publicationKey(b)
    && a.material_family === b.material_family
    && a.form_factor === b.form_factor
    && nearlyEqualMetric(a, b, x)
    && nearlyEqualMetric(a, b, y);
}

export function representativeRecords(
  records: PlotRecord[],
  x: PropertyKey,
  y: PropertyKey,
  kind: FigureKind
): PlotRecord[] {
  const groups = new Map<string, PlotRecord[]>();
  records.forEach((record) => groups.set(groupKey(record), [...(groups.get(groupKey(record)) ?? []), record]));
  const selected: PlotRecord[] = [];
  for (const group of groups.values()) {
    selected.push(group.slice().sort((a, b) => compare(a, b, x, y))[0]);
  }
  const ordered = selected.sort((a, b) => sourceRank(a) - sourceRank(b) || compare(a, b, x, y));
  const deduplicated = ordered.filter(
    (record, index, all) => !all.slice(0, index).some((candidate) => repeatedCoordinate(candidate, record, x, y))
  );
  return kind === "ranked"
    ? deduplicated.filter((record) => RANKED_MATERIAL_FAMILIES.has(record.material_family))
    : deduplicated;
}

function rankingAxis(topBy: FigureTopAxis, x: PropertyKey, y: PropertyKey): "x" | "y" {
  if (topBy === "auto") {
    if (PERFORMANCE_PROPERTIES.has(y)) return "y";
    if (PERFORMANCE_PROPERTIES.has(x)) return "x";
    throw new ApiInputError("Top-point extraction requires at least one higher-is-better performance property.");
  }
  const property = topBy === "x" ? x : y;
  if (!PERFORMANCE_PROPERTIES.has(property)) {
    throw new ApiInputError(`${property} is not a higher-is-better performance property.`);
  }
  return topBy;
}

export function topRecords(
  records: PlotRecord[],
  x: PropertyKey,
  y: PropertyKey,
  top: number,
  topBy: FigureTopAxis
): PlotRecord[] {
  if (!Number.isInteger(top) || top < 0 || top > MAX_TOP_POINTS) {
    throw new ApiInputError(`top must be an integer from 0 to ${MAX_TOP_POINTS}.`);
  }
  if (top === 0) return [];
  const axis = rankingAxis(topBy, x, y);
  const property = axis === "x" ? x : y;
  return records
    .filter((record) => Number.isFinite(metric(record, property)))
    .slice()
    .sort((a, b) => metric(b, property) - metric(a, property) || a.record_id.localeCompare(b.record_id))
    .slice(0, top);
}

function rank(values: number[], temporary: number): { rank: number; percentile: number } {
  const position = 1 + values.filter((value) => value > temporary).length;
  const total = values.length + 1;
  return {
    rank: position,
    percentile: total === 1 ? 100 : (100 * (total - position)) / (total - 1)
  };
}

export function temporaryRank(
  records: PlotRecord[],
  temporary: FigureTemporaryPoint | null | undefined,
  x: PropertyKey,
  y: PropertyKey
): FigureTemporaryRank | null {
  if (!temporary) return null;
  if (!Number.isFinite(temporary.x) || !Number.isFinite(temporary.y)) {
    throw new ApiInputError("Temporary-point coordinates must be finite numbers.");
  }
  const xResult = PERFORMANCE_PROPERTIES.has(x)
    ? rank(records.map((record) => metric(record, x)).filter(Number.isFinite), temporary.x)
    : null;
  const yResult = PERFORMANCE_PROPERTIES.has(y)
    ? rank(records.map((record) => metric(record, y)).filter(Number.isFinite), temporary.y)
    : null;
  let dominatedBy: number | null = null;
  let onParetoFrontier: boolean | null = null;
  if (PERFORMANCE_PROPERTIES.has(x) && PERFORMANCE_PROPERTIES.has(y)) {
    const toleranceX = Math.max(Math.abs(temporary.x), 1) * 1e-9;
    const toleranceY = Math.max(Math.abs(temporary.y), 1) * 1e-9;
    dominatedBy = records.filter((record) => {
      const recordX = metric(record, x);
      const recordY = metric(record, y);
      return recordX + toleranceX >= temporary.x
        && recordY + toleranceY >= temporary.y
        && (recordX > temporary.x + toleranceX || recordY > temporary.y + toleranceY);
    }).length;
    onParetoFrontier = dominatedBy === 0;
  }
  return {
    label: temporary.label?.trim() || "User input",
    x: temporary.x,
    y: temporary.y,
    total_with_temporary: records.length + 1,
    x_rank: xResult?.rank ?? null,
    y_rank: yResult?.rank ?? null,
    x_percentile: xResult?.percentile ?? null,
    y_percentile: yResult?.percentile ?? null,
    dominated_by: dominatedBy,
    on_pareto_frontier: onParetoFrontier
  };
}

export function defaultSelectedRecord(records: PlotRecord[], x: PropertyKey, y: PropertyKey): PlotRecord | null {
  return records.slice().sort((a, b) => compare(a, b, x, y))[0] ?? null;
}
