import { Profile, ResumeStyleId, Role, Tone, WorkSampleReference } from "@/lib/hunteragent-types";

function titleFromLink(link: string) {
  const cleaned = link.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const slug = cleaned.split("/").slice(1).join(" ").replace(/[-_]/g, " ").trim();
  return slug ? slug.replace(/\b\w/g, (char) => char.toUpperCase()) : cleaned;
}

export function buildFallbackWorkSampleSelections(role: Role, profile: Profile): WorkSampleReference[] {
  if (role.proofMode === "none") return [];

  if (profile.workSampleLinks.some(Boolean)) {
    return profile.workSampleLinks.filter(Boolean).slice(0, 3).map((link) => ({
      title: titleFromLink(link),
      href: link,
      note: `User-provided work sample. Review its relevance to the ${role.title} role before including it.`,
    }));
  }

  if (role.proofMode === "optional") return [];

  return role.workSamples.slice(0, 3);
}

export function buildFallbackPack(role: Role, profile: Profile, tone: Tone, styleId: ResumeStyleId) {
  // A budget/provider fallback must not pretend to have tailored a CV or read
  // linked evidence. Reuse supplied facts, never job requirements as achievements.
  void styleId;
  const summary = profile.guidedResume.professionalSummary.trim() || profile.currentTitle.trim() || "Professional summary to be completed.";
  const facts = [profile.guidedResume.recentImpact, profile.guidedResume.experienceSnapshot, profile.coreStrength]
    .map((text) => text.trim()).filter(Boolean).slice(0, 3);
  const greeting = tone === "warm" ? `Hello ${role.company} team,` : `Dear ${role.company} hiring team,`;
  return {
    cvSummary: summary,
    cvBullets: facts,
    letter: `${greeting}\n\nI am interested in the ${role.title} position.${profile.currentTitle.trim() ? ` My current role is ${profile.currentTitle.trim()}.` : ""}${profile.coreStrength.trim() ? `\n\n${profile.coreStrength.trim()}` : ""}\n\nI would welcome the opportunity to discuss my background and learn more about the role.\n\nBest,\n${profile.name}`,
    reasoning: "Template draft using your supplied facts, not an AI-tailored application. Review and complete it before sending.",
    workSampleSelections: buildFallbackWorkSampleSelections(role, profile),
    followUpDraft: null,
  };
}

export function buildFallbackFollowUp(role: Role, profile: Profile, appliedAtLabel: string) {
  return `Hi ${role.company} team,\n\nI wanted to follow up on my application for the ${role.title} role that I submitted on ${appliedAtLabel}. I am still very interested in the opportunity and would be glad to share any additional context if useful.\n\nBest,\n${profile.name}`;
}
