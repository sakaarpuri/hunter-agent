export type FlowPhase = "onboarding" | "waiting" | "brief" | "processing" | "studio";
export type StudioTab = "cv" | "letter" | "workSamples" | "pack";
export type Tone = "balanced" | "direct" | "warm";
export type FollowUpPlan = "off" | "7" | "14";
export type ResumeMode = "upload" | "guided";
export type ResumeStyleId = "minimal" | "modern" | "executive" | "creative";
export type BriefStatus = "scheduled" | "sent" | "replied" | "generating" | "ready";
export type PackTarget = "cv" | "letter" | "workSamples" | "pack";
export type PackIntent = "refresh" | "sharpen" | "edit";
export type ProofMode = "none" | "optional" | "recommended" | "required";
export type CvViewMode = "preview" | "content";
export type MaterialsMode = "ai" | "self";
export type WorkplaceMode = "remote" | "hybrid" | "on-site";
export type RemoteRegion = "worldwide" | "uk" | "europe" | "us" | "timezone-compatible";
export type DiscoveryCadence = "three-per-week" | "daily";

export type WorkSampleReference = {
  title: string;
  note: string;
  href?: string;
};

export type Role = {
  id: number;
  company: string;
  title: string;
  employment: string;
  location: string;
  posted: string;
  fit: string;
  focus: string[];
  proofMode: ProofMode;
  workSamples: WorkSampleReference[];
  summary: string;
  sourceUrl?: string;
  firstSeenAt?: string;
  expiresAt?: string;
  fingerprint?: string;
  matchAssessment?: {
    profileKey: string;
    sourceKey: string;
    score: number;
    fit: string;
    concerns: string[];
  };
};

export type GuidedResumeInput = {
  professionalSummary: string;
  recentImpact: string;
  experienceSnapshot: string;
  education: string;
  skills: string;
};

export type Profile = {
  name: string;
  currentTitle: string;
  recipientEmail: string;
  targetRoles: string[];
  locations: string;
  salary: string;
  workTypes: string[];
  workplaceModes: WorkplaceMode[];
  remoteRegions: RemoteRegion[];
  excludedCompanies: string[];
  specialPreferences: string[];
  briefsPaused: boolean;
  jobsPerBrief: 3;
  discoveryCadence: DiscoveryCadence;
  coreStrength: string;
  resumeMode: ResumeMode;
  cvFile: string;
  guidedResume: GuidedResumeInput;
  workSampleLinks: string[];
  briefTime: string;
  timezone: string;
  firstBrief: "now" | "scheduled";
  resumeDefaultStyle: ResumeStyleId;
  materialsMode: MaterialsMode;
};

export type ResumeStyleOption = {
  id: ResumeStyleId;
  label: string;
  blurb: string;
  bestFor: string;
};

export type BriefInboundRecord = {
  id: string;
  receivedAt: string;
  rawText: string;
  normalizedReply: string;
  selectedRoleIds: number[];
  matchedLabels: string[];
  preferenceNotes: string[];
  source: "dashboard" | "webhook";
  sender?: string;
  subject?: string;
  svixId?: string;
  eventId?: string;
  inboxId?: string;
  threadId?: string;
  messageId?: string;
};

export type BriefRecord = {
  id: string;
  createdAt: string;
  scheduledFor: string | null;
  sentAt: string | null;
  recipientEmail: string | null;
  outboundMessageId: string | null;
  outboundThreadId: string | null;
  outboundInboxId: string | null;
  roleIds: number[];
  // Immutable email numbering, including positions whose suggestions have expired.
  replyRoleIds?: number[];
  topRoleIds: number[];
  status: BriefStatus;
  selectedRoleIds: number[];
  inboundRecords: BriefInboundRecord[];
};

export type ExpiredBriefRecord = Pick<BriefRecord,
  "id" | "createdAt" | "sentAt" | "recipientEmail" | "outboundMessageId" | "outboundThreadId" | "outboundInboxId"
>;

export type PackRecord = {
  id: string;
  roleId: number;
  briefId: string;
  generatedAt: string;
  provider: "anthropic" | "fallback";
  tone: Tone;
  resumeStyleUsed: ResumeStyleId;
  resumeSourceType: ResumeMode;
  cvSummary: string;
  cvBullets: string[];
  letter: string;
  reasoning: string;
  workSampleSelections: WorkSampleReference[];
  followUpDraft: string | null;
};

export type AppliedRecord = {
  roleId: number;
  briefId: string;
  appliedAt: string;
  followUp: FollowUpPlan;
  followUpDueAt: string | null;
  followUpDraft: string | null;
  provider: "anthropic" | "fallback";
  resumeStyleUsed: ResumeStyleId;
};

export type WorkspaceState = {
  profile: Profile;
  roleCatalog: Role[];
  discoveryPool?: Role[];
  lastDiscoveryAt?: string | null;
  seenJobs?: Record<string, string>;
  expiredBriefs?: ExpiredBriefRecord[];
  onboardingStep: number;
  onboardingComplete: boolean;
  flowPhase: FlowPhase;
  briefs: BriefRecord[];
  activeBriefId: string | null;
  packs: PackRecord[];
  appliedRecords: AppliedRecord[];
  activeRoleId: number | null;
  studioTab: StudioTab;
  cvViewMode: CvViewMode;
  tone: Tone;
  leftRailCollapsed: boolean;
  roleStyleOverrides: Record<string, ResumeStyleId>;
  promptDrafts: Record<string, string>;
  promptHistory: Record<string, string[]>;
  generationStatus: string | null;
  lastError: string | null;
  stateVersion: number;
};

export type InboundReplyResult = {
  normalizedReply: string;
  selectedRoleIds: number[];
  matchedLabels: string[];
  preferenceNotes: string[];
};
