import { NextResponse } from "next/server";
import { AuthError, requireUser, updateCurrentUserName, updateCurrentUserPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as
      | { action: "update_name"; name?: string }
      | { action: "change_password"; currentPassword?: string; newPassword?: string };

    if (body.action === "update_name") {
      const nextUser = await updateCurrentUserName(user.id, body.name ?? "");
      return NextResponse.json({ user: nextUser });
    }

    if (body.action === "change_password") {
      await updateCurrentUserPassword(user.id, {
        currentPassword: body.currentPassword ?? "",
        newPassword: body.newPassword ?? "",
      });
      return NextResponse.json({ ok: true, signedOut: true });
    }

    return NextResponse.json({ error: "Unsupported settings action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "Could not update settings.";
    const status = error instanceof AuthError && error.message === "Sign in to access HunterAgent." ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
