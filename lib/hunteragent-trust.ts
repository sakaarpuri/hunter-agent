import { getResumeStyle } from "@/lib/hunteragent-data";
import { Profile, ResumeStyleId, Role, WorkSampleReference } from "@/lib/hunteragent-types";

export type TrustSource = "user" | "role" | "inferred";

export type TrustDetail = {
  label: string;
  value: string;
  source: TrustSource;
};

export type TrustSection = {
  title: string;
  summary: string;
  details: TrustDetail[];
};

export type TrustWorkSampleSection = TrustSection & {
  included: boolean;
  reason: string;
  selections: WorkSampleReference[];
};

export type TrustExplanationModel = {
  roleSelection: TrustSection;
  resumeStyle: TrustSection;
  workSamples: TrustWorkSampleSection;
  grounding: {
    user: TrustDetail[];
    role: TrustDetail[];
    inferred: TrustDetail[];
  };
};

export type TrustExplanationInput = {
  profile: Profile;
  role: Role;
  styleId?: ResumeStyleId;
  selectedWorkSamples?: WorkSampleReference[];
};

function pushDetail(target: TrustDetail[], label: string, value: string, source: TrustSource) {
  target.push({ label, value, source });
}

function humanJoin(values: string[]) {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

function buildWorkSampleSelections(role: Role, profile: Profile): WorkSampleReference[] {
  if (role.proofMode === "none") return [];

  if (profile.workSampleLinks.some(Boolean)) {
    return profile.workSampleLinks
      .filter(Boolean)
      .slice(0, 3)
      .map((href, index) => ({
        title: href.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || `Work sample ${index + 1}`,
        href,
        note: `HunterAgent selected this because it reinforces ${role.focus[index % role.focus.length]} for ${role.company}.`,
      }));
  }

  if (role.proofMode === "optional") return [];

  return role.workSamples.slice(0, 3);
}

function buildRoleSelectionSection(profile: Profile, role: Role): TrustSection {
  const details: TrustDetail[] = [];

  pushDetail(details, "User target roles", humanJoin(profile.targetRoles), "user");
  pushDetail(details, "User locations", profile.locations, "user");
  pushDetail(details, "User work types", humanJoin(profile.workTypes), "user");
  pushDetail(details, "User core strength", profile.coreStrength, "user");
  pushDetail(details, "Role title", `${role.company} - ${role.title}`, "role");
  pushDetail(details, "Role location", `${role.location} - ${role.employment}`, "role");
  pushDetail(details, "Role focus", humanJoin(role.focus), "role");
  pushDetail(details, "Proof mode", role.proofMode, "role");
  pushDetail(
    details,
    "Why it was selected",
    `This role overlaps your ${profile.coreStrength.toLowerCase()} and lines up with the hiring signal in ${role.fit}.`,
    "inferred",
  );

  return {
    title: "Why this role was selected",
    summary: `HunterAgent selected ${role.company} because the posting lines up with your target roles, location preferences, and the proof shape this team seems to want.`,
    details,
  };
}

function buildStyleSection(profile: Profile, role: Role, styleId: ResumeStyleId): TrustSection {
  const style = getResumeStyle(styleId);
  const details: TrustDetail[] = [];

  pushDetail(details, "Chosen style", style.label, "user");
  pushDetail(
    details,
    "Style source",
    styleId === profile.resumeDefaultStyle ? "Saved default resume style" : "Per-role override for this role",
    "user",
  );
  pushDetail(details, "Style best for", style.bestFor, "role");
  pushDetail(details, "Style blurb", style.blurb, "role");
  pushDetail(details, "Role shape", `${role.proofMode === "none" ? "No work samples" : "Some proof is useful"} for ${role.company}`, "role");
  pushDetail(
    details,
    "Why it fits",
    `The ${style.label.toLowerCase()} layout keeps ${role.company} easy to scan while matching ${role.fit}.`,
    "inferred",
  );
  pushDetail(
    details,
    "Grounded input",
    `This style comes from your saved resume preference, not a hidden model choice.`,
    "user",
  );

  return {
    title: "Why this resume style fits",
    summary: `The ${style.label} style is a good fit because it makes the resume easier to scan for the kind of role ${role.company} is hiring for.`,
    details,
  };
}

function buildWorkSamplesSection(profile: Profile, role: Role, selectedWorkSamples?: WorkSampleReference[]): TrustWorkSampleSection {
  const suggestedSelections = selectedWorkSamples?.length ? selectedWorkSamples : buildWorkSampleSelections(role, profile);
  const hasUserEvidence = profile.workSampleLinks.some(Boolean);
  const hasRoleEvidence = role.workSamples.length > 0;
  const included = role.proofMode !== "none" && suggestedSelections.length > 0;
  const details: TrustDetail[] = [];

  pushDetail(details, "Proof mode", role.proofMode, "role");
  pushDetail(details, "User work samples", hasUserEvidence ? `${profile.workSampleLinks.filter(Boolean).length} link(s) saved` : "No user links saved yet", "user");
  pushDetail(details, "Role samples", hasRoleEvidence ? `${role.workSamples.length} sample(s) from the role catalog` : "No catalog samples", "role");

  if (included) {
    pushDetail(
      details,
      "Why included",
      `This role benefits from concrete examples, so HunterAgent includes the strongest relevant samples instead of a generic portfolio dump.`,
      "inferred",
    );
  } else if (role.proofMode === "none") {
    pushDetail(
      details,
      "Why omitted",
      "This role does not call for work samples, so HunterAgent keeps the pack focused on the resume and cover letter.",
      "inferred",
    );
  } else if (!hasUserEvidence && !hasRoleEvidence) {
    pushDetail(
      details,
      "Why omitted",
      "There is not enough relevant sample evidence yet, so HunterAgent avoids adding a weak or noisy work-sample section.",
      "inferred",
    );
  } else {
    pushDetail(
      details,
      "Why omitted",
      "The role can support work samples, but the current selections did not produce a strong enough shortlist to surface here.",
      "inferred",
    );
  }

  return {
    title: "Work samples",
    summary: included
      ? `HunterAgent included ${suggestedSelections.length} work sample${suggestedSelections.length === 1 ? "" : "s"} because this role benefits from proof beyond the resume.`
      : "HunterAgent left work samples out so the pack stays focused and honest about the available proof.",
    details,
    included,
    reason: included
      ? "Selected samples are the strongest relevant proof for this role."
      : role.proofMode === "none"
        ? "The role itself does not need work samples."
        : "The available evidence is too thin to justify a work-sample section.",
    selections: suggestedSelections,
  };
}

function buildGrounding(profile: Profile, role: Role, styleId: ResumeStyleId, workSamples: WorkSampleReference[]) {
  const user: TrustDetail[] = [];
  const roleFacts: TrustDetail[] = [];
  const inferred: TrustDetail[] = [];

  pushDetail(user, "Name", profile.name, "user");
  pushDetail(user, "Current title", profile.currentTitle, "user");
  pushDetail(user, "Resume mode", profile.resumeMode === "upload" ? "Uploaded CV" : "Guided builder", "user");
  pushDetail(user, "Saved locations", profile.locations, "user");
  pushDetail(user, "Saved work types", humanJoin(profile.workTypes), "user");
  pushDetail(user, "Preferred style", getResumeStyle(styleId).label, "user");

  pushDetail(roleFacts, "Role", `${role.company} - ${role.title}`, "role");
  pushDetail(roleFacts, "Posting location", `${role.location} - ${role.employment}`, "role");
  pushDetail(roleFacts, "Role focus", humanJoin(role.focus), "role");
  pushDetail(roleFacts, "Proof mode", role.proofMode, "role");

  pushDetail(
    inferred,
    "Selection logic",
    `This role is a good match because it overlaps your target roles and core strengths.`,
    "inferred",
  );
  pushDetail(
    inferred,
    "Style logic",
    `The selected style keeps the CV easy to scan for this kind of hiring team.`,
    "inferred",
  );
  pushDetail(
    inferred,
    "Work sample logic",
    workSamples.length > 0
      ? "HunterAgent included work samples because the role benefits from direct proof."
      : "HunterAgent left work samples out to avoid forcing irrelevant evidence into the pack.",
    "inferred",
  );

  return { user, role: roleFacts, inferred };
}

export function buildTrustExplanation(input: TrustExplanationInput): TrustExplanationModel {
  const styleId = input.styleId ?? input.profile.resumeDefaultStyle;
  const workSamples = input.selectedWorkSamples ?? buildWorkSampleSelections(input.role, input.profile);

  return {
    roleSelection: buildRoleSelectionSection(input.profile, input.role),
    resumeStyle: buildStyleSection(input.profile, input.role, styleId),
    workSamples: buildWorkSamplesSection(input.profile, input.role, workSamples),
    grounding: buildGrounding(input.profile, input.role, styleId, workSamples),
  };
}
