import { canonicalJobUrl } from "@/lib/hunteragent-search-cache";
import type { Role, SourceVerificationStatus } from "@/lib/hunteragent-types";

const CLOSED_COPY = /\b(?:job|position|role|vacancy)\b[^.]{0,90}\b(?:closed|filled|expired|no longer available)\b|no longer accepting applications|page not found/i;

export async function verifyJobSource(role: Role, now = new Date()): Promise<Role> {
  let url = role.sourceUrl ? canonicalJobUrl(role.sourceUrl) : null;
  if (!url) return { ...role, sourceVerificationStatus: "unavailable", sourceVerifiedAt: now.toISOString() };

  let status: SourceVerificationStatus = "unknown";
  try {
    for (let redirect = 0; redirect <= 2; redirect += 1) {
      const response: Response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(6_000),
        headers: { accept: "text/html,application/xhtml+xml" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location: string | null = response.headers.get("location");
        url = location ? canonicalJobUrl(new URL(location, url).toString()) : null;
        if (!url) { status = "unavailable"; break; }
        continue;
      }
      if (response.status === 404 || response.status === 410) status = "unavailable";
      else if (response.ok) status = CLOSED_COPY.test((await response.text()).slice(0, 250_000)) ? "unavailable" : "verified";
      break;
    }
  } catch {
    status = "unknown";
  }
  return { ...role, sourceUrl: url ?? role.sourceUrl, sourceVerificationStatus: status, sourceVerifiedAt: now.toISOString() };
}

export async function verifyJobSources(roles: Role[], now = new Date()) {
  return Promise.all(roles.map((role) => verifyJobSource(role, now)));
}
