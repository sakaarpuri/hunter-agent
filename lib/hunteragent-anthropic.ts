import { getResumeStyle } from "@/lib/hunteragent-data";
import { buildFallbackFollowUp, buildFallbackPack } from "@/lib/hunteragent-fallback";
import { PackIntent, PackRecord, PackTarget, Profile, ResumeStyleId, Role, Tone } from "@/lib/hunteragent-types";

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

type PackGenerationResult = ReturnType<typeof buildFallbackPack> & {
  provider: "anthropic" | "fallback";
};

type FollowUpGenerationResult = {
  draft: string;
  provider: "anthropic" | "fallback";
};

type PackGenerationOptions = {
  target?: PackTarget;
  intent?: PackIntent;
  instruction?: string;
  currentPack?: Pick<PackRecord, "cvSummary" | "cvBullets" | "letter" | "reasoning" | "workSampleSelections"> | null;
};

function extractText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: Array<{ type?: string; text?: string }> }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function parseJsonResponse<T>(rawText: string): T | null {
  const fenced = rawText.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? rawText;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1) return null;

    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

async function callAnthropic(system: string, userPrompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": ANTHROPIC_VERSION,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 1400,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${message}`);
  }

  return extractText(await response.json());
}

function buildRefinementIntent(intent: PackIntent, target: PackTarget, instruction?: string) {
  const scopedTarget =
    target === "cv"
      ? "resume summary and bullets"
      : target === "letter"
        ? "cover letter"
        : target === "workSamples"
          ? "work sample selections and reasoning"
          : "full application pack";

  const sharpenRules = [
    "Tighter writing",
    "Less repetition",
    "Stronger alignment to the job",
    "Better work-sample reasoning when evidence is relevant",
  ];

  if (intent === "sharpen") {
    return {
      task: `Sharpen the ${scopedTarget}.`,
      extraConstraints: sharpenRules,
    };
  }

  if (intent === "edit" && instruction?.trim()) {
    return {
      task: `Revise only the ${scopedTarget} using this instruction: ${instruction.trim()}`,
      extraConstraints: sharpenRules,
    };
  }

  return {
    task: `Refresh the ${scopedTarget}.`,
    extraConstraints: [],
  };
}

function normalizeWorkSampleSelections(
  selections: Array<{ title?: string; note?: string; href?: string }> | null | undefined,
  fallbackSelections: PackGenerationResult["workSampleSelections"],
) {
  if (!Array.isArray(selections) || selections.length === 0) return fallbackSelections;

  return selections
    .filter((item) => item?.title && item?.note)
    .slice(0, 3)
    .map((item) => ({
      title: item.title ?? "",
      note: item.note ?? "",
      href: item.href,
    }));
}

function mergePackSections(
  base: Omit<PackGenerationResult, "provider">,
  target: PackTarget,
  candidate: Partial<Omit<PackGenerationResult, "provider">>,
) {
  if (target === "pack") {
    return {
      cvSummary: candidate.cvSummary ?? base.cvSummary,
      cvBullets: Array.isArray(candidate.cvBullets) && candidate.cvBullets.length > 0 ? candidate.cvBullets.slice(0, 3) : base.cvBullets,
      letter: candidate.letter ?? base.letter,
      reasoning: candidate.reasoning ?? base.reasoning,
      workSampleSelections: candidate.workSampleSelections ?? base.workSampleSelections,
      followUpDraft: null,
    };
  }

  if (target === "cv") {
    return {
      ...base,
      cvSummary: candidate.cvSummary ?? base.cvSummary,
      cvBullets: Array.isArray(candidate.cvBullets) && candidate.cvBullets.length > 0 ? candidate.cvBullets.slice(0, 3) : base.cvBullets,
      followUpDraft: null,
    };
  }

  if (target === "letter") {
    return {
      ...base,
      letter: candidate.letter ?? base.letter,
      followUpDraft: null,
    };
  }

  return {
    ...base,
    reasoning: candidate.reasoning ?? base.reasoning,
    workSampleSelections: candidate.workSampleSelections ?? base.workSampleSelections,
    followUpDraft: null,
  };
}

