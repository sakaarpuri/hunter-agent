import { createHash, timingSafeEqual } from "node:crypto";
import { checkDatabaseConnectivity } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "cache-control": "no-store, no-cache, max-age=0, must-revalidate",
  "content-type": "application/json; charset=utf-8",
  pragma: "no-cache",
  "x-content-type-options": "nosniff",
};

function json(status: number, body: { status: string }, authenticated = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: authenticated ? { ...RESPONSE_HEADERS, vary: "Authorization" } : RESPONSE_HEADERS,
  });
}

function isReadinessRequest(request: Request) {
  return new URL(request.url).searchParams.get("readiness") === "1";
}

function isReadinessAuthorized(request: Request) {
  const expected = process.env.HEALTH_CHECK_TOKEN?.trim();
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || !supplied) return false;

  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

function hasRequiredConfiguration() {
  const required = [
    "DATABASE_URL",
    "APP_BASE_URL",
    "TAVILY_API_KEY",
    "AGENTMAIL_API_KEY",
    "AGENTMAIL_INBOX_ID",
    "AGENTMAIL_WEBHOOK_SECRET",
    "CRON_SECRET",
  ] as const;
  if (!required.every((name) => process.env[name]?.trim())) return false;
  try {
    const appUrl = new URL(process.env.APP_BASE_URL!);
    return appUrl.protocol === "https:" && appUrl.pathname === "/" && !appUrl.search && !appUrl.hash;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!isReadinessRequest(request)) return json(200, { status: "live" });
  if (!isReadinessAuthorized(request)) return json(401, { status: "unauthorized" }, true);
  if (!hasRequiredConfiguration()) return json(503, { status: "not_ready" }, true);

  const databaseReady = await checkDatabaseConnectivity();
  return databaseReady
    ? json(200, { status: "ready" }, true)
    : json(503, { status: "not_ready" }, true);
}

export async function HEAD(request: Request) {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
