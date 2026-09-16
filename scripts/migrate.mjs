import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required to run migrations.");
new URL(databaseUrl);

const directory = path.join(process.cwd(), "migrations");
const files = (await readdir(directory))
  .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
  .sort();
if (!files.length) throw new Error("No migration files were found.");

const sql = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 15 });
try {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY`;
  await sql`SELECT pg_advisory_lock(724186030)`;
  try {
    for (const name of files) {
      const [existing] = await sql`SELECT name FROM schema_migrations WHERE name = ${name}`;
      if (existing) {
        console.log(`Already applied: ${name}`);
        continue;
      }
      const source = await readFile(path.join(directory, name), "utf8");
      await sql.begin(async (transaction) => {
        await transaction.unsafe(source);
        await transaction`INSERT INTO schema_migrations (name) VALUES (${name})`;
      });
      console.log(`Applied: ${name}`);
    }
  } finally {
    await sql`SELECT pg_advisory_unlock(724186030)`;
  }
} finally {
  await sql.end({ timeout: 5 });
}
