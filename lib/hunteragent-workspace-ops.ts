import { estimateMinutes, getRoleFromCatalog } from "@/lib/hunteragent-data";
import { parseInboundReply } from "@/lib/hunteragent-email";
import { generateApplicationPack } from "@/lib/hunteragent-anthropic";
import { PackIntent, PackTarget, WorkspaceState } from "@/lib/hunteragent-types";
import { canUseRole, getRetainedBrief, isRoleExpired, pruneExpiredSuggestions } from "@/lib/hunteragent-retention";

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
  replyToMessageId?: string;
};

export type AppliedInboundReply = {
  briefId: string | null;
  selectedRoleIds: number[];
  duplicate: boolean;
};

function getTargetBrief(state: WorkspaceState, preferredBriefId?: string) {
  const briefId = preferredBriefId ?? state.activeBriefId;
  return briefId ? getRetainedBrief(state, briefId) : null;
}

export function getTargetBriefByMetadata(
  state: WorkspaceState,
  metadata: { preferredBriefId?: string; threadId?: string; messageId?: string; inboxId?: string },
) {
  // Every supplied routing identifier constrains the same brief. Never fall through
  // from an unknown/expired email to the currently displayed brief.
  let matches = [...state.briefs, ...(state.expiredBriefs ?? [])];
  let constrained = false;
  for (const [key, field] of [
    ["preferredBriefId", "id"], ["threadId", "outboundThreadId"],
    ["messageId", "outboundMessageId"], ["inboxId", "outboundInboxId"],
  ] as const) {
    const value = metadata[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !value.trim()) return null;
    constrained = true;
    matches = matches.filter((brief) => brief[field] === value);
  }
  if (!constrained || matches.length !== 1) return null;
  return state.briefs.find((brief) => brief.id === matches[0].id) ?? null;
}

function hasDuplicateInbound(brief: NonNullable<ReturnType<typeof getTargetBrief>>, input: InboundReplyInput) {
  return brief.inboundRecords.some((record) => {
    if (input.svixId && record.svixId === input.svixId) return true;
    if (input.messageId && record.messageId === input.messageId) return true;
    return false;
  });
}

