import { NextResponse } from "next/server";
import { attachSessionCookie, AuthError, createSession, createUser } from "@/lib/auth";
import { allowAuthAttempt, clientAddress } from "@/lib/auth-rate-limit";
import { recordProductEvent } from "@/lib/product-analytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const ip = clientAddress(request);
    const allowed = await allowAuthAttempt("signup", ip, 5, 60 * 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many account attempts. Try again later." },
        { status: 429, headers: { "retry-after": "3600" } },
      );
    }
    const user = await createUser({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
    });
    await recordProductEvent(user.id, "account_created");

    const response = NextResponse.json({ user });
    return attachSessionCookie(response, await createSession(user.id, ip));
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "Could not create the account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
