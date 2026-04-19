import { DAILY_ROLES } from "@/lib/hunteragent-data";
import { Profile, ProofMode, Role, WorkSampleReference, WorkplaceMode } from "@/lib/hunteragent-types";

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
};

type TavilySearchResponse = {
  results?: TavilySearchResult[];
};

let discoverySequence = 1000;

function nextRoleId() {
  discoverySequence += 1;
  return discoverySequence;
}

function inferProofMode(title: string): ProofMode {
  const lower = title.toLowerCase();
  if (/(designer|ux writer|content designer|brand|frontend|developer|marketer)/.test(lower)) return "recommended";
  if (/(product designer|senior product designer|brand designer)/.test(lower)) return "required";
  if (/(ops|operations|admin|finance|customer success|recruiter)/.test(lower)) return "none";
  return "optional";
}

function trimSentence(value: string, fallback: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function inferCompany(title: string) {
  const match = title.split(/[-|—]/).map((part) => part.trim()).filter(Boolean);
  return match.length > 1 ? match[match.length - 1] : "New match";
}

function inferRoleTitle(title: string) {
  const match = title.split(/[-|—]/).map((part) => part.trim()).filter(Boolean);
  return match[0] || title || "Open role";
}

function inferEmployment(content: string) {
  const lower = content.toLowerCase();
  if (lower.includes("part-time") || lower.includes("part time")) return "Part-time";
  if (lower.includes("contract")) return "Contract";
  return "Full-time";
}

function inferLocation(content: string, fallback: string) {
  const lower = content.toLowerCase();
  if (lower.includes("hybrid")) return "Hybrid";
  if (lower.includes("remote")) return "Remote";
  return fallback;
}

function inferWorkplaceMode(value: string): WorkplaceMode {
  const lower = value.toLowerCase();
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("remote")) return "remote";
  return "on-site";
}

function buildWorkSamples(title: string, content: string): WorkSampleReference[] {
  const lower = `${title} ${content}`.toLowerCase();
  if (/(designer|ux|brand)/.test(lower)) {
    return [
      { title: "Case study", note: "Useful proof of process, tradeoffs, and shipped outcomes." },
      { title: "Systems work", note: "Shows repeatable craft instead of a one-off surface redesign." },
    ];
  }
  if (/(frontend|engineer|developer)/.test(lower)) {
    return [
      { title: "Shipped project", note: "Shows implementation quality and product judgment." },
      { title: "GitHub or code sample", note: "Useful evidence for frontend delivery and maintainability." },
    ];
  }
  if (/(writer|content|marketing)/.test(lower)) {
    return [
      { title: "Writing sample", note: "Shows voice, clarity, and practical decision-making." },
      { title: "Campaign or launch asset", note: "Useful proof of strategic execution, not only copy polish." },
    ];
  }
  return [];
}

function fallbackFit(profile: Profile) {
  return `${profile.targetRoles[0] ?? "role fit"}, ${profile.locations.toLowerCase()}, ${profile.coreStrength.toLowerCase()}`;
}

