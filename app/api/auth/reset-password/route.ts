import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPasswordResetTokenByHash, deletePasswordResetToken, updateUserPassword } from "@/lib/db";
import { validatePassword } from "@/lib/auth";
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

    const tokenHash = hashToken(token);
    const row = await getPasswordResetTokenByHash(tokenHash);

    if (!row) {
      return NextResponse.json({ error: "Reset link is invalid or has already been used." }, { status: 400 });
    }

    if (row.expires_at <= new Date().toISOString()) {
      await deletePasswordResetToken(tokenHash);
      return NextResponse.json({ error: "Reset link has expired. Request a new one." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await updateUserPassword(row.user_id, passwordHash, new Date().toISOString());
    await deletePasswordResetToken(tokenHash);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
