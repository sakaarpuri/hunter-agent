import { NextResponse } from "next/server";
import { getAgentMailReplyText, isAgentMailMessageReceived, verifyAgentMailWebhook } from "@/lib/agentmail-webhook";
import { listStoredWorkspaces, updateWorkspaceState } from "@/lib/hunteragent-store";
import { type AppliedInboundReply, applyInboundReplyToWorkspace, generateSelectedPacksForWorkspace } from "@/lib/hunteragent-workspace-ops";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

type WorkspaceResolution = {
  userId: string | null;
  reason: "thread" | "message" | "sender_inbox" | "no_match" | "ambiguous";
};

async function resolveWorkspaceUserId(metadata: { threadId?: string; messageId?: string; inboxId?: string; sender?: string }): Promise<WorkspaceResolution> {
  const workspaces = await listStoredWorkspaces();

  const matchByPredicate = (
    reason: WorkspaceResolution["reason"],
    predicate: (workspace: (typeof workspaces)[number]) => boolean,
  ): WorkspaceResolution | null => {
    const matches = workspaces.filter(predicate);
    if (matches.length === 1) {
      return { userId: matches[0].userId, reason };
    }
    if (matches.length > 1) {
      return { userId: null, reason: "ambiguous" };
    }
    return null;
  };

  if (metadata.threadId) {
    const byThread = matchByPredicate("thread", ({ state }) =>
      state.briefs.some((brief) => brief.outboundThreadId === metadata.threadId),
    );
    if (byThread) return byThread;
  }

  if (metadata.messageId) {
    const byMessage = matchByPredicate("message", ({ state }) =>
      state.briefs.some((brief) => brief.outboundMessageId === metadata.messageId),
    );
    if (byMessage) return byMessage;
  }

  // This is the only heuristic fallback we allow: same sending inbox and same recipient
  // email that HunterAgent previously delivered to. If multiple users fit, we reject it.
  if (metadata.inboxId && metadata.sender) {
    const normalizedSender = metadata.sender.trim().toLowerCase();
    const bySenderAndInbox = matchByPredicate("sender_inbox", ({ state }) =>
      state.briefs.some(
        (brief) =>
          brief.outboundInboxId === metadata.inboxId &&
          Boolean(brief.sentAt) &&
          brief.recipientEmail?.trim().toLowerCase() === normalizedSender,
      ),
    );
    if (bySenderAndInbox) return bySenderAndInbox;
  }

  return { userId: null, reason: "no_match" };
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;
  try {
    event = verifyAgentMailWebhook(rawBody, request.headers);
  } catch (error) {
    logger.warn("webhook: signature verification failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Invalid AgentMail webhook.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!isAgentMailMessageReceived(event)) {
    logger.debug("webhook: ignored non-message event", { eventType: event.event_type });
    return NextResponse.json({ ok: true, ignored: true, eventType: event.event_type });
  }

  const rawText = getAgentMailReplyText(event);
  if (!rawText) {
    logger.debug("webhook: empty body, ignored", { eventType: event.event_type });
    return NextResponse.json({ ok: true, ignored: true, eventType: event.event_type, reason: "empty_body" });
  }

  const resolution = await resolveWorkspaceUserId({
    threadId: event.message.thread_id,
    messageId: event.message.message_id,
    inboxId: event.message.inbox_id,
    sender: event.message.from,
  });

  if (!resolution.userId) {
    logger.warn("webhook: could not resolve workspace", { reason: resolution.reason, sender: event.message.from });
    return NextResponse.json(
      {
        ok: true,
        ignored: true,
        eventType: event.event_type,
        reason: resolution.reason === "ambiguous" ? "ambiguous_workspace_match" : "no_workspace_match",
      },
      { status: 202 },
    );
  }

  let appliedReply: AppliedInboundReply | null = null;

  const workspace = await withRetry(() =>
    updateWorkspaceState(async (state) => {
      appliedReply = applyInboundReplyToWorkspace(state, {
        rawText,
        sender: event.message.from,
        subject: event.message.subject,
        source: "webhook",
        svixId: request.headers.get("svix-id") ?? undefined,
        eventId: event.event_id,
        inboxId: event.message.inbox_id,
        threadId: event.message.thread_id,
        messageId: event.message.message_id,
      });

      if (!appliedReply?.briefId || appliedReply.duplicate || appliedReply.selectedRoleIds.length === 0) {
        return state;
      }

      return generateSelectedPacksForWorkspace(state, {
        briefId: appliedReply.briefId,
      });
    }, resolution.userId ?? undefined)
  );

  const replyMeta = appliedReply ?? {
    briefId: null,
    selectedRoleIds: [],
    duplicate: false,
  };

  logger.info("webhook: processed", {
    userId: resolution.userId,
    resolvedBy: resolution.reason,
    briefId: replyMeta.briefId,
    selectedRoleIds: replyMeta.selectedRoleIds,
    duplicate: replyMeta.duplicate,
  });

  return NextResponse.json({
    ok: true,
    eventType: event.event_type,
    resolvedBy: resolution.reason,
    briefId: replyMeta.briefId ?? workspace.activeBriefId,
    selectedRoleIds: replyMeta.selectedRoleIds,
    duplicate: replyMeta.duplicate,
  });
}
