# HunterAgent

HunterAgent is an email-first job scout and application studio. It searches daily, sends up to three standout new matches by email, prepares application materials on request, and keeps application history separate from short-lived suggestions.

## Local Development

Run the app locally:

```bash
npm install
npm run dev
```

Open:
- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

## Core Environment Variables

HunterAgent currently expects these environment variables for the full product loop:

```env
DATABASE_URL=
APP_BASE_URL=

ANTHROPIC_API_KEY=
ANTHROPIC_MATERIALS_MODEL=claude-sonnet-5
ANTHROPIC_INTENT_MODEL=claude-sonnet-5
ANTHROPIC_MATCH_MODEL=claude-haiku-4-5-20251001
ANTHROPIC_FOLLOW_UP_MODEL=claude-haiku-4-5-20251001
ANTHROPIC_CV_MODEL=claude-haiku-4-5-20251001
TAVILY_API_KEY=
AGENTMAIL_API_KEY=
AGENTMAIL_INBOX_ID=
AGENTMAIL_WEBHOOK_SECRET=
CRON_SECRET=
HEALTH_CHECK_TOKEN=
NEXT_PUBLIC_SUPPORT_EMAIL=
```

Notes:
- Copy `.env.example` to `.env.local` for local development and keep secrets out of Git.
- `DATABASE_URL` should use the Supabase transaction-pooler connection string for the production database.
- `APP_BASE_URL` should be your deployed base URL so outbound brief emails include a working dashboard link.
- `CRON_SECRET` protects the background brief worker and the manual scheduler route.
- `HEALTH_CHECK_TOKEN` protects database-readiness checks; public liveness does not expose provider status.
- `NEXT_PUBLIC_SUPPORT_EMAIL` is shown on the Privacy and Terms pages.
- The complete documented set, including budget controls, is in `.env.example`.

## Production Scheduler

HunterAgent includes two ways to trigger daily brief scheduling:

- a protected manual trigger route at `/api/cron/daily-briefs`
- a Netlify Scheduled Function at `netlify/functions/daily-briefs.ts`, which dispatches the long-running work to `daily-briefs-background`

This project is configured for Netlify deployment through [`netlify.toml`](netlify.toml).

The scheduled function runs every 15 minutes:

- schedule: every 15 minutes
- function: `daily-briefs`

Why 15 minutes:
- users choose their own local brief time
- HunterAgent needs a repeated scheduler window to evaluate each user’s timezone and chosen send time
- a once-daily single global trigger is not enough for multi-timezone delivery

What the scheduler does on each run:
- returns quickly after authenticating and starting a Netlify Background Function
- skips users whose setup is incomplete
- skips users whose briefs are paused
- skips users who already received a brief that local day
- sends only for users whose configured local brief time falls inside the current 15-minute scheduler window
- stops accepting new work before the background-function time limit so remaining users are safely reconsidered on the next run

### Netlify notes

The deployed scheduler should use Netlify Scheduled Functions, not Vercel Cron Jobs.

Before deploying, follow [`docs/launch-checklist.md`](docs/launch-checklist.md). In particular, set `APP_BASE_URL`, `CRON_SECRET`, and the AgentMail variables in Netlify, then run `npm run db:migrate` against the production database.

The `/api/cron/daily-briefs` route still exists for manual or authenticated server-to-server triggering, but Netlify Scheduled Functions should be the primary production scheduler.

## Current Launch Status

Already implemented:
- real auth with per-user workspaces
- Close Match, A Little Stretch, and Surprise Me discovery modes with fixed hard constraints
- structured role feedback that influences future matching
- pre-send listing verification and first-party source preference
- privacy-safe first-party product events with 90-day retention
- inbound AgentMail webhook handling
- outbound brief sending
- Tavily-backed discovery with shared public-query caching and no demo-job fallback
- role-aware studio with conditional work samples
- prompt memory and targeted pack editing
- Netlify scheduled-to-background delivery for daily briefs
- versioned production database migrations
- public liveness and protected database-readiness checks
- customer-facing Privacy and Terms pages

Launch decisions still owned outside the codebase:
- choose and integrate a payment provider before charging the £4.99 monthly founding-member price
- configure the public support email and confirm the operator identity and governing-law wording with appropriate legal advice
- verify the production provider credentials and complete one real-account delivery-and-reply test after deployment

