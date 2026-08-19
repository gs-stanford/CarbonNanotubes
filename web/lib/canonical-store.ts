import { ensureDatabaseSchema, withDb } from "@/lib/db";

export type CanonicalReleaseRows = {
  release: {
    releaseId: string;
    schemaVersion: string;
    sourceHash: string;
    recordCount: number;
    measurementCount: number;
    publicationCount: number;
    importedAt: string;
  };
  records: Record<string, string>[];
  measurements: Record<string, string>[];
  publications: Record<string, string>[];
};

type ReleaseRow = {
  release_id: string;
  schema_version: string;
  source_hash: string;
  record_count: number;
  measurement_count: number;
  publication_count: number;
  imported_at: Date | string;
};

type PayloadRow = {
  payload_json: unknown;
};

let canonicalReleasePromise: Promise<CanonicalReleaseRows> | null = null;

function payloadFromJson(value: unknown, label: string): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} contains an invalid payload_json value.`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, item === null || item === undefined ? "" : String(item)])
  );
}

async function loadCanonicalRelease(): Promise<CanonicalReleaseRows> {
  await ensureDatabaseSchema();
  return withDb(async (client) => {
    const releaseResult = await client.query<ReleaseRow>(
      `
        SELECT release_id, schema_version, source_hash, record_count,
               measurement_count, publication_count, imported_at
        FROM atlas_dataset_releases
        WHERE active = true
      `
    );
    if (releaseResult.rowCount !== 1) {
      throw new Error(
        `Canonical PostgreSQL release is unavailable: expected one active release, found ${releaseResult.rowCount ?? 0}. Run npm run db:import-public.`
      );
    }
    const release = releaseResult.rows[0];

    const recordResult = await client.query<PayloadRow>(
      `
        SELECT payload_json
        FROM atlas_canonical_records
        WHERE release_id = $1
        ORDER BY record_id
      `,
      [release.release_id]
    );
    const measurementResult = await client.query<PayloadRow>(
      `
        SELECT payload_json
        FROM atlas_canonical_measurements
        WHERE release_id = $1
        ORDER BY measurement_id
      `,
      [release.release_id]
    );
    const publicationResult = await client.query<PayloadRow>(
      `
        SELECT payload_json
        FROM atlas_canonical_publications
        WHERE release_id = $1
        ORDER BY publication_id
      `,
      [release.release_id]
    );

    const actualCounts = {
      records: recordResult.rowCount ?? 0,
      measurements: measurementResult.rowCount ?? 0,
      publications: publicationResult.rowCount ?? 0
    };
    const expectedCounts = {
      records: Number(release.record_count),
      measurements: Number(release.measurement_count),
      publications: Number(release.publication_count)
    };
    for (const key of Object.keys(expectedCounts) as Array<keyof typeof expectedCounts>) {
      if (actualCounts[key] !== expectedCounts[key]) {
        throw new Error(
          `Canonical PostgreSQL ${key} count ${actualCounts[key]} does not match active release count ${expectedCounts[key]}.`
        );
      }
    }

    return {
      release: {
        releaseId: release.release_id,
        schemaVersion: release.schema_version,
        sourceHash: release.source_hash,
        recordCount: expectedCounts.records,
        measurementCount: expectedCounts.measurements,
        publicationCount: expectedCounts.publications,
        importedAt: new Date(release.imported_at).toISOString()
      },
      records: recordResult.rows.map((row, index) => payloadFromJson(row.payload_json, `Canonical record ${index + 1}`)),
      measurements: measurementResult.rows.map((row, index) => payloadFromJson(row.payload_json, `Canonical measurement ${index + 1}`)),
      publications: publicationResult.rows.map((row, index) => payloadFromJson(row.payload_json, `Canonical publication ${index + 1}`))
    };
  });
}

export function readCanonicalReleaseRows(): Promise<CanonicalReleaseRows> {
  canonicalReleasePromise ??= loadCanonicalRelease();
  return canonicalReleasePromise;
}
