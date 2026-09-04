import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  claimWorkspaceUpdateLease,
  compareAndSwapWorkspaceRow,
  ensureWorkspaceForUser,
  getWorkspaceRow,
  listWorkspaceRows,
  releaseWorkspaceUpdateLease,
  upsertWorkspaceRow,
} from "@/lib/db";
import { createInitialWorkspaceState, initialProfile } from "@/lib/hunteragent-data";
import { BriefRecord, GuidedResumeInput, WorkspaceState } from "@/lib/hunteragent-types";
import { normalizeBriefPreferences, pruneExpiredSuggestions } from "@/lib/hunteragent-retention";

const STORE_DIR = path.join(process.cwd(), ".data");
const LEGACY_STORE_PATH = path.join(STORE_DIR, "hunteragent-workspace.json");

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function ensureStoreDir() {
  await mkdir(STORE_DIR, { recursive: true });
}

function normalizeGuidedResume(value?: Partial<GuidedResumeInput>) {
  return {
    ...initialProfile.guidedResume,
    ...(value ?? {}),
  };
}

function normalizeBrief(brief: BriefRecord): BriefRecord {
  const legacy = brief as Partial<BriefRecord>;
  return {
    ...brief,
    recipientEmail: legacy.recipientEmail ?? null,
    outboundMessageId: legacy.outboundMessageId ?? null,
    outboundThreadId: legacy.outboundThreadId ?? null,
    outboundInboxId: legacy.outboundInboxId ?? null,
  };
}

export function ensureWorkspaceState(state: WorkspaceState, now: Date = new Date(), previousState?: WorkspaceState) {
  const legacyProfile = (state.profile ?? {}) as Partial<WorkspaceState["profile"]> & { portfolioLinks?: string[] };
  state.profile = {
    ...initialProfile,
    ...(state.profile ?? {}),
    guidedResume: normalizeGuidedResume(state.profile?.guidedResume),
    workSampleLinks: state.profile?.workSampleLinks ?? legacyProfile.portfolioLinks ?? initialProfile.workSampleLinks,
    targetRoles: state.profile?.targetRoles ?? initialProfile.targetRoles,
    workTypes: state.profile?.workTypes ?? initialProfile.workTypes,
    workplaceModes: state.profile?.workplaceModes ?? initialProfile.workplaceModes,
    remoteRegions: state.profile?.remoteRegions ?? initialProfile.remoteRegions,
    excludedCompanies: state.profile?.excludedCompanies ?? initialProfile.excludedCompanies,
    specialPreferences: state.profile?.specialPreferences ?? initialProfile.specialPreferences,
    briefsPaused: state.profile?.briefsPaused ?? initialProfile.briefsPaused,
    materialsMode: state.profile?.materialsMode ?? initialProfile.materialsMode,
    ...normalizeBriefPreferences(state.profile),
  };
  state.roleCatalog = state.roleCatalog ?? createInitialWorkspaceState().roleCatalog;
  state.briefs = (state.briefs ?? []).map(normalizeBrief);
  state.studioTab = state.studioTab === "workSamples" || state.studioTab === "pack" || state.studioTab === "letter" ? state.studioTab : "cv";
  state.cvViewMode = state.cvViewMode ?? "preview";
  state.leftRailCollapsed = state.leftRailCollapsed ?? true;
  state.promptDrafts = state.promptDrafts ?? {};
  state.promptHistory = state.promptHistory ?? {};
  state.stateVersion = (state.stateVersion as number | undefined) ?? 1;

  return pruneExpiredSuggestions(state, now, previousState);
}

async function normalizeRow(userId: string, initialRow: { state_json: string }) {
  let row = initialRow;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parsed = JSON.parse(row.state_json) as WorkspaceState;
    const normalized = ensureWorkspaceState(parsed);
    const nextJson = JSON.stringify(normalized);
    if (nextJson === JSON.stringify(JSON.parse(row.state_json))) return normalized;
    // Anchor legacy timestamps once, without overwriting a concurrent user action.
    if (await compareAndSwapWorkspaceRow(userId, row.state_json, nextJson, new Date().toISOString())) return normalized;
    const latest = await getWorkspaceRow(userId);
    if (!latest) throw new Error("Workspace no longer exists.");
    row = latest;
  }
  throw new Error("Workspace changed while loading. Please try again.");
}

async function readStateFromRow(userId: string) {
  const row = (await getWorkspaceRow(userId)) ?? (await ensureWorkspaceForUser(userId));
  return normalizeRow(userId, row);
}

async function persistStateForUser(userId: string, state: WorkspaceState, previousState?: WorkspaceState) {
  const normalized = ensureWorkspaceState(cloneState(state), new Date(), previousState);
  normalized.stateVersion = (normalized.stateVersion ?? 1) + 1;
  await upsertWorkspaceRow(userId, JSON.stringify(normalized, null, 2), new Date().toISOString());
  return cloneState(normalized);
}

export async function readWorkspaceState(userId?: string) {
  if (userId) {
    return await readStateFromRow(userId);
  }

  await ensureStoreDir();

  try {
    const raw = await readFile(LEGACY_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as WorkspaceState;
    const normalized = ensureWorkspaceState(parsed);
    if (JSON.stringify(normalized) !== JSON.stringify(JSON.parse(raw))) {
      await writeFile(LEGACY_STORE_PATH, JSON.stringify(normalized, null, 2), "utf8");
    }
    return normalized;
  } catch {
    const initial = createInitialWorkspaceState();
    return writeWorkspaceState(initial);
  }
}

export async function writeWorkspaceState(state: WorkspaceState, userId?: string, previousState?: WorkspaceState) {
  if (userId) {
    const row = previousState ? null : await getWorkspaceRow(userId);
    return await persistStateForUser(userId, state, previousState ?? (row ? JSON.parse(row.state_json) as WorkspaceState : undefined));
  }

  await ensureStoreDir();
  if (!previousState) {
    try { previousState = JSON.parse(await readFile(LEGACY_STORE_PATH, "utf8")) as WorkspaceState; } catch { /* No legacy workspace yet. */ }
  }
  const normalized = ensureWorkspaceState(cloneState(state), new Date(), previousState);
  await writeFile(LEGACY_STORE_PATH, JSON.stringify(normalized, null, 2), "utf8");
  return cloneState(normalized);
}

export async function updateWorkspaceState(
  updater: (state: WorkspaceState) => WorkspaceState | Promise<WorkspaceState>,
  userId?: string,
) {
  if (userId) {
    const token = randomUUID();
    let claimed = false;
    for (let attempt = 0; attempt < 10 && !claimed; attempt++) {
      claimed = await claimWorkspaceUpdateLease(userId, token);
      if (!claimed) await new Promise((resolve) => setTimeout(resolve, 100 + attempt * 25));
    }
    if (!claimed) throw new Error("Workspace is busy. Please try again.");
    try {
      const current = await readWorkspaceState(userId);
      const next = await updater(cloneState(current));
      return writeWorkspaceState(next, userId, current);
    } finally {
      await releaseWorkspaceUpdateLease(userId, token).catch(() => {});
    }
  }

  const current = await readWorkspaceState(userId);
  const next = await updater(cloneState(current));
  return writeWorkspaceState(next, userId, current);
}

export async function listStoredWorkspaces() {
  const workspaces = [];
  for (const row of await listWorkspaceRows()) {
    const state = await normalizeRow(row.user_id, row);
    workspaces.push({ userId: row.user_id, state });
  }
  return workspaces;
}