## Verification

Useful checks during development:

```bash
npm run lint
npx tsc --noEmit
npm run build
node scripts/check-health.mjs
node scripts/check-scheduler.mjs
node scripts/check-migrations.mjs
node scripts/check-auth-security.mjs
```

## Local Design Review

Run the development server with `npm run dev -- --port 3100`, then open:

- `http://localhost:3100` for the interactive homepage.
- `http://localhost:3100/dashboard?mode=signin` for the sign-in experience.
- `http://localhost:3100/design-preview?state=onboarding` for setup.
- `http://localhost:3100/design-preview?state=waiting` for a scheduled brief.
- `http://localhost:3100/design-preview?state=brief` for role selection.
- `http://localhost:3100/design-preview?state=studio` for CVs and refinement.

The preview uses fictional, in-memory data with the real workspace components.
It needs no login or service credentials. Reloading resets its state; refinement
records instructions but does not rewrite example documents. Account changes and
CV imports are blocked. The route returns 404 outside development. It is not an
authentication bypass for real workspaces.

Repeatable checks (the browser check uses installed Google Chrome by default):

```bash
node scripts/check-workspace-logic.mjs
node scripts/check-experience.mjs
```

Set `TEST_BASE_URL`, `TEST_OUTPUT_DIR`, or `BROWSER_CHANNEL` to override browser
test defaults. Screenshots are written to `/tmp/hunteragent-experience`.
The checks cover local UI journeys, mocked auth errors, preview isolation,
self-managed applications, and fallback generation. They do not verify live
Supabase persistence, email delivery, paid AI generation, or Netlify deployment.
CV export uses the shared HTML renderer through the browser's Print / Save as
PDF dialog; printer-specific pagination still requires a final document review.

### Dream-job Homepage

The homepage is positioned for people who are happy in work but open to a
meaningful upgrade. Active job seekers can use the same flow. Setup captures
what would make a move worthwhile in the existing `specialPreferences` field,
which is already used by discovery; no database migration is needed.

`lib/dream-job-examples.ts` contains five manually researched employer-listing
snapshots. They are inspiration across different careers, not one person's
matches, an automatically refreshed feed, or affiliated employer promotions.
Each includes the exact role title, original URL, review date, requirements,
and practical considerations. These examples are not inserted into user briefs.
The Arctic example is a guiding role with photography responsibilities, not a
standalone photographer vacancy.

Before publishing or refreshing this collection, revisit every original
employer page. Replace or clearly mark closed listings, and update review dates
only after checking the source. Do not add salaries, visa support, or relocation
benefits without a supporting employer statement. The browser check validates
the demo's links and UI, not the continued availability of the external jobs.

### Discovery, Delivery, And Retention

Briefs contain up to three jobs. Users choose `discoveryCadence` (`daily` by
default, or `three-per-week`). Search cadence is separate from the
daily email delivery time. Discovery maintains an unseen candidate pool; emails
only contain genuine new matches. A sparse result set is not padded, and no
empty email is sent. Selecting a job does not automatically spend AI-writing
credits; preparing materials is an explicit dashboard action.

Suggestions, including selected-but-unapplied jobs, expire seven days after
first discovery. Selecting or re-discovering a job does not extend its lifetime.
Generated documents and applied records remain accessible separately. Original
email numbering is retained, and old replies cannot fall through to a newer
brief. Lightweight seen-job fingerprints suppress repeats for 30 days.

Persistent search caching and credit reservations require `DATABASE_URL`.
New discovery tables are initialized by the existing database setup. Only
public listing data is shared; user CVs, personal details and private ranking
preferences are not stored in the shared query cache. Search fails closed if
its database-backed credit reservation is unavailable.
The three new tables have row-level security enabled with no public policies;
the server connection must be their owner or have `BYPASSRLS`. The live
Supabase permissions and existing auth/workspace tables still need a separate
credentials-backed review before deployment.

Optional server-only cost controls (defaults):

```env
DISCOVERY_USER_DAILY_CREDITS=4
DISCOVERY_GLOBAL_DAILY_CREDITS=30
DISCOVERY_CACHE_TTL_SECONDS=86400
DISCOVERY_ENABLE_ADVANCED=true
```

