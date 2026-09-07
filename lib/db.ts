import Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createInitialWorkspaceState } from "@/lib/hunteragent-data";
import { WorkspaceState } from "@/lib/hunteragent-types";

const STORE_DIR = path.join(process.cwd(), ".data");
const LEGACY_SQLITE_PATH = path.join(STORE_DIR, "hunteragent.db");
const LEGACY_WORKSPACE_PATH = path.join(STORE_DIR, "hunteragent-workspace.json");

declare global {
  var __hunteragentPg: postgres.Sql | undefined;
  var __hunteragentDbInit: Promise<void> | undefined;
}

function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("Missing DATABASE_URL. Add your Supabase transaction pooler URL before starting HunterAgent.");
  }

  // Validate parsability. If it fails, the password likely contains unencoded
  // special characters (@ # / ?) — percent-encode the user:password segment.
  try {
    new URL(value);
    return value;
  } catch {
    // Attempt an auto-fix by percent-encoding reserved characters in the
    // password portion between the scheme and final host separator.
    const schemeEnd = value.indexOf("://");
    if (schemeEnd !== -1) {
      const afterScheme = value.slice(schemeEnd + 3);
      const atIndex = afterScheme.lastIndexOf("@");
      if (atIndex !== -1) {
        const userInfo = afterScheme.slice(0, atIndex);
        const hostAndRest = afterScheme.slice(atIndex + 1);
        const colonIndex = userInfo.indexOf(":");
        if (colonIndex !== -1) {
          const user = userInfo.slice(0, colonIndex);
          const pass = userInfo.slice(colonIndex + 1);
          const encodedPass = encodeURIComponent(pass);
          const fixed = `${value.slice(0, schemeEnd + 3)}${user}:${encodedPass}@${hostAndRest}`;
          try {
            new URL(fixed);
            return fixed;
          } catch {
            // fall through to the error below
          }
        }
      }
    }

    // Detect unfilled template placeholders like [project-ref] or [region]
    if (/\[[^\]]+\]/.test(value)) {
      throw new Error(
        "DATABASE_URL still contains template placeholders (e.g. [project-ref], [region]). " +
        "Go to Supabase → Settings → Database → Connection string (Transaction pooler) " +
        "and copy the full URL with your real project reference and region."
      );
    }

    throw new Error(
      "DATABASE_URL is not a valid URL. If your Supabase password contains special characters " +
      "(@, #, /, ?, etc.) they must be percent-encoded. " +
      "Go to Supabase → Settings → Database → Connection string and copy the URL exactly as shown, " +
      "or manually replace @ with %40, # with %23, etc. in the password portion."
    );
  }
}

