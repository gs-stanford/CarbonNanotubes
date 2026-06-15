import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required to run database migrations.");
  process.exit(1);
}

const sslRequested = process.env.PGSSLMODE === "require" || connectionString.includes("sslmode=require");
const pool = new Pool({
  connectionString,
  ssl: sslRequested ? { rejectUnauthorized: false } : undefined
});

try {
  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const sql = await fs.readFile(schemaPath, "utf8");
  await pool.query(sql);
  await pool.query(
    "INSERT INTO atlas_schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
    ["schema-v0.1"]
  );
  console.log("Database schema is up to date.");
} finally {
  await pool.end();
}
