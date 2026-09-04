import { createHash } from "node:crypto";
import { consumeAuthRateLimit } from "@/lib/db";

export function clientAddress(request: Request) {
  return request.headers.get("x-nf-client-connection-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

export async function allowAuthAttempt(
  scope: "login" | "signup" | "password-reset-request" | "password-reset",
  identity: string,
  maxHits: number,
  windowSeconds: number,
) {
  const normalized = identity.trim().toLowerCase().slice(0, 320) || "unknown";
  const keyHash = createHash("sha256").update(`${scope}:${normalized}`).digest("hex");
  return consumeAuthRateLimit(keyHash, maxHits, windowSeconds);
}