function getSql() {
  if (!global.__hunteragentPg) {
    global.__hunteragentPg = postgres(requireDatabaseUrl(), {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }

  return global.__hunteragentPg;
}

export async function checkDatabaseConnectivity(timeoutMs = 5_000): Promise<boolean> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) return false;

  try {
    const query = getSql()<[{ ok: number }]>`SELECT 1 AS ok`;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        query.cancel();
        reject(new Error("Database health check timed out."));
      }, timeoutMs);
    });

    try {
      const rows = await Promise.race([query, timedOut]);
      return rows[0]?.ok === 1;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

async function initializeSchema() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      ip_address TEXT
    )
  `;
  await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS workspace_update_leases (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      lease_token TEXT NOT NULL,
      lease_until TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`ALTER TABLE workspace_update_leases ENABLE ROW LEVEL SECURITY`;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_rate_limits (
      key_hash TEXT PRIMARY KEY,
      hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
      window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reset_tokens_token_hash ON password_reset_tokens(token_hash)`;
  await sql`
    DELETE FROM password_reset_tokens older
    USING password_reset_tokens newer
    WHERE older.user_id = newer.user_id
      AND (older.created_at < newer.created_at OR (older.created_at = newer.created_at AND older.id < newer.id))
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON password_reset_tokens(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_updated_at ON auth_rate_limits(updated_at)`;
  // Supabase can grant Data API roles access to public-schema tables. With no
  // policies, these records remain available only to the server connection.
  await sql`ALTER TABLE users ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE sessions ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY`;

  // Only public search snippets belong here, never profiles or personalized roles.
  await sql`
    CREATE TABLE IF NOT EXISTS discovery_search_cache (
      cache_key TEXT PRIMARY KEY,
      results JSONB NOT NULL DEFAULT '[]'::jsonb,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
      lease_token TEXT,
      lease_until TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS discovery_credit_usage (
      scope TEXT NOT NULL,
      credit_day DATE NOT NULL,
      credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
      PRIMARY KEY (scope, credit_day)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS discovery_user_runs (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_started_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Supabase may grant anon/authenticated privileges by default. No policies:
  // only the server's owner/BYPASSRLS connection may use these internal tables.
  await sql`ALTER TABLE discovery_search_cache ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE discovery_credit_usage ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE discovery_user_runs ENABLE ROW LEVEL SECURITY`;
  await sql`CREATE INDEX IF NOT EXISTS idx_discovery_cache_expiry ON discovery_search_cache(expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_discovery_credit_day ON discovery_credit_usage(credit_day)`;

  await sql`
    CREATE TABLE IF NOT EXISTS ai_response_cache (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cache_key TEXT NOT NULL,
      response_text TEXT,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
      lease_token TEXT,
      lease_until TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, cache_key)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ai_budget_usage (
      scope TEXT NOT NULL,
      budget_day DATE NOT NULL,
      cents BIGINT NOT NULL DEFAULT 0 CHECK (cents >= 0 AND cents <= 9007199254740991),
      PRIMARY KEY (scope, budget_day)
    )
  `;
  // Sensitive generated content and spending controls are server-only too.
  await sql`ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE ai_budget_usage ENABLE ROW LEVEL SECURITY`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ai_cache_updated_at ON ai_response_cache(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ai_budget_day ON ai_budget_usage(budget_day)`;

  await sql`
    CREATE TABLE IF NOT EXISTS product_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_name TEXT NOT NULL,
      properties JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE product_events ENABLE ROW LEVEL SECURITY`;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_events_user_time ON product_events(user_id, occurred_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_product_events_name_time ON product_events(event_name, occurred_at DESC)`;

  await migrateLegacyStateIfNeeded(sql);
}

async function ensureDatabaseInitialized() {
  if (!global.__hunteragentDbInit) {
    global.__hunteragentDbInit = initializeSchema().catch((error) => {
      global.__hunteragentDbInit = undefined;
      throw error;
    });
  }

  await global.__hunteragentDbInit;
}

async function migrateLegacyStateIfNeeded(sql: postgres.Sql) {
  const [userCountRow] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM users`;
  const [workspaceCountRow] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM workspaces`;
  const [sessionCountRow] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM sessions`;

  const hasData = Number(userCountRow?.count ?? 0) > 0 || Number(workspaceCountRow?.count ?? 0) > 0 || Number(sessionCountRow?.count ?? 0) > 0;
  if (hasData) return;

  if (existsSync(LEGACY_SQLITE_PATH)) {
    const legacyDb = new Database(LEGACY_SQLITE_PATH, { readonly: true, fileMustExist: false });
    try {
      const tables = legacyDb
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'sessions', 'workspaces')")
        .all() as Array<{ name: string }>;
      const tableNames = new Set(tables.map((table) => table.name));

      if (tableNames.has("users")) {
        const users = legacyDb.prepare("SELECT * FROM users").all() as DbUserRow[];
        for (const user of users) {
          await sql`
            INSERT INTO users (id, email, full_name, password_hash, created_at, updated_at)
            VALUES (${user.id}, ${user.email}, ${user.full_name}, ${user.password_hash}, ${user.created_at}, ${user.updated_at})
            ON CONFLICT (id) DO NOTHING
          `;
        }
      }

      if (tableNames.has("sessions")) {
        const sessions = legacyDb.prepare("SELECT * FROM sessions").all() as DbSessionRow[];
        for (const session of sessions) {
          await sql`
            INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
            VALUES (${session.id}, ${session.user_id}, ${session.token_hash}, ${session.expires_at}, ${session.created_at})
            ON CONFLICT (id) DO NOTHING
          `;
        }
      }

      if (tableNames.has("workspaces")) {
        const workspaces = legacyDb.prepare("SELECT * FROM workspaces").all() as DbWorkspaceRow[];
        for (const workspace of workspaces) {
          await sql`
            INSERT INTO workspaces (user_id, state_json, updated_at)
            VALUES (${workspace.user_id}, ${workspace.state_json}, ${workspace.updated_at})
            ON CONFLICT (user_id) DO NOTHING
          `;
        }
      }

      return;
    } catch {
      // fall through to JSON legacy import
    } finally {
      legacyDb.close();
    }
  }

  if (existsSync(LEGACY_WORKSPACE_PATH)) {
    try {
      const workspace = JSON.parse(readFileSync(LEGACY_WORKSPACE_PATH, "utf8")) as WorkspaceState;
      void workspace;
    } catch {
      // no-op: legacy JSON is only used when a new user is created
    }
  }
}

