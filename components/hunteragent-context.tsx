"use client";
import { createContext, useContext } from "react";
import type { AuthUser } from "@/lib/auth";
import type {
  AppliedRecord, CvViewMode, PackIntent, PackTarget, Profile, RoleFeedbackReason,
  ProofMode, ResumeStyleId, Role, StudioTab, Tone, WorkspaceState,
} from "@/lib/hunteragent-types";
import type { buildTrustExplanation } from "@/lib/hunteragent-trust";
import { JOB_RETENTION_MS } from "@/lib/hunteragent-retention";

export function suggestionExpiry(role: Role, now: number) {
  const firstSeen = Date.parse(role.firstSeenAt ?? "");
  const explicitExpiry = Date.parse(role.expiresAt ?? "");
  const expires = Math.min(
    Number.isFinite(firstSeen) ? firstSeen + JOB_RETENTION_MS : Infinity,
    Number.isFinite(explicitExpiry) ? explicitExpiry : Infinity,
  );
  if (!Number.isFinite(expires)) return { expired: true, label: "Expiry unavailable; not selectable", expires: null };
  return {
    expired: expires <= now,
    label: expires <= now
      ? "Suggestion expired"
      : `Suggestion expires ${new Date(expires).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
    expires: new Date(expires).toISOString(),
  };
}

export type TrustExplanation = ReturnType<typeof buildTrustExplanation>;

export type HunterAgentContextValue = {
  // Auth
  user: AuthUser;
  isDesignPreview?: boolean;
  // Workspace state
  workspace: WorkspaceState;
  currentTime: number;
  draftProfile: Profile;
  setDraftProfile: React.Dispatch<React.SetStateAction<Profile>>;
  draftStep: number;
  setDraftStep: React.Dispatch<React.SetStateAction<number>>;
  replyInput: string;
  setReplyInput: React.Dispatch<React.SetStateAction<string>>;
  // Loading / saving flags
  isLoading: boolean;
  isSavingDraft: boolean;
  isSubmittingReply: boolean;
  isGenerating: boolean;
  generationStage: number;
  clientError: string | null;
  // Settings state
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settingsName: string;
  setSettingsName: React.Dispatch<React.SetStateAction<string>>;
  currentPassword: string;
  setCurrentPassword: React.Dispatch<React.SetStateAction<string>>;
  newPassword: string;
  setNewPassword: React.Dispatch<React.SetStateAction<string>>;
  settingsError: string | null;
  settingsNotice: string | null;
  isSavingSettings: boolean;
  isSavingPreferences: boolean;
  // Studio state
  editInstruction: string;
  setEditInstruction: React.Dispatch<React.SetStateAction<string>>;
  designReferenceOpen: boolean;
  setDesignReferenceOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trustPanelOpen: boolean;
  setTrustPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Derived values
  activeBrief: WorkspaceState["briefs"][number] | null;
  selectedRoles: Role[];
  activeRole: Role | null;
  activePack: WorkspaceState["packs"][number] | null;
  appliedDetails: Array<AppliedRecord & { role: Role }>;
  effectiveStyle: ResumeStyleId;
  trustExplanation: TrustExplanation | null;
  activeProofMode: ProofMode;
  showWorkSamplesTab: boolean;
  visibleStudioTabs: Array<[StudioTab, string]>;
  promptHistory: string[];
  stageLabel: string;
  // Handlers
  handleSettingsNameSave: () => Promise<void>;
  handlePasswordChange: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  handleSignOut: () => Promise<void>;
  handlePreferenceSave: () => Promise<void>;
  toggleWorkplaceMode: (mode: WorkspaceState["profile"]["workplaceModes"][number]) => void;
  toggleRemoteRegion: (region: WorkspaceState["profile"]["remoteRegions"][number]) => void;
  handleFinishOnboarding: () => Promise<void>;
  handleSendFirstBriefNow: () => Promise<void>;
  handleReopenOnboarding: () => Promise<void>;
  handleReset: () => Promise<void>;
  generatePacks: (options?: { roleId?: number; target?: PackTarget; intent?: PackIntent; instruction?: string }) => Promise<void>;
  handleSharpenPack: () => void;
  handleSectionEdit: (target: PackTarget) => void;
  handleSuggestionClick: (suggestion: string) => void;
  handleEditCurrentTabOnly: () => void;
  handleClearPrompt: () => void;
  handleInboundReplySubmit: (options?: { prepareMaterials?: boolean }) => Promise<void>;
  handleToneChange: (tone: Tone) => Promise<void>;
  handleStudioTab: (tab: StudioTab) => Promise<void>;
  handleCvViewMode: (mode: CvViewMode) => Promise<void>;
  handleActiveRole: (roleId: number) => Promise<void>;
  handleRoleFeedback: (roleId: number, reaction: "interested" | "not_for_me", reason?: RoleFeedbackReason) => Promise<void>;
  handleRoleStyle: (styleId: ResumeStyleId) => Promise<void>;
  handleMakeDefaultStyle: (styleId: ResumeStyleId) => Promise<void>;
  handleLeftRailToggle: () => Promise<void>;
  handleExportCvPreview: () => void;
  handleMarkApplied: () => Promise<void>;
  handleFollowUpPlan: (roleId: number, plan: AppliedRecord["followUp"]) => Promise<void>;
  handleSetActiveBrief: (briefId: string) => Promise<void>;
};

const HunterAgentContext = createContext<HunterAgentContextValue | null>(null);

export function HunterAgentProvider({ children, value }: { children: React.ReactNode; value: HunterAgentContextValue }) {
  return <HunterAgentContext.Provider value={value}>{children}</HunterAgentContext.Provider>;
}

export function useHunterAgent(): HunterAgentContextValue {
  const ctx = useContext(HunterAgentContext);
  if (!ctx) throw new Error("useHunterAgent must be used inside HunterAgentProvider");
  return ctx;
}
