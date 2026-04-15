import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureWorkspaceForUser, getWorkspaceRow, listWorkspaceRows, upsertWorkspaceRow } from "@/lib/db";
import { createBriefRecord, createInitialWorkspaceState, initialProfile } from "@/lib/hunteragent-data";
import { BriefRecord, GuidedResumeInput, WorkspaceState } from "@/lib/hunteragent-types";

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

function ensureWorkspaceState(state: WorkspaceState) {
  const legacyProfile = state.profile as Partial<WorkspaceState["profile"]> & { portfolioLinks?: string[] };
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
  };
  state.roleCatalog = state.roleCatalog?.length ? state.roleCatalog : createInitialWorkspaceState().roleCatalog;
  state.briefs = (state.briefs ?? []).map(normalizeBrief);
  state.studioTab = state.studioTab === "workSamples" || state.studioTab === "pack" || state.studioTab === "letter" ? state.studioTab : "cv";
  state.cvViewMode = state.cvViewMode ?? "preview";
  state.leftRailCollapsed = state.leftRailCollapsed ?? true;
  state.promptDrafts = state.promptDrafts ?? {};
  state.promptHistory = state.promptHistory ?? {};
  state.stateVersion = (state.stateVersion as number | undefined) ?? 1;

  if (state.onboardingComplete && state.briefs.length === 0) {
    const brief = createBriefRecord(state.profile.firstBrief, state.roleCatalog);
    state.briefs = [brief];
    state.activeBriefId = brief.id;
    state.flowPhase = "waiting";
  }
  return state;
}

async function readStateFromRow(userId: string) {
  const row = (await getWorkspaceRow(userId)) ?? (await ensureWorkspaceForUser(userId));
  const parsed = JSON.parse(row.state_json) as WorkspaceState;
  return ensureWorkspaceState(parsed);
}

async function persistStateForUser(userId: string, state: WorkspaceState) {
  const normalized = ensureWorkspaceState(cloneState(state));
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
    return ensureWorkspaceState(parsed);
  } catch {
    const initial = createInitialWorkspaceState();
    await writeWorkspaceState(initial);
    return cloneState(initial);
  }
}

export async function writeWorkspaceState(state: WorkspaceState, userId?: string) {
  if (userId) {
    return await persistStateForUser(userId, state);
  }

  await ensureStoreDir();
  await writeFile(LEGACY_STORE_PATH, JSON.stringify(state, null, 2), "utf8");
  return cloneState(state);
}

export async function updateWorkspaceState(
  updater: (state: WorkspaceState) => WorkspaceState | Promise<WorkspaceState>,
  userId?: string,
) {
  const current = await readWorkspaceState(userId);
  const next = await updater(cloneState(current));
  return writeWorkspaceState(next, userId);
}

export async function listStoredWorkspaces() {
  return (await listWorkspaceRows()).map((row) => ({
    userId: row.user_id,
    state: ensureWorkspaceState(JSON.parse(row.state_json) as WorkspaceState),
  }));
}
