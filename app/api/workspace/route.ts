import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { createBriefRecord, createInitialWorkspaceState, getRoleFromCatalog } from "@/lib/hunteragent-data";
import { buildScheduledBriefStatus } from "@/lib/agentmail";
import { prepareFreshBrief, sendPreparedBrief } from "@/lib/hunteragent-briefs";
import { readWorkspaceState, updateWorkspaceState } from "@/lib/hunteragent-store";
import { CvViewMode, ResumeStyleId, StudioTab, Tone, WorkspaceState } from "@/lib/hunteragent-types";

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

  const body = (await request.json()) as
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
    | { action: "reset_workspace" };

  const nextState = await updateWorkspaceState((state) => {
    state.lastError = null;

    switch (body.action) {
      case "sync_draft": {
        state.profile = body.profile;
        state.onboardingStep = body.onboardingStep;
        return state;
      }
      case "update_profile": {
        state.profile = body.profile;
        state.generationStatus = body.profile.briefsPaused
          ? "Daily briefs are paused. Resume them whenever you want HunterAgent to start scouting again."
          : state.generationStatus;
        return state;
      }
      case "finish_onboarding": {
        state.onboardingComplete = true;
        state.onboardingStep = 4;
        if (!state.activeBriefId) {
          const brief = createBriefRecord(state.profile.firstBrief, state.roleCatalog);
          state.briefs = [brief];
          state.activeBriefId = brief.id;
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
        const brief = state.briefs.find((item) => item.id === state.activeBriefId);
        if (!brief) {
          state.lastError = "No brief is ready to send yet.";
          return state;
        }

        if (!state.profile.recipientEmail.trim()) {
          state.lastError = "Add a recipient email before sending the brief.";
          state.flowPhase = "waiting";
          return state;
        }

        return state;
      }
      case "set_active_role": {
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
        state.roleStyleOverrides[String(body.roleId)] = body.style;
        return state;
      }
      case "mark_applied": {
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
      case "reset_workspace": {
        return createInitialWorkspaceState();
      }
      default:
        return state;
    }
  }, user.id);

  if (body.action === "finish_onboarding" || body.action === "send_first_brief_now" || body.action === "update_profile") {
    if (body.action === "update_profile") {
      return json(nextState);
    }

    const shouldSendImmediately = body.action === "send_first_brief_now" || nextState.profile.firstBrief === "now";

    try {
      const refreshedState = await updateWorkspaceState(async (state) => {
        await prepareFreshBrief(state);
        return state;
      }, user.id);

      if (shouldSendImmediately && refreshedState.profile.recipientEmail.trim()) {
        const sentState = await updateWorkspaceState(async (state) => sendPreparedBrief(state), user.id);
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