function dedupeRoles(roles: Role[]) {
  const seen = new Set<string>();
  return roles.filter((role) => {
    const key = `${role.company.toLowerCase()}::${role.title.toLowerCase()}::${role.location.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function convertSearchResultToRole(result: TavilySearchResult, profile: Profile): Role | null {
  const title = result.title?.trim();
  if (!title) return null;

  const content = (result.content || result.raw_content || "").trim();
  const roleTitle = inferRoleTitle(title);
  const company = inferCompany(title);
  const proofMode = inferProofMode(roleTitle);
  const workSamples = buildWorkSamples(roleTitle, content);

  return {
    id: nextRoleId(),
    company,
    title: roleTitle,
    employment: inferEmployment(content),
    location: inferLocation(content, profile.locations.split(",")[0]?.trim() || "Remote"),
    posted: "fresh",
    fit: trimSentence(content, fallbackFit(profile)),
    focus: [profile.coreStrength, profile.targetRoles[0] ?? roleTitle, profile.locations].filter(Boolean),
    proofMode,
    workSamples,
    summary: trimSentence(content, `${roleTitle} at ${company} looks aligned with ${profile.coreStrength}.`),
  };
}

function buildQueries(profile: Profile) {
  const titles = profile.targetRoles.filter(Boolean).slice(0, 2);
  const locations = profile.locations
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);
  const workTypes = profile.workTypes.join(" OR ");
  const workplaceModes = profile.workplaceModes.map((mode) => (mode === "on-site" ? "on-site" : mode)).join(" OR ");
  const remoteRegions = profile.remoteRegions
    .map((region) => {
      switch (region) {
        case "uk":
          return "\"UK\"";
        case "europe":
          return "\"Europe\"";
        case "us":
          return "\"US\"";
        case "timezone-compatible":
          return "\"timezone-compatible\"";
        default:
          return "\"worldwide\"";
      }
    })
    .join(" OR ");
  const specialPreferences = profile.specialPreferences.slice(0, 2).join(" ");

  return titles.map((title) =>
    `"${title}" ${locations.join(" OR ")} (${workTypes}) (${workplaceModes}) ${remoteRegions} ${specialPreferences}`.trim(),
  );
}

async function searchTavily(query: string): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      topic: "general",
      time_range: "day",
      max_results: 8,
      include_raw_content: true,
      include_domains: ["boards.greenhouse.io", "jobs.lever.co", "jobs.ashbyhq.com", "wellfound.com", "linkedin.com"],
    }),
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as TavilySearchResponse;
  return payload.results ?? [];
}

function matchesHardFilters(role: Role, profile: Profile) {
  const roleText = `${role.location} ${role.summary} ${role.fit}`.toLowerCase();
  const roleMode = inferWorkplaceMode(role.location);

  if (profile.workplaceModes.length > 0 && !profile.workplaceModes.includes(roleMode)) {
    return false;
  }

  if (
    profile.excludedCompanies.some((company) => company.trim() && role.company.toLowerCase().includes(company.trim().toLowerCase()))
  ) {
    return false;
  }

  if (roleMode === "remote" && profile.remoteRegions.length > 0 && !profile.remoteRegions.includes("worldwide")) {
    const regionMatches = profile.remoteRegions.some((region) => {
      if (region === "timezone-compatible") return /timezone|gmt|bst|cet|europe|uk/.test(roleText);
      return roleText.includes(region === "uk" ? "uk" : region);
    });
    if (!regionMatches) return false;
  }

  return true;
}

function scoreRole(role: Role, profile: Profile) {
  let score = 0;
  const text = `${role.title} ${role.company} ${role.location} ${role.fit} ${role.summary} ${role.focus.join(" ")}`.toLowerCase();

  for (const targetRole of profile.targetRoles) {
    if (targetRole && text.includes(targetRole.toLowerCase())) score += 5;
  }

  for (const workType of profile.workTypes) {
    if (workType && role.employment.toLowerCase().includes(workType.toLowerCase())) score += 2;
  }

  for (const location of profile.locations.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)) {
    if (text.includes(location)) score += 2;
  }

  for (const preference of profile.specialPreferences) {
    if (preference && text.includes(preference.toLowerCase())) score += 3;
  }

  if (text.includes(profile.coreStrength.toLowerCase())) score += 4;

  const roleMode = inferWorkplaceMode(role.location);
  if (profile.workplaceModes.includes(roleMode)) score += 2;
  if (roleMode === "remote" && profile.remoteRegions.length > 0) score += 1;

  return score;
}

export async function discoverRoles(profile: Profile): Promise<{ roles: Role[]; usedFallback: boolean }> {
  if (profile.briefsPaused) {
    return { roles: DAILY_ROLES.map((role) => ({ ...role })), usedFallback: false };
  }

  const queries = buildQueries(profile);
  const batches = await Promise.all(queries.map((query) => searchTavily(query)));
  const discovered = dedupeRoles(
    batches
      .flat()
      .map((result) => convertSearchResultToRole(result, profile))
      .filter(Boolean) as Role[],
  )
    .filter((role) => matchesHardFilters(role, profile))
    .sort((left, right) => scoreRole(right, profile) - scoreRole(left, profile));

  if (discovered.length >= 5) {
    return { roles: discovered.slice(0, 10), usedFallback: false };
  }

  const fallbackRoles = DAILY_ROLES.map((role) => ({ ...role }))
    .filter((role) => matchesHardFilters(role, profile))
    .sort((left, right) => scoreRole(right, profile) - scoreRole(left, profile))
    .slice(0, 10);

  if (fallbackRoles.length > 0) {
    return { roles: fallbackRoles, usedFallback: true };
  }

  return {
    roles: DAILY_ROLES.map((role) => ({ ...role }))
      .sort((left, right) => scoreRole(right, profile) - scoreRole(left, profile))
      .slice(0, 10),
    usedFallback: true,
  };
}
