import {
  getBundledExplorerPayload,
  measurementFromRow,
  PROPERTY_META_BASE,
  publicationFromRow,
  recordFromRow,
  type Measurement,
  type PlotRecord,
  type PropertyKey,
  type Publication
} from "@/lib/data";
import { readCanonicalReleaseMetadata } from "@/lib/canonical-store";
import { ensureDatabaseSchema, hasDatabaseUrl, withDb } from "@/lib/db";
import { buildCanonicalRecordQuery } from "@/lib/query-sql.mjs";

export type ReleaseDescriptor = {
  release_id: string;
  schema_version: string;
  source_hash: string | null;
  record_count: number;
  measurement_count: number;
  publication_count: number;
  imported_at: string | null;
  backend: "postgresql" | "bundled_csv";
};

export type RecordQuery = {
  limit: number;
  after?: string;
  recordIds?: string[];
  property?: PropertyKey;
  minValue?: number;
  maxValue?: number;
  measurementRanges?: Array<{ property: PropertyKey; minValue?: number; maxValue?: number }>;
  requiredProperties?: PropertyKey[];
  materialFamilies?: string[];
  formFactors?: string[];
  releaseTiers?: string[];
  doi?: string;
  author?: string;
  journal?: string;
  yearMin?: number;
  yearMax?: number;
  gaugeLengthMinMm?: number;
  gaugeLengthMaxMm?: number;
  temperatureMinC?: number;
  temperatureMaxC?: number;
  provenance?: string[];
  verification?: string[];
  q?: string;
  strictReady?: boolean;
  peerReviewed?: boolean;
  normalizedEligible?: boolean;
};

export type CanonicalRecord = {
  record: PlotRecord;
  measurements: Measurement[];
  publication: Publication | null;
};

export type RecordQueryPage = {
  records: CanonicalRecord[];
  nextCursor: string | null;
  hasMore: boolean;
};

type QueryRow = {
  record_payload: unknown;
  publication_payload: unknown;
  measurement_payloads: unknown;
};

