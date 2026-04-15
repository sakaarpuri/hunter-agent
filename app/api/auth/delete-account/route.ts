import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { AuthError, clearSessionCookie, requireUser } from "@/lib/auth";
import { deleteUser, getUserById } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Sign in to access HunterAgent." }, { status: 401 });
  }

  const body = (await request.json()) as { password?: string };
  if (!body.password) {
    return NextResponse.json({ error: "Password is required to delete your account." }, { status: 400 });
  }

  const dbUser = await getUserById(user.id);
  if (!dbUser) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const matches = await bcrypt.compare(body.password, dbUser.password_hash);
  if (!matches) {
    return NextResponse.json({ error: "Password didn't match." }, { status: 403 });
  }

  await deleteUser(user.id);

  const response = NextResponse.json({ ok: true });
  return clearSessionCookie(response);
}
