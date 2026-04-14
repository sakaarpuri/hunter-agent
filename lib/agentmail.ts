import { formatClock } from "@/lib/hunteragent-data";
import { BriefRecord, Profile, Role } from "@/lib/hunteragent-types";

type AgentMailSendResponse = {
  message_id?: string;
  thread_id?: string;
  inbox_id?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAppBaseUrl() {
  return process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
}

function buildDashboardLine() {
  const appBaseUrl = getAppBaseUrl();
  return appBaseUrl ? `Open dashboard: ${appBaseUrl}/dashboard` : "";
}

function buildBriefSubject() {
  return "Your 10 matched roles for today";
}

function buildBriefText(brief: BriefRecord, profile: Profile, roles: Role[]) {
  const topRoles = roles.filter((role) => brief.topRoleIds.includes(role.id));
  const moreRoles = roles.filter((role) => brief.roleIds.includes(role.id) && !brief.topRoleIds.includes(role.id));
  const lines = [
    `Hi ${profile.name || "there"},`,
    "",
    "I found 10 roles that fit your profile today.",
    "",
    "Reply with the numbers or names you want me to prepare.",
    "Then check your dashboard in about 2 to 10 minutes, depending on how many roles you choose.",
    "",
    "Top picks",
    "",
  ];

  for (const role of topRoles) {
    lines.push(`${role.id}. ${role.title} — ${role.company}`);
    lines.push(`   ${role.location} / ${role.employment}`);
    lines.push(`   Why it fits: ${role.fit}`);
    lines.push("");
  }

  lines.push("More from today’s shortlist", "");
  for (const role of moreRoles) {
    lines.push(`${role.id}. ${role.title} — ${role.company}`);
  }

  lines.push(
    "",
    "Reply examples:",
    "1, 4",
    "BrightPath and Hollow Arc",
    "pause",
    "more remote",
  );

  const dashboardLine = buildDashboardLine();
  if (dashboardLine) {
    lines.push("", dashboardLine);
  }

  lines.push(
    "",
    "Email is for shortlist selection and alerts only.",
    "For review, edits, and tracking, continue in your dashboard.",
  );

  return lines.join("\n");
}

function buildBriefHtml(brief: BriefRecord, profile: Profile, roles: Role[]) {
  const topRoles = roles.filter((role) => brief.topRoleIds.includes(role.id));
  const moreRoles = roles.filter((role) => brief.roleIds.includes(role.id) && !brief.topRoleIds.includes(role.id));
  const appBaseUrl = getAppBaseUrl();

  const renderRole = (role: Role, compact = false) => {
    const title = `${role.id}. ${role.title} — ${role.company}`;
    if (compact) {
      return `<li style="margin:0 0 8px 0;">${escapeHtml(title)}</li>`;
    }
    return `
      <div style="padding:14px 16px;border:1px solid #d7d7d2;border-radius:18px;background:#fff;margin:0 0 12px 0;">
        <div style="font-weight:600;color:#172221;font-size:15px;">${escapeHtml(title)}</div>
        <div style="margin-top:6px;color:#4f5c59;font-size:13px;">${escapeHtml(`${role.location} / ${role.employment}`)}</div>
        <div style="margin-top:8px;color:#1f2d2b;font-size:13px;line-height:1.6;"><strong>Why it fits:</strong> ${escapeHtml(role.fit)}</div>
      </div>
    `;
  };

  return `
<!doctype html>
<html>
  <body style="margin:0;background:#f5f2ea;padding:24px;font-family:Inter,Arial,sans-serif;color:#172221;">
    <div style="max-width:680px;margin:0 auto;background:#fffdf8;border:1px solid #dfddd6;border-radius:28px;overflow:hidden;">
      <div style="padding:28px 28px 20px 28px;background:linear-gradient(135deg,#eef6f3 0%,#fffdf8 100%);border-bottom:1px solid #e6e2da;">
        <div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#5c6a67;">HunterAgent daily brief</div>
        <h1 style="margin:14px 0 0 0;font-size:30px;line-height:1.1;">Your 10 matched roles for today</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.7;color:#4f5c59;">
          Hi ${escapeHtml(profile.name || "there")}, I found 10 roles that fit your profile today. Reply with the numbers or names you want me to prepare, then check your dashboard in about 2 to 10 minutes depending on how many roles you choose.
        </p>
      </div>
      <div style="padding:24px 28px;">
        <h2 style="margin:0 0 14px 0;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#5c6a67;">Top picks</h2>
        ${topRoles.map((role) => renderRole(role)).join("")}

        <h2 style="margin:22px 0 14px 0;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#5c6a67;">More from today’s shortlist</h2>
        <ul style="padding-left:20px;margin:0;color:#1f2d2b;font-size:14px;line-height:1.7;">
          ${moreRoles.map((role) => renderRole(role, true)).join("")}
        </ul>

        <div style="margin-top:24px;padding:16px 18px;border-radius:18px;background:#f3faf7;border:1px solid #d8ede5;">
          <div style="font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.14em;color:#1e6f60;">Reply examples</div>
          <div style="margin-top:10px;font-size:14px;line-height:1.8;color:#1f2d2b;">1, 4<br/>BrightPath and Hollow Arc<br/>pause<br/>more remote</div>
        </div>

        ${
          appBaseUrl
            ? `<div style="margin-top:20px;"><a href="${escapeHtml(`${appBaseUrl}/dashboard`)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#1d7a67;color:#ffffff;text-decoration:none;font-weight:600;">Open dashboard</a></div>`
            : ""
        }

        <p style="margin:20px 0 0 0;font-size:12px;line-height:1.7;color:#73817d;">
          Email is for shortlist selection and alerts only. For review, edits, and tracking, continue in your dashboard.
        </p>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

export async function sendDailyBriefEmail(brief: BriefRecord, profile: Profile, roles: Role[]) {
  const apiKey = requireEnv("AGENTMAIL_API_KEY");
  const inboxId = requireEnv("AGENTMAIL_INBOX_ID");

  if (!profile.recipientEmail.trim()) {
    throw new Error("Recipient email is required before HunterAgent can send the daily brief.");
  }

  const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      to: profile.recipientEmail.trim(),
      subject: buildBriefSubject(),
      text: buildBriefText(brief, profile, roles),
      html: buildBriefHtml(brief, profile, roles),
      labels: ["hunteragent", "daily-brief", `brief:${brief.id}`],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`AgentMail send failed: ${response.status} ${message}`);
  }

  const payload = (await response.json()) as AgentMailSendResponse;

  return {
    inboxId: payload.inbox_id ?? inboxId,
    messageId: payload.message_id ?? null,
    threadId: payload.thread_id ?? null,
    sentAt: new Date().toISOString(),
  };
}

export function buildScheduledBriefStatus(brief: BriefRecord, profile: Profile) {
  if (profile.briefsPaused) {
    return "Daily briefs are paused. Resume them in settings when you want HunterAgent to send again.";
  }
  const when = brief.scheduledFor ?? brief.createdAt;
  return `First brief is queued for ${formatClock(when)} to ${profile.recipientEmail || "your chosen inbox"}.`;
}
