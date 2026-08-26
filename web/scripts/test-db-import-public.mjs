import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  importPublicRelease,
  loadPublicRelease,
  verifyPublicRelease
} from "./db-import-public.mjs";
import { buildCanonicalRecordQuery } from "../lib/query-sql.mjs";

const database = await PGlite.create({ dataDir: "memory://" });
const schema = await fs.readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");

try {
  await database.exec(schema);
  const release = loadPublicRelease();

  const firstImport = await importPublicRelease(database, release, { acquireLock: false });
  assert.equal(firstImport.parity, "exact");
  assert.deepEqual(firstImport.counts, {
    records: 1363,
    measurements: 5337,
    publications: 271
  });

  const secondImport = await importPublicRelease(database, release, { acquireLock: false });
  assert.deepEqual(secondImport, firstImport, "Repeated import must be idempotent.");

  const countResult = await database.query(`
    SELECT
      (SELECT count(*)::integer FROM atlas_canonical_records) AS records,
      (SELECT count(*)::integer FROM atlas_canonical_measurements) AS measurements,
      (SELECT count(*)::integer FROM atlas_canonical_publications) AS publications
  `);
  assert.deepEqual(countResult.rows[0], {
    records: 1363,
    measurements: 5337,
    publications: 271
  });

  await database.query(`
    INSERT INTO atlas_publications (
      publication_id, doi_verified, title_verified, metadata_json
    ) VALUES (
      'test-publication', '10.0000/cpt-curator-gate', 'Curator gate fixture', '{}'::jsonb
    )
  `);
  await database.query(`
    INSERT INTO atlas_submissions (
      submission_id,
      record_id,
      publication_id,
      doi_verified,
      raw_payload,
      canonical_record,
      canonical_publication,
      duplicate_check
    ) VALUES (
      'test-submission',
      'test-record',
      'test-publication',
      '10.0000/cpt-curator-gate',
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb
    )
  `);
  const pendingSubmission = await database.query(`
    SELECT status, public_visible
    FROM atlas_submissions
    WHERE submission_id = 'test-submission'
  `);
  assert.deepEqual(
    pendingSubmission.rows[0],
    { status: "accepted", public_visible: false },
    "Automated acceptance must remain hidden pending curator review."
  );
  await assert.rejects(
    () => database.query(`UPDATE atlas_submissions SET public_visible = true WHERE submission_id = 'test-submission'`),
    /atlas_submissions_official_visibility_check/,
    "PostgreSQL must reject public visibility for a non-official submission."
  );
  await database.query(`
    UPDATE atlas_submissions
    SET status = 'official', public_visible = true
    WHERE submission_id = 'test-submission'
  `);

  const multiPropertyPlan = buildCanonicalRecordQuery({
    limit: 20,
    doi: "https://doi.org/10.1126/science.adj1082",
    materialFamilies: ["CNT_or_CNT_hybrid"],
    measurementRanges: [
      { property: "density", minValue: 1300, maxValue: 1500 },
      { property: "tensile_strength", minValue: 8e9 }
    ]
  });
  const multiPropertyResult = await database.query(multiPropertyPlan.text, multiPropertyPlan.values);
  assert.deepEqual(
    multiPropertyResult.rows.map((row) => row.record_payload.record_id),
    ["rec_f8e2b6a26ecb"],
    "PostgreSQL query engine must apply same-record multi-property ranges."
  );

  const searchPlan = buildCanonicalRecordQuery({
    limit: 20,
    author: "Xinshi Zhang",
    q: "dynamic strength",
    requiredProperties: ["tensile_strength"]
  });
  const searchResult = await database.query(searchPlan.text, searchPlan.values);
  assert.equal(searchResult.rows.length, 4, "PostgreSQL query engine must search publication metadata.");

  const gaugeLengthPlan = buildCanonicalRecordQuery({ limit: 1, gaugeLengthMinMm: 0 });
  const gaugeLengthResult = await database.query(gaugeLengthPlan.text, gaugeLengthPlan.values);
  assert.equal(gaugeLengthResult.rows.length, 2, "PostgreSQL query engine must safely parse numeric condition fields.");

  const curatedPeerReviewedPlan = buildCanonicalRecordQuery({
    limit: 1,
    peerReviewed: true,
    provenance: ["author_curated_published_compilation"]
  });
  const curatedPeerReviewedResult = await database.query(curatedPeerReviewedPlan.text, curatedPeerReviewedPlan.values);
  assert.ok(
    curatedPeerReviewedResult.rows.length > 0,
    "Peer-reviewed filtering must retain verified author-curated literature records."
  );

  await database.query(`
    UPDATE atlas_canonical_records
    SET payload_json = '{}'::jsonb
    WHERE record_id = (SELECT record_id FROM atlas_canonical_records ORDER BY record_id LIMIT 1)
  `);
  await assert.rejects(
    () => verifyPublicRelease(database, release.manifest),
    /payload hash does not match/,
    "Parity verification must reject altered payloads."
  );

  await importPublicRelease(database, release, { acquireLock: false });
  const repaired = await verifyPublicRelease(database, release.manifest);
  assert.equal(repaired.parity, "exact");
  console.log(JSON.stringify({ status: "pass", ...repaired }, null, 2));
} finally {
  await database.close();
}
