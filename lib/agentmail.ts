import { formatClock } from "@/lib/hunteragent-data";
import { jobsPerBrief, roleIsCurrent } from "@/lib/hunteragent-discovery";
import { BriefRecord, Profile, Role } from "@/lib/hunteragent-types";

type AgentMailSendResponse = {
  message_id?: string;
  thread_id?: string;
  inbox_id?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
}

export function getOrderedBriefRoles(brief: BriefRecord, roles: Role[], profile: Profile, now = new Date()) {
  const used = new Set<number>();
  // Never renumber surviving roles after expiry: numeric replies use this snapshot.
  return (brief.replyRoleIds ?? brief.roleIds).map((id, index) => {
    const role = roles.find((item) => item.id === id);
    if (!role || used.has(id) || !brief.roleIds.includes(id) || !roleIsCurrent(role, now)) return null;
    used.add(id);
    return { role, position: index + 1 };
  }).filter((item): item is { role: Role; position: number } => item !== null).slice(0, jobsPerBrief(profile));
}

export function buildBriefEmail(brief: BriefRecord, profile: Profile, roles: Role[], now = new Date()) {
  const ordered = getOrderedBriefRoles(brief, roles, profile, now);
  const count = ordered.length;
  const noun = count === 1 ? "role" : "roles";
  const subject = `Your ${count} matched ${noun} for today`;
  const intro = `Your shortlist has ${count} new ${noun} to review.`;
  const examples = ordered.slice(0, 2).map(({ position }) => position).join(", ");
  const companies = [...new Set(ordered.slice(0, 2).map(({ role }) => role.company))].join(" and ");
  const base = getAppBaseUrl();
  const lines = [
    `Hi ${profile.name || "there"},`, "", intro, "",
    "Reply with the numbers or names you want me to prepare.",
    "Then check your dashboard for your application materials.", "",
  ];
  for (const { role, position } of ordered) {
    const range = role.explorationKind === "adjacent" ? "A little stretch" : "Close match";
    const availability = role.sourceVerificationStatus === "verified" ? "Listing checked today" : "Check current availability";
    lines.push(`${position}. ${role.title} - ${role.company}`, `   ${role.location} / ${role.employment}`,
      `   ${range} / ${availability}`, `   Why it may be worth a look: ${role.fit}`, `   ${role.posted}`, `   Job listing: ${role.sourceUrl}`, "");
  }
  lines.push("Reply examples:", examples, companies, "pause", "more remote");
  if (base) lines.push("", `Open dashboard: ${base}/dashboard`);
  lines.push("", "Email is for shortlist selection and alerts only.", "For review, edits, and tracking, continue in your dashboard.");
  const cards = ordered.map(({ role, position }) => `
    <div style="padding:14px 16px;border:1px solid #d7d7d2;border-radius:18px;background:#fff;margin:0 0 12px 0;">
      <div style="font-weight:600;color:#172221;font-size:15px;">${escapeHtml(`${position}. ${role.title} - ${role.company}`)}</div>
      <div style="margin-top:6px;color:#4f5c59;font-size:13px;">${escapeHtml(`${role.location} / ${role.employment}`)}</div>
      <div style="margin-top:8px;color:#58716b;font-size:12px;font-weight:600;">${escapeHtml(role.explorationKind === "adjacent" ? "A little stretch" : "Close match")} &middot; ${escapeHtml(role.sourceVerificationStatus === "verified" ? "Listing checked today" : "Check current availability")}</div>
      <div style="margin-top:8px;color:#1f2d2b;font-size:13px;line-height:1.6;"><strong>Why it may be worth a look:</strong> ${escapeHtml(role.fit)}</div>
      <div style="margin-top:8px;font-size:12px;">${escapeHtml(role.posted)} &middot; <a href="${escapeHtml(role.sourceUrl!)}">View job listing</a></div>
    </div>`).join("");
  const html = `<!doctype html>
<html><body style="margin:0;background:#f5f2ea;padding:24px;font-family:Georgia,serif;color:#172221;">
  <div style="max-width:680px;margin:0 auto;background:#fffdf8;border:1px solid #dfddd6;border-radius:28px;overflow:hidden;">
    <div style="padding:28px;background:linear-gradient(135deg,#eef6f3 0%,#fffdf8 100%);border-bottom:1px solid #e6e2da;">
      <div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#5c6a67;">HunterAgent daily brief</div>
      <h1 style="margin:14px 0 0;font-size:30px;line-height:1.1;">${escapeHtml(subject)}</h1>
      <p style="font-size:15px;line-height:1.7;color:#4f5c59;">Hi ${escapeHtml(profile.name || "there")}, ${escapeHtml(intro)} Reply with the numbers or names you want me to prepare, then check your dashboard for your application materials.</p>
    </div>
    <div style="padding:24px 28px;">
      ${cards}
      <div style="margin-top:24px;padding:16px 18px;border-radius:18px;background:#f3faf7;border:1px solid #d8ede5;">
        <strong>Reply examples</strong><div style="margin-top:10px;font-size:14px;line-height:1.8;">${escapeHtml(examples)}<br/>${escapeHtml(companies)}<br/>pause<br/>more remote</div>
      </div>
      ${base ? `<p><a href="${escapeHtml(`${base}/dashboard`)}">Open dashboard</a></p>` : ""}
      <p style="font-size:12px;line-height:1.7;color:#73817d;">Email is for shortlist selection and alerts only. For review, edits, and tracking, continue in your dashboard.</p>
    </div>
  </div>
</body></html>`;
  return { subject, text: lines.join("\n"), html, count };
}

