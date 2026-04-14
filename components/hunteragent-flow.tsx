"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowLeft,
  CalendarDots,
  CaretLeft,
  CaretRight,
  CheckCircle,
  ClockCountdown,
  EnvelopeSimple,
  Folders,
  GlobeHemisphereWest,
  ListChecks,
  MapPin,
  PaperPlaneTilt,
  Palette,
  PencilSimple,
  Sparkle,
  Target,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import type { AuthUser } from "@/lib/auth";
import {
  REMOTE_REGION_OPTIONS,
  RESUME_STYLES,
  WORKPLACE_MODE_OPTIONS,
  estimateMinutes,
  formatAppliedDate,
  formatClock,
  formatRoleCode,
  getResumeStyle,
  getRoleFromCatalog,
  initialProfile,
  parsePreferenceList,
} from "@/lib/hunteragent-data";
import {
  AppliedRecord,
  CvViewMode,
  PackIntent,
  PackTarget,
  Profile,
  ProofMode,
  RemoteRegion,
  ResumeStyleId,
  Role,
  StudioTab,
  Tone,
  WorkplaceMode,
  WorkspaceState,
} from "@/lib/hunteragent-types";
import { buildCvPrintHtml, CvPreview, getCvExportMetadata } from "@/components/cv-preview";
import { TrustExplanationPanel } from "@/components/trust-explanation-panel";
import { buildTrustExplanation } from "@/lib/hunteragent-trust";

type NavItem = {
  label: string;
  icon: typeof ListChecks;
  active: boolean;
  action?: () => void;
};

const ONBOARDING_STEPS = [
  { id: 1, label: "Profile" },
  { id: 2, label: "Preferences" },
  { id: 3, label: "Resume Setup" },
  { id: 4, label: "Delivery" },
] as const;

const PROCESSING_STAGES = [
  "Analysing the roles you selected",
  "Drafting your resume and cover letter",
  "Selecting the best supporting materials",
] as const;

const EDIT_PROMPT_SUGGESTIONS = ["Make it more direct", "Focus on growth work", "Sound more senior"] as const;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T | { error?: string };

  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? "Request failed");
  }

  return payload as T;
}

