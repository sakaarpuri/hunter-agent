import { randomBytes, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, insertPasswordResetToken } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/agentmail";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
}

export async function POST(request: NextRequest) {
  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const user = await getUserByEmail(normalized);

    // Always return success to avoid leaking which emails are registered
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    await insertPasswordResetToken({
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    });

    const resetLink = `${getAppBaseUrl()}/reset-password?token=${token}`;
    await sendPasswordResetEmail(normalized, resetLink);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
