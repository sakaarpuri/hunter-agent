import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { updateWorkspaceState } from "@/lib/hunteragent-store";
import { applyInboundReplyToWorkspace } from "@/lib/hunteragent-workspace-ops";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "Sign in to access HunterAgent.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    briefId: string;
    rawText: string;
    sender?: string;
    subject?: string;
    source?: "dashboard" | "webhook";
  } | null;

  if (!body || typeof body.briefId !== "string" || !body.briefId.trim() || typeof body.rawText !== "string" || !body.rawText.trim()
    || (body.source !== undefined && body.source !== "dashboard" && body.source !== "webhook")) {
    return NextResponse.json({ error: "briefId and rawText are required" }, { status: 400 });
  }

  const workspace = await updateWorkspaceState((state) => {
    applyInboundReplyToWorkspace(state, {
      briefId: body.briefId,
      rawText: body.rawText,
      sender: body.sender,
      subject: body.subject,
      source: body.source ?? "dashboard",
    });
    return state;
  }, user.id);

  return NextResponse.json(workspace);
}