export function HunterAgentFlow({ user }: { user: AuthUser }) {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [draftProfile, setDraftProfile] = useState<Profile>(initialProfile);
  const [draftStep, setDraftStep] = useState(1);
  const [replyInput, setReplyInput] = useState("1, 4");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState(0);
  const [clientError, setClientError] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [designReferenceOpen, setDesignReferenceOpen] = useState(false);
  const [trustPanelOpen, setTrustPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState(user.fullName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  const draftReadyRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    setClientError(null);

    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const nextState = (await response.json()) as WorkspaceState;
      setWorkspace(nextState);
      setDraftProfile(nextState.profile);
      setDraftStep(nextState.onboardingStep);
      draftReadyRef.current = true;

      const activeBrief = nextState.briefs.find((item) => item.id === nextState.activeBriefId);
      const latestReply = activeBrief?.inboundRecords[0]?.rawText;
      if (latestReply) {
        setReplyInput(latestReply);
      }
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not load the workspace.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();

    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
      }
      if (promptTimerRef.current) {
        clearTimeout(promptTimerRef.current);
      }
    };
  }, [loadWorkspace]);

  useEffect(() => {
    setSettingsName(user.fullName);
  }, [user.fullName]);

  useEffect(() => {
    if (!draftReadyRef.current) return;
    if (workspace?.onboardingComplete) return;

    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
    }

    draftTimerRef.current = setTimeout(async () => {
      try {
        setIsSavingDraft(true);
        const nextState = await postJson<WorkspaceState>("/api/workspace", {
          action: "sync_draft",
          profile: draftProfile,
          onboardingStep: draftStep,
        });
        setWorkspace(nextState);
      } catch (error) {
        setClientError(error instanceof Error ? error.message : "Could not save the draft.");
      } finally {
        setIsSavingDraft(false);
      }
    }, 320);

    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
    };
  }, [draftProfile, draftStep, workspace?.onboardingComplete]);

  const activeBrief = useMemo(
    () => workspace?.briefs.find((item) => item.id === workspace.activeBriefId) ?? null,
    [workspace],
  );

  const selectedRoles = useMemo(
    () => (activeBrief?.selectedRoleIds ?? []).map((roleId) => getRoleFromCatalog(roleId, workspace?.roleCatalog ?? [])).filter(Boolean) as Role[],
    [activeBrief, workspace?.roleCatalog],
  );

  const activeRole = useMemo(() => {
    if (!workspace) return null;
    const roleId = workspace.activeRoleId ?? activeBrief?.selectedRoleIds[0] ?? null;
    return roleId ? getRoleFromCatalog(roleId, workspace.roleCatalog) : null;
  }, [activeBrief, workspace]);

  const activePack = useMemo(() => {
    if (!workspace || !activeRole) return null;
    const briefId = activeBrief?.id;
    return (
      workspace.packs.find((item) => item.roleId === activeRole.id && item.briefId === briefId) ??
      workspace.packs.find((item) => item.roleId === activeRole.id) ??
      null
    );
  }, [activeBrief?.id, activeRole, workspace]);

  const appliedDetails = useMemo(() => {
    if (!workspace) return [];
    return workspace.appliedRecords
      .map((record) => ({
        ...record,
        role: getRoleFromCatalog(record.roleId, workspace.roleCatalog),
      }))
      .filter((item): item is AppliedRecord & { role: Role } => Boolean(item.role));
  }, [workspace]);

  const effectiveStyle = activeRole
    ? workspace?.roleStyleOverrides[String(activeRole.id)] ?? draftProfile.resumeDefaultStyle
    : draftProfile.resumeDefaultStyle;

  const trustExplanation = useMemo(() => {
    if (!activeRole || !activePack) return null;
    return buildTrustExplanation({
      profile: draftProfile,
      role: activeRole,
      styleId: effectiveStyle,
      selectedWorkSamples: activePack.workSampleSelections,
    });
  }, [activePack, activeRole, draftProfile, effectiveStyle]);

  const activeProofMode: ProofMode = activeRole?.proofMode ?? "none";
  const hasUserWorkSamples = draftProfile.workSampleLinks.some((item) => item.trim());
  const showWorkSamplesTab =
    !!activeRole && activeProofMode !== "none" && (activeProofMode !== "optional" || hasUserWorkSamples || activeRole.workSamples.length > 0);
  const visibleStudioTabs = ([
    ["cv", "CV"],
    ["letter", "Cover Letter"],
    ...(showWorkSamplesTab ? ([["workSamples", "Work Samples"]] as Array<[StudioTab, string]>) : []),
    ["pack", "Pack"],
  ] as Array<[StudioTab, string]>);
  const promptKey = activeRole ? `${activeRole.id}:${workspace?.studioTab ?? "cv"}` : null;
  const promptHistory = promptKey ? workspace?.promptHistory[promptKey] ?? [] : [];

  async function runWorkspaceAction(body: unknown) {
    const nextState = await postJson<WorkspaceState>("/api/workspace", body);
    setWorkspace(nextState);
    return nextState;
  }

  async function handleSettingsNameSave() {
    setIsSavingSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);

    try {
      const payload = await postJson<{ user: AuthUser | null }>("/api/auth/settings", {
        action: "update_name",
        name: settingsName,
      });
      setSettingsName(payload.user?.fullName ?? settingsName);
      setSettingsNotice("Name updated.");
      window.location.reload();
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not update the name.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);

    try {
      const payload = await postJson<{ ok: boolean; signedOut?: boolean }>("/api/auth/settings", {
        action: "change_password",
        currentPassword,
        newPassword,
      });
      if (payload.signedOut) {
        await postJson("/api/auth/logout", {});
        window.location.reload();
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setSettingsNotice("Password updated.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not change the password.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleSignOut() {
    await postJson("/api/auth/logout", {});
    window.location.reload();
  }

  async function handlePreferenceSave() {
    if (!workspace) return;

    setIsSavingPreferences(true);
    setClientError(null);
    setSettingsError(null);
    setSettingsNotice(null);

    try {
      const nextState = await runWorkspaceAction({
        action: "update_profile",
        profile: draftProfile,
      });
      setDraftProfile(nextState.profile);
      setSettingsNotice(
        nextState.profile.briefsPaused
          ? "Preferences saved. Daily briefs are paused until you turn them back on."
          : "Preferences saved. HunterAgent will use these settings for future briefs.",
      );
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not save the scouting preferences.");
    } finally {
      setIsSavingPreferences(false);
    }
  }

  function toggleWorkplaceMode(mode: WorkplaceMode) {
    setDraftProfile((current) => ({
      ...current,
      workplaceModes: current.workplaceModes.includes(mode)
        ? current.workplaceModes.filter((item) => item !== mode)
        : [...current.workplaceModes, mode],
    }));
  }

  function toggleRemoteRegion(region: RemoteRegion) {
    setDraftProfile((current) => ({
      ...current,
      remoteRegions: current.remoteRegions.includes(region)
        ? current.remoteRegions.filter((item) => item !== region)
        : [...current.remoteRegions, region],
    }));
  }

  useEffect(() => {
    if (!promptKey || !workspace) return;
    setEditInstruction(workspace.promptDrafts[promptKey] ?? "");
  }, [promptKey, workspace]);

  useEffect(() => {
    if (!workspace || showWorkSamplesTab || workspace.studioTab !== "workSamples") return;
    void runWorkspaceAction({ action: "set_studio_tab", tab: "pack" });
  }, [showWorkSamplesTab, workspace]);

  useEffect(() => {
    if (!promptKey || !workspace) return;
    if ((workspace.promptDrafts[promptKey] ?? "") === editInstruction) return;

    if (promptTimerRef.current) {
      clearTimeout(promptTimerRef.current);
    }

    promptTimerRef.current = setTimeout(async () => {
      try {
        await runWorkspaceAction({ action: "set_prompt_draft", key: promptKey, value: editInstruction });
      } catch (error) {
        setClientError(error instanceof Error ? error.message : "Could not save the refinement prompt.");
      }
    }, 260);

    return () => {
      if (promptTimerRef.current) {
        clearTimeout(promptTimerRef.current);
      }
    };
  }, [editInstruction, promptKey, workspace]);

  async function persistDraftNow() {
    const nextState = await postJson<WorkspaceState>("/api/workspace", {
      action: "sync_draft",
      profile: draftProfile,
      onboardingStep: draftStep,
    });
    setWorkspace(nextState);
    return nextState;
  }

  async function handleFinishOnboarding() {
    try {
      setClientError(null);
      if (!draftProfile.recipientEmail.trim()) {
        setClientError("Add the inbox where HunterAgent should send your daily brief before finishing setup.");
        return;
      }
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
      await persistDraftNow();
      const nextState = await runWorkspaceAction({ action: "finish_onboarding" });
      setDraftProfile(nextState.profile);
      setDraftStep(nextState.onboardingStep);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not finish onboarding.");
    }
  }

  async function handleSendFirstBriefNow() {
    try {
      setClientError(null);
      await runWorkspaceAction({ action: "send_first_brief_now" });
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not send the first brief.");
    }
  }

  async function handleReopenOnboarding() {
    try {
      setClientError(null);
      const nextState = await runWorkspaceAction({ action: "reopen_onboarding" });
      setDraftProfile(nextState.profile);
      setDraftStep(nextState.onboardingStep);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not reopen setup.");
    }
  }

  async function handleReset() {
    try {
      setClientError(null);
      const nextState = await runWorkspaceAction({ action: "reset_workspace" });
      setDraftProfile(nextState.profile);
      setDraftStep(nextState.onboardingStep);
      setReplyInput("1, 4");
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not reset the workspace.");
    }
  }

  async function generatePacks(options?: { roleId?: number; target?: PackTarget; intent?: PackIntent; instruction?: string }) {
    if (!activeBrief) return;

    try {
      setClientError(null);
      setIsGenerating(true);
      setGenerationStage(0);
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
      }
      generationTimerRef.current = setInterval(() => {
        setGenerationStage((current) => (current + 1) % PROCESSING_STAGES.length);
      }, 950);

      const nextState = await postJson<WorkspaceState>("/api/generate-packs", {
        briefId: activeBrief.id,
        roleId: options?.roleId,
        target: options?.target,
        intent: options?.intent,
        instruction: options?.instruction,
      });
      setWorkspace(nextState);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not generate the application packs.");
    } finally {
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
      }
      setIsGenerating(false);
      setGenerationStage(0);
    }
  }

  function targetFromStudioTab(tab: StudioTab): PackTarget {
    if (tab === "cv") return "cv";
    if (tab === "letter") return "letter";
    if (tab === "workSamples") return "workSamples";
    return "pack";
  }

  function targetLabel(target: PackTarget) {
    if (target === "cv") return "CV";
    if (target === "letter") return "cover letter";
    if (target === "workSamples") return "work sample reasoning";
    return "pack";
  }

  async function handleSharpenPack() {
    if (!activeRole) return;
    await generatePacks({ roleId: activeRole.id, target: "pack", intent: "sharpen" });
  }

  async function handleSectionEdit(target: PackTarget) {
    if (!activeRole) return;
    await generatePacks({
      roleId: activeRole.id,
      target,
      intent: editInstruction.trim() ? "edit" : "refresh",
      instruction: editInstruction.trim() || undefined,
    });
  }

  function handleSuggestionClick(suggestion: string) {
    setEditInstruction((current) => {
      if (!current.trim()) return suggestion;
      if (current.includes(suggestion)) return current;
      return `${current.trim()} ${suggestion}`;
    });
  }

  async function handleEditCurrentTabOnly() {
    if (!activeRole || !workspace) return;
    await handleSectionEdit(targetFromStudioTab(workspace.studioTab));
  }

  function handleClearPrompt() {
    setEditInstruction("");
  }

  async function handleInboundReplySubmit() {
    if (!activeBrief || !replyInput.trim()) return;

    try {
      setClientError(null);
      setIsSubmittingReply(true);
      const nextState = await postJson<WorkspaceState>("/api/inbound-email", {
        briefId: activeBrief.id,
        rawText: replyInput,
        source: "dashboard",
      });
      setWorkspace(nextState);

      const repliedBrief = nextState.briefs.find((item) => item.id === activeBrief.id);
      if (repliedBrief?.selectedRoleIds.length) {
        await generatePacks();
      }
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not parse the inbound email.");
    } finally {
      setIsSubmittingReply(false);
    }
  }

  async function handleToneChange(nextTone: Tone) {
    if (!workspace) return;
    try {
      setClientError(null);
      const nextState = await runWorkspaceAction({ action: "set_tone", tone: nextTone });
      if (nextState.activeRoleId) {
        await generatePacks({ roleId: nextState.activeRoleId });
      }
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not update the tone.");
    }
  }

  async function handleStudioTab(tab: StudioTab) {
    if (!workspace) return;
    try {
      setClientError(null);
      const nextState = await runWorkspaceAction({ action: "set_studio_tab", tab });
      if (tab !== "cv" && nextState.cvViewMode !== "content") {
        await runWorkspaceAction({ action: "set_cv_view", mode: "content" satisfies CvViewMode });
      }
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not switch the studio tab.");
    }
  }

  async function handleCvViewMode(mode: CvViewMode) {
    try {
      setClientError(null);
      await runWorkspaceAction({ action: "set_cv_view", mode });
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not switch the CV preview.");
    }
  }

  async function handleActiveRole(roleId: number) {
    try {
      setClientError(null);
      await runWorkspaceAction({ action: "set_active_role", roleId });
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not switch the active role.");
    }
  }

  async function handleRoleStyle(styleId: ResumeStyleId) {
    if (!activeRole) return;
    try {
      setClientError(null);
      await runWorkspaceAction({ action: "set_role_style", roleId: activeRole.id, style: styleId });
      await generatePacks({ roleId: activeRole.id });
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not update the resume style.");
    }
  }

  async function handleMakeDefaultStyle(styleId: ResumeStyleId) {
    try {
      setClientError(null);
      const nextState = await runWorkspaceAction({ action: "set_default_style", style: styleId });
      setDraftProfile(nextState.profile);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not update the default style.");
    }
  }

  async function handleLeftRailToggle() {
    if (!workspace) return;
    try {
      setClientError(null);
      await runWorkspaceAction({ action: "set_left_rail", collapsed: !workspace.leftRailCollapsed });
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not resize the navigation rail.");
    }
  }

  function handleExportCvPreview() {
    if (!activePack) return;
    const html = buildCvPrintHtml(draftProfile, activePack, effectiveStyle, activeRole);
    const metadata = getCvExportMetadata(draftProfile, activePack, effectiveStyle, activeRole);
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=980,height=1200");
    if (!printWindow) {
      setClientError("The CV preview could not open a print window. Allow pop-ups and try again.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = metadata.title;
    printWindow.document.documentElement.setAttribute("data-export-filename", metadata.filename);
    printWindow.document.documentElement.setAttribute("data-export-title", metadata.title);
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  async function handleMarkApplied() {
    if (!activeRole) return;
    try {
      setClientError(null);
      await runWorkspaceAction({ action: "mark_applied", roleId: activeRole.id });
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not mark the role as applied.");
    }
  }

  async function handleFollowUpPlan(roleId: number, plan: AppliedRecord["followUp"]) {
    try {
      setClientError(null);
      const nextState = await postJson<WorkspaceState>("/api/follow-up", { roleId, plan });
      setWorkspace(nextState);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not update follow-up.");
    }
  }

  const navItems: NavItem[] = [
    { label: "Setup", icon: ListChecks, active: workspace?.flowPhase === "onboarding" },
    { label: "Today", icon: EnvelopeSimple, active: ["waiting", "brief", "processing"].includes(workspace?.flowPhase ?? "onboarding") },
    { label: "Studio", icon: Sparkle, active: workspace?.flowPhase === "studio" },
    { label: "Applied", icon: Folders, active: (workspace?.appliedRecords.length ?? 0) > 0 },
    { label: "Follow Up", icon: CalendarDots, active: (workspace?.appliedRecords.some((item) => item.followUp !== "off") ?? false) },
    { label: "Reset", icon: ArrowClockwise, active: false, action: handleReset },
  ];

  const stageLabel =
    workspace?.flowPhase === "onboarding"
      ? "Let's get you set up"
      : workspace?.flowPhase === "waiting"
        ? "First brief scheduled"
        : workspace?.flowPhase === "brief"
          ? "Today’s email brief is live"
          : workspace?.flowPhase === "processing"
      ? "Building your application materials"
            : "Application studio";

  const isStudioLayout = workspace?.flowPhase === "studio";

  if (isLoading || !workspace) {
    return (
      <div className="overflow-hidden rounded-[2rem] border border-[var(--border-soft)] bg-white shadow-[0_35px_85px_-38px_rgba(21,49,46,0.32)]">
        <div className="grid min-h-[860px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1.15fr)_360px]">
          <aside className="hidden border-b border-[var(--border-soft)] bg-[var(--surface)] px-5 py-6 lg:block lg:border-r lg:border-b-0">
            <div className="skeleton-bar h-11 rounded-2xl" />
            <div className="mt-8 grid gap-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="skeleton-bar h-12 rounded-2xl" />
              ))}
            </div>
          </aside>
          <main className="border-b border-[var(--border-soft)] px-5 py-6 lg:border-r lg:border-b-0 lg:px-6 xl:px-8">
            <div className="skeleton-bar h-20 rounded-[1.7rem]" />
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="skeleton-bar h-48 rounded-[1.9rem]" />
              ))}
            </div>
          </main>
          <section className="bg-[var(--surface)] px-5 py-6 lg:px-6 xl:px-7">
            <div className="skeleton-bar h-[640px] rounded-[1.9rem]" />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--border-soft)] bg-white shadow-[0_35px_85px_-38px_rgba(21,49,46,0.32)]">
      <div
        className={cn(
          "grid min-h-[860px] grid-cols-1",
          isStudioLayout
            ? workspace.leftRailCollapsed
              ? "lg:grid-cols-[92px_minmax(0,1fr)_minmax(520px,1.25fr)]"
              : "lg:grid-cols-[260px_minmax(0,1fr)_minmax(470px,1.1fr)]"
            : workspace.leftRailCollapsed
              ? "lg:grid-cols-[92px_minmax(0,1.2fr)_minmax(360px,0.8fr)]"
              : "lg:grid-cols-[260px_minmax(0,1.18fr)_minmax(360px,0.82fr)]",
        )}
      >
        <aside className={cn("hidden border-b border-[var(--border-soft)] bg-[var(--surface)] py-6 lg:block lg:border-r lg:border-b-0", workspace.leftRailCollapsed ? "px-3" : "px-5")}>
          <div className={cn("flex items-center", workspace.leftRailCollapsed ? "justify-center" : "justify-between")}>
            {!workspace.leftRailCollapsed && (
              <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                HunterAgent
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ink)]">
                Daily brief at {draftProfile.briefTime}
              </h2>
              </div>
            )}
            <div className="flex items-center gap-2">
              {!workspace.leftRailCollapsed && (
                <Link
                  href="/"
                  className="rounded-full border border-[var(--border-soft)] bg-white p-2 text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                >
                  <ArrowLeft size={18} />
                </Link>
              )}
              <button
                type="button"
                onClick={() => void handleLeftRailToggle()}
                className="rounded-full border border-[var(--border-soft)] bg-white p-2 text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                aria-label={workspace.leftRailCollapsed ? "Expand navigation rail" : "Collapse navigation rail"}
                title={workspace.leftRailCollapsed ? "Expand navigation rail" : "Collapse navigation rail"}
              >
                {workspace.leftRailCollapsed ? <CaretRight size={18} /> : <CaretLeft size={18} />}
              </button>
            </div>
          </div>

          <nav className={cn("grid gap-2 text-sm", workspace.leftRailCollapsed ? "mt-6" : "mt-8")}>
            {navItems.map(({ label, icon: Icon, active, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className={cn(
                  "flex items-center rounded-2xl py-3 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                  workspace.leftRailCollapsed ? "justify-center px-0" : "gap-3 px-3",
                  active ? "bg-[var(--accent)] text-white shadow-[0_20px_50px_-34px_rgba(18,108,100,0.9)]" : "text-[var(--muted)] hover:bg-white",
                )}
                title={workspace.leftRailCollapsed ? label : undefined}
              >
                <Icon size={18} weight={active ? "fill" : "duotone"} />
                {!workspace.leftRailCollapsed && <span className="font-medium">{label}</span>}
              </button>
            ))}
          </nav>

          {!workspace.leftRailCollapsed && <div className="mt-10 rounded-[1.7rem] border border-[var(--border-soft)] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
              Delivery
            </p>
            <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between gap-3">
                <span>Timezone</span>
                <span className="font-mono text-[var(--ink)]">{draftProfile.timezone}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Brief time</span>
                <span className="font-mono text-[var(--ink)]">{draftProfile.briefTime}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>First brief</span>
                <span className="text-[var(--ink)]">{draftProfile.firstBrief === "now" ? "Send now" : "Scheduled"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Recipient</span>
                <span className="text-[var(--ink)]">{draftProfile.recipientEmail || "Not set"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Draft autosave</span>
                <span className={cn("font-medium", isSavingDraft ? "text-[var(--accent)]" : "text-[var(--muted)]")}>
                  {isSavingDraft ? "Saving" : "Live"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Brief status</span>
                <span className={cn("font-medium", draftProfile.briefsPaused ? "text-amber-600" : "text-[var(--accent)]")}>
                  {draftProfile.briefsPaused ? "Paused" : "Active"}
                </span>
              </div>
            </div>
          </div>}

          {!workspace.leftRailCollapsed && <div className="mt-6 rounded-[1.7rem] border border-[var(--border-soft)] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
              Your profile
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
              <div className="flex items-start gap-3">
                <UserCircle size={18} className="mt-1 text-[var(--accent)]" />
                <div>
                  <p className="font-medium text-[var(--ink)]">{draftProfile.name}</p>
                  <p>{draftProfile.currentTitle}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Target size={18} className="mt-1 text-[var(--accent)]" />
                <div>
                  <p className="font-medium text-[var(--ink)]">Target roles</p>
                  <p>{draftProfile.targetRoles.filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <GlobeHemisphereWest size={18} className="mt-1 text-[var(--accent)]" />
                <div>
                  <p className="font-medium text-[var(--ink)]">Locations</p>
                  <p>{draftProfile.locations}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Palette size={18} className="mt-1 text-[var(--accent)]" />
                <div>
                  <p className="font-medium text-[var(--ink)]">Default style</p>
                  <p>{getResumeStyle(draftProfile.resumeDefaultStyle).label}</p>
                </div>
              </div>
            </div>
          </div>}

          {!workspace.leftRailCollapsed && workspace.appliedRecords.length > 0 && (
            <div className="mt-6 rounded-[1.7rem] border border-[var(--border-soft)] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Applications</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Applied</span>
                  <span className="font-semibold text-[var(--ink)]">{workspace.appliedRecords.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">With follow-up</span>
                  <span className="font-semibold text-[var(--ink)]">
                    {workspace.appliedRecords.filter((r) => r.followUp && r.followUp !== "off").length}
                  </span>
                </div>
                {workspace.appliedRecords.length > 0 && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{
                        width: `${Math.min(100, (workspace.appliedRecords.filter((r) => r.followUp && r.followUp !== "off").length / workspace.appliedRecords.length) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        <main className="border-b border-[var(--border-soft)] px-5 py-6 lg:border-r lg:border-b-0 lg:px-6 xl:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-5">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                Workflow
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-4xl">
                {stageLabel}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                {workspace.flowPhase === "onboarding" &&
                  "Set the profile, resume source, design direction, and delivery rhythm once. HunterAgent keeps the discovery loop in email and the deeper work in the dashboard."}
                {workspace.flowPhase === "waiting" &&
                  draftProfile.briefsPaused
                    ? "Daily briefs are paused. Keep shaping the workspace, then resume the scout in settings whenever you want HunterAgent sending again."
                    : `The first brief is scheduled for ${draftProfile.briefTime} ${draftProfile.timezone}. Send it now for the walkthrough or leave it queued for the selected time.`}
                {workspace.flowPhase === "brief" &&
                  "The brief record below mirrors the email that went out. Paste the inbound reply as raw text and HunterAgent will parse it into selected roles and brief history."}
                {workspace.flowPhase === "processing" &&
                  `The inbound reply is parsed and the selected roles are being turned into real packs. ${isGenerating ? PROCESSING_STAGES[generationStage] : workspace.generationStatus ?? "Generation is underway."}`}
                {workspace.flowPhase === "studio" &&
                  "Each role now has a real pack record. Adjust style or tone, regenerate when needed, mark the role applied, then switch on follow-up when it is worth nudging."}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:items-end">
              <div className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Current state
                </p>
                <p className="mt-2 font-mono text-sm text-[var(--ink)]">
                  {workspace.flowPhase === "onboarding" ? `Step ${draftStep} of 4` : draftProfile.briefTime}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {workspace.flowPhase === "processing"
                    ? PROCESSING_STAGES[generationStage]
                    : workspace.generationStatus ?? draftProfile.timezone}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white px-4 py-3 text-left shadow-[0_18px_38px_-30px_rgba(20,43,40,0.24)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                    Signed in
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{user.fullName}</p>
                  <p className="text-sm text-[var(--muted)]">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen((current) => !current);
                    setSettingsError(null);
                    setSettingsNotice(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                >
                  <PencilSimple size={16} weight="bold" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>

          {isGenerating && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
                <span className="font-medium">{PROCESSING_STAGES[generationStage]}</span>
                <span>{Math.round(((generationStage + 1) / PROCESSING_STAGES.length) * 90)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${Math.round(((generationStage + 1) / PROCESSING_STAGES.length) * 90)}%` }}
                />
              </div>
            </div>
          )}

          {(clientError || workspace.lastError) && (
            <div className="mt-6 flex items-start gap-3 rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-[var(--ink)]">
              <WarningCircle size={18} className="mt-1 text-amber-600" />
              <div>{clientError ?? workspace.lastError}</div>
            </div>
          )}

          {isSettingsOpen && (
            <section className="mt-6 rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Account settings</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">Keep your HunterAgent identity clean.</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--ink)]"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <p className="text-sm font-semibold text-[var(--ink)]">Edit name</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    This is the name shown in your dashboard.
                  </p>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-medium text-[var(--ink)]">Display name</span>
                    <input
                      value={settingsName}
                      onChange={(event) => setSettingsName(event.target.value)}
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSettingsNameSave}
                    disabled={isSavingSettings}
                    className="mt-4 inline-flex items-center rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Save name
                  </button>
                </div>

                <form onSubmit={handlePasswordChange} className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <p className="text-sm font-semibold text-[var(--ink)]">Change password</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    Keep the same baseline here too: at least 6 characters, with one number or symbol.
                  </p>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-medium text-[var(--ink)]">Current password</span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      autoComplete="current-password"
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-medium text-[var(--ink)]">New password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="mt-4 inline-flex items-center rounded-full border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Update password
                  </button>
                </form>
              </div>

              <div className="mt-5 rounded-[1.7rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">Job search settings</p>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                      These settings shape which roles get matched and whether your daily email is active.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePreferenceSave}
                    disabled={isSavingPreferences}
                    className="inline-flex items-center rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSavingPreferences ? "Saving…" : "Save settings"}
                  </button>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-4">
                    <p className="text-sm font-semibold text-[var(--ink)]">Brief status</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      Pause your daily email if you need a break. Your settings and history are kept.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setDraftProfile((current) => ({ ...current, briefsPaused: false }))}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-medium",
                          !draftProfile.briefsPaused ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                        )}
                      >
                        Daily briefs on
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftProfile((current) => ({ ...current, briefsPaused: true }))}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-medium",
                          draftProfile.briefsPaused ? "bg-amber-600 text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                        )}
                      >
                        Pause briefs
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-4">
                    <p className="text-sm font-semibold text-[var(--ink)]">Recipient and timing</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm md:col-span-2">
                        <span className="font-medium text-[var(--ink)]">Daily brief recipient</span>
                        <input
                          type="email"
                          className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                          value={draftProfile.recipientEmail}
                          onChange={(event) => setDraftProfile((current) => ({ ...current, recipientEmail: event.target.value }))}
                        />
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium text-[var(--ink)]">Daily brief time</span>
                        <input
                          className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                          value={draftProfile.briefTime}
                          onChange={(event) => setDraftProfile((current) => ({ ...current, briefTime: event.target.value }))}
                        />
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium text-[var(--ink)]">Timezone</span>
                        <input
                          className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                          value={draftProfile.timezone}
                          onChange={(event) => setDraftProfile((current) => ({ ...current, timezone: event.target.value }))}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-4 xl:col-span-2">
                    <div className="grid gap-5 xl:grid-cols-2">
                      <div className="grid gap-4">
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Locations</span>
                          <input
                            className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                            value={draftProfile.locations}
                            onChange={(event) => setDraftProfile((current) => ({ ...current, locations: event.target.value }))}
                          />
                        </label>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Salary or rate range</span>
                          <input
                            className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                            value={draftProfile.salary}
                            onChange={(event) => setDraftProfile((current) => ({ ...current, salary: event.target.value }))}
                          />
                        </label>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Excluded companies</span>
                          <textarea
                            className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                            value={draftProfile.excludedCompanies.join(", ")}
                            onChange={(event) =>
                              setDraftProfile((current) => ({
                                ...current,
                                excludedCompanies: parsePreferenceList(event.target.value),
                              }))
                            }
                          />
                        </label>
                      </div>

                      <div className="grid gap-4">
                        <div className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Work types</span>
                          <div className="flex flex-wrap gap-2">
                            {["Full-time", "Part-time", "Contract"].map((type) => {
                              const active = draftProfile.workTypes.includes(type);
                              return (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() =>
                                    setDraftProfile((current) => ({
                                      ...current,
                                      workTypes: active
                                        ? current.workTypes.filter((item) => item !== type)
                                        : [...current.workTypes, type],
                                    }))
                                  }
                                  className={cn(
                                    "rounded-full px-4 py-2 text-sm font-medium",
                                    active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                                  )}
                                >
                                  {type}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Workplace</span>
                          <div className="flex flex-wrap gap-2">
                            {WORKPLACE_MODE_OPTIONS.map((option) => {
                              const active = draftProfile.workplaceModes.includes(option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => toggleWorkplaceMode(option.id)}
                                  className={cn(
                                    "rounded-full px-4 py-2 text-sm font-medium",
                                    active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                                  )}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Remote work region</span>
                          <div className="flex flex-wrap gap-2">
                            {REMOTE_REGION_OPTIONS.map((option) => {
                              const active = draftProfile.remoteRegions.includes(option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => toggleRemoteRegion(option.id)}
                                  className={cn(
                                    "rounded-full px-4 py-2 text-sm font-medium",
                                    active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                                  )}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Special preferences</span>
                          <textarea
                            className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                            value={draftProfile.specialPreferences.join(", ")}
                            onChange={(event) =>
                              setDraftProfile((current) => ({
                                ...current,
                                specialPreferences: parsePreferenceList(event.target.value),
                              }))
                            }
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {(settingsError || settingsNotice) && (
                <div
                  className={cn(
                    "mt-5 rounded-2xl px-4 py-3 text-sm",
                    settingsError
                      ? "border border-rose-200 bg-rose-50 text-rose-700"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700",
                  )}
                >
                  {settingsError ?? settingsNotice}
                </div>
              )}
            </section>
          )}

          {workspace.onboardingComplete && !draftProfile.recipientEmail.trim() && (
            <div className="mt-6 rounded-[1.8rem] border border-[var(--amber-border)] bg-[var(--amber-soft)] px-5 py-4 text-sm leading-7 text-[var(--ink)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Delivery setup needed</p>
                  <p className="mt-2">
                    This workspace was created before HunterAgent asked for a real delivery inbox. Reopen setup, add the recipient email, and the brief can send through AgentMail for real.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReopenOnboarding}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--amber-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                >
                  Reopen setup
                </button>
              </div>
            </div>
          )}

          {workspace.flowPhase === "onboarding" && (
            <section className="mt-6 grid gap-6 2xl:grid-cols-[1.25fr_0.95fr]">
              <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] pb-4">
                  {ONBOARDING_STEPS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDraftStep(item.id)}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                        draftStep === item.id ? "bg-[var(--accent)] text-white" : item.id < draftStep ? "bg-white text-[var(--ink)]" : "bg-transparent text-[var(--muted)]",
                      )}
                    >
                      {item.id}. {item.label}
                    </button>
                  ))}
                </div>

                {draftStep === 1 && (
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium text-[var(--ink)]">Name</span>
                      <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.name} onChange={(event) => setDraftProfile((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium text-[var(--ink)]">Current title</span>
                      <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.currentTitle} onChange={(event) => setDraftProfile((current) => ({ ...current, currentTitle: event.target.value }))} />
                    </label>
                    {draftProfile.targetRoles.map((role, index) => (
                      <label key={index} className="grid gap-2 text-sm">
                        <span className="font-medium text-[var(--ink)]">Target role {index + 1}</span>
                        <input
                          className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
                          value={role}
                          onChange={(event) =>
                            setDraftProfile((current) => {
                              const next = [...current.targetRoles];
                              next[index] = event.target.value;
                              return { ...current, targetRoles: next };
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}

                {draftStep === 2 && (
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <label className="grid gap-2 text-sm md:col-span-2">
                      <span className="font-medium text-[var(--ink)]">Locations</span>
                      <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.locations} onChange={(event) => setDraftProfile((current) => ({ ...current, locations: event.target.value }))} />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium text-[var(--ink)]">Salary or rate range</span>
                      <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.salary} onChange={(event) => setDraftProfile((current) => ({ ...current, salary: event.target.value }))} />
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium text-[var(--ink)]">Core strength</span>
                      <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.coreStrength} onChange={(event) => setDraftProfile((current) => ({ ...current, coreStrength: event.target.value }))} />
                    </label>
                    <div className="grid gap-2 text-sm md:col-span-2">
                      <span className="font-medium text-[var(--ink)]">Work types</span>
                      <div className="flex flex-wrap gap-2">
                        {["Full-time", "Part-time", "Contract"].map((type) => {
                          const active = draftProfile.workTypes.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() =>
                                setDraftProfile((current) => ({
                                  ...current,
                                  workTypes: active
                                    ? current.workTypes.filter((item) => item !== type)
                                    : [...current.workTypes, type],
                                }))
                              }
                              className={cn(
                                "rounded-full px-4 py-2 text-sm font-medium transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                                active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-white text-[var(--ink)]",
                              )}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm md:col-span-2">
                      <span className="font-medium text-[var(--ink)]">Workplace</span>
                      <div className="flex flex-wrap gap-2">
                        {WORKPLACE_MODE_OPTIONS.map((option) => {
                          const active = draftProfile.workplaceModes.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleWorkplaceMode(option.id)}
                              className={cn(
                                "rounded-full px-4 py-2 text-sm font-medium transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                                active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-white text-[var(--ink)]",
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm md:col-span-2">
                      <span className="font-medium text-[var(--ink)]">Remote region</span>
                      <div className="flex flex-wrap gap-2">
                        {REMOTE_REGION_OPTIONS.map((option) => {
                          const active = draftProfile.remoteRegions.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleRemoteRegion(option.id)}
                              className={cn(
                                "rounded-full px-4 py-2 text-sm font-medium transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                                active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-white text-[var(--ink)]",
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-xs leading-6 text-[var(--muted)]">Used when a role is remote and the posting limits which regions can apply.</span>
                    </div>
                    <label className="grid gap-2 text-sm md:col-span-2">
                      <span className="font-medium text-[var(--ink)]">Excluded companies</span>
                      <textarea
                        className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
                        value={draftProfile.excludedCompanies.join(", ")}
                        onChange={(event) =>
                          setDraftProfile((current) => ({
                            ...current,
                            excludedCompanies: parsePreferenceList(event.target.value),
                          }))
                        }
                        placeholder="Comma-separated, e.g. Meta, Agency Inc"
                      />
                    </label>
                    <label className="grid gap-2 text-sm md:col-span-2">
                      <span className="font-medium text-[var(--ink)]">Special preferences</span>
                      <textarea
                        className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
                        value={draftProfile.specialPreferences.join(", ")}
                        onChange={(event) =>
                          setDraftProfile((current) => ({
                            ...current,
                            specialPreferences: parsePreferenceList(event.target.value),
                          }))
                        }
                        placeholder="Comma-separated, e.g. B2B SaaS, 4-day week, healthcare AI"
                      />
                    </label>
                  </div>
                )}

                {draftStep === 3 && (
                  <div className="mt-5 grid gap-6">
                    <div className="grid gap-3 text-sm">
                      <span className="font-medium text-[var(--ink)]">Resume source</span>
                      <div className="grid gap-3 md:grid-cols-2">
                        {[
                          ["upload", "I already have a CV", "Upload or import a base resume and let HunterAgent tailor from it."],
                          ["guided", "Create one for me", "Answer a few essentials and HunterAgent builds the first base resume from scratch."],
                        ].map(([value, label, note]) => {
                          const active = draftProfile.resumeMode === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setDraftProfile((current) => ({ ...current, resumeMode: value as Profile["resumeMode"] }))}
                              className={cn(
                                "rounded-[1.5rem] border px-4 py-4 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                                active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-strong)] bg-white",
                              )}
                            >
                              <p className="font-semibold text-[var(--ink)]">{label}</p>
                              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{note}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {draftProfile.resumeMode === "upload" ? (
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium text-[var(--ink)]">Master CV file</span>
                        <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.cvFile} onChange={(event) => setDraftProfile((current) => ({ ...current, cvFile: event.target.value }))} />
                        <span className="text-xs leading-6 text-[var(--muted)]">This becomes the base resume HunterAgent tailors for each selected role.</span>
                      </label>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2 text-sm md:col-span-2">
                          <span className="font-medium text-[var(--ink)]">Professional summary</span>
                          <textarea className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.guidedResume.professionalSummary} onChange={(event) => setDraftProfile((current) => ({ ...current, guidedResume: { ...current.guidedResume, professionalSummary: event.target.value } }))} />
                        </label>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Recent impact</span>
                          <textarea className="min-h-28 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.guidedResume.recentImpact} onChange={(event) => setDraftProfile((current) => ({ ...current, guidedResume: { ...current.guidedResume, recentImpact: event.target.value } }))} />
                        </label>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Experience snapshot</span>
                          <textarea className="min-h-28 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.guidedResume.experienceSnapshot} onChange={(event) => setDraftProfile((current) => ({ ...current, guidedResume: { ...current.guidedResume, experienceSnapshot: event.target.value } }))} />
                        </label>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Education</span>
                          <textarea className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.guidedResume.education} onChange={(event) => setDraftProfile((current) => ({ ...current, guidedResume: { ...current.guidedResume, education: event.target.value } }))} />
                        </label>
                        <label className="grid gap-2 text-sm">
                          <span className="font-medium text-[var(--ink)]">Skills</span>
                          <textarea className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.guidedResume.skills} onChange={(event) => setDraftProfile((current) => ({ ...current, guidedResume: { ...current.guidedResume, skills: event.target.value } }))} />
                        </label>
                      </div>
                    )}

                    <div className="grid gap-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-[var(--ink)]">Default resume style</span>
                        <span className="text-xs text-[var(--muted)]">Used first, overridable per job later</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {RESUME_STYLES.map((style) => {
                          const active = draftProfile.resumeDefaultStyle === style.id;
                          return (
                            <button
                              key={style.id}
                              type="button"
                              onClick={() => setDraftProfile((current) => ({ ...current, resumeDefaultStyle: style.id }))}
                              className={cn(
                                "rounded-[1.55rem] border p-4 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.99]",
                                active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-soft)] bg-white",
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <h4 className="text-base font-semibold text-[var(--ink)]">{style.label}</h4>
                                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--muted)]")}>Default</span>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{style.blurb}</p>
                              <p className="mt-2 text-xs leading-6 text-[var(--muted)]">Best for: {style.bestFor}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm">
                      <span className="font-medium text-[var(--ink)]">Work sample links</span>
                      {draftProfile.workSampleLinks.map((link, index) => (
                        <label key={index} className="grid gap-2 text-sm">
                          <span className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Link {index + 1}</span>
                          <input
                            className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
                            value={link}
                            onChange={(event) =>
                              setDraftProfile((current) => {
                                const next = [...current.workSampleLinks];
                                next[index] = event.target.value;
                                return { ...current, workSampleLinks: next };
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {draftStep === 4 && (
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <label className="grid gap-2 text-sm md:col-span-2">
                      <span className="font-medium text-[var(--ink)]">Daily brief recipient</span>
                      <input
                        type="email"
                        className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
                        value={draftProfile.recipientEmail}
                        onChange={(event) => setDraftProfile((current) => ({ ...current, recipientEmail: event.target.value }))}
                        placeholder="you@example.com"
                      />
                      <span className="text-xs leading-6 text-[var(--muted)]">HunterAgent sends the daily brief here, then waits for reply selections from the same inbox.</span>
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium text-[var(--ink)]">Daily brief time</span>
                      <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.briefTime} onChange={(event) => setDraftProfile((current) => ({ ...current, briefTime: event.target.value }))} />
                      <span className="text-xs leading-6 text-[var(--muted)]">Every later daily brief lands at this local time.</span>
                    </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium text-[var(--ink)]">Timezone</span>
                      <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.timezone} onChange={(event) => setDraftProfile((current) => ({ ...current, timezone: event.target.value }))} />
                    </label>
                    <div className="grid gap-3 text-sm md:col-span-2">
                      <span className="font-medium text-[var(--ink)]">First shortlist</span>
                      <button
                        type="button"
                        onClick={() => setDraftProfile((current) => ({ ...current, firstBrief: "now" }))}
                        className={cn(
                          "rounded-[1.3rem] border px-4 py-3 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                          draftProfile.firstBrief === "now" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]" : "border-[var(--border-strong)] bg-white text-[var(--muted)]",
                        )}
                      >
                        Send the first brief immediately
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftProfile((current) => ({ ...current, firstBrief: "scheduled" }))}
                        className={cn(
                          "rounded-[1.3rem] border px-4 py-3 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                          draftProfile.firstBrief === "scheduled" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]" : "border-[var(--border-strong)] bg-white text-[var(--muted)]",
                        )}
                      >
                        Wait until the scheduled time
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-5">
                  <button
                    type="button"
                    onClick={() => setDraftStep((current) => Math.max(1, current - 1))}
                    disabled={draftStep === 1}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>
                  {draftStep < ONBOARDING_STEPS.length ? (
                    <button
                      type="button"
                      onClick={() => setDraftStep((current) => Math.min(ONBOARDING_STEPS.length, current + 1))}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFinishOnboarding}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                    >
                      Finish setup
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Preview</p>
                <div className="mt-4 rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <h3 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
                    Resume source: {draftProfile.resumeMode === "upload" ? "Uploaded base CV" : "HunterAgent guided builder"}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    Default style is {getResumeStyle(draftProfile.resumeDefaultStyle).label}. The first brief will {draftProfile.firstBrief === "now" ? "arrive now" : `wait until ${draftProfile.briefTime}`}, and every later brief lands at {draftProfile.briefTime} {draftProfile.timezone} in {draftProfile.recipientEmail || "your chosen inbox"}.
                  </p>
                </div>
                <div className="mt-5 rounded-[1.6rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4 text-sm leading-7 text-[var(--muted)]">
                  Even without a CV, the user can finish onboarding. HunterAgent uses the guided resume input as the base document, then tailors from that once the first reply arrives.
                </div>
              </div>
            </section>
          )}

          {workspace.flowPhase === "waiting" && (
            <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_1.15fr]">
              <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Scheduled delivery</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink)]">
                  First brief queued for {draftProfile.briefTime}.
                </h3>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                  The current workspace state is already persisted. Refreshing the page keeps the onboarding choices, the scheduled brief, and the resume setup exactly where they are. When it sends, HunterAgent delivers to {draftProfile.recipientEmail || "your chosen inbox"}.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleSendFirstBriefNow}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                  >
                    <PaperPlaneTilt size={16} weight="fill" />
                    Send first brief now
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftStep(4)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                  >
                    <PencilSimple size={16} />
                    Adjust delivery
                  </button>
                </div>
              </div>

              <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Tomorrow’s rhythm</p>
                <div className="mt-5 grid gap-3">
                  {[
                    `Brief lands at ${draftProfile.briefTime} in ${draftProfile.recipientEmail || "your chosen inbox"}.`,
                    "Reply to your email with the roles you want — we'll pick them up automatically.",
                    "Selected roles move straight into real CV, letter, and follow-up generation.",
                  ].map((line) => (
                    <div key={line} className="rounded-[1.5rem] bg-[var(--surface)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {(workspace.flowPhase === "brief" || workspace.flowPhase === "processing" || workspace.flowPhase === "studio") && activeBrief && (
            <section className="mt-6 space-y-6">
              <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Brief record</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                      Top 5 first, five more in the same email.
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-3 py-2 text-xs font-medium text-[var(--muted)]">
                    <ClockCountdown size={14} weight="duotone" />
                    {activeBrief.sentAt ? `Sent at ${formatClock(activeBrief.sentAt)}` : `Scheduled for ${draftProfile.briefTime}`}
                  </div>
                </div>

                <div className="mt-5 rounded-[1.6rem] border border-[var(--border-soft)] bg-white p-4 text-sm leading-7 text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                  I found 10 roles that fit {draftProfile.name.split(" ")[0]}&apos;s profile today. Reply with the numbers or company names you want me to prepare, then check the dashboard in about {estimateMinutes(activeBrief.selectedRoleIds.length || 1)}.
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[var(--muted)]">
                  <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-2">
                    To: {(activeBrief.recipientEmail ?? draftProfile.recipientEmail) || "not set"}
                  </span>
                  <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-2">
                    {activeBrief.outboundThreadId ? "Thread linked" : "No outbound thread yet"}
                  </span>
                </div>

                <div className="mt-5 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Top picks</p>
                      <p className="text-xs font-medium text-[var(--accent)]">Numbers or names both parse</p>
                    </div>
                    <div className="mt-3 space-y-3">
                      {workspace.roleCatalog.filter((role) => activeBrief.topRoleIds.includes(role.id)).map((role) => (
                        <article key={role.id} className="rounded-[1.55rem] border border-[var(--border-soft)] bg-white p-4 shadow-[0_18px_45px_-36px_rgba(14,34,32,0.45)]">
                          <div className="flex gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface)] font-mono text-xs text-[var(--accent)]">
                              {formatRoleCode(role.id)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm text-[var(--muted)]">{role.company}</p>
                                  <h4 className="mt-1 text-lg font-semibold tracking-tight text-[var(--ink)]">{role.title}</h4>
                                </div>
                                <div className="rounded-full bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--muted)]">{role.employment}</div>
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                                <MapPin size={13} weight="duotone" />
                                {role.location} · Posted {role.posted}
                              </div>
                              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Why it fits: {role.fit}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-[1.6rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">More from today’s shortlist</p>
                      <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                        {workspace.roleCatalog.filter((role) => activeBrief.roleIds.includes(role.id) && !activeBrief.topRoleIds.includes(role.id)).map((role) => (
                          <div key={role.id} className="flex items-start gap-3 rounded-2xl bg-white/70 px-3 py-2.5">
                            <span className="font-mono text-[11px] text-[var(--accent)]">{formatRoleCode(role.id)}</span>
                            <span>{role.title} — {role.company}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] border border-[var(--border-soft)] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Inbound email parser</p>
                        <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--muted)]">
                          {activeBrief.inboundRecords.length} replies logged
                        </span>
                      </div>
                      <label className="mt-3 grid gap-2 text-sm">
                        <span className="font-medium text-[var(--ink)]">Raw inbound reply</span>
                        <textarea
                          className="min-h-28 rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                          value={replyInput}
                          onChange={(event) => setReplyInput(event.target.value)}
                        />
                        <span className="text-xs leading-6 text-[var(--muted)]">Paste the actual body text the email layer receives. HunterAgent strips quoted text, parses numbers or company names, and stores the result in the brief record.</span>
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                        {[
                          "1, 4",
                          "BrightPath and Hollow Arc",
                          "2 only please",
                        ].map((sample) => (
                          <button
                            key={sample}
                            type="button"
                            onClick={() => setReplyInput(sample)}
                            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                          >
                            {sample}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleInboundReplySubmit}
                        disabled={isSubmittingReply || isGenerating}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:-translate-y-0.5 enabled:active:translate-y-[1px] enabled:active:scale-[0.98]"
                      >
                        <PaperPlaneTilt size={16} weight="fill" />
                        {isSubmittingReply ? "Parsing inbound email" : "Parse inbound email"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {(workspace.flowPhase === "processing" || workspace.flowPhase === "studio") && (
                <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                  <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Selected roles</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">Active application queue</h3>
                      </div>
                      <div className={cn("status-pill", isGenerating && "status-breath")}>
                        <Sparkle size={14} weight="fill" />
                        {selectedRoles.length} selected
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {selectedRoles.length === 0 ? (
                        <div className="rounded-[1.5rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4 text-sm leading-7 text-[var(--muted)]">
                          No roles selected yet. Paste your daily email below and choose the roles you want to apply for.
                        </div>
                      ) : (
                        selectedRoles.map((role) => {
                          const isActive = activeRole?.id === role.id;
                          const pack = workspace.packs.find((item) => item.roleId === role.id && item.briefId === activeBrief.id);
                          const applied = workspace.appliedRecords.some((item) => item.roleId === role.id);
                          return (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => handleActiveRole(role.id)}
                              className={cn(
                                "w-full rounded-[1.55rem] border p-4 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.99]",
                                isActive ? "border-[var(--accent)] bg-white" : "border-[var(--border-soft)] bg-white/80",
                              )}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm text-[var(--muted)]">{role.company}</p>
                                  <h4 className="mt-1 text-lg font-semibold tracking-tight text-[var(--ink)]">{role.title}</h4>
                                </div>
                                <div className={cn(
                                  "rounded-full px-3 py-1 text-xs font-medium",
                                  applied
                                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                                    : pack
                                      ? "bg-[var(--surface)] text-[var(--muted)]"
                                      : "bg-[var(--surface-2)] text-[var(--muted)]",
                                )}>
                                  {applied ? "Applied" : pack ? `Ready · ${pack.provider}` : PROCESSING_STAGES[generationStage]}
                                </div>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{role.summary}</p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Brief history</p>
                    <div className="mt-4 space-y-3">
                      {activeBrief.inboundRecords.length === 0 ? (
                        <div className="rounded-[1.45rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                          No replies yet. When you reply to your daily email, the roles you mention will appear here.
                        </div>
                      ) : (
                        activeBrief.inboundRecords.map((record) => (
                          <div key={record.id} className="rounded-[1.45rem] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
                            <div className="font-mono text-xs text-[var(--accent)]">{formatClock(record.receivedAt)} · {record.source}</div>
                            <p className="mt-2 font-medium text-[var(--ink)]">{record.normalizedReply}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {record.selectedRoleIds.length > 0 ? record.selectedRoleIds.map((roleId) => (
                                <span key={roleId} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">
                                  Selected {formatRoleCode(roleId)}
                                </span>
                              )) : (
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">No role match</span>
                              )}
                              {record.preferenceNotes.map((note) => (
                                <span key={note} className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">{note}</span>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>

        <section className="bg-[var(--surface)] px-5 py-6 lg:px-6 xl:px-7">
          {workspace.flowPhase !== "studio" || !activeRole || !activePack ? (
            <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Workspace preview</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                {workspace.flowPhase === "onboarding"
                  ? "The studio wakes up after the first inbound reply."
                  : workspace.flowPhase === "waiting"
                    ? "The dashboard is ready for the first brief."
                    : workspace.flowPhase === "brief"
                      ? "Paste the inbound email and the studio will fill in here."
                      : "Real generation is running through the server routes."}
              </h3>
              <div className="mt-5 grid gap-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="skeleton-bar h-24 rounded-[1.5rem]" />
                ))}
              </div>
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4 text-sm leading-7 text-[var(--muted)]">
                {workspace.flowPhase === "processing"
                  ? `${PROCESSING_STAGES[generationStage]}…`
                  : "Select roles from your email to start building your application materials. Your CV, cover letter, and follow-up draft will appear here."}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Application studio</p>
                <div className="mt-4 border-b border-[var(--border-soft)] pb-4">
                  <h3 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{activeRole.company}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {activeRole.title} · {activeRole.location} · {activeRole.employment} · Posted {activeRole.posted}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
                  {visibleStudioTabs.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleStudioTab(value)}
                      className={cn(
                        "rounded-full px-3.5 py-2 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                        workspace.studioTab === value ? "bg-[var(--accent)] text-white" : "border border-[var(--border-soft)] bg-white text-[var(--muted)]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {([
                    ["balanced", "Balanced"],
                    ["direct", "More direct"],
                    ["warm", "Warmer"],
                  ] as Array<[Tone, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => void handleToneChange(value)}
                      className={cn(
                        "rounded-full px-3.5 py-2 text-xs font-medium transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                        workspace.tone === value ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface)] text-[var(--muted)]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Refinement prompt</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                        Adjust only what needs changing. Use this to edit just the current section without rewriting the whole pack.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[var(--muted)]">
                        Active target: {targetLabel(targetFromStudioTab(workspace.studioTab))}
                      </div>
                      <button
                        type="button"
                        onClick={handleClearPrompt}
                        className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-[11px] font-medium text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                      >
                        Clear prompt
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={editInstruction}
                    onChange={(event) => setEditInstruction(event.target.value)}
                    placeholder="Example: Make the cover letter more direct and emphasize growth work."
                    className="mt-4 min-h-28 w-full rounded-[1.2rem] border border-[var(--border-soft)] bg-white px-4 py-3 text-sm leading-7 text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {EDIT_PROMPT_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="rounded-full border border-[var(--border-soft)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  {promptHistory.length > 0 && (
                    <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Recent for this role and section</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {promptHistory.map((entry) => (
                          <button
                            key={entry}
                            type="button"
                            onClick={() => setEditInstruction(entry)}
                            className="rounded-full border border-[var(--border-soft)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                          >
                            {entry}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {workspace.studioTab === "cv" && (
                  <div className="mt-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2 text-xs font-medium">
                        {([
                          ["preview", "Preview"],
                          ["content", "Content"],
                        ] as Array<[CvViewMode, string]>).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => void handleCvViewMode(mode)}
                            className={cn(
                              "rounded-full px-3.5 py-2 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                              workspace.cvViewMode === mode ? "bg-[var(--accent)] text-white" : "border border-[var(--border-soft)] bg-white text-[var(--muted)]",
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleExportCvPreview}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                      >
                        <PaperPlaneTilt size={16} />
                        Export PDF
                      </button>
                    </div>

                    {workspace.cvViewMode === "preview" ? (
                      <CvPreview profile={draftProfile} pack={activePack} role={activeRole} styleId={effectiveStyle} />
                    ) : (
                      <>
                        <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Resume summary</p>
                              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{activePack.cvSummary}</p>
                            </div>
                            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">
                              {activePack.resumeSourceType === "upload" ? "Uploaded base CV" : "Guided base resume"}
                            </div>
                          </div>
                        </div>

                        {activePack.cvBullets.map((bullet) => (
                          <div key={bullet} className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white p-4 text-sm leading-7 text-[var(--muted)]">
                            {bullet}
                          </div>
                        ))}
                      </>
                    )}

                    <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Design reference</p>
                          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">Keep this tucked away unless you want to change the visual direction.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDesignReferenceOpen((current) => !current)}
                          className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                        >
                          {designReferenceOpen ? "Collapse" : "Open"}
                        </button>
                      </div>

                      {designReferenceOpen && (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            {RESUME_STYLES.map((style) => {
                              const active = effectiveStyle === style.id;
                              return (
                                <button
                                  key={style.id}
                                  type="button"
                                  onClick={() => void handleRoleStyle(style.id)}
                                  className={cn(
                                    "rounded-[1.45rem] border p-4 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.99]",
                                    active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-soft)] bg-white",
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <h4 className="font-semibold text-[var(--ink)]">{style.label}</h4>
                                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--muted)]")}>{active ? "Current" : "Use"}</span>
                                  </div>
                                  <div className="mt-3 rounded-[1rem] border border-[var(--border-soft)] p-3">
                                    <div className="h-3 w-20 rounded-full" style={{ backgroundColor: style.id === "creative" ? "#c67a3f" : "#0f6a62" }} />
                                    <div className="mt-3 h-2 w-28 rounded-full bg-[rgba(20,32,30,0.18)]" />
                                    <div className="mt-2 h-2 w-full rounded-full bg-[rgba(20,32,30,0.12)]" />
                                    <div className="mt-2 h-2 w-4/5 rounded-full bg-[rgba(20,32,30,0.12)]" />
                                  </div>
                                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{style.blurb}</p>
                                  <p className="mt-2 text-xs leading-6 text-[var(--muted)]">Best for: {style.bestFor}</p>
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleMakeDefaultStyle(effectiveStyle)}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                          >
                            <Palette size={16} />
                            Make {getResumeStyle(effectiveStyle).label} the default style
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {workspace.studioTab === "letter" && (
                  <div className="mt-6 rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm leading-7 whitespace-pre-line text-[var(--muted)]">
                    {activePack.letter}
                  </div>
                )}

                {workspace.studioTab === "workSamples" && (
                  <div className="mt-6 space-y-3">
                    {activePack.workSampleSelections.length === 0 ? (
                      <div className="rounded-[1.4rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4 text-sm leading-7 text-[var(--muted)]">
                        No work samples needed for this role — your CV and cover letter are the strongest application here.
                      </div>
                    ) : activePack.workSampleSelections.map((item) => (
                      <div key={`${item.title}-${item.note}`} className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-[var(--ink)]">{item.title}</h4>
                            {item.href && <p className="mt-2 text-xs font-mono text-[var(--accent)]">{item.href}</p>}
                          </div>
                          <div className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[var(--muted)]">Selected proof</div>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.note}</p>
                      </div>
                    ))}
                  </div>
                )}

                {workspace.studioTab === "pack" && (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
                      {activePack.reasoning}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        `Resume · ${getResumeStyle(activePack.resumeStyleUsed).label}`,
                        `Cover letter · ${workspace.tone}`,
                        showWorkSamplesTab ? `Work samples · ${activePack.workSampleSelections.length} picks` : "Work samples · not in scope",
                        `Provider · ${activePack.provider}`,
                      ].map((item) => (
                        <div key={item} className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white px-4 py-4 text-sm font-medium text-[var(--ink)]">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {trustExplanation && (
                  <div className="mt-6 rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Trust layer</p>
                        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                          See how this CV, cover letter, and work sample selection were put together.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTrustPanelOpen((current) => !current)}
                        className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                      >
                        {trustPanelOpen ? "Hide trust details" : "Open trust details"}
                      </button>
                    </div>

                    {trustPanelOpen && (
                      <div className="mt-4">
                        <TrustExplanationPanel explanation={trustExplanation} />
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void handleEditCurrentTabOnly()}
                    disabled={isGenerating}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:-translate-y-0.5 enabled:active:translate-y-[1px] enabled:active:scale-[0.98]"
                  >
                    <PencilSimple size={16} weight="fill" />
                    {isGenerating ? "Updating" : `Edit ${targetLabel(targetFromStudioTab(workspace.studioTab))} only`}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSharpenPack()}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                  >
                    <Sparkle size={16} weight="fill" />
                    Sharpen pack
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleMarkApplied}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                  >
                    <CheckCircle size={16} weight="fill" />
                    Mark applied
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {([
                    ["cv", "Edit CV only"],
                    ["letter", "Edit cover letter only"],
                    ...(showWorkSamplesTab ? ([["workSamples", "Edit work samples only"]] as Array<[PackTarget, string]>) : []),
                  ] as Array<[PackTarget, string]>).map(([target, label]) => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => void handleSectionEdit(target)}
                      disabled={isGenerating}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:-translate-y-0.5 enabled:active:translate-y-[1px] enabled:active:scale-[0.98]",
                        workspace.studioTab === target
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border-soft)] bg-white text-[var(--ink)]",
                      )}
                    >
                      <Sparkle size={16} />
                      {label}
                    </button>
                  ))}
                </div>

                {activePack.provider === "fallback" && (
                  <div className="mt-4 rounded-[1.45rem] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                    These materials were generated using our fallback engine. They&apos;re a solid starting point — review and edit before sending.
                  </div>
                )}
              </div>

              <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Applied timeline</p>
                {appliedDetails.length === 0 ? (
                  <div className="mt-4 rounded-[1.5rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4 text-sm leading-7 text-[var(--muted)]">
                    No applications logged yet. Mark a role as applied from the studio to track it here.
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {appliedDetails.map((item) => (
                      <div key={item.roleId} className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{item.role.company}</h4>
                            <p className="mt-1 text-sm text-[var(--muted)]">{item.role.title} · Applied {formatAppliedDate(item.appliedAt)}</p>
                          </div>
                          <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">
                            {getResumeStyle(item.resumeStyleUsed).label} · {item.provider}
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                          Follow-up is {item.followUp === "off" ? "off" : `${item.followUp} days`}. {item.followUpDueAt ? `Due ${formatAppliedDate(item.followUpDueAt)}.` : "Enable a reminder when you want the nudge."}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                          {([
                            ["off", "Follow-up off"],
                            ["7", "Remind in 7 days"],
                            ["14", "Remind in 14 days"],
                          ] as Array<[AppliedRecord["followUp"], string]>).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => void handleFollowUpPlan(item.roleId, value)}
                              className={cn(
                                "rounded-full px-3.5 py-2 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                                item.followUp === value ? "bg-[var(--accent)] text-white" : "border border-[var(--border-soft)] bg-white text-[var(--muted)]",
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {item.followUpDraft && (
                          <div className="mt-4 rounded-[1.4rem] border border-[var(--border-soft)] bg-white p-4 text-sm leading-7 whitespace-pre-line text-[var(--muted)]">
                            {item.followUpDraft}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
