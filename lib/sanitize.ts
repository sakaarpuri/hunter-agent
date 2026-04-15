/**
 * Strip HTML tags and control characters from user-supplied text
 * to prevent XSS when content is later rendered.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""); // strip control chars (keep \t, \n, \r)
}

export function sanitizeProfile(profile: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => (typeof item === "string" ? sanitizeText(item) : item));
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
