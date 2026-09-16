import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = `${await readFile(new URL("../migrations/001_launch_schema.sql", import.meta.url), "utf8")}\n${await readFile(new URL("../migrations/002_product_events.sql", import.meta.url), "utf8")}`;
const runtime = await readFile(new URL("../lib/db.ts", import.meta.url), "utf8");
const runner = await readFile(new URL("./migrate.mjs", import.meta.url), "utf8");

for (const table of [
  "users", "sessions", "workspaces", "workspace_update_leases",
  "password_reset_tokens", "auth_rate_limits", "discovery_search_cache", "discovery_credit_usage",
  "discovery_user_runs", "ai_response_cache", "ai_budget_usage",
  "product_events",
]) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  assert.match(runtime, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
}
assert.match(migration, /ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT/);
assert.match(runtime, /ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT/);
for (const table of [
  "users", "sessions", "workspaces", "workspace_update_leases", "password_reset_tokens",
  "auth_rate_limits", "discovery_search_cache", "discovery_credit_usage", "discovery_user_runs",
  "ai_response_cache", "ai_budget_usage",
  "product_events",
]) {
  assert.match(migration, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
  assert.match(runtime, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
}
assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_reset_tokens_user_id/);
assert.match(runtime, /CREATE UNIQUE INDEX IF NOT EXISTS idx_reset_tokens_user_id/);
assert.match(runner, /ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY/);

console.log("Migration parity checks passed.");
