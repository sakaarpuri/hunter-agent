import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { readWorkspaceState } from "@/lib/hunteragent-store";
import { recordProductEvent } from "@/lib/product-analytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthError ? error.message : "Sign in required." }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { event?: unknown; roleId?: unknown } | null;
  if (body?.event !== "role_opened" || !Number.isSafeInteger(body.roleId) || Number(body.roleId) <= 0) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  }
  const role = (await readWorkspaceState(user.id)).roleCatalog.find((item) => item.id === body.roleId);
  if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
  await recordProductEvent(user.id, "role_opened", {
    roleId: role.id,
    explorationKind: role.explorationKind ?? "close",
    sourceKind: role.sourceKind ?? "aggregator",
  });
  return NextResponse.json({ ok: true });
}
