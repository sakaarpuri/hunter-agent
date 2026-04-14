import { BriefRecord, InboundReplyResult, Role } from "@/lib/hunteragent-types";

function normalizeReply(rawText: string) {
  const lines = rawText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const usefulLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(">")) break;
    if (/^on .+ wrote:$/i.test(line)) break;
    if (/^(from|sent|subject|to):/i.test(line)) break;
    usefulLines.push(line);
  }

  return usefulLines.join(" ").replace(/\s+/g, " ").trim();
}

function extractNumbers(normalizedReply: string) {
  const matches = normalizedReply.match(/\b(10|[1-9])\b/g) ?? [];
  return [...new Set(matches.map((value) => Number(value)))];
}

function findRoleMatches(normalizedReply: string, brief: BriefRecord, roles: Role[]) {
  const haystack = normalizedReply.toLowerCase();
  const selectedRoleIds = new Set<number>();
  const matchedLabels = new Set<string>();

  for (const role of roles.filter((item) => brief.roleIds.includes(item.id))) {
    const company = role.company.toLowerCase();
    const title = role.title.toLowerCase();
    const shortTitle = `${role.title} ${role.company}`.toLowerCase();

    if (haystack.includes(company) || haystack.includes(title) || haystack.includes(shortTitle)) {
      selectedRoleIds.add(role.id);
      matchedLabels.add(`${role.title} — ${role.company}`);
    }
  }

  return {
    selectedRoleIds: [...selectedRoleIds],
    matchedLabels: [...matchedLabels],
  };
}

function extractPreferenceNotes(normalizedReply: string) {
  const lower = normalizedReply.toLowerCase();
  const notes: string[] = [];

  if (lower.includes("pause")) notes.push("pause daily briefs");
  if (lower.includes("resume")) notes.push("resume daily briefs");
  if (lower.includes("more remote")) notes.push("prefer more remote roles");
  if (lower.includes("less contract")) notes.push("prefer fewer contract roles");
  if (lower.includes("more design")) notes.push("prefer more design roles");

  return notes;
}

export function parseInboundReply(brief: BriefRecord, rawText: string, roles: Role[]): InboundReplyResult {
  const normalizedReply = normalizeReply(rawText);

  if (!normalizedReply) {
    return {
      normalizedReply: "",
      selectedRoleIds: [],
      matchedLabels: [],
      preferenceNotes: [],
    };
  }

  const numericSelections = extractNumbers(normalizedReply).filter((id) => brief.roleIds.includes(id));
  const fuzzyMatches = findRoleMatches(normalizedReply, brief, roles);

  const selectedRoleIds = [...new Set([...numericSelections, ...fuzzyMatches.selectedRoleIds])].sort((a, b) => a - b);
  const matchedLabels = [...new Set([...selectedRoleIds.map((id) => `#${id}`), ...fuzzyMatches.matchedLabels])];

  return {
    normalizedReply,
    selectedRoleIds,
    matchedLabels,
    preferenceNotes: extractPreferenceNotes(normalizedReply),
  };
}
