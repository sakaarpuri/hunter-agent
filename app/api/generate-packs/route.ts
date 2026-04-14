import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { updateWorkspaceState } from "@/lib/hunteragent-store";
import { generateSelectedPacksForWorkspace } from "@/lib/hunteragent-workspace-ops";
import { PackIntent, PackTarget } from "@/lib/hunteragent-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "Sign in to access HunterAgent.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const body = (await request.json()) as {
    briefId?: string;
    roleId?: number;
    regenerate?: boolean;
    target?: PackTarget;
    intent?: PackIntent;
    instruction?: string;
  };

  const workspace = await updateWorkspaceState((state) =>
    generateSelectedPacksForWorkspace(state, {
      briefId: body.briefId ?? state.activeBriefId ?? undefined,
      roleId: body.roleId,
      target: body.target,
      intent: body.intent,
      instruction: body.instruction,
    }), user.id,
  );

  return NextResponse.json(workspace);
}