export type DbUserRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export type DbSessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  ip_address: string | null;
};

export type DbWorkspaceRow = {
  user_id: string;
  state_json: string;
  updated_at: string;
};

export type DbPasswordResetTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

export async function getUserByEmail(email: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  const rows = await sql<DbUserRow[]>`SELECT * FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
  return rows[0];
}

export async function getUserById(id: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  const rows = await sql<DbUserRow[]>`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0];
}

export async function insertUser(row: DbUserRow) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`
    INSERT INTO users (id, email, full_name, password_hash, created_at, updated_at)
    VALUES (${row.id}, ${row.email}, ${row.full_name}, ${row.password_hash}, ${row.created_at}, ${row.updated_at})
  `;
}

export async function updateUserName(userId: string, fullName: string, updatedAt: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`UPDATE users SET full_name = ${fullName}, updated_at = ${updatedAt} WHERE id = ${userId}`;
}

export async function updateUserPassword(userId: string, passwordHash: string, updatedAt: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`UPDATE users SET password_hash = ${passwordHash}, updated_at = ${updatedAt} WHERE id = ${userId}`;
}

export async function insertSession(row: DbSessionRow) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, ip_address)
    VALUES (${row.id}, ${row.user_id}, ${row.token_hash}, ${row.expires_at}, ${row.created_at}, ${row.ip_address ?? null})
  `;
}

export async function getSessionByTokenHash(tokenHash: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  const rows = await sql<DbSessionRow[]>`SELECT * FROM sessions WHERE token_hash = ${tokenHash} LIMIT 1`;
  return rows[0];
}

export async function deleteSessionByTokenHash(tokenHash: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
}

export async function deleteSessionsForUser(userId: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
}

export async function pruneExpiredSessions(nowIso: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`DELETE FROM sessions WHERE expires_at <= ${nowIso}`;
}

export async function getWorkspaceRow(userId: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  const rows = await sql<DbWorkspaceRow[]>`SELECT * FROM workspaces WHERE user_id = ${userId} LIMIT 1`;
  return rows[0];
}

export async function upsertWorkspaceRow(userId: string, stateJson: string, updatedAt: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`
    INSERT INTO workspaces (user_id, state_json, updated_at)
    VALUES (${userId}, ${stateJson}, ${updatedAt})
    ON CONFLICT (user_id) DO UPDATE
      SET state_json = EXCLUDED.state_json,
          updated_at = EXCLUDED.updated_at
  `;
}

export async function claimWorkspaceUpdateLease(userId: string, token: string, leaseSeconds = 60) {
  if (!userId || !token || !Number.isSafeInteger(leaseSeconds) || leaseSeconds < 5 || leaseSeconds > 120) return false;
  await ensureDatabaseInitialized();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO workspace_update_leases (user_id, lease_token, lease_until)
    VALUES (${userId}, ${token}, now() + ${leaseSeconds} * interval '1 second')
    ON CONFLICT (user_id) DO UPDATE
      SET lease_token = EXCLUDED.lease_token, lease_until = EXCLUDED.lease_until
      WHERE workspace_update_leases.lease_until <= now()
    RETURNING user_id
  `;
  return rows.length === 1;
}

