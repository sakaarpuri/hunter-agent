import { createBriefRecord } from "@/lib/hunteragent-data";
import { discoverRoles } from "@/lib/hunteragent-discovery";
import { sendDailyBriefEmail } from "@/lib/agentmail";
import { WorkspaceState } from "@/lib/hunteragent-types";

export async function prepareFreshBrief(state: WorkspaceState) {
  if (state.profile.briefsPaused) {
    state.flowPhase = "waiting";
    state.generationStatus = "Daily briefs are paused. Resume them in settings when you want HunterAgent to search again.";
    return { state, brief: null, roles: state.roleCatalog };
  }

  const roles = await discoverRoles(state.profile);
  state.roleCatalog = roles;

  const brief = createBriefRecord("now", roles);
  state.briefs.unshift(brief);
  state.activeBriefId = brief.id;
  state.flowPhase = "waiting";
  state.generationStatus = `Prepared ${roles.length} fresh roles for the next brief.`;
  return { state, brief, roles };
}

export async function sendPreparedBrief(state: WorkspaceState, briefId?: string) {
  if (state.profile.briefsPaused) {
    state.flowPhase = "waiting";
    state.generationStatus = "Daily briefs are paused. Resume them before sending a new brief.";
    return state;
  }

  const brief = state.briefs.find((item) => item.id === (briefId ?? state.activeBriefId));
  if (!brief) {
    throw new Error("No brief is ready to send.");
  }

  const sent = await sendDailyBriefEmail(brief, state.profile, state.roleCatalog);
  brief.status = "sent";
  brief.sentAt = sent.sentAt;
  brief.scheduledFor = null;
  brief.recipientEmail = state.profile.recipientEmail.trim();
  brief.outboundMessageId = sent.messageId;
  brief.outboundThreadId = sent.threadId;
  brief.outboundInboxId = sent.inboxId;
  state.flowPhase = "brief";
  state.generationStatus = `Daily brief sent to ${state.profile.recipientEmail.trim()}.`;
  state.lastError = null;
  return state;
}
