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
    // Attempt auto-fix: re-encode the password portion between :// and the last @
    // e.g. postgres://user:p@ss#word@host:5432/db → postgres://user:p%40ss%23word@host:5432/db
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
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reset_tokens_token_hash ON password_reset_tokens(token_hash)`;

  await migrateLegacyStateIfNeeded(sql);
}

async function ensureDatabaseInitialized() {
  if (!global.__hunteragentDbInit) {
    global.__hunteragentDbInit = initializeSchema();
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

export async function insertPasswordResetToken(row: DbPasswordResetTokenRow) {
  await ensureDatabaseInitialized();
  const sql = getSql();
  await sql`DELETE FROM password_reset_tokens WHERE user_id = ${row.user_id}`;
  await sql`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
    VALUES (${row.id}, ${row.user_id}, ${row.token_hash}, ${row.expires_at}, ${row.created_at})
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