export function applyInboundReplyToWorkspace(state: WorkspaceState, input: InboundReplyInput, now: Date = new Date()): AppliedInboundReply {
  pruneExpiredSuggestions(state, now);
  if (typeof input.rawText !== "string" || !input.rawText.trim()) {
    state.lastError = "A non-empty reply is required.";
    return { briefId: null, selectedRoleIds: [], duplicate: false };
  }
  const brief = getTargetBriefByMetadata(state, {
    preferredBriefId: input.briefId,
    threadId: input.threadId,
    // messageId identifies the incoming message for deduplication, not its parent.
    messageId: input.replyToMessageId,
    inboxId: input.inboxId,
  });
  if (!brief || !brief.roleIds.some((id) => {
    const role = state.roleCatalog.find((item) => item.id === id);
    return role && !isRoleExpired(role, now);
  })) {
    state.lastError = "That brief has expired or the email identifiers did not match. Open a current brief to select jobs.";
    return { briefId: null, selectedRoleIds: [], duplicate: false };
  }

  if (hasDuplicateInbound(brief, input)) {
    state.lastError = null;
    state.generationStatus = "Duplicate webhook event ignored.";
    if (brief.status === "generating") {
      brief.status = "replied";
      state.flowPhase = "brief";
    }
    return { briefId: brief.id, selectedRoleIds: brief.selectedRoleIds, duplicate: true };
  }

  const replyRoleIds = brief.replyRoleIds ?? brief.roleIds;
  const parsed = parseInboundReply({ ...brief, roleIds: replyRoleIds }, input.rawText, state.roleCatalog);
  const positions = (parsed.normalizedReply.match(/\b\d+\b/g) ?? []).map(Number);
  const invalidPosition = positions.some((position) => position < 1 || position > replyRoleIds.length);
  const expiredSelection = parsed.selectedRoleIds.some((id) => {
    const role = state.roleCatalog.find((item) => item.id === id);
    return !brief.roleIds.includes(id) || !role || isRoleExpired(role, now);
  });
  if (invalidPosition || expiredSelection) {
    state.lastError = "One or more selected jobs have expired or were not in this brief. No selection was changed.";
    return { briefId: brief.id, selectedRoleIds: [], duplicate: false };
  }

  brief.inboundRecords.unshift({
    id: `inbound-${crypto.randomUUID()}`,
    receivedAt: now.toISOString(),
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
  brief.status = "replied";
  state.flowPhase = "brief";
  state.activeBriefId = brief.id;
  state.activeRoleId = parsed.selectedRoleIds[0] ?? state.activeRoleId;
  state.generationStatus = parsed.selectedRoleIds.length > 0 ? "Selection saved. Choose Prepare my materials in your dashboard when ready." : null;
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

export function isValidGenerationInput(value: unknown): value is {
  briefId?: string; roleId?: number; target?: PackTarget; intent?: PackIntent; instruction?: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (input.briefId === undefined || (typeof input.briefId === "string" && Boolean(input.briefId.trim())))
    && (input.roleId === undefined || (typeof input.roleId === "number" && Number.isSafeInteger(input.roleId) && input.roleId > 0))
    && (input.target === undefined || ["cv", "letter", "workSamples", "pack"].includes(input.target as string))
    && (input.intent === undefined || ["refresh", "sharpen", "edit"].includes(input.intent as string))
    && (input.instruction === undefined || (typeof input.instruction === "string" && input.instruction.length <= 10_000));
}

export async function generateSelectedPacksForWorkspace(
  state: WorkspaceState,
  options: { briefId?: string; roleId?: number; target?: PackTarget; intent?: PackIntent; instruction?: string } = {},
  userId?: string,
) {
  pruneExpiredSuggestions(state);
  if (!isValidGenerationInput(options)) {
    state.lastError = "Invalid material generation request.";
    return state;
  }
  const brief = getTargetBrief(state, options.briefId);
  if (!brief) {
    state.lastError = "No active brief was available for generation.";
    return state;
  }

  const savedRoleIds = state.packs.filter((pack) => pack.briefId === brief.id).map((pack) => pack.roleId);
  const roleIds = options.roleId !== undefined ? [options.roleId]
    : brief.selectedRoleIds.length > 0 ? brief.selectedRoleIds
    : options.intent === "edit" || options.intent === "sharpen" || options.intent === "refresh"
      ? (state.activeRoleId !== null && savedRoleIds.includes(state.activeRoleId) ? [state.activeRoleId] : savedRoleIds)
      : [];
  if (roleIds.length === 0) {
    state.lastError = "Select a role from the inbound email before generating packs.";
    return state;
  }

  if (roleIds.some((roleId) => !canUseRole(state, roleId, brief.id))) {
    state.lastError = "That job has expired or does not belong to this brief. Saved materials can still be reopened and edited.";
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
  const successfulRoleIds = new Set<number>();
  let usedFallback = false;

  for (const roleId of roleIds) {
    if (!canUseRole(state, roleId, brief.id)) {
      state.lastError = "A selected job expired while preparing materials. Previously saved materials are still available.";
      state.generationStatus = null;
      brief.status = state.packs.some((pack) => pack.briefId === brief.id) ? "ready" : "replied";
      state.flowPhase = brief.status === "ready" ? "studio" : "brief";
      return pruneExpiredSuggestions(state);
    }
    const role = getRoleFromCatalog(roleId, state.roleCatalog);
    if (!role) continue;

    const style = state.roleStyleOverrides[String(roleId)] ?? state.profile.resumeDefaultStyle;
    const existingPack = state.packs.find((item) => item.roleId === roleId && item.briefId === brief.id);
    // Self-managed applications need a tracking record, not a model call.
    if (state.profile.materialsMode === "self" && existingPack) continue;
    const generated = state.profile.materialsMode === "self" ? {
      provider: "fallback" as const,
      cvSummary: "",
      cvBullets: [],
      letter: "",
      reasoning: "Self-managed application. Prepare your documents outside HunterAgent.",
      workSampleSelections: [],
    } : await generateApplicationPack(role, state.profile, state.tone, style, {
      userId,
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

    if (state.profile.materialsMode !== "self" && generated.provider === "fallback") {
      usedFallback = true;
      // Keep an existing document and its provenance intact when a refinement
      // was not performed (budget exhausted, provider down, or invalid output).
      if (existingPack) continue;
    } else if (generated.provider === "anthropic") {
      successfulRoleIds.add(roleId);
    }
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
      followUpDraft: existingPack?.followUpDraft ?? null,
    };

    const existingIndex = state.packs.findIndex((item) => item.roleId === roleId && item.briefId === brief.id);
    if (existingIndex >= 0) {
      state.packs[existingIndex] = record;
    } else {
      state.packs.unshift(record);
    }
  }

  if (trimmedInstruction && state.profile.materialsMode !== "self") {
    for (const roleId of roleIds) {
      const promptKey = `${roleId}:${target}`;
      state.promptDrafts[promptKey] = trimmedInstruction;
      if (!successfulRoleIds.has(roleId)) continue;
      const existingHistory = state.promptHistory[promptKey] ?? [];
      state.promptHistory[promptKey] = [trimmedInstruction, ...existingHistory.filter((item) => item !== trimmedInstruction)].slice(0, 6);
    }
  }

  brief.status = "ready";
  state.flowPhase = "studio";
  state.generationStatus =
    state.profile.materialsMode === "self"
      ? "Your selected roles are ready to track. No AI materials were generated."
      : usedFallback
      ? "AI writing was unavailable or reached its limit. Existing documents were kept; new documents use a profile-based template. Your prompt is saved to retry."
      : options.intent === "edit" && options.instruction?.trim()
      ? `${targetLabel[0].toUpperCase()}${targetLabel.slice(1)} updated for ${roleIds.length} selected role${roleIds.length > 1 ? "s" : ""}.`
      : options.intent === "sharpen"
        ? `Sharpened ${targetLabel} ready for ${roleIds.length} selected role${roleIds.length > 1 ? "s" : ""}.`
        : `${targetLabel[0].toUpperCase()}${targetLabel.slice(1)} ready for ${roleIds.length} selected role${roleIds.length > 1 ? "s" : ""}.`;
  state.activeRoleId = options.roleId ?? brief.selectedRoleIds[0] ?? state.activeRoleId;
  state.activeBriefId = brief.id;
  state.lastError = null;

  return pruneExpiredSuggestions(state);
}
