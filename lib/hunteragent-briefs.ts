import { createBriefRecord } from "@/lib/hunteragent-data";
import { discoverRoles, jobsPerBrief, rankUnseenRoles, roleFingerprint, roleIsCurrent } from "@/lib/hunteragent-discovery";
import { pruneExpiredSuggestions } from "@/lib/hunteragent-retention";
import { sendDailyBriefEmail } from "@/lib/agentmail";
import { WorkspaceState } from "@/lib/hunteragent-types";
import { prioritizeRoles } from "@/lib/hunteragent-matching";

const SEEN_RETENTION_MS = 30 * 86_400_000;
export type PrepareBriefOptions = { userId?: string; now?: Date };

export async function prepareFreshBrief(state: WorkspaceState, context: PrepareBriefOptions | string = {}) {
  const options = typeof context === "string" ? { userId: context } : context;
  const now = options.now ?? new Date();
  if (state.profile.briefsPaused) {
    state.flowPhase = "waiting";
    state.generationStatus = "Daily briefs are paused. Resume them in settings when you want discovery to continue.";
    return { state, brief: null, roles: [] };
  }

  state.seenJobs = Object.fromEntries(Object.entries(state.seenJobs ?? {}).filter(([, seen]) => {
    const timestamp = Date.parse(seen);
    return Number.isFinite(timestamp) && now.getTime() - timestamp < SEEN_RETENTION_MS;
  }));
  // Mark all displayed jobs, not just selected jobs. Ignoring a suggestion must
  // not put it back into tomorrow's shortlist, even for older workspace formats.
  for (const brief of state.briefs) {
    const shown = Date.parse(brief.createdAt);
    if (!Number.isFinite(shown) || now.getTime() - shown >= SEEN_RETENTION_MS) continue;
    for (const id of brief.replyRoleIds ?? brief.roleIds) {
      const role = state.roleCatalog.find((item) => item.id === id);
      if (!role?.sourceUrl) continue;
      const fingerprint = roleFingerprint(role.sourceUrl);
      if (!state.seenJobs[fingerprint] || Date.parse(state.seenJobs[fingerprint]) < shown) state.seenJobs[fingerprint] = brief.createdAt;
    }
  }
  pruneExpiredSuggestions(state, now);

  const pending = state.briefs.find((brief) => !brief.sentAt && brief.roleIds.some((id) => {
    const role = state.roleCatalog.find((item) => item.id === id);
    return role && roleIsCurrent(role, now);
  }));
  if (pending) {
    const roles = pending.roleIds.map((id) => state.roleCatalog.find((role) => role.id === id))
      .filter((role): role is WorkspaceState["roleCatalog"][number] => Boolean(role && roleIsCurrent(role, now)))
      .slice(0, jobsPerBrief(state.profile));
    pending.roleIds = roles.map((role) => role.id);
    pending.replyRoleIds = [...pending.roleIds];
    pending.topRoleIds = pending.topRoleIds.filter((id) => pending.roleIds.includes(id));
    state.activeBriefId = pending.id;
    state.generationStatus = "Your prepared brief is still ready. No additional search was needed.";
    return { state, brief: pending, roles };
  }

  const applied = new Set(state.appliedRecords.map((record) => record.roleId));
  const search = await discoverRoles(state.profile, {
    userId: options.userId, now, pool: (state.discoveryPool ?? []).filter((role) => !applied.has(role.id)),
    knownRoles: state.roleCatalog, seenJobs: state.seenJobs, lastDiscoveryAt: state.lastDiscoveryAt,
  });
  state.lastDiscoveryAt = search.lastDiscoveryAt;
  const catalog = new Map(state.roleCatalog.map((role) => [role.id, role]));
  const filtered = rankUnseenRoles(search.roles, state.profile, state.seenJobs, now).filter((role) => {
    if (applied.has(role.id)) return false;
    const existing = catalog.get(role.id);
    return !existing || (existing.sourceUrl && roleFingerprint(existing.sourceUrl) === roleFingerprint(role.sourceUrl!));
  });
  const candidates = await prioritizeRoles(filtered, state.profile, options.userId);
  const hasAssessment = candidates.some((role) => role.matchAssessment);
  const roles = candidates.filter((role) => hasAssessment ? (role.matchAssessment?.score ?? 0) >= 60 : true)
    .slice(0, jobsPerBrief(state.profile));
  const chosen = new Set(roles.map((role) => role.id));
  state.discoveryPool = candidates.filter((role) => !chosen.has(role.id)).slice(0, 45);
  for (const role of roles) if (!catalog.has(role.id)) catalog.set(role.id, role);
  state.roleCatalog = [...catalog.values()];
  state.flowPhase = "waiting";
  if (!roles.length) {
    state.generationStatus = "No new unexpired matches are available. No empty brief was created or emailed; discovery will retry on its next scheduled day.";
    return { state, brief: null, roles: [] };
  }

  const brief = createBriefRecord("now", roles, jobsPerBrief(state.profile), now);
  brief.replyRoleIds = [...brief.roleIds];
  for (const role of roles) state.seenJobs[roleFingerprint(role.sourceUrl!)] = now.toISOString();
  state.briefs.unshift(brief);
  state.activeBriefId = brief.id;
  state.generationStatus = `Prepared ${roles.length} new ${roles.length === 1 ? "role" : "roles"}${roles.length < jobsPerBrief(state.profile) ? "; fewer matches were available, so nothing was added to pad the list" : ""}.`;
  return { state, brief, roles };
}

export async function sendPreparedBrief(state: WorkspaceState, briefId?: string, now = new Date()) {
  if (state.profile.briefsPaused) {
    state.flowPhase = "waiting";
    state.generationStatus = "Daily briefs are paused. Resume them before sending a new brief.";
    return state;
  }
  pruneExpiredSuggestions(state, now);
  const brief = state.briefs.find((item) => item.id === (briefId ?? state.activeBriefId));
  if (!brief || brief.sentAt) {
    state.generationStatus = brief?.sentAt ? "This brief has already been sent." : "No current brief is ready to send.";
    return state;
  }
  brief.replyRoleIds ??= [...brief.roleIds];
  brief.roleIds = brief.roleIds.filter((id) => {
    const role = state.roleCatalog.find((item) => item.id === id);
    return role && roleIsCurrent(role, now);
  }).slice(0, jobsPerBrief(state.profile));
  brief.topRoleIds = brief.topRoleIds.filter((id) => brief.roleIds.includes(id));
  if (!brief.roleIds.length) {
    state.generationStatus = "No current matches remain in this brief. No email was sent.";
    return state;
  }
  // Before the first send, finalize the actual emailed positions. Once sent,
  // retention keeps this immutable snapshot even when individual jobs expire.
  brief.replyRoleIds = [...brief.roleIds];
  const sent = await sendDailyBriefEmail(brief, state.profile, state.roleCatalog, now);
  brief.status = "sent";
  brief.sentAt = sent.sentAt;
  brief.scheduledFor = null;
  brief.recipientEmail = state.profile.recipientEmail.trim();
  brief.outboundMessageId = sent.messageId;
  brief.outboundThreadId = sent.threadId;
  brief.outboundInboxId = sent.inboxId;
  state.flowPhase = "brief";
  state.generationStatus = `Brief with ${brief.roleIds.length} ${brief.roleIds.length === 1 ? "role" : "roles"} sent to ${state.profile.recipientEmail.trim()}.`;
  state.lastError = null;
  return state;
}