export async function releaseWorkspaceUpdateLease(userId: string, token: string) {
  if (!userId || !token) return;
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`DELETE FROM workspace_update_leases WHERE user_id = ${userId} AND lease_token = ${token}`;
}

/** Persist read-time normalization only if the workspace has not changed. */
export async function normalizeWorkspaceRowIfUnchanged(
  userId: string,
  originalStateJson: string,
  normalizedStateJson: string,
  updatedAt: string,
): Promise<boolean> {
  await ensureDatabaseInitialized();
  const sql = getSql();
  const rows = await sql`
    UPDATE workspaces SET state_json = ${normalizedStateJson}, updated_at = ${updatedAt}
    WHERE user_id = ${userId} AND state_json = ${originalStateJson}
    RETURNING user_id
  `;
  return rows.length === 1;
}

export const compareAndSwapWorkspaceRow = normalizeWorkspaceRowIfUnchanged;

export async function insertPasswordResetToken(row: DbPasswordResetTokenRow) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
    VALUES (${row.id}, ${row.user_id}, ${row.token_hash}, ${row.expires_at}, ${row.created_at})
    ON CONFLICT (user_id) DO UPDATE SET
      id = EXCLUDED.id,
      token_hash = EXCLUDED.token_hash,
      expires_at = EXCLUDED.expires_at,
      created_at = EXCLUDED.created_at
  `;
}

export async function getPasswordResetTokenByHash(tokenHash: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  const rows = await sql<DbPasswordResetTokenRow[]>`SELECT * FROM password_reset_tokens WHERE token_hash = ${tokenHash} LIMIT 1`;
  return rows[0];
}

export async function deletePasswordResetToken(tokenHash: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`DELETE FROM password_reset_tokens WHERE token_hash = ${tokenHash}`;
}

export async function resetUserPasswordWithToken(
  tokenHash: string,
  passwordHash: string,
  updatedAt: string,
  nowIso: string,
) {
  if (![tokenHash, passwordHash, updatedAt, nowIso].every((value) => typeof value === "string" && value.length > 0)) {
    return false;
  }
  await ensureDatabaseInitialized();
  const sql = getSql();
  return sql.begin(async (tx) => {
    const rows = await tx<{ user_id: string }[]>`
      DELETE FROM password_reset_tokens
      WHERE token_hash = ${tokenHash} AND expires_at > ${nowIso}
      RETURNING user_id
    `;
    const userId = rows[0]?.user_id;
    if (!userId) return false;
    await tx`UPDATE users SET password_hash = ${passwordHash}, updated_at = ${updatedAt} WHERE id = ${userId}`;
    await tx`DELETE FROM sessions WHERE user_id = ${userId}`;
    return true;
  });
}

export async function consumeAuthRateLimit(keyHash: string, maxHits: number, windowSeconds: number) {
  if (!/^[a-f0-9]{64}$/.test(keyHash)
    || !Number.isSafeInteger(maxHits) || maxHits < 1 || maxHits > 1000
    || !Number.isSafeInteger(windowSeconds) || windowSeconds < 60 || windowSeconds > 86_400) {
    return false;
  }
  try {
    await ensureDatabaseInitialized();
    const sql = getSql();
    const rows = await sql<{ allowed: boolean }[]>`
      INSERT INTO auth_rate_limits (key_hash, hits, window_started_at, updated_at)
      VALUES (${keyHash}, 1, now(), now())
      ON CONFLICT (key_hash) DO UPDATE SET
        hits = CASE
          WHEN auth_rate_limits.window_started_at <= now() - ${windowSeconds} * interval '1 second' THEN 1
          ELSE auth_rate_limits.hits + 1
        END,
        window_started_at = CASE
          WHEN auth_rate_limits.window_started_at <= now() - ${windowSeconds} * interval '1 second' THEN now()
          ELSE auth_rate_limits.window_started_at
        END,
        updated_at = now()
      RETURNING hits <= ${maxHits} AS allowed
    `;
    return rows[0]?.allowed === true;
  } catch {
    return false;
  }
}

export async function deleteUser(userId: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`DELETE FROM users WHERE id = ${userId}`;
}

export async function listWorkspaceRows() {
  await ensureDatabaseInitialized();
  const sql = getSql();
  return await sql<DbWorkspaceRow[]>`SELECT * FROM workspaces`;
}

export async function ensureWorkspaceForUser(userId: string) {
  const existing = await getWorkspaceRow(userId);
  if (existing) return existing;

  const initialState = await readLegacyWorkspaceOrInitial();
  const nowIso = new Date().toISOString();
  await upsertWorkspaceRow(userId, JSON.stringify(initialState, null, 2), nowIso);
  return (await getWorkspaceRow(userId))!;
}

async function readLegacyWorkspaceOrInitial(): Promise<WorkspaceState> {
  await ensureDatabaseInitialized();
  const rows = await listWorkspaceRows();
  if (rows.length === 0 && existsSync(LEGACY_WORKSPACE_PATH)) {
    try {
      return JSON.parse(readFileSync(LEGACY_WORKSPACE_PATH, "utf8")) as WorkspaceState;
    } catch {
      return createInitialWorkspaceState();
    }
  }

  return createInitialWorkspaceState();
}

export type PublicSearchResult = {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
  firstSeenAt: string;
};

export async function readDiscoveryCache(key: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  const [row] = await sql<{ results: PublicSearchResult[]; fresh: boolean }[]>`
    SELECT results, expires_at > now() AS fresh
    FROM discovery_search_cache WHERE cache_key = ${key}
  `;
  return row ?? null;
}

export async function claimDiscoveryCache(key: string, token: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO discovery_search_cache (cache_key, lease_token, lease_until)
    VALUES (${key}, ${token}, now() + interval '60 seconds')
    ON CONFLICT (cache_key) DO UPDATE
      SET lease_token = EXCLUDED.lease_token, lease_until = EXCLUDED.lease_until
      WHERE discovery_search_cache.expires_at <= now()
        AND discovery_search_cache.lease_until <= now()
    RETURNING cache_key
  `;
  return rows.length === 1;
}

