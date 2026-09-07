import type {
  ExplorationKind,
  ExplorationMode,
  Profile,
  Role,
} from "@/lib/hunteragent-types";

const TITLE_NOISE = new Set([
  "senior", "junior", "sr", "jr", "lead", "principal", "staff", "head",
  "director", "associate", "graduate", "trainee", "intern", "ii", "iii",
  "iv", "of", "the", "and", "a", "an",
]);

const EXECUTIVE_TITLES: Array<[RegExp, string]> = [
  [/\b(?:ceo|chief executive(?: officer)?)\b/g, "chiefexecutive"],
  [/\b(?:cto|chief technology officer)\b/g, "chieftechnology"],
  [/\b(?:cfo|chief financial officer)\b/g, "chieffinancial"],
  [/\b(?:coo|chief operating officer)\b/g, "chiefoperating"],
  [/\b(?:ciso|chief information security officer)\b/g, "chiefinformationsecurity"],
  [/\b(?:cio|chief information officer)\b/g, "chiefinformation"],
  [/\b(?:cmo|chief marketing officer)\b/g, "chiefmarketing"],
];

type Bridge = {
  signal: RegExp;
  stretch: string[];
  surprise: string[];
};

// Deliberately bounded role bridges. These expand credible responsibilities,
// not hard constraints such as location, salary, work type, or employer.
const ROLE_BRIDGES: Bridge[] = [
  {
    signal: /\b(product|ux|ui)\s+design|\bux\b|\bui\b/,
    stretch: ["Service Designer", "Design Strategist", "Design Program Manager"],
    surprise: ["Creative Technologist", "Innovation Strategist", "Customer Experience Lead"],
  },
  {
    signal: /\b(brand|graphic|visual)\s+design|\bart director\b/,
    stretch: ["Art Director", "Creative Strategist", "Brand Experience Designer"],
    surprise: ["Creative Producer", "Campaign Strategist", "Visual Storytelling Lead"],
  },
  {
    signal: /\bproduct\s+(manager|management|lead|director)\b/,
    stretch: ["Product Strategy Lead", "Program Manager", "Business Operations Manager"],
    surprise: ["Venture Builder", "Chief of Staff", "Innovation Lead"],
  },
  {
    signal: /\b(frontend|backend|fullstack|full stack|software|web|mobile)\b|\bdeveloper\b|\bprogrammer\b/,
    stretch: ["Solutions Engineer", "Developer Advocate", "Technical Product Manager"],
    surprise: ["Creative Technologist", "Technical Program Manager", "Innovation Engineer"],
  },
  {
    signal: /\b(marketing|growth|demand generation|lifecycle|seo|crm)\b/,
    stretch: ["Product Marketing Manager", "Lifecycle Marketing Manager", "Brand Strategist"],
    surprise: ["Partnerships Manager", "Community Lead", "Content Strategy Lead"],
  },
  {
    signal: /\b(operations|operator|programme|program manager|project manager)\b/,
    stretch: ["Business Operations Manager", "Program Manager", "Chief of Staff"],
    surprise: ["Partnerships Manager", "Innovation Program Lead", "Creative Producer"],
  },
  {
    signal: /\b(finance|financial|accounting|commercial analyst|investment)\b/,
    stretch: ["Strategic Finance Manager", "Commercial Strategy Manager", "Business Operations Manager"],
    surprise: ["Investor Relations Manager", "Chief of Staff", "Venture Operations Lead"],
  },
  {
    signal: /\b(sales|business development|account executive|commercial)\b/,
    stretch: ["Partnerships Manager", "Customer Success Lead", "Commercial Strategy Manager"],
    surprise: ["Ecosystem Lead", "Market Expansion Lead", "Community Partnerships Lead"],
  },
  {
    signal: /\b(writer|writing|editor|editorial|content|communications|copywriter)\b/,
    stretch: ["Content Strategist", "Communications Manager", "Editorial Lead"],
    surprise: ["Knowledge Manager", "Brand Strategist", "Learning Experience Designer"],
  },
  {
    signal: /\bphotograph|\bvideograph|\bfilmmaker|\bvisual storyteller\b/,
    stretch: ["Content Producer", "Visual Storytelling Lead", "Creative Producer"],
    surprise: ["Expedition Content Producer", "Brand Storyteller", "Field Communications Lead"],
  },
  {
    signal: /\b(scientist|researcher|research scientist|laboratory|biologist|chemist|oceanograph)\b/,
    stretch: ["Research Program Manager", "Science Communicator", "Innovation Program Manager"],
    surprise: ["Policy Advisor", "Expedition Research Coordinator", "Research Partnerships Lead"],
  },
  {
    signal: /\b(recruiter|talent acquisition|human resources|people partner|people operations)\b/,
    stretch: ["Talent Program Manager", "People Operations Manager", "Employer Brand Manager"],
    surprise: ["Community Lead", "Learning Program Manager", "Workplace Experience Lead"],
  },
  {
    signal: /\b(customer success|account manager|implementation|customer experience)\b/,
    stretch: ["Account Management Lead", "Implementation Manager", "Partnerships Manager"],
    surprise: ["Customer Education Lead", "Community Lead", "Service Design Lead"],
  },
];

