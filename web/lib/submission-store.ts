import fs from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import {
  communitySubmissionsFile,
  readCommunitySubmissions,
  type CommunityAcceptedSubmission,
  type PublicRecord
} from "@/lib/data";
import { ensureDatabaseSchema, hasDatabaseUrl, withDb } from "@/lib/db";

export type ReviewStatus = "accepted" | "curator_hold" | "official" | "rejected" | "hidden";

export type AdminCleanupRun = {
  cleanup_run_id: string;
  status: "completed" | "failed";
  model: string | null;
  proposed_patch_json: unknown;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AdminSubmission = CommunityAcceptedSubmission & {
  review: {
    status: ReviewStatus;
    public_visible: boolean;
    ai_cleanup_status: string;
    issue_types: string[];
    flags: string[];
    duplicate_match_record_ids: string[];
    created_at: string;
    updated_at: string;
  };
  cleanup_runs: AdminCleanupRun[];
};

export type AdminSubmissionPatch = {
  status?: ReviewStatus;
  public_visible?: boolean;
  record_patch?: Partial<Pick<
    PublicRecord,
    | "record_label"
    | "sample_name"
    | "public_sample_label"
    | "material_family"
    | "form_factor"
    | "cnt_type"
    | "synthesis_method"
    | "postprocessing"
    | "test_standard"
    | "specimen_id"
    | "sample_batch_id"
    | "specimen_linkage"
    | "measurement_direction"
    | "density_basis"
    | "cross_section_method"
    | "normalization_basis"
    | "value_bound_type"
    | "statistic_type"
    | "sample_size_n"
    | "public_release_tier"
    | "default_plot_visibility"
    | "public_plot_badge"
    | "dataset_provenance"
    | "primary_source_verification_status"
    | "value_extraction_type"
    | "source_disclosure"
    | "citation_requirement"
    | "evidence_tier"
    | "missing_conditions"
    | "unit_inference_review_needed"
    | "strict_comparison_ready"
    | "normalized_comparison_eligible"
    | "exploratory_comparison_eligible"
    | "issue_types"
    | "required_action"
  >>;
};

type CleanupRunInput = {
  cleanupRunId: string;
  submissionId: string;
  status: "completed" | "failed";
  model: string | null;
  requestJson: unknown;
  responseJson: unknown;
  proposedPatchJson: unknown;
  errorMessage: string | null;
};

type StoredSubmissionRow = {
  submission_id: string;
  accepted_at: Date | string;
  duplicate_check: unknown;
  canonical_record: unknown;
  canonical_publication: unknown;
};

type AdminSubmissionRow = StoredSubmissionRow & {
  status: ReviewStatus;
  public_visible: boolean;
  ai_cleanup_status: string;
  duplicate_match_record_ids: string[] | null;
  issue_types: string[] | null;
  flags: string[] | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type StoredMeasurementRow = {
  submission_id: string;
  measurement_json: unknown;
};

type StoredCleanupRunRow = {
  cleanup_run_id: string;
  submission_id: string;
  status: "completed" | "failed";
  model: string | null;
  proposed_patch_json: unknown;
  error_message: string | null;
  created_at: Date | string;
  completed_at: Date | string | null;
};

async function writeCommunitySubmissionsFile(submissions: CommunityAcceptedSubmission[]) {
  const file = communitySubmissionsFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(submissions, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, file);
}

function assertAcceptedSubmission(value: unknown): CommunityAcceptedSubmission | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CommunityAcceptedSubmission>;
  if (!candidate.record?.record_id || !Array.isArray(candidate.measurements) || !candidate.publication?.publication_id) {
    return null;
  }
  return candidate as CommunityAcceptedSubmission;
}

function normalizeAcceptedSubmission(row: StoredSubmissionRow, measurements: unknown[]): CommunityAcceptedSubmission | null {
  const candidate = assertAcceptedSubmission({
    schema_version: "carbon-property-tables-community-v0.2",
    submission_id: row.submission_id,
    accepted_at: typeof row.accepted_at === "string" ? row.accepted_at : row.accepted_at.toISOString(),
    duplicate_check: row.duplicate_check,
    record: row.canonical_record,
    measurements,
    publication: row.canonical_publication
  });
  if (!candidate) return null;
  const legacyRecord = candidate.record as PublicRecord & {
    secondary_meta_analysis_record?: boolean;
    secondary_source_doi_raw?: string | null;
    secondary_source_title?: string | null;
    secondary_source_authors_short?: string | null;
    secondary_source_journal?: string | null;
    secondary_source_year?: number | null;
  };
  const authorCurated = Boolean(
    legacyRecord.author_curated_compilation_record || legacyRecord.secondary_meta_analysis_record
  );
  return {
    ...candidate,
    record: {
      ...legacyRecord,
      dataset_provenance: legacyRecord.dataset_provenance
        ?? (authorCurated ? "author_curated_published_compilation" : "community_submission"),
      dataset_provenance_detail: legacyRecord.dataset_provenance_detail
        ?? legacyRecord.dataset_provenance
        ?? (authorCurated ? "author_curated_published_compilation" : "community_submission"),
      primary_source_verification_status: legacyRecord.primary_source_verification_status
        ?? (authorCurated ? "verified_against_primary_source" : "submitter_claimed_pending_curator_check"),
      author_curated_compilation_record: authorCurated,
      test_standard: legacyRecord.test_standard ?? null,
      specimen_id: legacyRecord.specimen_id ?? null,
      sample_batch_id: legacyRecord.sample_batch_id ?? null,
      specimen_linkage: legacyRecord.specimen_linkage ?? "unknown",
      measurement_direction: legacyRecord.measurement_direction ?? null,
      density_basis: legacyRecord.density_basis ?? "unknown",
      cross_section_method: legacyRecord.cross_section_method ?? null,
      normalization_basis: legacyRecord.normalization_basis ?? "unknown",
      value_bound_type: legacyRecord.value_bound_type ?? "unspecified",
      statistic_type: legacyRecord.statistic_type ?? "unspecified",
      sample_size_n: legacyRecord.sample_size_n ?? null,
      comparability_model_version: legacyRecord.comparability_model_version ?? "cpt-property-pair-v1",
      compilation_source_doi_raw: legacyRecord.compilation_source_doi_raw ?? legacyRecord.secondary_source_doi_raw ?? null,
      compilation_source_title: legacyRecord.compilation_source_title ?? legacyRecord.secondary_source_title ?? null,
      compilation_source_authors_short: legacyRecord.compilation_source_authors_short ?? legacyRecord.secondary_source_authors_short ?? null,
      compilation_source_journal: legacyRecord.compilation_source_journal ?? legacyRecord.secondary_source_journal ?? null,
      compilation_source_year: legacyRecord.compilation_source_year ?? legacyRecord.secondary_source_year ?? null
    },
    measurements: candidate.measurements.map((measurement) => ({
      ...measurement,
      reported_value: measurement.reported_value ?? null,
      reported_unit: measurement.reported_unit ?? null,
      statistic_type: measurement.statistic_type ?? "unspecified",
      uncertainty_type: measurement.uncertainty_type ?? "not_reported",
      uncertainty_value_reported: measurement.uncertainty_value_reported ?? null,
      uncertainty_value_canonical: measurement.uncertainty_value_canonical ?? null,
      sample_size_n: measurement.sample_size_n ?? null,
      test_standard: measurement.test_standard ?? null,
      specimen_id: measurement.specimen_id ?? null,
      sample_batch_id: measurement.sample_batch_id ?? null,
      specimen_linkage: measurement.specimen_linkage ?? "unknown",
      measurement_set_id: measurement.measurement_set_id ?? null,
      measurement_direction: measurement.measurement_direction ?? null,
      density_basis: measurement.density_basis ?? "unknown",
      density_value_kg_m3: measurement.density_value_kg_m3 ?? null,
      density_source_locator: measurement.density_source_locator ?? null,
      cross_section_method: measurement.cross_section_method ?? null,
      normalization_basis: measurement.normalization_basis ?? "unknown",
      value_bound_type: measurement.value_bound_type ?? "unspecified",
      derivation_formula: measurement.derivation_formula ?? null,
      derivation_inputs_json: measurement.derivation_inputs_json ?? null,
      reported_or_derived: measurement.reported_or_derived ?? "reported",
      source_locator: measurement.source_locator ?? null,
      extraction_method: measurement.extraction_method ?? null
    }))
  };
}

function toIsoDate(value: Date | string | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function normalizeCleanupRun(row: StoredCleanupRunRow): AdminCleanupRun {
  return {
    cleanup_run_id: row.cleanup_run_id,
    status: row.status,
    model: row.model,
    proposed_patch_json: row.proposed_patch_json,
    error_message: row.error_message,
    created_at: toIsoDate(row.created_at) ?? "",
    completed_at: toIsoDate(row.completed_at)
  };
}

function normalizeAdminSubmission(row: AdminSubmissionRow, measurements: unknown[], cleanupRuns: StoredCleanupRunRow[]): AdminSubmission | null {
  const submission = normalizeAcceptedSubmission(row, measurements);
  if (!submission) return null;
  return {
    ...submission,
    review: {
      status: row.status,
      public_visible: row.public_visible,
      ai_cleanup_status: row.ai_cleanup_status,
      issue_types: row.issue_types ?? [],
      flags: row.flags ?? [],
      duplicate_match_record_ids: row.duplicate_match_record_ids ?? [],
      created_at: toIsoDate(row.created_at) ?? "",
      updated_at: toIsoDate(row.updated_at) ?? ""
    },
    cleanup_runs: cleanupRuns.map(normalizeCleanupRun)
  };
}

function splitTags(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function flagsForRecord(record: PublicRecord): string[] {
  return [
    record.public_plot_badge,
    record.dataset_provenance,
    record.primary_source_verification_status,
    record.missing_conditions ? "missing_conditions" : "",
    record.unit_inference_review_needed ? "unit_review" : ""
  ].filter(Boolean);
}

function publicVisibilityForStatus(status: ReviewStatus): boolean {
  return status === "official";
}

const RECORD_STRING_PATCH_FIELDS = [
  "record_label",
  "sample_name",
  "public_sample_label",
  "material_family",
  "form_factor",
  "cnt_type",
  "synthesis_method",
  "postprocessing",
  "test_standard",
  "specimen_id",
  "sample_batch_id",
  "specimen_linkage",
  "measurement_direction",
  "density_basis",
  "cross_section_method",
  "normalization_basis",
  "value_bound_type",
  "statistic_type",
  "public_release_tier",
  "default_plot_visibility",
  "public_plot_badge",
  "dataset_provenance",
  "primary_source_verification_status",
  "value_extraction_type",
  "source_disclosure",
  "citation_requirement",
  "evidence_tier",
  "issue_types",
  "required_action"
] as const;

const RECORD_BOOLEAN_PATCH_FIELDS = [
  "missing_conditions",
  "unit_inference_review_needed",
  "strict_comparison_ready",
  "normalized_comparison_eligible",
  "exploratory_comparison_eligible"
] as const;

function sanitizeRecordPatch(record: PublicRecord, patch: AdminSubmissionPatch["record_patch"]): PublicRecord {
  if (!patch || typeof patch !== "object") return record;
  const next = { ...record };
  const writableNext = next as unknown as Record<string, unknown>;

  for (const key of RECORD_STRING_PATCH_FIELDS) {
    const value = patch[key];
    if (typeof value === "string") {
      const clean = value.trim();
      if (clean) writableNext[key] = clean;
    }
  }

  for (const key of RECORD_BOOLEAN_PATCH_FIELDS) {
    const value = patch[key];
    if (typeof value === "boolean") {
      writableNext[key] = value;
    }
  }

  if (typeof patch.sample_size_n === "number" && Number.isInteger(patch.sample_size_n) && patch.sample_size_n > 0) {
    next.sample_size_n = patch.sample_size_n;
  }

  if (typeof patch.public_sample_label === "string") {
    const clean = patch.public_sample_label.trim();
    if (clean) {
      next.public_sample_label = clean;
      next.record_label = typeof patch.record_label === "string" && patch.record_label.trim() ? patch.record_label.trim() : clean;
      next.sample_name = typeof patch.sample_name === "string" && patch.sample_name.trim() ? patch.sample_name.trim() : clean;
    }
  }

  return next;
}

async function fetchAdminSubmission(client: PoolClient, submissionId: string): Promise<AdminSubmission | null> {
  const submissionResult = await client.query<AdminSubmissionRow>(
    `
      SELECT
        submission_id,
        accepted_at,
        duplicate_check,
        canonical_record,
        canonical_publication,
        status,
        public_visible,
        ai_cleanup_status,
        duplicate_match_record_ids,
        issue_types,
        flags,
        created_at,
        updated_at
      FROM atlas_submissions
      WHERE submission_id = $1 OR record_id = $1
      LIMIT 1
    `,
    [submissionId]
  );
  const row = submissionResult.rows[0];
  if (!row) return null;

  const measurements = await client.query<StoredMeasurementRow>(
    `
      SELECT submission_id, measurement_json
      FROM atlas_measurements
      WHERE submission_id = $1
      ORDER BY measurement_id ASC
    `,
    [row.submission_id]
  );
  const cleanupRuns = await client.query<StoredCleanupRunRow>(
    `
      SELECT cleanup_run_id, submission_id, status, model, proposed_patch_json, error_message, created_at, completed_at
      FROM atlas_ai_cleanup_runs
      WHERE submission_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `,
    [row.submission_id]
  );
  return normalizeAdminSubmission(
    row,
    measurements.rows.map((measurement) => measurement.measurement_json),
    cleanupRuns.rows
  );
}

export async function listAdminSubmissions(): Promise<AdminSubmission[]> {
  if (!hasDatabaseUrl()) {
    return readCommunitySubmissions().map((submission) => ({
      ...submission,
      review: {
        status: "accepted",
        public_visible: false,
        ai_cleanup_status: "not_requested",
        issue_types: splitTags(submission.record.issue_types),
        flags: flagsForRecord(submission.record),
        duplicate_match_record_ids: submission.duplicate_check.matched_records,
        created_at: submission.accepted_at,
        updated_at: submission.accepted_at
      },
      cleanup_runs: []
    }));
  }

  await ensureDatabaseSchema();
  return withDb(async (client) => {
    const submissions = await client.query<AdminSubmissionRow>(
      `
        SELECT
          submission_id,
          accepted_at,
          duplicate_check,
          canonical_record,
          canonical_publication,
          status,
          public_visible,
          ai_cleanup_status,
          duplicate_match_record_ids,
          issue_types,
          flags,
          created_at,
          updated_at
        FROM atlas_submissions
        ORDER BY updated_at DESC, accepted_at DESC
        LIMIT 500
      `
    );
    if (!submissions.rowCount) return [];

    const ids = submissions.rows.map((row) => row.submission_id);
    const measurementRows = await client.query<StoredMeasurementRow>(
      `
        SELECT submission_id, measurement_json
        FROM atlas_measurements
        WHERE submission_id = ANY($1::text[])
        ORDER BY measurement_id ASC
      `,
      [ids]
    );
    const cleanupRows = await client.query<StoredCleanupRunRow>(
      `
        SELECT cleanup_run_id, submission_id, status, model, proposed_patch_json, error_message, created_at, completed_at
        FROM atlas_ai_cleanup_runs
        WHERE submission_id = ANY($1::text[])
        ORDER BY created_at DESC
      `,
      [ids]
    );

    const measurementsBySubmission = new Map<string, unknown[]>();
    for (const row of measurementRows.rows) {
      const list = measurementsBySubmission.get(row.submission_id) ?? [];
      list.push(row.measurement_json);
      measurementsBySubmission.set(row.submission_id, list);
    }

    const cleanupBySubmission = new Map<string, StoredCleanupRunRow[]>();
    for (const row of cleanupRows.rows) {
      const list = cleanupBySubmission.get(row.submission_id) ?? [];
      if (list.length < 5) list.push(row);
      cleanupBySubmission.set(row.submission_id, list);
    }

    return submissions.rows
      .map((row) =>
        normalizeAdminSubmission(
          row,
          measurementsBySubmission.get(row.submission_id) ?? [],
          cleanupBySubmission.get(row.submission_id) ?? []
        )
      )
      .filter((submission): submission is AdminSubmission => submission !== null);
  });
}

export async function updateSubmissionReview(submissionId: string, patch: AdminSubmissionPatch): Promise<AdminSubmission | null> {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required for admin mutations.");
  }

  await ensureDatabaseSchema();
  return withDb(async (client) => {
    await client.query("BEGIN");
    try {
      const current = await client.query<AdminSubmissionRow>(
        `
          SELECT
            submission_id,
            accepted_at,
            duplicate_check,
            canonical_record,
            canonical_publication,
            status,
            public_visible,
            ai_cleanup_status,
            duplicate_match_record_ids,
            issue_types,
            flags,
            created_at,
            updated_at
          FROM atlas_submissions
          WHERE submission_id = $1 OR record_id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [submissionId]
      );
      const row = current.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }

      const nextStatus = patch.status ?? row.status;
      const requestedVisibility =
        typeof patch.public_visible === "boolean" ? patch.public_visible : publicVisibilityForStatus(nextStatus);
      const nextVisible = nextStatus === "official" && requestedVisibility;
      const currentRecord = assertAcceptedSubmission({
        schema_version: "cnt-property-atlas-community-v0.1",
        accepted_at: typeof row.accepted_at === "string" ? row.accepted_at : row.accepted_at.toISOString(),
        duplicate_check: row.duplicate_check,
        record: row.canonical_record,
        measurements: [],
        publication: row.canonical_publication
      })?.record;
      if (!currentRecord) {
        throw new Error("Stored submission has an invalid canonical record.");
      }

      const nextRecord = sanitizeRecordPatch(currentRecord, patch.record_patch);
      if (nextStatus === "official") {
        nextRecord.primary_source_verification_status = "verified_against_primary_source";
        nextRecord.public_plot_badge = "Curator-verified research";
        nextRecord.evidence_tier = "curator_verified_community_submission";
        nextRecord.source_disclosure = "Community-submitted record verified against the primary publication by a Carbon Property Tables curator.";
      }
      const issueTypes = splitTags(nextRecord.issue_types);
      const flags = flagsForRecord(nextRecord);

      await client.query(
        `
          UPDATE atlas_submissions
          SET
            status = $2,
            public_visible = $3,
            issue_types = $4::text[],
            flags = $5::text[],
            dataset_provenance = $6,
            primary_source_verification_status = $7,
            canonical_record = $8::jsonb,
            updated_at = now()
          WHERE submission_id = $1
        `,
        [
          row.submission_id,
          nextStatus,
          nextVisible,
          issueTypes,
          flags,
          nextRecord.dataset_provenance,
          nextRecord.primary_source_verification_status,
          JSON.stringify(nextRecord)
        ]
      );

      const updated = await fetchAdminSubmission(client, row.submission_id);
      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

async function readSubmissionSet(client: PoolClient, visibilityClause: string): Promise<CommunityAcceptedSubmission[]> {
  const submissions = await client.query<StoredSubmissionRow>(
    `
      SELECT submission_id, accepted_at, duplicate_check, canonical_record, canonical_publication
      FROM atlas_submissions
      WHERE ${visibilityClause}
      ORDER BY accepted_at ASC
    `
  );
  if (!submissions.rowCount) return [];

  const ids = submissions.rows.map((row) => row.submission_id);
  const measurementRows = await client.query<StoredMeasurementRow>(
    `
      SELECT submission_id, measurement_json
      FROM atlas_measurements
      WHERE submission_id = ANY($1::text[])
      ORDER BY measurement_id ASC
    `,
    [ids]
  );
  const bySubmission = new Map<string, unknown[]>();
  for (const row of measurementRows.rows) {
    const list = bySubmission.get(row.submission_id) ?? [];
    list.push(row.measurement_json);
    bySubmission.set(row.submission_id, list);
  }

  return submissions.rows
    .map((row) => normalizeAcceptedSubmission(row, bySubmission.get(row.submission_id) ?? []))
    .filter((submission): submission is CommunityAcceptedSubmission => submission !== null);
}

export async function readAcceptedSubmissions(): Promise<CommunityAcceptedSubmission[]> {
  if (!hasDatabaseUrl()) return readCommunitySubmissions();
  await ensureDatabaseSchema();
  return withDb((client) => readSubmissionSet(client, "status IN ('accepted', 'curator_hold', 'official')"));
}

export async function readPublicSubmissions(): Promise<CommunityAcceptedSubmission[]> {
  if (!hasDatabaseUrl()) return [];
  await ensureDatabaseSchema();
  return withDb((client) => readSubmissionSet(client, "status = 'official' AND public_visible = true"));
}

export async function saveAcceptedSubmission(submission: CommunityAcceptedSubmission, rawPayload: unknown): Promise<"postgres" | "file"> {
  if (!hasDatabaseUrl()) {
    const existing = readCommunitySubmissions();
    await writeCommunitySubmissionsFile([...existing, submission]);
    return "file";
  }

  await ensureDatabaseSchema();
  await withDb(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(
        `
          INSERT INTO atlas_publications (
            publication_id,
            doi_verified,
            title_verified,
            authors_short_verified,
            authors_full_verified,
            journal_verified,
            year_verified,
            issue_pages_verified,
            metadata_json,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
          ON CONFLICT (publication_id) DO UPDATE SET
            doi_verified = EXCLUDED.doi_verified,
            title_verified = EXCLUDED.title_verified,
            authors_short_verified = EXCLUDED.authors_short_verified,
            authors_full_verified = EXCLUDED.authors_full_verified,
            journal_verified = EXCLUDED.journal_verified,
            year_verified = EXCLUDED.year_verified,
            issue_pages_verified = EXCLUDED.issue_pages_verified,
            metadata_json = EXCLUDED.metadata_json,
            updated_at = now()
        `,
        [
          submission.publication.publication_id,
          submission.publication.doi_verified,
          submission.publication.title_verified,
          submission.publication.authors_short_verified,
          submission.publication.authors_full_verified,
          submission.publication.journal_verified,
          submission.publication.year_verified,
          submission.publication.issue_pages_verified,
          JSON.stringify(submission.publication)
        ]
      );

      await client.query(
        `
          INSERT INTO atlas_submissions (
            submission_id,
            record_id,
            publication_id,
            doi_verified,
            dataset_provenance,
            primary_source_verification_status,
            status,
            public_visible,
            duplicate_match_record_ids,
            issue_types,
            flags,
            raw_payload,
            canonical_record,
            canonical_publication,
            duplicate_check,
            accepted_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'accepted', false, $7::text[], $8::text[], $9::text[], $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::timestamptz, now())
          ON CONFLICT (record_id) DO NOTHING
        `,
        [
          submission.submission_id,
          submission.record.record_id,
          submission.publication.publication_id,
          submission.record.doi_verified,
          submission.record.dataset_provenance,
          submission.record.primary_source_verification_status,
          submission.duplicate_check.matched_records,
          submission.record.issue_types ? submission.record.issue_types.split(";").map((item) => item.trim()).filter(Boolean) : [],
          [
            submission.record.public_plot_badge,
            submission.record.dataset_provenance,
            submission.record.primary_source_verification_status,
            submission.record.missing_conditions ? "missing_conditions" : "",
            submission.record.unit_inference_review_needed ? "unit_review" : ""
          ].filter(Boolean),
          JSON.stringify(rawPayload),
          JSON.stringify(submission.record),
          JSON.stringify(submission.publication),
          JSON.stringify(submission.duplicate_check),
          submission.accepted_at
        ]
      );

      for (const measurement of submission.measurements) {
        await client.query(
          `
            INSERT INTO atlas_measurements (
              measurement_id,
              submission_id,
              record_id,
              property,
              value_canonical,
              unit_canonical,
              reported_value,
              reported_unit,
              statistic_type,
              uncertainty_type,
              uncertainty_value_reported,
              uncertainty_value_canonical,
              sample_size_n,
              test_standard,
              specimen_id,
              sample_batch_id,
              specimen_linkage,
              measurement_direction,
              density_basis,
              density_value_kg_m3,
              density_source_locator,
              cross_section_method,
              normalization_basis,
              value_bound_type,
              derivation_formula,
              derivation_inputs_json,
              reported_or_derived,
              source_locator,
              extraction_method,
              measurement_json
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
              $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
              $25, $26::jsonb, $27, $28, $29, $30::jsonb
            )
            ON CONFLICT (measurement_id) DO NOTHING
          `,
          [
            measurement.measurement_id,
            submission.submission_id,
            measurement.record_id,
            measurement.property,
            measurement.value_canonical,
            measurement.unit_canonical,
            measurement.reported_value,
            measurement.reported_unit,
            measurement.statistic_type,
            measurement.uncertainty_type,
            measurement.uncertainty_value_reported,
            measurement.uncertainty_value_canonical,
            measurement.sample_size_n,
            measurement.test_standard,
            measurement.specimen_id,
            measurement.sample_batch_id,
            measurement.specimen_linkage,
            measurement.measurement_direction,
            measurement.density_basis,
            measurement.density_value_kg_m3,
            measurement.density_source_locator,
            measurement.cross_section_method,
            measurement.normalization_basis,
            measurement.value_bound_type,
            measurement.derivation_formula,
            measurement.derivation_inputs_json,
            measurement.reported_or_derived,
            measurement.source_locator,
            measurement.extraction_method,
            JSON.stringify(measurement)
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
  return "postgres";
}

export async function hasStoredSubmission(recordId: string): Promise<boolean> {
  if (!hasDatabaseUrl()) {
    return readCommunitySubmissions().some((submission) => submission.record.record_id === recordId);
  }

  await ensureDatabaseSchema();
  const result = await withDb((client) =>
    client.query("SELECT 1 FROM atlas_submissions WHERE record_id = $1 LIMIT 1", [recordId])
  );
  return Boolean(result.rowCount);
}

export async function readStoredSubmission(submissionId: string): Promise<CommunityAcceptedSubmission | null> {
  if (!hasDatabaseUrl()) {
    return readCommunitySubmissions().find((submission) => submission.submission_id === submissionId || submission.record.record_id === submissionId) ?? null;
  }

  await ensureDatabaseSchema();
  return withDb(async (client) => {
    const submissionResult = await client.query<StoredSubmissionRow>(
      `
        SELECT submission_id, accepted_at, duplicate_check, canonical_record, canonical_publication
        FROM atlas_submissions
        WHERE submission_id = $1 OR record_id = $1
        LIMIT 1
      `,
      [submissionId]
    );
    const row = submissionResult.rows[0];
    if (!row) return null;
    const measurements = await client.query<StoredMeasurementRow>(
      `
        SELECT submission_id, measurement_json
        FROM atlas_measurements
        WHERE submission_id = $1
        ORDER BY measurement_id ASC
      `,
      [row.submission_id]
    );
    return normalizeAcceptedSubmission(row, measurements.rows.map((measurement) => measurement.measurement_json));
  });
}

export async function saveCleanupRun(run: CleanupRunInput): Promise<void> {
  if (!hasDatabaseUrl()) return;
  await ensureDatabaseSchema();
  await withDb(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(
        `
          INSERT INTO atlas_ai_cleanup_runs (
            cleanup_run_id,
            submission_id,
            status,
            model,
            request_json,
            response_json,
            proposed_patch_json,
            error_message,
            completed_at
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, now())
        `,
        [
          run.cleanupRunId,
          run.submissionId,
          run.status,
          run.model,
          JSON.stringify(run.requestJson),
          JSON.stringify(run.responseJson ?? null),
          JSON.stringify(run.proposedPatchJson ?? null),
          run.errorMessage
        ]
      );
      await client.query(
        `
          UPDATE atlas_submissions
          SET ai_cleanup_status = $2, updated_at = now()
          WHERE submission_id = $1
        `,
        [run.submissionId, run.status]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
