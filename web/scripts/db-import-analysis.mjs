import fs from "node:fs/promises";
import crypto from "node:crypto";
import pg from "pg";

const file = process.env.CPT_TRANSPORT_RESOURCE;
if (!file || !process.env.DATABASE_URL) throw new Error("CPT_TRANSPORT_RESOURCE and DATABASE_URL are required.");
const raw = await fs.readFile(file, "utf8");
if (/(\/Users\/|\/home\/|file:\/\/|matweb\.com)/i.test(raw)) throw new Error("Private or restricted-source content in analysis resource.");
const payload = JSON.parse(raw);
if (payload.schema !== "cpt-processing-analysis-v1" || !payload.version?.startsWith("transport-") || !Array.isArray(payload.contrasts)) throw new Error("Invalid processing resource.");
for (const c of payload.contrasts) {
  for (const pair of [c.sigma_MS_m, c.kappa_W_mK]) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.flat().every(n => Number.isFinite(n) && n > 0)) throw new Error("Invalid scientific input.");
  }
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: true } : undefined });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(725193)");
  const existing = await client.query("SELECT payload FROM atlas_analysis_resources WHERE name='transport' AND version=$1", [payload.version]);
  if (existing.rows.length && existing.rows[0].payload.resource_sha256 !== payload.resource_sha256) throw new Error("Immutable resource version collision.");
  await client.query("UPDATE atlas_analysis_resources SET active=false WHERE name='transport'");
  await client.query("INSERT INTO atlas_analysis_resources(name,version,payload,active) VALUES ('transport',$1,$2,true) ON CONFLICT(name,version) DO UPDATE SET active=true", [payload.version, payload]);
  await client.query("COMMIT");
  console.log(JSON.stringify({ version: payload.version, contrasts: payload.contrasts.length,
    file_sha256: crypto.createHash("sha256").update(raw).digest("hex") }));
} catch (e) { await client.query("ROLLBACK"); throw e; }
finally { client.release(); await pool.end(); }