export async function generateApplicationPack(
  role: Role,
  profile: Profile,
  tone: Tone,
  styleId: ResumeStyleId,
  options: PackGenerationOptions = {},
): Promise<PackGenerationResult> {
  const fallback = buildFallbackPack(role, profile, tone, styleId);
  const target = options.target ?? "pack";
  const intent = options.intent ?? "refresh";
  const basePack = options.currentPack
    ? {
        cvSummary: options.currentPack.cvSummary,
        cvBullets: options.currentPack.cvBullets,
        letter: options.currentPack.letter,
        reasoning: options.currentPack.reasoning,
        workSampleSelections: options.currentPack.workSampleSelections,
        followUpDraft: null,
      }
    : fallback;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return { ...mergePackSections(basePack, target, fallback), provider: "fallback" };
  }

  const style = getResumeStyle(styleId);
  const refinement = buildRefinementIntent(intent, target, options.instruction);
  const system = "You generate grounded job application assets. Never invent experience. Use only the supplied facts. Return raw JSON only.";
  const userPrompt = JSON.stringify(
    {
      task: refinement.task,
      target,
      intent,
      outputSchema: {
        cvSummary: "string",
        cvBullets: ["string", "string", "string"],
        letter: "string",
        reasoning: "string",
        workSampleSelections: [{ title: "string", note: "string", href: "string | optional" }],
      },
      applicant: {
        name: profile.name,
        currentTitle: profile.currentTitle,
        targetRoles: profile.targetRoles,
        locations: profile.locations,
        salary: profile.salary,
        workTypes: profile.workTypes,
        coreStrength: profile.coreStrength,
        resumeMode: profile.resumeMode,
        uploadedCv: profile.cvFile,
        guidedResume: profile.guidedResume,
        workSampleLinks: profile.workSampleLinks,
      },
      role,
      tone,
      resumeStyle: {
        id: style.id,
        label: style.label,
        blurb: style.blurb,
        bestFor: style.bestFor,
      },
      currentPack: options.currentPack ?? null,
      constraints: [
        "Keep the resume summary to one sentence.",
        "Return exactly three resume bullets.",
        "Keep the letter under 220 words.",
        "If work samples are in scope but links are sparse, still return up to three selections with helpful notes.",
        "If the role does not benefit from work samples, return an empty workSampleSelections array and avoid mentioning them in reasoning.",
        "Only rewrite the section(s) requested by the target. Preserve the rest.",
        ...refinement.extraConstraints,
      ],
      optionalInstruction: options.instruction?.trim() || null,
    },
    null,
    2,
  );

  try {
    const rawText = await callAnthropic(system, userPrompt);
    const parsed = rawText ? parseJsonResponse<Partial<typeof fallback>>(rawText) : null;

    if (!parsed) {
      return { ...mergePackSections(basePack, target, fallback), provider: "fallback" };
    }

    const merged = mergePackSections(basePack, target, {
      cvSummary: typeof parsed.cvSummary === "string" ? parsed.cvSummary : undefined,
      cvBullets: Array.isArray(parsed.cvBullets) ? parsed.cvBullets : undefined,
      letter: typeof parsed.letter === "string" ? parsed.letter : undefined,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
      workSampleSelections: normalizeWorkSampleSelections(parsed.workSampleSelections, basePack.workSampleSelections),
      followUpDraft: null,
    });

    return {
      ...merged,
      provider: "anthropic",
    };
  } catch {
    return { ...mergePackSections(basePack, target, fallback), provider: "fallback" };
  }
}

export async function generateFollowUpDraft(role: Role, profile: Profile, appliedAtLabel: string): Promise<FollowUpGenerationResult> {
  const fallback = buildFallbackFollowUp(role, profile, appliedAtLabel);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return { draft: fallback, provider: "fallback" };
  }

  const system = "You draft concise, grounded follow-up emails for job applications. Use only supplied facts. Return raw JSON only.";
  const userPrompt = JSON.stringify(
    {
      task: "Draft a follow-up email after a job application.",
      outputSchema: { draft: "string" },
      applicant: {
        name: profile.name,
        currentTitle: profile.currentTitle,
      },
      role: {
        company: role.company,
        title: role.title,
      },
      appliedAtLabel,
      constraints: [
        "Keep the email under 120 words.",
        "Do not sound demanding.",
        "Do not invent achievements or prior conversations.",
      ],
    },
    null,
    2,
  );

  try {
    const rawText = await callAnthropic(system, userPrompt);
    const parsed = rawText ? parseJsonResponse<{ draft?: string }>(rawText) : null;

    if (!parsed?.draft) {
      return { draft: fallback, provider: "fallback" };
    }

    return { draft: parsed.draft, provider: "anthropic" };
  } catch {
    return { draft: fallback, provider: "fallback" };
  }
}