export async function sendDailyBriefEmail(brief: BriefRecord, profile: Profile, roles: Role[], now = new Date()) {
  if (profile.briefsPaused) throw new Error("Daily briefs are paused.");
  const email = buildBriefEmail(brief, profile, roles, now);
  if (!email.count) throw new Error("No current matches remain. An empty brief will not be emailed.");
  if (!profile.recipientEmail.trim()) throw new Error("Recipient email is required before HunterAgent can send the daily brief.");
  const apiKey = requireEnv("AGENTMAIL_API_KEY");
  const inboxId = requireEnv("AGENTMAIL_INBOX_ID");
  const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ to: profile.recipientEmail.trim(), subject: email.subject, text: email.text, html: email.html,
      labels: ["hunteragent", "daily-brief", `brief:${brief.id}`] }),
  });
  if (!response.ok) throw new Error(`AgentMail send failed: ${response.status} ${await response.text()}`);
  const payload = await response.json() as AgentMailSendResponse;
  return { inboxId: payload.inbox_id ?? inboxId, messageId: payload.message_id ?? null,
    threadId: payload.thread_id ?? null, sentAt: now.toISOString() };
}

export async function sendPasswordResetEmail(toEmail: string, resetLink: string) {
  const apiKey = requireEnv("AGENTMAIL_API_KEY");
  const inboxId = requireEnv("AGENTMAIL_INBOX_ID");

  const text = [
    "Hi,",
    "",
    "We received a request to reset your HunterAgent password.",
    "",
    "Click the link below to set a new password. It expires in 1 hour.",
    "",
    resetLink,
    "",
    "If you didn't request this, you can safely ignore this email. Your password won't change.",
  ].join("\n");

  const html = `
<!doctype html>
<html>
  <body style="margin:0;background:#f5f2ea;padding:24px;font-family:Inter,Arial,sans-serif;color:#172221;">
    <div style="max-width:540px;margin:0 auto;background:#fffdf8;border:1px solid #dfddd6;border-radius:28px;overflow:hidden;">
      <div style="padding:28px 28px 20px 28px;background:linear-gradient(135deg,#eef6f3 0%,#fffdf8 100%);border-bottom:1px solid #e6e2da;">
        <div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#5c6a67;">HunterAgent</div>
        <h1 style="margin:14px 0 0 0;font-size:26px;line-height:1.2;">Reset your password</h1>
      </div>
      <div style="padding:24px 28px;">
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#4f5c59;">
          We received a request to reset your HunterAgent password. Click the button below to set a new one. The link expires in <strong>1 hour</strong>.
        </p>
        <a href="${escapeHtml(resetLink)}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#1d7a67;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">Reset password</a>
        <p style="margin:24px 0 0 0;font-size:13px;line-height:1.7;color:#73817d;">
          If you didn't request this, you can safely ignore this email. Your password won't change.
        </p>
      </div>
    </div>
  </body>
</html>
  `.trim();

  const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      to: toEmail,
      subject: "Reset your HunterAgent password",
      text,
      html,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`AgentMail send failed: ${response.status} ${message}`);
  }
}

export function buildScheduledBriefStatus(brief: BriefRecord, profile: Profile) {
  if (profile.briefsPaused) {
    return "Daily briefs are paused. Resume them in settings when you want HunterAgent to send again.";
  }
  const when = brief.scheduledFor ?? brief.createdAt;
  return `First brief is queued for ${formatClock(when)} to ${profile.recipientEmail || "your chosen inbox"}.`;
}
