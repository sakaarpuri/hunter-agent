import type { BriefRecord, ExpiredBriefRecord, Profile, Role, WorkspaceState } from "@/lib/hunteragent-types";

export const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeBriefPreferences(value: unknown): Pick<Profile, "jobsPerBrief" | "discoveryCadence" | "explorationMode"> {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    jobsPerBrief: 3,
    discoveryCadence: input.discoveryCadence === "three-per-week" ? "three-per-week" : "daily",
    explorationMode: input.explorationMode === "close" || input.explorationMode === "surprise" ? input.explorationMode : "stretch",
  };
}

function timestamp(value: unknown) {
  return typeof value === "string" && value.trim() ? Date.parse(value) : NaN;
}

export function isRoleExpired(role: Role, now: Date = new Date()) {
  const firstSeen = timestamp(role.firstSeenAt);
  const explicitExpiry = timestamp(role.expiresAt);
  const expires = Math.min(Number.isFinite(firstSeen) ? firstSeen + JOB_RETENTION_MS : Infinity, Number.isFinite(explicitExpiry) ? explicitExpiry : Infinity);
  return !Number.isFinite(expires) || expires <= now.getTime();
}

function identity(role: Role) {
  return role.fingerprint || role.sourceUrl || [role.company, role.title, role.location].join("|").toLowerCase();
}

function routingSnapshot(brief: BriefRecord): ExpiredBriefRecord {
  return {
    id: brief.id,
    createdAt: brief.createdAt,
    sentAt: brief.sentAt,
    recipientEmail: brief.recipientEmail,
    outboundMessageId: brief.outboundMessageId,
    outboundThreadId: brief.outboundThreadId,
    outboundInboxId: brief.outboundInboxId,
  };
}

export function hasSavedRole(state: WorkspaceState, roleId: number, briefId?: string) {
  return [...state.packs, ...state.appliedRecords].some(
    (record) => record.roleId === roleId && (briefId === undefined || record.briefId === briefId),
  );
}

// Archived briefs are material containers only, never selectable suggestion lists.
export function getRetainedBrief(state: WorkspaceState, briefId: string): BriefRecord | null {
  const live = state.briefs.find((brief) => brief.id === briefId);
  if (live) return live;
  const archived = state.expiredBriefs?.find((brief) => brief.id === briefId);
  if (!archived || ![...state.packs, ...state.appliedRecords].some((record) => record.briefId === briefId)) return null;
  return { ...archived, scheduledFor: null, roleIds: [], replyRoleIds: [], topRoleIds: [], selectedRoleIds: [], inboundRecords: [], status: "ready" };
}

export function canUseRole(state: WorkspaceState, roleId: number, briefId?: string, now: Date = new Date()) {
  const role = state.roleCatalog.find((item) => item.id === roleId);
  if (!role) return false;
  if (hasSavedRole(state, roleId, briefId)) return true;
  return !isRoleExpired(role, now) && state.briefs.some(
    (brief) => (briefId === undefined || brief.id === briefId) && brief.roleIds.includes(roleId),
  );
}

