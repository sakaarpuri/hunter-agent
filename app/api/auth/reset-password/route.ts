import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resetUserPasswordWithToken } from "@/lib/db";
import { validatePassword } from "@/lib/auth";
import { allowAuthAttempt, clientAddress } from "@/lib/auth-rate-limit";
import bcrypt from "bcryptjs";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const { token, password } = (await request.json()) as { token?: string; password?: string };

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Reset link is invalid." }, { status: 400 });
    }

    if (!password || !validatePassword(password)) {
      return NextResponse.json(
        { error: "Use at least 6 characters and include at least one number or symbol." },
        { status: 400 },
      );
    }

    const allowed = await allowAuthAttempt("password-reset", clientAddress(request), 10, 15 * 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many reset attempts. Try again in 15 minutes." },
        { status: 429, headers: { "retry-after": "900" } },
      );
    }

    const tokenHash = hashToken(token);
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const reset = await resetUserPasswordWithToken(tokenHash, passwordHash, now, now);
    if (!reset) {
      return NextResponse.json({ error: "Reset link is invalid or has expired." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
