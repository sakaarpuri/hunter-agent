"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  GearSix,
  MagnifyingGlass,
  WarningCircle,
  SpinnerGap,
} from "@phosphor-icons/react";
import type { AuthUser } from "@/lib/auth";
import { getRoleFromCatalog, initialProfile } from "@/lib/hunteragent-data";
import { getRetainedBrief, hasSavedRole, isRoleExpired, normalizeBriefPreferences } from "@/lib/hunteragent-retention";
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
import { buildCvPrintHtml, getCvExportMetadata } from "@/components/cv-preview";
import { buildTrustExplanation } from "@/lib/hunteragent-trust";
import { HunterAgentProvider, suggestionExpiry } from "@/components/hunteragent-context";
import styles from "./account-flow.module.css";
import { CommandPalette } from "@/components/command-palette";
import type { Command } from "@/components/command-palette";
import { LeftRail, type WorkspaceView } from "@/components/left-rail";
import {
  WorkspaceOverview,
  ApplicationsView,
} from "@/components/workspace-overview";
import { Brand } from "@/components/brand";
import { SettingsModal } from "@/components/settings-modal";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { StudioPanel } from "@/components/studio-panel";

const PROCESSING_STAGES = [
  "Reading each role's requirements and matching them to your profile",
  "Writing your tailored CV — adjusting emphasis for each role",
  "Drafting a role-specific cover letter",
  "Choosing the strongest work samples to include",
  "Finalising and running a quality check",
] as const;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T | { error?: string };

  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? "Request failed");
  }

  return payload as T;
}

export type WorkspaceTransport = (
  url: string,
  body?: unknown,
) => Promise<unknown>;

