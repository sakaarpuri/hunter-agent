import { estimateMinutes, getRoleFromCatalog } from "@/lib/hunteragent-data";
import { parseInboundReply } from "@/lib/hunteragent-email";
import { generateApplicationPack } from "@/lib/hunteragent-anthropic";
import { PackIntent, PackTarget, WorkspaceState } from "@/lib/hunteragent-types";

type InboundReplyInput = {
  briefId?: string;
  rawText: string;
  sender?: string;
  subject?: string;
  source: "dashboard" | "webhook";
  svixId?: string;
  eventId?: string;
  inboxId?: string;
  threadId?: string;
  messageId?: string;
};

export type AppliedInboundReply = {
  briefId: string | null;
  selectedRoleIds: number[];
  duplicate: boolean;
};

function getTargetBrief(state: WorkspaceState, preferredBriefId?: string) {
  return getTargetBriefByMetadata(state, { preferredBriefId });
}

function getTargetBriefByMetadata(
  state: WorkspaceState,
  metadata: { preferredBriefId?: string; threadId?: string; messageId?: string; inboxId?: string },
) {
  if (metadata.threadId) {
    const threaded = state.briefs.find((brief) => brief.outboundThreadId === metadata.threadId);
    if (threaded) return threaded;
  }

  if (metadata.messageId) {
    const matchedByMessage = state.briefs.find((brief) => brief.outboundMessageId === metadata.messageId);
    if (matchedByMessage) return matchedByMessage;
  }

  if (metadata.preferredBriefId) {
    const preferred = state.briefs.find((brief) => brief.id === metadata.preferredBriefId);
    if (preferred) return preferred;
  }

  if (metadata.inboxId) {
    const sameInbox = state.briefs
      .filter((brief) => brief.outboundInboxId === metadata.inboxId && brief.sentAt)
      .sort((left, right) => Date.parse(right.sentAt ?? right.createdAt) - Date.parse(left.sentAt ?? left.createdAt));
    if (sameInbox[0]) return sameInbox[0];
  }

  if (state.activeBriefId) {
    const active = state.briefs.find((brief) => brief.id === state.activeBriefId);
    if (active) return active;
  }

  const liveBriefs = [...state.briefs].filter((brief) => brief.status !== "scheduled");
  liveBriefs.sort((left, right) => {
    const leftTime = Date.parse(left.sentAt ?? left.createdAt);
    const rightTime = Date.parse(right.sentAt ?? right.createdAt);
    return rightTime - leftTime;
  });

  return liveBriefs[0] ?? state.briefs[0] ?? null;
}

function hasDuplicateInbound(brief: NonNullable<ReturnType<typeof getTargetBrief>>, input: InboundReplyInput) {
  return brief.inboundRecords.some((record) => {
    if (input.svixId && record.svixId === input.svixId) return true;
    if (input.messageId && record.messageId === input.messageId) return true;
    return false;
  });
}

export function applyInboundReplyToWorkspace(state: WorkspaceState, input: InboundReplyInput): AppliedInboundReply {
  const brief = getTargetBriefByMetadata(state, {
    preferredBriefId: input.briefId,
    threadId: input.threadId,
    messageId: input.messageId,
    inboxId: input.inboxId,
  });
  if (!brief) {
    state.lastError = "We could not find an active brief for that inbound email.";
    return { briefId: null, selectedRoleIds: [], duplicate: false };
  }

  if (hasDuplicateInbound(brief, input)) {
    state.lastError = null;
    state.generationStatus = "Duplicate webhook event ignored.";
    return { briefId: brief.id, selectedRoleIds: brief.selectedRoleIds, duplicate: true };
  }

  const parsed = parseInboundReply(brief, input.rawText, state.roleCatalog);

  brief.inboundRecords.unshift({
    id: `inbound-${crypto.randomUUID()}`,
    receivedAt: new Date().toISOString(),
    rawText: input.rawText,
    normalizedReply: parsed.normalizedReply,
    selectedRoleIds: parsed.selectedRoleIds,
    matchedLabels: parsed.matchedLabels,
    preferenceNotes: parsed.preferenceNotes,
    source: input.source,
    sender: input.sender,
    subject: input.subject,
    svixId: input.svixId,
    eventId: input.eventId,
    inboxId: input.inboxId,
    threadId: input.threadId,
    messageId: input.messageId,
  });

  brief.selectedRoleIds = parsed.selectedRoleIds;
  brief.status = parsed.selectedRoleIds.length > 0 ? "generating" : "replied";
  state.flowPhase = parsed.selectedRoleIds.length > 0 ? "processing" : "brief";
  state.activeBriefId = brief.id;
  state.activeRoleId = parsed.selectedRoleIds[0] ?? state.activeRoleId;
  state.generationStatus = parsed.selectedRoleIds.length > 0 ? "Reply parsed. Preparing packs." : null;
  state.lastError =
    parsed.selectedRoleIds.length === 0
      ? "No roles were matched from that inbound reply. Try numbers like 1, 4 or company names from the brief."
      : null;

  return {
    briefId: brief.id,
    selectedRoleIds: parsed.selectedRoleIds,
    duplicate: false,
  };
}

