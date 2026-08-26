import {
  getBundledExplorerPayload,
  getBundledExplorerBootstrap,
  getBundledReleaseSummary,
  measurementFromRow,
  PROPERTY_BY_KEY,
  PROPERTY_META_BASE,
  publicationFromRow,
  recordFromRow,
  type CommunityAcceptedSubmission,
  type Measurement,
  type PlotRecord,
  type PublicRecord,
  type PropertyKey,
  type Publication
} from "@/lib/data";
import type { ExplorerBootstrap } from "@/lib/figure-api";
import { readCanonicalReleaseMetadata } from "@/lib/canonical-store";
import { ensureDatabaseSchema, hasDatabaseUrl, withDb } from "@/lib/db";
import { buildCanonicalRecordQuery } from "@/lib/query-sql.mjs";
import { readPublicSubmissions } from "@/lib/submission-store";

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

export type DoiMetadata = {
  doi: string;
  title: string | null;
  authors_short: string | null;
  journal: string | null;
  year: number | null;
  role: "original" | "compilation";
};

type QueryRow = {
  record_payload: unknown;
  publication_payload: unknown;
  measurement_payloads: unknown;
};

type DoiLookupRow = {
  record_payload: unknown;
  publication_payload: unknown;
};

type BootstrapRow = {
  record_count: number | string;
  material_families: string[] | null;
  form_factors: string[] | null;
  primary_records: number | string;
  benchmark_records: number | string;
  peer_reviewed_research_records: number | string;
  peer_reviewed_comparator_records: number | string;
  commercial_comparator_records: number | string;
  author_curated_compilation_records: number | string;
  primary_source_verified_compilation_records: number | string;
  primary_source_check_pending_records: number | string;
  strict_ready_records: number | string;
  min_year: number | string | null;
  max_year: number | string | null;
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
    measurementWarnings: {},
    measurementMetadata: {}
  };
  measurements.forEach((measurement) => {
    record.values[measurement.property] = measurement.value_display;
    record.canonicalValues[measurement.property] = measurement.value_canonical;
    record.measurementWarnings[measurement.property] = measurement.measurement_warning;
    record.measurementMetadata[measurement.property] = measurement;
  });
  const publication = row.publication_payload
    ? publicationFromRow(payloadToStringRecord(row.publication_payload, "Publication payload"))
    : null;
  return { record, measurements, publication };
}

function canonicalRecordFromSubmission(submission: CommunityAcceptedSubmission): CanonicalRecord {
  const measurements = submission.measurements
    .map((measurement) => {
      const meta = PROPERTY_BY_KEY.get(measurement.property);
      if (!meta) return null;
      return {
        ...measurement,
        value_display: measurement.value_canonical * meta.displayFactor,
        unit_display: meta.displayUnit
      } satisfies Measurement;
    })
    .filter((measurement): measurement is Measurement => measurement !== null);
  const record: PlotRecord = {
    ...submission.record,
    values: {},
    canonicalValues: {},
    measurementWarnings: {},
    measurementMetadata: {}
  };
  for (const measurement of measurements) {
    record.values[measurement.property] = measurement.value_display;
    record.canonicalValues[measurement.property] = measurement.value_canonical;
    record.measurementWarnings[measurement.property] = measurement.measurement_warning;
    record.measurementMetadata[measurement.property] = measurement;
  }
  return { record, measurements, publication: submission.publication };
}

function normalizeDoi(value: string): string {
  return value
    .split(";")[0]
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
}

