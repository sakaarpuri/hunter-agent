"use client";

import Link from "next/link";
import { useState } from "react";
import { HunterAgentFlow, type WorkspaceTransport } from "./hunteragent-flow";
import {
  createInitialWorkspaceState,
  createBriefRecord,
  buildDueDate,
  DAILY_ROLES,
} from "@/lib/hunteragent-data";
import { canUseRole, getRetainedBrief, isRoleExpired, JOB_RETENTION_MS, normalizeBriefPreferences, pruneExpiredSuggestions } from "@/lib/hunteragent-retention";
import { shouldDiscoverNow } from "@/lib/hunteragent-scheduling";
import type {
  FlowPhase,
  PackRecord,
  Profile,
  ResumeStyleId,
  StudioTab,
  Tone,
} from "@/lib/hunteragent-types";

const user = {
  id: "local-design-preview",
  fullName: "Jamie Lee",
  email: "jamie@example.test",
  createdAt: new Date().toISOString(),
};

// Isolated fixtures for visual review. No authentication, database, email, or model calls.
export function createPreviewTransport(phase: FlowPhase, clock: () => Date = () => new Date()): WorkspaceTransport {
  const now = clock();
  let state = structuredClone(createInitialWorkspaceState());
  const sampleRoles = DAILY_ROLES.map((role, index) => {
    const firstSeen = now.getTime() - index * 60 * 60 * 1000;
    return { ...structuredClone(role), sourceUrl: `https://example.test/jobs/${role.id}`,
      fingerprint: `preview-role-${role.id}`, firstSeenAt: new Date(firstSeen).toISOString(),
      expiresAt: new Date(firstSeen + JOB_RETENTION_MS).toISOString(),
      explorationKind: index === 2 ? "adjacent" as const : "close" as const,
      sourceKind: "primary" as const, sourceVerificationStatus: "verified" as const,
      sourceVerifiedAt: now.toISOString() };
  });
  state.roleCatalog = structuredClone(sampleRoles);
  state.discoveryPool = structuredClone(sampleRoles);
  state.lastDiscoveryAt = phase === "waiting" || phase === "onboarding" ? null : now.toISOString();
  state.seenJobs = {};
  state.profile = {
    ...state.profile,
    name: "Jamie Lee",
    currentTitle: "Senior Product Designer",
    targetRoles: ["Senior Product Designer", "Design Lead", "Staff Designer"],
    recipientEmail: user.email,
    locations: "London, Europe",
    workplaceModes: ["remote", "hybrid"],
    coreStrength:
      "Simplifying complex workflows through research and thoughtful product systems",
    resumeMode: "guided",
    firstBrief: "scheduled",
    jobsPerBrief: 3,
    discoveryCadence: "daily",
    explorationMode: "stretch",
    workSampleLinks: ["https://example.com/case-study"],
    guidedResume: {
      professionalSummary:
        "Product designer bringing clarity to complex digital products.",
      experienceSnapshot:
        "Senior Product Designer, Common Ground, 2021-present. Product Designer, Forma Studio, 2018-2021.",
      recentImpact:
        "Led discovery and design for a multi-step onboarding experience. Established shared design-system patterns with engineering.",
      skills:
        "Product strategy, user research, interaction design, design systems, prototyping",
      education: "BA (Hons) Design, 2018",
    },
  };
  const brief = createBriefRecord("scheduled", state.roleCatalog, state.profile.jobsPerBrief);
  brief.id = "design-brief";
  brief.createdAt = now.toISOString();
  brief.scheduledFor = now.toISOString();
  brief.recipientEmail = user.email;
  brief.sentAt =
    phase === "waiting" || phase === "onboarding" ? null : brief.createdAt;
  brief.status =
    phase === "studio" ? "ready" : phase === "brief" ? "sent" : "scheduled";
  brief.selectedRoleIds = phase === "studio" ? [1, 2] : [];
  state.briefs = [brief];
  state.activeBriefId = brief.id;
  state.onboardingComplete = phase !== "onboarding";
  state.flowPhase = phase;
  state.activeRoleId = phase === "studio" ? 1 : null;
  if (brief.sentAt) {
    for (const id of brief.roleIds) {
      const role = state.roleCatalog.find((item) => item.id === id)!;
      state.seenJobs[role.fingerprint!] = role.firstSeenAt!;
    }
    state.discoveryPool = state.discoveryPool.filter((role) => !brief.roleIds.includes(role.id));
  }

  function sendPreviewBrief() {
    if (state.profile.briefsPaused) throw new Error("Resume brief emails in settings first.");
    const sentAt = clock();
    if (shouldDiscoverNow(state.profile, state.lastDiscoveryAt, sentAt)) {
      state.lastDiscoveryAt = sentAt.toISOString();
      // A finite fictional pool: no fabricated replacements when it runs out.
      state.discoveryPool = sampleRoles.filter((role) => !state.seenJobs?.[role.fingerprint!] && !isRoleExpired(role, sentAt));
    }
    const matches = (state.discoveryPool ?? []).filter((role) => !state.seenJobs?.[role.fingerprint!] && !isRoleExpired(role, sentAt));
    if (!matches.length) {
      state.lastError = "No genuine new matches. No email was sent and no roles were added to fill the count.";
      return;
    }
    const next = createBriefRecord("now", matches, state.profile.jobsPerBrief);
    Object.assign(next, { createdAt: sentAt.toISOString(), sentAt: sentAt.toISOString(), recipientEmail: user.email, status: "sent" });
    state.briefs = [next, ...state.briefs.filter((item) => item.sentAt)];
    state.activeBriefId = next.id;
    state.flowPhase = "brief";
    state.lastError = null;
    for (const id of next.roleIds) {
      const role = matches.find((item) => item.id === id)!;
      state.seenJobs![role.fingerprint!] = role.firstSeenAt!;
    }
    state.discoveryPool = matches.filter((role) => !next.roleIds.includes(role.id));
  }

  function samplePack(roleId: number): PackRecord {
    const role = state.roleCatalog.find((r) => r.id === roleId)!;
    return {
      id: `design-pack-${state.activeBriefId}-${roleId}`,
      roleId,
      briefId: state.activeBriefId!,
      generatedAt: clock().toISOString(),
      provider: "fallback",
      tone: state.tone,
      resumeStyleUsed: state.profile.resumeDefaultStyle,
      resumeSourceType: "guided",
      cvSummary:
        "Product designer with experience in research, systems, and end-to-end delivery. I help teams turn complex workflows into clear, considered digital experiences.",
      cvBullets: [
        "Led discovery and design for a multi-step onboarding experience, translating user research into a clearer first-run journey.",
        "Partnered with engineering to establish reusable design patterns across a growing product.",
        "Facilitated product workshops to align cross-functional teams around user needs and delivery priorities.",
      ],
      letter: `Hello ${role.company} team,\n\nYour focus on ${role.focus[0]} caught my attention. I enjoy the work of making complex products feel simple, and I would welcome the opportunity to bring that approach to your ${role.title.toLowerCase()} role.\n\nAt Common Ground, I led research and design for onboarding workflows and collaborated closely with engineering on shared patterns. I am comfortable moving from an open-ended problem to a thoughtful, testable solution.\n\nI would love to discuss where your team is heading and how I could contribute.\n\nBest,\nJamie Lee`,
      reasoning:
        "This example draws on Jamie's product-systems and research experience. Review every claim against the original CV before using generated materials.",
      workSampleSelections: [
        {
          title: "Onboarding experience",
          note: "Shows discovery and interaction design for a complex workflow.",
          href: "https://example.com/case-study",
        },
      ],
      followUpDraft: null,
    };
  }
  state.packs = phase === "studio" ? [samplePack(1), samplePack(2)] : [];
  return async (url, body) => {
    pruneExpiredSuggestions(state, clock());
    const b = (body ?? {}) as Record<string, unknown>;
    if (url.startsWith("/api/auth"))
      throw new Error(
        "Account changes are unavailable in the local design preview.",
      );
    if (url === "/api/workspace" && body) {
      switch (b.action) {
        case "set_active_role":
          if (!canUseRole(state, Number(b.roleId), state.activeBriefId ?? undefined, clock())) throw new Error("This suggestion expired. Saved materials remain available separately.");
          state.activeRoleId = Number(b.roleId);
          break;
        case "set_studio_tab":
          state.studioTab = b.tab as StudioTab;
          break;
        case "set_cv_view":
          state.cvViewMode = b.mode as "preview" | "content";
          break;
        case "set_left_rail":
          state.leftRailCollapsed = Boolean(b.collapsed);
          break;
        case "set_tone":
          state.tone = b.tone as Tone;
          break;
        case "set_role_style":
          state.roleStyleOverrides[String(b.roleId)] = b.style as ResumeStyleId;
          break;
        case "set_default_style":
          state.profile.resumeDefaultStyle = b.style as ResumeStyleId;
          break;
        case "set_prompt_draft":
          state.promptDrafts[String(b.key)] = String(b.value);
          break;
        case "sync_draft":
          state.profile = { ...(b.profile as Profile), ...normalizeBriefPreferences(b.profile) };
          state.onboardingStep = Number(b.onboardingStep);
          break;
        case "update_profile":
          state.profile = { ...(b.profile as Profile), ...normalizeBriefPreferences(b.profile) };
          break;
        case "finish_onboarding":
          state.onboardingComplete = true;
          state.flowPhase = "waiting";
          if (state.profile.firstBrief === "now") sendPreviewBrief();
          break;
        case "send_first_brief_now":
          sendPreviewBrief();
          break;
        case "set_active_brief":
          if (!getRetainedBrief(state, String(b.briefId))) throw new Error("This brief has expired and has no saved materials.");
          state.activeBriefId = String(b.briefId);
          break;
        case "reopen_onboarding":
          state.onboardingComplete = false;
          state.flowPhase = "onboarding";
          state.onboardingStep = 1;
          break;
        case "reset_workspace":
          state = structuredClone(createInitialWorkspaceState());
          break;
        case "mark_applied": {
          const roleId = Number(b.roleId);
          if (!state.appliedRecords.some((r) => r.roleId === roleId))
            state.appliedRecords.push({
              roleId,
              briefId: state.activeBriefId!,
              appliedAt: clock().toISOString(),
              followUp: "off",
              followUpDueAt: null,
              followUpDraft: null,
              provider: "fallback",
              resumeStyleUsed: state.profile.resumeDefaultStyle,
            });
          break;
        }
        case "set_role_feedback": {
          const roleId = Number(b.roleId);
          const role = state.roleCatalog.find((item) => item.id === roleId);
          if (role) state.roleFeedback[String(roleId)] = {
            roleId,
            reaction: b.reaction as "interested" | "not_for_me",
            ...(b.reason ? { reason: b.reason as "salary" | "location" | "company" | "seniority" | "direction" | "not_exciting" } : {}),
            title: role.title,
            company: role.company,
            location: role.location,
            explorationKind: role.explorationKind ?? "close",
            updatedAt: clock().toISOString(),
          };
          break;
        }
        default:
          throw new Error("That action is not part of the design preview.");
      }
    } else if (url === "/api/inbound-email") {
      const target = state.briefs.find((item) => item.id === b.briefId);
      if (!target) throw new Error("This suggestion expired. Choose a current role.");
      const positions = String(b.rawText).match(/\d+/g)?.map(Number) ?? [];
      const ids = [...new Set(positions
        .map((n) => (target.replyRoleIds ?? target.roleIds)[n - 1])
        .filter((id) => target.roleIds.includes(id) && state.roleCatalog.some((role) => role.id === id && !isRoleExpired(role, clock()))))];
      if (!ids.length) throw new Error("Select a role, or enter its number.");
      target.selectedRoleIds = ids;
      target.status = "replied";
      state.activeRoleId = ids[0];
      state.flowPhase = "brief";
    } else if (url === "/api/generate-packs") {
      const target = getRetainedBrief(state, String(b.briefId));
      if (!target) throw new Error("This brief has no current selections or saved materials.");
      const ids = b.roleId
        ? [Number(b.roleId)]
        : target.selectedRoleIds;
      for (const id of ids) {
        if (!canUseRole(state, id, target.id, clock())) throw new Error("This suggestion expired.");
        if (!state.packs.some((p) => p.roleId === id && p.briefId === target.id)) {
          const pack = samplePack(id);
          state.packs.push(state.profile.materialsMode === "self"
            ? { ...pack, cvSummary: "", cvBullets: [], letter: "", reasoning: "Self-managed application. No AI materials generated.", workSampleSelections: [] }
            : pack);
        }
        if (b.instruction && state.profile.materialsMode !== "self") {
          const key = `${id}:${b.target ?? "pack"}`;
          state.promptHistory[key] = [
            String(b.instruction),
            ...(state.promptHistory[key] ?? []).filter(
              (p) => p !== b.instruction,
            ),
          ].slice(0, 5);
        }
      }
      state.flowPhase = "studio";
      target.status = "ready";
    } else if (url === "/api/follow-up") {
      const record = state.appliedRecords.find(
        (r) => r.roleId === Number(b.roleId),
      );
      if (record) {
        record.followUp = b.plan as "off" | "7" | "14";
        record.followUpDueAt =
          b.plan === "off"
            ? null
            : buildDueDate(record.appliedAt, Number(b.plan) as 7 | 14);
        record.followUpDraft =
          b.plan === "off"
            ? null
            : "Hello, I wanted to follow up on my application and see if there is any additional context I can share. Best, Jamie";
      }
    }
    if (body) state.stateVersion++;
    return structuredClone(state);
  };
}

export function DesignWorkspace({ phase }: { phase: FlowPhase }) {
  const [transport] = useState(() => createPreviewTransport(phase));
  return (
    <>
      <div className="design-preview-banner">
        <strong>LOCAL DESIGN PREVIEW</strong>
        <span>Fictional data. No emails or AI calls. Reload to reset.</span>
        <nav aria-label="Preview state">
          {["onboarding", "waiting", "brief", "studio"].map((p) => (
            <Link
              key={p}
              href={`/design-preview?state=${p}`}
              aria-current={p === phase ? "page" : undefined}
            >
              {p}
            </Link>
          ))}
        </nav>
      </div>
      <HunterAgentFlow user={user} transport={transport} />
    </>
  );
}
