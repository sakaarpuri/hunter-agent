import { schedule, type Handler } from "@netlify/functions";
import { runDailyBriefs } from "../../lib/run-daily-briefs";

const scheduledHandler: Handler = async () => {
  try {
    const result = await runDailyBriefs();
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Scheduled brief failed.",
      }),
    };
  }
};

export const handler = schedule("*/15 * * * *", scheduledHandler);
