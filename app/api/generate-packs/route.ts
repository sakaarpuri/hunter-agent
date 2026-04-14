import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { updateWorkspaceState } from "@/lib/hunteragent-store";
import { generateSelectedPacksForWorkspace } from "@/lib/hunteragent-workspace-ops";
import { PackIntent, PackTarget } from "@/lib/hunteragent-types";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Module-level rate limiter (in-memory; resets on cold start)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    logger.warn("generate-packs: unauthorized");
    const message = error instanceof AuthError ? error.message : "Sign in to access HunterAgent.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  // Rate limiting
  const now = Date.now();
  const userTimestamps = (rateLimitMap.get(user.id) ?? []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );
  if (userTimestamps.length >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "Too many generation requests. Please wait a moment." },
      { status: 429 },
    );
  }
  rateLimitMap.set(user.id, [...userTimestamps, now]);

  try {
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

    logger.info("generate-packs: complete", { userId: user.id });
    return NextResponse.json(workspace);
  } catch (error) {
    logger.error("generate-packs: unhandled error", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
