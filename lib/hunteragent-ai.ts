import { createHash, randomUUID } from "node:crypto";
import { claimAiCache, readAiCache, releaseAiCache, reserveAiBudget, writeAiCache } from "@/lib/db";
import { logger } from "@/lib/logger";

export type AiTask = "matching" | "intent" | "materials" | "followUp" | "cvParse";

const TASKS = {
  matching: { env: "ANTHROPIC_MATCH_MODEL", model: "claude-haiku-4-5-20251001", output: 2500, inputBytes: 28000, ttl: 86400 },
  intent: { env: "ANTHROPIC_INTENT_MODEL", model: "claude-sonnet-5", output: 700, inputBytes: 6000, ttl: 30 * 86400 },
  materials: { env: "ANTHROPIC_MATERIALS_MODEL", model: "claude-sonnet-5", output: 2400, inputBytes: 40000, ttl: 300 },
  followUp: { env: "ANTHROPIC_FOLLOW_UP_MODEL", model: "claude-haiku-4-5-20251001", output: 400, inputBytes: 4000, ttl: 7 * 86400 },
  cvParse: { env: "ANTHROPIC_CV_MODEL", model: "claude-haiku-4-5-20251001", output: 1024, inputBytes: 20000, ttl: 60 },
} as const;

// Standard text API USD/MTok, checked 2026-09-02. Unknown models fail closed:
// changing model must include a review of price and request compatibility.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
};

function limit(name: string, fallback: number) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw.trim())) return 0;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= 1_000_000 ? value : 0;
}

export function aiTaskSettings(task: AiTask) {
  const settings = TASKS[task];
  const legacy = task === "materials" || task === "cvParse" ? process.env.ANTHROPIC_MODEL : undefined;
  return { ...settings, model: process.env[settings.env]?.trim() || legacy?.trim() || settings.model };
}

export function aiBudgetLimits() {
  return { userDailyCents: limit("AI_USER_DAILY_CENTS", 100), globalDailyCents: limit("AI_GLOBAL_DAILY_CENTS", 1000) };
}

export function estimateAiReservation(task: AiTask, system: string, prompt: string) {
  const settings = aiTaskSettings(task);
  const price = PRICES[settings.model];
  const inputBytes = Buffer.byteLength(system, "utf8") + Buffer.byteLength(prompt, "utf8");
  if (!price || inputBytes > settings.inputBytes) return null;
  // Text-only requests: byte count plus framing allowance is deliberately much
  // more conservative than a characters/4 estimate. Reserve maximum output too.
  return Math.max(1, Math.ceil(((inputBytes + 1024) * price.input + settings.output * price.output) / 10000));
}

export function parseAiJson(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")); }
  catch { return null; }
}

export async function callTaskAi(
  task: AiTask,
  system: string,
  prompt: string,
  options: { userId?: string; validate?: (text: string) => boolean } = {},
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const userId = options.userId;
  if (!apiKey || !userId || !process.env.DATABASE_URL || process.env.AI_ENABLED === "false") return null;
  const settings = aiTaskSettings(task);
  const cents = estimateAiReservation(task, system, prompt);
  if (cents === null) { logger.warn("ai: unsupported model or oversized input", { task }); return null; }
  const key = createHash("sha256").update(JSON.stringify(["ai-v1", task, settings.model, settings.output, system, prompt])).digest("hex");
  const token = randomUUID();
  let claimed = false;
  const valid = (text: string | null) => typeof text === "string" && text.length > 0
    && text.length <= 40000 && (!options.validate || options.validate(text));
  try {
    const cached = await readAiCache(userId, key);
    if (cached?.fresh) return valid(cached.text) ? cached.text : null;
    claimed = await claimAiCache(userId, key, token);
    if (!claimed) {
      const completed = await readAiCache(userId, key);
      return completed?.fresh && valid(completed.text) ? completed.text : null;
    }
    const budget = aiBudgetLimits();
    if (!await reserveAiBudget(userId, cents, budget.userDailyCents, budget.globalDailyCents)) {
      await writeAiCache(userId, key, token, null, 60);
      logger.info("ai: daily reservation limit reached", { task });
      return null;
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(25000),
      headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": apiKey },
      body: JSON.stringify({
        model: settings.model, max_tokens: settings.output, thinking: { type: "disabled" },
        system, messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error("Provider unavailable");
    const payload = await response.json() as { stop_reason?: string; content?: { type?: string; text?: string }[] };
    const text = Array.isArray(payload.content) ? payload.content.filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text).join("\n").trim() : "";
    const result = payload.stop_reason === "end_turn" && valid(text) ? text : null;
    await writeAiCache(userId, key, token, result, result ? settings.ttl : 300);
    logger.info("ai: completed", { task, model: settings.model, reservedCents: cents, usable: Boolean(result) });
    return result;
  } catch {
    // Never retry a possibly billed request, and never log prompts, responses,
    // names, CVs or API errors that might contain private content.
    if (claimed) await writeAiCache(userId, key, token, null, 300).catch(() => {});
    logger.warn("ai: using non-AI fallback", { task });
    return null;
  } finally {
    if (claimed) await releaseAiCache(userId, key, token).catch(() => {});
  }
}
