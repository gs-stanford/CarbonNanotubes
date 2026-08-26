import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const SCHEMA_VERSION = "carbon-property-tables-public-v0.4";
const FILES = {
  records: "public_records_v0.csv",
  measurements: "public_measurements_v0.csv",
  publications: "public_publications_v0.csv",
  summary: "public_release_summary.json"
};

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
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
    } else if (char === '"') {
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

  if (inQuotes) throw new Error("CSV ended inside a quoted field.");
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows.filter((items) => items.some((item) => item.length > 0));
}

function resolveDataDir() {
  const candidates = [
    path.join(process.cwd(), "data", "public"),
    path.join(process.cwd(), "..", "data", "public")
  ];
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, FILES.records)));
  if (!found) throw new Error(`Public release data not found. Checked: ${candidates.join(", ")}`);
  return found;
}

function readCsv(dataDir, fileName) {
  const raw = fs.readFileSync(path.join(dataDir, fileName));
  const parsed = parseCsv(raw.toString("utf8"));
  const headers = parsed[0] ?? [];
  if (!headers.length) throw new Error(`${fileName} has no header row.`);
  const rows = parsed.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`${fileName} row ${rowIndex + 2} has ${values.length} fields; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
  return { fileName, fileHash: sha256(raw), headers, rows };
}

function nullable(value) {
  const clean = String(value ?? "").trim();
  return clean && clean.toLowerCase() !== "nan" ? clean : null;
}

function numberOrNull(value) {
  const clean = nullable(value);
  if (clean === null) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonOrNull(value, label) {
  const clean = nullable(value);
  if (clean === null) return null;
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
}

function requiredNumber(value, label) {
  const parsed = numberOrNull(value);
  if (parsed === null) throw new Error(`${label} must be a finite number.`);
  return parsed;
}

function bool(value) {
  return String(value ?? "").trim().toLowerCase() === "true";
}

function normalizedDoi(value) {
  const doi = nullable(value)?.toLowerCase() ?? null;
  return doi && !doi.includes(";") ? doi : null;
}

function assertUnique(rows, key, label) {
  const seen = new Set();
  for (const row of rows) {
    const value = nullable(row[key]);
    if (!value) throw new Error(`${label} contains a row without ${key}.`);
    if (seen.has(value)) throw new Error(`${label} contains duplicate ${key}: ${value}`);
    seen.add(value);
  }
  return seen;
}

function rowHash(row) {
  return sha256(stableStringify(row));
}

function setHash(rows, idKey) {
  return sha256(
    rows
      .map((row) => `${row[idKey]}\t${rowHash(row)}`)
      .sort()
      .join("\n")
  );
}

export function loadPublicRelease(dataDir = resolveDataDir()) {
  const recordFile = readCsv(dataDir, FILES.records);
  const measurementFile = readCsv(dataDir, FILES.measurements);
  const publicationFile = readCsv(dataDir, FILES.publications);
  const summaryRaw = fs.readFileSync(path.join(dataDir, FILES.summary));
  const summary = JSON.parse(summaryRaw.toString("utf8"));

  const recordIds = assertUnique(recordFile.rows, "record_id", "public records");
  assertUnique(measurementFile.rows, "measurement_id", "public measurements");
  assertUnique(publicationFile.rows, "publication_id", "public publications");

  const recordProperties = new Set();
  for (const row of measurementFile.rows) {
    if (!recordIds.has(row.record_id)) {
      throw new Error(`Measurement ${row.measurement_id} references missing record ${row.record_id}.`);
    }
    requiredNumber(row.value_canonical, `Measurement ${row.measurement_id} value_canonical`);
    const pair = `${row.record_id}\u0000${row.property}`;
    if (recordProperties.has(pair)) {
      throw new Error(`Duplicate canonical measurement for record/property: ${row.record_id}/${row.property}`);
    }
    recordProperties.add(pair);
  }

  const publicationByDoi = new Map();
  for (const row of publicationFile.rows) {
    const doi = normalizedDoi(row.doi_verified);
    if (!doi) continue;
    if (publicationByDoi.has(doi)) throw new Error(`Duplicate publication DOI: ${doi}`);
    publicationByDoi.set(doi, row.publication_id);
  }

  const expectedCounts = {
    records: Number(summary.public_records),
    measurements: Number(summary.public_measurements),
    publications: Number(summary.public_publications)
  };
  const actualCounts = {
    records: recordFile.rows.length,
    measurements: measurementFile.rows.length,
    publications: publicationFile.rows.length
  };
  for (const key of Object.keys(actualCounts)) {
    if (expectedCounts[key] !== actualCounts[key]) {
      throw new Error(`Release summary ${key} count ${expectedCounts[key]} does not match CSV count ${actualCounts[key]}.`);
    }
  }

  const fileHashes = {
    [recordFile.fileName]: recordFile.fileHash,
    [measurementFile.fileName]: measurementFile.fileHash,
    [publicationFile.fileName]: publicationFile.fileHash,
    [FILES.summary]: sha256(summaryRaw)
  };
  const sourceHash = sha256(stableStringify({ schemaVersion: SCHEMA_VERSION, fileHashes }));
  const releaseId = `public-v0-${sourceHash.slice(0, 16)}`;

  const publications = publicationFile.rows.map((row) => ({
    publication_id: row.publication_id,
    release_id: releaseId,
    doi_verified: normalizedDoi(row.doi_verified),
    title_verified: nullable(row.title_verified),
    authors_short_verified: nullable(row.authors_short_verified),
    authors_full_verified: nullable(row.authors_full_verified),
    journal_verified: nullable(row.journal_verified),
    year_verified: numberOrNull(row.year_verified),
    issue_pages_verified: nullable(row.issue_pages_verified),
    validation_status: nullable(row.validation_status_enriched),
    public_source_type: nullable(row.public_source_type),
    row_hash: rowHash(row),
    payload_json: row
  }));

  const records = recordFile.rows.map((row) => ({
    record_id: row.record_id,
    release_id: releaseId,
    publication_id: publicationByDoi.get(normalizedDoi(row.doi_verified)) ?? null,
    doi_verified: nullable(row.doi_verified)?.toLowerCase() ?? null,
    record_label: nullable(row.record_label) ?? row.record_id,
    sample_name: nullable(row.sample_name) ?? nullable(row.record_label) ?? row.record_id,
    material_family: nullable(row.material_family) ?? "unknown",
    form_factor: nullable(row.form_factor) ?? "unknown",
    cnt_type: nullable(row.cnt_type),
    public_release_tier: nullable(row.public_release_tier) ?? "unknown",
    source_citation_class: nullable(row.source_citation_class) ?? "unknown",
    dataset_provenance: nullable(row.dataset_provenance) ?? "unknown",
    primary_source_verification_status: nullable(row.primary_source_verification_status) ?? "not_assessed",
    publication_year: numberOrNull(row.publication_year_verified),
    peer_reviewed_measurement: bool(row.peer_reviewed_measurement),
    contextual_benchmark: bool(row.contextual_benchmark),
    commercial_specsheet_benchmark: bool(row.commercial_specsheet_benchmark),
    author_curated_compilation_record: bool(row.author_curated_compilation_record),
    strict_comparison_ready: bool(row.strict_comparison_ready),
    specimen_id: nullable(row.specimen_id),
    sample_batch_id: nullable(row.sample_batch_id),
    specimen_linkage: nullable(row.specimen_linkage) ?? "unknown",
    density_basis: nullable(row.density_basis) ?? "unknown",
    cross_section_method: nullable(row.cross_section_method),
    normalization_basis: nullable(row.normalization_basis) ?? "unknown",
    value_bound_type: nullable(row.value_bound_type) ?? "unspecified",
    comparability_model_version: nullable(row.comparability_model_version) ?? "cpt-property-pair-v1",
    row_hash: rowHash(row),
    payload_json: row
  }));

  const measurements = measurementFile.rows.map((row) => ({
    measurement_id: row.measurement_id,
    release_id: releaseId,
    record_id: row.record_id,
    property: row.property,
    value_canonical: requiredNumber(row.value_canonical, `Measurement ${row.measurement_id} value_canonical`),
    unit_canonical: row.unit_canonical,
    reported_value: numberOrNull(row.reported_value),
    reported_unit: nullable(row.reported_unit),
    statistic_type: nullable(row.statistic_type) ?? "unspecified",
    uncertainty_type: nullable(row.uncertainty_type) ?? "not_reported",
    uncertainty_value_reported: numberOrNull(row.uncertainty_value_reported),
    uncertainty_value_canonical: numberOrNull(row.uncertainty_value_canonical),
    sample_size_n: numberOrNull(row.sample_size_n),
    test_standard: nullable(row.test_standard),
    specimen_id: nullable(row.specimen_id),
    sample_batch_id: nullable(row.sample_batch_id),
    specimen_linkage: nullable(row.specimen_linkage) ?? "unknown",
    measurement_set_id: nullable(row.measurement_set_id),
    measurement_direction: nullable(row.measurement_direction),
    density_basis: nullable(row.density_basis) ?? "unknown",
    density_value_kg_m3: numberOrNull(row.density_value_kg_m3),
    density_source_locator: nullable(row.density_source_locator),
    cross_section_method: nullable(row.cross_section_method),
    normalization_basis: nullable(row.normalization_basis) ?? "unknown",
    value_bound_type: nullable(row.value_bound_type) ?? "unspecified",
    derivation_formula: nullable(row.derivation_formula),
    derivation_inputs_json: jsonOrNull(row.derivation_inputs_json, `Measurement ${row.measurement_id} derivation_inputs_json`),
    reported_or_derived: nullable(row.reported_or_derived) ?? "reported",
    source_locator: nullable(row.source_locator),
    extraction_method: nullable(row.extraction_method),
    measurement_warning: nullable(row.measurement_warning) ?? "none",
    strict_plot_eligible: bool(row.strict_plot_eligible),
    normalized_plot_eligible: bool(row.normalized_plot_eligible),
    exploratory_plot_eligible: bool(row.exploratory_plot_eligible),
    row_hash: rowHash(row),
    payload_json: row
  }));

  return {
    manifest: {
      releaseId,
      schemaVersion: SCHEMA_VERSION,
      sourceHash,
      recordSetHash: setHash(recordFile.rows, "record_id"),
      measurementSetHash: setHash(measurementFile.rows, "measurement_id"),
      publicationSetHash: setHash(publicationFile.rows, "publication_id"),
      counts: actualCounts,
      fileHashes,
      sourceCommit: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? null,
      summary
    },
    records,
    measurements,
    publications
  };
}

async function insertChunks(client, sql, rows, chunkSize = 200) {
  for (let start = 0; start < rows.length; start += chunkSize) {
    await client.query(sql, [JSON.stringify(rows.slice(start, start + chunkSize))]);
  }
}

const INSERT_PUBLICATIONS = `
  INSERT INTO atlas_canonical_publications (
    publication_id, release_id, doi_verified, title_verified, authors_short_verified,
    authors_full_verified, journal_verified, year_verified, issue_pages_verified,
    validation_status, public_source_type, row_hash, payload_json
  )
  SELECT
    x.publication_id, x.release_id, x.doi_verified, x.title_verified, x.authors_short_verified,
    x.authors_full_verified, x.journal_verified, x.year_verified, x.issue_pages_verified,
    x.validation_status, x.public_source_type, x.row_hash, x.payload_json
  FROM jsonb_to_recordset($1::jsonb) AS x(
    publication_id text, release_id text, doi_verified text, title_verified text,
    authors_short_verified text, authors_full_verified text, journal_verified text,
    year_verified integer, issue_pages_verified text, validation_status text,
    public_source_type text, row_hash text, payload_json jsonb
  )
`;

const INSERT_RECORDS = `
  INSERT INTO atlas_canonical_records (
    record_id, release_id, publication_id, doi_verified, record_label, sample_name,
    material_family, form_factor, cnt_type, public_release_tier, source_citation_class,
    dataset_provenance, primary_source_verification_status, publication_year,
    peer_reviewed_measurement, contextual_benchmark, commercial_specsheet_benchmark,
    author_curated_compilation_record, strict_comparison_ready, specimen_id,
    sample_batch_id, specimen_linkage, density_basis, cross_section_method,
    normalization_basis, value_bound_type, comparability_model_version, row_hash, payload_json
  )
  SELECT
    x.record_id, x.release_id, x.publication_id, x.doi_verified, x.record_label, x.sample_name,
    x.material_family, x.form_factor, x.cnt_type, x.public_release_tier, x.source_citation_class,
    x.dataset_provenance, x.primary_source_verification_status, x.publication_year,
    x.peer_reviewed_measurement, x.contextual_benchmark, x.commercial_specsheet_benchmark,
    x.author_curated_compilation_record, x.strict_comparison_ready, x.specimen_id,
    x.sample_batch_id, x.specimen_linkage, x.density_basis, x.cross_section_method,
    x.normalization_basis, x.value_bound_type, x.comparability_model_version, x.row_hash, x.payload_json
  FROM jsonb_to_recordset($1::jsonb) AS x(
    record_id text, release_id text, publication_id text, doi_verified text,
    record_label text, sample_name text, material_family text, form_factor text,
    cnt_type text, public_release_tier text, source_citation_class text,
    dataset_provenance text, primary_source_verification_status text, publication_year integer,
    peer_reviewed_measurement boolean, contextual_benchmark boolean,
    commercial_specsheet_benchmark boolean, author_curated_compilation_record boolean,
    strict_comparison_ready boolean, specimen_id text, sample_batch_id text,
    specimen_linkage text, density_basis text, cross_section_method text,
    normalization_basis text, value_bound_type text, comparability_model_version text,
    row_hash text, payload_json jsonb
  )
`;

const INSERT_MEASUREMENTS = `
  INSERT INTO atlas_canonical_measurements (
    measurement_id, release_id, record_id, property, value_canonical, unit_canonical,
    reported_value, reported_unit, statistic_type, uncertainty_type,
    uncertainty_value_reported, uncertainty_value_canonical, sample_size_n,
    test_standard, specimen_id, sample_batch_id, specimen_linkage, measurement_set_id,
    measurement_direction, density_basis, density_value_kg_m3, density_source_locator,
    cross_section_method, normalization_basis, value_bound_type, derivation_formula,
    derivation_inputs_json, reported_or_derived, source_locator, extraction_method,
    measurement_warning, strict_plot_eligible, normalized_plot_eligible,
    exploratory_plot_eligible, row_hash, payload_json
  )
  SELECT
    x.measurement_id, x.release_id, x.record_id, x.property, x.value_canonical,
    x.unit_canonical, x.reported_value, x.reported_unit, x.statistic_type,
    x.uncertainty_type, x.uncertainty_value_reported, x.uncertainty_value_canonical,
    x.sample_size_n, x.test_standard, x.specimen_id, x.sample_batch_id,
    x.specimen_linkage, x.measurement_set_id, x.measurement_direction,
    x.density_basis, x.density_value_kg_m3, x.density_source_locator,
    x.cross_section_method, x.normalization_basis, x.value_bound_type,
    x.derivation_formula, x.derivation_inputs_json, x.reported_or_derived,
    x.source_locator, x.extraction_method,
    x.measurement_warning, x.strict_plot_eligible,
    x.normalized_plot_eligible, x.exploratory_plot_eligible, x.row_hash, x.payload_json
  FROM jsonb_to_recordset($1::jsonb) AS x(
    measurement_id text, release_id text, record_id text, property text,
    value_canonical double precision, unit_canonical text, reported_value double precision,
    reported_unit text, statistic_type text, uncertainty_type text,
    uncertainty_value_reported double precision, uncertainty_value_canonical double precision,
    sample_size_n integer, test_standard text, specimen_id text, sample_batch_id text,
    specimen_linkage text, measurement_set_id text, measurement_direction text,
    density_basis text, density_value_kg_m3 double precision, density_source_locator text,
    cross_section_method text, normalization_basis text, value_bound_type text,
    derivation_formula text, derivation_inputs_json jsonb, reported_or_derived text,
    source_locator text, extraction_method text, measurement_warning text,
    strict_plot_eligible boolean, normalized_plot_eligible boolean,
    exploratory_plot_eligible boolean, row_hash text, payload_json jsonb
  )
`;

function databaseSetHash(rows) {
  return sha256(rows.map((row) => `${row.id}\t${row.row_hash}`).sort().join("\n"));
}

function resultCount(result) {
  return Array.isArray(result.rows) ? result.rows.length : result.rowCount ?? result.affectedRows ?? 0;
}

async function readAndVerifyTable(client, table, idColumn, expectedCount, expectedHash, releaseId) {
  const result = await client.query(
    `SELECT ${idColumn} AS id, row_hash, payload_json FROM ${table} WHERE release_id = $1 ORDER BY ${idColumn}`,
    [releaseId]
  );
  const count = resultCount(result);
  if (count !== expectedCount) {
    throw new Error(`${table} count ${count} does not match expected ${expectedCount}.`);
  }
  for (const row of result.rows) {
    const payloadHash = sha256(stableStringify(row.payload_json));
    if (payloadHash !== row.row_hash) {
      throw new Error(`${table} row ${row.id} payload hash does not match its stored row hash.`);
    }
  }
  const actualHash = databaseSetHash(result.rows);
  if (actualHash !== expectedHash) {
    throw new Error(`${table} set hash ${actualHash} does not match expected ${expectedHash}.`);
  }
}

export async function verifyPublicRelease(client, manifest) {
  const releaseResult = await client.query(
    `
      SELECT release_id, source_hash, record_set_hash, measurement_set_hash,
             publication_set_hash, record_count, measurement_count, publication_count
      FROM atlas_dataset_releases
      WHERE active = true
    `
  );
  const releaseCount = resultCount(releaseResult);
  if (releaseCount !== 1) {
    throw new Error(`Expected exactly one active canonical release; found ${releaseCount}.`);
  }
  const active = releaseResult.rows[0];
  if (active.release_id !== manifest.releaseId || active.source_hash !== manifest.sourceHash) {
    throw new Error(`Active canonical release ${active.release_id} does not match bundled release ${manifest.releaseId}.`);
  }
  const declaredHashes = {
    records: active.record_set_hash,
    measurements: active.measurement_set_hash,
    publications: active.publication_set_hash
  };
  const expectedHashes = {
    records: manifest.recordSetHash,
    measurements: manifest.measurementSetHash,
    publications: manifest.publicationSetHash
  };
  for (const key of Object.keys(expectedHashes)) {
    if (declaredHashes[key] !== expectedHashes[key]) {
      throw new Error(`Active release declares the wrong ${key} set hash.`);
    }
  }

  const declaredCounts = {
    records: Number(active.record_count),
    measurements: Number(active.measurement_count),
    publications: Number(active.publication_count)
  };
  for (const key of Object.keys(manifest.counts)) {
    if (declaredCounts[key] !== manifest.counts[key]) {
      throw new Error(`Active release declares ${declaredCounts[key]} ${key}; expected ${manifest.counts[key]}.`);
    }
  }

  await readAndVerifyTable(
    client,
    "atlas_canonical_records",
    "record_id",
    manifest.counts.records,
    manifest.recordSetHash,
    manifest.releaseId
  );
  await readAndVerifyTable(
    client,
    "atlas_canonical_measurements",
    "measurement_id",
    manifest.counts.measurements,
    manifest.measurementSetHash,
    manifest.releaseId
  );
  await readAndVerifyTable(
    client,
    "atlas_canonical_publications",
    "publication_id",
    manifest.counts.publications,
    manifest.publicationSetHash,
    manifest.releaseId
  );

  const orphanResult = await client.query(
    `
      SELECT count(*)::integer AS count
      FROM atlas_canonical_measurements measurement
      LEFT JOIN atlas_canonical_records record ON record.record_id = measurement.record_id
      WHERE record.record_id IS NULL
    `
  );
  if (Number(orphanResult.rows[0]?.count ?? 0) !== 0) {
    throw new Error("Canonical measurement table contains orphaned records.");
  }

  return {
    releaseId: manifest.releaseId,
    sourceHash: manifest.sourceHash,
    counts: manifest.counts,
    parity: "exact"
  };
}

export async function importPublicRelease(client, release, options = {}) {
  const { manifest, publications, records, measurements } = release;
  await client.query("BEGIN");
  try {
    if (options.acquireLock !== false) {
      await client.query("SELECT pg_advisory_xact_lock($1)", [1386912441]);
    }
    await client.query(
      `
        INSERT INTO atlas_dataset_releases (
          release_id, schema_version, source_hash, record_set_hash, measurement_set_hash,
          publication_set_hash, record_count, measurement_count, publication_count,
          source_commit, active, metadata_json, imported_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11::jsonb, now())
        ON CONFLICT (release_id) DO UPDATE SET
          schema_version = EXCLUDED.schema_version,
          source_hash = EXCLUDED.source_hash,
          record_set_hash = EXCLUDED.record_set_hash,
          measurement_set_hash = EXCLUDED.measurement_set_hash,
          publication_set_hash = EXCLUDED.publication_set_hash,
          record_count = EXCLUDED.record_count,
          measurement_count = EXCLUDED.measurement_count,
          publication_count = EXCLUDED.publication_count,
          source_commit = EXCLUDED.source_commit,
          metadata_json = EXCLUDED.metadata_json,
          imported_at = now()
      `,
      [
        manifest.releaseId,
        manifest.schemaVersion,
        manifest.sourceHash,
        manifest.recordSetHash,
        manifest.measurementSetHash,
        manifest.publicationSetHash,
        manifest.counts.records,
        manifest.counts.measurements,
        manifest.counts.publications,
        manifest.sourceCommit,
        JSON.stringify({ file_hashes: manifest.fileHashes, public_release_summary: manifest.summary })
      ]
    );

    // Replace the canonical snapshot inside one transaction so readers see either complete release.
    await client.query("DELETE FROM atlas_canonical_measurements");
    await client.query("DELETE FROM atlas_canonical_records");
    await client.query("DELETE FROM atlas_canonical_publications");
    await insertChunks(client, INSERT_PUBLICATIONS, publications);
    await insertChunks(client, INSERT_RECORDS, records);
    await insertChunks(client, INSERT_MEASUREMENTS, measurements);
    await client.query("UPDATE atlas_dataset_releases SET active = false WHERE active = true");
    await client.query("UPDATE atlas_dataset_releases SET active = true WHERE release_id = $1", [manifest.releaseId]);

    const verification = await verifyPublicRelease(client, manifest);
    await client.query(
      "ALTER TABLE atlas_canonical_measurements VALIDATE CONSTRAINT atlas_canonical_measurements_scientific_domain_check"
    );
    await client.query("COMMIT");
    return verification;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function createPool(connectionString) {
  const sslRequested = process.env.PGSSLMODE === "require" || connectionString.includes("sslmode=require");
  return new Pool({
    connectionString,
    ssl: sslRequested ? { rejectUnauthorized: false } : undefined,
    max: 2
  });
}

async function main() {
  const release = loadPublicRelease();
  const dryRun = process.argv.includes("--dry-run");
  const verifyOnly = process.argv.includes("--verify-only");
  if (dryRun) {
    console.log(JSON.stringify({ ...release.manifest, validation: "pass" }, null, 2));
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to import or verify the canonical public release.");
  const pool = createPool(connectionString);
  const client = await pool.connect();
  try {
    const result = verifyOnly
      ? await verifyPublicRelease(client, release.manifest)
      : await importPublicRelease(client, release);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
