import Database from "better-sqlite3";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInitialWorkspaceState } from "@/lib/hunteragent-data";
import { WorkspaceState } from "@/lib/hunteragent-types";

const STORE_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(STORE_DIR, "hunteragent.db");
const LEGACY_WORKSPACE_PATH = path.join(STORE_DIR, "hunteragent-workspace.json");

declare global {
  var __hunteragentDb: Database.Database | undefined;
}

function ensureStoreDir() {
  mkdirSync(STORE_DIR, { recursive: true });
}

function getDatabase() {
  ensureStoreDir();

  if (!global.__hunteragentDb) {
    const db = new Database(DB_PATH, { timeout: 5000 });
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        user_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    `);

    global.__hunteragentDb = db;
  }

  return global.__hunteragentDb;
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
};

export type DbWorkspaceRow = {
  user_id: string;
  state_json: string;
  updated_at: string;
};

export function getUserByEmail(email: string) {
  const db = getDatabase();
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as DbUserRow | undefined;
}

export function getUserById(id: string) {
  const db = getDatabase();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as DbUserRow | undefined;
}

export function insertUser(row: DbUserRow) {
  const db = getDatabase();
  db.prepare(
    "INSERT INTO users (id, email, full_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(row.id, row.email, row.full_name, row.password_hash, row.created_at, row.updated_at);
}

export function updateUserName(userId: string, fullName: string, updatedAt: string) {
  const db = getDatabase();
  db.prepare("UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?").run(fullName, updatedAt, userId);
}

export function updateUserPassword(userId: string, passwordHash: string, updatedAt: string) {
  const db = getDatabase();
  db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(passwordHash, updatedAt, userId);
}

export function insertSession(row: DbSessionRow) {
  const db = getDatabase();
  db.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(row.id, row.user_id, row.token_hash, row.expires_at, row.created_at);
}

export function getSessionByTokenHash(tokenHash: string) {
  const db = getDatabase();
  return db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(tokenHash) as DbSessionRow | undefined;
}

export function deleteSessionByTokenHash(tokenHash: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function deleteSessionsForUser(userId: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function pruneExpiredSessions(nowIso: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso);
}

export function getWorkspaceRow(userId: string) {
  const db = getDatabase();
  return db.prepare("SELECT * FROM workspaces WHERE user_id = ?").get(userId) as DbWorkspaceRow | undefined;
}

export function upsertWorkspaceRow(userId: string, stateJson: string, updatedAt: string) {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO workspaces (user_id, state_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
  ).run(userId, stateJson, updatedAt);
}

export function listWorkspaceRows() {
  const db = getDatabase();
  return db.prepare("SELECT * FROM workspaces").all() as DbWorkspaceRow[];
}

export function ensureWorkspaceForUser(userId: string) {
  const existing = getWorkspaceRow(userId);
  if (existing) return existing;

  const initialState = readLegacyWorkspaceOrInitial();
  const nowIso = new Date().toISOString();
  upsertWorkspaceRow(userId, JSON.stringify(initialState, null, 2), nowIso);
  return getWorkspaceRow(userId)!;
}

function readLegacyWorkspaceOrInitial(): WorkspaceState {
  const db = getDatabase();
  const existingWorkspaceCount = db.prepare("SELECT COUNT(*) as count FROM workspaces").get() as { count: number };
  if (existingWorkspaceCount.count === 0 && existsSync(LEGACY_WORKSPACE_PATH)) {
    try {
      return JSON.parse(readFileSync(LEGACY_WORKSPACE_PATH, "utf8")) as WorkspaceState;
    } catch {
      return createInitialWorkspaceState();
    }
  }

  return createInitialWorkspaceState();
}