export async function writeDiscoveryCache(key: string, token: string, results: PublicSearchResult[], ttlSeconds: number) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`
    UPDATE discovery_search_cache
    SET results = ${JSON.stringify(results)}::jsonb,
        expires_at = now() + ${ttlSeconds} * interval '1 second',
        lease_until = '-infinity', lease_token = NULL, updated_at = now()
    WHERE cache_key = ${key} AND lease_token = ${token} AND lease_until > now()
  `;
}

export async function releaseDiscoveryCache(key: string, token: string) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`
    UPDATE discovery_search_cache SET lease_until = '-infinity', lease_token = NULL
    WHERE cache_key = ${key} AND lease_token = ${token}
  `;
}

export async function reserveDiscoveryCredits(userId: string, credits: number, userLimit: number, globalLimit: number) {
  if (!userId || ![1, 2].includes(credits) || !Number.isSafeInteger(userLimit) || !Number.isSafeInteger(globalLimit)
    || userLimit < credits || globalLimit < credits) return false;
  await ensureDatabaseInitialized();
  const sql = getSql();
  return sql.begin(async (tx) => {
    // One transaction-scoped lock serializes BOTH counters across all instances.
    // Failed/ambiguous provider calls keep their reservation: never undercount spend.
    await tx`SELECT pg_advisory_xact_lock(724186031)`;
    const scope = `user:${userId}`;
    const rows = await tx<{ scope: string; credits: number }[]>`
      SELECT scope, credits FROM discovery_credit_usage
      WHERE credit_day = (now() AT TIME ZONE 'UTC')::date AND scope IN ('global', ${scope})
    `;
    const used = new Map(rows.map((row) => [row.scope, row.credits]));
    if ((used.get('global') ?? 0) + credits > globalLimit || (used.get(scope) ?? 0) + credits > userLimit) return false;
    await tx`
      INSERT INTO discovery_credit_usage (scope, credit_day, credits)
      VALUES ('global', (now() AT TIME ZONE 'UTC')::date, ${credits}),
             (${scope}, (now() AT TIME ZONE 'UTC')::date, ${credits})
      ON CONFLICT (scope, credit_day) DO UPDATE
      SET credits = discovery_credit_usage.credits + EXCLUDED.credits
    `;
    return true;
  });
}