Basic search runs first. An advanced search may fill a sparse result set within
the same credit caps. These are Tavily credit limits, not currency amounts or
guaranteed total-cost savings. Review the global cap against launch capacity.

### Dream-job Concept Film

The homepage leads with an 18-second cinematic hero retaining all four original
scenes: Arctic photographer/guide, ocean scientist, remote mountain-cabin work,
and a woman leading a Seoul board meeting. The original headline sequence and
closing copy are synchronized to the video using `media/what-if/story.json`, also
read by the full-film renderer. `timing.json` shares the 120 BPM beat grid, duration
and transition length with the soundtrack edit. The four career shots each run
three seconds (six beats), followed by a three-second reflection and three-second
closing. The reflection's lines enter together rather than slowly staggering.
Quarter-second dissolves replace hard cuts; the preview also dissolves back to
its opening frame before looping. Frame callbacks synchronize the HTML headlines
with displayed frames, with media-event fallback for older browsers.
Responsive HTML preserves the motion typography
without cropping it on mobile; the accessible heading stays stable. Staggered
line entrances and underlines respect reduced motion. The supporting AI-search
explanation and signup action stay visible throughout, including the end card.
The silent H.264 previews are 1,000,315 bytes at 1280x720 and 744,607 bytes at
540x960; only the matching format downloads. The JPEG poster is 96,849 bytes
and preloaded at high priority. The portrait export preserves the boardroom's
wide framing inside a fixed canvas, without changing the video element's size
or object-fit during playback. Viewers can see the meeting, not just its chairperson.
The video, full headline and signup action fit the initial viewport at tested sizes
from 320x568 to 1440x900. On shorter screens or enlarged text, content can grow
vertically rather than being clipped. Without JavaScript the poster and signup
link remain available.

The preview starts when at least 55% visible, loops muted, and has an accessible
pause control. Offscreen or hidden-tab playback detaches sources; a deliberate
pause retains the current frame and remains paused across reentry. Reduced-motion
preferences or blocked autoplay keep manual playback available. Unsupported
IntersectionObserver browsers get the poster and manual playback, not forced motion.

"Watch the film" opens the full 18-second version in a native modal dialog, with
landscape/portrait format selection, sound and native playback controls. There is
no visible transcript section; the descriptive video track remains available.
Its video source is not attached until that explicit action.
Opening it suspends the hero preview. Escape, the close button and backdrop dismiss
it, release media, restore page scrolling and return focus to the opener. The full
film never loops or restarts audible playback merely because a tab becomes visible.
There is no duplicate full-width film section below the hero. Files live in
`public/films/`.
The local media source and provenance manifest live in `media/what-if/`.
`node scripts/build-hero-film.mjs` rebuilds the preview with local FFmpeg from the
manifest's original clips (downloaded into a temporary cache). It makes no new
image/video generation requests. The four three-second scenes lead into the
two closing cards, then loop to the opening scene. Source downloads are keyed
by URL so replacing a scene invalidates both renderers' caches.

`node scripts/build-full-film.mjs` rebuilds both 18-second exports and updates
`media/what-if/render-source.zip`. It requires FFmpeg, zip/unzip and a Python
environment with Pillow (`FILM_PYTHON` can select that interpreter).
It retrieves the existing source clips and uses the editable renderer, bundled
font and licensed soundtrack. Production labels are not burned into either public
export; provenance remains in the manifest. No new paid generation is needed.

`node scripts/build-film-score.mjs` edits **Take this Higher** by **Michael Ramir C.**
from Mixkit. It starts within the established electronic drum groove, with a slight
tempo adjustment from 124 to 120 BPM for synchronization. Cuts land every six beats.
The master targets -16 LUFS / -1.5 dBTP with a short closing fade. This replaces
the rejected gentle piano/strings score, rather than simply accelerating it.
`music.json` contains the source URL, checksum and edit settings; see
`media/what-if/MUSIC-LICENSE.md` for license scope. Source audio is cached outside
the repo, and the intermediate WAV is excluded from git and the source archive.
The full-film builder automatically rebuilds the soundtrack with FFmpeg, without
macOS-specific audio dependencies. Finished landscape and portrait films contain
the synchronized music; the autoplay hero deliberately remains silent.

