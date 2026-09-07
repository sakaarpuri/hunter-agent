import { randomUUID } from "node:crypto";
import { insertProductEvent } from "@/lib/db";

export type ProductEventName =
  | "account_created"
  | "onboarding_completed"
  | "brief_prepared"
  | "brief_sent"
  | "role_opened"
  | "role_feedback"
  | "materials_generated"
  | "application_recorded";

export async function recordProductEvent(
  userId: string,
  eventName: ProductEventName,
  properties: Record<string, string | number | boolean | null> = {},
) {
  if (!userId) return;
  try {
    await insertProductEvent({ id: randomUUID(), userId, eventName, properties });
  } catch {
    // Analytics must never block a customer action.
  }
}

