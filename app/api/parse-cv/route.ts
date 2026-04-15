import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

async function extractTextFromFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (file.name.endsWith(".pdf")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return result.text;
  }

  // Plain text fallback (covers .txt and .docx as best-effort UTF-8)
  return new TextDecoder().decode(bytes);
}

async function parseProfileFromText(text: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Heuristic fallback without AI
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      name: lines[0] ?? "",
      currentTitle: lines[1] ?? "",
      targetRoles: [],
      locations: "",
      coreStrength: text.slice(0, 300),
    };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Extract the following fields from this CV/resume text and return ONLY valid JSON (no markdown, no explanation):

{
  "name": "full name of the person",
  "currentTitle": "current or most recent job title",
  "targetRoles": ["up to 3 role types this person would target next"],
  "locations": "city or cities where the person is based or open to work",
  "coreStrength": "one sentence describing their main professional strength",
  "professionalSummary": "2-3 sentence professional summary if present, otherwise empty string"
}

CV text:
${text.slice(0, 4000)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const raw = data.content[0]?.text ?? "{}";

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  try {
    await requireUser();
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "Sign in to continue.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 5 MB." }, { status: 400 });
    }

    const text = await extractTextFromFile(file);

    if (!text.trim()) {
      return NextResponse.json({ error: "Could not extract text from the file." }, { status: 422 });
    }

    const profile = await parseProfileFromText(text);
    logger.info("parse-cv: success", { fileName: file.name, textLength: text.length });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    logger.error("parse-cv: error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Could not parse the CV." }, { status: 500 });
  }
}
