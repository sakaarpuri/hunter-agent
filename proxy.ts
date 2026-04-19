import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CSRF_PROTECTED_PATHS = [
  "/api/auth/",
  "/api/workspace",
  "/api/generate-packs",
  "/api/inbound-email",
  "/api/parse-cv",
  "/api/follow-up",
];

export function proxy(request: NextRequest) {
  if (request.method !== "POST" && request.method !== "PUT" && request.method !== "DELETE") {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const isProtected = CSRF_PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Webhook route is authenticated by signature, not by browser CSRF.
  if (pathname.startsWith("/api/agentmail/webhook") || pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  const requestedWith = request.headers.get("x-requested-with");
  if (requestedWith !== "XMLHttpRequest") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
