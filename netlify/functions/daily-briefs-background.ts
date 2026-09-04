import type { BackgroundHandler } from "@netlify/functions";
import { runDailyBriefs } from "../../lib/run-daily-briefs";

function authorized(header: string | undefined) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && header === `Bearer ${secret}`);
}

export const handler: BackgroundHandler = async (event) => {
  if (!authorized(event.headers.authorization)) {
    console.warn("daily-briefs-background: unauthorized invocation rejected");
    return;
  }

  const result = await runDailyBriefs(new Date(), { maxRuntimeMs: 13 * 60_000 });
  console.log("daily-briefs-background: completed", {
    processed: result.results.filter((item) => !item.status.startsWith("Skipped:") && !item.status.startsWith("Deferred:")).length,
    deferred: result.results.filter((item) => item.status.startsWith("Deferred:")).length,
    total: result.results.length,
  });
};
