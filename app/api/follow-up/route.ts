import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { buildDueDate, formatAppliedDate, getRoleFromCatalog } from "@/lib/hunteragent-data";
import { generateFollowUpDraft } from "@/lib/hunteragent-anthropic";
import { updateWorkspaceState } from "@/lib/hunteragent-store";
import { FollowUpPlan } from "@/lib/hunteragent-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "Sign in to access HunterAgent.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { roleId: number; plan: FollowUpPlan } | null;
  if (!body || !Number.isSafeInteger(body.roleId) || body.roleId <= 0 || !["off", "7", "14"].includes(body.plan)) {
    return NextResponse.json({ error: "A valid role and follow-up plan are required." }, { status: 400 });
  }

  const workspace = await updateWorkspaceState(async (state) => {
    const applied = state.appliedRecords.find((item) => item.roleId === body.roleId);
    if (!applied) {
      state.lastError = "Apply to the role first before setting up a follow-up reminder.";
      return state;
    }

    applied.followUp = body.plan;

    if (body.plan === "off") {
      applied.followUpDueAt = null;
      applied.followUpDraft = null;
      return state;
    }

    const role = getRoleFromCatalog(body.roleId, state.roleCatalog);
    if (!role) return state;

    const followUpDays = body.plan === "7" ? 7 : 14;
    applied.followUpDueAt = buildDueDate(applied.appliedAt, followUpDays);
    const generated = await generateFollowUpDraft(role, state.profile, formatAppliedDate(applied.appliedAt), user.id);
    applied.followUpDraft = generated.draft;
    applied.provider = generated.provider;
    state.lastError = null;
    return state;
  }, user.id);

  return NextResponse.json(workspace);
}
