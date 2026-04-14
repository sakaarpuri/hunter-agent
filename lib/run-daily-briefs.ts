import { prepareFreshBrief, sendPreparedBrief } from "@/lib/hunteragent-briefs";
import { hasSentBriefOnLocalDay, shouldRunBriefNow, CRON_CADENCE_MINUTES } from "@/lib/hunteragent-scheduling";
import { listStoredWorkspaces, updateWorkspaceState } from "@/lib/hunteragent-store";

export type DailyBriefRunResult = {
  userId: string;
  status: string;
};

export async function runDailyBriefs(now: Date = new Date()) {
  const workspaces = await listStoredWorkspaces();
  const results: DailyBriefRunResult[] = [];

  for (const { userId } of workspaces) {
    const workspace = await updateWorkspaceState(async (state) => {
      if (!state.onboardingComplete || !state.profile.recipientEmail.trim()) {
        state.generationStatus = "Skipped scheduled brief because setup is incomplete.";
        return state;
      }

      if (state.profile.briefsPaused) {
        state.generationStatus = "Skipped scheduled brief because daily briefs are paused.";
        return state;
      }

      if (hasSentBriefOnLocalDay(state, now)) {
        state.generationStatus = "Skipped scheduled brief because one was already sent today in the user’s local timezone.";
        return state;
      }

      if (!shouldRunBriefNow(state.profile, now)) {
        state.generationStatus = `Skipped scheduled brief because ${state.profile.briefTime} ${state.profile.timezone} is not due in this scheduler window yet.`;
        return state;
      }

      await prepareFreshBrief(state);
      return sendPreparedBrief(state);
    }, userId);

    results.push({ userId, status: workspace.generationStatus ?? "Processed" });
  }

  return {
    ok: true,
    cadenceMinutes: CRON_CADENCE_MINUTES,
    results,
  };
}
