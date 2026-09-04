import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { createInitialWorkspaceState, getRoleFromCatalog } from "@/lib/hunteragent-data";
import { buildScheduledBriefStatus } from "@/lib/agentmail";
import { prepareFreshBrief, sendPreparedBrief } from "@/lib/hunteragent-briefs";
import { readWorkspaceState, updateWorkspaceState } from "@/lib/hunteragent-store";
import { CvViewMode, ResumeStyleId, StudioTab, Tone, WorkspaceState } from "@/lib/hunteragent-types";
import { sanitizeProfile } from "@/lib/sanitize";
import { canUseRole, getRetainedBrief, hasSavedRole, normalizeBriefPreferences, pruneExpiredSuggestions } from "@/lib/hunteragent-retention";

export const runtime = "nodejs";

function json(data: WorkspaceState) {
  return NextResponse.json(data);
}

function authErrorResponse(error: unknown) {
  const message = error instanceof AuthError ? error.message : "Sign in to access HunterAgent.";
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function GET() {
  try {
    const user = await requireUser();
    return json(await readWorkspaceState(user.id));
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    return authErrorResponse(error);
  }

  const body = (await request.json().catch(() => null)) as
    | { action: "sync_draft"; profile: WorkspaceState["profile"]; onboardingStep: number }
    | { action: "update_profile"; profile: WorkspaceState["profile"] }
    | { action: "finish_onboarding" }
    | { action: "reopen_onboarding" }
    | { action: "send_first_brief_now" }
    | { action: "set_active_role"; roleId: number }
    | { action: "set_studio_tab"; tab: StudioTab }
    | { action: "set_cv_view"; mode: CvViewMode }
    | { action: "set_left_rail"; collapsed: boolean }
    | { action: "set_prompt_draft"; key: string; value: string }
    | { action: "set_tone"; tone: Tone }
    | { action: "set_default_style"; style: ResumeStyleId }
    | { action: "set_role_style"; roleId: number; style: ResumeStyleId }
    | { action: "mark_applied"; roleId: number }
    | { action: "set_active_brief"; briefId: string }
    | { action: "reset_workspace" }
    | null;

  if (!body || typeof body !== "object" || !("action" in body)) {
    return NextResponse.json({ error: "A workspace action is required." }, { status: 400 });
  }
  const validId = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (((body.action === "sync_draft" || body.action === "update_profile") && (!body.profile || typeof body.profile !== "object" || Array.isArray(body.profile)))
    || ("roleId" in body && !validId(body.roleId))
    || (body.action === "set_active_brief" && (typeof body.briefId !== "string" || !body.briefId.trim()))
    || (body.action === "sync_draft" && (!Number.isInteger(body.onboardingStep) || body.onboardingStep < 1 || body.onboardingStep > 4))
    || (body.action === "set_prompt_draft" && (typeof body.key !== "string" || typeof body.value !== "string" || body.value.length > 10_000))
    || (body.action === "set_tone" && !["balanced", "direct", "warm"].includes(body.tone))
    || ((body.action === "set_default_style" || body.action === "set_role_style") && !["minimal", "modern", "executive", "creative"].includes(body.style))
    || (body.action === "set_studio_tab" && !["cv", "letter", "workSamples", "pack"].includes(body.tab))
    || (body.action === "set_cv_view" && !["preview", "content"].includes(body.mode))
    || (body.action === "set_left_rail" && typeof body.collapsed !== "boolean")) {
    return NextResponse.json({ error: "Invalid workspace action input." }, { status: 400 });
  }

  const nextState = await updateWorkspaceState((state) => {
    pruneExpiredSuggestions(state);
    state.lastError = null;

    switch (body.action) {
      case "sync_draft": {
        state.profile = { ...state.profile, ...sanitizeProfile(body.profile as unknown as Record<string, unknown>), ...normalizeBriefPreferences(body.profile) };
        state.onboardingStep = body.onboardingStep;
        return state;
      }
      case "update_profile": {
        state.profile = { ...state.profile, ...sanitizeProfile(body.profile as unknown as Record<string, unknown>), ...normalizeBriefPreferences(body.profile) };
        state.generationStatus = body.profile.briefsPaused
          ? "Briefs are paused. Resume them whenever you want HunterAgent to start scouting again."
          : state.generationStatus;
        return state;
      }
      case "finish_onboarding": {
        state.onboardingComplete = true;
        state.onboardingStep = 4;
        if (!state.activeBriefId) {
          state.flowPhase = "waiting";
        }
        state.lastError = state.profile.recipientEmail.trim()
          ? null
          : "Add the inbox where HunterAgent should send your daily brief before finishing setup.";
        return state;
      }
      case "reopen_onboarding": {
        state.onboardingComplete = false;
        state.onboardingStep = 4;
        state.flowPhase = "onboarding";
        state.lastError = null;
        state.generationStatus = null;
        return state;
      }
      case "send_first_brief_now": {
        if (!state.profile.recipientEmail.trim()) {
          state.lastError = "Add a recipient email before sending the brief.";
          state.flowPhase = "waiting";
          return state;
        }

        return state;
      }
      case "set_active_role": {
        if (!canUseRole(state, body.roleId)) {
          state.lastError = "That suggested job has expired or is unavailable.";
          return state;
        }
        const saved = [...state.packs, ...state.appliedRecords].find((item) => item.roleId === body.roleId && item.briefId === state.activeBriefId)
          ?? [...state.packs, ...state.appliedRecords].find((item) => item.roleId === body.roleId);
        if (saved) {
          state.activeBriefId = saved.briefId;
          state.flowPhase = "studio";
        }
        state.activeRoleId = body.roleId;
        return state;
      }
      case "set_studio_tab": {
        state.studioTab = body.tab;
        return state;
      }
      case "set_cv_view": {
        state.cvViewMode = body.mode;
        return state;
      }
      case "set_left_rail": {
        state.leftRailCollapsed = body.collapsed;
        return state;
      }
      case "set_prompt_draft": {
        const match = /^(\d+):(cv|letter|workSamples|pack)$/.exec(body.key);
        if (!match || !canUseRole(state, Number(match[1]), state.activeBriefId ?? undefined)) {
          state.lastError = "That job has expired. Only saved materials can still be edited.";
          return state;
        }
        state.promptDrafts[body.key] = body.value;
        return state;
      }
      case "set_tone": {
        state.tone = body.tone;
        return state;
      }
      case "set_default_style": {
        state.profile.resumeDefaultStyle = body.style;
        return state;
      }
      case "set_role_style": {
        if (!canUseRole(state, body.roleId, state.activeBriefId ?? undefined)) {
          state.lastError = "That job has expired. Only saved materials can still be edited.";
          return state;
        }
        state.roleStyleOverrides[String(body.roleId)] = body.style;
        return state;
      }
      case "mark_applied": {
        if (!canUseRole(state, body.roleId, state.activeBriefId ?? undefined)) {
          state.lastError = "That suggested job has expired or is unavailable.";
          return state;
        }
        const activeBriefId = state.activeBriefId;
        if (!activeBriefId) return state;
        const pack = state.packs.find((item) => item.roleId === body.roleId && item.briefId === activeBriefId);
        if (!pack) return state;

        const appliedAt = new Date().toISOString();
        const existing = state.appliedRecords.find((item) => item.roleId === body.roleId);
        if (existing) {
          existing.appliedAt = appliedAt;
          existing.resumeStyleUsed = pack.resumeStyleUsed;
          existing.provider = pack.provider;
        } else {
          state.appliedRecords.unshift({
            roleId: body.roleId,
            briefId: activeBriefId,
            appliedAt,
            followUp: "off",
            followUpDueAt: null,
            followUpDraft: null,
            provider: pack.provider,
            resumeStyleUsed: pack.resumeStyleUsed,
          });
        }
        const firstRole = getRoleFromCatalog(body.roleId, state.roleCatalog);
        if (firstRole) {
          state.activeRoleId = firstRole.id;
        }
        return state;
      }
      case "set_active_brief": {
        const brief = getRetainedBrief(state, body.briefId);
        if (brief) {
          state.activeBriefId = body.briefId;
          const saved = [...state.packs, ...state.appliedRecords].find((item) => item.briefId === brief.id);
          state.activeRoleId = saved?.roleId ?? brief.selectedRoleIds[0] ?? null;
          state.flowPhase = saved && hasSavedRole(state, saved.roleId, brief.id) ? "studio" : brief.sentAt ? "brief" : "waiting";
        } else {
          state.lastError = "That brief has expired or is unavailable.";
        }
        return state;
      }
      case "reset_workspace": {
        return createInitialWorkspaceState();
      }
      default:
        state.lastError = "Unsupported workspace action.";
        return state;
    }
  }, user.id);

  if (nextState.lastError) return json(nextState);

  if (body.action === "finish_onboarding" || body.action === "send_first_brief_now" || body.action === "update_profile") {
    if (body.action === "update_profile") {
      return json(nextState);
    }

    const shouldSendImmediately = body.action === "send_first_brief_now" || nextState.profile.firstBrief === "now";

    try {
      let preparedBriefId: string | null = null;
      const refreshedState = await updateWorkspaceState(async (state) => {
        const prepared = await prepareFreshBrief(state, { userId: user.id });
        preparedBriefId = prepared.brief?.id ?? null;
        return state;
      }, user.id);
      if (!preparedBriefId) return json(refreshedState);

      if (shouldSendImmediately && refreshedState.profile.recipientEmail.trim()) {
        const sentState = await updateWorkspaceState(async (state) => sendPreparedBrief(state, preparedBriefId ?? undefined), user.id);
        return json(sentState);
      }

      const brief = refreshedState.briefs.find((item) => item.id === refreshedState.activeBriefId);
      if (body.action === "finish_onboarding" && brief) {
        const updatedState = await updateWorkspaceState((state) => {
          state.flowPhase = "waiting";
          state.generationStatus = buildScheduledBriefStatus(brief, refreshedState.profile);
          return state;
        }, user.id);
        return json(updatedState);
      }
      return json(refreshedState);
    } catch (error) {
      const updatedState = await updateWorkspaceState((state) => {
        state.flowPhase = "waiting";
        state.lastError = error instanceof Error ? error.message : "Could not prepare the brief.";
        return state;
      }, user.id);
      return json(updatedState);
    }
  }

  return json(nextState);
}
