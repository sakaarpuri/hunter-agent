import { schedule, type Handler } from "@netlify/functions";

const scheduledHandler: Handler = async () => {
  try {
    const baseUrl = (process.env.URL || process.env.APP_BASE_URL)?.replace(/\/$/, "");
    const secret = process.env.CRON_SECRET;
    if (!baseUrl || !secret) throw new Error("Missing background-dispatch configuration.");
    const response = await fetch(`${baseUrl}/.netlify/functions/daily-briefs-background`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { authorization: `Bearer ${secret}` },
    });
    if (response.status !== 202 && !response.ok) throw new Error(`Background dispatch failed with ${response.status}.`);
    return {
      statusCode: 200,
      body: JSON.stringify({ dispatched: true }),
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
