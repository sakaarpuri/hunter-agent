import { getResumeStyle } from "@/lib/hunteragent-data";
import { Profile, ResumeStyleId, Role, Tone, WorkSampleReference } from "@/lib/hunteragent-types";

function titleFromLink(link: string) {
  const cleaned = link.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const slug = cleaned.split("/").slice(1).join(" ").replace(/[-_]/g, " ").trim();
  return slug ? slug.replace(/\b\w/g, (char) => char.toUpperCase()) : cleaned;
}

export function buildFallbackWorkSampleSelections(role: Role, profile: Profile): WorkSampleReference[] {
  if (role.proofMode === "none") return [];

  if (profile.workSampleLinks.some(Boolean)) {
    return profile.workSampleLinks.filter(Boolean).slice(0, 3).map((link, index) => ({
      title: titleFromLink(link),
      href: link,
      note: `Chosen because it reinforces ${role.focus[index % role.focus.length]} for ${role.company}.`,
    }));
  }

  if (role.proofMode === "optional") return [];

  return role.workSamples.slice(0, 3);
}

export function buildFallbackPack(role: Role, profile: Profile, tone: Tone, styleId: ResumeStyleId) {
  const style = getResumeStyle(styleId);
  const opener = {
    balanced: `I am a strong fit for ${role.company} because this role sits directly at the overlap of ${role.focus[0]}, ${role.focus[1]}, and disciplined collaboration across product teams.`,
    direct: `This role maps closely to the work I already do well: ${role.focus[0]}, ${role.focus[1]}, and shipping calm product decisions with clear evidence.`,
    warm: `What draws me to ${role.company} is how clearly this role values ${role.focus[0]} and collaborative product craft, which is where I do my best work.`,
  } as const;

  const sourceContext =
    profile.resumeMode === "upload"
      ? `the uploaded master CV ${profile.cvFile}`
      : `the guided resume draft built from ${profile.guidedResume.experienceSnapshot.toLowerCase()}`;

  return {
    cvSummary: `${profile.name}'s resume was rebuilt in the ${style.label} style around ${role.focus[0]}, ${role.focus[1]}, and ${role.focus[2]}.`,
    cvBullets: [
      `Pulled forward evidence from ${sourceContext} so the strongest signal for ${role.company} appears first.`,
      `Reshaped the narrative to emphasise ${profile.coreStrength.toLowerCase()} and practical proof tied to ${role.fit}.`,
      `Kept the ${style.label.toLowerCase()} layout direction intentional: easier scanning, clearer hierarchy, and more space around the most relevant wins.`,
    ],
    letter: `${opener[tone]}\n\nI have attached examples that reflect the exact shape of work this team is asking for, including ${role.focus[0]}, ${role.focus[1]}, and the judgment required to turn messy requirements into useful shipped work.\n\nIf helpful, I can share more detail on my process, ${role.proofMode === "none" ? "the operating context behind my work," : "the tradeoffs behind the selected work samples,"} and how I collaborate across product and engineering.`,
    reasoning: role.proofMode === "none"
      ? `Chosen because ${role.company} is asking for ${role.fit}, and the strongest proof in ${profile.name}'s background is best carried by a focused resume and cover letter. The ${style.label} style keeps that evidence easy to scan.`
      : `Chosen because ${role.company} is asking for ${role.fit}, and the strongest proof in ${profile.name}'s background sits close to that combination. The ${style.label} style keeps that proof easy to scan.`,
    workSampleSelections: buildFallbackWorkSampleSelections(role, profile),
    followUpDraft: null,
  };
}

export function buildFallbackFollowUp(role: Role, profile: Profile, appliedAtLabel: string) {
  return `Hi ${role.company} team,\n\nI wanted to follow up on my application for the ${role.title} role that I submitted on ${appliedAtLabel}. I’m still very interested in the opportunity and would be glad to share any additional context or work samples if useful.\n\nBest,\n${profile.name}`;
}
