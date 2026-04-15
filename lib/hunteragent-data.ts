import {
  BriefRecord,
  CvViewMode,
  Profile,
  RemoteRegion,
  ResumeStyleId,
  ResumeStyleOption,
  Role,
  WorkplaceMode,
  WorkspaceState,
} from "@/lib/hunteragent-types";

export const WORKPLACE_MODE_OPTIONS: Array<{ id: WorkplaceMode; label: string }> = [
  { id: "remote", label: "Remote" },
  { id: "hybrid", label: "Hybrid" },
  { id: "on-site", label: "On-site" },
];

export const REMOTE_REGION_OPTIONS: Array<{ id: RemoteRegion; label: string }> = [
  { id: "worldwide", label: "Worldwide" },
  { id: "uk", label: "UK-only" },
  { id: "europe", label: "Europe-only" },
  { id: "us", label: "US-only" },
  { id: "timezone-compatible", label: "Timezone-compatible" },
];

export const RESUME_STYLES: ResumeStyleOption[] = [
  {
    id: "minimal",
    label: "Minimal",
    blurb: "Quiet structure, low decoration, strong scanning.",
    bestFor: "Generalist roles and conservative hiring teams.",
  },
  {
    id: "modern",
    label: "Modern",
    blurb: "Balanced hierarchy with sharper section rhythm.",
    bestFor: "Product, design, marketing, and tech teams.",
  },
  {
    id: "executive",
    label: "Executive",
    blurb: "More formal emphasis on ownership, scope, and outcomes.",
    bestFor: "Senior IC, lead, strategy, and operations roles.",
  },
  {
    id: "creative",
    label: "Creative",
    blurb: "More visual personality while staying recruiter-safe.",
    bestFor: "Design, brand, content, and portfolio-led applications.",
  },
];

