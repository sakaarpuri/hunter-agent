# HunterAgent

HunterAgent is an email-first job scout and application studio. It finds roles daily, sends a shortlist by email, prepares tailored application packs in the dashboard, and helps users track applied roles and follow-up timing.

## Local Development

Run the app locally:

```bash
cd "/Volumes/Extreme SSD/careeragent" && npm run dev
```

Open:
- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

## Core Environment Variables

HunterAgent currently expects these environment variables for the full product loop:

```env
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
TAVILY_API_KEY=
AGENTMAIL_API_KEY=
AGENTMAIL_INBOX_ID=
AGENTMAIL_WEBHOOK_SECRET=
APP_BASE_URL=
CRON_SECRET=
```

Notes:
- `APP_BASE_URL` should be your deployed base URL so outbound brief emails include a working dashboard link.
- `CRON_SECRET` protects the scheduled brief route in production. In local development, the route is open only when `NODE_ENV=development`.

## Production Scheduler

HunterAgent includes two ways to run daily brief scheduling:

- a protected manual trigger route at `/api/cron/daily-briefs`
- a Netlify Scheduled Function at `netlify/functions/daily-briefs.ts`

This project is now configured for Netlify deployment through [netlify.toml](/Volumes/Extreme SSD/careeragent/netlify.toml).

The scheduled function runs every 15 minutes:

- schedule: every 15 minutes
- function: `daily-briefs`

Why 15 minutes:
- users choose their own local brief time
- HunterAgent needs a repeated scheduler window to evaluate each user’s timezone and chosen send time
- a once-daily single global trigger is not enough for multi-timezone delivery

What the scheduler does on each run:
- skips users whose setup is incomplete
- skips users whose briefs are paused
- skips users who already received a brief that local day
- sends only for users whose configured local brief time falls inside the current 15-minute scheduler window

### Netlify notes

The deployed scheduler should use Netlify Scheduled Functions, not Vercel Cron Jobs.

Before deploying:
1. Set `APP_BASE_URL` to the deployed app URL.
2. Set `CRON_SECRET` in Netlify environment variables if you want to keep the manual `/api/cron/daily-briefs` route protected for manual runs.
3. Make sure AgentMail outbound email and webhook env vars are also set.
4. Deploy with the included `netlify.toml`.
5. Ensure Netlify functions are enabled for the site.

The `/api/cron/daily-briefs` route still exists for manual or authenticated server-to-server triggering, but Netlify Scheduled Functions should be the primary production scheduler.

## Current Launch Status

Already implemented:
- real auth with per-user workspaces
- inbound AgentMail webhook handling
- outbound brief sending
- Tavily-backed discovery with fallback
- role-aware studio with conditional work samples
- prompt memory and targeted pack editing
- Netlify scheduled function for daily briefs

Still to harden before broader launch:
- recruiter-grade PDF export hardening
- tighter unmatched AgentMail webhook fallback behavior

## Verification

Useful checks during development:

```bash
npm run lint
npm run build
```
