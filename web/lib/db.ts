import { Pool, type PoolClient } from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";

let pool: Pool | null = null;
let migrationPromise: Promise<void> | null = null;
const readSnapshot = new AsyncLocalStorage<PoolClient>();

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    const sslRequested = process.env.PGSSLMODE === "require" || connectionString.includes("sslmode=require");
    pool = new Pool({
      connectionString,
      ssl: sslRequested ? { rejectUnauthorized: false } : undefined
    });
  }

  return pool;
}

export async function withDb<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const snapshot = readSnapshot.getStore();
  if (snapshot) return callback(snapshot);
  const client = await getPool().connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function withReadSnapshot<T>(callback: () => Promise<T>): Promise<T> {
  if (!hasDatabaseUrl() || readSnapshot.getStore()) return callback();
  await ensureDatabaseSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const value = await readSnapshot.run(client, callback);
    await client.query("COMMIT");
    return value;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function ensureDatabaseSchema(): Promise<void> {
  if (!hasDatabaseUrl()) return;
  migrationPromise ??= (async () => {
    const schemaPath = path.join(process.cwd(), "db", "schema.sql");
    const sql = await fs.readFile(schemaPath, "utf8");
    await getPool().query(sql);
    await getPool().query(
      "INSERT INTO atlas_schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
      ["schema-v0.4-scientific-comparability"]
    );
  })();
  await migrationPromise;
}
