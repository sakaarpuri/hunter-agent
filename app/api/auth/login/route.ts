import { NextResponse } from "next/server";
import { attachSessionCookie, authenticateUser, AuthError, createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const user = await authenticateUser({
      email: body.email ?? "",
      password: body.password ?? "",
    });

    const response = NextResponse.json({ user });
    return attachSessionCookie(response, createSession(user.id));
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "Could not sign in.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
