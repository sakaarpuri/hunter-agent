import { Webhook } from "svix";

type AgentMailMessage = {
  inbox_id: string;
  thread_id: string;
  message_id: string;
  from: string;
  subject: string;
  preview?: string;
  text?: string;
  html?: string;
  extracted_text?: string;
};

type AgentMailThread = {
  thread_id: string;
  subject: string;
};

export type AgentMailWebhookEvent = {
  type: "event";
  event_type: string;
  event_id: string;
  message?: AgentMailMessage;
  thread?: AgentMailThread;
};

function requireHeader(headers: Headers, name: string) {
  const value = headers.get(name);
  if (!value) {
    throw new Error(`Missing ${name} header.`);
  }
  return value;
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function verifyAgentMailWebhook(rawBody: string, headers: Headers) {
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing AGENTMAIL_WEBHOOK_SECRET.");
  }

  const webhook = new Webhook(secret);
  const verified = webhook.verify(rawBody, {
    "svix-id": requireHeader(headers, "svix-id"),
    "svix-timestamp": requireHeader(headers, "svix-timestamp"),
    "svix-signature": requireHeader(headers, "svix-signature"),
  });

  return verified as AgentMailWebhookEvent;
}

export function getAgentMailReplyText(event: AgentMailWebhookEvent) {
  const message = event.message;
  if (!message) return "";

  return (
    message.extracted_text?.trim() ||
    message.text?.trim() ||
    (message.html ? stripHtml(message.html) : "") ||
    message.preview?.trim() ||
    ""
  );
}

export function isAgentMailMessageReceived(event: AgentMailWebhookEvent): event is AgentMailWebhookEvent & {
  event_type: "message.received";
  message: AgentMailMessage;
} {
  return event.type === "event" && event.event_type === "message.received" && Boolean(event.message);
}