export async function generateSelectedPacksForWorkspace(
  state: WorkspaceState,
  options: { briefId?: string; roleId?: number; target?: PackTarget; intent?: PackIntent; instruction?: string } = {},
) {
  const brief = getTargetBrief(state, options.briefId);
  if (!brief) {
    state.lastError = "No active brief was available for generation.";
    return state;
  }

  const roleIds = options.roleId ? [options.roleId] : brief.selectedRoleIds;
  if (roleIds.length === 0) {
    state.lastError = "Select a role from the inbound email before generating packs.";
    return state;
  }

  state.flowPhase = "processing";
  const target = options.target ?? "pack";
  const trimmedInstruction = options.instruction?.trim() ?? "";
  const targetLabel =
    target === "cv"
      ? "resume"
      : target === "letter"
        ? "cover letter"
        : target === "workSamples"
          ? "work sample reasoning"
          : "application pack";
  state.generationStatus = `Preparing ${roleIds.length} ${targetLabel}${roleIds.length > 1 ? "s" : ""}. Estimated time: ${estimateMinutes(roleIds.length)}.`;
  brief.status = "generating";

  for (const roleId of roleIds) {
    const role = getRoleFromCatalog(roleId, state.roleCatalog);
    if (!role) continue;

    const style = state.roleStyleOverrides[String(roleId)] ?? state.profile.resumeDefaultStyle;
    const existingPack = state.packs.find((item) => item.roleId === roleId && item.briefId === brief.id);
    const generated = await generateApplicationPack(role, state.profile, state.tone, style, {
      target,
      intent: options.intent,
      instruction: options.instruction,
      currentPack: existingPack
        ? {
            cvSummary: existingPack.cvSummary,
            cvBullets: existingPack.cvBullets,
            letter: existingPack.letter,
            reasoning: existingPack.reasoning,
            workSampleSelections: existingPack.workSampleSelections,
          }
        : null,
    });

    const record = {
      id: `pack-${brief.id}-${roleId}`,
      roleId,
      briefId: brief.id,
      generatedAt: new Date().toISOString(),
      provider: generated.provider,
      tone: state.tone,
      resumeStyleUsed: style,
      resumeSourceType: state.profile.resumeMode,
      cvSummary: generated.cvSummary,
      cvBullets: generated.cvBullets,
      letter: generated.letter,
      reasoning: generated.reasoning,
      workSampleSelections: generated.workSampleSelections,
      followUpDraft: null,
    };

    const existingIndex = state.packs.findIndex((item) => item.roleId === roleId && item.briefId === brief.id);
    if (existingIndex >= 0) {
      state.packs[existingIndex] = record;
    } else {
      state.packs.unshift(record);
    }
  }

  if (trimmedInstruction) {
    for (const roleId of roleIds) {
      const promptKey = `${roleId}:${target}`;
      const existingHistory = state.promptHistory[promptKey] ?? [];
      state.promptHistory[promptKey] = [trimmedInstruction, ...existingHistory.filter((item) => item !== trimmedInstruction)].slice(0, 6);
      state.promptDrafts[promptKey] = trimmedInstruction;
    }
  }

  brief.status = "ready";
  state.flowPhase = "studio";
  state.generationStatus =
    options.intent === "edit" && options.instruction?.trim()
      ? `${targetLabel[0].toUpperCase()}${targetLabel.slice(1)} updated for ${roleIds.length} selected role${roleIds.length > 1 ? "s" : ""}.`
      : options.intent === "sharpen"
        ? `Sharpened ${targetLabel} ready for ${roleIds.length} selected role${roleIds.length > 1 ? "s" : ""}.`
        : `${targetLabel[0].toUpperCase()}${targetLabel.slice(1)} ready for ${roleIds.length} selected role${roleIds.length > 1 ? "s" : ""}.`;
  state.activeRoleId = options.roleId ?? brief.selectedRoleIds[0] ?? state.activeRoleId;
  state.lastError = null;

  return state;
}