export const DAILY_ROLES: Role[] = [
  {
    id: 1,
    company: "BrightPath Studio",
    title: "Senior Product Designer",
    employment: "Full-time",
    location: "London / Hybrid",
    posted: "9h ago",
    fit: "systems work, B2B SaaS, metrics-heavy team",
    focus: ["product systems", "analytics fluency", "cross-functional delivery"],
    summary:
      "Lead product system work across growth surfaces and internal analytics tools for a team that moves quickly but expects polished thinking.",
    proofMode: "required",
    workSamples: [
      { title: "Checkout redesign case study", note: "Proves end-to-end systems thinking and conversion sensitivity." },
      { title: "SaaS onboarding study", note: "Maps neatly to activation and lifecycle moments in the role." },
      { title: "Dashboard launch write-up", note: "Shows comfort with B2B complexity and collaboration with product leads." },
    ],
  },
  {
    id: 2,
    company: "Northline Health",
    title: "UX Writer",
    employment: "Part-time",
    location: "Remote",
    posted: "6h ago",
    fit: "lifecycle content, product writing, healthcare",
    focus: ["content systems", "regulated language", "product clarity"],
    summary:
      "Shape lifecycle and product copy inside a healthcare product where clarity, trust, and editorial consistency matter more than splashy messaging.",
    proofMode: "recommended",
    workSamples: [
      { title: "Lifecycle content system", note: "Direct signal for email and in-product sequence work." },
      { title: "Content governance guide", note: "Useful evidence for structured writing in regulated spaces." },
      { title: "Onboarding rewrite project", note: "Shows reduction of friction through copy, not just visuals." },
    ],
  },
  {
    id: 3,
    company: "Riverframe",
    title: "Growth Marketer",
    employment: "Contract",
    location: "Remote",
    posted: "11h ago",
    fit: "activation, email programs, experimentation",
    focus: ["growth loops", "funnel experiments", "CRM strategy"],
    summary:
      "Own lifecycle experiments and practical growth programs for a small team that values execution speed and measurable insight.",
    proofMode: "recommended",
    workSamples: [
      { title: "Lifecycle campaign teardown", note: "Demonstrates channel planning and a clear experimentation rhythm." },
      { title: "Activation dashboard build", note: "Adds proof of analytical fluency, not just channel copy." },
      { title: "Retention experiment memo", note: "Shows concise reporting and iteration after launch." },
    ],
  },
  {
    id: 4,
    company: "Hollow Arc",
    title: "Product Designer",
    employment: "Full-time",
    location: "Berlin / Remote",
    posted: "4h ago",
    fit: "dashboard work, research collaboration, SaaS",
    focus: ["B2B UI depth", "research synthesis", "design systems"],
    summary:
      "Design operator interfaces for a SaaS platform with heavier-than-average workflow density and strong cross-functional product pairing.",
    proofMode: "required",
    workSamples: [
      { title: "Research-to-interface sprint", note: "Highlights the jump from user evidence to final workflow design." },
      { title: "Ops dashboard case study", note: "Useful proof for dense UI, not just clean marketing surfaces." },
      { title: "Component system audit", note: "Reassures them on scale, consistency, and handoff quality." },
    ],
  },
  {
    id: 5,
    company: "Meridian Labs",
    title: "Content Strategist",
    employment: "Part-time",
    location: "Remote",
    posted: "13h ago",
    fit: "editorial systems, product launches, B2B storytelling",
    focus: ["messaging systems", "launch planning", "narrative clarity"],
    summary:
      "Build messaging systems and launch content for a technical B2B product that needs sharper positioning and cleaner editorial rhythm.",
    proofMode: "recommended",
    workSamples: [
      { title: "Launch narrative deck", note: "Shows strategic messaging, not just production output." },
      { title: "Editorial framework", note: "Useful evidence of system-building across channels." },
      { title: "Customer story rewrite", note: "Proves the ability to simplify complex inputs into useful proof." },
    ],
  },
  {
    id: 6,
    company: "Northline Health",
    title: "Senior UX Designer",
    employment: "Full-time",
    location: "Remote",
    posted: "8h ago",
    fit: "healthcare systems, design ops, workflow polish",
    focus: ["workflow clarity", "ops design", "accessibility"],
    summary:
      "Own UX improvements in a care operations platform with operational depth and high expectations around clarity and usability.",
    proofMode: "recommended",
    workSamples: [
      { title: "Clinical workflow redesign", note: "Proves the ability to simplify dense operational flows." },
      { title: "Accessibility upgrade sprint", note: "Important evidence for careful product craft." },
      { title: "Ops dashboard refinement", note: "Useful match for system-heavy interface work." },
    ],
  },
  {
    id: 7,
    company: "Quiet Orbit",
    title: "Brand Designer",
    employment: "Contract",
    location: "London / Remote",
    posted: "1d ago",
    fit: "brand systems, campaign rollout, visual identity",
    focus: ["brand systems", "campaign motion", "asset consistency"],
    summary:
      "Translate a maturing brand into launch-ready assets, product narratives, and cohesive campaign work across channels.",
    proofMode: "required",
    workSamples: [
      { title: "Brand system rollout", note: "Demonstrates continuity across assets and surfaces." },
      { title: "Campaign toolkit", note: "Useful proof for flexible visual systems." },
      { title: "Launch motion package", note: "Adds energy without slipping into trend-driven work." },
    ],
  },
  {
    id: 8,
    company: "Motion Bureau",
    title: "Frontend Developer",
    employment: "Contract",
    location: "Remote",
    posted: "18h ago",
    fit: "Next.js, interface polish, performance-sensitive builds",
    focus: ["Next.js delivery", "frontend craft", "performance"],
    summary:
      "Ship interface-heavy frontend work in a small product studio where speed matters but visual quality still needs real care.",
    proofMode: "recommended",
    workSamples: [
      { title: "Interface performance audit", note: "Useful evidence for shipping polish without regressions." },
      { title: "Design system frontend build", note: "Shows repeatable implementation across product surfaces." },
      { title: "Animation cleanup write-up", note: "Reassures them on motion taste and restraint." },
    ],
  },
  {
    id: 9,
    company: "Fieldnote",
    title: "Content Designer",
    employment: "Full-time",
    location: "Remote",
    posted: "7h ago",
    fit: "content design, user guidance, product clarity",
    focus: ["microcopy systems", "onboarding clarity", "product education"],
    summary:
      "Improve product clarity inside a workflow-heavy app that needs better guidance, content consistency, and clearer user decision points.",
    proofMode: "recommended",
    workSamples: [
      { title: "Product education rewrite", note: "Signals structured guidance inside complex flows." },
      { title: "Content design system", note: "Adds evidence of scalable voice and pattern work." },
      { title: "Decision support prompts", note: "Useful proof for complex-product clarity." },
    ],
  },
  {
    id: 10,
    company: "Clear Harbor",
    title: "Product Marketer",
    employment: "Part-time",
    location: "Remote / Hybrid",
    posted: "14h ago",
    fit: "positioning, B2B launches, practical storytelling",
    focus: ["product positioning", "go-to-market execution", "customer proof"],
    summary:
      "Own lean GTM work for a B2B product with shifting positioning and a real need for tighter customer-facing proof.",
    proofMode: "none",
    workSamples: [
      { title: "Positioning reset memo", note: "Shows strategic framing, not just copy output." },
      { title: "Launch page rewrite", note: "Adds proof of practical shipping work." },
      { title: "Customer proof library", note: "Useful signal for evidence-led product marketing." },
    ],
  },
];