function payloadToStringRecord(value: unknown, label: string): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not a JSON object.`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, item === null || item === undefined ? "" : String(item)])
  );
}

function canonicalRecordFromPayloads(row: QueryRow): CanonicalRecord {
  const recordBase = recordFromRow(payloadToStringRecord(row.record_payload, "Canonical record payload"));
  const rawMeasurements = Array.isArray(row.measurement_payloads) ? row.measurement_payloads : [];
  const measurements = rawMeasurements
    .map((payload, index) => measurementFromRow(payloadToStringRecord(payload, `Measurement payload ${index + 1}`)))
    .filter((measurement): measurement is Measurement => measurement !== null);
  const record: PlotRecord = {
    ...recordBase,
    values: {},
    canonicalValues: {},
    measurementWarnings: {}
  };
  measurements.forEach((measurement) => {
    record.values[measurement.property] = measurement.value_display;
    record.canonicalValues[measurement.property] = measurement.value_canonical;
    record.measurementWarnings[measurement.property] = measurement.measurement_warning;
  });
  const publication = row.publication_payload
    ? publicationFromRow(payloadToStringRecord(row.publication_payload, "Publication payload"))
    : null;
  return { record, measurements, publication };
}

function normalizeDoi(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
}

function queryTokens(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 12);
}

async function queryPostgres(query: RecordQuery): Promise<RecordQueryPage> {
  await ensureDatabaseSchema();
  return withDb(async (client) => {
    const plan = buildCanonicalRecordQuery(query);
    const result = await client.query<QueryRow>(plan.text, plan.values);
    const hasMore = result.rows.length > query.limit;
    const selected = hasMore ? result.rows.slice(0, query.limit) : result.rows;
    const records = selected.map(canonicalRecordFromPayloads);
    return {
      records,
      hasMore,
      nextCursor: hasMore ? records.at(-1)?.record.record_id ?? null : null
    };
  });
}

function includesText(value: string | null | undefined, query: string | undefined): boolean {
  return !query || (value ?? "").toLowerCase().includes(query.toLowerCase());
}

function matchesFallback(record: PlotRecord, query: RecordQuery): boolean {
  if (query.after && record.record_id <= query.after) return false;
  if (query.recordIds?.length && !query.recordIds.includes(record.record_id)) return false;
  if (query.materialFamilies?.length && !query.materialFamilies.includes(record.material_family)) return false;
  if (query.formFactors?.length && !query.formFactors.includes(record.form_factor)) return false;
  if (query.releaseTiers?.length && !query.releaseTiers.includes(record.public_release_tier)) return false;
  if (query.provenance?.length && !query.provenance.includes(record.dataset_provenance)) return false;
  if (query.verification?.length && !query.verification.includes(record.primary_source_verification_status)) return false;
  if (query.doi && normalizeDoi(record.doi_verified ?? record.doi_raw ?? "") !== normalizeDoi(query.doi)) return false;
  if (!includesText(`${record.publication_authors_short_verified ?? ""} ${record.publication_authors_full_verified ?? ""}`, query.author)) return false;
  if (!includesText(record.publication_journal_verified, query.journal)) return false;
  if (query.yearMin !== undefined && (record.publication_year_verified ?? -Infinity) < query.yearMin) return false;
  if (query.yearMax !== undefined && (record.publication_year_verified ?? Infinity) > query.yearMax) return false;
  if (query.gaugeLengthMinMm !== undefined && (record.gauge_length_mm ?? -Infinity) < query.gaugeLengthMinMm) return false;
  if (query.gaugeLengthMaxMm !== undefined && (record.gauge_length_mm ?? Infinity) > query.gaugeLengthMaxMm) return false;
  if (query.temperatureMinC !== undefined && (record.condition_temperature_C ?? -Infinity) < query.temperatureMinC) return false;
  if (query.temperatureMaxC !== undefined && (record.condition_temperature_C ?? Infinity) > query.temperatureMaxC) return false;
  if (query.strictReady !== undefined && record.strict_comparison_ready !== query.strictReady) return false;
  if (query.normalizedEligible !== undefined && record.normalized_comparison_eligible !== query.normalizedEligible) return false;
  const peerReviewedRelease = record.public_release_tier === "peer_reviewed_research"
    || record.public_release_tier === "peer_reviewed_contextual_comparator";
  if (query.peerReviewed !== undefined && peerReviewedRelease !== query.peerReviewed) return false;
  const ranges = new Map<PropertyKey, { minValue?: number; maxValue?: number }>();
  (query.requiredProperties ?? []).forEach((property) => ranges.set(property, {}));
  (query.measurementRanges ?? []).forEach((range) => ranges.set(range.property, range));
  if (query.property) ranges.set(query.property, { minValue: query.minValue, maxValue: query.maxValue });
  for (const [property, range] of ranges) {
    const value = record.canonicalValues[property];
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    if (range.minValue !== undefined && value < range.minValue) return false;
    if (range.maxValue !== undefined && value > range.maxValue) return false;
  }
  if (query.q) {
    const haystack = [
      record.doi_verified,
      record.doi_raw,
      record.record_label,
      record.sample_name,
      record.public_sample_label,
      record.material_family,
      record.form_factor,
      record.cnt_type,
      record.synthesis_method,
      record.postprocessing,
      record.publication_title_verified,
      record.publication_authors_short_verified,
      record.publication_authors_full_verified,
      record.publication_journal_verified,
      record.citation_raw
    ]
      .filter(Boolean)
      .join(" ")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (!queryTokens(query.q).every((token) => haystack.includes(token))) return false;
  }
  return true;
}

function queryBundled(query: RecordQuery): RecordQueryPage {
  const payload = getBundledExplorerPayload();
  const publicationByDoi = new Map(
    payload.publications
      .filter((publication) => publication.doi_verified)
      .map((publication) => [normalizeDoi(publication.doi_verified ?? ""), publication])
  );
  const selected = payload.records
    .filter((record) => matchesFallback(record, query))
    .sort((a, b) => a.record_id.localeCompare(b.record_id))
    .slice(0, query.limit + 1);
  const hasMore = selected.length > query.limit;
  const page = hasMore ? selected.slice(0, query.limit) : selected;
  const measurementsByRecord = new Map<string, Measurement[]>();
  payload.measurements.forEach((measurement) => {
    const current = measurementsByRecord.get(measurement.record_id) ?? [];
    current.push(measurement);
    measurementsByRecord.set(measurement.record_id, current);
  });
  const records = page.map((record) => ({
    record,
    measurements: measurementsByRecord.get(record.record_id) ?? [],
    publication: publicationByDoi.get(normalizeDoi(record.doi_verified ?? "")) ?? null
  }));
  return {
    records,
    hasMore,
    nextCursor: hasMore ? records.at(-1)?.record.record_id ?? null : null
  };
}

export async function queryCanonicalRecords(query: RecordQuery): Promise<RecordQueryPage> {
  return hasDatabaseUrl() ? queryPostgres(query) : queryBundled(query);
}

export async function getCanonicalRecord(recordId: string): Promise<CanonicalRecord | null> {
  const page = await queryCanonicalRecords({ limit: 1, recordIds: [recordId] });
  return page.records[0] ?? null;
}

export async function getReleaseDescriptor(): Promise<ReleaseDescriptor> {
  if (hasDatabaseUrl()) {
    const release = await readCanonicalReleaseMetadata();
    return {
      release_id: release.releaseId,
      schema_version: release.schemaVersion,
      source_hash: release.sourceHash,
      record_count: release.recordCount,
      measurement_count: release.measurementCount,
      publication_count: release.publicationCount,
      imported_at: release.importedAt,
      backend: "postgresql"
    };
  }
  const payload = getBundledExplorerPayload();
  return {
    release_id: "bundled-public-v0",
    schema_version: "cnt-property-atlas-public-v0.3",
    source_hash: null,
    record_count: payload.summary.recordCount,
    measurement_count: payload.summary.measurementCount,
    publication_count: payload.publications.length,
    imported_at: null,
    backend: "bundled_csv"
  };
}

export async function getPropertyCatalog() {
  if (!hasDatabaseUrl()) return getBundledExplorerPayload().properties;
  await ensureDatabaseSchema();
  const counts = await withDb(async (client) => {
    const result = await client.query<{ property: string; record_count: number | string }>(
      `
        SELECT m.property, count(*) AS record_count
        FROM atlas_dataset_releases rel
        JOIN atlas_canonical_measurements m ON m.release_id = rel.release_id
        WHERE rel.active = true
        GROUP BY m.property
      `
    );
    return new Map(result.rows.map((row) => [row.property, Number(row.record_count)]));
  });
  return PROPERTY_META_BASE
    .map((meta) => ({ ...meta, recordsWithValue: counts.get(meta.key) ?? 0 }))
    .filter((meta) => meta.recordsWithValue > 0);
}
