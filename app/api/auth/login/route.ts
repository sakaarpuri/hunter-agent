import { NextResponse } from "next/server";
import { attachSessionCookie, authenticateUser, AuthError, createSession } from "@/lib/auth";
import { allowAuthAttempt, clientAddress } from "@/lib/auth-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const allowed = await allowAuthAttempt("login", body.email ?? "", 10, 15 * 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again in 15 minutes." },
        { status: 429, headers: { "retry-after": "900" } },
      );
    }
    const user = await authenticateUser({
      email: body.email ?? "",
      password: body.password ?? "",
    });

    const ip = clientAddress(request);
    const response = NextResponse.json({ user });
    return attachSessionCookie(response, await createSession(user.id, ip));
  } catch (error) {
    const message = error instanceof AuthError ? "Email or password didn't match." : "Could not sign in.";
    return NextResponse.json({ error: message }, { status: error instanceof AuthError ? 400 : 500 });
  }
}
