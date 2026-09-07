import { createHash, randomUUID } from "node:crypto";
import {
  claimDiscoveryCache,
  readDiscoveryCache,
  releaseDiscoveryCache,
  reserveDiscoveryCredits,
  writeDiscoveryCache,
  type PublicSearchResult,
} from "@/lib/db";

export type SearchDepth = "basic" | "advanced";
export type SearchOutcome = {
  results: PublicSearchResult[];
  status: "cached" | "live" | "unavailable" | "budget" | "busy" | "error";
};
const DOMAINS = [
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "jobs.lever.co",
  "jobs.ashbyhq.com",
  "jobs.smartrecruiters.com",
  "myworkdayjobs.com",
  "wellfound.com",
  "linkedin.com",
];
const DAY = 86_400_000;

function budget(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function discoveryLimits() {
  return {
    userCredits: budget("DISCOVERY_USER_DAILY_CREDITS", 4),
    globalCredits: budget("DISCOVERY_GLOBAL_DAILY_CREDITS", 30),
    cacheTtlSeconds: Math.max(3600, Math.min(259200, budget("DISCOVERY_CACHE_TTL_SECONDS", 86400))),
    advanced: process.env.DISCOVERY_ENABLE_ADVANCED !== "false",
  };
}

export function canonicalJobUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    let host = url.hostname.toLowerCase().replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") {
      if (parts.length !== 3 || parts[1] !== "jobs" || !/^\d+$/.test(parts[2])) return null;
      host = "boards.greenhouse.io";
    } else if (host === "jobs.lever.co" || host === "jobs.ashbyhq.com") {
      if (parts.length === 3 && parts[2] === "apply") parts.pop();
      if (parts.length !== 2 || !/^[a-f0-9-]{20,}$/i.test(parts[1])) return null;
    } else if (host === "jobs.smartrecruiters.com") {
      if (parts.length < 2 || parts.length > 3 || !/^[a-z0-9-]+$/i.test(parts[0])) return null;
    } else if (host.endsWith(".myworkdayjobs.com")) {
      if (!parts.includes("job") || parts.length < 3) return null;
    } else if (host === "wellfound.com") {
      if (parts.length !== 2 || parts[0] !== "jobs" || !/^\d+/.test(parts[1])) return null;
    } else if (host === "linkedin.com") {
      if (parts.length !== 3 || parts[0] !== "jobs" || parts[1] !== "view") return null;
      const id = parts[2].match(/(?:^|-)(\d+)$/)?.[1];
      if (!id) return null;
      parts[2] = id;
    } else return null;
    return `https://${host}/${parts.join("/")}`;
  } catch {
    return null;
  }
}

export function jobSourceKind(raw: string): "primary" | "aggregator" {
  const canonical = canonicalJobUrl(raw);
  if (!canonical) return "aggregator";
  const host = new URL(canonical).hostname;
  return host === "wellfound.com" || host === "linkedin.com" ? "aggregator" : "primary";
}

export function publicQueryCacheKey(query: string, depth: SearchDepth) {
  return createHash("sha256").update(JSON.stringify({
    version: 1, query: query.trim().replace(/\s+/g, " ").toLowerCase(), depth,
    domains: DOMAINS, timeRange: "week", maxResults: 15,
  })).digest("hex");
}

function normalizeResults(payload: unknown, previous: PublicSearchResult[], now: Date): PublicSearchResult[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown }).results)) {
    throw new Error("Malformed search response");
  }
  const prior = new Map(previous.map((result) => [result.url, result.firstSeenAt]));
  const results: PublicSearchResult[] = [];
  const seen = new Set<string>();
  for (const raw of (payload as { results: unknown[] }).results.slice(0, 20)) {
    if (!raw || typeof raw !== "object") continue;
    const value = raw as Record<string, unknown>;
    const url = typeof value.url === "string" ? canonicalJobUrl(value.url) : null;
    const title = typeof value.title === "string" ? value.title.trim().slice(0, 300) : "";
    const content = typeof value.content === "string" ? value.content.trim().slice(0, 8000) : "";
    if (!url || !title || !content || seen.has(url)) continue;
    if (/no longer (?:accepting|available)|position (?:has been |is )?(?:filled|closed)|job (?:has )?expired/i.test(`${title} ${content}`)) continue;
    seen.add(url);
    const published = typeof value.published_date === "string" ? Date.parse(value.published_date) : NaN;
    results.push({
      url, title, content,
      ...(Number.isFinite(published) && published <= now.getTime() ? { publishedDate: new Date(published).toISOString() } : {}),
      firstSeenAt: prior.get(url) ?? now.toISOString(),
    });
  }
  return results;
}

export async function searchPublicJobs(
  query: string,
  depth: SearchDepth,
  options: { userId?: string; allowPaid?: boolean; now?: Date } = {},
): Promise<SearchOutcome> {
  const empty = (status: SearchOutcome["status"]): SearchOutcome => ({ results: [], status });
  if (!process.env.DATABASE_URL) return empty("unavailable");
  const key = publicQueryCacheKey(query, depth);
  let token: string | null = null;
  try {
    const cached = await readDiscoveryCache(key);
    const now = options.now ?? new Date();
    const unexpired = (items: PublicSearchResult[]) => items.filter((item) => {
      const firstSeen = Date.parse(item.firstSeenAt);
      return Number.isFinite(firstSeen) && firstSeen <= now.getTime() && now.getTime() < firstSeen + 7 * DAY;
    });
    if (cached?.fresh) return { results: unexpired(cached.results), status: "cached" };
    if (!options.allowPaid || !options.userId || !process.env.TAVILY_API_KEY) return empty("unavailable");
    token = randomUUID();
    if (!await claimDiscoveryCache(key, token)) {
      token = null;
      // A competing instance owns the fetch. Do not duplicate it or escalate.
      const filled = await readDiscoveryCache(key);
      return filled?.fresh ? { results: unexpired(filled.results), status: "cached" } : empty("busy");
    }
    const afterClaim = await readDiscoveryCache(key);
    if (afterClaim?.fresh) return { results: unexpired(afterClaim.results), status: "cached" };
    const limits = discoveryLimits();
    if (!await reserveDiscoveryCredits(options.userId, depth === "basic" ? 1 : 2, limits.userCredits, limits.globalCredits)) {
      return empty("budget");
    }
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.TAVILY_API_KEY}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        query, search_depth: depth, auto_parameters: false, topic: "general", time_range: "week",
        max_results: 15, include_answer: false, include_raw_content: false, include_domains: DOMAINS,
      }),
    });
    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    const results = normalizeResults(await response.json(), afterClaim?.results ?? cached?.results ?? [], now);
    await writeDiscoveryCache(key, token, results, limits.cacheTtlSeconds);
    return { results: unexpired(results), status: "live" };
  } catch {
    // Briefs remain usable during provider/DB outages. A short negative cache
    // prevents retry storms, but an ambiguous request is never refunded.
    if (token) {
      try { await writeDiscoveryCache(key, token, [], 300); } catch { /* fail closed */ }
    }
    return empty("error");
  } finally {
    if (token) {
      try { await releaseDiscoveryCache(key, token); } catch { /* lease expires automatically */ }
    }
  }
}
