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
import { HunterAgentProvider } from "@/components/hunteragent-context";
import { LeftRail } from "@/components/left-rail";
import { SettingsModal } from "@/components/settings-modal";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { StudioPanel } from "@/components/studio-panel";

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
    headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
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

  async function handleSetActiveBrief(briefId: string) {
    try {
      setClientError(null);
      await runWorkspaceAction({ action: "set_active_brief", briefId });
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Could not switch brief.");
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

  const contextValue = workspace ? {
    user,
    workspace,
    draftProfile,
    setDraftProfile,
    draftStep,
    setDraftStep,
    replyInput,
    setReplyInput,
    isLoading,
    isSavingDraft,
    isSubmittingReply,
    isGenerating,
    generationStage,
    clientError,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsName,
    setSettingsName,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    settingsError,
    settingsNotice,
    isSavingSettings,
    isSavingPreferences,
    editInstruction,
    setEditInstruction,
    designReferenceOpen,
    setDesignReferenceOpen,
    trustPanelOpen,
    setTrustPanelOpen,
    activeBrief,
    selectedRoles,
    activeRole,
    activePack,
    appliedDetails,
    effectiveStyle,
    trustExplanation,
    activeProofMode,
    showWorkSamplesTab,
    visibleStudioTabs,
    promptHistory,
    stageLabel,
    handleSettingsNameSave,
    handlePasswordChange,
    handleSignOut,
    handlePreferenceSave,
    toggleWorkplaceMode,
    toggleRemoteRegion,
    handleFinishOnboarding,
    handleSendFirstBriefNow,
    handleReopenOnboarding,
    handleReset,
    generatePacks,
    handleSharpenPack,
    handleSectionEdit,
    handleSuggestionClick,
    handleEditCurrentTabOnly,
    handleClearPrompt,
    handleInboundReplySubmit,
    handleToneChange,
    handleStudioTab,
    handleCvViewMode,
    handleActiveRole,
    handleRoleStyle,
    handleMakeDefaultStyle,
    handleLeftRailToggle,
    handleExportCvPreview,
    handleMarkApplied,
    handleFollowUpPlan,
    handleSetActiveBrief,
  } : null;

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
    <HunterAgentProvider value={contextValue!}>
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
        <LeftRail />

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

          <SettingsModal />


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

          <OnboardingWizard />


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

        <StudioPanel />

      </div>
    </div>
    </HunterAgentProvider>
  );
}