export const initialProfile: Profile = {
  name: "Alina Reed",
  currentTitle: "Senior Product Designer",
  recipientEmail: "",
  targetRoles: ["Senior Product Designer", "Product Designer"],
  locations: "London, Remote, Hybrid",
  salary: "£68k - £92k",
  workTypes: ["Full-time"],
  workplaceModes: ["remote"],
  remoteRegions: ["worldwide"],
  excludedCompanies: [],
  specialPreferences: ["B2B SaaS", "No agencies"],
  briefsPaused: false,
  coreStrength: "B2B SaaS systems, lifecycle UX, design systems",
  resumeMode: "upload",
  cvFile: "Alina-Reed-Master-CV.pdf",
  guidedResume: {
    professionalSummary:
      "Senior product designer with a systems-first approach to B2B SaaS, lifecycle UX, and calmer workflow design.",
    recentImpact:
      "Led a redesign of a high-friction checkout and internal analytics surfaces, reducing support escalations while improving completion rates.",
    experienceSnapshot:
      "7+ years across product design, design systems, and close collaboration with engineering and product leads.",
    education: "BA in Interaction Design, University of the Arts London.",
    skills: "Product design, design systems, UX strategy, lifecycle UX, Figma, analytics-informed design.",
  },
  workSampleLinks: [
    "https://alinareed.design/checkout-case-study",
    "https://alinareed.design/saas-onboarding",
    "https://alinareed.design/dashboard-launch",
  ],
  briefTime: "08:00",
  timezone: "Europe/London",
  firstBrief: "now",
  resumeDefaultStyle: "modern",
};

export function estimateMinutes(count: number) {
  if (count <= 1) return "2 to 4 minutes";
  if (count <= 3) return "4 to 6 minutes";
  return "8 to 10 minutes";
}

export function formatRoleCode(roleId: number) {
  return String(roleId).padStart(2, "0");
}

export function formatClock(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export function formatAppliedDate(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
}

export function buildDueDate(appliedAt: string, followUpDays: 7 | 14) {
  const date = new Date(appliedAt);
  date.setDate(date.getDate() + followUpDays);
  return date.toISOString();
}

export function getRole(roleId: number) {
  return DAILY_ROLES.find((role) => role.id === roleId) ?? null;
}

export function getRoleFromCatalog(roleId: number, roles: Role[]) {
  return roles.find((role) => role.id === roleId) ?? null;
}

export function getResumeStyle(styleId: ResumeStyleId) {
  return RESUME_STYLES.find((style) => style.id === styleId) ?? RESUME_STYLES[1];
}

export function parsePreferenceList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createBriefRecord(firstBrief: Profile["firstBrief"], roles: Role[] = DAILY_ROLES): BriefRecord {
  const now = new Date();
  return {
    id: `brief-${crypto.randomUUID()}`,
    createdAt: now.toISOString(),
    scheduledFor: firstBrief === "scheduled" ? now.toISOString() : null,
    sentAt: null,
    recipientEmail: null,
    outboundMessageId: null,
    outboundThreadId: null,
    outboundInboxId: null,
    roleIds: roles.map((role) => role.id),
    topRoleIds: roles.slice(0, 5).map((role) => role.id),
    status: firstBrief === "now" ? "scheduled" : "scheduled",
    selectedRoleIds: [],
    inboundRecords: [],
  };
}

export function createInitialWorkspaceState(): WorkspaceState {
  return {
    profile: initialProfile,
    roleCatalog: DAILY_ROLES,
    onboardingStep: 1,
    onboardingComplete: false,
    flowPhase: "onboarding",
    briefs: [],
    activeBriefId: null,
    packs: [],
    appliedRecords: [],
    activeRoleId: null,
    studioTab: "cv",
    cvViewMode: "preview" satisfies CvViewMode,
    tone: "balanced",
    leftRailCollapsed: true,
    roleStyleOverrides: {},
    promptDrafts: {},
    promptHistory: {},
    generationStatus: null,
    lastError: null,
    stateVersion: 1,
  };
}
