# HunterAgent Launch Checklist

Use this list for the first Netlify production release. Keep all secrets in Netlify or the local `.env.local` file, never in Git.

## 1. Product Decisions

- Confirm the public support and privacy email.
- Confirm the legal operator name/address and governing-law wording with appropriate legal advice.
- Decide whether launch is free-only or includes paid access. Billing is not implemented; the current Terms correctly say users will not be charged.
- If charging at launch, select a payment provider, implement checkout/subscription management/webhooks, and test cancellation and failed-payment handling before changing the Terms or publishing a price as purchasable.

## 2. Supabase Database

- Copy the Supabase transaction-pooler connection string into `DATABASE_URL` in Netlify.
- Run the versioned schema migrations against production:

```bash
DATABASE_URL="your-transaction-pooler-url" npm run db:migrate
```

- Run `npm run db:migrate` again and confirm it reports no pending migrations.
- Keep direct browser access disabled. The schema enables row-level security without public policies; the app accesses Postgres from server code only.

## 3. Netlify Variables

Set every required value from `.env.example` for the Production context:

- `DATABASE_URL`
- `APP_BASE_URL` using the final HTTPS origin with no path
- `TAVILY_API_KEY` and the selected discovery limits
- `ANTHROPIC_API_KEY`, task-model values, `AI_ENABLED`, and budget limits
- `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`, and `AGENTMAIL_WEBHOOK_SECRET`
- a long random `CRON_SECRET`
- a separate long random `HEALTH_CHECK_TOKEN`
- `NEXT_PUBLIC_SUPPORT_EMAIL`

Trigger a fresh production deploy after changing any public `NEXT_PUBLIC_*` value.

## 4. AgentMail

- Set the webhook endpoint to `https://YOUR-DOMAIN/api/agentmail/webhook`.
- Subscribe to `message.received`.
- Use the same signing secret in AgentMail and `AGENTMAIL_WEBHOOK_SECRET`.
- Confirm the configured inbox matches `AGENTMAIL_INBOX_ID`.

## 5. Pre-Deploy Verification

```bash
npm run lint
npx tsc --noEmit
node scripts/check-migrations.mjs
node scripts/check-auth-security.mjs
node scripts/check-health.mjs
node scripts/check-scheduler.mjs
node scripts/check-retention.mjs
node scripts/check-discovery.mjs
node scripts/check-ai.mjs
node scripts/check-ai-storage.mjs
node scripts/check-cv-parse.mjs
node scripts/check-match-filters.mjs
node scripts/check-workspace-logic.mjs
node scripts/check-film.mjs
npm run build
```

With the development server running on port 3100, also run:

```bash
TEST_BASE_URL=http://localhost:3100 node scripts/check-experience.mjs
```

## 6. Production Smoke Test

- `/` returns 200 over HTTPS and the hero film autoplays muted where the browser permits it.
- `/privacy` and `/terms` return 200 and show the real support contact.
- `/design-preview` returns 404 in production.
- `/api/health` returns 200 with only `{"status":"live"}`.
- `/api/health?readiness=1` returns 401 without a token and 200 with `Authorization: Bearer HEALTH_CHECK_TOKEN` when the database is reachable.
- Protected workspace routes return 401 when signed out.
- The cron and background endpoints reject an incorrect secret.
- Netlify shows both the scheduled dispatcher and background worker, with no timeout or authentication errors.

## 7. One Real-Account Journey

- Create a new account and finish onboarding with a real delivery email and chosen region.
- Confirm the first discovery returns no more than three genuine, non-expired roles and does not fabricate filler.
- Confirm the email arrives and links to the deployed HTTPS dashboard.
- Reply with a role number and confirm AgentMail opens the correct role for the same account.
- Generate, edit, preview, and export a CV; verify the PDF has no repeated content or clipped continuation page.
- Pause briefs, change the delivery settings, sign out/in, and confirm the changes persist.
- Delete the test account and confirm it can no longer sign in.

## 8. First-Day Monitoring

- Watch Netlify function failures and duration for the scheduled and background functions.
- Check readiness privately after deploy and after any database credential change.
- Check Supabase connection usage and storage growth.
- Check Tavily and Anthropic spend against the configured daily caps.
- Check AgentMail delivery failures and webhook signature errors without logging message content or CV data.
