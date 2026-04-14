import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  deleteSessionByTokenHash,
  deleteSessionsForUser,
  ensureWorkspaceForUser,
  getSessionByTokenHash,
  getUserByEmail,
  getUserById,
  insertSession,
  insertUser,
  pruneExpiredSessions,
  updateUserName,
  updateUserPassword,
  type DbUserRow,
} from "@/lib/db";

export const SESSION_COOKIE_NAME = "hunteragent_session";
const SESSION_TTL_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
};

export class AuthError extends Error {}

function toAuthUser(row: DbUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function validatePassword(password: string) {
  return password.length >= 6 && /[0-9\W_]/.test(password);
}

export function validateSignUpInput(input: { name: string; email: string; password: string }) {
  if (!input.name.trim()) throw new AuthError("Add your name before continuing.");
  if (!isValidEmail(input.email)) throw new AuthError("Enter a valid email address.");
  if (!validatePassword(input.password)) {
    throw new AuthError("Use at least 6 characters and include at least one number or symbol.");
  }
}

export async function createUser(input: { name: string; email: string; password: string }) {
  validateSignUpInput(input);
  const email = normalizeEmail(input.email);

  if (getUserByEmail(email)) {
    throw new AuthError("An account with that email already exists. Sign in instead.");
  }

  const now = new Date().toISOString();
  const row: DbUserRow = {
    id: crypto.randomUUID(),
    email,
    full_name: input.name.trim(),
    password_hash: await bcrypt.hash(input.password, 10),
    created_at: now,
    updated_at: now,
  };

  insertUser(row);
  ensureWorkspaceForUser(row.id);
  return toAuthUser(row);
}

export async function authenticateUser(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const user = getUserByEmail(email);
  if (!user) {
    throw new AuthError("We couldn’t find an account with that email.");
  }

  const matches = await bcrypt.compare(input.password, user.password_hash);
  if (!matches) {
    throw new AuthError("That password didn’t match. Try again.");
  }

  return toAuthUser(user);
}

export function createSession(userId: string) {
  pruneExpiredSessions(new Date().toISOString());

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  insertSession({
    id: crypto.randomUUID(),
    user_id: userId,
    token_hash: tokenHash,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  return { token, expiresAt };
}

export function attachSessionCookie(response: NextResponse, session: { token: string; expiresAt: Date }) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: session.token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return response;
}

export async function getCurrentUser() {
  pruneExpiredSessions(new Date().toISOString());
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = getSessionByTokenHash(hashToken(token));
  if (!session) return null;

  if (session.expires_at <= new Date().toISOString()) {
    deleteSessionByTokenHash(session.token_hash);
    return null;
  }

  const user = getUserById(session.user_id);
  return user ? toAuthUser(user) : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Sign in to access HunterAgent.");
  }
  return user;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return;
  deleteSessionByTokenHash(hashToken(token));
}

export async function updateCurrentUserName(userId: string, fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) throw new AuthError("Add a name before saving.");
  updateUserName(userId, trimmed, new Date().toISOString());
  const user = getUserById(userId);
  return user ? toAuthUser(user) : null;
}

export async function updateCurrentUserPassword(userId: string, input: { currentPassword: string; newPassword: string }) {
  const user = getUserById(userId);
  if (!user) throw new AuthError("We couldn’t find that account.");

  const matches = await bcrypt.compare(input.currentPassword, user.password_hash);
  if (!matches) {
    throw new AuthError("Current password didn’t match.");
  }

  if (!validatePassword(input.newPassword)) {
    throw new AuthError("Use at least 6 characters and include at least one number or symbol.");
  }

  const nextHash = await bcrypt.hash(input.newPassword, 10);
  updateUserPassword(userId, nextHash, new Date().toISOString());
  deleteSessionsForUser(userId);
}