export function HunterAgentFlow({
  user,
  transport,
}: {
  user: AuthUser;
  transport?: WorkspaceTransport;
}) {
  const router = useRouter();
  const request = useCallback(
    async <T,>(url: string, body: unknown): Promise<T> => {
      return transport
        ? ((await transport(url, body)) as T)
        : postJson<T>(url, body);
    },
    [transport],
  );
  const [requestedView, setRequestedView] = useState<WorkspaceView | null>(
    null,
  );
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [draftProfile, setDraftProfile] = useState<Profile>(initialProfile);
  const [draftStep, setDraftStep] = useState(1);
  const [replyInput, setReplyInput] = useState("");
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const draftReadyRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownVersion = useRef<number | null>(null);
  const loadedPromptKey = useRef<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    setClientError(null);

    try {
      let nextState: WorkspaceState;
      if (transport) {
        nextState = (await transport("/api/workspace")) as WorkspaceState;
      } else {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/dashboard?mode=signin");
          return;
        }
        if (!response.ok)
          throw new Error("Your workspace could not load. Please try again.");
        nextState = (await response.json()) as WorkspaceState;
      }
      setWorkspace(nextState);
      lastKnownVersion.current =
        (nextState as { stateVersion?: number }).stateVersion ?? null;
      setDraftProfile({ ...nextState.profile, ...normalizeBriefPreferences(nextState.profile) });
      setDraftStep(nextState.onboardingStep);
      draftReadyRef.current = true;

      const activeBrief = nextState.briefs.find(
        (item) => item.id === nextState.activeBriefId,
      );
      const latestReply = activeBrief?.inboundRecords[0]?.rawText;
      if (latestReply) {
        setReplyInput(latestReply);
      } else {
        setReplyInput((activeBrief?.selectedRoleIds ?? [])
          .map((id) => (activeBrief?.replyRoleIds ?? activeBrief?.roleIds ?? []).indexOf(id) + 1)
          .filter((position) => position > 0).join(", "));
      }
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not load the workspace.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router, transport]);

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
    const tick = () => setCurrentTime(Date.now());
    const timer = setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);

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
        const nextState = await request<WorkspaceState>("/api/workspace", {
          action: "sync_draft",
          profile: { ...draftProfile, ...normalizeBriefPreferences(draftProfile) },
          onboardingStep: draftStep,
        });
        setWorkspace(nextState);
        const v = (nextState as { stateVersion?: number }).stateVersion;
        if (v !== undefined) lastKnownVersion.current = v;
      } catch (error) {
        setClientError(
          error instanceof Error ? error.message : "Could not save the draft.",
        );
      } finally {
        setIsSavingDraft(false);
      }
    }, 320);

    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
    };
  }, [draftProfile, draftStep, workspace?.onboardingComplete, request]);

  const activeBrief = useMemo(
    () =>
      workspace?.activeBriefId ? getRetainedBrief(workspace, workspace.activeBriefId) : null,
    [workspace],
  );

  const selectedRoles = useMemo(
    () =>
      [...new Set([
        ...(activeBrief?.selectedRoleIds ?? []),
        ...(workspace?.packs.filter((pack) => pack.briefId === activeBrief?.id).map((pack) => pack.roleId) ?? []),
      ])]
        .map((roleId) =>
          getRoleFromCatalog(roleId, workspace?.roleCatalog ?? []),
        )
        .filter((role): role is Role => Boolean(role && workspace &&
          (!isRoleExpired(role, new Date(currentTime)) || hasSavedRole(workspace, role.id, activeBrief?.id)))),
    [activeBrief, workspace, currentTime],
  );

  const activeRole = useMemo(() => {
    if (!workspace) return null;
    const roleId =
      workspace.activeRoleId ?? activeBrief?.selectedRoleIds[0] ?? null;
    const role = roleId ? getRoleFromCatalog(roleId, workspace.roleCatalog) : null;
    return role && (!isRoleExpired(role, new Date(currentTime)) || hasSavedRole(workspace, role.id, activeBrief?.id)) ? role : null;
  }, [activeBrief, workspace, currentTime]);

  const activePack = useMemo(() => {
    if (!workspace || !activeRole) return null;
    const briefId = activeBrief?.id;
    return (
      workspace.packs.find(
        (item) => item.roleId === activeRole.id && item.briefId === briefId,
      ) ??
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
      .filter((item): item is AppliedRecord & { role: Role } =>
        Boolean(item.role),
      );
  }, [workspace]);

  const effectiveStyle = activeRole
    ? (workspace?.roleStyleOverrides[String(activeRole.id)] ??
      draftProfile.resumeDefaultStyle)
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
  const hasUserWorkSamples = draftProfile.workSampleLinks.some((item) =>
    item.trim(),
  );
  const showWorkSamplesTab =
    !!activeRole &&
    activeProofMode !== "none" &&
    (activeProofMode !== "optional" ||
      hasUserWorkSamples ||
      activeRole.workSamples.length > 0);
  const visibleStudioTabs = [
    ["cv", "CV"],
    ["letter", "Cover Letter"],
    ...(showWorkSamplesTab
      ? ([["workSamples", "Work Samples"]] as Array<[StudioTab, string]>)
      : []),
    ["pack", "Pack"],
  ] as Array<[StudioTab, string]>;
  const promptKey = activeRole
    ? `${activeRole.id}:${workspace?.studioTab ?? "cv"}`
    : null;
  const promptHistory = promptKey
    ? (workspace?.promptHistory[promptKey] ?? [])
    : [];

  const runWorkspaceAction = useCallback(
    async (body: unknown) => {
      const nextState = await request<WorkspaceState>("/api/workspace", body);
      setWorkspace(nextState);
      const newVersion = (nextState as { stateVersion?: number }).stateVersion;
      if (lastKnownVersion.current !== null && newVersion !== undefined) {
        if (newVersion > lastKnownVersion.current + 1) {
          setClientError(
            "Your workspace was updated in another tab. Showing the latest version.",
          );
        }
        lastKnownVersion.current = newVersion;
      }
      return nextState;
    },
    [request],
  );

  async function handleSettingsNameSave() {
    setIsSavingSettings(true);
    setSettingsError(null);
    setSettingsNotice(null);

    try {
      const payload = await request<{ user: AuthUser | null }>(
        "/api/auth/settings",
        {
          action: "update_name",
          name: settingsName,
        },
      );
      setSettingsName(payload.user?.fullName ?? settingsName);
      setSettingsNotice("Name updated.");
      router.refresh();
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "Could not update the name.",
      );
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
      const payload = await request<{ ok: boolean; signedOut?: boolean }>(
        "/api/auth/settings",
        {
          action: "change_password",
          currentPassword,
          newPassword,
        },
      );
      if (payload.signedOut) {
        await request("/api/auth/logout", {});
        router.replace("/dashboard?mode=signin");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setSettingsNotice("Password updated.");
    } catch (error) {
      setSettingsError(
        error instanceof Error
          ? error.message
          : "Could not change the password.",
      );
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleSignOut() {
    try {
      await request("/api/auth/logout", {});
      router.replace("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not sign out. Please try again.";
      setSettingsError(message);
      setClientError(message);
    }
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
        profile: { ...draftProfile, ...normalizeBriefPreferences(draftProfile) },
      });
      setDraftProfile(nextState.profile);
      setSettingsNotice(
        nextState.profile.briefsPaused
          ? "Preferences saved. Brief emails are paused until you turn them back on."
          : "Preferences saved. HunterAgent will use these settings for future briefs.",
      );
    } catch (error) {
      setSettingsError(
        error instanceof Error
          ? error.message
          : "Your settings couldn't be saved. Try again.",
      );
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
    if (!promptKey || !workspace || loadedPromptKey.current === promptKey)
      return;
    loadedPromptKey.current = promptKey;
    setEditInstruction(workspace.promptDrafts[promptKey] ?? "");
  }, [promptKey, workspace]);

  // A reply can start generation outside this browser, so refresh while it is pending.
  useEffect(() => {
    if (workspace?.flowPhase !== "processing" || isGenerating) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setInterval(async () => {
      try {
        let next: WorkspaceState;
        if (transport)
          next = (await transport("/api/workspace")) as WorkspaceState;
        else {
          const response = await fetch("/api/workspace", {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) return;
          next = (await response.json()) as WorkspaceState;
        }
        if (!cancelled) setWorkspace(next);
      } catch {
        /* Keep the current state and retry on the next poll. */
      }
    }, 5000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [workspace?.flowPhase, isGenerating, transport]);

  useEffect(() => {
    if (
      !workspace ||
      showWorkSamplesTab ||
      workspace.studioTab !== "workSamples"
    )
      return;
    void runWorkspaceAction({ action: "set_studio_tab", tab: "pack" });
  }, [showWorkSamplesTab, workspace, runWorkspaceAction]);

  useEffect(() => {
    if (!promptKey || !workspace) return;
    if ((workspace.promptDrafts[promptKey] ?? "") === editInstruction) return;

    if (promptTimerRef.current) {
      clearTimeout(promptTimerRef.current);
    }

    promptTimerRef.current = setTimeout(async () => {
      try {
        await runWorkspaceAction({
          action: "set_prompt_draft",
          key: promptKey,
          value: editInstruction,
        });
      } catch (error) {
        setClientError(
          error instanceof Error
            ? error.message
            : "Your edit instruction couldn't be saved.",
        );
      }
    }, 260);

    return () => {
      if (promptTimerRef.current) {
        clearTimeout(promptTimerRef.current);
      }
    };
  }, [editInstruction, promptKey, workspace, runWorkspaceAction]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function persistDraftNow() {
    const nextState = await request<WorkspaceState>("/api/workspace", {
      action: "sync_draft",
      profile: { ...draftProfile, ...normalizeBriefPreferences(draftProfile) },
      onboardingStep: draftStep,
    });
    setWorkspace(nextState);
    const v = (nextState as { stateVersion?: number }).stateVersion;
    if (v !== undefined) lastKnownVersion.current = v;
    return nextState;
  }

  async function handleFinishOnboarding() {
    try {
      setClientError(null);
      if (!draftProfile.recipientEmail.trim()) {
        setClientError(
          "Add the inbox where HunterAgent should send new matches before finishing setup.",
        );
        return;
      }
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
      await persistDraftNow();
      const nextState = await runWorkspaceAction({
        action: "finish_onboarding",
      });
      setDraftProfile(nextState.profile);
      setDraftStep(nextState.onboardingStep);
    } catch (error) {
      setClientError(
        error instanceof Error ? error.message : "Could not finish onboarding.",
      );
    }
  }

  async function handleSendFirstBriefNow() {
    try {
      setClientError(null);
      await runWorkspaceAction({ action: "send_first_brief_now" });
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not send the first brief.",
      );
    }
  }

  async function handleReopenOnboarding() {
    try {
      setClientError(null);
      const nextState = await runWorkspaceAction({
        action: "reopen_onboarding",
      });
      setDraftProfile(nextState.profile);
      setDraftStep(nextState.onboardingStep);
    } catch (error) {
      setClientError(
        error instanceof Error ? error.message : "Could not reopen setup.",
      );
    }
  }

  async function handleReset() {
    if (
      !window.confirm(
        "Reset this workspace? This removes your briefs, materials, and application history.",
      )
    )
      return;
    try {
      setClientError(null);
      const nextState = await runWorkspaceAction({ action: "reset_workspace" });
      setDraftProfile(nextState.profile);
      setDraftStep(nextState.onboardingStep);
      setReplyInput("");
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not reset the workspace.",
      );
    }
  }

  async function generatePacks(options?: {
    roleId?: number;
    target?: PackTarget;
    intent?: PackIntent;
    instruction?: string;
  }) {
    if (!activeBrief) return;

    try {
      setClientError(null);
      setIsGenerating(true);
      setRequestedView("studio");
      setGenerationStage(0);
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
      }
      generationTimerRef.current = setInterval(() => {
        setGenerationStage((current) =>
          Math.min(current + 1, PROCESSING_STAGES.length - 1),
        );
      }, 12000);

      const nextState = await request<WorkspaceState>("/api/generate-packs", {
        briefId: activeBrief.id,
        roleId: options?.roleId,
        target: options?.target,
        intent: options?.intent,
        instruction: options?.instruction,
      });
      setWorkspace(nextState);
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not generate the application packs.",
      );
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

  async function handleSharpenPack() {
    if (!activeRole) return;
    await generatePacks({
      roleId: activeRole.id,
      target: "pack",
      intent: "sharpen",
    });
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

  async function handleInboundReplySubmit(options?: { prepareMaterials?: boolean }) {
    if (!activeBrief || !replyInput.trim()) return;

    try {
      setClientError(null);
      setIsSubmittingReply(true);
      const nextState = await request<WorkspaceState>("/api/inbound-email", {
        briefId: activeBrief.id,
        rawText: replyInput,
        source: "dashboard",
      });
      setWorkspace(nextState);

      const repliedBrief = nextState.briefs.find(
        (item) => item.id === activeBrief.id,
      );
      // Explicit review creates tracking records in self-managed mode; the
      // server skips model calls for that mode. Saving a selection does neither.
      if (!nextState.lastError && options?.prepareMaterials && repliedBrief?.selectedRoleIds.length) {
        await generatePacks();
      }
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "We couldn't read your reply. Try again.",
      );
    } finally {
      setIsSubmittingReply(false);
    }
  }

  async function handleToneChange(nextTone: Tone) {
    if (!workspace) return;
    try {
      setClientError(null);
      const nextState = await runWorkspaceAction({
        action: "set_tone",
        tone: nextTone,
      });
      if (nextState.activeRoleId) {
        await generatePacks({ roleId: nextState.activeRoleId });
      }
    } catch (error) {
      setClientError(
        error instanceof Error ? error.message : "Could not update the tone.",
      );
    }
  }

  async function handleStudioTab(tab: StudioTab) {
    if (!workspace) return;
    try {
      setClientError(null);
      await saveActivePrompt();
      const nextState = await runWorkspaceAction({
        action: "set_studio_tab",
        tab,
      });
      if (tab === "cv" && nextState.cvViewMode !== "preview") {
        await runWorkspaceAction({
          action: "set_cv_view",
          mode: "preview" satisfies CvViewMode,
        });
      }
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not switch the studio tab.",
      );
    }
  }

  async function handleCvViewMode(mode: CvViewMode) {
    try {
      setClientError(null);
      await runWorkspaceAction({ action: "set_cv_view", mode });
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not switch the CV preview.",
      );
    }
  }

  async function handleActiveRole(roleId: number) {
    try {
      setClientError(null);
      await saveActivePrompt();
      await runWorkspaceAction({ action: "set_active_role", roleId });
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not switch the active role.",
      );
    }
  }

  async function saveActivePrompt() {
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    if (
      promptKey &&
      workspace &&
      (workspace.promptDrafts[promptKey] ?? "") !== editInstruction
    ) {
      await runWorkspaceAction({
        action: "set_prompt_draft",
        key: promptKey,
        value: editInstruction,
      });
    }
  }

  async function handleRoleStyle(styleId: ResumeStyleId) {
    if (!activeRole) return;
    try {
      setClientError(null);
      await runWorkspaceAction({
        action: "set_role_style",
        roleId: activeRole.id,
        style: styleId,
      });
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not update the resume style.",
      );
    }
  }

  async function handleMakeDefaultStyle(styleId: ResumeStyleId) {
    try {
      setClientError(null);
      const nextState = await runWorkspaceAction({
        action: "set_default_style",
        style: styleId,
      });
      setDraftProfile(nextState.profile);
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not update the default style.",
      );
    }
  }

  async function handleLeftRailToggle() {
    if (!workspace) return;
    const next = !workspace.leftRailCollapsed;
    try {
      setClientError(null);
      setWorkspace((current) =>
        current ? { ...current, leftRailCollapsed: next } : current,
      );
      await runWorkspaceAction({ action: "set_left_rail", collapsed: next });
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not resize the navigation rail.",
      );
    }
  }

  function handleExportCvPreview() {
    if (!activePack) return;
    const html = buildCvPrintHtml(
      draftProfile,
      activePack,
      effectiveStyle,
      activeRole,
    );
    const metadata = getCvExportMetadata(
      draftProfile,
      activePack,
      effectiveStyle,
      activeRole,
    );
    const frame = document.createElement("iframe");
    frame.title = metadata.title;
    frame.style.cssText =
      "position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0";
    frame.setAttribute("aria-hidden", "true");
    const cleanup = () => frame.remove();
    frame.onload = async () => {
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        cleanup();
        setClientError("The print preview could not open. Please try again.");
        return;
      }
      await printWindow.document.fonts.ready;
      printWindow.addEventListener("afterprint", cleanup, { once: true });
      printWindow.focus();
      printWindow.print();
      window.setTimeout(cleanup, 60000);
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  }

  async function handleMarkApplied() {
    if (!activeRole) return;
    try {
      setClientError(null);
      await runWorkspaceAction({
        action: "mark_applied",
        roleId: activeRole.id,
      });
      setRequestedView("applications");
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Could not mark the role as applied.",
      );
    }
  }

  async function handleFollowUpPlan(
    roleId: number,
    plan: AppliedRecord["followUp"],
  ) {
    try {
      setClientError(null);
      const nextState = await request<WorkspaceState>("/api/follow-up", {
        roleId,
        plan,
      });
      setWorkspace(nextState);
    } catch (error) {
      setClientError(
        error instanceof Error ? error.message : "Could not update follow-up.",
      );
    }
  }

  async function handleSetActiveBrief(briefId: string) {
    try {
      setClientError(null);
      await saveActivePrompt();
      const nextState = await runWorkspaceAction({ action: "set_active_brief", briefId });
      const nextBrief = getRetainedBrief(nextState, briefId);
      setReplyInput((nextBrief?.selectedRoleIds ?? [])
        .map((id) => (nextBrief?.replyRoleIds ?? nextBrief?.roleIds ?? []).indexOf(id) + 1)
        .filter((position) => position > 0).join(", "));
    } catch (error) {
      setClientError(
        error instanceof Error ? error.message : "Could not switch brief.",
      );
    }
  }

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

  const view: WorkspaceView =
    requestedView ??
    (workspace?.flowPhase === "studio" || workspace?.flowPhase === "processing"
      ? "studio"
      : "brief");

  const commands: Command[] = workspace
    ? [
        ...(
          [
            ["brief", "Go to your brief"],
            ["studio", "Open application studio"],
            ["applications", "View applications"],
          ] as const
        ).map(([destination, label]) => ({
          id: `navigate-${destination}`,
          label,
          action: () => setRequestedView(destination),
        })),
        {
          id: "go-settings",
          label: "Open Settings",
          description: "Edit your profile and preferences",
          action: () => setIsSettingsOpen(true),
        },
        {
          id: "toggle-rail",
          label: workspace.leftRailCollapsed
            ? "Expand sidebar"
            : "Collapse sidebar",
          action: () => void handleLeftRailToggle(),
        },
        ...(activePack && draftProfile.materialsMode !== "self"
          ? [
              {
                id: "export-pdf",
                label: "Print / save CV as PDF",
                description: "Open the browser print dialog for your CV",
                action: () => handleExportCvPreview(),
              },
            ]
          : []),
        {
          id: "reset",
          label: "Reset workspace",
          description: "Clear all data and start over",
          action: () => void handleReset(),
        },
      ]
    : [];

  const contextValue = workspace
    ? {
        user,
        isDesignPreview: Boolean(transport),
        workspace,
        currentTime,
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
      }
    : null;

  if (!workspace && clientError)
    return (
      <div className="workspace-load-error" role="alert">
        <WarningCircle size={28} />
        <h1>Let&apos;s get your workspace back.</h1>
        <p>{clientError}</p>
        <button
          className="button button-dark"
          onClick={() => void loadWorkspace()}
        >
          Try again
        </button>
      </div>
    );
  if (isLoading || !workspace)
    return (
      <div className="workspace-loading" role="status">
        <Brand />
        <div className="skeleton-bar" />
        <p>Opening your workspace...</p>
      </div>
    );

  const isOnboarding = !workspace.onboardingComplete;
  const title = isOnboarding
    ? "Make this search yours."
    : view === "applications"
      ? "Your next steps."
      : view === "studio"
        ? "Make a strong first impression."
        : workspace.flowPhase === "waiting"
          ? "A little space for what's next."
          : "Your next move, in focus.";

  return (
    <HunterAgentProvider value={contextValue!}>
      <div
        className={cn(
          "workspace-shell",
          workspace.leftRailCollapsed && "rail-compact",
        )}
      >
        <LeftRail view={view} onNavigate={setRequestedView} />
        <div className="workspace-body">
          <header className="workspace-topbar">
            <div className="mobile-brand">
              <Brand compact />
            </div>
            <span className="workspace-breadcrumb">
              Your workspace <span>/</span>{" "}
              {isOnboarding
                ? "Setup"
                : view === "brief"
                  ? "Your brief"
                  : view === "studio"
                    ? "Application studio"
                    : "Applications"}
            </span>
            <div className="workspace-tools">
              <button
                onClick={() => setCommandPaletteOpen(true)}
                aria-label="Search commands"
              >
                <MagnifyingGlass size={17} />
                <span>Quick actions</span>
                <kbd>⌘ K</kbd>
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Open settings"
              >
                <GearSix size={19} />
              </button>
              <span className="workspace-avatar" title={user.fullName}>
                {user.fullName.slice(0, 1)}
              </span>
            </div>
          </header>
          {!isOnboarding && (
            <nav
              className="mobile-workspace-nav"
              aria-label="Mobile workspace navigation"
            >
              {(
                [
                  ["brief", "Your brief"],
                  ["studio", "Studio"],
                  ["applications", "Applications"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-current={view === id ? "page" : undefined}
                  onClick={() => setRequestedView(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
          <div className="workspace-content">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">
                  {isOnboarding
                    ? "A GOOD SEARCH STARTS WITH YOU"
                    : "HUNTERAGENT / YOUR CAREER, CONSIDERED"}
                </p>
                <h1 className="workspace-title">{title}</h1>
              </div>
              {!isOnboarding && (
                <span className="workspace-status">
                  <span
                    className={cn(
                      "signal-dot",
                      draftProfile.briefsPaused && "is-paused",
                    )}
                  />
                  {draftProfile.briefsPaused
                    ? "Briefs paused"
                    : "Email window at " + workspace.profile.briefTime}
                </span>
              )}
            </div>
            {(clientError || workspace.lastError) && (
              <div className="workspace-notice" role="alert">
                <WarningCircle size={18} />
                <p>{clientError ?? workspace.lastError}</p>
              </div>
            )}
            {isGenerating && (
              <div className="generation-notice" role="status">
                <SpinnerGap size={19} className="loading-spinner" />
                <div>
                  <strong>Preparing your application materials</strong>
                  <p>
                    Using your profile and the selected job details. This can
                    take a few minutes.
                  </p>
                </div>
              </div>
            )}
            {isOnboarding ? (
              <OnboardingWizard />
            ) : view === "brief" ? (
              <WorkspaceOverview
                key={activeBrief?.id ?? "waiting"}
                onNavigate={setRequestedView}
              />
            ) : view === "applications" ? (
              <ApplicationsView onNavigate={setRequestedView} />
            ) : (
              <div className="workspace-studio">
                {workspace.packs.length > 0 && (
                  <details className={styles.savedDocuments}>
                    <summary>Saved documents ({workspace.packs.length})</summary>
                    <p>Generated documents are kept separately from seven-day suggestions.</p>
                    <div role="group" aria-label="Saved application documents">
                    {workspace.packs.map((pack) => {
                      const role = getRoleFromCatalog(pack.roleId, workspace.roleCatalog);
                      return (
                        <button key={pack.id} className="text-link" onClick={async () => {
                          await handleSetActiveBrief(pack.briefId);
                          await handleActiveRole(pack.roleId);
                        }}>
                          <strong>{role ? `${role.company}: ${role.title}` : "Saved application materials"}</strong>
                          <span>Saved {new Date(pack.generatedAt).toLocaleDateString("en-GB")}. {role && suggestionExpiry(role, currentTime).expired ? "Suggestion expired; documents kept." : "Open materials"}</span>
                        </button>
                      );
                    })}
                    </div>
                  </details>
                )}
                {selectedRoles.length > 0 && (
                  <div className="studio-role-switcher">
                    <label htmlFor="active-role-select">PREPARING FOR</label>
                    <select
                      id="active-role-select"
                      value={activeRole?.id ?? ""}
                      onChange={(e) =>
                        void handleActiveRole(Number(e.target.value))
                      }
                    >
                      {selectedRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.company} · {role.title}
                        </option>
                      ))}
                    </select>
                    <button
                      className="text-link"
                      onClick={() => setRequestedView("brief")}
                    >
                      Back to brief <ArrowRight size={14} />
                    </button>
                  </div>
                )}
                {activePack || isGenerating ? (
                  <StudioPanel />
                ) : (
                  <div className="workspace-empty">
                    <h2>
                      {workspace.flowPhase === "processing"
                        ? "Your materials are being prepared."
                        : "A good application starts with a role."}
                    </h2>
                    <p>
                      {workspace.flowPhase === "processing"
                        ? "Refresh your workspace to check for completed materials."
                        : "Choose a role from your brief, then select Prepare my materials. Selecting alone never starts AI writing."}
                    </p>
                    {workspace.flowPhase === "processing" ? (
                      <button
                        className="button button-dark"
                        onClick={() => void loadWorkspace()}
                      >
                        Refresh workspace
                      </button>
                    ) : (
                      <button
                        className="button button-dark"
                        onClick={() => setRequestedView("brief")}
                      >
                        Explore your brief <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <footer className="workspace-footer">
            <span>Your decisions. Your next chapter.</span>
            <button onClick={() => setIsSettingsOpen(true)}>
              Manage preferences
            </button>
          </footer>
        </div>
      </div>
      <SettingsModal />
      {commandPaletteOpen && (
        <CommandPalette
          commands={commands}
          onClose={() => setCommandPaletteOpen(false)}
        />
      )}
    </HunterAgentProvider>
  );
}
