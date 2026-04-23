import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

async function extractTextFromFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (file.name.endsWith(".pdf")) {
    // Use lib path directly to skip pdf-parse v1's test-file loader that crashes in Next.js.
    // pdf-parse v2 (class-based) was tried but requires DOMMatrix (browser-only) — not viable in Node.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return result.text;
  }

  // Plain text fallback (covers .txt and .docx as best-effort UTF-8)
  return new TextDecoder().decode(bytes);
}

function heuristicProfileFromText(text: string): Record<string, unknown> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const nameLine = lines.find((l) => l.length < 60 && !/^(summary|profile|experience|education|skills|work|contact|objective)/i.test(l)) ?? "";
  const titleLine = lines.filter((l) => l !== nameLine && l.length < 80 && !/^(summary|profile|experience|education|skills|work|contact)/i.test(l))[0] ?? "";

  const summaryIdx = lines.findIndex((l) => /^(summary|professional summary|profile|objective|about)/i.test(l));
  const coreStrength = summaryIdx !== -1
    ? lines.slice(summaryIdx + 1, summaryIdx + 4).join(" ").slice(0, 200)
    : "";

  const expIdx = lines.findIndex((l) => /^(experience|work experience|employment)/i.test(l));
  const targetRoles: string[] = [];
  if (expIdx !== -1) {
    for (const l of lines.slice(expIdx + 1, expIdx + 10)) {
      if (l.length < 70 && /designer|developer|manager|lead|strategist|writer|marketer|analyst|engineer/i.test(l)) {
        targetRoles.push(l);
        if (targetRoles.length >= 2) break;
      }
    }
  }

  return { name: nameLine, currentTitle: titleLine, targetRoles, locations: "", coreStrength };
}

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  return raw.trim();
}

function profileLooksUseful(profile: Record<string, unknown>) {
  const fields = [
    typeof profile.name === "string" ? profile.name.trim() : "",
    typeof profile.currentTitle === "string" ? profile.currentTitle.trim() : "",
    typeof profile.locations === "string" ? profile.locations.trim() : "",
    typeof profile.coreStrength === "string" ? profile.coreStrength.trim() : "",
    Array.isArray(profile.targetRoles) ? profile.targetRoles.filter(Boolean).join(" ").trim() : "",
  ];

  return fields.some(Boolean);
}

async function parseProfileFromText(text: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return heuristicProfileFromText(text);
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
    const parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
    return profileLooksUseful(parsed) ? parsed : heuristicProfileFromText(text);
  } catch {
    return heuristicProfileFromText(text);
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