/** Mutates state; callers can inject a clock and the pre-update snapshot. */
export function pruneExpiredSuggestions(state: WorkspaceState, now: Date = new Date(), previousState?: WorkspaceState) {
  const wasProcessing = state.flowPhase === "processing";
  Object.assign(state.profile, normalizeBriefPreferences(state.profile));
  state.packs ??= [];
  state.appliedRecords ??= [];
  state.briefs ??= [];
  state.roleCatalog ??= [];

  const protectedIds = new Set([...state.packs, ...state.appliedRecords].map((record) => record.roleId));
  const referencedIds = new Set([...protectedIds, ...state.briefs.flatMap((brief) => brief.roleIds)]);
  const catalog = new Map(state.roleCatalog.map((role) => [role.id, role]));
  for (const role of previousState?.roleCatalog ?? []) {
    if (referencedIds.has(role.id) && !catalog.has(role.id)) catalog.set(role.id, structuredClone(role));
  }
  state.roleCatalog = [...catalog.values()];

  const priorById = new Map((previousState?.roleCatalog ?? []).map((role) => [role.id, role]));
  const firstSeenByIdentity = new Map<string, number>();
  const expiryByIdentity = new Map<string, number>();
  const allRoles = [...state.roleCatalog, ...(state.discoveryPool ?? [])];
  for (const role of [...allRoles, ...(previousState?.roleCatalog ?? []), ...(previousState?.discoveryPool ?? [])]) {
    const dates = [now.getTime(), timestamp(role.firstSeenAt)];
    if (!Number.isFinite(timestamp(role.firstSeenAt)) && Number.isFinite(timestamp(role.expiresAt))) dates.push(timestamp(role.expiresAt) - JOB_RETENTION_MS);
    if (role.fingerprint) dates.push(timestamp(state.seenJobs?.[role.fingerprint]), timestamp(previousState?.seenJobs?.[role.fingerprint]));
    const prior = priorById.get(role.id);
    if (prior && identity(prior) === identity(role)) dates.push(timestamp(prior.firstSeenAt));
    for (const brief of [...state.briefs, ...(previousState?.briefs ?? [])]) {
      if ((brief.replyRoleIds ?? brief.roleIds).includes(role.id)) dates.push(timestamp(brief.createdAt));
    }
    for (const record of state.packs) if (record.roleId === role.id) dates.push(timestamp(record.generatedAt));
    for (const record of state.appliedRecords) if (record.roleId === role.id) dates.push(timestamp(record.appliedAt));
    const earliest = Math.min(...dates.filter(Number.isFinite));
    const key = identity(role);
    firstSeenByIdentity.set(key, Math.min(firstSeenByIdentity.get(key) ?? Infinity, earliest));
    const expiry = timestamp(role.expiresAt);
    if (Number.isFinite(expiry)) expiryByIdentity.set(key, Math.min(expiryByIdentity.get(key) ?? Infinity, expiry));
  }
  for (const role of allRoles) {
    const firstSeen = firstSeenByIdentity.get(identity(role))!;
    role.firstSeenAt = new Date(firstSeen).toISOString();
    role.expiresAt = new Date(Math.min(firstSeen + JOB_RETENTION_MS, expiryByIdentity.get(identity(role)) ?? Infinity)).toISOString();
  }

  const roles = new Map(state.roleCatalog.map((role) => [role.id, role]));
  const liveRole = (id: number) => Boolean(roles.get(id) && !isRoleExpired(roles.get(id)!, now));
  const appliedIds = new Set(state.appliedRecords.map((record) => record.roleId));
  const archived = new Map((state.expiredBriefs ?? []).map((brief) => [brief.id, brief]));
  const kept: BriefRecord[] = [];
  for (const brief of state.briefs) {
    const previous = previousState?.briefs.find((item) => item.id === brief.id);
    brief.replyRoleIds = [...(previous?.sentAt ? previous.replyRoleIds ?? previous.roleIds : brief.replyRoleIds ?? brief.roleIds)];
    brief.roleIds = brief.roleIds.filter((id) => liveRole(id) || (appliedIds.has(id) && roles.has(id)));
    brief.topRoleIds = brief.topRoleIds.filter((id) => brief.roleIds.includes(id) && liveRole(id));
    // Saving a pack is not an extension of a suggestion's lifetime.
    brief.selectedRoleIds = brief.selectedRoleIds.filter((id) => brief.roleIds.includes(id) && liveRole(id));
    if (brief.roleIds.length === 0 && brief.replyRoleIds.length > 0) {
      archived.set(brief.id, routingSnapshot(brief));
    } else {
      kept.push(brief);
    }
  }
  state.briefs = kept;
  state.expiredBriefs = [...archived.values()];
  state.roleCatalog = state.roleCatalog.filter((role) => !isRoleExpired(role, now) || protectedIds.has(role.id));
  if (state.discoveryPool) state.discoveryPool = state.discoveryPool.filter((role) => !isRoleExpired(role, now));

  if (state.activeRoleId !== null && !canUseRole(state, state.activeRoleId, state.activeBriefId ?? undefined, now)) state.activeRoleId = null;
  const active = state.briefs.find((brief) => brief.id === state.activeBriefId);
  const savedIsOpen = state.activeRoleId !== null && hasSavedRole(state, state.activeRoleId, state.activeBriefId ?? undefined);
  if (!active && !savedIsOpen) {
    state.activeBriefId = null;
    if (state.onboardingComplete) state.flowPhase = state.briefs.some((brief) => brief.sentAt) ? "brief" : "waiting";
  }
  if (wasProcessing && !active?.selectedRoleIds.length && !savedIsOpen) {
    state.flowPhase = active?.sentAt ? "brief" : "waiting";
    state.generationStatus = null;
    if (active?.status === "generating") active.status = active.sentAt ? "sent" : "scheduled";
  }
  return state;
}