export async function claimDiscoveryRun(userId: string, timezone: string, daily: boolean) {
  if (!userId) return null;
  await ensureDatabaseInitialized();
  const sql = getSql();
  // The database clock and persisted claim also protect stale workspace snapshots.
  const [row] = await sql<{ started_at: string }[]>`
    INSERT INTO discovery_user_runs (user_id, last_started_at)
    VALUES (${userId}, now())
    ON CONFLICT (user_id) DO UPDATE SET last_started_at = EXCLUDED.last_started_at
    WHERE (discovery_user_runs.last_started_at AT TIME ZONE ${timezone})::date
            < (now() AT TIME ZONE ${timezone})::date
      AND (${daily} OR EXTRACT(ISODOW FROM now() AT TIME ZONE ${timezone}) IN (1, 3, 5))
    RETURNING last_started_at::text AS started_at
  `;
  return row ? new Date(row.started_at).toISOString() : null;
}

export async function pruneDiscoveryStorage() {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`DELETE FROM discovery_search_cache WHERE updated_at < now() - interval '30 days' AND lease_until <= now()`;
  await sql`DELETE FROM discovery_credit_usage WHERE credit_day < (now() AT TIME ZONE 'UTC')::date - 30`;
  await sql`DELETE FROM ai_response_cache WHERE updated_at <= now() - interval '30 days'`;
  await sql`DELETE FROM ai_budget_usage WHERE budget_day < (now() AT TIME ZONE 'UTC')::date - 30`;
  await sql`DELETE FROM auth_rate_limits WHERE updated_at <= now() - interval '2 days'`;
  await sql`DELETE FROM product_events WHERE occurred_at <= now() - interval '90 days'`;
}

export async function insertProductEvent(row: {
  id: string;
  userId: string;
  eventName: string;
  properties?: Record<string, string | number | boolean | null>;
  occurredAt?: string;
}) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`
    INSERT INTO product_events (id, user_id, event_name, properties, occurred_at)
    VALUES (${row.id}, ${row.userId}, ${row.eventName}, ${JSON.stringify(row.properties ?? {})}::jsonb, ${row.occurredAt ?? new Date().toISOString()})
  `;
}

const AI_CACHE_MAX_TTL_SECONDS = 30 * 24 * 60 * 60;

function hasAiStorageKey(value: string) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

export async function readAiCache(userId: string, key: string): Promise<{ text: string | null; fresh: boolean } | null> {
  if (!hasAiStorageKey(userId) || !hasAiStorageKey(key)) return null;
  await ensureDatabaseInitialized();
  const sql = getSql();
  const [row] = await sql<{ text: string | null; fresh: boolean }[]>`
    SELECT response_text AS text, expires_at > now() AS fresh
    FROM ai_response_cache
    WHERE user_id = ${userId} AND cache_key = ${key}
      AND updated_at > now() - interval '30 days'
  `;
  return row ?? null;
}