function doiMetadataFromRecord(record: PublicRecord, publication: Publication | null, doi: string): DoiMetadata | null {
  if (normalizeDoi(record.doi_verified ?? record.doi_raw ?? "") === doi) {
    return {
      doi,
      title: publication?.title_verified ?? record.publication_title_verified,
      authors_short: publication?.authors_short_verified ?? record.publication_authors_short_verified,
      journal: publication?.journal_verified ?? record.publication_journal_verified,
      year: publication?.year_verified ?? record.publication_year_verified,
      role: "original"
    };
  }
  if (normalizeDoi(record.compilation_source_doi_raw ?? "") === doi) {
    return {
      doi,
      title: record.compilation_source_title,
      authors_short: record.compilation_source_authors_short,
      journal: record.compilation_source_journal,
      year: record.compilation_source_year,
      role: "compilation"
    };
  }
  return null;
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
  const plan = buildCanonicalRecordQuery(query);
  const [canonicalRows, publicSubmissions] = await Promise.all([
    withDb(async (client) => (await client.query<QueryRow>(plan.text, plan.values)).rows),
    readPublicSubmissions()
  ]);
  const merged = new Map<string, CanonicalRecord>();
  for (const row of canonicalRows) {
    const record = canonicalRecordFromPayloads(row);
    merged.set(record.record.record_id, record);
  }
  for (const submission of publicSubmissions) {
    const record = canonicalRecordFromSubmission(submission);
    if (matchesFallback(record.record, query) && !merged.has(record.record.record_id)) {
      merged.set(record.record.record_id, record);
    }
  }
  const eligible = Array.from(merged.values()).sort((a, b) => a.record.record_id.localeCompare(b.record.record_id));
  const hasMore = eligible.length > query.limit;
  const records = hasMore ? eligible.slice(0, query.limit) : eligible;
  return {
    records,
    hasMore,
    nextCursor: hasMore ? records.at(-1)?.record.record_id ?? null : null
  };
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

export async function lookupDoiMetadata(value: string): Promise<DoiMetadata | null> {
  const doi = normalizeDoi(value);
  if (hasDatabaseUrl()) {
    await ensureDatabaseSchema();
    const [row, publicSubmissions] = await Promise.all([
      withDb(async (client) => {
        const result = await client.query<DoiLookupRow>(
          `
            SELECT
              r.payload_json AS record_payload,
              p.payload_json AS publication_payload
            FROM atlas_dataset_releases rel
            JOIN atlas_canonical_records r ON r.release_id = rel.release_id
            LEFT JOIN atlas_canonical_publications p ON p.publication_id = r.publication_id
            WHERE rel.active = true
              AND (
                lower(COALESCE(p.doi_verified, r.doi_verified, '')) = $1
                OR lower(
                  regexp_replace(
                    regexp_replace(COALESCE(r.payload_json->>'compilation_source_doi_raw', ''), '^https?://(dx\\.)?doi\\.org/', '', 'i'),
                    '^doi:\\s*',
                    '',
                    'i'
                  )
                ) = $1
              )
            ORDER BY CASE WHEN lower(COALESCE(p.doi_verified, r.doi_verified, '')) = $1 THEN 0 ELSE 1 END
            LIMIT 1
          `,
          [doi]
        );
        return result.rows[0] ?? null;
      }),
      readPublicSubmissions()
    ]);
    if (row) {
      const record = recordFromRow(payloadToStringRecord(row.record_payload, "DOI lookup record payload"));
      const publication = row.publication_payload
        ? publicationFromRow(payloadToStringRecord(row.publication_payload, "DOI lookup publication payload"))
        : null;
      const metadata = doiMetadataFromRecord(record, publication, doi);
      if (metadata) return metadata;
    }
    for (const submission of publicSubmissions) {
      const metadata = doiMetadataFromRecord(submission.record, submission.publication, doi);
      if (metadata) return metadata;
    }
    return null;
  }

  const payload = getBundledExplorerPayload();
  const publicationByDoi = new Map(
    payload.publications
      .filter((publication) => publication.doi_verified)
      .map((publication) => [normalizeDoi(publication.doi_verified ?? ""), publication])
  );
  for (const record of payload.records) {
    const publication = publicationByDoi.get(normalizeDoi(record.doi_verified ?? "")) ?? null;
    const metadata = doiMetadataFromRecord(record, publication, doi);
    if (metadata) return metadata;
  }
  return null;
}

export async function getPublicationSearchCorpus(): Promise<{ records: PublicRecord[]; publications: Publication[] }> {
  const [canonical, publicSubmissions] = await Promise.all([
    hasDatabaseUrl()
      ? (async () => {
          await ensureDatabaseSchema();
          return withDb(async (client) => {
            const recordResult = await client.query<{ payload_json: unknown }>(
              `
                SELECT r.payload_json
                FROM atlas_dataset_releases rel
                JOIN atlas_canonical_records r ON r.release_id = rel.release_id
                WHERE rel.active = true
                ORDER BY r.record_id
              `
            );
            const publicationResult = await client.query<{ payload_json: unknown }>(
              `
                SELECT p.payload_json
                FROM atlas_dataset_releases rel
                JOIN atlas_canonical_publications p ON p.release_id = rel.release_id
                WHERE rel.active = true
                ORDER BY p.publication_id
              `
            );
            return {
              records: recordResult.rows.map((row, index) =>
                recordFromRow(payloadToStringRecord(row.payload_json, `Publication-search record ${index + 1}`))
              ),
              publications: publicationResult.rows.map((row, index) =>
                publicationFromRow(payloadToStringRecord(row.payload_json, `Publication-search publication ${index + 1}`))
              )
            };
          });
        })()
      : Promise.resolve({
          records: getBundledExplorerPayload().records,
          publications: getBundledExplorerPayload().publications
        }),
    readPublicSubmissions()
  ]);
  const records = new Map<string, PublicRecord>();
  canonical.records.forEach((record) => records.set(record.record_id, record));
  publicSubmissions.forEach((submission) => records.set(submission.record.record_id, submission.record));
  const publications = new Map<string, Publication>();
  canonical.publications.forEach((publication) => publications.set(publication.publication_id, publication));
  publicSubmissions.forEach((submission) => publications.set(submission.publication.publication_id, submission.publication));
  return { records: Array.from(records.values()), publications: Array.from(publications.values()) };
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
  const summary = getBundledReleaseSummary();
  return {
    release_id: "bundled-public-v0",
    schema_version: "carbon-property-tables-public-v0.4",
    source_hash: null,
    record_count: summary.recordCount,
    measurement_count: summary.measurementCount,
    publication_count: summary.publicationCount,
    imported_at: null,
    backend: "bundled_csv"
  };
}

export async function getExplorerBootstrap(): Promise<ExplorerBootstrap> {
  if (!hasDatabaseUrl()) return getBundledExplorerBootstrap();
  await ensureDatabaseSchema();
  const [release, baseProperties, row, publicSubmissions] = await Promise.all([
    readCanonicalReleaseMetadata(),
    getCanonicalPropertyCatalog(),
    withDb(async (client) => {
      const result = await client.query<BootstrapRow>(
        `
          SELECT
            count(*) AS record_count,
            array_agg(DISTINCT r.material_family ORDER BY r.material_family) AS material_families,
            array_agg(DISTINCT r.form_factor ORDER BY r.form_factor) AS form_factors,
            count(*) FILTER (WHERE r.peer_reviewed_measurement) AS primary_records,
            count(*) FILTER (WHERE r.contextual_benchmark) AS benchmark_records,
            count(*) FILTER (WHERE r.public_release_tier = 'peer_reviewed_research') AS peer_reviewed_research_records,
            count(*) FILTER (WHERE r.public_release_tier = 'peer_reviewed_contextual_comparator') AS peer_reviewed_comparator_records,
            count(*) FILTER (WHERE r.public_release_tier = 'commercial_contextual_comparator') AS commercial_comparator_records,
            count(*) FILTER (WHERE r.author_curated_compilation_record) AS author_curated_compilation_records,
            count(*) FILTER (
              WHERE r.author_curated_compilation_record
                AND r.primary_source_verification_status = 'verified_against_primary_source'
            ) AS primary_source_verified_compilation_records,
            count(*) FILTER (
              WHERE r.primary_source_verification_status = 'pending_independent_check'
            ) AS primary_source_check_pending_records,
            count(*) FILTER (WHERE r.strict_comparison_ready) AS strict_ready_records,
            min(r.publication_year) AS min_year,
            max(r.publication_year) AS max_year
          FROM atlas_dataset_releases rel
          JOIN atlas_canonical_records r ON r.release_id = rel.release_id
          WHERE rel.active = true
        `
      );
      if (result.rowCount !== 1) throw new Error("Canonical PostgreSQL bootstrap query returned no aggregate row.");
      return result.rows[0];
    }),
    readPublicSubmissions()
  ]);
  const count = (value: number | string) => Number(value);
  if (count(row.record_count) !== release.recordCount) {
    throw new Error("Canonical PostgreSQL bootstrap count does not match the active release metadata.");
  }
  const publicRecords = publicSubmissions.map((submission) => canonicalRecordFromSubmission(submission));
  const publicPlotRecords = publicRecords.map((item) => item.record);
  const properties = baseProperties.map((property) => ({
    ...property,
    recordsWithValue: property.recordsWithValue
      + publicPlotRecords.filter((record) => typeof record.values[property.key] === "number").length
  })).filter((property) => property.recordsWithValue > 0);
  const publicYears = publicPlotRecords
    .map((record) => record.publication_year_verified)
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year));
  const allYears = [
    ...(row.min_year === null ? [] : [count(row.min_year)]),
    ...(row.max_year === null ? [] : [count(row.max_year)]),
    ...publicYears
  ];
  const countPublic = (predicate: (record: PlotRecord) => boolean) => publicPlotRecords.filter(predicate).length;
  return {
    properties,
    families: Array.from(new Set([...(row.material_families ?? []), ...publicPlotRecords.map((record) => record.material_family)])).sort(),
    forms: Array.from(new Set([...(row.form_factors ?? []), ...publicPlotRecords.map((record) => record.form_factor)])).sort(),
    summary: {
      recordCount: release.recordCount + publicPlotRecords.length,
      measurementCount: release.measurementCount + publicRecords.reduce((total, item) => total + item.measurements.length, 0),
      primaryRecords: count(row.primary_records) + countPublic((record) => record.peer_reviewed_measurement),
      benchmarkRecords: count(row.benchmark_records) + countPublic((record) => record.contextual_benchmark),
      peerReviewedResearchRecords: count(row.peer_reviewed_research_records)
        + countPublic((record) => record.public_release_tier === "peer_reviewed_research"),
      peerReviewedComparatorRecords: count(row.peer_reviewed_comparator_records)
        + countPublic((record) => record.public_release_tier === "peer_reviewed_contextual_comparator"),
      commercialComparatorRecords: count(row.commercial_comparator_records)
        + countPublic((record) => record.public_release_tier === "commercial_contextual_comparator"),
      authorCuratedCompilationRecords: count(row.author_curated_compilation_records)
        + countPublic((record) => record.author_curated_compilation_record),
      primarySourceVerifiedCompilationRecords: count(row.primary_source_verified_compilation_records)
        + countPublic((record) => record.author_curated_compilation_record
          && record.primary_source_verification_status === "verified_against_primary_source"),
      primarySourceCheckPendingRecords: count(row.primary_source_check_pending_records)
        + countPublic((record) => record.primary_source_verification_status === "pending_independent_check"),
      strictReadyRecords: count(row.strict_ready_records) + countPublic((record) => record.strict_comparison_ready),
      minYear: allYears.length ? Math.min(...allYears) : null,
      maxYear: allYears.length ? Math.max(...allYears) : null
    }
  };
}

async function getCanonicalPropertyCatalog() {
  if (!hasDatabaseUrl()) {
    const summary = getBundledReleaseSummary();
    return PROPERTY_META_BASE
      .map((meta) => ({ ...meta, recordsWithValue: summary.measurementsByProperty[meta.key] ?? 0 }));
  }
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
    .map((meta) => ({ ...meta, recordsWithValue: counts.get(meta.key) ?? 0 }));
}

export async function getPropertyCatalog() {
  const [baseProperties, publicSubmissions] = await Promise.all([
    getCanonicalPropertyCatalog(),
    readPublicSubmissions()
  ]);
  const publicRecords = publicSubmissions.map((submission) => canonicalRecordFromSubmission(submission).record);
  return baseProperties.map((property) => ({
    ...property,
    recordsWithValue: property.recordsWithValue
      + publicRecords.filter((record) => typeof record.values[property.key] === "number").length
  })).filter((property) => property.recordsWithValue > 0);
}
