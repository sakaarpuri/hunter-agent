import { prepareFreshBrief, sendPreparedBrief } from "@/lib/hunteragent-briefs";
import { hasSentBriefOnLocalDay, shouldRunBriefNow, CRON_CADENCE_MINUTES } from "@/lib/hunteragent-scheduling";
import { listStoredWorkspaces, updateWorkspaceState } from "@/lib/hunteragent-store";
import { pruneDiscoveryStorage } from "@/lib/db";
import type { WorkspaceState } from "@/lib/hunteragent-types";

export type DailyBriefRunResult = {
  userId: string;
  status: string;
};

function skipReason(state: WorkspaceState, now: Date) {
  if (!state.onboardingComplete || !state.profile.recipientEmail.trim()) return "Skipped: setup is incomplete.";
  if (state.profile.briefsPaused) return "Skipped: daily briefs are paused.";
  if (hasSentBriefOnLocalDay(state, now)) return "Skipped: a brief was already sent today in the user's local timezone.";
  if (!shouldRunBriefNow(state.profile, now)) return `Skipped: ${state.profile.briefTime} ${state.profile.timezone} is not due in this scheduler window.`;
  return null;
}

export async function runDailyBriefs(
  now: Date = new Date(),
  options: { maxRuntimeMs?: number } = {},
) {
  const startedAt = Date.now();
  const maxRuntimeMs = Math.max(60_000, Math.min(options.maxRuntimeMs ?? 13 * 60_000, 14 * 60_000));
  try { await pruneDiscoveryStorage(); } catch { /* discovery itself fails closed if the DB is unavailable */ }
  const workspaces = await listStoredWorkspaces();
  const results: DailyBriefRunResult[] = [];

  for (const { userId, state: snapshot } of workspaces) {
    if (Date.now() - startedAt > maxRuntimeMs - 60_000) {
      results.push({ userId, status: "Deferred: the background run is nearing its time limit." });
      continue;
    }
    const skipped = skipReason(snapshot, now);
    if (skipped) {
      results.push({ userId, status: skipped });
      continue;
    }
    let changedBeforeUpdate: string | null = null;
    const workspace = await updateWorkspaceState(async (state) => {
      // Only due snapshots take the write path; recheck a newer state before
      // doing any search/send, without replacing the user's workspace message.
      changedBeforeUpdate = skipReason(state, now);
      if (changedBeforeUpdate) return state;

      const prepared = await prepareFreshBrief(state, { userId, now });
      if (!prepared.brief) return state;
      return sendPreparedBrief(state, prepared.brief.id, now);
    }, userId);

    results.push({ userId, status: changedBeforeUpdate ?? workspace.generationStatus ?? "Processed" });
  }

  return {
    ok: true,
    cadenceMinutes: CRON_CADENCE_MINUTES,
    results,
  };
}