export async function claimAiCache(userId: string, key: string, token: string): Promise<boolean> {
  if (![userId, key, token].every(hasAiStorageKey)) return false;
  await ensureDatabaseInitialized();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO ai_response_cache (user_id, cache_key, lease_token, lease_until)
    VALUES (${userId}, ${key}, ${token}, now() + interval '120 seconds')
    ON CONFLICT (user_id, cache_key) DO UPDATE
      SET lease_token = EXCLUDED.lease_token, lease_until = EXCLUDED.lease_until,
          response_text = NULL, updated_at = now()
      WHERE ai_response_cache.expires_at <= now()
        AND ai_response_cache.lease_until <= now()
    RETURNING cache_key
  `;
  return rows.length === 1;
}

export async function writeAiCache(userId: string, key: string, token: string, text: string | null, ttlSeconds: number): Promise<void> {
  if (![userId, key, token].every(hasAiStorageKey) || !isPositiveInteger(ttlSeconds)
    || (text !== null && typeof text !== "string")) return;
  await ensureDatabaseInitialized();
  const sql = getSql();
  const ttl = Math.min(ttlSeconds, AI_CACHE_MAX_TTL_SECONDS);
  await sql`
    UPDATE ai_response_cache
    SET response_text = ${text}, expires_at = now() + ${ttl} * interval '1 second',
        lease_token = NULL, lease_until = '-infinity', updated_at = now()
    WHERE user_id = ${userId} AND cache_key = ${key}
      AND lease_token = ${token} AND lease_until > now()
  `;
}

export async function releaseAiCache(userId: string, key: string, token: string): Promise<void> {
  if (![userId, key, token].every(hasAiStorageKey)) return;
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`
    UPDATE ai_response_cache SET lease_token = NULL, lease_until = '-infinity'
    WHERE user_id = ${userId} AND cache_key = ${key} AND lease_token = ${token}
  `;
}

export async function reserveAiBudget(userId: string, cents: number, userDailyCents: number, globalDailyCents: number): Promise<boolean> {
  if (!hasAiStorageKey(userId) || ![cents, userDailyCents, globalDailyCents].every(isPositiveInteger)
    || cents > userDailyCents || cents > globalDailyCents) return false;
  try {
    await ensureDatabaseInitialized();
    const sql = getSql();
    return await sql.begin(async (tx) => {
      // Both counters are reserved together across instances. No refunds: an
      // ambiguous model request may already have incurred its full cost.
      await tx`SELECT pg_advisory_xact_lock(724186032)`;
      const scope = `user:${userId}`;
      const rows = await tx<{ scope: string; cents: string }[]>`
        SELECT scope, cents::text AS cents FROM ai_budget_usage
        WHERE budget_day = (now() AT TIME ZONE 'UTC')::date AND scope IN ('global', ${scope})
      `;
      const used = new Map(rows.map((row) => [row.scope, Number(row.cents)]));
      if ([...used.values()].some((value) => !Number.isSafeInteger(value) || value < 0)) return false;
      // Subtract before comparing so even safe-integer maximum caps cannot
      // overflow in a JS addition before reaching the database BIGINT column.
      if (cents > globalDailyCents - (used.get("global") ?? 0)
        || cents > userDailyCents - (used.get(scope) ?? 0)) return false;
      await tx`
        INSERT INTO ai_budget_usage (scope, budget_day, cents)
        VALUES ('global', (now() AT TIME ZONE 'UTC')::date, ${cents}),
               (${scope}, (now() AT TIME ZONE 'UTC')::date, ${cents})
        ON CONFLICT (scope, budget_day) DO UPDATE
        SET cents = ai_budget_usage.cents + EXCLUDED.cents
      `;
      return true;
    });
  } catch {
    // A failed/ambiguous commit never grants permission to make a paid call.
    return false;
  }
}