The proposed quick-introduction flow and close-match / adjacent-role mixer are
documented in `docs/curiosity-discovery-proposal.md`. They are not implemented and
must not be marketed as existing controls. Location and remote-region preferences
already exist in onboarding and settings.

Footage was generated through Higgsfield with Kling 3.0. Still requests used
`nano_banana_pro`; Higgsfield reported the finished images as `nano_banana_2`,
so they are not represented as confirmed Pro-model output. The Fable 5.1 launch
film was analyzed for pacing and graphic inserts only. No source footage,
music, presenter, branding or script was copied. Typography is rendered
deterministically rather than generated inside the footage. The soundtrack
is licensed from Mixkit, not music copied from the reference.
Scenes are not advertised vacancies.

Additional regression checks:

```bash
node scripts/check-retention.mjs
node scripts/check-discovery.mjs
node scripts/check-film.mjs
```

### Task-Based AI And Spending Controls

Tasks have distinct model budgets rather than an autonomous daily agent loop:

- Tavily finds public job listings; code applies occupation, workplace, employer,
  employment and explicit geographic compatibility filters before any AI ranking.
- Haiku evaluates at most 12 new candidates in one batch. Scores, source excerpts,
  preference excerpts, and tradeoffs are validated against supplied data. It cannot
  invent job IDs or evidence. Assessed candidates below 60 are not sent; unassessed
  overflow is held for a later batch rather than padding an AI-ranked shortlist.
- Sonnet groups stated dream-move preferences on first use and after preferences
  change. This interpretation is privately cached for up to 30 days, not regenerated
  every day. Matching assessments are reused while criteria, source and model match.
- Sonnet writes/refines application materials only after an explicit user request.
  A five-minute response cache absorbs duplicate requests. Haiku writes short
  follow-ups with a seven-day cache.
- Brief emails, numeric replies, scheduling, retention, login and exports stay
  deterministic. Ambiguous replies still request clarification, not AI actions.

Server-only settings, with defaults:

```env
AI_ENABLED=true
AI_USER_DAILY_CENTS=100
AI_GLOBAL_DAILY_CENTS=1000
```

These are conservative **reservation ceilings**, $1/user/day and $10/site/day,
not actual-billing reports. Each request reserves estimated maximum input/output
cost, rounded up to a cent, in an atomic database transaction before contacting
Anthropic. UTF-8 byte counts plus framing allowance deliberately overestimate
text input tokens; output caps range from 400 to 2,500 tokens. Thinking is disabled
explicitly. Prices use standard API rates checked on 2026-09-02 and must be reviewed
when changing models or provider pricing. These caps exclude Tavily, email, hosting,
and calls from other software using the same API account. Set a provider-level
spending limit too. UTC midnight resets the counters. Failed/ambiguous requests
retain their reservations, and are not automatically retried.

Setting either cap to `0` disables paid calls within that scope. Invalid values
fail closed. `AI_ENABLED=false` disables AI entirely without disabling the product.
Missing identity, database, unsupported model or oversized prompts also use the
non-AI fallback. Unknown model IDs are denied until their compatibility/prices are
added to `lib/hunteragent-ai.ts`. Legacy `ANTHROPIC_MODEL` remains a materials-only
override; set `ANTHROPIC_MATERIALS_MODEL` explicitly to move a deployment to Sonnet 5.

AI outputs live in a separate per-user cache, never the shared public search cache.
Both new AI tables have RLS enabled with no public policies; only the server database
connection can access them. User deletion cascades cached responses. Scheduled
cleanup removes responses and counters after 30 days. Source snippets, profiles,
CVs, raw responses and provider error bodies are not written to AI logs.

If AI is unavailable, filtered deterministic matching and fact-based document
templates remain available. Existing documents are never overwritten by a failed
refinement; its prompt stays as a draft, not a successful history entry. Matching
explanations are evidence-linked assessments, not guarantees about eligibility.

New verification:

```bash
node scripts/check-ai.mjs
node scripts/check-ai-storage.mjs
node scripts/check-match-filters.mjs
```

These use fake profiles and mocked providers/database operations. Before launch,
check a real Supabase migration, actual model access/latency and a small consented
matching-quality sample on Netlify. No live paid AI calls are made by these tests.
Model references: [Anthropic model overview](https://platform.claude.com/docs/en/models/overview)
and [Sonnet 5 behavior changes](https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5).
