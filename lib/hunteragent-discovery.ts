import { createHash } from "node:crypto";
import { claimDiscoveryRun, type PublicSearchResult } from "@/lib/db";
import { canonicalJobUrl, discoveryLimits, jobSourceKind, searchPublicJobs } from "@/lib/hunteragent-search-cache";
import { shouldDiscoverNow } from "@/lib/hunteragent-scheduling";
import {
  buildPublicQueryPlans,
  classifyExplorationRole,
  selectExplorationMix,
} from "@/lib/hunteragent-exploration";
import { Profile, ProofMode, Role, RoleFeedbackRecord, WorkplaceMode } from "@/lib/hunteragent-types";

export { matchesOccupation } from "@/lib/hunteragent-exploration";

const DAY = 86_400_000;

export function roleFingerprint(sourceUrl: string) {
  return createHash("sha256").update(canonicalJobUrl(sourceUrl) ?? sourceUrl).digest("hex");
}

function stableRoleId(fingerprint: string) {
  // 52 hash bits fit exactly in a JS number; no process-local sequence collisions.
  return Number.parseInt(fingerprint.slice(0, 13), 16) + 1;
}

export function roleIsCurrent(role: Role, now = new Date()) {
  const firstSeen = Date.parse(role.firstSeenAt ?? "");
  const expires = Date.parse(role.expiresAt ?? "");
  const deadline = Math.min(firstSeen + 7 * DAY, Number.isFinite(expires) ? expires : Infinity);
  return Boolean(role.sourceUrl && canonicalJobUrl(role.sourceUrl)) && Number.isFinite(firstSeen)
    && firstSeen <= now.getTime() && now.getTime() < deadline;
}

export function jobsPerBrief(profile: Profile): 3 {
  void profile;
  return 3;
}

export function buildPublicQueries(profile: Profile) {
  return buildPublicQueryPlans(profile).map((plan) => plan.query);
}

function workplaceMode(text: string): WorkplaceMode | null {
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/on[ -]?site|in[ -]office|office[ -]based/i.test(text)) return "on-site";
  if (/\bremote\b/i.test(text) && !/\b(?:not|no|non)[ -]remote\b|remote\s+(?:work\s+)?(?:is\s+)?not\s+(?:available|allowed|offered)/i.test(text)) return "remote";
  return null;
}

function proofMode(title: string): ProofMode {
  if (/product designer|brand designer/i.test(title)) return "required";
  if (/designer|writer|frontend|developer|marketer/i.test(title)) return "recommended";
  if (/operations|admin|finance|customer success|recruiter/i.test(title)) return "none";
  return "optional";
}

function convertResult(result: PublicSearchResult, profile: Profile): Role {
  const pieces = result.title.split(/\s+[|\u2014-]\s+/).map((piece) => piece.trim()).filter(Boolean);
  const at = result.title.match(/^(?:Job Application for )?(.+?) at (.+)$/i);
  const title = (at?.[1] ?? pieces[0] ?? result.title).replace(/^Job Application for /i, "");
  const company = at?.[2] ?? (pieces.length > 1 ? pieces[pieces.length - 1] : "Company not specified");
  const content = result.content.replace(/\s+/g, " ").trim();
  const mode = workplaceMode(content);
  const location = content.match(/\blocation\s*:\s*([^.;|]{2,90})/i)?.[1]?.trim();
  const employment = /part[ -]time/i.test(content) ? "Part-time" : /\bcontract\b/i.test(content) ? "Contract"
    : /full[ -]time/i.test(content) ? "Full-time" : "Not specified";
  const fingerprint = roleFingerprint(result.url);
  const snippet = content.length > 350 ? `${content.slice(0, 347)}...` : content;
  return {
    id: stableRoleId(fingerprint), sourceUrl: result.url, fingerprint,
    firstSeenAt: result.firstSeenAt,
    expiresAt: new Date(Date.parse(result.firstSeenAt) + 7 * DAY).toISOString(),
    company, title, employment,
    location: location ?? (mode === "remote" ? "Remote" : mode === "hybrid" ? "Hybrid" : "Location not specified"),
    posted: result.publishedDate ? `Posted ${result.publishedDate.slice(0, 10)} (source)` : "Posting date not provided by source",
    fit: snippet, focus: [], proofMode: proofMode(title), workSamples: [], summary: content,
    explorationKind: classifyExplorationRole(title, profile) ?? "close",
    sourceKind: jobSourceKind(result.url),
  };
}

function normalizedWords(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}


