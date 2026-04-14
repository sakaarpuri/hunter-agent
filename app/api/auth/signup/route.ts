import { NextResponse } from "next/server";
import { attachSessionCookie, AuthError, createSession, createUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const user = await createUser({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
    });

    const response = NextResponse.json({ user });
    return attachSessionCookie(response, await createSession(user.id));
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "Could not create the account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