export type PublicQueryPlan = {
  query: string;
  kind: ExplorationKind;
  title: string;
};

export function normalizedWords(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function occupationWords(title: string) {
  let text = normalizedWords(title)
    .replace(/\bfront end\b/g, "frontend")
    .replace(/\bback end\b/g, "backend")
    .replace(/\bfull stack\b/g, "fullstack");
  for (const [pattern, replacement] of EXECUTIVE_TITLES) {
    text = text.replace(pattern, replacement);
  }
  text = text
    .replace(/\buser experience\b/g, "ux")
    .replace(/\buser interface\b/g, "ui")
    .replace(/\bdesigners?\b/g, "design")
    .replace(/\bengineering\b/g, "engineer")
    .replace(/\bphotography\b/g, "photographer")
    .replace(/\bguiding\b/g, "guide");
  if (/\b(?:software|frontend|backend|fullstack|web|mobile|ios|android|developer|programmer)\b/.test(text)) {
    text = `${text.replace(/\b(?:developer|programmer)\b/g, "engineer")} software`;
  }
  return new Set(text.split(" ").filter((word) => word && !TITLE_NOISE.has(word)));
}

export function matchesOccupation(title: string, targets: string[]) {
  const requested = targets.filter((target) => target.trim());
  if (!requested.length) return true;
  const actual = occupationWords(title);
  return requested.some((target) => {
    const wanted = occupationWords(target);
    if (!wanted.size) return false;
    if ([...wanted].some((word) => word.startsWith("chief")) && actual.has("assistant") && !wanted.has("assistant")) {
      return false;
    }
    return [...wanted].every((word) => actual.has(word));
  });
}

function profileSignals(profile: Profile) {
  return normalizedWords([
    profile.currentTitle,
    ...profile.targetRoles,
    profile.coreStrength,
    profile.guidedResume.skills,
    ...profile.specialPreferences,
  ].join(" "));
}

export function adjacentRoleTitles(profile: Profile) {
  if (profile.explorationMode === "close") return [];
  const signals = profileSignals(profile);
  const titles: string[] = [];
  for (const bridge of ROLE_BRIDGES) {
    if (!bridge.signal.test(signals)) continue;
    titles.push(...bridge.stretch);
    if (profile.explorationMode === "surprise") titles.push(...bridge.surprise);
  }
  const existing = profile.targetRoles.filter(Boolean);
  return [...new Set(titles)].filter((title) => !matchesOccupation(title, existing)).slice(0, 6);
}

export function classifyExplorationRole(title: string, profile: Profile): ExplorationKind | null {
  if (matchesOccupation(title, profile.targetRoles)) return "close";
  if (profile.explorationMode !== "close" && matchesOccupation(title, adjacentRoleTitles(profile))) {
    return "adjacent";
  }
  return null;
}

function publicTerm(value: string) {
  return value
    .toLowerCase()
    .replace(/["\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function buildPublicQueryPlans(profile: Profile): PublicQueryPlan[] {
  const regions = profile.locations
    .split(",")
    .map(publicTerm)
    .filter(Boolean)
    .slice(0, 2);
  const closeTitles = [...new Set(profile.targetRoles.map(publicTerm).filter(Boolean))];
  const adjacentTitles = adjacentRoleTitles(profile).map(publicTerm);
  const titlePlans: Array<{ title: string; kind: ExplorationKind }> =
    profile.explorationMode === "close"
      ? closeTitles.slice(0, 2).map((title) => ({ title, kind: "close" }))
      : profile.explorationMode === "stretch"
        ? [
            ...closeTitles.slice(0, 1).map((title) => ({ title, kind: "close" as const })),
            ...adjacentTitles.slice(0, 1).map((title) => ({ title, kind: "adjacent" as const })),
          ]
        : [
            ...closeTitles.slice(0, 1).map((title) => ({ title, kind: "close" as const })),
            ...adjacentTitles.slice(0, 2).map((title) => ({ title, kind: "adjacent" as const })),
          ];
  return titlePlans.map(({ title, kind }) => ({
    title,
    kind,
    query: `"${title}" jobs ${regions.join(" OR ")}`.trim(),
  }));
}

export function selectExplorationMix(roles: Role[], mode: ExplorationMode, limit = 3) {
  const caps = mode === "close"
    ? { close: limit, adjacent: 0 }
    : mode === "stretch"
      ? { close: Math.min(2, limit), adjacent: Math.min(1, limit) }
      : { close: Math.min(1, limit), adjacent: Math.min(2, limit) };
  const selected: Role[] = [];
  const counts = { close: 0, adjacent: 0 };
  for (const role of roles) {
    const kind = role.explorationKind ?? "close";
    if (counts[kind] >= caps[kind]) continue;
    selected.push(role);
    counts[kind] += 1;
    if (selected.length === limit) break;
  }
  return selected;
}
