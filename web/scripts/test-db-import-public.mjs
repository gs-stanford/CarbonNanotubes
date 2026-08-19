import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  importPublicRelease,
  loadPublicRelease,
  verifyPublicRelease
} from "./db-import-public.mjs";

const database = await PGlite.create({ dataDir: "memory://" });
const schema = await fs.readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");

try {
  await database.exec(schema);
  const release = loadPublicRelease();

  const firstImport = await importPublicRelease(database, release, { acquireLock: false });
  assert.equal(firstImport.parity, "exact");
  assert.deepEqual(firstImport.counts, {
    records: 1366,
    measurements: 5344,
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
    records: 1366,
    measurements: 5344,
    publications: 271
  });

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