function employmentKinds(text: string) {
  const kinds = new Set<string>();
  if (/\bfull[ -]?time\b/i.test(text)) kinds.add("full-time");
  if (/\bpart[ -]?time\b/i.test(text)) kinds.add("part-time");
  if (/\bcontract(?:or)?\b|\bfreelance\b|\bfixed[ -]term\b/i.test(text)) kinds.add("contract");
  if (/\bpermanent\b/i.test(text)) kinds.add("permanent");
  return kinds;
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  uk: ["uk", "u k", "united kingdom", "great britain", "britain", "england", "scotland", "wales", "northern ireland"],
  us: ["us", "u s", "usa", "u s a", "united states", "united states of america"],
  germany: ["germany", "deutschland"], france: ["france"], ireland: ["ireland"], spain: ["spain"],
  italy: ["italy"], netherlands: ["netherlands"], portugal: ["portugal"], poland: ["poland"],
  sweden: ["sweden"], denmark: ["denmark"], finland: ["finland"], austria: ["austria"], belgium: ["belgium"],
  norway: ["norway"], switzerland: ["switzerland"], canada: ["canada"], australia: ["australia"],
  india: ["india"], japan: ["japan"], singapore: ["singapore"], southkorea: ["south korea"], maldives: ["maldives"],
};
const CITY_COUNTRIES: Record<string, string> = {
  london: "uk", manchester: "uk", bristol: "uk", leeds: "uk", edinburgh: "uk", glasgow: "uk", belfast: "uk",
  berlin: "germany", munich: "germany", paris: "france", dublin: "ireland", amsterdam: "netherlands",
  madrid: "spain", barcelona: "spain", lisbon: "portugal", oslo: "norway", tromso: "norway", zurich: "switzerland",
  "new york": "us", nyc: "us", "san francisco": "us", seattle: "us", boston: "us", austin: "us", "los angeles": "us",
  toronto: "canada", vancouver: "canada", sydney: "australia", melbourne: "australia", tokyo: "japan", seoul: "southkorea",
};
const EU_COUNTRIES = new Set(["germany", "france", "ireland", "spain", "italy", "netherlands", "portugal", "poland", "sweden", "denmark", "finland", "austria", "belgium"]);
const EUROPE_COUNTRIES = new Set([...EU_COUNTRIES, "uk", "norway", "switzerland"]);

function includesPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `);
}

function geography(value: string) {
  const text = normalizedWords(value).replace(/\bnorthern ireland\b/g, "uk").replace(/\bnyc\b/g, "new york");
  const countries = new Set(Object.entries(COUNTRY_ALIASES).filter(([, aliases]) => aliases.some((alias) => includesPhrase(text, alias))).map(([country]) => country));
  const cities = new Set(Object.keys(CITY_COUNTRIES).filter((city) => includesPhrase(text, city)));
  for (const city of cities) countries.add(CITY_COUNTRIES[city]);
  return {
    countries, cities,
    eu: /\beu\b|\beuropean union\b/.test(text),
    europe: /\beurope\b|\beuropean economic area\b|\beea\b/.test(text),
    worldwide: /\bworldwide\b|\banywhere\b|\bglobally\b|\bglobal\b/.test(text),
  };
}

type Geography = ReturnType<typeof geography>;
function hasGeography(place: Geography) {
  return place.countries.size > 0 || place.eu || place.europe;
}

function includesCountry(place: Geography, country: string) {
  return place.countries.has(country) || (place.eu && EU_COUNTRIES.has(country)) || (place.europe && EUROPE_COUNTRIES.has(country));
}

function regionsOverlap(left: Geography, right: Geography) {
  return [...left.countries].some((country) => includesCountry(right, country))
    || [...right.countries].some((country) => includesCountry(left, country))
    || ((left.eu || left.europe) && (right.eu || right.europe));
}

function matchesOnsiteLocation(location: string, preferences: string) {
  const actual = geography(location);
  const requested = geography(preferences);
  if (requested.worldwide || !hasGeography(actual) || !hasGeography(requested)) return true;
  if (!regionsOverlap(actual, requested)) return false;
  // City-specific choices must overlap; a country preference still includes its cities.
  const choices = preferences.split(/[,;\n/]|\bor\b/i).map((value) => geography(value));
  const cityCountries = new Set([...requested.cities].map((city) => CITY_COUNTRIES[city]));
  const broadChoice = choices.some((choice) => hasGeography(choice) && !choice.cities.size
    && (/\bor\b/i.test(preferences) || choice.eu || choice.europe || [...choice.countries].some((country) => !cityCountries.has(country))));
  if (actual.cities.size && requested.cities.size && !broadChoice) {
    return [...actual.cities].some((city) => requested.cities.has(city));
  }
  return true;
}

function matchesRemoteRegion(role: Role, profile: Profile) {
  // Only location fields and explicit eligibility clauses are evidence of a restriction.
  // Offices, customers and company headquarters mentioned elsewhere are not.
  const clauses = role.summary.match(/\b(?:remote\s*(?:[-:(]|in\b|from\b|within\b)|(?:must|need to)\s+(?:be\s+)?(?:based|located|reside)\s+in|(?:candidates?|applicants?)\s+(?:must be\s+)?(?:based|located|residing)\s+in)[^.;\n]{1,100}/gi) ?? [];
  const only = `${role.location} ${role.summary}`.match(/\b(?:uk|us|usa|eu|europe|united kingdom|united states|canada|australia|india|japan)(?:[ -]only\b|\s+(?:residents?|candidates?)\s+only\b)/gi) ?? [];
  const scopeText = [role.location, ...clauses, ...only].join(" ")
    .replace(/\b(?:uk|us|usa|eu|europe|united kingdom|united states)\s+(?:time[ -]?zones?|business hours|working hours)\b/gi, "");
  const scope = geography(scopeText);
  if (scope.worldwide && !only.length && !clauses.some((clause) => /\bmust\b|\bneed to\b/i.test(clause))) return true;
  if (!hasGeography(scope)) return true;
  const requested = geography([...profile.remoteRegions.filter((region) => region !== "worldwide" && region !== "timezone-compatible"), profile.locations].join(" "));
  if (hasGeography(requested)) return regionsOverlap(scope, requested);
  // Worldwide is not a claim that this person is eligible for every regional restriction.
  return !profile.remoteRegions.length || profile.remoteRegions.includes("timezone-compatible");
}

export function matchesHardFilters(role: Role, profile: Profile) {
  if (!classifyExplorationRole(role.title, profile)) return false;
  const locationMode = workplaceMode(role.location);
  const mode = locationMode ?? workplaceMode(role.summary);
  if (mode && profile.workplaceModes.length && !profile.workplaceModes.includes(mode)) return false;
  if (/\b(?:not|no|non)[ -]remote\b|remote\s+(?:work\s+)?(?:is\s+)?not\s+(?:available|allowed|offered)/i.test(`${role.location} ${role.summary}`)
    && profile.workplaceModes.length === 1 && profile.workplaceModes[0] === "remote") return false;
  const company = normalizedWords(role.company);
  if (profile.excludedCompanies.some((excluded) => normalizedWords(excluded) && includesPhrase(company, normalizedWords(excluded)))) return false;
  const employment = employmentKinds(role.employment);
  const wantedEmployment = employmentKinds(profile.workTypes.join(" "));
  if (employment.size && wantedEmployment.size) {
    if (employment.has("contract") && !wantedEmployment.has("contract")) return false;
    if (employment.has("permanent") && wantedEmployment.size === 1 && wantedEmployment.has("contract")) return false;
    const schedules = [...employment].filter((kind) => kind === "full-time" || kind === "part-time");
    if (!employment.has("contract") && schedules.length && !schedules.some((kind) => wantedEmployment.has(kind))) return false;
  }
  if (mode === "remote" && !matchesRemoteRegion(role, profile)) return false;
  const location = hasGeography(geography(role.location)) ? role.location
    : role.summary.match(/\b(?:job |work |office )?location\s*:\s*([^.;|\n]{2,90})/i)?.[1] ?? role.location;
  if ((mode === "on-site" || mode === "hybrid") && !matchesOnsiteLocation(location, profile.locations)) return false;
  return true;
}

function feedbackAdjustment(role: Role, feedback: RoleFeedbackRecord[]) {
  const roleWords = new Set(normalizedWords(role.title).split(" "));
  let score = 0;
  for (const item of feedback.slice(0, 60)) {
    const titleOverlap = normalizedWords(item.title).split(" ").filter((word) => roleWords.has(word)).length;
    if (item.reaction === "interested") {
      if (titleOverlap) score += Math.min(4, titleOverlap * 2);
      if (normalizedWords(item.company) === normalizedWords(role.company)) score += 2;
      if (item.explorationKind === (role.explorationKind ?? "close")) score += 1;
      continue;
    }
    if (item.reason === "company" && normalizedWords(item.company) === normalizedWords(role.company)) score -= 8;
    if (item.reason === "location" && normalizedWords(item.location) === normalizedWords(role.location)) score -= 5;
    if ((item.reason === "direction" || item.reason === "seniority") && titleOverlap) score -= Math.min(6, titleOverlap * 2);
    if (item.reason === "not_exciting" && titleOverlap && item.explorationKind === (role.explorationKind ?? "close")) score -= 3;
  }
  return score;
}

function scoreRole(role: Role, profile: Profile, feedback: RoleFeedbackRecord[] = []) {
  const text = `${role.title} ${role.company} ${role.location} ${role.summary}`.toLowerCase();
  let score = 0;
  for (const target of profile.targetRoles) if (target && text.includes(target.toLowerCase())) score += 5;
  for (const type of profile.workTypes) if (type && role.employment.toLowerCase().includes(type.toLowerCase())) score += 2;
  for (const location of profile.locations.split(",")) if (location.trim() && text.includes(location.trim().toLowerCase())) score += 2;
  for (const preference of profile.specialPreferences) if (preference && text.includes(preference.toLowerCase())) score += 3;
  if (profile.coreStrength && text.includes(profile.coreStrength.toLowerCase())) score += 4;
  if (role.sourceKind === "primary") score += 2;
  score += feedbackAdjustment(role, feedback);
  return score;
}

export function rankUnseenRoles(roles: Role[], profile: Profile, seenJobs: Record<string, string> = {}, now = new Date(), feedback: RoleFeedbackRecord[] = []) {
  const seen = new Set<string>();
  const ids = new Set<number>();
  return roles.filter((role) => {
    if (!roleIsCurrent(role, now) || !matchesHardFilters(role, profile)) return false;
    const fingerprint = roleFingerprint(role.sourceUrl!);
    const lastShown = Date.parse(seenJobs[fingerprint] ?? "");
    if (Number.isFinite(lastShown) && now.getTime() - lastShown < 30 * DAY) return false;
    if (seen.has(fingerprint) || ids.has(role.id)) return false;
    seen.add(fingerprint);
    ids.add(role.id);
    return true;
  }).map((role) => ({ ...role, explorationKind: classifyExplorationRole(role.title, profile) ?? role.explorationKind ?? "close" }))
    .sort((left, right) => scoreRole(right, profile, feedback) - scoreRole(left, profile, feedback));
}

export type DiscoveryOptions = {
  userId?: string;
  now?: Date;
  pool?: Role[];
  knownRoles?: Role[];
  seenJobs?: Record<string, string>;
  lastDiscoveryAt?: string | null;
  feedback?: RoleFeedbackRecord[];
};

export async function discoverRoles(profile: Profile, options: DiscoveryOptions = {}) {
  const now = options.now ?? new Date();
  let lastDiscoveryAt = options.lastDiscoveryAt ?? null;
  const result = (roles: Role[], status: string) => ({ roles, usedFallback: false as const, lastDiscoveryAt, status });
  if (profile.briefsPaused) return result([], "paused");
  const candidates = [...(options.pool ?? [])];
  const ranked = () => rankUnseenRoles(candidates, profile, options.seenJobs, now, options.feedback);
  if (!shouldDiscoverNow(profile, lastDiscoveryAt, now)) return result(ranked(), "pool");
  const plans = buildPublicQueryPlans(profile);
  if (!plans.length) return result(ranked(), "unavailable");
  let allowPaid = false;
  if (options.userId && process.env.DATABASE_URL && process.env.TAVILY_API_KEY) {
    try {
      const claimed = await claimDiscoveryRun(options.userId, profile.timezone || "UTC", profile.discoveryCadence === "daily");
      if (claimed) { lastDiscoveryAt = claimed; allowPaid = true; }
    } catch { /* no cross-instance cadence claim means no paid requests */ }
  }
  const known = new Map<string, Role>();
  for (const role of [...(options.knownRoles ?? []), ...candidates]) {
    if (role.sourceUrl) {
      const fingerprint = roleFingerprint(role.sourceUrl);
      const existing = known.get(fingerprint);
      if (!existing || Date.parse(role.firstSeenAt ?? "") < Date.parse(existing.firstSeenAt ?? "")) known.set(fingerprint, role);
    }
  }
  const add = (results: PublicSearchResult[]) => {
    for (const raw of results) {
      const role = convertResult(raw, profile);
      const existing = known.get(role.fingerprint!);
      // Never refresh firstSeenAt/expiry or overwrite a saved catalog record.
      candidates.push(existing ?? role);
      if (!existing) known.set(role.fingerprint!, role);
    }
  };
  let status = "pool";
  let canEscalate = true;
  for (const plan of plans) {
    const search = await searchPublicJobs(plan.query, "basic", { userId: options.userId, allowPaid, now });
    status = search.status;
    add(search.results);
    if (search.status !== "cached" && search.status !== "live") { canEscalate = false; break; }
  }
  if (canEscalate && plans.length <= 2
    && selectExplorationMix(ranked(), profile.explorationMode, jobsPerBrief(profile)).length < jobsPerBrief(profile)
    && discoveryLimits().advanced) {
    const fallbackPlan = plans.find((plan) => plan.kind === "adjacent") ?? plans[0];
    const search = await searchPublicJobs(fallbackPlan.query, "advanced", { userId: options.userId, allowPaid, now });
    status = search.status;
    add(search.results);
  }
  return result(ranked().slice(0, 45), status);
}
