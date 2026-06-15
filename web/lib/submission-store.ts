import fs from "node:fs/promises";
import path from "node:path";
import {
  communitySubmissionsFile,
  readCommunitySubmissions,
  type CommunityAcceptedSubmission
} from "@/lib/data";
import { ensureDatabaseSchema, hasDatabaseUrl, withDb } from "@/lib/db";

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

type StoredMeasurementRow = {
  submission_id: string;
  measurement_json: unknown;
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
    schema_version: "cnt-property-atlas-community-v0.1",
    submission_id: row.submission_id,
    accepted_at: typeof row.accepted_at === "string" ? row.accepted_at : row.accepted_at.toISOString(),
    duplicate_check: row.duplicate_check,
    record: row.canonical_record,
    measurements,
    publication: row.canonical_publication
  });
  return candidate;
}

export async function readAcceptedSubmissions(): Promise<CommunityAcceptedSubmission[]> {
  if (!hasDatabaseUrl()) return readCommunitySubmissions();

  await ensureDatabaseSchema();
  return withDb(async (client) => {
    const submissions = await client.query<StoredSubmissionRow>(
      `
        SELECT submission_id, accepted_at, duplicate_check, canonical_record, canonical_publication
        FROM atlas_submissions
        WHERE public_visible = true
          AND status IN ('accepted', 'official')
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
  });
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
          VALUES ($1, $2, $3, $4, 'accepted', true, $5::text[], $6::text[], $7::text[], $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::timestamptz, now())
          ON CONFLICT (record_id) DO NOTHING
        `,
        [
          submission.submission_id,
          submission.record.record_id,
          submission.publication.publication_id,
          submission.record.doi_verified,
          submission.duplicate_check.matched_records,
          submission.record.issue_types ? submission.record.issue_types.split(";").map((item) => item.trim()).filter(Boolean) : [],
          [
            submission.record.public_plot_badge,
            submission.record.value_extraction_type,
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
              measurement_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
            ON CONFLICT (measurement_id) DO NOTHING
          `,
          [
            measurement.measurement_id,
            submission.submission_id,
            measurement.record_id,
            measurement.property,
            measurement.value_canonical,
            measurement.unit_canonical,
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
